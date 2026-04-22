//1. 파이어베이스 라이브러리 불러오기
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-app.js";
import { getFirestore, doc, setDoc, getDoc, collection, addDoc, getDocs } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-firestore.js";

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

const allEmojis = ["🎮", "🕹️", "🎲", "🎯", "🐶", "🐱", "🍓", "😎", "🤩", "🚀", "🌟", "🔥", "🦄", "🍀", "🍔", "👽","😀","😂","😍","🥳","👻","🤡","🤗","🤔","🤐","🐭","🐹","🐰","🦊","🐻","🐼","🐨","🐯","🦁","🐮","🐷","🐸","🐵","🐧","🐤","🦆","🦉","🦇","🐺","🐝","🦋","🐢","🐍","🦖","🐙","🦑","🦀","🐠","🐬","🐳","🦈","🐅","🦓","🦍","🐘","🐫","🦒","🦘","🐎","🐏","🐐","🦌","🐕","🐈","🦚","🦜","🦢","🦩","🕊","🦝","🦨","🦥","🐿","🦔","🐉","🍎","🍊","🍋","🍌","🍉","🍇","🫐","🍒","🍑","🍍","🥥","🥝","🍅","🥑","🥦","🥒","🌶","🌽","🥕","🥔","🍠","🥐","🍞","🥨","🧀","🍳","🥞","🥓","🥩","🍗","🌭","🍟","🍕","🥪","🌮","🥗","🍣","🍱","🥟","🍤","🍙","🍚","🍧","🍦","🍰","🎂","🍭","🍬","🍫","🍩","🍪","🍯","🍼","☕️","🧃","🥤","🍺","🍻","🥂","🍷","🥃","🧊","⚽️","🏀","🏈","⚾️","🎾","🏐","🏓","🏸","🥊","🛹","⛸","🎿","🏂","🏋️","🏄","🏊","🚴","🏆","🥇","🏅","🎟","🎪","🎭","🎨","🎬","🎤","🎧","🎹","🥁","🎸","🎳","🎰","🧩","🚗","🚓","🚑","🚒","🚜","🚲","🛵","🏍","✈️","🚁","⛵️","🛳","🗺","🗽","🏰","🎡","🎢","⛺️","🏠","🏢","🏥","🏦","🏫","⛪️","🌅","🌌","⌚️","📱","💻","⌨️","🖥","📷","📸","🎥","📞","☎️","📺","📻","⏱","⏰","⏳","💡","💸","💵","💰","💳","💎","🛠","🔫","💣","🪄"];
const praises = ["Fabulous!", "Terrific!", "Awesome!", "Incredible!", "Great Job!", "Perfect!"];

//4. 배경색 및 오디오 설정
const pastelColors = [{ hex: "#FFE4E1" }, { hex: "#FFF0E6" }, { hex: "#FFFACD" }, { hex: "#E8F8F5" }, { hex: "#E1F5FE" }, { hex: "#F3E5F5" }, { hex: "#FBE9E7" }, { hex: "#E0F2F1" }, { hex: "#FCF3CF" }, { hex: "#E8EAF6" }];
const pickedColor = pastelColors[Math.floor(Math.random() * pastelColors.length)];
document.body.style.backgroundColor = pickedColor.hex;
document.querySelectorAll(".screen").forEach((s) => {
  if (s.id !== "fishing-screen" && s.id !== "memory-screen" && s.id !== "speed-screen" && s.id !== "speed-match-screen") s.style.backgroundColor = pickedColor.hex;
});

const bgm = new Audio("./bgm.mp3");
bgm.loop = true; bgm.volume = 0.1;
let isBgmPlaying = false; 
let isMuted = false;

