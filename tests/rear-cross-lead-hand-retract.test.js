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
    "scripts/arm-role-semantics.js",
    "scripts/rigging.js",
    "scripts/rig-connection.js",
    "scripts/arm-chain-resolver.js",
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
    "scripts/pose-assist.js",
    "scripts/joint-coordinates.js",
    "scripts/cutscene-model.js",
    "scripts/motion-anchors.js",
    "scripts/motion-track-builder.js",
    "scripts/boxing-step-locomotion.js",
    "scripts/motion-planner.js",
  ]) runScript(context, path);
  return context.window.Animotion;
}

function runScript(context, path) {
  vm.runInContext(fs.readFileSync(path, "utf8"), context, { filename: path });
}

test("rear-cross generation retracts the lead hand chain toward guard", () => {
  const Animotion = loadAnimotion();
  const parts = separateBoxerParts();
  const bridge = Animotion.cutsceneModel.normalizeBridge({ durationFrames: 36, impactFrame: 24, effectDirection: { x: 1, y: 0 } });
  const plan = Animotion.motionPlanner.createPlan(parts, "back_hand", bridge, { template: "punch", target: { x: 150, y: 38 } });
  const guard = poseAt(plan, "front_forearm", "guard");
  const drive = poseAt(plan, "front_forearm", "drive");
  const impactUpper = poseAt(plan, "front_upper", "impact");
  const impactForearm = poseAt(plan, "front_forearm", "impact");
  const impactHand = poseAt(plan, "front_hand", "impact");

  assert.equal(plan.jointAction.targetDebug.punchStyle, "rear-cross");
  assert.deepEqual(guard, Animotion.motionModel.defaultCustomMotion());
  assert.deepEqual(xy(drive), { x: 0, y: 0 });
  assert.equal(Math.abs(impactForearm.rotate) > Math.abs(drive.rotate), true);
  assert.deepEqual(xy(impactForearm), { x: 0, y: 0 });
  assert.equal(impactUpper.x, 0);
  assert.equal(impactUpper.rotate >= 70, true);
  assert.equal(Math.abs(forearmWorldAngle(parts, impactUpper, impactForearm) + 45) < 0.001, true);
  assert.equal(Math.hypot(impactHand.x, impactHand.y) > 0, true);
  assert.equal(Math.abs(impactForearm.jointY) > 0, true);
});

test("rear-cross keeps punching forearm free to drive forward", () => {
  const Animotion = loadAnimotion();
  const parts = separateBoxerParts();
  const bridge = Animotion.cutsceneModel.normalizeBridge({ durationFrames: 36, impactFrame: 24, effectDirection: { x: 1, y: 0 } });
  const plan = Animotion.motionPlanner.createPlan(parts, "back_hand", bridge, { template: "punch", target: { x: 150, y: 38 } });
  const impactForearm = poseAt(plan, "back_forearm", "impact");

  assert.equal(plan.jointAction.targetDebug.punchStyle, "rear-cross");
  assert.equal(Math.hypot(impactForearm.x, impactForearm.y) > 0, true);
});

test("rearHandPunch01 keeps separate template id and rear-cross support", () => {
  const Animotion = loadAnimotion();
  const parts = separateBoxerParts();
  const bridge = Animotion.cutsceneModel.normalizeBridge({ durationFrames: 18, impactFrame: 15, effectDirection: { x: 1, y: 0 } });
  const plan = Animotion.motionPlanner.createPlan(parts, "back_hand", bridge, { template: "rearHandPunch01", target: { x: 150, y: 38 } });
  const impactForearm = poseAt(plan, "back_forearm", "impact");
  const leadImpact = poseAt(plan, "front_forearm", "impact");

  assert.equal(plan.jointAction.actionTimeline.template, "rearHandPunch01");
  assert.equal(plan.jointAction.actionTimeline.durationFrames, 18);
  assert.equal(plan.jointAction.actionTimeline.impactFrame, 15);
  assert.equal(plan.jointAction.targetDebug.punchStyle, "rear-cross");
  assert.equal(plan.jointAction.targetDebug.roleDecision.explicitActionOverride, true);
  assert.equal(Math.hypot(impactForearm.x, impactForearm.y) > 0, true);
  assert.equal(Math.abs(leadImpact.jointY) > 0, true);
});

test("front jab generation does not retract the opposite rear hand", () => {
  const Animotion = loadAnimotion();
  const parts = separateBoxerParts();
  const bridge = Animotion.cutsceneModel.normalizeBridge({ durationFrames: 36, impactFrame: 24, effectDirection: { x: 1, y: 0 } });
  const plan = Animotion.motionPlanner.createPlan(parts, "front_hand", bridge, { template: "punch", target: { x: 150, y: 38 } });

  assert.equal(plan.jointAction.targetDebug.punchStyle, "jab");
  assert.deepEqual(poseAt(plan, "back_forearm", "impact"), Animotion.motionModel.defaultCustomMotion());
  assert.deepEqual(poseAt(plan, "back_hand", "impact"), Animotion.motionModel.defaultCustomMotion());
});

test("rear-cross keeps unparented legs attached to the moving torso", () => {
  const Animotion = loadAnimotion();
  const parts = separateBoxerParts();
  const bridge = Animotion.cutsceneModel.normalizeBridge({ durationFrames: 36, impactFrame: 24, effectDirection: { x: 1, y: 0 } });
  const plan = Animotion.motionPlanner.createPlan(parts, "back_hand", bridge, { template: "punch", target: { x: 150, y: 38 } });
  const body = poseAt(plan, "body", "impact");
  const leftLeg = poseAt(plan, "left_leg", "impact");
  const rightLeg = poseAt(plan, "right_leg", "impact");

  assert.equal(plan.jointAction.targetDebug.punchStyle, "rear-cross");
  assert.equal(Math.hypot(body.x, body.y) > 0, true);
  assert.deepEqual({ x: leftLeg.x, y: leftLeg.y }, { x: body.x, y: body.y });
  assert.deepEqual({ x: rightLeg.x, y: rightLeg.y }, { x: body.x, y: body.y });
});

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

function poseAt(plan, partId, beatId) {
  const frame = plan.jointAction.beats.find((beat) => beat.id === beatId).at;
  return plan.partTracks.find((track) => track.partId === partId).keyframes.find((keyframe) => keyframe.frame === frame).pose;
}

function xy(pose) {
  return { x: pose.x, y: pose.y };
}

function forearmWorldAngle(parts, upperPose, pose) {
  const forearm = parts.find((part) => part.id === "front_forearm");
  return baseAngle(forearm) + upperPose.rotate + pose.rotate + jointRotation(forearm, pose);
}

function jointRotation(part, pose) {
  const base = { x: part.joint.x - part.pivot.x, y: part.joint.y - part.pivot.y };
  const target = { x: base.x + pose.jointX, y: base.y + pose.jointY };
  return (Math.atan2(target.y, target.x) - Math.atan2(base.y, base.x)) * 180 / Math.PI;
}

function baseAngle(part) {
  return Math.atan2(part.joint.y - part.pivot.y, part.joint.x - part.pivot.x) * 180 / Math.PI;
}
