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

  function insertKeyframe(partOrId, frame = state.currentFrame, pose = null, options = {}) {
    const part = findPart(partOrId);
    if (!part) return null;
    const before = partSnapshot(part);
    part.keyframes = Animotion.timeline.upsertedKeyframes(part, frame, pose || part.customMotion);
    syncProjectParts();
    recordKeyframeUpdate(part.id, before, partSnapshot(part), options);
    return part;
  }

  function deleteKeyframe(partOrId, frame = state.currentFrame, options = {}) {
    const part = findPart(partOrId);
    if (!part) return null;
    const before = partSnapshot(part);
    part.keyframes = Animotion.timeline.deletedKeyframes(part, frame);
    syncPartPoseToFrame(part, frame);
    syncProjectParts();
    recordKeyframeUpdate(part.id, before, partSnapshot(part), options);
    return part;
  }

  function applyGeneratedTracks(tracks = []) {
    for (const track of tracks) setPartKeyframes(track.partId, track.keyframes);
    syncProjectParts();
  }

  function applyMotionPlanResult(bridge, plan, result) {
    const primaryPartId = result.primaryPartId || result.effectivePrimaryPartId || bridge.primaryPartId;
    setCutsceneBridge({ ...bridge, primaryPartId, jointAction: result.jointAction });
    setMotionPlan({
      ...plan,
      target: result.target,
      anchors: result.anchors,
      motionScope: result.motionScope,
      targetDebug: result.targetDebug,
      activeMotionTarget: result.activeMotionTarget,
      trajectoryPoints: result.trajectoryPoints,
    });
    applyGeneratedTracks(result.partTracks);
    syncPartPoseToFrame(state.selectedPartId, state.currentFrame);
    return result;
  }

  function regenerateForRigChange(partId, change = {}, options = {}) {
    const geometryChanged = rigGeometryChanged(change);
    if (options.regenerateMotion === false || !geometryChanged) {
      if (options.recordHistory !== false) {
        recordRegenerationDebug({
          attempted: false,
          generated: false,
          partId,
          changedKeys: Object.keys(change.after || {}),
          geometryChanged,
          reason: options.regenerateMotion === false ? "disabled" : "non-rig-geometry-change",
        });
      }
      return null;
    }
    const bridge = Animotion.cutsceneModel?.normalizeBridge?.(state.cutsceneBridge, { assets: projectAssets() });
    if (!regenerablePunchBridge(bridge, partId)) {
      recordRegenerationDebug({
        attempted: true,
        generated: false,
        partId,
        changedKeys: Object.keys(change.after || {}),
        geometryChanged,
        bridgePrimaryPartId: bridge?.primaryPartId || null,
        actionSource: bridge?.jointAction?.source || null,
        reason: "not-regenerable-punch-bridge",
      });
      return null;
    }
    const plan = { ...currentMotionPlan(), template: "punch", selectedPartId: partId };
    const result = Animotion.motionPlanner?.createPlan?.(state.parts, partId, bridge, plan);
    recordRegenerationDebug({
      attempted: true,
      generated: Boolean(result),
      partId,
      changedKeys: Object.keys(change.after || {}),
      geometryChanged,
      bridgePrimaryPartId: bridge?.primaryPartId || null,
      actionSource: bridge?.jointAction?.source || null,
      resultTrackCount: result?.partTracks?.length || 0,
      reason: result ? "generated" : "planner-returned-empty",
    });
    return result ? applyMotionPlanResult(bridge, plan, result) : null;
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

  function recordKeyframeUpdate(partId, before, after, options) {
    if (options.recordHistory === false || sameValue(before, after)) return;
    Animotion.commandHistory?.record?.({
      label: "keyframe",
      undo: () => applyPartSnapshot(partId, before),
      redo: () => applyPartSnapshot(partId, after),
    });
  }

  function applyPartSnapshot(partId, snapshot) {
    const part = findPart(partId);
    if (!part) return null;
    setPartKeyframes(part, cloneValue(snapshot.keyframes || []));
    applyCustomMotion(part, snapshot.customMotion);
    syncProjectParts();
    return part;
  }

  function applyCustomMotion(part, customMotion) {
    const patch = { customMotion: cloneValue(customMotion) };
    if (Animotion.partCommands?.updatePart) return Animotion.partCommands.updatePart(part, patch, { recordHistory: false });
    Object.assign(part, patch);
    return part;
  }

  function setCutsceneBridge(bridge) {
    state.cutsceneBridge = bridge ? Animotion.cutsceneModel.normalizeBridge(bridge, { assets: projectAssets() }) : null;
    return state.cutsceneBridge;
  }

  function updateJointAction(action) {
    if (!state.cutsceneBridge) return null;
    const previousAction = state.cutsceneBridge.jointAction;
    const nextAction = Animotion.motionDraftActionStore?.preservePreviousDraft?.(previousAction, action, { assets: projectAssets() }) || action;
    state.cutsceneBridge = Animotion.cutsceneModel.normalizeBridge({
      ...state.cutsceneBridge,
      jointAction: nextAction,
    }, { assets: projectAssets() });
    return Animotion.cutsceneActionSelectors?.getActiveJointAction?.(state)?.action || null;
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

  function rigGeometryChanged(change = {}) {
    return ["handTip", "joint", "pivot"].some((key) => hasOwn(change.after || {}, key));
  }

  function regenerablePunchBridge(bridge, partId) {
    const action = bridge?.jointAction;
    if (!action || !partId || bridge.primaryPartId !== partId) return false;
    return Animotion.cutsceneActionSelectors?.isPunchAction?.(action) || false;
  }

  function hasOwn(value, key) {
    return Object.prototype.hasOwnProperty.call(value, key);
  }

  function partSnapshot(part) {
    return {
      customMotion: cloneValue(Animotion.motionModel.normalizeCustomMotion(part.customMotion)),
      keyframes: cloneValue(keyframesForTrack(part.keyframes || [])),
    };
  }

  function sameValue(left, right) {
    return JSON.stringify(left) === JSON.stringify(right);
  }

  function cloneValue(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function projectAssets() {
    return state.project?.assets || null;
  }

  function recordRegenerationDebug(entry) {
    state.motionRegenerationDebug = {
      atFrame: state.currentFrame || null,
      ...entry,
    };
    return state.motionRegenerationDebug;
  }

  Animotion.motionCommands = {
    syncPartPoseToFrame,
    insertKeyframe,
    deleteKeyframe,
    applyGeneratedTracks,
    applyMotionPlanResult,
    regenerateForRigChange,
    setPartKeyframes,
    setCutsceneBridge,
    updateJointAction,
    currentMotionPlan,
    setMotionPlan,
  };
}
