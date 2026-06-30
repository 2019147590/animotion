const assert = require("node:assert/strict");
const { test, loadPreview, part, installUpperArmScenario, symmetryAsset, readyDraft } = require("./preview-render-order-fixture");

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
  Animotion.state.cutsceneBridge.primaryPartId = upper.id;
  Animotion.state.cutsceneBridge.jointAction.targetDebug = { primaryPartId: upper.id, punchStyle: "rear-cross" };
  Animotion.preview.drawPreview(0, () => {}, () => {});
  const sequence = Animotion.state.previewDrawSequenceDebug.sequence;
  const supplementalDraws = sequence.filter((entry) => entry.partId === supplemental.id && entry.drawPath === "supplemental-part");
  assert.equal(supplementalDraws.length, 1);
  assert.equal(supplementalDraws[0].renderGroupPartId, upper.id);
  assert.equal(supplementalDraws[0].index < sequence.find((entry) => entry.partId === fore.id && entry.pass === "main-part").index, true);
  assert.equal(supplementalDraws[0].index < sequence.find((entry) => entry.partId === hand.id && entry.pass === "main-part").index, true);
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
  assert.equal(supplemental.visiblePath, "supplemental-part");
  assert.equal(supplemental.foregroundOccluderIds.includes(fore.id), true);
  assert.equal(supplemental.foregroundOccluderIds.includes(hand.id), true);
  assert.equal(supplemental.index < sequence.find((entry) => entry.partId === fore.id && entry.pass === "main-part").index, true);
  assert.equal(supplemental.index < sequence.find((entry) => entry.partId === hand.id && entry.pass === "main-part").index, true);
  assert.equal(supplemental.unexpectedForegroundBeforeFill, false);
});

test("upperArm direct ready patch renders once before foreground occluders", () => {
  const Animotion = loadPreview();
  const { upper, fore, hand, counterpart } = installUpperArmScenario(Animotion);
  Animotion.state.project.assets = [symmetryAsset("hidden-upper-direct", upper.id, counterpart.id)];
  Animotion.state.cutsceneBridge.jointAction.motionDraft = readyDraft(upper.id, "hidden-upper-direct");
  Animotion.preview.drawPreview(0, () => {}, () => {});
  const sequence = Animotion.state.previewDrawSequenceDebug.sequence;
  const patches = sequence.filter((entry) => entry.drawPath === "hidden-completion-symmetry" && entry.hiddenCompletionPatchId === "hidden-upper-direct");
  assert.equal(patches.length, 1);
  for (const part of [fore, hand]) assert.equal(patches[0].index < sequence.find((entry) => entry.partId === part.id && entry.pass === "main-part").index, true);
  assert.equal(patches[0].index < sequence.find((entry) => entry.partId === "face_layer" && entry.pass === "main-part").index, true);
  assert.equal(sequence.some((entry) => entry.pass === "depth-top-up" && entry.drawPath === "hidden-completion-symmetry"), false);
});

test("jab action skips legacy rearCross direct ready patch", () => {
  const Animotion = loadPreview();
  const { upper, counterpart } = installUpperArmScenario(Animotion);
  Animotion.state.project.assets = [symmetryAsset("hidden-upper-direct", upper.id, counterpart.id)];
  Animotion.state.cutsceneBridge.jointAction = {
    ...Animotion.state.cutsceneBridge.jointAction,
    targetDebug: { primaryPartId: upper.id, punchStyle: "jab" },
    motionDraft: readyDraft(upper.id, "hidden-upper-direct"),
  };
  Animotion.preview.drawPreview(0, () => {}, () => {});
  const sequence = Animotion.state.previewDrawSequenceDebug.sequence;
  assert.equal(sequence.some((entry) => entry.drawPath === "hidden-completion-symmetry" && entry.hiddenCompletionPatchId === "hidden-upper-direct"), false);
});

test("combo scoped hidden patch only appears during rearCross local action", () => {
  const Animotion = loadPreview();
  const { upper, counterpart } = installUpperArmScenario(Animotion);
  Animotion.state.project.assets = [symmetryAsset("hidden-upper-direct", upper.id, counterpart.id)];
  Animotion.state.cutsceneBridge.jointAction = {
    ...Animotion.state.cutsceneBridge.jointAction,
    source: "combo-timeline-v1",
    comboTimeline: {
      id: "jab_jab_cross",
      steps: [
        { index: 0, actionId: "jab", startFrame: 1, endFrame: 18, holdEndFrame: 20 },
        { index: 1, actionId: "jab", startFrame: 21, endFrame: 38, holdEndFrame: 41 },
        { index: 2, actionId: "rearCross", startFrame: 42, endFrame: 59, holdEndFrame: 59 },
      ],
    },
    motionDraft: readyDraft(upper.id, "hidden-upper-direct"),
    effectTracks: [{ type: "hiddenCompletion", actionId: "rearCross", localFrame: 1, endLocalFrame: 18, partId: upper.id, assetId: "hidden-upper-direct" }],
  };

  Animotion.state.currentFrame = 15;
  Animotion.preview.drawPreview(0, () => {}, () => {});
  assert.equal(Animotion.state.previewDrawSequenceDebug.sequence.some((entry) => entry.hiddenCompletionPatchId === "hidden-upper-direct"), false);

  Animotion.state.currentFrame = 45;
  Animotion.preview.drawPreview(0, () => {}, () => {});
  assert.equal(Animotion.state.previewDrawSequenceDebug.sequence.some((entry) => entry.hiddenCompletionPatchId === "hidden-upper-direct"), true);
});

