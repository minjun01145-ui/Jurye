//1. 파이어베이스 라이브러리 불러오기
// 1. 파이어베이스 라이브러리 불러오기 (🔥 initializeFirestore 를 추가로 적어줍니다)
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-app.js";
import { initializeFirestore, getFirestore, doc, setDoc, getDoc, collection, addDoc, getDocs, onSnapshot, query, orderBy, limit, deleteDoc } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-firestore.js";

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
const db = getFirestore(app); // 🚀 [속도 패치] 강제 저속 모드 해제! 고속 실시간 통신망(WebSocket)으로 연결합니다.

window.addEventListener("unhandledrejection", (event) => {
  console.error("처리되지 않은 통신 오류:", event.reason);
  if (currentGameMode === "create") {
    alert("네트워크가 잠시 불안정해서 작업이 멈췄습니다. 화면을 복구합니다. 다시 제출 버튼을 눌러 주세요.");
    showScreen("student-create-screen");
    const controls = document.getElementById("top-left-controls");
    if (controls) controls.style.display = "flex";
  }
});

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
let currentMultiRoomGroupPlayMode = null;
let currentMultiRoomRepresentatives = null;
// 🚀 통신 폭탄 방지용 상태 기억 변수
let lastSyncedScore = -1;
let lastSyncedItems = null;
// 🚀 문제 만들기 전용 전역 변수
let createTargetCount = 1;
let createAllowedTypes = [];
let myCreatedProblems = [];
let currentEditingSlot = -1;
let isBossRaid = false; // 보스전 모드인지 확인하는 전역 변수
// ==========================================
// 🚀 1. 등록된 캐릭터 폴더 목록 (folder_list.txt 자동 파싱 시스템)
// ==========================================
let availableCharacters = [];
// 🚀 jr(돈)과 ownedCharacters(구매한 캐릭터 목록) 속성 추가
let currentUser = { stdId: "", realName: "", classId: "", nickname: "", emoji: "😎", character: "", jr: 0, ownedCharacters: [], score: 0, caughtEmojis: "" };
const praises = ["Fabulous!", "Terrific!", "Awesome!", "Incredible!", "Great Job!", "Perfect!"];

// 멀티플레이 및 글로벌 변수들 통합 정리
let lobbyUsersUnsubscribe = null;
let lobbyChatUnsubscribe = null;
let myLobbyDocId = null; 
let globalMultiEndTime = null; 
let multiUseSpecialItems = false; 
let myLobbyListenerUnsubscribe = null; 
let isTeacherMode = false; 
let multiRoomUnsubscribe = null;
let teacherLiveUnsubscribe = null;
let teacherMatchInterval = null;

// 🚀 char/folder_list.txt 파일을 읽어서 배열을 자동 생성하는 함수
async function loadCharacterList() {
  try {
    const response = await fetch("char/folder_list.txt?t=" + Date.now());
    if (!response.ok) throw new Error("텍스트 파일을 찾을 수 없습니다.");
    const text = await response.text();
    availableCharacters = text.split(/\r?\n/).map(line => line.trim()).filter(line => line !== "");
    
    if (availableCharacters.length > 0) {
      currentUser.character = availableCharacters[0];
      
      // 🚀 파일 로딩 완료 즉시 로그인 화면에 기본 캐릭터(1번)를 표시합니다!
      const avatarDisp = document.getElementById("main-character-display");
      if (avatarDisp) {
        avatarDisp.innerHTML = `<img src="char/${availableCharacters[0]}/stand1_0.png" class="anim-avatar" data-char-id="${availableCharacters[0]}" style="height: 140px; filter: drop-shadow(0px 8px 10px rgba(0,0,0,0.15));" />`;
      }
    }
  } catch (error) {
    console.warn("캐릭터 목록 로딩 실패 (대체 캐릭터 가동):", error);
    availableCharacters = ["기본0(민준쌤)"];
    currentUser.character = availableCharacters[0];
    
    // 실패 시에도 기본 캐릭터를 띄워줍니다
    const avatarDisp = document.getElementById("main-character-display");
    if (avatarDisp) {
      avatarDisp.innerHTML = `<img src="char/${availableCharacters[0]}/stand1_0.png" class="anim-avatar" data-char-id="${availableCharacters[0]}" style="height: 140px; filter: drop-shadow(0px 8px 10px rgba(0,0,0,0.15));" />`;
    }
  }
}
loadCharacterList();

// ==========================================
// 사운드 시스템
// ==========================================
let isMuted = false; 
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
  if (isMuted) return; 
  try {
    const ctx = getAudioCtx();
    if (!ctx) return;
    const osc = ctx.createOscillator(); const gainNode = ctx.createGain();
    osc.connect(gainNode); gainNode.connect(ctx.destination);
    if (type === "click") { 
      osc.type = "sine"; osc.frequency.setValueAtTime(600, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(800, ctx.currentTime + 0.1);
      gainNode.gain.setValueAtTime(0.1, ctx.currentTime); osc.start(); osc.stop(ctx.currentTime + 0.1);
    } else if (type === "flip") { 
      osc.type = "triangle"; osc.frequency.setValueAtTime(300, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(100, ctx.currentTime + 0.08);
      gainNode.gain.setValueAtTime(0.1, ctx.currentTime); osc.start(); osc.stop(ctx.currentTime + 0.08);
    } else if (type === "pop") { 
      osc.type = "sine"; osc.frequency.setValueAtTime(400, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(1200, ctx.currentTime + 0.1);
      gainNode.gain.setValueAtTime(0.15, ctx.currentTime); 
      gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);
      osc.start(); osc.stop(ctx.currentTime + 0.1);
    } else if (type === "wrong") { 
      osc.type = "sawtooth"; osc.frequency.setValueAtTime(150, ctx.currentTime);
      gainNode.gain.setValueAtTime(0.1, ctx.currentTime); osc.start(); osc.stop(ctx.currentTime + 0.2);
    } else if (type === "success") { 
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
    } else if (type === "treasure") { 
      osc.type = "square"; osc.frequency.setValueAtTime(400, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(800, ctx.currentTime + 0.3);
      gainNode.gain.setValueAtTime(0.1, ctx.currentTime); osc.start(); osc.stop(ctx.currentTime + 0.3);
    }
  } catch(e) { console.warn("Sound disabled", e); }
}
// 🚀 [멈춤 미아 방지] 브라우저를 얼리지 않는 자체 팝업창 엔진
window.customAlert = function(msg, callback) {
  const overlay = document.getElementById("custom-alert-overlay");
  const msgEl = document.getElementById("custom-alert-msg");
  const btn = document.getElementById("custom-alert-btn");
  
  if (overlay && msgEl && btn) {
    msgEl.innerText = msg;
    overlay.style.display = "flex";
    
    // 버튼을 누르면 창이 닫히도록 설정
    btn.onclick = () => {
      if (typeof playSound === "function") playSound("click");
      overlay.style.display = "none";
      if (callback) callback();
    };
  } else {
    // 혹시라도 HTML을 못 찾으면 기존 시스템 alert로 임시 작동
    alert(msg);
    if (callback) callback();
  }
};
// ==========================================
// 5. UI 유틸리티
// ==========================================
function showScreen(screenId) {
  document.querySelectorAll(".screen").forEach((s) => { s.style.display = "none"; s.classList.remove("active"); });
  if (screenId) { const screen = document.getElementById(screenId); if(screen) { screen.style.display = "flex"; screen.classList.add("active"); } }

  const gameScreens = ["flashcard-screen", "memory-screen", "speed-match-screen", "speed-screen", "fishing-screen", "chunk-screen", "teacher-match-screen"];
  const container = document.getElementById("walking-emoji-container");
  if (container) {
    if (gameScreens.includes(screenId)) {
      container.style.opacity = "0"; 
    } else {
      container.style.opacity = "1"; 
    }
  }
}

function bindClick(id, callback) {
  const el = document.getElementById(id);
  if (el) el.onclick = callback;
  else console.warn(`주의: HTML에서 '${id}' 버튼 찾기 실패 (무시됨)`);
}

// ==========================================
// 🚀 2. 2D 픽셀 캐릭터 4프레임 애니메이션 엔진
// ==========================================
const charFrames = ["stand1_0.png", "stand1_1.png", "stand1_2.png", "stand1_3.png"];
let currentFrameIdx = 0;
const preloadedImages = {}; 

setInterval(() => {
  currentFrameIdx = (currentFrameIdx + 1) % charFrames.length;
  document.querySelectorAll(".anim-avatar").forEach(img => {
    const charFolder = img.getAttribute("data-char-id");
    if (charFolder) {
      const imgPath = `char/${charFolder}/${charFrames[currentFrameIdx]}`;
      if (!preloadedImages[imgPath]) {
        const tempImg = new Image();
        tempImg.src = imgPath;
        preloadedImages[imgPath] = tempImg;
      }
      img.src = imgPath; 
    }
  });
}, 250);

function getAvatarHtml(charFolder, size = "45px") {
  if(!charFolder) return "😎"; 
  return `<img src="char/${charFolder}/stand1_0.png" class="anim-avatar" data-char-id="${charFolder}" style="height:${size}; vertical-align:middle; margin-right:5px; filter: drop-shadow(2px 2px 2px rgba(0,0,0,0.15));">`;
}

// ==========================================
// 🛒 3. 캐릭터 상점 및 대기실
// ==========================================
// 🚀 [4/4] 캐릭터 상점: 구매(2000JR), 장착, 그리고 원작자 수익금(500JR) 발송 시스템
function renderCharShopList() {
  const shopContainer = document.getElementById("shop-character-list");
  if (!shopContainer) return;
  
  shopContainer.innerHTML = "";
  
  availableCharacters.forEach(charFolder => {
    let charName = charFolder;
    let creatorName = "알 수 없음";
    
    if (charFolder.includes("(") && charFolder.includes(")")) {
      const parts = charFolder.split("(");
      charName = parts[0].trim(); 
      creatorName = parts[1].replace(")", "").trim(); 
    }

    // 이미 구매한 캐릭터인지 확인
    const isOwned = currentUser.ownedCharacters && currentUser.ownedCharacters.includes(charFolder);
    const lockText = isOwned ? `<span style="color:#4CAF50;">보유 중 ✔️</span>` : `<span style="color:#f44336;">2000 JR 🔒</span>`;

    const card = document.createElement("div");
    card.className = "shop-char-card";
    card.style.cssText = "display: flex; flex-direction:column; align-items: center; background: white; padding: 15px; border-radius: 20px; border: 3px solid #FF9800; cursor: pointer; transition: 0.2s;";
    
    card.innerHTML = `
      <img src="char/${charFolder}/stand1_0.png" class="anim-avatar" data-char-id="${charFolder}" style="height: 80px; margin-bottom:10px;">
      <span style="font-weight:bold; color:#333; font-size:18px;">${charName}</span>
      <span style="font-size:13px; color:#666; margin-top:5px; background:#f0f0f0; padding:3px 8px; border-radius:8px;">만든이: ${creatorName}</span>
      <div style="margin-top:10px; font-weight:bold; font-size:15px;">${lockText}</div>
    `;
    
    card.onclick = async () => { 
        playSound("click");

        if (isOwned) {
            // 이미 구매한 캐릭터 -> 장착
            currentUser.character = charFolder; 
            const avatarDisp = document.getElementById("main-character-display");
            if(avatarDisp) avatarDisp.innerHTML = getAvatarHtml(charFolder, "140px");
            alert(`[${charName}] 캐릭터를 장착했습니다!`);
            showScreen("login-screen");
        } else {
            // 미보유 캐릭터 -> 2000 JR 구매 시도
            if (confirm(`[${charName}] 캐릭터를 2000 JR에 구매하시겠습니까?\n(현재 내 JR: ${currentUser.jr} JR)`)) {
                if (currentUser.jr < 2000) {
                    return alert("JR이 부족합니다! 게임을 플레이하여 JR을 더 모아오세요.");
                }

                // 1. 내 돈 차감 및 소유권 추가
                currentUser.jr -= 2000;
                currentUser.ownedCharacters.push(charFolder);
                currentUser.character = charFolder;

                // 2. 내 DB 업데이트
                await setDoc(doc(db, "users", currentUser.stdId), {
                    jr: currentUser.jr,
                    ownedCharacters: currentUser.ownedCharacters,
                    character: currentUser.character
                }, { merge: true });

                // 3. 💸 원작자에게 로열티(500 JR) 발송 
                if (creatorName && creatorName !== "알 수 없음" && creatorName !== "민준쌤") {
                    await addDoc(collection(db, "royalties"), {
                        creatorName: creatorName,      // 이 이름으로 주인을 찾습니다
                        buyerId: currentUser.stdId,
                        buyerName: currentUser.realName,
                        charName: charName,
                        amount: 500,
                        isClaimed: false,              // 아직 수령하지 않음
                        timestamp: Date.now()
                    });
                }

                // UI 즉시 업데이트
                const avatarDisp = document.getElementById("main-character-display");
                if(avatarDisp) avatarDisp.innerHTML = getAvatarHtml(charFolder, "140px");
                const jrDisp = document.getElementById("user-jr-display");
                if(jrDisp) jrDisp.innerText = currentUser.jr;

                alert(`🎉 구매 성공! [${charName}] 캐릭터를 장착했습니다!`);
                showScreen("login-screen");
            }
        }
    };
    shopContainer.appendChild(card);
  });
}

// 🚀 조편성 상태 글로벌 변수
let currentGroupingActive = false;
let myCurrentGroupId = null;

// 👥 멀티플레이 대기실 (학생용) - 조가 편성되면 자기 조만 보임!
function renderLobbyGrid(players, showId = false) {
  const gridContainer = document.getElementById("lobby-grid-container");
  if (!gridContainer) return;
  
  gridContainer.innerHTML = "";
  players.forEach(p => {
    const box = document.createElement("div");
    box.style.cssText = "display:flex; flex-direction:column; align-items:center; background:rgba(255,255,255,0.9); padding:10px 5px; border-radius:15px; border:2px solid #ddd; position:relative;";
    
    const charFolder = p.character || availableCharacters[0] || "기본0(민준쌤)";
    const idText = showId ? `<br><span style="font-size:12px; color:#555;">${p.stdId} ${p.realName || ''}</span>` : '';
    
    box.innerHTML = `
      <div class="character-wrapper" style="position:relative; display:flex; justify-content:center; width:100%;">
        <div id="bubble-${p.stdId}" class="chat-bubble" style="position:absolute; bottom:60px; background:#fff; border:2px solid #2196F3; padding:6px 10px; border-radius:12px; font-size:12px; font-weight:bold; color:#333; display:none; white-space:nowrap; z-index:100; box-shadow:0 3px 5px rgba(0,0,0,0.1);"></div>
        <img src="char/${charFolder}/stand1_0.png" class="anim-avatar" data-char-id="${charFolder}" style="height:60px;">
      </div>
      <span style="font-size:14px; font-weight:bold; margin-top:5px; color:#1976D2; text-align:center; line-height:1.2;">${p.nickname}${idText}</span>
    `;
    gridContainer.appendChild(box);
  });
}

// 👨‍🏫 교사 전용 실시간 모니터링 렌더러 (조편성 유무에 따라 자동 분할)
function renderTeacherVisualLobby(players) {
  const container = document.getElementById("teacher-visual-lobby-grid");
  if (!container) return;
  container.innerHTML = "";
  
  if (currentGroupingActive) {
    // 🚀 조편성이 되어있으면 조별로 박스를 나눠서 렌더링
    let maxGroup = 0;
    players.forEach(p => { if(p.groupId > maxGroup) maxGroup = p.groupId; });
    
    for(let i = 1; i <= maxGroup; i++) {
       const gPlayers = players.filter(p => p.groupId === i);
       if(gPlayers.length === 0) continue;
       
       const gDiv = document.createElement("div");
       gDiv.style.cssText = "background: rgba(255,255,255,0.7); border: 3px solid #FF9800; border-radius: 12px; padding: 15px; margin-bottom: 10px; width: 100%; box-sizing:border-box;";
       gDiv.innerHTML = `<h3 style="margin-top:0; color:#F57C00; border-bottom:2px dashed #FFCC80; padding-bottom:5px;">${i}조 (${gPlayers.length}명)</h3>`;
       
       const gGrid = document.createElement("div");
       gGrid.style.cssText = "display: flex; flex-wrap: wrap; gap: 10px; margin-top: 10px;";
       
       gPlayers.forEach(p => { gGrid.innerHTML += getTeacherPlayerHtml(p); });
       gDiv.appendChild(gGrid);
       container.appendChild(gDiv);
    }
  } else {
    // 🚀 조편성이 안되어있으면 한 통에 전부 다 렌더링
    const gGrid = document.createElement("div");
    gGrid.style.cssText = "display: flex; flex-wrap: wrap; gap: 10px;";
    players.forEach(p => { gGrid.innerHTML += getTeacherPlayerHtml(p); });
    container.appendChild(gGrid);
  }
}

// 🚀 학번/이름 가리기 토글 상태 변수 및 이벤트
let isTeacherNameHidden = false;

bindClick("teacher-toggle-name-btn", () => {
    playSound("click");
    isTeacherNameHidden = !isTeacherNameHidden;
    const btn = document.getElementById("teacher-toggle-name-btn");
    if (isTeacherNameHidden) {
        btn.innerText = "👀 학번/이름 보이기";
        btn.style.backgroundColor = "#8BC34A";
        btn.style.boxShadow = "0 4px 0 #689F38";
    } else {
        btn.innerText = "🙈 학번/이름 숨기기";
        btn.style.backgroundColor = "#607D8B";
        btn.style.boxShadow = "0 4px 0 #455A64";
    }
    // 버튼을 누르는 즉시 화면 리렌더링 강제 호출
    if (window.teacherLobbyStatus === "playing") {
        renderTeacherLiveLeaderboard(window.globalLobbyPlayers);
    } else {
        renderTeacherVisualLobby(window.globalLobbyPlayers);
    }
});

// 교사용 미니 캐릭터 카드 HTML (크기 확대 및 🚨유령 강퇴 기능 탑재)
function getTeacherPlayerHtml(p) {
  const charFolder = p.character || "기본0(민준쌤)";
  const nameHtml = isTeacherNameHidden ? "" : `<br><span style="font-size:13px; color:#777;">${p.stdId} ${p.realName || ''}</span>`;
  
  return `
    <div class="character-wrapper" onclick="if(typeof kickPlayer === 'function') kickPlayer('${p.docId}', '${p.nickname}')" style="position:relative; display:flex; flex-direction:column; align-items:center; background:#fff; padding:12px; border-radius:15px; border:3px solid #eee; width: 120px; box-shadow: 0 4px 8px rgba(0,0,0,0.05); cursor:pointer; transition: transform 0.1s;">
      <div id="teacher-bubble-${p.stdId}" class="chat-bubble" style="position:absolute; bottom:85px; background:#fff; border:2px solid #9C27B0; padding:6px 10px; border-radius:10px; font-size:12px; font-weight:bold; color:#333; display:none; white-space:nowrap; z-index:100; box-shadow:0 3px 6px rgba(0,0,0,0.15);"></div>
      <img src="char/${charFolder}/stand1_0.png" class="anim-avatar" data-char-id="${charFolder}" style="height:70px;" title="클릭하면 대기실에서 내보냅니다.">
      <span style="font-size:15px; font-weight:bold; margin-top:8px; color:#333; text-align:center; line-height:1.3;">${p.nickname}${nameHtml}</span>
    </div>
  `;
}

// 💬 채팅 말풍선 띄우기 (학생용 & 교사용 동시 처리)
let bubbleTimeouts = {};
function showChatBubble(stdId, text) {
  // 학생 뷰어용 버블
  const bubble = document.getElementById(`bubble-${stdId}`);
  if(bubble) {
    bubble.innerText = text; bubble.style.display = "block";
    bubble.classList.remove("fadeIn"); void bubble.offsetWidth; bubble.classList.add("fadeIn");
    if(bubbleTimeouts[`std-${stdId}`]) clearTimeout(bubbleTimeouts[`std-${stdId}`]);
    bubbleTimeouts[`std-${stdId}`] = setTimeout(() => { bubble.style.display = "none"; }, 3000);
  }
  // 교사 뷰어용 버블
  const tBubble = document.getElementById(`teacher-bubble-${stdId}`);
  if(tBubble) {
    tBubble.innerText = text; tBubble.style.display = "block";
    tBubble.classList.remove("fadeIn"); void tBubble.offsetWidth; tBubble.classList.add("fadeIn");
    if(bubbleTimeouts[`tch-${stdId}`]) clearTimeout(bubbleTimeouts[`tch-${stdId}`]);
    bubbleTimeouts[`tch-${stdId}`] = setTimeout(() => { tBubble.style.display = "none"; }, 3000);
  }
}

bindClick("go-char-shop-btn", () => { playSound("click"); renderCharShopList(); showScreen("char-shop-screen"); });
bindClick("char-shop-back-btn", () => { playSound("click"); showScreen("login-screen"); });

// 🌟 배경 걸어다니는 이모지 시스템 (슈퍼마리오 물리엔진)
const walkingEmojisList = ["🐶", "🐱", "🐭", "🐹", "🐰", "🦊", "🐻", "🐼", "🐨", "🐯", "🦁", "🐮", "🐷", "🐸", "🐵", "🐧", "🐤", "🦆", "🦉", "🦇", "🐺", "🐢", "🐍", "🦖", "🐙", "🦑", "🦀", "🐠", "🐬", "🐳", "🦈", "🐅", "🦓", "🦍", "🐘", "🐫", "🦒", "🦘", "🐎", "🐏", "🐐", "🦌", "🐕", "🐈", "🦚", "🕊", "🐿", "🦔", "🚶", "🏃", "💃", "🕺"];
let walkingEmojis = [];

// 🌟 배경 걸어다니는 이모지 시스템 (슈퍼마리오 물리엔진 - 🚀 GPU 가속 최적화 완료)
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
    let baseVx = (Math.random() * 0.8 + 0.4) * (Math.random() < 0.5 ? 1 : -1); 
    let vy = 0; 
    
    // 🚀 left, bottom을 고정하고 will-change: transform을 주어 그래픽카드(GPU)에게 렌더링을 완전히 맡깁니다.
    el.style.cssText = `position:absolute; bottom:0px; left:0px; font-size:${size}px; opacity: 0.8; filter: drop-shadow(0px 5px 5px rgba(0,0,0,0.3)); user-select:none; will-change: transform;`;
    container.appendChild(el);
    walkingEmojis.push({ el, x, y, baseVx, vy, size });
  }

  function animateEmojis() {
    // 🚀 [CPU/메모리 구원] 게임 화면일 때는 배경 이모지 물리엔진 연산을 완전히 멈춤! (크롬북 뻗음 방지)
    const container = document.getElementById("walking-emoji-container");
    if (container && container.style.opacity === "0") {
      requestAnimationFrame(animateEmojis);
      return;
    }
    const w = window.innerWidth;
    let speedScale = Math.max(0.4, w / 1000); 

    walkingEmojis.forEach(e => {
      let currentVx = e.baseVx * speedScale;
      if (e.y > 0) e.vy -= 0.6; 
      e.x += currentVx;
      e.y += e.vy;
      
      if (e.y <= 0) {
        e.y = 0; e.vy = 0;
        if (Math.random() < 0.003) e.vy = Math.random() * 4 + 7; 
      }
      
      if (e.x > w - e.size) { e.x = w - e.size; e.baseVx *= -1; } 
      else if (e.x < 0) { e.x = 0; e.baseVx *= -1; }
      
      let wobble = 0;
      if (e.y === 0) wobble = Math.abs(Math.sin(Date.now() / 150)) * 6; 
      
      const dir = e.baseVx > 0 ? 1 : -1;
      // 🚀 CSS의 left, bottom 글씨를 바꾸는 대신, 3D 공간상에서 이미지를 쓱 밀어버리도록 변경 (렉 0%)
      e.el.style.transform = `translate3d(${e.x}px, ${-(e.y + wobble)}px, 0) scaleX(${dir})`;
    });
    requestAnimationFrame(animateEmojis);
  }
  animateEmojis();
}
initWalkingEmojis();

