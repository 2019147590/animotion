const assert = require("node:assert/strict");

globalThis.Animotion = {};
require("../scripts/arm-role-semantics.js");
const rigConnection = require("../scripts/rig-connection.js");

function test(name, fn) {
  try {
    fn();
    console.log(`PASS ${name}`);
  } catch (error) {
    console.error(`FAIL ${name}`);
    throw error;
  }
}

test("head connects to torso neck point", () => {
  const torso = { id: "torso", type: "body", rect: { x: 20, y: 20, w: 40, h: 80 }, pivot: { x: 20, y: 40 }, joint: { x: 20, y: 60 } };
  const head = { id: "head", type: "head", parentId: "torso", rect: { x: 25, y: 0, w: 30, h: 24 }, pivot: { x: 15, y: 22 }, joint: { x: 15, y: 12 } };
  const metadata = rigConnection.metadataForPart(head, torso);
  const points = rigConnection.previewPoints(head, torso);
  assert.equal(metadata.attachPointSelf, "neck");
  assert.equal(metadata.attachPointParent, "neck");
  assert.equal(points.find((point) => point.role === "parentConnection").label, "목 연결점");
});

test("forearm connects to upper arm elbow point", () => {
  const upper = { id: "upper-arm", type: "arm", rect: { x: 10, y: 20, w: 20, h: 40 }, pivot: { x: 10, y: 4 }, joint: { x: 12, y: 36 } };
  const forearm = { id: "front_forearm", type: "arm", parentId: "upper-arm", rect: { x: 18, y: 54, w: 18, h: 34 }, pivot: { x: 8, y: 4 }, joint: { x: 8, y: 30 } };
  const metadata = rigConnection.metadataForPart(forearm, upper);
  assert.equal(metadata.attachPointSelf, "elbow");
  assert.equal(metadata.attachPointParent, "elbow");
});

test("preview points preserve outside-rect joint and pivot coordinates", () => {
  const part = { id: "cloth", type: "prop", rect: { x: 10, y: 20, w: 20, h: 30 }, pivot: { x: -4, y: 12 }, joint: { x: 25, y: 35 } };
  const points = rigConnection.previewPoints(part);
  assert.deepEqual(points.find((point) => point.role === "rotationPivot").localPoint, { x: -4, y: 12 });
  assert.deepEqual(points.find((point) => point.role === "joint").localPoint, { x: 25, y: 35 });
});

test("arm preview points expose a separate hand tip endpoint", () => {
  const arm = { id: "bent-arm", type: "arm", rect: { x: 10, y: 20, w: 30, h: 40 }, pivot: { x: 26, y: 6 }, joint: { x: 14, y: 18 }, handTip: { x: 4, y: 36 } };
  const points = rigConnection.previewPoints(arm);
  assert.deepEqual(points.find((point) => point.role === "joint").localPoint, { x: 14, y: 18 });
  assert.deepEqual(points.find((point) => point.role === "handTip").localPoint, { x: 4, y: 36 });
});

test("human arm preview points enforce role-specific labels and handTip visibility", () => {
  const upperArm = { id: "upper", type: "arm", humanRole: "upperArm", rect: { x: 0, y: 0, w: 20, h: 40 }, pivot: { x: 10, y: 4 }, joint: { x: 12, y: 36 }, handTip: { x: 18, y: 38 } };
  const forearm = { id: "forearm", type: "arm", humanRole: "forearm", rect: { x: 0, y: 0, w: 20, h: 40 }, pivot: { x: 12, y: 4 }, joint: { x: 10, y: 34 }, handTip: { x: 18, y: 38 } };
  const hand = { id: "glove", type: "prop", humanRole: "hand", rect: { x: 0, y: 0, w: 20, h: 18 }, pivot: { x: 2, y: 9 }, joint: { x: 8, y: 9 }, handTip: { x: 18, y: 8 } };
  const upperPoints = rigConnection.previewPoints(upperArm);
  const forearmPoints = rigConnection.previewPoints(forearm);
  const handPoints = rigConnection.previewPoints(hand);

  assert.equal(upperPoints.find((point) => point.role === "rotationPivot").label, "어깨 회전점 / shoulder pivot");
  assert.equal(upperPoints.find((point) => point.role === "joint").label, "팔꿈치 연결점 / elbow joint");
  assert.equal(upperPoints.some((point) => point.role === "handTip"), false);
  assert.equal(forearmPoints.find((point) => point.role === "rotationPivot").label, "팔꿈치 회전점 / elbow pivot");
  assert.equal(forearmPoints.find((point) => point.role === "joint").label, "손목 연결점 / wrist joint");
  assert.equal(forearmPoints.some((point) => point.role === "handTip"), false);
  assert.equal(handPoints.find((point) => point.role === "rotationPivot").label, "손목 회전점 / wrist pivot");
  assert.equal(handPoints.find((point) => point.role === "handTip").label, "주먹 타격점 / punch contact point");
  assert.equal(handPoints.some((point) => point.role === "joint"), false);
});

test("parentId takes priority when parentId and parentPartId both exist", () => {
  const part = { id: "head", parentId: "body", parentPartId: "legacy-body" };
  assert.equal(rigConnection.parentIdFor(part), "body");
});

test("parentPartId remains a fallback parent identifier", () => {
  const part = { id: "head", parentId: null, parentPartId: "legacy-body" };
  const metadata = rigConnection.metadataForPart(part, { id: "legacy-body", type: "body", rect: { x: 0, y: 0, w: 20, h: 40 } });
  assert.equal(rigConnection.parentIdFor(part), "legacy-body");
  assert.equal(metadata.parentPartId, "legacy-body");
});
