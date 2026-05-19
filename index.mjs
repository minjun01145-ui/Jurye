import { initializeApp } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-app.js";
import { getFirestore, doc, setDoc, getDoc, collection, addDoc, getDocs, onSnapshot, query, orderBy, limit, where, deleteDoc } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyAh3e5ruxctlhv-OwBAQl5WDds0IZooPD0", authDomain: "test2222-e2458.firebaseapp.com",
  projectId: "test2222-e2458", storageBucket: "test2222-e2458.firebasestorage.app",
  messagingSenderId: "848561047931", appId: "1:848561047931:web:ec05133741eb2a6ce195de", measurementId: "G-HV5RS45JG3"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// 🌟 글로벌 상태 변수
let wordSets = []; let studentList = []; let wordList = []; 
let gameTimerInterval; let cdInterval; let gameTimeRemaining = 0; let gameScore = 0; let lastMatchTime = 0;
let currentGameMode = ""; let currentRankingMode = ""; let isGamePaused = false; 
let currentSetId = null; let currentSetTitle = ""; 
let isWordHidden = false; let isMeanHidden = false; let starData = {};
let currentUser = { stdId: "", realName: "", classId: "", nickname: "", emoji: "", score: 0 };
let currentLiveStatus = "lobby"; let lobbyUnsubUsers = null; let lobbyUnsubChat = null; let liveStateUnsub = null; let liveScoresUnsub = null; let liveGameTimeRemaining = 0;

const allEmojis = ["🎮", "🕹️", "🎲", "🎯", "🐶", "🐱", "🍓", "😎", "🤩", "🚀", "🌟", "🔥", "🦄", "🍀", "🍔", "👽","😀","😂","😍","🥳","👻","🤡","🤗","🤔","🤐","🐭","🐹","🐰","🦊","🐻","🐼","🐨","🐯","🦁","🐮","🐷","🐸","🐵","🐧","🐤","🦆","🦉","🦇","🐺","🐝","🦋","🐢","🐍","🦖","🐙","🦑","🦀","🐠","🐬","🐳","🦈","🐅","🦓","🦍","🐘","🐫","🦒","🦘","🐎","🐏","🐐","🦌","🐕","🐈","🦚","🦜","🦢","🦩","🕊","🦝","🦨","🦥","🐿","🦔","🐉","🍎","🍊","🍋","🍌","🍉","🍇","🫐","🍒","🍑","🍍","🥥","🥝","🍅","🥑","🥦","🥒","🌶","🌽","🥕","🥔","🍠","🥐","🍞","🥨","🧀","🍳","🥞","🥓","🥩","🍗","🌭","🍟","🍕","🥪","🌮","🥗","🍣","🍱","🥟","🍤","🍙","🍚","🍧","🍦","🍰","🎂","🍭","🍬","🍫","🍩","🍪","🍯","🍼","☕️","🧃","🥤","🍺","🍻","🥂","🍷","🥃","🧊","⚽️","🏀","🏈","⚾️","🎾","🏐","🏓","🏸","🥊","🛹","⛸","🎿","🏂","🏋️","🏄","🏊","🚴","🏆","🥇","🏅","🎟","🎪","🎭","🎨","🎬","🎤","🎧","🎹","🥁","🎸","🎳","🎰","🧩","🚗","🚓","🚑","🚒","🚜","🚲","🛵","🏍","✈️","🚁","⛵️","🛳","🗺","🗽","🏰","🎡","🎢","⛺️","🏠","🏢","🏥","🏦","🏫","⛪️","🌅","🌌","⌚️","📱","💻","⌨️","🖥","📷","📸","🎥","📞","☎️","📺","📻","⏱","⏰","⏳","💡","💸","💵","💰","💳","💎","🛠","🔫","💣","🪄"];
const modeNames = { "speed-match": "🧩 짝맞추기", "exam1": "📝 순서맞추기", "exam2": "✍️ 직접쓰기" };

// 🌟 오디오 설정 (효과음만!)
let globalAudioCtx = null; let isMuted = false;
function getAudioCtx() { if (!globalAudioCtx) { const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return null; globalAudioCtx = new AC(); } if (globalAudioCtx.state === "suspended") globalAudioCtx.resume(); return globalAudioCtx; }
document.body.addEventListener("click", () => { getAudioCtx(); }, {once: true}); 

