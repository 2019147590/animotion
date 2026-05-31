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
    "scripts/project-model.js",
    "scripts/project-serialization.js",
    "scripts/rigging.js",
    "scripts/command-history.js",
  ]) runScript(context, path);
  context.window.Animotion.state = {
    image: { naturalWidth: 100, naturalHeight: 80 },
    parts: [],
    selectedPartId: null,
    editTarget: { kind: "part", partId: null, maskId: null },
    project: context.window.Animotion.projectModel.createEmptyProject(),
  };
  context.window.Animotion.imageBounds = () => ({ width: 100, height: 80 });
  runScript(context, "scripts/part-visibility-masks.js");
  runScript(context, "scripts/edit-target.js");
  runScript(context, "scripts/path.js");
  runScript(context, "scripts/parts.js");
  runScript(context, "scripts/part-supplemental-transform.js");
  runScript(context, "scripts/part-commands.js");
  runScript(context, "scripts/part-command-history.js");
  runScript(context, "scripts/part-transform-commands.js");
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

function plain(value) {
  return JSON.parse(JSON.stringify(value));
}

test("selected part copy creates an offset selected duplicate with undo", () => {
  const Animotion = loadAnimotion();
  const source = Animotion.partCommands.createPart("body", { x: 10, y: 12, w: 20, h: 30 }, "torso");
  Animotion.commandHistory.clear();

  const copy = Animotion.partCommands.copySelectedPart();

  assert.equal(Animotion.state.parts.length, 2);
  assert.notEqual(copy.id, source.id);
  assert.equal(copy.name, "torso copy");
  assert.equal(copy.order, 2);
  assert.equal(copy.transform.x, 16);
  assert.equal(copy.transform.y, 16);
  assert.equal(Animotion.state.selectedPartId, copy.id);
  assert.equal(Animotion.commandHistory.undo(), true);
  assert.equal(Animotion.state.parts.length, 1);
  assert.equal(Animotion.state.selectedPartId, source.id);
  assert.equal(Animotion.commandHistory.redo(), true);
  assert.equal(Animotion.state.parts.length, 2);
});

test("selected part copy gives visibility masks fresh ids and keeps part edit target", () => {
  const Animotion = loadAnimotion();
  const source = Animotion.partCommands.createPart("body", { x: 10, y: 12, w: 20, h: 30 }, "torso");
  source.visibilityMasks = [{ id: "mask-original", mask: { kind: "polygon", points: [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }] }, keyframes: [{ frame: 1, strength: 1 }] }];

  const copy = Animotion.partCommands.copySelectedPart();

  assert.equal(copy.visibilityMasks.length, 1);
  assert.notEqual(copy.visibilityMasks[0].id, source.visibilityMasks[0].id);
  assert.deepEqual(plain(Animotion.state.editTarget), { kind: "part", partId: copy.id, maskId: null });
  assert.equal(Animotion.state.selectedVisibilityMaskId, null);
});

test("selected part horizontal flip toggles static scaleX", () => {
  const Animotion = loadAnimotion();
  const part = Animotion.partCommands.createPart("arm", { x: 20, y: 20, w: 20, h: 20 });

  Animotion.partCommands.flipSelectedPartHorizontal();
  assert.equal(part.transform.scaleX, -1);

  Animotion.partCommands.flipSelectedPartHorizontal();
  assert.equal(part.transform.scaleX, 1);
});

test("selected part transforms keep existing visibility mask geometry unchanged", () => {
  const Animotion = loadAnimotion();
  const part = Animotion.partCommands.createPart("arm", { x: 20, y: 20, w: 20, h: 20 });
  part.visibilityMasks = [{
    id: "mask-existing",
    mask: { kind: "polygon", points: [{ x: 2, y: 2 }, { x: 14, y: 2 }, { x: 14, y: 18 }, { x: 2, y: 18 }] },
    keyframes: [{ frame: 1, strength: 1 }, { frame: 12, strength: 0.25 }],
  }];
  const before = JSON.stringify(part.visibilityMasks);

  Animotion.partCommands.flipSelectedPartHorizontal();
  Animotion.partCommands.rotateSelectedPartClockwise(30);

  assert.equal(JSON.stringify(part.visibilityMasks), before);
  assert.equal(part.transform.scaleX, -1);
  assert.equal(part.transform.rotation, 30);
});

test("selected part rotation commands rotate by quarter turns", () => {
  const Animotion = loadAnimotion();
  const part = Animotion.partCommands.createPart("head", { x: 20, y: 8, w: 20, h: 20 });

  Animotion.partCommands.rotateSelectedPartClockwise();
  assert.equal(part.transform.rotation, 90);

  Animotion.partCommands.rotateSelectedPartCounterClockwise();
  assert.equal(part.transform.rotation, 0);
});

test("selected part rotation commands accept custom angles", () => {
  const Animotion = loadAnimotion();
  const part = Animotion.partCommands.createPart("head", { x: 20, y: 8, w: 20, h: 20 });

  Animotion.partCommands.rotateSelectedPartClockwise(22.5);
  assert.equal(part.transform.rotation, 22.5);

  Animotion.partCommands.rotateSelectedPartCounterClockwise(7.5);
  assert.equal(part.transform.rotation, 15);
});

test("selected part rotation rejects invalid custom angles", () => {
  const Animotion = loadAnimotion();
  const part = Animotion.partCommands.createPart("head", { x: 20, y: 8, w: 20, h: 20 });
  const before = JSON.parse(JSON.stringify(part.transform));

  const result = Animotion.partCommands.rotateSelectedPartBy("not-a-number");

  assert.equal(result, null);
  assert.deepEqual(JSON.parse(JSON.stringify(part.transform)), before);
});
