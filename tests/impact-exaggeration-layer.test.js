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
  const context = { window: { Animotion: { state: {} } } };
  vm.createContext(context);
  for (const path of [
    "scripts/config.js",
    "scripts/coordinate-spaces.js",
    "scripts/human-rig-schema.js",
    "scripts/hidden-completion-assets.js",
    "scripts/motion-model.js",
    "scripts/motion-hints.js",
    "scripts/motion-drafts.js",
    "scripts/motion-target-state.js",
    "scripts/motion-target-debug.js",
    "scripts/pose-assist.js",
    "scripts/action-specs.js",
    "scripts/action-timeline-model.js",
    "scripts/impact-exaggeration-layer.js",
    "scripts/joint-coordinates.js",
    "scripts/cutscene-model.js",
    "scripts/motion-anchors.js",
    "scripts/motion-track-builder.js",
    "scripts/boxing-step-locomotion.js",
    "scripts/motion-planner.js",
    "scripts/project-model.js",
    "scripts/project-serialization.js",
  ]) runScript(context, path);
  return context.window.Animotion;
}

function runScript(context, path) {
  vm.runInContext(fs.readFileSync(path, "utf8"), context, { filename: path });
}

test("impact exaggeration normalizes layer fields and clamps unsafe values", () => {
  const model = loadAnimotion().impactExaggerationLayer;
  const layer = model.normalizeImpactExaggerationLayer({
    frame: -4,
    holdFrames: 99,
    strength: 9,
    targetPartIds: ["hand", null, "foot"],
    scaleHints: [{ partId: "hand", scaleX: 9, scaleY: 0.1 }],
    stretchHints: [{ partId: "hand", axis: "z", amount: 4 }],
  });
  assert.equal(layer.frame, 1);
  assert.equal(layer.enabled, true);
  assert.equal(layer.holdFrames, 12);
  assert.equal(layer.strength, 2);
  assert.deepEqual(JSON.parse(JSON.stringify(layer.targetPartIds)), ["hand", "foot"]);
  assert.equal(layer.scaleHints[0].scaleX, 1.8);
  assert.equal(layer.scaleHints[0].scaleY, 0.5);
  assert.equal(layer.stretchHints[0].axis, "x");
  assert.equal(layer.stretchHints[0].amount, 0.5);
});

test("enabled false prevents preview exaggeration transform hints", () => {
  const model = loadAnimotion().impactExaggerationLayer;
  const hint = model.transformHintForPart({
    enabled: false,
    frame: 10,
    holdFrames: 2,
    strength: 1,
    targetPartIds: ["right-hand"],
    scaleHints: [{ partId: "right-hand", scaleX: 1.2, scaleY: 0.8 }],
    stretchHints: [{ partId: "right-hand", axis: "x", amount: 0.2 }],
  }, { id: "right-hand" }, 10);
  assert.equal(hint, null);
});

test("legacy impact exaggeration without enabled normalizes as enabled", () => {
  const model = loadAnimotion().impactExaggerationLayer;
  const layer = model.normalizeImpactExaggerationLayer({
    frame: 4,
    targetPartIds: ["right-hand"],
    scaleHints: [{ partId: "right-hand", scaleX: 1.2, scaleY: 0.8 }],
  });
  const hint = model.transformHintForPart(layer, { id: "right-hand" }, 4);
  assert.equal(layer.enabled, true);
  assert.equal(hint.scaleX, 1.2);
});

test("default punch impact exaggeration reads impact frame and prefers hand targets", () => {
  const Animotion = loadAnimotion();
  const timeline = Animotion.actionTimelineModel.timelineForTemplate("punch", { durationFrames: 36, impactFrame: 24 });
  const layer = Animotion.impactExaggerationLayer.createDefaultImpactExaggerationForActionTimeline(timeline, { parts: parts() });
  assert.equal(layer.frame, 24);
  assert.equal(layer.enabled, true);
  assert.deepEqual(JSON.parse(JSON.stringify(layer.targetPartIds)), ["right-hand"]);
  assert.equal(layer.stretchHints[0].axis, "x");
});

test("default kick impact exaggeration reads impact frame and prefers foot or shin targets", () => {
  const Animotion = loadAnimotion();
  const timeline = Animotion.actionTimelineModel.timelineForTemplate("kick", { durationFrames: 30, impactFrame: 20 });
  const layer = Animotion.impactExaggerationLayer.createDefaultImpactExaggerationForActionTimeline(timeline, { parts: parts() });
  assert.equal(layer.frame, 20);
  assert.deepEqual(JSON.parse(JSON.stringify(layer.targetPartIds)), ["right-foot"]);
  assert.equal(layer.stretchHints[0].axis, "y");
});

test("motion planner stores default impact exaggeration on punch and kick actions", () => {
  const Animotion = loadAnimotion();
  const bridge = Animotion.cutsceneModel.normalizeBridge({ durationFrames: 36, impactFrame: 24 });
  const punch = Animotion.motionPlanner.createPlan(parts(), "right-forearm", bridge, { template: "punch", target: { x: 190, y: 50 } });
  const kick = Animotion.motionPlanner.createPlan(parts(), "right-shin", bridge, { template: "kick", target: { x: 190, y: 100 } });
  assert.equal(punch.jointAction.impactExaggeration.frame, 24);
  assert.deepEqual(JSON.parse(JSON.stringify(punch.jointAction.impactExaggeration.targetPartIds)), ["right-hand"]);
  assert.deepEqual(JSON.parse(JSON.stringify(kick.jointAction.impactExaggeration.targetPartIds)), ["right-foot"]);
});

