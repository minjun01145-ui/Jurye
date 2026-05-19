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
let gameTimerInterval; let cdInterval; let gameTimeRemaining = 0; let gameScore = 0; let lastMatchTime = 0;
let currentGameMode = ""; let currentRankingMode = ""; let isGamePaused = false; 
let currentSetId = null; let currentSetTitle = ""; 
let isWordHidden = false; let isMeanHidden = false; let starData = {};
let currentUser = { stdId: "", realName: "", classId: "", nickname: "", emoji: "", score: 0 };
let currentEditingSetId = null; 

let currentLiveStatus = "lobby"; let lobbyUnsubUsers = null; let lobbyUnsubChat = null; let liveStateUnsub = null; let liveScoresUnsub = null; let liveGameTimeRemaining = 0;
let liveGameStartTimeout = null; // 🌟 라이브 버그 방지용 타이머 변수

const allEmojis = ["🎮", "🕹️", "🎲", "🎯", "🐶", "🐱", "🍓", "😎", "🤩", "🚀", "🌟", "🔥", "🦄", "🍀", "🍔", "👽","😀","😂","😍","🥳","👻","🤡","🤗","🤔","🤐","🐭","🐹","🐰","🦊","🐻","🐼","🐨","🐯","🦁","🐮","🐷","🐸","🐵","🐧","🐤","🦆","🦉","🦇","🐺","🐝","🦋","🐢","🐍","🦖","🐙","🦑","🦀","🐠","🐬","🐳","🦈","🐅","🦓","🦍","🐘","🐫","🦒","🦘","🐎","🐏","🐐","🦌","🐕","🐈","🦚","🦜","🦢","🦩","🕊","🦝","🦨","🦥","🐿","🦔","🐉","🍎","🍊","🍋","🍌","🍉","🍇","🫐","🍒","🍑","🍍","🥥","🥝","🍅","🥑","🥦","🥒","🌶","🌽","🥕","🥔","🍠","🥐","🍞","🥨","🧀","🍳","🥞","🥓","🥩","🍗","🌭","🍟","🍕","🥪","🌮","🥗","🍣","🍱","🥟","🍤","🍙","🍚","🍧","🍦","🍰","🎂","🍭","🍬","🍫","🍩","🍪","🍯","🍼","☕️","🧃","🥤","🍺","🍻","🥂","🍷","🥃","🧊","⚽️","🏀","🏈","⚾️","🎾","🏐","🏓","🏸","🥊","🛹","⛸","🎿","🏂","🏋️","🏄","🏊","🚴","🏆","🥇","🏅","🎟","🎪","🎭","🎨","🎬","🎤","🎧","🎹","🥁","🎸","🎳","🎰","🧩","🚗","🚓","🚑","🚒","🚜","🚲","🛵","🏍","✈️","🚁","⛵️","🛳","🗺","🗽","🏰","🎡","🎢","⛺️","🏠","🏢","🏥","🏦","🏫","⛪️","🌅","🌌","⌚️","📱","💻","⌨️","🖥","📷","📸","🎥","📞","☎️","📺","📻","⏱","⏰","⏳","💡","💸","💵","💰","💳","💎","🛠","🔫","💣","🪄"];
const modeNames = { "speed-match": "🧩 짝맞추기", "exam1": "📝 순서맞추기", "exam2": "✍️ 직접쓰기", "chunk": "🧩 문장해석", "fc": "🃏 깜빡이", "memory": "🔠 메모리", "speed": "⚡ 퀴즈", "fish": "🎣 낚시" };

// ==========================================
// 🌟 신규: 로밍 이모지 (화면 아래쪽 둥둥)
// ==========================================
let roamingEmojis = []; let roamAnimId = null; let lastRoamTime = 0;
function startRoamingEmojis() {
  const container = document.getElementById("roaming-emojis"); container.innerHTML = ""; roamingEmojis = []; container.style.display = "block";
  for(let i=0; i<8; i++) {
    let el = document.createElement("div"); el.innerText = allEmojis[Math.floor(Math.random() * allEmojis.length)];
    el.style.position = "absolute"; el.style.fontSize = "35px"; el.style.bottom = (Math.random() * 15) + "px";
    container.appendChild(el);
    roamingEmojis.push({ el: el, x: Math.random() * window.innerWidth, vx: (Math.random() * 100 + 50) * (Math.random() < 0.5 ? 1 : -1), isJumping: false, yOffset: 0 });
  }
  if(!roamAnimId) { lastRoamTime = performance.now(); roamAnimId = requestAnimationFrame(animateRoaming); }
}
function stopRoamingEmojis() {
  document.getElementById("roaming-emojis").style.display = "none";
  if(roamAnimId) { cancelAnimationFrame(roamAnimId); roamAnimId = null; }
}
function animateRoaming(time) {
  if(!roamAnimId) return;
  let dt = (time - lastRoamTime) / 1000; if(dt > 0.1) dt = 0.016; lastRoamTime = time;
  roamingEmojis.forEach(e => {
    e.x += e.vx * dt;
    if(e.x < -40) { e.x = -40; e.vx *= -1; } else if(e.x > window.innerWidth) { e.x = window.innerWidth; e.vx *= -1; }
    if(!e.isJumping && Math.random() < 0.01) { e.isJumping = true; e.vy = -300; } // 점프 높이 상향
    if(e.isJumping) {
      e.yOffset += e.vy * dt; e.vy += 800 * dt; // 중력
      if(e.yOffset >= 0) { e.yOffset = 0; e.isJumping = false; }
    }
    let scaleX = e.vx > 0 ? -1 : 1; 
    e.el.style.transform = `translate3d(${e.x}px, ${e.yOffset}px, 0) scaleX(${scaleX})`;
  });
  roamAnimId = requestAnimationFrame(animateRoaming);
}

// 오디오 설정 (효과음 전용)
let globalAudioCtx = null; let isMuted = false;
function getAudioCtx() { if (!globalAudioCtx) { const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return null; globalAudioCtx = new AC(); } if (globalAudioCtx.state === "suspended") globalAudioCtx.resume(); return globalAudioCtx; }
document.body.addEventListener("click", () => { getAudioCtx(); }, {once: true}); 
function playSound(type) {
  try {
    const ctx = getAudioCtx(); if (!ctx || isMuted) return;
    const osc = ctx.createOscillator(); const gainNode = ctx.createGain(); osc.connect(gainNode); gainNode.connect(ctx.destination);
    if (type === "click") { osc.type = "sine"; osc.frequency.setValueAtTime(600, ctx.currentTime); osc.frequency.exponentialRampToValueAtTime(800, ctx.currentTime + 0.1); gainNode.gain.setValueAtTime(0.1, ctx.currentTime); osc.start(); osc.stop(ctx.currentTime + 0.1); }
    else if (type === "wrong") { osc.type = "sawtooth"; osc.frequency.setValueAtTime(150, ctx.currentTime); gainNode.gain.setValueAtTime(0.1, ctx.currentTime); osc.start(); osc.stop(ctx.currentTime + 0.2); }
    else if (type === "success") { osc.type = "sine"; osc.frequency.setValueAtTime(659.25, ctx.currentTime); gainNode.gain.setValueAtTime(0.1, ctx.currentTime); gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.25); osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.25); }
  } catch(e) {}
}

