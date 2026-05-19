// ==========================================
// 1. 파이어베이스 라이브러리 및 세팅
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
// 2. 단일 원본 전역 변수
// ==========================================
let wordSets = []; let studentList = []; let wordList = []; 
let gameTimerInterval; let cdInterval; let gameTimeRemaining = 0; let gameScore = 0; 
let currentGameMode = ""; let currentRankingMode = ""; let isGamePaused = false; 
let currentSetId = null; let currentSetTitle = ""; 
let isWordHidden = false; let isMeanHidden = false; let starData = {};
let currentUser = { stdId: "", realName: "", classId: "", nickname: "", emoji: "", score: 0 };
let currentEditingSetId = null; 

let currentLiveStatus = "lobby"; let lobbyUnsubUsers = null; let lobbyUnsubChat = null; let liveStateUnsub = null; let liveScoresUnsub = null; let liveGameTimeRemaining = 0;

const allEmojis = ["🎮", "🕹️", "🎲", "🎯", "🐶", "🐱", "🍓", "😎", "🤩", "🚀", "🌟", "🔥", "🦄", "🍀", "🍔", "👽","😀","😂","😍","🥳","👻","🤡","🤗","🤔","🤐","🐭","🐹","🐰","🦊","🐻","🐼","🐨","🐯","🦁","🐮","🐷","🐸","🐵","🐧","🐤","🦆","🦉","🦇","🐺","🐝","🦋","🐢","🐍","🦖","🐙","🦑","🦀","🐠","🐬","🐳","🦈","🐅","🦓","🦍","🐘","🐫","🦒","🦘","🐎","🐏","🐐","🦌","🐕","🐈","🦚","🦜","🦢","🦩","🕊","🦝","🦨","🦥","🐿","🦔","🐉","🍎","🍊","🍋","🍌","🍉","🍇","🫐","🍒","🍑","🍍","🥥","🥝","🍅","🥑","🥦","🥒","🌶","🌽","🥕","🥔","🍠","🥐","🍞","🥨","🧀","🍳","🥞","🥓","🥩","🍗","🌭","🍟","🍕","🥪","🌮","🥗","🍣","🍱","🥟","🍤","🍙","🍚","🍧","🍦","🍰","🎂","🍭","🍬","🍫","🍩","🍪","🍯","🍼","☕️","🧃","🥤","🍺","🍻","🥂","🍷","🥃","🧊","⚽️","🏀","🏈","⚾️","🎾","🏐","🏓","🏸","🥊","🛹","⛸","🎿","🏂","🏋️","🏄","🏊","🚴","🏆","🥇","🏅","🎟","🎪","🎭","🎨","🎬","🎤","🎧","🎹","🥁","🎸","🎳","🎰","🧩","🚗","🚓","🚑","🚒","🚜","🚲","🛵","🏍","✈️","🚁","⛵️","🛳","🗺","🗽","🏰","🎡","🎢","⛺️","🏠","🏢","🏥","🏦","🏫","⛪️","🌅","🌌","⌚️","📱","💻","⌨️","🖥","📷","📸","🎥","📞","☎️","📺","📻","⏱","⏰","⏳","💡","💸","💵","💰","💳","💎","🛠","🔫","💣","🪄"];
const modeNames = { "speed-match": "🧩 짝맞추기", "exam1": "📝 순서맞추기", "exam2": "✍️ 직접쓰기" };

// 오디오 설정 (효과음)
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
    }
  } catch(e) {}
}

// UI 유틸
function showScreen(screenId) { document.querySelectorAll(".screen").forEach((s) => { s.style.display = "none"; s.classList.remove("active"); }); const screen = document.getElementById(screenId); if(screen) { screen.style.display = "flex"; screen.classList.add("active"); } }
function bindClick(id, callback) { const el = document.getElementById(id); if (el) el.onclick = callback; }

