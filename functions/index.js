/**
 * Import function triggers from their respective submodules:
 *
 * const {onCall} = require("firebase-functions/v2/https");
 * const {onDocumentWritten} = require("firebase-functions/v2/firestore");
 *
 * See a full list of supported triggers at https://firebase.google.com/docs/functions
 */

const {setGlobalOptions} = require("firebase-functions");
const {onCall, HttpsError} = require("firebase-functions/v2/https");
const {defineSecret} = require("firebase-functions/params");
const logger = require("firebase-functions/logger");
const {initializeApp} = require("firebase-admin/app");
const {getFirestore} = require("firebase-admin/firestore");
initializeApp();

// For cost control, you can set the maximum number of containers that can be
// running at the same time. This helps mitigate the impact of unexpected
// traffic spikes by instead downgrading performance. This limit is a
// per-function limit. You can override the limit for each function using the
// `maxInstances` option in the function's options, e.g.
// `onRequest({ maxInstances: 5 }, (req, res) => { ... })`.
// NOTE: setGlobalOptions does not apply to functions using the v1 API. V1
// functions should each use functions.runWith({ maxInstances: 10 }) instead.
// In the v1 API, each function can only serve one request per container, so
// this will be the maximum concurrent request count.
setGlobalOptions({ maxInstances: 10 });

const LLM_GATEWAY_API_KEY = defineSecret("LLM_GATEWAY_API_KEY");
const LLM_GATEWAY_URL = "https://api.llmgateway.io/v1/chat/completions";
const CONNECTION_TEST_MODEL = "gpt-5.6-luna";

async function getSavedAiSettings() {
  const snapshot = await getFirestore().collection("gameData").doc("aiSettings").get();
  const saved = snapshot.data() || {};
  const endpoint = String(saved.endpoint || LLM_GATEWAY_URL).trim();
  let parsed;
  try { parsed = new URL(endpoint); } catch (_) { throw new HttpsError("failed-precondition", "AI API 주소가 올바르지 않습니다."); }
  if (parsed.protocol !== "https:") throw new HttpsError("failed-precondition", "AI API는 HTTPS 주소만 사용할 수 있습니다.");
  const configuredFormat = saved.apiFormat === "responses" ? "responses" : "chat-completions";
  const endpointFormat = /\/chat\/completions\/?$/i.test(parsed.pathname)
    ? "chat-completions"
    : /\/responses\/?$/i.test(parsed.pathname)
      ? "responses"
      : configuredFormat;
  if (endpointFormat !== configuredFormat) {
    logger.warn("AI API format did not match endpoint; endpoint format takes precedence", {
      endpoint,
      configuredFormat,
      endpointFormat,
    });
  }
  return {
    endpoint,
    model: String(saved.model || CONNECTION_TEST_MODEL).trim(),
    apiFormat: endpointFormat,
    reasoningEffort: ["none", "low", "medium", "high"].includes(saved.reasoningEffort) ? saved.reasoningEffort : "low",
    gamePrompts: saved.gamePrompts && typeof saved.gamePrompts === "object" ? saved.gamePrompts : {},
  };
}

