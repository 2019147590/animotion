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
  const createdCanvases = [];
  const context = {
    window: { Animotion: {}, devicePixelRatio: 1 },
    DOMMatrix: Matrix,
    performance: { now: () => 0 },
    document: { createElement: () => fakeCanvas(createdCanvases) },
    crypto: { randomUUID: () => "test-id" },
  };
  vm.createContext(context);
  const Animotion = context.window.Animotion;
  Animotion.dom = { previewCanvas: { width: 200, height: 160 }, previewCtx: ctx, els: elements() };
  Animotion.previewCtxOps = ctx.__ops;
  Animotion.createdCanvases = createdCanvases;
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
  for (const path of previewScripts()) runScript(context, path);
  Animotion.motion = { motionFor: (part) => Animotion.motionModel.poseToTransform(Animotion.timeline.evaluatePartAtFrame(part, Animotion.state.currentFrame)) };
  runScript(context, "scripts/preview.js");
  return Animotion;
}

function previewScripts() {
  return [
    "scripts/hidden-completion-coverage-bounds.js", "scripts/hidden-completion-assets.js",
    "scripts/playback-speed.js", "scripts/motion-model.js", "scripts/timeline.js", "scripts/cutscene-action-selectors.js",
    "scripts/action-scoped-effects.js",
    "scripts/rig-connection.js", "scripts/arm-chain-resolver.js", "scripts/render-layer-utils.js",
    "scripts/render-order-debug.js", "scripts/arm-extension-controls.js", "scripts/arm-extension.js",
    "scripts/lead-arm-composite.js",
    "scripts/arm-extension-render.js", "scripts/motion-replacement-layer.js", "scripts/motion-replacement-render.js",
    "scripts/cutscene-depth.js", "scripts/hidden-completion-render.js", "scripts/hidden-completion-supplemental-coverage.js",
    "scripts/hidden-completion-supplemental-part.js", "scripts/hidden-completion-supplemental-warp.js",
    "scripts/hidden-completion-fill-scheduler.js", "scripts/part-visibility-masks.js", "scripts/part-visibility-mask-render.js",
    "scripts/preview-static-transform.js", "scripts/supplemental-follow.js", "scripts/preview-scene.js",
    "scripts/preview-hidden-fill.js", "scripts/preview-supplemental-renderer.js", "scripts/preview-part-renderer.js",
    "scripts/preview-rig-overlay.js",
  ];
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
  return { image: { naturalWidth: 200, naturalHeight: 160 }, parts, selectedPartId: "arm_01", currentFrame: 24, running: false, pausedTime: 0, separateCharacter: false, nextImage: null, project: { assets: [] }, cutsceneBridge: bridge() };
}

function part(id, type, order, rect, humanRole = type) {
  return { id, name: id, type, humanRole, order, rect, pivot: { x: rect.w / 2, y: rect.h * 0.2 }, joint: { x: rect.w / 2, y: rect.h * 0.8 }, alpha: 1, keyframes: [], customMotion: {}, canvas: { id } };
}

function installUpperArmScenario(Animotion) {
  const upper = { ...part("rearupperarm_01", "arm", 2, { x: 70, y: 38, w: 24, h: 44 }), humanRole: "upperArm" };
  const fore = { ...part("rearforearm_01", "arm", 3, { x: 82, y: 58, w: 24, h: 42 }), humanRole: "forearm", parentId: upper.id };
  const hand = { ...part("rearhand_01", "hand", 4, { x: 88, y: 92, w: 20, h: 16 }), humanRole: "hand", parentId: fore.id };
  const counterpart = { ...part("frontupperarm_01", "arm", 5, { x: 102, y: 38, w: 24, h: 44 }), humanRole: "upperArm" };
  Animotion.state.parts = [Animotion.state.parts[0], upper, fore, hand, counterpart, ...Animotion.state.parts.slice(2)];
  Animotion.state.selectedPartId = upper.id;
  Animotion.state.cutsceneBridge = {
    ...Animotion.state.cutsceneBridge,
    primaryPartId: upper.id,
    jointAction: { ...Animotion.state.cutsceneBridge.jointAction, targetDebug: { primaryPartId: upper.id, punchStyle: "rear-cross" } },
  };
  return { upper, fore, hand, counterpart };
}

function symmetryAsset(id, sourcePartId, counterpartPartId) {
  return {
    id, type: "hiddenCompletionPatch", sourcePartId, sourceRectNormalized: { xNorm: 0, yNorm: 0, wNorm: 1, hNorm: 1 },
    guide: {
      meshVerticesNormalized: [{ xNorm: 0, yNorm: 0 }, { xNorm: 1, yNorm: 0 }, { xNorm: 1, yNorm: 1 }, { xNorm: 0, yNorm: 1 }],
      meshFaces: [[0, 1, 2], [0, 2, 3]],
      silhouetteVerticesNormalized: [{ xNorm: 0, yNorm: 0 }, { xNorm: 1, yNorm: 0 }, { xNorm: 1, yNorm: 1 }, { xNorm: 0, yNorm: 1 }],
    },
    patchStatus: "draft", renderMode: "manualOverride", completionMethod: "symmetry",
    symmetrySource: { counterpartPartId, targetPartId: sourcePartId, confidence: 0.9 },
  };
}