const emojiContainer = document.getElementById("emoji-container");
if(emojiContainer) {
  allEmojis.sort(() => 0.5 - Math.random()).slice(0, 10).forEach((emoji) => {
    const btn = document.createElement("button"); btn.className = "emoji-btn"; btn.innerText = emoji;
    btn.onclick = () => { document.querySelectorAll(".emoji-btn").forEach((b) => b.classList.remove("selected")); btn.classList.add("selected"); currentUser.emoji = emoji; playSound("click"); }; emojiContainer.appendChild(btn);
  });
}
bindClick("mute-btn", () => { isMuted = !isMuted; document.getElementById("mute-btn").innerText = isMuted ? "[S] 소리 OFF" : "[S] 소리 ON"; playSound("click"); });

function resetGameStates() {
  clearInterval(gameTimerInterval); clearInterval(cdInterval); isGamePaused = false; gameScore = 0;
  document.getElementById("huge-countdown-overlay").style.display = "none";
}

bindClick("back-to-menu-btn", () => { 
  playSound("click"); document.getElementById("top-left-controls").style.display = "none"; resetGameStates(); 
  if(liveStateUnsub) leaveLobby(); else showScreen("menu-screen"); 
});
bindClick("home-btn", () => { playSound("click"); showScreen("hub-screen"); }); 

// ==========================================
// 🌟 3. 비동기 DB 로드 및 로그인 로직
// ==========================================
async function loadAllFromDB() {
  const authBtn = document.getElementById("auth-btn");
  try {
    const setSnap = await getDoc(doc(db, "gameData", "wordSets")); if (setSnap.exists()) wordSets = setSnap.data().sets || [];
    const stdSnap = await getDoc(doc(db, "gameData", "students")); if (stdSnap.exists()) studentList = stdSnap.data().students || [];
    if(authBtn) { authBtn.innerText = "[ENTER] 인증하기"; authBtn.disabled = false; authBtn.classList.add("btn-yellow"); }
  } catch (error) { 
    if(authBtn) authBtn.innerText = "연결 실패 (새로고침)";
  }
}
loadAllFromDB(); 

bindClick("auth-btn", () => {
  playSound("click"); const inputId = document.getElementById("auth-id").value.trim(); const inputName = document.getElementById("auth-name").value.trim();
  if(!inputId || !inputName) return Swal.fire('ERROR', '학번과 이름을 입력하세요!', 'warning');
  const matchedStudent = studentList.find(s => s.stdId === inputId && s.name === inputName);
  if (matchedStudent) { currentUser.stdId = inputId; currentUser.realName = inputName; currentUser.classId = inputId.substring(0, 2); showScreen("login-screen"); } 
  else { Swal.fire('ACCESS DENIED', '정보가 일치하지 않습니다.', 'error'); }
});

bindClick("login-btn", () => {
  playSound("click"); const nick = document.getElementById("nickname").value.trim();
  if (!nick || !currentUser.emoji) return Swal.fire('WAIT', '닉네임과 아이콘을 골라주세요!', 'warning');
  currentUser.nickname = nick; document.getElementById("user-display").innerText = `${currentUser.emoji} ${currentUser.nickname}`;
  showScreen("hub-screen");
});

// ==========================================
// 🌟 4. 허브 및 관리자
// ==========================================
bindClick("btn-singleplayer", () => {
  playSound("click");
  if (wordSets.length === 0) return Swal.fire('EMPTY', '등록된 단어장이 없습니다.', 'info');
  renderSetSelectList(); showScreen("set-select-screen");
});
bindClick("btn-multiplayer", () => { playSound("click"); enterLobby(); });
bindClick("btn-hub-admin", async () => {
  playSound("click");
  const { value: pwd } = await Swal.fire({ title: 'ADMIN ONLY', input: 'password', inputPlaceholder: 'PASSWORD (4 DIGITS)'});
  if (pwd === "1234") showScreen("admin-main-screen"); else if (pwd) Swal.fire('ERROR', '비밀번호 불일치', 'error');
});

