// ==========================================
// 1. 파이어베이스 세팅
// ==========================================
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-app.js";
import { getFirestore, doc, setDoc, getDoc, collection, addDoc, getDocs, onSnapshot, query, orderBy, limit, where, deleteDoc } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyAh3e5ruxctlhv-OwBAQl5WDds0IZooPD0", authDomain: "test2222-e2458.firebaseapp.com",
  projectId: "test2222-e2458", storageBucket: "test2222-e2458.firebasestorage.app",
  messagingSenderId: "848561047931", appId: "1:848561047931:web:ec05133741eb2a6ce195de", measurementId: "G-HV5RS45JG3"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// ==========================================
// 2. 단일 원본 전역 변수들
// ==========================================
let wordSets = []; let studentList = []; let wordList = []; let unknownWordsHistory = [];
let gameTimerInterval; let cdInterval; let gameTimeRemaining = 0; let gameScore = 0; let lastMatchTime = 0;
let currentGameMode = ""; let currentRankingMode = ""; let globalScoreMultiplier = 1; let isGamePaused = false; let isFishing = false; let fcIsRandom = false;  
let currentSetId = null; let currentSetTitle = ""; 
let isWordHidden = false; let isMeanHidden = false; let starData = {};
let currentUser = { stdId: "", realName: "", classId: "", nickname: "", emoji: "", score: 0, caughtEmojis: "" };
let currentEditingSetId = null; 

// 라이브 멀티플레이 전용 상태 변수
let currentLiveStatus = "lobby"; // lobby, practice, playing, ended
let lobbyUnsubUsers = null; let lobbyUnsubChat = null; let liveStateUnsub = null; let liveScoresUnsub = null;
let liveGameTimeRemaining = 0;

const allEmojis = ["🎮", "🕹️", "🎲", "🎯", "🐶", "🐱", "🍓", "😎", "🤩", "🚀", "🌟", "🔥", "🦄", "🍀", "🍔", "👽","😀","😂","😍","🥳","👻","🤡","🤗","🤔","🤐","🐭","🐹","🐰","🦊","🐻","🐼","🐨","🐯","🦁","🐮","🐷","🐸","🐵","🐧","🐤","🦆","🦉","🦇","🐺","🐝","🦋","🐢","🐍","🦖","🐙","🦑","🦀","🐠","🐬","🐳","🦈","🐅","🦓","🦍","🐘","🐫","🦒","🦘","🐎","🐏","🐐","🦌","🐕","🐈","🦚","🦜","🦢","🦩","🕊","🦝","🦨","🦥","🐿","🦔","🐉","🍎","🍊","🍋","🍌","🍉","🍇","🫐","🍒","🍑","🍍","🥥","🥝","🍅","🥑","🥦","🥒","🌶","🌽","🥕","🥔","🍠","🥐","🍞","🥨","🧀","🍳","🥞","🥓","🥩","🍗","🌭","🍟","🍕","🥪","🌮","🥗","🍣","🍱","🥟","🍤","🍙","🍚","🍧","🍦","🍰","🎂","🍭","🍬","🍫","🍩","🍪","🍯","🍼","☕️","🧃","🥤","🍺","🍻","🥂","🍷","🥃","🧊","⚽️","🏀","🏈","⚾️","🎾","🏐","🏓","🏸","🥊","🛹","⛸","🎿","🏂","🏋️","🏄","🏊","🚴","🏆","🥇","🏅","🎟","🎪","🎭","🎨","🎬","🎤","🎧","🎹","🥁","🎸","🎳","🎰","🧩","🚗","🚓","🚑","🚒","🚜","🚲","🛵","🏍","✈️","🚁","⛵️","🛳","🗺","🗽","🏰","🎡","🎢","⛺️","🏠","🏢","🏥","🏦","🏫","⛪️","🌅","🌌","⌚️","📱","💻","⌨️","🖥","📷","📸","🎥","📞","☎️","📺","📻","⏱","⏰","⏳","💡","💸","💵","💰","💳","💎","🛠","🔫","💣","🪄"];
const praises = ["Fabulous!", "Terrific!", "Awesome!", "Incredible!", "Great Job!", "Perfect!"];
const modeNames = { "fc": "🃏 깜빡이", "memory": "🔠 메모리", "speed-match": "🧩 짝맞추기", "speed": "⚡ 스피드퀴즈", "fish": "🎣 낚시", "exam1": "📝 순서맞추기", "exam2": "✍️ 직접쓰기" };

let examQueue = []; let examCurrentIndex = 0; let examWords = []; let examSlots = [];
let fcQueue = []; let fcCurrent = null; let fcStartTime = 0; let fcKnown = 0; let fcIsFlipped = false; let fcIsAnimating = false; let fcScore = 0; let cardAppearTime = 0; let isRetryPhase = false; let hasFlippedToCheck = false; 
let memoryRound = 1; let memoryPairsFound = 0; let memoryFlipped = []; 
let smRound = 1; let smPairsFound = 0; let smSelected = []; 
let sqCurrentWord = null;
let fishCards = []; let fishSelected = []; let fishEmojisCaught = 0; let lastFrameTime = 0; let caughtEmojisList = [];

