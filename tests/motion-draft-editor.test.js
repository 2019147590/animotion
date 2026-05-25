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
    "scripts/coordinate-spaces.js",
    "scripts/geometry.js",
    "scripts/hidden-completion-coverage-bounds.js",
    "scripts/hidden-completion-assets.js",
    "scripts/motion-hints.js",
    "scripts/motion-drafts.js",
    "scripts/cutscene-action-selectors.js",
    "scripts/motion-draft-action-store.js",
    "scripts/motion-draft-editor.js",
    "scripts/hidden-completion-supplemental-coverage.js",
    "scripts/hidden-completion-supplemental-part.js",
    "scripts/hidden-completion-guide-editor.js",
  ]) runScript(context, path);
  const Animotion = context.window.Animotion;
  Animotion.state = { motionPlan: {}, cutsceneBridge: null };
  Animotion.motionCommands = {
    currentMotionPlan: () => Animotion.state.motionPlan,
    setMotionPlan(patch) {
      Animotion.state.motionPlan = { ...Animotion.state.motionPlan, ...patch };
      return Animotion.state.motionPlan;
    },
    updateJointAction(action) {
      Animotion.state.cutsceneBridge.jointAction = action;
      return action;
    },
  };
  return Animotion;
}

function runScript(context, path) {
  vm.runInContext(fs.readFileSync(path, "utf8"), context, { filename: path });
}

test("motion draft editor edits the plan draft before action generation", () => {
  const Animotion = loadAnimotion();
  Animotion.state.motionPlan.motionDraft = Animotion.motionDrafts.compileFromHints({
    source: "correspondence",
    occlusion: "partial",
    depthOrder: "behind",
    hiddenCompletion: "required",
  }, { partId: "leg-a", correspondenceId: "corr-1", targetPartType: "foot" });
  const updated = Animotion.motionDraftEditor.updateVisibilityImpactValue(0.35);
  assert.equal(updated.draftScope, "plan");
  assert.equal(Animotion.state.motionPlan.motionDraft.visibility.keyframes[1].value, 0.35);
  const row = Animotion.motionDraftEditor.draftRows()[0];
  assert.equal(row[0], "scope");
  assert.equal(row[1], "plan");
});

test("motion draft editor edits action snapshots without touching the plan draft", () => {
  const Animotion = loadAnimotion();
  const planDraft = Animotion.motionDrafts.compileFromHints({
    source: "correspondence",
    occlusion: "partial",
    depthOrder: "behind",
    hiddenCompletion: "candidate",
  }, { partId: "leg-a", correspondenceId: "corr-1", targetPartType: "foot" });
  Animotion.state.motionPlan.motionDraft = planDraft;
  Animotion.state.cutsceneBridge = {
    jointAction: {
      motionDraft: Animotion.motionDrafts.snapshot(planDraft),
    },
  };
  const updated = Animotion.motionDraftEditor.updateHiddenCompletion({ assetStatus: "ready", assetId: "asset-hidden-leg" });
  assert.equal(updated.draftScope, "action-snapshot");
  assert.equal(updated.hiddenCompletion.assetStatus, "ready");
  assert.equal(updated.hiddenCompletion.assetId, "asset-hidden-leg");
  assert.equal(Animotion.state.motionPlan.motionDraft.hiddenCompletion.assetStatus, "missing");
});

test("motion draft hidden completion follows request ready replace remove lifecycle", () => {
  const Animotion = loadAnimotion();
  const draft = Animotion.motionDrafts.compileFromHints({
    source: "correspondence",
    hiddenCompletion: "required",
  }, { partId: "leg-a" });
  assert.equal(draft.hiddenCompletion.assetKind, "hiddenCompletionPatch");
  const requested = Animotion.motionDrafts.requestHiddenCompletion(draft, {
    requestId: "request-1",
    requestedAt: "2026-05-18T00:00:00+09:00",
  });
  assert.equal(requested.hiddenCompletion.assetStatus, "requested");
  assert.equal(requested.hiddenCompletion.assetId, null);
  assert.equal(requested.hiddenCompletion.requestedAt, "2026-05-17T15:00:00.000Z");
  const ready = Animotion.motionDrafts.markHiddenCompletionReady(requested, "asset-hidden-leg", {
    completedAt: "2026-05-18T01:00:00+09:00",
  });
  assert.equal(ready.hiddenCompletion.assetStatus, "ready");
  assert.equal(ready.hiddenCompletion.assetId, "asset-hidden-leg");
  assert.equal(ready.hiddenCompletion.completedAt, "2026-05-17T16:00:00.000Z");
  const replaced = Animotion.motionDrafts.markHiddenCompletionReady(ready, "asset-hidden-leg-v2");
  assert.equal(replaced.hiddenCompletion.assetId, "asset-hidden-leg-v2");
  const removed = Animotion.motionDrafts.removeHiddenCompletionAsset(replaced);
  assert.equal(removed.hiddenCompletion.assetStatus, "missing");
  assert.equal(removed.hiddenCompletion.assetId, null);
});

