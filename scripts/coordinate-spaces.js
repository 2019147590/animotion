{
  const global = typeof window !== "undefined" ? window : globalThis;
  const Animotion = global.Animotion || (global.Animotion = {});

  function normalizedImageRectFromRect(rect, bounds) {
    const safe = safeBounds(bounds);
    const source = normalizeRect(rect);
    return {
      xNorm: clamp01(source.x / safe.width),
      yNorm: clamp01(source.y / safe.height),
      wNorm: clamp01(source.w / safe.width),
      hNorm: clamp01(source.h / safe.height),
      coordinateSpace: "normalized-image",
    };
  }

  function rectFromNormalizedImageRect(rect, bounds) {
    if (!rect) return null;
    const safe = safeBounds(bounds);
    const x = clampInt(rect.xNorm * safe.width, 0, safe.width - 1);
    const y = clampInt(rect.yNorm * safe.height, 0, safe.height - 1);
    return {
      x,
      y,
      w: clampInt(rect.wNorm * safe.width, 1, safe.width - x),
      h: clampInt(rect.hNorm * safe.height, 1, safe.height - y),
    };
  }

  function normalizedLocalPointFromPoint(point, rect) {
    const source = normalizePoint(point);
    const safeRect = normalizeRect(rect);
    return {
      xNorm: clamp01(source.x / safeRect.w),
      yNorm: clamp01(source.y / safeRect.h),
      coordinateSpace: "part-local-normalized",
    };
  }

  function pointFromNormalizedLocalPoint(point, rect) {
    if (!point) return null;
    const safeRect = normalizeRect(rect);
    return {
      x: Math.round(clamp01(Number(point.xNorm)) * safeRect.w),
      y: Math.round(clamp01(Number(point.yNorm)) * safeRect.h),
    };
  }

  function normalizedLocalPointsFromPoints(points = [], rect) {
    return Array.isArray(points) ? points.map((point) => normalizedLocalPointFromPoint(point, rect)) : [];
  }

  function pointsFromNormalizedLocalPoints(points = [], rect) {
    return Array.isArray(points) ? points.map((point) => pointFromNormalizedLocalPoint(point, rect)).filter(Boolean) : [];
  }

  function normalizedImagePointFromPoint(point, bounds) {
    if (!bounds) return null;
    const safe = safeBounds(bounds);
    const source = normalizePoint(point);
    return {
      xNorm: clamp01(source.x / safe.width),
      yNorm: clamp01(source.y / safe.height),
      coordinateSpace: "normalized-image",
    };
  }

  function pointFromNormalizedImagePoint(point, bounds) {
    if (!point || !bounds) return null;
    const safe = safeBounds(bounds);
    return {
      x: Math.round(clamp01(Number(point.xNorm)) * safe.width),
      y: Math.round(clamp01(Number(point.yNorm)) * safe.height),
    };
  }

  function normalizeRect(rect = {}) {
    return {
      x: Math.round(Number(rect.x) || 0),
      y: Math.round(Number(rect.y) || 0),
      w: Math.max(1, Math.round(Number(rect.w) || Number(rect.width) || 1)),
      h: Math.max(1, Math.round(Number(rect.h) || Number(rect.height) || 1)),
    };
  }

  function normalizePoint(point = {}) {
    return {
      x: Math.round(Number(point.x ?? point[0]) || 0),
      y: Math.round(Number(point.y ?? point[1]) || 0),
    };
  }

  function safeBounds(bounds = {}) {
    const source = bounds || {};
    return {
      width: Math.max(1, Math.round(Number(source.width) || Number(source.w) || 1)),
      height: Math.max(1, Math.round(Number(source.height) || Number(source.h) || 1)),
    };
  }

  function clampInt(value, min, max) {
    return Math.round(Math.min(max, Math.max(min, Number(value) || 0)));
  }

  function clamp01(value) {
    return Math.min(1, Math.max(0, Number.isFinite(value) ? value : 0));
  }

  Animotion.coordinateSpaces = {
    normalizedImageRectFromRect,
    rectFromNormalizedImageRect,
    normalizedImagePointFromPoint,
    pointFromNormalizedImagePoint,
    normalizedLocalPointFromPoint,
    pointFromNormalizedLocalPoint,
    normalizedLocalPointsFromPoints,
    pointsFromNormalizedLocalPoints,
  };

  if (typeof module !== "undefined") module.exports = Animotion.coordinateSpaces;
}
