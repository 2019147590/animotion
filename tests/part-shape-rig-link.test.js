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
  const context = {
    window: { Animotion: {} },
    document: { createElement: () => fakeCanvas() },
    crypto: { randomUUID: randomId },
    Path2D: FakePath2D,
  };
  vm.createContext(context);
  for (const path of [
    "scripts/config.js",
    "scripts/geometry.js",
    "scripts/motion-model.js",
    "scripts/human-rig-schema.js",
    "scripts/arm-role-semantics.js",
    "scripts/rig-connection.js",
    "scripts/arm-chain-resolver.js",
    "scripts/project-model.js",
    "scripts/project-serialization.js",
    "scripts/rigging.js",
  ]) runScript(context, path);
  context.window.Animotion.state = {
    image: { naturalWidth: 100, naturalHeight: 80 },
    parts: [],
    selectedPartId: null,
    project: context.window.Animotion.projectModel.createEmptyProject(),
  };
  context.window.Animotion.imageBounds = () => ({ width: 100, height: 80 });
  for (const path of [
    "scripts/path.js",
    "scripts/parts.js",
    "scripts/part-shape-rig-link.js",
    "scripts/part-commands.js",
  ]) runScript(context, path);
  return context.window.Animotion;
}

function runScript(context, path) {
  vm.runInContext(fs.readFileSync(path, "utf8"), context, { filename: path });
}

function fakeCanvas() {
  return {
    width: 0,
    height: 0,
    getContext: () => ({
      drawImage() {},
      fill() {},
      set globalCompositeOperation(value) { this._globalCompositeOperation = value; },
      set fillStyle(value) { this._fillStyle = value; },
    }),
  };
}

function randomId() {
  randomId.count = (randomId.count || 0) + 1;
  return `part-${randomId.count}`;
}

class FakePath2D {
  moveTo() {}
  lineTo() {}
  closePath() {}
  ellipse() {}
}

function createArmChain(Animotion) {
  const upper = Animotion.partCommands.createPart("arm", { x: 10, y: 10, w: 20, h: 20 }, "front_upperArm");
  Animotion.partCommands.updatePart(upper.id, { humanRole: "upperArm", pivot: { x: 0, y: 10 }, joint: { x: 20, y: 10 } });
  const forearm = Animotion.partCommands.createPart("arm", { x: 30, y: 10, w: 20, h: 20 }, "front_forearm");
  Animotion.partCommands.updatePart(forearm.id, { humanRole: "forearm", parentId: upper.id, pivot: { x: 0, y: 10 }, joint: { x: 20, y: 10 } });
  const hand = Animotion.partCommands.createPart("prop", { x: 50, y: 15, w: 10, h: 10 }, "front_glove");
  Animotion.partCommands.updatePart(hand.id, { humanRole: "hand", parentId: forearm.id, pivot: { x: 0, y: 5 }, handTip: { x: 10, y: 5 } });
  return { upper, forearm, hand };
}

function imagePoint(part, key) {
  return { x: part.rect.x + part[key].x, y: part.rect.y + part[key].y };
}

function plain(value) {
  return JSON.parse(JSON.stringify(value));
}

test("forearm outline edits keep elbow and wrist connected to adjacent parts", () => {
  const Animotion = loadAnimotion();
  const { upper, forearm, hand } = createArmChain(Animotion);

  Animotion.partCommands.applyShapeToPart(forearm.id, Animotion.geometry.rectShape({ x: 32, y: 12, w: 24, h: 16 }));

  assert.deepEqual(imagePoint(forearm, "pivot"), imagePoint(upper, "joint"));
  assert.deepEqual(imagePoint(forearm, "joint"), imagePoint(hand, "pivot"));
  assert.deepEqual(plain(forearm.pivot), { x: -2, y: 8 });
  assert.deepEqual(plain(forearm.joint), { x: 18, y: 8 });
});

test("upper arm outline edits keep its joint aligned to forearm pivot", () => {
  const Animotion = loadAnimotion();
  const { upper, forearm } = createArmChain(Animotion);

  Animotion.partCommands.applyShapeToPart(upper.id, Animotion.geometry.rectShape({ x: 8, y: 8, w: 24, h: 24 }));

  assert.deepEqual(imagePoint(upper, "joint"), imagePoint(forearm, "pivot"));
  assert.deepEqual(imagePoint(upper, "pivot"), { x: 10, y: 20 });
  assert.deepEqual(plain(upper.joint), { x: 22, y: 12 });
});

test("hand outline edits keep wrist connected and preserve hand tip position", () => {
  const Animotion = loadAnimotion();
  const { forearm, hand } = createArmChain(Animotion);
  const handTipImage = imagePoint(hand, "handTip");

  Animotion.partCommands.applyShapeToPart(hand.id, Animotion.geometry.rectShape({ x: 48, y: 14, w: 14, h: 12 }));

  assert.deepEqual(imagePoint(hand, "pivot"), imagePoint(forearm, "joint"));
  assert.deepEqual(imagePoint(hand, "handTip"), handTipImage);
  assert.deepEqual(plain(hand.pivot), { x: 2, y: 6 });
  assert.deepEqual(plain(hand.handTip), { x: 12, y: 6 });
});
