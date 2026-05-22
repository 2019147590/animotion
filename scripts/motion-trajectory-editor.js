{
  const global = typeof window !== "undefined" ? window : globalThis;
  const Animotion = global.Animotion || (global.Animotion = {});
  const HANDLE_RADIUS = 6;
  function install() {
    if (typeof document === "undefined" || !Animotion.dom?.previewCanvas) return;
    const canvas = Animotion.dom.previewCanvas;
    canvas.addEventListener("pointermove", onPointerMove);
    canvas.addEventListener("pointerup", onPointerUp);
    canvas.addEventListener("pointercancel", onPointerUp);
    Animotion.motionPlanner.drawOverlay = drawOverlay;
  }
  function hitTarget(event) {
    const anchorHit = hitAnchor(event);
    if (anchorHit) return { type: "anchor", label: anchorSelection(anchorHit.anchor).label, hit: anchorHit };
    const hit = hitBeat(event);
    return hit ? { type: "beat", label: beatSelection(hit.beat, hit.focusKey).label, hit } : null;
  }
  function beginDragFromTarget(event, target) {
    const hit = target?.payload || target?.hit || target;
    if (hit?.type === "anchor") return beginAnchorDrag(event, hit.hit);
    if (hit?.type === "beat") return beginBeatDrag(event, hit.hit);
    return false;
  }
  function beginBeatDrag(event, hit) {
    freezePlayback();
    Animotion.motionCommands.setMotionPlan({ selectedBeatId: hit.beat.id });
    Animotion.state.selectedEditPoint = beatSelection(hit.beat, hit.focusKey);
    Animotion.state.trajectoryDrag = { beatIndex: hit.index, focusKey: hit.focusKey };
    Animotion.timelineControls?.setCurrentFrame?.(hit.beat.at);
    Animotion.dom.previewCanvas.setPointerCapture(event.pointerId);
    Animotion.previewPointerArbitration?.setActiveDragOwner?.("trajectoryEditor", event, { kind: "trajectory", label: hit.beat.id });
    refresh();
    return true;
  }
  function onPointerMove(event) {
    if (Animotion.previewPointerArbitration?.activeDragOwner?.()?.editorKey === "trajectoryEditor") return;
    updateDrag(event);
  }
  function updateDrag(event) {
    const drag = Animotion.state?.trajectoryDrag;
    if (!drag || !Animotion.state.previewView) return false;
    const point = previewPoint(event);
    if (!point) return true;
    if (drag.anchorKey && editAnchorPoint(currentAction(), drag.anchorKey, point)) regenerateActionFromAnchors();
    else if (editBeatPoint(currentAction(), drag.beatIndex, drag.focusKey, point)) regenerateActionTracks();
    event.preventDefault();
    refresh();
    return true;
  }
  function onPointerUp(event) {
    if (Animotion.previewPointerArbitration?.activeDragOwner?.()?.editorKey === "trajectoryEditor") return;
    endDrag(event);
  }
  function endDrag(event) {
    const canvas = Animotion.dom?.previewCanvas;
    if (canvas?.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
    if (!Animotion.state?.trajectoryDrag) return false;
    Animotion.state.trajectoryDrag = null;
    Animotion.previewPointerArbitration?.clearActiveDragOwner?.({ editorKey: "trajectoryEditor" });
    refresh();
    return true;
  }
  function drawOverlay(ctx, view, cutscene) {
    if (!editingLayerVisible()) return;
    const action = cutscene?.bridge?.jointAction;
    const tracks = trajectoryTracks(action);
    if (cutscene?.active) for (const track of tracks) if (track.samples.length >= 2) drawTrajectory(ctx, view, track.samples.map((sample) => sample.point), cutscene.values.n, track.key);
    drawBeatHandles(ctx, view, action, tracks);
    drawActionAnchors(ctx, view, action);
    Animotion.motionPathExplainer?.drawOverlay?.(ctx, view, cutscene);
    drawTarget(ctx, view);
  }
  function beginAnchorDrag(event, hit) {
    freezePlayback();
    Animotion.motionCommands.setMotionPlan({ selectedBeatId: null });
    Animotion.state.selectedEditPoint = anchorSelection(hit.anchor);
    Animotion.state.trajectoryDrag = { anchorKey: hit.anchor.key };
    Animotion.dom.previewCanvas.setPointerCapture(event.pointerId);
    Animotion.previewPointerArbitration?.setActiveDragOwner?.("trajectoryEditor", event, { kind: "trajectory-anchor", label: hit.anchor.key });
    refresh();
    return true;
  }
  function drawBeatHandles(ctx, view, action, tracks) {
    if (!action?.beats?.length || Animotion.state.exporting) return;
    const selectedId = currentPlan().selectedBeatId;
    ctx.save();
    ctx.lineWidth = 2;
    for (const track of tracks) {
      for (const beat of action.beats) {
        const point = pointFrom(beat.pose?.[track.key]);
        if (!point) continue;
        const selected = beat.id === selectedId;
        const screen = imagePointToScreen(point, view);
        ctx.fillStyle = selected ? colorForKey(track.key) : "#fffaf0";
        ctx.strokeStyle = selected ? "#fffaf0" : colorForKey(track.key);
        ctx.beginPath();
        ctx.arc(screen.x, screen.y, selected ? 8 : HANDLE_RADIUS, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }
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
    if (!point || !action?.beats?.length) return null;
    const tolerance = Animotion.config.hitTolerancePx / sourceScale();
    return action.beats.flatMap((beat, index) => trajectoryKeys(action)
      .map((focusKey) => ({ beat, index, focusKey, distance: pointDistance(point, pointFrom(beat.pose?.[focusKey])) })))
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
    beat.poseNormalized = { ...(beat.poseNormalized || {}), [focusKey]: normalizedPoint(beat.pose[focusKey]) };
    return true;
  }
  function editAnchorPoint(action, anchorKey, point) {
    const anchor = action?.anchors?.find((candidate) => candidate.key === anchorKey);
    if (!anchor || !point) return false;
    anchor.point = { x: Math.round(Number(point.x) || 0), y: Math.round(Number(point.y) || 0) };
    anchor.pointNormalized = normalizedPoint(anchor.point);
    return true;
  }
  function regenerateActionFromAnchors() {
    const state = Animotion.state;
    const bridge = Animotion.cutsceneModel.normalizeBridge(state.cutsceneBridge);
    const primaryId = runtimePrimaryId(bridge);
    const plan = { ...currentPlan(), anchors: currentAction()?.anchors || [] };
    const primary = plan.anchors.find((anchor) => anchor.key === bridge.jointAction?.focusKey && anchor.role === "primary");
    if (primary?.point) plan.target = { ...primary.point };
    const result = Animotion.motionPlanner.createPlan(state.parts, primaryId, bridge, plan);
    Animotion.motionCommands.applyMotionPlanResult(bridge, plan, result);
  }
  function regenerateActionTracks() {
    const state = Animotion.state;
    const bridge = Animotion.cutsceneModel.normalizeBridge(state.cutsceneBridge);
    const primaryId = runtimePrimaryId(bridge);
    const tracks = Animotion.motionPlanner.tracksForJointAction(state.parts, primaryId, bridge);
    Animotion.motionCommands.applyGeneratedTracks(tracks);
    for (const track of tracks) Animotion.motionCommands.syncPartPoseToFrame(track.partId, state.currentFrame);
  }

  function currentAction() {
    return Animotion.state?.cutsceneBridge?.jointAction || null;
  }

  function beatSelection(beat, focusKey) {
    const info = Animotion.previewPointInfo?.trajectoryBeatInfo?.(beat, focusKey, currentAction()) || {};
    return { kind: "trajectory", role: info.role || "이동 경로점", label: info.label || beat?.id || "", detail: info.detail || "", participatesInTrajectory: true, trajectoryRole: info.trajectoryRole || "beat" };
  }

  function anchorSelection(anchor) {
    const info = Animotion.previewPointInfo?.anchorInfo?.(anchor) || {};
    return { kind: "trajectory", role: info.role || "궤적 조정점", label: info.label || `${anchor?.key || ""} · ${anchor?.role || ""}`, detail: info.detail || "", participatesInTrajectory: true, trajectoryRole: info.trajectoryRole || anchor?.role || "anchor" };
  }

  function currentPlan() {
    return Animotion.motionCommands?.currentMotionPlan?.() || Animotion.motionPlanner.normalizePlan(Animotion.state.motionPlan);
  }

  function runtimePrimaryId(bridge) {
    return Animotion.motionPrimarySelection?.runtimePrimaryId?.(Animotion.state.parts, bridge, Animotion.state.selectedPartId)
      || bridge.primaryPartId
      || Animotion.state.selectedPartId;
  }

  function trajectorySamples(action, focusKey) { return Animotion.motionTrajectoryTracks?.trajectorySamples?.(action, focusKey) || (action?.beats || []).map((beat) => beat.pose?.[focusKey]).filter(Boolean).map((point, index) => ({ id: `sample-${index}`, kind: "sample", editable: false, point: pointFrom(point) })); }
  function trajectoryTracks(action) { return Animotion.motionTrajectoryTracks?.trajectoryTracks?.(action) || [{ key: action?.focusKey || "hip", samples: trajectorySamples(action, action?.focusKey || "hip") }]; }
  function trajectoryKeys(action) { return Animotion.motionTrajectoryTracks?.trajectoryKeys?.(action) || [action?.focusKey || "hip"]; }

  function drawTrajectory(ctx, view, points, progress, key) {
    ctx.save();
    ctx.globalAlpha = 0.24;
    ctx.strokeStyle = colorForKey(key);
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
    drawTrajectoryMarker(ctx, view, points, progress, key);
    ctx.restore();
  }

  function colorForKey(key) { return key === "hip" ? "#1f6f9f" : "#811515"; }

  function drawTrajectoryMarker(ctx, view, points, progress, key) {
    const index = Math.min(points.length - 1, Math.floor(progress * (points.length - 1)));
    const screen = imagePointToScreen(pointFrom(points[index]), view);
    ctx.globalAlpha = 0.85;
    ctx.fillStyle = colorForKey(key);
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

  function normalizedPoint(point) {
    return Animotion.coordinateSpaces?.normalizedImagePointFromPoint?.(point, sourceBounds()) || null;
  }

  function sourceBounds() {
    if (Animotion.state?.image) return { width: Animotion.state.image.naturalWidth, height: Animotion.state.image.naturalHeight };
    return typeof Animotion.imageBounds === "function" ? Animotion.imageBounds() : null;
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

  Animotion.trajectoryEditor = { drawOverlay, editBeatPoint, editAnchorPoint, trajectorySamples, hitTarget, beginDragFromTarget, updateDrag, endDrag };
  install();
  if (typeof module !== "undefined") module.exports = Animotion.trajectoryEditor;
}
