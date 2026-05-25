const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const tests = [];

function test(name, fn) {
  tests.push({ name, fn });
}

function loadAnimotion() {
  const context = { window: { Animotion: {} }, Uint8Array, Buffer };
  vm.createContext(context);
  for (const path of [
    "scripts/coordinate-spaces.js",
    "scripts/hidden-completion-coverage-bounds.js",
    "scripts/hidden-completion-assets.js",
    "scripts/hidden-completion-request.js",
    "scripts/hidden-completion-prompt.js",
    "scripts/hidden-completion-result.js",
    "scripts/hidden-completion-provider.js",
    "scripts/hidden-completion-local-sd-worker-contract.js",
    "scripts/hidden-completion-local-sd-provider.js",
  ]) runScript(context, path);
  return context.window.Animotion;
}

function runScript(context, path) {
  vm.runInContext(fs.readFileSync(path, "utf8"), context, { filename: path });
}

test("local-sd-inpaint provider exists with capabilities", () => {
  const Animotion = loadAnimotion();
  const provider = Animotion.hiddenCompletionLocalSdProvider.createLocalSdInpaintProvider({ fetchImpl: async () => okWorkerResponse() });
  const capabilities = Animotion.hiddenCompletionProvider.capabilitiesFor(provider);
  assert.equal(provider.id, "local-sd-inpaint");
  assert.equal(capabilities.supportsSourceImage, true);
  assert.equal(capabilities.supportsMask, true);
  assert.equal(capabilities.supportsFineTune, false);
});

test("Local SD provider config does not mutate request", async () => {
  const Animotion = loadAnimotion();
  const request = requestPayload(Animotion);
  const before = JSON.stringify(request);
  const provider = localProvider(Animotion, async () => okWorkerResponse({ imageBase64: "abc" }));
  await runProvider(Animotion, provider, {
    endpoint: "http://127.0.0.1:7861/inpaint",
    modelId: "sd-local",
    steps: 20,
    cfgScale: 7,
    strength: 0.65,
    checkpointPath: "models/inpaint.safetensors",
  }, request);
  assert.equal(JSON.stringify(request), before);
  assert.equal(Object.hasOwn(request, "checkpointPath"), false);
  assert.equal(Object.hasOwn(request, "cfgScale"), false);
});

test("Local SD provider requires endpoint", async () => {
  const Animotion = loadAnimotion();
  const provider = localProvider(Animotion, async () => okWorkerResponse());
  await assert.rejects(
    () => runProvider(Animotion, provider, {}),
    /providerConfig.endpoint is required/
  );
});

test("Local SD provider rejects source mask mismatch before worker call", async () => {
  const Animotion = loadAnimotion();
  let called = false;
  const provider = localProvider(Animotion, async () => {
    called = true;
    return okWorkerResponse();
  });
  await assert.rejects(
    () => Animotion.hiddenCompletionProvider.runHiddenCompletionProvider({
      provider,
      request: requestPayload(Animotion),
      sourceImage: imageBytes(20, 20),
      maskImage: imageBytes(19, 20),
      providerConfig: { endpoint: "http://127.0.0.1:7861/inpaint" },
    }),
    /dimensions must match/
  );
  assert.equal(called, false);
});

test("mocked Local SD worker response normalizes into HiddenCompletionResult", async () => {
  const Animotion = loadAnimotion();
  let body = null;
  const provider = localProvider(Animotion, async (_url, init) => {
    body = JSON.parse(init.body);
    return okWorkerResponse({
      imageBase64: "abc",
      modelId: "local-model",
      requestHash: "hash-1",
      rawProviderMetadata: { sampler: "worker-owned" },
    });
  });
  const result = await runProvider(Animotion, provider, {
    endpoint: "http://127.0.0.1:7861/inpaint",
    modelId: "local-model",
    modelLicense: "local model license label",
    promptVersion: "local-sd-hidden-completion-v1",
    negativePrompt: "blurry",
    seed: 0,
    steps: 12,
    guidanceScale: 6.5,
    denoise: 0.55,
  });
  assert.equal(body.task, "hidden_completion_inpaint");
  assert.equal(body.promptVersion, "local-sd-hidden-completion-v1");
  assert.equal(body.negativePrompt, "blurry");
  assert.equal(body.cfgScale, 6.5);
  assert.equal(result.provider, "local-sd-inpaint");
  assert.equal(result.modelId, "local-model");
  assert.equal(result.modelLicense, "local model license label");
  assert.equal(result.imageBase64, "abc");
  assert.equal(result.rawProviderMetadata.sampler, "worker-owned");
});

