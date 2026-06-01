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
