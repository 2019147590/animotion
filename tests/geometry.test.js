const assert = require("node:assert/strict");
const geometry = require("../scripts/geometry.js");
const rigging = require("../scripts/rigging.js");
const motionModel = require("../scripts/motion-model.js");
const jointCoordinates = require("../scripts/joint-coordinates.js");
const cutsceneModel = require("../scripts/cutscene-model.js");
const poseAssist = require("../scripts/pose-assist.js");
const timeline = require("../scripts/timeline.js");

function test(name, fn) {
  try {
    fn();
    console.log(`PASS ${name}`);
  } catch (error) {
    console.error(`FAIL ${name}`);
    throw error;
  }
}

const imageBounds = { width: 100, height: 80 };

test("rectShape creates four closed corner points", () => {
  const shape = geometry.rectShape({ x: 10, y: 20, w: 30, h: 40 });
  assert.equal(shape.closed, true);
  assert.deepEqual(shape.points, [
    { x: 10, y: 20 },
    { x: 40, y: 20 },
    { x: 40, y: 60 },
    { x: 10, y: 60 },
  ]);
});

test("pointsBounds clamps points to image bounds", () => {
  const bounds = geometry.pointsBounds([
    { x: -5, y: -2 },
    { x: 120, y: 90 },
  ], imageBounds);
  assert.deepEqual(bounds, { x: 0, y: 0, w: 100, h: 80 });
});

test("shapeIsReady rejects open or too-small shapes", () => {
  const openShape = { kind: "polygon", closed: false, points: [{ x: 0, y: 0 }, { x: 5, y: 0 }, { x: 5, y: 5 }] };
  const tinyShape = { kind: "polygon", closed: true, points: [{ x: 0, y: 0 }, { x: 2, y: 0 }, { x: 2, y: 2 }] };
  assert.equal(geometry.shapeIsReady(openShape, imageBounds, 4), false);
  assert.equal(geometry.shapeIsReady(tinyShape, imageBounds, 4), false);
});

test("shapeToMask converts image points into part-local points", () => {
  const shape = geometry.rectShape({ x: 10, y: 12, w: 20, h: 10 });
  const mask = geometry.shapeToMask(shape, { x: 10, y: 12, w: 20, h: 10 });
  assert.deepEqual(mask.points[0], { x: 0, y: 0 });
  assert.deepEqual(mask.points[2], { x: 20, y: 10 });
});

test("arm pivot moves to the shoulder side closest to the body", () => {
  const body = { x: 40, y: 20, w: 20, h: 50 };
  const leftArm = { x: 15, y: 25, w: 18, h: 45 };
  const rightArm = { x: 67, y: 25, w: 18, h: 45 };
  assert.deepEqual(rigging.defaultPivotForPart("arm", leftArm, body), { x: 15.84, y: 6.300000000000001 });
  assert.deepEqual(rigging.defaultPivotForPart("arm", rightArm, body), { x: 2.16, y: 6.300000000000001 });
});

test("leg pivot moves to the hip side closest to the body", () => {
  const body = { x: 40, y: 20, w: 20, h: 50 };
  const leftLeg = { x: 36, y: 68, w: 12, h: 38 };
  const rightLeg = { x: 52, y: 68, w: 12, h: 38 };
  assert.deepEqual(rigging.defaultPivotForPart("leg", leftLeg, body), { x: 10.56, y: 3.04 });
  assert.deepEqual(rigging.defaultPivotForPart("leg", rightLeg, body), { x: 1.44, y: 3.04 });
});

test("limb joint defaults to the opposite movable side", () => {
  const body = { x: 40, y: 20, w: 20, h: 50 };
  const leftArm = { x: 15, y: 25, w: 18, h: 45 };
  const rightLeg = { x: 52, y: 68, w: 12, h: 38 };
  assert.deepEqual(rigging.defaultJointForPart("arm", leftArm, body), { x: 2.16, y: 30.6 });
  assert.deepEqual(rigging.defaultJointForPart("leg", rightLeg, body), { x: 10.56, y: 33.44 });
});

test("localPointFromImagePoint clamps dragged rig handles into the part rect", () => {
  const rect = { x: 20, y: 30, w: 50, h: 60 };
  assert.deepEqual(rigging.localPointFromImagePoint(rect, { x: 45, y: 70 }), { x: 25, y: 40 });
  assert.deepEqual(rigging.localPointFromImagePoint(rect, { x: 10, y: 120 }), { x: 0, y: 60 });
});

test("custom motion returns user-authored sinusoidal transform", () => {
  const settings = { x: 10, y: -5, rotate: 20, scaleY: 0.1, jointX: 7, jointY: -3, phase: 0 };
  const motion = motionModel.customMotionForPart(settings, 0.25, 1);
  assert.equal(Math.round(motion.x), 10);
  assert.equal(Math.round(motion.y), -5);
  assert.equal(Math.round(motion.rotate), 20);
  assert.equal(Number(motion.scaleY.toFixed(2)), 1.1);
  assert.equal(Math.round(motion.jointX), 7);
  assert.equal(Math.round(motion.jointY), -3);
});

