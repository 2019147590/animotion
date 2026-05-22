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
  const ctx = canvasContext();
  const context = { window: { Animotion: {}, devicePixelRatio: 1 }, DOMMatrix: Matrix, performance: { now: () => 0 }, document: { createElement: () => ({ width: 0, height: 0, getContext: () => ctx }) } };
  vm.createContext(context);
  const Animotion = context.window.Animotion;
  Animotion.dom = { previewCanvas: { width: 200, height: 160 }, previewCtx: ctx, els: elements() };
  Animotion.state = stateFixture();
  Animotion.config = { timelineFps: 24, timelineFrames: 120 };
  Animotion.view = { resizeCanvas() {} };
  Animotion.geometry = { fitRect: () => ({ x: 0, y: 0, w: 200, h: 160, scale: 1 }), absoluteShapeFromPart: (part) => rectShape(part.rect) };
  Animotion.path = { pathFromShape: () => ({}) };
  Animotion.previewTransform = { sourceFrame: () => ({ x: 0, y: 0, w: 200, h: 160, sourceWidth: 200, sourceHeight: 160 }), applySourceFrame() {}, sourceScale: () => 1 };
  Animotion.cutsceneEffects = { drawPanelImage() {}, drawSpeedLines() {}, drawInkField() {}, drawImpactPanel() {}, drawFlash() {}, drawPanelMask() {} };
  Animotion.cutsceneModel = cutsceneModel();
  Animotion.parts = { selectedPart: () => Animotion.state.parts.find((part) => part.id === Animotion.state.selectedPartId) };
  Animotion.previewRigPoints = { localPoint: (part, spec) => spec.localPoint || part.pivot, imagePoint: (part, spec) => ({ x: part.rect.x + (spec.localPoint || part.pivot).x, y: part.rect.y + (spec.localPoint || part.pivot).y }) };
  Animotion.previewTransform.imagePointToScreen = (point) => point;
  for (const path of ["scripts/motion-model.js", "scripts/timeline.js", "scripts/rig-connection.js", "scripts/render-layer-utils.js", "scripts/render-order-debug.js", "scripts/arm-extension-controls.js", "scripts/arm-extension.js", "scripts/arm-extension-render.js", "scripts/cutscene-depth.js"]) runScript(context, path);
  Animotion.motion = { motionFor: (part) => Animotion.motionModel.poseToTransform(Animotion.timeline.evaluatePartAtFrame(part, Animotion.state.currentFrame)) };
  runScript(context, "scripts/preview.js");
  return Animotion;
}

function runScript(context, path) {
  vm.runInContext(fs.readFileSync(path, "utf8"), context, { filename: path });
}

function elements() {
  return {
    motionTemplate: { value: "cutscene" },
    backgroundOpacity: { value: "0" },
    impactReferenceOpacity: { value: "0" },
    currentFrame: { value: "24" },
    frameLabel: { textContent: "24" },
  };
}

function stateFixture() {
  const parts = [
    part("body", "body", 1, { x: 55, y: 45, w: 28, h: 70 }),
    { ...part("arm_01", "arm", 2, { x: 38, y: 34, w: 42, h: 42 }), humanRole: "forearm", pivot: { x: 28, y: 8 }, joint: { x: 22, y: 22 }, handTip: { x: 8, y: 36 }, keyframes: [{ frame: 24, pose: { x: 4, y: 0, rotate: -42, scaleY: 0.9, jointX: 0, jointY: 0, phase: 0 } }] },
    part("face_layer", "prop", 5000, { x: 52, y: 26, w: 34, h: 30 }, "face"),
    part("hair_front", "hair", 7000, { x: 46, y: 16, w: 48, h: 26 }),
  ];
  return { image: { naturalWidth: 200, naturalHeight: 160 }, parts, selectedPartId: "arm_01", currentFrame: 24, running: false, pausedTime: 0, separateCharacter: false, nextImage: null, cutsceneBridge: bridge() };
}
function part(id, type, order, rect, humanRole = type) {
  return { id, name: id, type, humanRole, order, rect, pivot: { x: rect.w / 2, y: rect.h * 0.2 }, joint: { x: rect.w / 2, y: rect.h * 0.8 }, alpha: 1, keyframes: [], customMotion: {}, canvas: { id } };
}

