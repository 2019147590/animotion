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
    "scripts/arm-role-semantics.js", "scripts/rig-connection.js", "scripts/part-transform-geometry.js", "scripts/part-visibility-masks.js",
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
  runScript(context, "scripts/edit-target.js");
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
  const canvas = { width: 0, height: 0, __ctx: renderContext(), getContext() { return this.__ctx; } };
  fakeCanvas.created.push(canvas);
  return canvas;
}
fakeCanvas.created = [];

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

test("visibility mask creation stores points in transformed part local space", () => {
  const Animotion = loadAnimotion();
  const part = Animotion.partCommands.createPart("arm", { x: 10, y: 10, w: 20, h: 10 }, "flipped arm");
  Animotion.partCommands.updatePart(part.id, { pivot: { x: 10, y: 5 }, transform: { x: 30, y: 0, rotation: 0, scaleX: -1, scaleY: 1 } });
  Animotion.state.selection = polygon([{ x: 45, y: 12 }, { x: 55, y: 12 }, { x: 55, y: 18 }, { x: 45, y: 18 }]);

  const created = Animotion.partVisibilityMaskCommands.createMaskFromSelection(1);

  assert.equal(created.ok, true);
  assert.deepEqual(JSON.parse(JSON.stringify(part.visibilityMasks[0].mask.points)), [
    { x: 15, y: 2 }, { x: 5, y: 2 }, { x: 5, y: 8 }, { x: 15, y: 8 },
  ]);
});

test("visibility mask creation handles rotated part local space", () => {
  const Animotion = loadAnimotion();
  const part = Animotion.partCommands.createPart("arm", { x: 10, y: 10, w: 20, h: 10 }, "rotated arm");
  Animotion.partCommands.updatePart(part.id, { pivot: { x: 0, y: 0 }, transform: { x: 0, y: 0, rotation: 90, scaleX: 1, scaleY: 1 } });
  Animotion.state.selection = polygon([{ x: 10, y: 10 }, { x: 10, y: 30 }, { x: 0, y: 30 }, { x: 0, y: 10 }]);

  const created = Animotion.partVisibilityMaskCommands.createMaskFromSelection(1);

  assert.equal(created.ok, true);
  assert.deepEqual(JSON.parse(JSON.stringify(part.visibilityMasks[0].mask.points)), [
    { x: 0, y: 0 }, { x: 20, y: 0 }, { x: 20, y: 10 }, { x: 0, y: 10 },
  ]);
});

test("visibility mask creation clears polygon selection and activates mask edit target", () => {
  const Animotion = loadAnimotion();
  const body = Animotion.partCommands.createPart("body", { x: 10, y: 10, w: 40, h: 40 }, "body copy");
  Animotion.state.selection = polygon([{ x: 12, y: 12 }, { x: 32, y: 12 }, { x: 32, y: 32 }, { x: 12, y: 32 }]);

  const created = Animotion.partVisibilityMaskCommands.createMaskFromSelection(1);

  assert.equal(created.ok, true);
  assert.equal(Animotion.state.selection, null);
  assert.deepEqual(plain(Animotion.state.editTarget), { kind: "visibilityMask", partId: body.id, maskId: created.mask.id });
});