function renderSetSelectList() {
  const container = document.getElementById("set-select-list"); container.innerHTML = "";
  wordSets.forEach(set => {
    const btn = document.createElement("button"); btn.className = "r-btn"; btn.style.width = "100%";
    btn.innerHTML = `${set.title} <span style="font-size:14px; color:#555;">(${set.words.length}개)</span>`;
    btn.onclick = () => { playSound("click"); if(set.words.length < 4) return Swal.fire('WAIT', '단어가 4개 미만입니다.', 'warning'); wordList = set.words; currentSetId = set.id; currentSetTitle = set.title; showScreen("menu-screen"); };
    container.appendChild(btn);
  });
}
bindClick("set-select-back-to-hub-btn", () => { playSound("click"); showScreen("hub-screen"); });
bindClick("menu-go-back-set-btn", () => { playSound("click"); showScreen("set-select-screen"); });
bindClick("admin-main-close-btn", () => { playSound("click"); showScreen("hub-screen"); });

// ==========================================
// 🌟 5. 라이브 멀티플레이 엔진 (학생)
// ==========================================
async function enterLobby() {
  if (wordSets.length === 0) return Swal.fire('EMPTY', '서버에 등록된 단어장이 없습니다.', 'info');
  showScreen("lobby-screen"); currentLiveStatus = "lobby";
  try { await setDoc(doc(db, "lobby_users", currentUser.stdId), { stdId: currentUser.stdId, nickname: currentUser.nickname, emoji: currentUser.emoji, online: true, timestamp: Date.now() }); } catch(e) {}
  
  const qUsers = query(collection(db, "lobby_users"), where("online", "==", true));
  lobbyUnsubUsers = onSnapshot(qUsers, (snap) => { let users = []; snap.forEach(d => users.push(d.data())); renderLobbyUsers(users); });
  
  const qChat = query(collection(db, "lobby_chat"), orderBy("timestamp", "desc"), limit(50));
  lobbyUnsubChat = onSnapshot(qChat, (snap) => { let msgs = []; snap.forEach(d => msgs.push(d.data())); msgs.reverse(); renderLobbyChat(msgs, "lobby-chat-box"); renderLobbyChat(msgs, "admin-lobby-chat-box"); });

  // 🌟 라이브 상태 수신 (버그 원천 차단 로직 적용!)
  liveStateUnsub = onSnapshot(doc(db, "gameData", "liveRoom"), (docSnap) => {
    if(docSnap.exists()) {
      let data = docSnap.data(); 
      let targetSet = wordSets.find(s => String(s.id) === String(data.setId));
      let setText = targetSet ? targetSet.title : "세트 미정"; 
      let modeText = modeNames[data.mode] || "미정";
      document.getElementById("lobby-game-info").innerHTML = `[${modeText}]<br>TIME: ${data.time/60}MIN<br>SET: ${setText}`;

      // 상태 강제 전환
      if (data.status === "practice" && currentLiveStatus !== "practice") {
        if(!targetSet) return Swal.fire('ERROR', '단어장 동기화 오류. 로비에 남습니다.', 'error');
        currentLiveStatus = "practice"; startLivePractice(data, targetSet.words);
      } else if (data.status === "playing" && currentLiveStatus !== "playing") {
        if(!targetSet) return;
        currentLiveStatus = "playing"; startLiveMainGame(data, targetSet.words);
      } else if (data.status === "ended" && currentLiveStatus !== "ended") {
        currentLiveStatus = "ended"; endLiveGame();
      } else if (data.status === "lobby" && currentLiveStatus !== "lobby") {
        currentLiveStatus = "lobby"; showScreen("lobby-screen");
      }
    }
  });
}

async function leaveLobby() {
  if (lobbyUnsubUsers) lobbyUnsubUsers(); if (lobbyUnsubChat) lobbyUnsubChat(); if (liveStateUnsub) liveStateUnsub();
  lobbyUnsubUsers = null; lobbyUnsubChat = null; liveStateUnsub = null; currentLiveStatus = "lobby";
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
  if(c1) { c1.innerHTML = html; count1.innerText = users.length; } 
  const c2 = document.getElementById("admin-lobby-user-list"); const count2 = document.getElementById("admin-lobby-user-count");
  if(c2) { c2.innerHTML = html; count2.innerText = users.length; }
}