function showScreen(screenId) { 
  document.querySelectorAll(".screen").forEach((s) => { s.classList.remove("active"); }); 
  const screen = document.getElementById(screenId); if(screen) { screen.classList.add("active"); } 
  // 메뉴 화면에만 이모지 로밍 표시
  if(["auth-screen", "login-screen", "hub-screen", "menu-screen"].includes(screenId)) { startRoamingEmojis(); } else { stopRoamingEmojis(); }
}
function bindClick(id, callback) { const el = document.getElementById(id); if (el) el.onclick = callback; }

const emojiContainer = document.getElementById("emoji-container");
if(emojiContainer) {
  allEmojis.sort(() => 0.5 - Math.random()).slice(0, 10).forEach((emoji) => {
    const btn = document.createElement("button"); btn.className = "emoji-btn"; btn.innerText = emoji;
    btn.onclick = () => { document.querySelectorAll(".emoji-btn").forEach((b) => b.classList.remove("selected")); btn.classList.add("selected"); currentUser.emoji = emoji; playSound("click"); }; emojiContainer.appendChild(btn);
  });
}
bindClick("mute-btn", () => { isMuted = !isMuted; document.getElementById("mute-btn").innerText = isMuted ? "🔇 소리 OFF" : "🔊 소리 ON"; playSound("click"); });

function resetGameStates() {
  clearInterval(gameTimerInterval); clearInterval(cdInterval); isGamePaused = false; gameScore = 0; currentLiveStatus = "lobby";
  document.getElementById("huge-countdown-overlay").style.display = "none";
}
bindClick("back-to-menu-btn", () => { playSound("click"); document.getElementById("top-left-controls").style.display = "none"; resetGameStates(); if(liveStateUnsub) leaveLobby(); else showScreen("menu-screen"); });
bindClick("home-btn", () => { playSound("click"); showScreen("hub-screen"); }); 

// ==========================================
// 3. DB 로딩 및 로그인
// ==========================================
async function loadAllFromDB() {
  const authBtn = document.getElementById("auth-btn");
  try {
    const setSnap = await getDoc(doc(db, "gameData", "wordSets")); if (setSnap.exists()) wordSets = setSnap.data().sets || [];
    const stdSnap = await getDoc(doc(db, "gameData", "students")); if (stdSnap.exists()) studentList = stdSnap.data().students || [];
    if(authBtn) { authBtn.innerText = "[ENTER] 인증하기"; authBtn.disabled = false; authBtn.classList.add("btn-yellow"); }
    startRoamingEmojis(); // 첫 구동 
  } catch (error) { if(authBtn) authBtn.innerText = "연결 실패 (새로고침)"; }
}
loadAllFromDB(); 

bindClick("auth-btn", () => {
  playSound("click"); const inputId = document.getElementById("auth-id").value.trim(); const inputName = document.getElementById("auth-name").value.trim();
  if(!inputId || !inputName) return Swal.fire('WAIT', '학번과 이름을 입력하세요!', 'warning');
  const matchedStudent = studentList.find(s => s.stdId === inputId && s.name === inputName);
  if (matchedStudent) { currentUser.stdId = inputId; currentUser.realName = inputName; currentUser.classId = inputId.substring(0, 2); showScreen("login-screen"); } 
  else { Swal.fire('DENIED', '정보가 일치하지 않습니다.', 'error'); }
});
bindClick("login-btn", () => {
  playSound("click"); const nick = document.getElementById("nickname").value.trim();
  if (!nick || !currentUser.emoji) return Swal.fire('WAIT', '닉네임과 아이콘을 골라주세요!', 'warning');
  currentUser.nickname = nick; document.getElementById("user-display").innerText = `${currentUser.emoji} ${currentUser.nickname}`;
  showScreen("hub-screen");
});

// ==========================================
// 4. 허브 및 관리자
// ==========================================
bindClick("btn-singleplayer", () => {
  playSound("click"); if (wordSets.length === 0) return Swal.fire('EMPTY', '등록된 단어장이 없습니다.', 'info');
  renderSetSelectList(); showScreen("set-select-screen");
});
bindClick("btn-multiplayer", () => { playSound("click"); enterLobby(); });
bindClick("btn-hub-admin", async () => {
  playSound("click"); const { value: pwd } = await Swal.fire({ title: 'ADMIN ONLY', input: 'password', inputPlaceholder: 'PASSWORD'});
  if (pwd === "1234") showScreen("admin-main-screen"); else if (pwd) Swal.fire('ERROR', '비밀번호 불일치', 'error');
});

const setBtnClasses = ["btn-pink", "btn-cyan", "btn-green", "btn-purple", "btn-orange"];
function renderSetSelectList() {
  const container = document.getElementById("set-select-list"); container.innerHTML = "";
  wordSets.forEach(set => {
    const btn = document.createElement("button"); btn.className = `r-btn ${setBtnClasses[Math.floor(Math.random() * setBtnClasses.length)]}`; btn.style.width = "100%";
    btn.innerHTML = `${set.title} <br><span style="font-size:14px; color:#333;">(${set.words.length}개)</span>`;
    btn.onclick = () => { playSound("click"); if(set.words.length < 4) return Swal.fire('WAIT', '단어가 4개 미만입니다.', 'warning'); wordList = set.words; currentSetId = set.id; currentSetTitle = set.title; showScreen("menu-screen"); };
    container.appendChild(btn);
  });
}
bindClick("set-select-back-to-hub-btn", () => { playSound("click"); showScreen("hub-screen"); });
bindClick("menu-go-back-set-btn", () => { playSound("click"); showScreen("set-select-screen"); });
bindClick("admin-main-close-btn", () => { playSound("click"); showScreen("hub-screen"); });

