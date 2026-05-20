import { initializeApp } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-app.js";
import { getFirestore, doc, setDoc, getDoc } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-firestore.js";

const firebaseConfig = { /* (기존 내용 유지) */ };
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

let wordSets = []; let studentList = []; 
let currentUser = { stdId: "", nickname: "", emoji: "" };

// 🌟 핵심: 3초 타임아웃을 둔 안전한 DB 로딩
async function safeLoadDB() {
  const authBtn = document.getElementById("auth-btn");
  const msg = document.getElementById("db-msg");
  
  try {
    // 3초 내에 응답이 없으면 에러 발생
    const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout")), 3000));
    const dbPromise = Promise.all([
        getDoc(doc(db, "gameData", "wordSets")),
        getDoc(doc(db, "gameData", "students"))
    ]);

    const [setSnap, stdSnap] = await Promise.race([dbPromise, timeout]);
    
    if (setSnap.exists()) wordSets = setSnap.data().sets || [];
    if (stdSnap.exists()) studentList = stdSnap.data().students || [];
    
    msg.innerText = "서버 연결 성공!";
    msg.style.color = "#00BCD4";
    authBtn.innerText = "[ENTER] 인증하기";
    authBtn.disabled = false;
    authBtn.classList.add("btn-yellow");
    startRoamingEmojis();
  } catch (e) {
    msg.innerText = "연결 실패! 버튼을 눌러 재시도하세요.";
    msg.style.color = "#FF003C";
    authBtn.innerText = "재시도 (새로고침)";
    authBtn.disabled = false;
    authBtn.onclick = () => location.reload();
  }
}

// 🌟 실행 순서 보장
window.onload = safeLoadDB;

// ... (기존의 게임 로직과 동일하게 유지)
