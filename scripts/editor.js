{
  const global = window;
  const Animotion = global.Animotion;
  const state = Animotion.state;
  const geometry = Animotion.geometry;
  const dragKind = Animotion.dragKind;
  const shapeKind = Animotion.shapeKind;

  function hitShape(shape, point, tolerance) {
    const vertex = hitVertex(shape.points, point, tolerance);
    if (vertex !== -1) return { mode: "vertex", index: vertex };
    const edge = hitEdge(shape, point, tolerance);
    if (edge !== -1) return { mode: "edge", index: edge };
    if (pointInShape(shape, point)) return { mode: "move", index: -1 };
    return null;
  }

  function hitVertex(points, point, tolerance) {
    for (let i = 0; i < points.length; i += 1) {
      if (geometry.distance(points[i], point) <= tolerance) return i;
    }
    return -1;
  }

  function hitEdge(shape, point, tolerance) {
    const limit = shape.closed ? shape.points.length : shape.points.length - 1;
    for (let i = 0; i < limit; i += 1) {
      const a = shape.points[i];
      const b = shape.points[(i + 1) % shape.points.length];
      if (geometry.distanceToSegment(point, a, b) <= tolerance) return i;
    }
    return -1;
  }

  function pointInShape(shape, point) {
    const path = Animotion.path.pathFromShape(shape);
    return Animotion.dom.sourceCtx.isPointInPath(path, point.x, point.y);
  }

  function beginShapeEdit(point) {
    const tolerance = Animotion.config.hitTolerancePx / (state.sourceView?.scale || 1);
    if (state.selection && beginSelectionEdit(point, tolerance)) return true;
    return beginPartEdit(point, tolerance);
  }

  function beginSelectionEditOnly(point) {
    const tolerance = Animotion.config.hitTolerancePx / (state.sourceView?.scale || 1);
    return Boolean(state.selection && beginSelectionEdit(point, tolerance));
  }

  function beginSelectionVertexEdit(point) {
    const tolerance = Animotion.config.hitTolerancePx / (state.sourceView?.scale || 1);
    if (!state.selection || state.selection.closed) return false;
    const index = hitVertex(state.selection.points, point, tolerance);
    if (index === -1) return false;
    state.drag = {
      kind: dragKind.editSelection,
      mode: "vertex",
      index,
      start: point,
      originalPoints: geometry.clonePoints(state.selection.points),
    };
    return true;
  }

  function beginSelectionEdit(point, tolerance) {
    const hit = hitShape(state.selection, point, tolerance);
    if (!hit) return false;
    const index = insertPointForEdge(state.selection.points, hit, point);
    state.drag = {
      kind: dragKind.editSelection,
      mode: hit.mode === "edge" ? "vertex" : hit.mode,
      index,
      start: point,
      originalPoints: geometry.clonePoints(state.selection.points),
    };
    return true;
  }

  function beginPartEdit(point, tolerance) {
    const target = Animotion.editTarget?.current?.() || { kind: "part", partId: state.selectedPartId, maskId: null };
    return target.kind === "visibilityMask"
      ? beginVisibilityMaskEdit(target, point, tolerance)
      : beginSelectedPartEdit(target.partId, point, tolerance);
  }

  function deleteEditablePointAt(point) {
    const target = Animotion.editTarget?.current?.() || { kind: "part", partId: state.selectedPartId, maskId: null };
    if (target.kind !== "part") return false;
    return deletePartVertex(target.partId, point);
  }

  function beginSelectedPartEdit(partId, point, tolerance) {
    const part = findPart(partId);
    if (!part) return false;
    const shape = editablePartShape(part);
    const hit = hitShape(shape, point, tolerance);
    if (!hit) return false;
    const index = insertPointForEdge(shape.points, hit, point);
    if (hit.mode === "edge") applyDisplayedShapeToPart(part, shape);
    state.drag = editPartDrag(part, point, hit, index, shape);
    Animotion.ui.refreshUi();
    return true;
  }

  function deletePartVertex(partId, point) {
    const part = findPart(partId);
    if (!part) return false;
    const shape = editablePartShape(part);
    if (!canDeleteShapeVertex(shape)) return false;
    const tolerance = Animotion.config.hitTolerancePx / (state.sourceView?.scale || 1);
    const index = hitVertex(shape.points, point, tolerance);
    if (index === -1) return false;
    const points = shape.points.filter((_, pointIndex) => pointIndex !== index);
    applyDisplayedShapeToPart(part, { ...shape, points });
    state.drag = null;
    Animotion.ui.refreshUi();
    return true;
  }

  function canDeleteShapeVertex(shape) {
    return (shape.kind === shapeKind.polygon || shape.kind === shapeKind.lasso) && shape.points.length > 3;
  }

  function beginVisibilityMaskEdit(target, point, tolerance) {
    const part = findPart(target.partId);
    const mask = selectedVisibilityMask(part, target.maskId);
    if (!part || !mask) return false;
    const shape = visibilityMaskShape(part, mask);
    const hit = hitShape(shape, point, tolerance);
    if (!hit) return false;
    const index = insertPointForEdge(shape.points, hit, point);
    if (hit.mode === "edge") applyDisplayedMaskToPart(part, mask.id, shape);
    state.drag = editVisibilityMaskDrag(part, mask, point, hit, index, shape);
    Animotion.ui.refreshUi();
    return true;
  }

  function insertPointForEdge(points, hit, point) {
    if (hit.mode !== "edge") return hit.index;
    points.splice(hit.index + 1, 0, point);
    return hit.index + 1;
  }

  function editPartDrag(part, point, hit, index, shape = editablePartShape(part)) {
    return {
      kind: dragKind.editPart,
      targetKind: "part",
      partId: part.id,
      mode: hit.mode === "edge" ? "vertex" : hit.mode,
      index,
      start: point,
      startTransform: normalizeTransform(part.transform),
      parentMatrix: parentWorldMatrix(part),
      originalPoints: geometry.clonePoints(shape.points),
      shapeKind: part.mask?.kind || shapeKind.rect,
    };
  }

  function editVisibilityMaskDrag(part, mask, point, hit, index, shape) {
    return {
      kind: dragKind.editPart,
      targetKind: "visibilityMask",
      partId: part.id,
      maskId: mask.id,
      mode: hit.mode === "edge" ? "vertex" : hit.mode,
      index,
      start: point,
      originalPoints: geometry.clonePoints(shape.points),
      shapeKind: mask.mask?.kind || shapeKind.polygon,
    };
  }

  function applyDragEdit(point) {
    if (!state.drag) return;
    const points = editedPoints(point);
    if (state.drag.kind === dragKind.editSelection) {
      state.selection.points = points;
      state.selection = geometry.normalizeShape(state.selection, Animotion.imageBounds());
    }
    if (state.drag.kind === dragKind.editPart) {
      const part = state.parts.find((candidate) => candidate.id === state.drag.partId);
      if (part && state.drag.targetKind === "visibilityMask") applyDisplayedMaskToPart(part, state.drag.maskId, { kind: state.drag.shapeKind, closed: true, points });
      else if (part && state.drag.mode === "move") movePartTransform(part, point);
      else if (part) applyDisplayedShapeToPart(part, { kind: state.drag.shapeKind, closed: true, points });
    }
    Animotion.ui.refreshUi();
  }

  function editablePartShape(part) {
    return Animotion.partTransformGeometry?.shapeFromPart?.(part, state.parts) || geometry.absoluteShapeFromPart(part);
  }

  function applyDisplayedShapeToPart(part, shape) {
    const points = untransformedPoints(part, shape.points);
    return Animotion.parts.applyShapeToPart(part, { ...shape, points });
  }

  function applyDisplayedMaskToPart(part, maskId, shape) {
    const points = partLocalPoints(part, shape.points);
    const masks = Animotion.partVisibilityMasks.normalizeList(part.visibilityMasks).map((mask) =>
      mask.id === maskId ? { ...mask, mask: { ...mask.mask, kind: shape.kind, points } } : mask
    );
    return Animotion.partCommands.updatePart(part, { visibilityMasks: masks });
  }

  function visibilityMaskShape(part, mask) {
    const points = Animotion.partTransformGeometry?.partLocalPointsToImage?.(part, mask.mask.points, state.parts)
      || mask.mask.points.map((point) => ({ x: part.rect.x + point.x, y: part.rect.y + point.y }));
    return { kind: mask.mask.kind || shapeKind.polygon, closed: true, points };
  }

  function selectedVisibilityMask(part, maskId) {
    return (Animotion.partVisibilityMasks?.normalizeList?.(part?.visibilityMasks) || []).find((mask) => mask.id === maskId) || null;
  }

  function untransformedPoints(part, points) {
    const helper = Animotion.partTransformGeometry;
    if (!helper?.inverseMatrix || !helper?.worldMatrix || !helper?.applyMatrix) return points;
    const inverse = helper.inverseMatrix(helper.worldMatrix(part, state.parts));
    return points.map((point) => helper.applyMatrix(inverse, point));
  }

  function partLocalPoints(part, points) {
    return Animotion.partTransformGeometry?.imagePointsToPartLocal?.(part, points, state.parts)
      || points.map((point) => ({ x: point.x - part.rect.x, y: point.y - part.rect.y }));
  }

  function movePartTransform(part, point) {
    const delta = parentLocalDelta({ x: point.x - state.drag.start.x, y: point.y - state.drag.start.y }, state.drag.parentMatrix);
    const transform = state.drag.startTransform || normalizeTransform(part.transform);
    Animotion.partCommands.updatePart(part, { transform: { ...transform, x: transform.x + delta.x, y: transform.y + delta.y } });
  }

  function parentLocalDelta(delta, matrix) {
    const helper = Animotion.partTransformGeometry;
    if (!helper?.inverseMatrix || !helper?.applyMatrix) return delta;
    const inverse = helper.inverseMatrix(matrix || identityMatrix());
    const start = helper.applyMatrix(inverse, { x: 0, y: 0 });
    const end = helper.applyMatrix(inverse, delta);
    return { x: end.x - start.x, y: end.y - start.y };
  }

  function parentWorldMatrix(part) {
    const parent = findPart(Animotion.rigConnection?.parentIdFor?.(part) || part?.parentId || part?.parentPartId);
    return parent && Animotion.partTransformGeometry?.worldMatrix ? Animotion.partTransformGeometry.worldMatrix(parent, state.parts) : identityMatrix();
  }

  function identityMatrix() {
    return { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 };
  }

  function normalizeTransform(transform = {}) {
    return Animotion.partTransformGeometry?.normalizeTransform?.(transform) || {
      x: Number(transform.x) || 0,
      y: Number(transform.y) || 0,
      rotation: Number(transform.rotation) || 0,
      scaleX: Number(transform.scaleX) || 1,
      scaleY: Number(transform.scaleY) || 1,
    };
  }

  function findPart(partId) {
    return state.parts.find((candidate) => candidate.id === partId) || null;
  }

  function editedPoints(point) {
    if (state.drag.mode === "vertex") return replaceDraggedVertex(point);
    if (state.drag.mode === "move") return moveDraggedPoints(point);
    return geometry.clonePoints(state.drag.originalPoints);
  }

  function replaceDraggedVertex(point) {
    const points = geometry.clonePoints(state.drag.originalPoints);
    points[state.drag.index] = point;
    return points;
  }

  function moveDraggedPoints(point) {
    const bounds = Animotion.imageBounds();
    const dx = point.x - state.drag.start.x;
    const dy = point.y - state.drag.start.y;
    return state.drag.originalPoints.map((candidate) => ({
      x: geometry.clamp(candidate.x + dx, 0, bounds.width),
      y: geometry.clamp(candidate.y + dy, 0, bounds.height),
    }));
  }

  Animotion.editor = { beginShapeEdit, beginSelectionEditOnly, beginSelectionVertexEdit, applyDragEdit, deleteEditablePointAt, hitShape };
}
