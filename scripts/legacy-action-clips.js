{
  const global = typeof window !== "undefined" ? window : globalThis;
  const Animotion = global.Animotion || (global.Animotion = {});
  const IDS = Object.freeze({
    upper: "344d68b5-da9a-4a05-ae0c-aef075518a3d",
    forearm: "612d3ea0-7471-4649-8a61-7da9055cfc76",
    hand: "316845c3-0e83-4880-94d7-df6d83852448",
    bodyFill: "78b3d0c3-1fca-4e5e-88ab-75585a9a1d37",
    upperFill: "c21c00a0-c931-47aa-acff-d466b3dcffa1",
  });

  const LEGACY_REAR_CROSS_17 = Object.freeze({
    id: "legacyRearCross17",
    actionId: "rearCross",
    source: "legacyClip",
    primaryPartId: IDS.hand,
    durationFrames: 18,
    impactFrame: 15,
    resolvedArmChain: { upperArmId: IDS.upper, forearmId: IDS.forearm, handOrGloveId: IDS.hand },
    hiddenFillPartIds: [IDS.bodyFill, IDS.upperFill],
    bridge: {
      primaryPartId: IDS.hand,
      durationFrames: 18,
      impactFrame: 15,
      effectDirection: { x: 0.9701425001453319, y: -0.24253562503633297 },
      effectStrength: 1,
      sourceMotionEnabled: false,
      bodyAssistEnabled: true,
      ghostEnabled: true,
      jointAction: {
        source: "legacyClip",
        actionId: "rearCross",
        legacyClipId: "legacyRearCross17",
        focusKey: "lHand",
        actionTimeline: { template: "punch", id: "punch", label: "legacyRearCross17", durationFrames: 18, impactFrame: 15, beats: timelineBeats() },
        beats: rearCrossBeats(),
        targetDebug: {
          punchStyle: "rear-cross",
          primaryPartId: IDS.hand,
          selectedPartId: IDS.hand,
          terminalPunchPartId: IDS.hand,
          terminalPunchPointSource: "handTip",
          punchSide: "rear/rear-cross",
          separateRigPath: true,
          resolvedArmChain: { upperArmId: IDS.upper, forearmId: IDS.forearm, handOrGloveId: IDS.hand },
          legacyClipId: "legacyRearCross17",
        },
        impactExaggeration: { kind: "impactExaggeration", enabled: true, frame: 15, holdFrames: 2, strength: 1, targetPartIds: [IDS.hand], scaleHints: [{ partId: IDS.hand, scaleX: 1.06, scaleY: 0.96 }], stretchHints: [{ partId: IDS.hand, axis: "x", amount: 0.1 }] },
      },
    },
    partTracks: [
      track(IDS.hand, [[1, 0, 0, 0, 0], [4, -2, 0, -1.49, -0.04], [8, 31, -3, 22.11, 0.72], [12, 44, -4, 25.77, 0.72], [15, 53, -3, 28.86, 0.72], [18, 11, -1, 11.56, 0.27]]),
      track(IDS.upper, [[1, 0, 0, 1.2, 0], [4, -1.65, 0.45, -1.2, 0], [8, 33.15, -2.7, 1.2, 0], [12, 46.8, -4.2, 1.2, 0], [15, 56.55, -3.45, 1.2, 0], [18, 12, -0.75, 1.2, 0]]),
      track(IDS.forearm, [[1, 0, 0, 2.4, 0], [4, -3.3, 0.9, -2.4, 0], [8, 66.3, -5.4, 2.4, 0], [12, 93.6, -8.4, 2.4, 0], [15, 113.1, -6.9, 2.4, 0], [18, 24, -1.5, 2.4, 0]]),
      track(IDS.bodyFill, [[1, 0, 0, 0, 0], [4, 12, -1, 0, 0], [8, 76, -5, 0, 0], [12, 111, -7, 0, 0], [15, 123, -8, 0, 0], [18, 27, -2, 0, 0]]),
      { partId: IDS.upperFill, keyframes: [] },
    ],
  });

  function clipFor(id) {
    return id === LEGACY_REAR_CROSS_17.id ? clone(LEGACY_REAR_CROSS_17) : null;
  }

  function clipForAction(actionId) {
    return actionId === "rearCross" ? clipFor("legacyRearCross17") : null;
  }

  function applyPartMetadata(parts = [], clip = null) {
    const ids = new Set(clip?.hiddenFillPartIds || []);
    for (const part of parts || []) {
      if (!ids.has(part?.id)) continue;
      part.usage = part.usage || "rearCrossHiddenFill";
      part.createdForActionId = part.createdForActionId || "rearCross";
      part.ownerActionId = part.ownerActionId || "rearCross";
      for (const mask of part.visibilityMasks || []) mask.ownerActionId = mask.ownerActionId || "rearCross";
    }
  }

  function track(partId, rows) {
    return { partId, keyframes: rows.map(([frame, x, y, rotate, scaleY]) => ({ frame, pose: pose(x, y, rotate, scaleY) })) };
  }

  function pose(x = 0, y = 0, rotate = 0, scaleY = 0) {
    return { x, y, rotate, scaleY, jointX: 0, jointY: 0, phase: 0 };
  }

  function timelineBeats() {
    return [
      { id: "guard", phase: 0, at: 1, recoil: 0, lift: 0, reach: 0 },
      { id: "windup", phase: 0.2, at: 4, recoil: -0.24, lift: 0.06, reach: 0.1 },
      { id: "drive", phase: 0.52, at: 8, recoil: 0.18, lift: -0.03, reach: 0.62 },
      { id: "extension", phase: 0.78, at: 12, recoil: 0.38, lift: -0.01, reach: 0.9 },
      { id: "impact", phase: 1, at: 15, recoil: 0, lift: 0, reach: 1 },
      { id: "recover", phase: 1, at: 18, recoil: 0.04, lift: 0.02, reach: 0.22 },
    ];
  }

  function rearCrossBeats() {
    const poses = [
      ["guard", 1, { hip: [484, 595], chest: [484, 330], head: [489, 189], lShoulder: [349, 389], lElbow: [292, 425], lHand: [476, 242], rShoulder: [539, 340], rElbow: [702, 351], rHand: [830, 360], lKnee: [276, 994], lFoot: [276, 1238], rKnee: [658, 1077], rFoot: [658, 1381] }],
      ["windup", 4, { hip: [496, 594], chest: [498, 329], head: [496, 189], lShoulder: [349, 389], lElbow: [322, 413], lHand: [465, 245], rShoulder: [539, 340], rElbow: [702, 351], rHand: [830, 360], lKnee: [276, 994], lFoot: [276, 1238], rKnee: [658, 1077], rFoot: [658, 1381] }],
      ["drive", 8, { hip: [560, 590], chest: [573, 324], head: [532, 186], lShoulder: [349, 389], lElbow: [477, 352], lHand: [697, 224], rShoulder: [539, 340], rElbow: [702, 351], rHand: [830, 360], lKnee: [276, 994], lFoot: [276, 1238], rKnee: [658, 1077], rFoot: [658, 1381] }],
      ["extension", 12, { hip: [595, 588], chest: [614, 322], head: [552, 185], lShoulder: [349, 389], lElbow: [561, 319], lHand: [788, 214], rShoulder: [539, 340], rElbow: [702, 351], rHand: [830, 360], lKnee: [276, 994], lFoot: [276, 1238], rKnee: [658, 1077], rFoot: [658, 1381] }],
      ["impact", 15, { hip: [607, 587], chest: [628, 321], head: [559, 184], lShoulder: [349, 389], lElbow: [591, 307], lHand: [853, 219], rShoulder: [539, 340], rElbow: [702, 351], rHand: [830, 360], lKnee: [276, 994], lFoot: [276, 1238], rKnee: [658, 1077], rFoot: [658, 1381] }],
      ["recover", 18, { hip: [511, 593], chest: [516, 328], head: [504, 188], lShoulder: [349, 389], lElbow: [358, 399], lHand: [556, 237], rShoulder: [539, 340], rElbow: [702, 351], rHand: [830, 360], lKnee: [276, 994], lFoot: [276, 1238], rKnee: [658, 1077], rFoot: [658, 1381] }],
    ];
    return poses.map(([id, at, pose]) => ({ id, at, pose }));
  }

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  Animotion.legacyActionClips = { IDS, clipFor, clipForAction, applyPartMetadata };
  if (typeof module !== "undefined") module.exports = Animotion.legacyActionClips;
}
