import { initializeApp } from "https://www.gstatic.com/firebasejs/12.16.0/firebase-app.js";
import { getFirestore, doc, setDoc, updateDoc, getDoc, collection, addDoc, getDocs, onSnapshot, query, where, orderBy, limit, deleteDoc } from "https://www.gstatic.com/firebasejs/12.16.0/firebase-firestore.js";
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
const db = getFirestore(app);
const dbLite = getFirestoreLite(app);

export { app, db, dbLite, doc, setDoc, updateDoc, getDoc, collection, addDoc, getDocs, onSnapshot, query, where, orderBy, limit, deleteDoc, liteDoc, liteGetDoc, liteSetDoc, liteAddDoc, liteDeleteDoc, liteCollection, liteGetDocs, liteQuery, liteWhere };
