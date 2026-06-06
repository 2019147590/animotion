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
  const context = { window: { Animotion: {} }, Path2D: FakePath2D };
  vm.createContext(context);
  for (const path of ["scripts/config.js", "scripts/geometry.js"]) runScript(context, path);
  const Animotion = context.window.Animotion;
  Animotion.state = {
    image: {},
    selection: openPolygon(),
    drag: null,
    sourcePan: { x: 0, y: 0 },
    sourceView: { scale: 1 },
    spaceDown: false,
  };
  Animotion.dom = {
    sourceCanvas: fakeCanvas(),
    sourceCtx: { isPointInPath: () => false },
    els: { selectionTool: { value: Animotion.tool.polygon } },
  };
  Animotion.view = { canvasPoint: (event) => ({ x: event.imageX, y: event.imageY }) };
  Animotion.ui = { refreshUi() {} };
  Animotion.imageBounds = () => ({ width: 120, height: 100 });
  runScript(context, "scripts/path.js");
  runScript(context, "scripts/editor.js");
  runScript(context, "scripts/source-canvas-events.js");
  Animotion.sourceCanvasEvents.bindSourceCanvasEvents();
  return Animotion;
}

function runScript(context, path) {
  vm.runInContext(fs.readFileSync(path, "utf8"), context, { filename: path });
}

test("polygon tool click-drag moves an existing open polygon point", () => {
  const Animotion = loadAnimotion();

  Animotion.dom.sourceCanvas.listeners.pointerdown(pointerEvent({ imageX: 70, imageY: 20 }));
  Animotion.dom.sourceCanvas.listeners.pointermove(pointerEvent({ imageX: 80, imageY: 28 }));
  Animotion.dom.sourceCanvas.listeners.pointerup(pointerEvent({ imageX: 80, imageY: 28 }));

  assert.deepEqual(plain(Animotion.state.selection.points), [
    { x: 20, y: 20 },
    { x: 80, y: 28 },
    { x: 70, y: 70 },
  ]);
  assert.equal(Animotion.state.drag, null);
});

test("polygon tool still appends a point when no existing point is hit", () => {
  const Animotion = loadAnimotion();

  Animotion.dom.sourceCanvas.listeners.pointerdown(pointerEvent({ imageX: 90, imageY: 64 }));

  assert.equal(Animotion.state.selection.points.length, 4);
  assert.deepEqual(plain(Animotion.state.selection.points[3]), { x: 90, y: 64 });
});

test("polygon tool still closes when clicking back on the first point", () => {
  const Animotion = loadAnimotion();

  Animotion.dom.sourceCanvas.listeners.pointerdown(pointerEvent({ imageX: 20, imageY: 20 }));

  assert.equal(Animotion.state.selection.closed, true);
  assert.equal(Animotion.dom.els.selectionTool.value, Animotion.tool.edit);
});

function openPolygon() {
  return {
    kind: "polygon",
    closed: false,
    points: [{ x: 20, y: 20 }, { x: 70, y: 20 }, { x: 70, y: 70 }],
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

function fakeCanvas() {
  return {
    listeners: {},
    captured: null,
    addEventListener(type, handler) { this.listeners[type] = handler; },
    setPointerCapture(pointerId) { this.captured = pointerId; },
    hasPointerCapture(pointerId) { return this.captured === pointerId; },
    releasePointerCapture(pointerId) { if (this.captured === pointerId) this.captured = null; },
    getBoundingClientRect() { return { left: 0, top: 0 }; },
  };
}

function plain(value) {
  return JSON.parse(JSON.stringify(value));
}
