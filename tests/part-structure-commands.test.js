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
  const Animotion = context.window.Animotion;
  Animotion.state = {
    image: { naturalWidth: 120, naturalHeight: 90 },
    parts: [],
    selectedPartId: null,
    selection: null,
    project: Animotion.projectModel.createEmptyProject(),
  };
  Animotion.imageBounds = () => ({ width: 120, height: 90 });
  runScript(context, "scripts/path.js");
  runScript(context, "scripts/parts.js");
  runScript(context, "scripts/part-supplemental-transform.js");
  runScript(context, "scripts/part-commands.js");
  runScript(context, "scripts/part-command-history.js");
  runScript(context, "scripts/part-structure-commands.js");
  return Animotion;
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

function polygon(points) {
  return { kind: "polygon", closed: true, points };
}

test("extracting a drawn polygon creates an undoable manual split part", () => {
  const Animotion = loadAnimotion();
  const source = Animotion.partCommands.createPart("arm", { x: 10, y: 10, w: 40, h: 30 }, "rear_arm");
  Animotion.partCommands.updatePart(source.id, { pivot: { x: 5, y: 10 }, joint: { x: 35, y: 20 } });
  Animotion.state.selection = polygon([{ x: 25, y: 12 }, { x: 50, y: 15 }, { x: 48, y: 32 }, { x: 24, y: 30 }]);
  Animotion.commandHistory.clear();

  const response = Animotion.partStructureCommands.extractSelectionToPart();
  const split = response.part;

  assert.equal(response.ok, true);
  assert.equal(Animotion.state.parts.length, 2);
  assert.equal(split.splitFromPartId, source.id);
  assert.equal(split.splitMethod, "manual-polygon");
  assert.deepEqual(JSON.parse(JSON.stringify(split.rect)), { x: 24, y: 12, w: 26, h: 20 });
  assert.equal(Animotion.state.selectedPartId, split.id);
  assert.equal(Animotion.commandHistory.undo(), true);
  assert.equal(Animotion.state.parts.length, 1);
  assert.equal(Animotion.state.selectedPartId, source.id);
});

test("merging the part set replaces source parts with one polygon part", () => {
  const Animotion = loadAnimotion();
  const torso = Animotion.partCommands.createPart("body", { x: 10, y: 10, w: 20, h: 30 }, "torso");
  const arm = Animotion.partCommands.createPart("arm", { x: 32, y: 12, w: 22, h: 28 }, "arm");
  const hand = Animotion.partCommands.createPart("prop", { x: 54, y: 20, w: 10, h: 10 }, "hand");
  Animotion.partCommands.updatePart(arm.id, { parentId: torso.id });
  Animotion.partCommands.updatePart(hand.id, { parentId: arm.id });
  Animotion.state.selection = polygon([{ x: 8, y: 8 }, { x: 56, y: 8 }, { x: 58, y: 44 }, { x: 8, y: 45 }]);
  Animotion.state.selectedPartId = torso.id;
  Animotion.partStructureCommands.addSelectedPartToMergeSet();
  Animotion.state.selectedPartId = arm.id;
  Animotion.partStructureCommands.addSelectedPartToMergeSet();
  Animotion.commandHistory.clear();

  const response = Animotion.partStructureCommands.mergeSelectionWithShape();
  const merged = response.part;

  assert.equal(response.ok, true);
  assert.equal(Animotion.state.parts.some((part) => part.id === torso.id), false);
  assert.equal(Animotion.state.parts.some((part) => part.id === arm.id), false);
  assert.equal(Animotion.state.parts.length, 2);
  assert.equal(merged.parentId, null);
  assert.equal(Animotion.state.parts.find((part) => part.id === hand.id).parentId, merged.id);
  assert.deepEqual(JSON.parse(JSON.stringify(merged.rect)), { x: 8, y: 8, w: 50, h: 37 });
  assert.equal(Animotion.partStructureCommands.mergeSet().length, 0);
  assert.equal(Animotion.commandHistory.undo(), true);
  assert.equal(Animotion.state.parts.length, 3);
});