function playSound(type) {
  try {
    const ctx = getAudioCtx(); if (!ctx || isMuted) return;
    const osc = ctx.createOscillator(); const gainNode = ctx.createGain(); osc.connect(gainNode); gainNode.connect(ctx.destination);
    if (type === "click") { osc.type = "sine"; osc.frequency.setValueAtTime(600, ctx.currentTime); osc.frequency.exponentialRampToValueAtTime(800, ctx.currentTime + 0.1); gainNode.gain.setValueAtTime(0.1, ctx.currentTime); osc.start(); osc.stop(ctx.currentTime + 0.1); }
    else if (type === "wrong") { osc.type = "sawtooth"; osc.frequency.setValueAtTime(150, ctx.currentTime); gainNode.gain.setValueAtTime(0.1, ctx.currentTime); osc.start(); osc.stop(ctx.currentTime + 0.2); }
    else if (type === "success") {
      osc.type = "sine"; osc.frequency.setValueAtTime(659.25, ctx.currentTime); gainNode.gain.setValueAtTime(0.1, ctx.currentTime); gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.25); osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.25);
      const osc2 = ctx.createOscillator(); const gain2 = ctx.createGain(); osc2.connect(gain2); gain2.connect(ctx.destination); osc2.type = "sine"; osc2.frequency.setValueAtTime(523.25, ctx.currentTime + 0.2); gain2.gain.setValueAtTime(0.1, ctx.currentTime + 0.2); gain2.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.6); osc2.start(ctx.currentTime + 0.2); osc2.stop(ctx.currentTime + 0.6);
    }
  } catch(e) {}
}

// 🌟 UI 유틸리티
function showScreen(screenId) { document.querySelectorAll(".screen").forEach((s) => { s.style.display = "none"; s.classList.remove("active"); }); const screen = document.getElementById(screenId); if(screen) { screen.style.display = "flex"; screen.classList.add("active"); } }
function bindClick(id, callback) { const el = document.getElementById(id); if (el) el.onclick = callback; }

// 이모지 생성
const emojiContainer = document.getElementById("emoji-container");
if(emojiContainer) {
  allEmojis.sort(() => 0.5 - Math.random()).slice(0, 10).forEach((emoji) => {
    const btn = document.createElement("button"); btn.className = "emoji-btn"; btn.innerText = emoji;
    btn.onclick = () => { document.querySelectorAll(".emoji-btn").forEach((b) => b.classList.remove("selected")); btn.classList.add("selected"); currentUser.emoji = emoji; playSound("click"); }; emojiContainer.appendChild(btn);
  });
}
bindClick("mute-btn", () => { isMuted = !isMuted; document.getElementById("mute-btn").innerText = isMuted ? "🔇" : "🔊"; playSound("click"); });

function resetGameStates() {
  clearInterval(gameTimerInterval); clearInterval(cdInterval); isGamePaused = false; gameScore = 0; currentLiveStatus = "lobby";
  ["huge-countdown-overlay"].forEach(id => { let el = document.getElementById(id); if(el) el.style.display = "none"; });
}

bindClick("back-to-menu-btn", () => { 
  playSound("click"); document.getElementById("top-left-controls").style.display = "none"; resetGameStates(); 
  if(liveStateUnsub) leaveLobby(); else showScreen("menu-screen"); 
});
bindClick("home-btn", () => { playSound("click"); showScreen("hub-screen"); }); 

// ==========================================
// 🌟 1. 로그인 로직 (비동기 안전장치 & 펑키 Alert 적용)
// ==========================================
async function loadAllFromDB() {
  const authBtn = document.getElementById("auth-btn");
  try {
    const setSnap = await getDoc(doc(db, "gameData", "wordSets")); if (setSnap.exists()) wordSets = setSnap.data().sets || [];
    const stdSnap = await getDoc(doc(db, "gameData", "students")); if (stdSnap.exists()) studentList = stdSnap.data().students || [];
    if(authBtn) { authBtn.innerText = "인증하기"; authBtn.disabled = false; }
  } catch (error) { 
    if(authBtn) authBtn.innerText = "연결 실패 (새로고침 해주세요)";
  }
}
loadAllFromDB(); 

bindClick("auth-btn", () => {
  playSound("click"); const inputId = document.getElementById("auth-id").value.trim(); const inputName = document.getElementById("auth-name").value.trim();
  if(!inputId || !inputName) return Swal.fire('앗!', '학번과 이름을 모두 적어주세요!', 'warning');
  const matchedStudent = studentList.find(s => s.stdId === inputId && s.name === inputName);
  if (matchedStudent) { currentUser.stdId = inputId; currentUser.realName = inputName; currentUser.classId = inputId.substring(0, 2); showScreen("login-screen"); } 
  else { Swal.fire('실패!', '학번이 없거나 이름이 틀렸어요. 오타가 없는지 확인하세요!', 'error'); }
});

// 🌟 하나뿐인 찐 입장 버튼!!!
bindClick("login-btn", () => {
  playSound("click"); const nick = document.getElementById("nickname").value.trim();
  if (!nick || !currentUser.emoji) return Swal.fire('기다려요!', '닉네임과 이모지를 모두 골라주세요!', 'warning');
  currentUser.nickname = nick; document.getElementById("user-display").innerText = `${currentUser.emoji} ${currentUser.nickname}`;
  showScreen("hub-screen");
});

