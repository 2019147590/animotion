const assert = require("node:assert/strict");

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
