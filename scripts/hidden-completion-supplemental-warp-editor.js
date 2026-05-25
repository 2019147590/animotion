{
  const global = typeof window !== "undefined" ? window : globalThis;
  const Animotion = global.Animotion || (global.Animotion = {});
  const DRAG_KIND = "supplemental-warp-point";

  function drawOverlay(ctx, view) {
    const part = selectedSupplementalPart();
    if (!part || !view || !editingLayerVisible()) return;
    const points = screenPoints(part);
    if (!points.length) return;
    const seam = screenSeam(part);
    ctx.save();
    ctx.strokeStyle = "#0f7f79";
    ctx.lineWidth = 1.5;
    path(ctx, points);
    ctx.stroke();
    if (seam.length === 2) {
      ctx.strokeStyle = "#2f63d8";
      path(ctx, seam, false);
      ctx.stroke();
    }
    for (const point of points) drawHandle(ctx, point);
    for (const point of seam) drawHandle(ctx, point, "#63a4ff");
    ctx.restore();
  }

  function hitTarget(event) {
    const part = selectedSupplementalPart();
    if (!part || !editingLayerVisible()) return null;
    const pointer = canvasPoint(event);
    const points = screenPoints(part).concat(screenSeam(part));
    const hits = points
      .map((point) => ({ ...point, distance: distance(point, pointer) }))
      .filter((hit) => hit.distance <= tolerance())
      .sort((a, b) => a.distance - b.distance);
    if (hits[0]) return { label: hitLabel(hits[0]), partId: part.id, pointId: hits[0].id, hit: hits[0] };
    const seamHit = seamLineHit(part, pointer);
    return seamHit ? { label: "보완 재료 경계선", partId: part.id, pointId: "materialSeam", hit: seamHit } : null;
  }

  function beginDragFromTarget(event, target) {
    const hit = target?.hit || target?.payload?.hit;
    const part = selectedSupplementalPart();
    if (!part || !hit) return false;
    freezePlayback();
    Animotion.state.previewDrag = {
      kind: DRAG_KIND,
      partId: part.id,
      pointId: hit.pointId || hit.id,
      beforeWarp: clone(part.supplementalWarp || null),
      startWarp: clone(Animotion.hiddenCompletionSupplementalWarp.normalizeWarp(part.supplementalWarp, part) || Animotion.hiddenCompletionSupplementalWarp.defaultWarp(part)),
      startSeam: clone(Animotion.hiddenCompletionSupplementalWarp.materialSeam(part)),
      startPoint: localPoint(event, part),
      startHandle: handlePoint(part, hit.pointId || hit.id),
    };
    Animotion.dom.previewCanvas.setPointerCapture(event.pointerId);
    Animotion.previewPointerArbitration?.setActiveDragOwner?.("hiddenCompletionSupplementalWarpEditor", event, { kind: DRAG_KIND, label: part.id });
    return true;
  }

  function updateDrag(event) {
    const drag = Animotion.state.previewDrag;
    if (drag?.kind !== DRAG_KIND) return false;
    const part = Animotion.state.parts.find((candidate) => candidate.id === drag.partId);
    const current = localPoint(event, part);
    if (!part || !current || !drag.startPoint || !drag.startHandle) return true;
    const next = {
      x: drag.startHandle.x + current.x - drag.startPoint.x,
      y: drag.startHandle.y + current.y - drag.startPoint.y,
    };
    part.supplementalWarp = nextWarp(part, drag, current, next);
    if (Animotion.state.project) Animotion.state.project.parts = Animotion.state.parts;
    Animotion.ui?.refreshUi?.();
    event.preventDefault();
    return true;
  }

  function endDrag(event) {
    const drag = Animotion.state.previewDrag;
    if (drag?.kind !== DRAG_KIND) return false;
    const part = Animotion.state.parts.find((candidate) => candidate.id === drag.partId);
    const afterWarp = clone(part?.supplementalWarp || null), beforeWarp = clone(drag.beforeWarp || null);
    if (Animotion.dom.previewCanvas.hasPointerCapture(event.pointerId)) Animotion.dom.previewCanvas.releasePointerCapture(event.pointerId);
    Animotion.state.previewDrag = null;
    Animotion.previewPointerArbitration?.clearActiveDragOwner?.({ editorKey: "hiddenCompletionSupplementalWarpEditor" });
    if (part && JSON.stringify(beforeWarp) !== JSON.stringify(afterWarp)) recordHistory(part.id, beforeWarp, afterWarp);
    return true;
  }

  function screenPoints(part) {
    const matrix = currentMatrix(part);
    const warp = Animotion.hiddenCompletionSupplementalWarp.normalizeWarp(part.supplementalWarp, part) || Animotion.hiddenCompletionSupplementalWarp.defaultWarp(part);
    return warp.points.map((point) => {
      const image = new DOMPoint(part.rect.x + point.x, part.rect.y + point.y).matrixTransform(matrix);
      const screen = Animotion.previewTransform.imagePointToScreen(image, Animotion.state.previewView, Animotion.state.previewSourceFrame, Animotion.state.previewSourceTransform);
      return screen ? { ...screen, id: point.id, pointId: point.id } : null;
    }).filter(Boolean);
  }

  function screenSeam(part) {
    const matrix = currentMatrix(part);
    return Animotion.hiddenCompletionSupplementalWarp.materialSeam(part).points.map((point) => {
      const image = new DOMPoint(part.rect.x + point.x, part.rect.y + point.y).matrixTransform(matrix);
      const screen = Animotion.previewTransform.imagePointToScreen(image, Animotion.state.previewView, Animotion.state.previewSourceFrame, Animotion.state.previewSourceTransform);
      return screen ? { ...screen, id: point.id, pointId: point.id, materialSeam: true } : null;
    }).filter(Boolean);
  }

  function seamLineHit(part, pointer) {
    const seam = screenSeam(part);
    if (seam.length !== 2 || distanceToSegment(pointer, seam[0], seam[1]) > tolerance()) return null;
    return { id: "materialSeam", pointId: "materialSeam", materialSeam: true, hit: pointer };
  }

  function localPoint(event, part) {
    if (!part) return null;
    const pointer = Animotion.previewCoordinate.clientToPreviewPoint(event, Animotion.dom.previewCanvas);
    return Animotion.previewCoordinate.previewToPartLocalPoint(pointer, dragContext(part));
  }

  function dragContext(part) {
    return { part, partMatrix: currentMatrix(part), view: Animotion.state.previewView, sourceFrame: Animotion.state.previewSourceFrame, sourceTransform: Animotion.state.previewSourceTransform };
  }

  function currentMatrix(part) {
    const t = Animotion.state.running ? (performance.now() - Animotion.state.startTime) / 1000 : Animotion.state.pausedTime;
    return Animotion.preview.worldMatrix(part, t, new Map());
  }

  function selectedSupplementalPart() {
    const part = Animotion.parts?.selectedPart?.() || Animotion.state?.parts?.find((candidate) => candidate.id === Animotion.state?.selectedPartId);
    return part?.isSupplementalPart === true ? part : null;
  }

  function recordHistory(partId, beforeWarp, afterWarp) {
    Animotion.commandHistory?.record?.({
      label: "edit-supplemental-warp",
      undo: () => setWarp(partId, beforeWarp),
      redo: () => setWarp(partId, afterWarp),
    });
  }

  function handlePoint(part, pointId) {
    if (pointId === "materialSeam") return { x: 0, y: 0 };
    return Animotion.hiddenCompletionSupplementalWarp.materialSeamPointById(part, pointId)
      || Animotion.hiddenCompletionSupplementalWarp.pointById(part, pointId);
  }

  function nextWarp(part, drag, current, next) {
    if (drag.pointId === "materialSeam") {
      return Animotion.hiddenCompletionSupplementalWarp.translateMaterialSeam(part, {
        x: current.x - drag.startPoint.x,
        y: current.y - drag.startPoint.y,
      });
    }
    if (Animotion.hiddenCompletionSupplementalWarp.SEAM_IDS.includes(drag.pointId)) {
      return Animotion.hiddenCompletionSupplementalWarp.setMaterialSeamPoint(part, drag.pointId, next);
    }
    return Animotion.hiddenCompletionSupplementalWarp.setPoint(part, drag.pointId, next);
  }

  function setWarp(partId, warp) {
    const part = Animotion.state.parts.find((candidate) => candidate.id === partId);
    if (!part) return;
    if (warp) part.supplementalWarp = clone(warp);
    else delete part.supplementalWarp;
    if (Animotion.state.project) Animotion.state.project.parts = Animotion.state.parts;
    Animotion.ui?.refreshUi?.();
  }

  function path(ctx, points, close = true) {
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (const point of points.slice(1)) ctx.lineTo(point.x, point.y);
    if (close) ctx.closePath();
  }

  function drawHandle(ctx, point, fill = "#f1b83b") {
    ctx.beginPath();
    ctx.fillStyle = fill;
    ctx.strokeStyle = "#151515";
    ctx.arc(point.x, point.y, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }

  function canvasPoint(event) {
    const rect = Animotion.dom.previewCanvas.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  }

  function freezePlayback() {
    if (!Animotion.state.running) return;
    Animotion.state.pausedTime = (performance.now() - Animotion.state.startTime) / 1000;
    Animotion.state.running = false;
    Animotion.dom.els.playPause.textContent = "재생";
  }

  function tolerance() {
    return Animotion.config?.hitTolerancePx || 10;
  }

  function editingLayerVisible() {
    return !Animotion.state?.running && !Animotion.state?.exporting;
  }

  function distance(a, b) {
    return Math.hypot(Number(a.x) - Number(b.x), Number(a.y) - Number(b.y));
  }

  function distanceToSegment(point, a, b) {
    const dx = Number(b.x) - Number(a.x), dy = Number(b.y) - Number(a.y);
    const lengthSq = dx * dx + dy * dy;
    if (lengthSq <= 0.0001) return distance(point, a);
    const t = Math.max(0, Math.min(1, ((point.x - a.x) * dx + (point.y - a.y) * dy) / lengthSq));
    return distance(point, { x: Number(a.x) + dx * t, y: Number(a.y) + dy * t });
  }

  function hitLabel(hit) {
    return hit.materialSeam ? "보완 재료 경계점" : "보완 파츠 변형점";
  }

  function clone(value) {
    return value === undefined || value === null ? null : JSON.parse(JSON.stringify(value));
  }

  Animotion.hiddenCompletionSupplementalWarpEditor = { drawOverlay, hitTarget, beginDragFromTarget, updateDrag, endDrag };
  if (typeof module !== "undefined") module.exports = Animotion.hiddenCompletionSupplementalWarpEditor;
}
