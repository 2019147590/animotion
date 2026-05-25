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
  Animotion.previewCtxOps = ctx.__ops;
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
  for (const path of ["scripts/hidden-completion-coverage-bounds.js", "scripts/hidden-completion-assets.js", "scripts/motion-model.js", "scripts/timeline.js", "scripts/cutscene-action-selectors.js", "scripts/rig-connection.js", "scripts/arm-chain-resolver.js", "scripts/render-layer-utils.js", "scripts/render-order-debug.js", "scripts/arm-extension-controls.js", "scripts/arm-extension.js", "scripts/arm-extension-render.js", "scripts/motion-replacement-layer.js", "scripts/motion-replacement-render.js", "scripts/cutscene-depth.js", "scripts/hidden-completion-render.js", "scripts/hidden-completion-supplemental-coverage.js", "scripts/hidden-completion-supplemental-part.js", "scripts/hidden-completion-supplemental-warp.js", "scripts/hidden-completion-fill-scheduler.js"]) runScript(context, path);
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
    jointAction: {
      ...Animotion.state.cutsceneBridge.jointAction,
      targetDebug: { primaryPartId: upper.id, punchStyle: "rear-cross" },
    },
  };
  return { upper, fore, hand, counterpart };
}

function symmetryAsset(id, sourcePartId, counterpartPartId) {
  return {
    id,
    type: "hiddenCompletionPatch",
    sourcePartId,
    sourceRectNormalized: { xNorm: 0, yNorm: 0, wNorm: 1, hNorm: 1 },
    guide: {
      meshVerticesNormalized: [{ xNorm: 0, yNorm: 0 }, { xNorm: 1, yNorm: 0 }, { xNorm: 1, yNorm: 1 }, { xNorm: 0, yNorm: 1 }],
      meshFaces: [[0, 1, 2], [0, 2, 3]],
      silhouetteVerticesNormalized: [{ xNorm: 0, yNorm: 0 }, { xNorm: 1, yNorm: 0 }, { xNorm: 1, yNorm: 1 }, { xNorm: 0, yNorm: 1 }],
    },
    patchStatus: "draft",
    renderMode: "manualOverride",
    completionMethod: "symmetry",
    symmetrySource: { counterpartPartId, targetPartId: sourcePartId, confidence: 0.9 },
  };
}

function readyDraft(partId, assetId) {
  return {
    partId,
    hiddenCompletion: { needed: true, status: "candidate", assetKind: "hiddenCompletionPatch", assetStatus: "ready", assetId },
  };
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
  const ops = [];
  const record = (name, ...args) => ops.push({ name, args });
  return {
    __ops: ops,
    save: () => record("save"),
    restore: () => record("restore"),
    scale: (...args) => record("scale", ...args),
    clearRect: (...args) => record("clearRect", ...args),
    fillRect: (...args) => record("fillRect", ...args),
    fill: (...args) => record("fill", ...args),
    translate: (...args) => record("translate", ...args),
    transform: (...args) => record("transform", ...args),
    drawImage: (...args) => record("drawImage", ...args),
    stroke: (...args) => record("stroke", ...args),
    beginPath: (...args) => record("beginPath", ...args),
    moveTo: (...args) => record("moveTo", ...args),
    lineTo: (...args) => record("lineTo", ...args),
    closePath: (...args) => record("closePath", ...args),
    clip: (...args) => record("clip", ...args),
    rotate: (...args) => record("rotate", ...args),
  };
}

class Matrix {
  constructor(values = {}) { this.a = values.a ?? 1; this.b = values.b ?? 0; this.c = values.c ?? 0; this.d = values.d ?? 1; this.e = values.e ?? 0; this.f = values.f ?? 0; }
  translate(x, y) { return this.multiply(new Matrix({ e: x, f: y })); }
  rotate(degrees) { const r = degrees * Math.PI / 180, c = Math.cos(r), s = Math.sin(r); return this.multiply(new Matrix({ a: c, b: s, c: -s, d: c })); }
  scale(x, y) { return this.multiply(new Matrix({ a: x, d: y })); }
  multiply(right) { return new Matrix({ a: this.a * right.a + this.c * right.b, b: this.b * right.a + this.d * right.b, c: this.a * right.c + this.c * right.d, d: this.b * right.c + this.d * right.d, e: this.a * right.e + this.c * right.f + this.e, f: this.b * right.e + this.d * right.f + this.f }); }
}

