{
  const global = typeof window !== "undefined" ? window : globalThis;
  const Animotion = global.Animotion || (global.Animotion = {});

  function clientToPreviewPoint(event, canvas) {
    const rect = canvas.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  }

  function previewToPartLocalPoint(point, context = {}) {
    const image = previewToImagePoint(point, context);
    return imageToPartLocalPoint(image, context.part, context.partMatrix);
  }

  function partLocalToPreviewPoint(point, context = {}) {
    const image = partLocalToImagePoint(point, context.part, context.partMatrix);
    return imageToPreviewPoint(image, context);
  }

  function normalizedToPartLocalPoint(point, part) {
    if (!point) return null;
    return {
      x: Number(point.xNorm ?? point[0]) * (Number(part?.rect?.w) || 1),
      y: Number(point.yNorm ?? point[1]) * (Number(part?.rect?.h) || 1),
    };
  }

  function partLocalToNormalizedPoint(point, part) {
    if (!point) return null;
    return {
      xNorm: safeRatio(point.x, part?.rect?.w),
      yNorm: safeRatio(point.y, part?.rect?.h),
      coordinateSpace: "part-local-normalized",
    };
  }

  function dragLocalPoint(session, currentPointerPreviewPosition) {
    const current = previewToPartLocalPoint(currentPointerPreviewPosition, session);
    const start = session.startPointerLocalPosition;
    return current && start ? {
      x: session.startPointLocalPosition.x + current.x - start.x,
      y: session.startPointLocalPosition.y + current.y - start.y,
    } : null;
  }

  function dragRenderedPoint(session, currentPointerPreviewPosition) {
    return partLocalToPreviewPoint(dragLocalPoint(session, currentPointerPreviewPosition), session);
  }

  function previewToImagePoint(point, context) {
    if (!point) return null;
    const matrix = inverseMatrix(sourceMatrix(context));
    return applyMatrix(matrix, point);
  }

  function imageToPreviewPoint(point, context) {
    return point ? applyMatrix(sourceMatrix(context), point) : null;
  }

  function imageToPartLocalPoint(point, part, matrix) {
    if (!point || !part) return null;
    const localImage = applyMatrix(inverseMatrix(matrix), point);
    return { x: localImage.x - part.rect.x, y: localImage.y - part.rect.y };
  }

  function partLocalToImagePoint(point, part, matrix) {
    if (!point || !part) return null;
    return applyMatrix(matrix, { x: part.rect.x + point.x, y: part.rect.y + point.y });
  }

  function sourceMatrix(context = {}) {
    const view = context.view;
    const frame = context.sourceFrame;
    const transform = context.sourceTransform || {};
    const scale = sourceScale(view, frame, transform);
    const rotation = Number(transform.rotation) || 0;
    const center = {
      x: view.x + view.w * 0.5 + (Number(transform.x) || 0),
      y: view.y + view.h * 0.5 + (Number(transform.y) || 0),
    };
    return multiply(
      translate(center.x, center.y),
      rotate(rotation),
      scaleMatrix(scale, scale),
      translate(-frame.x - frame.w * 0.5, -frame.y - frame.h * 0.5)
    );
  }

  function sourceScale(view, frame, transform = {}) {
    return Math.min(view.w / frame.sourceWidth, view.h / frame.sourceHeight) * (Number(transform.scale) || 1);
  }

  function multiply(...matrices) {
    return matrices.reduce((left, right) => ({
      a: left.a * right.a + left.c * right.b,
      b: left.b * right.a + left.d * right.b,
      c: left.a * right.c + left.c * right.d,
      d: left.b * right.c + left.d * right.d,
      e: left.a * right.e + left.c * right.f + left.e,
      f: left.b * right.e + left.d * right.f + left.f,
    }));
  }

  function translate(x, y) {
    return { a: 1, b: 0, c: 0, d: 1, e: x, f: y };
  }

  function rotate(radians) {
    const cos = Math.cos(radians);
    const sin = Math.sin(radians);
    return { a: cos, b: sin, c: -sin, d: cos, e: 0, f: 0 };
  }

  function scaleMatrix(x, y) {
    return { a: x, b: 0, c: 0, d: y, e: 0, f: 0 };
  }

  function inverseMatrix(matrix) {
    const m = matrix || translate(0, 0);
    if (typeof m.inverse === "function") return matrixFromDom(m.inverse());
    const det = m.a * m.d - m.b * m.c || 1;
    return {
      a: m.d / det,
      b: -m.b / det,
      c: -m.c / det,
      d: m.a / det,
      e: (m.c * m.f - m.d * m.e) / det,
      f: (m.b * m.e - m.a * m.f) / det,
    };
  }

  function applyMatrix(matrix, point) {
    const m = matrixFromDom(matrix);
    return {
      x: m.a * point.x + m.c * point.y + m.e,
      y: m.b * point.x + m.d * point.y + m.f,
    };
  }

  function matrixFromDom(matrix) {
    return {
      a: Number(matrix?.a ?? 1),
      b: Number(matrix?.b ?? 0),
      c: Number(matrix?.c ?? 0),
      d: Number(matrix?.d ?? 1),
      e: Number(matrix?.e ?? 0),
      f: Number(matrix?.f ?? 0),
    };
  }

  function safeRatio(value, size) {
    const denominator = Number(size) || 1;
    return (Number(value) || 0) / denominator;
  }

  Animotion.previewCoordinate = {
    clientToPreviewPoint,
    previewToPartLocalPoint,
    partLocalToPreviewPoint,
    normalizedToPartLocalPoint,
    partLocalToNormalizedPoint,
    dragLocalPoint,
    dragRenderedPoint,
  };
  if (typeof module !== "undefined") module.exports = Animotion.previewCoordinate;
}
