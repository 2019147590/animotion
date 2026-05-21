{
  const global = typeof window !== "undefined" ? window : globalThis;
  const Animotion = global.Animotion || (global.Animotion = {});

  function statusForBridge(bridge = {}, options = {}) {
    if (!bridge) return { active: false };
    const safe = Animotion.cutsceneModel?.normalizeBridge?.(bridge) || bridge || {};
    const action = safe.jointAction;
    const actionType = actionTypeFor(action);
    if (!action || !["punch", "kick"].includes(actionType)) return { active: false };
    const beats = Array.isArray(action.beats) ? action.beats : [];
    const impactBeat = beatById(beats, "impact");
    const currentBeat = currentBeatFor(beats, options.currentFrame || 1);
    const timelineBeats = Array.isArray(action.actionTimeline?.beats) ? action.actionTimeline.beats : [];
    return {
      active: true,
      actionType,
      currentBeatId: currentBeat?.id || null,
      currentBeatFrame: currentBeat?.at || null,
      impactFrame: safe.impactFrame || action.actionTimeline?.impactFrame || impactBeat?.at || null,
      primaryPartRole: action.actionTimeline?.primaryPartRole || null,
      primaryPartId: safe.primaryPartId || action.targetDebug?.primaryPartId || null,
      bodyRootAssistActive: bodyRootAssistActive(safe, action),
      hipRootAnchorPresent: hipRootAnchorPresent(action.anchors),
      primaryImpactTarget: primaryImpactTarget(action, impactBeat),
      recoilFrame: recoilFrame(timelineBeats),
      driveFrame: frameFor(timelineBeats, "drive"),
      chamberFrame: frameFor(timelineBeats, "chamber"),
      extendFrame: frameFor(timelineBeats, "extend"),
      recoverFrame: frameFor(timelineBeats, "recover") || frameFor(beats, "recover"),
    };
  }

  function statusText(status = {}) {
    if (!status.active) return "Punch/kick motion status: no active punch/kick draft";
    const target = status.primaryImpactTarget ? `${status.primaryImpactTarget.key} ${status.primaryImpactTarget.x},${status.primaryImpactTarget.y}` : "none";
    const timing = compact([
      status.recoilFrame ? `${recoilLabel(status.actionType)} ${status.recoilFrame}` : null,
      status.driveFrame ? `drive ${status.driveFrame}` : null,
      status.chamberFrame ? `chamber ${status.chamberFrame}` : null,
      status.extendFrame ? `extend ${status.extendFrame}` : null,
      status.recoverFrame ? `recover ${status.recoverFrame}` : null,
    ]).join(" / ");
    return compact([
      `motion ${status.actionType}`,
      status.currentBeatId ? `beat ${status.currentBeatId}@${status.currentBeatFrame}` : null,
      `impact ${status.impactFrame}`,
      `primary ${status.primaryPartRole || "unknown"}:${status.primaryPartId || "none"}`,
      `body/root ${status.bodyRootAssistActive ? "active" : "inactive"}`,
      `hip anchor ${status.hipRootAnchorPresent ? "yes" : "no"}`,
      `target ${target}`,
      timing || null,
    ]).join(" · ");
  }

  function actionTypeFor(action = {}) {
    if (!action) return null;
    const template = action.actionTimeline?.template || action.actionTimeline?.id || "";
    if (template === "punch" || template === "kick") return template;
    const source = String(action.source || "");
    if (source.includes("punch")) return "punch";
    if (source.includes("kick")) return "kick";
    return null;
  }

  function currentBeatFor(beats = [], frame) {
    const current = Math.round(Number(frame) || 1);
    return beats.reduce((best, beat) => {
      const at = Math.round(Number(beat.at) || 1);
      if (at > current) return best;
      if (!best || at >= Math.round(Number(best.at) || 1)) return beat;
      return best;
    }, null) || beats[0] || null;
  }

  function bodyRootAssistActive(bridge, action) {
    return bridge.bodyAssistEnabled !== false && action.targetDebug?.chosenMotionScope !== "limb-only" && hipRootAnchorPresent(action.anchors);
  }

  function hipRootAnchorPresent(anchors = []) {
    return (Array.isArray(anchors) ? anchors : []).some((anchor) => anchor.key === "hip" && anchor.role === "root");
  }

  function primaryImpactTarget(action, impactBeat) {
    const key = action.focusKey;
    const point = key ? impactBeat?.pose?.[key] : null;
    if (!point) return null;
    return { key, x: Math.round(Number(point[0]) || 0), y: Math.round(Number(point[1]) || 0) };
  }

  function recoilFrame(beats = []) {
    const beat = beats.find((entry) => Number(entry.recoil) < 0);
    return beat?.at || null;
  }

  function recoilLabel(actionType) {
    return actionType === "punch" ? "windup" : "recoil";
  }

  function frameFor(beats = [], id) {
    return beatById(beats, id)?.at || null;
  }

  function beatById(beats = [], id) {
    return (Array.isArray(beats) ? beats : []).find((beat) => beat.id === id) || null;
  }

  function compact(values) {
    return values.filter((value) => value !== null && value !== undefined && value !== "");
  }

  Animotion.cutsceneMotionStatus = { statusForBridge, statusText };
  if (typeof module !== "undefined") module.exports = Animotion.cutsceneMotionStatus;
}