test("hidden completion patch asset normalizes project metadata", () => {
  const Animotion = loadAnimotion();
  const asset = Animotion.hiddenCompletionAssets.normalizeAsset({
    id: "hidden-leg",
    type: "hiddenCompletionPatch",
    sourcePartId: "leg-a",
    sourceRectNormalized: { xNorm: 0.2, yNorm: 0.3, wNorm: 0.4, hNorm: 0.5 },
    maskVerticesNormalized: [{ xNorm: 1.2, yNorm: -0.5 }],
    guide: {
      meshVerticesNormalized: [{ xNorm: 0, yNorm: 0 }, { xNorm: 1, yNorm: 0 }, { xNorm: 1, yNorm: 1 }],
      meshFaces: [[0, 1, 2], [2, 1, -2, 5]],
      silhouetteVerticesNormalized: [{ xNorm: 0.25, yNorm: 0.75 }],
      guideStrength: 0.75,
    },
    patchTransform: { translationNormalized: { xNorm: 0.2, yNorm: 0.3 }, scaleX: 1.25, rotation: 0.1 },
    generatedResult: {
      status: "requested",
      assetId: "generated-hidden-leg",
      generatedAt: "2026-05-18T01:00:00+09:00",
      sourceGuideVersion: "guide-v1",
    },
    renderMode: "guideOnly",
    patchStatus: "ready",
    preview: { label: "leg back", visible: false },
  });
  assert.equal(asset.type, "hiddenCompletionPatch");
  assert.equal(asset.sourcePartId, "leg-a");
  assert.equal(asset.sourceRectNormalized.coordinateSpace, "normalized-image");
  assert.equal(asset.maskVerticesNormalized[0].xNorm, 1.2);
  assert.equal(asset.maskVerticesNormalized[0].yNorm, -0.5);
  assert.equal(asset.guide.coordinateSpace, "part-local-normalized");
  assert.equal(asset.guide.meshVerticesNormalized[2].xNorm, 1);
  assert.equal(asset.guide.meshFaces[1][0], 2);
  assert.equal(asset.guide.meshFaces[1][1], 1);
  assert.equal(asset.guide.meshFaces[1][2], 0);
  assert.equal(asset.guide.silhouetteVerticesNormalized[0].yNorm, 0.75);
  assert.equal(asset.guide.guideStrength, 0.75);
  assert.equal(asset.patchTransform.coordinateSpace, "part-local");
  assert.equal(asset.patchTransform.translationNormalized.xNorm, 0.2);
  assert.equal(asset.generatedResult.status, "requested");
  assert.equal(asset.generatedResult.generatedAt, "2026-05-17T16:00:00.000Z");
  assert.equal(asset.renderMode, "guideOnly");
  assert.equal(asset.patchStatus, "ready");
  assert.equal(asset.preview.visible, false);
});

