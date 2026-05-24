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

function runScript(context, path) {
  vm.runInContext(fs.readFileSync(path, "utf8"), context, { filename: path });
}

function loadEditorAnimotion() {
  const context = { window: { Animotion: {} } };
  vm.createContext(context);
  for (const path of [
    "scripts/coordinate-spaces.js",
    "scripts/geometry.js",
    "scripts/hidden-completion-assets.js",
    "scripts/motion-hints.js",
    "scripts/motion-drafts.js",
    "scripts/cutscene-action-selectors.js",
    "scripts/motion-draft-action-store.js",
    "scripts/motion-draft-editor.js",
  ]) runScript(context, path);
  const Animotion = context.window.Animotion;
  Animotion.state = { motionPlan: {}, cutsceneBridge: null, project: { assets: [] } };
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

function loadRenderAnimotion() {
  const context = { window: { Animotion: {} } };
  vm.createContext(context);
  for (const path of [
    "scripts/hidden-completion-assets.js",
    "scripts/cutscene-action-selectors.js",
    "scripts/motion-draft-action-store.js",
    "scripts/hidden-completion-render.js",
  ]) runScript(context, path);
  return context.window.Animotion;
}

function loadCutsceneAnimotion() {
  const context = { window: { Animotion: {} } };
  vm.createContext(context);
  for (const path of [
    "scripts/coordinate-spaces.js",
    "scripts/hidden-completion-assets.js",
    "scripts/motion-drafts.js",
    "scripts/cutscene-action-selectors.js",
    "scripts/motion-draft-action-store.js",
    "scripts/cutscene-model.js",
  ]) runScript(context, path);
  return context.window.Animotion;
}

function loadCommandsAnimotion() {
  const context = { window: { Animotion: { state: { parts: [], project: { assets: [] }, cutsceneBridge: null } } } };
  vm.createContext(context);
  for (const path of [
    "scripts/coordinate-spaces.js",
    "scripts/hidden-completion-assets.js",
    "scripts/motion-drafts.js",
    "scripts/cutscene-action-selectors.js",
    "scripts/motion-draft-action-store.js",
    "scripts/cutscene-model.js",
    "scripts/motion-commands.js",
  ]) runScript(context, path);
  return context.window.Animotion;
}

function readyDraft(Animotion, partId, assetId) {
  return Animotion.motionDrafts.normalize({
    partId,
    hiddenCompletion: {
      needed: true,
      status: "candidate",
      assetKind: "hiddenCompletionPatch",
      assetStatus: "ready",
      assetId,
    },
  });
}

test("motion draft editor keeps hidden completion drafts per action part", () => {
  const Animotion = loadEditorAnimotion();
  Animotion.state.parts = [{ id: "body" }, { id: "upper" }];
  Animotion.state.project.assets = [
    { id: "hidden-body", type: "hiddenCompletionPatch", sourcePartId: "body" },
    { id: "hidden-upper", type: "hiddenCompletionPatch", sourcePartId: "upper" },
  ];
  Animotion.parts = { selectedPart: () => Animotion.state.parts.find((part) => part.id === Animotion.state.selectedPartId) || null };
  const bodyDraft = Animotion.motionDrafts.compileFromHints({ source: "manual", hiddenCompletion: "candidate" }, { partId: "body" });
  Animotion.state.selectedPartId = "body";
  Animotion.state.cutsceneBridge = { jointAction: { beats: [{ id: "impact", at: 1, pose: { p: [0, 0] } }], motionDraft: Animotion.motionDrafts.snapshot(bodyDraft) } };
  Animotion.motionDraftEditor.updateHiddenCompletion({ assetStatus: "ready", assetId: "hidden-body" });

  const upperDraft = Animotion.motionDrafts.compileFromHints({ source: "manual", hiddenCompletion: "candidate" }, { partId: "upper" });
  Animotion.state.selectedPartId = "upper";
  Animotion.state.cutsceneBridge.jointAction.motionDraft = Animotion.motionDrafts.snapshot(upperDraft);
  Animotion.motionDraftEditor.updateHiddenCompletion({ assetStatus: "ready", assetId: "hidden-upper" });

  assert.equal(Animotion.state.cutsceneBridge.jointAction.hiddenCompletionDrafts.length, 2);
  Animotion.state.selectedPartId = "body";
  assert.equal(Animotion.motionDraftEditor.activeDraftContext().draft.hiddenCompletion.assetId, "hidden-body");
  Animotion.state.selectedPartId = "upper";
  assert.equal(Animotion.motionDraftEditor.activeDraftContext().draft.hiddenCompletion.assetId, "hidden-upper");
});

test("joint action updates preserve a legacy single hidden completion draft", () => {
  const Animotion = loadCommandsAnimotion();
  Animotion.state.project.assets = [
    { id: "hidden-body", type: "hiddenCompletionPatch", sourcePartId: "body" },
    { id: "hidden-upper", type: "hiddenCompletionPatch", sourcePartId: "upper" },
  ];
  const beats = [{ id: "impact", at: 12, pose: { p: [4, 5] } }];
  const bodyDraft = readyDraft(Animotion, "body", "hidden-body");
  const upperDraft = readyDraft(Animotion, "upper", "hidden-upper");
  Animotion.state.cutsceneBridge = { durationFrames: 18, impactFrame: 12, jointAction: { beats, motionDraft: bodyDraft } };

  Animotion.motionCommands.updateJointAction({ beats, motionDraft: upperDraft });

  const drafts = Animotion.state.cutsceneBridge.jointAction.hiddenCompletionDrafts;
  assert.equal(drafts.length, 1);
  assert.equal(drafts[0].partId, "body");
  assert.equal(drafts[0].hiddenCompletion.assetId, "hidden-body");
});

test("hidden completion render uses the draft linked to each part", () => {
  const Animotion = loadRenderAnimotion();
  const bodyAsset = Animotion.hiddenCompletionAssets.normalizeAsset({
    id: "hidden-body",
    type: "hiddenCompletionPatch",
    sourcePartId: "body",
    completionMethod: "symmetry",
    symmetrySource: { counterpartPartId: "body" },
  });
  const upperAsset = Animotion.hiddenCompletionAssets.normalizeAsset({
    id: "hidden-upper",
    type: "hiddenCompletionPatch",
    sourcePartId: "upper",
    completionMethod: "symmetry",
    symmetrySource: { counterpartPartId: "upper-other" },
  });
  const state = {
    project: { assets: [bodyAsset, upperAsset] },
    cutsceneBridge: {
      jointAction: {
        hiddenCompletionDrafts: [
          { partId: "body", hiddenCompletion: { assetStatus: "ready", assetId: "hidden-body" } },
          { partId: "upper", hiddenCompletion: { assetStatus: "ready", assetId: "hidden-upper" } },
        ],
      },
    },
  };

  assert.equal(Animotion.hiddenCompletionRender.linkedSymmetryAsset({ id: "body" }, { state }).id, "hidden-body");
  assert.equal(Animotion.hiddenCompletionRender.linkedSymmetryAsset({ id: "upper" }, { state }).id, "hidden-upper");
});

test("cutscene bridge normalization preserves per-part hidden completion drafts", () => {
  const Animotion = loadCutsceneAnimotion();
  const draft = readyDraft(Animotion, "body", "hidden-body");
  const bridge = Animotion.cutsceneModel.normalizeBridge({
    jointAction: {
      beats: [{ id: "impact", at: 12, pose: { p: [4, 5] } }],
      hiddenCompletionDrafts: [draft],
    },
  });

  assert.equal(bridge.jointAction.hiddenCompletionDrafts.length, 1);
  assert.equal(bridge.jointAction.hiddenCompletionDrafts[0].partId, "body");
  assert.equal(bridge.jointAction.hiddenCompletionDrafts[0].hiddenCompletion.assetId, "hidden-body");
});