// ==========================================
// 3. UI 및 오디오 설정 (BGM 제거 완료)
// ==========================================
const pastelColors = [{ hex: "#FFE4E1" }, { hex: "#FFF0E6" }, { hex: "#FFFACD" }, { hex: "#E8F8F5" }, { hex: "#E1F5FE" }, { hex: "#F3E5F5" }, { hex: "#FBE9E7" }, { hex: "#E0F2F1" }, { hex: "#FCF3CF" }, { hex: "#E8EAF6" }];
document.body.style.backgroundColor = pastelColors[Math.floor(Math.random() * pastelColors.length)].hex;

let globalAudioCtx = null;
function getAudioCtx() { if (!globalAudioCtx) { const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return null; globalAudioCtx = new AC(); } if (globalAudioCtx.state === "suspended") globalAudioCtx.resume(); return globalAudioCtx; }
function playSound(type) {
  try {
    const ctx = getAudioCtx(); if (!ctx || isMuted) return;
    const osc = ctx.createOscillator(); const gainNode = ctx.createGain(); osc.connect(gainNode); gainNode.connect(ctx.destination);
    if (type === "click") { osc.type = "sine"; osc.frequency.setValueAtTime(600, ctx.currentTime); osc.frequency.exponentialRampToValueAtTime(800, ctx.currentTime + 0.1); gainNode.gain.setValueAtTime(0.1, ctx.currentTime); osc.start(); osc.stop(ctx.currentTime + 0.1); }
    else if (type === "wrong") { osc.type = "sawtooth"; osc.frequency.setValueAtTime(150, ctx.currentTime); gainNode.gain.setValueAtTime(0.1, ctx.currentTime); osc.start(); osc.stop(ctx.currentTime + 0.2); }
    else if (type === "success") {
      osc.type = "sine"; osc.frequency.setValueAtTime(659.25, ctx.currentTime); gainNode.gain.setValueAtTime(0.1, ctx.currentTime); gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.25); osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.25);
      const osc2 = ctx.createOscillator(); const gain2 = ctx.createGain(); osc2.connect(gain2); gain2.connect(ctx.destination); osc2.type = "sine"; osc2.frequency.setValueAtTime(523.25, ctx.currentTime + 0.2); gain2.gain.setValueAtTime(0.1, ctx.currentTime + 0.2); gain2.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.6); osc2.start(ctx.currentTime + 0.2); osc2.stop(ctx.currentTime + 0.6);
    } else if (type === "treasure") { osc.type = "square"; osc.frequency.setValueAtTime(400, ctx.currentTime); osc.frequency.exponentialRampToValueAtTime(800, ctx.currentTime + 0.3); gainNode.gain.setValueAtTime(0.1, ctx.currentTime); osc.start(); osc.stop(ctx.currentTime + 0.3); }
  } catch(e) {}
}

function showScreen(screenId) { document.querySelectorAll(".screen").forEach((s) => { s.style.display = "none"; s.classList.remove("active"); }); if (screenId) { const screen = document.getElementById(screenId); if(screen) { screen.style.display = "flex"; screen.classList.add("active"); } } }
function bindClick(id, callback) { const el = document.getElementById(id); if (el) el.onclick = callback; }

const emojiContainer = document.getElementById("emoji-container");
if(emojiContainer) {
  const shuffledEmojis = allEmojis.sort(() => 0.5 - Math.random()).slice(0, 10);
  shuffledEmojis.forEach((emoji) => {
    const btn = document.createElement("button"); btn.className = "emoji-btn"; btn.innerText = emoji;
    btn.onclick = () => { document.querySelectorAll(".emoji-btn").forEach((b) => b.classList.remove("selected")); btn.classList.add("selected"); currentUser.emoji = emoji; playSound("click"); }; emojiContainer.appendChild(btn);
  });
}
bindClick("mute-btn", () => { isMuted = !isMuted; document.getElementById("mute-btn").innerText = isMuted ? "🔇" : "🔊"; playSound("click"); });

function resetGameStates() {
  clearInterval(gameTimerInterval); clearInterval(cdInterval); isFishing = false; isGamePaused = false; gameScore = 0; globalScoreMultiplier = 1; currentUser.caughtEmojis = ""; currentLiveStatus = "lobby";
  ["game-countdown-overlay", "huge-countdown-overlay", "treasure-overlay", "sq-penalty-overlay", "buff-msg-overlay"].forEach(id => { let el = document.getElementById(id); if(el) el.style.display = "none"; });
  ["pile-double_current", "pile-half_current", "pile-double_future"].forEach(id => { let el = document.getElementById(id); if(el) el.innerHTML = ""; });
}

