{
  const global = typeof window !== "undefined" ? window : globalThis;
  const Animotion = global.Animotion || (global.Animotion = {});

  function imagePointsToPartLocal(part, points = [], parts = []) {
    const inverse = inverseMatrix(worldMatrix(part, parts));
    return points.map((point) => {
      const absolute = applyMatrix(inverse, point);
      return cleanPoint({ x: absolute.x - part.rect.x, y: absolute.y - part.rect.y });
    });
  }

  function partLocalPointsToImage(part, points = [], parts = []) {
    const matrix = worldMatrix(part, parts);
    return points.map((point) => cleanPoint(applyMatrix(matrix, { x: part.rect.x + point.x, y: part.rect.y + point.y })));
  }

  function shapeFromPart(part, parts = []) {
    const fallback = rectLocalPoints(part?.rect || {});
    return {
      kind: part?.mask?.kind || Animotion.shapeKind?.rect || "rect",
      closed: true,
      points: partLocalPointsToImage(part, part?.mask?.points?.length ? part.mask.points : fallback, parts),
    };
  }

  function pointToImage(part, point, parts = []) {
    return partLocalPointsToImage(part, [point], parts)[0] || null;
  }

  function worldMatrix(part, parts = [], cache = new Map()) {
    if (!part) return identity();
    if (cache.has(part.id)) return cache.get(part.id);
    const parent = parentPart(part, parts);
    const parentMatrix = parent ? worldMatrix(parent, parts, cache) : identity();
    const matrix = multiply(parentMatrix, localMatrix(part));
    cache.set(part.id, matrix);
    return matrix;
  }

  function localMatrix(part) {
    const transform = normalizeTransform(part.transform);
    const pivot = {
      x: Number(part.rect?.x || 0) + Number(part.pivot?.x || 0),
      y: Number(part.rect?.y || 0) + Number(part.pivot?.y || 0),
    };
    return multiply(
      translate(pivot.x + transform.x, pivot.y + transform.y),
      rotate(transform.rotation),
      scale(transform.scaleX, transform.scaleY),
      translate(-pivot.x, -pivot.y)
    );
  }

  function parentPart(part, parts) {
    const parentId = Animotion.rigConnection?.parentIdFor?.(part) || part?.parentId || part?.parentPartId || null;
    return (parts || []).find((candidate) => candidate.id === parentId) || null;
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

  function rotate(degrees) {
    const radians = degrees * Math.PI / 180;
    const cos = Math.cos(radians);
    const sin = Math.sin(radians);
    return { a: cos, b: sin, c: -sin, d: cos, e: 0, f: 0 };
  }

  function scale(x, y) {
    return { a: x, b: 0, c: 0, d: y, e: 0, f: 0 };
  }

  function inverseMatrix(matrix) {
    const det = matrix.a * matrix.d - matrix.b * matrix.c || 1;
    return {
      a: matrix.d / det,
      b: -matrix.b / det,
      c: -matrix.c / det,
      d: matrix.a / det,
      e: (matrix.c * matrix.f - matrix.d * matrix.e) / det,
      f: (matrix.b * matrix.e - matrix.a * matrix.f) / det,
    };
  }

  function applyMatrix(matrix, point) {
    return {
      x: matrix.a * point.x + matrix.c * point.y + matrix.e,
      y: matrix.b * point.x + matrix.d * point.y + matrix.f,
    };
  }

  function identity() {
    return { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 };
  }

  function rectLocalPoints(rect = {}) {
    const w = Number(rect.w) || 0;
    const h = Number(rect.h) || 0;
    return [{ x: 0, y: 0 }, { x: w, y: 0 }, { x: w, y: h }, { x: 0, y: h }];
  }

  function numberOrDefault(value, fallback) {
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
  }

  function cleanPoint(point) {
    return { x: cleanNumber(point.x), y: cleanNumber(point.y) };
  }

  function cleanNumber(value) {
    if (Math.abs(value) < 1e-9) return 0;
    const rounded = Math.round(value);
    return Math.abs(value - rounded) < 1e-9 ? rounded : value;
  }

  Animotion.partTransformGeometry = {
    imagePointsToPartLocal,
    partLocalPointsToImage,
    shapeFromPart,
    pointToImage,
    worldMatrix,
    localMatrix,
    normalizeTransform,
    applyMatrix,
    inverseMatrix,
  };
  if (typeof module !== "undefined") module.exports = Animotion.partTransformGeometry;
}
