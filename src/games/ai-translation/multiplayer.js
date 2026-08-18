const READY_MESSAGE = "문장을 해석할 준비가 되셨으면 네라고 해 주세요.";

const normalizeReadyAnswer = value => String(value || "").trim().replace(/[.!?\s]/g, "");
const restoreSentence = value => String(value || "").split("/").map(part => part.trim()).filter(Boolean).join(" ").replace(/\s+([.,!?;:])/g, "$1");

export function createAiTranslationMultiplayer({ root = document, judge, updateScore, onFinished }) {
  let state = null;

  function ensureView() {
    let overlay = root.getElementById("ai-multi-overlay");
    if (overlay) return overlay;
    overlay = root.createElement("div");
    overlay.id = "ai-multi-overlay";
    overlay.className = "ai-multi-overlay";
    overlay.hidden = true;
    overlay.innerHTML = `
      <section class="ai-multi-dialog" role="dialog" aria-modal="true" aria-labelledby="ai-multi-title">
        <header><div><span>AI TRANSLATION</span><h2 id="ai-multi-title">AI 문장 해석하기</h2></div><div class="ai-multi-status"><strong id="ai-multi-score">0문장 정답</strong><strong id="ai-multi-timer">00:00</strong></div></header>
        <div id="ai-multi-correct-effect" class="ai-multi-correct-effect" aria-hidden="true"><span>✓</span><strong>정답!</strong></div>
        <div id="ai-multi-log" class="ai-multi-log" role="log" aria-live="polite"></div>
        <form id="ai-multi-form" class="ai-multi-compose"><input id="ai-multi-input" maxlength="1000" autocomplete="off" placeholder="답변을 입력하세요" /><button type="submit">보내기</button></form>
      </section>`;
    root.body.appendChild(overlay);
    overlay.querySelector("form").addEventListener("submit", event => { event.preventDefault(); submit(); });
    return overlay;
  }

  function addMessage(role, text, kind = "") {
    const item = root.createElement("div");
    item.className = `ai-multi-message ${role} ${kind}`.trim();
    item.innerText = text;
    const log = root.getElementById("ai-multi-log");
    log.appendChild(item); log.scrollTop = log.scrollHeight;
  }

  function showQuestion() {
    const sentence = state.sentences[state.index];
    addMessage("assistant", restoreSentence(sentence.en), "question");
  }

  function showCorrectEffect() {
    const effect = root.getElementById("ai-multi-correct-effect");
    const dialog = root.querySelector(".ai-multi-dialog");
    if (!effect || !dialog) return;
    dialog.classList.remove("is-correct"); effect.classList.remove("show");
    void effect.offsetWidth;
    dialog.classList.add("is-correct"); effect.classList.add("show");
    setTimeout(() => { dialog.classList.remove("is-correct"); effect.classList.remove("show"); }, 850);
  }

  function renderScore() {
    const score = root.getElementById("ai-multi-score");
    if (score && state) score.innerText = `${state.score}문장 정답`;
  }

  function finish() {
    if (!state || state.finished) return;
    state.finished = true; clearInterval(state.timer);
    const input = root.getElementById("ai-multi-input");
    input.disabled = true; input.placeholder = "게임이 종료되었습니다.";
    root.querySelector("#ai-multi-form button").disabled = true;
    addMessage("assistant", `게임이 끝났습니다. 맞힌 문장은 ${state.score}개입니다.`, "finished");
    onFinished?.(state.score);
  }

  async function submit() {
    if (!state || state.busy || state.finished) return;
    const input = root.getElementById("ai-multi-input");
    const answer = input.value.trim();
    if (!answer) return;
    input.value = ""; addMessage("user", answer);
    if (!state.ready) {
      if (normalizeReadyAnswer(answer) !== "네") {
        addMessage("assistant", READY_MESSAGE);
        return;
      }
      state.ready = true; showQuestion(); return;
    }
    state.busy = true; input.disabled = true;
    const button = root.querySelector("#ai-multi-form button"); button.disabled = true; button.innerText = "채점 중…";
    try {
      const sentence = state.sentences[state.index];
      state.attempts += 1;
      const result = await judge({ sentence: restoreSentence(sentence.en), reference: String(sentence.ko || "").split("/").map(v => v.trim()).join(" "), answer, attempt: state.attempts });
      addMessage("assistant", result.feedback, result.verdict);
      if (result.verdict === "correct") {
        state.score += 1; state.attempts = 0; renderScore(); showCorrectEffect();
        await updateScore?.(state.score);
        state.index = (state.index + 1) % state.sentences.length;
        const activeState = state;
        await new Promise(resolve => setTimeout(resolve, 650));
        if (state === activeState && !state.finished) showQuestion();
      }
    } catch (error) {
      console.error("AI translation judging failed", error);
      addMessage("assistant", "AI 채점 연결이 잠시 불안정합니다. 같은 해석을 다시 보내 주세요.", "retry");
    } finally {
      state.busy = false;
      if (!state.finished) { input.disabled = false; button.disabled = false; button.innerText = "보내기"; input.focus(); }
    }
  }

  function start({ sentences, endTime }) {
    if (state && !state.finished && Number(state.endTime) === Number(endTime)) return;
    stop();
    const valid = (sentences || []).filter(item => String(item.en || "").trim() && String(item.ko || "").trim());
    if (!valid.length) throw new Error("AI 해석에 사용할 문장이 없습니다.");
    state = { sentences: valid.sort(() => Math.random() - .5), index: 0, score: 0, attempts: 0, ready: false, busy: false, finished: false, endTime, timer: null };
    const overlay = ensureView(); overlay.hidden = false;
    root.getElementById("ai-multi-log").innerHTML = "";
    const input = root.getElementById("ai-multi-input"); input.disabled = false;
    const button = root.querySelector("#ai-multi-form button"); button.disabled = false; button.innerText = "보내기";
    renderScore();
    addMessage("assistant", READY_MESSAGE);
    const tick = () => {
      const remaining = Math.max(0, Math.ceil((state.endTime - Date.now()) / 1000));
      root.getElementById("ai-multi-timer").innerText = `${String(Math.floor(remaining / 60)).padStart(2,"0")}:${String(remaining % 60).padStart(2,"0")}`;
      if (!remaining) finish();
    };
    tick(); state.timer = setInterval(tick, 250); input.focus();
  }

  function stop() {
    if (state?.timer) clearInterval(state.timer);
    const overlay = root.getElementById("ai-multi-overlay"); if (overlay) overlay.hidden = true;
    state = null;
  }
  return { start, stop, finish };
}

export { READY_MESSAGE, restoreSentence };
