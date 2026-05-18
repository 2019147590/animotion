{
  const global = window;
  const Animotion = global.Animotion;
  const state = Animotion.state;

  function syncPartPoseToFrame(partOrId, frame = state.currentFrame) {
    const part = findPart(partOrId);
    if (!part) return null;
    return Animotion.partCommands.updatePart(part, {
      customMotion: Animotion.timeline.evaluatePartAtFrame(part, frame),
    }, { recordHistory: false });
  }

  function insertKeyframe(partOrId, frame = state.currentFrame, pose = null) {
    const part = findPart(partOrId);
    if (!part) return null;
    part.keyframes = Animotion.timeline.upsertedKeyframes(part, frame, pose || part.customMotion);
    syncProjectParts();
    return part;
  }

  function deleteKeyframe(partOrId, frame = state.currentFrame) {
    const part = findPart(partOrId);
    if (!part) return null;
    part.keyframes = Animotion.timeline.deletedKeyframes(part, frame);
    syncPartPoseToFrame(part, frame);
    syncProjectParts();
    return part;
  }

  function applyGeneratedTracks(tracks = []) {
    for (const track of tracks) setPartKeyframes(track.partId, track.keyframes);
    syncProjectParts();
  }

  function applyMotionPlanResult(bridge, plan, result) {
    setCutsceneBridge({ ...bridge, jointAction: result.jointAction });
    setMotionPlan({
      ...plan,
      target: result.target,
      anchors: result.anchors,
      motionScope: result.motionScope,
      targetDebug: result.targetDebug,
    });
    applyGeneratedTracks(result.partTracks);
    syncPartPoseToFrame(state.selectedPartId, state.currentFrame);
    return result;
  }

  function currentMotionPlan() {
    state.motionPlan = normalizeMotionPlan(state.motionPlan);
    return state.motionPlan;
  }

  function setMotionPlan(patch = {}) {
    const nextPatch = { ...patch };
    if (hasOwn(nextPatch, "target") && !hasOwn(nextPatch, "targetNormalized")) nextPatch.targetNormalized = null;
    state.motionPlan = normalizeMotionPlan({
      ...currentMotionPlan(),
      ...nextPatch,
    });
    return state.motionPlan;
  }

  function setPartKeyframes(partOrId, keyframes = []) {
    const part = findPart(partOrId);
    if (!part) return null;
    part.keyframes = keyframesForTrack(keyframes);
    return part;
  }

  function setCutsceneBridge(bridge) {
    state.cutsceneBridge = bridge ? Animotion.cutsceneModel.normalizeBridge(bridge, { assets: projectAssets() }) : null;
    return state.cutsceneBridge;
  }

  function updateJointAction(action) {
    if (!state.cutsceneBridge) return null;
    state.cutsceneBridge = Animotion.cutsceneModel.normalizeBridge({
      ...state.cutsceneBridge,
      jointAction: action,
    });
    return state.cutsceneBridge.jointAction;
  }

  function findPart(partOrId) {
    const id = typeof partOrId === "string" ? partOrId : partOrId?.id;
    return state.parts.find((part) => part.id === id) || null;
  }

  function keyframesForTrack(keyframes) {
    return Animotion.timeline.sortedKeyframes({ keyframes });
  }

  function syncProjectParts() {
    if (state.project) state.project.parts = state.parts;
  }

  function normalizeMotionPlan(plan) {
    return Animotion.motionPlanner?.normalizePlan?.(plan, { assets: projectAssets() }) || { ...plan };
  }

  function hasOwn(value, key) {
    return Object.prototype.hasOwnProperty.call(value, key);
  }

  function projectAssets() {
    return state.project?.assets || null;
  }

  Animotion.motionCommands = {
    syncPartPoseToFrame,
    insertKeyframe,
    deleteKeyframe,
    applyGeneratedTracks,
    applyMotionPlanResult,
    setPartKeyframes,
    setCutsceneBridge,
    updateJointAction,
    currentMotionPlan,
    setMotionPlan,
  };
}