function bridge() {
  return { primaryPartId: "arm_01", impactFrame: 24, durationFrames: 36, sourceMotionEnabled: false, ghostEnabled: false, jointAction: { actionTimeline: { template: "punch" }, targetDebug: { primaryPartId: "arm_01", punchStyle: "rear-cross" }, beats: [{ id: "guard", at: 1 }, { id: "drive", at: 10 }, { id: "impact", at: 24 }, { id: "recover", at: 36 }] } };
}

function cutsceneModel() {
  return { GHOST_DELAYS: [], GHOST_ALPHA_RATIO: 0.2, normalizeBridge: (bridge) => bridge, bridgeFrameFromTime: () => 24, bridgeValues: () => ({ sourceAlpha: 1, launch: 0, ghostAlpha: 0, speedPower: 0, impactAlpha: 0, flashAlpha: 0, sourceX: 0, sourceY: 0, sourceScale: 1, sourceRotation: 0, impactX: 0, impactY: 0, impactScale: 1, impactRotation: 0 }) };
}

function rectShape(rect) {
  return { points: [{ x: rect.x, y: rect.y }, { x: rect.x + rect.w, y: rect.y }, { x: rect.x + rect.w, y: rect.y + rect.h }, { x: rect.x, y: rect.y + rect.h }], closed: true };
}

function point(value) { return { x: Math.round(Number(value.x)), y: Math.round(Number(value.y)) }; }

function canvasContext() {
  const noop = () => {};
  return { save: noop, restore: noop, scale: noop, clearRect: noop, fillRect: noop, fill: noop, translate: noop, transform: noop, drawImage: noop, stroke: noop, beginPath: noop, moveTo: noop, lineTo: noop, closePath: noop, clip: noop, rotate: noop };
}

class Matrix {
  constructor(values = {}) { this.a = values.a ?? 1; this.b = values.b ?? 0; this.c = values.c ?? 0; this.d = values.d ?? 1; this.e = values.e ?? 0; this.f = values.f ?? 0; }
  translate(x, y) { return this.multiply(new Matrix({ e: x, f: y })); }
  rotate(degrees) { const r = degrees * Math.PI / 180, c = Math.cos(r), s = Math.sin(r); return this.multiply(new Matrix({ a: c, b: s, c: -s, d: c })); }
  scale(x, y) { return this.multiply(new Matrix({ a: x, d: y })); }
  multiply(right) { return new Matrix({ a: this.a * right.a + this.c * right.b, b: this.b * right.a + this.d * right.b, c: this.a * right.c + this.c * right.d, d: this.b * right.c + this.d * right.d, e: this.a * right.e + this.c * right.f + this.e, f: this.b * right.e + this.d * right.f + this.f }); }
}

test("actual cutscene preview draw sequence puts segmented rear arm after face and front hair", () => {
  const Animotion = loadPreview();
  Animotion.preview.drawPreview(0, () => {}, () => {});
  const sequence = Animotion.state.previewDrawSequenceDebug.sequence;
  const arm = sequence.find((entry) => entry.partId === "arm_01" && entry.drawPath === "segmented-arm" && entry.pass === "main-part");
  assert.ok(arm);
  assert.equal(sequence.some((entry) => entry.partId === "arm_01" && entry.drawPath === "normal-part" && entry.pass === "main-part"), false);
  for (const id of ["face_layer", "hair_front"]) {
    const covering = sequence.find((entry) => entry.partId === id && entry.pass === "main-part");
    assert.ok(covering);
    assert.equal(arm.index > covering.index, true);
  }
  const topUp = sequence.find((entry) => entry.partId === "arm_01" && entry.pass === "depth-top-up");
  assert.equal(topUp.drawPath, "segmented-arm");
  assert.equal(topUp.index > sequence.find((entry) => entry.pass === "impact-panel").index, true);
  assert.equal(topUp.index > sequence.find((entry) => entry.pass === "flash").index, true);
  assert.equal(topUp.index < sequence.find((entry) => entry.pass === "panel-mask").index, true);
});

