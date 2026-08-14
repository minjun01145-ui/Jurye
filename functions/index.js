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

async function requestLlmGateway({model, messages}) {
  const apiKey = LLM_GATEWAY_API_KEY.value();
  if (!apiKey) {
    throw new HttpsError("failed-precondition", "LLM_GATEWAY_API_KEY Secret이 비어 있습니다.");
  }

  const body = {model, messages};
  const startedAt = Date.now();
  let response;
  try {
    response = await fetch(LLM_GATEWAY_URL, {
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
      url: LLM_GATEWAY_URL,
      model,
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
      url: LLM_GATEWAY_URL,
      model,
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
      url: LLM_GATEWAY_URL,
      model,
    });
    throw new HttpsError("data-loss", "LLM Gateway가 JSON이 아닌 응답을 반환했습니다.");
  }
  return {data, latencyMs: Date.now() - startedAt};
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
  const result = await requestLlmGateway({
    model: CONNECTION_TEST_MODEL,
    messages: [{role: "user", content: "Reply exactly with OK"}],
  });
  const reply = String(result.data?.choices?.[0]?.message?.content || "").trim();
  if (!reply) throw new HttpsError("data-loss", "LLM Gateway 응답에서 답변을 찾지 못했습니다.");
  return {
    ok: true,
    model: CONNECTION_TEST_MODEL,
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
  const result = await requestLlmGateway({
    model: CONNECTION_TEST_MODEL,
    messages: normalizeChatMessages(request.data?.messages),
  });
  const reply = String(result.data?.choices?.[0]?.message?.content || "").trim();
  if (!reply) throw new HttpsError("data-loss", "LLM Gateway 응답에서 답변을 찾지 못했습니다.");
  return {ok: true, model: CONNECTION_TEST_MODEL, reply, latencyMs: result.latencyMs};
});

// Create and deploy your first functions
// https://firebase.google.com/docs/functions/get-started

// exports.helloWorld = onRequest((request, response) => {
//   logger.info("Hello logs!", {structuredData: true});
//   response.send("Hello from Firebase!");
// });
