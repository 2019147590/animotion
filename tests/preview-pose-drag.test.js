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
  const context = { window: { Animotion: {} }, performance: { now: () => 0 } };
  vm.createContext(context);
  for (const path of [
    "scripts/geometry.js",
    "scripts/motion-model.js",
    "scripts/timeline.js",
    "scripts/pose-assist.js",
    "scripts/preview-coordinate.js",
    "scripts/command-history.js",
    "scripts/pose-drag-history.js",
  ]) runScript(context, path);
  const Animotion = context.window.Animotion;
  const canvas = canvasStub();
  Animotion.dom = {
    previewCanvas: canvas,
    els: {
      motionTemplate: { value: "cutscene" },
      pivotEditTarget: { value: "joint" },
      playPause: { textContent: "" },
    },
  };
  Animotion.state = {
    currentFrame: 3,
    parts: sampleParts(),
    selectedPartId: "arm",
    previewView: { x: 0, y: 0, w: 100, h: 80 },
    previewSourceFrame: { x: 0, y: 0, w: 100, h: 80, sourceWidth: 100, sourceHeight: 80 },
    previewSourceTransform: { x: 0, y: 0, scale: 1 },
    pausedTime: 0,
    running: false,
    project: { parts: [] },
  };
  Animotion.preview = { worldMatrix: () => identity() };
  Animotion.parts = { selectedPart: () => Animotion.state.parts.find((part) => part.id === Animotion.state.selectedPartId) };
  Animotion.ui = { refreshUi() {} };
  Animotion.imageBounds = () => ({ width: 100, height: 80 });
  Animotion.previewPointerArbitration = { setActiveDragOwner() {}, clearActiveDragOwner() {} };
  Animotion.partCommands = {
    updatePart(part, patch) {
      Object.assign(part, patch);
      return part;
    },
  };
  runScript(context, "scripts/motion-commands.js");
  runScript(context, "scripts/preview-events.js");
  return Animotion;
}

function runScript(context, path) {
  vm.runInContext(fs.readFileSync(path, "utf8"), context, { filename: path });
}

function canvasStub() {
  return {
    captured: null,
    getBoundingClientRect: () => ({ left: 0, top: 0 }),
    setPointerCapture(pointerId) { this.captured = pointerId; },
    hasPointerCapture(pointerId) { return this.captured === pointerId; },
    releasePointerCapture(pointerId) { if (this.captured === pointerId) this.captured = null; },
  };
}

function pointer(clientX, clientY) {
  return { clientX, clientY, pointerId: 1, preventDefault() {} };
}

function beginJointDrag(Animotion) {
  const arm = Animotion.state.parts.find((part) => part.id === "arm");
  return Animotion.previewEvents.beginDragFromTarget(pointer(5, 5), {
    partId: arm.id,
    role: "joint",
    label: "관절점",
    hit: { role: "joint", localPoint: arm.joint },
  });
}

function sampleParts() {
  return [
    { id: "spine", type: "spine", rect: { x: 40, y: 20, w: 20, h: 50 }, customMotion: {}, keyframes: [] },
    { id: "arm", type: "arm", rect: { x: 0, y: 0, w: 10, h: 10 }, pivot: { x: 0, y: 0 }, joint: { x: 5, y: 5 }, customMotion: {}, keyframes: [] },
  ];
}

function identity() {
  return { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 };
}

test("cutscene joint pose drag keeps following pointer outside source bounds", () => {
  const Animotion = loadAnimotion();
  assert.equal(beginJointDrag(Animotion), true);
  Animotion.previewEvents.updateDrag(pointer(155, -15));
  const arm = Animotion.state.parts.find((part) => part.id === "arm");
  assert.equal(arm.customMotion.jointX, 150);
  assert.equal(arm.customMotion.jointY, -20);
});

test("selected joint pose drag does not add extra selected-part translation or rotation", () => {
  const Animotion = loadAnimotion();
  beginJointDrag(Animotion);
  Animotion.previewEvents.updateDrag(pointer(155, 5));
  const arm = Animotion.state.parts.find((part) => part.id === "arm");
  assert.equal(arm.customMotion.x, 0);
  assert.equal(arm.customMotion.y, 0);
  assert.equal(arm.customMotion.rotate, 0);
});

test("pose drag commit can be undone back to the pre-drag pose and keyframes", () => {
  const Animotion = loadAnimotion();
  const arm = Animotion.state.parts.find((part) => part.id === "arm");
  beginJointDrag(Animotion);
  Animotion.previewEvents.updateDrag(pointer(155, 5));
  Animotion.previewEvents.endDrag(pointer(155, 5));
  assert.equal(arm.keyframes.some((keyframe) => keyframe.frame === 3), true);
  assert.equal(Animotion.commandHistory.undo(), true);
  assert.equal(arm.keyframes.length, 0);
  assert.equal(JSON.stringify(arm.customMotion), JSON.stringify(Animotion.motionModel.defaultCustomMotion()));
});
