{
  const global = typeof window !== "undefined" ? window : globalThis;
  const Animotion = global.Animotion || (global.Animotion = {});

  function drawSegmentedPart(ctx, part, hint, alpha = 1) {
    if (!hint?.active || !hint.controls) return { ok: false, reason: "inactive", fallbackUsed: true, segmentCount: 0 };
    return Animotion.armExtensionRender?.drawSegmentedPart?.(ctx, part, hint, alpha)
      || { ok: false, reason: "missing-renderer", fallbackUsed: true, segmentCount: 0, sourceBounds: part?.rect || null };
  }

  Animotion.armExtensionSegment = { drawSegmentedPart };
  if (typeof module !== "undefined") module.exports = Animotion.armExtensionSegment;
}
