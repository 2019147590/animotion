const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const tests = [];

function test(name, fn) {
  tests.push({ name, fn });
}

function loadAnimotion() {
  const context = { window: { Animotion: {} }, Blob, FormData, Uint8Array, Buffer };
  vm.createContext(context);
  for (const path of [
    "scripts/coordinate-spaces.js",
    "scripts/hidden-completion-coverage-bounds.js",
    "scripts/hidden-completion-assets.js",
    "scripts/hidden-completion-request.js",
    "scripts/hidden-completion-prompt.js",
    "scripts/hidden-completion-result.js",
    "scripts/hidden-completion-provider.js",
    "scripts/hidden-completion-stability-provider.js",
  ]) runScript(context, path);
  return context.window.Animotion;
}

function runScript(context, path) {
  vm.runInContext(fs.readFileSync(path, "utf8"), context, { filename: path });
}

test("Stability provider fails clearly when STABILITY_API_KEY is missing", async () => {
  const Animotion = loadAnimotion();
  const provider = Animotion.hiddenCompletionStabilityProvider.createStabilityImageEditProvider({
    env: {},
    fetchImpl: async () => okImageResponse(),
  });
  await assert.rejects(
    () => runProvider(Animotion, provider, {}),
    /missing Stability API key in STABILITY_API_KEY/
  );
});

test("Stability provider honors providerConfig apiKeyEnvName", async () => {
  const Animotion = loadAnimotion();
  let authorization = "";
  const provider = Animotion.hiddenCompletionStabilityProvider.createStabilityImageEditProvider({
    env: { ALT_STABILITY_KEY: "alt-secret" },
    fetchImpl: async (_url, init) => {
      authorization = init.headers.Authorization;
      return okJsonResponse({ image: "abc", seed: 12, finish_reason: "SUCCESS" });
    },
  });
  const result = await runProvider(Animotion, provider, { apiKeyEnvName: "ALT_STABILITY_KEY" });
  assert.equal(authorization, "Bearer alt-secret");
  assert.equal(result.provider, "stability-image-edit");
  assert.equal(result.imageBase64, "abc");
});

test("Stability provider refuses direct apiKey config", async () => {
  const Animotion = loadAnimotion();
  const provider = Animotion.hiddenCompletionStabilityProvider.createStabilityImageEditProvider({
    env: { STABILITY_API_KEY: "env-secret" },
    fetchImpl: async () => okImageResponse(),
  });
  await assert.rejects(
    () => runProvider(Animotion, provider, { apiKey: "direct-secret" }),
    /environment variable, not providerConfig.apiKey/
  );
});

test("Stability provider keeps request neutral while using providerConfig", async () => {
  const Animotion = loadAnimotion();
  const request = requestPayload(Animotion);
  const before = JSON.stringify(request);
  const provider = Animotion.hiddenCompletionStabilityProvider.createStabilityImageEditProvider({
    env: { STABILITY_API_KEY: "secret" },
    fetchImpl: async () => okImageResponse(),
  });
  await runProvider(Animotion, provider, { endpoint: "https://api.stability.ai/v2beta/stable-image/edit/inpaint", modelId: "custom-model" }, request);
  assert.equal(JSON.stringify(request), before);
  assert.equal(Object.hasOwn(request, "endpoint"), false);
  assert.equal(Object.hasOwn(request, "modelId"), false);
});

test("Stability provider rejects source and mask mismatch before API call", async () => {
  const Animotion = loadAnimotion();
  let called = false;
  const provider = Animotion.hiddenCompletionStabilityProvider.createStabilityImageEditProvider({
    env: { STABILITY_API_KEY: "secret" },
    fetchImpl: async () => {
      called = true;
      return okImageResponse();
    },
  });
  await assert.rejects(
    () => Animotion.hiddenCompletionProvider.runHiddenCompletionProvider({
      provider,
      request: requestPayload(Animotion),
      sourceImage: imageBytes(20, 20),
      maskImage: imageBytes(19, 20),
      providerConfig: {},
    }),
    /dimensions must match/
  );
  assert.equal(called, false);
});