function resetGameStates() {
  // 🚀 [멀티 자물쇠 완전 해제] 게임 초기화 시 상태를 깨끗이 비워줍니다.
  window.isMultiGameActive = false; 
  if (typeof window.isCountdownActive !== 'undefined') window.isCountdownActive = false;
  // 🚀 [관전자 영구 암전 방지] 대기실로 돌아갈 때 모든 방해 레이어 강제 철거!
  ["group-blocker-overlay", "sq-penalty-overlay", "treasure-overlay", "buff-msg-overlay", "multi-target-modal", "multi-blind-overlay"].forEach(id => {
      const el = document.getElementById(id);
          if (el) el.style.display = "none";
      });

      clearInterval(gameTimerInterval); clearInterval(cdInterval); 
      if (typeof chunkTimeout !== "undefined") clearTimeout(chunkTimeout); // 🚀 청크 유령 타이머도 확실히 파괴!
      isFishing = false; isGamePaused = false; gameScore = 0; globalScoreMultiplier = 1; currentUser.caughtEmojis = "";
      
      lastSyncedScore = -1; lastSyncedItems = null;
  
// 🚀 [0점 증발 버그 완벽 픽스!] 
  // 학생 폰이 너무 성급하게 0점으로 지워버리던 치명적인 코드를 수정했습니다!
  // 이제 0점이 아니라, "방금까지 딴 진짜 최종 점수"를 서버에 한 번 더 확실하게 쐐기를 박고 끝냅니다.
  if (myLobbyDocId) {
      setDoc(doc(db, "lobbyUsers", myLobbyDocId), { score: currentUser.score || 0, items: "", createdCount: 0, isSubmitted: false }, { merge: true }).catch(e=>e);
  }
  
  // 🚀 문제 만들기 상태 초기화
  myCreatedProblems = []; currentEditingSlot = -1;
  const submitBtn = document.getElementById("create-submit-btn"); if(submitBtn) submitBtn.style.display = "none";
}

bindClick("close-modal-btn", () => { document.getElementById("unknown-modal").style.display = "none"; });
// 🚀 1. 게임 도중 좌상단 '메뉴' 버튼 (유령 플레이어 생성 완벽 방지)
bindClick("back-to-menu-btn", async () => { 
  playSound("click"); 
  document.getElementById("top-left-controls").style.display = "none"; 
  document.getElementById("unknown-modal").style.display = "none"; 
  resetGameStates(); 
  
  if (myLobbyDocId) {
      // 멀티플레이 중 나갈 경우 서버에서 내 데이터를 완벽히 지우고 로비 선택창으로!
      await exitLobby();
      showScreen("lobby-mode-screen");
  } else {
      showScreen("menu-screen"); 
  }
});

// 🚀 2. 결과 화면의 '돌아가기' 버튼 (멀티 대기실 안전 복귀)
bindClick("home-btn", () => { 
  playSound("click"); 
  if (myLobbyDocId) {
      showScreen("multi-lobby-screen");
  } else {
      showScreen("menu-screen"); 
  }
});

