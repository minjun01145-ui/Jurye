//1. 파이어베이스 라이브러리 불러오기
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-app.js";
import { getFirestore, doc, setDoc, getDoc, collection, addDoc, getDocs, onSnapshot, query, orderBy, limit, deleteDoc } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-firestore.js";

//2. 파이어베이스 세팅
const firebaseConfig = {
  apiKey: "AIzaSyAh3e5ruxctlhv-OwBAQl5WDds0IZooPD0",
  authDomain: "test2222-e2458.firebaseapp.com",
  projectId: "test2222-e2458",
  storageBucket: "test2222-e2458.firebasestorage.app",
  messagingSenderId: "848561047931",
  appId: "1:848561047931:web:ec05133741eb2a6ce195de",
  measurementId: "G-HV5RS45JG3"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

//3. 글로벌 상태 변수들
let wordSets = []; 
let studentList = []; 
let currentEditingSetId = null; 
let wordList = []; 
let unknownWordsHistory = [];

let gameTimerInterval;
let cdInterval;
let gameTimeRemaining = 0; 
let gameScore = 0; 
let lastMatchTime = 0;
let currentGameMode = ""; 
let currentRankingMode = ""; 
let globalScoreMultiplier = 1; 
let isGamePaused = false; 
let isFishing = false; 
let fcIsRandom = false;  
let currentSetId = null; 
let currentSetTitle = ""; 

let isWordHidden = false;
let isMeanHidden = false;
let starData = {};

let currentUser = { stdId: "", realName: "", classId: "", nickname: "", emoji: "", score: 0, caughtEmojis: "" };
let lobbyUsersUnsubscribe = null;
let lobbyChatUnsubscribe = null;
let myLobbyDocId = null; // 대기실에서 탈퇴할 때 쓸 내 고유 ID
let globalMultiEndTime = null; // 🚀 멀티플레이 절대 종료 시간 각인용 변수
let multiUseSpecialItems = false; // 🚀 특수 아이템 사용 여부 전역 변수 추가
let myLobbyListenerUnsubscribe = null; // 내 개인 공격 수신용 리스너
let isTeacherMode = false; // 🚀 현재 브라우저가 교사 제어 모드인지 판별하는 안전 플래그 추가
let multiRoomUnsubscribe = null;
let teacherLiveUnsubscribe = null;
let teacherMatchInterval = null;
const allEmojis = ["🎮", "🕹️", "🎲", "🎯", "🐶", "🐱", "🍓", "😎", "🤩", "🚀", "🌟", "🔥", "🦄", "🍀", "🍔", "👽","😀","😂","😍","🥳","👻","🤡","🤗","🤔","🤐","🐭","🐹","🐰","🦊","🐻","🐼","🐨","🐯","🦁","🐮","🐷","🐸","🐵","🐧","🐤","🦆","🦉","🦇","🐺","🐝","🦋","🐢","🐍","🦖","🐙","🦑","🦀","🐠","🐬","🐳","🦈","🐅","🦓","🦍","🐘","🐫","🦒","🦘","🐎","🐏","🐐","🦌","🐕","🐈","🦚","🦜","🦢","🦩","🕊","🦝","🦨","🦥","🐿","🦔","🐉","🍎","🍊","🍋","🍌","🍉","🍇","🫐","🍒","🍑","🍍","🥥","🥝","🍅","🥑","🥦","🥒","🌶","🌽","🥕","🥔","🍠","🥐","🍞","🥨","🧀","🍳","🥞","🥓","🥩","🍗","🌭","🍟","🍕","🥪","🌮","🥗","🍣","🍱","🥟","🍤","🍙","🍚","🍧","🍦","🍰","🎂","🍭","🍬","🍫","🍩","🍪","🍯","🍼","☕️","🧃","🥤","🍺","🍻","🥂","🍷","🥃","🧊","⚽️","🏀","🏈","⚾️","🎾","🏐","🏓","🏸","🥊","🛹","⛸","🎿","🏂","🏋️","🏄","🏊","🚴","🏆","🥇","🏅","🎟","🎪","🎭","🎨","🎬","🎤","🎧","🎹","🥁","🎸","🎳","🎰","🧩","🚗","🚓","🚑","🚒","🚜","🚲","🛵","🏍","✈️","🚁","⛵️","🛳","🗺","🗽","🏰","🎡","🎢","⛺️","🏠","🏢","🏥","🏦","🏫","⛪️","🌅","🌌","⌚️","📱","💻","⌨️","🖥","📷","📸","🎥","📞","☎️","📺","📻","⏱","⏰","⏳","💡","💸","💵","💰","💳","💎","🛠","🔫","💣","🪄"];
const praises = ["Fabulous!", "Terrific!", "Awesome!", "Incredible!", "Great Job!", "Perfect!"];

let isMuted = false; // BGM이 없어졌으므로 이 변수는 효과음 전체 음소거용으로 씁니다.

let globalAudioCtx = null;
function getAudioCtx() {
  if (!globalAudioCtx) {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return null;
    globalAudioCtx = new AudioContext();
  }
  if (globalAudioCtx.state === "suspended") globalAudioCtx.resume();
  return globalAudioCtx;
}

function playSound(type) {
  if (isMuted) return; // 음소거 상태면 소리를 내지 않음

  try {
    const ctx = getAudioCtx();
    if (!ctx) return;
    const osc = ctx.createOscillator(); const gainNode = ctx.createGain();
    osc.connect(gainNode); gainNode.connect(ctx.destination);
    
    if (type === "click") { // 일반 메뉴 버튼 소리
      osc.type = "sine"; osc.frequency.setValueAtTime(600, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(800, ctx.currentTime + 0.1);
      gainNode.gain.setValueAtTime(0.1, ctx.currentTime); osc.start(); osc.stop(ctx.currentTime + 0.1);
    } else if (type === "flip") { // 🃏 카드 뒤집는 소리 (스윽)
      osc.type = "triangle"; osc.frequency.setValueAtTime(300, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(100, ctx.currentTime + 0.08);
      gainNode.gain.setValueAtTime(0.1, ctx.currentTime); osc.start(); osc.stop(ctx.currentTime + 0.08);
    } else if (type === "pop") { // 💧 낚시, 조각 선택 소리 (뾱!)
      osc.type = "sine"; osc.frequency.setValueAtTime(400, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(1200, ctx.currentTime + 0.1);
      gainNode.gain.setValueAtTime(0.15, ctx.currentTime); 
      gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);
      osc.start(); osc.stop(ctx.currentTime + 0.1);
    } else if (type === "wrong") { // ❌ 오답 소리
      osc.type = "sawtooth"; osc.frequency.setValueAtTime(150, ctx.currentTime);
      gainNode.gain.setValueAtTime(0.1, ctx.currentTime); osc.start(); osc.stop(ctx.currentTime + 0.2);
    } else if (type === "success") { // ⭕ 정답 소리
      osc.type = "sine"; osc.frequency.setValueAtTime(659.25, ctx.currentTime); 
      gainNode.gain.setValueAtTime(0.1, ctx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.25);
      osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.25);
      const osc2 = ctx.createOscillator(); const gain2 = ctx.createGain();
      osc2.connect(gain2); gain2.connect(ctx.destination);
      osc2.type = "sine"; osc2.frequency.setValueAtTime(523.25, ctx.currentTime + 0.2); 
      gain2.gain.setValueAtTime(0.1, ctx.currentTime + 0.2);
      gain2.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.6);
      osc2.start(ctx.currentTime + 0.2); osc2.stop(ctx.currentTime + 0.6);
    } else if (type === "treasure") { // 🎁 보물상자 등장 소리
      osc.type = "square"; osc.frequency.setValueAtTime(400, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(800, ctx.currentTime + 0.3);
      gainNode.gain.setValueAtTime(0.1, ctx.currentTime); osc.start(); osc.stop(ctx.currentTime + 0.3);
    }
  } catch(e) { console.warn("Sound disabled", e); }
}

//5. UI 유틸리티
function showScreen(screenId) {
  document.querySelectorAll(".screen").forEach((s) => { s.style.display = "none"; s.classList.remove("active"); });
  if (screenId) { const screen = document.getElementById(screenId); if(screen) { screen.style.display = "flex"; screen.classList.add("active"); } }

  // 🚶‍♂️ 배경 걷는 이모지 표시/숨김 제어 (게임 화면에서는 숨기기)
  const gameScreens = ["flashcard-screen", "memory-screen", "speed-match-screen", "speed-screen", "fishing-screen", "chunk-screen", "teacher-match-screen"];
  const container = document.getElementById("walking-emoji-container");
  if (container) {
    if (gameScreens.includes(screenId)) {
      container.style.opacity = "0"; // 게임 중엔 집중하도록 스르륵 숨김
    } else {
      container.style.opacity = "1"; // 메뉴, 대기실 등에서는 보이게
    }
  }
}

// ==========================================
// 🌟 배경 걸어다니는 이모지 시스템 (슈퍼마리오 물리엔진 최적화)
// ==========================================
const walkingEmojisList = ["🐶", "🐱", "🐭", "🐹", "🐰", "🦊", "🐻", "🐼", "🐨", "🐯", "🦁", "🐮", "🐷", "🐸", "🐵", "🐧", "🐤", "🦆", "🦉", "🦇", "🐺", "🐢", "🐍", "🦖", "🐙", "🦑", "🦀", "🐠", "🐬", "🐳", "🦈", "🐅", "🦓", "🦍", "🐘", "🐫", "🦒", "🦘", "🐎", "🐏", "🐐", "🦌", "🐕", "🐈", "🦚", "🕊", "🐿", "🦔", "🚶", "🏃", "💃", "🕺"];
let walkingEmojis = [];

function initWalkingEmojis() {
  const container = document.createElement("div");
  container.id = "walking-emoji-container";
  container.style.cssText = "position:fixed; bottom:0; left:0; width:100%; height:100%; z-index:15; pointer-events:none; overflow:hidden; transition: opacity 0.5s ease-in-out;";
  document.body.insertBefore(container, document.body.firstChild);

  for(let i = 0; i < 15; i++) {
    const el = document.createElement("div");
    const emoji = walkingEmojisList[Math.floor(Math.random() * walkingEmojisList.length)];
    el.innerText = emoji;
    
    const size = Math.random() * 20 + 35; 
    let x = Math.random() * window.innerWidth;
    let y = 0; 
    
    // 🚀 속도를 기존보다 훨씬 낮추고(0.4~1.2), vx 대신 baseVx라는 기준 속도를 기억합니다.
    let baseVx = (Math.random() * 0.8 + 0.4) * (Math.random() < 0.5 ? 1 : -1); 
    let vy = 0; 
    
    el.style.cssText = `position:absolute; bottom:0px; left:${x}px; font-size:${size}px; opacity: 0.8; filter: drop-shadow(0px 5px 5px rgba(0,0,0,0.3)); user-select:none;`;
    
    container.appendChild(el);
    walkingEmojis.push({ el, x, y, baseVx, vy, size });
  }

  function animateEmojis() {
    const w = window.innerWidth;
    
    // 🚀 화면 크기에 비례해서 속도를 조절합니다. (스마트폰처럼 작으면 속도가 최대 0.4배까지 느려짐)
    let speedScale = Math.max(0.4, w / 1000); 

    walkingEmojis.forEach(e => {
      let currentVx = e.baseVx * speedScale; // 화면 크기가 반영된 현재 속도

      // 중력 적용
      if (e.y > 0) {
        e.vy -= 0.6; 
      }
      
      e.x += currentVx;
      e.y += e.vy;
      
      // 바닥 충돌 및 점프 처리
      if (e.y <= 0) {
        e.y = 0;
        e.vy = 0;
        
        // 🚀 점프 빈도도 살짝 줄이고, 점프 높이를 현실적인 수준(7~11)으로 대폭 하향!
        if (Math.random() < 0.003) {
          e.vy = Math.random() * 4 + 7; 
        }
      }
      
      // 벽 충돌 (방향 전환)
      if (e.x > w - e.size) {
        e.x = w - e.size;
        e.baseVx *= -1; // 방향을 반대로
      } else if (e.x < 0) {
        e.x = 0;
        e.baseVx *= -1; // 방향을 반대로
      }
      
      // 걷는 모션 (흔들림도 속도에 비례해서 부드럽게)
      let wobble = 0;
      if (e.y === 0) {
        wobble = Math.abs(Math.sin(Date.now() / 150)) * 6; 
      }
      
      // 화면 렌더링
      const dir = e.baseVx > 0 ? 1 : -1;
      e.el.style.transform = `scaleX(${dir})`;
      e.el.style.left = e.x + "px";
      e.el.style.bottom = (e.y + wobble) + "px"; 
    });
    
    requestAnimationFrame(animateEmojis);
  }
  animateEmojis();
}
// 로딩되자마자 이모지 생성!
initWalkingEmojis();

function bindClick(id, callback) {
  const el = document.getElementById(id);
  if (el) el.onclick = callback;
  else console.warn(`주의: HTML에서 '${id}' 버튼 찾기 실패 (무시됨)`);
}

const emojiContainer = document.getElementById("emoji-container");
if(emojiContainer) {
  const shuffledEmojis = allEmojis.sort(() => 0.5 - Math.random()).slice(0, 10);
  shuffledEmojis.forEach((emoji) => {
    const btn = document.createElement("button"); btn.className = "emoji-btn"; btn.innerText = emoji;
    btn.onclick = () => {
      document.querySelectorAll(".emoji-btn").forEach((b) => b.classList.remove("selected"));
      btn.classList.add("selected"); currentUser.emoji = emoji; playSound("click");
    };
    emojiContainer.appendChild(btn);
  });
}

bindClick("mute-btn", () => {
  isMuted = !isMuted; 
  document.getElementById("mute-btn").innerText = isMuted ? "🔇" : "🔊"; 
  playSound("click"); 
});

function resetGameStates() {
  clearInterval(gameTimerInterval); clearInterval(cdInterval); isFishing = false; isGamePaused = false; gameScore = 0; globalScoreMultiplier = 1; currentUser.caughtEmojis = "";
  ["game-countdown-overlay", "treasure-overlay", "sq-penalty-overlay", "buff-msg-overlay"].forEach(id => {
    let el = document.getElementById(id); if(el) el.style.display = "none";
  });
  ["pile-double_current", "pile-half_current", "pile-double_future"].forEach(id => {
    let el = document.getElementById(id); if(el) el.innerHTML = "";
  });
}

bindClick("close-modal-btn", () => { document.getElementById("unknown-modal").style.display = "none"; });
bindClick("back-to-menu-btn", () => { playSound("click"); document.getElementById("top-left-controls").style.display = "none"; document.getElementById("unknown-modal").style.display = "none"; resetGameStates(); showScreen("menu-screen"); });
bindClick("home-btn", () => { playSound("click"); showScreen("menu-screen"); });

// ==========================================
// 6. 로그인, DB 로드 (강력한 안정성 패치!)
// ==========================================
async function loadAllFromDB() {
  let maxRetries = 3; // 최대 3번까지 끈질기게 재시도
  let success = false;

  for (let i = 0; i < maxRetries; i++) {
    try {
      // 1. 파이어베이스에서 데이터 가져오기 시도
      const setSnap = await getDoc(doc(db, "gameData", "wordSets")); 
      if (setSnap.exists()) {
        wordSets = setSnap.data().sets || [];
        // 성공 시 폰 내부에 몰래 백업 (로컬 캐시)
        localStorage.setItem("backup_wordSets", JSON.stringify(wordSets)); 
      }
      
      const stdSnap = await getDoc(doc(db, "gameData", "students")); 
      if (stdSnap.exists()) {
        studentList = stdSnap.data().students || [];
        // 성공 시 폰 내부에 명단 백업
        localStorage.setItem("backup_studentList", JSON.stringify(studentList)); 
      }
      
      success = true; // 성공!
      break; // 성공했으니 재시도 루프(for문) 탈출

    } catch (error) { 
      console.warn(`DB 연결 실패 (재시도 ${i+1}/${maxRetries}):`, error);
      // 실패하면 1초 기다렸다가 다시 시도합니다.
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  // 2. 3번 다 실패했을 경우의 최후의 수단 (오프라인 백업본 사용)
  if (!success) {
    console.error("서버 통신 완전 실패, 내장 백업 데이터를 확인합니다.");
    const backupSets = localStorage.getItem("backup_wordSets");
    const backupStds = localStorage.getItem("backup_studentList");

    if (backupSets && backupStds) {
      // 예전에 한 번이라도 접속했던 폰이면 저장된 데이터로 억지로 입장시킴!
      wordSets = JSON.parse(backupSets);
      studentList = JSON.parse(backupStds);
      success = true; // 백업으로 복구 성공
      // (선택사항) 학생에게 알림을 띄우려면 아래 주석을 해제하세요.
      // alert("네트워크가 불안정하여 임시 모드로 접속되었습니다. (일부 데이터가 최신이 아닐 수 있습니다)");
    }
  }

  // 3. 최종 결과에 따라 화면 넘기기
  if (success) {
    showScreen("auth-screen"); 
  } else {
    // 캐시 백업도 없고 서버 연결도 죽었을 때만 진짜 에러창과 새로고침 버튼 띄움
    const loadingScreen = document.getElementById("loading-screen");
    if(loadingScreen) loadingScreen.innerHTML = `
      <h2 style="color:#f44336;">서버 연결 실패 ㅠㅠ</h2>
      <p style="color:#fff;">학교 네트워크 접속이 원활하지 않습니다.</p>
      <button onclick="location.reload()" style="padding: 12px 25px; font-size: 20px; font-weight: bold; background-color: #FFC107; border: none; border-radius: 10px; cursor: pointer; margin-top: 20px;">🔄 다시 시도하기</button>
    `;
  }
}
loadAllFromDB(); 

bindClick("auth-btn", () => {
  playSound("click");
  const inputId = document.getElementById("auth-id").value.trim();
  const inputName = document.getElementById("auth-name").value.trim();

  if(!inputId || !inputName) return alert("학번과 이름을 모두 적어주세요!");
  const matchedStudent = studentList.find(s => s.stdId === inputId && s.name === inputName);
  
  if (matchedStudent) {
    currentUser.stdId = inputId; currentUser.realName = inputName; currentUser.classId = inputId.substring(0, 2); 
    showScreen("login-screen");
  } else { alert("데이터베이스에 없는 학번이거나 이름이 틀렸습니다! 선생님께 문의하세요."); }
});


bindClick("login-btn", () => {
  playSound("click");
  const nick = document.getElementById("nickname").value.trim();
  if (!nick || !currentUser.emoji) return alert("닉네임과 이모지를 모두 골라주세요!");
  currentUser.nickname = nick;
  document.getElementById("user-display").innerText = `${currentUser.emoji} ${currentUser.nickname}`;
  if (wordSets.length === 0) return alert("현재 등록된 학습 세트가 없습니다! 관리자 설정에서 세트를 만들어주세요.");
  
  // 변경: 곧바로 세트를 고르지 않고 모드 선택 스크린으로 이동
  showScreen("lobby-mode-screen");
});

// 🌟 신규: 세트 선택 버튼에 무작위 파스텔 컬러 적용!
const setBtnColors = [
  { bg: "#FFCDD2", shadow: "#E57373", color: "#333" },
  { bg: "#F8BBD0", shadow: "#F06292", color: "#333" },
  { bg: "#E1BEE7", shadow: "#BA68C8", color: "#333" },
  { bg: "#D1C4E9", shadow: "#9575CD", color: "#333" },
  { bg: "#C5CAE9", shadow: "#7E57C2", color: "#333" },
  { bg: "#BBDEFB", shadow: "#64B5F6", color: "#333" },
  { bg: "#B3E5FC", shadow: "#4FC3F7", color: "#333" },
  { bg: "#B2EBF2", shadow: "#4DD0E1", color: "#333" },
  { bg: "#B2DFDB", shadow: "#4DB6AC", color: "#333" },
  { bg: "#C8E6C9", shadow: "#81C784", color: "#333" },
  { bg: "#DCEDC8", shadow: "#AED581", color: "#333" },
  { bg: "#FFF9C4", shadow: "#FBC02D", color: "#333" },
  { bg: "#FFECB3", shadow: "#FFCA28", color: "#333" },
  { bg: "#FFE0B2", shadow: "#FFB300", color: "#333" },
  { bg: "#FFCCBC", shadow: "#FF8A65", color: "#333" }
];

function renderSetSelectList() {
  const container = document.getElementById("set-select-list"); container.innerHTML = "";
  wordSets.forEach(set => {
    const btn = document.createElement("button"); 
    btn.style.width = "100%"; btn.style.margin = "0"; 
    
    // 버튼 색깔 예쁜 걸로 랜덤 뽑기!
    let randColor = setBtnColors[Math.floor(Math.random() * setBtnColors.length)];
    btn.style.backgroundColor = randColor.bg; 
    btn.style.boxShadow = `0 5px 0 ${randColor.shadow}`;
    btn.style.color = randColor.color;
    
    btn.innerHTML = `${set.title} <br><span style="font-size:16px;">(단어 ${set.words.length}개)</span>`;
    btn.onclick = () => {
      playSound("click");
      if(set.words.length < 4) return alert("이 세트에는 단어가 4개 미만이라 게임을 할 수 없어요!");
      wordList = set.words;
      currentSetId = set.id;       
      currentSetTitle = set.title; 
      showScreen("menu-screen"); 
    };
    container.appendChild(btn);
  });
}

// 🌟 추가: 세트 선택 화면에서 뒤로가기 버튼
bindClick("set-select-back-btn", () => { playSound("click"); showScreen("auth-screen"); });
bindClick("menu-go-back-set-btn", () => { playSound("click"); showScreen("set-select-screen"); });

// ==========================================
// 7. 관리자 로직 (비밀번호 및 학생 의견 확인 추가)
// ==========================================
bindClick("admin-main-open-btn", () => { 
  playSound("click"); 
  const pwd = prompt("관리자 비밀번호 4자리를 입력하세요.", "");
  if (pwd === "1234") {
    showScreen("admin-main-screen");
  } else if (pwd !== null) {
    alert("비밀번호가 틀렸습니다!");
  }
});

bindClick("admin-main-close-btn", () => { playSound("click"); showScreen("auth-screen"); });
bindClick("admin-go-student-btn", () => { playSound("click"); renderAdminStudentList(); showScreen("admin-student-screen"); });
bindClick("admin-go-set-btn", () => { playSound("click"); renderAdminSetList(); showScreen("admin-set-list-screen"); });

function renderAdminStudentList() {
  const listEl = document.getElementById("admin-student-list"); listEl.innerHTML = "";
  if(studentList.length === 0) return listEl.innerHTML = "<p style='text-align:center; margin-top:50px;'>등록된 학생이 없습니다.</p>";
  studentList.forEach(std => {
    const item = document.createElement("div"); item.className = "admin-list-item"; item.innerHTML = `<span><b>[${std.stdId}]</b> ${std.name}</span>`;
    const delBtn = document.createElement("button"); delBtn.className = "admin-btn-small"; delBtn.innerText = "삭제";
    delBtn.onclick = async () => {
      if(confirm(`${std.name} 학생을 정말 삭제하시겠습니까?`)) {
        playSound("click"); studentList = studentList.filter(s => s.stdId !== std.stdId);
        await setDoc(doc(db, "gameData", "students"), { students: studentList }); renderAdminStudentList();
      }
    };
    item.appendChild(delBtn); listEl.appendChild(item);
  });
}

bindClick("admin-student-upload-btn", async () => {
  playSound("click"); const text = document.getElementById("admin-student-textarea").value; const lines = text.trim().split("\n"); let addedCount = 0;
  for (let line of lines) {
    const parts = line.split('\t'); 
    if (parts.length >= 2 && parts[0].trim() !== "" && parts[1].trim() !== "") {
      const stdId = parts[0].trim(); const name = parts[1].trim();
      const existingIndex = studentList.findIndex(s => s.stdId === stdId);
      if(existingIndex >= 0) studentList[existingIndex].name = name; else studentList.push({ stdId, name });
      addedCount++;
    }
  }
  if (addedCount === 0) return alert("입력된 학생 정보가 없거나 양식이 틀렸습니다!");
  try {
    await setDoc(doc(db, "gameData", "students"), { students: studentList });
    alert(`성공! 총 ${addedCount}명의 학생 정보를 처리했습니다.`);
    document.getElementById("admin-student-textarea").value = ""; renderAdminStudentList();
  } catch (error) { alert("저장에 실패했습니다."); }
});

bindClick("admin-student-back-btn", () => { playSound("click"); showScreen("admin-main-screen"); });

function renderAdminSetList() {
  const listEl = document.getElementById("admin-set-list"); listEl.innerHTML = "";
  if(wordSets.length === 0) return listEl.innerHTML = "<p style='text-align:center; margin-top:50px;'>등록된 세트가 없습니다.</p>";
  wordSets.forEach(set => {
    const item = document.createElement("div"); item.className = "admin-list-item"; item.innerHTML = `<span style="font-weight:bold;">${set.title} <span style="font-size:12px; font-weight:normal; color:#666;">(${set.words.length}단어)</span></span>`;
    const btnBox = document.createElement("div");
    const editBtn = document.createElement("button"); editBtn.className = "admin-btn-small admin-btn-edit"; editBtn.innerText = "수정";
    editBtn.onclick = () => {
      playSound("click"); currentEditingSetId = set.id; document.getElementById("admin-set-title").value = set.title;
      document.getElementById("admin-set-textarea").value = set.words.map(w => `${w.en}\t${w.ko}`).join("\n"); showScreen("admin-set-edit-screen");
    };
    const delBtn = document.createElement("button"); delBtn.className = "admin-btn-small"; delBtn.innerText = "삭제";
    delBtn.onclick = async () => {
      if(confirm(`[${set.title}] 세트를 정말 삭제하시겠습니까?`)) {
        playSound("click"); wordSets = wordSets.filter(s => s.id !== set.id);
        await setDoc(doc(db, "gameData", "wordSets"), { sets: wordSets }); renderAdminSetList();
      }
    };
    btnBox.appendChild(editBtn); btnBox.appendChild(delBtn); item.appendChild(btnBox); listEl.appendChild(item);
  });
}

bindClick("admin-set-list-back-btn", () => { playSound("click"); showScreen("admin-main-screen"); });
bindClick("admin-set-edit-cancel-btn", () => { playSound("click"); showScreen("admin-set-list-screen"); });
bindClick("admin-set-create-btn", () => { playSound("click"); currentEditingSetId = null; document.getElementById("admin-set-title").value = ""; document.getElementById("admin-set-textarea").value = ""; showScreen("admin-set-edit-screen"); });

bindClick("admin-set-save-btn", async () => {
  playSound("click"); const title = document.getElementById("admin-set-title").value.trim();
  if(!title) return alert("세트 이름을 적어주세요!");
  const text = document.getElementById("admin-set-textarea").value; const lines = text.trim().split("\n"); const newWords = [];
  for (let line of lines) {
    const parts = line.split('\t'); 
    if (parts.length >= 2 && parts[0].trim() !== "" && parts[1].trim() !== "") newWords.push({ en: parts[0].trim(), ko: parts[1].trim() });
  }
  if (newWords.length === 0) return alert("입력된 단어가 없거나 양식이 틀렸습니다!");

  if (currentEditingSetId) {
    const target = wordSets.find(s => s.id === currentEditingSetId); if(target) { target.title = title; target.words = newWords; }
  } else { wordSets.push({ id: Date.now().toString(), title: title, words: newWords }); }

  try {
    await setDoc(doc(db, "gameData", "wordSets"), { sets: wordSets }); 
    alert("성공적으로 저장되었습니다!"); renderAdminSetList(); showScreen("admin-set-list-screen");
  } catch (error) { alert("저장 실패."); }
});

// 🌟 관리자: 피드백(의견) 보기 로직
bindClick("admin-go-feedback-btn", () => { 
  playSound("click"); 
  renderAdminFeedbackList(); 
  showScreen("admin-feedback-screen"); 
});
bindClick("admin-feedback-back-btn", () => { playSound("click"); showScreen("admin-main-screen"); });

async function renderAdminFeedbackList() {
  const listEl = document.getElementById("admin-feedback-list");
  listEl.innerHTML = "<p style='text-align:center; margin-top:20px;'>학생들의 의견을 불러오는 중...</p>";
  try {
    const qSnap = await getDocs(collection(db, "feedback"));
    let fList = [];
    qSnap.forEach(doc => fList.push({ id: doc.id, ...doc.data() }));
    fList.sort((a,b) => b.timestamp - a.timestamp); // 최신순 정렬
    
    listEl.innerHTML = "";
    if(fList.length === 0) {
      listEl.innerHTML = "<p style='text-align:center; margin-top:50px;'>아직 등록된 의견이 없습니다.</p>";
      return;
    }
    fList.forEach(f => {
      const date = new Date(f.timestamp).toLocaleString();
      listEl.innerHTML += `
        <div style="border-bottom: 2px dashed #ddd; padding: 10px 5px; margin-bottom: 10px;">
          <div style="font-size:12px; color:#888; margin-bottom:5px;">${date}</div>
          <div style="font-weight:bold; margin-bottom:5px;">${f.emoji} ${f.nickname} <span style="font-size:12px; font-weight:normal; color:#666;">(${f.stdId})</span></div>
          <div style="font-size:16px; color:#333; line-height:1.4;">${f.text}</div>
        </div>
      `;
    });
  } catch(e) {
    listEl.innerHTML = "<p>에러가 발생했습니다.</p>";
  }
}

// ==========================================
// 🌟 8. 메인 메뉴 버튼 및 게임 시작 라우팅
// ==========================================

bindClick("menu-list-btn", () => { 
  playSound("click"); 
  isWordHidden = false; isMeanHidden = false;
  document.getElementById("toggle-word-btn").innerText = "영어 가리기";
  document.getElementById("toggle-mean-btn").innerText = "뜻 가리기";
  renderWordList(); 
  showScreen("list-screen"); 
});
bindClick("list-back-btn", () => { playSound("click"); showScreen("menu-screen"); });

bindClick("toggle-word-btn", () => {
  playSound("click");
  isWordHidden = !isWordHidden;
  document.getElementById("toggle-word-btn").innerText = isWordHidden ? "영어 보이기" : "영어 가리기";
  document.querySelectorAll(".word-text-col span").forEach(el => {
    if(isWordHidden) el.classList.add("hidden-text"); else el.classList.remove("hidden-text");
  });
});

bindClick("toggle-mean-btn", () => {
  playSound("click");
  isMeanHidden = !isMeanHidden;
  document.getElementById("toggle-mean-btn").innerText = isMeanHidden ? "뜻 보이기" : "뜻 가리기";
  document.querySelectorAll(".mean-text-col span").forEach(el => {
    if(isMeanHidden) el.classList.add("hidden-text"); else el.classList.remove("hidden-text");
  });
});

function getStarClass(count) {
  if (count === 0) return "fire-0";
  if (count === 1) return "fire-1";
  if (count === 2) return "fire-2";
  if (count <= 4) return "fire-3";
  if (count <= 7) return "fire-4";
  return "fire-max"; 
}

function renderWordList() {
  document.getElementById("list-title").innerText = `[ ${currentSetTitle} ] 목록`;
  const container = document.getElementById("word-list-container");
  container.innerHTML = "";
  
  const storageKey = `stars_${currentUser.stdId}_${currentSetId}`;
  try {
    const stored = localStorage.getItem(storageKey);
    if (stored) starData = JSON.parse(stored);
    else starData = {}; 
  } catch(e) {}

  wordList.forEach((word, idx) => {
    const wId = `word_${idx}`;
    if(starData[wId] === undefined) starData[wId] = 0; 

    const itemDiv = document.createElement("div");
    itemDiv.className = "word-list-item";

    const wordCol = document.createElement("div");
    wordCol.className = "word-text-col";
    const wSpan = document.createElement("span");
    wSpan.innerText = word.en;
    if(isWordHidden) wSpan.classList.add("hidden-text");
    wordCol.appendChild(wSpan);

    const meanCol = document.createElement("div");
    meanCol.className = "mean-text-col";
    const mSpan = document.createElement("span");
    mSpan.innerText = word.ko;
    if(isMeanHidden) mSpan.classList.add("hidden-text");
    meanCol.appendChild(mSpan);

    const starCol = document.createElement("div");
    starCol.className = "star-col";
    const starBtn = document.createElement("button");
    starBtn.className = `star-btn ${getStarClass(starData[wId])}`;
    starBtn.innerText = "⭐";
    
    const countSpan = document.createElement("span");
    countSpan.className = "star-count";
    countSpan.innerText = starData[wId] > 0 ? starData[wId] : "";

    starBtn.onclick = () => {
      playSound("click");
      starData[wId]++;
      starBtn.className = `star-btn ${getStarClass(starData[wId])}`; 
      countSpan.innerText = starData[wId]; 
      try { localStorage.setItem(storageKey, JSON.stringify(starData)); } catch(e){}
    };

    starCol.appendChild(starBtn);
    starCol.appendChild(countSpan);
    itemDiv.appendChild(wordCol);
    itemDiv.appendChild(meanCol);
    itemDiv.appendChild(starCol);
    container.appendChild(itemDiv);
  });
}

bindClick("menu-fc-btn", () => { playSound("click"); currentGameMode = "fc"; showScreen("fc-option-screen"); });
bindClick("fc-order-btn", () => { playSound("click"); fcIsRandom = false; startFlashcard(); });
bindClick("fc-random-btn", () => { playSound("click"); fcIsRandom = true; startFlashcard(); });
bindClick("fc-option-back-btn", () => { playSound("click"); showScreen("menu-screen"); }); 

bindClick("menu-memory-btn", () => { playSound("click"); currentGameMode = "memory"; showScreen("time-option-screen"); });
bindClick("menu-speed-match-btn", () => { playSound("click"); currentGameMode = "speed-match"; showScreen("time-option-screen"); });
bindClick("menu-speed-btn", () => { playSound("click"); currentGameMode = "speed"; showScreen("time-option-screen"); });
bindClick("menu-fish-btn", () => { playSound("click"); currentGameMode = "fish"; showScreen("time-option-screen"); });
bindClick("time-option-back-btn", () => { playSound("click"); showScreen("menu-screen"); }); 
bindClick("menu-chunk-btn", () => { playSound("click"); currentGameMode = "chunk"; showScreen("time-option-screen"); });
bindClick("rank-chunk-btn", () => { playSound("click"); showRankings("today", "chunk"); });
bindClick("rank-fc-btn", () => { playSound("click"); showRankings("today", "fc"); });
bindClick("rank-memory-btn", () => { playSound("click"); showRankings("today", "memory"); });
bindClick("rank-speed-match-btn", () => { playSound("click"); showRankings("today", "speed-match"); });
bindClick("rank-speed-btn", () => { playSound("click"); showRankings("today", "speed"); });
bindClick("rank-fish-btn", () => { playSound("click"); showRankings("today", "fish"); });

bindClick("time-3m-btn", () => { playSound("click"); routeGameStart(3); });
bindClick("time-5m-btn", () => { playSound("click"); routeGameStart(5); });

function routeGameStart(minutes) {
  if(currentGameMode === "memory") startCountdown(minutes, "memory-screen", startMemoryLogic);
  else if(currentGameMode === "speed-match") startCountdown(minutes, "speed-match-screen", startSpeedMatchLogic);
  else if(currentGameMode === "speed") startCountdown(minutes, "speed-screen", startSpeedLogic);
  else if(currentGameMode === "fish") startCountdown(minutes, "fishing-screen", startFishingLogic);
else if(currentGameMode === "chunk") startCountdown(minutes, "chunk-screen", startChunkLogic);
}


function startCountdown(minutes, screenId, logicCallback) {
  showScreen(screenId); document.getElementById("top-left-controls").style.display = "flex";
  const overlay = document.getElementById("game-countdown-overlay"); const textEl = document.getElementById("countdown-text");
  overlay.style.display = "flex"; gameTimeRemaining = minutes * 60; gameScore = 0; globalScoreMultiplier = 1;
  document.getElementById("pile-double_current").innerHTML = ""; document.getElementById("pile-half_current").innerHTML = ""; document.getElementById("pile-double_future").innerHTML = ""; 
  
  let count = 5; textEl.innerText = count;
  cdInterval = setInterval(() => {
    count--;
    if (count > 0) { playSound("click"); textEl.style.animation = "none"; void textEl.offsetWidth; textEl.style.animation = null; textEl.innerText = count; } 
    else { clearInterval(cdInterval); overlay.style.display = "none"; playSound("success"); lastMatchTime = Date.now(); logicCallback(); }
  }, 1000);
}

function showGamePraise(earnedScore, customMsg, customColor) {
  const overlay = document.getElementById("game-praise-overlay"); overlay.style.color = customColor || "#FF4081";
  if (customMsg) overlay.innerHTML = customMsg;
  else {
     const randPraise = praises[Math.floor(Math.random() * praises.length)];
     overlay.innerHTML = `<div id="praise-title">${randPraise}</div><div id="praise-score">+ ${earnedScore}점!</div>`;
  }
  overlay.classList.remove("praise-anim-pop"); void overlay.offsetWidth; overlay.classList.add("praise-anim-pop");
}

let buffTimeout;
function showBuffMsg(text, subText, r, g, b) {
  const overlay = document.getElementById("buff-msg-overlay");
  overlay.innerHTML = `<div>${text}</div><div style="font-size:24px; font-weight:normal; margin-top:5px;">${subText}</div>`;
  overlay.style.background = `rgba(${r}, ${g}, ${b}, 0.85)`; overlay.style.display = "flex";
  overlay.classList.remove("drift-anim"); void overlay.offsetWidth; overlay.classList.add("drift-anim");
  overlay.onclick = () => { overlay.style.display = "none"; clearTimeout(buffTimeout); };
  clearTimeout(buffTimeout); buffTimeout = setTimeout(() => { overlay.style.display = "none"; }, 2500); 
}

function calcSpeedBonus() {
  const timeDiff = Date.now() - lastMatchTime; let bonus = 50 - Math.floor(timeDiff / 100);
  if (bonus < 0) bonus = 0; if (bonus > 50) bonus = 50; lastMatchTime = Date.now(); return (100 + bonus) * globalScoreMultiplier; 
}

function addInventoryItem(type) {
  let color, text;
  if(type === 'double_current') { color = '#2196F3'; text = '🔵 x2'; } else if(type === 'half_current') { color = '#F44336'; text = '🔴 ÷2'; } else if(type === 'double_future') { color = '#FFC107'; text = '🟡 버프'; }
  let el = document.createElement("div"); el.className = "inventory-item"; el.style.background = color; el.innerText = text; document.getElementById("pile-" + type).appendChild(el);
}

function triggerTreasureEvent(callback) {
  isGamePaused = true; playSound("treasure");
  const overlay = document.getElementById("treasure-overlay"); overlay.style.display = "flex";
  const chests = document.querySelectorAll(".treasure-chest");
  
  chests.forEach(chest => {
    chest.onclick = null;
    chest.onclick = () => {
      playSound("click"); chest.classList.add("chest-explode");
      setTimeout(() => {
        overlay.style.display = "none"; chest.classList.remove("chest-explode");
        
        // 💥 멀티플레이 특수 아이템 발동 검사 분기 구역
        if (myLobbyDocId && multiUseSpecialItems) {
          let multiItemType = Math.floor(Math.random() * 6); // 0~5 주사위 굴리기 (특수무기 등장확률 대폭 가산)
          
          if (multiItemType === 0) {
            openTargetSelectionModal("swap", "🔄 점수 뒤바꾸기 공격!", "점수를 강제로 맞교환할 타겟을 선택하세요.", callback);
          } else if (multiItemType === 1) {
            openTargetSelectionModal("steal50", "💥 점수 50% 강탈 공격!", "점수의 절반을 내 점수로 뺏어올 대상을 고르세요.", callback);
          } else if (multiItemType === 2) {
            openTargetSelectionModal("blind", "🕶️ 3초 화면 암전 블라인드 공격!", "화면을 3초간 암전시켜 방해할 대상을 고르세요.", callback);
          } else if (multiItemType === 3) {
            // 🚨 광역 공격: 모든 학생 점수 10% 일제 강탈 (대상을 고를 필요 없음)
            executeSteal10FromAll(callback);
          } else {
            // 4, 5번이 나오면 기존 싱글모드 버프 지원
            executeNormalTreasureEffect(Math.floor(Math.random() * 2) === 0 ? 0 : 2, callback);
          }
        } else {
          // 싱글 플레이이거나 아이템 기능이 꺼져있을 땐 기본 로직 구동
          executeNormalTreasureEffect(Math.floor(Math.random() * 3), callback);
        }
      }, 400); 
    };
  });
}

// 기존 상자 연산 캡슐화 보조 함수
function executeNormalTreasureEffect(effectType, callback) {
  if (effectType === 0) { gameScore *= 2; addInventoryItem("double_current"); showBuffMsg("버프 획득!", "현재 점수 2배!", 33, 150, 243); } 
  else if (effectType === 1) { gameScore = Math.floor(gameScore / 2); addInventoryItem("half_current"); showBuffMsg("앗, 함정!", "현재 점수 반토막...", 244, 67, 54); } 
  else if (effectType === 2) { globalScoreMultiplier *= 2; addInventoryItem("double_future"); showBuffMsg("슈퍼 버프 획득!", "앞으로 얻는 모든 점수 2배!", 255, 193, 7); }
  
  refreshGameModeUI();
  isGamePaused = false; callback();
}

function refreshGameModeUI() {
  if(currentGameMode === "memory") updateMemoryUI(); 
  else if(currentGameMode === "speed-match") updateSpeedMatchUI(); 
  else if(currentGameMode === "speed") updateSpeedUI();
  else if(currentGameMode === "chunk") updateChunkUI();
}

// ==========================================
// 씬 1: 깜빡이 학습
// ==========================================
let fcQueue = []; let fcCurrent = null; let fcStartTime = 0; let fcKnown = 0; let fcIsFlipped = false; let fcIsAnimating = false; let fcScore = 0; let cardAppearTime = 0; let isRetryPhase = false; let hasFlippedToCheck = false; 

function startFlashcard() {
  if (!wordList || wordList.length === 0) { alert("단어장이 비어 있습니다!"); return; }
  fcQueue = fcIsRandom ? [...wordList].sort(() => 0.5 - Math.random()) : [...wordList];
  fcStartTime = Date.now(); fcKnown = 0; fcScore = 0; unknownWordsHistory = []; isRetryPhase = false; currentUser.caughtEmojis = "";
  
  let scoreEl = document.getElementById("fc-score"); if(scoreEl) scoreEl.innerText = "점수: 0";
  let topCtrls = document.getElementById("top-left-controls"); if(topCtrls) topCtrls.style.display = "flex";
  
  showScreen("flashcard-screen"); nextFlashcard("fly-right-in");
}

function autoFontSize(text) { return text.length > 40 ? "18px" : (text.length > 20 ? "24px" : "32px"); }

function updateFcUI() {
  let total = isRetryPhase ? unknownWordsHistory.length : wordList.length; let currentIdx = total - fcQueue.length + 1; if (currentIdx > total) currentIdx = total;
  let progEl = document.getElementById("fc-progress"); if(progEl) progEl.innerText = isRetryPhase ? `복습 모드: ${currentIdx} / ${total}` : `단어: ${currentIdx} / ${total}`;
  let statsEl = document.getElementById("fc-stats"); if(statsEl) statsEl.innerText = `🟢 알아요: ${fcKnown}개 | 🔴 몰라요: ${unknownWordsHistory.length}개`;
  document.querySelectorAll(".retry-badge").forEach((el) => (el.style.display = isRetryPhase ? "block" : "none"));
}

function nextFlashcard(animClass) {
  if (fcQueue.length === 0) {
    if (!isRetryPhase && unknownWordsHistory.length > 0) {
      alert("지금부터는 몰라요를 눌렀던 카드들이에요! 이번에 맞추면 추가 점수 보너스!");
      isRetryPhase = true; fcQueue = fcIsRandom ? [...unknownWordsHistory].sort(() => 0.5 - Math.random()) : [...unknownWordsHistory];
      nextFlashcard("pop-in"); return;
    } else { 
      currentUser.score = fcScore; 
      let resDetail = document.getElementById("result-detail"); if(resDetail) resDetail.innerText = `최종 깜빡이 점수입니다!`; 
      goResult(); return; 
    }
  }
  
  hasFlippedToCheck = false; 
  let btnKnow = document.getElementById("btn-know"); if(btnKnow) btnKnow.classList.add("btn-disabled");
  let btnDont = document.getElementById("btn-dont-know"); if(btnDont) btnDont.classList.add("btn-disabled");
  
  fcCurrent = fcQueue[0]; fcIsFlipped = false;
  updateFcUI(); 
  
  let fcCard = document.getElementById("fc-card"); 
  if(fcCard) { fcCard.classList.remove("is-flipped"); fcCard.className = `flash-card ${animClass}`; }
  
  let fcFront = document.getElementById("fc-front"); 
  if(fcFront) { fcFront.innerText = fcCurrent.en; fcFront.style.fontSize = autoFontSize(fcCurrent.en); }
  
  let fcBack = document.getElementById("fc-back"); 
  if(fcBack) { fcBack.innerText = fcCurrent.ko; fcBack.style.fontSize = autoFontSize(fcCurrent.ko); }
  
  fcIsAnimating = true; cardAppearTime = Date.now();
  setTimeout(() => { fcIsAnimating = false; if(fcCard) fcCard.className = "flash-card"; }, 400);
}

bindClick("fc-card", () => {
  if (fcIsAnimating) return; playSound("flip"); fcIsFlipped = !fcIsFlipped;
  let fcCard = document.getElementById("fc-card");
  if (fcIsFlipped) { 
    if(fcCard) fcCard.classList.add("is-flipped"); hasFlippedToCheck = true; 
    let bk = document.getElementById("btn-know"); if(bk) bk.classList.remove("btn-disabled"); 
    let bdk = document.getElementById("btn-dont-know"); if(bdk) bdk.classList.remove("btn-disabled"); 
  } else { if(fcCard) fcCard.classList.remove("is-flipped"); }
});

bindClick("btn-know", () => {
  if (!hasFlippedToCheck || fcIsAnimating) return; 
  fcIsAnimating = true; playSound("click");
  const reactTime = Date.now() - cardAppearTime; let speedBonus = Math.max(0, 150 - Math.floor(reactTime / 15));
  let finalEarned = 100 + speedBonus; if (isRetryPhase) finalEarned += 100;
  fcScore += finalEarned; 
  let sEl = document.getElementById("fc-score"); if(sEl) sEl.innerText = "점수: " + fcScore; 
  let cEl = document.getElementById("fc-card"); if(cEl) cEl.className = "flash-card fly-left";
  setTimeout(() => { fcQueue.shift(); fcKnown++; nextFlashcard("fly-right-in"); }, 400);
});

bindClick("btn-dont-know", () => {
  if (!hasFlippedToCheck || fcIsAnimating) return; 
  fcIsAnimating = true; playSound("wrong");
  if (!isRetryPhase) { const alreadySaved = unknownWordsHistory.find((w) => w.en === fcCurrent.en); if (!alreadySaved) unknownWordsHistory.push(fcCurrent); }
  
  let cardEl = document.getElementById("fc-card");
  let btnEl = document.getElementById("btn-dont-know");
  if(cardEl && btnEl) {
    const cardRect = cardEl.getBoundingClientRect(); const btnRect = btnEl.getBoundingClientRect();
    const moveX = btnRect.left + btnRect.width / 2 - (cardRect.left + cardRect.width / 2); const moveY = btnRect.top + btnRect.height / 2 - (cardRect.top + cardRect.height / 2);
    cardEl.style.transition = "all 0.4s cubic-bezier(0.6, -0.28, 0.735, 0.045)"; cardEl.style.transform = `translate(${moveX}px, ${moveY}px) scale(0) rotate(180deg)`; cardEl.style.opacity = "0";
    setTimeout(() => { cardEl.style.transition = "transform 0.4s cubic-bezier(0.4, 0.0, 0.2, 1)"; cardEl.style.transform = ""; cardEl.style.opacity = "1"; fcQueue.push(fcQueue.shift()); nextFlashcard("pop-in"); }, 400);
  } else {
    fcQueue.push(fcQueue.shift()); nextFlashcard("pop-in");
  }
});

// ==========================================
//씬 2: 메모리 게임 
// ==========================================
let memoryRound = 1; let memoryPairsFound = 0; let memoryFlipped = []; 
function updateMemoryUI() {
  const m = String(Math.floor(gameTimeRemaining / 60)).padStart(2, "0"); const s = String(gameTimeRemaining % 60).padStart(2, "0");
  document.getElementById("memory-timer").innerText = `🕒 ${m}:${s}`; document.getElementById("memory-score").innerText = `점수: ${gameScore}`;
}
function startMemoryLogic() {
  memoryRound = 1; updateMemoryUI();
  gameTimerInterval = setInterval(() => {
    if (!isGamePaused) { gameTimeRemaining--; updateMemoryUI(); if (gameTimeRemaining <= 0) { currentUser.score = gameScore; document.getElementById("result-detail").innerText = `제한 시간 종료! 획득한 점수입니다!`; goResult(); } }
  }, 1000); loadMemoryRound();
}
function loadMemoryRound() {
  memoryPairsFound = 0; memoryFlipped = [];
  const leftCol = document.getElementById("memory-left-col"); const rightCol = document.getElementById("memory-right-col");
  leftCol.innerHTML = ""; rightCol.innerHTML = ""; showGamePraise(0, `라운드 ${memoryRound}!`, "#9C27B0");
  let shuffled = [...wordList].sort(() => 0.5 - Math.random()); let roundWords = shuffled.slice(0, 4);
  let leftPool = roundWords.map(w => ({ text: w.en, id: w.en, side: 'left' })).sort(() => 0.5 - Math.random());
  let rightPool = roundWords.map(w => ({ text: w.ko, id: w.en, side: 'right' })).sort(() => 0.5 - Math.random());
  leftPool.forEach(item => leftCol.appendChild(createMemoryCard(item))); rightPool.forEach(item => rightCol.appendChild(createMemoryCard(item)));
}
function createMemoryCard(item) {
  const wrapper = document.createElement("div"); wrapper.className = `memory-card-wrapper`;
  const card = document.createElement("div"); card.className = `memory-card memory-card-${item.side}`;
  const front = document.createElement("div"); front.className = "memory-card-face memory-card-front"; front.innerText = "?";
  const back = document.createElement("div"); back.className = "memory-card-face memory-card-back"; back.innerText = item.text;
  card.appendChild(front); card.appendChild(back); wrapper.appendChild(card);
  wrapper.onclick = () => {
    if (isGamePaused || card.classList.contains("flipped")) return;
    if (memoryFlipped.length === 1 && memoryFlipped[0].side === item.side) return;
    playSound("flip"); card.classList.add("flipped"); memoryFlipped.push({ id: item.id, side: item.side, el: card, wrapper });
    updateMemorySideAvailability();
    if (memoryFlipped.length === 2) checkMemoryMatch();
  }; return wrapper;
}
function updateMemorySideAvailability() {
  const leftWrappers = document.querySelectorAll("#memory-left-col .memory-card-wrapper"); const rightWrappers = document.querySelectorAll("#memory-right-col .memory-card-wrapper");
  leftWrappers.forEach(w => w.classList.remove("disabled")); rightWrappers.forEach(w => w.classList.remove("disabled"));
  if (memoryFlipped.length === 1) {
    const sideToDisable = memoryFlipped[0].side;
    if (sideToDisable === "left") leftWrappers.forEach(w => w.classList.add("disabled")); else rightWrappers.forEach(w => w.classList.add("disabled"));
  }
}
function checkMemoryMatch() {
  isGamePaused = true; let [c1, c2] = memoryFlipped;
  if (c1.id === c2.id) { 
    setTimeout(() => {
      playSound("success"); let earnedScore = calcSpeedBonus(); gameScore += earnedScore; updateMemoryUI(); showGamePraise(earnedScore);
      c1.el.classList.add("matched"); c2.el.classList.add("matched"); memoryPairsFound++; memoryFlipped = []; updateMemorySideAvailability();
      if (Math.random() < 0.3) triggerTreasureEvent(() => { checkMemoryRoundEnd(); }); else { checkMemoryRoundEnd(); isGamePaused = false; }
    }, 600); 
  } else { 
    setTimeout(() => {
      playSound("wrong"); showGamePraise(0, "짝이 아니네요...<br><span style='font-size:24px; color:#ddd'>불이익은 없어요</span>", "#F44336");
      setTimeout(() => { c1.el.classList.remove("flipped"); c2.el.classList.remove("flipped"); memoryFlipped = []; updateMemorySideAvailability(); isGamePaused = false; }, 1200); 
    }, 600);
  }
}
function checkMemoryRoundEnd() { if (memoryPairsFound === 4) { memoryRound++; setTimeout(loadMemoryRound, 500); } }

// ==========================================
//씬 3: 스피드 짝맞추기
// ==========================================
let smRound = 1; let smPairsFound = 0; let smSelected = []; 
function updateSpeedMatchUI() {
  const m = String(Math.floor(gameTimeRemaining / 60)).padStart(2, "0"); const s = String(gameTimeRemaining % 60).padStart(2, "0");
  document.getElementById("sm-timer").innerText = `🕒 ${m}:${s}`; document.getElementById("sm-score").innerText = `점수: ${gameScore}`;
}
function startSpeedMatchLogic() {
  smRound = 1; updateSpeedMatchUI();
  gameTimerInterval = setInterval(() => {
    if (!isGamePaused) { gameTimeRemaining--; updateSpeedMatchUI(); if (gameTimeRemaining <= 0) { currentUser.score = gameScore; document.getElementById("result-detail").innerText = `제한 시간 종료! 획득한 점수입니다!`; goResult(); } }
  }, 1000); loadSpeedMatchRound();
}
function loadSpeedMatchRound() {
  smPairsFound = 0; smSelected = [];
  const leftCol = document.getElementById("sm-left-col"); const rightCol = document.getElementById("sm-right-col");
  leftCol.innerHTML = ""; rightCol.innerHTML = ""; showGamePraise(0, `라운드 ${smRound}!`, "#FF5722");
  let shuffled = [...wordList].sort(() => 0.5 - Math.random()); let roundWords = shuffled.slice(0, 4);
  let leftPool = roundWords.map(w => ({ text: w.en, id: w.en, side: 'left' })).sort(() => 0.5 - Math.random());
  let rightPool = roundWords.map(w => ({ text: w.ko, id: w.en, side: 'right' })).sort(() => 0.5 - Math.random());
  leftPool.forEach(item => leftCol.appendChild(createSmCard(item))); rightPool.forEach(item => rightCol.appendChild(createSmCard(item)));
}
function createSmCard(item) {
  const wrapper = document.createElement("div"); wrapper.className = `sm-card-wrapper`;
  const card = document.createElement("div"); card.className = `sm-card`; card.innerText = item.text;
  
  card.style.fontSize = item.text.length > 30 ? "14px" : (item.text.length > 15 ? "18px" : "24px"); 
  wrapper.appendChild(card);
  
  wrapper.onclick = () => {
    if (isGamePaused || card.classList.contains("selected") || card.classList.contains("matched")) return;
    
    if (smSelected.length === 1 && smSelected[0].side === item.side) { smSelected[0].el.classList.remove("selected"); smSelected = []; }
    playSound("flip"); card.classList.add("selected"); smSelected.push({ id: item.id, side: item.side, el: card, wrapper });
    updateSmSideAvailability();
    
    if (smSelected.length === 2) {
      isGamePaused = true; 
      checkSmMatch();
    }
  }; return wrapper;
}
function updateSmSideAvailability() {
  const leftWrappers = document.querySelectorAll("#sm-left-col .sm-card-wrapper"); const rightWrappers = document.querySelectorAll("#sm-right-col .sm-card-wrapper");
  leftWrappers.forEach(w => w.classList.remove("disabled")); rightWrappers.forEach(w => w.classList.remove("disabled"));
  if (smSelected.length === 1) {
    const sideToDisable = smSelected[0].side;
    if (sideToDisable === "left") leftWrappers.forEach(w => w.classList.add("disabled")); else rightWrappers.forEach(w => w.classList.add("disabled"));
  }
}
function checkSmMatch() {
  let [c1, c2] = smSelected;
  if (c1.id === c2.id) { 
    playSound("success"); let earnedScore = calcSpeedBonus(); gameScore += earnedScore; updateSpeedMatchUI(); showGamePraise(earnedScore);
    c1.el.classList.add("matched"); c2.el.classList.add("matched"); smPairsFound++; smSelected = []; updateSmSideAvailability();
    
    if (Math.random() < 0.3) triggerTreasureEvent(() => { checkSmRoundEnd(); isGamePaused = false; }); 
    else { checkSmRoundEnd(); isGamePaused = false; }
  } else { 
    playSound("wrong"); let penalty = calcSpeedBonus(); gameScore -= penalty; updateSpeedMatchUI(); showBuffMsg("오답!", `-${penalty}점 ㅠㅠ`, 244, 67, 54);
    c1.el.classList.add("wrong"); c2.el.classList.add("wrong");
    
    setTimeout(() => { 
      c1.el.classList.remove("selected", "wrong"); c2.el.classList.remove("selected", "wrong"); 
      smSelected = []; updateSmSideAvailability(); 
      isGamePaused = false; 
    }, 400); 
  }
}
function checkSmRoundEnd() { if (smPairsFound === 4) { smRound++; setTimeout(loadSpeedMatchRound, 500); } }

// ==========================================
//씬 4: 심플 스피드 퀴즈 
// ==========================================
let sqCurrentWord = null;
function updateSpeedUI() {
  const m = String(Math.floor(gameTimeRemaining / 60)).padStart(2, "0"); const s = String(gameTimeRemaining % 60).padStart(2, "0");
  document.getElementById("speed-timer").innerText = `🕒 ${m}:${s}`; document.getElementById("speed-score").innerText = `점수: ${gameScore}`;
if (myLobbyDocId && currentGameMode === "speed") {
    let currentBuffs = "";
    if (globalScoreMultiplier > 1) currentBuffs += "🟡"; // 배점 2배 버프 상태 표시
    setDoc(doc(db, "lobbyUsers", myLobbyDocId), { score: gameScore, items: currentBuffs }, { merge: true })
      .catch(e => console.error("점수 동기화 에러:", e));
  }
}
function startSpeedLogic() {
  updateSpeedUI();
  gameTimerInterval = setInterval(() => {
    if (globalMultiEndTime) {
       // 🌐 멀티플레이: 타이머 오차를 없애기 위해 '절대 시간' 기준 측정 (일시정지 중에도 시간 흐름!)
       gameTimeRemaining = Math.max(0, Math.floor((globalMultiEndTime - Date.now()) / 1000));
       updateSpeedUI();
       if (gameTimeRemaining <= 0) {
         clearInterval(gameTimerInterval);
         currentUser.score = gameScore; 
         document.getElementById("result-detail").innerText = `제한 시간 종료! 획득한 퀴즈 점수입니다!`; 
         goResult(); 
       }
    } else {
       // 👤 싱글플레이: 혼자 하므로 기존처럼 로컬 카운트 (보물상자 등 일시정지 시 시간 멈춤 허용)
       if (!isGamePaused) {
         gameTimeRemaining--; 
         updateSpeedUI();
         if (gameTimeRemaining <= 0) {
           clearInterval(gameTimerInterval);
           currentUser.score = gameScore; 
           document.getElementById("result-detail").innerText = `제한 시간 종료! 획득한 퀴즈 점수입니다!`; 
           goResult(); 
         }
       }
    }
  }, 500); // 타이머 딜레이를 막기 위해 0.5초 간격으로 촘촘히 체크!
  loadNextSpeedQuiz();
}
function loadNextSpeedQuiz() {
  sqCurrentWord = wordList[Math.floor(Math.random() * wordList.length)];
  let wrongWord = wordList[Math.floor(Math.random() * wordList.length)];
  while(wrongWord.ko === sqCurrentWord.ko && wordList.length > 1) wrongWord = wordList[Math.floor(Math.random() * wordList.length)];
  const wordBox = document.getElementById("speed-word-card"); const btn1 = document.getElementById("speed-opt-1"); const btn2 = document.getElementById("speed-opt-2");
  wordBox.innerText = sqCurrentWord.en; wordBox.style.fontSize = sqCurrentWord.en.length > 30 ? "20px" : (sqCurrentWord.en.length > 15 ? "26px" : "35px");
  wordBox.classList.remove("sq-fly-in"); void wordBox.offsetWidth; wordBox.classList.add("sq-fly-in");
  let opts = [ {text: sqCurrentWord.ko, isCorrect: true}, {text: wrongWord.ko, isCorrect: false} ]; opts.sort(() => 0.5 - Math.random());
  [btn1, btn2].forEach((btn, idx) => {
    btn.innerText = opts[idx].text; btn.style.fontSize = opts[idx].text.length > 25 ? "14px" : (opts[idx].text.length > 15 ? "16px" : "22px");
    btn.classList.remove("sq-fly-in"); void btn.offsetWidth; btn.classList.add("sq-fly-in");
    btn.onclick = () => {
      if (isGamePaused) return; 
      if(opts[idx].isCorrect) { 
        playSound("success"); let earnedScore = calcSpeedBonus(); gameScore += earnedScore; updateSpeedUI(); showGamePraise(earnedScore);
        if (Math.random() < 0.3) { triggerTreasureEvent(() => { loadNextSpeedQuiz(); }); } else { loadNextSpeedQuiz(); }
      } else { 
        playSound("wrong"); isGamePaused = true; let penalty = calcSpeedBonus(); gameScore -= penalty; updateSpeedUI();
        const penaltyOverlay = document.getElementById("sq-penalty-overlay"); document.getElementById("sq-penalty-text").innerText = `틀렸어요... -${penalty}점`; document.getElementById("sq-penalty-answer").innerText = `정답: ${sqCurrentWord.ko}`; penaltyOverlay.style.display = "flex";
        let count = 3; document.getElementById("sq-countdown").innerText = count;
        let pcd = setInterval(() => { count--; if(count > 0) { document.getElementById("sq-countdown").innerText = count; playSound("click"); } else { clearInterval(pcd); penaltyOverlay.style.display = "none"; isGamePaused = false; loadNextSpeedQuiz(); } }, 1000);
      }
    };
  });
}

// ==========================================
//씬 5: 이모지 낚시하기 게임
// ==========================================
let fishCards = []; let fishSelected = []; let fishEmojisCaught = 0; let lastFrameTime = 0; let caughtEmojisList = [];
const fishPond = document.getElementById("fish-pond");
function startFishingLogic() {
  document.getElementById("fish-bucket").innerHTML = ""; fishPond.innerHTML = "";
  fishEmojisCaught = 0; caughtEmojisList = []; updateFishUI(); isFishing = true;
  gameTimerInterval = setInterval(() => {
    if(!isGamePaused){
      gameTimeRemaining--; updateFishUI();
      if (gameTimeRemaining <= 0) { currentUser.score = fishEmojisCaught * 50; currentUser.caughtEmojis = caughtEmojisList.join(""); document.getElementById("result-detail").innerText = `제한 시간 종료! 총 ${fishEmojisCaught}마리의 이모지를 낚았습니다!`; goResult(); }
    }
  }, 1000);
  fishCards = []; fishSelected = []; let shuffled = [...wordList].sort(() => 0.5 - Math.random());
  for (let i = 0; i < 3; i++) { createFishEl(shuffled[i].en, "en", shuffled[i].en); createFishEl(shuffled[i].ko, "ko", shuffled[i].en); }
  createFishEl(shuffled[3].en, "en", shuffled[3].en); createFishEl(shuffled[4].ko, "ko", shuffled[4].en);
  lastFrameTime = performance.now(); requestAnimationFrame(moveFishes);
}
function updateFishUI() {
  const m = String(Math.floor(gameTimeRemaining / 60)).padStart(2, "0"); const s = String(gameTimeRemaining % 60).padStart(2, "0");
  document.getElementById("fish-timer").innerText = `🕒 ${m}:${s}`; document.getElementById("fish-score").innerText = `이모지: ${fishEmojisCaught}마리`;
}
function animateFlyToBucket(emoji, startX, startY) {
  const flyEl = document.createElement("div"); flyEl.innerText = emoji; flyEl.style.position = "fixed"; flyEl.style.left = startX - 20 + "px"; flyEl.style.top = startY - 20 + "px"; flyEl.style.fontSize = "40px"; flyEl.style.zIndex = "1000"; flyEl.style.pointerEvents = "none"; flyEl.style.transition = "all 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275)"; document.body.appendChild(flyEl);
  const bucket = document.getElementById("fish-bucket"); const bRect = bucket.getBoundingClientRect(); const targetX = bRect.left + 10 + Math.random() * (bRect.width - 50); const targetY = bRect.top + 10 + Math.random() * (bRect.height - 50);
  void flyEl.offsetWidth; flyEl.style.left = targetX + "px"; flyEl.style.top = targetY + "px"; flyEl.style.transform = "scale(0.8) rotate(360deg)";
  setTimeout(() => { flyEl.remove(); bucket.innerHTML += `<span>${emoji}</span>`; bucket.scrollTop = bucket.scrollHeight; }, 500);
}
function refillFishes() {
  let enIds = fishCards.filter((f) => f.lang === "en").map((f) => f.targetId); let koIds = fishCards.filter((f) => f.lang === "ko").map((f) => f.targetId); let matchCount = enIds.filter(id => koIds.includes(id)).length; let unmatchedEn = enIds.filter(id => !koIds.includes(id)); let unmatchedKo = koIds.filter(id => !enIds.includes(id)); let spawnList = []; 
  if (matchCount >= 2) {
    let w1 = wordList[Math.floor(Math.random() * wordList.length)]; let w2 = wordList[Math.floor(Math.random() * wordList.length)];
    while (w1.en === w2.en && wordList.length > 1) w2 = wordList[Math.floor(Math.random() * wordList.length)];
    spawnList.push({ id: w1.en, lang: "en" }); spawnList.push({ id: w2.en, lang: "ko" });
  } else if (matchCount === 1) {
    if (unmatchedEn.length > 0) spawnList.push({ id: unmatchedEn[0], lang: "ko" }); else if (unmatchedKo.length > 0) spawnList.push({ id: unmatchedKo[0], lang: "en" }); else { let w = wordList[Math.floor(Math.random() * wordList.length)]; spawnList.push({ id: w.en, lang: "ko" }); }
    let w2 = wordList[Math.floor(Math.random() * wordList.length)]; while (w2.en === spawnList[0].id && wordList.length > 1) w2 = wordList[Math.floor(Math.random() * wordList.length)]; spawnList.push({ id: w2.en, lang: spawnList[0].lang === "en" ? "ko" : "en" });
  } else {
    let resolved = 0; if (unmatchedEn.length > 0) { spawnList.push({ id: unmatchedEn[0], lang: "ko" }); resolved++; } if (resolved < 2 && unmatchedEn.length > 1) { spawnList.push({ id: unmatchedEn[1], lang: "ko" }); resolved++; } if (resolved < 2 && unmatchedKo.length > 0) { spawnList.push({ id: unmatchedKo[0], lang: "en" }); resolved++; } if (resolved < 2 && unmatchedKo.length > 1) { spawnList.push({ id: unmatchedKo[1], lang: "en" }); resolved++; }
  }
  spawnList.forEach((item) => { let wordObj = wordList.find((w) => w.en === item.id); if (wordObj) createFishEl(item.lang === "en" ? wordObj.en : wordObj.ko, item.lang, item.id); });
}
function createFishEl(text, lang, targetId) {
  let el = document.createElement("div"); el.className = "fish-card pop-in"; let emoji = allEmojis[Math.floor(Math.random() * allEmojis.length)]; let fontSize = text.length > 20 ? "11px" : text.length > 10 ? "13px" : "15px";
  el.innerHTML = `<div class="fish-emoji">${emoji}</div><div class="fish-text" style="font-size:${fontSize}">${text}</div>`; fishPond.appendChild(el);
  let angle = Math.random() * Math.PI * 2; let speed = 80 + Math.random() * 80; let vx = Math.cos(angle) * speed; let vy = Math.sin(angle) * speed; let x = fishPond.clientWidth / 2 - 50 + (Math.random() * 40 - 20); let y = fishPond.clientHeight / 2 - 50 + (Math.random() * 40 - 20);
  let fishObj = { el, text, lang, targetId, emoji, x, y, vx, vy }; fishCards.push(fishObj);
  el.onclick = () => {
    if (isGamePaused || fishSelected.length >= 2 || fishSelected.includes(fishObj)) return;
    playSound("pop"); el.classList.add("selected"); fishSelected.push(fishObj);
    if (fishSelected.length === 2) {
      let [f1, f2] = fishSelected;
      if (f1.lang !== f2.lang && f1.targetId === f2.targetId) {
        playSound("success"); showGamePraise(0, praises[Math.floor(Math.random() * praises.length)], "#4CAF50"); fishEmojisCaught += 2; updateFishUI(); caughtEmojisList.push(f1.emoji, f2.emoji);
        const rect1 = f1.el.getBoundingClientRect(); const rect2 = f2.el.getBoundingClientRect(); animateFlyToBucket(f1.emoji, rect1.left + rect1.width / 2, rect1.top + rect1.height / 2); animateFlyToBucket(f2.emoji, rect2.left + rect2.width / 2, rect2.top + rect2.height / 2);
        f1.el.remove(); f2.el.remove(); fishCards = fishCards.filter((c) => c !== f1 && c !== f2);
        if (Math.random() < 0.5) { triggerTreasureEvent(() => { refillFishes(); fishSelected = []; }); } else { refillFishes(); fishSelected = []; }
      } else {
        playSound("wrong"); showGamePraise(0, "Try again..", "#F44336"); f1.el.classList.add("wrong"); f2.el.classList.add("wrong");
        setTimeout(() => { f1.el.classList.remove("selected", "wrong"); f2.el.classList.remove("selected", "wrong"); fishSelected = []; }, 400);
      }
    }
  };
}
function moveFishes(currentTime) {
  if (!isFishing) return;
  let dt = (currentTime - lastFrameTime) / 1000; if (dt > 0.1 || !dt) dt = 0.016; lastFrameTime = currentTime;
  if(!isGamePaused) { 
    const pondW = fishPond.clientWidth; const pondH = fishPond.clientHeight;
    fishCards.forEach((f) => {
      const w = f.el.offsetWidth || 100; const h = f.el.offsetHeight || 100;
      f.x += f.vx * dt; f.y += f.vy * dt;
      if (f.x <= 0) { f.x = 0; f.vx *= -1; } if (f.x + w >= pondW) { f.x = pondW - w; f.vx *= -1; } if (f.y <= 0) { f.y = 0; f.vy *= -1; } if (f.y + h >= pondH) { f.y = pondH - h; f.vy *= -1; }
      let scale = f.el.classList.contains("selected") ? "scale(1.1)" : "scale(1)"; f.el.style.transform = `translate3d(${f.x}px, ${f.y}px, 0) ${scale}`;
    });
  } requestAnimationFrame(moveFishes);
}

// ==========================================
//9. 결과, 피드백 전송 및 랭킹
// ==========================================
async function goResult() {
  clearInterval(gameTimerInterval);
  clearInterval(cdInterval);
  isGamePaused = true; 

  document.getElementById("top-left-controls").style.display = "none"; 
  showScreen("result-screen");
  
  document.getElementById("praise-word").innerText = praises[Math.floor(Math.random() * praises.length)];
  document.getElementById("result-user").innerText = `${currentUser.emoji} ${currentUser.nickname} 학생`;
  document.getElementById("final-score").innerText = currentUser.score;

  const emojiBox = document.getElementById("result-caught-emojis");
  if (currentGameMode === "fish" && currentUser.caughtEmojis) { emojiBox.style.display = "block"; emojiBox.innerText = "🎣 낚은 이모지:\n" + currentUser.caughtEmojis; } 
  else { emojiBox.style.display = "none"; }
  playSound("success");

  try {
    await addDoc(collection(db, "scores"), {
      stdId: currentUser.stdId, nickname: currentUser.nickname, emoji: currentUser.emoji, classId: currentUser.classId,
      score: currentUser.score, mode: currentGameMode, timestamp: Date.now(),
      setId: currentSetId,       
      setTitle: currentSetTitle  
    });
  } catch(e) { console.error("점수 저장 실패:", e); }
}

// 🌟 신규: 학생 피드백 전송 로직
bindClick("go-feedback-btn", () => {
  playSound("click");
  document.getElementById("feedback-text").value = "";
  showScreen("feedback-screen");
});
bindClick("cancel-feedback-btn", () => { playSound("click"); showScreen("result-screen"); });

bindClick("submit-feedback-btn", async () => {
  playSound("click");
  const text = document.getElementById("feedback-text").value.trim();
  if(!text) return alert("의견을 적어주세요!");
  try {
    await addDoc(collection(db, "feedback"), {
      stdId: currentUser.stdId,
      nickname: currentUser.nickname,
      emoji: currentUser.emoji,
      text: text,
      timestamp: Date.now()
    });
    alert("소중한 의견 감사합니다!");
    showScreen("result-screen");
  } catch(e) {
    alert("전송에 실패했습니다.");
  }
});

bindClick("go-ranking-btn", () => { playSound("click"); showRankings("today", currentGameMode); });

bindClick("tab-today", () => { playSound("click"); showRankings("today", currentRankingMode); });
bindClick("tab-class", () => { playSound("click"); showRankings("class", currentRankingMode); });
bindClick("tab-all", () => { playSound("click"); showRankings("all", currentRankingMode); });
bindClick("ranking-home-btn", () => { playSound("click"); document.getElementById("confetti-canvas").style.display = "none"; showScreen("menu-screen"); });

async function showRankings(tab, mode = currentRankingMode) {
  currentRankingMode = mode; 
  showScreen("ranking-screen");
  
  document.querySelectorAll(".rank-tab").forEach(btn => btn.classList.remove("active"));
  document.getElementById(`tab-${tab}`).classList.add("active");

  const modeNames = {
    "fc": "🃏 깜빡이 학습",
    "memory": "🔠 메모 게임",
    "speed-match": "🧩 스피드 짝맞추기",
    "speed": "⚡ 심플 스피드퀴즈",
    "fish": "🎣 이모지 낚시하기",
"chunk": "🧩 문장 해석 게임"
  };

  document.getElementById("ranking-mode-title").innerText = `[ ${currentSetTitle} ]\n${modeNames[mode] || "전체"} 순위`;

  const quotes = ["Wanna try again? 🚀", "You're a star! ⭐", "Keep it up! 🔥", "Fantastic job! 🎉", "Challenge the top! 🏆"];
  document.getElementById("ranking-encourage").innerText = quotes[Math.floor(Math.random() * quotes.length)];
  document.getElementById("ranking-msg").innerText = `축하해요!! ${currentUser.emoji}${currentUser.nickname}님은 ${currentUser.score}점입니다!`;

  const listEl = document.getElementById("ranking-list");
  listEl.innerHTML = "<div style='text-align:center; padding: 20px;'>순위를 불러오는 중...🔍</div>";

  try {
    const qSnap = await getDocs(collection(db, "scores"));
    let allScores = []; qSnap.forEach(doc => allScores.push(doc.data()));
    
    let filtered = allScores.filter(s => s.mode === currentRankingMode && s.setId === currentSetId);

    const now = new Date(); const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

    if (tab === "today") filtered = filtered.filter(s => s.timestamp >= todayStart);
    else if (tab === "class") filtered = filtered.filter(s => s.classId === currentUser.classId);

    let uniqueTop = {};
    filtered.forEach(s => { if(!uniqueTop[s.stdId] || uniqueTop[s.stdId].score < s.score) uniqueTop[s.stdId] = s; });
    let sorted = Object.values(uniqueTop).sort((a, b) => b.score - a.score);

    listEl.innerHTML = "";
    if (sorted.length === 0) { listEl.innerHTML = "<div style='text-align:center; padding:20px;'>아직 등록된 기록이 없어요!</div>"; } 
    else {
      sorted.forEach((s, idx) => {
        let medal = idx === 0 ? "🥇" : idx === 1 ? "🥈" : idx === 2 ? "🥉" : `${idx+1}위`;
        listEl.innerHTML += `<div class="rank-item"><div><span class="rank-medal">${medal}</span> ${s.emoji} ${s.nickname}</div><div style="color:#ff4081; font-weight:bold;">${s.score}점</div></div>`;
      });
    }
    fireConfetti();
  } catch(e) { listEl.innerHTML = "데이터를 불러오지 못했습니다."; console.error(e); }
}

let confettiParticles = []; let confettiCtx = null; let confettiAnimId = null;
function fireConfetti() {
  const canvas = document.getElementById("confetti-canvas"); canvas.style.display = "block"; canvas.width = window.innerWidth; canvas.height = window.innerHeight;
  confettiCtx = canvas.getContext("2d"); confettiParticles = [];
  const colors = ["#ff4081", "#00bcd4", "#4caf50", "#ffeb3b", "#ff9800", "#9c27b0"];
  for(let i=0; i<100; i++) {
    confettiParticles.push({
      x: canvas.width / 2, y: canvas.height / 2 + 100, r: Math.random() * 6 + 4,
      dx: Math.random() * 20 - 10, dy: Math.random() * -20 - 5, color: colors[Math.floor(Math.random() * colors.length)],
      tilt: Math.random() * 10, tiltAngleInc: (Math.random() * 0.07) + 0.05, tiltAngle: 0
    });
  }
  if (confettiAnimId) cancelAnimationFrame(confettiAnimId); renderConfetti();
}
function renderConfetti() {
  if (!confettiCtx) return;
  const canvas = document.getElementById("confetti-canvas"); confettiCtx.clearRect(0, 0, canvas.width, canvas.height);
  let activeCount = 0;
  confettiParticles.forEach(p => {
    p.tiltAngle += p.tiltAngleInc; p.y += (Math.cos(p.tiltAngle) + 1 + p.r / 2) / 2; p.x += Math.sin(p.tiltAngle) * 2 + p.dx; p.dy += 0.2; p.y += p.dy;
    if (p.y <= canvas.height) activeCount++;
    confettiCtx.beginPath(); confettiCtx.lineWidth = p.r; confettiCtx.strokeStyle = p.color;
    confettiCtx.moveTo(p.x + p.tilt + p.r, p.y); confettiCtx.lineTo(p.x + p.tilt, p.y + p.tilt + p.r); confettiCtx.stroke();
  });
  if (activeCount > 0) confettiAnimId = requestAnimationFrame(renderConfetti); else canvas.style.display = "none";
}

// ==========================================
// 씬 6: 문장 해석 게임 (Chunk Matching)
// ==========================================
let chunkAnswers = [];
let chunkLength = 0;
let currentChunkIndex = 0;

function updateChunkUI() {
  const m = String(Math.floor(gameTimeRemaining / 60)).padStart(2, "0"); 
  const s = String(gameTimeRemaining % 60).padStart(2, "0");
  document.getElementById("chunk-timer").innerText = `🕒 ${m}:${s}`; 
  document.getElementById("chunk-score").innerText = `점수: ${gameScore}`;

  // 🌐 [멀티 대전용 실시간 점수 연동 트리거 추가] 내 점수와 버프 상태를 중계 서버로 즉시 송신!
  if (myLobbyDocId && currentGameMode === "chunk") {
    let currentBuffs = "";
    if (globalScoreMultiplier > 1) currentBuffs += "🟡"; // 배점 2배 버프 상태 표시
    setDoc(doc(db, "lobbyUsers", myLobbyDocId), { score: gameScore, items: currentBuffs }, { merge: true })
      .catch(e => console.error("해석 점수 동기화 에러:", e));
  }
}
function startChunkLogic() {
  // 슬래시가 포함된 문장만 필터링 (영어, 한글 모두 포함되어야 함)
  const validChunkWords = wordList.filter(w => w.en.includes('/') && w.ko.includes('/'));
  
  if(validChunkWords.length === 0) {
    alert("현재 세트에는 슬래시(/)로 구분된 문장이 없습니다. 다른 세트를 선택해 주세요.");
    clearInterval(gameTimerInterval);
    showScreen("menu-screen");
    return;
  }

  currentChunkIndex = 0; // 게임 시작 시 무조건 첫 번째 문장부터 시작
  updateChunkUI();

  // 🕒 절대 시간 동기화 타이머 가동
  gameTimerInterval = setInterval(() => {
    if (globalMultiEndTime) {
       // 🌐 멀티플레이어 대전 시: 타이머 오차를 없애기 위해 '절대 시간' 기준 측정
       gameTimeRemaining = Math.max(0, Math.floor((globalMultiEndTime - Date.now()) / 1000));
       updateChunkUI();
       if (gameTimeRemaining <= 0) {
         clearInterval(gameTimerInterval);
         currentUser.score = gameScore; 
         document.getElementById("result-detail").innerText = `제한 시간 종료! 획득한 해석 점수입니다!`; 
         goResult(); 
       }
    } else {
       // 👤 싱글플레이어 혼자하기 시: 기존 로컬 카운트 흐름 적용
       if (!isGamePaused) {
         gameTimeRemaining--; 
         updateChunkUI();
         if (gameTimeRemaining <= 0) {
           clearInterval(gameTimerInterval);
           currentUser.score = gameScore; 
           document.getElementById("result-detail").innerText = `제한 시간 종료! 획득한 해석 점수입니다!`; 
           goResult(); 
         }
       }
    }
  }, 500); // 0.5초마다 촘촘히 동기화 체크
  
  loadNextChunkQuiz(validChunkWords);
}

function loadNextChunkQuiz(validChunkWords) {
  const wordObj = validChunkWords[currentChunkIndex]; 
  
  let enParts = wordObj.en.split('/').map(s => s.trim());
  let koParts = wordObj.ko.split('/').map(s => s.trim()); // 👈 빠져있던 핵심 코드 복구 완료!

  chunkLength = Math.min(enParts.length, koParts.length);
  enParts = enParts.slice(0, chunkLength);
  koParts = koParts.slice(0, chunkLength);

  const container = document.getElementById("chunk-container");
  const btnContainer = document.getElementById("chunk-buttons-container");
  container.innerHTML = "";
  btnContainer.innerHTML = "";
  chunkAnswers = new Array(chunkLength).fill(null);

  // 상단 청크 빈칸 영역 세팅
  const pairsDiv = document.createElement("div");
  pairsDiv.style.display = "flex";
  pairsDiv.style.flexWrap = "wrap";
  pairsDiv.style.justifyContent = "center";
  pairsDiv.style.gap = "8px";
  pairsDiv.style.width = "100%";

  for(let i = 0; i < chunkLength; i++) {
    const pair = document.createElement("div");
    pair.style.display = "flex";
    pair.style.flexDirection = "column";
    pair.style.flex = "1 1 auto";
    pair.style.minWidth = "80px";
    pair.style.maxWidth = "45%";

    const enDiv = document.createElement("div");
    enDiv.className = "chunk-block sq-fly-in";
    enDiv.innerText = enParts[i];

    const slotDiv = document.createElement("div");
    slotDiv.className = "chunk-slot sq-fly-in";
    slotDiv.id = `chunk-slot-${i}`;
    
    // 채워진 빈칸을 다시 누르면 취소되는 로직
    slotDiv.onclick = () => {
      if (isGamePaused) return;
      if (chunkAnswers[i] !== null) {
        playSound("pop");
        document.getElementById(`chunk-btn-${chunkAnswers[i]}`).classList.remove("used");
        chunkAnswers[i] = null;
        slotDiv.innerText = "";
        slotDiv.classList.remove("filled");
      }
    };

    pair.appendChild(enDiv);
    pair.appendChild(slotDiv);
    pairsDiv.appendChild(pair);
  }
  container.appendChild(pairsDiv);

  // 하단 섞인 버튼 영역 세팅
  const shuffledIndices = Array.from({length: chunkLength}, (_, i) => i).sort(() => 0.5 - Math.random());
  
  shuffledIndices.forEach(origIdx => {
    const btn = document.createElement("button");
    btn.className = "chunk-btn sq-fly-in";
    btn.id = `chunk-btn-${origIdx}`;
    btn.innerText = koParts[origIdx];
    
    btn.onclick = () => {
      if (isGamePaused || btn.classList.contains("used")) return;
      playSound("pop");
      
      const emptyIdx = chunkAnswers.indexOf(null);
      if (emptyIdx !== -1) {
        chunkAnswers[emptyIdx] = origIdx;
        const slot = document.getElementById(`chunk-slot-${emptyIdx}`);
        slot.innerText = koParts[origIdx];
        slot.classList.add("filled");
        btn.classList.add("used");

        // 모든 빈칸이 채워졌는지 검사
        if (!chunkAnswers.includes(null)) {
          checkChunkAnswer(validChunkWords);
        }
      }
    };
    btnContainer.appendChild(btn);
  });
}

function checkChunkAnswer(validChunkWords) {
  isGamePaused = true;
  const isCorrect = chunkAnswers.every((val, idx) => val === idx);
  
  if (isCorrect) {
    playSound("success");
    const earned = calcSpeedBonus() * 2; // 난이도가 있으므로 보너스 배점 상향
    gameScore += earned;
    updateChunkUI();
    showGamePraise(earned, "Perfect Match!", "#3F51B5");

    currentChunkIndex++;
    if (currentChunkIndex >= validChunkWords.length) {
      currentChunkIndex = 0; 
    }
    
    if (Math.random() < 0.3) {
      triggerTreasureEvent(() => { isGamePaused = false; loadNextChunkQuiz(validChunkWords); });
    } else {
      setTimeout(() => { isGamePaused = false; loadNextChunkQuiz(validChunkWords); }, 600);
    }
  } else {
    playSound("wrong");
    const penalty = Math.floor(calcSpeedBonus());
    gameScore -= penalty;
    updateChunkUI();
    showBuffMsg("오답!", `순서가 맞지 않아요\n-${penalty}점`, 244, 67, 54);

    // 오답 시 흔들림 애니메이션 후 블록 초기화
    for(let i = 0; i < chunkLength; i++) {
      document.getElementById(`chunk-slot-${i}`).classList.add("wrong");
    }
    
    setTimeout(() => {
      for(let i = 0; i < chunkLength; i++) {
        const slot = document.getElementById(`chunk-slot-${i}`);
        slot.classList.remove("wrong", "filled");
        slot.innerText = "";
        if (chunkAnswers[i] !== null) {
          document.getElementById(`chunk-btn-${chunkAnswers[i]}`).classList.remove("used");
        }
      }
      chunkAnswers.fill(null);
      isGamePaused = false;
    }, 600);
  }
}
// ==========================================
// 씬 7: 온라인 멀티플레이어 로비 로직
// ==========================================

// 모드 선택 화면 버튼 클릭 연동
bindClick("mode-solo-btn", () => {
  playSound("click");
  renderSetSelectList(); 
  showScreen("set-select-screen");
});

bindClick("mode-multi-student-btn", () => {
  playSound("click");
  enterMultiLobbyAsStudent();
});

bindClick("mode-multi-teacher-btn", () => {
  playSound("click");
  const pwd = prompt("교사용 대기실 비밀번호를 입력하세요.", "");
  if (pwd === "1234") {
    enterMultiLobbyAsTeacher();
  } else if (pwd !== null) {
    alert("비밀번호가 틀렸습니다!");
  }
});

bindClick("lobby-mode-back-btn", () => {
  playSound("click");
  showScreen("login-screen");
});

// [학생용] 실시간 대기실 입장
async function enterMultiLobbyAsStudent() {
  showScreen("multi-lobby-screen");
  
  // 1. 파이어베이스 대기실 명단에 나 자신 등록
  try {
    const docRef = await addDoc(collection(db, "lobbyUsers"), {
      stdId: currentUser.stdId,
      nickname: currentUser.nickname,
      emoji: currentUser.emoji,
      score: 0,
      items: "", 
      attack: null, // 💥 실시간 피격 이벤트 수신용 필드
      timestamp: Date.now()
    });
    myLobbyDocId = docRef.id;

    // 🌟 [핵심] 나를 향한 공격을 실시간으로 도청하는 전용 안테나 설치
    myLobbyListenerUnsubscribe = onSnapshot(doc(db, "lobbyUsers", myLobbyDocId), (docSnap) => {
      if (docSnap.exists() && docSnap.data().attack) {
        const atk = docSnap.data().attack;
        handleIncomingAttack(atk);
        // 수신 확인했으니 파이어베이스 공격 필드는 즉시 비워두기 (중복 실행 방지)
        setDoc(doc(db, "lobbyUsers", myLobbyDocId), { attack: null }, { merge: true });
      }
    });

  } catch(e) { console.error("로비 입장 등록 실패:", e); }

  // 2. 대기 유저 리스트 실시간 감지
  lobbyUsersUnsubscribe = onSnapshot(collection(db, "lobbyUsers"), (snapshot) => {
    const userListEl = document.getElementById("lobby-user-list");
    const countEl = document.getElementById("lobby-user-count");
    userListEl.innerHTML = "";
    let count = 0;
    snapshot.forEach((doc) => {
      const u = doc.data();
      const chip = document.createElement("span");
      chip.style.cssText = "background: white; border: 1px solid #ddd; padding: 4px 8px; border-radius: 15px; font-size: 14px; box-shadow: 0 2px 4px rgba(0,0,0,0.05); white-space: nowrap;";
      chip.innerText = `${u.emoji} ${u.nickname}`;
      userListEl.appendChild(chip);
      count++;
    });
    countEl.innerText = count;
  });

  // 3. 로비 채팅창 실시간 감지
  const qChat = query(collection(db, "lobbyChat"), orderBy("timestamp", "asc"));
  lobbyChatUnsubscribe = onSnapshot(qChat, (snapshot) => {
    const chatWindow = document.getElementById("lobby-chat-window");
    chatWindow.innerHTML = "";
    snapshot.forEach((doc) => {
      const c = doc.data();
      const msgDiv = document.createElement("div");
      msgDiv.innerHTML = `<span style="font-weight:bold; color:#1976D2;">${c.emoji} ${c.nickname}:</span> <span>${c.text}</span>`;
      chatWindow.appendChild(msgDiv);
    });
    chatWindow.scrollTop = chatWindow.scrollHeight;
  });

  // 4. 교사의 실시간 원격 시작 신호 감지 인터셉터
  multiRoomUnsubscribe = onSnapshot(doc(db, "gameData", "multiRoom"), (docSnap) => {
    if (docSnap.exists()) {
      const room = docSnap.data();
      if (room.status === "playing") {
         // (기존의 카운트다운 및 게임 실행 코드가 원본 그대로 유지됨...)
         const selectedSet = wordSets.find(s => s.id === room.setId);
         if (selectedSet) { wordList = selectedSet.words; currentSetId = room.setId; currentSetTitle = room.setTitle; }
         currentGameMode = room.gameMode;
         multiUseSpecialItems = (room.useSpecialItems === "on");
         globalMultiEndTime = Date.now() + 5000 + (room.duration * 60 * 1000);
         if (room.gameMode === "speed") { startCountdown(room.duration, "speed-screen", () => { startSpeedLogic(); }); } 
         else if (room.gameMode === "chunk") { startCountdown(room.duration, "chunk-screen", () => { startChunkLogic(); }); }
      } 
      // 🚀 [철통 보완] 게임 진행 중에 교사가 강제 종료를 누르거나 창을 꺼서 status가 waiting으로 폭파된 경우!
      else if (room.status === "waiting" && (currentGameMode === "speed" || currentGameMode === "chunk") && !isTeacherMode) {
        resetGameStates();
        globalMultiEndTime = null;
        alert("👑 선생님이 멀티플레이 게임을 강제 종료하셨거나 연결이 끊어졌습니다!\n실시간 대기실로 안전하게 이동합니다.");
        showScreen("multi-lobby-screen");
      }
    }
  });
}

// 채팅 전송 버튼 연동
bindClick("lobby-chat-send-btn", async () => {
  const input = document.getElementById("lobby-chat-input");
  const text = input.value.trim();
  if(!text) return;
  
  input.value = "";
  playSound("pop");
  try {
    await addDoc(collection(db, "lobbyChat"), {
      nickname: currentUser.nickname,
      emoji: currentUser.emoji,
      text: text,
      timestamp: Date.now()
    });
  } catch(e) { console.error("채팅 전송 실패:", e); }
});

// 채팅창 엔터키 연동
const chatInput = document.getElementById("lobby-chat-input");
if(chatInput) {
  chatInput.onkeydown = (e) => {
    if(e.key === "Enter") {
      document.getElementById("lobby-chat-send-btn").click();
    }
  };
}

// 학생 대기실 나가기 버튼
bindClick("lobby-exit-btn", async () => {
  playSound("click");
  await exitLobby();
  showScreen("lobby-mode-screen");
});

// 대기실 퇴장 처리 공통 함수
async function exitLobby() {
  if (lobbyUsersUnsubscribe) { lobbyUsersUnsubscribe(); lobbyUsersUnsubscribe = null; }
  if (lobbyChatUnsubscribe) { lobbyChatUnsubscribe(); lobbyChatUnsubscribe = null; }
  if (multiRoomUnsubscribe) { multiRoomUnsubscribe(); multiRoomUnsubscribe = null; }
  if (myLobbyListenerUnsubscribe) { myLobbyListenerUnsubscribe(); myLobbyListenerUnsubscribe = null; } // 👈 추가
  if (myLobbyDocId) {
    try { await deleteDoc(doc(db, "lobbyUsers", myLobbyDocId)); } catch(e) { console.error(e); }
    myLobbyDocId = null;
  }
  globalMultiEndTime = null; 
}

// 브라우저 닫기/숨김 시 유령 유저 방지 및 교사 탈출 시 방 폭파
function forceCleanupLobby() {
  if (myLobbyDocId) {
    deleteDoc(doc(db, "lobbyUsers", myLobbyDocId));
  }
  
  // 🚀 만약 교사 모드가 켜진 상태에서 창을 그냥 닫아버리거나 새로고침을 한 경우 방을 즉시 대기 상태로 복구!
  if (isTeacherMode) {
    setDoc(doc(db, "gameData", "multiRoom"), { status: "waiting" });
  }
}
window.addEventListener("beforeunload", forceCleanupLobby);
window.addEventListener("pagehide", forceCleanupLobby);
// [교사용] 실시간 중계 대기실 입장 및 세트 옵션 주입
function enterMultiLobbyAsTeacher() {
  isTeacherMode = true; // 🚀 교사 모드 활성화!
  showScreen("teacher-lobby-screen");
  
  const setSelect = document.getElementById("teacher-game-set-select");
  if (setSelect) {
    setSelect.innerHTML = wordSets.map(set => `<option value="${set.id}">${set.title} (${set.words.length}개)</option>`).join("");
  }

  // 대기방 유저 실시간 감지
  lobbyUsersUnsubscribe = onSnapshot(collection(db, "lobbyUsers"), (snapshot) => {
    const userListEl = document.getElementById("teacher-user-list");
    const countEl = document.getElementById("teacher-user-count");
    userListEl.innerHTML = "";
    let count = 0;
    snapshot.forEach((doc) => {
      const u = doc.data();
      const card = document.createElement("div");
      card.style.cssText = "background: white; border: 2px solid #9C27B0; padding: 6px 12px; border-radius: 10px; font-size: 15px; font-weight: bold; box-shadow: 0 3px 6px rgba(0,0,0,0.05); display: flex; align-items: center; gap: 5px;";
      card.innerText = `${u.emoji} ${u.nickname} (${u.stdId})`;
      userListEl.appendChild(card);
      count++;
    });
    countEl.innerText = count;
  });
}


// 교사용 🏁멀티플레이 게임 시작 버튼 이벤트 바인딩
bindClick("teacher-game-start-btn", async () => {
  const mode = document.getElementById("teacher-game-mode-select").value;
  const duration = parseInt(document.getElementById("teacher-game-time-select").value);
  const setId = document.getElementById("teacher-game-set-select").value;
  const itemOption = document.getElementById("teacher-game-item-select").value; // 👈 추가
  const selectedSet = wordSets.find(s => s.id === setId);

  if(!selectedSet) return alert("게임을 진행할 학습 세트를 선택해 주세요!");

  playSound("success");

  // 파이어베이스 원격 멀티룸 상태 업데이트 (아이템 승인값 추가 포함)
  await setDoc(doc(db, "gameData", "multiRoom"), {
    status: "playing",
    gameMode: mode,
    duration: duration,
    setId: setId,
    setTitle: selectedSet.title,
    useSpecialItems: itemOption // 👈 서버 전송 각인
  });

  const targetEndTime = Date.now() + 5000 + (duration * 60 * 1000);
  startTeacherLiveMatch(targetEndTime);
});

// 교사용 실시간 타이머 및 중계화면 가동 함수 (절대 시간 적용)
function startTeacherLiveMatch(targetEndTime) {
  showScreen("teacher-match-screen");
  document.getElementById("teacher-match-exit-btn").style.display = "none";
  document.getElementById("teacher-match-abort-btn").style.display = "block"; // 🚀 강제 종료 버튼 상시 노출

  teacherMatchInterval = setInterval(async () => {
    let remain = Math.max(0, Math.floor((targetEndTime - Date.now()) / 1000));
    const m = String(Math.floor(remain / 60)).padStart(2, "0");
    const s = String(remain % 60).padStart(2, "0");
    timerEl.innerText = `🕒 ${m}:${s}`;

    if (remain <= 0) {
      clearInterval(teacherMatchInterval);
      await setDoc(doc(db, "gameData", "multiRoom"), { status: "finished" }, { merge: true });
      fireConfetti();
      document.getElementById("teacher-match-abort-btn").style.display = "none"; // 🚀 정상 종료 시 강제 종료 버튼 감춤
      document.getElementById("teacher-match-exit-btn").style.display = "block";
    }
  }, 500);

  startTeacherLiveLeaderboard();
}

// 🏎️ [정렬 핵심] 학생 점수를 가로채서 부드러운 위치 이동 연출을 수행하는 실시간 랭킹 보드
function startTeacherLiveLeaderboard() {
  const leaderboardContainer = document.getElementById("teacher-live-leaderboard");
  leaderboardContainer.innerHTML = ""; 

  teacherLiveUnsubscribe = onSnapshot(collection(db, "lobbyUsers"), (snapshot) => {
    let players = [];
    snapshot.forEach(doc => { players.push({ docId: doc.id, ...doc.data() }); });

    players.sort((a, b) => b.score - a.score);

    players.forEach((player, idx) => {
      let playerBar = document.getElementById(`live-bar-${player.stdId}`);
      if (!playerBar) {
        playerBar = document.createElement("div");
        playerBar.id = `live-bar-${player.stdId}`;
        playerBar.className = "live-rank-item";
        leaderboardContainer.appendChild(playerBar);
      }

      playerBar.className = `live-rank-item rank-${idx + 1}`;
      playerBar.style.top = `${idx * 70}px`;

      let medalBadge = idx === 0 ? "🥇 1등" : idx === 1 ? "🥈 2등" : idx === 2 ? "🥉 3등" : `${idx + 1}위`;

      playerBar.innerHTML = `
        <div class="live-rank-badge">${medalBadge}</div>
        <div class="live-rank-user">${player.emoji} ${player.nickname} <span style="font-size:12px; color:#888; font-weight:normal;">(${player.stdId})</span></div>
        <div class="live-rank-items">${player.items || ""}</div>
        <div class="live-rank-score">${player.score} 점</div>
      `;
    });

    const aliveIds = players.map(p => `live-bar-${p.stdId}`);
    Array.from(leaderboardContainer.children).forEach(child => {
      if (!aliveIds.includes(child.id)) child.remove();
    });
  });
}

// 중계 완료 후 대기방으로 리턴 제어 버튼
bindClick("teacher-match-exit-btn", async () => {
  playSound("click");
  clearInterval(teacherMatchInterval);
  if (teacherLiveUnsubscribe) { teacherLiveUnsubscribe(); teacherLiveUnsubscribe = null; }
  if (lobbyUsersUnsubscribe) { lobbyUsersUnsubscribe(); lobbyUsersUnsubscribe = null; }
  
  await setDoc(doc(db, "gameData", "multiRoom"), { status: "waiting" });
  enterMultiLobbyAsTeacher();
});

// 교사 대기실 나가기 버튼
bindClick("teacher-lobby-exit-btn", async () => {
  playSound("click");
  isTeacherMode = false; // 🚀 교사 모드 해제
  if (lobbyUsersUnsubscribe) { lobbyUsersUnsubscribe(); lobbyUsersUnsubscribe = null; }
  await setDoc(doc(db, "gameData", "multiRoom"), { status: "waiting" });
  showScreen("lobby-mode-screen");
});
// ==========================================
// 💥 멀티플레이 특수 아이템 대인 타격 처리 시스템
// ==========================================

// 공격 대상 선택 모달 빌더
async function openTargetSelectionModal(itemType, title, desc, gameCallback) {
  const modal = document.getElementById("multi-target-modal");
  const listContainer = document.getElementById("multi-target-list");
  
  document.getElementById("multi-target-title").innerText = title;
  document.getElementById("multi-target-desc").innerText = desc;
  listContainer.innerHTML = "<span style='color:#888; font-size:14px; padding:10px;'>타겟 탐색 중...</span>";
  modal.style.display = "flex";

  // 현재 룸안에 실시간 동기화 중인 학생들의 스냅샷 스캔
  try {
    const snap = await getDocs(collection(db, "lobbyUsers"));
    listContainer.innerHTML = "";
    let targetsExist = false;

    snap.forEach((docObj) => {
      const u = docObj.data();
      // 나 자신은 공격 대상 목록에서 철저히 배제
      if (docObj.id !== myLobbyDocId) {
        targetsExist = true;
        const btn = document.createElement("button");
        btn.style.cssText = "width:100%; text-align:left; font-size:16px; padding:10px; margin:0; border-radius:10px; background:#fff; color:#333; border:2px solid #ddd; box-shadow:0 3px 0 #ccc; display:flex; justify-content:space-between; align-items:center;";
        btn.innerHTML = `<span>${u.emoji} ${u.nickname}</span> <span style='font-weight:bold; color:#ff4081;'>${u.score}점</span>`;
        
        btn.onclick = async () => {
          modal.style.display = "none";
          playSound("success");
          await fireAttackToTarget(itemType, docObj.id, u, gameCallback);
        };
        listContainer.appendChild(btn);
      }
    });

    if(!targetsExist) {
      listContainer.innerHTML = "<p style='font-size:14px; color:#666; padding:10px; margin:0;'>공격할 수 있는 다른 학생이 없습니다! 혼자 플레이 중입니다.</p>";
    }

  } catch(e) { console.error(e); modal.style.display = "none"; isGamePaused = false; gameCallback(); }

  // 취소 버튼 연동
  document.getElementById("multi-target-cancel-btn").onclick = () => {
    modal.style.display = "none";
    playSound("click");
    isGamePaused = false;
    gameCallback();
  };
}

// 타겟을 향한 실시간 공격 신호 미사일 발사부
async function fireAttackToTarget(itemType, targetDocId, targetData, gameCallback) {
  try {
    // 실시간 정밀 타격을 위해 대상의 최신 점수 다이렉트 긴급 로드
    const freshSnap = await getDoc(doc(db, "lobbyUsers", targetDocId));
    let currentTargetScore = targetData.score;
    if(freshSnap.exists()) currentTargetScore = freshSnap.data().score || 0;

    if (itemType === "swap") {
      // 🔄 점수 스왑 연산: 내 점수와 타겟 점수를 통째로 교체
      let myOldScore = gameScore;
      gameScore = currentTargetScore;
      
      // 상대편 기기에 변동 점수 주입 및 팝업 통보 전송
      await setDoc(doc(db, "lobbyUsers", targetDocId), { 
        score: myOldScore,
        attack: { type: "swap", by: currentUser.nickname, newScore: myOldScore }
      }, { merge: true });

      showBuffMsg("점수 스왑 성공!", `${targetData.nickname}님과 점수가 바뀌어 ${gameScore}점이 되었습니다!`, 76, 175, 80);

    } else if (itemType === "steal50") {
      // 💥 50% 강탈 연산: 타겟의 점수 절반을 빼앗아 나에게 흡수
      let stealAmt = Math.floor(currentTargetScore * 0.5);
      gameScore += stealAmt;

      let targetNewScore = Math.max(0, currentTargetScore - stealAmt);
      await setDoc(doc(db, "lobbyUsers", targetDocId), {
        score: targetNewScore,
        attack: { type: "steal50", by: currentUser.nickname, amt: stealAmt }
      }, { merge: true });

      showBuffMsg("강탈 대성공! 🔵", `${targetData.nickname}님에게서 ${stealAmt}점을 강탈했습니다!`, 33, 150, 243);

    } else if (itemType === "blind") {
      // 🕶️ 화면 가리기 전송 (대상 점수 파괴 없음)
      await setDoc(doc(db, "lobbyUsers", targetDocId), {
        attack: { type: "blind", by: currentUser.nickname }
      }, { merge: true });

      showBuffMsg("블라인드 저주 발사! 👻", `${targetData.nickname}님의 화면을 3초간 마비시켰습니다.`, 156, 39, 176);
    }

  } catch(e) { console.error("공격 실패:", e); }

  refreshGameModeUI();
  isGamePaused = false;
  gameCallback();
}

// 🚨 광역 패시브: 나를 제외한 방 안의 모든 학생 점수 10%씩 일제 강탈
async function executeSteal10FromAll(gameCallback) {
  try {
    const snap = await getDocs(collection(db, "lobbyUsers"));
    let totalStolen = 0;

    for (let docObj of snap.docs) {
      if (docObj.id !== myLobbyDocId) {
        const u = docObj.data();
        let stolen = Math.floor((u.score || 0) * 0.1);
        totalStolen += stolen;

        let uNewScore = Math.max(0, (u.score || 0) - stolen);
        // 대상 유저들 일제히 차감 및 도발 팝업 송신
        await setDoc(doc(db, "lobbyUsers", docObj.id), {
          score: uNewScore,
          attack: { type: "steal10all", by: currentUser.nickname }
        }, { merge: true });
      }
    }

    gameScore += totalStolen;
    showBuffMsg("🔱 광역 강탈 스킬 발동!", `모든 학생의 점수를 10%씩 흡수하여 총 ${totalStolen}점을 획득했습니다!`, 255, 152, 0);

  } catch(e) { console.error(e); }

  refreshGameModeUI();
  isGamePaused = false;
  gameCallback();
}

// 💥 날벼락 피격 이벤트 발생 시 수신자 브라우저 작동 컨트롤러
function handleIncomingAttack(atk) {
  if (atk.type === "swap") {
    playSound("wrong");
    gameScore = atk.newScore;
    refreshGameModeUI();
    alert(`🚨 날벼락 발동!!!\n\n[${atk.by}]님이 당신과 점수를 맞바꿨습니다!\n바뀐 내 점수: ${gameScore}점`);

  } else if (atk.type === "steal50") {
    playSound("wrong");
    // 공격자가 내 점수를 계산하여 줄였으므로, 로컬 변수 즉시 재동기화 후 경고창 알림
    gameScore = Math.floor(gameScore * 0.5);
    refreshGameModeUI();
    alert(`🚨 탈탈 털렸습니다!!!\n\n[${atk.by}]님이 당신의 점수 50% (${atk.amt}점)를 빼앗아 갔습니다!`);

  } else if (atk.type === "steal10all") {
    playSound("wrong");
    gameScore = Math.max(0, gameScore - Math.floor(gameScore * 0.1));
    refreshGameModeUI();
    showBuffMsg("💥 흡수 당함!", `[${atk.by}]님의 광역 스킬로 인해 내 점수의 10%를 빼앗겼습니다!`, 244, 67, 54);

  } else if (atk.type === "blind") {
    playSound("wrong");
    const blindOverlay = document.getElementById("multi-blind-overlay");
    document.getElementById("multi-blind-msg").innerText = `😈 [${atk.by}]님의 먹칠 공격! 3초간 조작이 불가합니다.`;
    
    // 3초간 전면 차단 레이어 노출
    blindOverlay.style.display = "flex";
    setTimeout(() => {
      blindOverlay.style.display = "none";
    }, 3000);
  }
}
// 🚀 교사용 원격 게임 강제 종료 이벤트 바인딩
bindClick("teacher-match-abort-btn", async () => {
  if (!confirm("현재 진행 중인 실시간 멀티플레이 대전을 강제 종료하시겠습니까?\n접속한 모든 학생의 화면도 즉시 중단됩니다.")) return;
  
  playSound("wrong");
  clearInterval(teacherMatchInterval);
  if (teacherLiveUnsubscribe) { teacherLiveUnsubscribe(); teacherLiveUnsubscribe = null; }
  if (lobbyUsersUnsubscribe) { lobbyUsersUnsubscribe(); lobbyUsersUnsubscribe = null; }
  
  // 서버 룸 상태를 대기(waiting) 상태로 즉시 강제 폭파 신호 전송!
  await setDoc(doc(db, "gameData", "multiRoom"), { status: "waiting" });
  
  alert("게임이 정상적으로 강제 종료되었습니다.");
  enterMultiLobbyAsTeacher(); // 교사 대기실 화면으로 리턴
});
// 🧹 교사용 유령 유저 (전체) 강제 퇴장 처리
bindClick("teacher-clear-ghosts-btn", async () => {
  playSound("click");
  if(confirm("대기실의 모든 유저 목록을 강제로 싹 비웁니다.\n(실제 접속 중인 학생도 지워지니 주의하세요!) 진행할까요?")) {
    try {
      const snap = await getDocs(collection(db, "lobbyUsers"));
      snap.forEach(d => deleteDoc(doc(db, "lobbyUsers", d.id)));
      alert("대기실 명단이 초기화되었습니다.");
    } catch(e) { console.error("초기화 에러", e); }
  }
});