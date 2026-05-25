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
    "scripts/hidden-completion-coverage-bounds.js",
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

function recordingContext() {
  const ops = [];
  const record = (name, ...args) => ops.push({ name, args });
  return {
    __ops: ops,
    save: () => record("save"),
    restore: () => record("restore"),
    beginPath: () => record("beginPath"),
    moveTo: (...args) => record("moveTo", ...args),
    lineTo: (...args) => record("lineTo", ...args),
    closePath: () => record("closePath"),
    clip: () => record("clip"),
    transform: (...args) => record("transform", ...args),
    translate: (...args) => record("translate", ...args),
    rotate: (...args) => record("rotate", ...args),
    scale: (...args) => record("scale", ...args),
    drawImage: (...args) => record("drawImage", ...args),
  };
}

function readyRenderState(target, counterpart, asset, patch = {}) {
  return {
    parts: [target, counterpart],
    project: { assets: [asset] },
    cutsceneBridge: {
      jointAction: {
        hiddenCompletionDrafts: [{ partId: target.id, hiddenCompletion: { assetStatus: "ready", assetId: asset.id } }],
      },
    },
    ...patch,
  };
}

function renderContext(state) {
  return {
    state,
    parts: state.parts,
    t: 0,
    matrixCache: new Map(),
    worldMatrix: () => ({ a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }),
  };
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

test("hidden completion render hides a patch when its supplemental part is visible", () => {
  const Animotion = loadRenderAnimotion();
  const asset = Animotion.hiddenCompletionAssets.normalizeAsset({
    id: "hidden-body",
    type: "hiddenCompletionPatch",
    sourcePartId: "body",
    completionMethod: "symmetry",
    symmetrySource: { counterpartPartId: "body-ref" },
  });
  const state = {
    parts: [{ id: "body" }, { id: "supp-hidden-body", isSupplementalPart: true, sourcePatchAssetId: asset.id, hidden: false }],
    project: { assets: [asset] },
    cutsceneBridge: {
      jointAction: {
        hiddenCompletionDrafts: [{ partId: "body", hiddenCompletion: { assetStatus: "ready", assetId: asset.id } }],
      },
    },
  };
  Animotion.hiddenCompletionSupplementalPart = {
    hasVisiblePartForPatch: (parts, assetId) => parts.some((part) => part.isSupplementalPart && part.sourcePatchAssetId === assetId && !part.hidden),
  };

  assert.equal(Animotion.hiddenCompletionRender.linkedSymmetryAsset({ id: "body" }, { state }), null);
  state.parts[1].hidden = true;
  assert.equal(Animotion.hiddenCompletionRender.linkedSymmetryAsset({ id: "body" }, { state }).id, asset.id);
});

test("direct body patch render matches supplemental counterpart-canvas sampling", () => {
  const Animotion = loadRenderAnimotion();
  const target = { id: "body", rect: { x: 40, y: 30, w: 80, h: 100 } };
  const counterpart = { id: "body_ref", rect: { x: 110, y: 30, w: 80, h: 100 }, canvas: { id: "body-ref-canvas" } };
  const asset = Animotion.hiddenCompletionAssets.normalizeAsset({
    id: "hidden-body-symmetry",
    type: "hiddenCompletionPatch",
    sourcePartId: target.id,
    guide: {
      silhouetteVerticesNormalized: [
        { xNorm: 0, yNorm: 0 },
        { xNorm: 0.5, yNorm: 0 },
        { xNorm: 0.5, yNorm: 1 },
        { xNorm: 0, yNorm: 1 },
      ],
    },
    completionMethod: "symmetry",
    symmetrySource: { counterpartPartId: counterpart.id, targetPartId: target.id },
  });
  const ctx = recordingContext();
  const state = readyRenderState(target, counterpart, asset, { image: { id: "source-image", naturalWidth: 200, naturalHeight: 160 } });

  const result = Animotion.hiddenCompletionRender.drawForPart(ctx, target, renderContext(state));

  const draw = ctx.__ops.find((op) => op.name === "drawImage");
  assert.equal(result.ok, true);
  assert.equal(draw.args[0].id, "body-ref-canvas");
  assert.equal(draw.args[3], 88);
  assert.equal(draw.args[4], 108);
  assert.deepEqual(JSON.parse(JSON.stringify(result.drawnBounds)), { x: 36, y: 26, w: 88, h: 108 });
});

test("expanded upperArm patch render matches supplemental source-image sampling", () => {
  const Animotion = loadRenderAnimotion();
  const target = { id: "rearupperarm", rect: { x: 30, y: 42, w: 28, h: 36 } };
  const counterpart = { id: "frontupperarm", rect: { x: 122, y: 42, w: 28, h: 36 }, canvas: { id: "front-canvas" } };
  const asset = Animotion.hiddenCompletionAssets.normalizeAsset({
    id: "hidden-rearupperarm-symmetry",
    type: "hiddenCompletionPatch",
    sourcePartId: target.id,
    guide: {
      silhouetteVerticesNormalized: [
        { xNorm: -0.25, yNorm: 0 },
        { xNorm: 1.25, yNorm: 0 },
        { xNorm: 1.25, yNorm: 1 },
        { xNorm: -0.25, yNorm: 1 },
      ],
    },
    completionMethod: "symmetry",
    symmetrySource: { counterpartPartId: counterpart.id, targetPartId: target.id },
  });
  const ctx = recordingContext();
  const state = readyRenderState(target, counterpart, asset, { image: { id: "source-image", naturalWidth: 200, naturalHeight: 160 } });

  const result = Animotion.hiddenCompletionRender.drawForPart(ctx, target, renderContext(state));

  const draw = ctx.__ops.find((op) => op.name === "drawImage");
  assert.equal(result.ok, true);
  assert.equal(draw.args[0].id, "source-image");
  assert.equal(draw.args[1], 111);
  assert.equal(draw.args[2], 38);
  assert.equal(draw.args[3], 50);
  assert.equal(draw.args[4], 44);
  assert.equal(draw.args[5], -37.5);
  assert.equal(draw.args[6], -22);
  assert.equal(draw.args[7], 75);
  assert.equal(draw.args[8], 44);
  assert.deepEqual(JSON.parse(JSON.stringify(result.drawnBounds)), { x: 19, y: 38, w: 50, h: 44 });
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
