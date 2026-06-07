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
    "scripts/motion-model.js",
    "scripts/motion-hints.js",
    "scripts/motion-drafts.js",
    "scripts/motion-target-state.js",
    "scripts/motion-target-debug.js",
    "scripts/character-root-motion.js",
    "scripts/action-specs.js",
    "scripts/action-timeline-model.js",
    "scripts/cutscene-action-selectors.js",
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

test("forward boxingStep moves root and body parts in the same short direction", () => {
  const Animotion = loadAnimotion();
  const plan = boxingPlan(Animotion, boxingParts());
  const settle = frame(plan, "settle");
  const body = poseAt(plan, "body", settle);
  const head = poseAt(plan, "head", settle);
  const arm = poseAt(plan, "guard_arm", settle);

  assert.equal(plan.target, null);
  assert.equal(plan.jointAction.actionTimeline.template, "boxingStep");
  assert.equal(Object.hasOwn(plan.jointAction, "impactExaggeration"), false);
  assert.equal(plan.jointAction.targetDebug.direction, "forward");
  assert.equal(plan.jointAction.targetDebug.rootDelta.x > 0, true);
  assert.equal(body.x > 0 && head.x > 0 && arm.x > 0, true);
  assert.equal(body.x, head.x);
  assert.equal(head.x, arm.x);
});

test("boxingStep does not double-translate parented head and arm chains", () => {
  const Animotion = loadAnimotion();
  const plan = boxingPlan(Animotion, parentedParts());
  const settle = frame(plan, "settle");
  const body = poseAt(plan, "body", settle);
  const head = poseAt(plan, "head", settle);
  const upperArm = poseAt(plan, "upper_arm", settle);
  const forearm = poseAt(plan, "forearm", settle);

  assert.equal(body.x > 0, true);
  assert.deepEqual({ x: head.x, y: head.y }, { x: 0, y: 0 });
  assert.deepEqual({ x: upperArm.x, y: upperArm.y }, { x: 0, y: 0 });
  assert.deepEqual({ x: forearm.x, y: forearm.y }, { x: 0, y: 0 });
  assert.equal(plan.jointAction.targetDebug.rootDeltaPartIds.includes("head"), false);
});

test("boxingStep lead foot advances before the rear foot follows", () => {
  const Animotion = loadAnimotion();
  const plan = boxingPlan(Animotion, boxingParts());
  const leadId = plan.jointAction.targetDebug.leadFootKey === "rFoot" ? "right_foot" : "left_foot";
  const rearId = leadId === "right_foot" ? "left_foot" : "right_foot";
  const leadStep = frame(plan, "leadFootStep");
  const rearFollow = frame(plan, "rearFootFollow");
  const leadAtStep = poseAt(plan, leadId, leadStep).x;
  const rearAtStep = poseAt(plan, rearId, leadStep).x;
  const rearAtFollow = poseAt(plan, rearId, rearFollow).x;

  assert.equal(leadAtStep > rearAtStep, true);
  assert.equal(rearAtFollow > rearAtStep, true);
});

test("boxingStep leg-only parts separate during step and settle with the body", () => {
  const Animotion = loadAnimotion();
  const plan = boxingPlan(Animotion, legOnlyParts());
  const leadId = plan.jointAction.targetDebug.leadFootKey === "rFoot" ? "right_leg" : "left_leg";
  const rearId = leadId === "right_leg" ? "left_leg" : "right_leg";
  const leadStep = frame(plan, "leadFootStep");
  const settle = frame(plan, "settle");
  const bodySettle = poseAt(plan, "body", settle).x;

  assert.equal(poseAt(plan, leadId, leadStep).x > poseAt(plan, rearId, leadStep).x, true);
  assert.equal(poseAt(plan, "left_leg", settle).x, bodySettle);
  assert.equal(poseAt(plan, "right_leg", settle).x, bodySettle);
});