function renderLobbyChat(msgs, boxId) {
  const box = document.getElementById(boxId); if(!box) return;
  box.innerHTML = msgs.map(m => {
    const isMe = (m.stdId === currentUser.stdId) || (boxId === "admin-lobby-chat-box" && m.stdId === "ADMIN");
    return `<div class="chat-msg ${isMe ? 'me' : ''}">` + (isMe ? "" : `<span style="color:#888; font-size:12px;">${m.emoji} ${m.nickname}<br></span>`) + `${m.text}</div>`;
  }).join(""); box.scrollTop = box.scrollHeight;
}

// 🌟 강제전환: 연습 모드
function startLivePractice(config, targetWords) {
  resetGameStates(); currentLiveStatus = "practice";
  wordList = targetWords; currentSetId = config.setId; currentGameMode = config.mode;
  
  showScreen("speed-match-screen"); document.getElementById("top-left-controls").style.display = "flex";
  let banner = document.getElementById("live-sm-banner"); banner.style.display = "block"; banner.innerText = "> PRACTICE_MODE (10 SEC)";
  gameScore = 0; document.getElementById("sm-score").innerText = `SCORE: 0`;
  liveGameTimeRemaining = 10; document.getElementById("sm-timer").innerText = `TIME: 10`; 
  loadSpeedMatchRound(); 

  gameTimerInterval = setInterval(() => {
    if (!isGamePaused) { 
      liveGameTimeRemaining--; document.getElementById("sm-timer").innerText = `TIME: ${liveGameTimeRemaining}`;
      // 거대 카운트다운!
      if (liveGameTimeRemaining <= 5 && liveGameTimeRemaining > 0) { 
        document.getElementById("huge-countdown-overlay").style.display = "flex"; 
        document.getElementById("huge-text").innerText = liveGameTimeRemaining; playSound("click"); 
      }
    }
  }, 1000);
}

// 🌟 강제전환: 본 게임
function startLiveMainGame(config, targetWords) {
  resetGameStates(); currentLiveStatus = "playing";
  wordList = targetWords; currentSetId = config.setId; currentGameMode = config.mode;
  document.getElementById("huge-countdown-overlay").style.display = "none";
  
  showScreen("speed-match-screen"); document.getElementById("top-left-controls").style.display = "flex";
  let banner = document.getElementById("live-sm-banner"); banner.style.display = "block"; banner.style.background = "#FF003C"; banner.innerText = "> RANKED_MATCH_STARTED!";
  gameScore = 0; document.getElementById("sm-score").innerText = `SCORE: 0`;
  liveGameTimeRemaining = parseInt(config.time); loadSpeedMatchRound(); 

  gameTimerInterval = setInterval(() => {
    if (!isGamePaused) { 
      liveGameTimeRemaining--; document.getElementById("sm-timer").innerText = `TIME: ${liveGameTimeRemaining}`;
      if (liveGameTimeRemaining <= 0) endLiveGame();
    }
  }, 1000);
}

async function updateMyLiveScore() {
  if (currentLiveStatus === "playing") { try { await setDoc(doc(db, "liveRoom_scores", currentUser.stdId), { stdId: currentUser.stdId, nickname: currentUser.nickname, emoji: currentUser.emoji, score: gameScore, timestamp: Date.now() }); } catch(e) {} }
}

function endLiveGame() {
  resetGameStates(); document.getElementById("live-sm-banner").style.display = "none";
  currentUser.score = gameScore; 
  showScreen("result-screen"); document.getElementById("result-user").innerText = `${currentUser.emoji} ${currentUser.nickname} 학생`; document.getElementById("final-score").innerText = currentUser.score; playSound("success"); confetti({ particleCount: 150, spread: 70, origin: { y: 0.6 } });
  try { addDoc(collection(db, "scores"), { stdId: currentUser.stdId, nickname: currentUser.nickname, emoji: currentUser.emoji, classId: currentUser.classId, score: currentUser.score, mode: currentGameMode, timestamp: Date.now(), setId: currentSetId, setTitle: currentSetTitle }); } catch(e) {}
}