document.body.addEventListener("click", () => {
  if (!isBgmPlaying && !isMuted) { bgm.play().catch(e=>console.log("BGM Error:", e)); isBgmPlaying = true; }
}, {once: true});

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
  try {
    const ctx = getAudioCtx();
    if (!ctx) return;
    const osc = ctx.createOscillator(); const gainNode = ctx.createGain();
    osc.connect(gainNode); gainNode.connect(ctx.destination);
    if (type === "click") {
      osc.type = "sine"; osc.frequency.setValueAtTime(600, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(800, ctx.currentTime + 0.1);
      gainNode.gain.setValueAtTime(0.1, ctx.currentTime); osc.start(); osc.stop(ctx.currentTime + 0.1);
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

//5. UI 유틸리티
function showScreen(screenId) {
  document.querySelectorAll(".screen").forEach((s) => { s.style.display = "none"; s.classList.remove("active"); });
  if (screenId) { const screen = document.getElementById(screenId); if(screen) { screen.style.display = "flex"; screen.classList.add("active"); } }
}

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
  isMuted = !isMuted; bgm.muted = isMuted; 
  document.getElementById("mute-btn").innerText = isMuted ? "🔇" : "🔊"; playSound("click"); 
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
//6. 로그인, DB 로드
// ==========================================
async function loadAllFromDB() {
  try {
    const setSnap = await getDoc(doc(db, "gameData", "wordSets")); if (setSnap.exists()) wordSets = setSnap.data().sets || [];
    const stdSnap = await getDoc(doc(db, "gameData", "students")); if (stdSnap.exists()) studentList = stdSnap.data().students || [];
  } catch (error) { console.error("DB 로딩 에러:", error); }
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
  renderSetSelectList(); showScreen("set-select-screen");
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
        let effectType = Math.floor(Math.random() * 3);
        if (effectType === 0) { gameScore *= 2; addInventoryItem("double_current"); showBuffMsg("버프 획득!", "현재 점수 2배!", 33, 150, 243); } 
        else if (effectType === 1) { gameScore = Math.floor(gameScore / 2); addInventoryItem("half_current"); showBuffMsg("앗, 함정!", "현재 점수 반토막...", 244, 67, 54); } 
        else if (effectType === 2) { globalScoreMultiplier *= 2; addInventoryItem("double_future"); showBuffMsg("슈퍼 버프 획득!", "앞으로 얻는 모든 점수 2배!", 255, 193, 7); }
        
        if(currentGameMode === "memory") updateMemoryUI(); else if(currentGameMode === "speed-match") updateSpeedMatchUI(); else if(currentGameMode === "speed") updateSpeedUI();
        isGamePaused = false; callback();
      }, 400); 
    };
  });
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
  if (fcIsAnimating) return; playSound("click"); fcIsFlipped = !fcIsFlipped;
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
    playSound("click"); card.classList.add("flipped"); memoryFlipped.push({ id: item.id, side: item.side, el: card, wrapper });
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
    playSound("click"); card.classList.add("selected"); smSelected.push({ id: item.id, side: item.side, el: card, wrapper });
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
}
function startSpeedLogic() {
  updateSpeedUI();
  gameTimerInterval = setInterval(() => {
    if (!isGamePaused) { gameTimeRemaining--; updateSpeedUI(); if (gameTimeRemaining <= 0) { currentUser.score = gameScore; document.getElementById("result-detail").innerText = `제한 시간 종료! 획득한 퀴즈 점수입니다!`; goResult(); } }
  }, 1000); loadNextSpeedQuiz();
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
    playSound("click"); el.classList.add("selected"); fishSelected.push(fishObj);
    if (fishSelected.length === 2) {
      let [f1, f2] = fishSelected;
      if (f1.lang !== f2.lang && f1.targetId === f2.targetId) {
        playSound("success"); showGamePraise(0, praises[Math.floor(Math.random() * praises.length)], "#4CAF50"); fishEmojisCaught += 2; updateFishUI(); caughtEmojisList.push(f1.emoji, f2.emoji);
        const rect1 = f1.el.getBoundingClientRect(); const rect2 = f2.el.getBoundingClientRect(); animateFlyToBucket(f1.emoji, rect1.left + rect1.width / 2, rect1.top + rect1.height / 2); animateFlyToBucket(f2.emoji, rect2.left + rect2.width / 2, rect2.top
