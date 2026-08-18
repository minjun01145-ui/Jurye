import { createSimpleQuizEngine } from "../simple-quiz/engine.js";

export const TUG_DURATION_MS = 3 * 60 * 1000;
export const TUG_KO_LEAD = 20;

export function assignBalancedTeams(players, random = Math.random) {
  const shuffled = [...players];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled.map((player, index) => ({ ...player, team: index % 2 === 0 ? "blue" : "red" }));
}

export function getTugResult(bluePower, redPower, timedOut = false) {
  const lead = Number(bluePower || 0) - Number(redPower || 0);
  if (Math.abs(lead) >= TUG_KO_LEAD) return { result: lead > 0 ? "blue" : "red", reason: "ko" };
  if (!timedOut) return null;
  return { result: lead === 0 ? "draw" : lead > 0 ? "blue" : "red", reason: "time" };
}

export function clampTugLead(lead) {
  return Math.max(-TUG_KO_LEAD, Math.min(TUG_KO_LEAD, Number(lead) || 0));
}

function formatRemaining(endsAt) {
  const seconds = Math.max(0, Math.ceil((Number(endsAt || 0) - Date.now()) / 1000));
  return `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
}

function boardMarkup(role) {
  return `<section class="tug-board tug-${role}" aria-label="줄다리기 현황">
    <div class="tug-teams"><div class="tug-blue"><b>BLUE TEAM</b><span data-tug-blue-count>0명</span></div><div class="tug-red"><b>RED TEAM</b><span data-tug-red-count>0명</span></div></div>
    <div class="tug-track"><div class="tug-center"></div><div class="tug-rope" data-tug-rope><span></span></div></div>
    <div class="tug-score"><b class="tug-blue">BLUE <span data-tug-blue>0</span></b><strong data-tug-time>03:00</strong><b class="tug-red">RED <span data-tug-red>0</span></b></div>
    <div class="tug-state" data-tug-state>PLAYING</div>
  </section>`;
}

export function createTugOfWarGame({ gameData, lobbyData, contributePower, finishRound, buildQuestions, playSound = () => {} }) {
  let roomUnsubscribe = null;
  let timer = null;
  let studentRoot = null;
  let teacherRoot = null;
  let answerLocked = false;
  let questionSerial = 0;
  let activeRoundId = null;
  let activeUserId = null;
  let engine = null;
  let teacherFinishing = false;
  let latestTeacherRoom = null;
  let finishedNotified = false;

  function renderBoard(root, room) {
    if (!root) return;
    const blue = Number(room.bluePower || 0), red = Number(room.redPower || 0);
    root.querySelector("[data-tug-blue]").textContent = blue;
    root.querySelector("[data-tug-red]").textContent = red;
    root.querySelector("[data-tug-blue-count]").textContent = `${Number(room.blueTeamCount || 0)}명`;
    root.querySelector("[data-tug-red-count]").textContent = `${Number(room.redTeamCount || 0)}명`;
    root.querySelector("[data-tug-time]").textContent = formatRemaining(room.tugEndsAt);
    const percent = clampTugLead(blue - red) / TUG_KO_LEAD * 45;
    root.querySelector("[data-tug-rope]").style.transform = `translateX(${percent}%)`;
    const state = root.querySelector("[data-tug-state]");
    state.textContent = room.tugStatus === "finished"
      ? room.tugResult === "draw" ? "DRAW" : `${room.tugResult === "blue" ? "🔵 BLUE" : "🔴 RED"} TEAM WIN!`
      : "PLAYING";
    state.classList.toggle("is-finished", room.tugStatus === "finished");
  }

  function renderQuestion() {
    if (!studentRoot || !engine) return;
    const round = engine.nextQuestion();
    const area = studentRoot.querySelector("[data-tug-question]");
    if (!round) { area.innerHTML = "<p>출제할 수 있는 문제가 부족합니다.</p>"; return; }
    answerLocked = false;
    questionSerial++;
    area.innerHTML = `<div class="tug-prompt"></div><div class="tug-choices"></div><p data-tug-feedback></p>`;
    area.querySelector(".tug-prompt").textContent = round.question.en;
    const choices = area.querySelector(".tug-choices");
    round.choices.forEach(choice => {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = choice.text;
      button.addEventListener("click", async () => {
        if (answerLocked) return;
        answerLocked = true;
        choices.querySelectorAll("button").forEach(item => { item.disabled = true; });
        const feedback = area.querySelector("[data-tug-feedback]");
        if (choice.correct) {
          playSound("success");
          const token = `${activeRoundId}:${questionSerial}`;
          try {
            await contributePower({ documentId: activeUserId, roundId: activeRoundId, answerToken: token });
            feedback.textContent = "정답! 팀이 줄을 당겼습니다.";
          } catch (error) {
            console.error("줄다리기 점수 반영 실패", error);
            feedback.textContent = "점수 반영에 실패했습니다. 다음 문제를 진행합니다.";
          }
          setTimeout(renderQuestion, 500);
        } else {
          playSound("wrong");
          feedback.textContent = `오답입니다. 정답: ${round.question.ko}`;
          setTimeout(renderQuestion, 900);
        }
      });
      choices.appendChild(button);
    });
  }

  function stop() {
    if (roomUnsubscribe) roomUnsubscribe();
    roomUnsubscribe = null;
    if (timer) clearInterval(timer);
    timer = null;
    studentRoot?.remove();
    if (teacherRoot) teacherRoot.innerHTML = "";
    studentRoot = teacherRoot = null;
    engine?.reset();
    engine = null;
    activeRoundId = activeUserId = null;
    answerLocked = false;
    teacherFinishing = false;
    latestTeacherRoom = null;
    finishedNotified = false;
  }

  async function startStudent({ room, userId, questions, onFinished }) {
    stop();
    activeRoundId = room.tugRoundId;
    activeUserId = userId;
    engine = createSimpleQuizEngine({ getQuestions: () => questions });
    const userSnap = await lobbyData.getUserLite(userId);
    const team = userSnap.data()?.tugTeam;
    studentRoot = document.createElement("div");
    document.querySelectorAll(".screen.active").forEach(screen => screen.classList.remove("active"));
    studentRoot.id = "tugofwar-screen";
    studentRoot.className = "screen active tug-screen";
    studentRoot.innerHTML = `<main class="tug-student"><h1>줄다리기</h1><div class="tug-my-team tug-${team}">나의 팀: ${String(team || "").toUpperCase()}</div>${boardMarkup("student")}<div class="tug-question" data-tug-question></div></main>`;
    document.body.appendChild(studentRoot);
    renderBoard(studentRoot, room);
    renderQuestion();
    roomUnsubscribe = gameData.subscribe("multiRoom", snap => {
      if (!snap.exists()) return;
      const next = snap.data();
      if (next.tugRoundId !== activeRoundId) return;
      renderBoard(studentRoot, next);
      if (next.tugStatus === "finished") {
        answerLocked = true;
        studentRoot.querySelectorAll(".tug-question button").forEach(button => { button.disabled = true; });
        onFinished?.(next);
      }
    });
    timer = setInterval(() => {
      const time = studentRoot?.querySelector("[data-tug-time]");
      if (time) time.textContent = formatRemaining(room.tugEndsAt);
    }, 250);
  }

  function startTeacher({ room, container, onFinished }) {
    if (activeRoundId === room.tugRoundId && teacherRoot === container) {
      latestTeacherRoom = room;
      renderBoard(teacherRoot, room);
      return;
    }
    stop();
    activeRoundId = room.tugRoundId;
    latestTeacherRoom = room;
    teacherRoot = container;
    teacherRoot.style.display = "block";
    teacherRoot.innerHTML = boardMarkup("teacher");
    const inspect = async next => {
      latestTeacherRoom = next;
      if (next.tugRoundId !== activeRoundId) return;
      renderBoard(teacherRoot, next);
      if (next.tugStatus === "finished") {
        if (!finishedNotified) {
          finishedNotified = true;
          onFinished?.(next);
        }
        return;
      }
      const result = getTugResult(next.bluePower, next.redPower, Date.now() >= Number(next.tugEndsAt || 0));
      if (result && !teacherFinishing) {
        teacherFinishing = true;
        try { await finishRound(activeRoundId, result.result, result.reason); }
        finally { teacherFinishing = false; }
      }
    };
    inspect(room);
    roomUnsubscribe = gameData.subscribe("multiRoom", snap => { if (snap.exists()) inspect(snap.data()); });
    timer = setInterval(() => inspect(latestTeacherRoom), 250);
  }

  return { startStudent, startTeacher, stop, isActiveRound: roundId => activeRoundId === roundId };
}
