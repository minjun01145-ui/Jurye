// =====================================================
// [00] Firebase 초기화 / 전역 상태 / 기본 설정
// -----------------------------------------------------
// - Firebase 앱 및 Firestore 연결
// - long-polling 안정성 설정
// - 게임 전체에서 공유하는 전역 변수
// - currentUser, wordSets, studentList 등 핵심 상태
// =====================================================

import { initializeApp } from "https://www.gstatic.com/firebasejs/12.16.0/firebase-app.js";
import { getFirestore, doc, setDoc, updateDoc, getDoc, collection, addDoc, getDocs, onSnapshot, query, where, orderBy, limit, deleteDoc } from "https://www.gstatic.com/firebasejs/12.16.0/firebase-firestore.js";
import { getFirestore as getFirestoreLite, doc as liteDoc, getDoc as liteGetDoc, setDoc as liteSetDoc, addDoc as liteAddDoc, deleteDoc as liteDeleteDoc, collection as liteCollection, getDocs as liteGetDocs, query as liteQuery, where as liteWhere } from "https://www.gstatic.com/firebasejs/12.16.0/firebase-firestore-lite.js";
import { getFunctions, httpsCallable } from "https://www.gstatic.com/firebasejs/12.16.0/firebase-functions.js";
import {
  getDurationSeconds as getDurationSecondsCore
} from "./src/utils/timer.js";
import { normalizeShortAnswer as normalizeShortAnswerCore } from "./src/utils/text.js";
import {
  getSimpleCharacterName as getSimpleCharacterNameCore,
  getAvatarHtml as getAvatarHtmlCore
} from "./src/utils/character.js";
import {
  bindClick as bindClickCore,
  getStarClass as getStarClassCore,
  autoFontSize as autoFontSizeCore
} from "./src/utils/ui.js";

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
const cloudFunctions = getFunctions(app, "us-central1");
const testAiConnectionFunction = httpsCallable(cloudFunctions, "testAiConnection", { timeout: 60000 });
const adminAiChatFunction = httpsCallable(cloudFunctions, "adminAiChat", { timeout: 60000 });

// 🚀 [접속 안정화 FIX1]
// Firebase JS SDK의 기본 전송 방식을 그대로 사용합니다.
// 현재 SDK는 필요한 환경에서 long-polling을 자동 감지하므로 전 환경 강제 long-polling을 사용하지 않습니다.
const db = getFirestore(app);
// 초기 로딩/로그인처럼 실시간 리스너가 필요 없는 요청은 REST 전용 Firestore Lite로 처리합니다.
// 이 경로는 WebChannel Listen 스트림을 전혀 사용하지 않습니다.
const dbLite = getFirestoreLite(app);

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
let currentUser = { stdId: "", realName: "", classId: "", nickname: "", emoji: "😎", character: "", jr: 0, todayJr: 0, todayJrDate: "", ownedCharacters: [], score: 0, caughtEmojis: "" };
const praises = ["Fabulous!", "Terrific!", "Awesome!", "Incredible!", "Great Job!", "Perfect!"];

// 멀티플레이 및 글로벌 변수들 통합 정리
let lobbyUsersUnsubscribe = null;
let lobbyChatUnsubscribe = null;
let isStudentLobbyEntering = false;
let loadingRetryAction = null;
let myLobbyDocId = null; 
let activeLobbyClientSessionId = null;
let globalMultiEndTime = null; 
let multiUseSpecialItems = false; 
let myLobbyListenerUnsubscribe = null; 
let isTeacherMode = false; 
let activeTeacherSessionId = null;
let teacherHeartbeatInterval = null;
const TEACHER_HEARTBEAT_MS = 10000;
const TEACHER_LEASE_TIMEOUT_MS = 45000;
let multiRoomUnsubscribe = null;

// 🚑 멀티 안정화: onSnapshot + REST 보조 감시
let multiRoomRestWatchInterval = null;
let multiLobbyHeartbeatInterval = null;
let multiVisibilityHandlerInstalled = false;
let lastMultiRoomRestCheckAt = 0;
let lastMultiRoomSnapshotAt = 0;
let lastStudentRoundAckId = null;
let lastCompletedMultiRoundId = null;
let pendingCompletedResultRestore = false;
let multiJoinWaitInterval = null;
let multiJoinWaitGeneration = 0;
const MULTI_ROOM_REST_WATCH_MS = 1800;
const MULTI_HEARTBEAT_MS = 12000;

let teacherMatchInterval = null;


// =====================================================
// [01] 캐릭터 / JR / 학생 프로필 기본 시스템
// -----------------------------------------------------
// - 캐릭터 폴더 목록 로딩
// - 기본 캐릭터 표시
// - JR, ownedCharacters, character 상태 관리
// - 캐릭터 이미지 HTML 생성
// =====================================================

const BASE_CHARACTER = "기본0(민준쌤)";
let characterCatalogLoadedFromFile = false;

function getDefaultCharacter() {
  if (availableCharacters.includes(BASE_CHARACTER)) return BASE_CHARACTER;
  return availableCharacters[0] || BASE_CHARACTER;
}

function refreshMainCharacterDisplay() {
  const avatarDisp = document.getElementById("main-character-display");
  if (!avatarDisp) return;

  const charFolder = currentUser.character || getDefaultCharacter();
  avatarDisp.innerHTML = `<img src="char/${charFolder}/stand1_0.png" class="anim-avatar" data-char-id="${charFolder}" style="height: 140px; filter: drop-shadow(0px 8px 10px rgba(0,0,0,0.15));" />`;

  let charName = charFolder;
  let creatorName = "알 수 없음";
  if (charFolder.includes("(") && charFolder.includes(")")) {
    const parts = charFolder.split("(");
    charName = parts[0].trim();
    creatorName = parts.slice(1).join("(").replace(/\)$/, "").trim();
  }
  const nameEl = document.getElementById("current-character-name");
  if (nameEl) nameEl.innerText = `${charName} (만든이: ${creatorName})`;
  updatePlayerStatusBadge();
}

async function loadCharacterList() {
  try {
    const response = await fetch("char/folder_list.txt?t=" + Date.now());
    if (!response.ok) throw new Error("텍스트 파일을 찾을 수 없습니다.");

    const text = await response.text();
    availableCharacters = text
      .replace(/^\uFEFF/, "")
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line !== "");

    characterCatalogLoadedFromFile = availableCharacters.length > 0;

    // 서버 프로필에서 이미 읽은 장착값이 있으면 기본 캐릭터로 덮어쓰지 않습니다.
    if (!currentUser.character) {
      currentUser.character = getDefaultCharacter();
    }

    refreshMainCharacterDisplay();
  } catch (error) {
    console.warn("캐릭터 목록 로딩 실패 (대체 캐릭터 가동):", error);
    availableCharacters = [BASE_CHARACTER];
    characterCatalogLoadedFromFile = false;

    if (!currentUser.character) {
      currentUser.character = BASE_CHARACTER;
    }

    refreshMainCharacterDisplay();
  }

  return availableCharacters;
}

const characterListReady = loadCharacterList();

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


// =====================================================
// [02] 화면 전환 / 공통 UI / 상태 배지
// -----------------------------------------------------
// - showScreen()으로 모든 화면 전환 처리
// - 대기실 상점 팝업 자동 닫기
// - 우하단 JR/캐릭터 상태 배지
// - 로딩 진행률 표시
// - 공통 버튼 바인딩
// =====================================================


function showScreen(screenId) {
  document.querySelectorAll(".screen").forEach((s) => { s.style.display = "none"; s.classList.remove("active"); });
  if (screenId) { const screen = document.getElementById(screenId); if(screen) { screen.style.display = "flex"; screen.classList.add("active"); } }

  const gameScreens = ["memory-screen", "speed-match-screen", "speed-screen", "fishing-screen", "chunk-screen"];
  const container = document.getElementById("walking-emoji-container");
  if (container) {
    if (gameScreens.includes(screenId)) {
      container.style.opacity = "0"; 
    } else {
      container.style.opacity = "1"; 
    }
  }
updatePlayerStatusBadge();

// 🛒 대기실 상점 팝업이 게임 화면 위에 남지 않도록 화면 전환 시 자동으로 닫습니다.
const lobbyShopModal = document.getElementById("lobby-inline-shop-container");
if (lobbyShopModal && screenId !== "multi-lobby-screen") {
  lobbyShopModal.style.display = "none";
}

if (screenId === "multi-lobby-screen") {
  ensureLobbyShopButtonAndModal();
}
}

function bindClick(id, callback) {
  return bindClickCore(id, callback);
}
function getSimpleCharacterName(charFolder) {
  return getSimpleCharacterNameCore(charFolder);
}

function updatePlayerStatusBadge() {
  let badge = document.getElementById("player-status-badge");

  if (!badge) {
    badge = document.createElement("div");
    badge.id = "player-status-badge";
    document.body.appendChild(badge);
  }

  const hiddenScreens = new Set(["loading-screen", "auth-screen", "login-screen"]);
  const activeScreen = document.querySelector(".screen.active")?.id || "";
  if (!currentUser || !currentUser.stdId || !currentUser.nickname || hiddenScreens.has(activeScreen)) {
    badge.style.display = "none";
    return;
  }

  badge.style.display = "flex";
  const charFolder = currentUser.character || getDefaultCharacter();
  badge.innerHTML = `
    <div class="player-status-avatar"><img src="char/${charFolder}/stand1_0.png" alt="" /></div>
    <div class="player-status-values">
      <div><span>닉네임</span><b>${currentUser.nickname}</b></div>
      <div><span>현재 JR</span><b>${currentUser.jr || 0}</b></div>
      <div><span>오늘 얻은 JR</span><b>${currentUser.todayJr || 0}</b></div>
    </div>
  `;
}

// 구매/보상 직후에도 자동 반영되도록 가볍게 갱신합니다.
setInterval(updatePlayerStatusBadge, 1000);

// 🚀 실제 로딩 단계 표시용 함수
function updateLoadingProgress(percent, title, detail, showWarning = false) {
  const titleEl = document.getElementById("loading-title") || document.querySelector("#loading-screen h2");
  const detailEl = document.getElementById("loading-detail");
  const barEl = document.getElementById("loading-bar-fill");
  const percentEl = document.getElementById("loading-percent");
  const warningEl = document.getElementById("loading-warning");

  const safePercent = Math.max(0, Math.min(100, Number(percent) || 0));

  if (titleEl && title) titleEl.innerText = title;
  if (detailEl && detail) detailEl.innerText = detail;
  if (barEl) barEl.style.width = safePercent + "%";
  if (percentEl) percentEl.innerText = safePercent + "%";
  if (warningEl) warningEl.style.display = showWarning ? "block" : "none";
}

// Firebase 서버 요청의 성공/실패 판단은 SDK에 맡깁니다.
function getDurationSeconds(durationValue, fallbackSeconds = 180) {
  return getDurationSecondsCore(durationValue, fallbackSeconds);
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
  return getAvatarHtmlCore(charFolder, size);
}

function normalizeOwnedCharacters(...sources) {
  const result = [];
  const seen = new Set();

  const add = (value) => {
    if (typeof value !== "string") return;
    const normalized = value.trim();
    if (!normalized || seen.has(normalized)) return;
    seen.add(normalized);
    result.push(normalized);
  };

  add(getDefaultCharacter());

  sources.forEach((source) => {
    if (Array.isArray(source)) source.forEach(add);
    else add(source);
  });

  return result;
}

function normalizeCharacterProfileData(data = {}) {
  const savedCharacter =
    typeof data.character === "string" && data.character.trim()
      ? data.character.trim()
      : "";

  let ownedCharacters = normalizeOwnedCharacters(
    data.ownedCharacters,
    savedCharacter
  );

  let character = savedCharacter || getDefaultCharacter();

  // 캐릭터 목록 파일을 정상적으로 읽었을 때만 실제로 없는 폴더를 기본값으로 복구합니다.
  if (
    characterCatalogLoadedFromFile &&
    !availableCharacters.includes(character)
  ) {
    console.warn(
      `[캐릭터 복구] 저장된 장착 캐릭터 폴더를 찾지 못해 기본 캐릭터로 변경합니다: ${character}`
    );
    character = getDefaultCharacter();
  }

  // 장착 중인 캐릭터가 보유 목록에서 빠진 과거 오류를 자동 복구합니다.
  ownedCharacters = normalizeOwnedCharacters(ownedCharacters, character);

  return { character, ownedCharacters };
}

function applyCharacterProfileData(data = {}) {
  const normalized = normalizeCharacterProfileData(data);
  currentUser.character = normalized.character;
  currentUser.ownedCharacters = normalized.ownedCharacters;
  refreshMainCharacterDisplay();
  return normalized;
}

async function persistCharacterStateToServer({
  character,
  ownedCharacters,
  jr,
  verify = true
}) {
  if (!currentUser.stdId) {
    throw new Error("학생 인증 정보가 없어 캐릭터 상태를 저장할 수 없습니다.");
  }

  const userRef = liteDoc(dbLite, "users", currentUser.stdId);
  const payload = {
    character,
    ownedCharacters: normalizeOwnedCharacters(ownedCharacters, character),
    characterUpdatedAt: Date.now()
  };

  if (Number.isFinite(Number(jr))) {
    payload.jr = Number(jr);
  }

  await liteSetDoc(userRef, payload, { merge: true });

  if (!verify) return payload;

  const verifySnap = await liteGetDoc(userRef);
  if (!verifySnap.exists()) {
    throw new Error("저장 직후 사용자 문서를 다시 확인하지 못했습니다.");
  }

  const saved = verifySnap.data();
  const savedOwned = normalizeOwnedCharacters(saved.ownedCharacters);

  if (saved.character !== character) {
    throw new Error(
      `장착 캐릭터 저장 검증 실패: 요청=${character}, 서버=${saved.character || "(없음)"}`
    );
  }

  if (!savedOwned.includes(character)) {
    throw new Error("서버의 보유 캐릭터 목록에 현재 장착 캐릭터가 없습니다.");
  }

  payload.ownedCharacters = savedOwned;

  if (Object.prototype.hasOwnProperty.call(payload, "jr")) {
    const savedJr = Number(saved.jr || 0);
    if (savedJr !== Number(payload.jr)) {
      throw new Error(
        `JR 저장 검증 실패: 요청=${payload.jr}, 서버=${savedJr}`
      );
    }
  }

  return payload;
}

async function syncLobbyCharacterSafely(character) {
  if (!myLobbyDocId) return;

  try {
    await liteSetDoc(
      liteDoc(dbLite, "lobbyUsers", myLobbyDocId),
      { character, timestamp: Date.now() },
      { merge: true }
    );
  } catch (error) {
    console.warn("[캐릭터] 대기실 아바타 동기화 실패:", error);
  }
}

let characterMutationInFlight = false;

async function runCharacterMutation(task) {
  if (characterMutationInFlight) {
    alert("캐릭터 정보를 저장 중입니다. 잠시만 기다려 주세요.");
    return null;
  }

  characterMutationInFlight = true;
  try {
    return await task();
  } finally {
    characterMutationInFlight = false;
  }
}

async function equipOwnedCharacter(charFolder) {
  return runCharacterMutation(async () => {
    await characterListReady;

    const userRef = liteDoc(dbLite, "users", currentUser.stdId);
    const latestSnap = await liteGetDoc(userRef);
    const latestData = latestSnap.exists() ? latestSnap.data() : {};

    const ownedCharacters = normalizeOwnedCharacters(
      latestData.ownedCharacters,
      currentUser.ownedCharacters,
      latestData.character,
      currentUser.character
    );

    if (!ownedCharacters.includes(charFolder)) {
      throw new Error("서버 기준으로 보유하지 않은 캐릭터입니다.");
    }

    const saved = await persistCharacterStateToServer({
      character: charFolder,
      ownedCharacters,
      jr: Number(latestData.jr ?? currentUser.jr ?? 0),
      verify: true
    });

    currentUser.character = charFolder;
    currentUser.ownedCharacters = saved.ownedCharacters;
    if (Number.isFinite(Number(saved.jr))) currentUser.jr = Number(saved.jr);

    refreshMainCharacterDisplay();

    await syncLobbyCharacterSafely(charFolder);

    console.info("[캐릭터] 장착 저장/검증 완료:", {
      stdId: currentUser.stdId,
      character: charFolder
    });

    return true;
  });
}

async function purchaseAndEquipCharacter({
  charFolder,
  charName,
  creatorName,
  price
}) {
  return runCharacterMutation(async () => {
    await characterListReady;

    const userRef = liteDoc(dbLite, "users", currentUser.stdId);
    const latestSnap = await liteGetDoc(userRef);
    const latestData = latestSnap.exists() ? latestSnap.data() : {};

    const latestJr = Number(latestData.jr ?? currentUser.jr ?? 0);
    const latestOwned = normalizeOwnedCharacters(
      latestData.ownedCharacters,
      currentUser.ownedCharacters,
      latestData.character,
      currentUser.character
    );

    // 저장 응답이 애매했던 뒤 다시 눌러도 이중 결제하지 않습니다.
    if (latestOwned.includes(charFolder)) {
      const saved = await persistCharacterStateToServer({
        character: charFolder,
        ownedCharacters: latestOwned,
        jr: latestJr,
        verify: true
      });

      currentUser.jr = latestJr;
      currentUser.ownedCharacters = saved.ownedCharacters;
      currentUser.character = charFolder;
      refreshMainCharacterDisplay();
      await syncLobbyCharacterSafely(charFolder);

      return { alreadyOwned: true, jr: latestJr };
    }

    if (latestJr < price) {
      const error = new Error("JR_NOT_ENOUGH");
      error.code = "JR_NOT_ENOUGH";
      throw error;
    }

    const nextJr = latestJr - price;
    const nextOwned = normalizeOwnedCharacters(latestOwned, charFolder);

    // 서버 저장 후 다시 읽어서 JR/보유/장착 상태를 검증한 경우에만 성공 처리합니다.
    const saved = await persistCharacterStateToServer({
      character: charFolder,
      ownedCharacters: nextOwned,
      jr: nextJr,
      verify: true
    });

    currentUser.jr = nextJr;
    currentUser.ownedCharacters = saved.ownedCharacters;
    currentUser.character = charFolder;
    refreshMainCharacterDisplay();

    const jrDisp = document.getElementById("user-jr-display");
    if (jrDisp) jrDisp.innerText = currentUser.jr;

    await syncLobbyCharacterSafely(charFolder);

    // 로열티는 부가 기록이므로 구매 자체와 분리합니다.
    if (
      creatorName &&
      creatorName !== "알 수 없음" &&
      creatorName !== "민준쌤"
    ) {
      try {
        await liteAddDoc(liteCollection(dbLite, "royalties"), {
          creatorName,
          buyerId: currentUser.stdId,
          buyerName: currentUser.realName,
          charName,
          amount: 500,
          isClaimed: false,
          timestamp: Date.now()
        });
      } catch (royaltyError) {
        console.warn(
          "[캐릭터] 구매는 저장됐지만 로열티 기록 생성에 실패했습니다.",
          royaltyError
        );
      }
    }

    console.info("[캐릭터] 구매/장착 저장/검증 완료:", {
      stdId: currentUser.stdId,
      character: charFolder,
      price,
      jr: currentUser.jr,
      ownedCount: currentUser.ownedCharacters.length
    });

    return { alreadyOwned: false, jr: nextJr };
  });
}

