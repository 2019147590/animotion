const assert = require("node:assert/strict");

require("../scripts/motion-model.js");
require("../scripts/timeline.js");
require("../scripts/coordinate-spaces.js");
require("../scripts/motion-hints.js");
require("../scripts/motion-drafts.js");
require("../scripts/motion-target-state.js");
require("../scripts/motion-target-debug.js");
require("../scripts/rig-connection.js");
const characterRootMotion = require("../scripts/character-root-motion.js");
require("../scripts/pose-assist.js");
require("../scripts/joint-coordinates.js");
require("../scripts/motion-anchors.js");
const cutsceneModel = require("../scripts/cutscene-model.js");
require("../scripts/action-specs.js");
require("../scripts/motion-track-builder.js");
require("../scripts/boxing-step-locomotion.js");
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

test("full-character mode applies identical rootDelta to visible character parts", () => {
  const plan = fullCharacterPlan();
  const debug = characterRootMotion.evaluationDebug(plan.parts, 15, plan.bridge);
  const rootDelta = debug.rootDelta;
  for (const part of debug.parts.filter((part) => part.id !== "prop")) {
    assert.deepEqual({ x: part.x, y: part.y }, { x: rootDelta.x, y: rootDelta.y });
  }
});

test("body-follow mode applies rootDelta to unparented character parts", () => {
  const bridge = cutsceneModel.normalizeBridge({ impactFrame: 15 });
  const parts = [...sampleParts(), { id: "arm", type: "arm", rect: { x: 20, y: 28, w: 18, h: 44 } }];
  const plan = motionPlanner.createPlan(parts, "leg", bridge, { template: "kick", target: { x: 150, y: 70 } });
  const debug = characterRootMotion.evaluationDebug(partsWithTracks(parts, plan), 15, {
    ...bridge,
    primaryPartId: "leg",
    jointAction: plan.jointAction,
  });
  const arm = debug.parts.find((part) => part.id === "arm");
  assert.equal(debug.rootDeltaPartIds.includes("arm"), true);
  assert.deepEqual({ x: arm.x, y: arm.y }, { x: debug.rootDelta.x, y: debug.rootDelta.y });
});

test("parented parts inherit root motion through parent connection", () => {
  const bridge = cutsceneModel.normalizeBridge({ impactFrame: 15 });
  const parts = [
    { id: "body", type: "body", rect: { x: 40, y: 20, w: 20, h: 50 }, pivot: { x: 10, y: 25 }, joint: { x: 10, y: 40 } },
    { id: "head", type: "head", parentId: "body", rect: { x: 38, y: 4, w: 24, h: 20 }, pivot: { x: 12, y: 10 }, joint: { x: 12, y: 16 } },
    { id: "leg", type: "leg", rect: { x: 67, y: 60, w: 18, h: 45 }, pivot: { x: 2, y: 6 }, joint: { x: 16, y: 40 } },
  ];
  const plan = motionPlanner.createPlan(parts, "leg", bridge, { template: "kick", target: { x: 150, y: 70 } });
  const debug = characterRootMotion.evaluationDebug(partsWithTracks(parts, plan), 15, {
    ...bridge,
    primaryPartId: "leg",
    jointAction: plan.jointAction,
  });
  const head = debug.parts.find((part) => part.id === "head");
  assert.equal(debug.rootDeltaPartIds.includes("body"), true);
  assert.equal(debug.rootDeltaPartIds.includes("head"), false);
  assert.deepEqual({ x: head.x, y: head.y }, { x: 0, y: 0 });
});

test("motion planner does not add independent head assist when parentPartId attaches head to body", () => {
  const bridge = cutsceneModel.normalizeBridge({ impactFrame: 15 });
  const parts = [
    { id: "body", type: "body", rect: { x: 40, y: 20, w: 20, h: 50 }, pivot: { x: 10, y: 25 }, joint: { x: 10, y: 40 } },
    { id: "head", type: "head", parentPartId: "body", rect: { x: 38, y: 4, w: 24, h: 20 }, pivot: { x: 12, y: 10 }, joint: { x: 12, y: 16 } },
    { id: "leg", type: "leg", rect: { x: 67, y: 60, w: 18, h: 45 }, pivot: { x: 2, y: 6 }, joint: { x: 16, y: 40 } },
  ];
  const plan = motionPlanner.createPlan(parts, "leg", bridge, { template: "kick", target: { x: 150, y: 70 } });
  const headImpact = plan.partTracks.find((track) => track.partId === "head").keyframes
    .find((keyframe) => keyframe.frame === 15).pose;
  assert.deepEqual({ x: headImpact.x, y: headImpact.y }, { x: 0, y: 0 });
});

