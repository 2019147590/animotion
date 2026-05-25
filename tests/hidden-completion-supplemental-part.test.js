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
  const context = { window: { Animotion: { state: {} } }, document: { createElement: () => fakeCanvas() } };
  vm.createContext(context);
  for (const path of [
    "scripts/coordinate-spaces.js",
    "scripts/geometry.js",
    "scripts/motion-model.js",
    "scripts/human-rig-schema.js",
    "scripts/rig-connection.js",
    "scripts/hidden-completion-coverage-bounds.js",
    "scripts/hidden-completion-assets.js",
    "scripts/motion-drafts.js",
    "scripts/motion-draft-action-store.js",
    "scripts/cutscene-action-selectors.js",
    "scripts/project-model.js",
    "scripts/project-serialization.js",
    "scripts/hidden-completion-supplemental-coverage.js",
    "scripts/hidden-completion-supplemental-part.js",
    "scripts/hidden-completion-supplemental-project.js",
  ]) runScript(context, path);
  const Animotion = context.window.Animotion;
  Animotion.state = stateFixture(Animotion);
  Animotion.imageBounds = () => ({ width: 200, height: 160 });
  Animotion.parts = {
    selectedPart: () => Animotion.state.parts.find((part) => part.id === Animotion.state.selectedPartId) || null,
    updatePartCanvas(part) { part.canvas = fakeCanvas(); },
  };
  Animotion.partCommands = historyCommands(Animotion);
  return Animotion;
}

function runScript(context, path) {
  vm.runInContext(fs.readFileSync(path, "utf8"), context, { filename: path });
}

function fakeCanvas(width = 1, height = 1, patch = {}) {
  const ops = [];
  return {
    width,
    height,
    __ops: ops,
    getContext: () => ({
      save() {},
      restore() {},
      beginPath() {},
      moveTo() {},
      lineTo() {},
      closePath() {},
      clip() {},
      translate() {},
      rotate() {},
      scale() {},
      drawImage(...args) { ops.push({ name: "drawImage", args }); },
    }),
    ...patch,
  };
}

function stateFixture(Animotion) {
  const source = part("body", "body", { x: 40, y: 30, w: 80, h: 100 }, { humanRole: "torso" });
  const counterpart = part("body_ref", "body", { x: 110, y: 30, w: 80, h: 100 }, { humanRole: "torso" });
  const asset = Animotion.hiddenCompletionAssets.normalizeAsset({
    id: "hidden-body-symmetry",
    type: "hiddenCompletionPatch",
    sourcePartId: source.id,
    sourceRectNormalized: { xNorm: 0.2, yNorm: 0.1875, wNorm: 0.4, hNorm: 0.625 },
    guide: {
      silhouetteVerticesNormalized: [{ xNorm: 0, yNorm: 0 }, { xNorm: 0.5, yNorm: 0 }, { xNorm: 0.5, yNorm: 1 }, { xNorm: 0, yNorm: 1 }],
      meshVerticesNormalized: [{ xNorm: 0, yNorm: 0 }, { xNorm: 0.5, yNorm: 0 }, { xNorm: 0.5, yNorm: 1 }, { xNorm: 0, yNorm: 1 }],
    },
    completionMethod: "symmetry",
    symmetrySource: {
      counterpartPartId: counterpart.id,
      targetPartId: source.id,
      targetRegion: "left",
      sourceRegion: "right",
      confidence: 0.82,
    },
  });
  const draft = Animotion.motionDrafts.normalize({
    partId: source.id,
    hiddenCompletion: { needed: true, assetKind: "hiddenCompletionPatch", assetStatus: "ready", assetId: asset.id },
  }, { assets: [asset] });
  const project = Animotion.projectModel.createEmptyProject({ canvas: { width: 200, height: 160 } });
  project.assets = [asset];
  return {
    image: { id: "source-image", naturalWidth: 200, naturalHeight: 160 },
    imageName: "source.png",
    parts: [source, counterpart],
    selectedPartId: source.id,
    project,
    cutsceneBridge: { jointAction: { source: "manual-cutscene", beats: [{ id: "impact", at: 12, pose: { p: [1, 2] } }], hiddenCompletionDrafts: [draft] } },
    currentFrame: 1,
  };
}

