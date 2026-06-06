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
    selection: null,
    sourceView: { scale: 1 },
    project: Animotion.projectModel.createEmptyProject(),
  };
  Animotion.dom = {
    sourceCanvas: fakeEventCanvas(),
    sourceCtx: { isPointInPath: () => false },
    els: { selectionTool: { value: Animotion.tool.edit } },
  };
  Animotion.ui = { refreshUi() {} };
  Animotion.view = { canvasPoint: (event) => ({ x: event.imageX, y: event.imageY }) };
  Animotion.imageBounds = () => ({ width: 140, height: 120 });
  runScript(context, "scripts/part-visibility-masks.js");
  runScript(context, "scripts/edit-target.js");
  runScript(context, "scripts/path.js");
  runScript(context, "scripts/parts.js");
  runScript(context, "scripts/part-supplemental-transform.js");
  runScript(context, "scripts/part-commands.js");
  runScript(context, "scripts/part-command-history.js");
  runScript(context, "scripts/editor.js");
  runScript(context, "scripts/source-canvas-events.js");
  return Animotion;
}

function runScript(context, path) {
  vm.runInContext(fs.readFileSync(path, "utf8"), context, { filename: path });
}

test("source editor hit-tests and drags the visible flipped moved body polygon", () => {
  const Animotion = loadAnimotion();
  const body = partFromPolygon(Animotion, "body", [{ x: 20, y: 20 }, { x: 70, y: 20 }, { x: 70, y: 85 }, { x: 20, y: 85 }]);
  Animotion.partCommands.updatePart(body.id, { pivot: { x: 25, y: 32 }, transform: { x: 18, y: 7, rotation: 0, scaleX: -1, scaleY: 1 } });
  const visible = Animotion.partTransformGeometry.shapeFromPart(body, Animotion.state.parts).points[1];

  const started = Animotion.editor.beginShapeEdit(visible);

  assert.equal(started, true);
  assert.equal(Animotion.state.drag.partId, body.id);
  assert.equal(Animotion.state.drag.index, 1);
});

test("source editor drags the visible flipped rotated upperArm vertex", () => {
  const Animotion = loadAnimotion();
  const upperArm = partFromPolygon(Animotion, "arm", [{ x: 52, y: 24 }, { x: 66, y: 25 }, { x: 64, y: 58 }, { x: 50, y: 57 }]);
  Animotion.partCommands.updatePart(upperArm.id, { pivot: { x: 7, y: 16 }, transform: { x: 26, y: 9, rotation: 32, scaleX: -1, scaleY: 1 } });
  const visible = Animotion.partTransformGeometry.shapeFromPart(upperArm, Animotion.state.parts).points[2];
  const moved = { x: visible.x + 4, y: visible.y - 3 };

  const started = Animotion.editor.beginShapeEdit(visible);
  Animotion.editor.applyDragEdit(moved);
  const after = Animotion.partTransformGeometry.shapeFromPart(upperArm, Animotion.state.parts).points[2];

  assert.equal(started, true);
  assert.equal(Animotion.state.drag.partId, upperArm.id);
  assertPointClose(after, moved);
});

test("source canvas click-drag moves a selected part polygon vertex", () => {
  const Animotion = loadAnimotion();
  const part = partFromPolygon(Animotion, "body", [{ x: 20, y: 20 }, { x: 75, y: 20 }, { x: 75, y: 80 }, { x: 20, y: 80 }]);
  Animotion.editTarget.setPart(part);
  Animotion.sourceCanvasEvents.bindSourceCanvasEvents();

  Animotion.dom.sourceCanvas.listeners.pointerdown(pointerEvent({ imageX: 75, imageY: 20 }));
  Animotion.dom.sourceCanvas.listeners.pointermove(pointerEvent({ imageX: 82, imageY: 26 }));
  Animotion.dom.sourceCanvas.listeners.pointerup(pointerEvent({ imageX: 82, imageY: 26 }));

  assert.deepEqual(JSON.parse(JSON.stringify(part.mask.points[1])), { x: 62, y: 6 });
  assert.equal(Animotion.state.drag, null);
});

