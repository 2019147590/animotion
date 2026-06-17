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
  const context = { window: { Animotion: {} }, performance: { now: () => 1000 } };
  vm.createContext(context);
  for (const path of [
    "scripts/config.js",
    "scripts/geometry.js",
    "scripts/coordinate-spaces.js",
    "scripts/motion-model.js",
    "scripts/motion-hints.js",
    "scripts/motion-drafts.js",
    "scripts/motion-target-state.js",
    "scripts/motion-target-debug.js",
    "scripts/character-root-motion.js",
    "scripts/action-specs.js",
    "scripts/action-timeline-model.js",
    "scripts/cutscene-action-selectors.js",
    "scripts/impact-exaggeration-layer.js",
    "scripts/rig-connection.js",
    "scripts/arm-chain-resolver.js",
    "scripts/pose-assist.js",
    "scripts/joint-coordinates.js",
    "scripts/cutscene-model.js",
    "scripts/motion-anchors.js",
    "scripts/timeline.js",
    "scripts/arm-extension.js",
    "scripts/motion-track-builder.js",
    "scripts/boxing-step-locomotion.js",
    "scripts/motion-planner.js",
    "scripts/motion-primary-selection.js",
    "scripts/motion-planner-commands.js",
  ]) runScript(context, path);
  const Animotion = context.window.Animotion;
  const parts = separateBoxerParts();
  Animotion.state = {
    image: { naturalWidth: 180, naturalHeight: 140 },
    parts,
    selectedPartId: "back_upper",
    currentFrame: 1,
    running: false,
    startTime: 1000,
    cutsceneBridge: null,
    motionPlan: { template: "rearHandPunch01", targetMode: false },
    project: { assets: [], parts },
  };
  Animotion.dom = { els: { motionTemplate: { value: "" } } };
  Animotion.parts = { selectedPart: () => Animotion.state.parts.find((part) => part.id === Animotion.state.selectedPartId) || null };
  Animotion.partCommands = { updatePart: (part, patch) => Object.assign(part, patch) };
  Animotion.cutsceneControls = { preservePanelTransform: (next) => next };
  Animotion.timelineControls = { setCurrentFrame: (frame) => { Animotion.state.currentFrame = frame; } };
  Animotion.ui = { refreshUi() {} };
  runScript(context, "scripts/motion-commands.js");
  return Animotion;
}

function runScript(context, path) {
  vm.runInContext(fs.readFileSync(path, "utf8"), context, { filename: path });
}

test("rearHandPunch01 command generates a distinct rear-cross punch template", () => {
  const Animotion = loadAnimotion();
  const result = Animotion.motionPlannerCommands.generateFromSelection();
  const bridge = Animotion.state.cutsceneBridge;
  const impactFrame = bridge.jointAction.actionTimeline.impactFrame;
  const leadPose = poseAt(Animotion.state.parts, "front_forearm", impactFrame);

  assert.equal(result.generated, true);
  assert.equal(bridge.primaryPartId, "back_hand");
  assert.equal(bridge.durationFrames, 18);
  assert.equal(bridge.impactFrame, 15);
  assert.equal(bridge.jointAction.actionTimeline.template, "rearHandPunch01");
  assert.equal(bridge.jointAction.targetDebug.punchStyle, "rear-cross");
  assert.equal(bridge.jointAction.targetDebug.roleDecision.explicitActionOverride, true);
  assert.equal(Animotion.dom.els.motionTemplate.value, "cutscene");
  assert.equal(Math.abs(leadPose.jointY) > 0, true);
});

function separateBoxerParts() {
  return [
    part("body", "body", "torso", { x: 40, y: 20, w: 20, h: 50 }, { x: 10, y: 25 }, { x: 10, y: 43 }),
    part("head", "head", "head", { x: 38, y: 2, w: 24, h: 20 }, { x: 12, y: 10 }, { x: 12, y: 16 }),
    part("back_upper", "arm", "upperArm", { x: 20, y: 30, w: 20, h: 20 }, { x: 20, y: 8 }, { x: 2, y: 10 }, "body"),
    part("back_forearm", "arm", "forearm", { x: 2, y: 30, w: 20, h: 20 }, { x: 20, y: 10 }, { x: 2, y: 10 }, "back_upper"),
    part("back_hand", "hand", "hand", { x: -10, y: 32, w: 14, h: 14 }, { x: 14, y: 8 }, null, "back_forearm", { x: 0, y: 8 }),
    part("front_upper", "arm", "upperArm", { x: 60, y: 30, w: 20, h: 20 }, { x: 0, y: 8 }, { x: 18, y: 10 }, "body"),
    part("front_forearm", "arm", "forearm", { x: 78, y: 30, w: 20, h: 20 }, { x: 0, y: 10 }, { x: 20, y: 10 }, "front_upper"),
    part("front_hand", "hand", "hand", { x: 98, y: 32, w: 14, h: 14 }, { x: 0, y: 8 }, null, "front_forearm", { x: 14, y: 8 }),
  ];
}

function part(id, type, humanRole, rect, pivot, joint, parentId = null, handTip = null) {
  return {
    id,
    name: id,
    type,
    humanRole,
    rect,
    pivot,
    ...(joint ? { joint } : {}),
    ...(parentId ? { parentId } : {}),
    ...(handTip ? { handTip } : {}),
  };
}

function poseAt(parts, partId, frame) {
  return parts.find((part) => part.id === partId)?.keyframes.find((keyframe) => keyframe.frame === frame)?.pose || {};
}