test("hidden completion patch creates and restores a part-local mesh guide", () => {
  const Animotion = loadAnimotion();
  Animotion.imageBounds = () => ({ width: 100, height: 80 });
  const asset = Animotion.hiddenCompletionAssets.createForPart({
    id: "leg-a",
    name: "leg",
    sourceRect: { x: 10, y: 20, w: 30, h: 40 },
    mask: { points: [{ x: 3, y: 4 }, { x: 12, y: 20 }, { x: 27, y: 36 }] },
  }, { id: "hidden-leg" });
  assert.equal(asset.patchStatus, "guide");
  assert.equal(asset.renderMode, "guideOnly");
  assert.equal(asset.generatedResult.status, "none");
  assert.equal(asset.sourceRectNormalized.xNorm, 0.06);
  assert.equal(asset.sourceRectNormalized.wNorm, 0.38);
  assert.equal(asset.guide.meshVerticesNormalized.length, 4);
  assert.equal(asset.guide.silhouetteVerticesNormalized[1].xNorm, 0.4);
  assert.equal(asset.guide.silhouetteVerticesNormalized[1].yNorm, 0.5);

  const runtime = Animotion.hiddenCompletionAssets.runtimeGuideMesh(asset, { x: 100, y: 200, w: 60, h: 80 });
  assert.equal(runtime.meshVertices[2].x, 60);
  assert.equal(runtime.meshVertices[2].y, 80);
  assert.equal(runtime.silhouetteVertices[1].x, 24);
  assert.equal(runtime.silhouetteVertices[1].y, 40);
  assert.equal(runtime.meshFaces[0][0], 0);
  assert.equal(runtime.meshFaces[0][1], 1);
  assert.equal(runtime.meshFaces[0][2], 2);
});

test("hidden completion patch keeps mesh guide optional for legacy assets", () => {
  const Animotion = loadAnimotion();
  const asset = Animotion.hiddenCompletionAssets.normalizeAsset({
    id: "hidden-legacy",
    type: "hiddenCompletionPatch",
    sourcePartId: "leg-a",
    patchStatus: "ready",
  });
  assert.equal(asset.guide, undefined);
  assert.equal(asset.generatedResult, undefined);
  assert.equal(asset.renderMode, undefined);
  const runtime = Animotion.hiddenCompletionAssets.runtimeGuideMesh(asset, { x: 0, y: 0, w: 20, h: 30 });
  assert.equal(runtime.meshVertices[2].x, 20);
  assert.equal(runtime.meshVertices[2].y, 30);
});

test("motion draft ready status requires an asset id", () => {
  const Animotion = loadAnimotion();
  const draft = Animotion.motionDrafts.compileFromHints({
    source: "correspondence",
    hiddenCompletion: "required",
  }, { partId: "leg-a" });
  const normalized = Animotion.motionDrafts.normalize({
    ...draft,
    hiddenCompletion: { ...draft.hiddenCompletion, assetStatus: "ready", assetId: "" },
  });
  assert.equal(normalized.hiddenCompletion.assetStatus, "missing");
  assert.equal(normalized.hiddenCompletion.assetId, null);
});

test("motion draft ready status requires a patch asset when assets are provided", () => {
  const Animotion = loadAnimotion();
  const draft = Animotion.motionDrafts.compileFromHints({
    source: "correspondence",
    hiddenCompletion: "required",
  }, { partId: "leg-a" });
  const ready = {
    ...draft,
    hiddenCompletion: { ...draft.hiddenCompletion, assetStatus: "ready", assetId: "hidden-leg" },
  };
  assert.equal(Animotion.motionDrafts.normalize(ready, { assets: [] }).hiddenCompletion.assetStatus, "missing");
  const asset = Animotion.hiddenCompletionAssets.normalizeAsset({
    id: "hidden-leg",
    type: "hiddenCompletionPatch",
    sourcePartId: "leg-a",
  });
  assert.equal(Animotion.motionDrafts.normalize(ready, { assets: [asset] }).hiddenCompletion.assetStatus, "ready");
});

test("motion draft normalizes legacy inpainted patch kind", () => {
  const Animotion = loadAnimotion();
  const normalized = Animotion.motionDrafts.normalize({
    hiddenCompletion: { needed: true, status: "required", assetKind: "inpaintedPatch", assetStatus: "missing" },
  });
  assert.equal(normalized.hiddenCompletion.assetKind, "hiddenCompletionPatch");
});

test("motion draft editor lifecycle buttons update the active snapshot", () => {
  const Animotion = loadAnimotion();
  const planDraft = Animotion.motionDrafts.compileFromHints({
    source: "correspondence",
    hiddenCompletion: "required",
  }, { partId: "leg-a" });
  Animotion.state.cutsceneBridge = { jointAction: { motionDraft: Animotion.motionDrafts.snapshot(planDraft) } };
  const requested = Animotion.motionDraftEditor.requestHiddenCompletion();
  assert.equal(requested.hiddenCompletion.assetStatus, "requested");
  const ready = Animotion.motionDraftEditor.markHiddenCompletionReady("asset-hidden-leg");
  assert.equal(ready.hiddenCompletion.assetStatus, "ready");
  assert.equal(ready.hiddenCompletion.assetId, "asset-hidden-leg");
  const removed = Animotion.motionDraftEditor.removeHiddenCompletionAsset();
  assert.equal(removed.hiddenCompletion.assetStatus, "missing");
});