test("cutscene save load round trip preserves impact exaggeration metadata", () => {
  const Animotion = loadAnimotion();
  const bridge = Animotion.cutsceneModel.normalizeBridge({
    durationFrames: 36,
    impactFrame: 24,
    jointAction: {
      source: "test",
      actionTimeline: Animotion.actionTimelineModel.timelineForTemplate("punch", { durationFrames: 36, impactFrame: 24 }),
      impactExaggeration: { frame: 24, holdFrames: 3, strength: 1.4, targetPartIds: ["right-hand"], scaleHints: [{ partId: "right-hand", scaleX: 1.2, scaleY: 0.8 }] },
      beats: [{ id: "impact", at: 24, pose: { rHand: [190, 50] } }],
    },
  });
  const saved = Animotion.projectModel.projectFromEditorState({
    imageName: "impact.png",
    image: { naturalWidth: 200, naturalHeight: 160 },
    parts: parts(),
    currentFrame: 24,
    cutsceneBridge: bridge,
    project: { assets: [] },
  });
  const loaded = Animotion.projectModel.normalizeProject(JSON.parse(JSON.stringify(saved)), { imageBounds: { width: 200, height: 160 } });
  const restored = Animotion.cutsceneModel.normalizeBridge(loaded.editor.cutsceneBridge);
  assert.equal(restored.jointAction.impactExaggeration.frame, 24);
  assert.equal(restored.jointAction.impactExaggeration.holdFrames, 3);
  assert.equal(restored.jointAction.impactExaggeration.strength, 1.4);
  assert.equal(restored.jointAction.impactExaggeration.scaleHints[0].scaleX, 1.2);
});

test("toggling enabled preserves save load normalization", () => {
  const Animotion = loadAnimotion();
  const action = {
    source: "test",
    impactExaggeration: { enabled: false, frame: 24, targetPartIds: ["right-hand"] },
    beats: [{ id: "impact", at: 24, pose: { rHand: [190, 50] } }],
  };
  const bridge = Animotion.cutsceneModel.normalizeBridge({ durationFrames: 36, impactFrame: 24, jointAction: action });
  const saved = Animotion.projectModel.projectFromEditorState({
    imageName: "impact.png",
    image: { naturalWidth: 200, naturalHeight: 160 },
    parts: parts(),
    currentFrame: 24,
    cutsceneBridge: bridge,
    project: { assets: [] },
  });
  const loaded = Animotion.projectModel.normalizeProject(JSON.parse(JSON.stringify(saved)), { imageBounds: { width: 200, height: 160 } });
  const restored = Animotion.cutsceneModel.normalizeBridge(loaded.editor.cutsceneBridge);
  assert.equal(restored.jointAction.impactExaggeration.enabled, false);
});

test("impact exaggeration summary stays concise for the motion UI", () => {
  const Animotion = loadAnimotion();
  const text = Animotion.impactExaggerationLayer.summaryText({
    enabled: true,
    frame: 24,
    holdFrames: 6,
    strength: 1.8,
    targetPartIds: ["right-hand"],
  }, parts());
  assert.equal(text, "타격 과장 켜짐 · right-hand");
  assert.equal(text.includes("hold"), false);
  assert.equal(text.includes("strength"), false);
});

test("app shell exposes impact exaggeration status in the motion UI", () => {
  const html = fs.readFileSync("index.html", "utf8");
  const config = fs.readFileSync("scripts/config.js", "utf8");
  const ui = fs.readFileSync("scripts/ui.js", "utf8");
  assert.equal(html.includes('id="impactExaggerationStatus"'), true);
  assert.equal(html.includes('id="impactExaggerationEnabled"'), true);
  assert.equal(config.includes("impactExaggerationStatus"), true);
  assert.equal(config.includes("impactExaggerationEnabled"), true);
  assert.equal(ui.includes("renderImpactExaggerationStatus"), true);
  assert.equal(ui.includes("renderImpactExaggerationStatus"), true);
  assert.equal(ui.includes("impactExaggerationEnabled"), true);
});

function parts() {
  return [
    part("body", "body", "torso", 40, 20, 30, 70),
    part("right-forearm", "arm", "forearm", 80, 45, 36, 20),
    part("right-hand", "hand", "hand", 112, 45, 16, 16),
    part("right-shin", "leg", "shin", 70, 90, 20, 45),
    part("right-foot", "leg", "foot", 80, 130, 28, 14),
  ];
}

function part(id, type, humanRole, x, y, w, h) {
  return { id, name: id, type, humanRole, rect: { x, y, w, h }, pivot: { x: w * 0.2, y: h * 0.2 }, joint: { x: w * 0.8, y: h * 0.8 }, customMotion: {}, keyframes: [] };
}
