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

function loadPreview() {
  const context = {
    window: { Animotion: {} },
    DOMMatrix: Matrix,
  };
  vm.createContext(context);
  for (const path of [
    "scripts/motion-model.js",
    "scripts/timeline.js",
    "scripts/rig-connection.js",
    "scripts/preview-static-transform.js",
  ]) runScript(context, path);
  const Animotion = context.window.Animotion;
  Animotion.dom = {
    previewCanvas: {},
    previewCtx: {},
    els: { motionTemplate: { value: "cutscene" } },
  };
  Animotion.state = { parts: parentPartIdFixture(), currentFrame: 12, running: false, pausedTime: 0 };
  Animotion.geometry = {};
  Animotion.path = {};
  Animotion.motion = {
    motionFor(part) {
      return Animotion.motionModel.poseToTransform(Animotion.timeline.evaluatePartAtFrame(part, 12));
    },
  };
  runScript(context, "scripts/preview.js");
  return Animotion;
}

function runScript(context, path) {
  vm.runInContext(fs.readFileSync(path, "utf8"), context, { filename: path });
}

function parentPartIdFixture() {
  return [
    {
      id: "body",
      type: "body",
      rect: { x: 40, y: 20, w: 20, h: 50 },
      pivot: { x: 10, y: 25 },
      joint: { x: 10, y: 40 },
      keyframes: [{ frame: 12, pose: { x: 20, rotate: 20 } }],
    },
    {
      id: "head",
      type: "head",
      parentPartId: "body",
      rect: { x: 38, y: 4, w: 24, h: 20 },
      pivot: { x: 12, y: 10 },
      joint: { x: 12, y: 16 },
      keyframes: [{ frame: 12, pose: {} }],
    },
  ];
}

function headPivot(part) {
  return { x: part.rect.x + part.pivot.x, y: part.rect.y + part.pivot.y };
}

function transformPoint(matrix, point) {
  return { x: matrix.a * point.x + matrix.c * point.y + matrix.e, y: matrix.b * point.x + matrix.d * point.y + matrix.f };
}

function rounded(point) {
  return { x: Math.round(point.x), y: Math.round(point.y) };
}

class Matrix {
  constructor(values = {}) {
    this.a = values.a ?? 1;
    this.b = values.b ?? 0;
    this.c = values.c ?? 0;
    this.d = values.d ?? 1;
    this.e = values.e ?? 0;
    this.f = values.f ?? 0;
  }

  translate(x, y) {
    return this.multiply(new Matrix({ e: x, f: y }));
  }

  rotate(degrees) {
    const radians = degrees * Math.PI / 180;
    const cos = Math.cos(radians);
    const sin = Math.sin(radians);
    return this.multiply(new Matrix({ a: cos, b: sin, c: -sin, d: cos }));
  }

  scale(x, y) {
    return this.multiply(new Matrix({ a: x, d: y }));
  }

  multiply(right) {
    return new Matrix({
      a: this.a * right.a + this.c * right.b,
      b: this.b * right.a + this.d * right.b,
      c: this.a * right.c + this.c * right.d,
      d: this.b * right.c + this.d * right.d,
      e: this.a * right.e + this.c * right.f + this.e,
      f: this.b * right.e + this.d * right.f + this.f,
    });
  }
}

test("head with parentPartId inherits body world transform during cutscene playback", () => {
  const Animotion = loadPreview();
  const [body, head] = Animotion.state.parts;
  const cache = new Map();
  const bodyMatrix = Animotion.preview.worldMatrix(body, 0, cache);
  const headMatrix = Animotion.preview.worldMatrix(head, 0, cache);
  const expected = transformPoint(bodyMatrix, headPivot(head));
  const actual = transformPoint(headMatrix, headPivot(head));
  assert.deepEqual(rounded(actual), rounded(expected));
});

test("part static transform affects local preview matrix around pivot", () => {
  const Animotion = loadPreview();
  const part = Animotion.state.parts[0];
  part.keyframes = [];
  part.transform = { x: 7, y: -3, rotation: 90, scaleX: -1, scaleY: 1 };
  const pivot = { x: part.rect.x + part.pivot.x, y: part.rect.y + part.pivot.y };

  const actual = transformPoint(Animotion.preview.localMatrix(part, 0), pivot);

  assert.deepEqual(rounded(actual), { x: pivot.x + 7, y: pivot.y - 3 });
});