test("boxingStep keeps foot children attached to their leg parent", () => {
  const Animotion = loadAnimotion();
  const plan = boxingPlan(Animotion, legWithFootChildrenParts());
  const leadStep = frame(plan, "leadFootStep");
  const settle = frame(plan, "settle");
  const leftFootStep = poseAt(plan, "left_foot", leadStep);
  const rightFootStep = poseAt(plan, "right_foot", leadStep);

  assert.deepEqual({ x: leftFootStep.x, y: leftFootStep.y }, { x: 0, y: 0 });
  assert.deepEqual({ x: rightFootStep.x, y: rightFootStep.y }, { x: 0, y: 0 });
  assert.deepEqual({ x: poseAt(plan, "left_foot", settle).x, y: poseAt(plan, "left_foot", settle).y }, { x: 0, y: 0 });
  assert.equal(poseAt(plan, "right_leg", leadStep).x > poseAt(plan, "left_leg", leadStep).x, true);
});

test("boxingStep falls back to body-only motion without leg or foot parts", () => {
  const Animotion = loadAnimotion();
  const plan = boxingPlan(Animotion, bodyOnlyParts());
  const settle = frame(plan, "settle");
  const body = poseAt(plan, "body", settle);

  assert.equal(plan.jointAction.targetDebug.legFallback, true);
  assert.equal(plan.partTracks.length, bodyOnlyParts().length);
  assert.equal(body.x > 0, true);
  assert.equal(plan.jointAction.beats.some((beat) => beat.pose.rFoot), true);
});

function boxingPlan(Animotion, parts) {
  const bridge = Animotion.cutsceneModel.normalizeBridge({
    primaryPartId: "body",
    durationFrames: 16,
    impactFrame: 16,
    effectDirection: { x: 1, y: 0 },
  });
  return Animotion.motionPlanner.createPlan(parts, "body", bridge, { template: "boxingStep" });
}

function boxingParts() {
  return [
    part("body", "body", "torso", 40, 20, 28, 64),
    part("head", "head", "head", 42, 2, 24, 20),
    part("guard_arm", "arm", "forearm", 64, 34, 24, 28),
    part("left_foot", "foot", "foot", 28, 82, 18, 18),
    part("right_foot", "foot", "foot", 66, 82, 18, 18),
  ];
}

function bodyOnlyParts() {
  return [
    part("body", "body", "torso", 40, 20, 28, 64),
    part("head", "head", "head", 42, 2, 24, 20),
    part("guard_arm", "arm", "forearm", 64, 34, 24, 28),
  ];
}

function parentedParts() {
  return [
    part("body", "body", "torso", 40, 20, 28, 64),
    { ...part("head", "head", "head", 42, 2, 24, 20), parentId: "body" },
    { ...part("upper_arm", "arm", "upperArm", 58, 28, 18, 34), parentId: "body" },
    { ...part("forearm", "arm", "forearm", 72, 36, 20, 32), parentId: "upper_arm" },
    part("left_leg", "leg", null, 28, 76, 20, 44),
    part("right_leg", "leg", null, 66, 76, 20, 44),
  ];
}

function legOnlyParts() {
  return [
    part("body", "body", "torso", 40, 20, 28, 64),
    part("head", "head", "head", 42, 2, 24, 20),
    part("left_leg", "leg", null, 28, 76, 20, 44),
    part("right_leg", "leg", null, 66, 76, 20, 44),
  ];
}

function legWithFootChildrenParts() {
  return [
    part("body", "body", "torso", 40, 20, 28, 64),
    part("head", "head", "head", 42, 2, 24, 20),
    part("left_leg", "leg", null, 28, 76, 20, 44),
    part("right_leg", "leg", null, 66, 76, 20, 44),
    { ...part("left_foot", "foot", "foot", 26, 110, 18, 10), parentId: "left_leg" },
    { ...part("right_foot", "foot", "foot", 66, 110, 18, 10), parentId: "right_leg" },
  ];
}

function part(id, type, humanRole, x, y, w, h) {
  return {
    id,
    type,
    humanRole,
    rect: { x, y, w, h },
    pivot: { x: w * 0.5, y: h * 0.2 },
    joint: { x: w * 0.5, y: h * 0.88 },
    keyframes: [],
    customMotion: {},
  };
}

function frame(plan, beatId) {
  return plan.jointAction.beats.find((beat) => beat.id === beatId).at;
}

function poseAt(plan, partId, frameNumber) {
  return plan.partTracks.find((track) => track.partId === partId).keyframes
    .find((keyframe) => keyframe.frame === frameNumber).pose;
}
