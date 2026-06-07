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
    "scripts/geometry.js",
    "scripts/coordinate-spaces.js",
    "scripts/human-rig-schema.js",
    "scripts/arm-role-semantics.js",
    "scripts/rigging.js",
    "scripts/rig-connection.js",
    "scripts/arm-chain-resolver.js",
    "scripts/motion-model.js",
    "scripts/timeline.js",
    "scripts/motion-hints.js",
    "scripts/motion-drafts.js",
    "scripts/motion-target-state.js",
    "scripts/motion-target-debug.js",
    "scripts/character-root-motion.js",
    "scripts/action-specs.js",
    "scripts/action-timeline-model.js",
    "scripts/cutscene-action-selectors.js",
    "scripts/impact-exaggeration-layer.js",
    "scripts/pose-assist.js",
    "scripts/joint-coordinates.js",
    "scripts/cutscene-model.js",
    "scripts/motion-anchors.js",
    "scripts/motion-track-builder.js",
    "scripts/boxing-step-locomotion.js",
    "scripts/motion-planner.js",
    "scripts/command-history.js",
  ]) runScript(context, path);
  const Animotion = context.window.Animotion;
  Animotion.state = { currentFrame: 24, parts: [], project: { parts: [] }, selectedPartId: "back_hand", cutsceneBridge: null };
  Animotion.partCommands = { updatePart: (part, patch) => Object.assign(part, patch) };
  runScript(context, "scripts/motion-commands.js");
  runScript(context, "scripts/motion-command-history.js");
  runScript(context, "scripts/motion-track-upgrade-commands.js");
  return Animotion;
}

function runScript(context, path) {
  vm.runInContext(fs.readFileSync(path, "utf8"), context, { filename: path });
}

test("loaded rear-cross punch tracks can be explicitly upgraded with undo", () => {
  const Animotion = loadAnimotion();
  const parts = separateBoxerParts();
  const bridge = loadedRearCrossBridge(Animotion, parts);
  const oldPose = { x: 0, y: 0, rotate: 0, scaleY: 0, jointX: 0, jointY: 0, phase: 0 };
  for (const part of parts) part.keyframes = [{ frame: 24, pose: { ...oldPose } }];
  Animotion.state.parts = parts;
  Animotion.state.project.parts = parts;
  Animotion.state.cutsceneBridge = bridge;
  const beforeAction = JSON.stringify(bridge.jointAction);

  const result = Animotion.motionTrackUpgradeCommands.upgradeCurrentPunchTracks();

  assert.equal(result.ok, true);
  assert.equal(result.reason, "upgraded-loaded-punch-tracks");
  assert.equal(result.resultTrackCount, parts.length);
  assert.equal(JSON.stringify(Animotion.state.cutsceneBridge.jointAction), beforeAction);
  assert.equal(Animotion.commandHistory.canUndo(), true);
  const body = poseAt(parts, "body", 24);
  assert.equal(Math.hypot(body.x, body.y) > 0, true);
  assert.deepEqual(xy(poseAt(parts, "left_leg", 24)), xy(body));
  assert.deepEqual(xy(poseAt(parts, "right_leg", 24)), xy(body));
  assert.equal(poseAt(parts, "front_upper", 24).x, 0);
  assert.equal(poseAt(parts, "front_upper", 24).rotate >= 24, true);
  assert.deepEqual(xy(poseAt(parts, "front_forearm", 24)), { x: 0, y: 0 });
  assert.equal(Math.abs(poseAt(parts, "front_forearm", 24).jointY) > 0, true);

  assert.equal(Animotion.commandHistory.undo(), true);
  assert.deepEqual(JSON.parse(JSON.stringify(poseAt(parts, "left_leg", 24))), oldPose);
});

test("loaded rear-cross upgrade uses saved lead hand point when current handTip is out of bounds", () => {
  const Animotion = loadAnimotion();
  const parts = separateBoxerParts();
  const bridge = loadedRearCrossBridge(Animotion, parts);
  parts.find((part) => part.id === "front_hand").handTip = { x: 120, y: 8 };
  for (const part of parts) part.keyframes = [];
  Animotion.state.parts = parts;
  Animotion.state.project.parts = parts;
  Animotion.state.cutsceneBridge = bridge;

  const result = Animotion.motionTrackUpgradeCommands.upgradeCurrentPunchTracks();

  const hand = poseAt(parts, "front_hand", 24);
  const forearm = poseAt(parts, "front_forearm", 24);
  const upper = poseAt(parts, "front_upper", 24);
  assert.equal(result.ok, true);
  assert.equal(upper.x, 0);
  assert.equal(upper.rotate >= 24, true);
  assert.equal(Math.abs(forearm.x) < 60, true);
  assert.equal(Math.abs(hand.rotate) <= 2, true);
  assert.equal(Math.abs(forearm.jointY) > 0, true);
  assert.equal(Math.abs(forearm.jointY) <= 36, true);
});

test("loaded non-punch action is reported without changing keyframes", () => {
  const Animotion = loadAnimotion();
  const parts = separateBoxerParts();
  for (const part of parts) part.keyframes = [{ frame: 12, pose: { x: 7 } }];
  Animotion.state.parts = parts;
  Animotion.state.project.parts = parts;
  Animotion.state.cutsceneBridge = Animotion.cutsceneModel.normalizeBridge({
    primaryPartId: "body",
    durationFrames: 18,
    impactFrame: 12,
    jointAction: {
      source: "test",
      actionTimeline: { template: "dash" },
      beats: [{ id: "impact", at: 12, pose: { hip: [20, 30] } }],
    },
  });

  const result = Animotion.motionTrackUpgradeCommands.upgradeCurrentPunchTracks();

  assert.equal(result.ok, false);
  assert.equal(result.reason, "not-punch-action");
  assert.equal(result.attempted, true);
  assert.equal(Animotion.commandHistory.canUndo(), false);
  assert.equal(parts.every((part) => part.keyframes[0].pose.x === 7), true);
});

function loadedRearCrossBridge(Animotion, parts) {
  const bridge = Animotion.cutsceneModel.normalizeBridge({ durationFrames: 36, impactFrame: 24, effectDirection: { x: 1, y: 0 } });
  const plan = Animotion.motionPlanner.createPlan(parts, "back_hand", bridge, { template: "punch", target: { x: 150, y: 38 } });
  assert.equal(plan.jointAction.targetDebug.punchStyle, "rear-cross");
  return { ...bridge, primaryPartId: "back_hand", jointAction: plan.jointAction };
}

function separateBoxerParts() {
  return [
    part("body", "body", "torso", { x: 40, y: 20, w: 20, h: 50 }, { x: 10, y: 25 }, { x: 10, y: 43 }),
    part("head", "head", "head", { x: 38, y: 2, w: 24, h: 20 }, { x: 12, y: 10 }, { x: 12, y: 16 }),
    part("left_leg", "leg", "shin", { x: 28, y: 66, w: 16, h: 42 }, { x: 8, y: 4 }, { x: 8, y: 38 }),
    part("right_leg", "leg", "shin", { x: 58, y: 66, w: 16, h: 42 }, { x: 8, y: 4 }, { x: 8, y: 38 }),
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

function poseAt(parts, id, frame) {
  return parts.find((part) => part.id === id).keyframes.find((keyframe) => keyframe.frame === frame).pose;
}

function xy(pose) {
  return { x: pose.x, y: pose.y };
}
