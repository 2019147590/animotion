const http = require("node:http");

const DEFAULT_PORT = 8787;
const DEFAULT_PATH = "/hidden-completion/generate";
const MAX_BODY_BYTES = 24 * 1024 * 1024;
const DEFAULT_ALLOWED_ORIGINS = [
  "http://localhost:8765",
  "http://127.0.0.1:8765",
  "http://localhost:5500",
  "http://127.0.0.1:5500",
];

function loadAnimotionRuntime() {
  const Animotion = globalThis.Animotion || (globalThis.Animotion = {});
  Animotion.hiddenCompletionPrompt = require("./hidden-completion-prompt.js");
  Animotion.hiddenCompletionResult = require("./hidden-completion-result.js");
  Animotion.hiddenCompletionProvider = require("./hidden-completion-provider.js");
  Animotion.hiddenCompletionStabilityProvider = require("./hidden-completion-stability-provider.js");
  return Animotion;
}

function createHiddenCompletionProviderServer(options = {}) {
  const Animotion = options.Animotion || loadAnimotionRuntime();
  const routePath = options.path || DEFAULT_PATH;
  const corsOrigins = allowedOrigins(options);
  const server = http.createServer(async (req, res) => {
    if (req.method === "OPTIONS") return sendCors(req, res, 204, "", "text/plain", corsOrigins);
    if (req.method !== "POST" || urlPath(req.url) !== routePath) return sendJson(req, res, 404, { error: "not_found" }, corsOrigins);
    try {
      const payload = await readJson(req, options.maxBodyBytes || MAX_BODY_BYTES);
      const result = await runGeneration(Animotion, payload, options);
      return sendJson(req, res, 200, serializeResult(result), corsOrigins);
    } catch (error) {
      return sendJson(req, res, error.statusCode || 400, { error: error.message }, corsOrigins);
    }
  });
  return server;
}

async function runGeneration(Animotion, payload, options = {}) {
  Animotion = Animotion || loadAnimotionRuntime();
  validatePayload(payload);
  const providerConfig = sanitizedProviderConfig(payload.providerConfig);
  const provider = Animotion.hiddenCompletionStabilityProvider.createStabilityImageEditProvider({
    env: options.env || process.env,
    fetchImpl: options.fetchImpl || fetch,
  });
  return Animotion.hiddenCompletionProvider.runHiddenCompletionProvider({
    provider,
    request: payload.request,
    sourceImage: payload.sourceImage,
    maskImage: payload.maskImage,
    providerConfig,
  });
}

function validatePayload(payload = {}) {
  if (!payload.request || payload.request.task !== "hidden_completion") throw new Error("hidden completion request is required");
  if (!payload.sourceImage || !payload.maskImage) throw new Error("sourceImage and maskImage are required");
  if (payload.providerConfig?.apiKey) throw new Error("providerConfig.apiKey is not accepted by the local provider server");
}

function sanitizedProviderConfig(config = {}) {
  const { apiKey, ...safeConfig } = config || {};
  return safeConfig;
}

function serializeResult(result) {
  if (!result.imageBytes) return result;
  return {
    ...result,
    imageBase64: Buffer.from(result.imageBytes).toString("base64"),
    imageBytes: null,
  };
}

function readJson(req, maxBytes) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.setEncoding("utf8");
    req.on("data", (chunk) => {
      body += chunk;
      if (Buffer.byteLength(body) > maxBytes) {
        reject(Object.assign(new Error("request body too large"), { statusCode: 413 }));
        req.destroy();
      }
    });
    req.on("end", () => {
      try {
        resolve(JSON.parse(body || "{}"));
      } catch (_error) {
        reject(new Error("request body must be valid JSON"));
      }
    });
    req.on("error", reject);
  });
}

function sendJson(req, res, status, data, corsOrigins) {
  sendCors(req, res, status, JSON.stringify(data), "application/json", corsOrigins);
}

function sendCors(req, res, status, body, contentType = "text/plain", corsOrigins = DEFAULT_ALLOWED_ORIGINS) {
  const origin = req?.headers?.origin;
  const allowedOrigin = corsOrigins.includes(origin) ? origin : corsOrigins[0];
  res.writeHead(status, {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "content-type",
    "Content-Type": contentType,
  });
  res.end(body);
}

function allowedOrigins(options = {}) {
  if (Array.isArray(options.allowedOrigins)) return options.allowedOrigins.map(String).filter(Boolean);
  const value = (options.env || process.env).ANIMOTION_PROVIDER_ALLOWED_ORIGINS;
  return value ? value.split(",").map((origin) => origin.trim()).filter(Boolean) : DEFAULT_ALLOWED_ORIGINS;
}

function urlPath(url = "") {
  return String(url).split("?")[0];
}

function startServer(options = {}) {
  const port = Number(options.port || process.env.ANIMOTION_PROVIDER_PORT || DEFAULT_PORT);
  const server = createHiddenCompletionProviderServer(options);
  server.listen(port, "127.0.0.1", () => {
    console.log(`Animotion hidden completion provider server listening on http://127.0.0.1:${port}${options.path || DEFAULT_PATH}`);
  });
  return server;
}

if (require.main === module) startServer();

module.exports = {
  DEFAULT_PATH,
  DEFAULT_PORT,
  DEFAULT_ALLOWED_ORIGINS,
  createHiddenCompletionProviderServer,
  runGeneration,
  startServer,
};