bindClick("close-modal-btn", () => { document.getElementById("unknown-modal").style.display = "none"; });
bindClick("back-to-menu-btn", () => { 
  playSound("click"); document.getElementById("top-left-controls").style.display = "none"; document.getElementById("unknown-modal").style.display = "none"; resetGameStates(); 
  // 만약 라이브 상태에서 나간다면 로비에서 아예 퇴장시킵니다.
  if(liveStateUnsub) { leaveLobby(); } else { showScreen("menu-screen"); }
});
bindClick("home-btn", () => { playSound("click"); showScreen("hub-screen"); }); 

// ==========================================
// 4. 로그인 및 DB 로드
// ==========================================
async function loadAllFromDB() {
  try {
    const setSnap = await getDoc(doc(db, "gameData", "wordSets")); if (setSnap.exists()) wordSets = setSnap.data().sets || [];
    const stdSnap = await getDoc(doc(db, "gameData", "students")); if (stdSnap.exists()) studentList = stdSnap.data().students || [];
  } catch (error) { console.error("DB 로딩 에러:", error); }
}
loadAllFromDB(); 

bindClick("auth-btn", () => {
  playSound("click"); const inputId = document.getElementById("auth-id").value.trim(); const inputName = document.getElementById("auth-name").value.trim();
  if(!inputId || !inputName) return alert("학번과 이름을 모두 적어주세요!");
  const matchedStudent = studentList.find(s => s.stdId === inputId && s.name === inputName);
  if (matchedStudent) { currentUser.stdId = inputId; currentUser.realName = inputName; currentUser.classId = inputId.substring(0, 2); showScreen("login-screen"); } 
  else { alert("데이터베이스에 없는 학번이거나 이름이 틀렸습니다!"); }
});

bindClick("login-btn", () => {
  playSound("click"); const nick = document.getElementById("nickname").value.trim();
  if (!nick || !currentUser.emoji) return alert("닉네임과 이모지를 모두 골라주세요!");
  currentUser.nickname = nick; document.getElementById("user-display").innerText = `${currentUser.emoji} ${currentUser.nickname}`;
  showScreen("hub-screen"); // 로그인 완료 후 허브로 이동!
});

// ==========================================
// 🌟 5. 허브(HUB) 화면 (싱글 / 멀티 / 관리자)
// ==========================================
bindClick("btn-singleplayer", () => {
  playSound("click");
  if (wordSets.length === 0) return alert("현재 등록된 학습 세트가 없습니다! 관리자 설정에서 세트를 만들어주세요.");
  renderSetSelectList(); showScreen("set-select-screen");
});

bindClick("btn-multiplayer", () => { playSound("click"); enterLobby(); });

bindClick("btn-hub-admin", () => {
  playSound("click"); const pwd = prompt("관리자 비밀번호 4자리를 입력하세요.", "");
  if (pwd === "1234") showScreen("admin-main-screen"); else if (pwd !== null) alert("비밀번호가 틀렸습니다!");
});

// 싱글플레이 세트 버튼 생성
const setBtnColors = [ { bg: "#FFCDD2", shadow: "#E57373", color: "#333" }, { bg: "#F8BBD0", shadow: "#F06292", color: "#333" }, { bg: "#E1BEE7", shadow: "#BA68C8", color: "#333" }, { bg: "#D1C4E9", shadow: "#9575CD", color: "#333" }, { bg: "#C5CAE9", shadow: "#7E57C2", color: "#333" }, { bg: "#BBDEFB", shadow: "#64B5F6", color: "#333" }, { bg: "#B3E5FC", shadow: "#4FC3F7", color: "#333" }, { bg: "#B2EBF2", shadow: "#4DD0E1", color: "#333" }, { bg: "#B2DFDB", shadow: "#4DB6AC", color: "#333" }, { bg: "#C8E6C9", shadow: "#81C784", color: "#333" }, { bg: "#DCEDC8", shadow: "#AED581", color: "#333" }, { bg: "#FFF9C4", shadow: "#FBC02D", color: "#333" }, { bg: "#FFECB3", shadow: "#FFCA28", color: "#333" }, { bg: "#FFE0B2", shadow: "#FFB300", color: "#333" }, { bg: "#FFCCBC", shadow: "#FF8A65", color: "#333" } ];
function renderSetSelectList() {
  const container = document.getElementById("set-select-list"); container.innerHTML = "";
  wordSets.forEach(set => {
    const btn = document.createElement("button"); btn.style.width = "100%"; btn.style.margin = "0"; 
    let randColor = setBtnColors[Math.floor(Math.random() * setBtnColors.length)];
    btn.style.backgroundColor = randColor.bg; btn.style.boxShadow = `0 5px 0 ${randColor.shadow}`; btn.style.color = randColor.color;
    btn.innerHTML = `${set.title} <br><span style="font-size:16px;">(단어 ${set.words.length}개)</span>`;
    btn.onclick = () => { playSound("click"); if(set.words.length < 4) return alert("단어가 4개 미만이라 게임을 할 수 없어요!"); wordList = set.words; currentSetId = set.id; currentSetTitle = set.title; showScreen("menu-screen"); };
    container.appendChild(btn);
  });
}
bindClick("set-select-back-to-hub-btn", () => { playSound("click"); showScreen("hub-screen"); });
bindClick("menu-go-back-set-btn", () => { playSound("click"); showScreen("set-select-screen"); });
bindClick("admin-main-close-btn", () => { playSound("click"); showScreen("hub-screen"); });

