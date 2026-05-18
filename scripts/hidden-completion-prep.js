{
  const global = typeof window !== "undefined" ? window : globalThis;
  const Animotion = global.Animotion || (global.Animotion = {});

  function prepareHiddenCompletionImages({ request, sourceImage, maskImage = null }) {
    const bounds = imageBounds(sourceImage);
    const cropRect = rectFromNormalized(request?.sourceRectNormalized, bounds);
    const sourceCrop = { image: sourceImage, width: cropRect.w, height: cropRect.h, cropRect };
    const mask = maskImage || rasterizeMaskDescriptor(request, cropRect);
    assertMatchingDimensions(sourceCrop, mask);
    return { request, sourceImage: sourceCrop, maskImage: mask };
  }

  function rasterizeMaskDescriptor(request, cropRect) {
    const points = maskSourcePoints(request).map((point) => clippedLocalPoint(point, cropRect));
    return {
      width: cropRect.w,
      height: cropRect.h,
      kind: "polygon-mask-descriptor",
      polygonPoints: points,
      clippedAtBoundary: true,
    };
  }

  function maskSourcePoints(request) {
    if (request?.maskVerticesNormalized?.length) return request.maskVerticesNormalized;
    return request?.guide?.silhouetteVerticesNormalized || [];
  }

  function clippedLocalPoint(point, rect) {
    return {
      x: clamp(numberOrDefault(point.xNorm, 0) * rect.w, 0, rect.w),
      y: clamp(numberOrDefault(point.yNorm, 0) * rect.h, 0, rect.h),
    };
  }

  function assertMatchingDimensions(sourceImage, maskImage) {
    if (sourceImage.width !== maskImage.width || sourceImage.height !== maskImage.height) {
      throw new Error("hidden completion source image and mask image dimensions must match");
    }
  }

  function rectFromNormalized(rect, bounds) {
    if (!rect) throw new Error("hidden completion sourceRectNormalized is required");
    const x = clampInt(numberOrDefault(rect.xNorm, 0) * bounds.width, 0, bounds.width - 1);
    const y = clampInt(numberOrDefault(rect.yNorm, 0) * bounds.height, 0, bounds.height - 1);
    return {
      x,
      y,
      w: clampInt(numberOrDefault(rect.wNorm, 0) * bounds.width, 1, bounds.width - x),
      h: clampInt(numberOrDefault(rect.hNorm, 0) * bounds.height, 1, bounds.height - y),
    };
  }

  function imageBounds(image) {
    const width = Math.round(Number(image?.naturalWidth || image?.width) || 0);
    const height = Math.round(Number(image?.naturalHeight || image?.height) || 0);
    if (width < 1 || height < 1) throw new Error("hidden completion source image dimensions are required");
    return { width, height };
  }

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function clampInt(value, min, max) {
    return Math.round(clamp(Number(value) || 0, min, max));
  }

  function numberOrDefault(value, fallback) {
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
  }

  Animotion.hiddenCompletionPrep = { prepareHiddenCompletionImages, rasterizeMaskDescriptor };
  if (typeof module !== "undefined") module.exports = Animotion.hiddenCompletionPrep;
}
