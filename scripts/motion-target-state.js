{
  const global = typeof window !== "undefined" ? window : globalThis;
  const Animotion = global.Animotion || (global.Animotion = {});
  const SOURCES = new Set(["manual", "correspondence", "generated"]);

  function normalizeTargetState(plan = {}, bounds = null) {
    const target = pointFrom(plan.target, bounds);
    const source = normalizeSource(plan.targetSource?.type, target);
    const manual = targetObject(plan.manualMotionTarget, "manual", bounds)
      || (source === "manual" ? targetObject({ ...plan.targetSource, point: target }, "manual", bounds) : null);
    const correspondence = targetObject(plan.correspondenceAnchor, "correspondence", bounds);
    const active = targetObject(plan.activeMotionTarget, source, bounds)
      || (target ? targetObject({ ...plan.targetSource, point: target }, source, bounds) : null);
    return {
      manualMotionTarget: manual,
      correspondenceAnchor: correspondence,
      activeMotionTarget: active,
      characterRootAnchor: targetObject(plan.characterRootAnchor, "generated", bounds),
      trajectoryPoints: normalizeTrajectoryPoints(plan.trajectoryPoints, bounds),
    };
  }

  function manualTargetPatch(point) {
    const target = roundedPoint(point);
    const active = targetObject({ point: target, source: "manual" }, "manual");
    return { target, anchors: [], targetMode: false, targetSource: { type: "manual" }, manualMotionTarget: active, activeMotionTarget: active };
  }

  function correspondenceAnchorPatch(draft) {
    const anchor = correspondenceTarget(draft);
    return {
      correspondenceAnchor: anchor,
      ...(isReferenceTarget(draft) ? { characterRootAnchor: { ...anchor, role: "reference" } } : {}),
    };
  }

  function correspondenceTargetPatch(draft) {
    const active = correspondenceTarget(draft);
    return {
      ...correspondenceAnchorPatch(draft),
      target: active.point,
      anchors: draft.anchors || [],
      targetMode: false,
      motionHints: draft.motionHints,
      targetDebug: draft.targetDebug,
      targetSource: {
        type: "correspondence",
        correspondenceId: draft.correspondenceId,
        targetPartType: draft.targetPartType,
        coordinateSpace: draft.targetCoordinateSpace,
      },
      activeMotionTarget: active,
    };
  }

  function clearManualTargetPatch(plan = {}) {
    const active = plan.activeMotionTarget?.source === "manual" || plan.targetSource?.type === "manual";
    return {
      manualMotionTarget: null,
      ...(active ? { target: null, targetSource: null, activeMotionTarget: null, anchors: [] } : {}),
    };
  }

  function statusText(plan = {}) {
    const active = plan.activeMotionTarget;
    if (!active && plan.correspondenceAnchor) return "B correspondence is saved but not driving motion.";
    if (active?.source === "manual" && plan.correspondenceAnchor) return "Manual target is active. B correspondence is saved but not driving motion.";
    if (active?.source) return `Active motion target: ${active.source}`;
    return "No active motion target.";
  }

  function trajectorySamples(beats = [], focusKey = "hip") {
    return beats.map((beat) => pointFrom(beat.pose?.[focusKey])).filter(Boolean)
      .map((point, index) => ({ id: `sample-${index}`, kind: "sample", editable: false, point }));
  }

  function correspondenceTarget(draft = {}) {
    return targetObject({
      point: draft.target,
      source: "correspondence",
      correspondenceId: draft.correspondenceId,
      targetPartType: draft.targetPartType,
      coordinateSpace: draft.targetCoordinateSpace,
      role: isReferenceTarget(draft) ? "reference" : "attack",
    }, "correspondence");
  }

  function isReferenceTarget(draft = {}) {
    return ["chest", "hip", "head"].includes(draft.targetPartType);
  }

  function targetObject(input, fallbackSource, bounds = null) {
    const point = pointFrom(input?.point || input, bounds);
    if (!point) return null;
    const source = normalizeSource(input?.source || fallbackSource, point);
    return {
      point,
      source,
      ...(input?.correspondenceId ? { correspondenceId: String(input.correspondenceId) } : {}),
      ...(input?.targetPartType ? { targetPartType: String(input.targetPartType) } : {}),
      ...(input?.coordinateSpace ? { coordinateSpace: String(input.coordinateSpace) } : { coordinateSpace: "sourceImage" }),
      ...(input?.role ? { role: String(input.role) } : {}),
    };
  }

  function normalizeTrajectoryPoints(points = [], bounds = null) {
    return (Array.isArray(points) ? points : []).map((point, index) => {
      const normalized = pointFrom(point.point || point, bounds);
      if (!normalized) return null;
      const kind = point.kind === "anchor" || point.kind === "control" ? point.kind : "sample";
      return { id: String(point.id || `${kind}-${index}`), kind, editable: kind !== "sample", point: normalized };
    }).filter(Boolean);
  }

  function pointFrom(point, bounds = null) {
    const restored = Animotion.coordinateSpaces?.pointFromNormalizedImagePoint?.(point?.pointNormalized || point?.normalized, bounds);
    if (restored) return roundedPoint(restored);
    if (!point) return null;
    const x = Number(point.x ?? point[0]);
    const y = Number(point.y ?? point[1]);
    return Number.isFinite(x) && Number.isFinite(y) ? { x: Math.round(x), y: Math.round(y) } : null;
  }

  function roundedPoint(point) {
    return point ? { x: Math.round(Number(point.x) || 0), y: Math.round(Number(point.y) || 0) } : null;
  }

  function normalizeSource(source, target) {
    if (!target) return null;
    return SOURCES.has(source) ? String(source) : "manual";
  }

  Animotion.motionTargetState = {
    normalizeTargetState,
    manualTargetPatch,
    correspondenceAnchorPatch,
    correspondenceTargetPatch,
    clearManualTargetPatch,
    statusText,
    trajectorySamples,
    isReferenceTarget,
  };
  if (typeof module !== "undefined") module.exports = Animotion.motionTargetState;
}