// ==========================================
// 🌟 6. 라이브 멀티플레이 시스템 (학생 관점)
// ==========================================
let liveGameConfig = { mode: "", time: 0, items: false, teamMode: "indiv", setId: "" };

async function enterLobby() {
  if (wordSets.length === 0) return alert("서버에 등록된 단어장이 없습니다. 선생님께 문의하세요.");
  showScreen("lobby-screen");
  
  // 1. 내 상태를 온라인으로 기록
  try { await setDoc(doc(db, "lobby_users", currentUser.stdId), { stdId: currentUser.stdId, nickname: currentUser.nickname, emoji: currentUser.emoji, online: true, lastActive: Date.now() }); } catch(e) {}

  // 2. 접속자 & 채팅 리스너 시작
  startLobbyListeners();

  // 3. 🌟 가장 중요한 관리자 상태(State) 리스너 시작!
  liveStateUnsub = onSnapshot(doc(db, "gameData", "liveRoom"), (docSnap) => {
    if(docSnap.exists()) {
      let data = docSnap.data();
      liveGameConfig = data;

      // 대기실 UI 텍스트 업데이트
      let setText = wordSets.find(s=>s.id === data.setId)?.title || "세트 미정";
      let modeText = modeNames[data.mode] || "미정";
      document.getElementById("lobby-game-info").innerHTML = `종목: <b>${modeText}</b> <br>시간: <b>${data.time/60}분</b> / <b>${data.teamMode==='indiv'?'개인전':'팀전'}</b> <br>단어장: <b>${setText}</b> <br>아이템: <b>${data.items?'사용함':'없음'}</b>`;

      // 🌟 상태 변화 감지 및 강제 화면 전환 로직
      if (data.status === "practice" && currentLiveStatus !== "practice") {
        currentLiveStatus = "practice";
        startLivePractice(data);
      } else if (data.status === "playing" && currentLiveStatus !== "playing") {
        currentLiveStatus = "playing";
        startLiveMainGame(data);
      } else if (data.status === "ended" && currentLiveStatus !== "ended") {
        currentLiveStatus = "ended";
        endLiveGame();
      } else if (data.status === "lobby" && currentLiveStatus !== "lobby") {
        currentLiveStatus = "lobby";
        showScreen("lobby-screen");
      }
    }
  });
}

function startLobbyListeners() {
  const qUsers = query(collection(db, "lobby_users"), where("online", "==", true));
  lobbyUnsubUsers = onSnapshot(qUsers, (snap) => { let users = []; snap.forEach(d => users.push(d.data())); renderLobbyUsers(users); });
  const qChat = query(collection(db, "lobby_chat"), orderBy("timestamp", "desc"), limit(50));
  lobbyUnsubChat = onSnapshot(qChat, (snap) => { let msgs = []; snap.forEach(d => msgs.push(d.data())); msgs.reverse(); renderLobbyChat(msgs, "lobby-chat-box"); renderLobbyChat(msgs, "admin-lobby-chat-box"); });
}

async function leaveLobby() {
  if (lobbyUnsubUsers) { lobbyUnsubUsers(); lobbyUnsubUsers = null; }
  if (lobbyUnsubChat) { lobbyUnsubChat(); lobbyUnsubChat = null; }
  if (liveStateUnsub) { liveStateUnsub(); liveStateUnsub = null; }
  try { await setDoc(doc(db, "lobby_users", currentUser.stdId), { online: false }, { merge: true }); } catch(e) {}
  showScreen("hub-screen");
}
bindClick("lobby-leave-btn", () => { playSound("click"); leaveLobby(); });

function sendChat(inputId) {
  const inputEl = document.getElementById(inputId); const text = inputEl.value.trim(); if(!text) return; inputEl.value = "";
  addDoc(collection(db, "lobby_chat"), { stdId: currentUser.stdId, nickname: currentUser.nickname, emoji: currentUser.emoji, text: text, timestamp: Date.now() });
}
bindClick("lobby-chat-send-btn", () => { playSound("click"); sendChat("lobby-chat-input"); });
document.getElementById("lobby-chat-input").addEventListener("keypress", (e) => { if(e.key === "Enter") { playSound("click"); sendChat("lobby-chat-input"); } });

function renderLobbyUsers(users) {
  const html = users.map(u => `<div class="user-badge">${u.emoji} ${u.nickname}</div>`).join("");
  const c1 = document.getElementById("lobby-user-list"); const count1 = document.getElementById("lobby-user-count");
  const c2 = document.getElementById("admin-lobby-user-list"); const count2 = document.getElementById("admin-lobby-user-count");
  if(c1) { c1.innerHTML = html; count1.innerText = users.length; } if(c2) { c2.innerHTML = html; count2.innerText = users.length; } 
}

