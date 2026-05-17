{
  const global = typeof window !== "undefined" ? window : globalThis;
  const Animotion = global.Animotion || (global.Animotion = {});
  const HANDLE_RADIUS = 6;

  function install() {
    if (typeof document === "undefined" || !Animotion.dom?.previewCanvas) return;
    const canvas = Animotion.dom.previewCanvas;
    canvas.addEventListener("pointerdown", onPointerDown, true);
    canvas.addEventListener("pointermove", onPointerMove);
    canvas.addEventListener("pointerup", onPointerUp);
    canvas.addEventListener("pointercancel", onPointerUp);
    Animotion.motionPlanner.drawOverlay = drawOverlay;
  }

  function onPointerDown(event) {
    const anchorHit = hitAnchor(event);
    if (anchorHit) return beginAnchorDrag(event, anchorHit);
    const hit = hitBeat(event);
    if (!hit) return;
    freezePlayback();
    currentPlan().selectedBeatId = hit.beat.id;
    Animotion.state.trajectoryDrag = { beatIndex: hit.index, focusKey: hit.focusKey };
    Animotion.timelineControls?.setCurrentFrame?.(hit.beat.at);
    Animotion.dom.previewCanvas.setPointerCapture(event.pointerId);
    event.preventDefault();
    event.stopImmediatePropagation();
    refresh();
  }

  function onPointerMove(event) {
    const drag = Animotion.state?.trajectoryDrag;
    if (!drag || !Animotion.state.previewView) return;
    const point = previewPoint(event);
    if (!point) return;
    if (drag.anchorKey && editAnchorPoint(currentAction(), drag.anchorKey, point)) regenerateActionFromAnchors();
    else if (editBeatPoint(currentAction(), drag.beatIndex, drag.focusKey, point)) regeneratePrimaryTrack();
    event.preventDefault();
    refresh();
  }

  function onPointerUp(event) {
    const canvas = Animotion.dom?.previewCanvas;
    if (canvas?.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
    if (!Animotion.state?.trajectoryDrag) return;
    Animotion.state.trajectoryDrag = null;
    refresh();
  }

  function drawOverlay(ctx, view, cutscene) {
    if (!editingLayerVisible()) return;
    const action = cutscene?.bridge?.jointAction;
    const focusKey = action?.focusKey || "hip";
    const points = focusPoints(action, focusKey);
    if (points.length >= 2 && cutscene?.active) drawTrajectory(ctx, view, points, cutscene.values.n);
    drawBeatHandles(ctx, view, action, focusKey);
    drawActionAnchors(ctx, view, action);
    drawTarget(ctx, view);
  }

  function beginAnchorDrag(event, hit) {
    freezePlayback();
    currentPlan().selectedBeatId = null;
    Animotion.state.trajectoryDrag = { anchorKey: hit.anchor.key };
    Animotion.dom.previewCanvas.setPointerCapture(event.pointerId);
    event.preventDefault();
    event.stopImmediatePropagation();
    refresh();
  }

  function drawBeatHandles(ctx, view, action, focusKey) {
    if (!action?.beats?.length || Animotion.state.exporting) return;
    const selectedId = currentPlan().selectedBeatId;
    ctx.save();
    ctx.lineWidth = 2;
    for (const beat of action.beats) {
      const point = pointFrom(beat.pose?.[focusKey]);
      if (!point) continue;
      const selected = beat.id === selectedId;
      const screen = imagePointToScreen(point, view);
      ctx.fillStyle = selected ? "#e1462e" : "#fffaf0";
      ctx.strokeStyle = selected ? "#fffaf0" : "#e1462e";
      ctx.beginPath();
      ctx.arc(screen.x, screen.y, selected ? 8 : HANDLE_RADIUS, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawTarget(ctx, view) {
    const target = currentPlan().target;
    if (!target) return;
    ctx.save();
    ctx.strokeStyle = "#e1462e";
    ctx.fillStyle = "#fffaf0";
    ctx.lineWidth = 3;
    const screen = imagePointToScreen(target, view);
    ctx.beginPath();
    ctx.arc(screen.x, screen.y, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  function drawActionAnchors(ctx, view, action) {
    if (!action?.anchors?.length || Animotion.state.exporting) return;
    ctx.save();
    ctx.lineWidth = 2;
    for (const anchor of action.anchors) {
      const point = pointFrom(anchor.point);
      if (!point) continue;
      const screen = imagePointToScreen(point, view);
      ctx.fillStyle = anchor.locked ? "#e1462e" : "#8fd3ff";
      ctx.strokeStyle = "#151515";
      ctx.beginPath();
      ctx.rect(screen.x - 4, screen.y - 4, 8, 8);
      ctx.fill();
      ctx.stroke();
    }
    ctx.restore();
  }

  function hitBeat(event) {
    const state = Animotion.state;
    if (!isCutsceneEditable() || !state.previewView) return null;
    const point = previewPoint(event);
    const action = currentAction();
    const focusKey = action?.focusKey || "hip";
    if (!point || !action?.beats?.length) return null;
    const tolerance = Animotion.config.hitTolerancePx / sourceScale();
    return action.beats
      .map((beat, index) => ({ beat, index, focusKey, distance: pointDistance(point, pointFrom(beat.pose?.[focusKey])) }))
      .filter((hit) => hit.distance <= tolerance)
      .sort((a, b) => a.distance - b.distance)[0] || null;
  }

  function hitAnchor(event) {
    const state = Animotion.state;
    if (!isCutsceneEditable() || !state.previewView) return null;
    const point = previewPoint(event);
    const action = currentAction();
    if (!point || !action?.anchors?.length) return null;
    const tolerance = Animotion.config.hitTolerancePx / sourceScale();
    return action.anchors
      .map((anchor) => ({ anchor, distance: pointDistance(point, pointFrom(anchor.point)) }))
      .filter((hit) => hit.distance <= tolerance)
      .sort((a, b) => a.distance - b.distance)[0] || null;
  }

  function editBeatPoint(action, beatIndex, focusKey, point) {
    const beat = action?.beats?.[beatIndex];
    if (!beat?.pose || !focusKey || !point) return false;
    beat.pose[focusKey] = [Math.round(Number(point.x) || 0), Math.round(Number(point.y) || 0)];
    return true;
  }

  function editAnchorPoint(action, anchorKey, point) {
    const anchor = action?.anchors?.find((candidate) => candidate.key === anchorKey);
    if (!anchor || !point) return false;
    anchor.point = { x: Math.round(Number(point.x) || 0), y: Math.round(Number(point.y) || 0) };
    return true;
  }

  function regenerateActionFromAnchors() {
    const state = Animotion.state;
    const bridge = Animotion.cutsceneModel.normalizeBridge(state.cutsceneBridge);
    const primaryId = bridge.primaryPartId || state.selectedPartId;
    const plan = { ...currentPlan(), anchors: currentAction()?.anchors || [] };
    const primary = plan.anchors.find((anchor) => anchor.key === bridge.jointAction?.focusKey && anchor.role === "primary");
    if (primary?.point) plan.target = { ...primary.point };
    const result = Animotion.motionPlanner.createPlan(state.parts, primaryId, bridge, plan);
    state.cutsceneBridge = { ...bridge, jointAction: result.jointAction };
    state.motionPlan = { ...plan, target: result.target, anchors: result.anchors };
    applyPartTracks(result.partTracks);
    syncSelectedPartPose();
  }

  function regeneratePrimaryTrack() {
    const state = Animotion.state;
    const bridge = Animotion.cutsceneModel.normalizeBridge(state.cutsceneBridge);
    const primaryId = bridge.primaryPartId || state.selectedPartId;
    const track = Animotion.motionPlanner
      .tracksForJointAction(state.parts, primaryId, bridge)
      .find((candidate) => candidate.partId === primaryId);
    const part = state.parts.find((candidate) => candidate.id === primaryId);
    if (!part || !track) return;
    part.keyframes = track.keyframes;
    part.customMotion = Animotion.timeline.evaluatePartAtFrame(part, state.currentFrame);
  }

  function applyPartTracks(tracks) {
    for (const track of tracks || []) {
      const part = Animotion.state.parts.find((candidate) => candidate.id === track.partId);
      if (part) part.keyframes = track.keyframes;
    }
  }

  function syncSelectedPartPose() {
    const part = Animotion.parts?.selectedPart?.();
    if (part) part.customMotion = Animotion.timeline.evaluatePartAtFrame(part, Animotion.state.currentFrame);
  }

  function currentAction() {
    return Animotion.state?.cutsceneBridge?.jointAction || null;
  }

  function currentPlan() {
    Animotion.state.motionPlan = Animotion.motionPlanner.normalizePlan(Animotion.state.motionPlan);
    return Animotion.state.motionPlan;
  }

  function focusPoints(action, focusKey) {
    return (action?.beats || []).map((beat) => beat.pose?.[focusKey]).filter(Boolean);
  }

  function drawTrajectory(ctx, view, points, progress) {
    ctx.save();
    ctx.globalAlpha = 0.24;
    ctx.strokeStyle = "#811515";
    ctx.lineWidth = 3;
    ctx.setLineDash([12, 14]);
    ctx.beginPath();
    points.forEach((point, index) => {
      const screen = imagePointToScreen(pointFrom(point), view);
      if (index === 0) ctx.moveTo(screen.x, screen.y);
      else ctx.lineTo(screen.x, screen.y);
    });
    ctx.stroke();
    ctx.setLineDash([]);
    drawTrajectoryMarker(ctx, view, points, progress);
    ctx.restore();
  }

  function drawTrajectoryMarker(ctx, view, points, progress) {
    const index = Math.min(points.length - 1, Math.floor(progress * (points.length - 1)));
    const screen = imagePointToScreen(pointFrom(points[index]), view);
    ctx.globalAlpha = 0.85;
    ctx.fillStyle = "#c32222";
    ctx.beginPath();
    ctx.arc(screen.x, screen.y, 5, 0, Math.PI * 2);
    ctx.fill();
  }

  function previewPoint(event) {
    const rect = Animotion.dom.previewCanvas.getBoundingClientRect();
    return Animotion.previewTransform.screenPointToImage(
      { x: event.clientX - rect.left, y: event.clientY - rect.top },
      Animotion.state.previewView,
      Animotion.state.previewSourceFrame,
      Animotion.state.previewSourceTransform
    );
  }

  function imagePointToScreen(point, view) {
    return Animotion.previewTransform.imagePointToScreen(point, view, Animotion.state.previewSourceFrame, Animotion.state.previewSourceTransform);
  }

  function sourceScale() {
    return Animotion.previewTransform.sourceScale(Animotion.state.previewView, Animotion.state.previewSourceFrame, Animotion.state.previewSourceTransform);
  }

  function pointFrom(point) {
    if (!point) return null;
    return { x: Number(point.x ?? point[0]) || 0, y: Number(point.y ?? point[1]) || 0 };
  }

  function pointDistance(a, b) {
    if (!a || !b) return Infinity;
    return Math.hypot(a.x - b.x, a.y - b.y);
  }

  function isCutsceneEditable() {
    return Animotion.dom?.els?.motionTemplate?.value === "cutscene" && Boolean(currentAction());
  }

  function editingLayerVisible() {
    const state = Animotion.state;
    return !state.running && !state.exporting;
  }

  function freezePlayback() {
    const state = Animotion.state;
    if (!state.running) return;
    state.pausedTime = (performance.now() - state.startTime) / 1000;
    state.running = false;
    Animotion.dom.els.playPause.textContent = "재생";
  }

  function refresh() {
    Animotion.ui?.refreshUi?.();
  }

  Animotion.trajectoryEditor = { drawOverlay, editBeatPoint, editAnchorPoint };
  install();

  if (typeof module !== "undefined") module.exports = Animotion.trajectoryEditor;
}