test("arm-only rear punch segmented controls land the glove while keeping elbow behind it", () => {
  const Animotion = loadPreview();
  Animotion.state.cutsceneBridge.jointAction = {
    ...Animotion.state.cutsceneBridge.jointAction,
    focusKey: "lHand",
    beats: [
      { id: "drive", at: 10, pose: { lShoulder: [70, 42], lElbow: [78, 64], lHand: [84, 76] } },
      { id: "impact", at: 24, pose: { lShoulder: [70, 42], lElbow: [94, 92], lHand: [96, 96] } },
      { id: "recover", at: 36, pose: { lShoulder: [70, 42], lElbow: [78, 50], lHand: [88, 58] } },
    ],
  };

  Animotion.preview.drawPreview(0, () => {}, () => {});

  const arm = Animotion.state.previewDrawSequenceDebug.sequence.find((entry) => entry.partId === "arm_01" && entry.drawPath === "segmented-arm" && entry.pass === "main-part");
  assert.ok(arm);
  assert.deepEqual(point(arm.segmentedRenderResult.handTip), { x: 96, y: 96 });
  assert.equal(arm.segmentedRenderResult.elbow.x < 90, true);
  assert.equal(arm.segmentedRenderResult.elbow.y < 82, true);
});

test("cutscene preview erases runtime rigged character from source panel before drawing animated parts", () => {
  const Animotion = loadPreview();
  Animotion.dom.els.backgroundOpacity.value = "1";
  const savedSeparateCharacter = Animotion.state.separateCharacter;

  Animotion.preview.drawPreview(0, () => {}, () => {});

  const debug = Animotion.state.previewDrawSequenceDebug;
  const sourcePanel = debug.sequence.find((entry) => entry.pass === "source-panel");
  const analysis = Animotion.renderOrderDebug.analyze(debug, { selectedPartId: "arm_01", bridge: Animotion.state.cutsceneBridge, parts: Animotion.state.parts });
  assert.equal(sourcePanel.drawPath, "source-panel");
  assert.equal(sourcePanel.sourcePanelMode, "runtime-part-erased");
  assert.deepEqual(sourcePanel.erasedPartIds.sort(), Animotion.state.parts.map((part) => part.id).sort());
  assert.equal(analysis.sourcePanelConflictRisk, false);
  assert.equal(analysis.sourceEraseWithoutReplacement, false);
  assert.equal(Animotion.state.separateCharacter, savedSeparateCharacter);
});

test("segmented arm render failure falls back to normal arm draw", () => {
  const Animotion = loadPreview();
  const arm = Animotion.state.parts.find((part) => part.id === "arm_01");
  arm.joint = { ...arm.pivot };

  Animotion.preview.drawPreview(0, () => {}, () => {});

  const sequence = Animotion.state.previewDrawSequenceDebug.sequence;
  const failed = sequence.find((entry) => entry.partId === "arm_01" && entry.drawPath === "segmented-arm-failed" && entry.pass === "main-part");
  const fallback = sequence.find((entry) => entry.partId === "arm_01" && entry.drawPath === "normal-part" && entry.pass === "main-part");
  const analysis = Animotion.renderOrderDebug.analyze(Animotion.state.previewDrawSequenceDebug, { selectedPartId: "arm_01", bridge: Animotion.state.cutsceneBridge, parts: Animotion.state.parts });
  assert.ok(failed);
  assert.equal(failed.segmentedRenderFailure, true);
  assert.equal(failed.segmentedRenderReason, "degenerate-segment");
  assert.ok(fallback);
  assert.equal(fallback.fallbackForSegmentedRender, true);
  assert.equal(analysis.segmentedRenderFailure, true);
  assert.equal(analysis.segmentedReplacesNormal, false);
});

test("runtime source erase is safe when segmented arm falls back to normal draw", () => {
  const Animotion = loadPreview();
  Animotion.dom.els.backgroundOpacity.value = "1";
  const arm = Animotion.state.parts.find((part) => part.id === "arm_01");
  arm.joint = { ...arm.pivot };

  Animotion.preview.drawPreview(0, () => {}, () => {});

  const debug = Animotion.state.previewDrawSequenceDebug;
  const sourcePanel = debug.sequence.find((entry) => entry.pass === "source-panel");
  const fallback = debug.sequence.find((entry) => entry.partId === "arm_01" && entry.drawPath === "normal-part" && entry.pass === "main-part");
  const analysis = Animotion.renderOrderDebug.analyze(debug, { selectedPartId: "arm_01", bridge: Animotion.state.cutsceneBridge, parts: Animotion.state.parts });
  assert.equal(sourcePanel.sourcePanelMode, "runtime-part-erased");
  assert.equal(sourcePanel.erasedPartIds.includes("arm_01"), true);
  assert.ok(fallback);
  assert.equal(analysis.sourceEraseWithoutReplacement, false);
  assert.equal(analysis.sourcePanelConflictRisk, false);
});

