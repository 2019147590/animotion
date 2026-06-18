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
    "scripts/playback-speed.js",
    "scripts/coordinate-spaces.js",
    "scripts/motion-model.js",
    "scripts/motion-hints.js",
    "scripts/motion-drafts.js",
    "scripts/timeline.js",
    "scripts/motion-target-state.js",
    "scripts/motion-target-debug.js",
    "scripts/character-root-motion.js",
    "scripts/action-specs.js",
    "scripts/action-timeline-model.js",
    "scripts/cutscene-action-selectors.js",
    "scripts/impact-exaggeration-layer.js",
    "scripts/pose-assist.js",
    "scripts/joint-coordinates.js",
    "scripts/cutscene-model.js",
    "scripts/motion-anchors.js",
    "scripts/arm-extension-controls.js",
    "scripts/arm-extension.js",
    "scripts/motion-replacement-layer.js",
    "scripts/motion-replacement-render.js",
    "scripts/motion-track-builder.js",
    "scripts/boxing-step-locomotion.js",
    "scripts/motion-planner.js",
    "scripts/action-frame-editor.js",
    "scripts/preview-coordinate.js",
    "scripts/preview-rig-points.js",
    "scripts/command-history.js",
    "scripts/pose-drag-history.js",
  ]) runScript(context, path);
  const Animotion = context.window.Animotion;
  const canvas = canvasStub();
  Animotion.dom = { previewCanvas: canvas, els: { motionTemplate: { value: "cutscene" }, pivotEditTarget: { value: "handTip" }, playPause: { textContent: "" } } };
  Animotion.state = stateFixture();
  Animotion.preview = { worldMatrix: () => ({ a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }) };
  Animotion.previewTransform = { sourceScale: () => 1 };
  Animotion.parts = { selectedPart: () => Animotion.state.parts.find((part) => part.id === Animotion.state.selectedPartId) };
  Animotion.ui = { refreshUi() {} };
  Animotion.config = { hitTolerancePx: 12 };
  Animotion.imageBounds = () => ({ width: 100, height: 80 });
  Animotion.previewPointerArbitration = { setActiveDragOwner() {}, clearActiveDragOwner() {} };
  runScript(context, "scripts/part-supplemental-transform.js");
  runScript(context, "scripts/part-commands.js");
  runScript(context, "scripts/motion-commands.js");
  runScript(context, "scripts/preview-events.js");
  generatePunch(Animotion);
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

function stateFixture() {
  return {
    currentFrame: 1,
    parts: [
      { id: "spine", type: "spine", humanRole: "torso", rect: { x: 40, y: 20, w: 20, h: 50 }, pivot: { x: 10, y: 25 }, joint: { x: 10, y: 40 }, customMotion: {}, keyframes: [] },
      { id: "arm", type: "arm", humanRole: "forearm", rect: { x: 0, y: 0, w: 10, h: 10 }, pivot: { x: 0, y: 0 }, joint: { x: 5, y: 5 }, handTip: { x: 8, y: 5 }, customMotion: {}, keyframes: [] },
    ],
    selectedPartId: "arm",
    motionPlan: { template: "punch", target: null, targetMode: false },
    previewView: { x: 0, y: 0, w: 100, h: 80 },
    previewSourceFrame: { x: 0, y: 0, w: 100, h: 80, sourceWidth: 100, sourceHeight: 80 },
    previewSourceTransform: { x: 0, y: 0, scale: 1 },
    pausedTime: 0,
    running: false,
    project: { parts: [] },
  };
}

function pointer(clientX, clientY) {
  return { clientX, clientY, pointerId: 1, preventDefault() {} };
}

function beginHandTipDrag(Animotion) {
  const arm = Animotion.state.parts.find((part) => part.id === "arm");
  return Animotion.previewEvents.beginDragFromTarget(pointer(8, 5), {
    partId: arm.id,
    role: "handTip",
    label: "손끝점",
    hit: { role: "handTip", localPoint: arm.handTip },
  });
}

function generatePunch(Animotion) {
  const bridge = Animotion.cutsceneModel.normalizeBridge({ primaryPartId: "arm", durationFrames: 36, impactFrame: 24 });
  const result = Animotion.motionPlanner.createPlan(Animotion.state.parts, "arm", bridge, { template: "punch", target: { x: 90, y: 5 } });
  Animotion.motionCommands.applyMotionPlanResult(bridge, { template: "punch" }, result);
}

