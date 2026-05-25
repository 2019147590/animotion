const assert = require("node:assert/strict");
const { test, loadPreview, part, legacyBridge, loadedFrontJabBridge } = require("./preview-render-order-fixture");

test("replacement render failure falls back to normal arm draw", () => {
  const Animotion = loadPreview();
  const arm = Animotion.state.parts.find((part) => part.id === "arm_01");
  arm.handTip = { ...arm.pivot };
  Animotion.preview.drawPreview(0, () => {}, () => {});
  const sequence = Animotion.state.previewDrawSequenceDebug.sequence;
  const failed = sequence.find((entry) => entry.partId === "arm_01" && entry.drawPath === "motion-replacement-failed" && entry.pass === "main-part");
  const fallback = sequence.find((entry) => entry.partId === "arm_01" && entry.drawPath === "normal-part" && entry.pass === "main-part");
  const analysis = Animotion.renderOrderDebug.analyze(Animotion.state.previewDrawSequenceDebug, { selectedPartId: "arm_01", bridge: Animotion.state.cutsceneBridge, parts: Animotion.state.parts });
  assert.equal(failed.replacementRenderReason, "degenerate-shoulder-handTip");
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
  assert.equal(analysis.sourceEraseWithoutReplacement, false);
  assert.equal(analysis.sourcePanelConflictRisk, false);
});

test("paused cutscene preview does not draw stale ghost parts while editing a frame", () => {
  const Animotion = loadPreview();
  Animotion.cutsceneModel.GHOST_DELAYS = [0.1];
  Animotion.cutsceneModel.bridgeValues = ghostValues;
  Animotion.state.running = false;
  Animotion.state.cutsceneBridge.ghostEnabled = true;
  Animotion.preview.drawPreview(1000, () => {}, () => {});
  assert.equal(Animotion.state.previewDrawSequenceDebug.sequence.some((entry) => entry.pass === "ghost-part"), false);
});

test("running cutscene playback still draws ghost parts when enabled", () => {
  const Animotion = loadPreview();
  Animotion.cutsceneModel.GHOST_DELAYS = [0.1];
  Animotion.cutsceneModel.bridgeValues = ghostValues;
  Animotion.state.running = true;
  Animotion.state.startTime = 0;
  Animotion.state.cutsceneBridge.ghostEnabled = true;
  Animotion.preview.drawPreview(1000, () => {}, () => {});
  assert.equal(Animotion.state.previewDrawSequenceDebug.sequence.some((entry) => entry.pass === "ghost-part"), true);
});

test("explicit loaded rear arm-only punch replaces whole-arm translation without mutating saved data", () => {
  const Animotion = loadPreview();
  const arm = Animotion.state.parts.find((item) => item.id === "arm_01");
  arm.keyframes = [{ frame: 24, pose: { x: 34, y: -6, rotate: 0, scaleY: 0, jointX: 0, jointY: 0, phase: 0 } }];
  Animotion.state.cutsceneBridge = legacyBridge();
  Animotion.state.cutsceneBridge.jointAction.targetDebug = { primaryPartId: "arm_01", punchStyle: "rear-cross" };
  const savedAction = JSON.parse(JSON.stringify(Animotion.state.cutsceneBridge.jointAction));
  const savedKeyframes = JSON.parse(JSON.stringify(arm.keyframes));
  Animotion.preview.drawPreview(0, () => {}, () => {});
  const sequence = Animotion.state.previewDrawSequenceDebug.sequence;
  const armDraw = sequence.find((entry) => entry.partId === "arm_01" && entry.pass === "main-part");
  assert.equal(armDraw.drawPath, "motion-replacement");
  assert.equal(armDraw.punchStyleSource, "explicit");
  assert.equal(armDraw.replacementRenderResult.beatLabel, "impact");
  for (const id of ["face_layer", "hair_front"]) assert.equal(armDraw.index > sequence.find((entry) => entry.partId === id && entry.pass === "main-part").index, true);
  assert.deepEqual(Animotion.state.cutsceneBridge.jointAction, savedAction);
  assert.deepEqual(arm.keyframes, savedKeyframes);
});

test("selected legacy rear arm stays above Korean face layer when primary metadata is missing", () => {
  const Animotion = loadPreview();
  const face = Animotion.state.parts.find((item) => item.id === "face_layer");
  face.name = "?쇨뎬_layer";
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
  Animotion.state.cutsceneBridge = { primaryPartId: null, impactFrame: 24, durationFrames: 36, sourceMotionEnabled: false, ghostEnabled: false, jointAction: { source: "motion-planner-punch-anchors-v1", actionTimeline: { template: "punch" }, beats: [{ id: "impact", at: 24, pose: {} }] } };
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
  assert.equal(topUp.index > sequence.find((entry) => entry.partId === "hair_front" && entry.pass === "main-part").index, true);
  assert.equal(sequence.some((entry) => entry.partId === "arm_01" && entry.drawPath === "normal-part"), false);
  assert.deepEqual(Animotion.state.cutsceneBridge, savedBridge);
});

function ghostValues() {
  return { sourceAlpha: 1, launch: 1, ghostAlpha: 1, speedPower: 0, impactAlpha: 0, flashAlpha: 0, sourceX: 0, sourceY: 0, sourceScale: 1, sourceRotation: 0, impactX: 0, impactY: 0, impactScale: 1, impactRotation: 0 };
}