function renderLobbyChat(msgs, boxId) {
  const box = document.getElementById(boxId); if(!box) return;
  box.innerHTML = msgs.map(m => {
    const isMe = (m.stdId === currentUser.stdId) || (boxId === "admin-lobby-chat-box" && m.stdId === "ADMIN");
    const align = isMe ? "flex-end" : "flex-start"; const bg = isMe ? "#BBDEFB" : "#F5F5F5";
    const name = isMe ? "" : `<div style="font-size: 12px; color: #888; margin-bottom: 2px;">${m.emoji} ${m.nickname}</div>`;
    return `<div style="display: flex; flex-direction: column; align-items: ${align}; width: 100%; margin-bottom:5px;">${name}<div style="background: ${bg}; padding: 8px 12px; border-radius: 15px; font-size: 14px; max-width: 80%; word-break: break-all; color: #333; text-align: left; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">${m.text}</div></div>`;
  }).join("");
  box.scrollTop = box.scrollHeight;
}

// 🌟 강제 전환 1단계: 연습 모드 시작
function startLivePractice(config) {
  resetGameStates();
  currentLiveStatus = "practice";
  wordList = wordSets.find(s=>s.id === config.setId).words || [];
  currentSetId = config.setId; currentGameMode = config.mode;
  
  showScreen("speed-match-screen");
  document.getElementById("top-left-controls").style.display = "flex";
  
  // UI 변경: 연습 모드 배너 띄우기
  let banner = document.getElementById("live-sm-banner");
  banner.style.display = "block"; banner.style.backgroundColor = "#9C27B0"; banner.innerText = "💪 [연습 모드] 손가락 풀기!";
  
  // 연습모드는 점수 안 올라감
  gameScore = 0; document.getElementById("sm-score").innerText = `점수: ${gameScore}`;
  
  // 10초 타이머 세팅 (클라이언트 기준)
  liveGameTimeRemaining = 10;
  document.getElementById("sm-timer").innerText = `🕒 00:10`;
  
  loadSpeedMatchRound(); // 기존 짝맞추기 로드 함수 그대로 씀

  gameTimerInterval = setInterval(() => {
    if (!isGamePaused) { 
      liveGameTimeRemaining--;
      document.getElementById("sm-timer").innerText = `🕒 00:${String(liveGameTimeRemaining).padStart(2,"0")}`;
      
      // 🌟 핵심: 5초 남았을 때 거대 카운트다운 시작!
      if (liveGameTimeRemaining <= 5 && liveGameTimeRemaining > 0) {
        document.getElementById("huge-countdown-overlay").style.display = "flex";
        document.getElementById("huge-text").innerText = liveGameTimeRemaining;
        playSound("click");
      }
    }
  }, 1000);
}

// 🌟 강제 전환 2단계: 본 게임 시작
function startLiveMainGame(config) {
  resetGameStates();
  currentLiveStatus = "playing";
  wordList = wordSets.find(s=>s.id === config.setId).words || [];
  currentSetId = config.setId; currentGameMode = config.mode;
  
  // 거대 카운트다운 숨기기
  document.getElementById("huge-countdown-overlay").style.display = "none";
  showScreen("speed-match-screen");
  document.getElementById("top-left-controls").style.display = "flex";
  
  // 배너 변경
  let banner = document.getElementById("live-sm-banner");
  banner.style.display = "block"; banner.style.backgroundColor = "#FF5722"; banner.innerText = "🔥 [본 게임] 랭킹전 시작!";
  
  gameScore = 0; document.getElementById("sm-score").innerText = `점수: ${gameScore}`;
  
  // 서버에서 정해준 시간으로 세팅
  liveGameTimeRemaining = parseInt(config.time);
  
  loadSpeedMatchRound(); // 리셋된 상태로 새 라운드 시작

  gameTimerInterval = setInterval(() => {
    if (!isGamePaused) { 
      liveGameTimeRemaining--;
      const m = String(Math.floor(liveGameTimeRemaining / 60)).padStart(2, "0"); const s = String(liveGameTimeRemaining % 60).padStart(2, "0");
      document.getElementById("sm-timer").innerText = `🕒 ${m}:${s}`;
      
      // 만약 선생님이 종료 안 누르고 시간이 다 되면 자체적으로 끝냄
      if (liveGameTimeRemaining <= 0) {
        endLiveGame();
      }
    }
  }, 1000);
}

// 본게임 도중 내 점수가 오를 때마다 서버로 전송하는 함수
async function updateMyLiveScore() {
  if (currentLiveStatus === "playing") {
    try {
      await setDoc(doc(db, "liveRoom_scores", currentUser.stdId), {
        stdId: currentUser.stdId, nickname: currentUser.nickname, emoji: currentUser.emoji, score: gameScore, timestamp: Date.now()
      });
    } catch(e) {}
  }
}

