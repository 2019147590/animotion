const assert = require("node:assert/strict");
const http = require("node:http");
const tests = [];

function test(name, fn) {
  tests.push({ name, fn });
}

function loadServer() {
  delete globalThis.Animotion;
  delete require.cache[require.resolve("../scripts/hidden-completion-provider-server.js")];
  return require("../scripts/hidden-completion-provider-server.js");
}

test("provider server fails clearly when STABILITY_API_KEY is missing", async () => {
  const server = loadServer();
  await assert.rejects(
    () => server.runGeneration(globalThis.Animotion, payload(), { env: {}, fetchImpl: async () => okStabilityResponse() }),
    /missing Stability API key in STABILITY_API_KEY/
  );
});

test("provider server rejects apiKey in providerConfig", async () => {
  const server = loadServer();
  await assert.rejects(
    () => server.runGeneration(globalThis.Animotion, payload({ providerConfig: { apiKey: "secret" } }), {
      env: { STABILITY_API_KEY: "env-secret" },
      fetchImpl: async () => okStabilityResponse(),
    }),
    /providerConfig.apiKey is not accepted/
  );
});

test("provider server calls Stability with env key and returns normalized result", async () => {
  const server = loadServer();
  let authorization = "";
  const result = await server.runGeneration(globalThis.Animotion, payload(), {
    env: { STABILITY_API_KEY: "env-secret" },
    fetchImpl: async (_url, init) => {
      authorization = init.headers.Authorization;
      return okStabilityResponse({ image: "abc", seed: 9, finish_reason: "SUCCESS" });
    },
  });
  assert.equal(authorization, "Bearer env-secret");
  assert.equal(result.provider, "stability-image-edit");
  assert.equal(result.imageBase64, "abc");
  assert.equal(result.provenance, undefined);
});

test("provider server rejects source mask mismatch before Stability call", async () => {
  const server = loadServer();
  let called = false;
  await assert.rejects(
    () => server.runGeneration(globalThis.Animotion, payload({ maskImage: imagePayload(19, 20) }), {
      env: { STABILITY_API_KEY: "env-secret" },
      fetchImpl: async () => {
        called = true;
        return okStabilityResponse();
      },
    }),
    /dimensions must match/
  );
  assert.equal(called, false);
});

test("provider server exposes a local HTTP generation endpoint", async () => {
  const serverModule = loadServer();
  const server = serverModule.createHiddenCompletionProviderServer({
    env: { STABILITY_API_KEY: "env-secret" },
    fetchImpl: async () => okStabilityResponse({ image: "abc", seed: 4, finish_reason: "SUCCESS" }),
  });
  const port = await listen(server);
  try {
    const response = await postJson(`http://127.0.0.1:${port}${serverModule.DEFAULT_PATH}`, payload());
    assert.equal(response.status, 200);
    assert.equal(response.body.provider, "stability-image-edit");
    assert.equal(response.body.imageBase64, "abc");
  } finally {
    await close(server);
  }
});

test("provider server allows common local static app origins", async () => {
  const serverModule = loadServer();
  const server = serverModule.createHiddenCompletionProviderServer({
    env: { STABILITY_API_KEY: "env-secret" },
    fetchImpl: async () => okStabilityResponse(),
  });
  const port = await listen(server);
  try {
    const response = await postJson(`http://127.0.0.1:${port}${serverModule.DEFAULT_PATH}`, payload(), {
      Origin: "http://localhost:5500",
    });
    assert.equal(response.status, 200);
    assert.equal(response.headers["access-control-allow-origin"], "http://localhost:5500");
  } finally {
    await close(server);
  }
});

function payload(patch = {}) {
  return {
    request: requestPayload(),
    sourceImage: imagePayload(20, 20),
    maskImage: imagePayload(20, 20),
    providerConfig: {
      apiKeyEnvName: "STABILITY_API_KEY",
      outputFormat: "png",
      promptVersion: "stability-hidden-completion-v1",
    },
    ...patch,
  };
}

function requestPayload() {
  return {
    task: "hidden_completion",
    requestId: null,
    promptVersion: "stability-hidden-completion-v1",
    patchAssetId: "hidden-leg",
    sourcePartId: "part-leg",
    sourceRectNormalized: { xNorm: 0.1, yNorm: 0.2, wNorm: 0.5, hNorm: 0.4, coordinateSpace: "normalized-image" },
    maskVerticesNormalized: [{ xNorm: 0, yNorm: 0, coordinateSpace: "part-local-normalized" }],
    guide: { meshVerticesNormalized: [], meshFaces: [], silhouetteVerticesNormalized: [] },
    patchTransform: { coordinateSpace: "part-local", translationNormalized: { xNorm: 0, yNorm: 0, coordinateSpace: "part-local-normalized" }, scaleX: 1, scaleY: 1, rotation: 0 },
    intent: { mode: "extend_same_part", preserveStyle: true, preserveLineArt: true, avoidNewDesign: true },
    provenance: { provider: null, modelId: null, modelLicense: null },
    warnings: [],
  };
}

function imagePayload(width, height) {
  return { width, height, imageBase64: "iVBORw0KGgo=", mimeType: "image/png" };
}

function okStabilityResponse(body = { image: "abc", seed: 1, finish_reason: "SUCCESS" }) {
  return {
    status: 200,
    headers: { get: () => "application/json" },
    json: async () => body,
    text: async () => JSON.stringify(body),
  };
}

function listen(server) {
  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => resolve(server.address().port));
  });
}

function close(server) {
  return new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
}

function postJson(url, body, headers = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request(url, { method: "POST", headers: { "Content-Type": "application/json", ...headers } }, (res) => {
      let data = "";
      res.setEncoding("utf8");
      res.on("data", (chunk) => { data += chunk; });
      res.on("end", () => resolve({ status: res.statusCode, headers: res.headers, body: JSON.parse(data) }));
    });
    req.on("error", reject);
    req.end(JSON.stringify(body));
  });
}

(async () => {
  for (const { name, fn } of tests) {
    try {
      await fn();
      console.log(`PASS ${name}`);
    } catch (error) {
      console.error(`FAIL ${name}`);
      throw error;
    }
  }
})();