// ==========================================
// 🌟 6. 관리자 라이브 로비 로직
// ==========================================
bindClick("admin-go-live-btn", async () => { 
  playSound("click"); if (wordSets.length === 0) return Swal.fire('EMPTY', '단어장을 먼저 등록하세요.', 'info'); 
  showScreen("admin-lobby-screen");
  const setSelect = document.getElementById("admin-live-set"); setSelect.innerHTML = "";
  wordSets.forEach(s => { let opt = document.createElement("option"); opt.value = s.id; opt.innerText = s.title; setSelect.appendChild(opt); });
  
  await pushAdminLiveState("lobby");
  ["admin-live-set", "admin-live-mode", "admin-live-time", "admin-live-team", "admin-live-item"].forEach(id => { document.getElementById(id).addEventListener("change", () => pushAdminLiveState("lobby")); });
  
  // 관리자용 로비 리스너
  const qUsers = query(collection(db, "lobby_users"), where("online", "==", true));
  lobbyUnsubUsers = onSnapshot(qUsers, (snap) => { let users = []; snap.forEach(d => users.push(d.data())); renderLobbyUsers(users); });
  const qChat = query(collection(db, "lobby_chat"), orderBy("timestamp", "desc"), limit(50));
  lobbyUnsubChat = onSnapshot(qChat, (snap) => { let msgs = []; snap.forEach(d => msgs.push(d.data())); msgs.reverse(); renderLobbyChat(msgs, "admin-lobby-chat-box"); });
});

async function pushAdminLiveState(statusStr) {
  let config = { status: statusStr, setId: document.getElementById("admin-live-set").value, mode: document.getElementById("admin-live-mode").value, time: parseInt(document.getElementById("admin-live-time").value), teamMode: document.getElementById("admin-live-team").value, items: document.getElementById("admin-live-item").value === "true" };
  await setDoc(doc(db, "gameData", "liveRoom"), config);
}

bindClick("admin-lobby-leave-btn", () => { playSound("click"); if (lobbyUnsubUsers) lobbyUnsubUsers(); if (lobbyUnsubChat) lobbyUnsubChat(); showScreen("admin-main-screen"); });

bindClick("admin-lobby-chat-send-btn", () => { playSound("click"); const inputEl = document.getElementById("admin-lobby-chat-input"); const text = inputEl.value.trim(); if(!text) return; inputEl.value = ""; addDoc(collection(db, "lobby_chat"), { stdId: "ADMIN", nickname: "SYSTEM", emoji: "📢", text: text, timestamp: Date.now() }); });

bindClick("admin-live-start-btn", async () => {
  playSound("click");
  const result = await Swal.fire({ title: 'ALL SYSTEMS GO?', text: "모든 학생을 강제로 게임에 참여시킵니다!", icon: 'warning', showCancelButton: true, confirmButtonText: 'LAUNCH', confirmButtonColor: '#FF003C' });
  if(!result.isConfirmed) return;

  const qScores = query(collection(db, "liveRoom_scores")); const snapScores = await getDocs(qScores); const deletePromises = []; snapScores.forEach(d => deletePromises.push(deleteDoc(d.ref))); await Promise.all(deletePromises);
  await pushAdminLiveState("practice");
  showScreen("admin-live-monitor-screen"); document.getElementById("admin-live-status-text").innerText = "> STATUS: PRACTICE_MODE (10s)";
  startAdminMonitor();
  setTimeout(async () => { await pushAdminLiveState("playing"); document.getElementById("admin-live-status-text").innerText = "> STATUS: RANKED_MATCH_ONGOING"; document.getElementById("admin-live-status-text").style.color = "#00FF41"; }, 10500); 
});

bindClick("admin-live-end-btn", async () => {
  playSound("click"); const result = await Swal.fire({ title: 'FORCE STOP?', text: "게임을 바로 끝내시겠습니까?", icon: 'warning', showCancelButton: true, confirmButtonText: 'STOP' }); if(!result.isConfirmed) return;
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
        let medalSpan = document.createElement("div"); medalSpan.className = "rank-medal"; let nameSpan = document.createElement("div"); nameSpan.className = "rank-name"; let scoreSpan = document.createElement("div"); scoreSpan.className = "rank-score";
        row.appendChild(medalSpan); row.appendChild(nameSpan); row.appendChild(scoreSpan); container.appendChild(row);
      }
      let medalHtml = idx === 0 ? "1ST" : idx === 1 ? "2ND" : idx === 2 ? "3RD" : `${idx+1}TH`;
      row.children[0].innerHTML = medalHtml; row.children[1].innerHTML = `${s.emoji} ${s.nickname}`; row.children[2].innerHTML = `${s.score}`;
      row.style.top = (idx * 55) + "px"; // 부드러운 위치 이동
    });
  });
}

