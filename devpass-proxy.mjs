// Local-only development proxy for testing OpenAI-compatible gateways from the browser.
// Do not expose this server to a network or deploy it as-is.
import http from "node:http";

const PORT = Number(process.env.DEVPASS_PROXY_PORT || 8787);
const ALLOWED_ORIGINS = new Set([
  "http://localhost:8000",
  "http://127.0.0.1:8000",
  "http://localhost:8787",
  "http://127.0.0.1:8787"
]);

function setCorsHeaders(request, response) {
  const origin = request.headers.origin;
  if (origin && ALLOWED_ORIGINS.has(origin)) response.setHeader("Access-Control-Allow-Origin", origin);
  response.setHeader("Vary", "Origin");
  response.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  response.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-AI-Target");
}

function sendJson(response, status, body) {
  response.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(body));
}

http.createServer(async (request, response) => {
  setCorsHeaders(request, response);
  if (request.method === "OPTIONS") { response.writeHead(204); response.end(); return; }
  if (request.method === "GET" && request.url === "/health") { sendJson(response, 200, { ok: true }); return; }
  if (request.method !== "POST" || request.url !== "/ai") { sendJson(response, 404, { error: { message: "Use POST /ai or GET /health." } }); return; }

  const target = String(request.headers["x-ai-target"] || "");
  let targetUrl;
  try {
    targetUrl = new URL(target);
    if (!/^https?:$/.test(targetUrl.protocol)) throw new Error("Unsupported protocol");
  } catch (_) { sendJson(response, 400, { error: { message: "X-AI-Target must be a complete http(s) API URL.", code: "invalid_target" } }); return; }

  const chunks = [];
  let size = 0;
  request.on("data", chunk => {
    size += chunk.length;
    if (size <= 1024 * 1024) chunks.push(chunk);
  });
  request.on("end", async () => {
    if (size > 1024 * 1024) { sendJson(response, 413, { error: { message: "Request body is too large.", code: "payload_too_large" } }); return; }
    try {
      const headers = { "Content-Type": request.headers["content-type"] || "application/json" };
      if (request.headers.authorization) headers.Authorization = request.headers.authorization;
      const upstream = await fetch(targetUrl, { method: "POST", headers, body: Buffer.concat(chunks) });
      const body = await upstream.arrayBuffer();
      const responseHeaders = { "Content-Type": upstream.headers.get("content-type") || "application/json; charset=utf-8" };
      const requestId = upstream.headers.get("x-request-id") || upstream.headers.get("request-id");
      const retryAfter = upstream.headers.get("retry-after");
      if (requestId) responseHeaders["X-Request-Id"] = requestId;
      if (retryAfter) responseHeaders["Retry-After"] = retryAfter;
      response.writeHead(upstream.status, responseHeaders);
      response.end(Buffer.from(body));
    } catch (error) {
      sendJson(response, 502, { error: { message: `Upstream gateway request failed: ${error.message}`, code: "upstream_fetch_failed" } });
    }
  });
}).listen(PORT, "127.0.0.1", () => {
  console.log(`DevPass local proxy listening at http://127.0.0.1:${PORT}`);
});
