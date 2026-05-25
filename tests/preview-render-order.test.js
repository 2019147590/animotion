const assert = require("node:assert/strict");
const { test, loadPreview, part, symmetryAsset, readyDraft, point, lastOpIndexBefore } = require("./preview-render-order-fixture");

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
  const plan = Animotion.motionReplacementLayer.planForPart(Animotion.state.parts[1], { parts: Animotion.state.parts, bridge: Animotion.state.cutsceneBridge, frame: 24, selectedPartId: "arm_01" });
  assert.ok(arm);
  assert.deepEqual(point(arm.replacementRenderResult.handTip), point(plan.handTip));
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
    ...symmetryAsset("hidden-arm-symmetry", "arm_01", "arm_02"),
    sourceRectNormalized: { xNorm: 0.19, yNorm: 0.21, wNorm: 0.21, hNorm: 0.26 },
  })];
  Animotion.state.cutsceneBridge.jointAction.motionDraft = readyDraft("arm_01", "hidden-arm-symmetry");
  Animotion.preview.drawPreview(0, () => {}, () => {});
  const sequence = Animotion.state.previewDrawSequenceDebug.sequence;
  const sourcePanel = sequence.find((entry) => entry.pass === "source-panel");
  const patch = sequence.find((entry) => entry.drawPath === "hidden-completion-symmetry");
  const face = sequence.find((entry) => entry.partId === "face_layer" && entry.pass === "main-part");
  assert.equal(sourcePanel.sourcePanelMode, "runtime-part-erased");
  assert.equal(patch.hiddenCompletionPatchId, "hidden-arm-symmetry");
  assert.equal(patch.counterpartPartId, "arm_02");
  assert.equal(patch.index > sourcePanel.index, true);
  assert.equal(patch.index < face.index, true);
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
  assert.equal(patches.length, 1);
  assert.equal(patches[0].partId, body.id);
  assert.equal(patches[0].index < sequence.find((entry) => entry.partId === "face_layer" && entry.pass === "main-part").index, true);
  assert.equal(patches[0].index < sequence.find((entry) => entry.partId === "hair_front" && entry.pass === "main-part").index, true);
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
  const supplemental = sequence.find((entry) => entry.partId === "supp-body-fill" && entry.drawPath === "supplemental-part" && entry.pass === "main-part");
  assert.equal(supplemental.renderGroupPartId, "body");
  assert.equal(supplemental.supplementalCoverage.warnings.length, 0);
  assert.deepEqual(JSON.parse(JSON.stringify(supplemental.supplementalCoverage.maskBounds)), { x: 10, y: 15, w: 24, h: 47 });
  assert.equal(supplemental.index < sequence.find((entry) => entry.partId === "face_layer" && entry.pass === "main-part").index, true);
  const drawIndex = Animotion.previewCtxOps.findIndex((op) => op.name === "drawImage" && op.args[0]?.id === "supp-body-fill");
  const clipIndex = lastOpIndexBefore(Animotion.previewCtxOps, drawIndex, "clip");
  assert.equal(clipIndex > -1, true);
});
