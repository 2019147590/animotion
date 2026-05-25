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
    "scripts/hidden-completion-supplemental-coverage.js",
    "scripts/hidden-completion-supplemental-part.js",
  ]) vm.runInContext(fs.readFileSync(path, "utf8"), context, { filename: path });
  const Animotion = context.window.Animotion;
  Animotion.state = stateFixture(Animotion);
  Animotion.imageBounds = () => ({ width: 200, height: 160 });
  Animotion.parts = { selectedPart: () => Animotion.state.parts.find((part) => part.id === Animotion.state.selectedPartId) || null };
  return Animotion;
}

function fakeCanvas(width = 1, height = 1) {
  const ops = [];
  return {
    width,
    height,
    __ops: ops,
    getContext: () => ({
      save() {},
      restore() {},
      translate() {},
      rotate() {},
      scale() {},
      drawImage(...args) { ops.push({ name: "drawImage", args }); },
    }),
  };
}

function stateFixture(Animotion) {
  const source = part("body", { x: 40, y: 30, w: 80, h: 100 });
  const counterpart = part("body_ref", { x: 110, y: 30, w: 80, h: 100 });
  const asset = Animotion.hiddenCompletionAssets.normalizeAsset({
    id: "hidden-body-symmetry",
    type: "hiddenCompletionPatch",
    sourcePartId: source.id,
    guide: {
      silhouetteVerticesNormalized: [{ xNorm: 0, yNorm: 0 }, { xNorm: 0.5, yNorm: 0 }, { xNorm: 0.5, yNorm: 1 }, { xNorm: 0, yNorm: 1 }],
    },
    completionMethod: "symmetry",
    symmetrySource: { counterpartPartId: counterpart.id, targetPartId: source.id, targetRegion: "left", sourceRegion: "right" },
  });
  const draft = Animotion.motionDrafts.normalize({
    partId: source.id,
    hiddenCompletion: { needed: true, assetKind: "hiddenCompletionPatch", assetStatus: "ready", assetId: asset.id },
  }, { assets: [asset] });
  return {
    image: { id: "source-image", naturalWidth: 200, naturalHeight: 160 },
    parts: [source, counterpart],
    selectedPartId: source.id,
    project: { assets: [asset], parts: [] },
    cutsceneBridge: { jointAction: { source: "manual-cutscene", hiddenCompletionDrafts: [draft] } },
  };
}

function part(id, rect) {
  return {
    id,
    name: id,
    type: "body",
    humanRole: "torso",
    rect,
    sourceRect: rect,
    pivot: { x: rect.w * 0.5, y: rect.h * 0.25 },
    joint: { x: rect.w * 0.5, y: rect.h * 0.85 },
    order: 4,
    layerIndex: 4,
    canvas: fakeCanvas(),
  };
}

test("patch transform sync regenerates the linked supplemental part canvas", () => {
  const Animotion = loadAnimotion();
  const inserted = Animotion.hiddenCompletionSupplementalPart.insertForSelectedLinkedPatch(Animotion.state).part;
  const oldCanvas = inserted.canvas;
  const asset = {
    ...Animotion.state.project.assets[0],
    patchTransform: { translationNormalized: { xNorm: -0.25, yNorm: 0.2 }, scaleX: 1.2, scaleY: 0.85, rotation: 6 },
  };

  const result = Animotion.hiddenCompletionSupplementalPart.syncPartForPatch(asset, Animotion.state, { regenerateCanvas: true });

  assert.equal(result.ok, true);
  assert.notEqual(result.part.canvas, oldCanvas);
  assert.equal(result.part.canvas.__sourceSamplingPath, "counterpart-part-canvas");
  assert.equal(result.part.canvas.__ops.some((op) => op.name === "drawImage"), true);
  assert.equal(Animotion.state.parts.find((part) => part.id === inserted.id).canvas, result.part.canvas);
});