function generateBoxingStep(Animotion) {
  const bridge = Animotion.cutsceneModel.normalizeBridge({
    primaryPartId: "spine",
    durationFrames: 16,
    impactFrame: 16,
    effectDirection: { x: 1, y: 0 },
  });
  const result = Animotion.motionPlanner.createPlan(Animotion.state.parts, "spine", bridge, { template: "boxingStep" });
  Animotion.motionCommands.applyMotionPlanResult(bridge, { template: "boxingStep" }, result);
}

function poseAt(part, frame) {
  return part.keyframes.find((keyframe) => keyframe.frame === frame)?.pose;
}

test("handTip pose drag at selected impact frame writes an impact keyframe", () => {
  const Animotion = loadAnimotion();
  const arm = Animotion.state.parts.find((part) => part.id === "arm");
  Animotion.actionFrameEditor.selectBeat("impact");
  const before = Animotion.timeline.evaluatePartAtFrame(arm, 24);
  assert.equal(beginHandTipDrag(Animotion), true);
  Animotion.previewEvents.updateDrag(pointer(18, 5));
  Animotion.previewEvents.endDrag(pointer(18, 5));
  assert.equal(poseAt(arm, 24).jointX, before.jointX + 10);
  assert.equal(Animotion.timeline.evaluatePartAtFrame(arm, 24).jointX, before.jointX + 10);
});

test("replacement plan uses edited impact handTip pose", () => {
  const Animotion = loadAnimotion();
  const arm = Animotion.state.parts.find((part) => part.id === "arm");
  Animotion.actionFrameEditor.selectBeat("impact");
  const beforePlan = Animotion.motionReplacementLayer.planForPart(arm, {
    parts: Animotion.state.parts,
    bridge: Animotion.state.cutsceneBridge,
    frame: 24,
    selectedPartId: "arm",
  });
  beginHandTipDrag(Animotion);
  Animotion.previewEvents.updateDrag(pointer(18, 5));
  Animotion.previewEvents.endDrag(pointer(18, 5));
  const afterPlan = Animotion.motionReplacementLayer.planForPart(arm, {
    parts: Animotion.state.parts,
    bridge: Animotion.state.cutsceneBridge,
    frame: 24,
    selectedPartId: "arm",
  });

  assert.equal(afterPlan.active, true);
  assert.notDeepEqual(JSON.parse(JSON.stringify(afterPlan.handTip)), JSON.parse(JSON.stringify(beforePlan.handTip)));
  assert.equal(poseAt(arm, 24).jointX > beforePlan.evaluatedPose.jointX, true);
});

test("windup action-frame drag does not overwrite the impact keyframe", () => {
  const Animotion = loadAnimotion();
  const arm = Animotion.state.parts.find((part) => part.id === "arm");
  Animotion.actionFrameEditor.selectBeat("impact");
  beginHandTipDrag(Animotion);
  Animotion.previewEvents.updateDrag(pointer(18, 5));
  Animotion.previewEvents.endDrag(pointer(18, 5));
  const impact = { ...poseAt(arm, 24) };

  Animotion.actionFrameEditor.selectBeat("windup");
  const windupFrame = Animotion.state.currentFrame;
  beginHandTipDrag(Animotion);
  Animotion.previewEvents.updateDrag(pointer(3, 5));
  Animotion.previewEvents.endDrag(pointer(3, 5));

  assert.notEqual(poseAt(arm, windupFrame).jointX, impact.jointX);
  assert.equal(poseAt(arm, 24).jointX, impact.jointX);
});

test("boxingStep action-frame drag writes the selected frame keyframe", () => {
  const Animotion = loadAnimotion();
  const arm = Animotion.state.parts.find((part) => part.id === "arm");
  generateBoxingStep(Animotion);
  Animotion.actionFrameEditor.selectBeat("settle");
  const frame = Animotion.state.currentFrame;
  const before = Animotion.timeline.evaluatePartAtFrame(arm, frame);

  assert.equal(beginHandTipDrag(Animotion), true);
  Animotion.previewEvents.updateDrag(pointer(18, 5));
  Animotion.previewEvents.endDrag(pointer(18, 5));

  assert.equal(poseAt(arm, frame).jointX, before.jointX + 10);
  assert.equal(Animotion.state.cutsceneBridge.jointAction.actionTimeline.template, "boxingStep");
});
