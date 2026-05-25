{
  const global = typeof window !== "undefined" ? window : globalThis;
  const Animotion = global.Animotion || (global.Animotion = {});
  const DEFAULT_PADDING = 4;

  function withRequiredCoverageBounds(asset, sourcePart, options = {}) {
    if (!asset || !sourcePart) return asset;
    const bounds = options.imageBounds || imageBounds();
    if (!bounds) return asset;
    const rect = requiredCoverageRect(asset, sourcePart, options);
    const normalized = Animotion.coordinateSpaces?.normalizedImageRectFromRect?.(rect, bounds) || normalizedRect(rect, bounds);
    return { ...asset, sourceRectNormalized: normalized };
  }

  function requiredCoverageRect(asset, sourcePart, options = {}) {
    const bounds = options.imageBounds || imageBounds();
    const sourceRect = normalizeRect(sourcePart.sourceRect || sourcePart.rect);
    const assetRect = Animotion.coordinateSpaces?.rectFromNormalizedImageRect?.(asset?.sourceRectNormalized, bounds) || sourceRect;
    const required = [sourceRect, guideBounds(asset, sourceRect), maskBounds(asset, sourceRect)].filter(Boolean).reduce(unionBounds);
    const padded = clampRect(expandRect(required || sourceRect, padding(options)), bounds);
    return containsRect(assetRect, padded) ? clampRect(assetRect, bounds) : clampRect(unionBounds(assetRect, padded), bounds);
  }

  function sourcePartRectNormalized(sourcePart, options = {}) {
    const bounds = options.imageBounds || imageBounds();
    if (!sourcePart || !bounds) return null;
    return Animotion.coordinateSpaces?.normalizedImageRectFromRect?.(sourcePart.sourceRect || sourcePart.rect, bounds)
      || normalizedRect(sourcePart.sourceRect || sourcePart.rect, bounds);
  }

  function guideBounds(asset, sourceRect) {
    return boundsFromNormalizedPoints(asset?.guide?.silhouetteVerticesNormalized || asset?.guide?.meshVerticesNormalized || [], sourceRect);
  }

  function maskBounds(asset, sourceRect) {
    return boundsFromNormalizedPoints(asset?.maskVerticesNormalized || [], sourceRect);
  }

  function boundsFromNormalizedPoints(points = [], sourceRect) {
    if (!Array.isArray(points) || !points.length || !sourceRect) return null;
    const imagePoints = points.map((point) => ({
      x: sourceRect.x + number(point.xNorm ?? point.x ?? point[0]) * sourceRect.w,
      y: sourceRect.y + number(point.yNorm ?? point.y ?? point[1]) * sourceRect.h,
    }));
    const minX = Math.min(...imagePoints.map((point) => point.x));
    const minY = Math.min(...imagePoints.map((point) => point.y));
    const maxX = Math.max(...imagePoints.map((point) => point.x));
    const maxY = Math.max(...imagePoints.map((point) => point.y));
    return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
  }

  function unionBounds(a, b) {
    if (!a) return b;
    if (!b) return a;
    const x = Math.min(a.x, b.x), y = Math.min(a.y, b.y);
    return { x, y, w: Math.max(a.x + a.w, b.x + b.w) - x, h: Math.max(a.y + a.h, b.y + b.h) - y };
  }

  function expandRect(rect, amount) {
    return { x: rect.x - amount, y: rect.y - amount, w: rect.w + amount * 2, h: rect.h + amount * 2 };
  }

  function clampRect(rect, bounds) {
    const safe = bounds || {};
    const width = Math.max(1, Math.round(Number(safe.width || safe.w) || 1));
    const height = Math.max(1, Math.round(Number(safe.height || safe.h) || 1));
    const x = Math.max(0, Math.floor(Number(rect.x) || 0));
    const y = Math.max(0, Math.floor(Number(rect.y) || 0));
    const maxX = Math.min(width, Math.ceil((Number(rect.x) || 0) + Math.max(1, Number(rect.w) || 1)));
    const maxY = Math.min(height, Math.ceil((Number(rect.y) || 0) + Math.max(1, Number(rect.h) || 1)));
    return { x, y, w: Math.max(1, maxX - x), h: Math.max(1, maxY - y) };
  }

  function containsRect(outer, inner) {
    const e = 0.001;
    return inner.x >= outer.x - e && inner.y >= outer.y - e && inner.x + inner.w <= outer.x + outer.w + e && inner.y + inner.h <= outer.y + outer.h + e;
  }

  function normalizeRect(rect = {}) {
    return {
      x: Math.round(Number(rect.x) || 0),
      y: Math.round(Number(rect.y) || 0),
      w: Math.max(1, Math.round(Number(rect.w || rect.width) || 1)),
      h: Math.max(1, Math.round(Number(rect.h || rect.height) || 1)),
    };
  }

  function normalizedRect(rect, bounds) {
    const safe = bounds || {};
    const width = Math.max(1, Number(safe.width || safe.w) || 1);
    const height = Math.max(1, Number(safe.height || safe.h) || 1);
    const source = normalizeRect(rect);
    return {
      xNorm: clamp01(source.x / width),
      yNorm: clamp01(source.y / height),
      wNorm: clamp01(source.w / width),
      hNorm: clamp01(source.h / height),
      coordinateSpace: "normalized-image",
    };
  }

  function padding(options) {
    const value = Number(options.padding ?? DEFAULT_PADDING);
    return Number.isFinite(value) ? Math.max(0, value) : DEFAULT_PADDING;
  }

  function number(value) {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : 0;
  }

  function clamp01(value) {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? Math.min(1, Math.max(0, numeric)) : 0;
  }

  function imageBounds() {
    return Animotion.imageBounds?.() || (Animotion.state?.image ? { width: Animotion.state.image.naturalWidth, height: Animotion.state.image.naturalHeight } : null);
  }

  Animotion.hiddenCompletionCoverageBounds = { DEFAULT_PADDING, withRequiredCoverageBounds, requiredCoverageRect, sourcePartRectNormalized };
  if (typeof module !== "undefined") module.exports = Animotion.hiddenCompletionCoverageBounds;
}