// ==========================================
// 🛒 3. 캐릭터 상점 및 대기실
// ==========================================
// 🚀 [4/4] 캐릭터 상점: 구매(2000JR), 장착, 그리고 원작자 수익금(500JR) 발송 시스템
function renderCharShopList() {
  const shopContainer = document.getElementById("shop-character-list");
  if (!shopContainer) return;
  
  shopContainer.innerHTML = "";
  const shopJrDisp = document.getElementById("shop-jr-display");
  if (shopJrDisp) shopJrDisp.innerText = currentUser.jr || 0;
  
  const ownedSet = new Set(currentUser.ownedCharacters || []);
  const sortedCharacters = availableCharacters
    .map((charFolder, originalIndex) => ({ charFolder, originalIndex }))
    .sort((a, b) => {
      const ownedDifference = Number(ownedSet.has(b.charFolder)) - Number(ownedSet.has(a.charFolder));
      return ownedDifference || a.originalIndex - b.originalIndex;
    })
    .map(item => item.charFolder);

  let renderedOwnershipGroup = null;
  sortedCharacters.forEach(charFolder => {
    let charName = charFolder;
    let creatorName = "알 수 없음";
    
    if (charFolder.includes("(") && charFolder.includes(")")) {
      const parts = charFolder.split("(");
      charName = parts[0].trim(); 
      creatorName = parts[1].replace(")", "").trim(); 
    }

    // 이미 구매한 캐릭터인지 확인
    const isOwned = currentUser.ownedCharacters && currentUser.ownedCharacters.includes(charFolder);
    if (renderedOwnershipGroup !== isOwned) {
      renderedOwnershipGroup = isOwned;
      const groupTitle = document.createElement("h2");
      groupTitle.className = "character-shop-group-title";
      groupTitle.innerText = isOwned ? "보유 중인 캐릭터" : "판매 중인 캐릭터";
      shopContainer.appendChild(groupTitle);
    }
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

      try {
        if (currentUser.ownedCharacters?.includes(charFolder)) {
          const ok = await equipOwnedCharacter(charFolder);
          if (!ok) return;

          alert(`[${charName}] 캐릭터를 장착하고 서버에 저장했습니다!`);
          closeCharacterShopModal();
          return;
        }

        const confirmed = confirm(
          `[${charName}] 캐릭터를 2000 JR에 구매하시겠습니까?\n` +
          `(현재 내 JR: ${currentUser.jr} JR)`
        );
        if (!confirmed) return;

        const result = await purchaseAndEquipCharacter({
          charFolder,
          charName,
          creatorName,
          price: 2000
        });
        if (!result) return;

        alert(
          result.alreadyOwned
            ? `[${charName}]은 이미 보유 중이어서 추가 결제 없이 장착했습니다.`
            : `🎉 구매 성공! [${charName}] 캐릭터를 장착하고 서버 저장까지 확인했습니다!`
        );

        closeCharacterShopModal();
      } catch (error) {
        console.error("[캐릭터 상점] 구매/장착 실패:", error);

        if (error?.code === "JR_NOT_ENOUGH" || error?.message === "JR_NOT_ENOUGH") {
          alert("JR이 부족합니다! 게임을 플레이하여 JR을 더 모아오세요.");
        } else {
          alert(
            "캐릭터 정보를 서버에 저장하지 못했습니다.\n" +
            "결제 완료로 처리하지 않았으니 잠시 후 다시 시도해 주세요.\n\n" +
            (error?.message || error)
          );
        }

        try {
          const snap = await liteGetDoc(liteDoc(dbLite, "users", currentUser.stdId));
          if (snap.exists()) {
            const data = snap.data();
            currentUser.jr = Number(data.jr || 0);
            applyCharacterProfileData(data);
            const jrDisp = document.getElementById("user-jr-display");
            if (jrDisp) jrDisp.innerText = currentUser.jr;
          }
        } catch (_) {}
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

  // 네트워크 재접속이 겹쳐 예전 문서가 잠시 남아도 같은 학생은 한 번만 표시한다.
  const uniquePlayers = Array.from(
    new Map(players.map(p => [p.stdId || p.docId, p])).values()
  );
  
  gridContainer.innerHTML = "";
  uniquePlayers.forEach(p => {
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

function openCharacterShopModal() {
  renderCharShopList();
  const overlay = document.getElementById("char-shop-screen");
  if (overlay) overlay.style.display = "flex";
}
function closeCharacterShopModal() {
  const overlay = document.getElementById("char-shop-screen");
  if (overlay) overlay.style.display = "none";
  refreshMainCharacterDisplay();
}
bindClick("go-char-shop-btn", () => { playSound("click"); openCharacterShopModal(); });
bindClick("char-shop-back-btn", () => { playSound("click"); closeCharacterShopModal(); });

let siteConfirmAction = null;
function closeSiteConfirm() {
  const overlay = document.getElementById("site-confirm-overlay");
  if (overlay) overlay.style.display = "none";
  siteConfirmAction = null;
}
function showSiteConfirm(message, onConfirm, options = {}) {
  const overlay = document.getElementById("site-confirm-overlay");
  const titleEl = document.getElementById("site-confirm-title");
  const messageEl = document.getElementById("site-confirm-message");
  const cancelBtn = document.getElementById("site-confirm-cancel-btn");
  const okBtn = document.getElementById("site-confirm-ok-btn");
  if (!overlay) return;
  if (titleEl) titleEl.innerText = options.title || "첫 화면으로 돌아갈까요?";
  if (messageEl) messageEl.innerText = message;
  if (cancelBtn) cancelBtn.innerText = options.cancelText || "계속 설정하기";
  if (okBtn) okBtn.innerText = options.okText || "첫 화면으로";
  if (cancelBtn) cancelBtn.style.display = options.hideCancel ? "none" : "";
  siteConfirmAction = onConfirm;
  overlay.style.display = "flex";
  cancelBtn?.focus();
}
bindClick("site-confirm-cancel-btn", closeSiteConfirm);
bindClick("site-confirm-ok-btn", () => {
  const action = siteConfirmAction;
  closeSiteConfirm();
  if (typeof action === "function") action();
});

function confirmReturnToAuthScreen() {
  playSound("click");
  showSiteConfirm("현재 설정 중인 내용은 저장되지 않습니다.", () => {
    const nicknameInput = document.getElementById("nickname");
    if (nicknameInput) nicknameInput.value = "";
    showScreen("auth-screen");
  });
}
bindClick("profile-logo-home-btn", confirmReturnToAuthScreen);
bindClick("profile-login-crumb", confirmReturnToAuthScreen);

// 🌟 배경 걸어다니는 이모지 시스템 (슈퍼마리오 물리엔진)
const walkingEmojisList = ["🐶", "🐱", "🐭", "🐹", "🐰", "🦊", "🐻", "🐼", "🐨", "🐯", "🦁", "🐮", "🐷", "🐸", "🐵", "🐧", "🐤", "🦆", "🦉", "🦇", "🐺", "🐢", "🐍", "🦖", "🐙", "🦑", "🦀", "🐠", "🐬", "🐳", "🦈", "🐅", "🦓", "🦍", "🐘", "🐫", "🦒", "🦘", "🐎", "🐏", "🐐", "🦌", "🐕", "🐈", "🦚", "🕊", "🐿", "🦔", "🚶", "🏃", "💃", "🕺"];
let walkingEmojis = [];

// 🌟 배경 걸어다니는 이모지 시스템 (슈퍼마리오 물리엔진 - 🚀 GPU 가속 최적화 완료)
function initWalkingEmojis() {
  // 🚀 [크롬북 안정성 우선] 배경 이모지 물리 애니메이션은 장식 기능이라 비활성화합니다.
  // 우하단 JR/캐릭터 상태 배지로 대체합니다.
  return;

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


// =====================================================
// [03] 게임 상태 초기화 / 오버레이 정리 / 안전 복구
// -----------------------------------------------------
// - 게임 타이머와 카운트다운 정리
// - 방해 레이어, 보물상자, 타겟창, 블라인드 제거
// - 게임 점수, 아이템, 상태값 초기화
// - 멀티 복귀 전 기본 청소 담당
// =====================================================


function resetGameStates() {
  // 🚀 [멀티 자물쇠 완전 해제] 게임 초기화 시 상태를 깨끗이 비워줍니다.
  window.isMultiGameActive = false; 
  if (typeof window.isCountdownActive !== 'undefined') window.isCountdownActive = false;
  // 🚀 [관전자 영구 암전 방지] 대기실로 돌아갈 때 모든 방해 레이어 강제 철거!
  ["group-blocker-overlay", "sq-penalty-overlay", "buff-msg-overlay", "multi-target-modal", "multi-blind-overlay"].forEach(id => {
      const el = document.getElementById(id);
          if (el) el.style.display = "none";
      });
      closeTreasureOverlay(false);

      clearInterval(gameTimerInterval); clearInterval(cdInterval); 
      if (typeof chunkTimeout !== "undefined") clearTimeout(chunkTimeout); // 🚀 청크 유령 타이머도 확실히 파괴!
      isFishing = false; isGamePaused = false; gameScore = 0; globalScoreMultiplier = 1; currentUser.caughtEmojis = "";
      
      lastSyncedScore = -1; lastSyncedItems = null;
  
// 🚀 [오답 장부 삭제 방지 픽스] 게임이 끝났을 때 오답 장부를 지우지 않고 그대로 둡니다.
  // (그래야 선생님이 게임 종료 후 대기실에서 분석 버튼을 눌러 데이터를 취합할 수 있습니다!)
  if (myLobbyDocId) {
      // 삭제된 로비 문서를 setDoc이 다시 만들어 "undefined 유저"가 되는 것을 방지합니다.
      // updateDoc은 문서가 이미 삭제되었다면 재생성하지 않고 실패하므로 안전합니다.
      updateDoc(doc(db, "lobbyUsers", myLobbyDocId), {
          score: currentUser.score || 0,
          items: "",
          createdCount: 0,
          isSubmitted: false
      }).catch(() => {});
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
  if (soloSpeedMatchActive) {
    const speedMatchScreen = document.getElementById("speed-match-screen");
    speedMatchScreen.classList.remove("sm-solo-mode", "sm-setup-mode", "sm-playing-mode", "sm-result-mode");
    document.getElementById("sm-solo-settings").hidden = true;
    document.getElementById("sm-solo-result").hidden = true;
    restoreBuffMessageOverlay();
    restoreGameInventory();
    soloSpeedMatchActive = false;
    soloSpeedMatchStage = "setup";
    soloSpeedMatchFinishing = false;
  }
  if (soloChunkActive) {
    const chunkScreen = document.getElementById("chunk-screen");
    chunkScreen.classList.remove("chunk-solo-mode", "chunk-setup-mode", "chunk-playing-mode", "chunk-result-mode");
    document.getElementById("chunk-solo-settings").hidden = true;
    document.getElementById("chunk-solo-result").hidden = true;
    restoreBuffMessageOverlay();
    restoreGameInventory();
    soloChunkActive = false;
    soloChunkStage = "setup";
    soloChunkFinishing = false;
  }
  if (soloSpeedActive) {
    const speedScreen = document.getElementById("speed-solo-screen");
    speedScreen.classList.remove("speed-solo-mode", "speed-solo-setup-mode", "speed-solo-playing-mode", "speed-solo-result-mode");
    document.getElementById("speed-solo-settings").hidden = true;
    document.getElementById("speed-solo-result").hidden = true;
    restoreBuffMessageOverlay(); restoreGameInventory();
    soloSpeedActive = false; soloSpeedStage = "setup"; soloSpeedFinishing = false;
  }
  
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
      if (!confirm("결과 화면을 종료하고 대기실로 돌아갈까요?")) return;
      if (typeof window.toggleStudentLobbyListeners === "function") {
          window.toggleStudentLobbyListeners(true);
      }
      showScreen("multi-lobby-screen");
  } else {
      showScreen("menu-screen"); 
  }
});


// =====================================================
// [04] 초기 데이터 로딩 / 로그인 / 학생 인증
// -----------------------------------------------------
// - wordSets, studentList 불러오기
// - 로딩 타임아웃 및 재시도
// - 학번/이름 인증
// - 출석 JR 보상
// - 닉네임 저장 후 로비 진입
// =====================================================


let isInitialDataLoading = false;
let lastFirebaseStartupError = null;

function setLoadingDiagnostic(message = "") {
  const el = document.getElementById("loading-diagnostic");
  if (el) el.innerText = message;
}

function formatFirebaseError(error) {
  const code = error?.code ? `[${error.code}] ` : "";
  return `${code}${error?.message || String(error || "알 수 없는 오류")}`;
}

function setLoadingRecoveryButtons({ retry = false, backup = false } = {}) {
  const retryBtn = document.getElementById("loading-retry-btn");
  const backupBtn = document.getElementById("loading-backup-btn");
  if (retryBtn) retryBtn.style.display = retry ? "inline-block" : "none";
  if (backupBtn) backupBtn.style.display = backup ? "inline-block" : "none";
}

function hasLocalBootstrapBackup() {
  return Boolean(
    localStorage.getItem("backup_wordSets") &&
    localStorage.getItem("backup_studentList")
  );
}

function enterWithLocalBootstrapBackup() {
  const backupSets = localStorage.getItem("backup_wordSets");
  const backupStds = localStorage.getItem("backup_studentList");

  if (!backupSets || !backupStds) {
    alert("이 기기에 사용할 수 있는 이전 백업 데이터가 없습니다.");
    return false;
  }

  try {
    wordSets = JSON.parse(backupSets);
    studentList = JSON.parse(backupStds);
  } catch (error) {
    console.error("[Firebase] 로컬 백업 파싱 실패:", error);
    alert("이 기기의 백업 데이터가 손상되어 사용할 수 없습니다.");
    return false;
  }

  console.warn("[Firebase] 사용자가 직접 로컬 백업 모드를 선택했습니다.");
  updateLoadingProgress(
    100,
    "이전 백업 데이터로 시작합니다.",
    "Firebase 서버 데이터가 아니라 이 기기에 마지막으로 저장된 자료입니다.",
    true
  );
  setLoadingDiagnostic("백업 모드 · 최신 서버 데이터가 아닐 수 있습니다.");
  setLoadingRecoveryButtons({ retry: false, backup: false });

  setTimeout(() => showScreen("auth-screen"), 350);
  return true;
}

async function readBootstrapDocFromServer(collectionName, documentName, label) {
  const startedAt = performance.now();
  console.info(`[Firebase REST] ${label} 읽기 시작`);

  try {
    const snap = await liteGetDoc(liteDoc(dbLite, collectionName, documentName));
    const elapsed = Math.round(performance.now() - startedAt);
    console.info(`[Firebase REST] ${label} 읽기 성공 · ${elapsed}ms`);
    return { snap, elapsed };
  } catch (error) {
    const elapsed = Math.round(performance.now() - startedAt);
    console.error(`[Firebase REST] ${label} 읽기 실패 · ${elapsed}ms`, error);
    throw error;
  }
}

async function loadAllFromDB() {
  if (isInitialDataLoading) return;
  isInitialDataLoading = true;
  lastFirebaseStartupError = null;

  showScreen("loading-screen");
  setLoadingRecoveryButtons({ retry: false, backup: false });
  setLoadingDiagnostic("Firebase SDK 12.16.0 · Firestore Lite REST 연결 확인 중...");
  updateLoadingProgress(8, "데이터를 불러오는 중입니다.", "Firebase 서버 연결 준비 중...");

  const slowNoticeTimer = setTimeout(() => {
    updateLoadingProgress(
      35,
      "서버 응답을 기다리고 있습니다.",
      "연결을 끊지 않고 Firebase SDK가 응답을 받을 때까지 기다리는 중입니다.",
      true
    );
    setLoadingDiagnostic("10초 이상 응답 대기 중 · 임의 타임아웃으로 실패 처리하지 않습니다.");
  }, 10000);

  try {
    updateLoadingProgress(
      20,
      "서버 데이터를 요청했습니다.",
      "REST 전용 Firestore Lite로 학습 세트와 학생 명단을 동시에 불러오는 중..."
    );
    setLoadingDiagnostic("Firestore Lite REST 요청 시작 · WebChannel/Listen 미사용");

    const [setResult, stdResult] = await Promise.all([
      readBootstrapDocFromServer("gameData", "wordSets", "wordSets"),
      readBootstrapDocFromServer("gameData", "students", "students")
    ]);

    if (!setResult.snap.exists()) {
      throw new Error("gameData/wordSets 문서가 존재하지 않습니다.");
    }
    if (!stdResult.snap.exists()) {
      throw new Error("gameData/students 문서가 존재하지 않습니다.");
    }

    wordSets = setResult.snap.data().sets || [];
    studentList = stdResult.snap.data().students || [];

    localStorage.setItem("backup_wordSets", JSON.stringify(wordSets));
    localStorage.setItem("backup_studentList", JSON.stringify(studentList));
    localStorage.setItem("backup_loadedAt", String(Date.now()));

    clearTimeout(slowNoticeTimer);

    const totalMs = Math.max(setResult.elapsed, stdResult.elapsed);
    updateLoadingProgress(90, "서버 데이터 확인 완료!", "로그인 준비 중...");
    setLoadingDiagnostic(
      `Firebase REST 연결 성공 · wordSets ${setResult.elapsed}ms · students ${stdResult.elapsed}ms`
    );

    console.info("[Firebase REST] 초기 서버 연결 성공", {
      wordSetsMs: setResult.elapsed,
      studentsMs: stdResult.elapsed,
      longestMs: totalMs,
      wordSetCount: wordSets.length,
      studentCount: studentList.length
    });

    updateLoadingProgress(100, "준비 완료!", "최신 서버 데이터로 로그인 화면을 엽니다.");
    setTimeout(() => showScreen("auth-screen"), 250);
  } catch (error) {
    clearTimeout(slowNoticeTimer);
    lastFirebaseStartupError = error;

    const errorText = formatFirebaseError(error);
    console.error("[Firebase] 초기 서버 연결 최종 실패:", error);

    updateLoadingProgress(
      100,
      "Firebase 서버 연결에 실패했습니다.",
      "자동으로 오프라인 데이터로 넘어가지 않습니다. 서버 연결을 다시 시도할 수 있습니다.",
      true
    );
    setLoadingDiagnostic(errorText);
    setLoadingRecoveryButtons({
      retry: true,
      backup: hasLocalBootstrapBackup()
    });
  } finally {
    isInitialDataLoading = false;
  }
}

const loadingRetryBtn = document.getElementById("loading-retry-btn");
if (loadingRetryBtn) {
  loadingRetryBtn.addEventListener("click", () => {
    playSound("click");
    loadAllFromDB();
  });
}

const loadingBackupBtn = document.getElementById("loading-backup-btn");
if (loadingBackupBtn) {
  loadingBackupBtn.addEventListener("click", () => {
    playSound("click");
    enterWithLocalBootstrapBackup();
  });
}

loadAllFromDB();

function getSeoulDateKey(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit"
  }).formatToParts(date).reduce((result, part) => {
    if (part.type !== "literal") result[part.type] = part.value;
    return result;
  }, {});
  return `${parts.year}-${parts.month}-${parts.day}`;
}

// 🚀 [1/4] 학생 인증 시 서버에서 내 JR과 캐릭터 정보 불러오기
// 🚀 [1/2] 학생 인증 시 서버에서 정보 불러오고 출석/수익 보상 "즉시" 지급!
bindClick("auth-btn", async () => {
  playSound("click");

  const inputId = document.getElementById("auth-id").value.trim();
  const inputName = document.getElementById("auth-name").value.trim();

  if (!inputId || !inputName) {
    alert("학번과 이름을 모두 적어주세요!");
    return;
  }

  const matchedStudent = studentList.find(
    (student) => student.stdId === inputId && student.name === inputName
  );

  if (!matchedStudent) {
    alert("데이터베이스에 없는 학번이거나 이름이 틀렸습니다! 선생님께 문의하세요.");
    return;
  }

  currentUser.stdId = inputId;
  currentUser.realName = inputName;
  currentUser.classId = inputId.substring(0, 2);

  showScreen("loading-screen");
  setLoadingRecoveryButtons({ retry: false, backup: false });
  updateLoadingProgress(15, "프로필 정보를 불러오는 중...", "Firebase 서버에서 내 정보를 직접 확인합니다.");
  setLoadingDiagnostic(`학생 ${inputId} 프로필 서버 읽기 시작`);

  try {
    await characterListReady;

    const profileStartedAt = performance.now();
    const userRef = liteDoc(dbLite, "users", inputId);
    const userDoc = await liteGetDoc(userRef);
    const profileMs = Math.round(performance.now() - profileStartedAt);

    console.info(`[Firebase] 사용자 프로필 서버 읽기 성공 · ${profileMs}ms`);
    setLoadingDiagnostic(`프로필 서버 읽기 성공 · ${profileMs}ms`);

    if (userDoc.exists()) {
      const data = userDoc.data();
      currentUser.jr = Number(data.jr || 0);
      currentUser.nickname = data.nickname || "";
      currentUser.lastLoginDate = data.lastLoginDate || "";
      currentUser.todayJrDate = data.todayJrDate || "";
      currentUser.todayJr = Number(data.todayJr || 0);

      const normalizedCharacter = applyCharacterProfileData(data);

      if (
        data.character !== normalizedCharacter.character ||
        JSON.stringify(data.ownedCharacters || []) !==
          JSON.stringify(normalizedCharacter.ownedCharacters)
      ) {
        console.warn("[캐릭터 복구] 사용자 문서의 캐릭터 상태를 정규화합니다.", {
          beforeCharacter: data.character,
          afterCharacter: normalizedCharacter.character,
          beforeOwned: data.ownedCharacters,
          afterOwned: normalizedCharacter.ownedCharacters
        });
      }
    } else {
      currentUser.jr = 0;
      currentUser.ownedCharacters = [getDefaultCharacter()];
      currentUser.character = getDefaultCharacter();
      currentUser.lastLoginDate = "";
      currentUser.nickname = "";
      currentUser.todayJrDate = "";
      currentUser.todayJr = 0;
      refreshMainCharacterDisplay();
    }

    updateLoadingProgress(45, "출석 보상을 확인하는 중...", "오늘의 접속 상태를 확인합니다.");

    const todayStr = new Date().toLocaleDateString("ko-KR", { timeZone: "Asia/Seoul" });
    if (currentUser.todayJrDate !== todayStr) {
      currentUser.todayJrDate = todayStr;
      currentUser.todayJr = 0;
    }
    const isFirstLogin = currentUser.lastLoginDate !== todayStr;

    if (isFirstLogin) {
      currentUser.jr += 1000;
      currentUser.todayJr += 1000;
      currentUser.lastLoginDate = todayStr;

      setTimeout(() => {
        showBuffMsg("🎉 출석 보상 🎉", "오늘의 접속 보상 1000 JR 획득!", 76, 175, 80);
        fireConfetti();
      }, 500);
    }

    updateLoadingProgress(60, "캐릭터 판매 수익을 확인하는 중...", "내 캐릭터와 관련된 기록만 조회합니다.");

    let totalRoyalty = 0;
    const buyersList = [];

    try {
      const royaltyQuery = liteQuery(
        liteCollection(dbLite, "royalties"),
        liteWhere("creatorName", "==", currentUser.realName)
      );
      const royaltySnap = await liteGetDocs(royaltyQuery);
      const claimJobs = [];

      royaltySnap.forEach((docSnap) => {
        const data = docSnap.data();

        if (data.isClaimed === false) {
          totalRoyalty += Number(data.amount || 0);
          buyersList.push(`${data.buyerId || ""} ${data.buyerName || ""} 학생`.trim());
          claimJobs.push(liteSetDoc(docSnap.ref, { isClaimed: true }, { merge: true }));
        }
      });

      if (claimJobs.length > 0) {
        await Promise.all(claimJobs);
      }
    } catch (royaltyError) {
      // 부가 기능 때문에 로그인 전체가 실패하지 않도록 분리합니다.
      console.warn("[Firebase] 로열티 조회 실패. 로그인은 계속 진행합니다.", royaltyError);
    }

    if (totalRoyalty > 0) {
      currentUser.jr += totalRoyalty;
      currentUser.todayJr += totalRoyalty;

      setTimeout(() => {
        alert(
          `💰 캐릭터 판매 수익 도착! 💰\n\n${buyersList.join("\n")}` +
          `\n...이(가) 당신의 캐릭터를 샀습니다!\n\n총 ${totalRoyalty} JR 이 입금되었습니다!`
        );
        const jrDisp = document.getElementById("user-jr-display");
        if (jrDisp) jrDisp.innerText = currentUser.jr;
      }, 3500);
    }

    updateLoadingProgress(82, "프로필 정보를 저장하는 중...", "보상과 캐릭터 정보를 서버에 반영합니다.");

    await liteSetDoc(userRef, {
      stdId: currentUser.stdId,
      realName: currentUser.realName,
      nickname: currentUser.nickname,
      character: currentUser.character,
      jr: currentUser.jr,
      todayJr: currentUser.todayJr,
      todayJrDate: currentUser.todayJrDate,
      ownedCharacters: currentUser.ownedCharacters,
      lastLoginDate: currentUser.lastLoginDate
    }, { merge: true });

    if (isFirstLogin) {
      try {
        const attendanceDate = getSeoulDateKey();
        await liteSetDoc(liteDoc(dbLite, "attendance", `${attendanceDate}_${currentUser.stdId}`), {
          stdId: currentUser.stdId,
          realName: currentUser.realName,
          classId: currentUser.classId,
          date: attendanceDate,
          timestamp: Date.now()
        });
      } catch (attendanceError) {
        console.warn("출석 기록 저장 실패. 로그인은 계속 진행합니다.", attendanceError);
      }
    }

    const jrDisp = document.getElementById("user-jr-display");
    if (jrDisp) jrDisp.innerText = currentUser.jr;

    const nicknameInput = document.getElementById("nickname");
    if (nicknameInput) nicknameInput.value = "";

    updateLoadingProgress(100, "프로필 준비 완료!", "캐릭터 설정 화면으로 이동합니다.");
    setLoadingDiagnostic("Firebase 프로필 읽기/저장 완료");
    setTimeout(() => showScreen("login-screen"), 180);
  } catch (error) {
    console.error("[Firebase] 프로필 서버 연결 실패:", error);

    updateLoadingProgress(
      100,
      "프로필 서버 연결에 실패했습니다.",
      "학생 명단 인증은 성공했지만 최신 프로필을 Firebase에서 읽지 못했습니다.",
      true
    );
    setLoadingDiagnostic(formatFirebaseError(error));

    alert(
      "학생 인증은 확인됐지만 Firebase 프로필 서버 연결에 실패했습니다.\n" +
      "다시 인증해 주세요.\n\n" +
      formatFirebaseError(error)
    );

    setTimeout(() => showScreen("auth-screen"), 250);
  }
});

// 🚀 [2/2] 게임 시작 버튼 (닉네임은 이번 접속에만 적용, 캐릭터만 DB 저장)
bindClick("login-btn", async () => {
  playSound("click");
  const nick = document.getElementById("nickname").value.trim() || currentUser.realName;
  
  currentUser.nickname = nick;
  updatePlayerStatusBadge();

  try {
    await liteSetDoc(liteDoc(dbLite, "users", currentUser.stdId), {
      character: currentUser.character,
      ownedCharacters: normalizeOwnedCharacters(
        currentUser.ownedCharacters,
        currentUser.character
      )
    }, { merge: true });
  } catch (error) {
    console.error("[Firebase] 캐릭터 저장 실패:", error);
    alert(
      "캐릭터 정보를 서버에 저장하지 못했습니다.\n" +
      "인터넷 연결 후 다시 '게임 시작'을 눌러 주세요."
    );
    return;
  }

  if (wordSets.length === 0) return alert("현재 등록된 학습 세트가 없습니다! 관리자 설정에서 세트를 만들어주세요.");
  showScreen("lobby-mode-screen");
});

// =====================================================
// [05] 학습 세트 선택 / 관리자 / 단어 목록
// -----------------------------------------------------
// - 개인 게임용 세트 선택
// - 학생 명단 관리
// - 단어 세트 생성/수정/삭제
// - 단어 목록 보기
// - 별표/가리기 기능
// =====================================================


function renderSetSelectList() {
  const container = document.getElementById("set-select-list"); container.innerHTML = "";
  // 🚀 특수 세트는 철저히 걸러냅니다!
  const normalSets = wordSets.filter(s => !s.isCustomSet && !s.hidden);
  normalSets.forEach(set => {
    const btn = document.createElement("button");
    btn.className = "set-picker-button";
    btn.innerHTML = `<strong>${set.title}</strong><span>단어 ${set.words.length}개</span>`;
    btn.onclick = () => {
      playSound("click");
      if(set.words.length < 4) return alert("이 세트에는 단어가 4개 미만이라 게임을 할 수 없어요!");
      wordList = set.words;
      currentSetId = set.id;       
      currentSetTitle = set.title; 
      container.querySelectorAll(".set-picker-button").forEach(el => el.classList.remove("is-selected"));
      btn.classList.add("is-selected");
      const panel = document.getElementById("learning-method-panel");
      const title = document.getElementById("selected-set-title");
      if (panel) panel.classList.remove("is-disabled");
      if (title) title.innerText = set.title;
    };
    container.appendChild(btn);
  });
}

function closeAdminPasswordDialog() {
  const overlay = document.getElementById("admin-password-overlay");
  if (overlay) overlay.hidden = true;
}

bindClick("admin-main-open-btn", () => {
  playSound("click");
  const overlay = document.getElementById("admin-password-overlay");
  const input = document.getElementById("admin-password-input");
  const error = document.getElementById("admin-password-error");
  if (!overlay || !input) return;
  input.value = "";
  if (error) error.hidden = true;
  overlay.hidden = false;
  requestAnimationFrame(() => input.focus());
});

document.getElementById("admin-password-form")?.addEventListener("submit", event => {
  event.preventDefault();
  const input = document.getElementById("admin-password-input");
  const error = document.getElementById("admin-password-error");
  if (input?.value !== "1234") {
    if (error) error.hidden = false;
    input?.select();
    return;
  }
  closeAdminPasswordDialog();
  showScreen("admin-main-screen");
  showAdminPanel("students");
});
bindClick("admin-password-cancel-btn", closeAdminPasswordDialog);

function showAdminSetView(viewName = "list") {
  const listView = document.getElementById("admin-set-list-view");
  const editView = document.getElementById("admin-set-edit-view");
  if (listView) listView.hidden = viewName !== "list";
  if (editView) editView.hidden = viewName !== "edit";
}

function showAdminPanel(panelName) {
  if (panelName === "multiplayer") {
    enterMultiLobbyAsTeacher();
    return;
  }
  document.querySelectorAll("#admin-main-screen .admin-panel").forEach(panel => panel.classList.toggle("active", panel.id === `admin-panel-${panelName}`));
  document.querySelectorAll("#admin-main-screen .admin-nav-btn").forEach(button => button.classList.toggle("active", button.dataset.adminPanel === panelName));
  if (panelName === "students") { renderAdminStudentList(); renderAdminStudentWealthList(); }
  if (panelName === "sets") { showAdminSetView("list"); renderAdminSetList(); }
  if (panelName === "feedback") renderAdminFeedbackList();
  if (panelName === "learning") renderAdminLearningDashboard();
  if (panelName === "ai") loadAdminAiSettings();
  document.querySelector("#admin-main-screen .admin-workspace")?.scrollTo(0, 0);
}

bindClick("admin-main-close-btn", () => { playSound("click"); showScreen("auth-screen"); });
document.querySelectorAll("#admin-main-screen .admin-nav-btn").forEach(button => {
  button.addEventListener("click", () => { playSound("click"); showAdminPanel(button.dataset.adminPanel); });
});

function renderAdminStudentList() {
  const listEl = document.getElementById("admin-student-list"); listEl.innerHTML = "";
  if(studentList.length === 0) return listEl.innerHTML = "<p style='text-align:center; margin-top:50px;'>등록된 학생이 없습니다.</p>";
  studentList.forEach(std => {
    const item = document.createElement("div"); item.className = "admin-list-item"; item.innerHTML = `<span><b>[${std.stdId}]</b> ${std.name}</span>`;
    const delBtn = document.createElement("button"); delBtn.className = "admin-text-action"; delBtn.innerText = "삭제";
    delBtn.onclick = async () => {
      if(confirm(`${std.name} 학생을 정말 삭제하시겠습니까?`)) {
        playSound("click"); studentList = studentList.filter(s => s.stdId !== std.stdId);
        await setDoc(doc(db, "gameData", "students"), { students: studentList }); renderAdminStudentList(); renderAdminStudentWealthList();
      }
    };
    item.appendChild(delBtn); listEl.appendChild(item);
  });
}

async function renderAdminStudentWealthList() {
  const listEl = document.getElementById("admin-student-wealth-list");
  if (!listEl) return;
  listEl.innerHTML = "<p>불러오는 중...</p>";
  try {
    const snap = await getDocs(collection(db, "users"));
    const userMap = new Map();
    snap.forEach(userDoc => userMap.set(userDoc.id, { id: userDoc.id, ...userDoc.data() }));
    const rows = studentList.map(student => ({
      id: student.stdId,
      name: student.name,
      jr: Number(userMap.get(student.stdId)?.jr) || 0
    }));
    userMap.forEach(user => {
      if (!rows.some(row => row.id === user.id)) rows.push({ id: user.id, name: user.realName || user.name || "미등록 학생", jr: Number(user.jr) || 0 });
    });
    rows.sort((a, b) => a.id.localeCompare(b.id, "ko", { numeric: true }));
    listEl.innerHTML = "";
    if (!rows.length) { listEl.innerHTML = "<p>재화 데이터가 있는 학생이 없습니다.</p>"; return; }
    rows.forEach(row => {
      const item = document.createElement("div");
      item.className = "admin-wealth-row";
      const select = document.createElement("input");
      select.type = "checkbox"; select.className = "admin-wealth-select"; select.dataset.stdId = row.id;
      const identity = document.createElement("span");
      identity.className = "admin-wealth-identity"; identity.textContent = `${row.id}  ${row.name}`;
      const value = document.createElement("span");
      value.className = "admin-wealth-value"; value.textContent = row.jr.toLocaleString();
      const unit = document.createElement("span"); unit.textContent = "JR";
      item.append(select, identity, value, unit); listEl.appendChild(item);
    });
    const selectAll = document.getElementById("admin-wealth-select-all");
    if (selectAll) selectAll.checked = false;
  } catch (error) {
    console.error("학생 재화 데이터 조회 실패", error);
    listEl.innerHTML = "<p>학생 재화 데이터를 불러오지 못했습니다.</p>";
  }
}

function getSelectedAdminWealthRows() {
  return [...document.querySelectorAll("#admin-student-wealth-list .admin-wealth-select:checked")].map(check => ({ stdId: check.dataset.stdId }));
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
    document.getElementById("admin-student-textarea").value = ""; renderAdminStudentList(); renderAdminStudentWealthList();
  } catch (error) { alert("저장에 실패했습니다."); }
});

bindClick("admin-reset-jr-btn", async () => {
  playSound("click");
  const selected = getSelectedAdminWealthRows();
  const resetValue = Number(document.getElementById("admin-reset-jr-value")?.value);
  if (!selected.length) return alert("재화를 변경할 학생을 선택하세요.");
  if (!Number.isFinite(resetValue) || resetValue < 0) return alert("변경할 재화값을 0 이상의 숫자로 입력하세요.");
  if (!confirm(`선택한 ${selected.length}명의 재화를 ${Math.floor(resetValue)} JR로 변경할까요?`)) return;
  try {
    await Promise.all(selected.map(row => setDoc(doc(db, "users", row.stdId), { jr: Math.floor(resetValue) }, { merge: true })));
    await renderAdminStudentWealthList();
    alert("선택한 학생의 재화를 변경했습니다.");
  } catch (error) {
    console.error("학생 재화 변경 실패", error);
    alert("재화 변경 중 오류가 발생했습니다.");
  }
});

bindClick("admin-reset-items-btn", async () => {
  playSound("click");
  const selected = getSelectedAdminWealthRows();
  if (!selected.length) return alert("아이템 구매 내역을 초기화할 학생을 선택하세요.");
  if (!confirm(`선택한 ${selected.length}명의 구매한 캐릭터를 모두 회수하고 기본 캐릭터로 변경할까요?`)) return;
  try {
    await Promise.all(selected.map(row => setDoc(doc(db, "users", row.stdId), {
      ownedCharacters: [BASE_CHARACTER],
      character: BASE_CHARACTER
    }, { merge: true })));
    alert("선택한 학생의 구매한 캐릭터를 회수하고 현재 캐릭터를 기본0으로 변경했습니다.");
  } catch (error) {
    console.error("학생 아이템 구매 내역 초기화 실패", error);
    alert("아이템 구매 내역 초기화 중 오류가 발생했습니다.");
  }
});

document.getElementById("admin-wealth-select-all")?.addEventListener("change", event => {
  document.querySelectorAll("#admin-student-wealth-list .admin-wealth-select").forEach(check => { check.checked = event.target.checked; });
});
function renderAdminSetList() {
  const visibleList = document.getElementById("admin-set-list");
  const hiddenList = document.getElementById("admin-hidden-set-list");
  if (!visibleList || !hiddenList) return;
  visibleList.innerHTML = ""; hiddenList.innerHTML = "";

  const renderSetRow = (set, listEl, isHidden) => {
    const item = document.createElement("div"); item.className = "admin-list-item admin-set-row";
    const info = document.createElement("span"); info.className = "admin-set-info";
    info.textContent = `${set.title} (${set.words.length}단어) · 세트 타입: ${set.type || "null"}`;
    const btnBox = document.createElement("div"); btnBox.className = "admin-set-actions";
    const hideBtn = document.createElement("button"); hideBtn.className = "admin-text-action"; hideBtn.innerText = isHidden ? "숨김 해제" : "세트 숨기기";
    hideBtn.onclick = async () => {
      playSound("click"); set.hidden = !isHidden;
      await setDoc(doc(db, "gameData", "wordSets"), { sets: wordSets }); renderAdminSetList();
    };
    const editBtn = document.createElement("button"); editBtn.className = "admin-text-action"; editBtn.innerText = "수정";
    editBtn.onclick = () => {
      playSound("click"); currentEditingSetId = set.id;
      document.getElementById("admin-set-title").value = set.title;
      document.getElementById("admin-set-type").value = set.type || "";
      document.getElementById("admin-set-textarea").value = set.words.map(w => `${w.en}\t${w.ko}`).join("\n");
      showAdminSetView("edit");
    };
    const delBtn = document.createElement("button"); delBtn.className = "admin-text-action"; delBtn.innerText = "삭제";
    delBtn.onclick = async () => {
      if (!confirm(`[${set.title}] 세트를 정말 삭제하시겠습니까?`)) return;
      playSound("click"); wordSets = wordSets.filter(item => item.id !== set.id);
      await setDoc(doc(db, "gameData", "wordSets"), { sets: wordSets }); renderAdminSetList();
    };
    btnBox.append(hideBtn, editBtn, delBtn); item.append(info, btnBox); listEl.appendChild(item);
  };

  const visibleSets = wordSets.filter(set => !set.hidden);
  const hiddenSets = wordSets.filter(set => set.hidden);
  visibleSets.forEach(set => renderSetRow(set, visibleList, false));
  hiddenSets.forEach(set => renderSetRow(set, hiddenList, true));
  if (!visibleSets.length) visibleList.innerHTML = "<p>사용 중인 세트가 없습니다.</p>";
  if (!hiddenSets.length) hiddenList.innerHTML = "<p>숨긴 세트가 없습니다.</p>";
}

bindClick("admin-set-edit-cancel-btn", () => { playSound("click"); showAdminSetView("list"); });
bindClick("admin-set-create-btn", () => { playSound("click"); currentEditingSetId = null; document.getElementById("admin-set-title").value = ""; document.getElementById("admin-set-type").value = ""; document.getElementById("admin-set-textarea").value = ""; showAdminSetView("edit"); });

bindClick("admin-set-save-btn", async () => {
  playSound("click"); const title = document.getElementById("admin-set-title").value.trim();
  const setType = document.getElementById("admin-set-type").value || null;
  if(!title) return alert("세트 이름을 적어주세요!");
  const text = document.getElementById("admin-set-textarea").value; const lines = text.trim().split("\n"); const newWords = [];
  for (let line of lines) {
    const parts = line.split('\t'); 
    if (parts.length >= 2 && parts[0].trim() !== "" && parts[1].trim() !== "") newWords.push({ en: parts[0].trim(), ko: parts[1].trim() });
  }
  if (newWords.length === 0) return alert("입력된 단어가 없거나 양식이 틀렸습니다!");

  if (currentEditingSetId) {
    const target = wordSets.find(s => s.id === currentEditingSetId); if(target) { target.title = title; target.type = setType; target.words = newWords; }
  } else { wordSets.push({ id: Date.now().toString(), title: title, type: setType, hidden: false, words: newWords }); }

  try {
    await setDoc(doc(db, "gameData", "wordSets"), { sets: wordSets }); 
    alert("성공적으로 저장되었습니다!"); renderAdminSetList(); showAdminSetView("list");
  } catch (error) { alert("저장 실패."); }
});

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

function getAttendancePeriodRange() {
  const period = document.getElementById("admin-attendance-period")?.value || "week";
  const todayKey = getSeoulDateKey();
  if (period === "week") {
    return { start: getSeoulDateKey(new Date(Date.now() - (6 * 86400000))), end: todayKey, label: "최근 일주일" };
  }
  if (period === "specific-month") {
    const month = document.getElementById("admin-attendance-month")?.value || todayKey.slice(0, 7);
    return { month, label: month };
  }
  const [year, month] = todayKey.split("-").map(Number);
  const previous = new Date(Date.UTC(year, month - 2, 1, 12));
  const previousMonth = `${previous.getUTCFullYear()}-${String(previous.getUTCMonth() + 1).padStart(2, "0")}`;
  return { month: previousMonth, label: `${previousMonth} (직전 한 달)` };
}

async function renderAdminAttendanceRanking() {
  const list = document.getElementById("admin-attendance-ranking");
  if (!list) return;
  list.innerHTML = "<p>출석 기록을 불러오는 중...</p>";
  try {
    const range = getAttendancePeriodRange();
    const snapshot = await getDocs(collection(db, "attendance"));
    const attendanceByStudent = new Map();
    snapshot.forEach(recordDoc => {
      const record = recordDoc.data();
      const date = String(record.date || "");
      const inPeriod = range.month ? date.startsWith(range.month) : date >= range.start && date <= range.end;
      if (!inPeriod || !record.stdId) return;
      if (!attendanceByStudent.has(record.stdId)) attendanceByStudent.set(record.stdId, { dates: new Set(), realName: record.realName || "" });
      attendanceByStudent.get(record.stdId).dates.add(date);
    });
    const ranked = [...attendanceByStudent.entries()].map(([stdId, data]) => ({
      stdId,
      name: studentList.find(student => student.stdId === stdId)?.name || data.realName || "이름 없음",
      count: data.dates.size
    })).sort((a, b) => b.count - a.count || a.stdId.localeCompare(b.stdId, "ko", { numeric: true }));
    list.innerHTML = "";
    if (!ranked.length) { list.innerHTML = `<p>${range.label} 출석 기록이 없습니다.</p>`; return; }
    ranked.forEach((student, index) => {
      const row = document.createElement("div"); row.className = "admin-learning-row";
      row.innerHTML = `<span>${index + 1}위</span><span>${student.stdId} ${student.name}</span><strong>${student.count}일</strong>`;
      list.appendChild(row);
    });
  } catch (error) {
    console.error("출석 순위 조회 실패", error);
    list.innerHTML = "<p>출석 기록을 불러오지 못했습니다.</p>";
  }
}

function renderAdminLearningStudentList() {
  const list = document.getElementById("admin-learning-student-list");
  if (!list) return;
  list.innerHTML = "";
  [...studentList].sort((a, b) => a.stdId.localeCompare(b.stdId, "ko", { numeric: true })).forEach(student => {
    const button = document.createElement("button");
    button.type = "button"; button.className = "admin-learning-student";
    button.textContent = `${student.stdId} ${student.name}`;
    button.addEventListener("click", () => {
      list.querySelectorAll(".admin-learning-student").forEach(item => item.classList.remove("active"));
      button.classList.add("active");
      renderAdminSoloHistory(student);
    });
    list.appendChild(button);
  });
  if (!studentList.length) list.innerHTML = "<p>등록된 학생이 없습니다.</p>";
}

async function renderAdminSoloHistory(student) {
  const list = document.getElementById("admin-solo-history-list");
  if (!list) return;
  list.innerHTML = `<p>${student.stdId} ${student.name} 학생의 기록을 불러오는 중...</p>`;
  const gameNames = { fc: "학습 목록 보기", memory: "메모리", "speed-match": "짝맞추기", speed: "스피드퀴즈", fish: "이모지 낚시", chunk: "문장 해석" };
  try {
    const snapshot = await getDocs(query(collection(db, "scores"), where("stdId", "==", student.stdId)));
    const records = [];
    snapshot.forEach(scoreDoc => {
      const score = scoreDoc.data();
      if (score.playContext === "solo") records.push(score);
    });
    records.sort((a, b) => Number(b.timestamp || 0) - Number(a.timestamp || 0));
    list.innerHTML = "";
    if (!records.length) { list.innerHTML = "<p>혼자하기 기록이 없습니다.</p>"; return; }
    records.forEach(record => {
      const row = document.createElement("div"); row.className = "admin-solo-history-row";
      const date = new Date(Number(record.timestamp || 0)).toLocaleString("ko-KR", { timeZone: "Asia/Seoul" });
      row.innerHTML = `<span>${date}</span><span>${record.setTitle || "세트 정보 없음"}</span><span>${gameNames[record.mode] || record.mode || "게임 정보 없음"}</span><strong>${Number(record.score || 0).toLocaleString()}점</strong>`;
      list.appendChild(row);
    });
  } catch (error) {
    console.error("혼자하기 기록 조회 실패", error);
    list.innerHTML = "<p>혼자하기 기록을 불러오지 못했습니다.</p>";
  }
}

function renderAdminLearningDashboard() {
  const monthInput = document.getElementById("admin-attendance-month");
  if (monthInput) {
    if (!monthInput.value) monthInput.value = getSeoulDateKey().slice(0, 7);
    monthInput.disabled = document.getElementById("admin-attendance-period")?.value !== "specific-month";
  }
  renderAdminAttendanceRanking();
  renderAdminLearningStudentList();
  const history = document.getElementById("admin-solo-history-list");
  if (history) history.innerHTML = "<p>왼쪽에서 학생을 선택하세요.</p>";
}

bindClick("admin-attendance-load-btn", renderAdminAttendanceRanking);
document.getElementById("admin-attendance-period")?.addEventListener("change", event => {
  const monthInput = document.getElementById("admin-attendance-month");
  if (monthInput) monthInput.disabled = event.target.value !== "specific-month";
});

const DEFAULT_AI_SETTINGS = {
  endpoint: "https://api.openai.com/v1/responses",
  model: "gpt-5.6-luna",
  apiFormat: "responses",
  reasoningEffort: "low"
};
let aiSettingsCache = null;

async function getAiSettings(force = false) {
  if (aiSettingsCache && !force) return aiSettingsCache;
  const settingsDoc = await getDoc(doc(db, "gameData", "aiSettings"));
  aiSettingsCache = settingsDoc.exists() ? { ...DEFAULT_AI_SETTINGS, ...settingsDoc.data() } : { ...DEFAULT_AI_SETTINGS };
  return aiSettingsCache;
}

async function loadAdminAiSettings() {
  const status = document.getElementById("admin-ai-status");
  if (status) status.innerText = "설정을 불러오는 중...";
  try {
    const settings = await getAiSettings(true);
    document.getElementById("admin-ai-endpoint").value = settings.endpoint;
    document.getElementById("admin-ai-model").value = settings.model;
    document.getElementById("admin-ai-format").value = settings.apiFormat;
    document.getElementById("admin-ai-reasoning").value = settings.reasoningEffort;
    if (status) status.innerText = "";
  } catch (error) {
    if (status) status.innerText = "AI 설정을 불러오지 못했습니다.";
  }
}

function readAdminAiSettings() {
  return {
    endpoint: document.getElementById("admin-ai-endpoint").value.trim(),
    model: document.getElementById("admin-ai-model").value.trim(),
    apiFormat: document.getElementById("admin-ai-format").value,
    reasoningEffort: document.getElementById("admin-ai-reasoning").value
  };
}

bindClick("admin-ai-save-btn", async () => {
  const settings = readAdminAiSettings();
  const status = document.getElementById("admin-ai-status");
  if (!settings.endpoint || !settings.model) { status.innerText = "API 주소와 모델명을 입력하세요."; return; }
  try {
    await setDoc(doc(db, "gameData", "aiSettings"), settings);
    aiSettingsCache = settings;
    setAdminAiStatus("Cloud Function용 AI 설정을 저장했습니다.", "success");
  } catch (error) { status.innerText = "설정을 저장하지 못했습니다."; }
});

function getAiErrorDetail(error) {
  const functionDetail = error?.details && typeof error.details === "object" ? error.details : {};
  return {
    kind: functionDetail.kind || error?.code || "cloud-function",
    message: functionDetail.message || error?.message || "Cloud Function 호출 중 알 수 없는 오류가 발생했습니다.",
    ...functionDetail
  };
}

function formatAiErrorDetail(detail) {
  const lines = [
    `종류: ${detail.kind || "unknown"}`,
    `메시지: ${detail.message || "알 수 없는 오류"}`
  ];
  if (detail.status) lines.push(`HTTP 상태: ${detail.status}${detail.statusText ? ` ${detail.statusText}` : ""}`);
  if (detail.endpoint) lines.push(`Gateway 주소: ${detail.endpoint}`);
  if (detail.serverCode) lines.push(`서버 코드: ${detail.serverCode}`);
  if (detail.requestId) lines.push(`요청 ID: ${detail.requestId}`);
  if (detail.bodyPreview) lines.push(`응답 본문: ${detail.bodyPreview}`);
  return lines.join("\n");
}

function setAdminAiStatus(message, state = "") {
  const status = document.getElementById("admin-ai-status");
  const details = document.getElementById("admin-ai-error-details");
  if (!status) return;
  status.className = `admin-ai-status${state ? ` is-${state}` : ""}`;
  status.innerText = message;
  if (state !== "error" && details) details.hidden = true;
}

function showAdminAiError(error) {
  const detail = getAiErrorDetail(error);
  setAdminAiStatus(`AI 연결에 실패했습니다: ${detail.message}`, "error");
  const details = document.getElementById("admin-ai-error-details");
  const detailText = document.getElementById("admin-ai-error-detail");
  if (details && detailText) { detailText.innerText = formatAiErrorDetail(detail); details.hidden = false; }
}

bindClick("admin-ai-test-btn", async () => {
  const settings = readAdminAiSettings();
  const testButton = document.getElementById("admin-ai-test-btn");
  if (!settings.endpoint || !settings.model) { setAdminAiStatus("API 주소와 모델명을 입력하세요.", "error"); return; }
  testButton.disabled = true; setAdminAiStatus("Cloud Function에서 LLM Gateway 연결을 확인하는 중...");
  const startedAt = performance.now();
  try {
    const response = await testAiConnectionFunction(settings);
    const result = response.data;
    const latencyMs = Number.isFinite(result.latencyMs) ? result.latencyMs : Math.round(performance.now() - startedAt);
    setAdminAiStatus(`연결 성공 · ${result.model} · ${latencyMs}ms · 응답: ${result.reply}`, "success");
    document.getElementById("admin-ai-chat-connection").innerText = `${result.model} · ${latencyMs}ms`;
  } catch (error) {
    console.error("Cloud Function AI 연결 테스트 실패", error);
    showAdminAiError(error);
  } finally { testButton.disabled = false; }
});

let adminAiChatHistory = [];
let adminAiChatBusy = false;

function renderAdminAiChat() {
  const log = document.getElementById("admin-ai-chat-log");
  if (!log) return;
  log.innerHTML = "";
  if (!adminAiChatHistory.length) { log.innerHTML = '<p class="admin-ai-chat-empty">연결 테스트 후 메시지를 보내 보세요.</p>'; return; }
  adminAiChatHistory.forEach(message => {
    const bubble = document.createElement("div");
    bubble.className = `admin-ai-message ${message.role}${message.pending ? " pending" : ""}`;
    bubble.innerText = message.content;
    log.appendChild(bubble);
  });
  log.scrollTop = log.scrollHeight;
}

function setAdminAiChatBusy(busy) {
  adminAiChatBusy = busy;
  const send = document.getElementById("admin-ai-chat-send-btn");
  const input = document.getElementById("admin-ai-chat-input");
  if (send) { send.disabled = busy; send.innerText = busy ? "전송 중..." : "전송"; }
  if (input) input.disabled = busy;
}

bindClick("admin-ai-chat-send-btn", async () => {
  if (adminAiChatBusy) return;
  const input = document.getElementById("admin-ai-chat-input");
  const text = input?.value.trim();
  if (!text) return;
  adminAiChatHistory.push({role: "user", content: text});
  input.value = "";
  adminAiChatHistory.push({role: "assistant", content: "응답을 기다리는 중...", pending: true});
  renderAdminAiChat();
  setAdminAiChatBusy(true);
  const startedAt = performance.now();
  try {
    const messages = adminAiChatHistory.filter(message => !message.pending).slice(-10).map(({role, content}) => ({role, content}));
    const response = await adminAiChatFunction({messages});
    const result = response.data;
    adminAiChatHistory[adminAiChatHistory.length - 1] = {role: "assistant", content: result.reply};
    const latencyMs = Number.isFinite(result.latencyMs) ? result.latencyMs : Math.round(performance.now() - startedAt);
    document.getElementById("admin-ai-chat-connection").innerText = `${result.model} · ${latencyMs}ms`;
  } catch (error) {
    adminAiChatHistory[adminAiChatHistory.length - 1] = {role: "assistant", content: `오류: ${getAiErrorDetail(error).message}`};
    showAdminAiError(error);
  } finally {
    renderAdminAiChat();
    setAdminAiChatBusy(false);
    input?.focus();
  }
});
document.getElementById("admin-ai-chat-input")?.addEventListener("keydown", event => {
  if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) { event.preventDefault(); document.getElementById("admin-ai-chat-send-btn")?.click(); }
});

bindClick("menu-list-btn", () => { 
  playSound("click"); 
  isWordHidden = false; isMeanHidden = false;
  document.getElementById("toggle-word-btn").innerText = "영어 가리기";
  document.getElementById("toggle-mean-btn").innerText = "뜻 가리기";
  renderWordList(); 
  document.getElementById("list-screen").hidden = false;
});
bindClick("list-back-btn", () => { playSound("click"); document.getElementById("list-screen").hidden = true; });
document.getElementById("list-screen")?.addEventListener("click", event => {
  if (event.target === event.currentTarget) event.currentTarget.hidden = true;
});
let pokemonEncounterTimer = null;

function closePokemonBattle() {
  clearTimeout(pokemonEncounterTimer);
  pokemonEncounterTimer = null;
  const overlay = document.getElementById("pokemon-battle-overlay");
  if (overlay) overlay.hidden = true;
}

function openPokemonBattle() {
  const overlay = document.getElementById("pokemon-battle-overlay");
  const modal = overlay?.querySelector(".pokemon-battle-modal");
  if (!overlay || !modal) return;
  clearTimeout(pokemonEncounterTimer);
  overlay.hidden = false;
  modal.classList.remove("is-battle");
  void modal.offsetWidth;
  modal.classList.add("is-encounter");
  pokemonEncounterTimer = setTimeout(() => {
    modal.classList.remove("is-encounter");
    modal.classList.add("is-battle");
    pokemonEncounterTimer = null;
  }, 1900);
}

bindClick("menu-pokemon-btn", () => { playSound("click"); openPokemonBattle(); });
bindClick("pokemon-battle-close-btn", () => { playSound("click"); closePokemonBattle(); });
document.getElementById("pokemon-battle-overlay")?.addEventListener("click", event => {
  if (event.target === event.currentTarget) closePokemonBattle();
});
document.addEventListener("keydown", event => {
  if (event.key === "Escape") {
    const overlay = document.getElementById("list-screen");
    if (overlay && !overlay.hidden) overlay.hidden = true;
    const flashcardOverlay = document.getElementById("flashcard-screen");
    if (flashcardOverlay && !flashcardOverlay.hidden) { saveFlashcardProgress(); flashcardOverlay.hidden = true; currentGameMode = ""; }
    const chunkPracticeOverlay = document.getElementById("chunk-practice-overlay");
    if (chunkPracticeOverlay && !chunkPracticeOverlay.hidden) chunkPracticeOverlay.hidden = true;
    const aiTranslateOverlay = document.getElementById("ai-translate-overlay");
    if (aiTranslateOverlay && !aiTranslateOverlay.hidden && !aiTranslateBusy) aiTranslateOverlay.hidden = true;
    const pokemonBattleOverlay = document.getElementById("pokemon-battle-overlay");
    if (pokemonBattleOverlay && !pokemonBattleOverlay.hidden) closePokemonBattle();
  }
});

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
  return getStarClassCore(count);
}