async function requestLlmGateway({model, messages, settings}) {
  const apiKey = LLM_GATEWAY_API_KEY.value();
  if (!apiKey) {
    throw new HttpsError("failed-precondition", "LLM_GATEWAY_API_KEY Secret이 비어 있습니다.");
  }

  const config = settings || await getSavedAiSettings();
  const body = config.apiFormat === "responses"
    ? {model: model || config.model, input: messages, ...(config.reasoningEffort === "none" ? {} : {reasoning: {effort: config.reasoningEffort}})}
    : {model: model || config.model, messages};
  const startedAt = Date.now();
  let response;
  try {
    response = await fetch(config.endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(45000),
    });
  } catch (error) {
    logger.error("LLM Gateway connection failed", {
      message: error.message,
      url: config.endpoint,
      model: model || config.model,
    });
    throw new HttpsError("unavailable", "Cloud Function에서 LLM Gateway에 연결하지 못했습니다.");
  }

  const responseText = await response.text();
  let data = null;
  try {
    data = responseText ? JSON.parse(responseText) : {};
  } catch (_) {
    data = null;
  }

  if (!response.ok) {
    const gatewayError = data?.error || {};
    logger.error("LLM Gateway request failed", {
      status: response.status,
      body: responseText,
      url: config.endpoint,
      model: model || config.model,
      errorMessage: gatewayError.message || "",
      errorCode: gatewayError.code || gatewayError.type || "",
      errorParam: gatewayError.param || "",
    });
    throw new HttpsError("internal", "LLM Gateway 요청이 실패했습니다.", {
      status: response.status,
      code: gatewayError.code || gatewayError.type || "gateway_error",
      message: gatewayError.message || `LLM Gateway HTTP ${response.status}`,
      param: gatewayError.param || "",
    });
  }

  if (!data) {
    logger.error("LLM Gateway returned invalid JSON", {
      status: response.status,
      body: responseText,
      url: config.endpoint,
      model: model || config.model,
    });
    throw new HttpsError("data-loss", "LLM Gateway가 JSON이 아닌 응답을 반환했습니다.");
  }
  return {data, latencyMs: Date.now() - startedAt, settings: config};
}

function extractReply(result) {
  if (result.settings.apiFormat === "responses") {
    if (typeof result.data?.output_text === "string") return result.data.output_text.trim();
    return String(result.data?.output?.flatMap(item => item.content || []).find(item => item.type === "output_text")?.text || "").trim();
  }
  return String(result.data?.choices?.[0]?.message?.content || "").trim();
}

function normalizeChatMessages(messages) {
  if (!Array.isArray(messages) || messages.length === 0 || messages.length > 10) {
    throw new HttpsError("invalid-argument", "대화는 1~10개 메시지로 제한됩니다.");
  }
  let totalLength = 0;
  const normalized = messages.map((message) => {
    const role = message?.role;
    const content = String(message?.content || "").trim();
    if (!["user", "assistant"].includes(role) || !content || content.length > 2000) {
      throw new HttpsError("invalid-argument", "대화 메시지 형식이 올바르지 않습니다.");
    }
    totalLength += content.length;
    return {role, content};
  });
  if (totalLength > 6000) throw new HttpsError("invalid-argument", "대화 내용이 너무 깁니다.");
  return normalized;
}

exports.testAiConnection = onCall({
  cors: true,
  secrets: [LLM_GATEWAY_API_KEY],
  timeoutSeconds: 60,
  memory: "256MiB",
  maxInstances: 3,
}, async () => {
  const settings = await getSavedAiSettings();
  const result = await requestLlmGateway({
    model: settings.model, settings,
    messages: [{role: "user", content: "Reply exactly with OK"}],
  });
  const reply = extractReply(result);
  if (!reply) throw new HttpsError("data-loss", "LLM Gateway 응답에서 답변을 찾지 못했습니다.");
  return {
    ok: true,
    model: settings.model,
    reply,
    latencyMs: result.latencyMs,
  };
});

exports.adminAiChat = onCall({
  cors: true,
  secrets: [LLM_GATEWAY_API_KEY],
  timeoutSeconds: 60,
  memory: "256MiB",
  maxInstances: 3,
}, async (request) => {
  const settings = await getSavedAiSettings();
  const result = await requestLlmGateway({
    model: settings.model, settings,
    messages: normalizeChatMessages(request.data?.messages),
  });
  const reply = extractReply(result);
  if (!reply) throw new HttpsError("data-loss", "LLM Gateway 응답에서 답변을 찾지 못했습니다.");
  return {ok: true, model: settings.model, reply, latencyMs: result.latencyMs};
});