// ==========================================
// 6. 로그인, DB 로드 (강력한 안정성 패치!)
// ==========================================
async function loadAllFromDB() {
  let maxRetries = 3; 
  let success = false;

  for (let i = 0; i < maxRetries; i++) {
    try {
      const setSnap = await getDoc(doc(db, "gameData", "wordSets")); 
      if (setSnap.exists()) {
        wordSets = setSnap.data().sets || [];
        localStorage.setItem("backup_wordSets", JSON.stringify(wordSets)); 
      }
      
      const stdSnap = await getDoc(doc(db, "gameData", "students")); 
      if (stdSnap.exists()) {
        studentList = stdSnap.data().students || [];
        localStorage.setItem("backup_studentList", JSON.stringify(studentList)); 
      }
      
      success = true; 
      break; 

    } catch (error) { 
      console.warn(`DB 연결 실패 (재시도 ${i+1}/${maxRetries}):`, error);
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  if (!success) {
    console.error("서버 통신 완전 실패, 내장 백업 데이터를 확인합니다.");
    const backupSets = localStorage.getItem("backup_wordSets");
    const backupStds = localStorage.getItem("backup_studentList");

    if (backupSets && backupStds) {
      wordSets = JSON.parse(backupSets);
      studentList = JSON.parse(backupStds);
      success = true; 
    }
  }

  if (success) {
    showScreen("auth-screen"); 
  } else {
    const loadingScreen = document.getElementById("loading-screen");
    if(loadingScreen) loadingScreen.innerHTML = `
      <h2 style="color:#f44336;">서버 연결 실패 ㅠㅠ</h2>
      <p style="color:#fff;">학교 네트워크 접속이 원활하지 않습니다.</p>
      <button onclick="location.reload()" style="padding: 12px 25px; font-size: 20px; font-weight: bold; background-color: #FFC107; border: none; border-radius: 10px; cursor: pointer; margin-top: 20px;">🔄 다시 시도하기</button>
    `;
  }
}
loadAllFromDB(); 

// 🚀 [1/4] 학생 인증 시 서버에서 내 JR과 캐릭터 정보 불러오기
// 🚀 [1/2] 학생 인증 시 서버에서 정보 불러오고 출석/수익 보상 "즉시" 지급!
bindClick("auth-btn", async () => {
  playSound("click");
  const inputId = document.getElementById("auth-id").value.trim();
  const inputName = document.getElementById("auth-name").value.trim();

  if(!inputId || !inputName) return alert("학번과 이름을 모두 적어주세요!");
  const matchedStudent = studentList.find(s => s.stdId === inputId && s.name === inputName);
  
  if (matchedStudent) {
    currentUser.stdId = inputId; currentUser.realName = inputName; currentUser.classId = inputId.substring(0, 2); 
    
    // 로딩 화면 띄우기
    showScreen("loading-screen"); 
    document.querySelector("#loading-screen h2").innerText = "프로필 정보를 불러오는 중...";

    // 서버(users 컬렉션)에서 내 정보 가져오기
    const userDoc = await getDoc(doc(db, "users", inputId));
    if (userDoc.exists()) {
        const d = userDoc.data();
        currentUser.jr = d.jr || 0;
        currentUser.ownedCharacters = d.ownedCharacters || ["기본0(민준쌤)"];
        currentUser.character = d.character || availableCharacters[0];
        currentUser.nickname = d.nickname || "";
        currentUser.lastLoginDate = d.lastLoginDate || "";
    } else {
        // 처음 접속하는 학생 초기 세팅
        currentUser.jr = 0;
        currentUser.ownedCharacters = ["기본0(민준쌤)"];
        currentUser.character = availableCharacters[0];
        currentUser.lastLoginDate = "";
    }

    // 1️⃣ 출석체크 로직 (로그인 화면 진입 전에 즉시 지급)
    const todayStr = new Date().toLocaleDateString("ko-KR", { timeZone: "Asia/Seoul" });
    let isFirstLogin = (currentUser.lastLoginDate !== todayStr);

    if (isFirstLogin) {
       currentUser.jr += 1000;
       currentUser.lastLoginDate = todayStr;
       setTimeout(() => {
          showBuffMsg("🎉 출석 보상 🎉", "오늘의 접속 보상 1000 JR 획득!", 76, 175, 80);
          fireConfetti();
       }, 500);
    }

    // 2️⃣ 로열티(수익) 확인: 내가 만든 캐릭터가 팔렸는지 검사
    const royaltySnap = await getDocs(collection(db, "royalties"));
    let totalRoyalty = 0;
    let buyersList = [];

    royaltySnap.forEach(docSnap => {
        const data = docSnap.data();
        if (data.creatorName === currentUser.realName && data.isClaimed === false) {
            totalRoyalty += data.amount;
            buyersList.push(`${data.buyerId} ${data.buyerName} 학생`);
            // 수익금 수령 완료 처리
            setDoc(docSnap.ref, { isClaimed: true }, { merge: true }); 
        }
    });

    if (totalRoyalty > 0) {
        currentUser.jr += totalRoyalty;
        setTimeout(() => {
            alert(`💰 캐릭터 판매 수익 도착! 💰\n\n${buyersList.join("\n")}\n...이(가) 당신의 캐릭터를 샀습니다!\n\n총 ${totalRoyalty} JR 이 입금되었습니다!`);
            const jrDisp = document.getElementById("user-jr-display");
            if(jrDisp) jrDisp.innerText = currentUser.jr;
        }, 3500); 
    }

    // 내 최종 정보를 DB에 영구 저장 (보상 받은 내용 반영)
    await setDoc(doc(db, "users", currentUser.stdId), {
       stdId: currentUser.stdId,
       realName: currentUser.realName,
       nickname: currentUser.nickname,
       character: currentUser.character,
       jr: currentUser.jr,
       ownedCharacters: currentUser.ownedCharacters,
       lastLoginDate: currentUser.lastLoginDate
    }, { merge: true });

    // 로그인 창에 현재 내 JR 잔액 띄우기 (이제 값이 보입니다!)
    const jrDisp = document.getElementById("user-jr-display");
    if(jrDisp) jrDisp.innerText = currentUser.jr;
    if(currentUser.nickname) document.getElementById("nickname").value = currentUser.nickname;

    showScreen("login-screen");
  } else { alert("데이터베이스에 없는 학번이거나 이름이 틀렸습니다! 선생님께 문의하세요."); }
});

// 🚀 [2/2] 게임 시작 버튼 (단순히 화면 넘어가기 + DB 닉네임/캐릭터 갱신만 수행)
bindClick("login-btn", async () => {
  playSound("click");
  const nick = document.getElementById("nickname").value.trim();
  if (!nick) return alert("나만의 닉네임을 입력해 주세요!");
  
  currentUser.nickname = nick;
  document.getElementById("user-display").innerText = currentUser.nickname;
  
  const avatarDisp = document.getElementById("user-avatar-display");
  if(avatarDisp) {
    avatarDisp.innerHTML = getAvatarHtml(currentUser.character, "80px");
  }

  // 이름/캐릭터 바뀐 내용만 저장
  await setDoc(doc(db, "users", currentUser.stdId), {
     nickname: currentUser.nickname,
     character: currentUser.character
  }, { merge: true });

  if (wordSets.length === 0) return alert("현재 등록된 학습 세트가 없습니다! 관리자 설정에서 세트를 만들어주세요.");
  showScreen("lobby-mode-screen");
});

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
  // 🚀 특수 세트는 철저히 걸러냅니다!
  const normalSets = wordSets.filter(s => !s.isCustomSet);
  normalSets.forEach(set => {
    const btn = document.createElement("button"); 
    btn.style.width = "100%"; btn.style.margin = "0"; 
    
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

bindClick("set-select-back-btn", () => { playSound("click"); showScreen("login-screen"); }); // 🚀 프로필 설정창으로 리턴!
bindClick("menu-go-back-set-btn", () => { playSound("click"); showScreen("set-select-screen"); });

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
bindClick("admin-reset-jr-btn", async () => {
    playSound("click");
    if (confirm("정말 모든 학생의 JR을 0으로 만들고, 구매한 캐릭터를 모두 몰수하시겠습니까?\n(새 학기나 대규모 이벤트 리셋용)")) {
        const pwd = prompt("초기화를 진행하려면 관리자 비밀번호 4자리를 입력하세요.");
        if (pwd === "1234") {
            showScreen("loading-screen");
            document.querySelector("#loading-screen h2").innerText = "전체 학생 재화 초기화 중...";
            try {
                const snap = await getDocs(collection(db, "users"));
                const promises = [];
                snap.forEach(d => {
                    promises.push(setDoc(doc(db, "users", d.id), { 
                        jr: 0, 
                        ownedCharacters: ["기본0(민준쌤)"], 
                        character: "기본0(민준쌤)" 
                    }, { merge: true }));
                });
                await Promise.all(promises);
                alert("✅ 모든 학생의 JR과 캐릭터가 성공적으로 0으로 초기화되었습니다!");
            } catch(e) {
                alert("초기화 중 오류가 발생했습니다.");
                console.error(e);
            }
            showScreen("admin-student-screen");
        } else if (pwd !== null) {
            alert("비밀번호가 틀렸습니다!");
        }
    }
});
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
    fList.sort((a,b) => b.timestamp - a.timestamp); 
    
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
          <div style="font-weight:bold; margin-bottom:5px;">${f.nickname} <span style="font-size:12px; font-weight:normal; color:#666;">(${f.stdId})</span></div>
          <div style="font-size:16px; color:#333; line-height:1.4;">${f.text}</div>
        </div>
      `;
    });
  } catch(e) {
    listEl.innerHTML = "<p>에러가 발생했습니다.</p>";
  }
}

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

// 🚀 [타이머 폭주 방지용 글로벌 자물쇠]
window.isCountdownActive = false; 

function startCountdown(minutes, screenId, logicCallback) {
  // 🚀 [안전 방어막] 혹시라도 시간 데이터가 깨지거나 누락되면 강제로 3분 분량을 확보하여 즉시 종료를 막습니다!
  const validMinutes = parseInt(minutes) || 3; 

  if (typeof gameTimerInterval !== 'undefined') clearInterval(gameTimerInterval); 
  if (typeof cdInterval !== 'undefined') clearInterval(cdInterval);
  if (window.cdInterval) clearInterval(window.cdInterval);
  
  isGamePaused = false; 
  showScreen(screenId); 
  document.getElementById("top-left-controls").style.display = "flex";
  
  // 🚀 [뒤로가기 증발 패치] 멀티플레이 학생용 화면에서는 뒤로가기 버튼을 완벽히 지웁니다.
  const inGameBackBtn = document.getElementById("back-to-menu-btn");
  if (inGameBackBtn) {
      inGameBackBtn.style.display = (typeof myLobbyDocId !== 'undefined' && myLobbyDocId) ? "none" : "block";
  }

  const overlay = document.getElementById("game-countdown-overlay"); 
  const textEl = document.getElementById("countdown-text");
  overlay.style.display = "flex"; 
  
  gameTimeRemaining = validMinutes * 60; 
  gameScore = 0; 
  globalScoreMultiplier = 1;
  
  const p1 = document.getElementById("pile-double_current"); if(p1) p1.innerHTML = ""; 
  const p2 = document.getElementById("pile-half_current"); if(p2) p2.innerHTML = ""; 
  const p3 = document.getElementById("pile-double_future"); if(p3) p3.innerHTML = ""; 
  
  let count = 5; 
  textEl.innerText = count;
  window.cdInterval = setInterval(() => {
    count--;
    if (count > 0) { 
        playSound("click"); textEl.style.animation = "none"; void textEl.offsetWidth; textEl.style.animation = null; textEl.innerText = count; 
    } else { 
        clearInterval(window.cdInterval); 
        overlay.style.display = "none"; 
        playSound("success"); 
        lastMatchTime = Date.now(); 
        logicCallback(); 
    }
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
  if (myLobbyDocId && window.multiUseBuffItems === false) {
      callback();
      return;
  }
  
  isGamePaused = true; playSound("treasure");
  const overlay = document.getElementById("treasure-overlay"); overlay.style.display = "flex";
  const chests = document.querySelectorAll(".treasure-chest");
  
  chests.forEach(chest => {
    chest.onclick = () => {
      chests.forEach(c => c.onclick = null);

      playSound("click"); chest.classList.add("chest-explode");

      // 🚀 [초강력 멈춤 방지 픽스] 
      // 서버에서 점수를 가져오라고 명령만 던져놓고, "절대 기다리지 않음(No Await)!"
      // 와이파이가 느려서 못 가져오면 그냥 옛날 점수 띄우고 게임은 무조건 진행시킴!
      if (myLobbyDocId && multiUseSpecialItems && typeof openTargetSelectionModal === "function") {
          getDocs(collection(db, "lobbyUsers")).then(snap => {
              let freshPlayers = [];
              snap.forEach(d => freshPlayers.push({ docId: d.id, ...d.data() }));
              window.globalLobbyPlayers = freshPlayers; 
          }).catch(e => console.error("점수 로딩 지연(무시됨)"));
      }

      // 무조건 0.4초 뒤에 상자 닫고 게임 재개 (절대 멈추지 않음)
      setTimeout(() => { 
        overlay.style.display = "none"; chest.classList.remove("chest-explode");
        
        if (myLobbyDocId && multiUseSpecialItems && typeof openTargetSelectionModal === "function") {
          let multiItemType = Math.floor(Math.random() * 5); 
          if (multiItemType === 0) { openTargetSelectionModal("swap", "🔄 점수 뒤바꾸기 공격!", "점수를 강제로 맞교환할 타겟을 선택하세요.", callback); } 
          else if (multiItemType === 1) { openTargetSelectionModal("steal50", "💥 점수 50% 강탈 공격!", "점수의 절반을 내 점수로 뺏어올 대상을 고르세요.", callback); } 
          else if (multiItemType === 2) { openTargetSelectionModal("blind", "🕶️ 3초 화면 암전 블라인드 공격!", "화면을 3초간 암전시켜 방해할 대상을 고르세요.", callback); } 
          else { executeNormalTreasureEffect(Math.floor(Math.random() * 2) === 0 ? 0 : 2, callback); }
        } else {
          executeNormalTreasureEffect(Math.floor(Math.random() * 3), callback);
        }
      }, 400); 
    };
  });
}
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
  // 🚀 [초긴급 픽스] 무한 퀴즈 모드에서도 아이템/공격 점수 새로고침이 작동하도록 추가!!
  else if(currentGameMode === "custom_infinite") updateCiUI(); 
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

// (여기는 기존 깜빡이 학습과 실시간 낚시 엔진 로직이 수정 없이 그대로 안정되게 유지됩니다...)
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
// 씬 2: 메모리 게임
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
// 씬 3: 스피드 짝맞추기 (멀티 지원 업데이트 버전)
// ==========================================
let smRound = 1; let smPairsFound = 0; let smSelected = []; 
function updateSpeedMatchUI() {
  const m = String(Math.floor(gameTimeRemaining / 60)).padStart(2, "0"); const s = String(gameTimeRemaining % 60).padStart(2, "0");
  document.getElementById("sm-timer").innerText = `🕒 ${m}:${s}`; 
  // 🚀 픽스: 멀티플레이어 조별 점수 합산 텍스트 반영
  document.getElementById("sm-score").innerHTML = `점수: ${gameScore}${getGroupScoreText()}`; 
  // 🚀 쿨타임 동기화 엔진 연결
  if (currentGameMode === "speed-match") window.syncScoreToServer();
}
function startSpeedMatchLogic() {
  smRound = 1; updateSpeedMatchUI();
  gameTimerInterval = setInterval(() => {
    if (globalMultiEndTime) {
       gameTimeRemaining = Math.max(0, Math.floor((globalMultiEndTime - Date.now()) / 1000));
       updateSpeedMatchUI();
       if (gameTimeRemaining <= 0) { clearInterval(gameTimerInterval); currentUser.score = gameScore; document.getElementById("result-detail").innerText = `제한 시간 종료! 획득한 점수입니다!`; goResult(); }
    } else {
       if (!isGamePaused) { 
         gameTimeRemaining--; updateSpeedMatchUI(); 
         if (gameTimeRemaining <= 0) { clearInterval(gameTimerInterval); currentUser.score = gameScore; document.getElementById("result-detail").innerText = `제한 시간 종료! 획득한 점수입니다!`; goResult(); } 
       }
    }
  }, 500); 
  loadSpeedMatchRound();
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
    if (smSelected.length === 2) { isGamePaused = true; checkSmMatch(); }
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
    if (Math.random() < 0.3) triggerTreasureEvent(() => { checkSmRoundEnd(); isGamePaused = false; }); else { checkSmRoundEnd(); isGamePaused = false; }
  } else { 
    playSound("wrong"); let penalty = calcSpeedBonus(); gameScore -= penalty; updateSpeedMatchUI(); showBuffMsg("오답!", `-${penalty}점 ㅠㅠ`, 244, 67, 54);
    c1.el.classList.add("wrong"); c2.el.classList.add("wrong");
    setTimeout(() => { c1.el.classList.remove("selected", "wrong"); c2.el.classList.remove("selected", "wrong"); smSelected = []; updateSmSideAvailability(); isGamePaused = false; }, 400); 
  }
}
function checkSmRoundEnd() { if (smPairsFound === 4) { smRound++; setTimeout(loadSpeedMatchRound, 500); } }
// 🚀 학생 인게임 UI 조별 점수 합산 텍스트 생성 엔진
// 🚀 학생 인게임 UI 조별 점수 합산 텍스트 생성 엔진 (다이어트 패치 적용)
// 🚀 학생 인게임 UI 조별 점수 합산 텍스트 생성 엔진 (다이어트 패치 적용)
function getGroupScoreText() {
    if (currentGroupingActive && currentMultiRoomGroupPlayMode === "all-sum" && myCurrentGroupId) {
        return ` <span style="font-size:16px; color:#E91E63; text-shadow:1px 1px 0px #fff;">(조 점수는 앞화면 참조!)</span>`;
    }
    return "";
}

// 🚀 [네트워크 다이어트] 점수 동기화 2초 쿨타임 엔진 (학교 와이파이 마비 방지)
let syncScoreTimeout = null;
window.syncScoreToServer = function() {
    if (!myLobbyDocId) return;
    let currentBuffs = ""; if (globalScoreMultiplier > 1) currentBuffs += "🟡"; 
    if (gameScore !== lastSyncedScore || currentBuffs !== lastSyncedItems) {
        if (syncScoreTimeout) return; // 이미 2초 대기열에 있으면 무시하고 스킵!
        syncScoreTimeout = setTimeout(() => {
            setDoc(doc(db, "lobbyUsers", myLobbyDocId), { score: gameScore, items: currentBuffs }, { merge: true }).catch(e => e);
            lastSyncedScore = gameScore; lastSyncedItems = currentBuffs;
            syncScoreTimeout = null;
        }, 2000);
    }
};

// ==========================================
// 씬 4: 심플 스피드 퀴즈
// ==========================================
let sqCurrentWord = null;

function updateSpeedUI() {
  const m = String(Math.floor(gameTimeRemaining / 60)).padStart(2, "0"); const s = String(gameTimeRemaining % 60).padStart(2, "0");
  document.getElementById("speed-timer").innerText = `🕒 ${m}:${s}`; 
  
  // 🌟 보스전일 때는 데미지로, 일반 게임일 때는 점수로 글자가 바뀝니다!
  if (typeof isBossRaid !== "undefined" && isBossRaid) {
      document.getElementById("speed-score").innerHTML = `내 총 데미지: ${gameScore}`; 
  } else {
      document.getElementById("speed-score").innerHTML = `점수: ${gameScore}${getGroupScoreText()}`; 
  }
  
  if (currentGameMode === "speed" || currentGameMode === "boss") window.syncScoreToServer();
}
function startSpeedLogic() {
  updateSpeedUI();
  gameTimerInterval = setInterval(() => {
    if (globalMultiEndTime) {
       gameTimeRemaining = Math.max(0, Math.floor((globalMultiEndTime - Date.now()) / 1000));
       updateSpeedUI();
       if (gameTimeRemaining <= 0) { clearInterval(gameTimerInterval); currentUser.score = gameScore; document.getElementById("result-detail").innerText = `제한 시간 종료! 획득한 퀴즈 점수입니다!`; goResult(); }
    } else {
       if (!isGamePaused) {
         gameTimeRemaining--; updateSpeedUI();
         if (gameTimeRemaining <= 0) { clearInterval(gameTimerInterval); currentUser.score = gameScore; document.getElementById("result-detail").innerText = `제한 시간 종료! 획득한 퀴즈 점수입니다!`; goResult(); }
       }
    }
  }, 500); 
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
        // 🚀 픽스: Pcd라는 독립 타이머 대신 cdInterval을 사용하여 게임 종료 시 완벽히 소각되도록 수정!
        clearInterval(cdInterval);
        cdInterval = setInterval(() => { count--; if(count > 0) { document.getElementById("sq-countdown").innerText = count; playSound("click"); } else { clearInterval(cdInterval); penaltyOverlay.style.display = "none"; isGamePaused = false; loadNextSpeedQuiz(); } }, 1000);
      }
    };
  });
}

// ==========================================
// 씬 5: 이모지 낚시하기 게임
// ==========================================
let fishCards = []; let fishSelected = []; let fishEmojisCaught = 0; let lastFrameTime = 0; let caughtEmojisList = [];
const fishPond = document.getElementById("fish-pond");
const fallbackEmojis = ["🐠", "🐟", "🐡", "🐙", "🦑", "🦐", "🦀", "🐳", "🐋", "🐬"];

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
  let el = document.createElement("div"); el.className = "fish-card pop-in"; let emoji = fallbackEmojis[Math.floor(Math.random() * fallbackEmojis.length)]; let fontSize = text.length > 20 ? "11px" : text.length > 10 ? "13px" : "15px";
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
// 9. 결과, 피드백 전송 및 랭킹
// ==========================================
// 🚀 [3/4] 결과 화면: 멀티플레이 2초 대기 동기화 및 획득 JR 정산

// 🚀 [3/4] 결과 화면: 멀티플레이 2초 대기 동기화 및 획득 JR 정산
// 🚀 [3/4] 결과 화면: 멀티플레이 2초 대기 동기화 및 획득 JR 정산
async function goResult() {
  
  // 🚀 픽스: 게임 종료 시 열려있을 수 있는 '모든 방해 레이어(블라인드, 공격창 등)'를 강제로 즉시 소각! (먹통 100% 방지)
  ["group-blocker-overlay", "sq-penalty-overlay", "treasure-overlay", "buff-msg-overlay", "multi-target-modal", "multi-blind-overlay"].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.style.display = "none";
  });
  
  clearInterval(gameTimerInterval); clearInterval(cdInterval); isGamePaused = true; 
  document.getElementById("top-left-controls").style.display = "none"; 

  try {
    await addDoc(collection(db, "scores"), {
      stdId: currentUser.stdId, nickname: currentUser.nickname, emoji: currentUser.emoji, classId: currentUser.classId,
      score: currentUser.score, mode: currentGameMode, timestamp: Date.now(), setId: currentSetId, setTitle: currentSetTitle,
      groupId: currentGroupingActive ? myCurrentGroupId : null, groupPlayMode: currentGroupingActive ? currentMultiRoomGroupPlayMode : null
    });
  } catch(e) { console.error("점수 저장 실패:", e); }

let earnedJR = Math.floor(currentUser.score / 100);
  // 🚀 [인플레이션 방지 패치] 기본 보상은 무조건 최대 1000 JR까지만 지급!
  if (earnedJR > 1000) earnedJR = 1000; 
  
  let rankBonusJR = 0; let rankMsg = "";
  
  let finalDisplayScore = currentUser.score;
  let finalDisplayName = `${currentUser.nickname} 학생`;

  if (myLobbyDocId && (currentGameMode === "speed" || currentGameMode === "speed-match" || currentGameMode === "chunk" || currentGameMode === "custom_infinite")) {
    showScreen("loading-screen");
    document.querySelector("#loading-screen h2").innerText = "다른 친구들의 점수를 집계 중입니다...";
    document.querySelector("#loading-screen p").innerText = "잠시만 기다려주세요 (약 2초)";
    await new Promise(resolve => setTimeout(resolve, 2000)); 

    let allPlayers = [];
    if (currentGroupingActive && currentMultiRoomGroupPlayMode) {
        finalDisplayName = `${myCurrentGroupId}조`;
        let groupTotal = 0;
        
        try {
            const snap = await getDocs(collection(db, "lobbyUsers"));
            snap.forEach(d => {
                const dt = d.data();
                allPlayers.push(dt);
                if(dt.groupId === myCurrentGroupId) groupTotal += dt.score;
            });
            
            // 🚀 조별 순위 산정 및 보너스 (1~5등 1000점)
            let groupData = {};
            allPlayers.forEach(p => {
                if(p.groupId) {
                    if(!groupData[p.groupId]) groupData[p.groupId] = 0;
                    groupData[p.groupId] += p.score || 0;
                }
            });
            let sortedGroups = Object.keys(groupData).map(gId => ({ id: parseInt(gId), score: groupData[gId] })).sort((a,b) => b.score - a.score);
            let myRank = sortedGroups.findIndex(g => g.id === myCurrentGroupId) + 1;
            if (myRank >= 1 && myRank <= 5) {
                rankBonusJR = 1000; rankMsg = `\n(조 순위 ${myRank}위 달성 보너스 +1000!)`;
            }
        } catch(e) {
            console.warn("조별 점수 합산 중 통신 오류 (무시됨)", e);
            groupTotal = currentUser.score; 
        }
        
        finalDisplayScore = groupTotal;
        
        if (currentMultiRoomGroupPlayMode === "all-sum") {
            document.getElementById("result-detail").innerText = `(개인 기여 점수: ${currentUser.score}점)`;
        } else {
            document.getElementById("result-detail").innerText = `조 대표의 획득 점수입니다!`;
        }
    } else {
        // 🚀 개인전 순위 산정 및 보너스 (1~5등 1000점)
        try {
            const snap = await getDocs(collection(db, "lobbyUsers"));
            snap.forEach(d => allPlayers.push(d.data()));
            let sortedPlayers = allPlayers.sort((a,b) => (b.score || 0) - (a.score || 0));
            let myRank = sortedPlayers.findIndex(p => p.stdId === currentUser.stdId) + 1;
            if (myRank >= 1 && myRank <= 5) {
                rankBonusJR = 1000; rankMsg = `\n(개인 순위 ${myRank}위 보너스 +1000!)`;
            }
        } catch(e) { console.warn("개인전 랭킹 통신 오류", e); }
        
        document.getElementById("result-detail").innerText = `개인 획득 점수입니다.`;
    }
  }

  currentUser.jr += (earnedJR + rankBonusJR);
  if (currentUser.stdId) await setDoc(doc(db, "users", currentUser.stdId), { jr: currentUser.jr }, { merge: true });

  showScreen("result-screen");
  document.getElementById("praise-word").innerText = praises[Math.floor(Math.random() * praises.length)];
  document.getElementById("result-user").innerText = finalDisplayName;
  document.getElementById("final-score").innerText = finalDisplayScore;
  document.getElementById("result-caught-emojis").style.display = "none";
  playSound("success");

  setTimeout(() => { showBuffMsg("💰 보상 획득!", `게임 보상: +${earnedJR} JR${rankMsg}\n(현재 잔액: ${currentUser.jr} JR)`, 33, 150, 243); }, 800);
}

bindClick("go-feedback-btn", () => { playSound("click"); document.getElementById("feedback-text").value = ""; showScreen("feedback-screen"); });
bindClick("cancel-feedback-btn", () => { playSound("click"); showScreen("result-screen"); });

bindClick("submit-feedback-btn", async () => {
  playSound("click");
  const text = document.getElementById("feedback-text").value.trim();
  if(!text) return alert("의견을 적어주세요!");
  try {
    await addDoc(collection(db, "feedback"), {
      stdId: currentUser.stdId, nickname: currentUser.nickname, emoji: currentUser.emoji, text: text, timestamp: Date.now()
    });
    alert("소중한 의견 감사합니다!"); showScreen("result-screen");
  } catch(e) { alert("전송에 실패했습니다."); }
});

bindClick("go-ranking-btn", () => { playSound("click"); showRankings("today", currentGameMode); });
bindClick("tab-today", () => { playSound("click"); showRankings("today", currentRankingMode); });
bindClick("tab-class", () => { playSound("click"); showRankings("class", currentRankingMode); });
bindClick("tab-all", () => { playSound("click"); showRankings("all", currentRankingMode); });
// 🚀 3. 명예의 전당 화면의 '메뉴로 돌아가기' 버튼 (멀티 대기실 연동)
// 🚀 3. 명예의 전당 화면의 '메뉴로 돌아가기' 버튼 (교사/학생 완벽 분리 연동)
bindClick("ranking-home-btn", () => { 
  playSound("click"); 
  document.getElementById("confetti-canvas").style.display = "none"; 
  
  if (isTeacherMode) {
      showScreen("teacher-lobby-screen"); // 🚀 교사는 교사 대기실로 복귀!
  } else if (myLobbyDocId) {
      showScreen("multi-lobby-screen");
  } else {
      showScreen("menu-screen"); 
  }
});
async function showRankings(tab, mode = currentRankingMode) {
  currentRankingMode = mode; showScreen("ranking-screen");
  document.querySelectorAll(".rank-tab").forEach(btn => btn.classList.remove("active"));
  document.getElementById(`tab-${tab}`).classList.add("active");

  // 🚀 픽스: 무한 퀴즈 게임 이름 추가
  const modeNames = { "fc": "🃏 깜빡이 학습", "memory": "🔠 메모 게임", "speed-match": "🧩 스피드 짝맞추기", "speed": "⚡ 심플 스피드퀴즈", "fish": "🎣 이모지 낚시하기", "chunk": "🧩 문장 해석 게임", "custom_infinite": "♾️ 무한 퀴즈 게임", "boss_raid": "👹 보스 레이드 (타격 데미지)" };

  const quotes = ["Wanna try again? 🚀", "You're a star! ⭐", "Keep it up! 🔥", "Fantastic job! 🎉", "Challenge the top! 🏆"];
  document.getElementById("ranking-encourage").innerText = quotes[Math.floor(Math.random() * quotes.length)];
  document.getElementById("ranking-msg").innerText = `축하해요!! ${currentUser.nickname}님은 ${currentUser.score}점입니다!`;

  const listEl = document.getElementById("ranking-list"); listEl.innerHTML = "<div style='text-align:center; padding: 20px;'>순위를 불러오는 중...🔍</div>";

  try {
    const q = query(collection(db, "scores"), orderBy("timestamp", "desc"), limit(500));
    const qSnap = await getDocs(q);
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
        listEl.innerHTML += `<div class="rank-item"><div><span class="rank-medal">${medal}</span> ${s.nickname}</div><div style="color:#ff4081; font-weight:bold;">${s.score}점</div></div>`;
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
let chunkAnswers = []; let chunkLength = 0; let currentChunkIndex = 0;
let chunkTimeout = null; // 🚀 [무결성 픽스] 먹통 방지를 위한 전용 타이머 변수 설치!
function updateChunkUI() {
  const m = String(Math.floor(gameTimeRemaining / 60)).padStart(2, "0"); const s = String(gameTimeRemaining % 60).padStart(2, "0");
  document.getElementById("chunk-timer").innerText = `🕒 ${m}:${s}`; 
  
  // 🌟 보스전일 때는 데미지로, 일반 게임일 때는 점수로 글자가 바뀝니다!
  if (typeof isBossRaid !== "undefined" && isBossRaid) {
      document.getElementById("chunk-score").innerHTML = `내 총 데미지: ${gameScore}`; 
  } else {
      document.getElementById("chunk-score").innerHTML = `점수: ${gameScore}${getGroupScoreText()}`; 
  }
  
  if (currentGameMode === "chunk" || currentGameMode === "boss") window.syncScoreToServer();
}

function startChunkLogic() {
  const validChunkWords = wordList.filter(w => w.en.includes('/') && w.ko.includes('/'));
  if(validChunkWords.length === 0) { alert("현재 세트에는 슬래시(/)로 구분된 문장이 없습니다. 다른 세트를 선택해 주세요."); clearInterval(gameTimerInterval); showScreen("menu-screen"); return; }
  currentChunkIndex = 0; updateChunkUI();
  gameTimerInterval = setInterval(() => {
    if (globalMultiEndTime) {
       gameTimeRemaining = Math.max(0, Math.floor((globalMultiEndTime - Date.now()) / 1000)); updateChunkUI();
       if (gameTimeRemaining <= 0) { clearInterval(gameTimerInterval); currentUser.score = gameScore; document.getElementById("result-detail").innerText = `제한 시간 종료! 획득한 해석 점수입니다!`; goResult(); }
    } else {
       if (!isGamePaused) {
         gameTimeRemaining--; updateChunkUI();
         if (gameTimeRemaining <= 0) { clearInterval(gameTimerInterval); currentUser.score = gameScore; document.getElementById("result-detail").innerText = `제한 시간 종료! 획득한 해석 점수입니다!`; goResult(); }
       }
    }
  }, 500); 
  loadNextChunkQuiz(validChunkWords);
}
function loadNextChunkQuiz(validChunkWords) {
  const wordObj = validChunkWords[currentChunkIndex]; 
  let enParts = wordObj.en.split('/').map(s => s.trim()); let koParts = wordObj.ko.split('/').map(s => s.trim());
  chunkLength = Math.min(enParts.length, koParts.length); enParts = enParts.slice(0, chunkLength); koParts = koParts.slice(0, chunkLength);
  const container = document.getElementById("chunk-container"); const btnContainer = document.getElementById("chunk-buttons-container");
  container.innerHTML = ""; btnContainer.innerHTML = ""; chunkAnswers = new Array(chunkLength).fill(null);

  const pairsDiv = document.createElement("div"); pairsDiv.style.cssText = "display:flex; flex-wrap:wrap; justify-content:center; gap:8px; width:100%;";
  for(let i = 0; i < chunkLength; i++) {
    const pair = document.createElement("div"); pair.style.cssText = "display:flex; flex-direction:column; flex:1 1 auto; min-width:80px; max-width:45%;";
    const enDiv = document.createElement("div"); enDiv.className = "chunk-block sq-fly-in"; enDiv.innerText = enParts[i];
    const slotDiv = document.createElement("div"); slotDiv.className = "chunk-slot sq-fly-in"; slotDiv.id = `chunk-slot-${i}`;
    slotDiv.onclick = () => {
      if (isGamePaused) return;
      if (chunkAnswers[i] !== null) {
        playSound("pop"); document.getElementById(`chunk-btn-${chunkAnswers[i]}`).classList.remove("used");
        chunkAnswers[i] = null; slotDiv.innerText = ""; slotDiv.classList.remove("filled");
      }
    };
    pair.appendChild(enDiv); pair.appendChild(slotDiv); pairsDiv.appendChild(pair);
  }
  container.appendChild(pairsDiv);

  const shuffledIndices = Array.from({length: chunkLength}, (_, i) => i).sort(() => 0.5 - Math.random());
  shuffledIndices.forEach(origIdx => {
    const btn = document.createElement("button"); btn.className = "chunk-btn sq-fly-in"; btn.id = `chunk-btn-${origIdx}`; btn.innerText = koParts[origIdx];
    btn.onclick = () => {
      if (isGamePaused || btn.classList.contains("used")) return;
      playSound("pop"); const emptyIdx = chunkAnswers.indexOf(null);
      if (emptyIdx !== -1) {
        chunkAnswers[emptyIdx] = origIdx; const slot = document.getElementById(`chunk-slot-${emptyIdx}`);
        slot.innerText = koParts[origIdx]; slot.classList.add("filled"); btn.classList.add("used");
        if (!chunkAnswers.includes(null)) { checkChunkAnswer(validChunkWords); }
      }
    }; btnContainer.appendChild(btn);
  });
}
function checkChunkAnswer(validChunkWords) {
  isGamePaused = true; const isCorrect = chunkAnswers.every((val, idx) => val === idx);
  if (isCorrect) {
    playSound("success"); const earned = calcSpeedBonus() * 2; gameScore += earned; updateChunkUI(); showGamePraise(earned, "Perfect Match!", "#3F51B5");
    currentChunkIndex++; if (currentChunkIndex >= validChunkWords.length) { currentChunkIndex = 0; }
    if (Math.random() < 0.3) { triggerTreasureEvent(() => { isGamePaused = false; loadNextChunkQuiz(validChunkWords); }); } 
    else { 
        clearTimeout(chunkTimeout); // 🚀 기존 타이머 안전하게 삭제
        chunkTimeout = setTimeout(() => { isGamePaused = false; loadNextChunkQuiz(validChunkWords); }, 600); 
    }
  } else {
    playSound("wrong"); const penalty = Math.floor(calcSpeedBonus()); gameScore -= penalty; updateChunkUI(); showBuffMsg("오답!", `순서가 맞지 않아요\n-${penalty}점`, 244, 67, 54);
    for(let i = 0; i < chunkLength; i++) { document.getElementById(`chunk-slot-${i}`).classList.add("wrong"); }
    clearTimeout(chunkTimeout); // 🚀 기존 타이머 안전하게 삭제
    chunkTimeout = setTimeout(() => {
      for(let i = 0; i < chunkLength; i++) {
        const slot = document.getElementById(`chunk-slot-${i}`); 
        if (slot) { slot.classList.remove("wrong", "filled"); slot.innerText = ""; } // 보호막
        if (chunkAnswers[i] !== null) { 
            const btn = document.getElementById(`chunk-btn-${chunkAnswers[i]}`);
            if(btn) btn.classList.remove("used"); // 보호막
        }
      }
      chunkAnswers.fill(null); isGamePaused = false; // 🚀 안전하게 터치 잠금 해제!
    }, 600);
  }
}

// ==========================================
// 씬 7: 온라인 멀티플레이어 로비 로직
// ==========================================
bindClick("mode-solo-btn", () => { playSound("click"); renderSetSelectList(); showScreen("set-select-screen"); });
bindClick("mode-multi-student-btn", () => { playSound("click"); enterMultiLobbyAsStudent(); });
bindClick("mode-multi-teacher-btn", () => {
  playSound("click"); const pwd = prompt("교사용 대기실 비밀번호를 입력하세요.", "");
  if (pwd === "1234") { enterMultiLobbyAsTeacher(); } else if (pwd !== null) { alert("비밀번호가 틀렸습니다!"); }
});
bindClick("lobby-mode-back-btn", () => { playSound("click"); showScreen("login-screen"); });

async function enterMultiLobbyAsStudent() {
  showScreen("multi-lobby-screen");
  try {
    const docRef = await addDoc(collection(db, "lobbyUsers"), {
      stdId: currentUser.stdId, realName: currentUser.realName, nickname: currentUser.nickname, character: currentUser.character, emoji: currentUser.emoji, score: 0, items: "", attack: null, timestamp: Date.now()
    });
    myLobbyDocId = docRef.id;
    myLobbyListenerUnsubscribe = onSnapshot(doc(db, "lobbyUsers", myLobbyDocId), (docSnap) => {
if (!docSnap.exists()) {
          window.customAlert("선생님에 의해 대기실이 초기화되었습니다.");
          exitLobby();
          showScreen("lobby-mode-screen");
          return;
      }
      if (docSnap.data().attack) {
        const atk = docSnap.data().attack; handleIncomingAttack(atk);
        setDoc(doc(db, "lobbyUsers", myLobbyDocId), { attack: null }, { merge: true });
      }
    });
  } catch(e) { console.error("로비 입장 등록 실패:", e); }

  // 🚀 학생 대기실 유저/채팅 감시 켜기/끄기 헬퍼 함수
  window.toggleStudentLobbyListeners = function(turnOn) {
      if (turnOn) {
          if (!lobbyUsersUnsubscribe) {
              lobbyUsersUnsubscribe = onSnapshot(collection(db, "lobbyUsers"), (snapshot) => {
                  const countEl = document.getElementById("lobby-user-count");
                  let players = []; let count = 0;
                  snapshot.forEach((doc) => {
                    const p = { docId: doc.id, ...doc.data() };
                    players.push(p); count++;
                    if (p.stdId === currentUser.stdId) myCurrentGroupId = p.groupId;
                  }); 
                  window.globalLobbyPlayers = players; 
                  if(countEl) countEl.innerText = count;

                  const sTitle = document.getElementById("student-lobby-title");
                  if (currentGroupingActive && myCurrentGroupId) {
                      if(sTitle) sTitle.innerHTML = `🚀 실시간 대기실 <span style="color:#E91E63; font-size:18px;">(👥 ${myCurrentGroupId}조)</span>`;
                      const myGroupPlayers = players.filter(p => p.groupId === myCurrentGroupId);
                      renderLobbyGrid(myGroupPlayers, true); 
                  } else {
                      if(sTitle) sTitle.innerHTML = `🚀 실시간 대기실`;
                      renderLobbyGrid(players, false);
                  }
              });
          }
          if (!lobbyChatUnsubscribe) {
              const qChat = query(collection(db, "lobbyChat"), orderBy("timestamp", "asc"));
              lobbyChatUnsubscribe = onSnapshot(qChat, (snapshot) => {
                  snapshot.docChanges().forEach((change) => {
                      if (change.type === "added") {
                          const c = change.doc.data();
                          if (currentGroupingActive) { if (c.groupId === myCurrentGroupId) processIncomingChat(c); } 
                          else { processIncomingChat(c); }
                      }
                  });
              });
          }
      } else {
          // 🚀 끄기 명령이 들어오면 모든 감시 카메라(onSnapshot)를 차단하여 읽기 트래픽을 0으로 만듭니다!
          if (lobbyUsersUnsubscribe) { lobbyUsersUnsubscribe(); lobbyUsersUnsubscribe = null; }
          if (lobbyChatUnsubscribe) { lobbyChatUnsubscribe(); lobbyChatUnsubscribe = null; }
      }
  };

  toggleStudentLobbyListeners(true); 

  // 🚀 멀티플레이어 중복 가동 차단 글로벌 뮤텍스 선언
  window.isMultiGameActive = false;

  multiRoomUnsubscribe = onSnapshot(doc(db, "gameData", "multiRoom"), async (docSnap) => {
    if (docSnap.exists()) {
      const room = docSnap.data();
      currentGroupingActive = room.groupingActive || false;
      currentMultiRoomGroupPlayMode = room.groupPlayMode || null;
      currentMultiRoomRepresentatives = room.representatives || null;
      
if (room.status === "playing") {
            // 🚀 [미아 방지 완벽 픽스 1] 새 게임 판독기! 
            // 폰이 잠든 사이 이전 게임 종료 신호를 놓쳤더라도, 선생님이 새로 시작한 게임의 고유 종료 시간(endTime)이 
            // 내 폰이 기억하는 시간과 다르다면 '완전히 새로운 게임'으로 인식하고 잠금을 강제 해제합니다.
            if (globalMultiEndTime && room.endTime && globalMultiEndTime !== room.endTime) {
                window.isMultiGameActive = false; 
            }

            // 🚀 [미아 방지 완벽 픽스 2] 대기실 탈출기!
            // 내부 시스템이 꼬여서 눈에 보이는 화면은 '대기실'이나 '결과창'인데, 폰 혼자 게임 중이라 착각하는 상태를 감지합니다.
            const isStuckOut = document.getElementById("multi-lobby-screen").classList.contains("active") || 
                               document.getElementById("result-screen").classList.contains("active") ||
                               document.getElementById("highfive-result-screen").classList.contains("active");

            // 하이파이브 모드거나, 실제 화면이 게임 밖(대기실/결과창)에 갇혀있는 경우에는 묻지도 따지지도 않고 무조건 강제 소환!
            if (window.isMultiGameActive && room.gameMode !== "highfive" && !isStuckOut) return;
            
            window.isMultiGameActive = true;

         toggleStudentLobbyListeners(false);
         
         let selectedSet = wordSets.find(s => s.id === room.setId);
         if (!selectedSet && room.setId !== "custom_creation") {
             try {
                 const setSnap = await getDoc(doc(db, "gameData", "wordSets"));
                 if (setSnap.exists()) {
                     wordSets = setSnap.data().sets || [];
                     selectedSet = wordSets.find(s => s.id === room.setId);
                 }
             } catch(e) { console.error("최신 세트 다운로드 실패", e); }
         }

         if (selectedSet) { wordList = selectedSet.words; currentSetId = room.setId; currentSetTitle = room.setTitle; }
         
         currentGameMode = room.gameMode; 
         multiUseSpecialItems = (room.useSpecialItems === "on");
         window.multiUseBuffItems = (room.useBuffItems === "on");
         globalMultiEndTime = room.endTime; 
         
         if (currentGroupingActive && currentMultiRoomGroupPlayMode === "one-player" && room.gameMode !== "highfive") {
             const rep = currentMultiRoomRepresentatives?.[myCurrentGroupId];
             if (rep && rep.stdId !== currentUser.stdId) {
                 document.getElementById("group-blocker-msg").innerHTML = `지금은 <b>${rep.name}</b> 친구의 화면에서<br>조원들과 다 함께 상의하며 플레이하세요!`;
                 document.getElementById("group-blocker-overlay").style.display = "flex";
             }
         }

         if (room.gameMode === "boss") {
             isBossRaid = true;
             multiUseSpecialItems = false; // 보스전 팀킬 금지
             if (room.subMode === "speed") { currentGameMode = "speed"; startCountdown(room.duration, "speed-screen", () => { startSpeedLogic(); }); }
             else if (room.subMode === "chunk") { currentGameMode = "chunk"; startCountdown(room.duration, "chunk-screen", () => { startChunkLogic(); }); }
             else if (room.subMode === "custom_infinite") { currentGameMode = "custom_infinite"; startCountdown(room.duration, "custom-infinite-screen", () => { startCustomInfiniteLogic(); }); }
         } else {
             isBossRaid = false; 
             if (room.gameMode === "speed") { startCountdown(room.duration, "speed-screen", () => { startSpeedLogic(); }); } 
             else if (room.gameMode === "speed-match") { startCountdown(room.duration, "speed-match-screen", () => { startSpeedMatchLogic(); }); } 
             else if (room.gameMode === "chunk") { startCountdown(room.duration, "chunk-screen", () => { startChunkLogic(); }); }
             else if (room.gameMode === "highfive") { startHighFiveLogic(room.endTime); }
             else if (room.gameMode === "create") { startCreateLogic(room); }
             else if (room.gameMode === "custom_infinite") { startCountdown(room.duration, "custom-infinite-screen", () => { startCustomInfiniteLogic(); }); }
             else if (room.gameMode === "showcase") { startShowcaseLogic(room.showcaseChar); }
         }
      } 
      else if (room.status === "waiting") {
        // 🚀 대기실로 돌아왔을 때만 안전하게 실행되는 찐 종료 로직!
        window.isMultiGameActive = false;
        toggleStudentLobbyListeners(true); 
        
if (currentGameMode === "speed" || currentGameMode === "speed-match" || currentGameMode === "chunk" || currentGameMode === "create" || currentGameMode === "custom_infinite" || currentGameMode === "showcase" || isBossRaid) {
            
            if (isBossRaid) {
                currentUser.score = gameScore; 
                globalMultiEndTime = null;
                document.getElementById("result-detail").innerText = `보스에게 입힌 총 데미지입니다!`; 
                
                // 🚀 [명예의 전당 DB 픽스] 저장될 모드를 'boss_raid'로 강제 덮어쓰고 저장!
                let originalMode = currentGameMode;
                currentGameMode = "boss_raid";
                
                goResult().then(() => {
                    currentGameMode = originalMode; // 원래대로 복구
                    isBossRaid = false;
                    resetGameStates();
                });
            } else {
                resetGameStates(); 
let alertMsg = currentGameMode === "showcase" ? "✨ 쇼케이스가 종료되었습니다. 대기실로 이동합니다." : "👑 선생님이 활동을 종료하셨습니다!\n실시간 대기실로 이동합니다.";
                currentGameMode = "";
                // 🚀 브라우저 멈춤 없이 팝업만 띄우고 백그라운드에서 즉시 대기실로 강제 이동!
                window.customAlert(alertMsg);
                showScreen("multi-lobby-screen");
            }
        }
        if (room.groupingActive && document.getElementById("highfive-result-screen").classList.contains("active")) {
            document.getElementById("confetti-canvas").style.display = "none";
            showScreen("multi-lobby-screen");
        }
      }
    }
  });
}
bindClick("lobby-exit-btn", async () => { playSound("click"); await exitLobby(); showScreen("lobby-mode-screen"); });

async function exitLobby() {
  if (lobbyUsersUnsubscribe) { lobbyUsersUnsubscribe(); lobbyUsersUnsubscribe = null; }
  if (lobbyChatUnsubscribe) { lobbyChatUnsubscribe(); lobbyChatUnsubscribe = null; }
  if (multiRoomUnsubscribe) { multiRoomUnsubscribe(); multiRoomUnsubscribe = null; }
  if (myLobbyListenerUnsubscribe) { myLobbyListenerUnsubscribe(); myLobbyListenerUnsubscribe = null; }
  if (myLobbyDocId) { try { await deleteDoc(doc(db, "lobbyUsers", myLobbyDocId)); } catch(e) { console.error(e); } myLobbyDocId = null; }
  globalMultiEndTime = null; 
}

function forceCleanupLobby() {
  if (myLobbyDocId) { deleteDoc(doc(db, "lobbyUsers", myLobbyDocId)); }
  if (isTeacherMode) { setDoc(doc(db, "gameData", "multiRoom"), { status: "waiting" }); }
}
window.addEventListener("beforeunload", forceCleanupLobby);
window.addEventListener("pagehide", forceCleanupLobby);

window.teacherGroupPlayMode = null; // 교사용 글로벌 변수 추가

function enterMultiLobbyAsTeacher() {
  isTeacherMode = true; showScreen("teacher-lobby-screen");
  
  // 🚀 일반 세트와 출제 세트를 각자의 드롭다운에 나눠 담습니다!
  const setSelect = document.getElementById("teacher-game-set-select");
  if (setSelect) { setSelect.innerHTML = wordSets.filter(s => !s.isCustomSet).map(set => `<option value="${set.id}">${set.title} (${set.words.length}개)</option>`).join(""); }
  const customSetSelect = document.getElementById("teacher-custom-set-select");
  if (customSetSelect) { customSetSelect.innerHTML = wordSets.filter(s => s.isCustomSet).map(set => `<option value="${set.id}">✨ ${set.title} (${set.words.length}문제)</option>`).join(""); }
  
  lobbyUsersUnsubscribe = onSnapshot(collection(db, "lobbyUsers"), (snapshot) => {
    const tCountEl = document.getElementById("teacher-user-count");
    let players = []; let count = 0;
    snapshot.forEach((doc) => { players.push({ docId: doc.id, ...doc.data() }); count++; }); 
    if(tCountEl) tCountEl.innerText = count;
    window.globalLobbyPlayers = players; 
    if (window.teacherLobbyStatus === "waiting") { renderTeacherVisualLobby(window.globalLobbyPlayers); }
  });

  // 교사 쪽 (enterMultiLobbyAsTeacher 내부)
  const qChat = query(collection(db, "lobbyChat"), orderBy("timestamp", "asc"));
  lobbyChatUnsubscribe = onSnapshot(qChat, (snapshot) => {
    snapshot.docChanges().forEach((change) => {
      if (change.type === "added") { const c = change.doc.data(); processIncomingChat(c); } // 🚀 새 엔진 호출!
    });
  });

  multiRoomUnsubscribe = onSnapshot(doc(db, "gameData", "multiRoom"), (docSnap) => {
      if (docSnap.exists()) {
          const data = docSnap.data();
          currentGroupingActive = data.groupingActive || false;
          window.teacherGroupPlayMode = data.groupPlayMode || null;
          currentGameMode = data.gameMode || ""; 
          updateTeacherMenuVisibility(); 
          
          if (data.status === "playing" && data.gameMode !== "highfive") {
              window.teacherLobbyStatus = "playing";
              
              // 🎵 게임 모드에 맞는 BGM 자동 재생!
              playTeacherBGM(data.gameMode);
              
              if (data.gameMode === "showcase") {
                  startShowcaseLogic(data.showcaseChar);
              } else if (data.gameMode === "boss") {
                  // 👈 보스전 렌더링 시작!
                  setupTeacherBossMatch(data);
              } else {
                  setupTeacherLiveMatch(data.endTime);
                  if (data.gameMode === "create") {
                      document.getElementById("teacher-viewer-title").innerText = "📝 출제 현황판";
                      document.getElementById("teacher-match-abort-btn").innerHTML = "⏹️ 문제만들기 종료 및 세트 저장";
                  } else {
                      document.getElementById("teacher-viewer-title").innerText = "⚡ 실시간 라이브 중계";
                      document.getElementById("teacher-match-abort-btn").innerHTML = "⏹️ 진행 중인 게임 강제 종료";
                  }
              }
          } else {
              window.teacherLobbyStatus = "waiting";
              window.isTeacherBossMatchRunning = false; 
              cleanupTeacherLiveMatch();
              
              // 🎵 대기실로 돌아오면 대기실 BGM 자동 재생!
              playTeacherBGM("lobby");
              
if (currentGameMode === "showcase" || currentGameMode === "boss") {
                  let wasBoss = (currentGameMode === "boss");
                  currentGameMode = ""; 
                  
if (wasBoss) {
                      showScreen("teacher-lobby-screen");
                      document.getElementById("teacher-viewer-title").innerText = "🏆 보스전 최종 타격 데미지 랭킹";
                      document.getElementById("teacher-visual-lobby-grid").style.display = "none";
                      document.getElementById("teacher-live-leaderboard").style.display = "block";
                      
                      // 🚀 [0점 증발 버그 울트라 픽스] 
                      // 학생 폰에서 무슨 일이 일어나든 상관없이, 교사 PC가 보스를 때리던 도중 기록해둔 '진짜 최고 데미지(previousPlayerScores)'를 뼈대로 사용합니다!
                      let finalBossScores = window.globalLobbyPlayers.map(p => {
                          let newP = JSON.parse(JSON.stringify(p));
                          newP.score = Math.max(newP.score || 0, previousPlayerScores[p.stdId] || 0);
                          return newP;
                      });
                      renderTeacherLiveLeaderboard(finalBossScores); 
                      
                      // 🚀 늦게 통신되는 학생 점수까지 반영되도록 10초간 리더보드 자동 갱신
                      let refreshCount = 0;
                      let bossRankInterval = setInterval(() => {
                          if (window.teacherLobbyStatus === "playing") { clearInterval(bossRankInterval); return; }
                          
                          window.globalLobbyPlayers.forEach(p => {
                              let existing = finalBossScores.find(f => f.stdId === p.stdId);
                              let bestScore = Math.max(p.score || 0, previousPlayerScores[p.stdId] || 0);
                              
                              if (existing) {
                                  if (bestScore > (existing.score || 0)) existing.score = bestScore;
                              } else {
                                  let newP = JSON.parse(JSON.stringify(p));
                                  newP.score = bestScore;
                                  finalBossScores.push(newP);
                              }
                          });
                          
                          renderTeacherLiveLeaderboard(finalBossScores);
                          refreshCount++;
                          if(refreshCount > 5) clearInterval(bossRankInterval);
                      }, 2000);
                  } else {
                      showScreen("teacher-lobby-screen");
                  }
              }
              renderTeacherVisualLobby(window.globalLobbyPlayers); 
          }
      } // 💡 에러의 원인이었던 잃어버린 괄호를 찾아서 넣었습니다!
  });

  if(teacherRenderInterval) clearInterval(teacherRenderInterval);
  teacherRenderInterval = setInterval(() => {
      if(!isTeacherMode) return;
      if (window.teacherLobbyStatus === "playing") {
          renderTeacherLiveLeaderboard(window.globalLobbyPlayers);
      }
  }, 500); 
}

// 🚀 교사 메뉴 숨김/표시 자동 갱신 로직 (조별 문제출제 지원 버전)
    function updateTeacherMenuVisibility() {
        const modeSelect = document.getElementById("teacher-game-mode-select");
        if(!modeSelect) return;
        const mode = modeSelect.value;
        const isHf = (mode === "highfive");
        const isCreate = (mode === "create");
        const isCustom = (mode === "custom_game");
        const isBoss = (mode === "boss"); 
        const bossSub = document.getElementById("teacher-boss-submode-select")?.value;
        
        const toggleDisplay = (id, condition) => {
            const el = document.getElementById(id);
            if (el) el.style.display = condition ? "block" : "none";
        };

        // 🚀 [보스전 세트 픽스] 보스전 하위 모드가 '학생출제 무한모드'일 때, 일반 세트 드롭다운에 '학생 세트'를 덮어씌웁니다!
        const setSelect = document.getElementById("teacher-game-set-select");
        if (setSelect) {
            if (isBoss && bossSub === "custom_infinite") {
                setSelect.innerHTML = wordSets.filter(s => s.isCustomSet).map(set => `<option value="${set.id}">✨ ${set.title} (${set.words.length}문제)</option>`).join("");
            } else {
                setSelect.innerHTML = wordSets.filter(s => !s.isCustomSet).map(set => `<option value="${set.id}">${set.title} (${set.words.length}개)</option>`).join("");
            }
        }

        // 조 해제 버튼 보이기 (조편성이 되어있을 때만)
        toggleDisplay("teacher-disband-group-btn", currentGroupingActive);

        toggleDisplay("teacher-boss-options-container", isBoss); 
        toggleDisplay("teacher-time-container", !(isHf || isCreate)); // 🚀 [보스전 강제종료 픽스] 보스전에서도 타이머 시간을 조절할 수 있도록 해제!
        toggleDisplay("teacher-item-container", !(isHf || isCreate || isBoss)); 
        toggleDisplay("teacher-set-container", !(isHf || isCreate || isCustom)); // 🚀 보스전에서도 무조건 세트 선택창 표시


    // 커스텀 게임용 조별전 드롭다운 제어
    const customGroupOpt = document.getElementById("custom-group-option");
    const customPlaySelect = document.getElementById("teacher-custom-play-select");
    if(customGroupOpt && customPlaySelect) {
        if(!currentGroupingActive) {
            customGroupOpt.disabled = true; customGroupOpt.innerText = "조별전 (하이파이브 조편성 필요)";
            if(customPlaySelect.value === "group") customPlaySelect.value = "individual";
        } else {
            customGroupOpt.disabled = false; customGroupOpt.innerText = "조별전 (선택 가능)";
        }
    }

    // 🚀 플레이 방식(1인 폰 vs 전원 접속) 컨테이너 표시 로직
    let showPlayMode = false;
    if (isCustom) showPlayMode = (customPlaySelect && customPlaySelect.value === "group");
    else if (isCreate) showPlayMode = currentGroupingActive; // 문제출제 모드도 조편성 시 플레이 방식 선택!
    else showPlayMode = (currentGroupingActive && !isHf);
    toggleDisplay("teacher-group-play-mode-container", showPlayMode);

    // 🚀 문항 수 선택 로직 (문제만들기 + 조편성 + 다같이(all-sum) 모드일 땐 문항수 숨김! 1인 1문제 고정)
    const playMode = document.getElementById("teacher-group-play-mode-select")?.value;
    if (isCreate && currentGroupingActive && playMode === "all-sum") {
        toggleDisplay("teacher-create-count-container", false);
    } else {
        toggleDisplay("teacher-create-count-container", isCreate);
    }
}

const modeSelectBox = document.getElementById("teacher-game-mode-select");
if(modeSelectBox) modeSelectBox.addEventListener("change", updateTeacherMenuVisibility);
const customPlaySelectBox = document.getElementById("teacher-custom-play-select");
if(customPlaySelectBox) customPlaySelectBox.addEventListener("change", updateTeacherMenuVisibility);
// 🚀 그룹 플레이 방식이 바뀔 때도 갱신되도록 추가!
const groupPlayModeBox = document.getElementById("teacher-group-play-mode-select");
if(groupPlayModeBox) groupPlayModeBox.addEventListener("change", updateTeacherMenuVisibility);
// 🚀 모드 선택 시 메뉴 변경
const modeSelect = document.getElementById("teacher-game-mode-select");
if(modeSelect) modeSelect.addEventListener("change", updateTeacherMenuVisibility);
// 🚀 보스전 하위 모드가 바뀔 때 세트 드롭다운을 갱신하도록 이벤트 추가!
const bossSubBox = document.getElementById("teacher-boss-submode-select");
if(bossSubBox) bossSubBox.addEventListener("change", updateTeacherMenuVisibility);
// 🚀 게임 시작 및 모드 처리 (옵션 분리 버전)
// 🚀 교사 전용: 게임 시작 버튼 핸들러 (버그 및 학생 세트 연동 완전 해결판)
bindClick("teacher-game-start-btn", async () => {
  const modeSelect = document.getElementById("teacher-game-mode-select");
  if (!modeSelect) return;
  const mode = modeSelect.value;
  
  const groupCountSelect = document.getElementById("teacher-group-count-select");
  const groupCount = groupCountSelect ? parseInt(groupCountSelect.value) : 2;

  playSound("success");

  // 🧹 [좀비 점수 소각 픽스 1] 
  // 새로운 게임 시작 버튼을 누르는 순간, 대기실에 있는 모든 학생의 DB 점수를 0으로 완벽 초기화!
  try {
      const snap = await getDocs(collection(db, "lobbyUsers"));
      snap.forEach(d => {
          setDoc(doc(db, "lobbyUsers", d.id), { score: 0, items: "", createdCount: 0, isSubmitted: false }, { merge: true }).catch(e=>e);
      });
  } catch(e) { console.error("점수 초기화 에러", e); }
  
  if (mode === "boss") {
      const bossHp = parseInt(document.getElementById("teacher-boss-hp-select").value);
      const subMode = document.getElementById("teacher-boss-submode-select").value;
      const duration = document.getElementById("teacher-game-time-select")?.value || 3;
      
      // 🚀 [보스전 세트 픽스] 메인 드롭다운에서 선택된 세트(학생 출제작 포함)를 깔끔하게 읽어옵니다.
      let finalSetId = document.getElementById("teacher-game-set-select").value;
      if(!finalSetId) return alert("보스전을 진행할 학습 세트를 선택해 주세요!");
      let finalSetTitle = wordSets.find(s => s.id === finalSetId)?.title;

      const tEnd = Date.now() + 5000 + (duration * 60 * 1000); // 5초 인트로
      await setDoc(doc(db, "gameData", "multiRoom"), { 
          status: "playing", gameMode: "boss", subMode: subMode, duration: duration, 
          setId: finalSetId, setTitle: finalSetTitle, 
          bossHp: bossHp, bossMaxHp: bossHp, endTime: tEnd, groupingActive: false,
          useBuffItems: "on", useSpecialItems: "off" // 보스전에선 팀킬 불가!
      }, { merge: true });
      return;
  }

  if (mode === "highfive") {
     const targetEndTime = Date.now() + 15000;
     await setDoc(doc(db, "gameData", "multiRoom"), { status: "playing", gameMode: mode, groupCount: groupCount, endTime: targetEndTime });
     startHighFiveLogic(targetEndTime); 
     return;
  }

  if (mode === "create") {
      const cTime = parseInt(document.getElementById("teacher-create-time-select").value);
      const cCount = parseInt(document.getElementById("teacher-create-count-select").value);
      let allowedTypes = [];
      document.querySelectorAll(".create-type-cb:checked").forEach(cb => allowedTypes.push(cb.value));
      if(allowedTypes.length === 0) return alert("최소 1개 이상의 문제 유형을 선택해 주세요!");
      const targetEndTime = Date.now() + (cTime * 60 * 1000); 

      let gPlayMode = null; let reps = {};
      if (currentGroupingActive) {
          gPlayMode = document.getElementById("teacher-group-play-mode-select").value;
          if (gPlayMode === "one-player") {
              const grouped = {}; window.globalLobbyPlayers.forEach(p => { if (p.groupId) { if(!grouped[p.groupId]) grouped[p.groupId] = []; grouped[p.groupId].push(p); } });
              for (const gId in grouped) { const mems = grouped[gId]; const rep = mems[Math.floor(Math.random() * mems.length)]; reps[gId] = { stdId: rep.stdId, name: `${rep.nickname} (${rep.stdId} ${rep.realName})` }; }
          }
      }

      await setDoc(doc(db, "gameData", "multiRoom"), { 
          status: "playing", gameMode: mode, duration: cTime, targetProblemCount: cCount, allowedTypes: allowedTypes,
          setId: "custom_creation", setTitle: "학생들이 출제 중...", endTime: targetEndTime,
          groupingActive: currentGroupingActive, groupPlayMode: gPlayMode, representatives: reps
      }, { merge: true });
      return;
  }

  // 🚀 1. 게임 옵션(시간, 버프, 공격) 읽어오기
  const timeSelect = document.getElementById("teacher-game-time-select");
  const duration = timeSelect ? parseInt(timeSelect.value) : 3;
  const buffOption = document.getElementById("teacher-game-buff-select")?.value || "on"; 
  const attackOption = document.getElementById("teacher-game-attack-select")?.value || "off"; 

  // 🚀 2. 특수 세트(무한 모드) 시작 로직
  if (mode === "custom_game") {
      const rule = document.getElementById("teacher-custom-rule-select").value; 
      const playStyle = document.getElementById("teacher-custom-play-select").value; 
      const cSetId = document.getElementById("teacher-custom-set-select").value;
      if(!cSetId) return alert("학생이 출제한 세트를 선택해 주세요!");
      const cSet = wordSets.find(s => s.id === cSetId);
      if (!cSet || !Array.isArray(cSet.words) || cSet.words.length === 0) return alert("학생 출제 세트에 문제가 없습니다. 먼저 문제 만들기를 종료해서 세트를 생성해 주세요.");
      const hasBrokenProblem = cSet.words.some(w => { try { JSON.parse(w.en); return false; } catch(e) { return true; } });
      if (hasBrokenProblem) return alert("학생 출제 세트 안에 손상된 문제가 있습니다. 새로 문제 만들기 세트를 생성해 주세요.");

      let gPlayMode = null; let reps = {};
      if (playStyle === "group") {
          gPlayMode = document.getElementById("teacher-group-play-mode-select").value;
          if (gPlayMode === "one-player") {
              const grouped = {}; window.globalLobbyPlayers.forEach(p => { if (p.groupId) { if(!grouped[p.groupId]) grouped[p.groupId] = []; grouped[p.groupId].push(p); } });
              for (const gId in grouped) { const mems = grouped[gId]; const rep = mems[Math.floor(Math.random() * mems.length)]; reps[gId] = { stdId: rep.stdId, name: `${rep.nickname} (${rep.stdId} ${rep.realName})` }; }
          }
      }
      const tEnd = Date.now() + 5000 + (duration * 60 * 1000);
      await setDoc(doc(db, "gameData", "multiRoom"), { 
          status: "playing", gameMode: "custom_" + rule, duration: duration, setId: cSetId, setTitle: cSet.title, 
          useBuffItems: buffOption, useSpecialItems: attackOption, endTime: tEnd, groupingActive: (playStyle === "group"), groupPlayMode: gPlayMode, representatives: reps
      }, { merge: true });
      return;
  }

  // 🚀 3. 일반 게임 시작 로직
  const setSelect = document.getElementById("teacher-game-set-select");
  const setId = setSelect ? setSelect.value : null;
  if (!setId) return alert("게임을 진행할 학습 세트를 선택해 주세요!");
  const selectedSet = wordSets.find(s => s.id === setId); 
  if(!selectedSet) return alert("게임을 진행할 학습 세트를 찾을 수 없습니다.");

  let groupPlayMode = null; let representatives = {};
  if (currentGroupingActive) {
      groupPlayMode = document.getElementById("teacher-group-play-mode-select").value;
      if (groupPlayMode === "one-player") {
          const grouped = {}; window.globalLobbyPlayers.forEach(p => { if (p.groupId) { if(!grouped[p.groupId]) grouped[p.groupId] = []; grouped[p.groupId].push(p); } });
          for (const gId in grouped) { const mems = grouped[gId]; const rep = mems[Math.floor(Math.random() * mems.length)]; representatives[gId] = { stdId: rep.stdId, name: `${rep.nickname} (${rep.stdId} ${rep.realName})` }; }
      }
  }
  const targetEndTime = Date.now() + 5000 + (duration * 60 * 1000);
  await setDoc(doc(db, "gameData", "multiRoom"), { 
      status: "playing", gameMode: mode, duration: duration, setId: setId, setTitle: selectedSet.title, 
      useBuffItems: buffOption, useSpecialItems: attackOption, endTime: targetEndTime,
      groupPlayMode: groupPlayMode, representatives: representatives
  }, { merge: true }); 
});

// 🧹 교사용 마스터 초기화 버튼
bindClick("teacher-clear-ghosts-btn", async () => {
  playSound("click");
  if(confirm("대기실 유저 목록 및 꼬여버린 게임 상태를 완전히 초기화합니다.\n진행할까요?")) {
    try {
      const snap = await getDocs(collection(db, "lobbyUsers"));
      snap.forEach(d => deleteDoc(doc(db, "lobbyUsers", d.id)));
      
      const chatSnap = await getDocs(collection(db, "lobbyChat"));
      chatSnap.forEach(d => deleteDoc(doc(db, "lobbyChat", d.id)));
      
      await setDoc(doc(db, "gameData", "multiRoom"), { status: "waiting", groupingActive: false, gameMode: "", endTime: null }, { merge: true });
      currentGroupingActive = false;
      alert("✅ 완벽하게 초기화되었습니다!");
    } catch(e) { console.error("초기화 에러", e); }
  }
});

// ==========================================
// 🚀 교사용 대기실 및 무중단 라이브 중계 엔진
// ==========================================
window.teacherLobbyStatus = "waiting";
window.globalLobbyPlayers = [];
let teacherRenderInterval = null;



// ⚡ 실시간 중계 UI 셋업
function setupTeacherLiveMatch(endTime) {
    document.getElementById("teacher-viewer-title").innerText = "⚡ 실시간 라이브 중계";
    document.getElementById("teacher-match-timer").style.display = "block";
    document.getElementById("teacher-visual-lobby-grid").style.display = "none";
    
    const board = document.getElementById("teacher-live-leaderboard");
    board.style.display = "block";
    board.innerHTML = ""; // 기존 그리드 지우기
    
    const abortBtn = document.getElementById("teacher-match-abort-btn");
    if(abortBtn) abortBtn.style.display = "block";

    clearInterval(teacherMatchInterval);
    teacherMatchInterval = setInterval(() => {
        const remaining = Math.max(0, Math.floor((endTime - Date.now()) / 1000));
        const m = String(Math.floor(remaining / 60)).padStart(2, "0");
        const s = String(remaining % 60).padStart(2, "0");
        document.getElementById("teacher-match-timer").innerText = `🕒 ${m}:${s}`;
if (remaining <= 0) {
            clearInterval(teacherMatchInterval);
            document.getElementById("teacher-match-timer").innerText = "게임 종료!";
            
            // 🚀 [기능 개선] 게임 종료 시 버튼을 숨기지 않고 초록색 복귀 버튼으로 멋지게 변신!
            if (abortBtn) {
                if (currentGameMode === "create") {
                    abortBtn.innerHTML = "🏁 문제 만들기 마감 및 세트 저장하기";
                } else {
                    abortBtn.innerHTML = "🏁 활동 정산 및 대기실로 복귀하기";
                }
                abortBtn.style.backgroundColor = "#4CAF50";
                abortBtn.style.boxShadow = "0 4px 0 #388E3C";
            }
        }
    }, 500);
}

// ⚡ 실시간 중계 UI 해제 (대기실 복구)
function cleanupTeacherLiveMatch() {
    clearInterval(teacherMatchInterval);
    document.getElementById("teacher-viewer-title").innerText = "👀 학생 대기실 모니터링";
    document.getElementById("teacher-match-timer").style.display = "none";
    document.getElementById("teacher-visual-lobby-grid").style.display = "flex";
    document.getElementById("teacher-live-leaderboard").style.display = "none";
    
    const abortBtn = document.getElementById("teacher-match-abort-btn");
    if(abortBtn) abortBtn.style.display = "none";
}

// ⚡ 라이브 리더보드 렌더러 (조별 모드 및 문제 만들기 지원 통합 엔진)
function renderTeacherLiveLeaderboard(players) {
    const board = document.getElementById("teacher-live-leaderboard");
    if (!board) return;

    let renderList = [];

    // 🚀 [문제 만들기 모드 전용 현황판]
    if (currentGameMode === "create") {
        if (currentGroupingActive && window.teacherGroupPlayMode) {
            let groupData = {};
            players.forEach(p => {
                if (!p.groupId) return;
                if (!groupData[p.groupId]) groupData[p.groupId] = { id: p.groupId, createdCount: 0, isSubmitted: false, targetCount: 0, members: 0 };
                groupData[p.groupId].createdCount += p.createdCount || 0;
                groupData[p.groupId].targetCount += p.targetCount || 0;
                if (p.isSubmitted) groupData[p.groupId].isSubmitted = true;
                groupData[p.groupId].members++;
            });
            renderList = Object.values(groupData).map(g => {
                const target = window.teacherGroupPlayMode === "all-sum" ? g.members : (players.find(p=>p.groupId===g.id)?.targetCount || 1);
                return {
                    renderId: `group-${g.id}`,
                    title: `<span style="color:#FF5722">${g.id}조</span>`,
                    subtitle: `<span style="font-size:14px; color:#666;">(조별 출제)</span>`,
                    scoreText: `${g.createdCount} / ${target} 완료`,
                    isDone: g.isSubmitted,
                    icon: `<span style="font-size:35px; margin-right:10px;">👥</span>`
                }
            });
        } else {
            renderList = players.map(p => {
                const charFolder = p.character || availableCharacters[0] || "기본0(민준쌤)";
                const nameHtml = isTeacherNameHidden ? "" : ` <span style="font-size:14px; color:#666;">(${p.stdId} ${p.realName || ''})</span>`;
                return {
                    renderId: `user-${p.stdId}`,
                    title: p.nickname, subtitle: nameHtml,
                    scoreText: `${p.createdCount || 0} / ${p.targetCount || 1} 완료`,
                    isDone: p.isSubmitted,
                    icon: `<img src="char/${charFolder}/stand1_0.png" class="anim-avatar" style="height:45px; margin-right: 10px; vertical-align: middle;">`
                };
            });
        }

        board.style.minHeight = (renderList.length * 80) + "px";
        renderList.forEach((p, index) => {
            const topPos = index * 80;
            let row = document.getElementById(`live-rank-${p.renderId}`);
            let badge = p.isDone ? "✅" : "⏳";
            let rankClass = p.isDone ? "rank-1" : "rank-2";

            if (!row) {
                row = document.createElement("div"); row.id = `live-rank-${p.renderId}`; row.className = `live-rank-item`;
                row.innerHTML = `<div class="live-rank-badge"></div><div class="live-rank-user" style="display:flex; align-items:center;"></div><div class="live-rank-items"></div><div class="live-rank-score"></div>`;
                board.appendChild(row);
            }
            row.style.top = topPos + "px"; row.className = `live-rank-item ${rankClass}`;
            row.querySelector(".live-rank-badge").innerText = badge;
            row.querySelector(".live-rank-user").innerHTML = `${p.icon} ${p.title} ${p.subtitle}`;
            row.querySelector(".live-rank-items").innerText = "";
            row.querySelector(".live-rank-score").innerText = p.scoreText;
            row.querySelector(".live-rank-score").style.color = p.isDone ? "#4CAF50" : "#F44336";
        });
        return; 
    }

    // 🎮 [기존 일반 게임 랭킹 순위표]
    if (currentGroupingActive && window.teacherGroupPlayMode) {
        let groupData = {};
        players.forEach(p => {
            if (!p.groupId) return;
            if (!groupData[p.groupId]) groupData[p.groupId] = { id: p.groupId, score: 0, items: "" };
            groupData[p.groupId].score += p.score || 0;
            if (p.items) groupData[p.groupId].items += p.items; 
        });
        renderList = Object.values(groupData).map(g => ({
            renderId: `group-${g.id}`, title: `<span style="color:#FF5722">${g.id}조</span>`,
            subtitle: `<span style="font-size:14px; color:#666;">(조별 합산 점수)</span>`,
            score: g.score, items: g.items, icon: `<span style="font-size:35px; margin-right:10px;">👥</span>`
        }));
    } else {
        renderList = players.map(p => {
            const charFolder = p.character || availableCharacters[0] || "기본0(민준쌤)";
            const nameHtml = isTeacherNameHidden ? "" : ` <span style="font-size:14px; color:#666;">(${p.stdId} ${p.realName || ''})</span>`;
            return {
                renderId: `user-${p.stdId}`, title: p.nickname, subtitle: nameHtml,
                score: p.score || 0, items: p.items || "",
                icon: `<img src="char/${charFolder}/stand1_0.png" class="anim-avatar" style="height:45px; margin-right: 10px; vertical-align: middle;">`
            };
        });
    }

    const sorted = renderList.sort((a, b) => b.score - a.score);
    board.style.minHeight = (sorted.length * 80) + "px";

    sorted.forEach((p, index) => {
        const topPos = index * 80;
        let row = document.getElementById(`live-rank-${p.renderId}`);
        let medal = index === 0 ? "🥇" : index === 1 ? "🥈" : index === 2 ? "🥉" : `${index + 1}위`;
        let rankClass = index === 0 ? "rank-1" : index === 1 ? "rank-2" : index === 2 ? "rank-3" : "";

        if (!row) {
            row = document.createElement("div"); row.id = `live-rank-${p.renderId}`; row.className = `live-rank-item`;
            row.innerHTML = `<div class="live-rank-badge"></div><div class="live-rank-user" style="display:flex; align-items:center;"></div><div class="live-rank-items"></div><div class="live-rank-score">0점</div>`;
            board.appendChild(row);
        }
        row.style.top = topPos + "px"; row.className = `live-rank-item ${rankClass}`;
        row.querySelector(".live-rank-badge").innerText = medal;
        row.querySelector(".live-rank-user").innerHTML = `${p.icon} ${p.title} ${p.subtitle}`;
        row.querySelector(".live-rank-items").innerText = p.items;
        row.querySelector(".live-rank-score").innerText = p.score + "점";
        row.querySelector(".live-rank-score").style.color = "#ff4081"; 
    });
}

// 🛑 진행 중인 게임 강제 종료 및 문제 세트 자동 생성 버튼
bindClick("teacher-match-abort-btn", async () => {
    playSound("click");
    
    // 🚀 현재 게임이 자연스럽게 끝난 상태인지 타이머 글자로 똑똑하게 감지합니다.
    const isGameFinished = document.getElementById("teacher-match-timer").innerText === "게임 종료!";

    if (currentGameMode === "create") {
        const confirmMsg = isGameFinished 
            ? "문제 만들기가 마감되었습니다.\n학생들이 제출한 문제들로 '새로운 학습 세트'를 생성하시겠습니까?"
            : "문제 만들기를 종료합니다.\n학생들이 제출한 문제들로 '새로운 학습 세트'를 생성하시겠습니까?";
            
        if(confirm(confirmMsg)) {
            const saved = await saveCreatedProblemsToSet();
            if (!saved) return;
            await setDoc(doc(db, "gameData", "multiRoom"), { status: "waiting" }, { merge: true });
            window.customAlert("종료 및 세트 생성이 완료되었습니다!");
        }
    } else {
        if (isGameFinished) {
            // 🚀 이미 시간이 다 가고 게임이 끝난 상태라면 확인창 없이 즉시 대기실로 안전하게 전원 복귀!
            await setDoc(doc(db, "gameData", "multiRoom"), { status: "waiting" }, { merge: true });
        } else {
            // 게임 도중 교사가 중간에 강제로 끌 때만 경고 확인창을 띄워 실수를 방지합니다.
            if(confirm("진행 중인 게임을 즉시 종료하고 아이들을 대기실로 부르시겠습니까?")) {
                await setDoc(doc(db, "gameData", "multiRoom"), { status: "waiting" }, { merge: true });
            }
        }
    }
});

async function saveCreatedProblemsToSet() {
    // 🚀 [안정성 패치] 와이파이가 느린 학생의 문제까지 모두 취합하도록 3.5초 대기
    await new Promise(resolve => setTimeout(resolve, 3500));
    const snap = await getDocs(collection(db, "lobbyUsers"));
    const customWords = [];
    let firstClassId = "테스트";
    
    // 조편성 여부 파악
    const isGroupActive = currentGroupingActive;

    snap.forEach(d => {
        const data = d.data();
        if (data.classId) firstClassId = data.classId; 
        else if (data.stdId) firstClassId = data.stdId.substring(0, 1) + "학년 " + data.stdId.substring(1, 2);
        
        // 🚀 개인/조별 만든이 포맷팅
        let authorStr = `만든이: ${data.stdId} ${data.realName || data.nickname}`;
        if (isGroupActive && data.groupId) {
            authorStr = `만든이: ${firstClassId}반 ${data.groupId}조(${data.realName || data.nickname})`;
        }

        if (data.createdProblems) {
            data.createdProblems.forEach(p => {
                if (p) {
                    customWords.push({
                        en: JSON.stringify(p), 
                        ko: `[학생출제] ${data.nickname}`,
                        isCustomData: true,
                        author: authorStr // 🚀 기록 완료
                    });
                }
            });
        }
    });

    if (customWords.length === 0) { alert("아직 저장된 학생 문제가 없습니다. 잠시 후 다시 종료 버튼을 눌러 주세요."); return false; }

    const now = new Date();
    const title = `${firstClassId}반 ${now.getMonth()+1}월 ${now.getDate()}일 ${now.getHours()}:${String(now.getMinutes()).padStart(2, '0')}`;
    
    // 🚀 isCustomSet: true 태그를 달아서 기존 게임들과 영원히 격리시킵니다.
    wordSets.push({ id: Date.now().toString(), title: title, words: customWords, isCustomSet: true });
    await setDoc(doc(db, "gameData", "wordSets"), { sets: wordSets });

    // 🚀 핵심 픽스: 세트가 저장된 직후, 교사 메뉴의 세트 선택 드롭다운을 즉시 새로고침합니다!
    const setSelect = document.getElementById("teacher-game-set-select");
    if (setSelect) { setSelect.innerHTML = wordSets.filter(s => !s.isCustomSet).map(set => `<option value="${set.id}">${set.title} (${set.words.length}개)</option>`).join(""); }
    const customSetSelect = document.getElementById("teacher-custom-set-select");
    if (customSetSelect) { customSetSelect.innerHTML = wordSets.filter(s => s.isCustomSet).map(set => `<option value="${set.id}">✨ ${set.title} (${set.words.length}문제)</option>`).join(""); }
    return true;
}

// 🚀 교사 대기실 나가기 버튼 핸들러 연결
// 🚀 교사 대기실 나가기 버튼 핸들러 연결
bindClick("teacher-lobby-exit-btn", async () => {
  playSound("click");
  stopTeacherBGM(); // 🎵 밖으로 나갈 때 교실 BGM 완전 끄기
  isTeacherMode = false;
  if (lobbyUsersUnsubscribe) { lobbyUsersUnsubscribe(); lobbyUsersUnsubscribe = null; }
  if (lobbyChatUnsubscribe) { lobbyChatUnsubscribe(); lobbyChatUnsubscribe = null; }
  if (multiRoomUnsubscribe) { multiRoomUnsubscribe(); multiRoomUnsubscribe = null; }
  if (teacherRenderInterval) { clearInterval(teacherRenderInterval); teacherRenderInterval = null; }
  await setDoc(doc(db, "gameData", "multiRoom"), { status: "waiting" });
  showScreen("lobby-mode-screen");
});
// ==========================================
// 🚀 전역 뒤로가기 버튼 UI 이름/위치 통일 패치
// ==========================================
const backBtnIds = [
  "char-shop-back-btn", "admin-main-close-btn", "admin-feedback-back-btn", 
  "admin-student-back-btn", "admin-set-list-back-btn", "set-select-back-btn", 
  "lobby-mode-back-btn", "lobby-exit-btn", "teacher-lobby-exit-btn", 
  "menu-go-back-set-btn", "list-back-btn", "fc-option-back-btn", 
  "time-option-back-btn", "home-btn", "ranking-home-btn"
];

// 1. 위 목록에 있는 모든 버튼을 찾아 "⬅️ 뒤로 가기"로 이름을 바꾸고 좌상단으로 날려버립니다.
backBtnIds.forEach(id => {
  const btn = document.getElementById(id);
  if (btn) {
    btn.innerText = "⬅️ 뒤로 가기";
    btn.classList.add("global-back-btn");
  }
});

// 2. 게임 플레이 중 나타나는 인게임 메뉴 버튼은 이미 좌상단에 잘 세팅되어 있으므로 텍스트만 맞춥니다.
const inGameBackBtn = document.getElementById("back-to-menu-btn");
if (inGameBackBtn) {
  inGameBackBtn.innerText = "⬅️ 뒤로 가기";
}
// ==========================================
// 🚀 하이파이브 조편성 코어 엔진
// ==========================================
let hfClicked = false;

function startHighFiveLogic(endTime) {
  hfClicked = false;
  showScreen("highfive-screen");
  
  const timerEl = document.getElementById("hf-timer");
  const btn = document.getElementById("hf-btn");
  const status = document.getElementById("hf-status");
  
  btn.style.display = "flex";
  status.style.display = "none";
  
  // 교사 모드면 버튼 숨기고 안내만 띄움
// 교사 모드면 버튼 숨기고 안내만 띄움
  if(isTeacherMode) {
      btn.style.display = "none";
      status.style.display = "block";
      status.innerText = "학생들이 조편성을 진행 중입니다...";
      playTeacherBGM("highfive"); // 🎵 하이파이브 전용 심장 쫄깃한 브금 큐!
  }

  clearInterval(gameTimerInterval);
  gameTimerInterval = setInterval(() => {
     const remaining = Math.max(0, Math.floor((endTime - Date.now()) / 1000));
     timerEl.innerText = remaining;
     
     if(remaining <= 0) {
         clearInterval(gameTimerInterval);
         
         // 안 누르고 뻐기는 학생은 15초 땡 치는 순간 강제 터치!
         if(!isTeacherMode && !hfClicked) {
             submitHighFive(Date.now());
         }
         
timerEl.innerText = "종료!";
         btn.style.display = "none";
         status.style.display = "block";
         status.innerText = "조편성 결과 완벽 집계 중... (약 4초)";
         
         // 🚀 [안정성 패치] 22명 동시 접속 시 누락 없도록 4초 대기!
         setTimeout(() => { processHighFiveResult(); }, 4000);
     }
  }, 500);
}

bindClick("hf-btn", () => {
    if(hfClicked || isTeacherMode) return;
    playSound("pop");
    submitHighFive(Date.now()); // 누른 순간의 밀리초(Timestamp) 전송!
});

async function submitHighFive(timestamp) {
    hfClicked = true;
    document.getElementById("hf-btn").style.display = "none";
    const status = document.getElementById("hf-status");
    status.style.display = "block";
    status.innerText = "하이파이브 성공! 다른 친구들을 기다리는 중...";
    
    try {
        await addDoc(collection(db, "scores"), {
          stdId: currentUser.stdId, 
          nickname: currentUser.nickname, 
          character: currentUser.character,
          score: timestamp, // 점수 칸에 타이밍(Timestamp)을 넣습니다
          mode: "highfive", 
          timestamp: Date.now()
        });
    } catch(e) { console.error(e); }
}

// 🚀 하이파이브 결과 처리 (학번/실명 표시 및 데이터 저장)
async function processHighFiveResult() {
    showScreen("loading-screen");
    document.querySelector("#loading-screen h2").innerText = "마음이 통하는 친구들을 찾고 있습니다...";
    
    let groupCount = 2;
    const roomDoc = await getDoc(doc(db, "gameData", "multiRoom"));
    if(roomDoc.exists() && roomDoc.data().groupCount) groupCount = roomDoc.data().groupCount;

    const lobbySnap = await getDocs(collection(db, "lobbyUsers"));
    const lobbyPlayers = [];
    lobbySnap.forEach(d => lobbyPlayers.push({ docId: d.id, ...d.data() }));

    let uniqueTop = {};
    const thirtySecondsAgo = Date.now() - 45000;

    for (let attempt = 0; attempt < 5; attempt++) {
        const q = query(collection(db, "scores"), orderBy("timestamp", "desc"), limit(300));
        const qSnap = await getDocs(q);
        qSnap.forEach(d => {
            const s = d.data();
            if (s.mode === "highfive" && s.timestamp > thirtySecondsAgo) {
                if (!uniqueTop[s.stdId] || uniqueTop[s.stdId].score > s.score) uniqueTop[s.stdId] = s;
            }
        });
        if (Object.keys(uniqueTop).length >= lobbyPlayers.length) break;
        await new Promise(resolve => setTimeout(resolve, 700));
    }

    lobbyPlayers.forEach((p, idx) => {
        if (!uniqueTop[p.stdId]) {
            uniqueTop[p.stdId] = {
                stdId: p.stdId,
                realName: p.realName,
                nickname: p.nickname,
                character: p.character,
                score: (roomDoc.exists() && roomDoc.data().endTime ? roomDoc.data().endTime : Date.now()) + idx,
                timestamp: Date.now(),
                mode: "highfive"
            };
        } else {
            uniqueTop[p.stdId].realName = uniqueTop[p.stdId].realName || p.realName;
            uniqueTop[p.stdId].nickname = uniqueTop[p.stdId].nickname || p.nickname;
            uniqueTop[p.stdId].character = uniqueTop[p.stdId].character || p.character;
        }
    });
    
    let sorted = Object.values(uniqueTop).sort((a, b) => a.score - b.score);
    let groups = Array.from({length: groupCount}, () => []);
    let baseSize = Math.floor(sorted.length / groupCount);
    let remainder = sorted.length % groupCount;
    
    let currentIndex = 0;
    for(let i=0; i<groupCount; i++) {
        let size = baseSize + (i < remainder ? 1 : 0);
        groups[i] = sorted.slice(currentIndex, currentIndex + size);
        currentIndex += size;
    }

    // 🚀 교사가 '이 조로 게임하기'를 누를 때를 대비해 결과를 메모리에 임시 저장
    window.latestGroups = groups;

    const container = document.getElementById("hf-result-container");
    container.innerHTML = "";
    
    groups.forEach((group, idx) => {
        const groupDiv = document.createElement("div");
        groupDiv.style.cssText = "background: white; border: 4px solid #FF9800; border-radius: 15px; padding: 15px; width: 100%; max-width: 280px; box-shadow: 0 5px 15px rgba(0,0,0,0.1);";
        groupDiv.innerHTML = `<h3 style="margin-top:0; color:#F57C00; border-bottom:2px dashed #ccc; padding-bottom:10px; font-size:22px;">${idx + 1}조 (${group.length}명)</h3>`;
        
        const ul = document.createElement("div");
        ul.style.cssText = "display: flex; flex-direction: column; gap: 8px;";
        group.forEach(member => {
            const charFolder = member.character || "기본0(민준쌤)";
            // 🚀 결과창에 학번과 실명 동시 표기
            ul.innerHTML += `
              <div style="display:flex; align-items:center; gap:10px; background:#fff3e0; padding:8px 12px; border-radius:10px; border:2px solid #ffe0b2;">
                <img src="char/${charFolder}/stand1_0.png" style="height:40px; image-rendering:pixelated; image-rendering: crisp-edges;">
                <div style="display:flex; flex-direction:column; align-items:flex-start;">
                  <span style="font-weight:bold; font-size:16px; color:#333;">${member.nickname}</span>
                  <span style="font-size:12px; color:#666;">${member.stdId} ${member.realName || ''}</span>
                </div>
              </div>
            `;
        });
        groupDiv.appendChild(ul);
        container.appendChild(groupDiv);
    });
    
    // 교사에게만 확정/취소 버튼 보이기, 학생은 대기 메시지 띄우기
    const playBtn = document.getElementById("hf-result-play-btn");
    if(playBtn) playBtn.style.display = isTeacherMode ? "block" : "none";
    const homeBtn = document.getElementById("hf-result-home-btn");
    if(homeBtn) homeBtn.style.display = isTeacherMode ? "block" : "none";

    // 🚀 학생 화면에는 버튼 대신 자동 이동 대기 메시지 띄우기
    let studentWaitMsg = document.getElementById("hf-student-wait-msg");
    if (!studentWaitMsg) {
        studentWaitMsg = document.createElement("div");
        studentWaitMsg.id = "hf-student-wait-msg";
        studentWaitMsg.style.cssText = "font-size: 22px; font-weight: bold; color: #E91E63; margin-top: 25px; width: 100%; text-align: center;";
        studentWaitMsg.innerText = "⏳ 선생님의 조편성 확정을 기다리는 중...";
        document.getElementById("highfive-result-screen").appendChild(studentWaitMsg);
    }
    studentWaitMsg.style.display = isTeacherMode ? "none" : "block";

    showScreen("highfive-result-screen");
    playSound("success");
    fireConfetti();
    showScreen("highfive-result-screen");
    playSound("success");
    fireConfetti();
    if(isTeacherMode) stopTeacherBGM(); // 🎵 결과 발표 때는 BGM 끄기
}


// 🚀 교사 전용: 이 조로 게임하기(확정) 버튼
bindClick("hf-result-play-btn", async () => {
    if (!isTeacherMode) return;
    playSound("click");
    document.getElementById("confetti-canvas").style.display = "none";
    
    // 로비에 있는 모든 유저에게 조(groupId) 부여하기
    const lobbySnap = await getDocs(collection(db, "lobbyUsers"));
    const groupUpdatePromises = [];
    
    // 각 조별 현재 배정된 인원수를 추적
    let groupCounts = new Array(window.latestGroups.length).fill(0);
    
    lobbySnap.forEach(docSnap => {
        const d = docSnap.data();
        let gId = null;
        for (let i = 0; i < window.latestGroups.length; i++) {
            if (window.latestGroups[i].find(m => m.stdId === d.stdId)) { 
                gId = i + 1; 
                groupCounts[i]++;
                break; 
            }
        }
        
        // 🚨 [무결성 패치 2] 튕겨서 새로고침하는 바람에 조 명단에서 누락된 학생 실시간 구제!
        // 가장 인원이 적은 조를 찾아 자동으로 강제 배정합니다.
        if (!gId && d.stdId) {
            let minIndex = 0;
            for (let i = 1; i < groupCounts.length; i++) {
                if (groupCounts[i] < groupCounts[minIndex]) minIndex = i;
            }
            gId = minIndex + 1;
            groupCounts[minIndex]++;
            console.log(`[누락생 구제] ${d.nickname} 학생을 ${gId}조에 자동 배정했습니다.`);
        }
        
        if (gId) groupUpdatePromises.push(setDoc(docSnap.ref, { groupId: gId }, { merge: true }));
    });
    await Promise.all(groupUpdatePromises);

    currentGroupingActive = true;
    await setDoc(doc(db, "gameData", "multiRoom"), { status: "waiting", groupingActive: true }, { merge: true });
    alert("✅ 조편성이 완료되어 활성화되었습니다!");
    showScreen("teacher-lobby-screen");
});

// 취소 및 대기실로 돌아가기 (조편성 해제)
bindClick("hf-result-home-btn", async () => {
    playSound("click");
    document.getElementById("confetti-canvas").style.display = "none";
    if(isTeacherMode) {
        currentGroupingActive = false;
        await setDoc(doc(db, "gameData", "multiRoom"), { status: "waiting", groupingActive: false }, { merge: true });
        alert("❌ 조편성을 취소하고 대기실로 돌아갑니다.");
        showScreen("teacher-lobby-screen");
    } else {
        showScreen("multi-lobby-screen");
    }
});

// 채팅 보낼 때 자기 조 번호 같이 보내기 (마지막 수정 포인트)
bindClick("lobby-chat-send-btn", async () => {
  const input = document.getElementById("lobby-chat-input"); const text = input.value.trim(); if(!text) return;
  input.value = ""; playSound("pop");
  try { 
    // 🚀 에러 방지: 조편성이 안되어있으면 undefined 대신 null을 전송하게 묶어줍니다.
    await addDoc(collection(db, "lobbyChat"), { 
        stdId: currentUser.stdId, 
        nickname: currentUser.nickname, 
        text: text, 
        groupId: myCurrentGroupId || null, 
        timestamp: Date.now() 
    }); 
  } catch(e) { console.error("채팅 전송 에러:", e); }
});

const chatInput = document.getElementById("lobby-chat-input");
if(chatInput) { chatInput.onkeydown = (e) => { if(e.key === "Enter") { document.getElementById("lobby-chat-send-btn").click(); } }; }

// ==========================================
// 🧪 개발자 전용 빠른 테스트 모드 (원클릭 입장)
// ==========================================
bindClick("dev-t-btn", () => {
    playSound("click");
    enterMultiLobbyAsTeacher(); // 인증 생략하고 바로 교사 로비로 점프!
});

bindClick("dev-s1-btn", () => {
    playSound("click");
    // 가상의 테스터 1 데이터 강제 주입
    currentUser.stdId = "9991";
    currentUser.realName = "테스터1";
    currentUser.nickname = "테스터1";
    currentUser.classId = "99";
    currentUser.character = availableCharacters[0] || "기본0(민준쌤)";
    enterMultiLobbyAsStudent(); // 인증 생략하고 바로 학생 로비로 점프!
});

bindClick("dev-s2-btn", () => {
    playSound("click");
    // 가상의 테스터 2 데이터 강제 주입
    currentUser.stdId = "9992";
    currentUser.realName = "테스터2";
    currentUser.nickname = "테스터2";
    currentUser.classId = "99";
    // 캐릭터가 여러 개면 2번째 캐릭터 할당, 없으면 1번째 할당
currentUser.character = availableCharacters[1] || availableCharacters[0] || "기본0(민준쌤)";
    enterMultiLobbyAsStudent(); // 인증 생략하고 바로 학생 로비로 점프!
});
// ==========================================
// 🚀 누락되었던 멀티플레이어 전용 특수 공격 시스템 픽스!
// ==========================================
window.openTargetSelectionModal = function(attackType, title, desc, callback) {
    const modal = document.getElementById("multi-target-modal");
    if(!modal) { isGamePaused = false; callback(); return; } 
    
    document.getElementById("multi-target-title").innerText = title;
    document.getElementById("multi-target-desc").innerText = desc;
    const listEl = document.getElementById("multi-target-list");
    listEl.innerHTML = "";
    
    let targets = window.globalLobbyPlayers ? window.globalLobbyPlayers.filter(p => p.stdId !== currentUser.stdId) : [];
    // 🚀 [타겟 정렬 픽스] 상대방 목록을 점수가 높은 순(내림차순)으로 완벽하게 정렬합니다!
    targets.sort((a, b) => (b.score || 0) - (a.score || 0));
    if (targets.length === 0) {
        alert("공격할 대상이 없어 일반 게임으로 계속 진행합니다!");
        isGamePaused = false; callback(); return;
    }

    targets.forEach(t => {
        const btn = document.createElement("button");
        // 🚀 핵심 픽스: color: #333; 을 추가하여 흰색 배경에서 글씨가 선명하게 보이게 만듭니다!
        btn.style.cssText = "padding: 10px; font-size: 16px; border-radius: 10px; background: #fff; color: #333; border: 2px solid #ddd; text-align: left; font-weight: bold; cursor: pointer; margin-bottom: 5px;";
        btn.innerText = `🎯 ${t.nickname} (${t.score || 0}점)`;
        
        // 🚀 [초강력 멈춤 방지 유지됨]
        btn.onclick = () => {
            playSound("pop"); modal.style.display = "none";
            
            let targetOldScore = t.score || 0;

            // 🚀 서버에 공격 신호만 툭 던져놓고 절대 기다리지 않습니다!
            setDoc(doc(db, "lobbyUsers", t.docId), {
                attack: { type: attackType, fromId: currentUser.stdId, fromName: currentUser.nickname, myScore: gameScore, timestamp: Date.now() }
            }, { merge: true }).catch(e => console.error("공격 통신 지연 (무시됨)"));

            if (attackType === "swap") {
                gameScore = targetOldScore;
                showBuffMsg("점수 스왑 성공!", `${t.nickname}님과 점수가 바뀌었습니다!`, 156, 39, 176);
            } else if (attackType === "steal50") {
                const stolen = Math.floor(targetOldScore / 2);
                gameScore += stolen;
                showBuffMsg("점수 강탈 성공!", `${t.nickname}님의 점수 ${stolen}점을 뺏었습니다!`, 233, 30, 99);
            } else if (attackType === "blind") {
                showBuffMsg("블라인드 공격 성공!", `${t.nickname}님의 화면을 가렸습니다!`, 33, 33, 33);
            }
            
            // 기다림 없이 무조건 즉각적으로 UI를 갱신하고 다음 문제로 넘어갑니다!
            refreshGameModeUI(); isGamePaused = false; callback();
        };
        listEl.appendChild(btn);
    });

    document.getElementById("multi-target-cancel-btn").onclick = () => {
        playSound("click"); modal.style.display = "none"; isGamePaused = false; callback();
    };
    modal.style.display = "flex";
};

window.executeSteal10FromAll = async function(callback) {
    let stolenTotal = 0;
    const targets = window.globalLobbyPlayers ? window.globalLobbyPlayers.filter(p => p.stdId !== currentUser.stdId) : [];
    targets.forEach(t => {
        setDoc(doc(db, "lobbyUsers", t.docId), {
            attack: { type: "steal10", fromId: currentUser.stdId, fromName: currentUser.nickname, timestamp: Date.now() }
        }, { merge: true });
        stolenTotal += 10;
    });
    gameScore += stolenTotal;
    showBuffMsg("광역 공격 성공!", `모든 친구에게서 총 ${stolenTotal}점을 뺏어왔습니다!`, 255, 87, 34);
    refreshGameModeUI(); isGamePaused = false; callback();
};

window.handleIncomingAttack = function(atk) {
    if (!atk) return;
    playSound("wrong");
    if (atk.type === "swap") {
        showBuffMsg("앗!", `${atk.fromName}님이 당신과 점수를 바꿨습니다!`, 244, 67, 54);
        gameScore = atk.myScore || 0; 
    } else if (atk.type === "steal50") {
        const lost = Math.floor(gameScore / 2);
        gameScore -= lost;
        showBuffMsg("강탈당함!", `${atk.fromName}님에게 ${lost}점을 뺏겼습니다!`, 244, 67, 54);
    } else if (atk.type === "steal10") {
        gameScore -= 10;
        showBuffMsg("광역 공격!", `${atk.fromName}님이 10점을 훔쳐갔습니다!`, 244, 67, 54);
    } else if (atk.type === "blind") {
        const blind = document.getElementById("multi-blind-overlay");
        if (blind) {
            document.getElementById("multi-blind-msg").innerText = `${atk.fromName}님의 공격! 3초 후 해제됩니다.`;
            blind.style.display = "flex";
            setTimeout(() => { blind.style.display = "none"; }, 3000);
        }
    }
    refreshGameModeUI();
};
// ==========================================
// 🚀 실시간 채팅 통합 엔진 (말풍선 + 카카오톡형 로그창)
// ==========================================
window.processIncomingChat = function(c) {
    // 1. 기존 머리 위 말풍선 띄우기 (선생님 채팅은 캐릭터가 없으므로 생략)
    if (c.stdId !== "TEACHER") {
        showChatBubble(c.stdId, c.text);
    }
    
    // 2. 학생용 분할 화면 우측 채팅 로그에 예쁘게 쌓기
    const slog = document.getElementById("student-chat-log");
    if (slog) {
        const isMe = c.stdId === currentUser.stdId;
        const isTeacher = c.stdId === "TEACHER";
        
        const align = isMe ? "flex-end" : "flex-start";
        const bg = isTeacher ? "#FFCDD2" : (isMe ? "#FFF59D" : "#E3F2FD"); // 교사는 빨강, 나는 노랑, 남은 파랑
        const textColor = isTeacher ? "#B71C1C" : "#333";
        const prefix = isTeacher ? "📢 " : "";
        
        slog.innerHTML += `<div style="align-self: ${align}; max-width: 85%; background: ${bg}; padding: 8px 12px; border-radius: 12px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
            <div style="font-size: 11px; color: #666; margin-bottom: 3px; font-weight:bold;">${prefix}${c.nickname}</div>
            <div style="color: ${textColor}; word-break: break-all; font-size: 14px;">${c.text}</div>
        </div>`;
        slog.scrollTop = slog.scrollHeight; // 스크롤 맨 아래로 자동 이동
    }
};

// 👨‍🏫 교사용 채팅 전송 로직
bindClick("teacher-chat-send-btn", async () => {
    const input = document.getElementById("teacher-chat-input"); 
    const text = input?.value.trim(); 
    if(!text) return;
    input.value = ""; playSound("pop");
    try { 
        await addDoc(collection(db, "lobbyChat"), { 
            stdId: "TEACHER", nickname: "👨‍🏫 선생님", text: text, 
            groupId: null, timestamp: Date.now() 
        }); 
    } catch(e) { console.error("교사 채팅 에러:", e); }
});

const tChatInput = document.getElementById("teacher-chat-input");
if(tChatInput) { tChatInput.onkeydown = (e) => { if(e.key === "Enter") document.getElementById("teacher-chat-send-btn").click(); }; }
// ==========================================
// 🚀 씬 8: 문제 만들기 모드 (출제 및 세트 자동 생성)
// ==========================================

function startCreateLogic(room) {
    createAllowedTypes = room.allowedTypes || ["multiple", "short", "order", "match"];
    myCreatedProblems = [];
    
    // 조별/개인별 문항 수 설정
    if (currentGroupingActive && currentMultiRoomGroupPlayMode === "all-sum") {
        createTargetCount = 1; // 👨‍👩‍👧‍👦 다 같이(각자 1문제씩)
    } else {
        createTargetCount = room.targetProblemCount || 3; // 👤 대표자 혼자 N문제 or 개인전 N문제
    }
    
    myCreatedProblems = new Array(createTargetCount).fill(null);
    renderCreateSlots();
    showScreen("student-create-screen");

    gameTimerInterval = setInterval(() => {
        if (globalMultiEndTime) {
            gameTimeRemaining = Math.max(0, Math.floor((globalMultiEndTime - Date.now()) / 1000));
            const m = String(Math.floor(gameTimeRemaining / 60)).padStart(2, "0"); 
            const s = String(gameTimeRemaining % 60).padStart(2, "0");
            document.getElementById("create-timer").innerText = `🕒 ${m}:${s}`;
            
if (gameTimeRemaining <= 0) {
                    clearInterval(gameTimerInterval);
                    // 🚀 폰이 멈추지 않게 팝업 띄우고 바로 강제 제출 실행
                    window.customAlert("제한 시간이 종료되었습니다!\n지금까지 만든 문제만 강제 제출됩니다.");
                    document.getElementById("create-submit-btn").click(); 
                }
        }
    }, 500);
}

function renderCreateSlots() {
    const listEl = document.getElementById("create-slot-list");
    listEl.innerHTML = "";
    
    let filledCount = 0;
    myCreatedProblems.forEach((prob, idx) => {
        const slot = document.createElement("div");
        slot.style.cssText = "background: white; border: 3px solid #ccc; border-radius: 15px; padding: 20px; text-align: center; cursor: pointer; transition: 0.2s; box-shadow: 0 4px 6px rgba(0,0,0,0.05);";
        
        if (prob === null) {
            slot.innerHTML = `<div style="font-size:35px; color:#4CAF50; font-weight:900;">+</div><div style="color:#666; font-size:16px;">${idx + 1}번 문제 만들기</div>`;
            slot.style.borderStyle = "dashed";
            slot.onclick = () => { playSound("click"); openCreateTypeSelector(idx); };
        } else {
            filledCount++;
            slot.style.borderColor = "#4CAF50";
            slot.style.background = "#E8F5E9";
            
            const typeLabels = { multiple: "📝 객관식", short: "✍️ 단답형", order: "🔄 순서 맞추기", match: "🧩 짝짓기" };
            slot.innerHTML = `
                <div style="font-size:14px; color:#388E3C; font-weight:bold; margin-bottom:5px;">${typeLabels[prob.type]}</div>
                <div style="font-size:18px; font-weight:bold; color:#333; margin-bottom:10px; word-break:keep-all;">Q. ${prob.q}</div>
                <div style="font-size:14px; color:#666;">(클릭해서 수정하기)</div>
            `;
            slot.onclick = () => { playSound("click"); openCreateEditor(idx, prob.type, prob); };
        }
        listEl.appendChild(slot);
    });

    const submitBtn = document.getElementById("create-submit-btn");
    if (filledCount === createTargetCount) {
        submitBtn.style.display = "block";
    } else {
        submitBtn.style.display = "none";
    }

    // 교사 현황판 업데이트를 위해 서버에 내 상태 전송
    if (myLobbyDocId) {
        setDoc(doc(db, "lobbyUsers", myLobbyDocId), { createdCount: filledCount, targetCount: createTargetCount }, { merge: true });
    }
}

function openCreateTypeSelector(idx) {
    currentEditingSlot = idx;
    const btnContainer = document.getElementById("create-type-buttons");
    btnContainer.innerHTML = "";
    
    const typeInfos = [
        { id: "multiple", icon: "📝", name: "객관식 (5지선다)", desc: "문제 1개, 정답 1개, 오답 4개" },
        { id: "short", icon: "✍️", name: "단답형", desc: "문제 1개, 정답 1개 (대소문자 구별 안함)" },
        { id: "order", icon: "🔄", name: "순서 맞추기", desc: "단어를 섞어두면 순서대로 맞추는 문제" },
        { id: "match", icon: "🧩", name: "짝짓기", desc: "4개의 짝을 묶어서 맞추는 게임용 문제" }
    ];

    typeInfos.forEach(info => {
        if (createAllowedTypes.includes(info.id)) {
            const btn = document.createElement("button");
            btn.style.cssText = "background: #F5F5F5; border: 2px solid #ddd; color: #333; box-shadow: 0 4px 0 #ccc; padding: 15px; margin: 0; width: 100%; text-align: left; display: flex; align-items: center; gap: 10px; line-height: 1.3;";
            btn.innerHTML = `<span style="font-size:30px;">${info.icon}</span> <div><div style="font-size:18px; font-weight:bold;">${info.name}</div><div style="font-size:12px; color:#888;">${info.desc}</div></div>`;
            btn.onclick = () => {
                playSound("click");
                document.getElementById("create-type-modal").style.display = "none";
                openCreateEditor(idx, info.id, null);
            };
            btnContainer.appendChild(btn);
        }
    });

    document.getElementById("create-type-modal").style.display = "flex";
}

bindClick("create-type-cancel-btn", () => { playSound("click"); document.getElementById("create-type-modal").style.display = "none"; });

function openCreateEditor(idx, type, existingData) {
    currentEditingSlot = idx;
    const area = document.getElementById("create-editor-dynamic-area");
    area.innerHTML = "";
    document.getElementById("create-editor-modal").setAttribute("data-type", type);
    
    const createInput = (placeholder, id, value = "") => `<input type="text" id="${id}" placeholder="${placeholder}" value="${value}" style="width:100%; box-sizing:border-box; margin-bottom:10px; font-size:16px; padding:10px; border-radius:10px; border:2px solid #2196F3;">`;
    
    if (type === "multiple") {
        area.innerHTML = `
            ${createInput("문제를 입력하세요 (예: Apple의 뜻은?)", "c-q", existingData?.q)}
            ${createInput("⭕ 정답 입력", "c-a", existingData?.a)}
            ${createInput("❌ 오답 1", "c-w1", existingData?.w1)}
            ${createInput("❌ 오답 2", "c-w2", existingData?.w2)}
            ${createInput("❌ 오답 3", "c-w3", existingData?.w3)}
            ${createInput("❌ 오답 4", "c-w4", existingData?.w4)}
        `;
    } else if (type === "short") {
        area.innerHTML = `
            ${createInput("문제를 입력하세요", "c-q", existingData?.q)}
            ${createInput("⭕ 단답형 정답 입력", "c-a", existingData?.a)}
        `;
    } else if (type === "order") {
        area.innerHTML = `
            ${createInput("질문 (예: '나는 소년이다'를 영작하세요)", "c-q", existingData?.q)}
            <p style="font-size:14px; color:#666; text-align:left; margin:0 0 5px 0;">순서대로 조합될 단어 조각들을 순서대로 적어주세요. (최소 2개, 최대 5개)</p>
            ${createInput("1번 단어 (첫 번째)", "c-o1", existingData?.words?.[0])}
            ${createInput("2번 단어", "c-o2", existingData?.words?.[1])}
            ${createInput("3번 단어", "c-o3", existingData?.words?.[2])}
            ${createInput("4번 단어", "c-o4", existingData?.words?.[3])}
            ${createInput("5번 단어 (마지막)", "c-o5", existingData?.words?.[4])}
        `;
    } else if (type === "match") {
        area.innerHTML = `
            ${createInput("문제 테마 (예: 반의어 짝짓기)", "c-q", existingData?.q)}
            <div style="display:flex; gap:10px;">${createInput("A항목", "c-m1a", existingData?.pairs?.[0]?.a)} ${createInput("A짝꿍", "c-m1b", existingData?.pairs?.[0]?.b)}</div>
            <div style="display:flex; gap:10px;">${createInput("B항목", "c-m2a", existingData?.pairs?.[1]?.a)} ${createInput("B짝꿍", "c-m2b", existingData?.pairs?.[1]?.b)}</div>
            <div style="display:flex; gap:10px;">${createInput("C항목", "c-m3a", existingData?.pairs?.[2]?.a)} ${createInput("C짝꿍", "c-m3b", existingData?.pairs?.[2]?.b)}</div>
            <div style="display:flex; gap:10px;">${createInput("D항목", "c-m4a", existingData?.pairs?.[3]?.a)} ${createInput("D짝꿍", "c-m4b", existingData?.pairs?.[3]?.b)}</div>
        `;
    }
    
    document.getElementById("create-editor-modal").style.display = "flex";
}

bindClick("create-editor-delete-btn", () => {
    playSound("click");
    if(confirm("이 문제를 삭제하시겠습니까?")) {
        myCreatedProblems[currentEditingSlot] = null;
        document.getElementById("create-editor-modal").style.display = "none";
        renderCreateSlots();
    }
});

bindClick("create-editor-save-btn", () => {
    playSound("click");
    const type = document.getElementById("create-editor-modal").getAttribute("data-type");
    let prob = { type: type };
    
    const val = (id) => document.getElementById(id)?.value.trim() || "";
    
    if (type === "multiple") {
        prob.q = val("c-q"); prob.a = val("c-a"); prob.w1 = val("c-w1"); prob.w2 = val("c-w2"); prob.w3 = val("c-w3"); prob.w4 = val("c-w4");
        if(!prob.q || !prob.a || !prob.w1 || !prob.w2 || !prob.w3 || !prob.w4) return alert("모든 빈칸을 채워주세요!");
    } else if (type === "short") {
        prob.q = val("c-q"); prob.a = val("c-a");
        if(!prob.q || !prob.a) return alert("모든 빈칸을 채워주세요!");
    } else if (type === "order") {
        prob.q = val("c-q");
        prob.words = [val("c-o1"), val("c-o2"), val("c-o3"), val("c-o4"), val("c-o5")].filter(w => w !== "");
        if(!prob.q || prob.words.length < 2) return alert("질문과 최소 2개 이상의 단어 조각을 입력하세요!");
    } else if (type === "match") {
        prob.q = val("c-q");
        prob.pairs = [ {a:val("c-m1a"), b:val("c-m1b")}, {a:val("c-m2a"), b:val("c-m2b")}, {a:val("c-m3a"), b:val("c-m3b")}, {a:val("c-m4a"), b:val("c-m4b")} ];
        if(!prob.q || prob.pairs.some(p => !p.a || !p.b)) return alert("모든 짝꿍을 4쌍 다 채워주세요!");
    }

    myCreatedProblems[currentEditingSlot] = prob;
    document.getElementById("create-editor-modal").style.display = "none";
    renderCreateSlots();
});

// 🚀 최종 제출 및 JR 보상 정산 분배 알고리즘
bindClick("create-submit-btn", async () => {
    playSound("success");
    clearInterval(gameTimerInterval);
    document.getElementById("top-left-controls").style.display = "none";
    
    showScreen("loading-screen");
    document.querySelector("#loading-screen h2").innerText = "제출 및 보상 정산 중...";

    const actualProblems = myCreatedProblems.filter(p => p !== null);
    try {
        if (myLobbyDocId) {
            await setDoc(doc(db, "lobbyUsers", myLobbyDocId), { createdProblems: actualProblems, isSubmitted: true, createdCount: actualProblems.length }, { merge: true });
        }
    } catch (e) {
        console.error("문제 제출 저장 실패:", e);
        alert("제출 저장에 실패했습니다. 와이파이를 확인한 뒤 다시 제출해 주세요.");
        showScreen("student-create-screen");
        const controls = document.getElementById("top-left-controls");
        if (controls) controls.style.display = "flex";
        return;
    }

    // 💰 보상 지급 로직 (1문제당 1000 JR)
    let totalBaseReward = actualProblems.length * 1000;
    let myDisplayReward = totalBaseReward;

    if (currentGroupingActive) {
        if (currentMultiRoomGroupPlayMode === "all-sum") {
            // 다 같이 모드 (1인 1문제 출제) -> 자기가 1000 JR 받음
            currentUser.jr += 1000;
            myDisplayReward = 1000;
            await setDoc(doc(db, "users", currentUser.stdId), { jr: currentUser.jr }, { merge: true });
        } else {
            // 대표 1인 모드 (대표가 N문제 출제 후 조원들에게 n빵 분배)
            // 🚀 [조별 정산 무한 로딩 픽스] 네트워크 오류로 멈추는 것을 방지
            try {
                const snap = await getDocs(collection(db, "lobbyUsers"));
                let groupMems = [];
                snap.forEach(d => { if(d.data().groupId === myCurrentGroupId) groupMems.push(d.data().stdId); });
                
                if (groupMems.length > 0) {
                    let perPerson = Math.floor(totalBaseReward / groupMems.length);
                    for(let sid of groupMems) {
                        try {
                            const uDoc = await getDoc(doc(db, "users", sid));
                            if(uDoc.exists()) {
                                let curJr = uDoc.data().jr || 0;
                                await setDoc(doc(db, "users", sid), { jr: curJr + perPerson }, { merge: true });
                            }
                        } catch(e) {} // 개별 유저 전송 실패 시에도 멈추지 않고 무시
                    }
                    currentUser.jr += perPerson; 
                    myDisplayReward = perPerson;
                }
            } catch(e) {
                console.error("조별 JR 분배 중 통신 오류", e);
                // 💥 실패하더라도 멈추지 않고 대표자 본인에게만이라도 돈을 줌
                currentUser.jr += totalBaseReward; 
            }
        }
    } else {
        // 개인전
        currentUser.jr += totalBaseReward;
        await setDoc(doc(db, "users", currentUser.stdId), { jr: currentUser.jr }, { merge: true });
    }

    const jrDisp = document.getElementById("user-jr-display");
    if (jrDisp) jrDisp.innerText = currentUser.jr;

    document.getElementById("create-reward-msg").innerText = `${myDisplayReward} JR 획득!`;
    showScreen("create-wait-screen");
    fireConfetti();
});

// 🚀 기다리는 동안 상점 열기 및 구매 기능 완벽 이식 (인라인)
function renderInlineShop() {
    const shopContainer = document.getElementById("inline-shop-list");
    if (!shopContainer) return;
    shopContainer.innerHTML = "";
    
    availableCharacters.forEach(charFolder => {
        let charName = charFolder; let creatorName = "알 수 없음";
        if (charFolder.includes("(") && charFolder.includes(")")) {
            const parts = charFolder.split("("); charName = parts[0].trim(); creatorName = parts[1].replace(")", "").trim(); 
        }
        const isOwned = currentUser.ownedCharacters && currentUser.ownedCharacters.includes(charFolder);
        const lockText = isOwned ? `<span style="color:#4CAF50;">보유 중 ✔️</span>` : `<span style="color:#f44336;">2000 JR 🔒</span>`;

        const card = document.createElement("div");
        card.style.cssText = "display: flex; align-items: center; justify-content: space-between; background: white; padding: 15px; border-radius: 15px; border: 3px solid #cbd5e0; width: 100%; box-sizing: border-box; cursor: pointer;";
        card.innerHTML = `
          <div style="display:flex; align-items:center; gap:15px;">
              <img src="char/${charFolder}/stand1_0.png" class="anim-avatar" style="height: 60px;">
              <div style="text-align:left;">
                  <div style="font-weight:bold; color:#333; font-size:18px;">${charName}</div>
                  <div style="font-size:12px; color:#666;">만든이: ${creatorName}</div>
              </div>
          </div>
          <div style="font-weight:bold; font-size:15px;">${lockText}</div>
        `;
        card.onclick = async () => { 
            playSound("click");
            if (isOwned) {
                currentUser.character = charFolder; 
                alert(`[${charName}] 캐릭터를 장착했습니다!`);
                renderInlineShop(); // 화면 즉시 갱신
            } else {
                if (confirm(`[${charName}] 캐릭터를 2000 JR에 구매하시겠습니까?\n(현재 내 JR: ${currentUser.jr} JR)`)) {
                    if (currentUser.jr < 2000) return alert("JR이 부족합니다! 게임을 플레이하여 JR을 더 모아오세요.");
                    currentUser.jr -= 2000;
                    currentUser.ownedCharacters.push(charFolder);
                    currentUser.character = charFolder;
                    
                    // 내 정보 DB에 갱신
                    await setDoc(doc(db, "users", currentUser.stdId), {
                        jr: currentUser.jr, ownedCharacters: currentUser.ownedCharacters, character: currentUser.character
                    }, { merge: true });
                    
                    // 원작자 수익금 발송
                    if (creatorName && creatorName !== "알 수 없음" && creatorName !== "민준쌤") {
                        await addDoc(collection(db, "royalties"), {
                            creatorName: creatorName, buyerId: currentUser.stdId, buyerName: currentUser.realName,
                            charName: charName, amount: 500, isClaimed: false, timestamp: Date.now()
                        });
                    }
                    
                    const jrDisp = document.getElementById("user-jr-display"); if(jrDisp) jrDisp.innerText = currentUser.jr;
                    alert(`🎉 구매 성공! [${charName}] 캐릭터를 장착했습니다!`);
                    renderInlineShop();
                }
            }
        };
        shopContainer.appendChild(card);
    });
}

// 상점 열기 버튼 클릭
bindClick("create-show-shop-btn", () => {
    playSound("click");
    document.getElementById("create-show-shop-btn").style.display = "none";
    document.getElementById("inline-shop-container").style.display = "flex";
    renderInlineShop();
});

// 상점 닫기 버튼 클릭
bindClick("close-inline-shop-btn", () => {
    playSound("click");
    document.getElementById("inline-shop-container").style.display = "none";
    document.getElementById("create-show-shop-btn").style.display = "block";
});
// ==========================================
// 🚀 씬 9: 학생 출제 세트 - 무한 퀴즈 모드 (다형성 엔진)
// ==========================================
let ciCurrentProb = null;

function updateCiUI() {
  const m = String(Math.floor(gameTimeRemaining / 60)).padStart(2, "0"); const s = String(gameTimeRemaining % 60).padStart(2, "0");
  document.getElementById("ci-timer").innerText = `🕒 ${m}:${s}`; 
  
  // 🌟 보스전일 때는 데미지로, 일반 게임일 때는 점수로 글자가 바뀝니다!
  if (typeof isBossRaid !== "undefined" && isBossRaid) {
      document.getElementById("ci-score").innerHTML = `내 총 데미지: ${gameScore}`; 
  } else {
      document.getElementById("ci-score").innerHTML = `점수: ${gameScore}${getGroupScoreText()}`; 
  }
  
  if (currentGameMode === "custom_infinite" || currentGameMode === "boss") window.syncScoreToServer();
}

function startCustomInfiniteLogic() {
  wordList = (wordList || []).filter(w => {
    try { JSON.parse(w.en); return true; } catch(e) { return false; }
  });
  if (wordList.length === 0) {
    alert("진행할 학생 출제 문제가 없습니다. 선생님께 다시 세트를 선택해 달라고 알려 주세요.");
    showScreen("multi-lobby-screen");
    return;
  }
  updateCiUI();
  gameTimerInterval = setInterval(() => {
    if (globalMultiEndTime) {
       gameTimeRemaining = Math.max(0, Math.floor((globalMultiEndTime - Date.now()) / 1000)); updateCiUI();
       if (gameTimeRemaining <= 0) { clearInterval(gameTimerInterval); currentUser.score = gameScore; document.getElementById("result-detail").innerText = `제한 시간 종료! 총 획득 점수입니다!`; goResult(); }
    }
  }, 500); 
  loadNextCiQuiz();
}

function loadNextCiQuiz() {
  const wordObj = wordList[Math.floor(Math.random() * wordList.length)];
  try {
    ciCurrentProb = JSON.parse(wordObj.en);
  } catch(e) {
    console.error("학생 출제 문제 파싱 실패:", e);
    wordList = wordList.filter(w => w !== wordObj);
    if (wordList.length === 0) {
      alert("남아 있는 학생 출제 문제가 없습니다. 대기실로 돌아갑니다.");
      showScreen("multi-lobby-screen");
      return;
    }
    loadNextCiQuiz();
    return;
  }
  
  document.getElementById("ci-author-badge").innerText = wordObj.author;
  const box = document.getElementById("ci-question-box");

  // 🚀 문제 유형별 친절한 안내 문구 추가
  let instruction = "";
  if (ciCurrentProb.type === "multiple") instruction = "📝 알맞은 정답을 하나 고르세요.";
  else if (ciCurrentProb.type === "short") instruction = "✍️ 빈칸에 들어갈 정답을 직접 입력하세요.";
  else if (ciCurrentProb.type === "order") instruction = "🔄 단어 조각을 올바른 순서대로 클릭하세요.";
  else if (ciCurrentProb.type === "match") instruction = "🧩 서로 연관된 짝을 모두 찾아 맞추세요.";

  // 🚀 Q. 글자 제거 및 레이아웃 수정 (테스트 시 '5'라고 치면 Q.5로 보여 헷갈리던 부분 해결!)
  box.innerHTML = `
    <div style="display:flex; flex-direction:column; align-items:center; width:100%;">
      <div style="font-size:16px; color:#9C27B0; margin-bottom:15px; font-weight:bold; padding: 5px 15px; background: rgba(255,255,255,0.6); border-radius: 10px; border: 2px dashed #E1BEE7;">${instruction}</div>
      <div style="font-size:26px; color:#333; font-weight:900; word-break:keep-all; line-height:1.4;">${ciCurrentProb.q}</div>
    </div>
  `;
  
  box.classList.remove("sq-fly-in"); void box.offsetWidth; box.classList.add("sq-fly-in");

  const area = document.getElementById("ci-dynamic-area"); area.innerHTML = "";

  if(ciCurrentProb.type === "multiple") {
      let opts = [ciCurrentProb.a, ciCurrentProb.w1, ciCurrentProb.w2, ciCurrentProb.w3, ciCurrentProb.w4].sort(()=>0.5-Math.random());
      opts.forEach(opt => {
          let btn = document.createElement("button"); btn.className = "sq-btn sq-fly-in"; 
          // 🚀 파란색 배경에 맞는 파란색 그림자(#1976D2) 추가!
          btn.style.cssText = "width:100%; height:60px; font-size:18px; background:#2196F3; box-shadow:0 6px 0 #1976D2; margin:5px 0 !important; border-radius:12px; padding:10px;"; 
          btn.innerText = opt;
          btn.onclick = () => handleCiAnswer(opt === ciCurrentProb.a, ciCurrentProb.a); area.appendChild(btn);
      });
  } else if(ciCurrentProb.type === "short") {
      let inp = document.createElement("input"); inp.type = "text"; inp.placeholder = "정답 입력 후 엔터"; inp.style.cssText = "width:100%; box-sizing:border-box;";
      let btn = document.createElement("button"); btn.innerText = "제출하기"; btn.className="sq-btn sq-fly-in"; 
      // 🚀 초록색 배경에 맞는 초록색 그림자(#388E3C) 추가!
      btn.style.cssText = "width:100%; background:#4CAF50; box-shadow:0 6px 0 #388E3C;";
      btn.onclick = () => handleCiAnswer(inp.value.trim().toLowerCase() === ciCurrentProb.a.toLowerCase(), ciCurrentProb.a);
      inp.onkeydown = (e) => { if(e.key === "Enter") btn.click(); };
      area.appendChild(inp); area.appendChild(btn); setTimeout(()=>inp.focus(), 100);
  } else if(ciCurrentProb.type === "order") {
      let expectedOrder = [...ciCurrentProb.words]; let shuffled = [...ciCurrentProb.words].sort(()=>0.5-Math.random()); let currentStep = 0;
      let container = document.createElement("div"); container.style.cssText="display:flex; flex-wrap:wrap; gap:10px; justify-content:center; width:100%;";
      shuffled.forEach(w => {
          let btn = document.createElement("button"); btn.className="sq-btn sq-fly-in"; 
          // 🚀 주황색 배경에 맞는 주황색 그림자(#F57C00) 추가!
          btn.style.cssText="width:auto; min-width:80px; height:50px; font-size:16px; padding:10px; margin:0 !important; background:#FF9800; box-shadow:0 6px 0 #F57C00;"; 
          btn.innerText = w;
          btn.onclick = () => {
              if(btn.disabled || isGamePaused) return; playSound("pop");
              if(w === expectedOrder[currentStep]) {
                  btn.disabled = true; btn.style.background = "#aaa"; btn.style.boxShadow="none"; btn.style.transform="scale(0.9)"; currentStep++;
                  if(currentStep === expectedOrder.length) handleCiAnswer(true, expectedOrder.join(" "));
              } else { handleCiAnswer(false, expectedOrder.join(" ")); }
          }; container.appendChild(btn);
      }); area.appendChild(container);
  } else if(ciCurrentProb.type === "match") {
      let all = []; ciCurrentProb.pairs.forEach(p => { all.push({t:p.a, m:p.b}, {t:p.b, m:p.a}); }); all.sort(()=>0.5-Math.random());
      let selected = null; let matchedCount = 0;
      let container = document.createElement("div"); container.style.cssText="display:flex; flex-wrap:wrap; gap:8px; justify-content:center; width:100%;";
      all.forEach(item => {
          let btn = document.createElement("button"); btn.className="sq-btn sq-fly-in"; 
          // 🚀 보라색 배경에 맞는 보라색 그림자(#7B1FA2) 추가!
          btn.style.cssText="width:45%; height:60px; font-size:15px; margin:0 !important; background:#9C27B0; box-shadow:0 6px 0 #7B1FA2;"; 
          btn.innerText = item.t;
          btn.onclick = () => {
              if(btn.disabled || isGamePaused) return; playSound("pop");
              if(!selected) { selected = {btn, item}; btn.style.background="#E91E63"; btn.style.boxShadow="0 6px 0 #C2185B"; }
              else {
                  if(selected.btn === btn) { selected.btn.style.background="#9C27B0"; selected.btn.style.boxShadow="0 6px 0 #7B1FA2"; selected = null; return; }
                  if(selected.item.m === item.t) {
                      btn.disabled=true; selected.btn.disabled=true; btn.style.opacity="0"; selected.btn.style.opacity="0"; matchedCount++; selected = null;
                      if(matchedCount === 4) setTimeout(()=>handleCiAnswer(true, "짝짓기 완료!"), 300);
                  } else {
                      selected.btn.style.background="#9C27B0"; selected.btn.style.boxShadow="0 6px 0 #7B1FA2"; selected = null;
                      btn.classList.add("wrong"); setTimeout(()=>btn.classList.remove("wrong"), 400);
                  }
              }
          }; container.appendChild(btn);
      }); area.appendChild(container);
  }
}

function handleCiAnswer(isCorrect, answerText) {
    if(isGamePaused) return;
    if(isCorrect) {
        playSound("success"); let earned = calcSpeedBonus(); gameScore += earned; updateCiUI(); showGamePraise(earned);
        if(Math.random() < 0.3) triggerTreasureEvent(() => loadNextCiQuiz()); else loadNextCiQuiz();
    } else {
        playSound("wrong"); isGamePaused = true; let pen = calcSpeedBonus(); gameScore -= pen; updateCiUI();
        const po = document.getElementById("sq-penalty-overlay"); document.getElementById("sq-penalty-text").innerText=`틀렸어요... -${pen}점`; document.getElementById("sq-penalty-answer").innerText=`정답: ${answerText}`; po.style.display="flex";
        let c=3; document.getElementById("sq-countdown").innerText=c;
        // 🚀 픽스: 타이머 변수를 전역(cdInterval)으로 묶어서 게임 종료 시 안전하게 동시 파괴되도록 보완!
        clearInterval(cdInterval);
        cdInterval = setInterval(()=>{c--; if(c>0){document.getElementById("sq-countdown").innerText=c; playSound("click");} else {clearInterval(cdInterval); po.style.display="none"; isGamePaused=false; loadNextCiQuiz();}}, 1000);
    }
}
// ==========================================
// 👻 유령 플레이어 퇴마(방지 및 강퇴) 시스템
// ==========================================

// 1. 브라우저 강제 종료 시 최대한 서버에 퇴장 신호 쏘기 시도
window.addEventListener("beforeunload", () => {
    if (myLobbyDocId) {
        // 비동기 통신이지만 브라우저가 꺼지기 직전에 최대한 삭제를 시도합니다.
        deleteDoc(doc(db, "lobbyUsers", myLobbyDocId)).catch(e => e);
    }
});

// 2. 선생님의 철퇴 (교사용 대기실에서 유령 클릭 시 즉시 삭제)
window.kickPlayer = async function(docId, nickname) {
    if (!isTeacherMode) return;
    playSound("click");
    if(confirm(`🚨 [${nickname}] 학생을 대기실에서 강제로 내보내시겠습니까?\n(나간 학생의 유령 데이터를 청소할 때 사용하세요.)`)) {
        try {
            await deleteDoc(doc(db, "lobbyUsers", docId));
        } catch(e) {
            console.error(e);
        }
    }
};
// 💔 교사용: 현재 편성된 조 강제 해제하기
bindClick("teacher-disband-group-btn", async () => {
    playSound("click");
    if(confirm("🚨 현재 편성된 모든 조를 해제하고 '개인전 모드'로 돌아가시겠습니까?\n(아이들의 화면이 다시 개인 모드로 전환됩니다.)")) {
        // 1. 방 상태 리셋
        await setDoc(doc(db, "gameData", "multiRoom"), { groupingActive: false, groupPlayMode: null, groupCount: null }, { merge: true });
        
        // 2. 접속 중인 모든 학생의 소속 조(groupId) 데이터 삭제
        const snap = await getDocs(collection(db, "lobbyUsers"));
        snap.forEach(d => {
            setDoc(doc(db, "lobbyUsers", d.id), { groupId: null }, { merge: true }).catch(e=>e);
        });
        
        alert("모든 조편성이 해제되었습니다! 이제 개인전으로 게임을 진행할 수 있습니다.");
    }
});
// ==========================================
// 🚀 씬 10: 캐릭터 쇼케이스 (반값 할인 이벤트) 시스템
// ==========================================

bindClick("teacher-showcase-btn", () => {
    playSound("click");
    const list = document.getElementById("showcase-char-list");
    list.innerHTML = "";
    availableCharacters.forEach(charFolder => {
        let charName = charFolder.split("(")[0].trim();
        const btn = document.createElement("button");
        btn.innerHTML = getAvatarHtml(charFolder, "50px") + `<div style="font-size:14px; margin-top:10px; font-weight:bold;">${charName}</div>`;
        btn.style.cssText = "display:flex; flex-direction:column; align-items:center; padding: 15px; background: white; border: 3px solid #ddd; border-radius: 15px; color: #333; cursor: pointer; width: 110px; transition:0.2s; box-shadow: 0 4px 6px rgba(0,0,0,0.1);";
        btn.onmouseover = () => btn.style.borderColor = "#FF9800";
        btn.onmouseout = () => btn.style.borderColor = "#ddd";
        btn.onclick = async () => {
            playSound("pop");
            document.getElementById("showcase-select-modal").style.display = "none";
            // 기존 게임과 완벽 분리된 'showcase'라는 새로운 채널 오픈
            await setDoc(doc(db, "gameData", "multiRoom"), { 
                status: "playing", 
                gameMode: "showcase", 
                showcaseChar: charFolder 
            }, { merge: true });
        };
        list.appendChild(btn);
    });
    document.getElementById("showcase-select-modal").style.display = "flex";
});

bindClick("showcase-cancel-btn", () => {
    playSound("click"); document.getElementById("showcase-select-modal").style.display = "none";
});

bindClick("teacher-showcase-end-btn", async () => {
    playSound("click");
    await setDoc(doc(db, "gameData", "multiRoom"), { status: "waiting" }, { merge: true });
});

window.startShowcaseLogic = function(charFolder) {
    isGamePaused = true; // 아이들 폰이 이상하게 터치되는 것을 방지
    let charName = charFolder; let creatorName = "알 수 없음";
    if (charFolder.includes("(") && charFolder.includes(")")) {
        const parts = charFolder.split("("); charName = parts[0].trim(); creatorName = parts[1].replace(")", "").trim(); 
    }

    if (isTeacherMode) {
        showScreen("teacher-showcase-screen");
        document.getElementById("teacher-showcase-avatar").innerHTML = getAvatarHtml(charFolder, "120px");
        document.getElementById("teacher-showcase-name").innerText = charName;
        playSound("treasure"); 
        fireConfetti();
    } else {
        showScreen("student-showcase-screen");
        document.getElementById("student-showcase-avatar").innerHTML = getAvatarHtml(charFolder, "100px");
        document.getElementById("student-showcase-name").innerText = charName;
        document.getElementById("student-showcase-creator").innerText = "만든이: " + creatorName;
        
        const actionContainer = document.getElementById("student-showcase-action");
        const isOwned = currentUser.ownedCharacters && currentUser.ownedCharacters.includes(charFolder);
        
        if (isOwned) {
            actionContainer.innerHTML = `<div style="color: #4CAF50; font-weight: bold; font-size: 20px; padding: 15px; border: 2px dashed #4CAF50; border-radius: 10px;">이미 보유 중인 캐릭터입니다!</div>`;
        } else {
            actionContainer.innerHTML = `<button id="buy-showcase-btn" style="background: #E91E63; border: none; border-radius: 20px; box-shadow: 0 6px 0 #C2185B; color: white; width: 100%; font-weight: bold; cursor: pointer; font-size: 22px; margin: 0; padding: 15px;">1000 JR 구매하기</button>`;
            
            // 버튼 생성 직후 클릭 이벤트 할당
            setTimeout(() => {
                const buyBtn = document.getElementById("buy-showcase-btn");
                if(buyBtn) {
                    buyBtn.onclick = async () => {
                        playSound("click");
                        if (currentUser.jr < 1000) return alert("JR이 부족합니다!");
                        
                        currentUser.jr -= 1000;
                        currentUser.ownedCharacters.push(charFolder);
                        
                        // 1. 내 DB 업데이트
                        await setDoc(doc(db, "users", currentUser.stdId), {
                            jr: currentUser.jr, ownedCharacters: currentUser.ownedCharacters
                        }, { merge: true });
                        
                        // 2. 원작자 로열티 지급
                        if (creatorName && creatorName !== "알 수 없음" && creatorName !== "민준쌤") {
                            await addDoc(collection(db, "royalties"), {
                                creatorName: creatorName, buyerId: currentUser.stdId, buyerName: currentUser.realName,
                                charName: charName, amount: 500, isClaimed: false, timestamp: Date.now()
                            });
                        }
                        
                        // 3. (중요) 쇼케이스 즉시 장착 & 대기실 프로필 실시간 반영
                        if (myLobbyDocId) {
                            currentUser.character = charFolder;
                            await setDoc(doc(db, "lobbyUsers", myLobbyDocId), { character: charFolder }, { merge: true });
                        }
                        
                        alert(`🎉 반값 할인 구매 성공! [${charName}] 획득!\n(대기실로 돌아가면 즉시 아바타가 변경됩니다.)`);
                        actionContainer.innerHTML = `<div style="color: #4CAF50; font-weight: bold; font-size: 20px; padding: 15px; border: 2px dashed #4CAF50; border-radius: 10px;">구매 완료!</div>`;
                        fireConfetti();
                    };
                }
            }, 100);
        }
    }
};
// ==========================================
// 🎵 11. 교사 전용 스마트 BGM 엔진 (랜덤 게임 음악 지원 버전)
// ==========================================
const bgmPlayer = new Audio();
bgmPlayer.loop = true; // 무한 반복 재생
bgmPlayer.volume = 0.4; // 배경음악이므로 목소리를 가리지 않게 볼륨 40% 설정

// 🚀 여러 개의 게임용 BGM 리스트 (파일을 더 추가하시면 여기에 줄표표기하여 이름을 계속 적어주시면 됩니다!)
const gameBgmList = [
    "bgm/game1.mp3",
    "bgm/game2.mp3"
    //"bgm/game3.mp3",
    //"bgm/game4.mp3",
    //"bgm/game5.mp3"
];

window.playTeacherBGM = function(mode) {
    // 🛡️ [핵심 방어막] 학생 기기이거나 음소거 상태면 절대 BGM을 틀지 않습니다!
    if (!isTeacherMode || isMuted) return; 

    let trackSrc = "";
    let isGameMode = false;

    // 1. 상황별 고정 BGM 처리
    if (mode === "lobby" || mode === "waiting") trackSrc = "bgm/lobby.mp3";
    else if (mode === "create") trackSrc = "bgm/create.mp3";
    else if (mode === "highfive") trackSrc = "bgm/highfive.mp3";
    else if (mode === "showcase") trackSrc = "bgm/showcase.mp3";
    else if (mode === "boss") trackSrc = "bgm/boss.mp3";
    // 2. 그 외 실제 게임을 플레이하는 모드인지 판정
    else if (mode === "speed" || mode === "speed-match" || mode === "chunk" || (mode && mode.startsWith("custom_"))) {
        isGameMode = true; 
    }
    
    // 3. 게임 모드일 경우 랜덤 BGM 처리 엔진
    if (isGameMode) {
        // 이미 랜덤 게임 음악 중 하나가 재생 중이라면, 중간에 노래가 뚝 끊기거나 다시 시작되지 않도록 유지합니다.
        const isPlayingGameMusic = gameBgmList.some(bgm => bgmPlayer.src.includes(bgm));
        if (isPlayingGameMusic && !bgmPlayer.paused) {
            return; 
        }
        // 새로운 게임을 시작할 때, 리스트에서 무작위로 하나를 뽑아서 틀어줍니다!
        trackSrc = gameBgmList[Math.floor(Math.random() * gameBgmList.length)];
    }

    // 4. 실제 재생 실행
    if (trackSrc) {
        if (bgmPlayer.src.includes(trackSrc) && !bgmPlayer.paused) return; // 이미 재생 중인 곡이면 무시 (부드러운 이어짐)
        bgmPlayer.src = trackSrc;
        bgmPlayer.play().catch(e => console.warn("브라우저 정책으로 BGM 재생 대기됨"));
    } else {
        bgmPlayer.pause();
    }
};

window.stopTeacherBGM = function() {
    bgmPlayer.pause();
};

// 기존의 '음소거 버튼(🔊/🔇)'을 눌렀을 때 BGM도 같이 꺼지고 켜지도록 연동
const oldMuteBtn = document.getElementById("mute-btn");
if(oldMuteBtn) {
    oldMuteBtn.addEventListener("click", () => {
        if (isMuted) {
            stopTeacherBGM();
        } else if (isTeacherMode) {
            playTeacherBGM(currentGameMode || "lobby");
        }
    });
}
// 📢 보스 전용 사운드 재생 함수 (HTML 수정 필요 없음!)
function playBossSound(soundName) {
    const audio = new Audio(`boss/${soundName}.mp3`); // 만약 원본 파일이 wav면 .wav로 수정해주세요!
    audio.volume = 0.4; // 🚀 [볼륨 픽스] 효과음이 너무 크지 않게 40%로 일괄 고정합니다! (더 줄이려면 0.3 등으로 변경)
    audio.play().catch(e => console.log("효과음 재생 에러:", e));
}
// ==========================================
// 👹 보스 레이드 코어 엔진 (등장 연출 & 인공지능 패턴 + 유령화 방지)
// ==========================================
let bossInterval = null;
let bossDamageQueue = []; 
let isBossDefeated = false;
let previousPlayerScores = {};
let bossSpriteTimer = null;
let bossPatternTimeout = null; 
let bossX = -100; 
window.isTeacherBossMatchRunning = false; // 🌟 핵심: 보스가 여러 마리 겹치는 것 완벽 방지!

// 제공된 스프라이트 설정
const bossSprites = {
    idle: { url: "boss/Golem/Golem_1_idle.png", frames: 8 },
    walk: { url: "boss/Golem/Golem_1_walk.png", frames: 10 },
    attack: { url: "boss/Golem/Golem_1_attack.png", frames: 11 },
    hurt: { url: "boss/Golem/Golem_1_hurt.png", frames: 4 },
    die: { url: "boss/Golem/Golem_1_die.png", frames: 12 }
};

// 강제 종료 버튼 연결
bindClick("teacher-boss-abort-btn", async () => {
    playSound("click");
    if(confirm("진행 중인 보스전을 강제로 종료하시겠습니까?")) {
        await endBossMatch(false); // 타임오버 처리로 강제종료
    }
});

function playBossAnimation(state, speedMs = 100, loop = true) {
    clearInterval(bossSpriteTimer);
    const spriteEl = document.getElementById("boss-sprite");
    if (!spriteEl) return;

    const anim = bossSprites[state];
    spriteEl.style.backgroundImage = `url('${anim.url}')`;
    spriteEl.style.backgroundSize = `${anim.frames * 100}% 100%`;
    spriteEl.style.imageRendering = "pixelated"; 

    let frame = 0;
    const boxWidth = spriteEl.clientWidth; // 현재 보스 박스의 정확한 픽셀 크기 (예: 400px)
    
    // 🚀 첫 프레임 즉시 고정 (초기화)
    spriteEl.style.backgroundPosition = "0px 0px";

    bossSpriteTimer = setInterval(() => {
        frame++;
        if (frame >= anim.frames) {
            if (!loop) { clearInterval(bossSpriteTimer); return; }
            frame = 0;
        }
        // 🚀 % 대신 '정확한 픽셀(px)' 단위로 필름을 넘깁니다! 
        // 0px -> -400px -> -800px 로 이동하며 절대 미끄러지지(흘러가지) 않습니다.
        spriteEl.style.backgroundPosition = `-${frame * boxWidth}px 0px`;
    }, speedMs);
}

window.setupTeacherBossMatch = function(roomData) {
    if (window.isTeacherBossMatchRunning) return; 
    window.isTeacherBossMatchRunning = true;
    // 🚀 [이모지 퇴근 픽스] 보스전 시작 시 렉을 유발하는 이모지 상자를 아예 숨겨버립니다.
    const emojiBox = document.getElementById("emoji-container");
    if (emojiBox) emojiBox.style.display = "none";
    showScreen("teacher-boss-screen");
    isBossDefeated = false;
    bossDamageQueue = [];
    previousPlayerScores = {};
    bossX = 0; // 🚀 정중앙 정렬
    
    document.getElementById("boss-outro-overlay").style.display = "none";
    document.getElementById("boss-hp-fill").style.width = "100%";
    document.getElementById("boss-hp-text").innerText = `${roomData.bossMaxHp} / ${roomData.bossMaxHp}`;
    
    const introOverlay = document.getElementById("boss-intro-overlay");
    const containerEl = document.getElementById("boss-sprite-container"); // 🚀 위치 이동용 부모
    const spriteEl = document.getElementById("boss-sprite"); // 🚀 방향 뒤집기용 자식
    
    introOverlay.style.display = "none";
    playSound("treasure");
    
    // 🌟 1. 보스를 하늘 위로 숨겨둠 (지붕 뚫고 대기)
    containerEl.style.transition = "none";
    containerEl.style.bottom = "110vh"; 
    containerEl.style.left = "50%";
    spriteEl.style.transform = "scaleX(1)"; // 정면 바라보기
    playBossAnimation("idle", 150, true);
    
    // 🌟 2. 부드럽고 묵직하게 땅으로 가속 낙하 (쿵!)
    setTimeout(() => {
        containerEl.style.transition = "bottom 0.7s cubic-bezier(0.6, -0.28, 0.735, 0.045)";
        containerEl.style.bottom = "15vh"; // 바닥 안착 위치
    }, 100);

    // 🌟 3. 바닥에 닿았을 때 화면 진동 및 암전 오버레이 등장
    setTimeout(() => {
        playSound("pop"); 
        const screen = document.getElementById("teacher-boss-screen");
        screen.classList.add("shake-screen-effect"); // 화면 전체 진동
        setTimeout(() => screen.classList.remove("shake-screen-effect"), 500);

        introOverlay.style.display = "flex";
        
        // 🌟 4. 3.5초 뒤 인트로 종료 및 본 게임(AI 패턴) 가동
        setTimeout(() => {
            introOverlay.style.display = "none";
            containerEl.style.transition = "left 2s linear";
            startBossGameLoop(roomData.endTime, roomData.bossMaxHp);
            runBossAIPattern(); 
        }, 3500);
    }, 800);
};

// 🤖 보스 움직임 인공지능 (무한 루프)
async function runBossAIPattern() {
    const containerEl = document.getElementById("boss-sprite-container");
    const spriteEl = document.getElementById("boss-sprite");
    
    while (!isBossDefeated && window.isTeacherBossMatchRunning) {
        // 1. 가만히 숨쉬기
        playBossAnimation("idle", 150, true);
        const idleTime = Math.random() * 2000 + 2000;
        await new Promise(r => { bossPatternTimeout = setTimeout(r, idleTime); });
        if(isBossDefeated || !window.isTeacherBossMatchRunning) break;
        
        // 2. 우측으로 걸어가기
        playBossAnimation("walk", 120, true);
        spriteEl.style.transform = "scaleX(1)"; // 🚀 자식이 방향 전환 (종이처럼 꼬이지 않고 즉시 휙!)
        bossX += 150; 
        containerEl.style.left = `calc(50% + ${bossX}px)`; // 🚀 부모만 부드럽게 위치 이동
        await new Promise(r => { bossPatternTimeout = setTimeout(r, 2000); });
        if(isBossDefeated || !window.isTeacherBossMatchRunning) break;
        
// 3. 학교 공격!
        playBossAnimation("attack", 100, false);
        const roars = ["boss_roar_1", "boss_roar_2", "boss_roar_3"];
        playBossSound(roars[Math.floor(Math.random() * roars.length)]); // 🚀 3가지 포효음 중 랜덤 재생!
        await new Promise(r => { bossPatternTimeout = setTimeout(r, 1500); });
        
        // 4. 뒤로 물러나기 (좌측으로 이동)
        playBossAnimation("walk", 120, true);
        spriteEl.style.transform = "scaleX(-1)"; // 🚀 자식이 방향 전환 (즉시 휙!)
        bossX -= 150; 
        containerEl.style.left = `calc(50% + ${bossX}px)`; 
        await new Promise(r => { bossPatternTimeout = setTimeout(r, 2000); });
        if(isBossDefeated || !window.isTeacherBossMatchRunning) break;
        
        spriteEl.style.transform = "scaleX(1)"; // 방향 원래대로 복구
    }
}

function startBossGameLoop(endTime, maxHp) {
    let currentHp = maxHp;
    
    // 🚀 [원샷킬 버그 완벽 픽스] 보스 체력 루프 시작 시점에, 학생들의 이전 점수를 '현재 서버 점수'로 정확히 리셋!
    // 이렇게 해야 시작 전에 누적된 옛날 점수(유령 딜)가 보스에게 한꺼번에 들어가는 현상을 막습니다.
    if (window.globalLobbyPlayers) {
        window.globalLobbyPlayers.forEach(p => {
            previousPlayerScores[p.stdId] = p.score || 0;
        });
    }
    
    clearInterval(bossInterval);
    bossInterval = setInterval(() => {
        if (isBossDefeated || !window.isTeacherBossMatchRunning) return;

        const remaining = Math.max(0, Math.floor((endTime - Date.now()) / 1000));
        const m = String(Math.floor(remaining / 60)).padStart(2, "0");
        const s = String(remaining % 60).padStart(2, "0");
        document.getElementById("boss-timer").innerText = `🕒 ${m}:${s}`;
        
        if (remaining <= 0) {
            endBossMatch(false);
            return;
        }

        let totalDamageThisTick = 0;
        if (window.globalLobbyPlayers) {
            window.globalLobbyPlayers.forEach(p => {
                const prev = previousPlayerScores[p.stdId] || 0;
                const curr = p.score || 0;
                const diff = curr - prev;
                if (diff > 0) {
                    totalDamageThisTick += diff;
                    bossDamageQueue.push({ amount: diff, name: p.nickname });
                    previousPlayerScores[p.stdId] = curr;
                }
            });
        }

        if (totalDamageThisTick > 0) {
            currentHp -= totalDamageThisTick;
            if (currentHp <= 0) currentHp = 0;
            
            const hpPercent = Math.max(0, (currentHp / maxHp) * 100);
            document.getElementById("boss-hp-fill").style.width = `${hpPercent}%`;
            document.getElementById("boss-hp-text").innerText = `${currentHp} / ${maxHp}`;
            
            if (currentHp <= 0) endBossMatch(true); 
        }
    }, 1000); 

    const effectInterval = setInterval(() => {
        if (isBossDefeated || !window.isTeacherBossMatchRunning) { clearInterval(effectInterval); return; }
        if (bossDamageQueue.length > 0) {
            const hit = bossDamageQueue.shift();
            spawnDamageFloater(hit.amount, hit.name);
            
            const spriteEl = document.getElementById("boss-sprite");
            // 🚀 안전한 피격 애니메이션으로 변경 (순간이동 박멸!)
            spriteEl.classList.remove("boss-hit-anim");
            void spriteEl.offsetWidth;
            spriteEl.classList.add("boss-hit-anim");
            
            playBossAnimation("hurt", 100, false);
            setTimeout(() => { if(!isBossDefeated) playBossAnimation("idle", 150, true); }, 400);
            
            const hits = ["boss_hit_1", "boss_hit_2", "boss_hit_3"];
            playBossSound(hits[Math.floor(Math.random() * hits.length)]); // 🚀 3가지 타격음 중 찰지게 랜덤 재생!
        }
    }, 150);
}

function spawnDamageFloater(amount, name) {
    const arena = document.getElementById("boss-arena");
    const floater = document.createElement("div");
    floater.className = "damage-floater";
    floater.innerHTML = `<span class="damage-amount">-${amount}</span><span class="damage-player">${name}</span>`;
    
    const offsetX = (Math.random() - 0.5) * 250;
    const offsetY = -Math.random() * 100 - 150;
    floater.style.left = `calc(50% + ${offsetX}px)`;
    floater.style.top = `calc(100% + ${offsetY}px)`;
    
    arena.appendChild(floater);
    setTimeout(() => floater.remove(), 1000); 
}

async function endBossMatch(isVictory) {
    if (isBossDefeated) return; 
    isBossDefeated = true;
    window.isTeacherBossMatchRunning = false; 
    
    clearInterval(bossInterval);
    clearTimeout(bossPatternTimeout); 
    
    const spriteEl = document.getElementById("boss-sprite");
    // 🚀 부모/자식 분리에 따른 안전한 초기화
    spriteEl.style.transform = `scaleX(1)`; 

const outroTitle = document.getElementById("boss-outro-title");
    if (isVictory) {
        playBossSound("boss_die"); // 🚀 보스 쓰러지는 효과음 추가!
        playBossAnimation("die", 150, false);
        outroTitle.innerText = "보스 격파 성공!!";
        outroTitle.style.color = "#4CAF50";
    } else {
        playBossAnimation("attack", 150, true);
        outroTitle.innerText = "타임 오버... 방어 실패";
        outroTitle.style.color = "#F44336";
    }

    const outro = document.getElementById("boss-outro-overlay");
    outro.style.display = "flex";
    
    setTimeout(async () => {
        await setDoc(doc(db, "gameData", "multiRoom"), { status: "waiting" }, { merge: true });
    }, 3500);
}