function renderWordList() {
  document.getElementById("list-title").innerText = currentSetTitle;
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

bindClick("menu-fc-btn", () => { playSound("click"); currentGameMode = "fc"; fcIsRandom = false; startFlashcard(); });
let chunkPracticeSentences = [];
let chunkPracticeIndex = 0;
let chunkPracticeSelected = [];
let chunkPracticePieces = [];
let chunkPracticeShuffledIndices = [];
let chunkPracticeWrongPositions = [];
let chunkPracticeLastWrongPieces = [];
let chunkPracticeHintPiece = null;
let chunkPracticeLocked = false;

function showChunkPracticeUnsupported() {
  showSiteConfirm("문장이 있는 세트가 맞는지를 확인하세요.", () => {}, {
    title: "문장 해석 연습을 지원하지 않는 세트예요.",
    okText: "확인",
    hideCancel: true
  });
}

function openChunkPractice() {
  const selectedSet = wordSets.find(set => String(set.id) === String(currentSetId));
  if (!selectedSet || selectedSet.type !== "문장(끊어읽기)") { showChunkPracticeUnsupported(); return; }
  chunkPracticeSentences = selectedSet.words.filter(word => String(word.en || "").includes("/") && String(word.ko || "").trim());
  if (!chunkPracticeSentences.length) { showChunkPracticeUnsupported(); return; }
  chunkPracticeIndex = 0;
  document.getElementById("chunk-practice-overlay").hidden = false;
  loadChunkPracticeSentence();
}

function closeChunkPractice() {
  document.getElementById("chunk-practice-overlay").hidden = true;
}

function loadChunkPracticeSentence() {
  const sentence = chunkPracticeSentences[chunkPracticeIndex];
  chunkPracticePieces = String(sentence.en).split("/").map(part => part.trim()).filter(Boolean);
  chunkPracticeShuffledIndices = Array.from({ length: chunkPracticePieces.length }, (_, index) => index);
  for (let index = chunkPracticeShuffledIndices.length - 1; index > 0; index--) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    [chunkPracticeShuffledIndices[index], chunkPracticeShuffledIndices[randomIndex]] = [chunkPracticeShuffledIndices[randomIndex], chunkPracticeShuffledIndices[index]];
  }
  if (chunkPracticeShuffledIndices.length > 1 && chunkPracticeShuffledIndices.every((value, index) => value === index)) {
    [chunkPracticeShuffledIndices[0], chunkPracticeShuffledIndices[1]] = [chunkPracticeShuffledIndices[1], chunkPracticeShuffledIndices[0]];
  }
  chunkPracticeSelected = [];
  chunkPracticeWrongPositions = [];
  chunkPracticeLastWrongPieces = [];
  chunkPracticeHintPiece = null;
  chunkPracticeLocked = false;
  document.getElementById("chunk-practice-progress").innerText = `문장 ${chunkPracticeIndex + 1} / ${chunkPracticeSentences.length}`;
  document.getElementById("chunk-practice-meaning").innerText = String(sentence.ko).split("/").map(part => part.trim()).join(" ");
  document.getElementById("chunk-practice-feedback").innerText = "";
  document.getElementById("chunk-practice-hint-btn").hidden = true;
  renderChunkPractice();
}

function renderChunkPractice() {
  const answer = document.getElementById("chunk-practice-answer");
  const pieces = document.getElementById("chunk-practice-pieces");
  answer.innerHTML = ""; pieces.innerHTML = "";
  chunkPracticeSelected.forEach((pieceIndex, answerIndex) => {
    const button = document.createElement("button");
    button.type = "button"; button.className = "chunk-practice-piece selected";
    if (chunkPracticeWrongPositions.includes(answerIndex)) button.classList.add("hint-wrong");
    button.innerText = chunkPracticePieces[pieceIndex];
    button.onclick = () => {
      if (chunkPracticeLocked) return;
      chunkPracticeSelected.splice(answerIndex, 1); chunkPracticeWrongPositions = []; chunkPracticeHintPiece = null; renderChunkPractice();
    };
    answer.appendChild(button);
  });
  chunkPracticeShuffledIndices.forEach(pieceIndex => {
    const piece = chunkPracticePieces[pieceIndex];
    const button = document.createElement("button");
    button.type = "button"; button.className = "chunk-practice-piece"; button.innerText = piece;
    if (chunkPracticeHintPiece === pieceIndex) button.classList.add("hint-wrong");
    button.disabled = chunkPracticeSelected.includes(pieceIndex);
    button.onclick = () => {
      if (chunkPracticeLocked) return;
      const sourceRect = button.getBoundingClientRect();
      chunkPracticeSelected.push(pieceIndex); chunkPracticeWrongPositions = []; chunkPracticeHintPiece = null; renderChunkPractice();
      const placed = answer.lastElementChild;
      if (placed) {
        const targetRect = placed.getBoundingClientRect();
        placed.animate([
          { transform: `translate(${sourceRect.left - targetRect.left}px, ${sourceRect.top - targetRect.top}px) scale(.92)`, opacity: .65 },
          { transform: "translate(0, 0) scale(1)", opacity: 1 }
        ], { duration: 280, easing: "cubic-bezier(.2,.8,.2,1)" });
      }
    };
    pieces.appendChild(button);
  });
  answer.classList.toggle("is-empty", chunkPracticeSelected.length === 0);
}

bindClick("menu-chunk-practice-btn", () => { playSound("click"); openChunkPractice(); });
bindClick("chunk-practice-close-btn", () => { playSound("click"); closeChunkPractice(); });
document.getElementById("chunk-practice-overlay")?.addEventListener("click", event => { if (event.target === event.currentTarget) closeChunkPractice(); });
bindClick("chunk-practice-check-btn", () => {
  playSound("click");
  const feedback = document.getElementById("chunk-practice-feedback");
  if (chunkPracticeSelected.length !== chunkPracticePieces.length) { feedback.innerText = "문장 덩어리를 모두 선택하세요."; return; }
  const correct = chunkPracticeSelected.every((pieceIndex, index) => pieceIndex === index);
  if (!correct) {
    playSound("wrong");
    chunkPracticeLocked = true;
    chunkPracticeLastWrongPieces = chunkPracticeSelected.filter((pieceIndex, index) => pieceIndex !== index);
    feedback.innerText = "순서가 맞지 않습니다. 조각을 다시 놓아 보세요.";
    document.getElementById("chunk-practice-hint-btn").hidden = false;
    const answer = document.getElementById("chunk-practice-answer");
    answer.classList.add("is-wrong");
    setTimeout(() => {
      answer.classList.remove("is-wrong");
      chunkPracticeSelected = [];
      chunkPracticeWrongPositions = [];
      chunkPracticeLocked = false;
      renderChunkPractice();
    }, 650);
    return;
  }
  playSound("success");
  chunkPracticeLocked = true;
  feedback.innerText = "정답입니다.";
  document.getElementById("chunk-practice-answer").classList.add("is-correct");
  const success = document.getElementById("chunk-practice-success");
  success.classList.remove("show");
  void success.offsetWidth;
  success.classList.add("show");
  setTimeout(() => {
    document.getElementById("chunk-practice-answer").classList.remove("is-correct");
    success.classList.remove("show");
    chunkPracticeIndex++;
    if (chunkPracticeIndex >= chunkPracticeSentences.length) {
      closeChunkPractice();
      window.customAlert("문장 해석 연습을 모두 마쳤습니다.");
      return;
    }
    loadChunkPracticeSentence();
  }, 1050);
});
bindClick("chunk-practice-hint-btn", () => {
  playSound("click");
  if (!chunkPracticeLastWrongPieces.length) return;
  chunkPracticeHintPiece = chunkPracticeLastWrongPieces[Math.floor(Math.random() * chunkPracticeLastWrongPieces.length)];
  document.getElementById("chunk-practice-feedback").innerText = "틀린 조각 중 하나를 알려줍니다.";
  renderChunkPractice();
});

let aiTranslateSentences = [];
let aiTranslateIndex = 0;
let aiTranslateBusy = false;

function setAiTranslateBusy(busy) {
  aiTranslateBusy = busy;
  const button = document.getElementById("ai-translate-submit-btn");
  if (!button) return;
  button.disabled = busy;
  button.querySelector(".submit-label").hidden = busy;
  button.querySelector(".submit-loading").hidden = !busy;
}

function closeAiTranslate() {
  if (aiTranslateBusy) return;
  document.getElementById("ai-translate-overlay").hidden = true;
}

function loadAiTranslateSentence() {
  const sentence = aiTranslateSentences[aiTranslateIndex];
  document.getElementById("ai-translate-progress").innerText = `문장 ${aiTranslateIndex + 1} / ${aiTranslateSentences.length}`;
  document.getElementById("ai-translate-sentence").innerText = String(sentence.en || "").split("/").map(part => part.trim()).join(" ");
  document.getElementById("ai-translate-answer").value = "";
  document.getElementById("ai-translate-result").innerText = "";
  document.getElementById("ai-translate-answer").focus();
}

async function openAiTranslate() {
  const selectedSet = wordSets.find(set => String(set.id) === String(currentSetId));
  if (!selectedSet || !["문장", "문장(끊어읽기)"].includes(selectedSet.type)) {
    showSiteConfirm("문장 또는 문장(끊어읽기) 타입의 세트를 선택하세요.", () => {}, { title: "AI 문장 해석을 지원하지 않는 세트예요.", okText: "확인", hideCancel: true });
    return;
  }
  aiTranslateSentences = selectedSet.words.filter(word => String(word.en || "").trim() && String(word.ko || "").trim());
  if (!aiTranslateSentences.length) {
    showSiteConfirm("문장이 있는 세트가 맞는지를 확인하세요.", () => {}, { title: "AI 문장 해석을 지원하지 않는 세트예요.", okText: "확인", hideCancel: true });
    return;
  }
  const overlay = document.getElementById("ai-translate-overlay");
  const connecting = document.getElementById("ai-translate-connecting");
  const content = document.getElementById("ai-translate-content");
  overlay.hidden = false; connecting.hidden = false; content.hidden = true;
  document.getElementById("ai-translate-progress").innerText = "AI API에 연결 중입니다...";
  try {
    const settings = await getAiSettings(true);
    if (!settings.endpoint || !settings.model) throw new Error("AI 설정 없음");
    await testAiConnectionFunction(settings);
    aiTranslateIndex = 0;
    connecting.hidden = true; content.hidden = false;
    loadAiTranslateSentence();
  } catch (error) {
    console.error("AI 문장 해석 연결 실패", error);
    closeAiTranslate();
    showSiteConfirm("선생님께 AI 연결 설정을 확인해 달라고 알려주세요.", () => {}, { title: "AI API에 연결하지 못했습니다.", okText: "확인", hideCancel: true });
  }
}

bindClick("menu-ai-translate-btn", () => { playSound("click"); openAiTranslate(); });
bindClick("ai-translate-close-btn", () => { playSound("click"); closeAiTranslate(); });
document.getElementById("ai-translate-overlay")?.addEventListener("click", event => { if (event.target === event.currentTarget) closeAiTranslate(); });
bindClick("ai-translate-submit-btn", async () => {
  if (aiTranslateBusy) return;
  const answer = document.getElementById("ai-translate-answer").value.trim();
  const result = document.getElementById("ai-translate-result");
  if (!answer) { result.innerText = "해석을 입력하세요."; return; }
  setAiTranslateBusy(true); result.innerText = "";
  const sentence = aiTranslateSentences[aiTranslateIndex];
  try {
    throw new Error("AI 문장 채점용 Cloud Function은 아직 연결되지 않았습니다.");
    const correct = false;
    if (!correct) { result.innerText = "틀렸습니다. 다시 해석해 보세요."; return; }
    result.innerText = "맞았습니다!";
    result.classList.add("correct");
    setTimeout(() => {
      result.classList.remove("correct");
      aiTranslateIndex++;
      if (aiTranslateIndex >= aiTranslateSentences.length) {
        document.getElementById("ai-translate-overlay").hidden = true;
        window.customAlert("AI 문장 해석을 모두 마쳤습니다.");
        return;
      }
      loadAiTranslateSentence();
    }, 750);
  } catch (error) {
    console.error("AI 채점 실패", error);
    result.innerText = "AI 채점에 실패했습니다. 잠시 후 다시 시도하세요.";
  } finally { setAiTranslateBusy(false); }
});
bindClick("flashcard-close-btn", () => { playSound("click"); saveFlashcardProgress(); document.getElementById("flashcard-screen").hidden = true; currentGameMode = ""; });
bindClick("flashcard-restart-btn", () => {
  playSound("click");
  showSiteConfirm("현재까지의 깜빡이 학습 진행 상태가 초기화됩니다.", () => {
    clearFlashcardProgress();
    startFlashcard(true);
  }, {
    title: "처음부터 다시 시작할까요?",
    cancelText: "계속 학습하기",
    okText: "처음부터 다시하기"
  });
});
bindClick("fc-unknown-list-btn", () => {
  playSound("click");
  const list = document.getElementById("fc-unknown-list");
  const button = document.getElementById("fc-unknown-list-btn");
  if (!list || !button) return;
  list.hidden = !list.hidden;
  button.innerText = list.hidden ? "몰라요 한 단어 리스트 보기" : "몰라요 한 단어 리스트 닫기";
});
document.getElementById("flashcard-screen")?.addEventListener("click", event => {
  if (event.target === event.currentTarget) { saveFlashcardProgress(); event.currentTarget.hidden = true; currentGameMode = ""; }
});

bindClick("menu-memory-btn", () => { playSound("click"); currentGameMode = "memory"; showScreen("time-option-screen"); });
const soloSpeedMatchOptions = { time: null, score: null, treasure: null };
let soloSpeedMatchActive = false;
let soloSpeedMatchStage = "setup";
let soloSpeedMatchFinishing = false;
let inventoryBarHomeParent = null;
let inventoryBarHomeNextSibling = null;

function clearGameInventory() {
  ["pile-double_current", "pile-half_current", "pile-double_future"].forEach(id => {
    const pile = document.getElementById(id);
    if (pile) pile.innerHTML = "";
  });
}

function moveInventoryToSoloGame(gameAreaId) {
  const inventory = document.getElementById("inventory-bar");
  const status = document.querySelector(`#${gameAreaId} .sm-game-status, #${gameAreaId} .chunk-game-status, #${gameAreaId} .speed-solo-game-status`);
  if (!inventory || !status) return;
  if (!inventoryBarHomeParent) {
    inventoryBarHomeParent = inventory.parentElement;
    inventoryBarHomeNextSibling = inventory.nextSibling;
  }
  status.appendChild(inventory);
  inventory.classList.add("is-sm-contained");
}

function restoreGameInventory() {
  const inventory = document.getElementById("inventory-bar");
  if (!inventory) return;
  inventory.classList.remove("is-sm-contained");
  if (inventoryBarHomeParent && inventory.parentElement !== inventoryBarHomeParent) {
    inventoryBarHomeParent.insertBefore(inventory, inventoryBarHomeNextSibling);
  }
}

function setSoloSpeedMatchStage(stage) {
  soloSpeedMatchStage = stage;
  const screen = document.getElementById("speed-match-screen");
  const actionButton = document.getElementById("sm-solo-start-btn");
  const closeButton = document.getElementById("sm-solo-close-btn");
  screen.classList.toggle("sm-setup-mode", stage === "setup");
  screen.classList.toggle("sm-playing-mode", stage === "playing");
  screen.classList.toggle("sm-result-mode", stage === "result");
  actionButton.innerText = stage === "setup" ? "시작하기!" : stage === "playing" ? "게임 중단하기" : "다시하기";
  actionButton.classList.toggle("is-stop", stage === "playing");
  actionButton.classList.toggle("is-finish", stage === "result");
  actionButton.disabled = stage === "setup" ? !Object.values(soloSpeedMatchOptions).every(Boolean) : false;
  closeButton.hidden = stage === "playing";
  closeButton.innerText = stage === "result" ? "끝내기" : "닫기";
}