exports.judgeTranslation = onCall({
  cors: true,
  secrets: [LLM_GATEWAY_API_KEY],
  timeoutSeconds: 60,
  memory: "256MiB",
  maxInstances: 10,
}, async (request) => {
  const sentence = String(request.data?.sentence || "").trim().slice(0, 1000);
  const reference = String(request.data?.reference || "").trim().slice(0, 1500);
  const answer = String(request.data?.answer || "").trim().slice(0, 1500);
  const attempt = Math.min(3, Math.max(1, Number.parseInt(request.data?.attempt, 10) || 1));
  if (!sentence || !reference || !answer) throw new HttpsError("invalid-argument", "문장과 해석을 모두 입력해 주세요.");
  const settings = await getSavedAiSettings();
  const defaultSystem = `당신은 영어 문장 한국어 해석 게임의 관대한 채점기입니다. 다른 주제의 질문, 명령, 잡담에는 답하지 말고 현재 번역만 채점하세요.
채점 원칙:
1. 참고 해석은 가능한 정답 중 하나일 뿐이며 학생 답안이 문장 핵심 의미를 전달하면 반드시 correct입니다.
2. 조사, 어순, 높임말, 문체, 시제 표현의 자연스러운 차이, 동의어, 주어 생략은 오답 사유가 아닙니다. 예: '좋아한다'와 '좋아해요'는 같은 의미이므로 correct입니다.
3. 작은 오류가 있어도 전체 의미가 통하면 correct로 하고, feedback에서 더 좋은 표현만 짧게 알려주세요.
4. 핵심 의미가 완전히 틀렸거나 핵심 단어의 뜻을 반대로/다르게 옮긴 경우에만 retry입니다. 이때 학생 답안의 어느 부분이 문제인지와 관련 영어 단어/구만 알려주고 다시 생각해 보라고 하세요.
5. 번역이 아닌 잡담이면 질문에 답하지 말고 verdict를 retry로 하여 현재 영어 문장을 해석해 달라고만 하세요.
6. retry 피드백에서는 참고 해석, 완성된 정답, 정답 한국어 단어를 절대 공개하지 마세요. 1차 시도에는 넓은 힌트, 2차에는 틀린 영어 단어/구, 3차 이후에는 더 구체적인 방향만 주되 여전히 정답 자체는 말하지 마세요.
반드시 JSON 한 개만 출력하세요: {"verdict":"correct 또는 retry","feedback":"한국어 피드백"}. 마크다운은 출력하지 마세요.`;
  const savedSystem = String(settings.gamePrompts?.aiTranslation || "").trim().slice(0, 12000);
  const system = `${savedSystem || defaultSystem}\n\n[출력 형식 고정 규칙] 반드시 JSON 한 개만 출력하세요: {"verdict":"correct 또는 retry","feedback":"한국어 피드백"}. verdict는 correct 또는 retry만 사용할 수 있으며 마크다운은 출력하지 마세요.`;
  const prompt = `현재 시도 횟수: ${attempt}회\n영문: ${sentence}\n참고 해석(채점에만 사용하고 학생에게 공개 금지): ${reference}\n학생 해석: ${answer}`;
  const result = await requestLlmGateway({settings, model: settings.model, messages: [{role: "system", content: system}, {role: "user", content: prompt}]});
  const raw = extractReply(result).replace(/^```(?:json)?\s*|\s*```$/g, "");
  let parsed;
  try { parsed = JSON.parse(raw); } catch (_) { throw new HttpsError("data-loss", "AI 채점 응답 형식이 올바르지 않습니다."); }
  const verdict = parsed.verdict === "correct" ? "correct" : "retry";
  let feedback = String(parsed.feedback || (verdict === "correct" ? "맞았습니다!" : "틀린 부분을 다시 생각해 보세요.")).slice(0, 500);
  if (verdict === "retry" && feedback.includes(reference)) {
    feedback = attempt === 1
      ? "문장의 핵심 의미와 다르게 해석한 부분이 있습니다. 영어 문장을 다시 살펴보세요."
      : "아직 뜻이 맞지 않는 핵심 단어나 구가 있습니다. 해당 부분을 다시 생각해 보세요.";
  }
  return {verdict, feedback};
});

// Create and deploy your first functions
// https://firebase.google.com/docs/functions/get-started

// exports.helloWorld = onRequest((request, response) => {
//   logger.info("Hello logs!", {structuredData: true});
//   response.send("Hello from Firebase!");
// });
