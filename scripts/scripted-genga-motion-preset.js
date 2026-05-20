{
  const global = typeof window !== "undefined" ? window : globalThis;
  const Animotion = global.Animotion || (global.Animotion = {});

  const PRESET_ID = "scripted-genga-demo-motion-v1";
  const FOREARM_ID = "part-right-forearm";
  const HIDDEN_PATCH_ID = "hidden-right-forearm-extension";

  function createPreset(options = {}) {
    const hiddenAssetId = options.hiddenAssetId || options.fixture?.hiddenCompletionPatch?.id || HIDDEN_PATCH_ID;
    const trajectoryPoints = createTrajectoryPoints();
    const motionDraft = createMotionDraft(hiddenAssetId);
    return {
      id: PRESET_ID,
      name: "Demo Genga Motion",
      selectedPartId: FOREARM_ID,
      durationFrames: 36,
      impactFrame: 24,
      partTracks: createPartTracks(),
      trajectoryPoints,
      rootMotion: createRootMotion(),
      motionDraft,
      motionPlan: createMotionPlan(trajectoryPoints, motionDraft),
      cutsceneBridge: createCutsceneBridge(trajectoryPoints, motionDraft),
    };
  }

  function applyToApp(options = {}) {
    if (!canApplyToApp()) throw new Error("Demo genga fixture를 먼저 생성해야 합니다.");
    const preset = createPreset({ fixture: Animotion.state.scriptedGengaFixture, ...options });
    Animotion.motionCommands.setCutsceneBridge(preset.cutsceneBridge);
    Animotion.motionCommands.setMotionPlan(preset.motionPlan);
    Animotion.state.motionPlan = { ...Animotion.state.motionPlan, ...preset.motionPlan };
    Animotion.motionCommands.applyGeneratedTracks(preset.partTracks);
    Animotion.state.selectedPartId = preset.selectedPartId;
    Animotion.state.currentFrame = preset.impactFrame;
    Animotion.state.running = false;
    if (Animotion.dom?.els?.motionTemplate) Animotion.dom.els.motionTemplate.value = "cutscene";
    if (Animotion.dom?.els?.playPause) Animotion.dom.els.playPause.textContent = "재생";
    Animotion.motionCommands.syncPartPoseToFrame(preset.selectedPartId, preset.impactFrame);
    syncProjectEditor(preset);
    if (Animotion.dom?.els?.demoGengaStatus) {
      Animotion.dom.els.demoGengaStatus.textContent = "demo genga motion preset이 적용되었습니다.";
    }
    Animotion.ui.refreshUi();
    return preset;
  }

  function applyToParts(parts, preset = createPreset()) {
    const byId = new Map((parts || []).map((part) => [part.id, part]));
    for (const track of preset.partTracks) {
      const part = byId.get(track.partId);
      if (part) part.keyframes = clone(track.keyframes);
    }
    return parts;
  }

  function canApplyToApp() {
    const ids = new Set((Animotion.state?.parts || []).map((part) => part.id));
    return ids.has("part-torso") && ids.has("part-neck-head") && ids.has(FOREARM_ID);
  }

  function createPartTracks() {
    return [
      track("part-torso", [[1, 0, 0, 0], [10, -8, 6, -3], [24, 26, -10, 4], [36, 8, 0, 1]]),
      track("part-neck-head", [[1, 0, 0, 0], [10, -3, 2, -5], [24, 5, -4, 7], [36, 0, 0, 2]]),
      track("part-right-upper-arm", [[1, 0, 0, 0], [10, -4, 2, -8], [24, 14, -8, 18, 16, -12], [36, 3, 0, 6]]),
      track(FOREARM_ID, [[1, 0, 0, 0], [10, -8, 4, -10], [24, 34, -16, 34, 62, -26], [36, 8, -2, 8, 18, -8]]),
      track("part-speed-arc", [[1, -18, 8, -4], [10, -8, 2, -2], [24, 18, -10, 7], [36, 0, 0, 0]]),
    ];
  }

  function track(partId, specs) {
    return { partId, keyframes: specs.map(([frame, x, y, rotate, jointX = 0, jointY = 0]) => ({ frame, pose: pose(x, y, rotate, jointX, jointY) })) };
  }

  function pose(x, y, rotate, jointX = 0, jointY = 0) {
    return { x, y, rotate, scaleY: 0, jointX, jointY, phase: 0 };
  }

  function createTrajectoryPoints() {
    return [
      trajectory("ready", 1, 604, 326),
      trajectory("windup", 10, 582, 332),
      trajectory("extension", 24, 706, 300),
      trajectory("settle", 36, 642, 318),
    ];
  }

  function trajectory(id, frame, x, y) {
    return { id, frame, kind: "motion-sample", editable: true, point: { x, y } };
  }

  function createMotionDraft(hiddenAssetId) {
    return {
      source: PRESET_ID,
      generatedFrom: "scripted-demo-motion",
      partId: FOREARM_ID,
      draftKind: "non-destructive-2.5d",
      draftScope: "plan",
      compiledFromHintsVersion: 1,
      visibility: { property: "opacity", reason: "forearm-extension-readability", keyframes: [{ frame: 1, value: 1 }, { frame: 24, value: 0.82 }] },
      zOrder: { property: "layerIndex", reason: "forearm-sweeps-in-front", keyframes: [{ frame: 1, value: "current" }, { frame: 24, value: "front" }] },
      hiddenCompletion: { needed: true, status: "required", assetKind: "hiddenCompletionPatch", assetStatus: "ready", assetId: hiddenAssetId },
      warnings: ["right forearm pivot starts outside the source rect; extension guide should remain editable."],
    };
  }

  function createRootMotion() {
    return { source: PRESET_ID, keyframes: [{ frame: 1, x: 0, y: 0, rotate: 0 }, { frame: 24, x: 26, y: -10, rotate: 4 }, { frame: 36, x: 8, y: 0, rotate: 1 }] };
  }

  function createMotionPlan(trajectoryPoints, motionDraft) {
    return { template: "punch", target: { x: 706, y: 300 }, targetMode: false, demoMotionPresetId: PRESET_ID, trajectoryPoints: clone(trajectoryPoints), rootMotion: createRootMotion(), motionDraft: clone(motionDraft) };
  }

  function createCutsceneBridge(trajectoryPoints, motionDraft) {
    return { primaryPartId: FOREARM_ID, durationFrames: 36, impactFrame: 24, effectDirection: { x: 1, y: -0.28 }, effectStrength: 1, sourceMotionEnabled: true, bodyAssistEnabled: true, ghostEnabled: true, jointAction: { source: PRESET_ID, focusKey: "rHand", beats: createBeats(), trajectoryPoints: clone(trajectoryPoints), motionDraft: clone(motionDraft), targetDebug: { chosenMotionScope: "body-follow", rootMotion: createRootMotion(), hiddenCompletionReason: "forearm sweep exposes side fill beyond the original rect" } } };
  }

  function createBeats() {
    return [
      beat("ready", 1, 472, 382, 508, 184, 560, 264, 636, 340, 806, 378),
      beat("windup", 10, 462, 388, 502, 182, 548, 264, 616, 334, 772, 366),
      beat("extension", 24, 498, 366, 518, 174, 570, 252, 660, 310, 842, 344),
      beat("settle", 36, 480, 380, 512, 178, 562, 258, 642, 324, 814, 366),
    ];
  }

  function beat(id, at, hipX, hipY, headX, headY, shoulderX, shoulderY, elbowX, elbowY, handX, handY) {
    return { id, at, pose: { hip: [hipX, hipY], chest: [500, 294], head: [headX, headY], rShoulder: [shoulderX, shoulderY], rElbow: [elbowX, elbowY], rHand: [handX, handY] } };
  }

  function syncProjectEditor(preset) {
    const project = Animotion.state.project;
    if (!project) return;
    project.parts = Animotion.state.parts;
    project.editor = { ...(project.editor || {}), selectedPartId: preset.selectedPartId, motionPlan: Animotion.state.motionPlan, cutsceneBridge: Animotion.state.cutsceneBridge };
  }

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  Animotion.scriptedGengaMotionPreset = { createPreset, applyToApp, applyToParts, canApplyToApp };
  if (typeof module !== "undefined") module.exports = Animotion.scriptedGengaMotionPreset;
}
