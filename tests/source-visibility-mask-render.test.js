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

function loadSourceRender() {
  const sourceCtx = canvasContext();
  const previewCtx = canvasContext();
  const createdCanvases = [];
  const context = {
    window: { Animotion: {}, devicePixelRatio: 1 },
    document: { createElement: () => fakeCanvas(createdCanvases) },
    crypto: { randomUUID: () => "test-id" },
  };
  vm.createContext(context);
  const Animotion = context.window.Animotion;
  const part = maskedTransformedPart();
  Animotion.dom = {
    sourceCanvas: { width: 120, height: 90 },
    previewCanvas: { width: 120, height: 90 },
    sourceCtx,
    previewCtx,
    els: { selectionTool: { value: "select" } },
  };
  Animotion.tool = { edit: "edit" };
  Animotion.state = {
    image: { id: "original-image", naturalWidth: 120, naturalHeight: 90 },
    parts: [part],
    selectedPartId: part.id,
    currentFrame: 1,
  };
  Animotion.view = { resizeCanvas() {}, sourceImageView: () => ({ x: 0, y: 0, w: 120, h: 90, scale: 1 }) };
  Animotion.geometry = { absoluteShapeFromPart: partShape, pointsBounds };
  Animotion.path = { pathFromShape: (shape, x = 0, y = 0) => ({ shape, x, y }) };
  Animotion.panelEditor = { canEditRig: () => true, imageFor: () => null, cropShape: () => null, characterMask: () => null };
  Animotion.imageBounds = () => ({ width: 120, height: 90 });
  runScript(context, "scripts/part-transform-geometry.js");
  runScript(context, "scripts/part-visibility-masks.js");
  runScript(context, "scripts/part-visibility-mask-render.js");
  runScript(context, "scripts/render.js");
  return { Animotion, part, sourceCtx, createdCanvases };
}

function runScript(context, path) {
  vm.runInContext(fs.readFileSync(path, "utf8"), context, { filename: path });
}

test("source/original-cut masked transformed part does not erase original image pixels", () => {
  const { Animotion, part, sourceCtx, createdCanvases } = loadSourceRender();

  Animotion.render.drawSource();
  const layer = createdCanvases.find((canvas) => canvas.__ctx.__ops.some((op) => op.name === "composite" && op.args[0] === "destination-out"));
  const originalIndex = sourceCtx.__ops.findIndex((op) => op.name === "drawImage" && op.args[0] === Animotion.state.image);
  const layerIndex = sourceCtx.__ops.findIndex((op) => op.name === "drawImage" && op.args[0] === layer);
  const transform = sourceCtx.__ops.find((op) => op.name === "transform");
  const expected = Animotion.partTransformGeometry.worldMatrix(part, Animotion.state.parts);

  assert.ok(layer);
  assert.equal(sourceCtx.__ops.some((op) => op.name === "composite" && op.args[0] === "destination-out"), false);
  assert.equal(originalIndex > -1, true);
  assert.equal(layerIndex > originalIndex, true);
  assert.deepEqual(layer.__ctx.__ops.find((op) => op.name === "drawImage").args.slice(1), [0, 0, part.rect.w, part.rect.h]);
  assert.deepEqual(JSON.parse(JSON.stringify(layer.__ctx.__ops.find((op) => op.name === "fill").args[0])), {
    shape: { ...part.visibilityMasks[0].mask, closed: true },
    x: 0,
    y: 0,
  });
  assertMatrixArgs(transform.args, [expected.a, expected.b, expected.c, expected.d, expected.e, expected.f]);
});

function maskedTransformedPart() {
  return {
    id: "masked_part",
    name: "masked part",
    type: "arm",
    humanRole: "upperArm",
    order: 1,
    rect: { x: 10, y: 12, w: 24, h: 18 },
    pivot: { x: 12, y: 9 },
    joint: { x: 20, y: 14 },
    alpha: 1,
    canvas: { id: "masked-canvas" },
    transform: { x: 14, y: -3, rotation: 20, scaleX: -1, scaleY: 1 },
    visibilityMasks: [{
      id: "mask-a",
      mask: { kind: "polygon", points: [{ x: 0, y: 0 }, { x: 16, y: 0 }, { x: 16, y: 18 }, { x: 0, y: 18 }] },
      keyframes: [{ frame: 1, strength: 1 }],
    }],
  };
}

function partShape(part) {
  return {
    kind: "rect",
    closed: true,
    points: [
      { x: part.rect.x, y: part.rect.y },
      { x: part.rect.x + part.rect.w, y: part.rect.y },
      { x: part.rect.x + part.rect.w, y: part.rect.y + part.rect.h },
      { x: part.rect.x, y: part.rect.y + part.rect.h },
    ],
  };
}

function pointsBounds(points) {
  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y };
}

function canvasContext() {
  const ops = [];
  const ctx = {
    __ops: ops,
    save: () => ops.push({ name: "save", args: [] }),
    restore: () => ops.push({ name: "restore", args: [] }),
    scale: (...args) => ops.push({ name: "scale", args }),
    clearRect: (...args) => ops.push({ name: "clearRect", args }),
    fillRect: (...args) => ops.push({ name: "fillRect", args }),
    drawImage: (...args) => ops.push({ name: "drawImage", args }),
    translate: (...args) => ops.push({ name: "translate", args }),
    transform: (...args) => ops.push({ name: "transform", args }),
    fill: (...args) => ops.push({ name: "fill", args }),
    stroke: (...args) => ops.push({ name: "stroke", args }),
    beginPath: (...args) => ops.push({ name: "beginPath", args }),
    moveTo: (...args) => ops.push({ name: "moveTo", args }),
    lineTo: (...args) => ops.push({ name: "lineTo", args }),
    arc: (...args) => ops.push({ name: "arc", args }),
    setLineDash: (...args) => ops.push({ name: "setLineDash", args }),
    fillText: (...args) => ops.push({ name: "fillText", args }),
    measureText: (text) => ({ width: String(text).length * 7 }),
  };
  Object.defineProperty(ctx, "globalAlpha", { get() { return this._alpha ?? 1; }, set(value) { this._alpha = value; ops.push({ name: "alpha", args: [value] }); } });
  Object.defineProperty(ctx, "globalCompositeOperation", { get() { return this._composite ?? "source-over"; }, set(value) { this._composite = value; ops.push({ name: "composite", args: [value] }); } });
  return ctx;
}

function fakeCanvas(createdCanvases) {
  const canvas = { width: 0, height: 0, __ctx: canvasContext(), getContext() { return this.__ctx; } };
  createdCanvases.push(canvas);
  return canvas;
}

function assertMatrixArgs(actual, expected) {
  assert.equal(actual.length, expected.length);
  for (let index = 0; index < actual.length; index += 1) assert.ok(Math.abs(actual[index] - expected[index]) < 1e-9);
}