test("hidden completion guide editor creates and edits a selected part patch", () => {
  const Animotion = loadAnimotion();
  const part = {
    id: "leg-a",
    name: "leg",
    sourceRect: { x: 10, y: 20, w: 30, h: 40 },
    rect: { x: 10, y: 20, w: 30, h: 40 },
    mask: { points: [{ x: 0, y: 0 }, { x: 15, y: 20 }, { x: 30, y: 40 }] },
  };
  Animotion.imageBounds = () => ({ width: 100, height: 80 });
  Animotion.projectModel = { createEmptyProject: () => ({ assets: [] }) };
  Animotion.state.project = { assets: [] };
  Animotion.state.parts = [part];
  Animotion.state.selectedPartId = part.id;
  Animotion.parts = { selectedPart: () => part };
  let syncedAssetId = null;
  Animotion.hiddenCompletionSupplementalPart = { syncPartForPatch: (asset) => { syncedAssetId = asset.id; } };
  Animotion.state.motionPlan.motionDraft = Animotion.motionDrafts.compileFromHints({
    source: "correspondence",
    hiddenCompletion: "required",
  }, { partId: part.id });

  const asset = Animotion.hiddenCompletionGuideEditor.createGuideFromSelectedPart();
  assert.equal(asset.type, "hiddenCompletionPatch");
  assert.equal(asset.renderMode, "guideOnly");
  assert.equal(asset.patchStatus, "guide");
  assert.equal(Animotion.state.project.assets[0].id, asset.id);
  assert.equal(Animotion.state.motionPlan.motionDraft.hiddenCompletion.assetStatus, "ready");
  assert.equal(Animotion.state.motionPlan.motionDraft.hiddenCompletion.assetId, asset.id);

  const updated = Animotion.hiddenCompletionGuideEditor.updateSelectedGuideVertexFromImagePoint(2, { x: 25, y: 50 });
  assert.equal(updated.guide.meshVerticesNormalized[2].xNorm, 0.5);
  assert.equal(updated.guide.meshVerticesNormalized[2].yNorm, 0.75);
  assert.equal(syncedAssetId, asset.id);
});

test("hidden completion guide editor preserves vertices outside the source part", () => {
  const Animotion = loadAnimotion();
  const part = {
    id: "upper-a",
    name: "upper",
    sourceRect: { x: 10, y: 20, w: 30, h: 40 },
    rect: { x: 10, y: 20, w: 30, h: 40 },
    mask: { points: [{ x: 0, y: 0 }, { x: 30, y: 0 }, { x: 30, y: 40 }, { x: 0, y: 40 }] },
  };
  Animotion.imageBounds = () => ({ width: 100, height: 100 });
  Animotion.projectModel = { createEmptyProject: () => ({ assets: [] }) };
  Animotion.state.project = { assets: [] };
  Animotion.state.parts = [part];
  Animotion.state.selectedPartId = part.id;
  Animotion.parts = { selectedPart: () => part };
  Animotion.hiddenCompletionSupplementalPart = { syncPartForPatch: () => null };
  Animotion.state.motionPlan.motionDraft = Animotion.motionDrafts.compileFromHints({
    source: "manual",
    hiddenCompletion: "required",
  }, { partId: part.id });

  const asset = Animotion.hiddenCompletionGuideEditor.createGuideFromSelectedPart();
  const updated = Animotion.hiddenCompletionGuideEditor.updateSelectedGuideVertexFromImagePoint(2, { x: 55, y: 75 });
  const saved = Animotion.state.project.assets.find((candidate) => candidate.id === asset.id);

  assert.equal(updated.guide.meshVerticesNormalized[2].xNorm, 1.5);
  assert.equal(updated.guide.silhouetteVerticesNormalized[2].yNorm, 1.375);
  assert.equal(saved.maskVerticesNormalized[2].xNorm, 1.5);
  assert.equal(saved.sourceRectNormalized.wNorm > 0.3, true);
});