// ==========================================
// 🌟 7. 스피드 짝맞추기 엔진 (스마트 폰트 조절)
// ==========================================
let smRound = 1; let smPairsFound = 0; let smSelected = []; 
function loadSpeedMatchRound() {
  smPairsFound = 0; smSelected = []; const leftCol = document.getElementById("sm-left-col"); const rightCol = document.getElementById("sm-right-col"); leftCol.innerHTML = ""; rightCol.innerHTML = ""; 
  let shuffled = [...wordList].sort(() => 0.5 - Math.random()); let roundWords = shuffled.slice(0, 4);
  let leftPool = roundWords.map(w => ({ text: w.en, id: w.en, side: 'left' })).sort(() => 0.5 - Math.random());
  let rightPool = roundWords.map(w => ({ text: w.ko, id: w.en, side: 'right' })).sort(() => 0.5 - Math.random());
  leftPool.forEach(item => leftCol.appendChild(createSmCard(item))); rightPool.forEach(item => rightCol.appendChild(createSmCard(item)));
}

function createSmCard(item) {
  const wrapper = document.createElement("div"); wrapper.className = `sm-card-wrapper`; const card = document.createElement("div"); card.className = `sm-card`; card.innerText = item.text;
  
  // 🌟 글자수에 따른 스마트 폰트 스케일링 (가독성 최적화)
  let len = item.text.length;
  if(len < 10) card.style.fontSize = "clamp(18px, 4vw, 24px)";
  else if(len < 20) card.style.fontSize = "clamp(16px, 3.5vw, 20px)";
  else if(len < 40) card.style.fontSize = "clamp(14px, 3vw, 18px)";
  else card.style.fontSize = "clamp(12px, 2.5vw, 14px)";

  wrapper.appendChild(card);
  wrapper.onclick = () => {
    if (isGamePaused || card.classList.contains("selected") || card.classList.contains("matched")) return;
    if (smSelected.length === 1 && smSelected[0].side === item.side) { smSelected[0].el.classList.remove("selected"); smSelected = []; return;}
    playSound("click"); card.classList.add("selected"); smSelected.push({ id: item.id, side: item.side, el: card, wrapper });
    if (smSelected.length === 2) { isGamePaused = true; checkSmMatch(); }
  }; return wrapper;
}
function checkSmMatch() {
  let [c1, c2] = smSelected;
  if (c1.id === c2.id) { 
    playSound("success"); gameScore += 100; document.getElementById("sm-score").innerText = `SCORE: ${gameScore}`; updateMyLiveScore(); 
    c1.el.classList.add("matched"); c2.el.classList.add("matched"); smPairsFound++; smSelected = []; 
    setTimeout(() => { if (smPairsFound === 4) { smRound++; loadSpeedMatchRound(); } isGamePaused = false; }, 300);
  } else { 
    playSound("wrong"); gameScore = Math.max(0, gameScore - 50); document.getElementById("sm-score").innerText = `SCORE: ${gameScore}`; updateMyLiveScore(); 
    c1.el.classList.add("wrong"); c2.el.classList.add("wrong");
    setTimeout(() => { c1.el.classList.remove("selected", "wrong"); c2.el.classList.remove("selected", "wrong"); smSelected = []; isGamePaused = false; }, 300); 
  }
}

// ==========================================
// 🌟 8. 관리자 학생/단어장 관리 (팝업으로 변경)
// ==========================================
bindClick("admin-go-student-btn", () => { showScreen("admin-student-screen"); });
bindClick("admin-go-set-btn", () => { renderAdminSetList(); showScreen("admin-set-list-screen"); });
bindClick("admin-student-back-btn", () => { showScreen("admin-main-screen"); });
bindClick("admin-set-list-back-btn", () => { showScreen("admin-main-screen"); });
bindClick("admin-set-edit-cancel-btn", () => { showScreen("admin-set-list-screen"); });

