{
  const global = window;
  const Animotion = global.Animotion;
  const { previewCanvas, els } = Animotion.dom;
  const state = Animotion.state;
  const geometry = Animotion.geometry;

  function bindPreviewCanvasEvents() {
    previewCanvas.addEventListener("pointerdown", onPreviewPointerDown);
    previewCanvas.addEventListener("pointermove", onPreviewPointerMove);
    previewCanvas.addEventListener("pointerup", onPreviewPointerUp);
    previewCanvas.addEventListener("pointercancel", onPreviewPointerUp);
  }

  function onPreviewPointerDown(event) {
    const arbitration = Animotion.previewPointerArbitration?.beginPointerDown?.(event);
    if (arbitration) return;
    const target = hitTarget(event);
    if (target && beginDragFromTarget(event, target)) event.preventDefault();
  }

  function hitTarget(event) {
    const part = Animotion.parts.selectedPart();
    if (!part || !state.previewView) return null;
    const point = previewImagePoint(event);
    if (!point) return null;
    const hit = hitRigPoint(part, point);
    if (!hit || !editableRole(hit.role)) return null;
    return { kind: "selected-part-rigging-point", partId: part.id, role: hit.role, label: hit.label, hit };
  }

  function beginDragFromTarget(event, target) {
    const part = state.parts.find((candidate) => candidate.id === target.partId);
    if (!part) return false;
    state.selectedEditPoint = editPointSelection(part, target.role, target.label);
    const mode = dragMode(target.role);
    freezePlayback();
    if (mode === "pose") syncTimelinePosesToFrame();
    state.previewDrag = dragSession(event, part, target.role, mode, target.hit);
    els.pivotEditTarget.value = target.role === "joint" || target.role === "handTip" ? target.role : "anchor";
    if (mode === "pose") updateControlPose(part.id, { x: 0, y: 0 });
    previewCanvas.setPointerCapture(event.pointerId);
    Animotion.previewPointerArbitration?.setActiveDragOwner?.("previewEvents", event, { kind: mode, label: target.label });
    Animotion.ui.refreshUi();
    return true;
  }

  function onPreviewPointerMove(event) {
    if (Animotion.previewPointerArbitration?.handlePointerMove?.(event)) return;
    if (Animotion.hiddenCompletionGuideEditor?.updateDrag?.(event)) return;
    if (updateDrag(event)) return;
    updateHover(event);
  }

  function updateDrag(event) {
    if (!state.previewDrag || !state.previewView) return false;
    const part = state.parts.find((candidate) => candidate.id === state.previewDrag.partId);
    if (!part) return true;
    if (state.previewDrag.mode === "pose") {
      const delta = Animotion.previewCoordinate.dragImageDelta(state.previewDrag, previewPointer(event));
      if (!delta) return true;
      updateControlPose(part.id, delta);
    }
    else moveRigPoint(part, previewPointer(event));
    event.preventDefault();
    Animotion.ui.refreshUi();
    return true;
  }

  function onPreviewPointerUp(event) {
    if (Animotion.previewPointerArbitration?.handlePointerUp?.(event)) return;
    if (Animotion.hiddenCompletionGuideEditor?.endDrag?.(event)) return;
    endDrag(event);
  }

  function endDrag(event) {
    if (!state.previewDrag) return false;
    if (previewCanvas.hasPointerCapture(event.pointerId)) {
      previewCanvas.releasePointerCapture(event.pointerId);
    }
    if (state.previewDrag?.mode === "pose") commitControlPose();
    if (state.previewDrag?.mode === "rig") commitRigPointDrag();
    state.previewDrag = null;
    Animotion.previewPointerArbitration?.clearActiveDragOwner?.({ editorKey: "previewEvents" });
    return true;
  }

  function updateControlPose(partId, delta) {
    const tracks = Animotion.poseAssist.solveControlPose(state.parts, partId, delta, state.previewDrag.basePoses);
    for (const track of tracks) {
      const part = state.parts.find((candidate) => candidate.id === track.partId);
      if (part) Animotion.partCommands.updatePart(part, { customMotion: track.pose }, { recordHistory: false });
    }
  }

  function commitControlPose() {
    const before = state.previewDrag?.poseHistorySnapshot;
    for (const part of state.parts) {
      Animotion.motionCommands.insertKeyframe(part, state.currentFrame, part.customMotion, { recordHistory: false });
    }
    Animotion.poseDragHistory?.record?.(before, Animotion.poseDragHistory.snapshot(state.parts));
  }

  function syncTimelinePosesToFrame() {
    if (!timelineLikeMode()) return;
    for (const part of state.parts) {
      Animotion.motionCommands.syncPartPoseToFrame(part, state.currentFrame);
    }
  }

  function moveRigPoint(part, pointerPreviewPosition) {
    const local = Animotion.previewCoordinate.dragLocalPoint(state.previewDrag, pointerPreviewPosition);
    if (!local) return;
    const key = pointField(state.previewDrag.draggedPointKind);
    part[key] = local;
    if (key === "pivot") part.rotationPivot = local;
  }

  function frozenPartMatrix(part) {
    const t = Animotion.playbackSpeed.playbackSeconds(state, performance.now());
    return Animotion.preview.worldMatrix(part, t, new Map());
  }

  function dragSession(event, part, role, mode, hit) {
    const pointer = previewPointer(event);
    const partMatrix = frozenPartMatrix(part);
    const base = dragContext(part, partMatrix);
    const startPointLocal = Animotion.previewRigPoints.localPoint(part, hit || { role, localPoint: pointLocal(part, role) }, { timelineLike: timelineLikeMode() });
    const pointerLocal = Animotion.previewCoordinate.previewToPartLocalPoint(pointer, base);
    return {
      draggedPointId: `${part.id}:${role}`,
      draggedPointKind: role,
      sourcePartId: part.id,
      partId: part.id,
      role,
      mode,
      coordinateSpace: "part-local",
      startPointerPreviewPosition: pointer,
      startPointerLocalPosition: { ...(pointerLocal || startPointLocal) },
      startPointerImagePosition: previewImagePoint(event),
      startPoint: previewImagePoint(event),
      startPointLocalPosition: { ...startPointLocal },
      startPointNormalizedPosition: Animotion.previewCoordinate.partLocalToNormalizedPoint(startPointLocal, part),
      grabOffset: {
        x: (pointerLocal || startPointLocal).x - startPointLocal.x,
        y: (pointerLocal || startPointLocal).y - startPointLocal.y,
      },
      basePoses: snapshotPoses(),
      poseHistorySnapshot: mode === "pose" ? Animotion.poseDragHistory?.snapshot?.(state.parts) : null,
      ...base,
    };
  }

  function dragContext(part, partMatrix) {
    return {
      part,
      partMatrix,
      view: state.previewView,
      sourceFrame: state.previewSourceFrame,
      sourceTransform: state.previewSourceTransform,
    };
  }

  function commitRigPointDrag() {
    const drag = state.previewDrag;
    const part = state.parts.find((candidate) => candidate.id === drag.partId);
    if (!part) return;
    const key = pointField(drag.draggedPointKind);
    const finalPoint = { ...part[key] };
    part[key] = { ...drag.startPointLocalPosition };
    if (key === "pivot") part.rotationPivot = part[key];
    Animotion.partCommands.updatePart(part, { [key]: finalPoint });
  }

  function updateHover(event) {
    if (!state.previewView) return;
    const part = Animotion.parts.selectedPart();
    const point = part ? previewImagePoint(event) : null;
    const hit = point ? hitRigPoint(part, point) : null;
    const hadHover = Boolean(state.hoveredEditPoint);
    state.hoveredEditPoint = hit ? editPointSelection(part, hit.role, hit.label) : null;
    if (hit || hadHover) Animotion.ui.refreshUi();
  }

  function hitRigPoint(part, point) {
    const matrix = frozenPartMatrix(part);
    const tolerance = Animotion.config.hitTolerancePx / sourceScale();
    const hits = rigPointSpecs(part)
      .map((spec) => ({ ...spec, distance: geometry.distance(point, rigPointImagePoint(part, spec, matrix)) }))
      .filter((hit) => hit.distance <= tolerance);
    const sorted = Animotion.previewHitTest?.sortRigPointHits?.(hits) || hits.sort((a, b) => a.distance - b.distance);
    return sorted[0] || null;
  }

  function rigPointImagePoint(part, spec, matrix) {
    return Animotion.previewRigPoints.imagePoint(part, spec, matrix, { timelineLike: timelineLikeMode() });
  }

  function rigPointSpecs(part) {
    const parent = parentPart(part);
    return Animotion.rigConnection?.previewPoints?.(part, parent) || [
      { role: "rotationPivot", localPoint: part.pivot, label: "회전 중심" },
      { role: "joint", localPoint: part.joint, label: "관절점" },
    ];
  }

  function parentPart(part) {
    const parentId = Animotion.rigConnection?.parentIdFor?.(part);
    return state.parts.find((candidate) => candidate.id === parentId) || null;
  }

  function editableRole(role) {
    return role === "joint" || role === "rotationPivot" || role === "anchor" || role === "handTip";
  }

  function editPointSelection(part, role, label) {
    const info = Animotion.previewPointInfo?.rigPointInfo?.(part, role, { parts: state.parts, bridge: state.cutsceneBridge, selectedPartId: state.selectedPartId }) || {};
    return {
      kind: role,
      role: info.role || Animotion.rigConnection?.labelForRole?.(role) || label || "편집점",
      label: info.label || label || "",
      detail: info.detail || "",
      participatesInTrajectory: Boolean(info.participatesInTrajectory),
      trajectoryRole: info.trajectoryRole || null,
    };
  }

  function dragMode(role) {
    if (Animotion.actionFrameEditor?.isEditingActionFrame?.() && actionFramePoseRole(role) && timelineLikeMode()) return "pose";
    return role === "joint" && timelineLikeMode() ? "pose" : "rig";
  }

  function actionFramePoseRole(role) {
    return role === "joint" || role === "handTip";
  }

  function previewImagePoint(event) {
    if (!state.previewView || !state.previewSourceFrame) return null;
    return Animotion.previewCoordinate.previewToImagePoint(previewPointer(event), dragContext(null, null));
  }

  function sourceScale() {
    return Animotion.previewTransform.sourceScale(state.previewView, state.previewSourceFrame, state.previewSourceTransform);
  }

  function snapshotPoses() {
    return Object.fromEntries(state.parts.map((part) => [
      part.id,
      Animotion.motionModel.normalizeCustomMotion(part.customMotion),
    ]));
  }

  function selectedRole() {
    return els.pivotEditTarget.value === "joint" ? "joint" : "rotationPivot";
  }

  function pointField(role) {
    if (role === "joint") return "joint";
    if (role === "handTip") return "handTip";
    return "pivot";
  }

  function pointLocal(part, role) {
    const fallback = role === "handTip" ? Animotion.rigging?.handTipForPart?.(part) || part.handTip || part.joint : part.pivot;
    return Animotion.previewRigPoints.localPoint(part, { role, localPoint: fallback }, { timelineLike: timelineLikeMode() });
  }

  function previewPointer(event) {
    return Animotion.previewCoordinate.clientToPreviewPoint(event, previewCanvas);
  }

  function freezePlayback() {
    if (!state.running) return;
    Animotion.playbackSpeed.pauseAtNow(state);
    els.playPause.textContent = "재생";
  }

  function timelineLikeMode() {
    return els.motionTemplate.value === "keyframes" || els.motionTemplate.value === "cutscene";
  }

  Animotion.previewEvents = { bindPreviewCanvasEvents, hitTarget, beginDragFromTarget, updateDrag, endDrag };
}