function part(id, type, rect, patch = {}) {
  return {
    id,
    name: id,
    type,
    rect,
    sourceRect: rect,
    pivot: { x: rect.w * 0.5, y: rect.h * 0.25 },
    joint: { x: rect.w * 0.5, y: rect.h * 0.85 },
    order: 4,
    layerIndex: 4,
    alpha: 1,
    opacity: 1,
    mask: { kind: "rect", points: [{ x: 0, y: 0 }, { x: rect.w, y: 0 }, { x: rect.w, y: rect.h }, { x: 0, y: rect.h }] },
    customMotion: {},
    keyframes: [],
    canvas: fakeCanvas(),
    ...patch,
  };
}

function historyCommands(Animotion) {
  let before = null, after = null;
  return {
    historySnapshot: () => ({ selectedPartId: Animotion.state.selectedPartId, parts: Animotion.state.parts.map(({ canvas, ...rest }) => JSON.parse(JSON.stringify(rest))) }),
    recordHistorySnapshot: (label, nextBefore, nextAfter) => { before = nextBefore; after = nextAfter; return { label, before, after }; },
    lastHistory: () => ({ before, after }),
  };
}

test("ready symmetry hiddenCompletionPatch creates a supplemental part payload", () => {
  const Animotion = loadAnimotion();
  const asset = Animotion.state.project.assets[0];

  const result = Animotion.hiddenCompletionSupplementalPart.payloadFromPatch(asset, Animotion.state.parts, { imageBounds: Animotion.imageBounds(), actionId: "manual-cutscene" });

  assert.equal(result.ok, true);
  assert.equal(result.part.isSupplementalPart, true);
  assert.equal(result.part.supplementalKind, "hiddenCompletionSymmetry");
  assert.equal(result.part.sourcePatchAssetId, asset.id);
  assert.equal(result.part.sourcePartId, "body");
  assert.equal(result.part.counterpartPartId, "body_ref");
  assert.equal(result.part.targetRegion, "left");
  assert.equal(result.part.sourceRegion, "right");
  assert.equal(result.part.originalPatchAssetType, "hiddenCompletionPatch");
  assert.equal(result.part.mask.points[2].x, 44);
  assert.equal(result.part.canvas.width, 88);
  assert.equal(result.part.canvas.__sourceSamplingPath, "counterpart-part-canvas");
  assert.equal(result.part.supplementalCoverage.warnings.includes("canvas-opaque-bounds-too-small"), false);
});

test("button path inserts supplemental part selects it and preserves patch links", () => {
  const Animotion = loadAnimotion();
  const beforeAssetCount = Animotion.state.project.assets.length;
  const beforeDrafts = JSON.stringify(Animotion.state.cutsceneBridge.jointAction.hiddenCompletionDrafts);

  const result = Animotion.hiddenCompletionSupplementalPart.insertForSelectedLinkedPatch(Animotion.state);

  assert.equal(result.ok, true);
  assert.equal(Animotion.state.parts.length, 3);
  assert.equal(Animotion.state.selectedPartId, result.part.id);
  assert.equal(Animotion.state.project.assets.length, beforeAssetCount);
  assert.equal(JSON.stringify(Animotion.state.cutsceneBridge.jointAction.hiddenCompletionDrafts), beforeDrafts);
  assert.equal(Animotion.partCommands.lastHistory().after.parts.length, 3);
});

test("same patchAssetId does not create duplicate supplemental parts", () => {
  const Animotion = loadAnimotion();
  const first = Animotion.hiddenCompletionSupplementalPart.insertForSelectedLinkedPatch(Animotion.state);
  Animotion.state.selectedPartId = "body";
  const second = Animotion.hiddenCompletionSupplementalPart.insertForSelectedLinkedPatch(Animotion.state);

  assert.equal(first.ok, true);
  assert.equal(second.ok, true);
  assert.equal(second.duplicate, true);
  assert.equal(Animotion.state.parts.filter((part) => part.sourcePatchAssetId === "hidden-body-symmetry").length, 1);
  assert.equal(Animotion.state.selectedPartId, first.part.id);
});

