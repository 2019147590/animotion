const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const tests = [];

function test(name, fn) {
  tests.push({ name, fn });
}

function loadAnimotion() {
  const context = { window: { Animotion: {} } };
  vm.createContext(context);
  for (const path of [
    "scripts/coordinate-spaces.js",
    "scripts/hidden-completion-coverage-bounds.js",
    "scripts/hidden-completion-assets.js",
    "scripts/hidden-completion-request.js",
    "scripts/hidden-completion-prep.js",
    "scripts/hidden-completion-result.js",
    "scripts/hidden-completion-provider.js",
  ]) runScript(context, path);
  return context.window.Animotion;
}

function runScript(context, path) {
  vm.runInContext(fs.readFileSync(path, "utf8"), context, { filename: path });
}

test("provider config stays outside the neutral request payload", async () => {
  const Animotion = loadAnimotion();
  const request = requestPayload(Animotion);
  const before = JSON.stringify(request);
  const provider = Animotion.hiddenCompletionProvider.createApiProviderAdapter({
    callApi: async ({ request: sent }) => ({ imageBase64: "abc", requestHash: hash(sent), provider: "mock-api" }),
  });
  const prepared = Animotion.hiddenCompletionPrep.prepareHiddenCompletionImages({
    request,
    sourceImage: { width: 200, height: 100 },
  });

  await Animotion.hiddenCompletionProvider.runHiddenCompletionProvider({
    provider,
    request,
    sourceImage: prepared.sourceImage,
    maskImage: prepared.maskImage,
    providerConfig: { endpoint: "https://example.invalid", sampler: "provider-only", apiKey: "secret" },
  });

  assert.equal(JSON.stringify(request), before);
  assert.equal(Object.hasOwn(request, "endpoint"), false);
  assert.equal(Object.hasOwn(request, "sampler"), false);
});

test("provider adapter exposes lightweight capabilities", () => {
  const Animotion = loadAnimotion();
  const provider = Animotion.hiddenCompletionProvider.createApiProviderAdapter({
    capabilities: { supportsGuideMesh: false, maxResolution: 1024 },
    callApi: async () => ({ imageBase64: "abc" }),
  });
  const capabilities = Animotion.hiddenCompletionProvider.capabilitiesFor(provider);
  assert.equal(capabilities.supportsSourceImage, true);
  assert.equal(capabilities.supportsMask, true);
  assert.equal(capabilities.supportsGuideMesh, false);
  assert.equal(capabilities.maxResolution, 1024);
});

test("API provider reports a clear missing API key error", async () => {
  const Animotion = loadAnimotion();
  const provider = Animotion.hiddenCompletionProvider.createApiProviderAdapter({ callApi: async () => ({ imageBase64: "abc" }) });
  await assert.rejects(
    () => Animotion.hiddenCompletionProvider.runHiddenCompletionProvider({
      provider,
      request: requestPayload(Animotion),
      sourceImage: { width: 20, height: 20 },
      maskImage: { width: 20, height: 20 },
      providerConfig: { apiKeyEnvName: "ANIMOTION_API_KEY" },
    }),
    /missing API key for ANIMOTION_API_KEY/
  );
});

test("source and mask dimension mismatch is rejected", async () => {
  const Animotion = loadAnimotion();
  const provider = { id: "mock", run: async () => ({ imageBase64: "abc" }) };
  await assert.rejects(
    () => Animotion.hiddenCompletionProvider.runHiddenCompletionProvider({
      provider,
      request: requestPayload(Animotion),
      sourceImage: { width: 20, height: 20 },
      maskImage: { width: 19, height: 20 },
      providerConfig: {},
    }),
    /dimensions must match/
  );
});

test("rasterization clips at the image boundary without mutating request coordinates", () => {
  const Animotion = loadAnimotion();
  const request = requestPayload(Animotion);
  const prepared = Animotion.hiddenCompletionPrep.prepareHiddenCompletionImages({
    request,
    sourceImage: { width: 200, height: 100 },
  });
  assert.equal(request.maskVerticesNormalized[1].xNorm, 1.2);
  assert.equal(request.maskVerticesNormalized[1].yNorm, -0.2);
  assert.equal(prepared.maskImage.polygonPoints[1].x, 100);
  assert.equal(prepared.maskImage.polygonPoints[1].y, 0);
  assert.equal(prepared.sourceImage.width, prepared.maskImage.width);
});

test("mocked provider success returns a normalized result", async () => {
  const Animotion = loadAnimotion();
  const provider = Animotion.hiddenCompletionProvider.createApiProviderAdapter({
    id: "mock-api",
    callApi: async () => ({
      imageBase64: "abc",
      mimeType: "image/png",
      provider: "mock-api",
      modelId: "mock-model",
      modelLicense: "mock-license",
      requestHash: "hash-1",
      createdAt: "2026-05-18T00:00:00+09:00",
    }),
  });
  const result = await Animotion.hiddenCompletionProvider.runHiddenCompletionProvider({
    provider,
    request: requestPayload(Animotion),
    sourceImage: { width: 20, height: 20 },
    maskImage: { width: 20, height: 20 },
    providerConfig: { apiKey: "secret" },
  });
  assert.equal(result.provider, "mock-api");
  assert.equal(result.modelId, "mock-model");
  assert.equal(result.createdAt, "2026-05-17T15:00:00.000Z");
});

test("result writer stores output asset and patch provenance without mutating request", () => {
  const Animotion = loadAnimotion();
  const request = requestPayload(Animotion);
  const project = { assets: [patchAsset()] };
  const write = Animotion.hiddenCompletionResult.writeHiddenCompletionResult(project, "hidden-leg", {
    imageBase64: "abc",
    provider: "mock-api",
    modelId: "mock-model",
    modelLicense: "mock-license",
    requestHash: "hash-1",
    createdAt: "2026-05-18T00:00:00+09:00",
    rawProviderMetadata: { jobId: "job-1" },
  }, { inputAssetIds: ["source-image"], promptVersion: "hidden-prompt-v1" });
  const patch = project.assets.find((asset) => asset.id === "hidden-leg");

  assert.equal(write.generatedAssetId, "generated-hidden-leg");
  assert.equal(patch.patchStatus, "ready");
  assert.equal(patch.generatedResult.provenance.provider, "mock-api");
  assert.equal(patch.generatedResult.provenance.promptVersion, "hidden-prompt-v1");
  assert.equal(request.provenance.provider, null);
});

function requestPayload(Animotion) {
  return Animotion.hiddenCompletionRequest.buildHiddenCompletionRequest({ assets: [patchAsset()] }, "hidden-leg", {
    promptVersion: "hidden-prompt-v1",
  });
}

function patchAsset() {
  return {
    id: "hidden-leg",
    type: "hiddenCompletionPatch",
    name: "hidden leg",
    sourcePartId: "part-leg",
    sourceRectNormalized: { x: 0.1, y: 0.2, width: 0.5, height: 0.25 },
    maskVerticesNormalized: [{ x: 0.1, y: 0.2 }, { x: 1.2, y: -0.2 }, { x: 0.5, y: 1.1 }],
    guide: {
      meshVerticesNormalized: [{ x: 0, y: 0 }, { x: 0.5, y: 1.05 }, { x: 1, y: 1 }],
      meshFaces: [[0, 1, 2]],
      silhouetteVerticesNormalized: [{ x: 0, y: 0 }, { x: 1, y: 1.02 }],
    },
    patchTransform: { x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0 },
    patchStatus: "guide",
  };
}

function hash(value) {
  return `hash-${JSON.stringify(value).length}`;
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
