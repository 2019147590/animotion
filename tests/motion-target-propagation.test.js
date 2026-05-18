const assert = require("node:assert/strict");

require("../scripts/motion-model.js");
require("../scripts/coordinate-spaces.js");
require("../scripts/motion-hints.js");
require("../scripts/motion-drafts.js");
require("../scripts/motion-target-debug.js");
require("../scripts/pose-assist.js");
require("../scripts/joint-coordinates.js");
require("../scripts/motion-anchors.js");
const cutsceneModel = require("../scripts/cutscene-model.js");
const motionPlanner = require("../scripts/motion-planner.js");

function test(name, fn) {
  try {
    fn();
    console.log(`PASS ${name}`);
  } catch (error) {
    console.error(`FAIL ${name}`);
    throw error;
  }
}

function sampleParts() {
  return [
    { id: "body", type: "body", rect: { x: 40, y: 20, w: 20, h: 50 }, pivot: { x: 10, y: 25 }, joint: { x: 10, y: 40 } },
    { id: "head", type: "head", rect: { x: 38, y: 4, w: 24, h: 20 }, pivot: { x: 12, y: 10 }, joint: { x: 12, y: 16 } },
    { id: "leg", type: "leg", rect: { x: 67, y: 60, w: 18, h: 45 }, pivot: { x: 2, y: 6 }, joint: { x: 16, y: 40 } },
  ];
}

function bodyImpactPose(plan) {
  return plan.partTracks.find((track) => track.partId === "body").keyframes
    .find((keyframe) => keyframe.frame === 15).pose;
}

test("short target creates limb-only motion", () => {
  const bridge = cutsceneModel.normalizeBridge({ impactFrame: 15 });
  const plan = motionPlanner.createPlan(sampleParts(), "leg", bridge, {
    template: "kick",
    target: { x: 90, y: 96 },
  });
  assert.equal(plan.motionScope, "body-follow");
  assert.equal(plan.targetDebug.chosenMotionScope, "limb-only");
  assert.equal(plan.targetDebug.computedDistance < plan.targetDebug.distanceThreshold, true);
  assert.deepEqual({ x: bodyImpactPose(plan).x, y: bodyImpactPose(plan).y }, { x: 0, y: 0 });
});

test("long target creates body root translation", () => {
  const bridge = cutsceneModel.normalizeBridge({ impactFrame: 15 });
  const plan = motionPlanner.createPlan(sampleParts(), "leg", bridge, {
    template: "kick",
    target: { x: 150, y: 70 },
  });
  assert.equal(plan.targetDebug.chosenMotionScope, "body-follow");
  assert.equal(plan.targetDebug.computedDistance > plan.targetDebug.distanceThreshold, true);
  assert.equal(Math.hypot(bodyImpactPose(plan).x, bodyImpactPose(plan).y) > 10, true);
});

test("B part target is converted before distance threshold", () => {
  const bridge = cutsceneModel.normalizeBridge({ impactFrame: 15 });
  const plan = motionPlanner.createPlan(sampleParts(), "leg", bridge, {
    template: "kick",
    target: { x: 150, y: 70 },
    targetSource: { type: "correspondence", correspondenceId: "corr-1", coordinateSpace: "sourceImage" },
    targetDebug: {
      rawBTarget: { x: 980, y: 720, coordinateSpace: "impactImage" },
      convertedTarget: { x: 150, y: 70, coordinateSpace: "sourceImage" },
    },
  });
  assert.equal(plan.targetDebug.rawBTarget.x, 980);
  assert.equal(plan.targetDebug.convertedTarget.x, 150);
  assert.equal(plan.targetDebug.selectedPartCurrentPosition.x, 83);
  assert.equal(Math.round(plan.targetDebug.computedDistance), 73);
  assert.equal(plan.targetDebug.coordinateSpace, "sourceImage");
});

test("kick preset defaults to body-follow motion scope", () => {
  const plan = motionPlanner.normalizePlan({ template: "kick", target: { x: 150, y: 70 } });
  assert.equal(plan.motionScope, "body-follow");
});

test("motion scope override can force full-character follow", () => {
  const bridge = cutsceneModel.normalizeBridge({ impactFrame: 15 });
  const parts = [
    ...sampleParts(),
    { id: "arm", type: "arm", rect: { x: 20, y: 28, w: 18, h: 44 }, pivot: { x: 14, y: 6 }, joint: { x: 4, y: 34 } },
  ];
  const plan = motionPlanner.createPlan(parts, "leg", bridge, {
    template: "kick",
    motionScope: "full-character",
    target: { x: 90, y: 96 },
  });
  const armImpact = plan.partTracks.find((track) => track.partId === "arm").keyframes
    .find((keyframe) => keyframe.frame === 15).pose;
  assert.equal(plan.targetDebug.chosenMotionScope, "full-character");
  assert.equal(Math.hypot(bodyImpactPose(plan).x, bodyImpactPose(plan).y) > 0, true);
  assert.equal(Math.hypot(armImpact.x, armImpact.y) > 0, true);
});