test("source canvas click-drag ignores unselected visibility mask handles while editing a part", () => {
  const Animotion = loadAnimotion();
  const part = partFromPolygon(Animotion, "body", [{ x: 20, y: 20 }, { x: 75, y: 20 }, { x: 75, y: 80 }, { x: 20, y: 80 }]);
  part.visibilityMasks = [visibilityMask("mask-a", [{ x: 18, y: 18 }, { x: 30, y: 18 }, { x: 30, y: 30 }, { x: 18, y: 30 }])];
  Animotion.editTarget.setPart(part);
  Animotion.sourceCanvasEvents.bindSourceCanvasEvents();
  const before = JSON.stringify(part.visibilityMasks[0].mask.points);

  Animotion.dom.sourceCanvas.listeners.pointerdown(pointerEvent({ imageX: 38, imageY: 38 }));
  Animotion.dom.sourceCanvas.listeners.pointermove(pointerEvent({ imageX: 44, imageY: 44 }));
  Animotion.dom.sourceCanvas.listeners.pointerup(pointerEvent({ imageX: 44, imageY: 44 }));

  assert.equal(JSON.stringify(part.visibilityMasks[0].mask.points), before);
  assert.equal(Animotion.state.drag, null);
});

test("source editor defaults missing editTarget to selected part editing", () => {
  const Animotion = loadAnimotion();
  const part = partFromPolygon(Animotion, "body", [{ x: 20, y: 20 }, { x: 70, y: 20 }, { x: 70, y: 85 }, { x: 20, y: 85 }]);
  delete Animotion.state.editTarget;

  const started = Animotion.editor.beginShapeEdit({ x: 70, y: 20 });

  assert.equal(started, true);
  assert.deepEqual(plain(Animotion.state.editTarget), { kind: "part", partId: part.id, maskId: null });
});

test("part edit target ignores visibility mask polygon handles", () => {
  const Animotion = loadAnimotion();
  const part = partFromPolygon(Animotion, "body", [{ x: 20, y: 20 }, { x: 75, y: 20 }, { x: 75, y: 80 }, { x: 20, y: 80 }]);
  part.visibilityMasks = [visibilityMask("mask-a", [{ x: 18, y: 18 }, { x: 30, y: 18 }, { x: 30, y: 30 }, { x: 18, y: 30 }])];
  Animotion.editTarget.setPart(part);
  const maskPoint = Animotion.partTransformGeometry.partLocalPointsToImage(part, [part.visibilityMasks[0].mask.points[0]], Animotion.state.parts)[0];

  const started = Animotion.editor.beginShapeEdit(maskPoint);

  assert.equal(started, false);
  assert.deepEqual(JSON.parse(JSON.stringify(part.visibilityMasks[0].mask.points[0])), { x: 18, y: 18 });
});

test("part outline edit preserves visibility mask image-space placement", () => {
  const Animotion = loadAnimotion();
  const part = partFromPolygon(Animotion, "body", [{ x: 20, y: 20 }, { x: 75, y: 20 }, { x: 75, y: 80 }, { x: 20, y: 80 }]);
  part.visibilityMasks = [visibilityMask("mask-a", [{ x: 18, y: 18 }, { x: 30, y: 18 }, { x: 30, y: 30 }, { x: 18, y: 30 }])];
  Animotion.editTarget.setPart(part);
  const beforeMaskImagePoints = maskImagePoints(part);
  const beforeKeyframes = JSON.stringify(part.visibilityMasks[0].keyframes);

  const started = Animotion.editor.beginShapeEdit({ x: 20, y: 20 });
  Animotion.editor.applyDragEdit({ x: 10, y: 15 });

  assert.equal(started, true);
  assert.equal(Animotion.state.drag.targetKind, "part");
  assert.deepEqual(JSON.parse(JSON.stringify(maskImagePoints(part))), beforeMaskImagePoints);
  assert.deepEqual(JSON.parse(JSON.stringify(part.visibilityMasks[0].mask.points[0])), { x: 28, y: 23 });
  assert.equal(JSON.stringify(part.visibilityMasks[0].keyframes), beforeKeyframes);
  assert.deepEqual(JSON.parse(JSON.stringify(part.mask.points[1])), { x: 65, y: 5 });
});