function openSoloSpeedMatchSetup() {
  currentGameMode = "speed-match";
  soloSpeedMatchActive = true;
  soloSpeedMatchOptions.time = null; soloSpeedMatchOptions.score = null; soloSpeedMatchOptions.treasure = null;
  const screen = document.getElementById("speed-match-screen");
  screen.style.display = "grid";
  screen.classList.add("sm-solo-mode");
  screen.classList.remove("sm-playing-mode", "sm-result-mode");
  document.getElementById("top-left-controls").style.display = "none";
  document.getElementById("sm-solo-settings").hidden = false;
  document.getElementById("sm-game-area").classList.add("is-preview");
  document.getElementById("sm-preview-message").hidden = false;
  document.getElementById("sm-solo-result").hidden = true;
  moveInventoryToSoloGame("sm-game-area");
  clearGameInventory();
  soloSpeedMatchFinishing = false;
  setSoloSpeedMatchStage("setup");
  document.querySelectorAll("#sm-solo-settings [data-sm-option]").forEach(button => { button.classList.remove("selected"); button.disabled = false; });
  document.getElementById("sm-left-col").innerHTML = "";
  document.getElementById("sm-right-col").innerHTML = "";
  document.getElementById("sm-timer").innerText = "시간 설정";
  document.getElementById("sm-score").style.display = "";
  document.getElementById("sm-score").innerText = "점수 설정";
}

function closeSoloSpeedMatch() {
  clearInterval(gameTimerInterval);
  clearInterval(cdInterval);
  closeTreasureOverlay(false);
  const inlineCountdown = document.getElementById("sm-inline-countdown");
  if (inlineCountdown) inlineCountdown.hidden = true;
  const screen = document.getElementById("speed-match-screen");
  screen.classList.remove("sm-solo-mode", "sm-setup-mode", "sm-playing-mode", "sm-result-mode");
  screen.style.display = "none";
  document.getElementById("sm-solo-settings").hidden = true;
  document.getElementById("sm-game-area").classList.remove("is-preview");
  document.getElementById("sm-solo-result").hidden = true;
  restoreBuffMessageOverlay();
  restoreGameInventory();
  soloSpeedMatchActive = false;
  soloSpeedMatchStage = "setup";
  soloSpeedMatchFinishing = false;
  currentGameMode = "";
  document.getElementById("top-left-controls").style.display = "none";
}

bindClick("menu-speed-match-btn", () => { playSound("click"); openSoloSpeedMatchSetup(); });
bindClick("sm-solo-close-btn", () => { playSound("click"); closeSoloSpeedMatch(); });
document.querySelectorAll("#sm-solo-settings [data-sm-option]").forEach(button => {
  button.addEventListener("click", () => {
    playSound("click");
    const option = button.dataset.smOption;
    soloSpeedMatchOptions[option] = button.dataset.value;
    document.querySelectorAll(`#sm-solo-settings [data-sm-option="${option}"]`).forEach(item => item.classList.toggle("selected", item === button));
    document.getElementById("sm-solo-start-btn").disabled = !Object.values(soloSpeedMatchOptions).every(Boolean);
  });
});
bindClick("sm-solo-start-btn", () => {
  if (soloSpeedMatchStage === "playing") {
    if (soloSpeedMatchFinishing) return;
    currentUser.score = gameScore;
    document.getElementById("result-detail").innerText = "게임을 중단한 시점까지의 기록입니다.";
    goResult();
    return;
  }
  if (soloSpeedMatchStage === "result") {
    playSound("click");
    document.getElementById("sm-solo-result").hidden = true;
    setSoloSpeedMatchStage("playing");
    document.querySelectorAll("#sm-solo-settings [data-sm-option]").forEach(button => { button.disabled = true; });
    document.getElementById("sm-game-area").classList.remove("is-preview");
    document.getElementById("sm-preview-message").hidden = true;
    clearGameInventory();
    gameScore = 0; globalScoreMultiplier = 1; isGamePaused = false; lastMatchTime = Date.now();
    gameTimeRemaining = soloSpeedMatchOptions.time === "unlimited" ? 0 : soloSpeedMatchOptions.time === "test10" ? 10 : 180;
    runSoloSpeedMatchCountdown();
    return;
  }
  if (!Object.values(soloSpeedMatchOptions).every(Boolean)) return;
  playSound("success");
  const speedMatchScreen = document.getElementById("speed-match-screen");
  setSoloSpeedMatchStage("playing");
  document.querySelectorAll("#sm-solo-settings [data-sm-option]").forEach(button => { button.disabled = true; });
  document.getElementById("sm-game-area").classList.remove("is-preview");
  document.getElementById("sm-preview-message").hidden = true;
  document.getElementById("top-left-controls").style.display = "none";
  clearGameInventory();
  gameScore = 0; globalScoreMultiplier = 1; isGamePaused = false; lastMatchTime = Date.now();
  if (soloSpeedMatchOptions.time === "unlimited") {
    gameTimeRemaining = 0;
    runSoloSpeedMatchCountdown();
  } else {
    gameTimeRemaining = soloSpeedMatchOptions.time === "test10" ? 10 : 180;
    runSoloSpeedMatchCountdown();
  }
});

function runSoloSpeedMatchCountdown() {
  const overlay = document.getElementById("sm-inline-countdown");
  const number = overlay.querySelector("strong");
  overlay.hidden = false;
  let count = 3;
  number.innerText = count;
  clearInterval(cdInterval);
  cdInterval = setInterval(() => {
    count--;
    if (count > 0) {
      playSound("click"); number.innerText = count;
      number.classList.remove("pulse"); void number.offsetWidth; number.classList.add("pulse");
      return;
    }
    clearInterval(cdInterval);
    overlay.hidden = true;
    playSound("success"); lastMatchTime = Date.now(); startSpeedMatchLogic();
  }, 700);
}

const soloChunkOptions = { time: null, score: null, treasure: null };
let soloChunkActive = false;
let soloChunkStage = "setup";
let soloChunkFinishing = false;
let soloChunkSentences = [];
let soloChunkCompletedCount = 0;
let soloChunkPieces = [];
let soloChunkSelected = [];
let soloChunkShuffledIndices = [];

function parseChunkGameSentence(word) {
  const enParts = String(word?.en || "").split("/").map(part => part.trim()).filter(Boolean);
  const koText = String(word?.ko || "").split("/").map(part => part.trim()).filter(Boolean).join(" ");
  if (enParts.length < 2 || !koText) return null;
  return { enParts, koText };
}

function setSoloChunkStage(stage) {
  soloChunkStage = stage;
  const screen = document.getElementById("chunk-screen");
  const actionButton = document.getElementById("chunk-solo-start-btn");
  const closeButton = document.getElementById("chunk-solo-close-btn");
  screen.classList.toggle("chunk-setup-mode", stage === "setup");
  screen.classList.toggle("chunk-playing-mode", stage === "playing");
  screen.classList.toggle("chunk-result-mode", stage === "result");
  actionButton.innerText = stage === "setup" ? "시작하기!" : stage === "playing" ? "게임 중단하기" : "다시하기";
  actionButton.classList.toggle("is-stop", stage === "playing");
  actionButton.classList.toggle("is-finish", stage === "result");
  actionButton.disabled = stage === "setup" ? !Object.values(soloChunkOptions).every(Boolean) : false;
  closeButton.hidden = stage === "playing";
  closeButton.innerText = stage === "result" ? "끝내기" : "닫기";
}

function showChunkGameUnsupported() {
  showSiteConfirm("문장(끊어읽기) 세트에 /로 나눈 문장이 두 조각 이상 있어야 합니다.", () => {}, {
    title: "문장 해석 게임을 지원하지 않는 세트예요.", okText: "확인", hideCancel: true
  });
}

function openSoloChunkSetup() {
  const selectedSet = wordSets.find(set => String(set.id) === String(currentSetId));
  if (!selectedSet || selectedSet.type !== "문장(끊어읽기)") { showChunkGameUnsupported(); return; }
  soloChunkSentences = selectedSet.words.map(word => ({ word, parsed: parseChunkGameSentence(word) })).filter(item => item.parsed);
  if (!soloChunkSentences.length) { showChunkGameUnsupported(); return; }
  currentGameMode = "chunk";
  soloChunkActive = true;
  soloChunkOptions.time = null; soloChunkOptions.score = null; soloChunkOptions.treasure = null;
  const screen = document.getElementById("chunk-screen");
  screen.style.display = "grid";
  screen.classList.add("chunk-solo-mode");
  screen.classList.remove("chunk-playing-mode", "chunk-result-mode");
  document.getElementById("top-left-controls").style.display = "none";
  document.getElementById("chunk-solo-settings").hidden = false;
  document.getElementById("chunk-game-area").classList.add("is-preview");
  document.getElementById("chunk-preview-message").hidden = false;
  document.getElementById("chunk-solo-result").hidden = true;
  document.getElementById("chunk-container").innerHTML = "";
  document.getElementById("chunk-buttons-container").innerHTML = "";
  document.getElementById("chunk-timer").innerText = "시간 설정";
  document.getElementById("chunk-score").style.display = "";
  document.getElementById("chunk-score").innerText = "점수 설정";
  document.getElementById("chunk-game-meaning").innerText = "문장의 뜻";
  document.getElementById("chunk-game-progress").innerText = "문장 해석 게임";
  moveInventoryToSoloGame("chunk-game-area");
  clearGameInventory();
  soloChunkFinishing = false;
  setSoloChunkStage("setup");
  document.querySelectorAll("#chunk-solo-settings [data-chunk-option]").forEach(button => { button.classList.remove("selected"); button.disabled = false; });
}

function closeSoloChunk() {
  clearInterval(gameTimerInterval); clearInterval(cdInterval); clearTimeout(chunkTimeout);
  closeTreasureOverlay(false);
  const countdown = document.getElementById("chunk-inline-countdown");
  if (countdown) countdown.hidden = true;
  const screen = document.getElementById("chunk-screen");
  screen.classList.remove("chunk-solo-mode", "chunk-setup-mode", "chunk-playing-mode", "chunk-result-mode");
  screen.style.display = "none";
  document.getElementById("chunk-solo-settings").hidden = true;
  document.getElementById("chunk-game-area").classList.remove("is-preview");
  document.getElementById("chunk-solo-result").hidden = true;
  restoreBuffMessageOverlay(); restoreGameInventory();
  soloChunkActive = false; soloChunkStage = "setup"; soloChunkFinishing = false;
  currentGameMode = ""; isGamePaused = false;
}

bindClick("chunk-solo-close-btn", () => { playSound("click"); closeSoloChunk(); });
document.querySelectorAll("#chunk-solo-settings [data-chunk-option]").forEach(button => {
  button.addEventListener("click", () => {
    playSound("click");
    const option = button.dataset.chunkOption;
    soloChunkOptions[option] = button.dataset.value;
    document.querySelectorAll(`#chunk-solo-settings [data-chunk-option="${option}"]`).forEach(item => item.classList.toggle("selected", item === button));
    document.getElementById("chunk-solo-start-btn").disabled = !Object.values(soloChunkOptions).every(Boolean);
  });
});
bindClick("chunk-solo-start-btn", () => {
  if (soloChunkStage === "playing") {
    if (soloChunkFinishing) return;
    document.getElementById("result-detail").innerText = "게임을 중단한 시점까지의 기록입니다.";
    goResult(); return;
  }
  if (soloChunkStage === "result") {
    playSound("click");
    document.getElementById("chunk-solo-result").hidden = true;
    setSoloChunkStage("playing");
    document.querySelectorAll("#chunk-solo-settings [data-chunk-option]").forEach(button => { button.disabled = true; });
    document.getElementById("chunk-game-area").classList.remove("is-preview");
    document.getElementById("chunk-preview-message").hidden = true;
    gameScore = 0; globalScoreMultiplier = 1; isGamePaused = false; lastMatchTime = Date.now();
    gameTimeRemaining = soloChunkOptions.time === "unlimited" ? 0 : soloChunkOptions.time === "test10" ? 10 : 180;
    clearGameInventory();
    const overlay = document.getElementById("chunk-inline-countdown");
    const number = overlay.querySelector("strong");
    overlay.hidden = false; let count = 3; number.innerText = count; clearInterval(cdInterval);
    cdInterval = setInterval(() => {
      count--;
      if (count > 0) { playSound("click"); number.innerText = count; number.classList.remove("pulse"); void number.offsetWidth; number.classList.add("pulse"); return; }
      clearInterval(cdInterval); overlay.hidden = true; playSound("success"); startChunkLogic();
    }, 700);
    return;
  }
  if (!Object.values(soloChunkOptions).every(Boolean)) return;
  playSound("success"); setSoloChunkStage("playing");
  document.querySelectorAll("#chunk-solo-settings [data-chunk-option]").forEach(button => { button.disabled = true; });
  document.getElementById("chunk-game-area").classList.remove("is-preview");
  document.getElementById("chunk-preview-message").hidden = true;
  gameScore = 0; globalScoreMultiplier = 1; isGamePaused = false; lastMatchTime = Date.now();
  gameTimeRemaining = soloChunkOptions.time === "unlimited" ? 0 : soloChunkOptions.time === "test10" ? 10 : 180;
  clearGameInventory();
  const overlay = document.getElementById("chunk-inline-countdown");
  const number = overlay.querySelector("strong");
  overlay.hidden = false; let count = 3; number.innerText = count; clearInterval(cdInterval);
  cdInterval = setInterval(() => {
    count--;
    if (count > 0) { playSound("click"); number.innerText = count; number.classList.remove("pulse"); void number.offsetWidth; number.classList.add("pulse"); return; }
    clearInterval(cdInterval); overlay.hidden = true; playSound("success"); startChunkLogic();
  }, 700);
});
bindClick("menu-fish-btn", () => { playSound("click"); currentGameMode = "fish"; showScreen("time-option-screen"); });
bindClick("time-option-back-btn", () => { playSound("click"); showScreen("menu-screen"); }); 
bindClick("menu-chunk-btn", () => { playSound("click"); openSoloChunkSetup(); });

const soloSpeedOptions = { time: null, score: null, treasure: null };
let soloSpeedActive = false;
let soloSpeedStage = "setup";
let soloSpeedFinishing = false;
let soloSpeedQuestions = [];
let soloSpeedCompletedCount = 0;

function parseSentenceQuizPairs(word, sourceIndex) {
  const enParts = String(word?.en || "").split("/");
  const koParts = String(word?.ko || "").split("/");
  if (enParts.length !== koParts.length) return [];
  const pairs = [];
  for (let index = 0; index < enParts.length; index++) {
    const en = enParts[index].trim(); const ko = koParts[index].trim();
    if (!en || !ko) return [];
    pairs.push({ id: `${sourceIndex}:${index}`, en, ko });
  }
  return pairs;
}

function setSoloSpeedStage(stage) {
  soloSpeedStage = stage;
  const screen = document.getElementById("speed-solo-screen");
  const actionButton = document.getElementById("speed-solo-start-btn");
  const closeButton = document.getElementById("speed-solo-close-btn");
  screen.classList.toggle("speed-solo-setup-mode", stage === "setup");
  screen.classList.toggle("speed-solo-playing-mode", stage === "playing");
  screen.classList.toggle("speed-solo-result-mode", stage === "result");
  actionButton.innerText = stage === "setup" ? "시작하기!" : stage === "playing" ? "게임 중단하기" : "다시하기";
  actionButton.classList.toggle("is-stop", stage === "playing");
  actionButton.classList.toggle("is-finish", stage === "result");
  actionButton.disabled = stage === "setup" ? !Object.values(soloSpeedOptions).every(Boolean) : false;
  closeButton.hidden = stage === "playing";
  closeButton.innerText = stage === "result" ? "끝내기" : "닫기";
}

function openSoloSpeedSetup() {
  const selectedSet = wordSets.find(set => String(set.id) === String(currentSetId));
  if (!selectedSet || !Array.isArray(selectedSet.words)) return;
  if (selectedSet.type === "문장(끊어읽기)") {
    soloSpeedQuestions = selectedSet.words.flatMap((word, index) => parseSentenceQuizPairs(word, index));
    const distinctKorean = new Set(soloSpeedQuestions.map(question => question.ko.replace(/\s+/g, " ")));
    if (!soloSpeedQuestions.length || distinctKorean.size < 2) {
      showSiteConfirm("영어와 한국어 조각이 같은 수로 나뉜 문장이 두 개 이상의 서로 다른 뜻을 포함해야 합니다.", () => {}, { title: "심플퀴즈를 지원하지 않는 세트예요.", okText: "확인", hideCancel: true });
      return;
    }
  } else {
    soloSpeedQuestions = selectedSet.words.filter(word => String(word?.en || "").trim() && String(word?.ko || "").trim()).map((word, index) => ({ id: String(index), en: String(word.en).trim(), ko: String(word.ko).trim() }));
    const distinctKorean = new Set(soloSpeedQuestions.map(question => question.ko.replace(/\s+/g, " ")));
    if (soloSpeedQuestions.length < 2 || distinctKorean.size < 2) return;
  }
  currentGameMode = "speed"; soloSpeedActive = true;
  soloSpeedOptions.time = null; soloSpeedOptions.score = null; soloSpeedOptions.treasure = null;
  const screen = document.getElementById("speed-solo-screen");
  screen.style.display = "grid"; screen.classList.add("speed-solo-mode"); screen.classList.remove("speed-solo-playing-mode", "speed-solo-result-mode");
  document.getElementById("speed-solo-settings").hidden = false;
  document.getElementById("speed-solo-game-area").classList.add("is-preview");
  document.getElementById("speed-solo-preview-message").hidden = false;
  document.getElementById("speed-solo-result").hidden = true;
  document.getElementById("speed-solo-question").innerText = "Question";
  document.getElementById("speed-solo-options").innerHTML = "";
  document.getElementById("speed-solo-timer").innerText = "시간 설정";
  document.getElementById("speed-solo-score").style.display = "";
  document.getElementById("speed-solo-score").innerText = "점수 설정";
  moveInventoryToSoloGame("speed-solo-game-area"); clearGameInventory();
  soloSpeedFinishing = false; setSoloSpeedStage("setup");
  document.querySelectorAll("#speed-solo-settings [data-speed-option]").forEach(button => { button.classList.remove("selected"); button.disabled = false; });
}

function closeSoloSpeed() {
  clearInterval(gameTimerInterval); clearInterval(cdInterval); closeTreasureOverlay(false);
  const countdown = document.getElementById("speed-solo-inline-countdown"); if (countdown) countdown.hidden = true;
  const screen = document.getElementById("speed-solo-screen");
  screen.classList.remove("speed-solo-mode", "speed-solo-setup-mode", "speed-solo-playing-mode", "speed-solo-result-mode"); screen.style.display = "none";
  document.getElementById("speed-solo-settings").hidden = true; document.getElementById("speed-solo-game-area").classList.remove("is-preview"); document.getElementById("speed-solo-result").hidden = true;
  restoreBuffMessageOverlay(); restoreGameInventory(); soloSpeedActive = false; soloSpeedStage = "setup"; soloSpeedFinishing = false; currentGameMode = ""; isGamePaused = false;
}

function updateSoloSpeedUI() {
  const unlimited = soloSpeedOptions.time === "unlimited";
  const minutes = String(Math.floor(gameTimeRemaining / 60)).padStart(2, "0"); const seconds = String(gameTimeRemaining % 60).padStart(2, "0");
  document.getElementById("speed-solo-timer").innerText = unlimited ? "시간 제한 없음" : `🕒 ${minutes}:${seconds}`;
  document.getElementById("speed-solo-score").style.display = soloSpeedOptions.score === "off" ? "none" : "";
  document.getElementById("speed-solo-score").innerText = `점수: ${gameScore}`;
}

function loadNextSoloSpeedQuiz() {
  const validQuestions = soloSpeedQuestions.filter(question => soloSpeedQuestions.some(candidate => candidate.id !== question.id && candidate.ko.replace(/\s+/g, " ") !== question.ko.replace(/\s+/g, " ")));
  const question = validQuestions[Math.floor(Math.random() * validQuestions.length)];
  const wrongChoices = soloSpeedQuestions.filter(candidate => candidate.id !== question.id && candidate.ko.replace(/\s+/g, " ") !== question.ko.replace(/\s+/g, " "));
  const wrong = wrongChoices[Math.floor(Math.random() * wrongChoices.length)];
  const questionBox = document.getElementById("speed-solo-question");
  const options = document.getElementById("speed-solo-options");
  const selectedSet = wordSets.find(set => String(set.id) === String(currentSetId));
  document.getElementById("speed-solo-question-kind").innerText = selectedSet?.type === "문장(끊어읽기)" ? "영어 끊어읽기 덩어리" : "영어 단어";
  questionBox.innerText = question.en;
  options.innerHTML = "";
  [{ text: question.ko, correct: true }, { text: wrong.ko, correct: false }].sort(() => Math.random() - .5).forEach(choice => {
    const button = document.createElement("button"); button.type = "button"; button.innerText = choice.text;
    button.onclick = () => {
      if (isGamePaused) return;
      if (choice.correct) {
        playSound("success"); const earned = calcSpeedBonus();
        if (soloSpeedOptions.score === "on") gameScore += earned;
        soloSpeedCompletedCount++; updateSoloSpeedUI(); document.getElementById("speed-solo-feedback").innerText = "정답입니다!"; showGamePraise(earned);
        const allowTreasure = soloSpeedOptions.score === "on" && soloSpeedOptions.treasure === "on";
        if (allowTreasure && Math.random() < .3) { isGamePaused = true; triggerTreasureEvent(() => { isGamePaused = false; loadNextSoloSpeedQuiz(); }); } else loadNextSoloSpeedQuiz();
      } else {
        playSound("wrong"); isGamePaused = true; const penalty = calcSpeedBonus();
        if (soloSpeedOptions.score === "on") gameScore -= penalty;
        updateSoloSpeedUI(); document.getElementById("speed-solo-feedback").innerText = soloSpeedOptions.score === "on" ? `오답입니다. 정답: ${question.ko}` : `오답입니다. 정답: ${question.ko}`;
        options.classList.add("is-wrong");
        setTimeout(() => { options.classList.remove("is-wrong"); isGamePaused = false; loadNextSoloSpeedQuiz(); }, 900);
      }
    };
    options.appendChild(button);
  });
}

function startSoloSpeedLogic() {
  soloSpeedCompletedCount = 0; updateSoloSpeedUI();
  if (soloSpeedOptions.time !== "unlimited") gameTimerInterval = setInterval(() => {
    if (!isGamePaused) { gameTimeRemaining--; updateSoloSpeedUI(); if (gameTimeRemaining <= 0) { document.getElementById("result-detail").innerText = "제한 시간 종료! 획득한 퀴즈 점수입니다!"; goResult(); } }
  }, 1000);
  loadNextSoloSpeedQuiz();
}

function startSoloSpeedRound() {
  document.getElementById("speed-solo-result").hidden = true; setSoloSpeedStage("playing");
  document.querySelectorAll("#speed-solo-settings [data-speed-option]").forEach(button => { button.disabled = true; });
  document.getElementById("speed-solo-game-area").classList.remove("is-preview"); document.getElementById("speed-solo-preview-message").hidden = true;
  gameScore = 0; globalScoreMultiplier = 1; isGamePaused = false; lastMatchTime = Date.now();
  gameTimeRemaining = soloSpeedOptions.time === "unlimited" ? 0 : soloSpeedOptions.time === "test10" ? 10 : 180; clearGameInventory();
  const overlay = document.getElementById("speed-solo-inline-countdown"); const number = overlay.querySelector("strong"); overlay.hidden = false; let count = 3; number.innerText = count; clearInterval(cdInterval);
  cdInterval = setInterval(() => { count--; if (count > 0) { playSound("click"); number.innerText = count; number.classList.remove("pulse"); void number.offsetWidth; number.classList.add("pulse"); return; } clearInterval(cdInterval); overlay.hidden = true; playSound("success"); startSoloSpeedLogic(); }, 700);
}

bindClick("speed-solo-close-btn", () => { playSound("click"); closeSoloSpeed(); });
document.querySelectorAll("#speed-solo-settings [data-speed-option]").forEach(button => button.addEventListener("click", () => {
  playSound("click"); const option = button.dataset.speedOption; soloSpeedOptions[option] = button.dataset.value;
  document.querySelectorAll(`#speed-solo-settings [data-speed-option="${option}"]`).forEach(item => item.classList.toggle("selected", item === button));
  document.getElementById("speed-solo-start-btn").disabled = !Object.values(soloSpeedOptions).every(Boolean);
}));
bindClick("speed-solo-start-btn", () => {
  if (soloSpeedStage === "playing") { if (soloSpeedFinishing) return; document.getElementById("result-detail").innerText = "게임을 중단한 시점까지의 기록입니다."; goResult(); return; }
  if (soloSpeedStage === "result") { playSound("click"); startSoloSpeedRound(); return; }
  if (!Object.values(soloSpeedOptions).every(Boolean)) return;
  playSound("success"); startSoloSpeedRound();
});
bindClick("menu-speed-btn", () => { playSound("click"); openSoloSpeedSetup(); });

bindClick("time-10s-btn", () => { playSound("click"); routeGameStart("test10"); });
bindClick("time-3m-btn", () => { playSound("click"); routeGameStart(3); });
bindClick("time-5m-btn", () => { playSound("click"); routeGameStart(5); });

function routeGameStart(minutes) {
    globalMultiEndTime = null;
  if(currentGameMode === "memory") startCountdown(minutes, "memory-screen", startMemoryLogic);
  else if(currentGameMode === "speed-match") startCountdown(minutes, "speed-match-screen", startSpeedMatchLogic);
  else if(currentGameMode === "speed") startCountdown(minutes, "speed-screen", startSpeedLogic);
  else if(currentGameMode === "fish") startCountdown(minutes, "fishing-screen", startFishingLogic);
  else if(currentGameMode === "chunk") startCountdown(minutes, "chunk-screen", startChunkLogic);
}

// 🚀 [타이머 폭주 방지용 글로벌 자물쇠]
window.isCountdownActive = false; 



// =====================================================
// [06] 개인 게임 공통 시작 / 카운트다운 / 보상 UI
// -----------------------------------------------------
// - 10초 테스트 모드 포함 시간 계산
// - 5초 카운트다운
// - 게임 시작 전 상태 초기화
// - 칭찬 문구, 버프 메시지, 아이템 UI
// =====================================================


