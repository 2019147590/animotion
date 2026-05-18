const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

function test(name, fn) {
  try {
    fn();
    console.log(`PASS ${name}`);
  } catch (error) {
    console.error(`FAIL ${name}`);
    throw error;
  }
}

function loadAnimotion() {
  const context = { window: { Animotion: {} } };
  vm.createContext(context);
  for (const path of [
    "scripts/hidden-completion-assets.js",
    "scripts/hidden-completion-request.js",
  ]) runScript(context, path);
  return context.window.Animotion;
}

function runScript(context, path) {
  vm.runInContext(fs.readFileSync(path, "utf8"), context, { filename: path });
}

function buildRequest(project, assetId = "hidden-leg") {
  return loadAnimotion().hiddenCompletionRequest.buildHiddenCompletionRequest(project, assetId);
}

function buildRequestWithOptions(project, options) {
  return loadAnimotion().hiddenCompletionRequest.buildHiddenCompletionRequest(project, "hidden-leg", options);
}

test("hidden completion request builder creates an adapter payload from a patch asset", () => {
  const request = buildRequest({ assets: [patchAsset()] });
  assert.equal(request.task, "hidden_completion");
  assert.equal(request.requestId, null);
  assert.equal(request.promptVersion, null);
  assert.equal(request.patchAssetId, "hidden-leg");
  assert.equal(request.sourcePartId, "part-leg");
  assert.equal(request.sourceRectNormalized.xNorm, 0.42);
  assert.equal(request.maskVerticesNormalized[0].xNorm, 0.1);
  assert.equal(request.guide.meshFaces[0][2], 2);
  assert.equal(request.patchTransform.scaleX, 1);
  assert.equal(request.intent.mode, "extend_same_part");
  assert.equal(request.intent.preserveStyle, true);
  assert.equal(request.intent.preserveLineArt, true);
  assert.equal(request.intent.avoidNewDesign, true);
  assert.equal(request.provenance.provider, null);
  assertJsonEqual(request.warnings, []);
});

test("hidden completion request preserves guide coordinates outside the part", () => {
  const request = buildRequest({ assets: [patchAsset()] });
  assert.equal(request.guide.meshVerticesNormalized[2].yNorm, 1.05);
  assert.equal(request.guide.silhouetteVerticesNormalized[1].yNorm, 1.02);
});

test("hidden completion request rejects provider specific builder options", () => {
  assert.throws(
    () => buildRequestWithOptions({ assets: [patchAsset()] }, { provider: "openai" }),
    /unsupported hidden completion request option: provider/
  );
});

test("hidden completion request keeps provenance neutral and accepts only neutral options", () => {
  const request = buildRequestWithOptions({ assets: [patchAsset()] }, {
    promptVersion: "hidden-prompt-v1",
    requestId: "request-1",
  });
  assert.equal(request.requestId, "request-1");
  assert.equal(request.promptVersion, "hidden-prompt-v1");
  assert.equal(request.provenance.provider, null);
  assert.equal(request.provenance.modelId, null);
  assert.equal(request.provenance.modelLicense, null);
});

test("hidden completion request emits canonical normalized fields from aliases", () => {
  const request = buildRequest({ assets: [patchAsset()] });
  assertJsonEqual(request.sourceRectNormalized, {
    xNorm: 0.42,
    yNorm: 0.35,
    wNorm: 0.12,
    hNorm: 0.28,
    coordinateSpace: "normalized-image",
  });
  assertJsonEqual(request.guide.meshVerticesNormalized[0], {
    xNorm: 0.15,
    yNorm: 0.75,
    coordinateSpace: "part-local-normalized",
  });
});

test("hidden completion request rejects invalid patch ids and asset types", () => {
  assert.throws(
    () => buildRequest({ assets: [patchAsset()] }, "missing"),
    /hidden completion patch asset not found/
  );
  assert.throws(
    () => buildRequest({ assets: [{ id: "texture-1", type: "texture", name: "tex", uri: "tex.png" }] }, "texture-1"),
    /asset is not a hiddenCompletionPatch/
  );
});

test("hidden completion request rejects patches without a source part id", () => {
  const asset = patchAsset();
  delete asset.sourcePartId;
  assert.throws(
    () => buildRequest({ assets: [asset] }),
    /sourcePartId is required/
  );
});

test("hidden completion request warns and continues when guide mesh is missing", () => {
  const asset = patchAsset();
  delete asset.guide;
  const request = buildRequest({ assets: [asset] });
  assertJsonEqual(request.warnings, ["hidden-completion-guide-missing"]);
  assertJsonEqual(request.guide.meshVerticesNormalized, []);
  assertJsonEqual(request.guide.meshFaces, []);
  assertJsonEqual(request.guide.silhouetteVerticesNormalized, []);
});

test("hidden completion request contract documents neutral format and coordinate spaces", () => {
  const contract = fs.readFileSync("HIDDEN_COMPLETION_REQUEST.md", "utf8");
  assert.equal(contract.includes("provider-neutral"), true);
  assert.equal(contract.includes("must not contain sampler names"), true);
  assert.equal(contract.includes("options must not include provider-specific options"), true);
  assert.equal(contract.includes("source part local normalized"), true);
  assert.equal(contract.includes("must not be clamped"), true);
});

function assertJsonEqual(actual, expected) {
  assert.deepEqual(JSON.parse(JSON.stringify(actual)), expected);
}

function patchAsset() {
  return {
    id: "hidden-leg",
    type: "hiddenCompletionPatch",
    sourcePartId: "part-leg",
    sourceRectNormalized: { x: 0.42, y: 0.35, width: 0.12, height: 0.28 },
    maskVerticesNormalized: [{ x: 0.1, y: 0.7 }, { x: 0.4, y: 0.75 }],
    guide: {
      meshVerticesNormalized: [{ x: 0.15, y: 0.75 }, { x: 0.35, y: 0.82 }, { x: 0.42, y: 1.05 }],
      meshFaces: [[0, 1, 2]],
      silhouetteVerticesNormalized: [{ x: 0.12, y: 0.72 }, { x: 0.43, y: 1.02 }],
    },
    patchTransform: { x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0 },
    patchStatus: "guide",
  };
}