test("actual cutscene preview draw sequence puts replacement rear arm after face and front hair", () => {
  const Animotion = loadPreview();
  Animotion.preview.drawPreview(0, () => {}, () => {});
  const sequence = Animotion.state.previewDrawSequenceDebug.sequence;
  const arm = sequence.find((entry) => entry.partId === "arm_01" && entry.drawPath === "motion-replacement" && entry.pass === "main-part");
  assert.ok(arm);
  assert.equal(sequence.some((entry) => entry.partId === "arm_01" && entry.drawPath === "normal-part" && entry.pass === "main-part"), false);
  for (const id of ["face_layer", "hair_front"]) {
    const covering = sequence.find((entry) => entry.partId === id && entry.pass === "main-part");
    assert.ok(covering);
    assert.equal(arm.index > covering.index, true);
  }
  const topUp = sequence.find((entry) => entry.partId === "arm_01" && entry.pass === "depth-top-up");
  assert.equal(topUp.drawPath, "motion-replacement");
  assert.equal(topUp.index > sequence.find((entry) => entry.pass === "impact-panel").index, true);
  assert.equal(topUp.index > sequence.find((entry) => entry.pass === "flash").index, true);
  assert.equal(topUp.index < sequence.find((entry) => entry.pass === "panel-mask").index, true);
});

