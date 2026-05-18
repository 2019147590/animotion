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
    "scripts/hidden-completion-assets.js",
    "scripts/motion-hints.js",
    "scripts/motion-drafts.js",
    "scripts/motion-draft-editor.js",
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
    patchTransform: { translationNormalized: { xNorm: 0.2, yNorm: 0.3 }, scaleX: 1.25, rotation: 0.1 },
    patchStatus: "ready",
    preview: { label: "leg back", visible: false },
  });
  assert.equal(asset.type, "hiddenCompletionPatch");
  assert.equal(asset.sourcePartId, "leg-a");
  assert.equal(asset.sourceRectNormalized.coordinateSpace, "normalized-image");
  assert.equal(asset.maskVerticesNormalized[0].xNorm, 1);
  assert.equal(asset.maskVerticesNormalized[0].yNorm, 0);
  assert.equal(asset.patchTransform.coordinateSpace, "part-local");
  assert.equal(asset.patchTransform.translationNormalized.xNorm, 0.2);
  assert.equal(asset.patchStatus, "ready");
  assert.equal(asset.preview.visible, false);
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

test("motion draft editor is loaded after ui refresh hooks are available", () => {
  const bootstrap = fs.readFileSync("scripts/bootstrap.js", "utf8");
  assert.equal(bootstrap.indexOf('"ui"') < bootstrap.indexOf('"motion-draft-editor"'), true);
  assert.equal(bootstrap.includes("motion-draft-editor"), true);
});