// 강제 전환 3단계: 게임 종료
function endLiveGame() {
  resetGameStates();
  document.getElementById("live-sm-banner").style.display = "none";
  
  // 최종 점수를 일반 결과 화면으로 보냄
  currentUser.score = gameScore;
  document.getElementById("result-detail").innerText = `라이브 대전이 끝났습니다!`; 
  
  // 라이브 로비 리스너 유지한 채 결과만 보여줌 (포기하고 나가기 누르면 아예 나감)
  showScreen("result-screen");
  document.getElementById("praise-word").innerText = "Good Job!";
  document.getElementById("result-user").innerText = `${currentUser.emoji} ${currentUser.nickname} 학생`;
  document.getElementById("final-score").innerText = currentUser.score;
  document.getElementById("result-caught-emojis").style.display = "none";
  playSound("success");
  
  // 최종 점수 영구 보관용 DB에 저장
  try { addDoc(collection(db, "scores"), { stdId: currentUser.stdId, nickname: currentUser.nickname, emoji: currentUser.emoji, classId: currentUser.classId, score: currentUser.score, mode: currentGameMode, timestamp: Date.now(), setId: currentSetId, setTitle: currentSetTitle }); } catch(e) {}
}


// ==========================================
// 🌟 7. 관리자 (선생님) 라이브 로비 로직
// ==========================================
bindClick("admin-go-live-btn", () => { playSound("click"); enterAdminLobby(); });

async function enterAdminLobby() {
  if (wordSets.length === 0) return alert("단어장을 먼저 등록하세요.");
  showScreen("admin-lobby-screen");
  
  // 단어장 셀렉트 박스 채우기
  const setSelect = document.getElementById("admin-live-set");
  setSelect.innerHTML = "";
  wordSets.forEach(s => {
    let opt = document.createElement("option"); opt.value = s.id; opt.innerText = s.title + ` (${s.words.length}단어)`; setSelect.appendChild(opt);
  });

  // 상태를 기본값(lobby)으로 서버에 즉시 푸시
  await pushAdminLiveState("lobby");

  // 셀렉트 박스 변경 시 실시간으로 푸시 (아이들 화면에 바로 공지됨)
  ["admin-live-set", "admin-live-mode", "admin-live-time", "admin-live-team", "admin-live-item"].forEach(id => {
    document.getElementById(id).addEventListener("change", () => pushAdminLiveState("lobby"));
  });

  startLobbyListeners(); // 관리자도 채팅/접속자 봄
}

async function pushAdminLiveState(statusStr) {
  let config = {
    status: statusStr,
    setId: document.getElementById("admin-live-set").value,
    mode: document.getElementById("admin-live-mode").value,
    time: parseInt(document.getElementById("admin-live-time").value),
    teamMode: document.getElementById("admin-live-team").value,
    items: document.getElementById("admin-live-item").value === "true"
  };
  await setDoc(doc(db, "gameData", "liveRoom"), config);
}

// 관리자 로비 나가기
bindClick("admin-lobby-leave-btn", () => {
  playSound("click");
  if (lobbyUnsubUsers) { lobbyUnsubUsers(); lobbyUnsubUsers = null; }
  if (lobbyUnsubChat) { lobbyUnsubChat(); lobbyUnsubChat = null; }
  showScreen("admin-main-screen");
});

// 공지사항 보내기
function sendAdminChat() {
  const inputEl = document.getElementById("admin-lobby-chat-input"); const text = inputEl.value.trim(); if(!text) return; inputEl.value = "";
  addDoc(collection(db, "lobby_chat"), { stdId: "ADMIN", nickname: "👑민준쌤", emoji: "👨‍🏫", text: text, timestamp: Date.now() });
}
bindClick("admin-lobby-chat-send-btn", () => { playSound("click"); sendAdminChat(); });
document.getElementById("admin-lobby-chat-input").addEventListener("keypress", (e) => { if(e.key === "Enter") { playSound("click"); sendAdminChat(); } });

// 🌟 [게임 시작!] 버튼 로직
bindClick("admin-live-start-btn", async () => {
  playSound("click");
  if(!confirm("모든 학생을 연습 모드(10초)로 보내고 게임을 시작하시겠습니까?")) return;

  // 1. 이전 라이브 게임 점수(Collection) 모두 날리기 (안전하게 0점 처리)
  const qScores = query(collection(db, "liveRoom_scores"));
  const snapScores = await getDocs(qScores);
  const deletePromises = [];
  snapScores.forEach(d => deletePromises.push(deleteDoc(d.ref)));
  await Promise.all(deletePromises);

  // 2. 상태를 'practice'로 변경
  await pushAdminLiveState("practice");
  
  // 3. 선생님 화면을 '모니터'로 전환
  showScreen("admin-live-monitor-screen");
  document.getElementById("admin-live-status-text").innerText = "상태: 🏃‍♂️ 연습중... (10초 후 본게임 시작)";
  
  // 4. 모니터링 애니메이션 시작
  startAdminMonitor();

  // 5. 선생님의 백그라운드에서 10.5초 대기 후 자동으로 'playing'으로 변경!
  setTimeout(async () => {
    await pushAdminLiveState("playing");
    document.getElementById("admin-live-status-text").innerText = "상태: 🔥 본게임 진행 중!";
    document.getElementById("admin-live-status-text").style.color = "#FF4081";
  }, 10500); // 0.5초 여유 둠
});