test("all linked ready symmetry patches insert body and upper arm supplemental parts together", () => {
  const Animotion = loadAnimotion();
  const upper = part("upper", "arm", { x: 20, y: 40, w: 34, h: 28 }, { humanRole: "upperArm" });
  const upperRef = part("upper_ref", "arm", { x: 130, y: 40, w: 34, h: 28 }, { humanRole: "upperArm" });
  const asset = Animotion.hiddenCompletionAssets.normalizeAsset({
    id: "hidden-upper-symmetry",
    type: "hiddenCompletionPatch",
    sourcePartId: upper.id,
    sourceRectNormalized: { xNorm: 0.1, yNorm: 0.25, wNorm: 0.17, hNorm: 0.175 },
    guide: {
      silhouetteVerticesNormalized: [{ xNorm: 0, yNorm: 0 }, { xNorm: 1, yNorm: 0 }, { xNorm: 1, yNorm: 1 }, { xNorm: 0, yNorm: 1 }],
    },
    completionMethod: "symmetry",
    symmetrySource: { counterpartPartId: upperRef.id, targetPartId: upper.id, targetRegion: "front", sourceRegion: "rear" },
  });
  Animotion.state.parts.push(upper, upperRef);
  Animotion.state.project.assets.push(asset);
  Animotion.state.cutsceneBridge.jointAction.hiddenCompletionDrafts.push(
    Animotion.motionDrafts.normalize({
      partId: upper.id,
      hiddenCompletion: { needed: true, assetKind: "hiddenCompletionPatch", assetStatus: "ready", assetId: asset.id },
    }, { assets: Animotion.state.project.assets })
  );

  const result = Animotion.hiddenCompletionSupplementalPart.insertAllLinkedPatches(Animotion.state);

  assert.equal(result.ok, true);
  assert.equal(result.inserted.length, 2);
  assert.equal(Animotion.state.parts.some((item) => item.sourcePatchAssetId === "hidden-body-symmetry"), true);
  assert.equal(Animotion.state.parts.some((item) => item.sourcePatchAssetId === "hidden-upper-symmetry"), true);
  assert.equal(Animotion.state.parts.filter((item) => item.isSupplementalPart).length, 2);
  assert.equal(Animotion.partCommands.lastHistory().after.parts.filter((item) => item.isSupplementalPart).length, 2);
});

test("active linked patch prefers selected part draft over legacy action motionDraft", () => {
  const Animotion = loadAnimotion();
  const upper = part("upper", "arm", { x: 20, y: 40, w: 34, h: 28 }, { humanRole: "upperArm" });
  const upperRef = part("upper_ref", "arm", { x: 130, y: 40, w: 34, h: 28 }, { humanRole: "upperArm" });
  const asset = Animotion.hiddenCompletionAssets.normalizeAsset({
    id: "hidden-upper-symmetry",
    type: "hiddenCompletionPatch",
    sourcePartId: upper.id,
    sourceRectNormalized: { xNorm: 0.1, yNorm: 0.25, wNorm: 0.17, hNorm: 0.175 },
    guide: {
      silhouetteVerticesNormalized: [{ xNorm: 0, yNorm: 0 }, { xNorm: 1, yNorm: 0 }, { xNorm: 1, yNorm: 1 }, { xNorm: 0, yNorm: 1 }],
    },
    completionMethod: "symmetry",
    symmetrySource: { counterpartPartId: upperRef.id, targetPartId: upper.id },
  });
  Animotion.state.parts.push(upper, upperRef);
  Animotion.state.project.assets.push(asset);
  Animotion.state.cutsceneBridge.jointAction.motionDraft = Animotion.motionDrafts.normalize({
    partId: "body",
    hiddenCompletion: { needed: true, status: "candidate", assetKind: "hiddenCompletionPatch", assetStatus: "ready", assetId: "hidden-body-symmetry" },
  }, { assets: Animotion.state.project.assets });
  Animotion.state.cutsceneBridge.jointAction.hiddenCompletionDrafts.push(
    Animotion.motionDrafts.normalize({
      partId: "upper",
      hiddenCompletion: { needed: true, status: "candidate", assetKind: "hiddenCompletionPatch", assetStatus: "ready", assetId: "hidden-upper-symmetry" },
    }, { assets: Animotion.state.project.assets })
  );

  Animotion.state.selectedPartId = "body";
  assert.equal(Animotion.hiddenCompletionSupplementalPart.activeLinkedSymmetryPatch(Animotion.state).asset.id, "hidden-body-symmetry");
  Animotion.state.selectedPartId = "upper";
  assert.equal(Animotion.hiddenCompletionSupplementalPart.activeLinkedSymmetryPatch(Animotion.state).asset.id, "hidden-upper-symmetry");
});

