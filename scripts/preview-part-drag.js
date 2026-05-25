{
  const global = typeof window !== "undefined" ? window : globalThis;
  const Animotion = global.Animotion || (global.Animotion = {});

  function partBodyTarget(event) {
    const part = selectedPart();
    if (!part || part.hidden || !Animotion.state?.previewView) return null;
    const imagePoint = previewImagePoint(event);
    if (!imagePoint || !containsPartImagePoint(part, imagePoint)) return null;
    return { partId: part.id, label: part.name || part.id, hit: { imagePoint } };
  }

  function beginDragFromTarget(event, target) {
    const part = findPart(target?.partId);
    if (!part) return false;
    freezePlayback();
    Animotion.state.previewPartDrag = dragSession(event, part);
    Animotion.state.selectedEditPoint = { kind: "partBody", role: "파츠 이동", label: part.name || "", detail: "" };
    Animotion.dom.previewCanvas.setPointerCapture(event.pointerId);
    Animotion.previewPointerArbitration?.setActiveDragOwner?.("previewPartDrag", event, { kind: "part-body", label: part.name || "" });
    Animotion.ui?.refreshUi?.();
    return true;
  }

  function updateDrag(event) {
    const drag = Animotion.state?.previewPartDrag;
    const part = findPart(drag?.partId);
    const current = previewImagePoint(event);
    if (!drag || !part || !current) return Boolean(drag);
    const imageDelta = { x: current.x - drag.startImagePoint.x, y: current.y - drag.startImagePoint.y };
    const localDelta = parentLocalDelta(imageDelta, drag.parentMatrix);
    part.transform = {
      ...drag.startTransform,
      x: drag.startTransform.x + localDelta.x,
      y: drag.startTransform.y + localDelta.y,
    };
    event.preventDefault?.();
    Animotion.ui?.refreshUi?.();
    return true;
  }

  function endDrag(event) {
    const drag = Animotion.state?.previewPartDrag;
    const part = findPart(drag?.partId);
    if (!drag) return false;
    if (Animotion.dom.previewCanvas.hasPointerCapture?.(event.pointerId)) Animotion.dom.previewCanvas.releasePointerCapture(event.pointerId);
    Animotion.state.previewPartDrag = null;
    if (part) {
      const finalTransform = normalizeTransform(part.transform);
      part.transform = drag.startTransform;
      Animotion.partCommands.updatePart(part, { transform: finalTransform });
    }
    return true;
  }

  function dragSession(event, part) {
    return {
      partId: part.id,
      startImagePoint: previewImagePoint(event),
      startTransform: normalizeTransform(part.transform),
      parentMatrix: parentWorldMatrix(part),
    };
  }

  function containsPartImagePoint(part, imagePoint) {
    const matrix = worldMatrix(part);
    const absolute = applyMatrix(inverseMatrix(matrix), imagePoint);
    return containsLocalPoint(part, { x: absolute.x - part.rect.x, y: absolute.y - part.rect.y });
  }

  function containsLocalPoint(part, point) {
    const points = part.mask?.points?.length ? part.mask.points : rectPoints(part.rect);
    if (!insideBounds(point, points)) return false;
    return pointInPolygon(point, points) || points.some((pointA, index) => {
      const pointB = points[(index + 1) % points.length];
      return distanceToSegment(point, pointA, pointB) <= 0.5;
    });
  }

  function parentLocalDelta(delta, parentMatrix) {
    const inverse = inverseLinearMatrix(parentMatrix);
    return {
      x: inverse.a * delta.x + inverse.c * delta.y,
      y: inverse.b * delta.x + inverse.d * delta.y,
    };
  }

  function parentWorldMatrix(part) {
    const parentId = Animotion.rigConnection?.parentIdFor?.(part) || part?.parentId || part?.parentPartId || null;
    const parent = findPart(parentId);
    return parent ? worldMatrix(parent) : identityMatrix();
  }

  function worldMatrix(part) {
    const state = Animotion.state || {};
    const t = state.running ? (performance.now() - state.startTime) / 1000 : state.pausedTime;
    return Animotion.preview.worldMatrix(part, t, new Map());
  }

  function previewImagePoint(event) {
    const canvas = Animotion.dom?.previewCanvas;
    const pointer = Animotion.previewCoordinate.clientToPreviewPoint(event, canvas);
    return Animotion.previewCoordinate.previewToImagePoint(pointer, {
      view: Animotion.state.previewView,
      sourceFrame: Animotion.state.previewSourceFrame,
      sourceTransform: Animotion.state.previewSourceTransform,
    });
  }

  function rectPoints(rect) {
    return [{ x: 0, y: 0 }, { x: rect.w, y: 0 }, { x: rect.w, y: rect.h }, { x: 0, y: rect.h }];
  }

  function insideBounds(point, points) {
    const xs = points.map((item) => item.x);
    const ys = points.map((item) => item.y);
    return point.x >= Math.min(...xs) - 0.5 && point.x <= Math.max(...xs) + 0.5
      && point.y >= Math.min(...ys) - 0.5 && point.y <= Math.max(...ys) + 0.5;
  }

  function pointInPolygon(point, points) {
    let inside = false;
    for (let i = 0, j = points.length - 1; i < points.length; j = i, i += 1) {
      const a = points[i], b = points[j];
      if ((a.y > point.y) !== (b.y > point.y) && point.x < ((b.x - a.x) * (point.y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
    }
    return inside;
  }

  function distanceToSegment(point, a, b) {
    const dx = b.x - a.x, dy = b.y - a.y;
    if (dx === 0 && dy === 0) return Math.hypot(point.x - a.x, point.y - a.y);
    const t = Math.max(0, Math.min(1, ((point.x - a.x) * dx + (point.y - a.y) * dy) / (dx * dx + dy * dy)));
    return Math.hypot(point.x - (a.x + dx * t), point.y - (a.y + dy * t));
  }

  function inverseMatrix(matrix) {
    const m = matrixFromDom(matrix);
    const det = m.a * m.d - m.b * m.c || 1;
    return { a: m.d / det, b: -m.b / det, c: -m.c / det, d: m.a / det, e: (m.c * m.f - m.d * m.e) / det, f: (m.b * m.e - m.a * m.f) / det };
  }

  function inverseLinearMatrix(matrix) {
    const m = matrixFromDom(matrix);
    const det = m.a * m.d - m.b * m.c || 1;
    return { a: m.d / det, b: -m.b / det, c: -m.c / det, d: m.a / det };
  }

  function applyMatrix(matrix, point) {
    const m = matrixFromDom(matrix);
    return { x: m.a * point.x + m.c * point.y + m.e, y: m.b * point.x + m.d * point.y + m.f };
  }

  function matrixFromDom(matrix) {
    return { a: Number(matrix?.a ?? 1), b: Number(matrix?.b ?? 0), c: Number(matrix?.c ?? 0), d: Number(matrix?.d ?? 1), e: Number(matrix?.e ?? 0), f: Number(matrix?.f ?? 0) };
  }

  function identityMatrix() {
    return { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 };
  }

  function normalizeTransform(transform = {}) {
    return {
      x: numberOrDefault(transform.x, 0),
      y: numberOrDefault(transform.y, 0),
      rotation: numberOrDefault(transform.rotation, 0),
      scaleX: numberOrDefault(transform.scaleX, 1),
      scaleY: numberOrDefault(transform.scaleY, 1),
    };
  }

  function selectedPart() {
    return Animotion.parts?.selectedPart?.() || findPart(Animotion.state?.selectedPartId) || null;
  }

  function findPart(partOrId) {
    const id = typeof partOrId === "string" ? partOrId : partOrId?.id;
    return (Animotion.state?.parts || []).find((part) => part.id === id) || null;
  }

  function freezePlayback() {
    const state = Animotion.state || {};
    if (!state.running) return;
    state.pausedTime = (performance.now() - state.startTime) / 1000;
    state.running = false;
    if (Animotion.dom?.els?.playPause) Animotion.dom.els.playPause.textContent = "재생";
  }

  function numberOrDefault(value, fallback) {
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
  }

  Animotion.previewPartDrag = { partBodyTarget, beginDragFromTarget, updateDrag, endDrag };
  if (typeof module !== "undefined") module.exports = Animotion.previewPartDrag;
}
