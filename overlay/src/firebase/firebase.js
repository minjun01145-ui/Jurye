import { initializeApp } from "https://www.gstatic.com/firebasejs/12.16.0/firebase-app.js";
import { getAuth, signInAnonymously } from "https://www.gstatic.com/firebasejs/12.16.0/firebase-auth.js";
import { getFirestore, doc, setDoc, updateDoc, getDoc, collection, addDoc, getDocs, onSnapshot, query, where, orderBy, limit, deleteDoc, runTransaction, writeBatch } from "https://www.gstatic.com/firebasejs/12.16.0/firebase-firestore.js";
import { getFirestore as getFirestoreLite, doc as liteDoc, getDoc as liteGetDoc, setDoc as liteSetDoc, addDoc as liteAddDoc, deleteDoc as liteDeleteDoc, collection as liteCollection, getDocs as liteGetDocs, query as liteQuery, where as liteWhere } from "https://www.gstatic.com/firebasejs/12.16.0/firebase-firestore-lite.js";

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
const auth = getAuth(app);

async function ensureFirebaseAuth() {
  if (auth.currentUser) return auth.currentUser;

  try {
    const credential = await signInAnonymously(auth);
    console.info("[Firebase Auth] 익명 인증 준비 완료");
    return credential.user;
  } catch (error) {
    console.error("[Firebase Auth] 익명 인증 실패", error);

    if (error?.code === "auth/operation-not-allowed") {
      const setupError = new Error(
        "Firebase Authentication에서 익명(Anonymous) 로그인을 활성화해야 합니다. " +
        "Firebase Console > Authentication > Sign-in method > Anonymous에서 사용 설정 후 다시 접속하세요."
      );
      setupError.code = error.code;
      setupError.cause = error;
      throw setupError;
    }

    throw error;
  }
}

// 중요: Firestore 인스턴스 및 최초 gameData 읽기를 시작하기 전에 인증 토큰을 확보합니다.
// index.mjs는 이 모듈을 import하므로 top-level await가 끝날 때까지 실행되지 않습니다.
const firebaseAuthReady = ensureFirebaseAuth();
await firebaseAuthReady;

const db = getFirestore(app);
const dbLite = getFirestoreLite(app);

export {
  app, auth, firebaseAuthReady, db, dbLite,
  doc, setDoc, updateDoc, getDoc, collection, addDoc, getDocs,
  onSnapshot, query, where, orderBy, limit, deleteDoc, runTransaction, writeBatch,
  liteDoc, liteGetDoc, liteSetDoc, liteAddDoc, liteDeleteDoc,
  liteCollection, liteGetDocs, liteQuery, liteWhere
};