// 게임 강제 종료 버튼
bindClick("admin-live-end-btn", async () => {
  playSound("click");
  if(!confirm("진행 중인 라이브 게임을 강제로 종료하시겠습니까?")) return;
  await pushAdminLiveState("ended");
  if(liveScoresUnsub) { liveScoresUnsub(); liveScoresUnsub = null; }
  showScreen("admin-lobby-screen");
  await pushAdminLiveState("lobby"); // 다시 대기실로 원복
});

// 🌟 선생님 라이브 모니터 (스무스 랭킹 애니메이션의 핵심)
function startAdminMonitor() {
  const container = document.getElementById("admin-live-rank-container");
  container.innerHTML = ""; // 기존 막대기들 지우기

  const q = query(collection(db, "liveRoom_scores"));
  liveScoresUnsub = onSnapshot(q, (snap) => {
    let scores = []; snap.forEach(d => scores.push(d.data()));
    
    // 점수 높은 순으로 줄 세우기!
    scores.sort((a, b) => b.score - a.score);

    scores.forEach((s, idx) => {
      let rowId = `live-row-${s.stdId}`;
      let row = document.getElementById(rowId);
      
      // 막대기가 아직 없으면 새로 생성
      if (!row) {
        row = document.createElement("div");
        row.id = rowId;
        row.className = "live-rank-row";
        
        let medalSpan = document.createElement("div"); medalSpan.className = "live-rank-medal";
        let nameSpan = document.createElement("div"); nameSpan.className = "live-rank-name";
        let scoreSpan = document.createElement("div"); scoreSpan.className = "live-rank-score";
        
        row.appendChild(medalSpan); row.appendChild(nameSpan); row.appendChild(scoreSpan);
        container.appendChild(row);
      }
      
      // 순위에 따라 훈장 및 높이(Top) 지정 (이게 애니메이션을 만듦!)
      let medalHtml = idx === 0 ? "🥇" : idx === 1 ? "🥈" : idx === 2 ? "🥉" : `${idx+1}위`;
      row.children[0].innerHTML = medalHtml;
      row.children[1].innerHTML = `${s.emoji} ${s.nickname}`;
      row.children[2].innerHTML = `${s.score}점`;
      
      row.style.top = (idx * 65) + "px"; // 65px 간격으로 자기 자리 찾아가게 만듦!
    });
  });
}

// ==========================================
// 기존 관리자 잡다한 기능들 
// ==========================================
bindClick("admin-go-student-btn", () => { playSound("click"); renderAdminStudentList(); showScreen("admin-student-screen"); });
bindClick("admin-go-set-btn", () => { playSound("click"); renderAdminSetList(); showScreen("admin-set-list-screen"); });
bindClick("admin-student-back-btn", () => { playSound("click"); showScreen("admin-main-screen"); });
bindClick("admin-set-list-back-btn", () => { playSound("click"); showScreen("admin-main-screen"); });
bindClick("admin-set-edit-cancel-btn", () => { playSound("click"); showScreen("admin-set-list-screen"); });
bindClick("admin-set-create-btn", () => { playSound("click"); currentEditingSetId = null; document.getElementById("admin-set-title").value = ""; document.getElementById("admin-set-textarea").value = ""; showScreen("admin-set-edit-screen"); });
bindClick("admin-go-feedback-btn", () => { playSound("click"); renderAdminFeedbackList(); showScreen("admin-feedback-screen"); });
bindClick("admin-feedback-back-btn", () => { playSound("click"); showScreen("admin-main-screen"); });