// ==========================================
// 🌟 2. 허브(HUB) 화면 (싱글 / 멀티 / 관리자)
// ==========================================
bindClick("btn-singleplayer", () => {
  playSound("click");
  if (wordSets.length === 0) return Swal.fire('텅~', '등록된 단어장이 없어요!', 'info');
  renderSetSelectList(); showScreen("set-select-screen");
});

bindClick("btn-multiplayer", () => { playSound("click"); enterLobby(); });

// 🌟 SweetAlert를 활용한 펑키한 비밀번호 입력창!
bindClick("btn-hub-admin", async () => {
  playSound("click");
  const { value: pwd } = await Swal.fire({ title: '선생님 전용', input: 'password', inputPlaceholder: '비밀번호 4자리', confirmButtonColor: '#FF4081', confirmButtonText: '확인' });
  if (pwd === "1234") showScreen("admin-main-screen"); 
  else if (pwd) Swal.fire('땡!', '비밀번호가 틀렸습니다!', 'error');
});

const setBtnClasses = ["btn-pink", "btn-cyan", "btn-green", "btn-purple", "btn-orange"];
function renderSetSelectList() {
  const container = document.getElementById("set-select-list"); container.innerHTML = "";
  wordSets.forEach(set => {
    const btn = document.createElement("button"); btn.className = `n-btn ${setBtnClasses[Math.floor(Math.random() * setBtnClasses.length)]}`; btn.style.width = "100%";
    btn.innerHTML = `${set.title} <br><span style="font-size:16px;">(단어 ${set.words.length}개)</span>`;
    btn.onclick = () => { playSound("click"); if(set.words.length < 4) return Swal.fire('앗!', '단어가 4개 미만이라 게임을 할 수 없어요!', 'warning'); wordList = set.words; currentSetId = set.id; currentSetTitle = set.title; showScreen("menu-screen"); };
    container.appendChild(btn);
  });
}
bindClick("set-select-back-to-hub-btn", () => { playSound("click"); showScreen("hub-screen"); });
bindClick("menu-go-back-set-btn", () => { playSound("click"); showScreen("set-select-screen"); });
bindClick("admin-main-close-btn", () => { playSound("click"); showScreen("hub-screen"); });

// ==========================================
// 🌟 3. 라이브 멀티플레이 대기실
// ==========================================
let liveGameConfig = { mode: "", time: 0, items: false, teamMode: "indiv", setId: "" };

