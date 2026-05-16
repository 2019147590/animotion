{
  const global = typeof window !== "undefined" ? window : globalThis;
  const Animotion = global.Animotion || (global.Animotion = {});
  const shapeKind = Animotion.shapeKind || {
    rect: "rect",
    ellipse: "ellipse",
    lasso: "lasso",
    polygon: "polygon",
  };

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function clonePoints(points) {
    return points.map((point) => ({ x: point.x, y: point.y }));
  }

  function rectPoints(a, b) {
    const x1 = Math.min(a.x, b.x);
    const y1 = Math.min(a.y, b.y);
    const x2 = Math.max(a.x, b.x);
    const y2 = Math.max(a.y, b.y);
    return [
      { x: x1, y: y1 },
      { x: x2, y: y1 },
      { x: x2, y: y2 },
      { x: x1, y: y2 },
    ];
  }

  function pointsBounds(points, imageBounds) {
    const xs = points.map((point) => point.x);
    const ys = points.map((point) => point.y);
    const minX = clamp(Math.floor(Math.min(...xs)), 0, imageBounds.width - 1);
    const minY = clamp(Math.floor(Math.min(...ys)), 0, imageBounds.height - 1);
    const maxX = clamp(Math.ceil(Math.max(...xs)), minX + 1, imageBounds.width);
    const maxY = clamp(Math.ceil(Math.max(...ys)), minY + 1, imageBounds.height);
    return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
  }

  function rectShape(rect) {
    return {
      kind: shapeKind.rect,
      closed: true,
      points: rectPoints(rect, { x: rect.x + rect.w, y: rect.y + rect.h }),
    };
  }

  function normalizeShape(shape, imageBounds) {
    const bounds = pointsBounds(shape.points, imageBounds);
    if (shape.kind === shapeKind.rect || shape.kind === shapeKind.ellipse) {
      return rectShape({ x: bounds.x, y: bounds.y, w: bounds.w, h: bounds.h });
    }
    return shape;
  }

  function shapeIsReady(shape, imageBounds, minSize) {
    if (!shape || !shape.closed || shape.points.length < 3) return false;
    const bounds = pointsBounds(shape.points, imageBounds);
    return bounds.w >= minSize && bounds.h >= minSize;
  }

  function shapeToMask(shape, rect) {
    return {
      kind: shape.kind,
      points: shape.points.map((point) => ({
        x: point.x - rect.x,
        y: point.y - rect.y,
      })),
    };
  }

  function absoluteShapeFromPart(part) {
    const fallback = rectShape({ x: 0, y: 0, w: part.rect.w, h: part.rect.h });
    return {
      kind: part.mask?.kind || shapeKind.rect,
      closed: true,
      points: (part.mask?.points || fallback.points).map((point) => ({
        x: part.rect.x + point.x,
        y: part.rect.y + point.y,
      })),
    };
  }

  function localBounds(points) {
    const xs = points.map((point) => point.x);
    const ys = points.map((point) => point.y);
    const x = Math.min(...xs);
    const y = Math.min(...ys);
    return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y };
  }

  function distance(a, b) {
    return Math.hypot(a.x - b.x, a.y - b.y);
  }

  function distanceToSegment(point, a, b) {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    if (dx === 0 && dy === 0) return distance(point, a);
    const t = clamp(((point.x - a.x) * dx + (point.y - a.y) * dy) / (dx * dx + dy * dy), 0, 1);
    return distance(point, { x: a.x + dx * t, y: a.y + dy * t });
  }

  function fitRect(sourceW, sourceH, targetW, targetH) {
    if (!sourceW || !sourceH) return { x: 0, y: 0, w: targetW, h: targetH, scale: 1 };
    const scale = Math.min(targetW / sourceW, targetH / sourceH);
    const w = sourceW * scale;
    const h = sourceH * scale;
    return { x: (targetW - w) / 2, y: (targetH - h) / 2, w, h, scale };
  }

  Animotion.geometry = {
    clamp,
    clonePoints,
    rectPoints,
    pointsBounds,
    rectShape,
    normalizeShape,
    shapeIsReady,
    shapeToMask,
    absoluteShapeFromPart,
    localBounds,
    distance,
    distanceToSegment,
    fitRect,
  };

  if (typeof module !== "undefined") module.exports = Animotion.geometry;
}