test("Local SD worker request contract includes images prompt and model params", async () => {
  const Animotion = loadAnimotion();
  let body = null;
  const provider = localProvider(Animotion, async (_url, init) => {
    body = JSON.parse(init.body);
    return okWorkerResponse();
  });
  await runProvider(Animotion, provider, {
    endpoint: "http://127.0.0.1:7861/inpaint",
    modelId: "local-model",
    checkpointPath: "models/inpaint.safetensors",
    workflowPath: "workflows/inpaint.json",
    width: 512,
    height: 512,
    steps: 16,
    cfgScale: 7,
    strength: 0.6,
    seed: 4,
    negativePrompt: "blurry",
  });
  assert.equal(typeof body.imageBase64, "string");
  assert.equal(typeof body.maskBase64, "string");
  assert.equal(body.prompt.includes("masked hidden or missing area"), true);
  assert.equal(body.modelId, "local-model");
  assert.equal(body.checkpointPath, "models/inpaint.safetensors");
  assert.equal(body.workflowPath, "workflows/inpaint.json");
  assert.equal(body.width, 512);
  assert.equal(body.height, 512);
  assert.equal(body.denoise, 0.6);
});

test("Local SD worker request does not include neutral request provider fields", async () => {
  const Animotion = loadAnimotion();
  let body = null;
  const provider = localProvider(Animotion, async (_url, init) => {
    body = JSON.parse(init.body);
    return okWorkerResponse();
  });
  await runProvider(Animotion, provider, { endpoint: "http://127.0.0.1:7861/inpaint", modelId: "local-model" });
  assert.equal(Object.hasOwn(body, "sourceRectNormalized"), false);
  assert.equal(Object.hasOwn(body, "maskVerticesNormalized"), false);
  assert.equal(Object.hasOwn(body, "guide"), false);
  assert.equal(Object.hasOwn(body, "provenance"), false);
});

test("invalid Local SD worker response is rejected clearly", async () => {
  const Animotion = loadAnimotion();
  const provider = localProvider(Animotion, async () => ({
    status: 200,
    json: async () => ({ provider: "local-sd-inpaint" }),
    text: async () => "{}",
  }));
  await assert.rejects(
    () => runProvider(Animotion, provider, { endpoint: "http://127.0.0.1:7861/inpaint" }),
    /response imageBase64 or imageBytes is required/
  );
});

test("Local SD result writer marks patch ready and keeps request provenance null", async () => {
  const Animotion = loadAnimotion();
  const request = requestPayload(Animotion);
  const provider = localProvider(Animotion, async () => okWorkerResponse({ imageBase64: "abc", modelId: "local-model" }));
  const result = await runProvider(Animotion, provider, {
    endpoint: "http://127.0.0.1:7861/inpaint",
    modelId: "local-model",
    promptVersion: "local-sd-hidden-completion-v1",
  }, request);
  const project = { assets: [patchAsset()] };
  Animotion.hiddenCompletionResult.writeHiddenCompletionResult(project, "hidden-leg", result, {
    inputAssetIds: ["source-image", "hidden-leg"],
    promptVersion: result.rawProviderMetadata.promptVersion,
  });
  const patch = project.assets.find((asset) => asset.id === "hidden-leg");
  assert.equal(patch.patchStatus, "ready");
  assert.equal(patch.renderMode, "generated");
  assert.equal(patch.generatedResult.provenance.provider, "local-sd-inpaint");
  assert.equal(patch.generatedResult.provenance.modelId, "local-model");
  assert.equal(request.provenance.provider, null);
});

function localProvider(Animotion, fetchImpl) {
  return Animotion.hiddenCompletionLocalSdProvider.createLocalSdInpaintProvider({ fetchImpl });
}

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
    promptVersion: "hidden-completion-v1",
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

function okWorkerResponse(patch = {}) {
  const body = {
    imageBase64: "abc",
    mimeType: "image/png",
    createdAt: "2026-05-18T00:00:00+09:00",
    ...patch,
  };
  return {
    status: 200,
    json: async () => body,
    text: async () => JSON.stringify(body),
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
