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
    "scripts/motion-model.js",
    "scripts/motion-hints.js",
    "scripts/motion-drafts.js",
    "scripts/motion-target-state.js",
    "scripts/motion-target-debug.js",
    "scripts/character-root-motion.js",
    "scripts/pose-assist.js",
    "scripts/joint-coordinates.js",
    "scripts/cutscene-action-selectors.js",
    "scripts/cutscene-model.js",
    "scripts/motion-anchors.js",
    "scripts/action-specs.js",
    "scripts/action-timeline-model.js",
    "scripts/impact-exaggeration-layer.js",
    "scripts/arm-extension-controls.js",
    "scripts/arm-extension.js",
    "scripts/motion-track-builder.js",
    "scripts/boxing-step-locomotion.js",
    "scripts/motion-planner.js",
    "scripts/action-frame-editor.js",
    "scripts/cutscene-motion-status.js",
  ]) runScript(context, path);
  return context.window.Animotion;
}

function runScript(context, path) {
  vm.runInContext(fs.readFileSync(path, "utf8"), context, { filename: path });
}

function punchBridge(Animotion) {
  const bridge = Animotion.cutsceneModel.normalizeBridge({ durationFrames: 36, impactFrame: 24, primaryPartId: "arm" });
  const result = Animotion.motionPlanner.createPlan(parts(), "arm", bridge, { template: "punch", target: { x: 160, y: 30 } });
  return { ...bridge, jointAction: result.jointAction };
}

function boxingStepBridge(Animotion) {
  const bridge = Animotion.cutsceneModel.normalizeBridge({
    durationFrames: 16,
    impactFrame: 16,
    primaryPartId: "body",
    effectDirection: { x: 1, y: 0 },
  });
  const result = Animotion.motionPlanner.createPlan(parts(), "body", bridge, { template: "boxingStep" });
  return { ...bridge, jointAction: result.jointAction };
}

function parts() {
  return [
    { id: "body", type: "body", humanRole: "torso", rect: { x: 40, y: 20, w: 20, h: 50 }, pivot: { x: 10, y: 25 }, joint: { x: 10, y: 40 } },
    { id: "head", type: "head", humanRole: "head", rect: { x: 38, y: 4, w: 24, h: 20 }, pivot: { x: 12, y: 10 }, joint: { x: 12, y: 16 } },
    { id: "arm", type: "arm", humanRole: "forearm", rect: { x: 64, y: 28, w: 18, h: 32 }, pivot: { x: 2, y: 6 }, joint: { x: 16, y: 24 } },
  ];
}

test("punch generation exposes ordered selectable action frames", () => {
  const Animotion = loadAnimotion();
  const frames = Animotion.actionFrameEditor.framesForBridge(punchBridge(Animotion));
  const ids = frames.map((frame) => frame.normalizedId);
  assert.equal(ids.includes("windup"), true);
  assert.equal(ids.includes("impact"), true);
  assert.equal(ids.includes("recover"), true);
  assert.equal(frames.every((frame) => Number.isFinite(frame.frame)), true);
  assert.equal(JSON.stringify([...frames].sort((a, b) => a.frame - b.frame).map((frame) => frame.id)), JSON.stringify(frames.map((frame) => frame.id)));
});

test("selecting impact frame updates preview frame and status", () => {
  const Animotion = loadAnimotion();
  Animotion.state.cutsceneBridge = punchBridge(Animotion);
  Animotion.state.currentFrame = 1;
  Animotion.actionFrameEditor.selectBeat("impact");
  const status = Animotion.cutsceneMotionStatus.statusForBridge(Animotion.state.cutsceneBridge, {
    parts: parts(),
    currentFrame: Animotion.state.currentFrame,
    actionFrame: Animotion.actionFrameEditor.selectionStatus(),
  });
  assert.equal(Animotion.state.currentFrame, 24);
  assert.equal(status.actionFrame.selectedBeatId, "impact");
  assert.equal(status.actionFrame.selectedFrame, 24);
  assert.equal(Animotion.cutsceneMotionStatus.statusText(status).includes("trajectory read-only"), true);
});

test("legacy punch beats without actionTimeline still expose safe action frames", () => {
  const Animotion = loadAnimotion();
  const bridge = {
    primaryPartId: "arm",
    jointAction: {
      source: "motion-planner-punch-anchors-v1",
      focusKey: "rHand",
      beats: [
        { id: "windup", at: 6, pose: { rHand: [50, 30] } },
        { id: "impact", at: 24, pose: { rHand: [120, 30] } },
      ],
    },
  };
  const frames = Animotion.actionFrameEditor.framesForBridge(bridge);
  assert.equal(JSON.stringify(frames.map((frame) => frame.id)), JSON.stringify(["windup", "impact"]));
});

test("boxingStep generation exposes spec-defined action frames", () => {
  const Animotion = loadAnimotion();
  const frames = Animotion.actionFrameEditor.framesForBridge(boxingStepBridge(Animotion));
  assert.equal(JSON.stringify(frames.map((frame) => frame.normalizedId)), JSON.stringify([
    "guard",
    "weightshift",
    "leadfootstep",
    "rearfootfollow",
    "settle",
  ]));
});

test("stale selected action frame is inactive after switching away from punch", () => {
  const Animotion = loadAnimotion();
  Animotion.state.cutsceneBridge = punchBridge(Animotion);
  Animotion.actionFrameEditor.selectBeat("impact");
  Animotion.state.cutsceneBridge = { jointAction: { actionTimeline: { template: "kick" }, beats: [{ id: "impact", at: 12 }] } };
  assert.equal(Animotion.actionFrameEditor.isEditingActionFrame(), false);
  assert.equal(Animotion.actionFrameEditor.trajectoryReadOnly(), false);
});