// ==========================================
// 🌟 5. 라이브 멀티플레이 (학생)
// ==========================================
async function enterLobby() {
  if (wordSets.length === 0) return Swal.fire('EMPTY', '서버에 단어장이 없습니다.', 'info');
  showScreen("lobby-screen"); currentLiveStatus = "lobby";
  try { await setDoc(doc(db, "lobby_users", currentUser.stdId), { stdId: currentUser.stdId, nickname: currentUser.nickname, emoji: currentUser.emoji, online: true, timestamp: Date.now() }); } catch(e) {}
  
  const qUsers = query(collection(db, "lobby_users"), where("online", "==", true));
  lobbyUnsubUsers = onSnapshot(qUsers, (snap) => { let users = []; snap.forEach(d => users.push(d.data())); renderLobbyUsers(users); });
  const qChat = query(collection(db, "lobby_chat"), orderBy("timestamp", "desc"), limit(50));
  lobbyUnsubChat = onSnapshot(qChat, (snap) => { let msgs = []; snap.forEach(d => msgs.push(d.data())); msgs.reverse(); renderLobbyChat(msgs, "lobby-chat-box"); renderLobbyChat(msgs, "admin-lobby-chat-box"); });

  // 🌟 단어장 ID 비교 오류(문자열/숫자 타입) 완벽 해결: String() 캐스팅
  liveStateUnsub = onSnapshot(doc(db, "gameData", "liveRoom"), (docSnap) => {
    if(docSnap.exists()) {
      let data = docSnap.data(); 
      let targetSet = wordSets.find(s => String(s.id) === String(data.setId)); 
      let setText = targetSet ? targetSet.title : "세트 미정"; 
      document.getElementById("lobby-game-info").innerHTML = `MODE: ${modeNames[data.mode]||"미정"}<br>TIME: ${data.time/60}MIN<br>SET: ${setText}`;

      if (data.status === "practice" && currentLiveStatus !== "practice") {
        if(!targetSet) return Swal.fire('ERROR', '해당 단어장을 찾을 수 없습니다.', 'error');
        currentLiveStatus = "practice"; startLivePractice(data, targetSet.words);
      } else if (data.status === "playing" && currentLiveStatus !== "playing") {
        if(!targetSet) return;
        currentLiveStatus = "playing"; startLiveMainGame(data, targetSet.words);
      } else if (data.status === "ended" && currentLiveStatus !== "ended") {
        currentLiveStatus = "ended"; endLiveGame();
      } else if (data.status === "lobby" && currentLiveStatus !== "lobby") {
        currentLiveStatus = "lobby"; resetGameStates(); showScreen("lobby-screen");
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
  const c1 = document.getElementById("lobby-user-list"); if(c1) { c1.innerHTML = html; document.getElementById("lobby-user-count").innerText = users.length; } 
}
function renderLobbyChat(msgs, boxId) {
  const box = document.getElementById(boxId); if(!box) return;
  box.innerHTML = msgs.map(m => {
    const isMe = (m.stdId === currentUser.stdId) || (boxId === "admin-lobby-chat-box" && m.stdId === "ADMIN");
    return `<div class="chat-msg ${isMe ? 'me' : ''}">` + (isMe ? "" : `<span style="color:#aaa; font-size:12px;">${m.emoji} ${m.nickname}<br></span>`) + `${m.text}</div>`;
  }).join(""); box.scrollTop = box.scrollHeight;
}

function startLivePractice(config, targetWords) {
  resetGameStates(); currentLiveStatus = "practice";
  wordList = targetWords; currentSetId = config.setId; currentGameMode = config.mode;
  showScreen("speed-match-screen"); document.getElementById("top-left-controls").style.display = "flex";
  
  let banner = document.getElementById("live-sm-banner"); banner.style.display = "block"; banner.style.background = "var(--neon-dim)"; banner.innerText = "> PRACTICE (10S)";
  gameScore = 0; document.getElementById("sm-score").innerText = `SCORE: 0`;
  liveGameTimeRemaining = 10; document.getElementById("sm-timer").innerText = `TIME: 10`; 
  loadSpeedMatchRound(); 

  gameTimerInterval = setInterval(() => {
    if (!isGamePaused) { 
      liveGameTimeRemaining--; document.getElementById("sm-timer").innerText = `TIME: ${liveGameTimeRemaining}`;
      if (liveGameTimeRemaining <= 5 && liveGameTimeRemaining > 0) { 
        document.getElementById("huge-countdown-overlay").style.display = "flex"; 
        document.getElementById("huge-text").innerText = liveGameTimeRemaining; playSound("click"); 
      }
    }
  }, 1000);
}

function startLiveMainGame(config, targetWords) {
  resetGameStates(); currentLiveStatus = "playing";
  wordList = targetWords; currentSetId = config.setId; currentGameMode = config.mode;
  document.getElementById("huge-countdown-overlay").style.display = "none";
  
  showScreen("speed-match-screen"); document.getElementById("top-left-controls").style.display = "flex";
  let banner = document.getElementById("live-sm-banner"); banner.style.display = "block"; banner.style.background = "var(--neon-alert)"; banner.innerText = "> RANKED MATCH!";
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
  showScreen("result-screen"); document.getElementById("result-user").innerText = `${currentUser.emoji} ${currentUser.nickname}`; document.getElementById("final-score").innerText = currentUser.score; playSound("success"); confetti({ particleCount: 150, spread: 70, origin: { y: 0.6 } });
  try { addDoc(collection(db, "scores"), { stdId: currentUser.stdId, nickname: currentUser.nickname, emoji: currentUser.emoji, classId: currentUser.classId, score: currentUser.score, mode: currentGameMode, timestamp: Date.now(), setId: currentSetId, setTitle: currentSetTitle }); } catch(e) {}
}

// ==========================================
// 🌟 6. 라이브 통제실 (선생님)
// ==========================================
bindClick("admin-go-live-btn", async () => { 
  playSound("click"); if (wordSets.length === 0) return Swal.fire('EMPTY', '단어장 먼저 등록!', 'info'); 
  showScreen("admin-lobby-screen");
  const setSelect = document.getElementById("admin-live-set"); setSelect.innerHTML = "";
  wordSets.forEach(s => { let opt = document.createElement("option"); opt.value = s.id; opt.innerText = s.title; setSelect.appendChild(opt); });
  
  await pushAdminLiveState("lobby");
  ["admin-live-set", "admin-live-mode", "admin-live-time", "admin-live-team", "admin-live-item"].forEach(id => { document.getElementById(id).addEventListener("change", () => pushAdminLiveState("lobby")); });
});

async function pushAdminLiveState(statusStr) {
  let config = { status: statusStr, setId: document.getElementById("admin-live-set").value, mode: document.getElementById("admin-live-mode").value, time: parseInt(document.getElementById("admin-live-time").value), teamMode: document.getElementById("admin-live-team").value, items: document.getElementById("admin-live-item").value === "true" };
  await setDoc(doc(db, "gameData", "liveRoom"), config);
}

// 🌟 버그 차단: 방 나가면 타이머 폭파 및 로비 원상복구
bindClick("admin-lobby-leave-btn", async () => { 
  playSound("click"); 
  if(liveGameStartTimeout) clearTimeout(liveGameStartTimeout); 
  await pushAdminLiveState("lobby"); 
  showScreen("admin-main-screen"); 
});

bindClick("admin-lobby-chat-send-btn", () => {
  playSound("click"); const inputEl = document.getElementById("admin-lobby-chat-input"); const text = inputEl.value.trim(); if(!text) return; inputEl.value = "";
  addDoc(collection(db, "lobby_chat"), { stdId: "ADMIN", nickname: "SYSTEM", emoji: "📢", text: text, timestamp: Date.now() });
});
document.getElementById("admin-lobby-chat-input").addEventListener("keypress", (e) => { if(e.key === "Enter") document.getElementById("admin-lobby-chat-send-btn").click(); });

bindClick("admin-live-start-btn", async () => {
  playSound("click");
  const result = await Swal.fire({ title: 'LAUNCH MATCH?', text: "학생들을 연습게임(10초)으로 보냅니다.", icon: 'warning', showCancelButton: true, confirmButtonText: 'LAUNCH' });
  if(!result.isConfirmed) return;

  const qScores = query(collection(db, "liveRoom_scores")); const snapScores = await getDocs(qScores); const deletePromises = []; snapScores.forEach(d => deletePromises.push(deleteDoc(d.ref))); await Promise.all(deletePromises);
  
  await pushAdminLiveState("practice");
  showScreen("admin-live-monitor-screen"); document.getElementById("admin-live-status-text").innerText = "> PRACTICE_MODE (10s)"; document.getElementById("admin-live-status-text").style.color = "var(--neon-dim)";
  startAdminMonitor();
  
  // 🌟 타이머 누수 차단!
  if(liveGameStartTimeout) clearTimeout(liveGameStartTimeout);
  liveGameStartTimeout = setTimeout(async () => { 
    await pushAdminLiveState("playing"); 
    document.getElementById("admin-live-status-text").innerText = "> RANKED_MATCH_ONGOING"; 
    document.getElementById("admin-live-status-text").style.color = "var(--neon-green)";
  }, 10500); 
});

bindClick("admin-live-end-btn", async () => {
  playSound("click"); const result = await Swal.fire({ title: 'FORCE STOP?', text: "게임을 끝냅니다.", icon: 'warning', showCancelButton: true, confirmButtonText: 'STOP' }); if(!result.isConfirmed) return;
  if(liveGameStartTimeout) clearTimeout(liveGameStartTimeout); 
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
      row.style.top = (idx * 50) + "px"; 
    });
  });
}

// ==========================================
// 🌟 7. 싱글플레이 게임 라우팅 (복구 완료!)
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

function startCountdown(screenId, logicCallback) {
  showScreen(screenId); document.getElementById("top-left-controls").style.display = "flex";
  let count = 3; document.getElementById("huge-countdown-overlay").style.display = "flex"; document.getElementById("huge-text").innerText = count;
  cdInterval = setInterval(() => { count--; if (count > 0) { playSound("click"); document.getElementById("huge-text").innerText = count; } else { clearInterval(cdInterval); document.getElementById("huge-countdown-overlay").style.display = "none"; playSound("success"); gameScore = 0; lastMatchTime = Date.now(); logicCallback(); } }, 1000);
}

bindClick("menu-exam-btn", () => { playSound("click"); showScreen("exam-option-screen"); });
bindClick("exam-option-back-btn", () => { playSound("click"); showScreen("menu-screen"); });
bindClick("exam1-btn", () => { playSound("click"); currentGameMode = "exam1"; startCountdown("exam1-screen", startExam1Logic); });
bindClick("exam2-btn", () => { playSound("click"); currentGameMode = "exam2"; startCountdown("exam2-screen", startExam2Logic); });

// 🌟 복구된 게임 버튼 연결!
bindClick("menu-speed-match-btn", () => { playSound("click"); currentGameMode = "speed-match"; startCountdown("speed-match-screen", startSpeedMatchLogic); });
bindClick("menu-fc-btn", () => { playSound("click"); currentGameMode = "fc"; startCountdown("flashcard-screen", startFlashcard); });
bindClick("menu-memory-btn", () => { playSound("click"); currentGameMode = "memory"; startCountdown("memory-screen", startMemoryLogic); });
bindClick("menu-speed-btn", () => { playSound("click"); currentGameMode = "speed"; startCountdown("speed-screen", startSpeedLogic); });
bindClick("menu-fish-btn", () => { playSound("click"); currentGameMode = "fish"; startCountdown("fishing-screen", startFishingLogic); });

// ==========================================
// 🌟 8. 신규: 문장 해석 (청크) 모드 로직
// ==========================================
bindClick("menu-chunk-btn", () => { playSound("click"); currentGameMode = "chunk"; startCountdown("chunk-screen", startChunkLogic); });

let chunkQueue = []; let chunkCurrentIndex = 0; let chunkWords = []; let chunkSlots = []; let currentChunkTarget = [];

function startChunkLogic() {
  chunkQueue = [...wordList].sort(() => 0.5 - Math.random()); chunkCurrentIndex = 0; document.getElementById("chunk-score").innerText = `SCORE: 0`; loadChunkQuestion();
}

function loadChunkQuestion() {
  if(chunkCurrentIndex >= chunkQueue.length) { currentUser.score = gameScore; goResult(); return; }
  let q = chunkQueue[chunkCurrentIndex]; 
  document.getElementById("chunk-progress").innerText = `${chunkCurrentIndex + 1}/${chunkQueue.length}`; 
  document.getElementById("chunk-en").innerText = q.en;
  
  // 슬래시(/) 단위로 한글 자르기, 슬래시 없으면 전체가 한 덩어리
  currentChunkTarget = q.ko.split('/').map(s => s.trim()).filter(s => s !== "");
  chunkWords = currentChunkTarget.map((w, i) => ({ id: i, text: w })).sort(() => 0.5 - Math.random()); 
  chunkSlots = []; renderChunkCards();
}

function renderChunkCards() {
  const pool = document.getElementById("chunk-pool"); const slots = document.getElementById("chunk-slots"); const submitBtn = document.getElementById("chunk-submit-btn"); pool.innerHTML = ''; slots.innerHTML = '';
  chunkWords.forEach(item => { 
    let btn = document.createElement("button"); btn.className = "game-card chunk-piece"; btn.innerText = item.text; 
    btn.onclick = () => { if(isGamePaused) return; playSound("click"); chunkSlots.push(item); chunkWords = chunkWords.filter(w => w.id !== item.id); renderChunkCards(); }; 
    pool.appendChild(btn); 
  });
  chunkSlots.forEach(item => { 
    let btn = document.createElement("button"); btn.className = "game-card chunk-piece"; btn.style.background = "#FFEB3B"; btn.innerText = item.text; 
    btn.onclick = () => { if(isGamePaused) return; playSound("click"); chunkWords.push(item); chunkSlots = chunkSlots.filter(w => w.id !== item.id); renderChunkCards(); }; 
    slots.appendChild(btn); 
  });
  if (chunkWords.length === 0 && chunkSlots.length > 0) submitBtn.style.display = "block"; else submitBtn.style.display = "none";
}

bindClick("chunk-submit-btn", () => {
  if(isGamePaused) return; isGamePaused = true;
  // 순서대로 조립된 배열이 원본 배열과 똑같은지 확인
  let isCorrect = chunkSlots.every((item, idx) => item.text === currentChunkTarget[idx]);
  
  if (isCorrect) { 
    playSound("success"); gameScore += 100; document.getElementById("chunk-score").innerText = `SCORE: ${gameScore}`; 
    setTimeout(() => { chunkCurrentIndex++; isGamePaused = false; loadChunkQuestion(); }, 600); 
  } else { 
    playSound("wrong"); gameScore = Math.max(0, gameScore - 50); document.getElementById("chunk-score").innerText = `SCORE: ${gameScore}`; 
    chunkSlots.forEach(btn => btn.classList?.add("wrong")); // 틀림 이펙트
    setTimeout(() => { chunkWords = [...chunkWords, ...chunkSlots]; chunkSlots = []; renderChunkCards(); isGamePaused = false; }, 600); 
  }
});

// ==========================================
// 🌟 9. 나머지 싱글 게임 로직 (복구 완료!)
// ==========================================

// 🧩 짝맞추기
function startSpeedMatchLogic() { smRound = 1; gameTimeRemaining = 180; document.getElementById("sm-timer").innerText = `TIME: 180`; document.getElementById("sm-score").innerText = `SCORE: 0`; loadSpeedMatchRound(); gameTimerInterval = setInterval(() => { if (!isGamePaused) { gameTimeRemaining--; document.getElementById("sm-timer").innerText = `TIME: ${gameTimeRemaining}`; if (gameTimeRemaining <= 0) { currentUser.score = gameScore; goResult(); } } }, 1000); }
function loadSpeedMatchRound() { smPairsFound = 0; smSelected = []; const leftCol = document.getElementById("sm-left-col"); const rightCol = document.getElementById("sm-right-col"); leftCol.innerHTML = ""; rightCol.innerHTML = ""; let shuffled = [...wordList].sort(() => 0.5 - Math.random()); let roundWords = shuffled.slice(0, 4); let leftPool = roundWords.map(w => ({ text: w.en, id: w.en, side: 'left' })).sort(() => 0.5 - Math.random()); let rightPool = roundWords.map(w => ({ text: w.ko, id: w.en, side: 'right' })).sort(() => 0.5 - Math.random()); leftPool.forEach(item => leftCol.appendChild(createSmCard(item))); rightPool.forEach(item => rightCol.appendChild(createSmCard(item))); }
function createSmCard(item) { const wrapper = document.createElement("div"); wrapper.className = `sm-card-wrapper`; const card = document.createElement("div"); card.className = `game-card`; card.innerText = item.text; wrapper.appendChild(card); wrapper.onclick = () => { if (isGamePaused || card.classList.contains("selected") || card.classList.contains("matched")) return; if (smSelected.length === 1 && smSelected[0].side === item.side) { smSelected[0].el.classList.remove("selected"); smSelected = []; return;} playSound("click"); card.classList.add("selected"); smSelected.push({ id: item.id, side: item.side, el: card, wrapper }); if (smSelected.length === 2) { isGamePaused = true; checkSmMatch(); } }; return wrapper; }
function checkSmMatch() { let [c1, c2] = smSelected; if (c1.id === c2.id) { playSound("success"); gameScore += 100; document.getElementById("sm-score").innerText = `SCORE: ${gameScore}`; updateMyLiveScore(); c1.el.classList.add("matched"); c2.el.classList.add("matched"); smPairsFound++; smSelected = []; setTimeout(() => { if (smPairsFound === 4) { smRound++; loadSpeedMatchRound(); } isGamePaused = false; }, 300); } else { playSound("wrong"); gameScore = Math.max(0, gameScore - 50); document.getElementById("sm-score").innerText = `SCORE: ${gameScore}`; updateMyLiveScore(); c1.el.classList.add("wrong"); c2.el.classList.add("wrong"); setTimeout(() => { c1.el.classList.remove("selected", "wrong"); c2.el.classList.remove("selected", "wrong"); smSelected = []; isGamePaused = false; }, 300); } }

// 📝 시험 1단계 (순서 맞추기 - 띄어쓰기 기준)
function startExam1Logic() { examQueue = [...wordList].sort(() => 0.5 - Math.random()); examCurrentIndex = 0; document.getElementById("exam1-score").innerText = `SCORE: 0`; loadExam1Question(); }
function loadExam1Question() { if(examCurrentIndex >= examQueue.length) { currentUser.score = gameScore; goResult(); return; } let q = examQueue[examCurrentIndex]; document.getElementById("exam1-progress").innerText = `${examCurrentIndex + 1}/${examQueue.length}`; document.getElementById("exam1-ko").innerText = q.ko; let words = q.en.split(' ').filter(w => w.trim() !== ''); examWords = words.map((w, i) => ({ id: i, text: w })).sort(() => 0.5 - Math.random()); examSlots = []; renderExam1Cards(); }
function renderExam1Cards() { const pool = document.getElementById("exam1-pool"); const slots = document.getElementById("exam1-slots"); const submitBtn = document.getElementById("exam1-submit-btn"); pool.innerHTML = ''; slots.innerHTML = ''; examWords.forEach(item => { let btn = document.createElement("button"); btn.className = "game-card"; btn.style.padding="10px"; btn.innerText = item.text; btn.onclick = () => { if(isGamePaused) return; playSound("click"); examSlots.push(item); examWords = examWords.filter(w => w.id !== item.id); renderExam1Cards(); }; pool.appendChild(btn); }); examSlots.forEach(item => { let btn = document.createElement("button"); btn.className = "game-card"; btn.style.padding="10px"; btn.style.background = "#FFEB3B"; btn.innerText = item.text; btn.onclick = () => { if(isGamePaused) return; playSound("click"); examWords.push(item); examSlots = examSlots.filter(w => w.id !== item.id); renderExam1Cards(); }; slots.appendChild(btn); }); if (examWords.length === 0 && examSlots.length > 0) submitBtn.style.display = "block"; else submitBtn.style.display = "none"; }
bindClick("exam1-submit-btn", () => { if(isGamePaused) return; isGamePaused = true; let answer = examSlots.map(item => item.text).join(' '); let target = examQueue[examCurrentIndex].en.split(' ').filter(w => w.trim()!== '').join(' '); if (answer === target) { playSound("success"); gameScore += 100; document.getElementById("exam1-score").innerText = `SCORE: ${gameScore}`; setTimeout(() => { examCurrentIndex++; isGamePaused = false; loadExam1Question(); }, 600); } else { playSound("wrong"); gameScore = Math.max(0, gameScore - 50); document.getElementById("exam1-score").innerText = `SCORE: ${gameScore}`; setTimeout(() => { examWords = [...examWords, ...examSlots]; examSlots = []; renderExam1Cards(); isGamePaused = false; }, 600); } });

// ✍️ 시험 2단계 (직접 쓰기)
function startExam2Logic() { examQueue = [...wordList].sort(() => 0.5 - Math.random()); examCurrentIndex = 0; document.getElementById("exam2-score").innerText = `SCORE: 0`; loadExam2Question(); }
function loadExam2Question() { if(examCurrentIndex >= examQueue.length) { currentUser.score = gameScore; goResult(); return; } let q = examQueue[examCurrentIndex]; document.getElementById("exam2-progress").innerText = `${examCurrentIndex + 1}/${examQueue.length}`; document.getElementById("exam2-ko").innerText = q.ko; document.getElementById("exam2-input").value = ''; document.getElementById("exam2-input").classList.remove("wrong"); setTimeout(()=> document.getElementById("exam2-input").focus(), 100); }
bindClick("exam2-submit-btn", () => { if(isGamePaused) return; isGamePaused = true; let inputVal = document.getElementById("exam2-input").value; let target = examQueue[examCurrentIndex].en; let normInput = inputVal.toLowerCase().replace(/[^a-z0-9]/gi, ''); let normTarget = target.toLowerCase().replace(/[^a-z0-9]/gi, ''); if (normInput === normTarget && normTarget.length > 0) { playSound("success"); gameScore += 100; document.getElementById("exam2-score").innerText = `SCORE: ${gameScore}`; setTimeout(() => { examCurrentIndex++; isGamePaused = false; loadExam2Question(); }, 600); } else { playSound("wrong"); gameScore = Math.max(0, gameScore - 50); document.getElementById("exam2-score").innerText = `SCORE: ${gameScore}`; document.getElementById("exam2-input").classList.add("wrong"); setTimeout(() => { document.getElementById("exam2-input").classList.remove("wrong"); isGamePaused = false; document.getElementById("exam2-input").focus(); }, 600); } });
document.getElementById("exam2-input").addEventListener("keypress", function(e) { if (e.key === "Enter") { e.preventDefault(); document.getElementById("exam2-submit-btn").click(); } });

// 🃏 깜빡이
function startFlashcard() { fcQueue = [...wordList]; fcKnown=0; fcScore=0; unknownWordsHistory=[]; isRetryPhase=false; document.getElementById("fc-score").innerText="SCORE: 0"; nextFlashcard("pop-in"); }
function nextFlashcard(animClass) { if (fcQueue.length === 0) { if (!isRetryPhase && unknownWordsHistory.length > 0) { isRetryPhase = true; fcQueue = [...unknownWordsHistory].sort(() => 0.5 - Math.random()); nextFlashcard("pop-in"); return; } else { currentUser.score = fcScore; goResult(); return; } } hasFlippedToCheck = false; document.getElementById("btn-know").disabled=true; document.getElementById("btn-dont-know").disabled=true; fcCurrent = fcQueue[0]; fcIsFlipped = false; let total = isRetryPhase ? unknownWordsHistory.length : wordList.length; let currentIdx = total - fcQueue.length + 1; document.getElementById("fc-progress").innerText = `${currentIdx}/${total}`; let fcCard = document.getElementById("fc-card"); fcCard.classList.remove("is-flipped"); fcCard.className = `flash-card ${animClass}`; document.getElementById("fc-front").innerText = fcCurrent.en; document.getElementById("fc-back").innerText = fcCurrent.ko; fcIsAnimating = true; cardAppearTime = Date.now(); setTimeout(() => { fcIsAnimating = false; fcCard.className = "flash-card"; }, 400); }
bindClick("fc-card", () => { if (fcIsAnimating) return; playSound("click"); fcIsFlipped = !fcIsFlipped; let fcCard = document.getElementById("fc-card"); if (fcIsFlipped) { fcCard.classList.add("is-flipped"); hasFlippedToCheck = true; document.getElementById("btn-know").disabled=false; document.getElementById("btn-dont-know").disabled=false; } else { fcCard.classList.remove("is-flipped"); } });
bindClick("btn-know", () => { if (!hasFlippedToCheck || fcIsAnimating) return; fcIsAnimating = true; playSound("click"); fcScore += 100; document.getElementById("fc-score").innerText = "SCORE: " + fcScore; document.getElementById("fc-card").className = "flash-card fly-left"; setTimeout(() => { fcQueue.shift(); fcKnown++; nextFlashcard("pop-in"); }, 300); });
bindClick("btn-dont-know", () => { if (!hasFlippedToCheck || fcIsAnimating) return; fcIsAnimating = true; playSound("wrong"); if (!isRetryPhase) { const alreadySaved = unknownWordsHistory.find((w) => w.en === fcCurrent.en); if (!alreadySaved) unknownWordsHistory.push(fcCurrent); } let cardEl = document.getElementById("fc-card"); cardEl.style.transform = `scale(0)`; setTimeout(() => { cardEl.style.transform = ""; fcQueue.push(fcQueue.shift()); nextFlashcard("pop-in"); }, 300); });

// 🔠 메모리
function startMemoryLogic() { memoryRound = 1; gameTimeRemaining = 180; document.getElementById("memory-timer").innerText = `TIME: 180`; loadMemoryRound(); gameTimerInterval = setInterval(() => { if (!isGamePaused) { gameTimeRemaining--; document.getElementById("memory-timer").innerText = `TIME: ${gameTimeRemaining}`; if (gameTimeRemaining <= 0) { currentUser.score = gameScore; goResult(); } } }, 1000); }
function loadMemoryRound() { memoryPairsFound = 0; memoryFlipped = []; const leftCol = document.getElementById("memory-left-col"); const rightCol = document.getElementById("memory-right-col"); leftCol.innerHTML = ""; rightCol.innerHTML = ""; let shuffled = [...wordList].sort(() => 0.5 - Math.random()); let roundWords = shuffled.slice(0, 4); let leftPool = roundWords.map(w => ({ text: w.en, id: w.en, side: 'left' })).sort(() => 0.5 - Math.random()); let rightPool = roundWords.map(w => ({ text: w.ko, id: w.en, side: 'right' })).sort(() => 0.5 - Math.random()); leftPool.forEach(item => leftCol.appendChild(createMemoryCard(item))); rightPool.forEach(item => rightCol.appendChild(createMemoryCard(item))); }
function createMemoryCard(item) { const wrapper = document.createElement("div"); wrapper.className = `memory-card-wrapper`; const card = document.createElement("div"); card.className = `memory-card memory-card-${item.side}`; const front = document.createElement("div"); front.className = "memory-card-face memory-card-front"; front.innerText = "?"; const back = document.createElement("div"); back.className = "memory-card-face memory-card-back"; back.innerText = item.text; card.appendChild(front); card.appendChild(back); wrapper.appendChild(card); wrapper.onclick = () => { if (isGamePaused || card.classList.contains("flipped")) return; if (memoryFlipped.length === 1 && memoryFlipped[0].side === item.side) return; playSound("click"); card.classList.add("flipped"); memoryFlipped.push({ id: item.id, side: item.side, el: card, wrapper }); if (memoryFlipped.length === 2) { isGamePaused = true; let [c1, c2] = memoryFlipped; if (c1.id === c2.id) { setTimeout(() => { playSound("success"); gameScore += 100; document.getElementById("memory-score").innerText = `SCORE: ${gameScore}`; c1.el.classList.add("matched"); c2.el.classList.add("matched"); memoryPairsFound++; memoryFlipped = []; if (memoryPairsFound === 4) { memoryRound++; setTimeout(loadMemoryRound, 500); } isGamePaused = false; }, 500); } else { setTimeout(() => { playSound("wrong"); setTimeout(() => { c1.el.classList.remove("flipped"); c2.el.classList.remove("flipped"); memoryFlipped = []; isGamePaused = false; }, 500); }, 500); } } }; return wrapper; }

// ⚡ 퀴즈
function startSpeedLogic() { gameTimeRemaining = 180; document.getElementById("speed-timer").innerText = `TIME: 180`; loadNextSpeedQuiz(); gameTimerInterval = setInterval(() => { if (!isGamePaused) { gameTimeRemaining--; document.getElementById("speed-timer").innerText = `TIME: ${gameTimeRemaining}`; if (gameTimeRemaining <= 0) { currentUser.score = gameScore; goResult(); } } }, 1000); }
function loadNextSpeedQuiz() { sqCurrentWord = wordList[Math.floor(Math.random() * wordList.length)]; let wrongWord = wordList[Math.floor(Math.random() * wordList.length)]; while(wrongWord.ko === sqCurrentWord.ko && wordList.length > 1) wrongWord = wordList[Math.floor(Math.random() * wordList.length)]; const wordBox = document.getElementById("speed-word-card"); const btn1 = document.getElementById("speed-opt-1"); const btn2 = document.getElementById("speed-opt-2"); wordBox.innerText = sqCurrentWord.en; let opts = [ {text: sqCurrentWord.ko, isCorrect: true}, {text: wrongWord.ko, isCorrect: false} ]; opts.sort(() => 0.5 - Math.random()); [btn1, btn2].forEach((btn, idx) => { btn.innerText = opts[idx].text; btn.onclick = () => { if (isGamePaused) return; if(opts[idx].isCorrect) { playSound("success"); gameScore += 100; document.getElementById("speed-score").innerText=`SCORE: ${gameScore}`; loadNextSpeedQuiz(); } else { playSound("wrong"); gameScore = Math.max(0, gameScore - 50); document.getElementById("speed-score").innerText=`SCORE: ${gameScore}`; loadNextSpeedQuiz(); } }; }); }

// 🎣 낚시
function startFishingLogic() { document.getElementById("fish-bucket").innerHTML = ""; document.getElementById("fish-pond").innerHTML = ""; fishEmojisCaught = 0; caughtEmojisList = []; gameTimeRemaining = 180; document.getElementById("fish-timer").innerText = `TIME: 180`; isFishing = true; fishCards = []; fishSelected = []; let shuffled = [...wordList].sort(() => 0.5 - Math.random()); for (let i = 0; i < 3; i++) { createFishEl(shuffled[i].en, "en", shuffled[i].en); createFishEl(shuffled[i].ko, "ko", shuffled[i].en); } createFishEl(shuffled[3].en, "en", shuffled[3].en); createFishEl(shuffled[4].ko, "ko", shuffled[4].en); lastFrameTime = performance.now(); requestAnimationFrame(moveFishes); gameTimerInterval = setInterval(() => { if(!isGamePaused){ gameTimeRemaining--; document.getElementById("fish-timer").innerText = `TIME: ${gameTimeRemaining}`; if (gameTimeRemaining <= 0) { currentUser.score = fishEmojisCaught * 50; goResult(); } } }, 1000); }
function createFishEl(text, lang, targetId) { const el = document.createElement("div"); el.className = "fish-card"; let emoji = allEmojis[Math.floor(Math.random() * allEmojis.length)]; el.innerHTML = `<div class="fish-emoji">${emoji}</div><div class="fish-text">${text}</div>`; document.getElementById("fish-pond").appendChild(el); let angle = Math.random() * Math.PI * 2; let speed = 80 + Math.random() * 80; let vx = Math.cos(angle) * speed; let vy = Math.sin(angle) * speed; let x = document.getElementById("fish-pond").clientWidth / 2; let y = document.getElementById("fish-pond").clientHeight / 2; let fishObj = { el, text, lang, targetId, emoji, x, y, vx, vy }; fishCards.push(fishObj); el.onclick = () => { if (isGamePaused || fishSelected.length >= 2 || fishSelected.includes(fishObj)) return; playSound("click"); el.classList.add("selected"); fishSelected.push(fishObj); if (fishSelected.length === 2) { let [f1, f2] = fishSelected; if (f1.lang !== f2.lang && f1.targetId === f2.targetId) { playSound("success"); fishEmojisCaught += 2; document.getElementById("fish-score").innerText=`이모지: ${fishEmojisCaught}`; const bucket = document.getElementById("fish-bucket"); bucket.innerHTML += `<span>${f1.emoji}</span>`; f1.el.remove(); f2.el.remove(); fishCards = fishCards.filter((c) => c !== f1 && c !== f2); refillFishes(); fishSelected = []; } else { playSound("wrong"); setTimeout(() => { f1.el.classList.remove("selected"); f2.el.classList.remove("selected"); fishSelected = []; }, 400); } } }; }
function refillFishes() { let enIds = fishCards.filter((f) => f.lang === "en").map((f) => f.targetId); let koIds = fishCards.filter((f) => f.lang === "ko").map((f) => f.targetId); let matchCount = enIds.filter(id => koIds.includes(id)).length; let unmatchedEn = enIds.filter(id => !koIds.includes(id)); let unmatchedKo = koIds.filter(id => !enIds.includes(id)); let spawnList = []; if (matchCount >= 2) { let w1 = wordList[Math.floor(Math.random() * wordList.length)]; let w2 = wordList[Math.floor(Math.random() * wordList.length)]; while (w1.en === w2.en && wordList.length > 1) w2 = wordList[Math.floor(Math.random() * wordList.length)]; spawnList.push({ id: w1.en, lang: "en" }); spawnList.push({ id: w2.en, lang: "ko" }); } else if (matchCount === 1) { if (unmatchedEn.length > 0) spawnList.push({ id: unmatchedEn[0], lang: "ko" }); else if (unmatchedKo.length > 0) spawnList.push({ id: unmatchedKo[0], lang: "en" }); else { let w = wordList[Math.floor(Math.random() * wordList.length)]; spawnList.push({ id: w.en, lang: "ko" }); } let w2 = wordList[Math.floor(Math.random() * wordList.length)]; while (w2.en === spawnList[0].id && wordList.length > 1) w2 = wordList[Math.floor(Math.random() * wordList.length)]; spawnList.push({ id: w2.en, lang: spawnList[0].lang === "en" ? "ko" : "en" }); } else { let resolved = 0; if (unmatchedEn.length > 0) { spawnList.push({ id: unmatchedEn[0], lang: "ko" }); resolved++; } if (resolved < 2 && unmatchedEn.length > 1) { spawnList.push({ id: unmatchedEn[1], lang: "ko" }); resolved++; } if (resolved < 2 && unmatchedKo.length > 0) { spawnList.push({ id: unmatchedKo[0], lang: "en" }); resolved++; } if (resolved < 2 && unmatchedKo.length > 1) { spawnList.push({ id: unmatchedKo[1], lang: "en" }); resolved++; } } spawnList.forEach((item) => { let wordObj = wordList.find((w) => w.en === item.id); if (wordObj) createFishEl(item.lang === "en" ? wordObj.en : wordObj.ko, item.lang, item.id); }); }
function moveFishes(currentTime) { if (!isFishing) return; let dt = (currentTime - lastFrameTime) / 1000; if (dt > 0.1) dt = 0.016; lastFrameTime = currentTime; if(!isGamePaused) { const pondW = document.getElementById("fish-pond").clientWidth; const pondH = document.getElementById("fish-pond").clientHeight; fishCards.forEach((f) => { const w = f.el.offsetWidth || 50; const h = f.el.offsetHeight || 50; f.x += f.vx * dt; f.y += f.vy * dt; if (f.x <= 0) { f.x = 0; f.vx *= -1; } if (f.x + w >= pondW) { f.x = pondW - w; f.vx *= -1; } if (f.y <= 0) { f.y = 0; f.vy *= -1; } if (f.y + h >= pondH) { f.y = pondH - h; f.vy *= -1; } let scale = f.el.classList.contains("selected") ? "scale(1.1)" : "scale(1)"; f.el.style.transform = `translate3d(${f.x}px, ${f.y}px, 0) ${scale}`; }); } requestAnimationFrame(moveFishes); }

// ==========================================
// 🌟 10. 결과 및 DB 저장
// ==========================================
async function goResult() {
  clearInterval(gameTimerInterval); clearInterval(cdInterval); isGamePaused = true; 
  document.getElementById("top-left-controls").style.display = "none"; showScreen("result-screen");
  document.getElementById("result-user").innerText = `${currentUser.emoji} ${currentUser.nickname}`;
  document.getElementById("final-score").innerText = currentUser.score; playSound("success");
  confetti({ particleCount: 150, spread: 70, origin: { y: 0.6 } });
  if(currentLiveStatus !== "ended") { try { await addDoc(collection(db, "scores"), { stdId: currentUser.stdId, nickname: currentUser.nickname, emoji: currentUser.emoji, classId: currentUser.classId, score: currentUser.score, mode: currentGameMode, timestamp: Date.now(), setId: currentSetId, setTitle: currentSetTitle }); } catch(e) {} }
}

bindClick("go-ranking-btn", () => { playSound("click"); showRankings("today", currentGameMode); });
bindClick("tab-today", () => { playSound("click"); showRankings("today", currentRankingMode); });
bindClick("tab-class", () => { playSound("click"); showRankings("class", currentRankingMode); });
bindClick("ranking-home-btn", () => { playSound("click"); showScreen("hub-screen"); });

async function showRankings(tab, mode = currentRankingMode) {
  currentRankingMode = mode; showScreen("ranking-screen");
  document.getElementById("ranking-mode-title").innerText = `> ${modeNames[mode] || "전체"}`;
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

// 🌟 관리자 단어장 / 학생 관리 기능
bindClick("admin-go-student-btn", () => { showScreen("admin-student-screen"); });
bindClick("admin-go-set-btn", () => { renderAdminSetList(); showScreen("admin-set-list-screen"); });
bindClick("admin-student-back-btn", () => { showScreen("admin-main-screen"); });
bindClick("admin-set-list-back-btn", () => { showScreen("admin-main-screen"); });
bindClick("admin-set-edit-cancel-btn", () => { showScreen("admin-set-list-screen"); });
bindClick("admin-student-upload-btn", async () => {
  playSound("click"); const text = document.getElementById("admin-student-textarea").value; const lines = text.trim().split("\n"); let addedCount = 0;
  for (let line of lines) { const parts = line.split('\t'); if (parts.length >= 2 && parts[0].trim() !== "" && parts[1].trim() !== "") { const stdId = parts[0].trim(); const name = parts[1].trim(); const existingIndex = studentList.findIndex(s => s.stdId === stdId); if(existingIndex >= 0) studentList[existingIndex].name = name; else studentList.push({ stdId, name }); addedCount++; } }
  if (addedCount === 0) return Swal.fire('ERROR', '정보가 없습니다.', 'error');
  try { await setDoc(doc(db, "gameData", "students"), { students: studentList }); Swal.fire('SUCCESS', `${addedCount}명 저장 완료!`, 'success'); document.getElementById("admin-student-textarea").value = ""; } catch (error) {}
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