test("legacy cutscene playback keeps an unparented head attached to body rotation", () => {
  const parts = [
    {
      id: "body",
      type: "body",
      rect: { x: 40, y: 20, w: 20, h: 50 },
      pivot: { x: 10, y: 25 },
      joint: { x: 10, y: 40 },
      keyframes: [{ frame: 12, pose: { x: 20, rotate: 20 } }],
    },
    {
      id: "head",
      type: "head",
      rect: { x: 38, y: 4, w: 24, h: 20 },
      pivot: { x: 12, y: 10 },
      joint: { x: 12, y: 16 },
      keyframes: [{ frame: 12, pose: {} }],
    },
  ];
  const debug = characterRootMotion.evaluationDebug(parts, 12, {});
  const head = debug.parts.find((part) => part.id === "head");
  assert.deepEqual({ x: Math.round(head.x), y: Math.round(head.y) }, { x: 31, y: 2 });
});

test("parented head does not receive runtime root follow twice", () => {
  const parts = [
    {
      id: "body",
      type: "body",
      rect: { x: 40, y: 20, w: 20, h: 50 },
      pivot: { x: 10, y: 25 },
      keyframes: [{ frame: 12, pose: { x: 20, rotate: 20 } }],
    },
    {
      id: "head",
      type: "head",
      parentId: "body",
      rect: { x: 38, y: 4, w: 24, h: 20 },
      pivot: { x: 12, y: 10 },
      keyframes: [{ frame: 12, pose: { x: 3, y: -2 } }],
    },
  ];
  const debug = characterRootMotion.evaluationDebug(parts, 12, {});
  const head = debug.parts.find((part) => part.id === "head");
  assert.deepEqual({ x: head.x, y: head.y }, { x: 3, y: -2 });
});

test("limb-only motion does not move an unparented head with body root displacement", () => {
  const parts = [
    {
      id: "body",
      type: "body",
      rect: { x: 40, y: 20, w: 20, h: 50 },
      pivot: { x: 10, y: 25 },
      keyframes: [{ frame: 12, pose: { x: 20, rotate: 20 } }],
    },
    {
      id: "head",
      type: "head",
      rect: { x: 38, y: 4, w: 24, h: 20 },
      pivot: { x: 12, y: 10 },
      keyframes: [{ frame: 12, pose: {} }],
    },
  ];
  const debug = characterRootMotion.evaluationDebug(parts, 12, {
    jointAction: { targetDebug: { chosenMotionScope: "limb-only" } },
  });
  const head = debug.parts.find((part) => part.id === "head");
  assert.deepEqual({ x: head.x, y: head.y }, { x: 0, y: 0 });
});

test("unparented head keeps its own pose while following body root motion", () => {
  const parts = [
    {
      id: "body",
      type: "body",
      rect: { x: 40, y: 20, w: 20, h: 50 },
      pivot: { x: 10, y: 25 },
      keyframes: [{ frame: 12, pose: { x: 20, rotate: 20 } }],
    },
    {
      id: "head",
      type: "head",
      rect: { x: 38, y: 4, w: 24, h: 20 },
      pivot: { x: 12, y: 10 },
      keyframes: [{ frame: 12, pose: { x: 4, y: -3 } }],
    },
  ];
  const debug = characterRootMotion.evaluationDebug(parts, 12, {
    jointAction: { targetDebug: { chosenMotionScope: "body-follow" } },
  });
  const head = debug.parts.find((part) => part.id === "head");
  assert.deepEqual({ x: Math.round(head.x), y: Math.round(head.y) }, { x: 35, y: -1 });
});

test("primary part leads more strongly than torso in kick body-follow mode", () => {
  const bridge = cutsceneModel.normalizeBridge({ impactFrame: 15 });
  const parts = sampleParts();
  const plan = motionPlanner.createPlan(parts, "leg", bridge, { template: "kick", target: { x: 150, y: 70 } });
  const primary = plan.partTracks.find((track) => track.partId === "leg").keyframes.find((keyframe) => keyframe.frame === 15).pose;
  assert.equal(Math.hypot(primary.jointX, primary.jointY) > Math.hypot(plan.targetDebug.rootDelta.x, plan.targetDebug.rootDelta.y), true);
});

function fullCharacterPlan() {
  const bridge = cutsceneModel.normalizeBridge({ impactFrame: 15 });
  const parts = [
    ...sampleParts(),
    { id: "arm", type: "arm", rect: { x: 20, y: 28, w: 18, h: 44 } },
    { id: "prop", type: "prop", rect: { x: 5, y: 5, w: 8, h: 8 } },
  ];
  const plan = motionPlanner.createPlan(parts, "leg", bridge, {
    template: "kick",
    motionScope: "full-character",
    target: { x: 150, y: 70 },
  });
  return {
    parts: partsWithTracks(parts, plan),
    bridge: { ...bridge, primaryPartId: "leg", jointAction: plan.jointAction },
  };
}

function partsWithTracks(parts, plan) {
  return parts.map((part) => ({
    ...part,
    keyframes: plan.partTracks.find((track) => track.partId === part.id)?.keyframes || [],
  }));
}
