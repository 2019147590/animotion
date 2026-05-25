{
  const global = typeof window !== "undefined" ? window : globalThis;
  const Animotion = global.Animotion || (global.Animotion = {});

  function apply(ctx, part, frame, pathFromShape) {
    const active = Animotion.partVisibilityMasks?.activeMasks?.(part, frame) || [];
    if (!active.length) return null;
    const previousAlpha = ctx.globalAlpha;
    const previousComposite = ctx.globalCompositeOperation;
    ctx.save();
    ctx.globalCompositeOperation = "destination-out";
    for (const item of active) {
      ctx.globalAlpha = item.strength;
      ctx.fill(pathFromShape({ ...item.mask.mask, closed: true }, part.rect.x, part.rect.y));
    }
    ctx.restore();
    ctx.globalAlpha = previousAlpha;
    ctx.globalCompositeOperation = previousComposite;
    return { count: active.length, strengths: active.map((item) => item.strength) };
  }

  Animotion.partVisibilityMaskRender = { apply };
}
