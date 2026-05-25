const assert = require("node:assert/strict");
const { test, loadPreview, part, installUpperArmScenario } = require("./preview-render-order-fixture");

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
  assert.equal(supplemental.index < sequence.find((entry) => entry.partId === arm.id && entry.pass === "main-part").index, true);
  assert.equal(supplemental.index < sequence.find((entry) => entry.partId === "face_layer" && entry.pass === "main-part").index, true);
  assert.equal(supplemental.index < sequence.find((entry) => entry.partId === "hair_front" && entry.pass === "main-part").index, true);
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
  assert.equal(supplemental.supplementalWarpApplied, true);
  assert.equal(supplemental.index < sequence.find((entry) => entry.partId === fore.id && entry.pass === "main-part").index, true);
  assert.equal(supplemental.index < sequence.find((entry) => entry.partId === hand.id && entry.pass === "main-part").index, true);
  assert.equal(supplemental.unexpectedForegroundBeforeFill, false);
});
