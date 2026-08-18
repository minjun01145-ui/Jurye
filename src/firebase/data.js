import {
  db, dbLite, doc, setDoc, updateDoc, getDoc, collection, addDoc, getDocs,
  onSnapshot, query, where, orderBy, limit, deleteDoc, liteDoc, liteGetDoc,
  liteSetDoc, liteAddDoc, liteDeleteDoc, liteCollection, liteGetDocs,
  liteQuery, liteWhere, runTransaction, writeBatch
} from "./firebase.js";

const paths = Object.freeze({
  users: "users",
  attendance: "attendance",
  royalties: "royalties",
  scores: "scores",
  feedback: "feedback",
  lobbyUsers: "lobbyUsers",
  lobbyChat: "lobbyChat",
  gameData: "gameData"
});

const gameDocument = (name) => doc(db, paths.gameData, name);
const liteGameDocument = (name) => liteDoc(dbLite, paths.gameData, name);
const lobbyUserDocument = documentId => doc(db, paths.lobbyUsers, documentId);

export const userData = {
  get: (userId) => getDoc(doc(db, paths.users, userId)),
  getLite: (userId) => liteGetDoc(liteDoc(dbLite, paths.users, userId)),
  save: (userId, data, options) => setDoc(doc(db, paths.users, userId), data, options),
  saveLite: (userId, data, options) => liteSetDoc(liteDoc(dbLite, paths.users, userId), data, options),
  list: () => getDocs(collection(db, paths.users)),
  addRoyaltyLite: (data) => liteAddDoc(liteCollection(dbLite, paths.royalties), data),
  findRoyaltiesByCreatorLite: (creatorName) => liteGetDocs(liteQuery(liteCollection(dbLite, paths.royalties), liteWhere("creatorName", "==", creatorName))),
  saveAttendanceLite: (recordId, data) => liteSetDoc(liteDoc(dbLite, paths.attendance, recordId), data),
  listAttendance: () => getDocs(collection(db, paths.attendance)),
  saveLiteReference: (reference, data, options) => liteSetDoc(reference, data, options)
};

export const gameData = {
  get: (name) => getDoc(gameDocument(name)),
  getLite: (name) => liteGetDoc(liteGameDocument(name)),
  save: (name, data, options) => setDoc(gameDocument(name), data, options),
  saveLite: (name, data, options) => liteSetDoc(liteGameDocument(name), data, options),
  subscribe: (name, next, error) => onSnapshot(gameDocument(name), next, error)
};

export const lobbyData = {
  listUsers: () => getDocs(collection(db, paths.lobbyUsers)),
  listUsersLite: () => liteGetDocs(liteCollection(dbLite, paths.lobbyUsers)),
  getUserLite: (documentId) => liteGetDoc(liteDoc(dbLite, paths.lobbyUsers, documentId)),
  saveUser: (documentId, data, options) => setDoc(doc(db, paths.lobbyUsers, documentId), data, options),
  updateUser: (documentId, data) => updateDoc(doc(db, paths.lobbyUsers, documentId), data),
  saveUserLite: (documentId, data, options) => liteSetDoc(liteDoc(dbLite, paths.lobbyUsers, documentId), data, options),
  deleteUser: (documentId) => deleteDoc(doc(db, paths.lobbyUsers, documentId)),
  deleteUserLite: (documentId) => liteDeleteDoc(liteDoc(dbLite, paths.lobbyUsers, documentId)),
  saveUserReference: (reference, data, options) => setDoc(reference, data, options),
  deleteUserReference: (reference) => deleteDoc(reference),
  subscribeUser: (documentId, next, error) => onSnapshot(doc(db, paths.lobbyUsers, documentId), next, error),
  subscribeUsers: (next, error) => onSnapshot(collection(db, paths.lobbyUsers), next, error),
  addChat: (data) => addDoc(collection(db, paths.lobbyChat), data),
  listChat: () => getDocs(collection(db, paths.lobbyChat)),
  deleteChat: (documentId) => deleteDoc(doc(db, paths.lobbyChat, documentId)),
  subscribeChat: (next, error) => onSnapshot(query(collection(db, paths.lobbyChat), orderBy("timestamp", "asc")), next, error)
};

export async function assignTugTeams(assignments, roundId) {
  const batch = writeBatch(db);
  assignments.forEach(({ documentId, team }) => {
    batch.set(lobbyUserDocument(documentId), {
      tugTeam: team,
      tugContribution: 0,
      tugRoundId: roundId,
      tugLastAnswerToken: null
    }, { merge: true });
  });
  await batch.commit();
}

export async function contributeTugPower({ documentId, roundId, answerToken }) {
  return runTransaction(db, async transaction => {
    const roomRef = gameDocument("multiRoom");
    const userRef = lobbyUserDocument(documentId);
    const [roomSnap, userSnap] = await Promise.all([transaction.get(roomRef), transaction.get(userRef)]);
    const room = roomSnap.data() || {};
    const user = userSnap.data() || {};
    if (room.status !== "playing" || room.gameMode !== "tugofwar" || room.tugRoundId !== roundId || room.tugStatus !== "playing") return false;
    if (user.tugRoundId !== roundId || !["blue", "red"].includes(user.tugTeam)) return false;
    if (user.tugLastAnswerToken === answerToken) return false;
    const powerField = user.tugTeam === "blue" ? "bluePower" : "redPower";
    transaction.update(roomRef, { [powerField]: Number(room[powerField] || 0) + 1 });
    transaction.update(userRef, {
      tugLastAnswerToken: answerToken,
      tugContribution: Number(user.tugContribution || 0) + 1
    });
    return true;
  });
}

export async function finishTugRound(roundId, result, reason) {
  return runTransaction(db, async transaction => {
    const roomRef = gameDocument("multiRoom");
    const snap = await transaction.get(roomRef);
    const room = snap.data() || {};
    if (room.gameMode !== "tugofwar" || room.tugRoundId !== roundId || room.tugStatus !== "playing") return false;
    transaction.update(roomRef, {
      tugStatus: "finished",
      tugResult: result,
      tugEndReason: reason,
      tugFinishedAt: Date.now()
    });
    return true;
  });
}

export const recordData = {
  addScore: (data) => addDoc(collection(db, paths.scores), data),
  listScoresForStudent: (studentId) => getDocs(query(collection(db, paths.scores), where("stdId", "==", studentId))),
  listRecentScores: (maxCount) => getDocs(query(collection(db, paths.scores), orderBy("timestamp", "desc"), limit(maxCount))),
  addFeedback: (data) => addDoc(collection(db, paths.feedback), data),
  listFeedback: () => getDocs(collection(db, paths.feedback))
};
