{
  const global = typeof window !== "undefined" ? window : globalThis;
  const Animotion = global.Animotion || (global.Animotion = {});

  function geometryForPatch(patch, source, input) {
    const options = geometryOptions(input);
    const bounds = options.imageBounds;
    const sourceRect = normalizeRect(source.sourceRect || source.rect);
    const baseRect = Animotion.hiddenCompletionCoverageBounds?.requiredCoverageRect?.(patch, source, { imageBounds: bounds })
      || normalizeRect(Animotion.coordinateSpaces?.rectFromNormalizedImageRect?.(patch.sourceRectNormalized, bounds) || sourceRect);
    const points = patch.guide?.silhouetteVerticesNormalized || patch.maskVerticesNormalized || [];
    const imagePoints = points.map((point) => ({
      x: sourceRect.x + Number(point.xNorm ?? point.x ?? 0) * sourceRect.w,
      y: sourceRect.y + Number(point.yNorm ?? point.y ?? 0) * sourceRect.h,
    }));
    const rect = expandedRectForMask(baseRect, imagePoints, bounds);
    const maskPoints = imagePoints;
    return {
      rect,
      mask: { kind: "polygon", points: maskPoints.map((point) => ({ x: point.x - rect.x, y: point.y - rect.y })) },
    };
  }

  function canvasForPatch(patch, part, counterpart, source = null, options = {}) {
    if (typeof document === "undefined" || !counterpart?.canvas) return null;
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(part.rect.w));
    canvas.height = Math.max(1, Math.round(part.rect.h));
    const ctx = canvas.getContext("2d");
    const sourceImage = options.sourceImage || Animotion.state?.image || null;
    const sampleRect = counterpartSampleRect(part.rect, source, counterpart, options.imageBounds);
    const placement = sourceImage && sampleRect ? expandedPlacement(patch, part, source, counterpart, sampleRect) : null;
    const drawBounds = placement?.drawBounds || { x: 0, y: 0, w: part.rect.w, h: part.rect.h };
    ctx.save();
    const translation = patch.patchTransform?.translationNormalized || {};
    const baseX = part.rect.w * 0.5, baseY = part.rect.h * 0.5;
    ctx.translate(baseX + part.rect.w * Number(translation.xNorm || 0), baseY + part.rect.h * Number(translation.yNorm || 0));
    if (patch.patchTransform?.rotation) ctx.rotate(Number(patch.patchTransform.rotation) * Math.PI / 180);
    ctx.scale(-Math.abs(Number(patch.patchTransform?.scaleX) || 1), Math.abs(Number(patch.patchTransform?.scaleY) || 1));
    const dx = baseX - drawBounds.x - drawBounds.w, dy = drawBounds.y - baseY;
    if (shouldSampleSourceImage(patch, part, source, counterpart) && sourceImage && sampleRect) {
      ctx.drawImage(sourceImage, sampleRect.x, sampleRect.y, sampleRect.w, sampleRect.h, dx, dy, drawBounds.w, drawBounds.h);
      canvas.__sourceSamplingPath = "expanded-source-image-counterpart";
      canvas.__counterpartSamplingRect = sampleRect;
      if (placement) {
        canvas.__counterpartMaterialBounds = placement.materialBounds;
        canvas.__counterpartDrawBounds = placement.drawBounds;
      }
    } else {
      ctx.drawImage(counterpart.canvas, dx, dy, drawBounds.w, drawBounds.h);
      canvas.__sourceSamplingPath = "counterpart-part-canvas";
    }
    ctx.restore();
    canvas.__sourceOpaqueBounds = mirroredOpaqueBounds(counterpart.canvas, part.rect) || opaqueBoundsFromCanvas(canvas) || null;
    canvas.__opaqueBounds = { x: 0, y: 0, w: canvas.width, h: canvas.height };
    return canvas;
  }

  function shouldSampleSourceImage(patch, _part, source, counterpart) {
    return needsExpandedSampling(patch, source) || needsContextSampling(source, counterpart);
  }

  function needsExpandedSampling(patch, source) {
    const sourceRect = normalizeRect(source?.sourceRect || source?.rect);
    return [patch?.guide?.silhouetteVerticesNormalized, patch?.maskVerticesNormalized]
      .map((points) => imageBoundsFromNormalizedPoints(points, sourceRect))
      .filter(Boolean)
      .some((bounds) => !containsBounds(sourceRect, bounds));
  }

  function needsContextSampling(source, counterpart) { return [source?.humanRole, counterpart?.humanRole].map((role) => String(role || "").toLowerCase()).some((role) => role === "upperarm"); }

  function counterpartSampleRect(targetRect, source, counterpart, bounds) {
    const sourceRect = normalizeRect(source?.sourceRect || source?.rect);
    const counterpartRect = normalizeRect(counterpart?.sourceRect || counterpart?.rect);
    if (!sourceRect || !counterpartRect) return null;
    const target = normalizeRect(targetRect);
    const left = (target.x - sourceRect.x) / sourceRect.w;
    const right = (target.x + target.w - sourceRect.x) / sourceRect.w;
    const top = (target.y - sourceRect.y) / sourceRect.h;
    const bottom = (target.y + target.h - sourceRect.y) / sourceRect.h;
    return normalizeRect(clampRect({
      x: counterpartRect.x + (1 - right) * counterpartRect.w,
      y: counterpartRect.y + top * counterpartRect.h,
      w: (right - left) * counterpartRect.w,
      h: (bottom - top) * counterpartRect.h,
    }, bounds));
  }

  function expandedPlacement(patch, part, source, counterpart, sampleRect) {
    if (!needsExpandedSampling(patch, source)) return null;
    const materialBounds = boundsFromPoints(part.mask?.points || rectPoints(part.rect));
    const drawBounds = drawBoundsForMaterial(sampleRect, counterpartMaterialRect(counterpart), materialBounds);
    return { materialBounds, drawBounds };
  }

  function counterpartMaterialRect(part = {}) {
    const rect = normalizeRect(part.sourceRect || part.rect);
    const local = boundsFromPoints(part.mask?.points || []);
    if (!local.w || !local.h) return rect;
    return normalizeRect({ x: rect.x + local.x, y: rect.y + local.y, w: local.w, h: local.h });
  }

  function drawBoundsForMaterial(sample, material, target) {
    const w = target.w * sample.w / Math.max(1, material.w);
    const h = target.h * sample.h / Math.max(1, material.h);
    const rightRatio = (material.x + material.w - sample.x) / Math.max(1, sample.w);
    const topRatio = (material.y - sample.y) / Math.max(1, sample.h);
    return roundBounds({ x: target.x - w + rightRatio * w, y: target.y - topRatio * h, w, h });
  }

  function imageBoundsFromNormalizedPoints(points = [], rect) {
    if (!Array.isArray(points) || !points.length || !rect) return null;
    return boundsFromPoints(points.map((point) => ({
      x: rect.x + Number(point.xNorm ?? point.x ?? 0) * rect.w,
      y: rect.y + Number(point.yNorm ?? point.y ?? 0) * rect.h,
    })));
  }

  function geometryOptions(input = {}) {
    return input?.imageBounds || input?.parts ? input : { imageBounds: input };
  }

  function coverageForPart(part = {}) {
    const maskBounds = boundsFromPoints(part.mask?.points || rectPoints(part.rect));
    const rectBounds = { x: 0, y: 0, w: Number(part.rect?.w || 0), h: Number(part.rect?.h || 0) };
    const sourceRectBounds = { x: 0, y: 0, w: Number(part.sourceRect?.w || part.rect?.w || 0), h: Number(part.sourceRect?.h || part.rect?.h || 0) };
    const canvasBounds = { x: 0, y: 0, w: Number(part.rect?.w || 0), h: Number(part.rect?.h || 0) };
    const canvasOpaqueBounds = localOpaqueBounds(part);
    const renderedClippedBounds = intersectBounds(maskBounds, canvasOpaqueBounds || canvasBounds);
    const coverageRatio = ratio(renderedClippedBounds, maskBounds);
    const warnings = coverageWarnings({ maskBounds, rectBounds, sourceRectBounds, canvasOpaqueBounds, coverageRatio, part });
    return { maskBounds, rectBounds, sourceRectBounds, canvasBounds, canvasOpaqueBounds, renderedClippedBounds, coverageRatio, warnings };
  }

  function expandedRectForMask(rect, imagePoints, bounds) {
    const maskBounds = boundsFromPoints(imagePoints);
    const union = unionBounds(rect, maskBounds);
    return normalizeRect(clampRect(union, bounds));
  }

  function boundsFromPoints(points = []) {
    if (!points.length) return { x: 0, y: 0, w: 0, h: 0 };
    const xs = points.map((point) => Number(point.x || 0));
    const ys = points.map((point) => Number(point.y || 0));
    const minX = Math.min(...xs), minY = Math.min(...ys);
    return roundBounds({ x: minX, y: minY, w: Math.max(...xs) - minX, h: Math.max(...ys) - minY });
  }

  function unionBounds(a, b) {
    const x = Math.min(Number(a.x || 0), Number(b.x || 0));
    const y = Math.min(Number(a.y || 0), Number(b.y || 0));
    return { x, y, w: Math.max(a.x + a.w, b.x + b.w) - x, h: Math.max(a.y + a.h, b.y + b.h) - y };
  }

  function clampRect(rect, bounds) {
    const safe = bounds || imageBounds();
    if (!safe) return rect;
    const x = Math.max(0, rect.x), y = Math.max(0, rect.y);
    const maxX = Math.min(Number(safe.width || safe.w || 1), rect.x + rect.w);
    const maxY = Math.min(Number(safe.height || safe.h || 1), rect.y + rect.h);
    return { x, y, w: Math.max(1, maxX - x), h: Math.max(1, maxY - y) };
  }

  function rectPoints(rect = {}) {
    const w = Number(rect.w || 0), h = Number(rect.h || 0);
    return [{ x: 0, y: 0 }, { x: w, y: 0 }, { x: w, y: h }, { x: 0, y: h }];
  }

  function localOpaqueBounds(part) {
    const bounds = opaqueBoundsFromCanvas(part.canvas);
    if (!bounds || !part.canvas?.width || !part.canvas?.height) return null;
    return roundBounds({
      x: bounds.x / part.canvas.width * part.rect.w,
      y: bounds.y / part.canvas.height * part.rect.h,
      w: bounds.w / part.canvas.width * part.rect.w,
      h: bounds.h / part.canvas.height * part.rect.h,
    });
  }

  function mirroredOpaqueBounds(canvas, rect) {
    const bounds = opaqueBoundsFromCanvas(canvas);
    if (!bounds || !canvas?.width || !canvas?.height) return null;
    return roundBounds({
      x: rect.w - (bounds.x + bounds.w) / canvas.width * rect.w,
      y: bounds.y / canvas.height * rect.h,
      w: bounds.w / canvas.width * rect.w,
      h: bounds.h / canvas.height * rect.h,
    });
  }

  function opaqueBoundsFromCanvas(canvas) {
    if (!canvas) return null;
    if (canvas.__opaqueBounds) return roundBounds(canvas.__opaqueBounds);
    const ctx = typeof canvas.getContext === "function" ? canvas.getContext("2d") : null;
    if (!ctx?.getImageData || !canvas.width || !canvas.height) return null;
    return scanOpaqueBounds(ctx.getImageData(0, 0, canvas.width, canvas.height), canvas.width, canvas.height);
  }

  function scanOpaqueBounds(imageData, width, height) {
    let minX = width, minY = height, maxX = -1, maxY = -1;
    for (let y = 0; y < height; y += 1) for (let x = 0; x < width; x += 1) {
      if (imageData.data[(y * width + x) * 4 + 3] <= 0) continue;
      minX = Math.min(minX, x); minY = Math.min(minY, y); maxX = Math.max(maxX, x + 1); maxY = Math.max(maxY, y + 1);
    }
    return maxX < 0 ? null : { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
  }

  function coverageWarnings(data) {
    const warnings = [];
    if (!containsBounds(data.rectBounds, data.maskBounds)) warnings.push("mask-outside-supplemental-rect");
    if (!containsBounds(data.sourceRectBounds, data.maskBounds)) warnings.push("source-rect-too-small");
    if (data.canvasOpaqueBounds && data.coverageRatio < 0.9) warnings.push("canvas-opaque-bounds-too-small");
    if (looksNormalizedMask(data.part?.mask?.points, data.part?.rect)) warnings.push("mask-coordinate-mismatch");
    return warnings;
  }

  function containsBounds(outer, inner) {
    const e = 0.001;
    return inner.x >= outer.x - e && inner.y >= outer.y - e && inner.x + inner.w <= outer.x + outer.w + e && inner.y + inner.h <= outer.y + outer.h + e;
  }

  function intersectBounds(a, b) {
    const x = Math.max(a.x, b.x), y = Math.max(a.y, b.y);
    const w = Math.max(0, Math.min(a.x + a.w, b.x + b.w) - x);
    const h = Math.max(0, Math.min(a.y + a.h, b.y + b.h) - y);
    return roundBounds({ x, y, w, h });
  }

  function ratio(covered, target) {
    const area = Math.max(0, target.w * target.h);
    return area ? Math.max(0, Math.min(1, covered.w * covered.h / area)) : 0;
  }

  function looksNormalizedMask(points = [], rect = {}) {
    return Number(rect.w || 0) > 8 && Number(rect.h || 0) > 8 && points.length >= 3 && points.every((point) => Number(point.x) >= 0 && Number(point.x) <= 1 && Number(point.y) >= 0 && Number(point.y) <= 1);
  }

  function normalizeRect(rect = {}) {
    return { x: Math.round(Number(rect.x) || 0), y: Math.round(Number(rect.y) || 0), w: Math.max(1, Math.round(Number(rect.w) || 1)), h: Math.max(1, Math.round(Number(rect.h) || 1)) };
  }

  function roundBounds(bounds = {}) {
    return { x: roundNumber(bounds.x), y: roundNumber(bounds.y), w: roundNumber(bounds.w), h: roundNumber(bounds.h) };
  }

  function roundNumber(value) {
    return Math.round((Number(value) || 0) * 1000) / 1000;
  }

  function imageBounds() {
    return Animotion.imageBounds?.() || (Animotion.state?.image ? { width: Animotion.state.image.naturalWidth, height: Animotion.state.image.naturalHeight } : null);
  }

  Animotion.hiddenCompletionSupplementalCoverage = { geometryForPatch, canvasForPatch, coverageForPart };
  if (typeof module !== "undefined") module.exports = Animotion.hiddenCompletionSupplementalCoverage;
}