function startCountdown(minutes, screenId, logicCallback) {
  // 🚀 [안전 방어막] 혹시라도 시간 데이터가 깨지거나 누락되면 강제로 3분 분량을 확보합니다.
  // 🧪 단, 테스트용 "test10" 값은 정확히 10초로 처리합니다.
  const validSeconds = getDurationSeconds(minutes, 180);

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
  
  gameTimeRemaining = validSeconds; 
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
let buffMessageHomeParent = null;
let buffMessageHomeNextSibling = null;

function restoreBuffMessageOverlay() {
  const overlay = document.getElementById("buff-msg-overlay");
  if (!overlay) return;
  overlay.classList.remove("is-contained");
  if (buffMessageHomeParent && overlay.parentElement !== buffMessageHomeParent) {
    buffMessageHomeParent.insertBefore(overlay, buffMessageHomeNextSibling);
  }
}

function showBuffMsg(text, subText, r, g, b) {
  const overlay = document.getElementById("buff-msg-overlay");
  if (!buffMessageHomeParent) { buffMessageHomeParent = overlay.parentElement; buffMessageHomeNextSibling = overlay.nextSibling; }
  if (soloSpeedMatchActive || soloChunkActive) {
    document.getElementById(soloChunkActive ? "chunk-game-area" : "sm-game-area").appendChild(overlay);
    overlay.classList.add("is-contained");
  } else {
    restoreBuffMessageOverlay();
  }
  overlay.innerHTML = `<div>${text}</div><div style="font-size:24px; font-weight:normal; margin-top:5px;">${subText}</div>`;
  overlay.style.background = `rgba(${r}, ${g}, ${b}, 0.85)`; overlay.style.display = "flex";
  overlay.classList.remove("drift-anim"); void overlay.offsetWidth; overlay.classList.add("drift-anim");
  overlay.onclick = () => { overlay.style.display = "none"; clearTimeout(buffTimeout); restoreBuffMessageOverlay(); };
  clearTimeout(buffTimeout); buffTimeout = setTimeout(() => { overlay.style.display = "none"; restoreBuffMessageOverlay(); }, 2500);
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

let activeTreasureCallback = null;
let treasureHomeParent = null;
let treasureHomeNextSibling = null;

function restoreTreasureOverlay() {
  const overlay = document.getElementById("treasure-overlay");
  if (!overlay) return;
  overlay.style.display = "none";
  overlay.classList.remove("is-contained");
  overlay.querySelectorAll(".treasure-chest").forEach(chest => {
    chest.onclick = null;
    chest.classList.remove("chest-explode");
  });
  if (treasureHomeParent && overlay.parentElement !== treasureHomeParent) {
    treasureHomeParent.insertBefore(overlay, treasureHomeNextSibling);
  }
}

function closeTreasureOverlay(runCallback = false) {
  restoreTreasureOverlay();
  const callback = activeTreasureCallback;
  activeTreasureCallback = null;
  isGamePaused = false;
  if (runCallback && typeof callback === "function") callback();
}

function triggerTreasureEvent(callback, options = {}) {
  if (myLobbyDocId && window.multiUseBuffItems === false) {
      callback();
      return;
  }
  
  isGamePaused = true; playSound("treasure");
  const overlay = document.getElementById("treasure-overlay");
  if (!treasureHomeParent) { treasureHomeParent = overlay.parentElement; treasureHomeNextSibling = overlay.nextSibling; }
  const target = options.container || (soloChunkActive
    ? document.getElementById("chunk-game-area")
    : soloSpeedMatchActive
      ? document.getElementById("sm-game-area")
      : soloSpeedActive
        ? document.getElementById("speed-solo-game-area")
        : null);
  if (target) { target.appendChild(overlay); overlay.classList.add("is-contained"); }
  activeTreasureCallback = callback;
  overlay.style.display = "flex";
  const chests = overlay.querySelectorAll(".treasure-chest");
  
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
          if (multiItemType <= 2) {
            restoreTreasureOverlay();
            activeTreasureCallback = null;
          }
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
  activeTreasureCallback = null;
  restoreTreasureOverlay();
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

// =====================================================
// [07] 개인 게임 모드
// -----------------------------------------------------
// - 플래시카드
// - 메모리 게임
// - 스피드 짝맞추기
// - 스피드 퀴즈
// - 이모지 낚시
// - 문장 해석 청크 게임
// =====================================================
let fcQueue = []; let fcCurrent = null; let fcKnown = 0; let fcIsFlipped = false; let fcIsAnimating = false; let isRetryPhase = false; let hasFlippedToCheck = false;

function getFlashcardProgressKey() {
  return `flashcard_progress_${currentUser.stdId}_${currentSetId}`;
}

function saveFlashcardProgress() {
  if (!currentUser.stdId || !currentSetId || !fcQueue.length) return;
  try {
    localStorage.setItem(getFlashcardProgressKey(), JSON.stringify({
      queue: fcQueue,
      unknownWords: unknownWordsHistory,
      known: fcKnown,
      retryPhase: isRetryPhase
    }));
  } catch (error) { console.warn("깜빡이 진행 상태 저장 실패", error); }
}

function loadFlashcardProgress() {
  try {
    const saved = JSON.parse(localStorage.getItem(getFlashcardProgressKey()) || "null");
    if (!saved || !Array.isArray(saved.queue) || !saved.queue.length) return false;
    fcQueue = saved.queue;
    unknownWordsHistory = Array.isArray(saved.unknownWords) ? saved.unknownWords : [];
    fcKnown = Number(saved.known || 0);
    isRetryPhase = Boolean(saved.retryPhase);
    return true;
  } catch (error) {
    console.warn("깜빡이 진행 상태 불러오기 실패", error);
    return false;
  }
}

function clearFlashcardProgress() {
  try { localStorage.removeItem(getFlashcardProgressKey()); } catch (error) {}
}

function startFlashcard(forceRestart = false) {
  if (!wordList || wordList.length === 0) { alert("단어장이 비어 있습니다!"); return; }
  const resumed = !forceRestart && loadFlashcardProgress();
  if (!resumed) {
    fcQueue = [...wordList];
    fcKnown = 0; unknownWordsHistory = []; isRetryPhase = false;
  }
  currentUser.caughtEmojis = "";
  const unknownList = document.getElementById("fc-unknown-list");
  const unknownListButton = document.getElementById("fc-unknown-list-btn");
  if (unknownList) unknownList.hidden = true;
  if (unknownListButton) unknownListButton.innerText = "몰라요 한 단어 리스트 보기";
  renderFlashcardUnknownList();
  
  document.getElementById("flashcard-screen").hidden = false;
  nextFlashcard("fly-right-in");
}

function autoFontSize(text) {
  return autoFontSizeCore(text);
}

// (여기는 기존 깜빡이 학습과 실시간 낚시 엔진 로직이 수정 없이 그대로 안정되게 유지됩니다...)
function updateFcUI() {
  let total = isRetryPhase ? unknownWordsHistory.length : wordList.length; let currentIdx = total - fcQueue.length + 1; if (currentIdx > total) currentIdx = total;
  let progEl = document.getElementById("fc-progress"); if(progEl) progEl.innerText = isRetryPhase ? `복습 모드: ${currentIdx} / ${total}` : `단어: ${currentIdx} / ${total}`;
  let statsEl = document.getElementById("fc-stats"); if(statsEl) statsEl.innerText = `알아요 ${fcKnown}개 · 다시 볼 카드 ${unknownWordsHistory.length}개`;
  document.querySelectorAll(".retry-badge").forEach((el) => (el.style.display = isRetryPhase ? "block" : "none"));
  renderFlashcardUnknownList();
}

function renderFlashcardUnknownList() {
  const list = document.getElementById("fc-unknown-list");
  if (!list) return;
  list.innerHTML = "";
  if (!unknownWordsHistory.length) { list.innerHTML = "<p>아직 몰라요로 표시한 단어가 없습니다.</p>"; return; }
  unknownWordsHistory.forEach(word => {
    const row = document.createElement("div");
    row.innerHTML = `<strong></strong><span></span>`;
    row.querySelector("strong").textContent = word.en;
    row.querySelector("span").textContent = word.ko;
    list.appendChild(row);
  });
}

function nextFlashcard(animClass) {
  if (fcQueue.length === 0) {
    if (!isRetryPhase && unknownWordsHistory.length > 0) {
      alert("이제 몰라요를 눌렀던 카드를 다시 복습합니다.");
      isRetryPhase = true; fcQueue = fcIsRandom ? [...unknownWordsHistory].sort(() => 0.5 - Math.random()) : [...unknownWordsHistory];
      nextFlashcard("pop-in"); return;
    } else { 
      document.getElementById("flashcard-screen").hidden = true;
      clearFlashcardProgress();
      currentGameMode = "";
      alert("깜빡이 학습을 마쳤습니다.");
      return;
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
  
  fcIsAnimating = true;
  saveFlashcardProgress();
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
  let cEl = document.getElementById("fc-card"); if(cEl) cEl.className = "flash-card fly-left";
  setTimeout(() => { fcQueue.shift(); fcKnown++; saveFlashcardProgress(); nextFlashcard("fly-right-in"); }, 400);
});

bindClick("btn-dont-know", () => {
  if (!hasFlippedToCheck || fcIsAnimating) return; 
  fcIsAnimating = true; playSound("wrong");
  if (!isRetryPhase) {
    const alreadySaved = unknownWordsHistory.find((w) => w.en === fcCurrent.en && w.ko === fcCurrent.ko);
    if (!alreadySaved) {
      unknownWordsHistory.push(fcCurrent);
      const wordIndex = wordList.findIndex(word => word.en === fcCurrent.en && word.ko === fcCurrent.ko);
      if (wordIndex >= 0) {
        const storageKey = `stars_${currentUser.stdId}_${currentSetId}`;
        try {
          const saved = JSON.parse(localStorage.getItem(storageKey) || "{}");
          const wordId = `word_${wordIndex}`;
          saved[wordId] = Number(saved[wordId] || 0) + 1;
          localStorage.setItem(storageKey, JSON.stringify(saved));
          starData = saved;
        } catch (error) { console.warn("몰라요 단어 별표 연동 실패", error); }
      }
      renderFlashcardUnknownList();
    }
  }
  
  let cardEl = document.getElementById("fc-card");
  let btnEl = document.getElementById("btn-dont-know");
  if(cardEl && btnEl) {
    const cardRect = cardEl.getBoundingClientRect(); const btnRect = btnEl.getBoundingClientRect();
    const moveX = btnRect.left + btnRect.width / 2 - (cardRect.left + cardRect.width / 2); const moveY = btnRect.top + btnRect.height / 2 - (cardRect.top + cardRect.height / 2);
    cardEl.style.transition = "all 0.4s cubic-bezier(0.6, -0.28, 0.735, 0.045)"; cardEl.style.transform = `translate(${moveX}px, ${moveY}px) scale(0) rotate(180deg)`; cardEl.style.opacity = "0";
    setTimeout(() => { cardEl.style.transition = "transform 0.4s cubic-bezier(0.4, 0.0, 0.2, 1)"; cardEl.style.transform = ""; cardEl.style.opacity = "1"; fcQueue.push(fcQueue.shift()); saveFlashcardProgress(); nextFlashcard("pop-in"); }, 400);
  } else {
    fcQueue.push(fcQueue.shift()); saveFlashcardProgress(); nextFlashcard("pop-in");
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
  const unlimited = soloSpeedMatchActive && soloSpeedMatchOptions.time === "unlimited";
  const m = String(Math.floor(gameTimeRemaining / 60)).padStart(2, "0"); const s = String(gameTimeRemaining % 60).padStart(2, "0");
  document.getElementById("sm-timer").innerText = unlimited ? "시간 제한 없음" : `🕒 ${m}:${s}`;
  // 🚀 픽스: 멀티플레이어 조별 점수 합산 텍스트 반영
  document.getElementById("sm-score").style.display = soloSpeedMatchActive && soloSpeedMatchOptions.score === "off" ? "none" : "";
  document.getElementById("sm-score").innerHTML = `점수: ${gameScore}${getGroupScoreText()}`;
  // 🚀 쿨타임 동기화 엔진 연결
  if (currentGameMode === "speed-match") window.syncScoreToServer();
}
function startSpeedMatchLogic() {
  smRound = 1; updateSpeedMatchUI();
  const unlimited = soloSpeedMatchActive && soloSpeedMatchOptions.time === "unlimited";
  if (!unlimited) gameTimerInterval = setInterval(() => {
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
  }, 1000);
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
    playSound("success"); let earnedScore = calcSpeedBonus();
    if (!(soloSpeedMatchActive && soloSpeedMatchOptions.score === "off")) gameScore += earnedScore;
    updateSpeedMatchUI();
    if (soloSpeedMatchActive && soloSpeedMatchOptions.score === "off") showGamePraise(0, "정답!", "#4caf50"); else showGamePraise(earnedScore);
    c1.el.classList.add("matched"); c2.el.classList.add("matched"); smPairsFound++; smSelected = []; updateSmSideAvailability();
    const allowTreasure = !soloSpeedMatchActive || soloSpeedMatchOptions.treasure === "on";
    if (allowTreasure && Math.random() < 0.3) triggerTreasureEvent(() => { checkSmRoundEnd(); isGamePaused = false; }); else { checkSmRoundEnd(); isGamePaused = false; }
  } else { 
    playSound("wrong"); let penalty = calcSpeedBonus();
    if (!(soloSpeedMatchActive && soloSpeedMatchOptions.score === "off")) gameScore -= penalty;
    updateSpeedMatchUI();
    if (soloSpeedMatchActive && soloSpeedMatchOptions.score === "off") showBuffMsg("오답!", "다시 짝을 찾아보세요.", 244, 67, 54); else showBuffMsg("오답!", `-${penalty}점 ㅠㅠ`, 244, 67, 54);
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
    if (syncScoreTimeout) return; 
    syncScoreTimeout = setTimeout(() => {
        setDoc(doc(db, "lobbyUsers", myLobbyDocId), { 
            score: gameScore, 
            items: currentBuffs,
            problemStats: window.myProblemStats || {} // 🚀 [오답률 패치] 내 오답 장부를 서버로 전송!
        }, { merge: true }).catch(e => e);
        lastSyncedScore = gameScore; lastSyncedItems = currentBuffs;
        syncScoreTimeout = null;
    }, 2000);
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
  }, 1000); 
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


// =====================================================
// [08] 결과 화면 / 점수 저장 / 랭킹
// -----------------------------------------------------
// - 개인/멀티 게임 종료 처리
// - 점수 저장
// - JR 보상
// - 오늘/우리반/전체 랭킹 표시
// - 조별 점수 보너스 처리
// =====================================================



async function goResult() {
  const useSoloSpeedMatchResult = soloSpeedMatchActive && currentGameMode === "speed-match" && !myLobbyDocId;
  const useSoloChunkResult = soloChunkActive && currentGameMode === "chunk" && !myLobbyDocId;
  const useSoloSpeedResult = soloSpeedActive && currentGameMode === "speed" && !myLobbyDocId;
  if (useSoloSpeedMatchResult) {
    if (soloSpeedMatchFinishing) return;
    soloSpeedMatchFinishing = true;
    setSoloSpeedMatchStage("result");
    document.getElementById("sm-solo-start-btn").disabled = true;
  }
  if (useSoloChunkResult) {
    if (soloChunkFinishing) return;
    soloChunkFinishing = true;
    setSoloChunkStage("result");
    document.getElementById("chunk-solo-start-btn").disabled = true;
  }
  if (useSoloSpeedResult) {
    if (soloSpeedFinishing) return;
    soloSpeedFinishing = true;
    setSoloSpeedStage("result");
    document.getElementById("speed-solo-start-btn").disabled = true;
  }
  if (useSoloSpeedMatchResult || useSoloChunkResult || useSoloSpeedResult) currentUser.score = gameScore;
  // 멀티 결과 화면을 벗어났다가 같은 게임 방에 재입장해도 결과를 복원할 수 있도록
  // 완료한 라운드를 게임 상태 초기화보다 먼저 기억한다.
  if (myLobbyDocId && !isTeacherMode) {
    lastCompletedMultiRoundId = String(window.lastSeenMultiRoundId || globalMultiEndTime || "") || null;
    pendingCompletedResultRestore = false;
  }
  
  // 🚀 픽스: 게임 종료 시 열려있을 수 있는 '모든 방해 레이어(블라인드, 공격창 등)'를 강제로 즉시 소각! (먹통 100% 방지)
  ["group-blocker-overlay", "sq-penalty-overlay", "buff-msg-overlay", "multi-target-modal", "multi-blind-overlay"].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.style.display = "none";
  });
  closeTreasureOverlay(false);
  
  clearInterval(gameTimerInterval); clearInterval(cdInterval); clearTimeout(chunkTimeout); isGamePaused = true;
  document.getElementById("top-left-controls").style.display = "none"; 

  const shouldSaveScore = !((useSoloSpeedMatchResult && soloSpeedMatchOptions.score === "off") || (useSoloChunkResult && soloChunkOptions.score === "off") || (useSoloSpeedResult && soloSpeedOptions.score === "off"));
  if (shouldSaveScore) {
    try {
      await addDoc(collection(db, "scores"), {
        stdId: currentUser.stdId, nickname: currentUser.nickname, emoji: currentUser.emoji, classId: currentUser.classId,
        score: currentUser.score, mode: currentGameMode, timestamp: Date.now(), setId: currentSetId, setTitle: currentSetTitle,
        playContext: myLobbyDocId ? "multi" : "solo",
        groupId: currentGroupingActive ? myCurrentGroupId : null, groupPlayMode: currentGroupingActive ? currentMultiRoomGroupPlayMode : null
      });
    } catch(e) { console.error("점수 저장 실패:", e); }
  }

let earnedJR = Math.max(0, Math.floor(currentUser.score / 100));
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

  const todayStr = new Date().toLocaleDateString("ko-KR", { timeZone: "Asia/Seoul" });
  if (currentUser.todayJrDate !== todayStr) {
    currentUser.todayJrDate = todayStr;
    currentUser.todayJr = 0;
  }
  currentUser.jr += (earnedJR + rankBonusJR);
  currentUser.todayJr += (earnedJR + rankBonusJR);
  if (currentUser.stdId) await setDoc(doc(db, "users", currentUser.stdId), {
    jr: currentUser.jr,
    todayJr: currentUser.todayJr,
    todayJrDate: currentUser.todayJrDate
  }, { merge: true });

  if (useSoloSpeedMatchResult) {
    const result = document.getElementById("sm-solo-result");
    document.getElementById("sm-game-area").classList.remove("is-preview");
    document.getElementById("sm-preview-message").hidden = true;
    const scoreEnabled = soloSpeedMatchOptions.score === "on";
    document.getElementById("sm-solo-final-score").innerText = scoreEnabled ? `${finalDisplayScore}점` : "점수를 비활성화했습니다";
    document.getElementById("sm-solo-final-round").innerText = Math.max(0, smRound - 1);
    document.getElementById("sm-solo-final-reward").innerText = `${earnedJR} JR`;
    document.getElementById("sm-solo-final-balance").innerText = `${currentUser.jr} JR`;
    document.getElementById("sm-solo-ranking-btn").hidden = !scoreEnabled;
    document.getElementById("sm-solo-result-message").innerText = document.getElementById("result-detail").innerText || "수고했어요! 이번 기록을 확인해 보세요.";
    result.hidden = false;
    document.querySelectorAll("#sm-solo-settings [data-sm-option]").forEach(button => { button.disabled = false; });
    document.querySelectorAll("#sm-solo-settings [data-sm-option]").forEach(button => { button.disabled = false; });
    soloSpeedMatchFinishing = false;
    setSoloSpeedMatchStage("result");
    playSound("success");
    return;
  }

  if (useSoloChunkResult) {
    const scoreEnabled = soloChunkOptions.score === "on";
    document.getElementById("chunk-game-area").classList.remove("is-preview");
    document.getElementById("chunk-preview-message").hidden = true;
    document.getElementById("chunk-solo-final-score").innerText = scoreEnabled ? `${finalDisplayScore}점` : "점수를 비활성화했습니다";
    document.getElementById("chunk-solo-final-count").innerText = soloChunkCompletedCount;
    document.getElementById("chunk-solo-final-reward").innerText = `${earnedJR} JR`;
    document.getElementById("chunk-solo-final-balance").innerText = `${currentUser.jr} JR`;
    document.getElementById("chunk-solo-ranking-btn").hidden = !scoreEnabled;
    document.getElementById("chunk-solo-result-message").innerText = document.getElementById("result-detail").innerText || "수고했어요! 이번 기록을 확인해 보세요.";
    document.getElementById("chunk-solo-result").hidden = false;
    document.querySelectorAll("#chunk-solo-settings [data-chunk-option]").forEach(button => { button.disabled = false; });
    document.querySelectorAll("#chunk-solo-settings [data-chunk-option]").forEach(button => { button.disabled = false; });
    soloChunkFinishing = false;
    setSoloChunkStage("result");
    playSound("success");
    return;
  }

  if (useSoloSpeedResult) {
    const scoreEnabled = soloSpeedOptions.score === "on";
    document.getElementById("speed-solo-game-area").classList.remove("is-preview");
    document.getElementById("speed-solo-preview-message").hidden = true;
    document.getElementById("speed-solo-final-score").innerText = scoreEnabled ? `${finalDisplayScore}점` : "점수를 비활성화했습니다";
    document.getElementById("speed-solo-final-count").innerText = soloSpeedCompletedCount;
    document.getElementById("speed-solo-final-reward").innerText = `${earnedJR} JR`;
    document.getElementById("speed-solo-final-balance").innerText = `${currentUser.jr} JR`;
    document.getElementById("speed-solo-ranking-btn").hidden = !scoreEnabled;
    document.getElementById("speed-solo-result-message").innerText = document.getElementById("result-detail").innerText || "수고했어요! 이번 기록을 확인해 보세요.";
    document.getElementById("speed-solo-result").hidden = false;
    document.querySelectorAll("#speed-solo-settings [data-speed-option]").forEach(button => { button.disabled = false; });
    soloSpeedFinishing = false;
    setSoloSpeedStage("result");
    playSound("success");
    return;
  }

  showScreen("result-screen");
  document.getElementById("praise-word").innerText = praises[Math.floor(Math.random() * praises.length)];
  document.getElementById("result-user").innerText = finalDisplayName;
  document.getElementById("final-score").innerText = finalDisplayScore;
  document.getElementById("result-caught-emojis").style.display = "none";
  playSound("success");

  setTimeout(() => { showBuffMsg("💰 보상 획득!", `게임 보상: +${earnedJR} JR${rankMsg}\n(현재 잔액: ${currentUser.jr} JR)`, 33, 150, 243); }, 800);
}

// 🚀 [피드백 경로 추적기] 어디서 버튼을 눌렀는지 기억합니다!
window.feedbackReturnScreen = "result-screen"; // 기본값

// 결과창에서 누른 경우
bindClick("go-feedback-btn", () => { 
    playSound("click"); 
    window.feedbackReturnScreen = "result-screen"; 
    document.getElementById("feedback-text").value = ""; 
    showScreen("feedback-screen"); 
});

// 🚀 대기실에서 누른 경우
bindClick("lobby-go-feedback-btn", () => { 
    playSound("click"); 
    window.feedbackReturnScreen = "multi-lobby-screen"; 
    document.getElementById("feedback-text").value = ""; 
    showScreen("feedback-screen"); 
});

bindClick("cancel-feedback-btn", () => { 
    playSound("click"); 
    showScreen(window.feedbackReturnScreen); // 🚀 원래 있던 화면으로 복귀!
});

let soloRankingPeriod = "today";
let soloRankingScope = "class";
let soloRankingRequestId = 0;

function getSeoulTodayStart() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit"
  }).formatToParts(new Date()).reduce((acc, part) => {
    if (part.type !== "literal") acc[part.type] = Number(part.value);
    return acc;
  }, {});
  return Date.UTC(parts.year, parts.month - 1, parts.day) - (9 * 60 * 60 * 1000);
}

function openSoloRankingModal() {
  const overlay = document.getElementById("solo-ranking-overlay");
  const select = document.getElementById("solo-ranking-set-select");
  if (!overlay || !select) return;

  const normalSets = wordSets.filter(set => !set.isCustomSet && !set.hidden);
  select.innerHTML = "";
  normalSets.forEach(set => {
    const option = document.createElement("option");
    option.value = String(set.id);
    option.textContent = set.title;
    select.appendChild(option);
  });
  if (currentSetId && normalSets.some(set => String(set.id) === String(currentSetId))) select.value = String(currentSetId);

  overlay.style.display = "flex";
  loadSoloRankings();
}

function closeSoloRankingModal() {
  const overlay = document.getElementById("solo-ranking-overlay");
  if (overlay) overlay.style.display = "none";
  soloRankingRequestId++;
}

async function loadSoloRankings() {
  const select = document.getElementById("solo-ranking-set-select");
  const gameSelect = document.getElementById("solo-ranking-game-select");
  const list = document.getElementById("solo-ranking-list");
  const summary = document.getElementById("solo-ranking-summary-title");
  if (!select || !gameSelect || !list || !select.value || !gameSelect.value) return;

  const requestId = ++soloRankingRequestId;
  const selectedTitle = select.options[select.selectedIndex]?.text || "선택한 세트";
  const selectedGameTitle = gameSelect.options[gameSelect.selectedIndex]?.text || "선택한 게임";
  const periodText = soloRankingPeriod === "today" ? "오늘" : "역대";
  const scopeText = soloRankingScope === "class" ? "우리반" : "학년 전체";
  summary.textContent = `${selectedTitle} · ${selectedGameTitle} · ${periodText} · ${scopeText}`;
  list.innerHTML = '<div class="solo-ranking-empty">순위를 불러오는 중입니다.</div>';

  try {
    const scoreQuery = query(collection(db, "scores"), orderBy("timestamp", "desc"), limit(2000));
    const snapshot = await getDocs(scoreQuery);
    if (requestId !== soloRankingRequestId) return;

    let scores = [];
    snapshot.forEach(scoreDoc => scores.push(scoreDoc.data()));
    scores = scores.filter(score =>
      String(score.setId) === String(select.value) &&
      score.mode === gameSelect.value &&
      score.playContext === "solo" &&
      score.stdId
    );

    if (soloRankingPeriod === "today") {
      const todayStart = getSeoulTodayStart();
      scores = scores.filter(score => Number(score.timestamp || 0) >= todayStart);
    }
    if (soloRankingScope === "class") {
      scores = scores.filter(score => String(score.classId || "") === String(currentUser.classId || ""));
    } else {
      const myGrade = String(currentUser.stdId || "").slice(0, 1);
      scores = scores.filter(score => String(score.stdId || "").startsWith(myGrade));
    }

    const players = new Map();
    scores.forEach(score => {
      if (!players.has(score.stdId)) players.set(score.stdId, {
        stdId: score.stdId,
        nickname: score.nickname || score.stdId,
        classId: score.classId || "",
        latestAt: 0,
        bestScore: 0
      });
      const player = players.get(score.stdId);
      player.bestScore = Math.max(player.bestScore, Number(score.score || 0));
      if (Number(score.timestamp || 0) > player.latestAt) {
        player.latestAt = Number(score.timestamp || 0);
        player.nickname = score.nickname || player.nickname;
      }
    });

    const ranked = Array.from(players.values())
      .sort((a, b) => b.bestScore - a.bestScore || a.stdId.localeCompare(b.stdId));

    list.innerHTML = "";
    if (ranked.length === 0) {
      list.innerHTML = '<div class="solo-ranking-empty">조건에 맞는 기록이 아직 없습니다.</div>';
      return;
    }
    ranked.forEach((player, index) => {
      const row = document.createElement("div");
      row.className = "solo-ranking-row";
      const position = document.createElement("div");
      position.className = "solo-ranking-position";
      position.textContent = `${index + 1}위`;
      const info = document.createElement("div");
      info.className = "solo-ranking-player";
      const name = document.createElement("strong");
      name.textContent = player.nickname;
      const detail = document.createElement("span");
      detail.textContent = `${player.stdId} · 개인 연습 최고 기록`;
      info.append(name, detail);
      const score = document.createElement("div");
      score.className = "solo-ranking-score";
      score.textContent = `${player.bestScore.toLocaleString()}점`;
      row.append(position, info, score);
      list.appendChild(row);
    });
  } catch (error) {
    console.error("통합 순위 불러오기 실패", error);
    list.innerHTML = '<div class="solo-ranking-empty">순위 데이터를 불러오지 못했습니다.</div>';
  }
}

bindClick("learning-ranking-preview-btn", () => { playSound("click"); openSoloRankingModal(); });
bindClick("sm-solo-ranking-btn", () => {
  playSound("click");
  soloRankingPeriod = "today";
  soloRankingScope = "class";
  document.getElementById("solo-ranking-game-select").value = "speed-match";
  document.querySelectorAll('.solo-ranking-filter[data-filter="period"]').forEach(button => button.classList.toggle("is-active", button.dataset.value === "today"));
  document.querySelectorAll('.solo-ranking-filter[data-filter="scope"]').forEach(button => button.classList.toggle("is-active", button.dataset.value === "class"));
  openSoloRankingModal();
});
bindClick("chunk-solo-ranking-btn", () => {
  playSound("click");
  soloRankingPeriod = "today"; soloRankingScope = "class";
  document.getElementById("solo-ranking-game-select").value = "chunk";
  document.querySelectorAll('.solo-ranking-filter[data-filter="period"]').forEach(button => button.classList.toggle("is-active", button.dataset.value === "today"));
  document.querySelectorAll('.solo-ranking-filter[data-filter="scope"]').forEach(button => button.classList.toggle("is-active", button.dataset.value === "class"));
  openSoloRankingModal();
});
bindClick("speed-solo-ranking-btn", () => {
  playSound("click"); soloRankingPeriod = "today"; soloRankingScope = "class";
  document.getElementById("solo-ranking-game-select").value = "speed";
  document.querySelectorAll('.solo-ranking-filter[data-filter="period"]').forEach(button => button.classList.toggle("is-active", button.dataset.value === "today"));
  document.querySelectorAll('.solo-ranking-filter[data-filter="scope"]').forEach(button => button.classList.toggle("is-active", button.dataset.value === "class"));
  openSoloRankingModal();
});
bindClick("solo-ranking-close-btn", () => { playSound("click"); closeSoloRankingModal(); });
document.getElementById("solo-ranking-set-select")?.addEventListener("change", loadSoloRankings);
document.getElementById("solo-ranking-game-select")?.addEventListener("change", loadSoloRankings);
document.querySelectorAll(".solo-ranking-filter").forEach(button => {
  button.addEventListener("click", () => {
    const filter = button.dataset.filter;
    document.querySelectorAll(`.solo-ranking-filter[data-filter="${filter}"]`).forEach(item => item.classList.remove("is-active"));
    button.classList.add("is-active");
    if (filter === "period") soloRankingPeriod = button.dataset.value;
    if (filter === "scope") soloRankingScope = button.dataset.value;
    loadSoloRankings();
  });
});

