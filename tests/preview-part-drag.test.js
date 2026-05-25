const assert = require("node:assert/strict");

globalThis.Animotion = {};
const previewPartDrag = require("../scripts/preview-part-drag.js");

function test(name, fn) {
  try {
    fn();
    console.log(`PASS ${name}`);
  } catch (error) {
    console.error(`FAIL ${name}`);
    throw error;
  }
}

function setup() {
  const parent = { id: "torso", rect: { x: 0, y: 0, w: 40, h: 40 }, transform: {} };
  const child = {
    id: "arm",
    name: "arm copy",
    parentId: parent.id,
    rect: { x: 10, y: 10, w: 20, h: 10 },
    transform: { x: 4, y: -2, rotation: 90, scaleX: -1, scaleY: 1 },
  };
  const canvas = capturedCanvas();
  const updates = [];
  Object.assign(globalThis.Animotion, {
    state: {
      parts: [parent, child],
      selectedPartId: child.id,
      previewView: { x: 0, y: 0, w: 100, h: 80 },
      previewSourceFrame: { x: 0, y: 0, w: 100, h: 80, sourceWidth: 100, sourceHeight: 80 },
      previewSourceTransform: { scale: 1 },
      pausedTime: 0,
      running: false,
    },
    dom: { previewCanvas: canvas, els: { playPause: { textContent: "" } } },
    parts: { selectedPart: () => child },
    rigConnection: { parentIdFor: (part) => part.parentId || null },
    previewCoordinate: {
      clientToPreviewPoint: (event) => ({ x: event.clientX, y: event.clientY }),
      previewToImagePoint: (point) => point,
    },
    preview: {
      worldMatrix: (part) => part.id === parent.id
        ? { a: 2, b: 0, c: 0, d: 2, e: 0, f: 0 }
        : { a: 0, b: 1, c: -1, d: 0, e: 40, f: 0 },
    },
    previewPointerArbitration: { setActiveDragOwner() {} },
    partCommands: {
      updatePart(part, patch) {
        updates.push(patch);
        Object.assign(part, patch);
        return part;
      },
    },
    ui: { refreshUi() {} },
  });
  return { child, canvas, updates };
}

function capturedCanvas() {
  return {
    captured: null,
    setPointerCapture(pointerId) { this.captured = pointerId; },
    hasPointerCapture(pointerId) { return this.captured === pointerId; },
    releasePointerCapture(pointerId) { if (this.captured === pointerId) this.captured = null; },
  };
}

function eventAt(x, y) {
  return {
    clientX: x,
    clientY: y,
    pointerId: 1,
    prevented: 0,
    preventDefault() { this.prevented += 1; },
  };
}

test("part body hit test uses the transformed selected part body", () => {
  setup();
  const target = previewPartDrag.partBodyTarget(eventAt(25, 15));
  assert.equal(target.partId, "arm");
});

test("part body hit test ignores empty preview space", () => {
  setup();
  assert.equal(previewPartDrag.partBodyTarget(eventAt(4, 4)), null);
});

test("dragging a parented transformed part commits static translation in parent space", () => {
  const { child, canvas, updates } = setup();
  const start = eventAt(25, 15);
  const target = previewPartDrag.partBodyTarget(start);

  assert.equal(previewPartDrag.beginDragFromTarget(start, { kind: "part-body", ...target }), true);
  assert.equal(canvas.captured, 1);
  const move = eventAt(35, 21);
  assert.equal(previewPartDrag.updateDrag(move), true);
  assert.deepEqual(child.transform, { x: 9, y: 1, rotation: 90, scaleX: -1, scaleY: 1 });
  assert.equal(move.prevented, 1);

  assert.equal(previewPartDrag.endDrag(start), true);
  assert.equal(canvas.captured, null);
  assert.deepEqual(updates[0], { transform: { x: 9, y: 1, rotation: 90, scaleX: -1, scaleY: 1 } });
  assert.deepEqual(child.transform, updates[0].transform);
});
