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
    "scripts/preview-rig-points.js",
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
  Animotion.preview = { worldMatrix: poseMatrix };
  Animotion.previewTransform = { sourceScale: () => 1 };
  Animotion.parts = { selectedPart: () => Animotion.state.parts.find((part) => part.id === Animotion.state.selectedPartId) };
  Animotion.ui = { refreshUi() {} };
  Animotion.config = { hitTolerancePx: 12 };
  Animotion.imageBounds = () => ({ width: 100, height: 80 });
  Animotion.previewPointerArbitration = { setActiveDragOwner() {}, clearActiveDragOwner() {} };
  runScript(context, "scripts/part-commands.js");
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

function poseMatrix(part) {
  const motion = normalizeMotion(part.customMotion);
  const angle = jointRotation(part, motion);
  const pivot = { x: part.rect.x + (part.pivot?.x || 0), y: part.rect.y + (part.pivot?.y || 0) };
  return multiply(translate(pivot.x, pivot.y), rotate(angle), translate(-pivot.x, -pivot.y));
}

function normalizeMotion(motion = {}) {
  return {
    jointX: Number(motion.jointX) || 0,
    jointY: Number(motion.jointY) || 0,
  };
}

function jointRotation(part, motion) {
  if (!part.joint || (!motion.jointX && !motion.jointY)) return 0;
  const pivot = part.pivot || { x: 0, y: 0 };
  const base = { x: part.joint.x - pivot.x, y: part.joint.y - pivot.y };
  const target = { x: base.x + motion.jointX, y: base.y + motion.jointY };
  if (Math.hypot(base.x, base.y) < 1 || Math.hypot(target.x, target.y) < 1) return 0;
  return Math.atan2(target.y, target.x) - Math.atan2(base.y, base.x);
}

function multiply(...matrices) {
  return matrices.reduce((left, right) => ({
    a: left.a * right.a + left.c * right.b,
    b: left.b * right.a + left.d * right.b,
    c: left.a * right.c + left.c * right.d,
    d: left.b * right.c + left.d * right.d,
    e: left.a * right.e + left.c * right.f + left.e,
    f: left.b * right.e + left.d * right.f + left.f,
  }), identity());
}

function translate(x, y) {
  return { a: 1, b: 0, c: 0, d: 1, e: x, f: y };
}

function rotate(radians) {
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  return { a: cos, b: sin, c: -sin, d: cos, e: 0, f: 0 };
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

test("pose joint hit target stays under the pointer after crossing the pivot", () => {
  const Animotion = loadAnimotion();
  beginJointDrag(Animotion);
  Animotion.previewEvents.updateDrag(pointer(-5, -5));
  const arm = Animotion.state.parts.find((part) => part.id === "arm");
  assert.equal(arm.customMotion.jointX, -10);
  assert.equal(arm.customMotion.jointY, -10);
  const hit = Animotion.previewEvents.hitTarget(pointer(-5, -5));
  assert.equal(hit?.role, "joint");
});

test("pose drag does not record transient movement history before commit", () => {
  const Animotion = loadAnimotion();
  beginJointDrag(Animotion);
  Animotion.previewEvents.updateDrag(pointer(155, 5));
  assert.equal(Animotion.commandHistory.canUndo(), false);
  Animotion.previewEvents.endDrag(pointer(155, 5));
  assert.equal(Animotion.commandHistory.canUndo(), true);
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