test("paused cutscene preview does not draw stale ghost parts while editing a frame", () => {
  const Animotion = loadPreview();
  Animotion.cutsceneModel.GHOST_DELAYS = [0.1];
  Animotion.cutsceneModel.bridgeValues = () => ({ sourceAlpha: 1, launch: 1, ghostAlpha: 1, speedPower: 0, impactAlpha: 0, flashAlpha: 0, sourceX: 0, sourceY: 0, sourceScale: 1, sourceRotation: 0, impactX: 0, impactY: 0, impactScale: 1, impactRotation: 0 });
  Animotion.state.running = false;
  Animotion.state.cutsceneBridge.ghostEnabled = true;

  Animotion.preview.drawPreview(1000, () => {}, () => {});

  assert.equal(Animotion.state.previewDrawSequenceDebug.sequence.some((entry) => entry.pass === "ghost-part"), false);
});

test("running cutscene playback still draws ghost parts when enabled", () => {
  const Animotion = loadPreview();
  Animotion.cutsceneModel.GHOST_DELAYS = [0.1];
  Animotion.cutsceneModel.bridgeValues = () => ({ sourceAlpha: 1, launch: 1, ghostAlpha: 1, speedPower: 0, impactAlpha: 0, flashAlpha: 0, sourceX: 0, sourceY: 0, sourceScale: 1, sourceRotation: 0, impactX: 0, impactY: 0, impactScale: 1, impactRotation: 0 });
  Animotion.state.running = true;
  Animotion.state.startTime = 0;
  Animotion.state.cutsceneBridge.ghostEnabled = true;

  Animotion.preview.drawPreview(1000, () => {}, () => {});

  assert.equal(Animotion.state.previewDrawSequenceDebug.sequence.some((entry) => entry.pass === "ghost-part"), true);
});

test("explicit loaded rear arm-only punch replaces whole-arm translation without mutating saved data", () => {
  const Animotion = loadPreview();
  const arm = Animotion.state.parts.find((part) => part.id === "arm_01");
  arm.keyframes = [{ frame: 24, pose: { x: 34, y: -6, rotate: 0, scaleY: 0, jointX: 0, jointY: 0, phase: 0 } }];
  Animotion.state.cutsceneBridge = legacyBridge();
  Animotion.state.cutsceneBridge.jointAction.targetDebug = { primaryPartId: "arm_01", punchStyle: "rear-cross" };
  const savedAction = JSON.parse(JSON.stringify(Animotion.state.cutsceneBridge.jointAction)), savedKeyframes = JSON.parse(JSON.stringify(arm.keyframes));

  assert.deepEqual(Animotion.cutsceneDepth.orderedParts(Animotion.state.parts, { parts: Animotion.state.parts, bridge: Animotion.state.cutsceneBridge, frame: 1 }).map((part) => part.id), ["body", "arm_01", "face_layer", "hair_front"]);
  assert.deepEqual(Animotion.cutsceneDepth.orderedParts(Animotion.state.parts, { parts: Animotion.state.parts, bridge: Animotion.state.cutsceneBridge, frame: 36 }).map((part) => part.id), ["body", "arm_01", "face_layer", "hair_front"]);

  Animotion.preview.drawPreview(0, () => {}, () => {});

  const sequence = Animotion.state.previewDrawSequenceDebug.sequence, armDraw = sequence.find((entry) => entry.partId === "arm_01" && entry.pass === "main-part");
  assert.equal(armDraw.drawPath, "segmented-arm");
  assert.equal(armDraw.punchStyleSource, "explicit");
  assert.equal(armDraw.segmentedRenderResult.leadingControl, "handTip");
  assert.equal(armDraw.legacyDepthCompat, false);
  assert.equal(sequence.some((entry) => entry.partId === "arm_01" && entry.drawPath === "normal-part" && entry.pass === "main-part"), false);
  for (const id of ["face_layer", "hair_front"]) assert.equal(armDraw.index > sequence.find((entry) => entry.partId === id && entry.pass === "main-part").index, true);
  assert.deepEqual(Animotion.state.cutsceneBridge.jointAction, savedAction);
  assert.deepEqual(arm.keyframes, savedKeyframes);
});

