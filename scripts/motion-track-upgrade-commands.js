{
  const global = typeof window !== "undefined" ? window : globalThis;
  const Animotion = global.Animotion || (global.Animotion = {});

  function upgradeCurrentPunchTracks(options = {}) {
    const context = upgradeContext();
    if (!context.ok) return recordResult({ ...context, attempted: true });
    const tracks = Animotion.motionPlanner?.tracksForJointAction?.(context.parts, context.primaryId, context.bridge);
    if (!tracks?.length) return recordResult({ ...context, ok: false, attempted: true, reason: "no-generated-tracks" });
    Animotion.motionCommands?.applyGeneratedTracks?.(tracks, options);
    Animotion.motionCommands?.syncPartPoseToFrame?.(context.state.selectedPartId, context.state.currentFrame);
    return recordResult({ ...context, generated: true, resultTrackCount: tracks.length });
  }

  function upgradeContext(state = Animotion.state) {
    const bridge = Animotion.cutsceneModel?.normalizeBridge?.(state?.cutsceneBridge, { assets: state?.project?.assets }) || null;
    const action = bridge?.jointAction || null;
    if (!action) return inactive("missing-joint-action", state, bridge);
    if (Animotion.cutsceneActionSelectors?.isPunchAction?.(action) !== true) return inactive("not-punch-action", state, bridge);
    const primaryId = bridge.primaryPartId || action.targetDebug?.primaryPartId || state?.selectedPartId || null;
    if (!primaryId || !(state?.parts || []).some((part) => part.id === primaryId)) return inactive("missing-primary-part", state, bridge);
    return { ok: true, state, bridge, action, parts: state.parts || [], primaryId, reason: "ready" };
  }

  function recordResult(result) {
    const entry = {
      attempted: result.attempted === true || result.ok !== false,
      generated: result.generated === true,
      partId: result.primaryId || null,
      bridgePrimaryPartId: result.bridge?.primaryPartId || null,
      actionSource: result.action?.source || result.bridge?.jointAction?.source || null,
      resultTrackCount: result.resultTrackCount || 0,
      reason: result.generated ? "upgraded-loaded-punch-tracks" : result.reason,
    };
    if (result.state) result.state.motionRegenerationDebug = { atFrame: result.state.currentFrame || null, ...entry };
    return { ok: entry.generated, ...entry };
  }

  function inactive(reason, state, bridge) {
    return { ok: false, state, bridge, reason };
  }

  Animotion.motionTrackUpgradeCommands = { upgradeCurrentPunchTracks, upgradeContext };
  if (typeof module !== "undefined") module.exports = Animotion.motionTrackUpgradeCommands;
}