test("whole-arm jab proxy draws instead of segmented lead chain members", () => {
  const Animotion = loadPreview();
  const { upper, fore, hand } = installUpperArmScenario(Animotion);
  const proxy = { ...part("leadWholeArmJabProxy", "arm", 9, { x: 68, y: 36, w: 48, h: 72 }), usage: "leadWholeArmJabProxy" };
  Animotion.state.parts.push(proxy);
  Animotion.state.cutsceneBridge.jointAction = {
    ...Animotion.state.cutsceneBridge.jointAction,
    targetDebug: { primaryPartId: hand.id, punchStyle: "jab" },
    bindingProfile: {
      leadArm: { mode: "wholeArmProxy", proxyPartId: proxy.id, members: { leadUpperArm: upper.id, leadForearm: fore.id, leadHand: hand.id } },
      lockedPartIds: [upper.id, fore.id, hand.id, proxy.id],
    },
  };

  Animotion.preview.drawPreview(0, () => {}, () => {});
  const sequence = Animotion.state.previewDrawSequenceDebug.sequence;
  assert.equal(sequence.some((entry) => entry.partId === proxy.id && entry.drawPath === "normal-part"), true);
  assert.equal(sequence.some((entry) => entry.partId === upper.id && entry.pass === "main-part"), false);
  assert.equal(sequence.some((entry) => entry.partId === fore.id && entry.pass === "main-part"), false);
  assert.equal(sequence.some((entry) => entry.partId === hand.id && entry.pass === "main-part"), false);
});

test("rearCross hidden fill parts are hidden during jab", () => {
  const Animotion = loadPreview();
  const bodyFill = {
    ...part("body_01 copy", "body", 9001, { x: 50, y: 42, w: 35, h: 76 }),
    usage: "rearCrossHiddenFill",
    createdForActionId: "rearCross",
  };
  const upperFill = {
    ...part("front_upperarm copy", "arm", 9002, { x: 88, y: 44, w: 30, h: 48 }),
    usage: "rearCrossHiddenFill",
    createdForActionId: "rearCross",
  };
  Animotion.state.parts.push(bodyFill, upperFill);
  Animotion.state.cutsceneBridge.jointAction.targetDebug = { punchStyle: "jab" };

  Animotion.preview.drawPreview(0, () => {}, () => {});
  const drawnIds = Animotion.state.previewDrawSequenceDebug.sequence.map((entry) => entry.partId);

  assert.equal(drawnIds.includes(bodyFill.id), false);
  assert.equal(drawnIds.includes(upperFill.id), false);
});

test("rearCross hidden fill parts are visible during rearCross", () => {
  const Animotion = loadPreview();
  const bodyFill = {
    ...part("body_01 copy", "body", 9001, { x: 50, y: 42, w: 35, h: 76 }),
    usage: "rearCrossHiddenFill",
    createdForActionId: "rearCross",
  };
  const upperFill = {
    ...part("front_upperarm copy", "arm", 9002, { x: 88, y: 44, w: 30, h: 48 }),
    usage: "rearCrossHiddenFill",
    createdForActionId: "rearCross",
  };
  Animotion.state.parts.push(bodyFill, upperFill);
  Animotion.state.currentFrame = 15;
  Animotion.state.cutsceneBridge.jointAction.targetDebug = { punchStyle: "rear-cross" };

  Animotion.preview.drawPreview(0, () => {}, () => {});
  const normalDraws = Animotion.state.previewDrawSequenceDebug.sequence
    .filter((entry) => entry.drawPath === "normal-part")
    .map((entry) => entry.partId);

  assert.equal(normalDraws.includes(bodyFill.id), true);
  assert.equal(normalDraws.includes(upperFill.id), true);
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
  assert.equal(patch.visiblePath, "direct-ready-patch");
  assert.equal(patch.foregroundOccluderIds.includes(fore.id), true);
  assert.equal(patch.foregroundOccluderIds.includes(hand.id), true);
  assert.equal(patch.index < sequence.find((entry) => entry.partId === fore.id && entry.pass === "main-part").index, true);
  assert.equal(patch.index < sequence.find((entry) => entry.partId === hand.id && entry.pass === "main-part").index, true);
  assert.equal(patch.unexpectedForegroundBeforeFill, false);
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
  assert.equal(supplemental.index < sequence.find((entry) => entry.partId === fore.id && entry.pass === "main-part").index, true);
  assert.equal(supplemental.index < sequence.find((entry) => entry.partId === hand.id && entry.pass === "main-part").index, true);
  assert.equal(sequence.some((entry) => entry.drawPath === "hidden-completion-symmetry" && entry.hiddenCompletionPatchId === "hidden-upper-direct"), false);
});