test("timeline interpolates keyframes like a simple graph editor", () => {
  const part = {
    keyframes: [
      { frame: 1, pose: { x: 0, rotate: 0 } },
      { frame: 11, pose: { x: 20, rotate: 10 } },
    ],
  };
  const pose = timeline.evaluatePartAtFrame(part, 6);
  assert.equal(pose.x, 10);
  assert.equal(pose.rotate, 5);
});

test("pose assist treats the uploaded cut as impact and builds anticipation", () => {
  const parts = [
    { id: "body", type: "body", rect: { x: 40, y: 20, w: 20, h: 50 } },
    { id: "arm", type: "arm", rect: { x: 67, y: 25, w: 18, h: 45 } },
  ];
  const result = poseAssist.generateAnticipation(parts, "arm", 18, 120);
  const armTrack = result.tracks.find((track) => track.partId === "arm");
  assert.equal(result.impactFrame, 18);
  assert.equal(armTrack.keyframes.find((keyframe) => keyframe.frame === 18).pose.rotate, 0);
  assert.equal(armTrack.keyframes.find((keyframe) => keyframe.frame === 11).pose.rotate, 22);
});

test("control rig drag propagates a limb pull into spine and head poses", () => {
  const parts = [
    { id: "spine", type: "spine", rect: { x: 40, y: 20, w: 20, h: 50 } },
    { id: "head", type: "head", rect: { x: 38, y: 4, w: 24, h: 20 } },
    { id: "arm", type: "arm", rect: { x: 67, y: 25, w: 18, h: 45 } },
  ];
  const tracks = poseAssist.solveControlPose(parts, "arm", { x: 40, y: 10 });
  const spine = tracks.find((track) => track.partId === "spine").pose;
  const head = tracks.find((track) => track.partId === "head").pose;
  const arm = tracks.find((track) => track.partId === "arm").pose;
  assert.equal(arm.jointX, 40);
  assert.equal(spine.rotate, 4.8);
  assert.equal(head.rotate, -2);
});

test("cutscene bridge infers direction from the primary part side", () => {
  const parts = [
    { id: "body", type: "body", rect: { x: 40, y: 20, w: 20, h: 50 } },
    { id: "leg", type: "leg", rect: { x: 70, y: 55, w: 15, h: 35 } },
  ];
  const bridge = cutsceneModel.createBridge(parts, "leg");
  assert.equal(bridge.primaryPartId, "leg");
  assert.equal(bridge.effectDirection.x > 0, true);
  assert.equal(bridge.effectDirection.y < 0, true);
});

test("cutscene values snap into impact near the configured impact frame", () => {
  const bridge = cutsceneModel.normalizeBridge({ durationFrames: 18, impactFrame: 15, effectStrength: 1 });
  const before = cutsceneModel.bridgeValues(13 / 24, bridge, 24);
  const after = cutsceneModel.bridgeValues(16 / 24, bridge, 24);
  assert.equal(before.impactAlpha < after.impactAlpha, true);
  assert.equal(after.flashAlpha > 0, true);
  assert.equal(after.finalSnap > before.finalSnap, true);
});

test("cutscene values move source toward the positioned impact panel", () => {
  const bridge = cutsceneModel.normalizeBridge({ sourceX: -80, sourceY: 20, impactX: 120, impactY: -40, impactFrame: 15 });
  const early = cutsceneModel.bridgeValues(1 / 24, bridge, 24);
  const late = cutsceneModel.bridgeValues(17 / 24, bridge, 24);
  assert.equal(early.sourceAlpha > late.sourceAlpha, true);
  assert.equal(late.sourceX > early.sourceX, true);
  assert.equal(late.sourceY < early.sourceY, true);
  assert.equal(Math.round(late.impactX), 120);
});

test("joint coordinates hard-code lookism-style pose keys from pivots", () => {
  const parts = [
    { id: "body", type: "body", rect: { x: 40, y: 20, w: 20, h: 50 }, pivot: { x: 10, y: 25 }, joint: { x: 10, y: 40 } },
    { id: "arm", type: "arm", rect: { x: 67, y: 25, w: 18, h: 45 }, pivot: { x: 2, y: 6 }, joint: { x: 16, y: 32 } },
  ];
  const pose = jointCoordinates.inferJointPose(parts);
  assert.deepEqual(pose.chest, [50, 29]);
  assert.deepEqual(pose.rShoulder, [69, 31]);
  assert.deepEqual(pose.rHand, [83, 57]);
});

test("cutscene bridge stores generated joint action beats", () => {
  const parts = [
    { id: "body", type: "body", rect: { x: 40, y: 20, w: 20, h: 50 }, pivot: { x: 10, y: 25 }, joint: { x: 10, y: 40 } },
    { id: "leg", type: "leg", rect: { x: 67, y: 60, w: 18, h: 45 }, pivot: { x: 2, y: 6 }, joint: { x: 16, y: 40 } },
  ];
  const bridge = cutsceneModel.createBridge(parts, "leg");
  assert.equal(bridge.jointAction.source, "part-pivots-v1");
  assert.equal(bridge.jointAction.beats.some((beat) => beat.pose.rFoot), true);
});
