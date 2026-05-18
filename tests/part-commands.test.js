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