async function enterLobby() {
  if (wordSets.length === 0) return Swal.fire('텅~', '서버에 등록된 단어장이 없습니다.', 'info');
  showScreen("lobby-screen");
  try { await setDoc(doc(db, "lobby_users", currentUser.stdId), { stdId: currentUser.stdId, nickname: currentUser.nickname, emoji: currentUser.emoji, online: true, lastActive: Date.now() }); } catch(e) {}
  startLobbyListeners();

  liveStateUnsub = onSnapshot(doc(db, "gameData", "liveRoom"), (docSnap) => {
    if(docSnap.exists()) {
      let data = docSnap.data(); liveGameConfig = data;
      let setText = wordSets.find(s=>s.id === data.setId)?.title || "세트 미정"; let modeText = modeNames[data.mode] || "미정";
      document.getElementById("lobby-game-info").innerHTML = `종목: <b>${modeText}</b> <br>시간: <b>${data.time/60}분</b> / <b>개인전</b> <br>단어장: <b>${setText}</b>`;

      if (data.status === "practice" && currentLiveStatus !== "practice") { currentLiveStatus = "practice"; startLivePractice(data); } 
      else if (data.status === "playing" && currentLiveStatus !== "playing") { currentLiveStatus = "playing"; startLiveMainGame(data); } 
      else if (data.status === "ended" && currentLiveStatus !== "ended") { currentLiveStatus = "ended"; endLiveGame(); } 
      else if (data.status === "lobby" && currentLiveStatus !== "lobby") { currentLiveStatus = "lobby"; showScreen("lobby-screen"); }
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
    const align = isMe ? "flex-end" : "flex-start"; const bg = isMe ? "#FFEB3B" : "#fff"; const border = isMe ? "#FF4081" : "#000";
    const name = isMe ? "" : `<div style="font-size: 14px; font-weight:bold; margin-bottom: 4px;">${m.emoji} ${m.nickname}</div>`;
    return `<div style="display: flex; flex-direction: column; align-items: ${align}; width: 100%; margin-bottom:8px;">${name}<div style="background: ${bg}; padding: 10px 15px; border-radius: 12px; border: 3px solid ${border}; font-size: 16px; font-weight:bold; max-width: 80%; word-break: break-all; box-shadow: 2px 2px 0 #000;">${m.text}</div></div>`;
  }).join(""); box.scrollTop = box.scrollHeight;
}

// 🌟 강제 화면 전환 (연습 10초)
function startLivePractice(config) {
  resetGameStates(); currentLiveStatus = "practice"; wordList = wordSets.find(s=>s.id === config.setId).words || []; currentSetId = config.setId; currentGameMode = config.mode;
  showScreen("speed-match-screen"); document.getElementById("top-left-controls").style.display = "flex";
  document.getElementById("live-sm-banner").style.display = "block"; document.getElementById("live-sm-banner").style.backgroundColor = "#9C27B0"; document.getElementById("live-sm-banner").innerText = "💪 [연습 모드] 10초 몸풀기!";
  gameScore = 0; document.getElementById("sm-score").innerText = `점수: 0`; liveGameTimeRemaining = 10; document.getElementById("sm-timer").innerText = `🕒 00:10`; loadSpeedMatchRound(); 

  gameTimerInterval = setInterval(() => {
    if (!isGamePaused) { 
      liveGameTimeRemaining--; document.getElementById("sm-timer").innerText = `🕒 00:${String(liveGameTimeRemaining).padStart(2,"0")}`;
      if (liveGameTimeRemaining <= 5 && liveGameTimeRemaining > 0) { document.getElementById("huge-countdown-overlay").style.display = "flex"; document.getElementById("huge-text").innerText = liveGameTimeRemaining; playSound("click"); }
    }
  }, 1000);
}

// 🌟 본 게임 진행
function startLiveMainGame(config) {
  resetGameStates(); currentLiveStatus = "playing"; wordList = wordSets.find(s=>s.id === config.setId).words || []; currentSetId = config.setId; currentGameMode = config.mode;
  document.getElementById("huge-countdown-overlay").style.display = "none";
  showScreen("speed-match-screen"); document.getElementById("top-left-controls").style.display = "flex";
  document.getElementById("live-sm-banner").style.display = "block"; document.getElementById("live-sm-banner").style.backgroundColor = "#FF5722"; document.getElementById("live-sm-banner").innerText = "🔥 [본 게임] 랭킹전 시작!";
  gameScore = 0; document.getElementById("sm-score").innerText = `점수: 0`; liveGameTimeRemaining = parseInt(config.time); loadSpeedMatchRound(); 

  gameTimerInterval = setInterval(() => {
    if (!isGamePaused) { 
      liveGameTimeRemaining--; const m = String(Math.floor(liveGameTimeRemaining / 60)).padStart(2, "0"); const s = String(liveGameTimeRemaining % 60).padStart(2, "0");
      document.getElementById("sm-timer").innerText = `🕒 ${m}:${s}`;
      if (liveGameTimeRemaining <= 0) { endLiveGame(); }
    }
  }, 1000);
}

async function updateMyLiveScore() { if (currentLiveStatus === "playing") { try { await setDoc(doc(db, "liveRoom_scores", currentUser.stdId), { stdId: currentUser.stdId, nickname: currentUser.nickname, emoji: currentUser.emoji, score: gameScore, timestamp: Date.now() }); } catch(e) {} } }

function endLiveGame() {
  resetGameStates(); document.getElementById("live-sm-banner").style.display = "none";
  currentUser.score = gameScore; document.getElementById("result-detail").innerText = `라이브 대전 끝!`; 
  showScreen("result-screen"); document.getElementById("final-score").innerText = currentUser.score; playSound("success");
  try { addDoc(collection(db, "scores"), { stdId: currentUser.stdId, nickname: currentUser.nickname, emoji: currentUser.emoji, classId: currentUser.classId, score: currentUser.score, mode: currentGameMode, timestamp: Date.now(), setId: currentSetId, setTitle: currentSetTitle }); } catch(e) {}
}

// ==========================================
// 🌟 4. 관리자 라이브 로비 로직
// ==========================================
bindClick("admin-go-live-btn", async () => { 
  playSound("click"); if (wordSets.length === 0) return Swal.fire('빈방', '단어장을 먼저 등록하세요.', 'info'); showScreen("admin-lobby-screen");
  const setSelect = document.getElementById("admin-live-set"); setSelect.innerHTML = "";
  wordSets.forEach(s => { let opt = document.createElement("option"); opt.value = s.id; opt.innerText = s.title; setSelect.appendChild(opt); });
  await pushAdminLiveState("lobby");
  ["admin-live-set", "admin-live-mode", "admin-live-time", "admin-live-team", "admin-live-item"].forEach(id => { document.getElementById(id).addEventListener("change", () => pushAdminLiveState("lobby")); });
  startLobbyListeners(); 
});

async function pushAdminLiveState(statusStr) {
  let config = { status: statusStr, setId: document.getElementById("admin-live-set").value, mode: document.getElementById("admin-live-mode").value, time: parseInt(document.getElementById("admin-live-time").value), teamMode: document.getElementById("admin-live-team").value, items: document.getElementById("admin-live-item").value === "true" };
  await setDoc(doc(db, "gameData", "liveRoom"), config);
}

bindClick("admin-lobby-leave-btn", () => { playSound("click"); if (lobbyUnsubUsers) lobbyUnsubUsers(); if (lobbyUnsubChat) lobbyUnsubChat(); showScreen("admin-main-screen"); });

function sendAdminChat() { const inputEl = document.getElementById("admin-lobby-chat-input"); const text = inputEl.value.trim(); if(!text) return; inputEl.value = ""; addDoc(collection(db, "lobby_chat"), { stdId: "ADMIN", nickname: "👑민준쌤", emoji: "👨‍🏫", text: text, timestamp: Date.now() }); }
bindClick("admin-lobby-chat-send-btn", () => { playSound("click"); sendAdminChat(); }); document.getElementById("admin-lobby-chat-input").addEventListener("keypress", (e) => { if(e.key === "Enter") { playSound("click"); sendAdminChat(); } });

// 게임 발사! 버튼
bindClick("admin-live-start-btn", async () => {
  playSound("click");
  const result = await Swal.fire({ title: '시작할까요?', text: "모든 학생을 강제로 게임에 참여시킵니다!", icon: 'warning', showCancelButton: true, confirmButtonText: '네, 쏘세요!', confirmButtonColor: '#FF4081' });
  if(!result.isConfirmed) return;

  const qScores = query(collection(db, "liveRoom_scores")); const snapScores = await getDocs(qScores); const deletePromises = []; snapScores.forEach(d => deletePromises.push(deleteDoc(d.ref))); await Promise.all(deletePromises);
  await pushAdminLiveState("practice");
  showScreen("admin-live-monitor-screen"); document.getElementById("admin-live-status-text").innerText = "상태: 🏃‍♂️ 연습중... (10초 후 본게임 시작)";
  startAdminMonitor();
  setTimeout(async () => { await pushAdminLiveState("playing"); document.getElementById("admin-live-status-text").innerText = "상태: 🔥 본게임 진행 중!"; document.getElementById("admin-live-status-text").style.color = "#FF4081"; }, 10500); 
});

bindClick("admin-live-end-btn", async () => {
  playSound("click");
  const result = await Swal.fire({ title: '강제 종료', text: "게임을 바로 끝내시겠습니까?", icon: 'warning', showCancelButton: true, confirmButtonText: '종료' });
  if(!result.isConfirmed) return;
  await pushAdminLiveState("ended"); if(liveScoresUnsub) liveScoresUnsub();
  showScreen("admin-lobby-screen"); await pushAdminLiveState("lobby"); 
});

function startAdminMonitor() {
  const container = document.getElementById("admin-live-rank-container"); container.innerHTML = ""; 
  const q = query(collection(db, "liveRoom_scores"));
  liveScoresUnsub = onSnapshot(q, (snap) => {
    let scores = []; snap.forEach(d => scores.push(d.data())); scores.sort((a, b) => b.score - a.score);
    scores.forEach((s, idx) => {
      let rowId = `live-row-${s.stdId}`; let row = document.getElementById(rowId);
      if (!row) {
        row = document.createElement("div"); row.id = rowId; row.className = "live-rank-row";
        let medalSpan = document.createElement("div"); medalSpan.className = "live-rank-medal"; let nameSpan = document.createElement("div"); nameSpan.className = "live-rank-name"; let scoreSpan = document.createElement("div"); scoreSpan.className = "live-rank-score";
        row.appendChild(medalSpan); row.appendChild(nameSpan); row.appendChild(scoreSpan); container.appendChild(row);
      }
      let medalHtml = idx === 0 ? "🥇" : idx === 1 ? "🥈" : idx === 2 ? "🥉" : `${idx+1}위`;
      row.children[0].innerHTML = medalHtml; row.children[1].innerHTML = `${s.emoji} ${s.nickname}`; row.children[2].innerHTML = `${s.score}점`;
      row.style.top = (idx * 65) + "px"; 
    });
  });
}

// ==========================================
// 🌟 5. 스피드 짝맞추기 게임 엔진
// ==========================================
function loadSpeedMatchRound() {
  smPairsFound = 0; smSelected = []; const leftCol = document.getElementById("sm-left-col"); const rightCol = document.getElementById("sm-right-col"); leftCol.innerHTML = ""; rightCol.innerHTML = ""; 
  let shuffled = [...wordList].sort(() => 0.5 - Math.random()); let roundWords = shuffled.slice(0, 4);
  let leftPool = roundWords.map(w => ({ text: w.en, id: w.en, side: 'left' })).sort(() => 0.5 - Math.random());
  let rightPool = roundWords.map(w => ({ text: w.ko, id: w.en, side: 'right' })).sort(() => 0.5 - Math.random());
  leftPool.forEach(item => leftCol.appendChild(createSmCard(item))); rightPool.forEach(item => rightCol.appendChild(createSmCard(item)));
}
function createSmCard(item) {
  const wrapper = document.createElement("div"); wrapper.className = `sm-card-wrapper`; const card = document.createElement("div"); card.className = `game-card`; card.innerText = item.text;
  card.style.fontSize = item.text.length > 30 ? "14px" : (item.text.length > 15 ? "18px" : "24px"); wrapper.appendChild(card);
  wrapper.onclick = () => {
    if (isGamePaused || card.classList.contains("selected") || card.classList.contains("matched")) return;
    if (smSelected.length === 1 && smSelected[0].side === item.side) { smSelected[0].el.classList.remove("selected"); smSelected = []; }
    playSound("click"); card.classList.add("selected"); smSelected.push({ id: item.id, side: item.side, el: card, wrapper });
    if (smSelected.length === 2) { isGamePaused = true; checkSmMatch(); }
  }; return wrapper;
}
function checkSmMatch() {
  let [c1, c2] = smSelected;
  if (c1.id === c2.id) { 
    playSound("success"); gameScore += 100; document.getElementById("sm-score").innerText = `점수: ${gameScore}`; updateMyLiveScore(); 
    c1.el.classList.add("matched"); c2.el.classList.add("matched"); smPairsFound++; smSelected = []; 
    setTimeout(() => { if (smPairsFound === 4) { smRound++; loadSpeedMatchRound(); } isGamePaused = false; }, 400);
  } else { 
    playSound("wrong"); gameScore = Math.max(0, gameScore - 50); document.getElementById("sm-score").innerText = `점수: ${gameScore}`; updateMyLiveScore(); 
    c1.el.classList.add("wrong"); c2.el.classList.add("wrong");
    setTimeout(() => { c1.el.classList.remove("selected", "wrong"); c2.el.classList.remove("selected", "wrong"); smSelected = []; isGamePaused = false; }, 400); 
  }
}

// ==========================================
// 🌟 6. 시험 1단계 & 2단계
// ==========================================
let examQueue = []; let examCurrentIndex = 0; let examWords = []; let examSlots = [];
function startExam1Logic() { examQueue = [...wordList].sort(() => 0.5 - Math.random()); examCurrentIndex = 0; document.getElementById("exam1-score").innerText = `점수: 0`; loadExam1Question(); }
function loadExam1Question() {
  if(examCurrentIndex >= examQueue.length) { currentUser.score = gameScore; goResult(); return; }
  let q = examQueue[examCurrentIndex]; document.getElementById("exam1-progress").innerText = `${examCurrentIndex + 1} / ${examQueue.length}`; document.getElementById("exam1-ko").innerText = q.ko;
  let words = q.en.split(' ').filter(w => w.trim() !== ''); examWords = words.map((w, i) => ({ id: i, text: w })).sort(() => 0.5 - Math.random()); examSlots = []; renderExam1Cards();
}
function renderExam1Cards() {
  const pool = document.getElementById("exam1-pool"); const slots = document.getElementById("exam1-slots"); const submitBtn = document.getElementById("exam1-submit-btn");
  pool.innerHTML = ''; slots.innerHTML = '';
  examWords.forEach(item => { let btn = document.createElement("button"); btn.className = "game-card"; btn.style.padding="10px"; btn.innerText = item.text; btn.onclick = () => { if(isGamePaused) return; playSound("click"); examSlots.push(item); examWords = examWords.filter(w => w.id !== item.id); renderExam1Cards(); }; pool.appendChild(btn); });
  examSlots.forEach(item => { let btn = document.createElement("button"); btn.className = "game-card"; btn.style.padding="10px"; btn.style.background = "#FFEB3B"; btn.innerText = item.text; btn.onclick = () => { if(isGamePaused) return; playSound("click"); examWords.push(item); examSlots = examSlots.filter(w => w.id !== item.id); renderExam1Cards(); }; slots.appendChild(btn); });
  if (examWords.length === 0 && examSlots.length > 0) submitBtn.style.display = "block"; else submitBtn.style.display = "none";
}
bindClick("exam1-submit-btn", () => {
  if(isGamePaused) return; isGamePaused = true;
  let answer = examSlots.map(item => item.text).join(' '); let target = examQueue[examCurrentIndex].en.split(' ').filter(w => w.trim()!== '').join(' ');
  if (answer === target) { playSound("success"); gameScore += 100; document.getElementById("exam1-score").innerText = `점수: ${gameScore}`; setTimeout(() => { examCurrentIndex++; isGamePaused = false; loadExam1Question(); }, 800); } 
  else { playSound("wrong"); gameScore = Math.max(0, gameScore - 50); document.getElementById("exam1-score").innerText = `점수: ${gameScore}`; setTimeout(() => { examWords = [...examWords, ...examSlots]; examSlots = []; renderExam1Cards(); isGamePaused = false; }, 800); }
});

function startExam2Logic() { examQueue = [...wordList].sort(() => 0.5 - Math.random()); examCurrentIndex = 0; document.getElementById("exam2-score").innerText = `점수: 0`; loadExam2Question(); }
function loadExam2Question() {
  if(examCurrentIndex >= examQueue.length) { currentUser.score = gameScore; goResult(); return; }
  let q = examQueue[examCurrentIndex]; document.getElementById("exam2-progress").innerText = `${examCurrentIndex + 1} / ${examQueue.length}`; document.getElementById("exam2-ko").innerText = q.ko;
  document.getElementById("exam2-input").value = ''; document.getElementById("exam2-input").classList.remove("wrong"); setTimeout(()=> document.getElementById("exam2-input").focus(), 100);
}
bindClick("exam2-submit-btn", () => {
  if(isGamePaused) return; isGamePaused = true;
  let inputVal = document.getElementById("exam2-input").value; let target = examQueue[examCurrentIndex].en;
  let normInput = inputVal.toLowerCase().replace(/[^a-z0-9]/gi, ''); let normTarget = target.toLowerCase().replace(/[^a-z0-9]/gi, '');
  if (normInput === normTarget && normTarget.length > 0) { playSound("success"); gameScore += 100; document.getElementById("exam2-score").innerText = `점수: ${gameScore}`; setTimeout(() => { examCurrentIndex++; isGamePaused = false; loadExam2Question(); }, 800); } 
  else { playSound("wrong"); gameScore = Math.max(0, gameScore - 50); document.getElementById("exam2-score").innerText = `점수: ${gameScore}`; document.getElementById("exam2-input").classList.add("wrong"); setTimeout(() => { document.getElementById("exam2-input").classList.remove("wrong"); isGamePaused = false; document.getElementById("exam2-input").focus(); }, 800); }
});
document.getElementById("exam2-input").addEventListener("keypress", function(e) { if (e.key === "Enter") { e.preventDefault(); document.getElementById("exam2-submit-btn").click(); } });

// ==========================================
// 🌟 7. 메뉴 이동 및 공통 게임 진입 로직
// ==========================================
bindClick("menu-list-btn", () => { playSound("click"); isWordHidden = false; isMeanHidden = false; renderWordList(); showScreen("list-screen"); });
bindClick("list-back-btn", () => { playSound("click"); showScreen("menu-screen"); });
bindClick("toggle-word-btn", () => { playSound("click"); isWordHidden = !isWordHidden; document.querySelectorAll(".word-text-col span").forEach(el => { if(isWordHidden) el.classList.add("hidden-text"); else el.classList.remove("hidden-text"); }); });
bindClick("toggle-mean-btn", () => { playSound("click"); isMeanHidden = !isMeanHidden; document.querySelectorAll(".mean-text-col span").forEach(el => { if(isMeanHidden) el.classList.add("hidden-text"); else el.classList.remove("hidden-text"); }); });

function getStarClass(count) { if (count === 0) return "fire-0"; if (count === 1) return "fire-1"; if (count === 2) return "fire-2"; if (count <= 4) return "fire-3"; if (count <= 7) return "fire-4"; return "fire-max"; }
function renderWordList() {
  document.getElementById("list-title").innerText = `[ ${currentSetTitle} ]`; const container = document.getElementById("word-list-container"); container.innerHTML = "";
  const storageKey = `stars_${currentUser.stdId}_${currentSetId}`; try { const stored = localStorage.getItem(storageKey); if (stored) starData = JSON.parse(stored); else starData = {}; } catch(e) {}
  wordList.forEach((word, idx) => {
    const wId = `word_${idx}`; if(starData[wId] === undefined) starData[wId] = 0; 
    const itemDiv = document.createElement("div"); itemDiv.className = "word-list-item"; const wordCol = document.createElement("div"); wordCol.className = "word-text-col";
    const wSpan = document.createElement("span"); wSpan.innerText = word.en; if(isWordHidden) wSpan.classList.add("hidden-text"); wordCol.appendChild(wSpan);
    const meanCol = document.createElement("div"); meanCol.className = "mean-text-col"; const mSpan = document.createElement("span"); mSpan.innerText = word.ko; if(isMeanHidden) mSpan.classList.add("hidden-text"); meanCol.appendChild(mSpan);
    const starCol = document.createElement("div"); starCol.className = "star-col"; const starBtn = document.createElement("button"); starBtn.className = `star-btn ${getStarClass(starData[wId])}`; starBtn.innerText = "⭐";
    const countSpan = document.createElement("span"); countSpan.className = "star-count"; countSpan.innerText = starData[wId] > 0 ? starData[wId] : "";
    starBtn.onclick = () => { playSound("click"); starData[wId]++; starBtn.className = `star-btn ${getStarClass(starData[wId])}`; countSpan.innerText = starData[wId]; try { localStorage.setItem(storageKey, JSON.stringify(starData)); } catch(e){} };
    starCol.appendChild(starBtn); starCol.appendChild(countSpan); itemDiv.appendChild(wordCol); itemDiv.appendChild(meanCol); itemDiv.appendChild(starCol); container.appendChild(itemDiv);
  });
}

bindClick("menu-exam-btn", () => { playSound("click"); showScreen("exam-option-screen"); });
bindClick("exam-option-back-btn", () => { playSound("click"); showScreen("menu-screen"); });
bindClick("menu-speed-match-btn", () => { playSound("click"); currentGameMode = "speed-match"; startCountdown(180, "speed-match-screen", loadSpeedMatchRound); });
bindClick("exam1-btn", () => { playSound("click"); currentGameMode = "exam1"; startExamCountdown(startExam1Logic); });
bindClick("exam2-btn", () => { playSound("click"); currentGameMode = "exam2"; startExamCountdown(startExam2Logic); });

function startCountdown(minutes, screenId, logicCallback) {
  showScreen(screenId); document.getElementById("top-left-controls").style.display = "flex";
  let count = 3; document.getElementById("huge-countdown-overlay").style.display = "flex"; document.getElementById("huge-text").innerText = count;
  cdInterval = setInterval(() => { count--; if (count > 0) { playSound("click"); document.getElementById("huge-text").innerText = count; } else { clearInterval(cdInterval); document.getElementById("huge-countdown-overlay").style.display = "none"; playSound("success"); gameScore = 0; logicCallback(); } }, 1000);
}
function startExamCountdown(logicCallback) { startCountdown(0, currentGameMode === "exam1" ? "exam1-screen" : "exam2-screen", logicCallback); }

// ==========================================
// 🌟 8. 결과 및 라이브러리 폭죽(Confetti)
// ==========================================
async function goResult() {
  clearInterval(gameTimerInterval); clearInterval(cdInterval); isGamePaused = true; 
  document.getElementById("top-left-controls").style.display = "none"; showScreen("result-screen");
  document.getElementById("result-user").innerText = `${currentUser.emoji} ${currentUser.nickname} 학생`;
  document.getElementById("final-score").innerText = currentUser.score;
  playSound("success");
  
  // 🌟 라이브러리 폭죽 발사! (코드 단 1줄!)
  confetti({ particleCount: 150, spread: 70, origin: { y: 0.6 } });

  if(currentLiveStatus !== "ended") {
    try { await addDoc(collection(db, "scores"), { stdId: currentUser.stdId, nickname: currentUser.nickname, emoji: currentUser.emoji, classId: currentUser.classId, score: currentUser.score, mode: currentGameMode, timestamp: Date.now(), setId: currentSetId, setTitle: currentSetTitle }); } catch(e) {}
  }
}

bindClick("go-ranking-btn", () => { playSound("click"); showRankings("today", currentGameMode); });
bindClick("tab-today", () => { playSound("click"); showRankings("today", currentRankingMode); });
bindClick("tab-class", () => { playSound("click"); showRankings("class", currentRankingMode); });
bindClick("ranking-home-btn", () => { playSound("click"); showScreen("hub-screen"); });

async function showRankings(tab, mode = currentRankingMode) {
  currentRankingMode = mode; showScreen("ranking-screen");
  document.getElementById("ranking-mode-title").innerText = `${currentSetTitle}`;
  const listEl = document.getElementById("ranking-list"); listEl.innerHTML = "<div style='text-align:center; padding: 20px;'>순위 불러오는 중...🔍</div>";

  try {
    const qSnap = await getDocs(collection(db, "scores")); let allScores = []; qSnap.forEach(doc => allScores.push(doc.data()));
    let filtered = allScores.filter(s => s.mode === currentRankingMode && s.setId === currentSetId);
    const now = new Date(); const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    if (tab === "today") filtered = filtered.filter(s => s.timestamp >= todayStart); else if (tab === "class") filtered = filtered.filter(s => s.classId === currentUser.classId);

    let uniqueTop = {}; filtered.forEach(s => { if(!uniqueTop[s.stdId] || uniqueTop[s.stdId].score < s.score) uniqueTop[s.stdId] = s; }); let sorted = Object.values(uniqueTop).sort((a, b) => b.score - a.score);
    listEl.innerHTML = "";
    if (sorted.length === 0) { listEl.innerHTML = "<div style='text-align:center; padding:20px;'>기록이 없어요!</div>"; } 
    else { sorted.forEach((s, idx) => { let medal = idx === 0 ? "🥇" : idx === 1 ? "🥈" : idx === 2 ? "🥉" : `${idx+1}위`; listEl.innerHTML += `<div class="rank-item"><div><span class="rank-medal">${medal}</span> ${s.emoji} ${s.nickname}</div><div style="color:#FF4081; font-weight:bold;">${s.score}점</div></div>`; }); }
    confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
  } catch(e) { listEl.innerHTML = "데이터를 불러오지 못했습니다."; }
}