test("visibility mask edit target changes only the selected mask in transformed source coordinates", () => {
  const Animotion = loadAnimotion();
  const part = partFromPolygon(Animotion, "arm", [{ x: 52, y: 24 }, { x: 66, y: 25 }, { x: 64, y: 58 }, { x: 50, y: 57 }]);
  Animotion.partCommands.updatePart(part.id, { pivot: { x: 7, y: 16 }, transform: { x: 26, y: 9, rotation: 32, scaleX: -1, scaleY: 1 } });
  part.visibilityMasks = [
    visibilityMask("mask-a", [{ x: 1, y: 1 }, { x: 14, y: 1 }, { x: 14, y: 28 }, { x: 1, y: 28 }]),
    visibilityMask("mask-b", [{ x: 3, y: 16 }, { x: 10, y: 16 }, { x: 10, y: 24 }, { x: 3, y: 24 }]),
  ];
  Animotion.editTarget.setVisibilityMask(part, "mask-a");
  const beforePartMask = JSON.stringify(part.mask.points);
  const beforeOtherMask = JSON.stringify(part.visibilityMasks[1].mask.points);
  const visible = Animotion.partTransformGeometry.partLocalPointsToImage(part, [part.visibilityMasks[0].mask.points[1]], Animotion.state.parts)[0];
  const moved = { x: visible.x + 5, y: visible.y - 4 };

  const started = Animotion.editor.beginShapeEdit(visible);
  Animotion.editor.applyDragEdit(moved);
  const after = part.visibilityMasks[0].mask.points[1];
  const afterVisible = Animotion.partTransformGeometry.partLocalPointsToImage(part, [after], Animotion.state.parts)[0];

  assert.equal(started, true);
  assert.equal(Animotion.state.drag.targetKind, "visibilityMask");
  assertPointClose(afterVisible, moved);
  assert.equal(JSON.stringify(part.mask.points), beforePartMask);
  assert.equal(JSON.stringify(part.visibilityMasks[1].mask.points), beforeOtherMask);
});

test("double-click deletion removes a selected part polygon vertex through source editor coordinates", () => {
  const Animotion = loadAnimotion();
  const part = partFromPolygon(Animotion, "body", [{ x: 20, y: 20 }, { x: 75, y: 20 }, { x: 80, y: 55 }, { x: 75, y: 80 }, { x: 20, y: 80 }]);
  Animotion.editTarget.setPart(part);

  const deleted = Animotion.editor.deleteEditablePointAt({ x: 80, y: 55 });

  assert.equal(deleted, true);
  assert.equal(part.mask.points.length, 4);
  assert.equal(part.mask.points.some((point) => point.x === 60 && point.y === 35), false);
  assert.equal(Animotion.commandHistory.undo(), true);
  assert.equal(Animotion.state.parts[0].mask.points.length, 5);
});

test("source editor does not delete the last three part polygon vertices", () => {
  const Animotion = loadAnimotion();
  const part = partFromPolygon(Animotion, "body", [{ x: 20, y: 20 }, { x: 75, y: 20 }, { x: 20, y: 80 }]);
  Animotion.editTarget.setPart(part);

  const deleted = Animotion.editor.deleteEditablePointAt({ x: 75, y: 20 });

  assert.equal(deleted, false);
  assert.equal(part.mask.points.length, 3);
});

test("source editor double-click deletion ignores active visibility mask targets", () => {
  const Animotion = loadAnimotion();
  const part = partFromPolygon(Animotion, "body", [{ x: 20, y: 20 }, { x: 75, y: 20 }, { x: 80, y: 55 }, { x: 75, y: 80 }, { x: 20, y: 80 }]);
  part.visibilityMasks = [visibilityMask("mask-a", [{ x: 18, y: 18 }, { x: 30, y: 18 }, { x: 30, y: 30 }, { x: 18, y: 30 }])];
  Animotion.editTarget.setVisibilityMask(part, "mask-a");
  const beforePartMask = JSON.stringify(part.mask.points);
  const beforeVisibilityMask = JSON.stringify(part.visibilityMasks[0].mask.points);

  const deleted = Animotion.editor.deleteEditablePointAt({ x: 80, y: 55 });

  assert.equal(deleted, false);
  assert.equal(JSON.stringify(part.mask.points), beforePartMask);
  assert.equal(JSON.stringify(part.visibilityMasks[0].mask.points), beforeVisibilityMask);
});

function partFromPolygon(Animotion, type, points) {
  return Animotion.partCommands.createPartFromShape(type, { kind: "polygon", closed: true, points }, type);
}

function visibilityMask(id, points) {
  return { id, mask: { kind: "polygon", points }, keyframes: [{ frame: 1, strength: 1 }] };
}

function maskImagePoints(part) {
  return part.visibilityMasks[0].mask.points.map((point) => ({
    x: part.rect.x + point.x,
    y: part.rect.y + point.y,
  }));
}

function assertPointClose(actual, expected) {
  assert.ok(Math.abs(actual.x - expected.x) < 1e-9, `${actual.x} !== ${expected.x}`);
  assert.ok(Math.abs(actual.y - expected.y) < 1e-9, `${actual.y} !== ${expected.y}`);
}

function plain(value) {
  return JSON.parse(JSON.stringify(value));
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

function pointerEvent(overrides = {}) {
  return {
    button: 0,
    clientX: 0,
    clientY: 0,
    imageX: 0,
    imageY: 0,
    pointerId: 1,
    preventDefault() {},
    ...overrides,
  };
}

function randomId() {
  randomId.count = (randomId.count || 0) + 1;
  return `id-${randomId.count}`;
}