test("patch guide changes sync the linked supplemental part region", () => {
  const Animotion = loadAnimotion();
  const inserted = Animotion.hiddenCompletionSupplementalPart.insertForSelectedLinkedPatch(Animotion.state).part;
  const canvas = inserted.canvas;
  const asset = {
    ...Animotion.state.project.assets[0],
    guide: {
      ...Animotion.state.project.assets[0].guide,
      silhouetteVerticesNormalized: [{ xNorm: 0.25, yNorm: 0 }, { xNorm: 0.75, yNorm: 0 }, { xNorm: 0.75, yNorm: 1 }, { xNorm: 0.25, yNorm: 1 }],
    },
  };

  const result = Animotion.hiddenCompletionSupplementalPart.syncPartForPatch(asset, Animotion.state);

  assert.equal(result.ok, true);
  assert.equal(result.part.id, inserted.id);
  assert.equal(result.part.canvas, canvas);
  assert.equal(Animotion.state.parts.filter((part) => part.sourcePatchAssetId === asset.id).length, 1);
  assert.deepEqual(JSON.parse(JSON.stringify(result.part.mask.points)), [
    { x: 24, y: 4 },
    { x: 64, y: 4 },
    { x: 64, y: 104 },
    { x: 24, y: 104 },
  ]);
});

test("patch mask outside source rect expands supplemental rect and keeps mask local", () => {
  const Animotion = loadAnimotion();
  const asset = {
    ...Animotion.state.project.assets[0],
    guide: {
      ...Animotion.state.project.assets[0].guide,
      silhouetteVerticesNormalized: [{ xNorm: -0.25, yNorm: 0 }, { xNorm: 1.25, yNorm: 0 }, { xNorm: 1.25, yNorm: 1 }, { xNorm: -0.25, yNorm: 1 }],
    },
  };

  const result = Animotion.hiddenCompletionSupplementalPart.payloadFromPatch(asset, Animotion.state.parts, { imageBounds: Animotion.imageBounds() });

  assert.equal(result.ok, true);
  assert.deepEqual(JSON.parse(JSON.stringify(result.part.rect)), { x: 16, y: 26, w: 128, h: 108 });
  assert.deepEqual(JSON.parse(JSON.stringify(result.part.mask.points)), [
    { x: 4, y: 4 },
    { x: 124, y: 4 },
    { x: 124, y: 104 },
    { x: 4, y: 104 },
  ]);
  assert.equal(result.part.supplementalCoverage.warnings.includes("mask-outside-supplemental-rect"), false);
});

test("expanded hidden completion samples counterpart surroundings from the source image", () => {
  const Animotion = loadAnimotion();
  const asset = {
    ...Animotion.state.project.assets[0],
    guide: {
      ...Animotion.state.project.assets[0].guide,
      silhouetteVerticesNormalized: [{ xNorm: -0.25, yNorm: 0 }, { xNorm: 1.25, yNorm: 0 }, { xNorm: 1.25, yNorm: 1 }, { xNorm: -0.25, yNorm: 1 }],
    },
  };

  const result = Animotion.hiddenCompletionSupplementalPart.payloadFromPatch(asset, Animotion.state.parts, { imageBounds: Animotion.imageBounds() });

  assert.equal(result.ok, true);
  assert.equal(result.part.canvas.__sourceSamplingPath, "expanded-source-image-counterpart");
  assert.deepEqual(JSON.parse(JSON.stringify(result.part.canvas.__counterpartSamplingRect)), { x: 86, y: 26, w: 114, h: 108 });
  assert.equal(result.part.canvas.__ops.some((op) => op.name === "drawImage" && op.args[0].id === "source-image"), true);
});