test("arm-only rear punch replacement uses evaluated impact hand tip", () => {
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

  const arm = Animotion.state.previewDrawSequenceDebug.sequence.find((entry) => entry.partId === "arm_01" && entry.drawPath === "motion-replacement" && entry.pass === "main-part");
  assert.ok(arm);
  assert.deepEqual(point(arm.replacementRenderResult.handTip), point(Animotion.motionReplacementLayer.planForPart(Animotion.state.parts[1], { parts: Animotion.state.parts, bridge: Animotion.state.cutsceneBridge, frame: 24, selectedPartId: "arm_01" }).handTip));
  assert.equal(arm.replacementRenderResult.beatLabel, "impact");
  assert.equal(arm.skippedNormalArmDraw, true);
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

test("symmetry hidden completion patch composites before foreground occluders", () => {
  const Animotion = loadPreview();
  Animotion.dom.els.backgroundOpacity.value = "1";
  Animotion.state.parts.splice(2, 0, { ...part("arm_02", "arm", 3, { x: 86, y: 34, w: 34, h: 38 }), humanRole: "forearm", handTip: { x: 30, y: 34 } });
  Animotion.state.project.assets = [Animotion.hiddenCompletionAssets.normalizeAsset({
    id: "hidden-arm-symmetry",
    type: "hiddenCompletionPatch",
    sourcePartId: "arm_01",
    sourceRectNormalized: { xNorm: 0.19, yNorm: 0.21, wNorm: 0.21, hNorm: 0.26 },
    guide: {
      meshVerticesNormalized: [{ xNorm: 0, yNorm: 0 }, { xNorm: 1, yNorm: 0 }, { xNorm: 1, yNorm: 1 }, { xNorm: 0, yNorm: 1 }],
      meshFaces: [[0, 1, 2], [0, 2, 3]],
      silhouetteVerticesNormalized: [{ xNorm: 0, yNorm: 0 }, { xNorm: 1, yNorm: 0 }, { xNorm: 1, yNorm: 1 }, { xNorm: 0, yNorm: 1 }],
    },
    patchStatus: "draft",
    renderMode: "manualOverride",
    completionMethod: "symmetry",
    symmetrySource: { counterpartPartId: "arm_02", targetPartId: "arm_01", confidence: 0.9 },
  })];
  Animotion.state.cutsceneBridge.jointAction.motionDraft = {
    partId: "arm_01",
    hiddenCompletion: { needed: true, status: "candidate", assetKind: "hiddenCompletionPatch", assetStatus: "ready", assetId: "hidden-arm-symmetry" },
  };

  Animotion.preview.drawPreview(0, () => {}, () => {});

  const sequence = Animotion.state.previewDrawSequenceDebug.sequence;
  const sourcePanel = sequence.find((entry) => entry.pass === "source-panel");
  const patch = sequence.find((entry) => entry.drawPath === "hidden-completion-symmetry");
  const arm = sequence.find((entry) => entry.partId === "arm_01" && entry.pass === "main-part");
  const face = sequence.find((entry) => entry.partId === "face_layer" && entry.pass === "main-part");
  assert.equal(sourcePanel.sourcePanelMode, "runtime-part-erased");
  assert.ok(patch);
  assert.equal(patch.hiddenCompletionPatchId, "hidden-arm-symmetry");
  assert.equal(patch.counterpartPartId, "arm_02");
  assert.equal(patch.index > sourcePanel.index, true);
  assert.ok(arm);
  assert.equal(patch.index < face.index, true);
  assert.equal(sequence.some((entry) => entry.drawPath === "hidden-completion-symmetry-failed"), false);
});

test("body direct ready patch renders once before foreground occluders", () => {
  const Animotion = loadPreview();
  const body = Animotion.state.parts.find((item) => item.id === "body");
  const counterpart = { ...part("body_ref", "body", 2, { x: 92, y: 45, w: 28, h: 70 }), humanRole: "body" };
  Animotion.state.parts.splice(1, 0, counterpart);
  Animotion.state.project.assets = [symmetryAsset("hidden-body-direct", body.id, counterpart.id)];
  Animotion.state.cutsceneBridge.jointAction.motionDraft = readyDraft(body.id, "hidden-body-direct");

  Animotion.preview.drawPreview(0, () => {}, () => {});

  const sequence = Animotion.state.previewDrawSequenceDebug.sequence;
  const patches = sequence.filter((entry) => entry.drawPath === "hidden-completion-symmetry" && entry.hiddenCompletionPatchId === "hidden-body-direct");
  const face = sequence.find((entry) => entry.partId === "face_layer" && entry.pass === "main-part");
  const hair = sequence.find((entry) => entry.partId === "hair_front" && entry.pass === "main-part");
  assert.equal(patches.length, 1);
  assert.equal(patches[0].partId, body.id);
  assert.equal(patches[0].index < face.index, true);
  assert.equal(patches[0].index < hair.index, true);
});

test("supplemental parts render inside their source part group instead of their own layer order", () => {
  const Animotion = loadPreview();
  Animotion.state.parts.push({
    ...part("supp-body-fill", "body", 9000, { x: 48, y: 40, w: 44, h: 82 }),
    isSupplementalPart: true,
    sourcePartId: "body",
    sourcePatchAssetId: "hidden-body-fill",
    mask: { kind: "polygon", points: [{ x: 10, y: 15 }, { x: 34, y: 15 }, { x: 34, y: 62 }, { x: 10, y: 62 }] },
    canvas: { id: "supp-body-fill" },
  });

  Animotion.preview.drawPreview(0, () => {}, () => {});

  const sequence = Animotion.state.previewDrawSequenceDebug.sequence;
  const body = sequence.find((entry) => entry.partId === "body" && entry.drawPath === "normal-part" && entry.pass === "main-part");
  const supplemental = sequence.find((entry) => entry.partId === "supp-body-fill" && entry.drawPath === "supplemental-part" && entry.pass === "main-part");
  const face = sequence.find((entry) => entry.partId === "face_layer" && entry.pass === "main-part");
  assert.ok(body);
  assert.ok(supplemental);
  assert.ok(face);
  assert.equal(supplemental.renderGroupPartId, "body");
  assert.equal(supplemental.supplementalCoverage.warnings.length, 0);
  assert.deepEqual(JSON.parse(JSON.stringify(supplemental.supplementalCoverage.maskBounds)), { x: 10, y: 15, w: 24, h: 47 });
  assert.equal(supplemental.index > body.index, true);
  assert.equal(supplemental.index < face.index, true);
  assert.equal(sequence.some((entry) => entry.partId === "supp-body-fill" && entry.drawPath === "normal-part"), false);
  const drawIndex = Animotion.previewCtxOps.findIndex((op) => op.name === "drawImage" && op.args[0]?.id === "supp-body-fill");
  const clipIndex = lastOpIndexBefore(Animotion.previewCtxOps, drawIndex, "clip");
  assert.equal(clipIndex > -1, true);
  assert.deepEqual(Animotion.previewCtxOps.slice(clipIndex - 6, clipIndex).map((op) => [op.name, ...op.args]), [
    ["beginPath"],
    ["moveTo", 58, 55],
    ["lineTo", 82, 55],
    ["lineTo", 82, 102],
    ["lineTo", 58, 102],
    ["closePath"],
  ]);
});

test("upperArm supplemental fill stays behind its forearm and hand when the source part is depth-lifted", () => {
  const Animotion = loadPreview();
  const upper = { ...part("rearupperarm_01", "arm", 2, { x: 70, y: 38, w: 24, h: 44 }), humanRole: "upperArm" };
  const fore = { ...part("rearforearm_01", "arm", 3, { x: 82, y: 58, w: 24, h: 42 }), humanRole: "forearm", parentId: upper.id };
  const hand = { ...part("rearhand_01", "hand", 4, { x: 88, y: 92, w: 20, h: 16 }), humanRole: "hand", parentId: fore.id };
  const supplemental = {
    ...part("supp-rearupperarm-fill", "arm", 9000, { x: 66, y: 42, w: 46, h: 66 }),
    isSupplementalPart: true,
    sourcePartId: upper.id,
    sourcePatchAssetId: "hidden-rearupperarm-fill",
    mask: { kind: "polygon", points: [{ x: 0, y: 0 }, { x: 46, y: 0 }, { x: 46, y: 66 }, { x: 0, y: 66 }] },
    canvas: { id: "supp-rearupperarm-fill" },
  };
  Animotion.state.parts = [Animotion.state.parts[0], upper, fore, hand, ...Animotion.state.parts.slice(2), supplemental];
  Animotion.state.selectedPartId = upper.id;
  Animotion.state.cutsceneBridge = {
    ...Animotion.state.cutsceneBridge,
    primaryPartId: upper.id,
    jointAction: {
      ...Animotion.state.cutsceneBridge.jointAction,
      targetDebug: { primaryPartId: upper.id, punchStyle: "rear-cross" },
    },
  };

  Animotion.preview.drawPreview(0, () => {}, () => {});

  const sequence = Animotion.state.previewDrawSequenceDebug.sequence;
  const foreDraw = sequence.find((entry) => entry.partId === fore.id && entry.pass === "main-part");
  const handDraw = sequence.find((entry) => entry.partId === hand.id && entry.pass === "main-part");
  const supplementalDraws = sequence.filter((entry) => entry.partId === supplemental.id && entry.drawPath === "supplemental-part");
  assert.ok(foreDraw);
  assert.ok(handDraw);
  assert.equal(supplementalDraws.length, 1);
  assert.equal(supplementalDraws[0].renderGroupPartId, upper.id);
  assert.equal(supplementalDraws[0].index < foreDraw.index, true);
  assert.equal(supplementalDraws[0].index < handDraw.index, true);
  assert.equal(supplementalDraws.some((entry) => entry.pass === "depth-top-up"), false);
});

test("rear upperArm supplemental fill draws before earlier same-chain forearm and hand", () => {
  const Animotion = loadPreview();
  const { upper, fore, hand } = installUpperArmScenario(Animotion);
  upper.order = 8;
  fore.order = 6;
  hand.order = 7;
  Animotion.state.parts.push({
    ...part("supp-hidden-upper-fill", "arm", 9000, { x: 66, y: 42, w: 46, h: 66 }),
    humanRole: "upperArm",
    isSupplementalPart: true,
    supplementalKind: "hiddenCompletionSymmetry",
    completionMethod: "symmetry",
    sourcePartId: upper.id,
    counterpartPartId: "frontupperarm_01",
    sourcePatchAssetId: "hidden-upper-fill",
    mask: { kind: "polygon", points: [{ x: 0, y: 0 }, { x: 46, y: 0 }, { x: 46, y: 66 }, { x: 0, y: 66 }] },
    canvas: { id: "supp-hidden-upper-fill" },
  });

  Animotion.preview.drawPreview(0, () => {}, () => {});

  const sequence = Animotion.state.previewDrawSequenceDebug.sequence;
  const supplemental = sequence.find((entry) => entry.partId === "supp-hidden-upper-fill" && entry.drawPath === "supplemental-part");
  const foreDraw = sequence.find((entry) => entry.partId === fore.id && entry.pass === "main-part");
  const handDraw = sequence.find((entry) => entry.partId === hand.id && entry.pass === "main-part");
  assert.ok(supplemental);
  assert.equal(supplemental.visiblePath, "supplemental-part");
  assert.equal(supplemental.foregroundOccluderIds.includes(fore.id), true);
  assert.equal(supplemental.foregroundOccluderIds.includes(hand.id), true);
  assert.equal(supplemental.index < foreDraw.index, true);
  assert.equal(supplemental.index < handDraw.index, true);
  assert.equal(supplemental.unexpectedForegroundBeforeFill, false);
  assert.equal(sequence.some((entry) => entry.partId === "supp-hidden-upper-fill" && entry.pass === "depth-top-up"), false);
});

test("upperArm direct ready patch renders once before foreground occluders", () => {
  const Animotion = loadPreview();
  const { upper, fore, hand, counterpart } = installUpperArmScenario(Animotion);
  Animotion.state.project.assets = [symmetryAsset("hidden-upper-direct", upper.id, counterpart.id)];
  Animotion.state.cutsceneBridge.jointAction.motionDraft = readyDraft(upper.id, "hidden-upper-direct");

  Animotion.preview.drawPreview(0, () => {}, () => {});

  const sequence = Animotion.state.previewDrawSequenceDebug.sequence;
  const patches = sequence.filter((entry) => entry.drawPath === "hidden-completion-symmetry" && entry.hiddenCompletionPatchId === "hidden-upper-direct");
  const foreDraw = sequence.find((entry) => entry.partId === fore.id && entry.pass === "main-part");
  const handDraw = sequence.find((entry) => entry.partId === hand.id && entry.pass === "main-part");
  const face = sequence.find((entry) => entry.partId === "face_layer" && entry.pass === "main-part");
  const hair = sequence.find((entry) => entry.partId === "hair_front" && entry.pass === "main-part");
  assert.equal(patches.length, 1);
  for (const occluder of [foreDraw, handDraw, face, hair]) assert.equal(patches[0].index < occluder.index, true);
  assert.equal(sequence.some((entry) => entry.pass === "depth-top-up" && entry.drawPath === "hidden-completion-symmetry"), false);
});

test("rear upperArm direct ready patch draws before earlier same-chain forearm and hand", () => {
  const Animotion = loadPreview();
  const { upper, fore, hand, counterpart } = installUpperArmScenario(Animotion);
  upper.order = 8;
  fore.order = 6;
  hand.order = 7;
  Animotion.state.project.assets = [symmetryAsset("hidden-upper-direct", upper.id, counterpart.id)];
  Animotion.state.cutsceneBridge.jointAction.motionDraft = readyDraft(upper.id, "hidden-upper-direct");

  Animotion.preview.drawPreview(0, () => {}, () => {});

  const sequence = Animotion.state.previewDrawSequenceDebug.sequence;
  const patch = sequence.find((entry) => entry.drawPath === "hidden-completion-symmetry" && entry.hiddenCompletionPatchId === "hidden-upper-direct");
  const foreDraw = sequence.find((entry) => entry.partId === fore.id && entry.pass === "main-part");
  const handDraw = sequence.find((entry) => entry.partId === hand.id && entry.pass === "main-part");
  assert.ok(patch);
  assert.equal(patch.visiblePath, "direct-ready-patch");
  assert.equal(patch.foregroundOccluderIds.includes(fore.id), true);
  assert.equal(patch.foregroundOccluderIds.includes(hand.id), true);
  assert.equal(patch.index < foreDraw.index, true);
  assert.equal(patch.index < handDraw.index, true);
  assert.equal(patch.unexpectedForegroundBeforeFill, false);
  assert.equal(sequence.filter((entry) => entry.drawPath === "hidden-completion-symmetry" && entry.hiddenCompletionPatchId === "hidden-upper-direct").length, 1);
  assert.equal(sequence.some((entry) => entry.pass === "depth-top-up" && entry.drawPath === "hidden-completion-symmetry"), false);
});

test("visible supplemental part suppresses the direct ready patch", () => {
  const Animotion = loadPreview();
  const { upper, fore, hand, counterpart } = installUpperArmScenario(Animotion);
  Animotion.state.project.assets = [symmetryAsset("hidden-upper-direct", upper.id, counterpart.id)];
  Animotion.state.cutsceneBridge.jointAction.motionDraft = readyDraft(upper.id, "hidden-upper-direct");
  Animotion.state.parts.push({
    ...part("supp-hidden-upper-direct", "arm", 9000, { x: 66, y: 42, w: 46, h: 66 }),
    isSupplementalPart: true,
    sourcePartId: upper.id,
    sourcePatchAssetId: "hidden-upper-direct",
    mask: { kind: "polygon", points: [{ x: 0, y: 0 }, { x: 46, y: 0 }, { x: 46, y: 66 }, { x: 0, y: 66 }] },
    canvas: { id: "supp-hidden-upper-direct" },
  });

  Animotion.preview.drawPreview(0, () => {}, () => {});

  const sequence = Animotion.state.previewDrawSequenceDebug.sequence;
  const supplemental = sequence.find((entry) => entry.partId === "supp-hidden-upper-direct" && entry.drawPath === "supplemental-part");
  const foreDraw = sequence.find((entry) => entry.partId === fore.id && entry.pass === "main-part");
  const handDraw = sequence.find((entry) => entry.partId === hand.id && entry.pass === "main-part");
  assert.ok(supplemental);
  assert.equal(supplemental.index < foreDraw.index, true);
  assert.equal(supplemental.index < handDraw.index, true);
  assert.equal(sequence.some((entry) => entry.drawPath === "hidden-completion-symmetry" && entry.hiddenCompletionPatchId === "hidden-upper-direct"), false);
});

test("body hidden-completion supplemental fill draws behind overlapping foreground occluders", () => {
  const Animotion = loadPreview();
  const body = Animotion.state.parts.find((item) => item.id === "body");
  body.order = 8;
  const arm = { ...part("body_cover_arm", "arm", 4, { x: 60, y: 58, w: 34, h: 42 }), humanRole: "forearm" };
  Animotion.state.parts.splice(1, 0, arm);
  Animotion.state.parts.push({
    ...part("supp-hidden-body-fill", "body", 9000, { x: 48, y: 40, w: 44, h: 82 }),
    isSupplementalPart: true,
    supplementalKind: "hiddenCompletionSymmetry",
    completionMethod: "symmetry",
    sourcePartId: body.id,
    sourcePatchAssetId: "hidden-body-fill",
    mask: { kind: "polygon", points: [{ x: 10, y: 15 }, { x: 34, y: 15 }, { x: 34, y: 62 }, { x: 10, y: 62 }] },
    canvas: { id: "supp-hidden-body-fill" },
  });

  Animotion.preview.drawPreview(0, () => {}, () => {});

  const sequence = Animotion.state.previewDrawSequenceDebug.sequence;
  const supplemental = sequence.find((entry) => entry.partId === "supp-hidden-body-fill" && entry.drawPath === "supplemental-part");
  const armDraw = sequence.find((entry) => entry.partId === arm.id && entry.pass === "main-part");
  const face = sequence.find((entry) => entry.partId === "face_layer" && entry.pass === "main-part");
  const hair = sequence.find((entry) => entry.partId === "hair_front" && entry.pass === "main-part");
  assert.ok(supplemental);
  assert.equal(supplemental.index < armDraw.index, true);
  assert.equal(supplemental.index < face.index, true);
  assert.equal(supplemental.index < hair.index, true);
  assert.equal(supplemental.foregroundOccluderIds.includes(arm.id), true);
  assert.equal(supplemental.unexpectedForegroundBeforeFill, false);
});

test("non-overlapping supplemental fill does not pull unrelated parts forward or backward", () => {
  const Animotion = loadPreview();
  const body = Animotion.state.parts.find((item) => item.id === "body");
  const unrelated = { ...part("unrelated_prop", "prop", 0, { x: 150, y: 120, w: 18, h: 18 }), humanRole: "prop" };
  Animotion.state.parts.splice(1, 0, unrelated);
  Animotion.state.parts.push({
    ...part("supp-hidden-body-corner", "body", 9000, { x: 48, y: 40, w: 44, h: 82 }),
    isSupplementalPart: true,
    supplementalKind: "hiddenCompletionSymmetry",
    completionMethod: "symmetry",
    sourcePartId: body.id,
    sourcePatchAssetId: "hidden-body-corner",
    mask: { kind: "polygon", points: [{ x: 10, y: 15 }, { x: 34, y: 15 }, { x: 34, y: 62 }, { x: 10, y: 62 }] },
    canvas: { id: "supp-hidden-body-corner" },
  });

  Animotion.preview.drawPreview(0, () => {}, () => {});

  const sequence = Animotion.state.previewDrawSequenceDebug.sequence;
  const supplemental = sequence.find((entry) => entry.partId === "supp-hidden-body-corner" && entry.drawPath === "supplemental-part");
  const unrelatedDraw = sequence.find((entry) => entry.partId === unrelated.id && entry.pass === "main-part");
  assert.ok(supplemental);
  assert.ok(unrelatedDraw);
  assert.equal(supplemental.foregroundOccluderIds.includes(unrelated.id), false);
  assert.equal(unrelatedDraw.index < supplemental.index, true);
});

test("restored supplemental canvas with saved warp renders through occlusion fill scheduler", () => {
  const Animotion = loadPreview();
  const { upper, fore, hand } = installUpperArmScenario(Animotion);
  upper.order = 8;
  fore.order = 6;
  hand.order = 7;
  Animotion.state.parts.push({
    ...part("supp-restored-upper-fill", "arm", 9000, { x: 66, y: 42, w: 46, h: 66 }),
    humanRole: "upperArm",
    isSupplementalPart: true,
    supplementalKind: "hiddenCompletionSymmetry",
    completionMethod: "symmetry",
    sourcePartId: upper.id,
    sourcePatchAssetId: "hidden-restored-upper-fill",
    mask: { kind: "polygon", points: [{ x: 0, y: 0 }, { x: 46, y: 0 }, { x: 46, y: 66 }, { x: 0, y: 66 }] },
    canvas: { id: "restored-snapshot-canvas", width: 46, height: 66 },
    supplementalWarp: {
      points: [{ id: "tl", x: -2, y: 0 }, { id: "tr", x: 48, y: 4 }, { id: "br", x: 46, y: 68 }, { id: "bl", x: 0, y: 66 }],
    },
  });

  Animotion.preview.drawPreview(0, () => {}, () => {});

  const sequence = Animotion.state.previewDrawSequenceDebug.sequence;
  const supplemental = sequence.find((entry) => entry.partId === "supp-restored-upper-fill" && entry.drawPath === "supplemental-part");
  const foreDraw = sequence.find((entry) => entry.partId === fore.id && entry.pass === "main-part");
  const handDraw = sequence.find((entry) => entry.partId === hand.id && entry.pass === "main-part");
  assert.ok(supplemental);
  assert.equal(supplemental.supplementalWarpApplied, true);
  assert.equal(supplemental.index < foreDraw.index, true);
  assert.equal(supplemental.index < handDraw.index, true);
  assert.equal(supplemental.unexpectedForegroundBeforeFill, false);
});

function lastOpIndexBefore(ops, beforeIndex, name) {
  for (let index = beforeIndex - 1; index >= 0; index -= 1) if (ops[index]?.name === name) return index;
  return -1;
}

test("replacement render failure falls back to normal arm draw", () => {
  const Animotion = loadPreview();
  const arm = Animotion.state.parts.find((part) => part.id === "arm_01");
  arm.handTip = { ...arm.pivot };

  Animotion.preview.drawPreview(0, () => {}, () => {});

  const sequence = Animotion.state.previewDrawSequenceDebug.sequence;
  const failed = sequence.find((entry) => entry.partId === "arm_01" && entry.drawPath === "motion-replacement-failed" && entry.pass === "main-part");
  const fallback = sequence.find((entry) => entry.partId === "arm_01" && entry.drawPath === "normal-part" && entry.pass === "main-part");
  const analysis = Animotion.renderOrderDebug.analyze(Animotion.state.previewDrawSequenceDebug, { selectedPartId: "arm_01", bridge: Animotion.state.cutsceneBridge, parts: Animotion.state.parts });
  assert.ok(failed);
  assert.equal(failed.replacementRenderFailure, true);
  assert.equal(failed.replacementRenderReason, "degenerate-shoulder-handTip");
  assert.ok(fallback);
  assert.equal(fallback.fallbackToNormalArm, true);
  assert.equal(analysis.replacementRenderFailure, true);
  assert.equal(analysis.fallbackToNormalArm, true);
  assert.equal(analysis.segmentedReplacesNormal, false);
});

test("runtime source erase is safe when replacement falls back to normal draw", () => {
  const Animotion = loadPreview();
  Animotion.dom.els.backgroundOpacity.value = "1";
  const arm = Animotion.state.parts.find((part) => part.id === "arm_01");
  arm.handTip = { ...arm.pivot };

  Animotion.preview.drawPreview(0, () => {}, () => {});

  const debug = Animotion.state.previewDrawSequenceDebug;
  const sourcePanel = debug.sequence.find((entry) => entry.pass === "source-panel");
  const fallback = debug.sequence.find((entry) => entry.partId === "arm_01" && entry.drawPath === "normal-part" && entry.pass === "main-part");
  const analysis = Animotion.renderOrderDebug.analyze(debug, { selectedPartId: "arm_01", bridge: Animotion.state.cutsceneBridge, parts: Animotion.state.parts });
  assert.equal(sourcePanel.sourcePanelMode, "runtime-part-erased");
  assert.equal(sourcePanel.erasedPartIds.includes("arm_01"), true);
  assert.ok(fallback);
  assert.equal(analysis.fallbackToNormalArm, true);
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
  assert.equal(armDraw.drawPath, "motion-replacement");
  assert.equal(armDraw.punchStyleSource, "explicit");
  assert.equal(armDraw.replacementRenderResult.beatLabel, "impact");
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
  assert.equal(armDraw.drawPath, "motion-replacement");
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
  assert.equal(topUp.drawPath, "motion-replacement");
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
  assert.equal(armDraw.drawPath, "motion-replacement");
  assert.equal(armDraw.punchStyleSource, "selectedOverrideFromLoadedJab");
  assert.equal(topUp.drawPath, "motion-replacement");
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
