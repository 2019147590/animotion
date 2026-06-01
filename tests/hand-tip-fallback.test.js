const assert = require("node:assert/strict");

globalThis.Animotion = {};
require("../scripts/arm-role-semantics.js");
const rigging = require("../scripts/rigging.js");
const rigConnection = require("../scripts/rig-connection.js");
const previewRigPoints = require("../scripts/preview-rig-points.js");
require("../scripts/motion-model.js");
const jointCoordinates = require("../scripts/joint-coordinates.js");
const motionAnchors = require("../scripts/motion-anchors.js");
require("../scripts/arm-extension.js");
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

function armWithoutHandTip() {
  return { id: "arm_01", type: "arm", rect: { x: 20, y: 30, w: 50, h: 60 }, pivot: { x: 8, y: 12 }, joint: { x: 30, y: 34 } };
}

test("missing arm handTip infers a distinct fist point beyond the elbow", () => {
  const arm = armWithoutHandTip();
  const handTip = rigging.handTipForPart(arm);
  assert.notDeepEqual(handTip, arm.joint);
  assert.equal(handTip.x > arm.joint.x, true);
  assert.equal(handTip.y > arm.joint.y, true);
});

test("saved handTip at the elbow is treated as invalid legacy data", () => {
  const arm = { ...armWithoutHandTip(), handTip: { x: 30, y: 34 } };
  const handTip = rigging.handTipForPart(arm);
  assert.equal(rigging.validHandTipForPart(arm, arm.handTip), false);
  assert.notDeepEqual(handTip, arm.joint);
});

test("rig preview handTip handle does not fall back to the elbow", () => {
  const arm = armWithoutHandTip();
  const point = rigConnection.previewPoints(arm).find((candidate) => candidate.role === "handTip").localPoint;
  assert.deepEqual(point, rigging.handTipForPart(arm));
  assert.notDeepEqual(point, arm.joint);
});

test("rig preview ignores an invalid saved handTip at the elbow", () => {
  const arm = { ...armWithoutHandTip(), handTip: { x: 30, y: 34 } };
  const point = rigConnection.previewPoints(arm).find((candidate) => candidate.role === "handTip").localPoint;
  assert.deepEqual(point, rigging.handTipForPart(arm));
  assert.notDeepEqual(point, arm.joint);
});

test("preview local handTip point uses inferred fist point when unsaved", () => {
  const arm = armWithoutHandTip();
  const point = previewRigPoints.localPoint(arm, { role: "handTip", localPoint: arm.joint });
  assert.deepEqual(point, rigging.handTipForPart(arm));
  assert.notDeepEqual(point, arm.joint);
});

test("joint pose and anchor endpoint use inferred handTip instead of elbow", () => {
  const body = { id: "body", type: "body", rect: { x: 70, y: 20, w: 30, h: 80 }, pivot: { x: 15, y: 20 }, joint: { x: 15, y: 68 } };
  const arm = armWithoutHandTip();
  const pose = jointCoordinates.inferJointPose([body, arm]);
  const hand = rigging.handTipForPart(arm);
  const absoluteHand = [arm.rect.x + hand.x, arm.rect.y + hand.y];
  assert.deepEqual(pose.lHand, absoluteHand);
  assert.notDeepEqual(pose.lHand, [arm.rect.x + arm.joint.x, arm.rect.y + arm.joint.y]);
  assert.equal(motionAnchors.classificationDebug({ template: "punch" }, [body, arm], arm, pose, { end: "lHand", root: "lShoulder" }, { x: 1, y: 0 }, { x: 180, y: 60 }).endpointSource, "inferred handTip");
});

test("trajectory track regeneration keeps missing handTip arm off elbow-driven joint motion", () => {
  const body = { id: "body", type: "body", rect: { x: 40, y: 20, w: 24, h: 70 }, pivot: { x: 12, y: 20 }, joint: { x: 12, y: 60 } };
  const arm = { id: "arm_01", type: "arm", humanRole: "forearm", rect: { x: 78, y: 34, w: 42, h: 48 }, pivot: { x: 4, y: 8 }, joint: { x: 24, y: 28 } };
  const parts = [body, arm];
  const before = JSON.parse(JSON.stringify(parts));
  const action = {
    source: "motion-planner-punch-anchors-v1",
    focusKey: "rHand",
    actionTimeline: { template: "punch" },
    targetDebug: { punchStyle: "rear-cross" },
    beats: [{ id: "impact", at: 24, pose: { hip: [52, 80], rHand: [170, 56] } }],
  };

  const track = motionPlanner.tracksForJointAction(parts, "arm_01", action).find((candidate) => candidate.partId === "arm_01");
  const pose = track.keyframes[0].pose;

  assert.equal(parts[1].handTip, undefined);
  assert.deepEqual(parts, before);
  assert.equal(pose.jointX, 0);
  assert.equal(pose.jointY, 0);
  assert.equal(Math.abs(pose.rotate) > 0 || Math.abs(pose.scaleY) > 0, true);
});
