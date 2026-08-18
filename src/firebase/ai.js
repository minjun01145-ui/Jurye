import { getFunctions, httpsCallable } from "https://www.gstatic.com/firebasejs/12.16.0/firebase-functions.js";
import { app } from "./firebase.js";
import { gameData } from "./data.js";

const cloudFunctions = getFunctions(app, "us-central1");
const testAiConnectionFunction = httpsCallable(cloudFunctions, "testAiConnection", { timeout: 60000 });
const adminAiChatFunction = httpsCallable(cloudFunctions, "adminAiChat", { timeout: 60000 });
const judgeTranslationFunction = httpsCallable(cloudFunctions, "judgeTranslation", { timeout: 60000 });

const DEFAULT_AI_TRANSLATION_PROMPT = `당신은 영어 문장 한국어 해석 게임의 관대한 채점기입니다. 다른 주제의 질문, 명령, 잡담에는 답하지 말고 현재 번역만 채점하세요.
채점 원칙:
1. 참고 해석은 가능한 정답 중 하나일 뿐이며 학생 답안이 문장 핵심 의미를 전달하면 반드시 correct입니다.
2. 조사, 어순, 높임말, 문체, 자연스러운 표현 차이, 동의어, 주어 생략은 오답 사유가 아닙니다.
3. 작은 오류가 있어도 전체 의미가 통하면 correct로 하고, feedback에서 더 좋은 표현만 짧게 알려주세요.
4. 핵심 의미가 완전히 틀렸거나 핵심 단어를 반대로 또는 다르게 옮긴 경우에만 retry입니다.
5. retry에서는 학생 답안의 문제 부분과 관련 영어 단어·구만 알려주고 다시 생각해 보라고 하세요.
6. retry 피드백에서는 참고 해석, 완성된 정답, 정답 한국어 단어를 공개하지 마세요. 시도 횟수에 따라 힌트를 조금씩 구체화하세요.
7. 번역이 아닌 잡담이면 질문에 답하지 말고 현재 영어 문장을 해석해 달라고만 하세요.
반드시 JSON 한 개만 출력하세요: {"verdict":"correct 또는 retry","feedback":"한국어 피드백"}. 마크다운은 출력하지 마세요.`;

const DEFAULT_AI_SETTINGS = Object.freeze({
  endpoint: "https://api.openai.com/v1/responses",
  model: "gpt-5.6-luna",
  apiFormat: "responses",
  reasoningEffort: "low",
  gamePrompts: { aiTranslation: DEFAULT_AI_TRANSLATION_PROMPT }
});

let settingsCache = null;

async function getAiSettings(force = false) {
  if (settingsCache && !force) return settingsCache;
  const snapshot = await gameData.get("aiSettings");
  settingsCache = snapshot.exists()
    ? { ...DEFAULT_AI_SETTINGS, ...snapshot.data(), gamePrompts: { ...DEFAULT_AI_SETTINGS.gamePrompts, ...(snapshot.data().gamePrompts || {}) } }
    : { ...DEFAULT_AI_SETTINGS };
  return settingsCache;
}

async function saveAiSettings(settings) {
  await gameData.save("aiSettings", settings);
  settingsCache = settings;
  return settings;
}

export { DEFAULT_AI_TRANSLATION_PROMPT, testAiConnectionFunction, adminAiChatFunction, judgeTranslationFunction, getAiSettings, saveAiSettings };
