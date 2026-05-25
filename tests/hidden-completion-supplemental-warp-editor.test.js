const assert = require("node:assert/strict");

globalThis.DOMPoint = class DOMPoint {
  constructor(x, y) {
    this.x = x;
    this.y = y;
  }
  matrixTransform() {
    return { x: this.x, y: this.y };
  }
};

globalThis.Animotion = {};
require("../scripts/hidden-completion-supplemental-warp.js");
const editor = require("../scripts/hidden-completion-supplemental-warp-editor.js");

function test(name, fn) {
  try {
    fn();
    console.log(`PASS ${name}`);
  } catch (error) {
    console.error(`FAIL ${name}`);
    throw error;
  }
}

function reset() {
  let capturedPointer = null;
  let refreshCount = 0;
  let command = null;
  const part = {
    id: "supplemental",
    isSupplementalPart: true,
    rect: { x: 10, y: 20, w: 40, h: 50 },
    canvas: { width: 40, height: 50 },
  };
  const Animotion = globalThis.Animotion;
  Object.assign(Animotion, {
    state: {
      parts: [part],
      selectedPartId: part.id,
      running: false,
      exporting: false,
      pausedTime: 0,
      previewView: {},
      previewSourceFrame: null,
      previewSourceTransform: null,
    },
    parts: { selectedPart: () => part },
    preview: { worldMatrix: () => ({}) },
    previewTransform: { imagePointToScreen: (point) => ({ x: point.x, y: point.y }) },
    previewCoordinate: {
      clientToPreviewPoint: (event) => ({ x: event.clientX, y: event.clientY }),
      previewToPartLocalPoint: (point, context) => ({
        x: point.x - context.part.rect.x,
        y: point.y - context.part.rect.y,
      }),
    },
    dom: {
      previewCanvas: {
        getBoundingClientRect: () => ({ left: 0, top: 0 }),
        setPointerCapture: (pointerId) => { capturedPointer = pointerId; },
        hasPointerCapture: (pointerId) => capturedPointer === pointerId,
        releasePointerCapture: (pointerId) => {
          if (capturedPointer === pointerId) capturedPointer = null;
        },
      },
      els: { playPause: { textContent: "" } },
    },
    config: { hitTolerancePx: 10 },
    commandHistory: { record: (entry) => { command = entry; } },
    previewPointerArbitration: {
      setActiveDragOwner: (editorKey, event, options) => {
        Animotion.state.activePreviewDrag = { editorKey, pointerId: event.pointerId, kind: options.kind };
      },
      clearActiveDragOwner: () => { Animotion.state.activePreviewDrag = null; },
    },
    ui: { refreshUi: () => { refreshCount += 1; } },
  });
  return { Animotion, part, command: () => command, refreshCount: () => refreshCount };
}

function eventAt(x, y) {
  return {
    clientX: x,
    clientY: y,
    pointerId: 7,
    prevented: 0,
    preventDefault() { this.prevented += 1; },
  };
}

test("dragging a supplemental warp handle records undoable point edits", () => {
  const { Animotion, part, command, refreshCount } = reset();
  const hit = editor.hitTarget(eventAt(10, 20));

  assert.equal(hit.pointId, "tl");
  assert.equal(editor.beginDragFromTarget(eventAt(10, 20), { hit }), true);
  assert.equal(Animotion.state.activePreviewDrag.editorKey, "hiddenCompletionSupplementalWarpEditor");

  const move = eventAt(16, 27);
  assert.equal(editor.updateDrag(move), true);
  assert.deepEqual(part.supplementalWarp.points[0], { id: "tl", x: 6, y: 7 });
  assert.equal(move.prevented, 1);

  assert.equal(editor.endDrag(eventAt(16, 27)), true);
  assert.equal(Animotion.state.activePreviewDrag, null);
  assert.equal(refreshCount() >= 1, true);
  assert.equal(command().label, "edit-supplemental-warp");

  command().undo();
  assert.equal(part.supplementalWarp, undefined);
  command().redo();
  assert.deepEqual(part.supplementalWarp.points[0], { id: "tl", x: 6, y: 7 });
});

test("dragging a supplemental material seam handle records a region redistribution edit", () => {
  const { Animotion, part, command } = reset();
  const hit = editor.hitTarget(eventAt(10, 45));

  assert.equal(hit.pointId, "seamA");
  assert.equal(editor.beginDragFromTarget(eventAt(10, 45), { hit }), true);

  const move = eventAt(10, 37);
  assert.equal(editor.updateDrag(move), true);
  assert.deepEqual(part.supplementalWarp.materialSeam.sourcePoints[0], { id: "seamA", x: 0, y: 25 });
  assert.deepEqual(part.supplementalWarp.materialSeam.points[0], { id: "seamA", x: 0, y: 17 });

  assert.equal(editor.endDrag(eventAt(10, 37)), true);
  assert.equal(command().label, "edit-supplemental-warp");
  command().undo();
  assert.equal(part.supplementalWarp, undefined);
  command().redo();
  assert.deepEqual(part.supplementalWarp.materialSeam.points[0], { id: "seamA", x: 0, y: 17 });
});
