const assert = require("node:assert/strict");

globalThis.Animotion = {};
require("../scripts/arm-role-semantics.js");
require("../scripts/rig-connection.js");
require("../scripts/arm-chain-resolver.js");
const autoPlace = require("../scripts/arm-handle-autoplace.js");

function test(name, fn) {
  try {
    fn();
    console.log(`PASS ${name}`);
  } catch (error) {
    console.error(`FAIL ${name}`);
    throw error;
  }
}

function part(id, patch = {}) {
  return { id, name: id, type: "arm", rect: { x: 0, y: 0, w: 10, h: 10 }, pivot: { x: 5, y: 5 }, joint: { x: 5, y: 5 }, ...patch };
}

function chainParts() {
  return [
    part("torso", { type: "body", humanRole: "torso", rect: { x: 40, y: 10, w: 30, h: 80 } }),
    part("front_upperArm", { humanRole: "upperArm", parentId: "torso", rect: { x: 80, y: 20, w: 20, h: 20 } }),
    part("front_forearm", { humanRole: "forearm", parentId: "front_upperArm", rect: { x: 125, y: 25, w: 18, h: 18 } }),
    part("front_glove", { type: "glove", humanRole: "hand", parentId: "front_forearm", rect: { x: 170, y: 30, w: 14, h: 14 } }),
  ];
}

function apply(parts, patches) {
  for (const { partId, patch } of patches) Object.assign(parts.find((part) => part.id === partId), patch);
}

function world(part, point) {
  return { x: part.rect.x + point.x, y: part.rect.y + point.y };
}

function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

test("auto-place initializes a clean upperArm forearm hand chain", () => {
  const parts = chainParts();
  const plan = autoPlace.preview(parts, "front_upperArm");
  apply(parts, plan.patches);
  const resolved = globalThis.Animotion.armChainResolver.resolve(parts, "front_forearm");

  assert.equal(plan.ok, true);
  assert.equal(resolved.separateRigPath, true);
  assert.equal(resolved.chainParentingValid, true);
  assert.equal(resolved.elbowConnectionValid, true);
  assert.equal(resolved.wristConnectionValid, true);
  assert.equal(resolved.terminalPunchPartId, "front_glove");
  assert.equal(resolved.terminalPunchPointSource, "handTip");
});

test("auto-place aligns elbow and wrist in world space", () => {
  const parts = chainParts();
  apply(parts, autoPlace.preview(parts, "front_forearm").patches);
  const upper = parts[1], forearm = parts[2], hand = parts[3];

  assert.equal(distance(world(upper, upper.joint), world(forearm, forearm.pivot)) < 0.001, true);
  assert.equal(distance(world(forearm, forearm.joint), world(hand, hand.pivot)) < 0.001, true);
});

test("auto-place does not clamp handles to part rectangles", () => {
  const parts = chainParts();
  apply(parts, autoPlace.preview(parts, "front_forearm").patches);
  const forearm = parts[2], hand = parts[3];

  assert.equal(forearm.pivot.x < 0, true);
  assert.equal(hand.pivot.x < 0, true);
  assert.equal(hand.handTip.x > hand.rect.w, true);
});

test("auto-place does not silently fix invalid parent chains", () => {
  const parts = [
    part("torso", { type: "body", humanRole: "torso" }),
    part("front_glove", { type: "glove", humanRole: "hand", parentId: "torso" }),
  ];
  const before = JSON.stringify(parts);
  const plan = autoPlace.preview(parts, "front_glove");

  assert.equal(plan.ok, false);
  assert.match(plan.chainWarnings.join("; "), /forearm/);
  assert.equal(JSON.stringify(parts), before);
});