bindClick("submit-feedback-btn", async () => {
  playSound("click");
  const text = document.getElementById("feedback-text").value.trim();
  if(!text) return alert("의견을 적어주세요!");
  try {
    await addDoc(collection(db, "feedback"), {
      stdId: currentUser.stdId, nickname: currentUser.nickname, emoji: currentUser.emoji, text: text, timestamp: Date.now()
    });
    alert("소중한 의견 감사합니다!"); 
    showScreen(window.feedbackReturnScreen); // 🚀 제출 후 원래 화면으로 복귀!
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
  const unlimited = soloChunkActive && soloChunkOptions.time === "unlimited";
  const m = String(Math.floor(gameTimeRemaining / 60)).padStart(2, "0"); const s = String(gameTimeRemaining % 60).padStart(2, "0");
  document.getElementById("chunk-timer").innerText = unlimited ? "시간 제한 없음" : `🕒 ${m}:${s}`;
  document.getElementById("chunk-score").style.display = soloChunkActive && soloChunkOptions.score === "off" ? "none" : "";
  
  // 🌟 보스전일 때는 데미지로, 일반 게임일 때는 점수로 글자가 바뀝니다!
  if (typeof isBossRaid !== "undefined" && isBossRaid) {
      document.getElementById("chunk-score").innerHTML = `내 총 데미지: ${gameScore}`; 
  } else {
      document.getElementById("chunk-score").innerHTML = `점수: ${gameScore}${getGroupScoreText()}`; 
  }
  
  if (currentGameMode === "chunk" || currentGameMode === "boss") window.syncScoreToServer();
}

function startChunkLogic() {
  const validChunkWords = soloChunkActive
    ? soloChunkSentences
    : wordList.map(word => ({ word, parsed: parseChunkGameSentence(word) })).filter(item => item.parsed);
  if(validChunkWords.length === 0) { alert("현재 세트에는 슬래시(/)로 구분된 문장이 없습니다. 다른 세트를 선택해 주세요."); clearInterval(gameTimerInterval); showScreen("menu-screen"); return; }
  currentChunkIndex = 0; soloChunkCompletedCount = 0; updateChunkUI();
  const unlimited = soloChunkActive && soloChunkOptions.time === "unlimited";
  if (!unlimited) gameTimerInterval = setInterval(() => {
    if (globalMultiEndTime) {
       gameTimeRemaining = Math.max(0, Math.floor((globalMultiEndTime - Date.now()) / 1000)); updateChunkUI();
       if (gameTimeRemaining <= 0) { clearInterval(gameTimerInterval); currentUser.score = gameScore; document.getElementById("result-detail").innerText = `제한 시간 종료! 획득한 해석 점수입니다!`; goResult(); }
    } else {
       if (!isGamePaused) {
         gameTimeRemaining--; updateChunkUI();
         if (gameTimeRemaining <= 0) { clearInterval(gameTimerInterval); currentUser.score = gameScore; document.getElementById("result-detail").innerText = `제한 시간 종료! 획득한 해석 점수입니다!`; goResult(); }
       }
    }
  }, 1000); 
  loadNextChunkQuiz(validChunkWords);
}
function loadNextChunkQuiz(validChunkWords) {
  const sentence = validChunkWords[currentChunkIndex];
  const parsed = sentence.parsed || parseChunkGameSentence(sentence.word || sentence);
  const enParts = parsed.enParts;
  chunkLength = enParts.length;
  const container = document.getElementById("chunk-container"); const btnContainer = document.getElementById("chunk-buttons-container");
  container.innerHTML = ""; btnContainer.innerHTML = ""; chunkAnswers = []; soloChunkPieces = enParts; soloChunkSelected = [];
  document.getElementById("chunk-game-progress").innerText = `문장 ${currentChunkIndex + 1} / ${validChunkWords.length}`;
  document.getElementById("chunk-game-meaning").innerText = parsed.koText;
  document.getElementById("chunk-game-feedback").innerText = "아래 조각을 순서대로 선택하세요.";
  container.className = "chunk-game-answer is-empty";

  soloChunkShuffledIndices = Array.from({ length: chunkLength }, (_, index) => index);
  for (let index = soloChunkShuffledIndices.length - 1; index > 0; index--) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    [soloChunkShuffledIndices[index], soloChunkShuffledIndices[randomIndex]] = [soloChunkShuffledIndices[randomIndex], soloChunkShuffledIndices[index]];
  }
  if (soloChunkShuffledIndices.every((value, index) => value === index)) [soloChunkShuffledIndices[0], soloChunkShuffledIndices[1]] = [soloChunkShuffledIndices[1], soloChunkShuffledIndices[0]];

  const renderSelection = () => {
    container.innerHTML = ""; btnContainer.innerHTML = "";
    soloChunkSelected.forEach((pieceIndex, answerIndex) => {
      const selected = document.createElement("button"); selected.type = "button"; selected.className = "chunk-game-piece selected"; selected.innerText = soloChunkPieces[pieceIndex];
      selected.onclick = () => { if (isGamePaused) return; playSound("pop"); soloChunkSelected.splice(answerIndex, 1); renderSelection(); };
      container.appendChild(selected);
    });
    soloChunkShuffledIndices.forEach(pieceIndex => {
      const btn = document.createElement("button"); btn.type = "button"; btn.className = "chunk-game-piece"; btn.innerText = soloChunkPieces[pieceIndex];
      btn.disabled = soloChunkSelected.includes(pieceIndex);
      btn.onclick = () => {
        if (isGamePaused || btn.disabled) return;
        playSound("pop"); soloChunkSelected.push(pieceIndex); renderSelection();
        if (soloChunkSelected.length === chunkLength) checkChunkAnswer(validChunkWords);
      };
      btnContainer.appendChild(btn);
    });
    container.classList.toggle("is-empty", soloChunkSelected.length === 0);
  };
  renderSelection();
}
function checkChunkAnswer(validChunkWords) {
  isGamePaused = true; const isCorrect = soloChunkSelected.every((value, index) => value === index);
  const answer = document.getElementById("chunk-container");
  const feedback = document.getElementById("chunk-game-feedback");
  if (isCorrect) {
    playSound("success"); const earned = calcSpeedBonus() * 2;
    if (!(soloChunkActive && soloChunkOptions.score === "off")) gameScore += earned;
    soloChunkCompletedCount++; updateChunkUI();
    showGamePraise(earned, "정답입니다!", "#3F51B5"); feedback.innerText = "정답입니다!"; answer.classList.add("is-correct");
    currentChunkIndex++; if (currentChunkIndex >= validChunkWords.length) { currentChunkIndex = 0; }
    const allowTreasure = !soloChunkActive || soloChunkOptions.treasure === "on";
    if (allowTreasure && Math.random() < 0.3) { triggerTreasureEvent(() => { answer.classList.remove("is-correct"); isGamePaused = false; loadNextChunkQuiz(validChunkWords); }); }
    else { 
        clearTimeout(chunkTimeout);
        chunkTimeout = setTimeout(() => { answer.classList.remove("is-correct"); isGamePaused = false; loadNextChunkQuiz(validChunkWords); }, 700);
    }
  } else {
    playSound("wrong"); const penalty = Math.floor(calcSpeedBonus());
    if (!(soloChunkActive && soloChunkOptions.score === "off")) gameScore -= penalty;
    updateChunkUI(); feedback.innerText = "순서가 맞지 않습니다. 다시 조립해 보세요."; answer.classList.add("is-wrong");
    showBuffMsg("오답!", soloChunkActive && soloChunkOptions.score === "off" ? "순서가 맞지 않아요" : `순서가 맞지 않아요\n-${penalty}점`, 244, 67, 54);
    clearTimeout(chunkTimeout);
    chunkTimeout = setTimeout(() => {
      answer.classList.remove("is-wrong"); isGamePaused = false; loadNextChunkQuiz(validChunkWords);
    }, 600);
  }
}

// ==========================================
// 씬 7: 온라인 멀티플레이어 로비 로직
// ==========================================
bindClick("mode-solo-btn", () => {
  playSound("click");
  currentSetId = null;
  currentSetTitle = "";
  wordList = [];
  const panel = document.getElementById("learning-method-panel");
  const title = document.getElementById("selected-set-title");
  if (panel) panel.classList.add("is-disabled");
  if (title) title.innerText = "-";
  renderSetSelectList();
  showScreen("menu-screen");
});
bindClick("mode-multi-student-btn", () => { playSound("click"); enterMultiLobbyAsStudent(); });
bindClick("student-lobby-logo-home-btn", () => { playSound("click"); exitLobby().then(() => showScreen("lobby-mode-screen")); });
bindClick("student-lobby-mode-crumb", () => { playSound("click"); exitLobby().then(() => showScreen("lobby-mode-screen")); });
bindClick("student-lobby-login-crumb", () => {
  playSound("click");
  exitLobby().then(() => showScreen("auth-screen"));
});
bindClick("student-lobby-character-crumb", () => {
  playSound("click");
  exitLobby().then(() => {
    refreshMainCharacterDisplay();
    showScreen("login-screen");
  });
});
bindClick("mode-change-character-btn", () => { playSound("click"); openCharacterShopModal(); });
bindClick("mode-character-crumb", () => { playSound("click"); showScreen("login-screen"); });
bindClick("mode-logo-home-btn", confirmReturnToAuthScreen);
bindClick("mode-login-crumb", confirmReturnToAuthScreen);
bindClick("learning-logo-home-btn", confirmReturnToAuthScreen);
bindClick("learning-login-crumb", confirmReturnToAuthScreen);
bindClick("learning-character-crumb", () => { playSound("click"); showScreen("login-screen"); });
bindClick("learning-mode-crumb", () => { playSound("click"); showScreen("lobby-mode-screen"); });



// =====================================================
// [08.5] 멀티 제어 채널 안정화
// =====================================================

function createMultiRoundId(mode = "game") {
  return `${mode}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function getRoomRoundId(room = {}) {
  return String(
    room.roundId ||
    room.highfiveRoundId ||
    room.endTime ||
    `${room.gameMode || "unknown"}_${room.controlUpdatedAt || 0}`
  );
}

function restoreCompletedMultiResult(room = {}) {
  if (!pendingCompletedResultRestore) return false;
  if (!lastCompletedMultiRoundId || room.status !== "playing") return false;
  if (getRoomRoundId(room) !== lastCompletedMultiRoundId) return false;

  // 이미 끝낸 같은 라운드에는 다시 카운트다운/게임 초기화를 실행하지 않는다.
  pendingCompletedResultRestore = false;
  window.lastSeenMultiRoundId = lastCompletedMultiRoundId;
  window.isMultiGameActive = true;
  globalMultiEndTime = room.endTime || globalMultiEndTime;
  if (typeof window.toggleStudentLobbyListeners === "function") {
    window.toggleStudentLobbyListeners(false);
  }
  showScreen("result-screen");
  return true;
}

function isCompletedMultiRound(room = {}) {
  return Boolean(
    lastCompletedMultiRoundId &&
    getRoomRoundId(room) === lastCompletedMultiRoundId
  );
}

function closeMultiJoinWaitOverlay() {
  multiJoinWaitGeneration++;
  if (multiJoinWaitInterval) {
    clearInterval(multiJoinWaitInterval);
    multiJoinWaitInterval = null;
  }
  const overlay = document.getElementById("multi-join-wait-overlay");
  if (overlay) overlay.style.display = "none";
}

function waitForCurrentMultiGameToFinish() {
  let overlay = document.getElementById("multi-join-wait-overlay");
  if (!overlay) {
    overlay = document.createElement("div");
    overlay.id = "multi-join-wait-overlay";
    overlay.style.cssText = "position:fixed;inset:0;z-index:10000;background:rgba(0,0,0,.72);display:flex;align-items:center;justify-content:center;padding:20px;box-sizing:border-box;";
    overlay.innerHTML = `
      <div style="width:min(420px,100%);background:white;border-radius:20px;padding:28px;text-align:center;box-shadow:0 10px 35px rgba(0,0,0,.35);">
        <h2 style="color:#2196F3;margin:0 0 14px;">🎮 게임이 진행 중입니다</h2>
        <p style="line-height:1.6;color:#555;">게임이 끝나면 자동으로 멀티 대기실에 접속됩니다.</p>
        <button id="multi-join-wait-cancel-btn" style="background:#9e9e9e;box-shadow:0 5px 0 #616161;margin-top:12px;">접속 대기 취소</button>
      </div>`;
    document.body.appendChild(overlay);
    document.getElementById("multi-join-wait-cancel-btn").onclick = () => {
      closeMultiJoinWaitOverlay();
      showScreen("lobby-mode-screen");
    };
  }
  overlay.style.display = "flex";

  closeMultiJoinWaitOverlay();
  overlay.style.display = "flex";
  const waitGeneration = multiJoinWaitGeneration;
  multiJoinWaitInterval = setInterval(async () => {
    try {
      const snap = await liteGetDoc(liteDoc(dbLite, "gameData", "multiRoom"));
      if (waitGeneration !== multiJoinWaitGeneration) return;
      const room = snap.exists() ? snap.data() : {};
      const hasEnded = room.status !== "playing" || !room.endTime || Date.now() >= Number(room.endTime);
      if (hasEnded) {
        closeMultiJoinWaitOverlay();
        await enterMultiLobbyAsStudent({ skipGameWait: true });
      }
    } catch (e) {
      console.warn("멀티 접속 대기 중 방 상태 확인 실패", e);
    }
  }, 1000);
}

async function writeMultiRoomControlState(payload, { verifyRound = false } = {}) {
  const roomRef = liteDoc(dbLite, "gameData", "multiRoom");
  const nextPayload = { ...payload, controlUpdatedAt: Date.now() };

  await liteSetDoc(roomRef, nextPayload, { merge: true });

  if (!verifyRound) return nextPayload;

  const verifySnap = await liteGetDoc(roomRef);
  if (!verifySnap.exists()) throw new Error("멀티 방 상태 저장 직후 서버 문서를 확인하지 못했습니다.");

  const saved = verifySnap.data();
  if (payload.status && saved.status !== payload.status) {
    throw new Error(`멀티 방 상태 검증 실패: 요청=${payload.status}, 서버=${saved.status || "(없음)"}`);
  }
  if (payload.roundId && saved.roundId !== payload.roundId) {
    throw new Error(`멀티 라운드 검증 실패: 요청=${payload.roundId}, 서버=${saved.roundId || "(없음)"}`);
  }

  console.info("[멀티 제어] REST 저장/검증 완료", {
    status: saved.status,
    gameMode: saved.gameMode,
    roundId: saved.roundId
  });
  return saved;
}

async function acknowledgeStudentRound(room, source = "unknown") {
  if (!myLobbyDocId || isTeacherMode || room?.status !== "playing") return;

  const roundId = getRoomRoundId(room);
  if (!roundId || lastStudentRoundAckId === roundId) return;

  try {
    await liteSetDoc(
      liteDoc(dbLite, "lobbyUsers", myLobbyDocId),
      {
        joinedRoundId: roundId,
        joinedGameMode: room.gameMode || "",
        joinedAt: Date.now(),
        lastRoomSignalSource: source,
        clientHeartbeatAt: Date.now()
      },
      { merge: true }
    );
    lastStudentRoundAckId = roundId;
    console.info(`[멀티 ACK] ${roundId} · ${source}`);
  } catch (error) {
    console.warn("[멀티 ACK] 기록 실패", error);
  }
}

async function refreshLobbyHeartbeat() {
  if (!myLobbyDocId || isTeacherMode) return;
  try {
    await liteSetDoc(
      liteDoc(dbLite, "lobbyUsers", myLobbyDocId),
      {
        clientHeartbeatAt: Date.now(),
        clientVisible: document.visibilityState === "visible"
      },
      { merge: true }
    );
  } catch (error) {
    console.warn("[멀티 heartbeat] 갱신 실패", error);
  }
}

function stopStudentMultiFallbackWatchers() {
  if (multiRoomRestWatchInterval) {
    clearInterval(multiRoomRestWatchInterval);
    multiRoomRestWatchInterval = null;
  }
  if (multiLobbyHeartbeatInterval) {
    clearInterval(multiLobbyHeartbeatInterval);
    multiLobbyHeartbeatInterval = null;
  }
}

function isTeacherRoomOpen(room = {}) {
  const heartbeatAt = Number(room.teacherHeartbeatAt || 0);
  return room.roomOpen === true && Boolean(room.teacherSessionId) && heartbeatAt > 0 && Date.now() - heartbeatAt <= TEACHER_LEASE_TIMEOUT_MS;
}

async function closeExpiredTeacherRoom(room = {}) {
  if (room.roomOpen !== true || isTeacherRoomOpen(room)) return;
  try {
    await liteSetDoc(liteDoc(dbLite, "gameData", "multiRoom"), {
      roomOpen: false,
      status: "waiting",
      teacherClosedAt: Date.now(),
      teacherCloseReason: "lease-expired"
    }, { merge: true });
  } catch (error) { console.warn("만료된 교사 대기실 정리 실패", error); }
}

function stopTeacherRoomHeartbeat() {
  if (teacherHeartbeatInterval) { clearInterval(teacherHeartbeatInterval); teacherHeartbeatInterval = null; }
}

async function refreshTeacherRoomHeartbeat() {
  if (!isTeacherMode || !activeTeacherSessionId) return;
  await liteSetDoc(liteDoc(dbLite, "gameData", "multiRoom"), {
    roomOpen: true,
    teacherSessionId: activeTeacherSessionId,
    teacherHeartbeatAt: Date.now()
  }, { merge: true });
}

function startTeacherRoomHeartbeat() {
  stopTeacherRoomHeartbeat();
  teacherHeartbeatInterval = setInterval(() => refreshTeacherRoomHeartbeat().catch(error => console.warn("교사 대기실 heartbeat 실패", error)), TEACHER_HEARTBEAT_MS);
}

async function closeTeacherRoom(reason = "explicit-exit") {
  stopTeacherRoomHeartbeat();
  const sessionId = activeTeacherSessionId;
  activeTeacherSessionId = null;
  if (!sessionId) return;
  try {
    const roomSnap = await liteGetDoc(liteDoc(dbLite, "gameData", "multiRoom"));
    const room = roomSnap.exists() ? roomSnap.data() : {};
    if (room.teacherSessionId !== sessionId) return;
    await liteSetDoc(liteDoc(dbLite, "gameData", "multiRoom"), {
      roomOpen: false,
      status: "waiting",
      teacherClosedAt: Date.now(),
      teacherCloseReason: reason
    }, { merge: true });
  } catch (error) { console.warn("교사 대기실 닫기 실패", error); }
}

async function reconcileStudentRoomByRest(reason = "rest-watchdog") {
  if (isTeacherMode || !myLobbyDocId) return false;

  try {
    lastMultiRoomRestCheckAt = Date.now();
    const roomSnap = await liteGetDoc(liteDoc(dbLite, "gameData", "multiRoom"));
    if (!roomSnap.exists()) return false;
    const room = roomSnap.data();

    if (!isTeacherRoomOpen(room)) {
      await closeExpiredTeacherRoom(room);
      window.customAlert("교사 대기실 연결이 종료되었습니다.");
      await exitLobby();
      showScreen("lobby-mode-screen");
      return false;
    }

    if (room.status === "playing") {
      return await rescueJoinCurrentGameIfPlaying(reason, room);
    }

    if (room.status === "waiting" && window.isMultiGameActive) {
      const resultScreen = document.getElementById("result-screen");
      const bossResultStillVisible =
        isBossRaid && resultScreen && resultScreen.classList.contains("active");

      if (!bossResultStillVisible) {
        console.warn(`[멀티 REST 복구] 종료 신호 누락 감지 · ${reason}`);
        try { resetGameStates(); } catch (error) { console.warn(error); }

        window.isMultiGameActive = false;
        currentGameMode = "";
        globalMultiEndTime = null;

        if (typeof window.toggleStudentLobbyListeners === "function") {
          window.toggleStudentLobbyListeners(true);
        }
        showScreen("multi-lobby-screen");
      }
    }
    return false;
  } catch (error) {
    console.warn(`[멀티 REST 감시] ${reason} 실패`, error);
    return false;
  }
}

function startStudentMultiFallbackWatchers() {
  stopStudentMultiFallbackWatchers();

  multiRoomRestWatchInterval = setInterval(() => {
    reconcileStudentRoomByRest("rest-watchdog").catch(() => {});
  }, MULTI_ROOM_REST_WATCH_MS);

  multiLobbyHeartbeatInterval = setInterval(() => {
    refreshLobbyHeartbeat().catch(() => {});
  }, MULTI_HEARTBEAT_MS);

  if (!multiVisibilityHandlerInstalled) {
    multiVisibilityHandlerInstalled = true;

    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible" && myLobbyDocId && !isTeacherMode) {
        reconcileStudentRoomByRest("visibility-resume").catch(() => {});
        refreshLobbyHeartbeat().catch(() => {});
      }
    });

    window.addEventListener("focus", () => {
      if (myLobbyDocId && !isTeacherMode) {
        reconcileStudentRoomByRest("window-focus").catch(() => {});
      }
    });
  }

  reconcileStudentRoomByRest("watchdog-start").catch(() => {});
  refreshLobbyHeartbeat().catch(() => {});
}

// =====================================================
// [09] 멀티 미아 복구 / 진행 중 게임 직접 합류
// -----------------------------------------------------
// - onSnapshot 신호를 놓친 학생 복구
// - 재접속 학생이 현재 진행 중인 게임을 직접 확인
// - highfive, create, custom_infinite, boss, showcase 등으로 재합류
// =====================================================


async function rescueJoinCurrentGameIfPlaying(reason = "direct-check", prefetchedRoom = null) {
  let lockTaken = false;

  try {
    let room = prefetchedRoom;
    if (!room) {
      const roomSnap = await liteGetDoc(liteDoc(dbLite, "gameData", "multiRoom"));
      if (!roomSnap.exists()) return false;
      room = roomSnap.data();
    }

    currentGroupingActive = room.groupingActive || false;
    currentMultiRoomGroupPlayMode = room.groupPlayMode || null;
    currentMultiRoomRepresentatives = room.representatives || null;

    if (room.status !== "playing") return false;

    if (restoreCompletedMultiResult(room)) {
      console.log(`[멀티 결과 복원] 이미 완료한 라운드의 결과 화면으로 복귀합니다. (${reason})`);
      return true;
    }
    if (isCompletedMultiRound(room)) return true;

    // 이미 시간이 완전히 지난 일반 게임이면 억지로 들어가지 않습니다.
    // 하이파이브는 종료 처리 방식이 달라서 제외합니다.
    if (room.endTime && room.gameMode !== "highfive" && Date.now() >= Number(room.endTime)) {
      console.log(`[미아복구] 이미 종료 시간이 지난 게임이라 합류하지 않습니다. (${reason})`);
      return false;
    }

    const lobbyScreen = document.getElementById("multi-lobby-screen");
    const hfResultScreen = document.getElementById("highfive-result-screen");

    // 결과 화면을 복구 대상에서 제외하기 전에 새 라운드인지 먼저 판별한다.
    // 그래야 같은 라운드의 정상 결과 화면은 유지하면서, 교사가 다음 게임을
    // 시작했을 때는 결과 화면에서도 새 라운드에 정상 합류할 수 있다.
    const incomingRoundId = getRoomRoundId(room);
    if (
      (globalMultiEndTime && room.endTime && globalMultiEndTime !== room.endTime) ||
      (window.lastSeenMultiRoundId && incomingRoundId !== window.lastSeenMultiRoundId)
    ) {
      window.isMultiGameActive = false;
      window.isMultiStartProcessing = false;
    }
    window.lastSeenMultiRoundId = incomingRoundId;

    const isStuckOut =
      (lobbyScreen && lobbyScreen.classList.contains("active")) ||
      (hfResultScreen && hfResultScreen.classList.contains("active"));

    // 이미 다른 시작 처리 중이면 중복 시작을 막습니다.
    if (window.isMultiStartProcessing) return true;

    // 이미 정상적으로 게임 중이면 또 시작하지 않습니다.
    if (window.isMultiGameActive && room.gameMode !== "highfive" && !isStuckOut) return true;

    window.isMultiStartProcessing = true;
    lockTaken = true;

    window.myProblemStats = {};
    window.isMultiGameActive = true;

    if (typeof window.toggleStudentLobbyListeners === "function") {
      window.toggleStudentLobbyListeners(false);
    }

    let selectedSet = wordSets.find(s => s.id === room.setId);
    if (!selectedSet && room.setId !== "custom_creation") {
      try {
        const setSnap = await liteGetDoc(liteDoc(dbLite, "gameData", "wordSets"));
        if (setSnap.exists()) {
          wordSets = setSnap.data().sets || [];
          selectedSet = wordSets.find(s => s.id === room.setId);
        }
      } catch(e) {
        console.error("미아복구 중 최신 세트 다운로드 실패", e);
      }
    }

    if (selectedSet) {
      wordList = selectedSet.words;
      currentSetId = room.setId;
      currentSetTitle = room.setTitle;
    }

    currentGameMode = room.gameMode;
    multiUseSpecialItems = (room.useSpecialItems === "on");
    window.multiUseBuffItems = (room.useBuffItems === "on");
    globalMultiEndTime = room.endTime;

if (currentGroupingActive && currentMultiRoomGroupPlayMode === "one-player" && !["highfive", "showcase"].includes(room.gameMode)) {
      const rep = currentMultiRoomRepresentatives?.[myCurrentGroupId];
      if (rep && rep.stdId !== currentUser.stdId) {
        const blockerMsg = document.getElementById("group-blocker-msg");
        const blockerOverlay = document.getElementById("group-blocker-overlay");
        if (blockerMsg && blockerOverlay) {
          blockerMsg.innerHTML = `지금은 <b>${rep.name}</b> 친구의 화면에서<br>조원들과 다 함께 상의하며 플레이하세요!`;
          blockerOverlay.style.display = "flex";
        }
      }
    }

    console.log(`[미아복구] 진행 중인 게임 직접 확인 성공: ${room.gameMode} (${reason})`);
    acknowledgeStudentRound(room, reason).catch(() => {});

    if (room.gameMode === "boss") {
      isBossRaid = true;
      multiUseSpecialItems = false;

      if (room.subMode === "speed") {
        currentGameMode = "speed";
        startCountdown(room.duration, "speed-screen", () => { startSpeedLogic(); });
      } else if (room.subMode === "chunk") {
        currentGameMode = "chunk";
        startCountdown(room.duration, "chunk-screen", () => { startChunkLogic(); });
      } else if (room.subMode === "custom_infinite") {
        currentGameMode = "custom_infinite";
        startCountdown(room.duration, "custom-infinite-screen", () => { startCustomInfiniteLogic(); });
      }

    } else {
      isBossRaid = false;

      if (room.gameMode === "speed") {
        startCountdown(room.duration, "speed-screen", () => { startSpeedLogic(); });
      } else if (room.gameMode === "speed-match") {
        startCountdown(room.duration, "speed-match-screen", () => { startSpeedMatchLogic(); });
      } else if (room.gameMode === "chunk") {
        startCountdown(room.duration, "chunk-screen", () => { startChunkLogic(); });
      } else if (room.gameMode === "highfive") {
        startHighFiveLogic(room.endTime);
      } else if (room.gameMode === "create") {
        startCreateLogic(room);
      } else if (room.gameMode === "custom_infinite") {
        startCountdown(room.duration, "custom-infinite-screen", () => { startCustomInfiniteLogic(); });
      } else if (room.gameMode === "showcase") {
        startShowcaseLogic(room.showcaseChar);
      }
    }

    return true;

  } catch(e) {
    console.warn("진행 중인 게임 직접 확인 실패", e);
    return false;

  } finally {
    if (lockTaken) {
      setTimeout(() => {
        window.isMultiStartProcessing = false;
      }, 1500);
    }
  }
}
// =====================================================
// [10] 하이파이브 긴급 안정화 / 강제 진입 보조
// -----------------------------------------------------
// - 하이파이브 시작 신호를 놓친 학생을 직접 복구
// - 1초 확인 장치
// - 하이파이브 중 강제종료/늦은 접속 대응
// =====================================================
function forceStartHighFiveIfNeeded(room, source = "unknown") {
  try {
    if (!room) return false;
    if (isTeacherMode) return false;
    if (room.status !== "playing") return false;
    if (room.gameMode !== "highfive") return false;

    const endTime = Number(room.endTime || 0);
    if (!endTime) return false;

    // 너무 오래 지난 하이파이브는 뒤늦게 끌고 오지 않습니다.
    // 단, 종료 직후 결과 집계 시간까지 고려해서 12초 정도는 허용합니다.
    if (Date.now() > endTime + 12000) return false;

    const hfScreen = document.getElementById("highfive-screen");
    const hfResultScreen = document.getElementById("highfive-result-screen");

    const alreadyInHighFive = hfScreen && hfScreen.classList.contains("active");
    const alreadyInResult = hfResultScreen && hfResultScreen.classList.contains("active");

    if (alreadyInResult) return true;

    // 같은 하이파이브 판을 이미 시작했다면 중복 실행하지 않습니다.
    if (window.lastHighFiveEndTime === endTime && alreadyInHighFive) return true;

    window.lastHighFiveEndTime = endTime;
    window.isMultiGameActive = true;
    currentGameMode = "highfive";
    globalMultiEndTime = endTime;

    if (typeof window.toggleStudentLobbyListeners === "function") {
      window.toggleStudentLobbyListeners(false);
    }

    console.log(`[하이파이브 강제소환] ${source} 경로로 하이파이브 시작 감지`);
    startHighFiveLogic(endTime);
    return true;

  } catch(e) {
    console.warn("하이파이브 강제소환 실패", e);
    return false;
  }
}


// =====================================================
// [11] 학생용 멀티 대기실
// -----------------------------------------------------
// - 학생 lobbyUsers 등록
// - 유령 문서 정리
// - 조 복구 / 적은 조 자동 배정
// - 학생 대기실 실시간 감시
// - 에러 고치기 버튼
// - 게임 시작 신호 수신
// =====================================================


async function enterMultiLobbyAsStudent({ skipGameWait = false } = {}) {
  if (isStudentLobbyEntering) return;
  isStudentLobbyEntering = true;
  loadingRetryAction = null;
  showScreen("loading-screen");
  setLoadingRecoveryButtons({ retry: false, backup: false });
  setLoadingDiagnostic("");
  updateLoadingProgress(10, "대기실에 연결하는 중입니다.", "현재 수업 상태를 확인하는 중...");
  try {
    const openRoomSnap = await liteGetDoc(liteDoc(dbLite, "gameData", "multiRoom"));
    const openRoom = openRoomSnap.exists() ? openRoomSnap.data() : {};
    if (!isTeacherRoomOpen(openRoom)) {
      isStudentLobbyEntering = false;
      showScreen("lobby-mode-screen");
      window.customAlert("교사가 멀티플레이어 대기실을 열지 않았습니다.");
      return;
    }
  } catch (error) {
    isStudentLobbyEntering = false;
    showScreen("lobby-mode-screen");
    window.customAlert("대기실 개방 상태를 확인하지 못했습니다. 잠시 후 다시 시도하세요.");
    return;
  }
  if (!skipGameWait) {
    try {
      const preflightSnap = await liteGetDoc(liteDoc(dbLite, "gameData", "multiRoom"));
      const preflightRoom = preflightSnap.exists() ? preflightSnap.data() : {};
      const gameStillRunning =
        preflightRoom.status === "playing" &&
        preflightRoom.endTime &&
        Date.now() < Number(preflightRoom.endTime);
      if (gameStillRunning && !isCompletedMultiRound(preflightRoom)) {
        isStudentLobbyEntering = false;
        waitForCurrentMultiGameToFinish();
        return;
      }
    } catch (e) {
      console.warn("멀티 입장 전 게임 상태 확인 실패 - 일반 입장을 시도합니다.", e);
    }
  }

  let roomAtEntry = null;
  try {
    // 👻 [소형 안전 패치 2] 재입장 전에 내 유령을 지우되, 기존 조 번호(groupId)는 최대한 보존합니다.
    // 조편성 후 튕겼다가 다시 들어온 학생이 "조 없음" 상태가 되는 것을 막기 위한 패치입니다.
    let restoredGroupId = null;

    try {
      const roomSnap = await liteGetDoc(liteDoc(dbLite, "gameData", "multiRoom"));
      const roomData = roomSnap.exists() ? roomSnap.data() : {};
      roomAtEntry = roomData;
      pendingCompletedResultRestore = Boolean(
        lastCompletedMultiRoundId &&
        roomData.status === "playing" &&
        getRoomRoundId(roomData) === lastCompletedMultiRoundId
      );
      const groupingNow = roomData.groupingActive === true;

      const ghostSnap = await liteGetDocs(liteCollection(dbLite, "lobbyUsers"));
      const ghostDeletePromises = [];
      const groupCounts = {};

      ghostSnap.forEach(d => {
        const p = d.data();
        if (!p) return;

        // 과거 비동기 setDoc 경쟁으로 생긴 "이름 없는 반쪽짜리 로비 문서"는 안전하게 제거합니다.
        // 정상 학생 문서는 stdId가 반드시 있고, 교사 데이터는 lobbyUsers에 만들지 않습니다.
        if (!p.stdId && !p.nickname && !p.realName) {
          ghostDeletePromises.push(liteDeleteDoc(liteDoc(dbLite, "lobbyUsers", d.id)).catch(e => e));
          return;
        }

        // 현재 살아있는 조 인원 수를 세어 둡니다.
        if (p.groupId) {
          groupCounts[p.groupId] = (groupCounts[p.groupId] || 0) + 1;
        }

        // 내 예전 유령 문서가 있으면, 지우기 전에 groupId를 기억합니다.
        if (p.stdId === currentUser.stdId) {
          if (p.groupId) restoredGroupId = p.groupId;
          ghostDeletePromises.push(liteDeleteDoc(liteDoc(dbLite, "lobbyUsers", d.id)).catch(e => e));
        }
      });

      await Promise.all(ghostDeletePromises);

      // 조편성이 이미 켜져 있는데 내 예전 groupId를 못 찾았다면,
      // 현재 존재하는 조 중 가장 인원이 적은 조에 임시 배정합니다.
      if (groupingNow && !restoredGroupId) {
        const roomGroupCount = Number(roomData.groupCount || 0);
        const groupNumbers = Object.keys(groupCounts).map(Number).filter(n => Number.isFinite(n) && n > 0);
        const totalGroups = roomGroupCount || (groupNumbers.length > 0 ? Math.max(...groupNumbers) : 0);

        if (totalGroups > 0) {
          let bestGroup = 1;
          for (let i = 2; i <= totalGroups; i++) {
            if ((groupCounts[i] || 0) < (groupCounts[bestGroup] || 0)) {
              bestGroup = i;
            }
          }
          restoredGroupId = bestGroup;
          console.log(`[재입장 조 복구] ${currentUser.nickname} 학생을 ${restoredGroupId}조로 복구/배정했습니다.`);
        }
      }

    } catch(e) {
      console.warn("내 유령 청소/조 복구 실패 - 그래도 입장은 계속 시도합니다.", e);
    }

    updateLoadingProgress(50, "대기실에 연결하는 중입니다.", "내 대기실 정보를 등록하는 중...");

    const finalRoomCheck = await liteGetDoc(liteDoc(dbLite, "gameData", "multiRoom"));
    if (!finalRoomCheck.exists() || !isTeacherRoomOpen(finalRoomCheck.data())) {
      throw Object.assign(new Error("교사 대기실이 닫혔습니다."), { code: "teacher-room-closed" });
    }

    const newLobbyData = {
      stdId: currentUser.stdId,
      realName: currentUser.realName,
      nickname: currentUser.nickname,
      character: currentUser.character,
      emoji: currentUser.emoji,
      score: roomAtEntry && getRoomRoundId(roomAtEntry) === lastCompletedMultiRoundId
        ? (currentUser.score || 0)
        : 0,
      items: "",
      attack: null,
      timestamp: Date.now()
    };

    if (restoredGroupId) {
      newLobbyData.groupId = restoredGroupId;
    }

    newLobbyData.clientSessionId =
      `${currentUser.stdId}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    newLobbyData.clientHeartbeatAt = Date.now();
    newLobbyData.joinedRoundId = null;

    // 학생마다 고정 문서 ID를 사용해 빠른 재입장/중복 클릭이 겹쳐도
    // 동일 학생의 로비 문서가 두 개 만들어지지 않게 한다.
    const stableLobbyDocId = `student_${encodeURIComponent(String(currentUser.stdId || currentUser.nickname))}`;
    await liteSetDoc(liteDoc(dbLite, "lobbyUsers", stableLobbyDocId), newLobbyData);
    myLobbyDocId = stableLobbyDocId;
    activeLobbyClientSessionId = newLobbyData.clientSessionId;
    updateLoadingProgress(70, "대기실에 연결하는 중입니다.", "친구 목록과 채팅을 연결하는 중...");
    const watchedLobbyDocId = stableLobbyDocId;
    const watchedSessionId = newLobbyData.clientSessionId;
    let lobbyDocHasExisted = false;
    let lobbyRemovalCheckPending = false;
    myLobbyListenerUnsubscribe = onSnapshot(doc(db, "lobbyUsers", myLobbyDocId), (docSnap) => {
if (!docSnap.exists()) {
          // 고정 문서 ID로 재등록하는 찰나의 삭제 스냅샷은 교사 초기화가 아니다.
          if (!lobbyDocHasExisted) return;
          if (lobbyRemovalCheckPending) return;
          lobbyRemovalCheckPending = true;

          // 이전 접속의 지연 삭제 이벤트일 수 있으므로 서버 문서를 다시 확인한다.
          setTimeout(async () => {
            lobbyRemovalCheckPending = false;
            if (myLobbyDocId !== watchedLobbyDocId || activeLobbyClientSessionId !== watchedSessionId) return;

            try {
              const verifySnap = await liteGetDoc(liteDoc(dbLite, "lobbyUsers", watchedLobbyDocId));
              if (verifySnap.exists()) return;
            } catch (e) {
              console.warn("로비 문서 삭제 여부 재확인 실패 - 초기화 안내를 보류합니다.", e);
              return;
            }

            if (myLobbyDocId !== watchedLobbyDocId || activeLobbyClientSessionId !== watchedSessionId) return;
            window.customAlert("선생님에 의해 대기실이 초기화되었습니다.");
            await exitLobby();
            showScreen("lobby-mode-screen");
          }, 500);
          return;
      }
      if (docSnap.data()?.clientSessionId && docSnap.data().clientSessionId !== watchedSessionId) return;
      lobbyDocHasExisted = true;
      if (docSnap.data().attack) {
        const atk = docSnap.data().attack; handleIncomingAttack(atk);
        setDoc(doc(db, "lobbyUsers", myLobbyDocId), { attack: null }, { merge: true });
      }
    });
  } catch(e) {
    console.error("로비 입장 등록 실패:", e);
    isStudentLobbyEntering = false;
    updateLoadingProgress(0, "대기실 연결에 실패했습니다.", "다시 연결하거나 게임 모드 선택으로 돌아가세요.");
    setLoadingDiagnostic(formatFirebaseError(e));
    loadingRetryAction = () => enterMultiLobbyAsStudent({ skipGameWait });
    setLoadingRecoveryButtons({ retry: true, backup: false });
    return;
  }

  // 🚀 학생 대기실 유저/채팅 감시 켜기/끄기 헬퍼 함수
  window.toggleStudentLobbyListeners = function(turnOn) {
      if (turnOn) {
          if (!lobbyUsersUnsubscribe) {
              lobbyUsersUnsubscribe = onSnapshot(collection(db, "lobbyUsers"), (snapshot) => {
                  const countEl = document.getElementById("lobby-user-count");
                  const playerMap = new Map();
                  snapshot.forEach((doc) => {
                      const p = { docId: doc.id, ...doc.data() };
                      const key = p.stdId || p.docId;
                      const previous = playerMap.get(key);
                      if (!previous || Number(p.timestamp || 0) >= Number(previous.timestamp || 0)) {
                          playerMap.set(key, p);
                      }
                      if (p.stdId === currentUser.stdId) myCurrentGroupId = p.groupId;
                  });
                  const players = Array.from(playerMap.values());
                  window.globalLobbyPlayers = players; 
                  if(countEl) countEl.innerText = players.length;

                  const sTitle = document.getElementById("student-lobby-title");
                  if (currentGroupingActive && myCurrentGroupId) {
                      if(sTitle) sTitle.innerText = `멀티플레이어 대기실 · ${myCurrentGroupId}조`;
                      const myGroupPlayers = players.filter(p => p.groupId === myCurrentGroupId);
                      renderLobbyGrid(myGroupPlayers, true); 
                  } else {
                      if(sTitle) sTitle.innerText = "멀티플레이어 대기실";
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
    lastMultiRoomSnapshotAt = Date.now();

    if (docSnap.exists()) {
      const room = docSnap.data();
      currentGroupingActive = room.groupingActive || false;
      currentMultiRoomGroupPlayMode = room.groupPlayMode || null;
      currentMultiRoomRepresentatives = room.representatives || null;
      
if (room.status === "playing") {
            if (restoreCompletedMultiResult(room)) return;
            if (isCompletedMultiRound(room)) return;
            if (room.endTime && Date.now() >= Number(room.endTime)) return;

            // 🚑 하이파이브는 15초짜리라 실시간 신호 지연에 매우 취약합니다.
            // 따라서 일반 게임 로직으로 들어가기 전에 하이파이브 전용 강제소환을 먼저 시도합니다.
            if (room.gameMode === "highfive") {
                forceStartHighFiveIfNeeded(room, "snapshot");
                return;
            }

            // 🚑 일반 게임은 중복 시작 방지 잠금을 유지합니다.
            // 단, 하이파이브는 시작 신호가 1번뿐이고 15초짜리라서
            // 이 잠금에 걸리면 학생이 대기실에 남는 경우가 생길 수 있습니다.
            // startHighFiveLogic()은 기존 타이머를 clearInterval로 지우고 다시 시작하므로,
            // 하이파이브는 잠금을 우회합니다.
            if (room.gameMode !== "highfive") {
                if (window.isMultiStartProcessing) return;
                window.isMultiStartProcessing = true;
                setTimeout(() => { window.isMultiStartProcessing = false; }, 1500);
            }

            // 🚀 [미아 방지 완벽 픽스 1] 새 게임 판독기!
            // 폰이 잠든 사이 이전 게임 종료 신호를 놓쳤더라도, 선생님이 새로 시작한 게임의 고유 종료 시간(endTime)이 
            // 내 폰이 기억하는 시간과 다르다면 '완전히 새로운 게임'으로 인식하고 잠금을 강제 해제합니다.
            const incomingRoundId = getRoomRoundId(room);
            if (
                (globalMultiEndTime && room.endTime && globalMultiEndTime !== room.endTime) ||
                (window.lastSeenMultiRoundId && incomingRoundId !== window.lastSeenMultiRoundId)
            ) {
                window.isMultiGameActive = false;
                window.isMultiStartProcessing = false;
            }
            window.lastSeenMultiRoundId = incomingRoundId;

            // 🚀 [미아 방지 완벽 픽스 2] 대기실 탈출기!
            // 내부 시스템이 꼬여서 눈에 보이는 화면은 '대기실'이나 '결과창'인데, 폰 혼자 게임 중이라 착각하는 상태를 감지합니다.
            // 같은 라운드의 제한 시간이 먼저 끝나 결과 화면으로 이동한 경우는
            // 정상 종료 흐름이다. 서버의 room.status가 잠시 playing으로 남아 있어도
            // 결과 화면을 "게임 밖에 갇힌 상태"로 판단해 게임을 다시 시작하면 안 된다.
            // 새 라운드는 위의 roundId/endTime 비교에서 isMultiGameActive를 해제하므로
            // 결과 화면에 있더라도 정상적으로 새 게임에 합류할 수 있다.
            const isStuckOut = document.getElementById("multi-lobby-screen").classList.contains("active") ||
                               document.getElementById("highfive-result-screen").classList.contains("active");

// 하이파이브 모드거나, 실제 화면이 게임 밖(대기실/결과창)에 갇혀있는 경우에는 묻지도 따지지도 않고 무조건 강제 소환!
            if (window.isMultiGameActive && room.gameMode !== "highfive" && !isStuckOut) return;
            
            // 🚀 [오답 장부 초기화] 섞이지 않도록, 완전히 새로운 게임이 시작될 때만 내 오답 장부를 깨끗하게 비웁니다!
            window.myProblemStats = {};
            
            window.isMultiGameActive = true;
            acknowledgeStudentRound(room, "snapshot").catch(() => {});

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
         
if (currentGroupingActive && currentMultiRoomGroupPlayMode === "one-player" && !["highfive", "showcase"].includes(room.gameMode)) {
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
        // 🚑 [1.1 핫픽스] 게임 도중 늦게 도착한 cached waiting 신호 때문에
        // 학생 화면이 대기실로 빠졌다가 REST watchdog에 의해 다시 게임으로 들어오는 현상을 막습니다.
        // 이미 게임에 들어간 학생이라면 서버의 최신 상태를 한 번 직접 확인하고,
        // 서버가 아직 playing이면 이 waiting snapshot은 오래된 신호로 보고 무시합니다.
        if (!isTeacherMode && window.isMultiGameActive) {
          try {
            const latestRoomSnap = await liteGetDoc(liteDoc(dbLite, "gameData", "multiRoom"));
            if (latestRoomSnap.exists()) {
              const latestRoom = latestRoomSnap.data();
              if (latestRoom.status === "playing") {
                const latestRoundId = getRoomRoundId(latestRoom);
                const seenRoundId = window.lastSeenMultiRoundId || "";
                if (!seenRoundId || latestRoundId === seenRoundId || Number(latestRoom.controlUpdatedAt || 0) >= Number(room.controlUpdatedAt || 0)) {
                  console.warn("[멀티 상태 보호] 늦게 도착한 waiting 신호를 무시합니다.", {
                    seenRoundId,
                    latestRoundId
                  });
                  return;
                }
              }
            }
          } catch (e) {
            // 재확인 실패 시에는 기존 onSnapshot 동작을 유지합니다.
            console.warn("[멀티 상태 보호] waiting 재확인 실패 - 기존 종료 로직을 따릅니다.", e);
          }
        }

                // 👹 [보스전 결과 화면 학생 복귀]
        // 보스전은 종료 시 학생이 결과 화면에 남기 때문에,
        // 교사가 결과 확인 완료 버튼을 누르면 bossReturnToLobbyAt 신호로 학생도 대기실로 보냅니다.
        const bossReturnAt = room.bossReturnToLobbyAt || 0;
        const resultScreen = document.getElementById("result-screen");
        const isResultScreenActive = resultScreen && resultScreen.classList.contains("active");

        if (!isTeacherMode && bossReturnAt && window.lastHandledBossReturnAt !== bossReturnAt && isResultScreenActive) {
            window.lastHandledBossReturnAt = bossReturnAt;

            clearInterval(gameTimerInterval);
            clearInterval(cdInterval);
            if (window.cdInterval) clearInterval(window.cdInterval);

            isBossRaid = false;
            currentGameMode = "";
            globalMultiEndTime = null;
            window.isMultiGameActive = false;

            resetGameStates();
            toggleStudentLobbyListeners(true);

            window.customAlert("👑 선생님이 보스전 결과 확인을 마쳤습니다!\n대기실로 이동합니다.");
            showScreen("multi-lobby-screen");
            return;
        }
        // 🚨 하이파이브 진행/결과 대기 중 교사가 취소 또는 확정하면 학생도 반드시 대기실로 복귀합니다.
        const hfScreen = document.getElementById("highfive-screen");
        const hfResultScreen = document.getElementById("highfive-result-screen");
        const isInHighFiveFlow =
            (hfScreen && hfScreen.classList.contains("active")) ||
            (hfResultScreen && hfResultScreen.classList.contains("active")) ||
            currentGameMode === "highfive";

        if (!isTeacherMode && isInHighFiveFlow) {
            if (hfResultTimeout) {
                clearTimeout(hfResultTimeout);
                hfResultTimeout = null;
            }
            clearInterval(gameTimerInterval);
            if (window.cdInterval) clearInterval(window.cdInterval);

            document.getElementById("confetti-canvas").style.display = "none";
            window.isMultiGameActive = false;
            currentGameMode = "";
            currentHighFiveRoundId = null;
            globalMultiEndTime = null;
            currentGroupingActive = room.groupingActive || false;

            toggleStudentLobbyListeners(true);
            showScreen("multi-lobby-screen");
            return;
        }

        // 🚀 대기실로 돌아왔을 때만 안전하게 실행되는 찐 종료 로직!
        window.isMultiGameActive = false;
        toggleStudentLobbyListeners(true); 
          // 🚑 모든 게임 모드는 공통 REST watchdog이 보조합니다.
          startStudentMultiFallbackWatchers();

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

  // 🚑 [강화형 미아 복구] 재입장 직후 현재 게임 상태를 직접 1회 확인합니다.
  // 에러 고치기 버튼으로 다시 들어온 학생, 뒤늦게 재접속한 학생이 이미 진행 중인 게임을 따라잡게 합니다.
  startStudentMultiFallbackWatchers();

  setTimeout(() => {
    reconcileStudentRoomByRest("student-enter-direct-check").catch(e => {
      console.warn("재입장 후 현재 게임 확인 실패", e);
    });
  }, 300);
  updateLoadingProgress(100, "대기실 연결 완료", "실시간 수업 신호를 기다리고 있어요.");
  setTimeout(() => {
    isStudentLobbyEntering = false;
    loadingRetryAction = null;
    if (pendingCompletedResultRestore) showScreen("result-screen");
    else showScreen("multi-lobby-screen");
  }, 220);
}
bindClick("lobby-exit-btn", async () => { playSound("click"); await exitLobby(); showScreen("lobby-mode-screen"); });

// 🚑 학생용: 대기실 미아/오류 복구 버튼
// 학생이 뒤로가기를 누르지 않고, 자기 멀티 접속을 정리한 뒤 다시 입장하게 해줍니다.
let isLobbyRepairing = false;

bindClick("lobby-repair-btn", async () => {
  if (isLobbyRepairing) return;
  isLobbyRepairing = true;

  const btn = document.getElementById("lobby-repair-btn");
  const oldText = btn ? btn.innerText : "";

  try {
    playSound("click");

    if (btn) {
      btn.innerText = "복구 중...";
      btn.disabled = true;
      btn.style.opacity = "0.6";
      btn.style.cursor = "not-allowed";
    }

    // 게임/오버레이/타이머 상태를 먼저 정리합니다.
    try {
      resetGameStates();
    } catch(e) {
      console.warn("복구 중 게임 상태 초기화 실패", e);
    }

    // 기존 멀티 접속을 완전히 정리합니다.
    await exitLobby();

    // 너무 빠른 재입장으로 DB 삭제/생성이 겹치는 것을 줄이기 위한 짧은 안전 대기
    await new Promise(resolve => setTimeout(resolve, 600));

    // 다시 학생 멀티 대기실로 입장합니다.
    // 선생님이 이미 적용한 '자기 유령 삭제 + 조 번호 보존' 패치가 여기서 같이 작동합니다.
    await enterMultiLobbyAsStudent();

    window.customAlert("복구 완료! 선생님 화면에 다시 보이는지 확인해 주세요.");

  } catch(e) {
    console.error("대기실 복구 실패", e);
    window.customAlert("복구 중 오류가 났어요. 이 경우에는 크롬 탭을 완전히 닫고 다시 들어와 주세요.");
  } finally {
    isLobbyRepairing = false;

    const newBtn = document.getElementById("lobby-repair-btn");
    if (newBtn) {
      newBtn.innerText = oldText || "🚑 에러 고치기";
      newBtn.disabled = false;
      newBtn.style.opacity = "1";
      newBtn.style.cursor = "pointer";
    }
  }
});

async function exitLobby() {
  isStudentLobbyEntering = false;
  loadingRetryAction = null;
  stopStudentMultiFallbackWatchers();
  closeMultiJoinWaitOverlay();
  pendingCompletedResultRestore = false;
  activeLobbyClientSessionId = null;

  // 이전 게임의 지연 점수 전송이 퇴장/재입장 뒤에 실행되지 않도록 제거합니다.
  if (syncScoreTimeout) {
    clearTimeout(syncScoreTimeout);
    syncScoreTimeout = null;
  }

  window.isMultiStartProcessing = false;

  if (window.highFivePullerInterval) {
    clearInterval(window.highFivePullerInterval);
    window.highFivePullerInterval = null;
  }

  if (lobbyUsersUnsubscribe) { lobbyUsersUnsubscribe(); lobbyUsersUnsubscribe = null; }
  if (lobbyChatUnsubscribe) { lobbyChatUnsubscribe(); lobbyChatUnsubscribe = null; }
  if (multiRoomUnsubscribe) { multiRoomUnsubscribe(); multiRoomUnsubscribe = null; }
  if (myLobbyListenerUnsubscribe) { myLobbyListenerUnsubscribe(); myLobbyListenerUnsubscribe = null; }
  if (myLobbyDocId) { try { await liteDeleteDoc(liteDoc(dbLite, "lobbyUsers", myLobbyDocId)); } catch(e) { console.error(e); } myLobbyDocId = null; }
  globalMultiEndTime = null; 
}

function forceCleanupLobby() {
  if (myLobbyDocId) { deleteDoc(doc(db, "lobbyUsers", myLobbyDocId)); }
  if (isTeacherMode && activeTeacherSessionId) {
    setDoc(doc(db, "gameData", "multiRoom"), { roomOpen: false, status: "waiting", teacherSessionId: activeTeacherSessionId, teacherClosedAt: Date.now(), teacherCloseReason: "page-unload" }, { merge: true });
  }
}
window.addEventListener("beforeunload", forceCleanupLobby);
window.addEventListener("pagehide", forceCleanupLobby);

window.teacherGroupPlayMode = null; // 교사용 글로벌 변수 추가



// =====================================================
// [12] 교사용 멀티 대기실 / 게임 시작 컨트롤
// -----------------------------------------------------
// - 교사 대기실 입장
// - 학생 목록/조 목록 실시간 표시
// - 하이파이브, 문제 만들기, 학생 출제 게임, 보스전 시작
// - 조편성/조해제
// - 교사용 실시간 중계 화면
// =====================================================


async function enterMultiLobbyAsTeacher() {
  if (isTeacherMode && activeTeacherSessionId) { showScreen("teacher-lobby-screen"); return; }
  activeTeacherSessionId = `teacher_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  try {
    await liteSetDoc(liteDoc(dbLite, "gameData", "multiRoom"), {
      roomOpen: true,
      status: "waiting",
      teacherSessionId: activeTeacherSessionId,
      teacherOpenedAt: Date.now(),
      teacherHeartbeatAt: Date.now(),
      teacherClosedAt: null,
      teacherCloseReason: null
    }, { merge: true });
  } catch (error) {
    activeTeacherSessionId = null;
    window.customAlert("교사용 대기실을 열지 못했습니다. 네트워크 연결을 확인하세요.");
    return;
  }
  isTeacherMode = true;
  startTeacherRoomHeartbeat();
  showScreen("teacher-lobby-screen");
  
  // 🚀 일반 세트와 출제 세트를 각자의 드롭다운에 나눠 담습니다!
  const setSelect = document.getElementById("teacher-game-set-select");
  if (setSelect) { setSelect.innerHTML = wordSets.filter(s => !s.isCustomSet).map(set => `<option value="${set.id}">${set.title} (${set.words.length}개)</option>`).join(""); }
  const customSetSelect = document.getElementById("teacher-custom-set-select");
  if (customSetSelect) { customSetSelect.innerHTML = wordSets.filter(s => s.isCustomSet).map(set => `<option value="${set.id}">✨ ${set.title} (${set.words.length}문제)</option>`).join(""); }
  
  lobbyUsersUnsubscribe = onSnapshot(collection(db, "lobbyUsers"), (snapshot) => {
    const tCountEl = document.getElementById("teacher-user-count");
    const playerMap = new Map();
    snapshot.forEach((doc) => {
      const p = { docId: doc.id, ...doc.data() };
      const key = p.stdId || p.docId;
      const previous = playerMap.get(key);
      if (!previous || Number(p.timestamp || 0) >= Number(previous.timestamp || 0)) playerMap.set(key, p);
    });
    const players = Array.from(playerMap.values());
    if(tCountEl) tCountEl.innerText = players.length;
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
                  window.isBossResultShowing = false;
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
                      // 👹 [보스전 종료 화면 패치]
                      // 보스전이 끝났을 때도 일반 게임처럼 '결과 화면'으로 취급하고,
                      // 교사가 직접 대기실로 돌아갈 수 있는 버튼을 보여줍니다.
                      window.isBossResultShowing = true;
                      window.teacherLobbyStatus = "boss_result";

                      showScreen("teacher-lobby-screen");
                      document.getElementById("teacher-viewer-title").innerText = "🏆 보스전 최종 타격 데미지 랭킹";
                      document.getElementById("teacher-match-timer").style.display = "block";
                      document.getElementById("teacher-match-timer").innerText = "게임 종료!";
                      document.getElementById("teacher-visual-lobby-grid").style.display = "none";
                      document.getElementById("teacher-live-leaderboard").style.display = "block";

                      const bossBackBtn = document.getElementById("teacher-match-abort-btn");
                      if (bossBackBtn) {
                          bossBackBtn.style.display = "block";
                          bossBackBtn.innerHTML = "🏁 보스전 결과 확인 완료 / 대기실로 복귀하기";
                          bossBackBtn.style.backgroundColor = "#4CAF50";
                          bossBackBtn.style.boxShadow = "0 4px 0 #388E3C";
                      }

                      // 보스전 결과 화면에서는 대기실 음악으로 바로 바꾸지 않고 보스전 BGM을 유지합니다.
                      playTeacherBGM("boss");
                      
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

// 🚀 [UI 통합 혁신] 두 개로 쪼개져서 버그를 일으키던 세트 선택창을 '하나의 메인 드롭다운'으로 완벽 통합합니다!
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

    // 🚀 모드에 따라 하나의 드롭다운에 일반 세트 / 학생 출제 세트를 스마트하게 번갈아 갈아끼웁니다!
    const setSelect = document.getElementById("teacher-game-set-select");
    if (setSelect) {
        if (isCustom || (isBoss && bossSub === "custom_infinite")) {
            setSelect.innerHTML = wordSets.filter(s => s.isCustomSet).map(set => `<option value="${set.id}">✨ ${set.title} (${set.words.length}문제)</option>`).join("");
        } else {
            setSelect.innerHTML = wordSets.filter(s => !s.isCustomSet).map(set => `<option value="${set.id}">${set.title} (${set.words.length}개)</option>`).join("");
        }
    }

    // 조 해제 버튼 보이기 (조편성이 되어있을 때만)
    toggleDisplay("teacher-disband-group-btn", currentGroupingActive);

    toggleDisplay("teacher-boss-options-container", isBoss); 
    toggleDisplay("teacher-time-container", !(isHf || isCreate)); 
    toggleDisplay("teacher-item-container", !(isHf || isCreate || isBoss)); 
    
    // 🚀 하이파이브와 문제만들기를 제외하고는 무조건 세트 창을 통합 노출시킵니다! (증발 버그 완전 해결)
    toggleDisplay("teacher-set-container", !(isHf || isCreate)); 
    toggleDisplay("teacher-custom-options-container", isCustom);

    // 중복되는 구형 커스텀 드롭다운 요소들은 강제로 숨김 처리
    const customSetSelect = document.getElementById("teacher-custom-set-select");
    if (customSetSelect) customSetSelect.style.display = "none";
    const customSetLabels = document.querySelectorAll("#teacher-custom-options-container label");
    if (customSetLabels.length >= 3) customSetLabels[2].style.display = "none";

    toggleDisplay("teacher-group-count-container", isHf);
    toggleDisplay("teacher-create-time-container", isCreate);
    toggleDisplay("teacher-create-type-container", isCreate);

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

    let showPlayMode = false;
    if (isCustom) showPlayMode = (customPlaySelect && customPlaySelect.value === "group");
    else if (isCreate) showPlayMode = currentGroupingActive; 
    else showPlayMode = (currentGroupingActive && !isHf);
    toggleDisplay("teacher-group-play-mode-container", showPlayMode);

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
      const bossHpRaw = document.getElementById("teacher-boss-hp-select")?.value || "";
      const bossHp = parseInt(String(bossHpRaw).replace(/,/g, "").trim(), 10);
      if (!Number.isFinite(bossHp) || bossHp <= 0) {
          return alert("보스 체력은 1 이상의 숫자로 입력해 주세요! 예: 1000000");
      }
      const subMode = document.getElementById("teacher-boss-submode-select").value;
      const duration = document.getElementById("teacher-game-time-select")?.value || 3;
      const durationSeconds = getDurationSeconds(duration, 180);
      
      // 🚀 [보스전 학생출제 세트 버그 완전 해결]
      // 숨겨진 드롭다운 대신, 선생님 눈에 보이는 통합 메인 드롭다운에서 세트 번호를 안전하게 다이렉트로 읽어옵니다!
      const finalSetId = document.getElementById("teacher-game-set-select").value;
      if(!finalSetId) return alert("보스전을 진행할 학습 세트를 선택해 주세요!");
      const finalSetTitle = wordSets.find(s => s.id === finalSetId)?.title;

      // 🚀 [보스전 조편성 강제 해제 패치]
      // 보스전 시작 시 조가 편성되어 있다면 시스템이 알아서 학생들의 조(groupId) 정보를 싹 날려버리고 
      // 완벽한 개인전(전원 협동) 상태로 리셋합니다!
      if (currentGroupingActive) {
          currentGroupingActive = false;
          try {
              const snap = await getDocs(collection(db, "lobbyUsers"));
              const disbandPromises = [];
              snap.forEach(d => {
                  disbandPromises.push(setDoc(doc(db, "lobbyUsers", d.id), { groupId: null }, { merge: true }).catch(e=>e));
              });
              await Promise.all(disbandPromises);
          } catch(e) { console.error("보스전 조 해제 에러", e); }
          window.customAlert("보스전은 개인전으로 진행됩니다!\n(편성되었던 조가 자동 해제되었습니다.)");
      }

const tEnd = Date.now() + 5000 + (durationSeconds * 1000);// 5초 인트로 + 실제 제한시간
      const roundId = createMultiRoundId("boss");
      await writeMultiRoomControlState({ 
          status: "playing", gameMode: "boss", subMode: subMode, duration: duration, 
          setId: finalSetId, setTitle: finalSetTitle, 
          bossHp: bossHp, bossMaxHp: bossHp, endTime: tEnd,
          roundId, startedAt: Date.now(),
          groupingActive: false, groupPlayMode: null, groupCount: null,
          useBuffItems: "on", useSpecialItems: "off"
      }, { verifyRound: true });
      return;
  }

  if (mode === "highfive") {
     const targetEndTime = Date.now() + 25000;
     const roundId = "hf_" + Date.now();
     currentHighFiveRoundId = roundId;

     await writeMultiRoomControlState({
        status: "playing",
        gameMode: mode,
        groupCount: groupCount,
        endTime: targetEndTime,
        startedAt: Date.now(),
        roundId: roundId,
        highfiveStartedAt: Date.now(),
        highfiveRoundId: roundId,
        highfiveCancelledAt: null,
        highfiveConfirmedAt: null,
        groupingActive: false,
        groupPlayMode: null,
        representatives: null
     }, { verifyRound: true });

     startHighFiveLogic(targetEndTime); 
     return;
  }

  if (mode === "create") {
      const cTime = document.getElementById("teacher-create-time-select").value;
      const cTimeSeconds = getDurationSeconds(cTime, 600);
      const cCount = parseInt(document.getElementById("teacher-create-count-select").value);
      let allowedTypes = [];
      document.querySelectorAll(".create-type-cb:checked").forEach(cb => allowedTypes.push(cb.value));
      if(allowedTypes.length === 0) return alert("최소 1개 이상의 문제 유형을 선택해 주세요!");
      const targetEndTime = Date.now() + (cTimeSeconds * 1000); 

      let gPlayMode = null; let reps = {};
      if (currentGroupingActive) {
          gPlayMode = document.getElementById("teacher-group-play-mode-select").value;
          if (gPlayMode === "one-player") {
              const grouped = {}; window.globalLobbyPlayers.forEach(p => { if (p.groupId) { if(!grouped[p.groupId]) grouped[p.groupId] = []; grouped[p.groupId].push(p); } });
              for (const gId in grouped) { const mems = grouped[gId]; const rep = mems[Math.floor(Math.random() * mems.length)]; reps[gId] = { stdId: rep.stdId, name: `${rep.nickname} (${rep.stdId} ${rep.realName})` }; }
          }
      }

      const roundId = createMultiRoundId("create");
      await writeMultiRoomControlState({ 
          status: "playing", gameMode: mode, duration: cTime, targetProblemCount: cCount, allowedTypes: allowedTypes,
          setId: "custom_creation", setTitle: "학생들이 출제 중...", endTime: targetEndTime,
          roundId, startedAt: Date.now(),
          groupingActive: currentGroupingActive, groupPlayMode: gPlayMode, representatives: reps
      }, { verifyRound: true });
      return;
  }

  // 🚀 1. 게임 옵션(시간, 버프, 공격) 읽어오기
  const timeSelect = document.getElementById("teacher-game-time-select");
  const duration = timeSelect ? timeSelect.value : 3;
  const durationSeconds = getDurationSeconds(duration, 180);
  const buffOption = document.getElementById("teacher-game-buff-select")?.value || "on"; 
  const attackOption = document.getElementById("teacher-game-attack-select")?.value || "off"; 

// 🚀 2. 특수 세트(무한 모드) 시작 로직
  if (mode === "custom_game") {
      const rule = document.getElementById("teacher-custom-rule-select").value; 
      const playStyle = document.getElementById("teacher-custom-play-select").value; 
      // 🟢 통합 메인 드롭다운에서 학생 세트 번호를 안전하게 읽어옵니다.
      const cSetId = document.getElementById("teacher-game-set-select").value;
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
      const tEnd = Date.now() + 5000 + (durationSeconds * 1000);
      const roundId = createMultiRoundId("custom_" + rule);
      await writeMultiRoomControlState({ 
          status: "playing", gameMode: "custom_" + rule, duration: duration, setId: cSetId, setTitle: cSet.title, 
          useBuffItems: buffOption, useSpecialItems: attackOption, endTime: tEnd,
          roundId, startedAt: Date.now(),
          groupingActive: (playStyle === "group"), groupPlayMode: gPlayMode, representatives: reps
      }, { verifyRound: true });
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
  const targetEndTime = Date.now() + 5000 + (durationSeconds * 1000);
  const roundId = createMultiRoundId(mode);
  await writeMultiRoomControlState({ 
      status: "playing", gameMode: mode, duration: duration, setId: setId, setTitle: selectedSet.title, 
      useBuffItems: buffOption, useSpecialItems: attackOption, endTime: targetEndTime,
      roundId, startedAt: Date.now(),
      groupPlayMode: groupPlayMode, representatives: representatives
  }, { verifyRound: true }); 
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
window.isBossResultShowing = false;
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


// =====================================================
// [13] 교사 실시간 순위표 / 조별 점수판
// -----------------------------------------------------
// - 학생별 실시간 점수 표시
// - 조별 점수 합산
// - 이름 숨기기
// - 보스전/일반전 점수 표시 전환
// =====================================================

function renderTeacherLiveLeaderboard(players) {
    const board = document.getElementById("teacher-live-leaderboard");
    if (!board) return;

    let renderList = [];

    // 👥 조별 리더보드에 조원 이름 표시용
    const getGroupMembersText = (groupId) => {
        return (players || [])
            .filter(p => String(p.groupId) === String(groupId))
            .map(p => p.nickname || p.realName || p.stdId || "이름없음")
            .join(", ");
    };

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
                    subtitle: `<span style="font-size:14px; color:#666;">(조별 출제)</span><br><span style="font-size:13px; color:#1976D2;">👤 ${getGroupMembersText(g.id)}</span>`,
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
    renderId: `group-${g.id}`,
    title: `<span style="color:#FF5722">${g.id}조</span>`,
    subtitle: `<span style="font-size:14px; color:#666;">(조별 합산 점수)</span><br><span style="font-size:13px; color:#1976D2;">👤 ${getGroupMembersText(g.id)}</span>`,
    score: g.score || 0,
    items: g.items || "",
    icon: `<span style="font-size:35px; margin-right:10px;">👥</span>`
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

if (window.isBossResultShowing) {
    // 👹 [보스전 결과 화면 복귀 + 학생 소환]
    // 교사가 보스전 결과 확인을 마치면 학생 결과 화면도 대기실로 강제 복귀시킵니다.
    window.isBossResultShowing = false;
    window.teacherLobbyStatus = "waiting";
    currentGameMode = "";
    isBossRaid = false;

    try {
        await setDoc(doc(db, "gameData", "multiRoom"), {
            status: "waiting",
            gameMode: "",
            endTime: null,
            bossReturnToLobbyAt: Date.now()
        }, { merge: true });
    } catch(e) {
        console.warn("보스전 학생 복귀 신호 전송 실패", e);
    }

    cleanupTeacherLiveMatch();
    renderTeacherVisualLobby(window.globalLobbyPlayers || []);
    playTeacherBGM("lobby");
    showScreen("teacher-lobby-screen");
    return;
}
    
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


// =====================================================
// [14] 학생 출제 문제 취합 / 학생 출제 세트 저장
// -----------------------------------------------------
// - lobbyUsers에 제출된 학생 문제 수집
// - 학생 출제 세트 생성
// - 조별/개인 만든이 기록
// - 교사 드롭다운 새로고침
// =====================================================


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
bindClick("teacher-lobby-exit-btn", async () => {
  playSound("click");
  stopTeacherBGM(); // 🎵 밖으로 나갈 때 교실 BGM 완전 끄기
  await closeTeacherRoom("explicit-exit");
  isTeacherMode = false;
  if (lobbyUsersUnsubscribe) { lobbyUsersUnsubscribe(); lobbyUsersUnsubscribe = null; }
  if (lobbyChatUnsubscribe) { lobbyChatUnsubscribe(); lobbyChatUnsubscribe = null; }
  if (multiRoomUnsubscribe) { multiRoomUnsubscribe(); multiRoomUnsubscribe = null; }
  if (teacherRenderInterval) { clearInterval(teacherRenderInterval); teacherRenderInterval = null; }
  showScreen("admin-main-screen");
  showAdminPanel("students");
});
// ==========================================
// 🚀 전역 뒤로가기 버튼 UI 이름/위치 통일 패치
// ==========================================
const backBtnIds = [
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
let currentHighFiveRoundId = null;
let hfResultTimeout = null;
let hfProcessGuardTimeout = null;


// =====================================================
// [15] 하이파이브 본 게임 / 결과 처리
// -----------------------------------------------------
// - 학생 하이파이브 버튼 화면
// - 클릭 시간 저장
// - 조편성 결과 계산
// - 하이파이브 취소/복구/결과 화면
// =====================================================



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
         if (hfResultTimeout) clearTimeout(hfResultTimeout);
hfResultTimeout = setTimeout(() => {
    hfResultTimeout = null;
    processHighFiveResult();
}, 4000);
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
        let roundId = currentHighFiveRoundId;

        // 늦게 끌려온 학생은 로컬에 판 번호가 없을 수 있으므로 서버에서 직접 확인합니다.
        if (!roundId) {
            const roomSnap = await getDoc(doc(db, "gameData", "multiRoom"));
            if (roomSnap.exists()) {
                roundId = roomSnap.data().highfiveRoundId || null;
                currentHighFiveRoundId = roundId;
            }
        }

        await addDoc(collection(db, "scores"), {
          stdId: currentUser.stdId, 
          realName: currentUser.realName,
          nickname: currentUser.nickname, 
          character: currentUser.character,
          score: timestamp,
          mode: "highfive",
          highfiveRoundId: roundId,
          timestamp: Date.now()
        });
    } catch(e) { console.error(e); }
}

// 🚀 하이파이브 결과 처리 (학번/실명 표시 및 데이터 저장)

async function processHighFiveResult() {
    showScreen("loading-screen");
    document.querySelector("#loading-screen h2").innerText = "마음이 통하는 친구들을 찾고 있습니다...";

    // 🚑 [하이파이브 로딩 멈춤 방지]
    // 결과 계산 중 네트워크가 멈춰도 학생이 로딩 화면에 영원히 갇히지 않게 합니다.
    if (hfProcessGuardTimeout) clearTimeout(hfProcessGuardTimeout);
    hfProcessGuardTimeout = setTimeout(() => {
        const loadingScreen = document.getElementById("loading-screen");
        const isStillLoading = loadingScreen && loadingScreen.classList.contains("active");

        if (!isTeacherMode && isStillLoading && currentGameMode === "highfive") {
            console.warn("하이파이브 결과 계산이 지연되어 대기실로 복구합니다.");
            hfProcessGuardTimeout = null;
            if (hfResultTimeout) {
                clearTimeout(hfResultTimeout);
                hfResultTimeout = null;
            }
            clearInterval(gameTimerInterval);
            currentGameMode = "";
            window.isMultiGameActive = false;
            window.customAlert("하이파이브 결과를 불러오는 중 네트워크가 지연되었습니다.\n대기실로 복구합니다.");
            showScreen("multi-lobby-screen");
        }
    }, 14000);
    let groupCount = 2;
    const roomDoc = await getDoc(doc(db, "gameData", "multiRoom"));
    const roomData = roomDoc.exists() ? roomDoc.data() : {};
    if(roomData.groupCount) groupCount = roomData.groupCount;

    const roundId = roomData.highfiveRoundId || currentHighFiveRoundId || null;
    currentHighFiveRoundId = roundId;

    const lobbySnap = await getDocs(collection(db, "lobbyUsers"));
    const lobbyPlayers = [];
    lobbySnap.forEach(d => {
        const p = { docId: d.id, ...d.data() };
        if (p && p.stdId) lobbyPlayers.push(p);
    });

    const lobbyStdIds = new Set(lobbyPlayers.map(p => p.stdId).filter(Boolean));

    let uniqueTop = {};
    const thirtySecondsAgo = Date.now() - 45000;

    for (let attempt = 0; attempt < 5; attempt++) {
        const q = query(collection(db, "scores"), orderBy("timestamp", "desc"), limit(300));
        const qSnap = await getDocs(q);
        qSnap.forEach(d => {
            const s = d.data();

            if (s.mode !== "highfive") return;
            if (!s.stdId || !lobbyStdIds.has(s.stdId)) return;

            // 새 패치 이후에는 반드시 같은 판 번호만 사용합니다.
            // 혹시 판 번호가 없는 옛 기록은 45초 조건으로만 임시 허용합니다.
            if (roundId) {
                if (s.highfiveRoundId !== roundId) return;
            } else {
                if (s.timestamp <= thirtySecondsAgo) return;
            }

            if (!uniqueTop[s.stdId] || uniqueTop[s.stdId].score > s.score) {
                uniqueTop[s.stdId] = s;
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
                score: (roomData.endTime ? roomData.endTime : Date.now()) + idx,
                timestamp: Date.now(),
                mode: "highfive",
                highfiveRoundId: roundId
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

    if (hfProcessGuardTimeout) {
        clearTimeout(hfProcessGuardTimeout);
        hfProcessGuardTimeout = null;
    }

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
        currentHighFiveRoundId = null;
        window.latestGroups = [];

        if (hfResultTimeout) {
            clearTimeout(hfResultTimeout);
            hfResultTimeout = null;
        }
        clearInterval(gameTimerInterval);

        // 취소 시에는 학생들의 조 정보를 모두 지워서 개인전 대기실로 확실히 돌립니다.
        try {
            const lobbySnap = await getDocs(collection(db, "lobbyUsers"));
            const clearPromises = [];
            lobbySnap.forEach(docSnap => {
                clearPromises.push(setDoc(docSnap.ref, {
                    groupId: null,
                    score: 0,
                    items: "",
                    attack: null,
                    createdCount: 0,
                    isSubmitted: false
                }, { merge: true }).catch(e => e));
            });
            await Promise.all(clearPromises);
        } catch(e) {
            console.warn("하이파이브 취소 중 학생 조 정보 초기화 실패", e);
        }

        await setDoc(doc(db, "gameData", "multiRoom"), {
            status: "waiting",
            gameMode: "",
            groupingActive: false,
            groupPlayMode: null,
            representatives: null,
            groupCount: null,
            highfiveRoundId: null,
            highfiveCancelledAt: Date.now()
        }, { merge: true });

        alert("❌ 조편성을 취소하고 학생들도 모두 개인전 대기실로 돌려보냈습니다.");
        showScreen("teacher-lobby-screen");
    } else {
        currentHighFiveRoundId = null;
        currentGameMode = "";
        if (hfResultTimeout) {
            clearTimeout(hfResultTimeout);
            hfResultTimeout = null;
        }
        clearInterval(gameTimerInterval);
        document.getElementById("confetti-canvas").style.display = "none";
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



// =====================================================
// [16] 학생 문제 만들기
// -----------------------------------------------------
// - 교사가 지정한 문항 수/문제 유형 반영
// - 학생별 문제 작성 슬롯
// - 객관식/단답/순서/짝맞추기 문제 작성
// - 제출 및 JR 보상
// =====================================================

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


// =====================================================
// [17] 대기실 상점 / 캐릭터 구매·장착 UI
// -----------------------------------------------------
// - 문제 만들기 중 상점
// - 멀티 대기실 상점 팝업
// - 캐릭터 구매/장착
// - 게임 시작 시 상점 자동 닫힘
// =====================================================

function renderInlineShop(targetListId = "inline-shop-list") {
    const shopContainer = document.getElementById(targetListId);
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

          try {
            if (currentUser.ownedCharacters?.includes(charFolder)) {
              const ok = await equipOwnedCharacter(charFolder);
              if (!ok) return;

              alert(`[${charName}] 캐릭터를 장착하고 서버에 저장했습니다!`);
              renderInlineShop(targetListId);
              return;
            }

            const confirmed = confirm(
              `[${charName}] 캐릭터를 2000 JR에 구매하시겠습니까?\n` +
              `(현재 내 JR: ${currentUser.jr} JR)`
            );
            if (!confirmed) return;

            const result = await purchaseAndEquipCharacter({
              charFolder,
              charName,
              creatorName,
              price: 2000
            });
            if (!result) return;

            alert(
              result.alreadyOwned
                ? `[${charName}]은 이미 보유 중이어서 추가 결제 없이 장착했습니다.`
                : `🎉 구매 성공! [${charName}] 캐릭터를 장착하고 서버 저장까지 확인했습니다!`
            );

            renderInlineShop(targetListId);
          } catch (error) {
            console.error("[인라인 상점] 구매/장착 실패:", error);

            if (error?.code === "JR_NOT_ENOUGH" || error?.message === "JR_NOT_ENOUGH") {
              alert("JR이 부족합니다! 게임을 플레이하여 JR을 더 모아오세요.");
            } else {
              alert(
                "캐릭터 정보를 서버에 저장하지 못했습니다.\n" +
                "결제 완료로 처리하지 않았습니다.\n\n" +
                (error?.message || error)
              );
            }

            renderInlineShop(targetListId);
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
// 🛒 [멀티 대기실 상점]
// 문제 만들기 대기 화면의 인라인 상점을 학생 멀티 대기실에서도 팝업으로 재사용합니다.
function ensureLobbyShopButtonAndModal() {
  const existingButton = document.getElementById("lobby-show-shop-btn");
  if (existingButton) {
    existingButton.onclick = () => { playSound("click"); openCharacterShopModal(); };
    return;
  }

  const repairBtn = document.getElementById("lobby-repair-btn");
  const targetBox = repairBtn ? repairBtn.parentElement : null;

  const shopBtn = document.createElement("button");
  shopBtn.id = "lobby-show-shop-btn";
  shopBtn.innerText = "상점 보기";

  if (targetBox) {
    targetBox.appendChild(shopBtn);
  }

  shopBtn.onclick = () => {
    playSound("click");
    openCharacterShopModal();
  };
}


// =====================================================
// [18] 학생 출제 세트 게임
// -----------------------------------------------------
// - 학생들이 만든 문제로 무한 퀴즈 진행
// - 객관식/단답/순서/짝맞추기 풀이
// - 단답형 정답 정규화
// - 오답률 기록
// - 조별/개인 점수 반영
// =====================================================

let ciCurrentProb = null;

// 🚀 단답형 정답 비교용: 대소문자, 문장부호, 특수문자 차이는 무시합니다.
// 예) "I have a dog." = "i have a dog" = "I have a dog!"
function normalizeShortAnswer(text) {
  return normalizeShortAnswerCore(text);
}

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
  window.currentCiWordEnKey = wordObj.en; // 🚀 [오답률 패치] 현재 풀고 있는 문제 기억하기!
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
      btn.onclick = () => handleCiAnswer(normalizeShortAnswer(inp.value) === normalizeShortAnswer(ciCurrentProb.a), ciCurrentProb.a);
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

    // 🚀 [오답률 패치] 맞춤/틀림 실시간 기록 엔진
    if (window.currentCiWordEnKey) {
        let key = window.currentCiWordEnKey;
        if (!window.myProblemStats) window.myProblemStats = {};
        if (!window.myProblemStats[key]) window.myProblemStats[key] = { total: 0, wrong: 0 };
        window.myProblemStats[key].total++;
        if (!isCorrect) window.myProblemStats[key].wrong++;
        window.syncScoreToServer(); // 기록 즉시 서버 전송 예약
    }

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
        try {
            // 1. 교사 화면의 로컬 상태도 즉시 개인전으로 리셋
            currentGroupingActive = false;
            currentMultiRoomGroupPlayMode = null;
            currentMultiRoomRepresentatives = null;

            // 2. 방 상태를 더 확실하게 개인전/대기 상태로 리셋
            await setDoc(doc(db, "gameData", "multiRoom"), {
                status: "waiting",
                groupingActive: false,
                groupPlayMode: null,
                representatives: null,
                groupCount: null
            }, { merge: true });
            
            // 3. 접속 중인 모든 학생의 소속 조(groupId)를 끝까지 기다려서 삭제
            const snap = await getDocs(collection(db, "lobbyUsers"));
            const disbandPromises = [];
            snap.forEach(d => {
                disbandPromises.push(
                    setDoc(doc(db, "lobbyUsers", d.id), { groupId: null }, { merge: true }).catch(e => e)
                );
            });
            await Promise.all(disbandPromises);

            // 4. 교사 화면도 즉시 개인전 형태로 다시 그림
            window.globalLobbyPlayers = (window.globalLobbyPlayers || []).map(p => ({ ...p, groupId: null }));
            renderTeacherVisualLobby(window.globalLobbyPlayers);

            const btn = document.getElementById("teacher-disband-group-btn");
            if (btn) btn.style.display = "none";

            alert("모든 조편성이 확실히 해제되었습니다! 이제 개인전으로 게임을 진행할 수 있습니다.");
        } catch(e) {
            console.error("조편성 해제 실패", e);
            alert("조편성 해제 중 오류가 발생했습니다. 전체 대기실 초기화를 한 번 눌러 주세요.");
        }
    }
});


// =====================================================
// [19] 캐릭터 쇼케이스
// -----------------------------------------------------
// - 교사가 캐릭터를 선택해 전체 학생에게 보여주기
// - 쇼케이스 종료 후 대기실 복귀
// - 조별 one-player 화면 가리개와 충돌하지 않도록 분리
// =====================================================


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
    // 🛡️ 쇼케이스는 관전 가리개와 무관하므로, 이전 조별 게임의 화면 가리개가 남아 있으면 즉시 닫습니다.
    const blockerOverlay = document.getElementById("group-blocker-overlay");
    if (blockerOverlay) blockerOverlay.style.display = "none";

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

                      try {
                        const result = await purchaseAndEquipCharacter({
                          charFolder,
                          charName,
                          creatorName,
                          price: 1000
                        });
                        if (!result) return;

                        alert(
                          result.alreadyOwned
                            ? `[${charName}]은 이미 보유 중이어서 추가 결제 없이 장착했습니다.`
                            : `🎉 반값 할인 구매 성공! [${charName}] 획득 및 장착 완료!\n서버 저장까지 확인했습니다.`
                        );

                        actionContainer.innerHTML =
                          `<div style="color: #4CAF50; font-weight: bold; font-size: 20px; padding: 15px; border: 2px dashed #4CAF50; border-radius: 10px;">구매 및 장착 완료!</div>`;
                        fireConfetti();
                      } catch (error) {
                        console.error("[쇼케이스] 구매 실패:", error);

                        if (error?.code === "JR_NOT_ENOUGH" || error?.message === "JR_NOT_ENOUGH") {
                          alert("JR이 부족합니다!");
                        } else {
                          alert(
                            "캐릭터 구매 정보를 서버에 저장하지 못했습니다.\n" +
                            "결제 완료로 처리하지 않았습니다.\n\n" +
                            (error?.message || error)
                          );
                        }
                      }
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


// =====================================================
// [20] 보스전
// -----------------------------------------------------
// - 보스 등장/공격/피격/사망 애니메이션
// - 학생 점수를 데미지로 반영
// - 보스 HP 계산
// - 보스전 결과 화면
// - 교사 확인 후 학생 대기실 복귀
// =====================================================


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
                // 🚀 [보스전 의문사 방지 픽스 1] 
                // 이 장부에 기록되지 않은 학생이 도중에 발견되거나 늦게 접속한 경우, 
                // 그 학생이 들고 있던 기존 점수가 보스에게 핵폭탄 데미지로 박히는 버그를 원천 차단합니다!
                if (previousPlayerScores[p.stdId] === undefined) {
                    previousPlayerScores[p.stdId] = p.score || 0;
                    return; // 첫 틱은 점수를 장부에 기록(동기화)만 하고 보스 타격 계산은 패스!
                }

                const prev = previousPlayerScores[p.stdId] || 0;
                const curr = p.score || 0;
                
                // 🚀 [보스전 의문사 방지 픽스 2]
                // 학생이 게임 도중 새로고침을 해서 점수가 잠시 0점이 되었을 때, 
                // 장부가 0점으로 갱신되어 다음 문제 맞췄을 때 데미지가 폭발하는 현상을 방지합니다.
                if (curr < prev && curr === 0) return;

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

// 🚀 [크롬북 메모리 폭발 방지] 전역 변수에 타이머를 담아 게임 종료 시 확실하게 파괴할 수 있게 묶어둡니다.
    if (window.bossEffectInterval) clearInterval(window.bossEffectInterval);
    
    window.bossEffectInterval = setInterval(() => {
        if (isBossDefeated || !window.isTeacherBossMatchRunning) { clearInterval(window.bossEffectInterval); return; }
        
        // 🚀 [핵심 렉 픽스] 밀려있는 데미지가 있다면 한 틱당 최대 6개씩 묶어서 다발로 쏟아냅니다! (처리 속도 600% 향상)
        let processCount = Math.min(bossDamageQueue.length, 6);
        if (processCount > 0) {
            for(let i=0; i<processCount; i++) {
                const hit = bossDamageQueue.shift();
                spawnDamageFloater(hit.amount, hit.name);
            }
            
            const spriteEl = document.getElementById("boss-sprite");
            spriteEl.classList.remove("boss-hit-anim");
            void spriteEl.offsetWidth;
            spriteEl.classList.add("boss-hit-anim");
            
            playBossAnimation("hurt", 100, false);
            setTimeout(() => { if(!isBossDefeated) playBossAnimation("idle", 150, true); }, 400);
            
            const hits = ["boss_hit_1", "boss_hit_2", "boss_hit_3"];
            playBossSound(hits[Math.floor(Math.random() * hits.length)]); 
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
    if (window.bossEffectInterval) clearInterval(window.bossEffectInterval); // 🚀 [좀비 타이머 파괴] 데미지 출력 타이머 완벽 소각!
    bossDamageQueue = []; // 🚀 대기 중이던 타격 데이터도 전부 소각!
    
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
// ==========================================
// 🚀 [신규 기능 - 불사조 버튼 완벽 픽스판] 학생 출제 문제 오답률 분석 엔진
// ==========================================

// 1. 오답률 랭킹 및 확대 모달창 HTML 주입 (모달창은 화면 최상단에 안전하게 붙입니다)
setTimeout(() => {
    if (!document.getElementById("teacher-analysis-modal")) {
        const modalHtml = `
        <div id="teacher-analysis-modal" style="display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.8); z-index: 100000; flex-direction: column; align-items: center; justify-content: center; padding: 20px; box-sizing: border-box;">
          <div style="background: white; border: 4px solid #9C27B0; border-radius: 20px; width: 100%; max-width: 800px; height: 80vh; display: flex; flex-direction: column; overflow: hidden; box-shadow: 0 15px 30px rgba(0,0,0,0.3);">
            <div style="background: #9C27B0; color: white; padding: 15px 20px; font-size: 22px; font-weight: bold; display: flex; justify-content: space-between; align-items: center;">
              <span>📊 학생 출제 문제 오답률 랭킹</span>
              <button onclick="document.getElementById('teacher-analysis-modal').style.display='none'" style="background: transparent; border: none; color: white; font-size: 28px; cursor: pointer;">✖</button>
            </div>
            <div id="analysis-list-container" style="flex: 1; overflow-y: auto; padding: 20px; background: #F3E5F5; display: flex; flex-direction: column; gap: 12px;"></div>
          </div>
        </div>

        <div id="teacher-problem-detail-modal" style="display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.85); z-index: 100001; flex-direction: column; align-items: center; justify-content: center; padding: 20px; box-sizing: border-box; backdrop-filter: blur(5px);">
          <div style="background: white; border: 5px solid #FF9800; border-radius: 20px; width: 100%; max-width: 650px; padding: 40px 30px; text-align: center; box-shadow: 0 15px 40px rgba(0,0,0,0.5); position: relative;">
            <button onclick="document.getElementById('teacher-problem-detail-modal').style.display='none'" style="position: absolute; top: 15px; right: 20px; background: transparent; border: none; font-size: 30px; color: #888; cursor: pointer;">✖</button>
            <div id="detail-author" style="font-size: 18px; color: #E91E63; font-weight: bold; margin-bottom: 20px; background: #FCE4EC; display: inline-block; padding: 8px 20px; border-radius: 20px; border: 2px dashed #F06292;">만든이 정보</div>
            <div id="detail-question" style="font-size: 32px; font-weight: 900; color: #333; margin-bottom: 30px; word-break: keep-all; line-height: 1.4;">질문 내용</div>
            <div id="detail-answer" style="font-size: 24px; color: #4CAF50; font-weight: bold; background: #E8F5E9; padding: 15px; border-radius: 15px; border: 2px solid #81C784;">정답 내용</div>
            <div id="detail-stats" style="margin-top: 25px; font-size: 18px; font-weight: bold; color: #555; background: #eee; padding: 10px; border-radius: 10px;">오답률: 0%</div>
          </div>
        </div>
        `;
        document.body.insertAdjacentHTML('beforeend', modalHtml);
    }
}, 1500);


// =====================================================
// [21] 학생 출제 문제 오답 분석
// -----------------------------------------------------
// - 학생 출제 세트의 문제별 오답률 분석
// - 만든이/정답/시도 횟수/오답 횟수 표시
// - 교사용 분석 버튼 자동 복구
// =====================================================

window.openProblemAnalysis = function() {
    if(typeof playSound === "function") playSound("click");
    const container = document.getElementById("analysis-list-container");
    container.innerHTML = "<h3 style='text-align:center; color:#666;'>데이터를 취합 중입니다...🔍</h3>";
    document.getElementById("teacher-analysis-modal").style.display = "flex";

    let aggregatedStats = {};
    if (window.globalLobbyPlayers) {
        window.globalLobbyPlayers.forEach(p => {
            if (p.problemStats) {
                for (let key in p.problemStats) {
                    if (!aggregatedStats[key]) aggregatedStats[key] = { total: 0, wrong: 0 };
                    aggregatedStats[key].total += p.problemStats[key].total;
                    aggregatedStats[key].wrong += p.problemStats[key].wrong;
                }
            }
        });
    }

    let analysisList = [];
    const currentSetId = document.getElementById("teacher-game-set-select")?.value;
    const currentSet = wordSets.find(s => s.id === currentSetId);
    const targetWordList = currentSet ? currentSet.words : [];

    if(targetWordList && targetWordList.length > 0) {
        targetWordList.forEach(w => {
            let stats = aggregatedStats[w.en];
            if (stats && stats.total > 0) {
                let rate = Math.round((stats.wrong / stats.total) * 100);
                let probData = {};
                try { probData = JSON.parse(w.en); } catch(e) {}
                
                let answerText = "";
                if (probData.type === "multiple" || probData.type === "short") answerText = probData.a;
                else if (probData.type === "order") answerText = probData.words ? probData.words.join(" ") : "";
                else if (probData.type === "match") answerText = probData.pairs ? probData.pairs.map(p => `${p.a} ↔ ${p.b}`).join(" / ") : "";

                analysisList.push({
                    author: w.author || "작자 미상",
                    question: probData.q || "알 수 없는 문제",
                    answer: answerText,
                    total: stats.total,
                    wrong: stats.wrong,
                    rate: rate
                });
            }
        });
    }

    analysisList.sort((a, b) => b.rate - a.rate || b.wrong - a.wrong);

    container.innerHTML = "";
    if (analysisList.length === 0) {
        container.innerHTML = "<div style='text-align:center; padding: 30px; font-size: 20px; color: #666;'>이번 게임에서 학생들이 문제를 푼 기록(데이터)이 아직 실시간으로 반영되지 않았거나 없습니다.</div>";
        return;
    }

    analysisList.forEach((item, idx) => {
        let color = item.rate >= 50 ? "#F44336" : (item.rate >= 20 ? "#FF9800" : "#4CAF50");
        const div = document.createElement("div");
        div.style.cssText = "background: white; border: 3px solid #ddd; border-radius: 15px; padding: 15px; display: flex; justify-content: space-between; align-items: center; cursor: pointer; transition: 0.2s;";
        div.onmouseover = () => div.style.borderColor = "#9C27B0";
        div.onmouseout = () => div.style.borderColor = "#ddd";
        
        div.innerHTML = `
            <div style="flex: 1; text-align: left; padding-right: 15px;">
                <div style="font-size: 13px; color: #E91E63; font-weight: bold; margin-bottom: 5px;">${item.author}</div>
                <div style="font-size: 18px; color: #333; font-weight: bold; line-height: 1.3; word-break: keep-all;">Q. ${item.question}</div>
            </div>
            <div style="text-align: right; min-width: 110px;">
                <div style="font-size: 28px; font-weight: 900; color: ${color};">${item.rate}%</div>
                <div style="font-size: 12px; color: #666; font-weight: bold;">오답: ${item.wrong} / ${item.total}</div>
            </div>
        `;
        
        div.onclick = () => {
            if(typeof playSound === "function") playSound("pop");
            document.getElementById("detail-author").innerText = item.author;
            document.getElementById("detail-question").innerText = "Q. " + item.question;
            document.getElementById("detail-answer").innerText = "정답: " + item.answer;
            document.getElementById("detail-stats").innerText = `🔥 오답률: ${item.rate}% (총 ${item.total}번 시도 중 ${item.wrong}번 오답)`;
            document.getElementById("teacher-problem-detail-modal").style.display = "flex";
        };
        container.appendChild(div);
    });
};

// 3. 버튼 렌더링 및 자동 복구 엔진 (innerText 파괴 방어막)
setInterval(() => {
    let btn = document.getElementById("open-analysis-btn");
    const titleContainer = document.getElementById("teacher-viewer-title");
    
    // 🚀 [핵심 픽스 1: 불사조 로직] 제목이 바뀌면서 버튼이 날아가면, 제목 글자 '바깥'에 버튼을 새로 만들어서 붙입니다!
    if (!btn && titleContainer && titleContainer.parentElement) {
        btn = document.createElement("button");
        btn.id = "open-analysis-btn";
        btn.innerHTML = "📊 학생출제 문제 분석";
        // 위치를 타이머 바로 왼쪽으로 예쁘게 띄워줍니다.
        btn.style.cssText = "display: none; background: #E91E63; color: white; border: none; border-radius: 8px; padding: 6px 15px; font-size: 15px; font-weight: bold; cursor: pointer; box-shadow: 0 4px 0 #C2185B; margin-left: auto; margin-right: 15px; vertical-align: middle; animation: popIn 0.3s ease-out;";
        btn.onclick = window.openProblemAnalysis;
        
        // 제목 안(appendChild)이 아니라 제목 '옆(동생)'으로 붙여서 절대 지워지지 않게 만듭니다!
        titleContainer.parentElement.insertBefore(btn, titleContainer.nextSibling);
    }

    if (btn && window.teacherLobbyStatus === "waiting") {
        const currentSetId = document.getElementById("teacher-game-set-select")?.value;
        const currentSet = wordSets.find(s => s.id === currentSetId);
        
        // 🚀 [핵심 픽스 2: 무조건 띄우기] 선택된 세트가 '학생 출제' 세트라면 데이터 유무, 강제종료 여부 안 따지고 무조건 띄웁니다!
        const isCustomMode = currentSet && currentSet.isCustomSet;
        if (isCustomMode) {
            btn.style.display = "inline-block";
        } else {
            btn.style.display = "none";
        }
    } else if (btn) {
        btn.style.display = "none";
    }
}, 1000);
