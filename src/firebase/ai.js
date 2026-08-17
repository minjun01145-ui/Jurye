import { getFunctions, httpsCallable } from "https://www.gstatic.com/firebasejs/12.16.0/firebase-functions.js";
import { app } from "./firebase.js";
import { gameData } from "./data.js";

const cloudFunctions = getFunctions(app, "us-central1");
const testAiConnectionFunction = httpsCallable(cloudFunctions, "testAiConnection", { timeout: 60000 });
const adminAiChatFunction = httpsCallable(cloudFunctions, "adminAiChat", { timeout: 60000 });

const DEFAULT_AI_SETTINGS = Object.freeze({
  endpoint: "https://api.openai.com/v1/responses",
  model: "gpt-5.6-luna",
  apiFormat: "responses",
  reasoningEffort: "low"
});

let settingsCache = null;

async function getAiSettings(force = false) {
  if (settingsCache && !force) return settingsCache;
  const snapshot = await gameData.get("aiSettings");
  settingsCache = snapshot.exists()
    ? { ...DEFAULT_AI_SETTINGS, ...snapshot.data() }
    : { ...DEFAULT_AI_SETTINGS };
  return settingsCache;
}

async function saveAiSettings(settings) {
  await gameData.save("aiSettings", settings);
  settingsCache = settings;
  return settings;
}

export { testAiConnectionFunction, adminAiChatFunction, getAiSettings, saveAiSettings };
