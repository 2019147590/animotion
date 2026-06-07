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

class FakePath2D {
  moveTo() {}
  lineTo() {}
  closePath() {}
  ellipse() {}
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
    "scripts/arm-role-semantics.js", "scripts/rig-connection.js", "scripts/part-transform-geometry.js",
    "scripts/project-model.js", "scripts/project-serialization.js", "scripts/rigging.js", "scripts/command-history.js",
  ]) runScript(context, path);
  const Animotion = context.window.Animotion;
  Animotion.state = {
    image: { naturalWidth: 140, naturalHeight: 120 },
    parts: [],
    selectedPartId: null,
    editTarget: { kind: "part", partId: null, maskId: null },
    sourceView: { scale: 1 },
    project: Animotion.projectModel.createEmptyProject(),
  };
  Animotion.dom = {
    sourceCanvas: fakeEventCanvas(),
    sourceCtx: { isPointInPath: () => true },
    els: { selectionTool: { value: Animotion.tool.edit } },
  };
  Animotion.ui = { refreshUi() {} };
  Animotion.view = { canvasPoint: (event) => ({ x: event.imageX, y: event.imageY }) };
  Animotion.imageBounds = () => ({ width: 140, height: 120 });
  for (const path of [
    "scripts/edit-target.js", "scripts/path.js", "scripts/parts.js", "scripts/part-supplemental-transform.js",
    "scripts/part-commands.js", "scripts/part-command-history.js", "scripts/editor.js", "scripts/source-canvas-events.js",
  ]) runScript(context, path);
  return Animotion;
}

function runScript(context, path) {
  vm.runInContext(fs.readFileSync(path, "utf8"), context, { filename: path });
}

test("dragging a selected part body moves transform without resampling its image", () => {
  const Animotion = loadAnimotion();
  const part = Animotion.partCommands.createPartFromShape("body", polygon(), "body");
  const canvas = part.canvas;
  const rect = plain(part.rect);
  const mask = plain(part.mask.points);
  Animotion.editTarget.setPart(part);

  const started = Animotion.editor.beginShapeEdit({ x: 40, y: 40 });
  Animotion.editor.applyDragEdit({ x: 49, y: 46 });

  assert.equal(started, true);
  assert.equal(Animotion.state.drag.mode, "move");
  assert.equal(part.canvas, canvas);
  assert.deepEqual(plain(part.rect), rect);
  assert.deepEqual(plain(part.mask.points), mask);
  assert.deepEqual(plain(part.transform), { x: 9, y: 6, rotation: 0, scaleX: 1, scaleY: 1 });
  assert.equal(Animotion.commandHistory.undo(), true);
  assert.deepEqual(plain(Animotion.state.parts[0].transform), { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 });
});

function polygon() {
  return { kind: "polygon", closed: true, points: [{ x: 20, y: 20 }, { x: 75, y: 20 }, { x: 75, y: 80 }, { x: 20, y: 80 }] };
}

function fakeCanvas() {
  return { width: 0, height: 0, getContext: () => ({ drawImage() {}, fill() {}, set globalCompositeOperation(value) { this._composite = value; }, set fillStyle(value) { this._fillStyle = value; } }) };
}

function fakeEventCanvas() {
  return {
    listeners: {},
    captured: null,
    addEventListener(type, handler) { this.listeners[type] = handler; },
    setPointerCapture(pointerId) { this.captured = pointerId; },
    hasPointerCapture(pointerId) { return this.captured === pointerId; },
    releasePointerCapture(pointerId) { if (this.captured === pointerId) this.captured = null; },
  };
}

function randomId() {
  randomId.count = (randomId.count || 0) + 1;
  return `id-${randomId.count}`;
}

function plain(value) {
  return JSON.parse(JSON.stringify(value));
}
