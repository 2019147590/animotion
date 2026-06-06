{
  const global = window;
  const Animotion = global.Animotion;
  const { sourceCanvas, els } = Animotion.dom;
  const state = Animotion.state;
  const geometry = Animotion.geometry;

  function bindSourceCanvasEvents() {
    sourceCanvas.addEventListener("pointerdown", onSourcePointerDown);
    sourceCanvas.addEventListener("pointermove", onSourcePointerMove);
    sourceCanvas.addEventListener("pointerup", onSourcePointerUp);
    sourceCanvas.addEventListener("dblclick", onSourceDoubleClick);
    sourceCanvas.addEventListener("wheel", onSourceWheel, { passive: false });
  }

  function onSourcePointerDown(event) {
    if (!sourceImage() || !state.sourceView) return;
    if (event.button === 1 || state.spaceDown) return beginPan(event);
    const point = Animotion.view.canvasPoint(event, sourceCanvas, state.sourceView);
    if (!point) return;
    handleToolPointerDown(event, point);
  }

  function beginPan(event) {
    event.preventDefault();
    state.drag = {
      kind: Animotion.dragKind.panSource,
      startClient: { x: event.clientX, y: event.clientY },
      startPan: { ...state.sourcePan },
    };
    sourceCanvas.setPointerCapture(event.pointerId);
  }

  function handleToolPointerDown(event, point) {
    const tool = els.selectionTool.value;
    if (tool === Animotion.tool.edit) return beginEdit(event, point);
    if (tool === Animotion.tool.polygon) return beginPolygonPoint(event, point);
    if (tool === Animotion.tool.lasso) return beginLasso(event, point);
    if (tool === Animotion.tool.rect || tool === Animotion.tool.ellipse) beginBox(event, point, tool);
    return null;
  }

  function beginEdit(event, point) {
    const editing = Animotion.panelEditor?.canEditRig() === false
      ? Animotion.editor.beginSelectionEditOnly(point)
      : Animotion.editor.beginShapeEdit(point);
    if (editing) sourceCanvas.setPointerCapture(event.pointerId);
    return null;
  }

  function beginPolygonPoint(event, point) {
    if (shouldClosePolygon(point)) {
      closeSelection();
      return null;
    }
    if (Animotion.editor.beginSelectionVertexEdit?.(point)) {
      sourceCanvas.setPointerCapture(event.pointerId);
      return null;
    }
    return addPolygonPoint(point);
  }

  function addPolygonPoint(point) {
    if (!state.selection || state.selection.kind !== Animotion.shapeKind.polygon || state.selection.closed) {
      state.selection = { kind: Animotion.shapeKind.polygon, closed: false, points: [point] };
    } else if (shouldClosePolygon(point)) {
      closeSelection();
    } else {
      state.selection.points.push(point);
    }
    Animotion.ui.refreshUi();
  }

  function shouldClosePolygon(point) {
    return state.selection?.kind === Animotion.shapeKind.polygon &&
      !state.selection.closed &&
      state.selection.points.length >= 3 &&
      geometry.distance(state.selection.points[0], point) <= Animotion.config.hitTolerancePx / state.sourceView.scale;
  }

  function beginLasso(event, point) {
    state.selection = { kind: Animotion.shapeKind.lasso, closed: false, points: [point] };
    state.drag = { kind: Animotion.dragKind.drawLasso };
    sourceCanvas.setPointerCapture(event.pointerId);
    Animotion.ui.refreshUi();
  }

  function beginBox(event, point, tool) {
    state.selection = { kind: tool, closed: true, points: geometry.rectPoints(point, point) };
    state.drag = { kind: Animotion.dragKind.drawBox, start: point, tool };
    sourceCanvas.setPointerCapture(event.pointerId);
    Animotion.ui.refreshUi();
  }

  function onSourcePointerMove(event) {
    if (!state.drag || !sourceImage() || !state.sourceView) return;
    if (state.drag.kind === Animotion.dragKind.panSource) return updatePan(event);
    const point = Animotion.view.canvasPoint(event, sourceCanvas, state.sourceView);
    if (!point) return;
    if (state.drag.kind === Animotion.dragKind.drawBox) updateBox(point);
    if (state.drag.kind === Animotion.dragKind.drawLasso) updateLasso(point);
    if (isEditDrag()) Animotion.editor.applyDragEdit(point);
    Animotion.ui.refreshUi();
  }

  function updatePan(event) {
    state.sourcePan = {
      x: state.drag.startPan.x + event.clientX - state.drag.startClient.x,
      y: state.drag.startPan.y + event.clientY - state.drag.startClient.y,
    };
    Animotion.ui.refreshUi();
  }

  function updateBox(point) {
    state.selection = { kind: state.drag.tool, closed: true, points: geometry.rectPoints(state.drag.start, point) };
  }

  function updateLasso(point) {
    const last = state.selection.points[state.selection.points.length - 1];
    if (!last || geometry.distance(last, point) > Animotion.config.lassoPointSpacing) {
      state.selection.points.push(point);
    }
  }

  function isEditDrag() {
    return state.drag.kind === Animotion.dragKind.editSelection || state.drag.kind === Animotion.dragKind.editPart;
  }

  function onSourcePointerUp(event) {
    if (sourceCanvas.hasPointerCapture(event.pointerId)) sourceCanvas.releasePointerCapture(event.pointerId);
    if (state.drag?.kind === Animotion.dragKind.drawLasso && state.selection?.points.length >= 3) closeSelection();
    state.drag = null;
    Animotion.ui.refreshUi();
  }

  function onSourceDoubleClick(event) {
    if (tryDeleteEditablePoint(event)) {
      event.preventDefault();
      return;
    }
    closeSelection();
  }

  function tryDeleteEditablePoint(event) {
    if (els.selectionTool.value !== Animotion.tool.edit || Animotion.panelEditor?.canEditRig() === false) return false;
    if (!sourceImage() || !state.sourceView) return false;
    const point = Animotion.view.canvasPoint(event, sourceCanvas, state.sourceView);
    return Boolean(point && Animotion.editor.deleteEditablePointAt?.(point));
  }

  function closeSelection() {
    if (!state.selection || state.selection.points.length < 3) return;
    state.selection.closed = true;
    els.selectionTool.value = Animotion.tool.edit;
    Animotion.ui.refreshUi();
  }

  function onSourceWheel(event) {
    if (!state.image) return;
    event.preventDefault();
    const rect = sourceCanvas.getBoundingClientRect();
    const anchor = { x: event.clientX - rect.left, y: event.clientY - rect.top };
    const factor = event.deltaY < 0 ? Animotion.config.wheelZoomStep : 1 / Animotion.config.wheelZoomStep;
    Animotion.view.setSourceZoom(state.sourceZoom * factor, anchor);
  }

  function sourceImage() {
    return Animotion.panelEditor?.imageFor?.() || state.image;
  }

  Animotion.sourceCanvasEvents = { bindSourceCanvasEvents, closeSelection, onSourcePointerDown };
}
