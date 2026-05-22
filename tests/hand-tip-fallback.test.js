const assert = require("node:assert/strict");

globalThis.Animotion = {};
const rigging = require("../scripts/rigging.js");
const rigConnection = require("../scripts/rig-connection.js");
const previewRigPoints = require("../scripts/preview-rig-points.js");
const jointCoordinates = require("../scripts/joint-coordinates.js");
const motionAnchors = require("../scripts/motion-anchors.js");

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
  return { id: "arm_01", type: "arm", humanRole: "forearm", rect: { x: 20, y: 30, w: 50, h: 60 }, pivot: { x: 8, y: 12 }, joint: { x: 30, y: 34 } };
}

test("missing arm handTip infers a distinct fist point beyond the elbow", () => {
  const arm = armWithoutHandTip();
  const handTip = rigging.handTipForPart(arm);
  assert.notDeepEqual(handTip, arm.joint);
  assert.equal(handTip.x > arm.joint.x, true);
  assert.equal(handTip.y > arm.joint.y, true);
});

test("rig preview handTip handle does not fall back to the elbow", () => {
  const arm = armWithoutHandTip();
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