bindClick("admin-student-upload-btn", async () => {
  playSound("click"); const text = document.getElementById("admin-student-textarea").value; const lines = text.trim().split("\n"); let addedCount = 0;
  for (let line of lines) { const parts = line.split('\t'); if (parts.length >= 2 && parts[0].trim() !== "" && parts[1].trim() !== "") { const stdId = parts[0].trim(); const name = parts[1].trim(); const existingIndex = studentList.findIndex(s => s.stdId === stdId); if(existingIndex >= 0) studentList[existingIndex].name = name; else studentList.push({ stdId, name }); addedCount++; } }
  if (addedCount === 0) return Swal.fire('ERROR', '입력된 정보가 없습니다.', 'error');
  try { await setDoc(doc(db, "gameData", "students"), { students: studentList }); Swal.fire('SUCCESS', `총 ${addedCount}명 저장 완료!`, 'success'); document.getElementById("admin-student-textarea").value = ""; } catch (error) {}
});

function renderAdminSetList() {
  const listEl = document.getElementById("admin-set-list"); listEl.innerHTML = "";
  wordSets.forEach(set => {
    const item = document.createElement("div"); item.className = "rank-item"; item.innerHTML = `<span>${set.title} <span style="font-size:12px;">(${set.words.length})</span></span>`;
    const btnBox = document.createElement("div"); const editBtn = document.createElement("button"); editBtn.className = "r-btn btn-small btn-cyan"; editBtn.innerText = "수정";
    editBtn.onclick = () => { playSound("click"); currentEditingSetId = set.id; document.getElementById("admin-set-title").value = set.title; document.getElementById("admin-set-textarea").value = set.words.map(w => `${w.en}\t${w.ko}`).join("\n"); showScreen("admin-set-edit-screen"); };
    btnBox.appendChild(editBtn); item.appendChild(btnBox); listEl.appendChild(item);
  });
}
bindClick("admin-set-create-btn", () => { playSound("click"); currentEditingSetId = null; document.getElementById("admin-set-title").value = ""; document.getElementById("admin-set-textarea").value = ""; showScreen("admin-set-edit-screen"); });
bindClick("admin-set-save-btn", async () => {
  playSound("click"); const title = document.getElementById("admin-set-title").value.trim(); if(!title) return;
  const text = document.getElementById("admin-set-textarea").value; const lines = text.trim().split("\n"); const newWords = [];
  for (let line of lines) { const parts = line.split('\t'); if (parts.length >= 2 && parts[0].trim() !== "" && parts[1].trim() !== "") newWords.push({ en: parts[0].trim(), ko: parts[1].trim() }); }
  if (newWords.length === 0) return Swal.fire('ERROR', '단어가 없습니다.', 'error');
  if (currentEditingSetId) { const target = wordSets.find(s => s.id === currentEditingSetId); if(target) { target.title = title; target.words = newWords; } } else { wordSets.push({ id: Date.now().toString(), title: title, words: newWords }); }
  try { await setDoc(doc(db, "gameData", "wordSets"), { sets: wordSets }); Swal.fire('SUCCESS', '저장 완료!', 'success'); renderAdminSetList(); showScreen("admin-set-list-screen"); } catch (error) {}
});

// ==========================================
// 🌟 9. 기타 싱글플레이 연결들
// ==========================================
bindClick("menu-list-btn", () => { playSound("click"); isWordHidden = false; isMeanHidden = false; renderWordList(); showScreen("list-screen"); });
bindClick("list-back-btn", () => { playSound("click"); showScreen("menu-screen"); });
bindClick("toggle-word-btn", () => { playSound("click"); isWordHidden = !isWordHidden; document.querySelectorAll(".word-text-col span").forEach(el => { if(isWordHidden) el.classList.add("hidden-text"); else el.classList.remove("hidden-text"); }); });
bindClick("toggle-mean-btn", () => { playSound("click"); isMeanHidden = !isMeanHidden; document.querySelectorAll(".mean-text-col span").forEach(el => { if(isMeanHidden) el.classList.add("hidden-text"); else el.classList.remove("hidden-text"); }); });
function renderWordList() {
  document.getElementById("list-title").innerText = `> ${currentSetTitle}`; const container = document.getElementById("word-list-container"); container.innerHTML = "";
  wordList.forEach((word) => {
    const itemDiv = document.createElement("div"); itemDiv.className = "word-list-item"; 
    const wordCol = document.createElement("div"); wordCol.className = "word-text-col"; const wSpan = document.createElement("span"); wSpan.innerText = word.en; if(isWordHidden) wSpan.classList.add("hidden-text"); wordCol.appendChild(wSpan);
    const meanCol = document.createElement("div"); meanCol.className = "mean-text-col"; const mSpan = document.createElement("span"); mSpan.innerText = word.ko; if(isMeanHidden) mSpan.classList.add("hidden-text"); meanCol.appendChild(mSpan);
    itemDiv.appendChild(wordCol); itemDiv.appendChild(meanCol); container.appendChild(itemDiv);
  });
}