test("loaded patch guide edit commits silhouette and syncs supplemental mask", () => {
  const Animotion = loadAnimotion();
  const body = {
    id: "body",
    name: "body",
    type: "body",
    rect: { x: 40, y: 30, w: 80, h: 100 },
    sourceRect: { x: 40, y: 30, w: 80, h: 100 },
    pivot: { x: 40, y: 25 },
    joint: { x: 40, y: 85 },
    mask: { points: [{ x: 0, y: 0 }, { x: 80, y: 0 }, { x: 80, y: 100 }, { x: 0, y: 100 }] },
    customMotion: {},
    keyframes: [],
  };
  const bodyRef = { ...body, id: "body_ref", name: "body_ref", rect: { x: 120, y: 30, w: 80, h: 100 }, canvas: { id: "body-ref-canvas" } };
  const supplementalCanvas = { id: "loaded-supp-canvas" };
  const asset = Animotion.hiddenCompletionAssets.normalizeAsset({
    id: "hidden-body-symmetry",
    type: "hiddenCompletionPatch",
    sourcePartId: "body",
    sourceRectNormalized: { xNorm: 0.2, yNorm: 0.1875, wNorm: 0.4, hNorm: 0.625 },
    guide: {
      meshVerticesNormalized: [{ xNorm: 0, yNorm: 0 }, { xNorm: 1, yNorm: 0 }, { xNorm: 1, yNorm: 1 }, { xNorm: 0, yNorm: 1 }],
      meshFaces: [[0, 1, 2], [0, 2, 3]],
      silhouetteVerticesNormalized: [{ xNorm: 0, yNorm: 0 }, { xNorm: 1, yNorm: 0 }, { xNorm: 1, yNorm: 1 }, { xNorm: 0, yNorm: 1 }],
    },
    completionMethod: "symmetry",
    symmetrySource: { counterpartPartId: "body_ref", targetPartId: "body" },
  });
  const draft = Animotion.motionDrafts.normalize({
    partId: "body",
    hiddenCompletion: { needed: true, status: "candidate", assetKind: "hiddenCompletionPatch", assetStatus: "ready", assetId: asset.id },
  }, { assets: [asset] });
  Animotion.imageBounds = () => ({ width: 200, height: 160 });
  Animotion.state = {
    project: { assets: [asset] },
    parts: [body, bodyRef, {
      id: "supp-hidden-body",
      isSupplementalPart: true,
      sourcePatchAssetId: asset.id,
      sourcePartId: "body",
      rect: { x: 40, y: 30, w: 80, h: 100 },
      sourceRect: { x: 40, y: 30, w: 80, h: 100 },
      pivot: { x: 40, y: 25 },
      joint: { x: 40, y: 85 },
      mask: { points: [{ x: 0, y: 0 }, { x: 80, y: 0 }, { x: 80, y: 100 }, { x: 0, y: 100 }] },
      canvas: supplementalCanvas,
    }],
    selectedPartId: "body",
    cutsceneBridge: { jointAction: { hiddenCompletionDrafts: [draft], beats: [{ id: "impact", at: 1, pose: { p: [0, 0] } }] } },
  };
  Animotion.parts = { selectedPart: () => body };

  const updated = Animotion.hiddenCompletionGuideEditor.updateSelectedGuideVertexFromImagePoint(2, { x: 100, y: 130 });
  const saved = Animotion.state.project.assets.find((candidate) => candidate.id === asset.id);
  const supplemental = Animotion.state.parts.find((part) => part.id === "supp-hidden-body");

  assert.equal(updated.guide.meshVerticesNormalized[2].xNorm, 0.75);
  assert.equal(saved.guide.silhouetteVerticesNormalized[2].xNorm, 0.75);
  assert.equal(saved.sourceRectNormalized.xNorm < 0.2, true);
  assert.equal(saved.sourceRectNormalized.wNorm > 0.4, true);
  assert.deepEqual(JSON.parse(JSON.stringify(supplemental.mask.points[2])), { x: 64, y: 104 });
  assert.equal(supplemental.canvas, supplementalCanvas);
});

test("motion draft editor is loaded after ui refresh hooks are available", () => {
  const bootstrap = fs.readFileSync("scripts/bootstrap.js", "utf8");
  assert.equal(bootstrap.indexOf('"ui"') < bootstrap.indexOf('"motion-draft-editor"'), true);
  assert.equal(bootstrap.includes("motion-draft-editor"), true);
  assert.equal(bootstrap.indexOf('"motion-draft-editor"') < bootstrap.indexOf('"hidden-completion-guide-editor"'), true);
});
