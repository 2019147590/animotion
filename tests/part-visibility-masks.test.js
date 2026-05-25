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
    "scripts/config.js", "scripts/geometry.js", "scripts/motion-model.js", "scripts/human-rig-schema.js",
    "scripts/arm-role-semantics.js", "scripts/rig-connection.js", "scripts/part-visibility-masks.js",
    "scripts/project-model.js", "scripts/project-serialization.js", "scripts/rigging.js", "scripts/command-history.js",
  ]) runScript(context, path);
  const Animotion = context.window.Animotion;
  Animotion.state = {
    image: { naturalWidth: 120, naturalHeight: 90 },
    imageName: "source.png",
    parts: [],
    selectedPartId: null,
    selection: null,
    currentFrame: 1,
    project: Animotion.projectModel.createEmptyProject(),
  };
  Animotion.imageBounds = () => ({ width: 120, height: 90 });
  runScript(context, "scripts/path.js");
  runScript(context, "scripts/parts.js");
  runScript(context, "scripts/part-supplemental-transform.js");
  runScript(context, "scripts/part-commands.js");
  runScript(context, "scripts/part-command-history.js");
  runScript(context, "scripts/part-visibility-mask-commands.js");
  runScript(context, "scripts/part-visibility-mask-render.js");
  return Animotion;
}

function runScript(context, path) {
  vm.runInContext(fs.readFileSync(path, "utf8"), context, { filename: path });
}

function fakeCanvas() {
  return { width: 0, height: 0, getContext: () => ({ drawImage() {}, fill() {}, set globalCompositeOperation(value) { this._composite = value; }, set fillStyle(value) { this._fillStyle = value; } }) };
}

function randomId() {
  randomId.count = (randomId.count || 0) + 1;
  return `mask-${randomId.count}`;
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

test("visibility mask commands create undoable frame strength keyframes", () => {
  const Animotion = loadAnimotion();
  const part = Animotion.partCommands.createPart("arm", { x: 10, y: 10, w: 40, h: 30 }, "rear upperArm");
  Animotion.state.selection = polygon([{ x: 12, y: 12 }, { x: 42, y: 12 }, { x: 42, y: 36 }, { x: 12, y: 36 }]);
  Animotion.commandHistory.clear();

  const created = Animotion.partVisibilityMaskCommands.createMaskFromSelection(1);
  Animotion.state.currentFrame = 11;
  const keyed = Animotion.partVisibilityMaskCommands.setCurrentFrameStrength(0);

  assert.equal(created.ok, true);
  assert.equal(keyed.ok, true);
  assert.equal(part.visibilityMasks.length, 1);
  assert.equal(Animotion.partVisibilityMasks.evaluatedStrength(part.visibilityMasks[0], 6), 0.5);
  assert.deepEqual(JSON.parse(JSON.stringify(part.visibilityMasks[0].mask.points[0])), { x: 2, y: 2 });
  assert.equal(Animotion.commandHistory.undo(), true);
  assert.equal(part.visibilityMasks[0].keyframes.length, 1);
});

test("visibility masks survive project save and load normalization", () => {
  const Animotion = loadAnimotion();
  const part = Animotion.partCommands.createPart("arm", { x: 10, y: 10, w: 40, h: 30 }, "rear upperArm");
  Animotion.partCommands.updatePart(part.id, {
    visibilityMasks: [{ id: "mask-a", mask: { kind: "polygon", points: [{ x: 0, y: 0 }, { x: 20, y: 0 }, { x: 20, y: 20 }] }, keyframes: [{ frame: 1, strength: 1 }, { frame: 12, strength: 0.25 }] }],
  });

  const saved = Animotion.projectModel.projectFromEditorState(Animotion.state);
  const loaded = Animotion.projectModel.editorPartsFromProject(Animotion.projectModel.normalizeProject(saved, { imageBounds: { width: 120, height: 90 } }));

  assert.equal(saved.parts[0].visibilityMasks[0].id, "mask-a");
  assert.equal(loaded[0].visibilityMasks[0].keyframes[1].strength, 0.25);
});

test("visibility mask render erases active mask regions at evaluated strength", () => {
  const Animotion = loadAnimotion();
  const ctx = renderContext();
  const part = { rect: { x: 10, y: 10 }, visibilityMasks: [{ id: "mask-a", mask: { kind: "polygon", points: [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }] }, keyframes: [{ frame: 1, strength: 1 }, { frame: 11, strength: 0 }] }] };

  const result = Animotion.partVisibilityMaskRender.apply(ctx, part, 6, (shape, x, y) => ({ shape, x, y }));

  assert.equal(result.count, 1);
  assert.equal(result.strengths[0], 0.5);
  assert.equal(ctx.ops.some((op) => op.name === "composite" && op.value === "destination-out"), true);
  assert.equal(ctx.ops.some((op) => op.name === "alpha" && op.value === 0.5), true);
  assert.equal(ctx.ops.some((op) => op.name === "fill"), true);
});

function renderContext() {
  const ctx = { ops: [], save() { this.ops.push({ name: "save" }); }, restore() { this.ops.push({ name: "restore" }); }, fill(path) { this.ops.push({ name: "fill", path }); } };
  Object.defineProperty(ctx, "globalAlpha", { set(value) { this.ops.push({ name: "alpha", value }); } });
  Object.defineProperty(ctx, "globalCompositeOperation", { set(value) { this.ops.push({ name: "composite", value }); } });
  return ctx;
}
