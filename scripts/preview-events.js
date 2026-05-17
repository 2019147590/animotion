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
    const part = Animotion.parts.selectedPart();
    if (!part || !state.previewView) return;
    const point = previewPoint(event);
    if (!point) return;
    const role = hitRigRole(part, point) || selectedRole();
    const mode = dragMode(role);
    freezePlayback();
    state.previewDrag = { partId: part.id, role, mode, startPoint: point, basePoses: snapshotPoses() };
    els.pivotEditTarget.value = role;
    if (mode === "pose") updateControlPose(part.id, { x: 0, y: 0 });
    else moveRigPoint(part, point, role);
    previewCanvas.setPointerCapture(event.pointerId);
    event.preventDefault();
    Animotion.ui.refreshUi();
  }

  function onPreviewPointerMove(event) {
    if (!state.previewDrag || !state.previewView) return;
    const part = state.parts.find((candidate) => candidate.id === state.previewDrag.partId);
    const point = previewPoint(event);
    if (!part || !point) return;
    if (state.previewDrag.mode === "pose") updateControlPose(part.id, dragDelta(point));
    else moveRigPoint(part, point, state.previewDrag.role);
    event.preventDefault();
    Animotion.ui.refreshUi();
  }

  function onPreviewPointerUp(event) {
    if (previewCanvas.hasPointerCapture(event.pointerId)) {
      previewCanvas.releasePointerCapture(event.pointerId);
    }
    if (state.previewDrag?.mode === "pose") commitControlPose();
    state.previewDrag = null;
  }

  function updateControlPose(partId, delta) {
    const tracks = Animotion.poseAssist.solveControlPose(state.parts, partId, delta, state.previewDrag.basePoses);
    for (const track of tracks) {
      const part = state.parts.find((candidate) => candidate.id === track.partId);
      if (part) part.customMotion = track.pose;
    }
  }

  function commitControlPose() {
    for (const part of state.parts) {
      Animotion.timeline.upsertKeyframe(part, state.currentFrame, part.customMotion);
    }
  }

  function moveRigPoint(part, point, role) {
    const local = localPointForCurrentPose(part, point);
    const target = role === "joint" ? part.joint : part.pivot;
    const clamped = Animotion.rigging.localPointFromImagePoint(part.rect, local);
    target.x = clamped.x;
    target.y = clamped.y;
  }

  function localPointForCurrentPose(part, point) {
    const t = state.running ? (performance.now() - state.startTime) / 1000 : state.pausedTime;
    const matrix = Animotion.preview.worldMatrix(part, t, new Map());
    const localPoint = new DOMPoint(point.x, point.y).matrixTransform(matrix.inverse());
    return { x: localPoint.x, y: localPoint.y };
  }

  function hitRigRole(part, point) {
    const t = state.running ? (performance.now() - state.startTime) / 1000 : state.pausedTime;
    const matrix = Animotion.preview.worldMatrix(part, t, new Map());
    const tolerance = Animotion.config.hitTolerancePx / sourceScale();
    const hits = ["joint", "anchor"]
      .map((role) => ({ role, distance: geometry.distance(point, rigPoint(part, role, matrix)) }))
      .filter((hit) => hit.distance <= tolerance)
      .sort((a, b) => a.distance - b.distance);
    return hits[0]?.role || null;
  }

  function rigPoint(part, role, matrix) {
    const local = rigPointLocal(part, role);
    const point = new DOMPoint(part.rect.x + local.x, part.rect.y + local.y).matrixTransform(matrix);
    return { x: point.x, y: point.y };
  }

  function rigPointLocal(part, role) {
    if (role !== "joint") return part.pivot;
    const motion = Animotion.motionModel.normalizeCustomMotion(part.customMotion);
    if (!timelineLikeMode()) return part.joint;
    return { x: part.joint.x + motion.jointX, y: part.joint.y + motion.jointY };
  }

  function dragMode(role) {
    return role === "joint" && timelineLikeMode() ? "pose" : "rig";
  }

  function dragDelta(point) {
    return {
      x: point.x - state.previewDrag.startPoint.x,
      y: point.y - state.previewDrag.startPoint.y,
    };
  }

  function previewPoint(event) {
    const rect = previewCanvas.getBoundingClientRect();
    const screen = { x: event.clientX - rect.left, y: event.clientY - rect.top };
    const point = Animotion.previewTransform.screenPointToImage(
      screen,
      state.previewView,
      state.previewSourceFrame,
      state.previewSourceTransform
    );
    if (!point) return null;
    const bounds = Animotion.panelEditor?.imageBounds?.("source") || Animotion.imageBounds();
    return {
      x: geometry.clamp(point.x, 0, bounds.width),
      y: geometry.clamp(point.y, 0, bounds.height),
    };
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
    return els.pivotEditTarget.value === "joint" ? "joint" : "anchor";
  }

  function freezePlayback() {
    if (!state.running) return;
    state.pausedTime = (performance.now() - state.startTime) / 1000;
    state.running = false;
    els.playPause.textContent = "재생";
  }

  function timelineLikeMode() {
    return els.motionTemplate.value === "keyframes" || els.motionTemplate.value === "cutscene";
  }

  Animotion.previewEvents = { bindPreviewCanvasEvents };
}
