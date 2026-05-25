{
  const global = window;
  const Animotion = global.Animotion;
  const geometry = Animotion.geometry;

  function patchForTransform(part, patch = {}) {
    const nextRect = supplementalRect(part.rect, patch);
    const scale = supplementalMaskScale(part, patch);
    const patchData = {
      rect: nextRect,
      sourceRect: nextRect,
      pivot: scaleLocalPoint(part.pivot, part.rect, nextRect),
      joint: scaleLocalPoint(part.joint, part.rect, nextRect),
      mask: transformedMask(part.mask, part.rect, nextRect, scale.factor),
      supplementalMaskScale: scale.value,
    };
    if (part.handTip) patchData.handTip = scaleLocalPoint(part.handTip, part.rect, nextRect);
    return patchData;
  }

  function supplementalRect(rect, patch) {
    return {
      x: Math.round(numberOrDefault(patch.x, rect.x)),
      y: Math.round(numberOrDefault(patch.y, rect.y)),
      w: Math.max(1, Math.round(numberOrDefault(patch.w, rect.w))),
      h: Math.max(1, Math.round(numberOrDefault(patch.h, rect.h))),
    };
  }

  function supplementalMaskScale(part, patch) {
    const current = Math.min(1.5, Math.max(0.5, Number(part.supplementalMaskScale) || 1));
    const value = Math.min(1.5, Math.max(0.5, numberOrDefault(patch.maskScale, current)));
    return { value, factor: current ? value / current : value };
  }

  function transformedMask(mask, fromRect, toRect, maskFactor) {
    const points = (mask?.points || geometry.rectShape({ x: 0, y: 0, w: fromRect.w, h: fromRect.h }).points)
      .map((point) => scaleLocalPoint(point, fromRect, toRect))
      .map((point) => scaleAroundCenter(point, toRect, maskFactor));
    return { kind: mask?.kind || Animotion.shapeKind.rect, points };
  }

  function scaleLocalPoint(point = {}, fromRect, toRect) {
    return {
      x: fromRect.w ? Number(point.x || 0) / fromRect.w * toRect.w : Number(point.x || 0),
      y: fromRect.h ? Number(point.y || 0) / fromRect.h * toRect.h : Number(point.y || 0),
    };
  }

  function scaleAroundCenter(point, rect, factor) {
    const center = { x: rect.w * 0.5, y: rect.h * 0.5 };
    return {
      x: center.x + (point.x - center.x) * factor,
      y: center.y + (point.y - center.y) * factor,
    };
  }

  function numberOrDefault(value, fallback) {
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
  }

  Animotion.partSupplementalTransform = { patchForTransform };
}