function readyDraft(partId, assetId) {
  return { partId, hiddenCompletion: { needed: true, status: "candidate", assetKind: "hiddenCompletionPatch", assetStatus: "ready", assetId } };
}

function bridge() {
  return { primaryPartId: "arm_01", impactFrame: 24, durationFrames: 36, sourceMotionEnabled: false, ghostEnabled: false, jointAction: { actionTimeline: { template: "punch" }, targetDebug: { primaryPartId: "arm_01", punchStyle: "rear-cross" }, beats: [{ id: "guard", at: 1 }, { id: "drive", at: 10 }, { id: "impact", at: 24 }, { id: "recover", at: 36 }] } };
}

function legacyBridge() {
  return { primaryPartId: "arm_01", impactFrame: 24, durationFrames: 36, sourceMotionEnabled: false, ghostEnabled: false, jointAction: { source: "motion-planner-punch-anchors-v1", focusKey: "lHand", actionTimeline: { template: "punch" }, beats: [{ id: "impact", at: 24, pose: { lHand: [92, 36] } }] } };
}

function loadedFrontJabBridge() {
  return { primaryPartId: "arm_02", impactFrame: 24, durationFrames: 36, sourceMotionEnabled: false, ghostEnabled: false, jointAction: { source: "motion-planner-punch-anchors-v1", focusKey: "rHand", actionTimeline: { template: "punch" }, targetDebug: { primaryPartId: "arm_02", punchStyle: "jab" }, beats: [{ id: "guard", at: 1 }, { id: "drive", at: 10 }, { id: "impact", at: 24, pose: { rHand: [128, 42] } }, { id: "recover", at: 36 }] } };
}

function cutsceneModel() {
  return { GHOST_DELAYS: [], GHOST_ALPHA_RATIO: 0.2, normalizeBridge: (bridge) => bridge, bridgeFrameFromTime: () => 24, bridgeValues: () => ({ sourceAlpha: 1, launch: 0, ghostAlpha: 0, speedPower: 0, impactAlpha: 0, flashAlpha: 0, sourceX: 0, sourceY: 0, sourceScale: 1, sourceRotation: 0, impactX: 0, impactY: 0, impactScale: 1, impactRotation: 0 }) };
}

function rectShape(rect) {
  return { points: [{ x: rect.x, y: rect.y }, { x: rect.x + rect.w, y: rect.y }, { x: rect.x + rect.w, y: rect.y + rect.h }, { x: rect.x, y: rect.y + rect.h }], closed: true };
}

function point(value) { return { x: Math.round(Number(value.x)), y: Math.round(Number(value.y)) }; }

function canvasContext() {
  const ops = [];
  const record = (name, ...args) => ops.push({ name, args });
  const ctx = {
    __ops: ops, save: () => record("save"), restore: () => record("restore"), scale: (...args) => record("scale", ...args),
    clearRect: (...args) => record("clearRect", ...args), fillRect: (...args) => record("fillRect", ...args), fill: (...args) => record("fill", ...args),
    translate: (...args) => record("translate", ...args), transform: (...args) => record("transform", ...args), drawImage: (...args) => record("drawImage", ...args),
    stroke: (...args) => record("stroke", ...args), beginPath: (...args) => record("beginPath", ...args), moveTo: (...args) => record("moveTo", ...args),
    lineTo: (...args) => record("lineTo", ...args), closePath: (...args) => record("closePath", ...args), clip: (...args) => record("clip", ...args),
    rotate: (...args) => record("rotate", ...args),
  };
  Object.defineProperty(ctx, "globalAlpha", { get() { return this._alpha ?? 1; }, set(value) { this._alpha = value; record("alpha", value); } });
  Object.defineProperty(ctx, "globalCompositeOperation", { get() { return this._composite ?? "source-over"; }, set(value) { this._composite = value; record("composite", value); } });
  return ctx;
}

function fakeCanvas(createdCanvases) {
  const canvas = { width: 0, height: 0, __ctx: canvasContext(), getContext() { return this.__ctx; } };
  createdCanvases.push(canvas);
  return canvas;
}

function lastOpIndexBefore(ops, beforeIndex, name) {
  for (let index = beforeIndex - 1; index >= 0; index -= 1) if (ops[index]?.name === name) return index;
  return -1;
}

class Matrix {
  constructor(values = {}) { this.a = values.a ?? 1; this.b = values.b ?? 0; this.c = values.c ?? 0; this.d = values.d ?? 1; this.e = values.e ?? 0; this.f = values.f ?? 0; }
  translate(x, y) { return this.multiply(new Matrix({ e: x, f: y })); }
  rotate(degrees) { const r = degrees * Math.PI / 180, c = Math.cos(r), s = Math.sin(r); return this.multiply(new Matrix({ a: c, b: s, c: -s, d: c })); }
  scale(x, y) { return this.multiply(new Matrix({ a: x, d: y })); }
  multiply(right) { return new Matrix({ a: this.a * right.a + this.c * right.b, b: this.b * right.a + this.d * right.b, c: this.a * right.c + this.c * right.d, d: this.b * right.c + this.d * right.d, e: this.a * right.e + this.c * right.f + this.e, f: this.b * right.e + this.d * right.f + this.f }); }
}

module.exports = { test, loadPreview, part, installUpperArmScenario, symmetryAsset, readyDraft, legacyBridge, loadedFrontJabBridge, point, lastOpIndexBefore };