// 랭킹 시스템 연동
bindClick("go-ranking-btn", () => { playSound("click"); showRankings("today", currentGameMode); });
bindClick("tab-today", () => { playSound("click"); showRankings("today", currentRankingMode); });
bindClick("tab-class", () => { playSound("click"); showRankings("class", currentRankingMode); });
bindClick("ranking-home-btn", () => { playSound("click"); showScreen("hub-screen"); });
async function showRankings(tab, mode = currentRankingMode) {
  currentRankingMode = mode; showScreen("ranking-screen");
  document.getElementById("ranking-mode-title").innerText = `${currentSetTitle}`;
  const listEl = document.getElementById("ranking-list"); listEl.innerHTML = "<div style='text-align:center; padding: 20px;'>LOADING...</div>";
  try {
    const qSnap = await getDocs(collection(db, "scores")); let allScores = []; qSnap.forEach(doc => allScores.push(doc.data()));
    let filtered = allScores.filter(s => s.mode === currentRankingMode && s.setId === currentSetId);
    const now = new Date(); const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    if (tab === "today") filtered = filtered.filter(s => s.timestamp >= todayStart); else if (tab === "class") filtered = filtered.filter(s => s.classId === currentUser.classId);
    let uniqueTop = {}; filtered.forEach(s => { if(!uniqueTop[s.stdId] || uniqueTop[s.stdId].score < s.score) uniqueTop[s.stdId] = s; }); let sorted = Object.values(uniqueTop).sort((a, b) => b.score - a.score);
    listEl.innerHTML = "";
    if (sorted.length === 0) { listEl.innerHTML = "<div style='text-align:center; padding:20px;'>NO DATA</div>"; } 
    else { sorted.forEach((s, idx) => { let medal = idx === 0 ? "1ST" : idx === 1 ? "2ND" : idx === 2 ? "3RD" : `${idx+1}TH`; listEl.innerHTML += `<div class="rank-item"><span class="rank-medal">${medal}</span><span class="rank-name">${s.emoji} ${s.nickname}</span><span class="rank-score">${s.score}</span></div>`; }); }
    confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
  } catch(e) { listEl.innerHTML = "ERROR"; }
}

// 시험 대비 모드, 빙고 껍데기만 남겨둔 메뉴 (추후 업데이트)
bindClick("menu-exam-btn", () => { playSound("click"); showScreen("exam-option-screen"); });
bindClick("exam-option-back-btn", () => { playSound("click"); showScreen("menu-screen"); });
bindClick("menu-speed-match-btn", () => { playSound("click"); currentGameMode = "speed-match"; startCountdown(); });
function startCountdown() {
  showScreen("speed-match-screen"); document.getElementById("top-left-controls").style.display = "flex";
  let count = 3; document.getElementById("huge-countdown-overlay").style.display = "flex"; document.getElementById("huge-text").innerText = count;
  cdInterval = setInterval(() => { count--; if (count > 0) { playSound("click"); document.getElementById("huge-text").innerText = count; } else { clearInterval(cdInterval); document.getElementById("huge-countdown-overlay").style.display = "none"; playSound("success"); gameScore = 0; document.getElementById("sm-score").innerText = "SCORE: 0"; loadSpeedMatchRound(); } }, 1000);
}