test("selecting another part clears stale visibility mask edit target until a child mask is selected", () => {
  const Animotion = loadAnimotion();
  const body = Animotion.partCommands.createPart("body", { x: 10, y: 10, w: 40, h: 40 }, "body copy");
  Animotion.state.selection = polygon([{ x: 12, y: 12 }, { x: 32, y: 12 }, { x: 32, y: 32 }, { x: 12, y: 32 }]);
  Animotion.partVisibilityMaskCommands.createMaskFromSelection(1);
  const upperArm = Animotion.partCommands.createPart("arm", { x: 60, y: 10, w: 20, h: 30 }, "front upperArm copy");
  Animotion.partCommands.updatePart(upperArm.id, {
    visibilityMasks: [{ id: "upper-mask", mask: { kind: "polygon", points: [{ x: 0, y: 0 }, { x: 12, y: 0 }, { x: 12, y: 12 }] }, keyframes: [{ frame: 1, strength: 0.4 }] }],
  });

  const stale = Animotion.partVisibilityMaskCommands.selectedMask();
  const selected = Animotion.partVisibilityMaskCommands.selectMask("upper-mask").mask;

  assert.equal(stale, null);
  assert.equal(selected.id, "upper-mask");
  assert.deepEqual(plain(Animotion.state.editTarget), { kind: "visibilityMask", partId: upperArm.id, maskId: "upper-mask" });
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

test("masked part rendering isolates destination-out from the preview canvas", () => {
  const Animotion = loadAnimotion();
  const main = renderContext();
  const part = maskedPart();
  fakeCanvas.created = [];
  main.drawImage({ id: "hand" }, 30, 10, 20, 20);

  const result = Animotion.partVisibilityMaskRender.drawPartImage(main, part, 1, (shape, x, y) => ({ shape, x, y }));
  const layer = fakeCanvas.created.at(-1);

  assert.equal(result.isolatedLayer, true);
  assert.equal(main.ops.some((op) => op.name === "composite" && op.value === "destination-out"), false);
  assert.equal(layer.__ctx.ops.some((op) => op.name === "composite" && op.value === "destination-out"), true);
  assert.equal(main.ops.filter((op) => op.name === "drawImage").length, 2);
});

test("source view masked transformed part does not erase existing background pixels", () => {
  const Animotion = loadAnimotion();
  const main = renderContext();
  const part = maskedPart({ transform: { x: 20, y: 0, rotation: 0, scaleX: -1, scaleY: 1 } });
  fakeCanvas.created = [];
  main.drawImage({ id: "original-image" }, 0, 0, 120, 90);
  main.save();
  main.transform(-1, 0, 0, 1, 60, 0);

  const result = Animotion.partVisibilityMaskRender.drawPartImage(main, part, 1, (shape, x, y) => ({ shape, x, y }));
  main.restore();

  assert.equal(result.isolatedLayer, true);
  assert.equal(main.ops.some((op) => op.name === "composite" && op.value === "destination-out"), false);
  assert.equal(fakeCanvas.created.at(-1).__ctx.ops.some((op) => op.name === "fill"), true);
});

test("unmasked part rendering keeps the existing direct draw path", () => {
  const Animotion = loadAnimotion();
  const main = renderContext();
  const part = { ...maskedPart(), visibilityMasks: [] };
  fakeCanvas.created = [];

  const result = Animotion.partVisibilityMaskRender.drawPartImage(main, part, 1, () => ({}));

  assert.equal(result, null);
  assert.equal(fakeCanvas.created.length, 0);
  assert.deepEqual(main.ops.filter((op) => op.name === "drawImage").map((op) => op.args.slice(1)), [
    [10, 10, 20, 20],
  ]);
});

test("masked transformed part still draws its own masked layer back to the part rect", () => {
  const Animotion = loadAnimotion();
  const main = renderContext();
  const part = maskedPart({ transform: { x: 18, y: 4, rotation: 90, scaleX: -1, scaleY: 1 } });
  fakeCanvas.created = [];

  Animotion.partVisibilityMaskRender.drawPartImage(main, part, 1, (shape, x, y) => ({ shape, x, y }));
  const layer = fakeCanvas.created.at(-1);

  assert.deepEqual(layer.__ctx.ops.find((op) => op.name === "drawImage").args.slice(1), [0, 0, 20, 20]);
  assert.deepEqual(main.ops.find((op) => op.name === "drawImage").args.slice(1), [10, 10, 20, 20]);
});

function maskedPart(patch = {}) {
  return {
    rect: { x: 10, y: 10, w: 20, h: 20 },
    pivot: { x: 10, y: 10 },
    canvas: { id: "upperArm" },
    visibilityMasks: [{ id: "mask-a", mask: { kind: "polygon", points: [{ x: 0, y: 0 }, { x: 12, y: 0 }, { x: 12, y: 20 }, { x: 0, y: 20 }] }, keyframes: [{ frame: 1, strength: 1 }] }],
    ...patch,
  };
}

function renderContext() {
  const ctx = {
    ops: [],
    _alpha: 1,
    _composite: "source-over",
    save() { this.ops.push({ name: "save" }); },
    restore() { this.ops.push({ name: "restore" }); },
    fill(path) { this.ops.push({ name: "fill", path }); },
    drawImage(...args) { this.ops.push({ name: "drawImage", args }); },
    transform(...args) { this.ops.push({ name: "transform", args }); },
  };
  Object.defineProperty(ctx, "globalAlpha", { get() { return this._alpha; }, set(value) { this._alpha = value; this.ops.push({ name: "alpha", value }); } });
  Object.defineProperty(ctx, "globalCompositeOperation", { get() { return this._composite; }, set(value) { this._composite = value; this.ops.push({ name: "composite", value }); } });
  return ctx;
}

function plain(value) {
  return JSON.parse(JSON.stringify(value));
}
