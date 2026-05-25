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
  Animotion.dom = { sourceCtx: { isPointInPath: () => false } };
  Animotion.ui = { refreshUi() {} };
  Animotion.imageBounds = () => ({ width: 140, height: 120 });
  runScript(context, "scripts/part-visibility-masks.js");
  runScript(context, "scripts/edit-target.js");
  runScript(context, "scripts/path.js");
  runScript(context, "scripts/parts.js");
  runScript(context, "scripts/part-supplemental-transform.js");
  runScript(context, "scripts/part-commands.js");
  runScript(context, "scripts/editor.js");
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

test("part edit target changes the part outline without changing visibility masks", () => {
  const Animotion = loadAnimotion();
  const part = partFromPolygon(Animotion, "body", [{ x: 20, y: 20 }, { x: 75, y: 20 }, { x: 75, y: 80 }, { x: 20, y: 80 }]);
  part.visibilityMasks = [visibilityMask("mask-a", [{ x: 18, y: 18 }, { x: 30, y: 18 }, { x: 30, y: 30 }, { x: 18, y: 30 }])];
  Animotion.editTarget.setPart(part);
  const beforeMask = JSON.stringify(part.visibilityMasks[0].mask.points);

  const started = Animotion.editor.beginShapeEdit({ x: 75, y: 20 });
  Animotion.editor.applyDragEdit({ x: 80, y: 22 });

  assert.equal(started, true);
  assert.equal(Animotion.state.drag.targetKind, "part");
  assert.equal(JSON.stringify(part.visibilityMasks[0].mask.points), beforeMask);
  assert.deepEqual(JSON.parse(JSON.stringify(part.mask.points[1])), { x: 60, y: 2 });
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

function partFromPolygon(Animotion, type, points) {
  return Animotion.partCommands.createPartFromShape(type, { kind: "polygon", closed: true, points }, type);
}

function visibilityMask(id, points) {
  return { id, mask: { kind: "polygon", points }, keyframes: [{ frame: 1, strength: 1 }] };
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

function randomId() {
  randomId.count = (randomId.count || 0) + 1;
  return `id-${randomId.count}`;
}