test("upperArm supplemental does not invent context geometry without an expanded guide", () => {
  const Animotion = loadAnimotion();
  const source = part("rearupperarm", "arm", { x: 30, y: 42, w: 28, h: 36 }, { humanRole: "upperArm" });
  const counterpart = part("frontupperarm", "arm", { x: 122, y: 42, w: 28, h: 36 }, { humanRole: "upperArm" });
  const asset = Animotion.hiddenCompletionAssets.normalizeAsset({
    id: "hidden-rearupperarm-symmetry",
    type: "hiddenCompletionPatch",
    sourcePartId: source.id,
    guide: {
      silhouetteVerticesNormalized: [{ xNorm: 0, yNorm: 0 }, { xNorm: 1, yNorm: 0 }, { xNorm: 1, yNorm: 1 }, { xNorm: 0, yNorm: 1 }],
    },
    completionMethod: "symmetry",
    symmetrySource: { counterpartPartId: counterpart.id, targetPartId: source.id },
  });

  const result = Animotion.hiddenCompletionSupplementalPart.payloadFromPatch(asset, [source, counterpart], { imageBounds: Animotion.imageBounds() });

  assert.equal(result.ok, true);
  assert.deepEqual(JSON.parse(JSON.stringify(result.part.rect)), { x: 26, y: 38, w: 36, h: 44 });
  assert.equal(result.part.mask.points[0].x, source.rect.x - result.part.rect.x);
  assert.equal(result.part.mask.points[0].y, source.rect.y - result.part.rect.y);
  assert.equal(result.part.mask.points[2].x - result.part.mask.points[0].x, source.rect.w);
  assert.equal(result.part.mask.points[2].y - result.part.mask.points[0].y, source.rect.h);
  assert.equal(result.part.canvas.__sourceSamplingPath, "expanded-source-image-counterpart");
  assert.equal(result.part.canvas.__ops.some((op) => op.name === "drawImage" && op.args[0].id === "source-image"), true);
});

test("upperArm supplemental follows expanded user guide outside the source boundary", () => {
  const Animotion = loadAnimotion();
  const source = part("rearupperarm", "arm", { x: 30, y: 42, w: 28, h: 36 }, { humanRole: "upperArm" });
  const counterpart = part("frontupperarm", "arm", { x: 122, y: 42, w: 28, h: 36 }, { humanRole: "upperArm" });
  const asset = Animotion.hiddenCompletionAssets.normalizeAsset({
    id: "hidden-rearupperarm-symmetry",
    type: "hiddenCompletionPatch",
    sourcePartId: source.id,
    guide: {
      silhouetteVerticesNormalized: [{ xNorm: -0.25, yNorm: 0 }, { xNorm: 1.25, yNorm: 0 }, { xNorm: 1.25, yNorm: 1 }, { xNorm: -0.25, yNorm: 1 }],
    },
    completionMethod: "symmetry",
    symmetrySource: { counterpartPartId: counterpart.id, targetPartId: source.id },
  });

  const result = Animotion.hiddenCompletionSupplementalPart.payloadFromPatch(asset, [source, counterpart], { imageBounds: Animotion.imageBounds() });

  assert.equal(result.ok, true);
  assert.deepEqual(JSON.parse(JSON.stringify(result.part.rect)), { x: 19, y: 38, w: 50, h: 44 });
  assert.deepEqual(JSON.parse(JSON.stringify(result.part.mask.points)), [
    { x: 4, y: 4 },
    { x: 46, y: 4 },
    { x: 46, y: 40 },
    { x: 4, y: 40 },
  ]);
  assert.equal(result.part.canvas.__sourceSamplingPath, "expanded-source-image-counterpart");
  assert.deepEqual(JSON.parse(JSON.stringify(result.part.canvas.__counterpartMaterialBounds)), { x: 4, y: 4, w: 42, h: 36 });
  const draw = result.part.canvas.__ops.find((op) => op.name === "drawImage" && op.args[0].id === "source-image");
  assert.equal(draw.args[5], -37.5);
  assert.equal(draw.args[6], -22);
  assert.equal(draw.args[7], 75);
  assert.equal(draw.args[8], 44);
});

