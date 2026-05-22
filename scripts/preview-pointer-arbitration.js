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
    let target = null;
    let handled = false;
    for (const candidate of rankedTargets(targets)) {
      target = candidate;
      if (!candidate || candidate.kind === "empty-preview-background") break;
      handled = beginTarget(event, candidate);
      if (handled) break;
    }
    recordDebug(target, targets);
    if (handled) {
      event.preventDefault();
      event.stopImmediatePropagation();
    }
    return { handled, target, targets };
  }

  function collectTargets(event) {
    const targets = [activeDragTarget(event)];
    targets.push(Animotion.previewEvents?.hitTarget?.(event) || null);
    targets.push(...activeModeTargets(event));
    targets.push(optionalTarget("selected-part-transform-handle", Animotion.partTransformEditor?.hitTarget?.(event)));
    targets.push(trajectoryTarget(event));
    targets.push(optionalTarget("part-body", Animotion.previewEvents?.partBodyTarget?.(event)));
    return targets.filter(Boolean).concat(emptyTarget());
  }

  function decideTarget(targets = []) {
    return rankedTargets(targets)[0] || null;
  }

  function rankedTargets(targets = []) {
    return [...targets].sort((a, b) => priorityOf(a.kind) - priorityOf(b.kind));
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
    const owner = activeDragOwner();
    if (!owner && !state.previewDrag && !state.trajectoryDrag) return null;
    if (!hasPointerCaptureFor(owner?.pointerId ?? event?.pointerId)) return null;
    const detail = owner?.kind || state.previewDrag?.kind || state.previewDrag?.mode || "trajectory";
    return { kind: "active-drag-session", label: "active drag", detail };
  }

  function hasPointerCaptureFor(pointerId) {
    const canvas = Animotion.dom?.previewCanvas;
    return Boolean(pointerId !== undefined && canvas?.hasPointerCapture?.(pointerId));
  }

  function activeModeTargets(event) {
    return [
      activeTarget("hiddenCompletionGuideEditor", "hidden completion guide", event),
      activeTarget("correspondenceEditor", "B cut reference picker", event),
      activeTarget("motionAnchorPicker", "motion anchor picker", event),
      activeTarget("motionPlanner", "motion target picker", event),
    ].filter(Boolean);
  }

  function activeTarget(editorKey, fallbackLabel, event) {
    const hit = Animotion[editorKey]?.hitTarget?.(event);
    return hit ? { kind: "active-mode-guide-point", editorKey, label: hit.label || fallbackLabel, hit, payload: hit } : null;
  }

  function trajectoryTarget(event) {
    if (Animotion.actionFrameEditor?.trajectoryReadOnly?.()) return null;
    const hit = Animotion.trajectoryEditor?.hitTarget?.(event);
    return hit ? { kind: "motion-trajectory-point", editorKey: "trajectoryEditor", label: hit.label || "motion trajectory", hit, payload: hit } : null;
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
      editorKey: target.editorKey || "",
      label: target.label || "",
      detail: target.detail || target.hit?.label || target.hit?.hit?.beat?.id || target.hit?.hit?.anchor?.key || target.hit?.beat?.id || target.hit?.anchor?.key || "",
    };
  }

  function setActiveDragOwner(editorKey, event, options = {}) {
    if (!Animotion.state || !editorKey) return null;
    if (editorKey === "trajectoryEditor") Animotion.state.previewDrag = null;
    else Animotion.state.trajectoryDrag = null;
    const owner = {
      editorKey,
      pointerId: event?.pointerId,
      kind: options.kind || editorKey,
      label: options.label || "",
    };
    Animotion.state.activePreviewDrag = owner;
    return owner;
  }

  function clearActiveDragOwner(owner = null) {
    if (!Animotion.state?.activePreviewDrag) return;
    if (owner && Animotion.state.activePreviewDrag.editorKey !== owner.editorKey) return;
    Animotion.state.activePreviewDrag = null;
  }

  function activeDragOwner() {
    return Animotion.state?.activePreviewDrag || null;
  }

  function handlePointerMove(event) {
    const owner = activeDragOwner();
    if (!owner) return false;
    if (!ownsPointer(owner, event) || !hasPointerCaptureFor(owner.pointerId)) return true;
    const handled = Animotion[owner.editorKey]?.updateDrag?.(event) === true;
    if (handled) event.preventDefault();
    return true;
  }

  function handlePointerUp(event) {
    const owner = activeDragOwner();
    if (!owner) return false;
    if (!ownsPointer(owner, event)) return true;
    const handled = Animotion[owner.editorKey]?.endDrag?.(event) === true;
    clearActiveDragOwner(owner);
    return handled || true;
  }

  function ownsPointer(owner, event) {
    return owner.pointerId === undefined || event?.pointerId === undefined || owner.pointerId === event.pointerId;
  }

  function activateExclusivePicker(editorKey) {
    deactivatePicker("correspondenceEditor", editorKey);
    deactivatePicker("motionAnchorPicker", editorKey);
    deactivatePicker("motionPlanner", editorKey);
    if (Animotion.state) Animotion.state.activePreviewPicker = editorKey || null;
  }

  function clearActivePicker(editorKey) {
    if (Animotion.state?.activePreviewPicker === editorKey) Animotion.state.activePreviewPicker = null;
  }

  function deactivatePicker(editorKey, activeEditorKey) {
    if (editorKey === activeEditorKey) return;
    if (editorKey === "motionPlanner") Animotion.motionPlanner?.setTargetMode?.(false, { skipExclusive: true, refresh: false });
    else Animotion[editorKey]?.setPickMode?.(false, { skipExclusive: true, refresh: false });
  }

  function debugEnabled() {
    try {
      return Boolean(Animotion.state?.debugPreviewPointerArbitration || global.localStorage?.debugPreviewPointerArbitration === "1");
    } catch (error) {
      return Boolean(Animotion.state?.debugPreviewPointerArbitration);
    }
  }

  Animotion.previewPointerArbitration = {
    PRIORITY_ORDER,
    collectTargets,
    decideTarget,
    beginPointerDown,
    setActiveDragOwner,
    clearActiveDragOwner,
    activeDragOwner,
    handlePointerMove,
    handlePointerUp,
    activateExclusivePicker,
    clearActivePicker,
  };
  if (typeof module !== "undefined") module.exports = Animotion.previewPointerArbitration;
}
