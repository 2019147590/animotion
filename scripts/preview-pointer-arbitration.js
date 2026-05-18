{
  const global = typeof window !== "undefined" ? window : globalThis;
  const Animotion = global.Animotion || (global.Animotion = {});
  const PRIORITY_ORDER = [
    "active-drag-session",
    "selected-part-rigging-point",
    "active-mode-guide-point",
    "selected-part-transform-handle",
    "motion-trajectory-point",
    "part-body",
    "empty-preview-background",
  ];

  function beginPointerDown(event) {
    const targets = collectTargets(event);
    const target = decideTarget(targets);
    recordDebug(target, targets);
    if (!target || target.kind === "empty-preview-background") return { handled: false, target, targets };
    const handled = beginTarget(event, target);
    if (handled) {
      event.preventDefault();
      event.stopImmediatePropagation();
    }
    return { handled, target, targets };
  }

  function collectTargets(event) {
    const targets = [activeDragTarget(event)];
    targets.push(Animotion.previewEvents?.hitTarget?.(event) || null);
    targets.push(activeModeTarget(event));
    targets.push(optionalTarget("selected-part-transform-handle", Animotion.partTransformEditor?.hitTarget?.(event)));
    targets.push(trajectoryTarget(event));
    targets.push(optionalTarget("part-body", Animotion.previewEvents?.partBodyTarget?.(event)));
    return targets.filter(Boolean).concat(emptyTarget());
  }

  function decideTarget(targets = []) {
    return [...targets].sort((a, b) => priorityOf(a.kind) - priorityOf(b.kind))[0] || null;
  }

  function beginTarget(event, target) {
    if (target.kind === "active-drag-session") return true;
    if (target.kind === "selected-part-rigging-point") return Animotion.previewEvents?.beginDragFromTarget?.(event, target) === true;
    if (target.kind === "active-mode-guide-point") return Animotion[target.editorKey]?.beginDragFromTarget?.(event, target) === true;
    if (target.kind === "motion-trajectory-point") return Animotion.trajectoryEditor?.beginDragFromTarget?.(event, target) === true;
    if (target.kind === "selected-part-transform-handle") return Animotion.partTransformEditor?.beginDragFromTarget?.(event, target) === true;
    return false;
  }

  function activeDragTarget(event) {
    const state = Animotion.state || {};
    if (!state.previewDrag && !state.trajectoryDrag) return null;
    if (!hasActivePointerCapture(event)) {
      state.previewDrag = null;
      state.trajectoryDrag = null;
      return null;
    }
    return { kind: "active-drag-session", label: "active drag", detail: state.previewDrag?.kind || state.previewDrag?.mode || "trajectory" };
  }

  function hasActivePointerCapture(event) {
    const canvas = Animotion.dom?.previewCanvas;
    return Boolean(event?.pointerId !== undefined && canvas?.hasPointerCapture?.(event.pointerId));
  }

  function activeModeTarget(event) {
    return activeTarget("hiddenCompletionGuideEditor", "hidden completion guide", event)
      || activeTarget("correspondenceEditor", "B cut reference picker", event)
      || activeTarget("motionAnchorPicker", "motion anchor picker", event)
      || activeTarget("motionPlanner", "motion target picker", event);
  }

  function activeTarget(editorKey, fallbackLabel, event) {
    const hit = Animotion[editorKey]?.hitTarget?.(event);
    return hit ? { kind: "active-mode-guide-point", editorKey, label: hit.label || fallbackLabel, hit } : null;
  }

  function trajectoryTarget(event) {
    const hit = Animotion.trajectoryEditor?.hitTarget?.(event);
    return hit ? { kind: "motion-trajectory-point", label: hit.label || "motion trajectory", hit } : null;
  }

  function optionalTarget(kind, target) {
    return target ? { ...target, kind } : null;
  }

  function emptyTarget() {
    return { kind: "empty-preview-background", label: "empty preview background" };
  }

  function priorityOf(kind) {
    const index = PRIORITY_ORDER.indexOf(kind);
    return index >= 0 ? index : PRIORITY_ORDER.length;
  }

  function recordDebug(selected, targets) {
    const debug = {
      selected: selected ? debugTarget(selected) : null,
      candidates: targets.map(debugTarget),
      priorityOrder: PRIORITY_ORDER,
    };
    if (Animotion.state) Animotion.state.previewPointerArbitrationDebug = debug;
    if (debugEnabled()) console.debug("[Animotion] preview pointer target", debug);
  }

  function debugTarget(target) {
    return {
      kind: target.kind,
      label: target.label || "",
      detail: target.detail || target.hit?.label || target.hit?.beat?.id || target.hit?.anchor?.key || "",
    };
  }

  function debugEnabled() {
    try {
      return Boolean(Animotion.state?.debugPreviewPointerArbitration || global.localStorage?.debugPreviewPointerArbitration === "1");
    } catch (error) {
      return Boolean(Animotion.state?.debugPreviewPointerArbitration);
    }
  }

  Animotion.previewPointerArbitration = { PRIORITY_ORDER, collectTargets, decideTarget, beginPointerDown };
  if (typeof module !== "undefined") module.exports = Animotion.previewPointerArbitration;
}