test("selected legacy rear arm stays above Korean face layer when primary metadata is missing", () => {
  const Animotion = loadPreview();
  const face = Animotion.state.parts.find((part) => part.id === "face_layer");
  face.name = "얼굴_layer";
  Animotion.state.cutsceneBridge = legacyBridge();
  Animotion.state.cutsceneBridge.primaryPartId = null;

  Animotion.preview.drawPreview(0, () => {}, () => {});

  const sequence = Animotion.state.previewDrawSequenceDebug.sequence;
  const armDraw = sequence.find((entry) => entry.partId === "arm_01" && entry.pass === "main-part");
  const faceDraw = sequence.find((entry) => entry.partId === "face_layer" && entry.pass === "main-part");
  assert.equal(armDraw.drawPath, "segmented-arm");
  assert.equal(armDraw.index > faceDraw.index, true);
});

test("selected covered legacy punch without target metadata still gets depth top up", () => {
  const Animotion = loadPreview();
  Animotion.state.cutsceneBridge = {
    primaryPartId: null,
    impactFrame: 24,
    durationFrames: 36,
    sourceMotionEnabled: false,
    ghostEnabled: false,
    jointAction: { source: "motion-planner-punch-anchors-v1", actionTimeline: { template: "punch" }, beats: [{ id: "impact", at: 24, pose: {} }] },
  };

  Animotion.preview.drawPreview(0, () => {}, () => {});

  const topUp = Animotion.state.previewDrawSequenceDebug.sequence.find((entry) => entry.partId === "arm_01" && entry.pass === "depth-top-up");
  assert.equal(topUp.drawPath, "segmented-arm");
  assert.equal(topUp.punchStyleSource, "inferredLegacyLayer");
});

test("actual preview draw uses selected rear arm depth when loaded JSON still has front jab metadata", () => {
  const Animotion = loadPreview();
  Animotion.state.parts.splice(2, 0, { ...part("arm_02", "arm", 3, { x: 84, y: 36, w: 34, h: 38 }), humanRole: "forearm", handTip: { x: 30, y: 34 } });
  Animotion.state.cutsceneBridge = loadedFrontJabBridge();
  const savedBridge = JSON.parse(JSON.stringify(Animotion.state.cutsceneBridge));

  Animotion.preview.drawPreview(0, () => {}, () => {});

  const sequence = Animotion.state.previewDrawSequenceDebug.sequence;
  const armDraw = sequence.find((entry) => entry.partId === "arm_01" && entry.pass === "main-part");
  const topUp = sequence.find((entry) => entry.partId === "arm_01" && entry.pass === "depth-top-up");
  assert.equal(armDraw.drawPath, "segmented-arm");
  assert.equal(armDraw.punchStyleSource, "selectedOverrideFromLoadedJab");
  assert.equal(topUp.drawPath, "segmented-arm");
  assert.equal(topUp.evaluatedDepthBias > 0, true);
  assert.equal(topUp.finalSortKey > sequence.find((entry) => entry.partId === "hair_front" && entry.pass === "main-part").baseOrder, true);
  assert.equal(topUp.index > sequence.find((entry) => entry.partId === "face_layer" && entry.pass === "main-part").index, true);
  assert.equal(topUp.index > sequence.find((entry) => entry.partId === "hair_front" && entry.pass === "main-part").index, true);
  assert.equal(sequence.some((entry) => entry.partId === "arm_01" && entry.drawPath === "normal-part"), false);
  assert.deepEqual(Animotion.state.cutsceneBridge, savedBridge);
});

function legacyBridge() {
  return { primaryPartId: "arm_01", impactFrame: 24, durationFrames: 36, sourceMotionEnabled: false, ghostEnabled: false, jointAction: { source: "motion-planner-punch-anchors-v1", focusKey: "lHand", actionTimeline: { template: "punch" }, beats: [{ id: "impact", at: 24, pose: { lHand: [92, 36] } }] } };
}

function loadedFrontJabBridge() {
  return { primaryPartId: "arm_02", impactFrame: 24, durationFrames: 36, sourceMotionEnabled: false, ghostEnabled: false, jointAction: { source: "motion-planner-punch-anchors-v1", focusKey: "rHand", actionTimeline: { template: "punch" }, targetDebug: { primaryPartId: "arm_02", punchStyle: "jab" }, beats: [{ id: "guard", at: 1 }, { id: "drive", at: 10 }, { id: "impact", at: 24, pose: { rHand: [128, 42] } }, { id: "recover", at: 36 }] } };
}