test("Stability response is normalized into HiddenCompletionResult", async () => {
  const Animotion = loadAnimotion();
  let formKeys = [];
  const provider = Animotion.hiddenCompletionStabilityProvider.createStabilityImageEditProvider({
    env: { STABILITY_API_KEY: "secret" },
    fetchImpl: async (_url, init) => {
      formKeys = Array.from(init.body.keys());
      return okJsonResponse({ image: "abc", seed: 7, finish_reason: "SUCCESS" });
    },
  });
  const result = await runProvider(Animotion, provider, {
    modelId: "stable-image-inpaint-test",
    modelLicense: "Stability AI API Terms",
    promptVersion: "stability-hidden-completion-v1",
  });
  assert.deepEqual(formKeys.sort(), ["image", "mask", "output_format", "prompt"].sort());
  assert.equal(result.provider, "stability-image-edit");
  assert.equal(result.modelId, "stable-image-inpaint-test");
  assert.equal(result.modelLicense, "Stability AI API Terms");
  assert.equal(result.imageBase64, "abc");
  assert.equal(result.rawProviderMetadata.promptVersion, "stability-hidden-completion-v1");
});

test("Stability result writer marks patch ready with provenance outside request", async () => {
  const Animotion = loadAnimotion();
  const request = requestPayload(Animotion);
  const provider = Animotion.hiddenCompletionStabilityProvider.createStabilityImageEditProvider({
    env: { STABILITY_API_KEY: "secret" },
    fetchImpl: async () => okJsonResponse({ image: "abc", seed: 7, finish_reason: "SUCCESS" }),
  });
  const result = await runProvider(Animotion, provider, { modelId: "stable-image-inpaint-test" }, request);
  const project = { assets: [patchAsset()] };
  Animotion.hiddenCompletionResult.writeHiddenCompletionResult(project, "hidden-leg", result, {
    inputAssetIds: ["source-image", "hidden-leg"],
    promptVersion: result.rawProviderMetadata.promptVersion,
  });
  const patch = project.assets.find((asset) => asset.id === "hidden-leg");
  assert.equal(patch.patchStatus, "ready");
  assert.equal(patch.renderMode, "generated");
  assert.equal(patch.generatedResult.provenance.provider, "stability-image-edit");
  assert.equal(patch.generatedResult.provenance.modelId, "stable-image-inpaint-test");
  assert.equal(request.provenance.provider, null);
});

function runProvider(Animotion, provider, providerConfig, request = requestPayload(Animotion)) {
  return Animotion.hiddenCompletionProvider.runHiddenCompletionProvider({
    provider,
    request,
    sourceImage: imageBytes(20, 20),
    maskImage: imageBytes(20, 20),
    providerConfig,
  });
}

function requestPayload(Animotion) {
  return Animotion.hiddenCompletionRequest.buildHiddenCompletionRequest({ assets: [patchAsset()] }, "hidden-leg", {
    promptVersion: "stability-hidden-completion-v1",
  });
}

function patchAsset() {
  return {
    id: "hidden-leg",
    type: "hiddenCompletionPatch",
    name: "hidden leg",
    sourcePartId: "part-leg",
    sourceRectNormalized: { xNorm: 0.1, yNorm: 0.2, wNorm: 0.5, hNorm: 0.4 },
    maskVerticesNormalized: [{ x: 0.1, y: 0.2 }, { x: 1.2, y: -0.2 }],
    guide: {
      meshVerticesNormalized: [{ x: 0, y: 0 }, { x: 0.5, y: 1.05 }, { x: 1, y: 1 }],
      meshFaces: [[0, 1, 2]],
      silhouetteVerticesNormalized: [{ x: 0, y: 0 }, { x: 1, y: 1.02 }],
    },
    patchTransform: { x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0 },
    patchStatus: "guide",
  };
}

function imageBytes(width, height) {
  return { width, height, bytes: new Uint8Array([137, 80, 78, 71]), mimeType: "image/png" };
}

function okJsonResponse(body) {
  return {
    status: 200,
    headers: { get: () => "application/json" },
    json: async () => body,
    text: async () => JSON.stringify(body),
  };
}

function okImageResponse() {
  return {
    status: 200,
    headers: { get: () => "image/png" },
    arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer,
    text: async () => "",
  };
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