test("canvas opaque bounds too small reports supplemental coverage warning", () => {
  const Animotion = loadAnimotion();
  const result = Animotion.hiddenCompletionSupplementalPart.payloadFromPatch(Animotion.state.project.assets[0], Animotion.state.parts, { imageBounds: Animotion.imageBounds() });
  result.part.canvas = fakeCanvas(80, 100, { __opaqueBounds: { x: 0, y: 0, w: 20, h: 100 } });

  const coverage = Animotion.hiddenCompletionSupplementalPart.coverageForPart(result.part);

  assert.equal(coverage.warnings.includes("canvas-opaque-bounds-too-small"), true);
  assert.equal(coverage.coverageRatio < 0.6, true);
  assert.deepEqual(JSON.parse(JSON.stringify(coverage.canvasOpaqueBounds)), { x: 0, y: 0, w: 22, h: 108 });
});

test("sourceRect smaller than supplemental mask reports source rect coverage warning", () => {
  const Animotion = loadAnimotion();
  const result = Animotion.hiddenCompletionSupplementalPart.payloadFromPatch(Animotion.state.project.assets[0], Animotion.state.parts, { imageBounds: Animotion.imageBounds() });
  result.part.sourceRect = { x: 40, y: 30, w: 20, h: 100 };

  const coverage = Animotion.hiddenCompletionSupplementalPart.coverageForPart(result.part);

  assert.equal(coverage.warnings.includes("source-rect-too-small"), true);
});

test("legacy createdFromJointActionId does not hide another action patch", () => {
  const Animotion = loadAnimotion();
  const asset = Animotion.state.project.assets[0];
  Animotion.state.parts.push({
    id: "supp-hidden-body",
    isSupplementalPart: true,
    sourcePatchAssetId: asset.id,
    sourcePartId: "body",
    createdFromJointActionId: "action-a",
    hidden: false,
  });

  assert.equal(Animotion.hiddenCompletionSupplementalPart.hasVisiblePartForPatch(Animotion.state.parts, asset.id, { actionId: "action-a" }), true);
  assert.equal(Animotion.hiddenCompletionSupplementalPart.hasVisiblePartForPatch(Animotion.state.parts, asset.id, { actionId: "action-b" }), false);
  assert.equal(Animotion.hiddenCompletionSupplementalPart.hasVisiblePartForPatch(Animotion.state.parts, asset.id, {}), true);
});

test("supplemental metadata parent layer pivot joint and mask survive save load save", () => {
  const Animotion = loadAnimotion();
  Animotion.hiddenCompletionSupplementalPart.insertForSelectedLinkedPatch(Animotion.state);
  const firstSave = Animotion.projectModel.projectFromEditorState(Animotion.state);
  firstSave.parts.find((part) => part.isSupplementalPart).supplementalMaskScale = 0.8;
  const loaded = Animotion.projectModel.normalizeProject(JSON.parse(JSON.stringify(firstSave)), { imageBounds: Animotion.imageBounds() });
  const loadedParts = Animotion.projectModel.editorPartsFromProject(loaded);
  const secondSave = Animotion.projectModel.projectFromEditorState({ ...Animotion.state, project: loaded, parts: loadedParts });
  const supplemental = secondSave.parts.find((part) => part.isSupplementalPart);

  assert.equal(supplemental.sourcePatchAssetId, "hidden-body-symmetry");
  assert.equal(supplemental.sourcePartId, "body");
  assert.equal(supplemental.counterpartPartId, "body_ref");
  assert.equal(supplemental.parentId, "body");
  assert.equal(supplemental.layerIndex, 5);
  assert.equal(supplemental.pivot.x, 40);
  assert.equal(supplemental.joint.y, 85);
  assert.equal(supplemental.mask.points.length, 4);
  assert.equal(supplemental.supplementalMaskScale, 0.8);
  assert.equal(secondSave.assets.some((asset) => asset.id === "hidden-body-symmetry"), true);
});

test("old JSON load does not auto-create supplemental parts", () => {
  const Animotion = loadAnimotion();
  const saved = Animotion.projectModel.projectFromEditorState(Animotion.state);
  const loaded = Animotion.projectModel.normalizeProject(JSON.parse(JSON.stringify(saved)), { imageBounds: Animotion.imageBounds() });
  const loadedParts = Animotion.projectModel.editorPartsFromProject(loaded);

  assert.equal(loadedParts.some((part) => part.isSupplementalPart), false);
  assert.equal(loadedParts.length, 2);
});
