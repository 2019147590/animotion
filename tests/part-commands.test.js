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
    "scripts/rig-connection.js",
    "scripts/project-model.js",
    "scripts/project-serialization.js",
    "scripts/rigging.js",
    "scripts/command-history.js",
  ]) runScript(context, path);
  context.window.Animotion.state = {
    image: { naturalWidth: 100, naturalHeight: 80 },
    parts: [],
    selectedPartId: null,
    project: context.window.Animotion.projectModel.createEmptyProject(),
  };
  context.window.Animotion.imageBounds = () => ({ width: 100, height: 80 });
  runScript(context, "scripts/path.js");
  runScript(context, "scripts/parts.js");
  runScript(context, "scripts/part-commands.js");
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

test("part command creates a selected part and syncs project parts", () => {
  const Animotion = loadAnimotion();
  const part = Animotion.partCommands.createPart("body", { x: 10, y: 12, w: 20, h: 30 });
  assert.equal(Animotion.state.parts.length, 1);
  assert.equal(Animotion.state.selectedPartId, part.id);
  assert.equal(Animotion.state.project.parts, Animotion.state.parts);
  assert.equal(part.order, 1);
  assert.equal(part.rect.x, 10);
});

test("part command rejects cyclic parent updates", () => {
  const Animotion = loadAnimotion();
  const parent = Animotion.partCommands.createPart("body", { x: 0, y: 0, w: 20, h: 20 });
  const child = Animotion.partCommands.createPart("head", { x: 4, y: 0, w: 10, h: 10 });
  assert.equal(child.parentId, parent.id);
  Animotion.partCommands.updatePart(parent.id, { parentId: child.id });
  assert.equal(parent.parentId, null);
});

test("part command creates explicit rig connection metadata", () => {
  const Animotion = loadAnimotion();
  const torso = Animotion.partCommands.createPart("body", { x: 20, y: 20, w: 40, h: 50 });
  const head = Animotion.partCommands.createPart("head", { x: 24, y: 0, w: 30, h: 24 });
  assert.equal(head.parentId, torso.id);
  assert.equal(head.parentPartId, torso.id);
  assert.equal(head.attachPointSelf, "neck");
  assert.equal(head.attachPointParent, "neck");
  assert.deepEqual(head.rotationPivot, head.pivot);
  assert.equal(head.followStrength, 1);
});

test("part command delete removes the part and clears child parents", () => {
  const Animotion = loadAnimotion();
  const parent = Animotion.partCommands.createPart("body", { x: 0, y: 0, w: 20, h: 20 });
  const child = Animotion.partCommands.createPart("head", { x: 4, y: 0, w: 10, h: 10 });
  Animotion.partCommands.deletePart(parent.id);
  assert.equal(Animotion.state.parts.length, 1);
  assert.equal(Animotion.state.parts[0].id, child.id);
  assert.equal(Animotion.state.parts[0].parentId, null);
  assert.equal(Animotion.state.parts[0].parentPartId, null);
});

test("part command parent compatibility uses parentPartId for cycles and delete cleanup", () => {
  const Animotion = loadAnimotion();
  const torso = Animotion.partCommands.createPart("body", { x: 0, y: 0, w: 20, h: 20 });
  const head = Animotion.partCommands.createPart("head", { x: 4, y: 0, w: 10, h: 10 });
  head.parentId = null;
  head.parentPartId = torso.id;
  Animotion.partCommands.updatePart(torso.id, { parentId: head.id });
  assert.equal(torso.parentId, null);
  Animotion.partCommands.deletePart(torso.id);
  const remaining = Animotion.state.parts[0];
  assert.equal(remaining.parentId, null);
  assert.equal(remaining.parentPartId, null);
});

test("shape edits preserve outside pivot and joint image positions", () => {
  const Animotion = loadAnimotion();
  const part = Animotion.partCommands.createPart("arm", { x: 20, y: 20, w: 20, h: 20 });
  Animotion.partCommands.updatePart(part.id, {
    pivot: { x: -8, y: 10 },
    joint: { x: 35, y: -6 },
  });
  const pivotImage = { x: part.rect.x + part.pivot.x, y: part.rect.y + part.pivot.y };
  const jointImage = { x: part.rect.x + part.joint.x, y: part.rect.y + part.joint.y };
  Animotion.partCommands.applyShapeToPart(part.id, Animotion.geometry.rectShape({ x: 30, y: 30, w: 12, h: 12 }));
  assert.deepEqual({ x: part.rect.x + part.pivot.x, y: part.rect.y + part.pivot.y }, pivotImage);
  assert.deepEqual({ x: part.rect.x + part.joint.x, y: part.rect.y + part.joint.y }, jointImage);
  assert.equal(part.pivot.x < 0, true);
  assert.equal(part.joint.x > part.rect.w, true);
});

test("arm parts preserve hand tip rig point through shape edits", () => {
  const Animotion = loadAnimotion();
  const part = Animotion.partCommands.createPart("arm", { x: 20, y: 20, w: 20, h: 20 });
  Animotion.partCommands.updatePart(part.id, { handTip: { x: 35, y: -6 } });
  const handTipImage = { x: part.rect.x + part.handTip.x, y: part.rect.y + part.handTip.y };
  Animotion.partCommands.applyShapeToPart(part.id, Animotion.geometry.rectShape({ x: 30, y: 30, w: 12, h: 12 }));
  assert.deepEqual({ x: part.rect.x + part.handTip.x, y: part.rect.y + part.handTip.y }, handTipImage);
  assert.equal(part.handTip.x > part.rect.w, true);
});

test("part update command records undo and redo patches", () => {
  const Animotion = loadAnimotion();
  const part = Animotion.partCommands.createPart("body", { x: 0, y: 0, w: 20, h: 20 });
  Animotion.partCommands.updatePart(part.id, { name: "torso", order: 4 });
  assert.equal(part.name, "torso");
  assert.equal(part.order, 4);
  assert.equal(Animotion.commandHistory.canUndo(), true);
  assert.equal(Animotion.commandHistory.undo(), true);
  assert.equal(part.name, "body_01");
  assert.equal(part.order, 1);
  assert.equal(Animotion.commandHistory.redo(), true);
  assert.equal(part.name, "torso");
  assert.equal(part.order, 4);
});

test("part update command clears redo after a new edit", () => {
  const Animotion = loadAnimotion();
  const part = Animotion.partCommands.createPart("body", { x: 0, y: 0, w: 20, h: 20 });
  Animotion.partCommands.updatePart(part.id, { name: "torso" });
  Animotion.commandHistory.undo();
  Animotion.partCommands.updatePart(part.id, { name: "core" });
  assert.equal(Animotion.commandHistory.canRedo(), false);
  assert.equal(part.name, "core");
});
