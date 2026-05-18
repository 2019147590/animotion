const assert = require("node:assert/strict");

globalThis.Animotion = {};
globalThis.DOMPoint = class {
  constructor(x, y) {
    this.x = x;
    this.y = y;
  }

  matrixTransform(matrix) {
    return {
      x: matrix.a * this.x + matrix.c * this.y + matrix.e,
      y: matrix.b * this.x + matrix.d * this.y + matrix.f,
    };
  }
};

const geometry = require("../scripts/geometry.js");
const motionModel = require("../scripts/motion-model.js");
const rigConnection = require("../scripts/rig-connection.js");
const previewRigPoints = require("../scripts/preview-rig-points.js");
const previewHitTest = require("../scripts/preview-hit-test.js");

function test(name, fn) {
  try {
    fn();
    console.log(`PASS ${name}`);
  } catch (error) {
    console.error(`FAIL ${name}`);
    throw error;
  }
}

function setup(part) {
  Object.assign(globalThis.Animotion, {
    geometry,
    motionModel,
    rigConnection,
    previewRigPoints,
    config: { hitTolerancePx: 8 },
    state: {
      parts: [part],
      selectedPartId: part.id,
      previewView: { x: 0, y: 0, w: 100, h: 80 },
      previewSourceFrame: { x: 0, y: 0, w: 100, h: 80, sourceWidth: 100, sourceHeight: 80 },
      previewSourceTransform: { scale: 1 },
      pausedTime: 0,
      running: false,
    },
    dom: {
      previewCanvas: { getBoundingClientRect: () => ({ left: 0, top: 0 }) },
      els: { motionTemplate: { value: "cutscene" } },
    },
    parts: { selectedPart: () => part },
    preview: { worldMatrix: () => ({ a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }) },
    previewTransform: {
      screenPointToImage: (point) => point,
      sourceScale: () => 1,
    },
  });
}

function part() {
  return {
    id: "head",
    type: "head",
    rect: { x: 20, y: 30, w: 30, h: 20 },
    pivot: { x: 15, y: 18 },
    joint: { x: 12, y: 7 },
    customMotion: {},
  };
}

test("trajectory pointerdown yields when the pointer is on a selected joint handle", () => {
  const selected = part();
  setup(selected);
  const hit = previewHitTest.selectedEditableRigPoint({ clientX: 32, clientY: 37 });
  assert.equal(hit.role, "joint");
});

test("trajectory pointerdown does not yield away from selected rig handles", () => {
  const selected = part();
  setup(selected);
  const hit = previewHitTest.selectedEditableRigPoint({ clientX: 90, clientY: 70 });
  assert.equal(hit, null);
});

test("hit testing can select a rig handle outside the selected part rect", () => {
  const selected = { ...part(), joint: { x: -6, y: 25 } };
  setup(selected);
  const hit = previewHitTest.selectedEditableRigPoint({ clientX: 14, clientY: 55 });
  assert.equal(hit.role, "joint");
});