function renderAdminStudentList() {
  const listEl = document.getElementById("admin-student-list"); listEl.innerHTML = "";
  if(studentList.length === 0) return listEl.innerHTML = "<p style='text-align:center; margin-top:50px;'>등록된 학생이 없습니다.</p>";
  studentList.forEach(std => {
    const item = document.createElement("div"); item.className = "admin-list-item"; item.innerHTML = `<span><b>[${std.stdId}]</b> ${std.name}</span>`;
    const delBtn = document.createElement("button"); delBtn.className = "admin-btn-small"; delBtn.innerText = "삭제";
    delBtn.onclick = async () => { if(confirm(`${std.name} 학생을 정말 삭제하시겠습니까?`)) { playSound("click"); studentList = studentList.filter(s => s.stdId !== std.stdId); await setDoc(doc(db, "gameData", "students"), { students: studentList }); renderAdminStudentList(); } };
    item.appendChild(delBtn); listEl.appendChild(item);
  });
}
bindClick("admin-student-upload-btn", async () => {
  playSound("click"); const text = document.getElementById("admin-student-textarea").value; const lines = text.trim().split("\n"); let addedCount = 0;
  for (let line of lines) {
    const parts = line.split('\t'); 
    if (parts.length >= 2 && parts[0].trim() !== "" && parts[1].trim() !== "") {
      const stdId = parts[0].trim(); const name = parts[1].trim(); const existingIndex = studentList.findIndex(s => s.stdId === stdId);
      if(existingIndex >= 0) studentList[existingIndex].name = name; else studentList.push({ stdId, name }); addedCount++;
    }
  }
  if (addedCount === 0) return alert("입력된 학생 정보가 없거나 양식이 틀렸습니다!");
  try { await setDoc(doc(db, "gameData", "students"), { students: studentList }); alert(`성공! 총 ${addedCount}명의 학생 정보를 처리했습니다.`); document.getElementById("admin-student-textarea").value = ""; renderAdminStudentList(); } catch (error) { alert("저장에 실패했습니다."); }
});
function renderAdminSetList() {
  const listEl = document.getElementById("admin-set-list"); listEl.innerHTML = "";
  if(wordSets.length === 0) return listEl.innerHTML = "<p style='text-align:center; margin-top:50px;'>등록된 세트가 없습니다.</p>";
  wordSets.forEach(set => {
    const item = document.createElement("div"); item.className = "admin-list-item"; item.innerHTML = `<span style="font-weight:bold;">${set.title} <span style="font-size:12px; font-weight:normal; color:#666;">(${set.words.length}단어)</span></span>`;
    const btnBox = document.createElement("div"); const editBtn = document.createElement("button"); editBtn.className = "admin-btn-small admin-btn-edit"; editBtn.innerText = "수정";
    editBtn.onclick = () => { playSound("click"); currentEditingSetId = set.id; document.getElementById("admin-set-title").value = set.title; document.getElementById("admin-set-textarea").value = set.words.map(w => `${w.en}\t${w.ko}`).join("\n"); showScreen("admin-set-edit-screen"); };
    const delBtn = document.createElement("button"); delBtn.className = "admin-btn-small"; delBtn.innerText = "삭제";
    delBtn.onclick = async () => { if(confirm(`[${set.title}] 세트를 정말 삭제하시겠습니까?`)) { playSound("click"); wordSets = wordSets.filter(s => s.id !== set.id); await setDoc(doc(db, "gameData", "wordSets"), { sets: wordSets }); renderAdminSetList(); } };
    btnBox.appendChild(editBtn); btnBox.appendChild(delBtn); item.appendChild(btnBox); listEl.appendChild(item);
  });
}
bindClick("admin-set-save-btn", async () => {
  playSound("click"); const title = document.getElementById("admin-set-title").value.trim(); if(!title) return alert("세트 이름을 적어주세요!");
  const text = document.getElementById("admin-set-textarea").value; const lines = text.trim().split("\n"); const newWords = [];
  for (let line of lines) { const parts = line.split('\t'); if (parts.length >= 2 && parts[0].trim() !== "" && parts[1].trim() !== "") newWords.push({ en: parts[0].trim(), ko: parts[1].trim() }); }
  if (newWords.length === 0) return alert("입력된 단어가 없거나 양식이 틀렸습니다!");
  if (currentEditingSetId) { const target = wordSets.find(s => s.id === currentEditingSetId); if(target) { target.title = title; target.words = newWords; } } else { wordSets.push({ id: Date.now().toString(), title: title, words: newWords }); }
  try { await setDoc(doc(db, "gameData", "wordSets"), { sets: wordSets }); alert("성공적으로 저장되었습니다!"); renderAdminSetList(); showScreen("admin-set-list-screen"); } catch (error) { alert("저장 실패."); }
});
async function renderAdminFeedbackList() {
  const listEl = document.getElementById("admin-feedback-list"); listEl.innerHTML = "<p style='text-align:center; margin-top:20px;'>학생들의 의견을 불러오는 중...</p>";
  try {
    const qSnap = await getDocs(collection(db, "feedback")); let fList = []; qSnap.forEach(doc => fList.push({ id: doc.id, ...doc.data() })); fList.sort((a,b) => b.timestamp - a.timestamp); 
    listEl.innerHTML = ""; if(fList.length === 0) { listEl.innerHTML = "<p style='text-align:center; margin-top:50px;'>아직 등록된 의견이 없습니다.</p>"; return; }
    fList.forEach(f => { const date = new Date(f.timestamp).toLocaleString(); listEl.innerHTML += `<div style="border-bottom: 2px dashed #ddd; padding: 10px 5px; margin-bottom: 10px;"><div style="font-size:12px; color:#888; margin-bottom:5px;">${date}</div><div style="font-weight:bold; margin-bottom:5px;">${f.emoji} ${f.nickname} <span style="font-size:12px; font-weight:normal; color:#666;">(${f.stdId})</span></div><div style="font-size:16px; color:#333; line-height:1.4;">${f.text}</div></div>`; });
  } catch(e) { listEl.innerHTML = "<p>에
