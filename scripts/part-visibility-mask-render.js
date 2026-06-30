{
  const global = typeof window !== "undefined" ? window : globalThis;
  const Animotion = global.Animotion || (global.Animotion = {});

  function drawPartImage(ctx, part, frame, pathFromShape, options = {}) {
    const active = Animotion.partVisibilityMasks?.activeMasks?.(part, frame, options) || [];
    if (!active.length) {
      ctx.drawImage(part.canvas, part.rect.x, part.rect.y, part.rect.w, part.rect.h);
      return null;
    }
    const layer = partLayer(part);
    const layerCtx = layer.getContext("2d");
    layerCtx.drawImage(part.canvas, 0, 0, part.rect.w, part.rect.h);
    const result = apply(layerCtx, part, frame, pathFromShape, { offsetX: 0, offsetY: 0, activeMasks: active });
    ctx.drawImage(layer, part.rect.x, part.rect.y, part.rect.w, part.rect.h);
    return { ...result, isolatedLayer: true };
  }

  function apply(ctx, part, frame, pathFromShape, options = {}) {
    const active = options.activeMasks || Animotion.partVisibilityMasks?.activeMasks?.(part, frame, options) || [];
    if (!active.length) return null;
    const previousAlpha = ctx.globalAlpha;
    const previousComposite = ctx.globalCompositeOperation;
    const offsetX = Number(options.offsetX ?? part.rect.x) || 0;
    const offsetY = Number(options.offsetY ?? part.rect.y) || 0;
    ctx.save();
    ctx.globalCompositeOperation = "destination-out";
    for (const item of active) {
      ctx.globalAlpha = item.strength;
      ctx.fill(pathFromShape({ ...item.mask.mask, closed: true }, offsetX, offsetY));
    }
    ctx.restore();
    ctx.globalAlpha = previousAlpha;
    ctx.globalCompositeOperation = previousComposite;
    return { count: active.length, strengths: active.map((item) => item.strength) };
  }

  function partLayer(part) {
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(Number(part.rect?.w) || 1));
    canvas.height = Math.max(1, Math.round(Number(part.rect?.h) || 1));
    return canvas;
  }

  Animotion.partVisibilityMaskRender = { drawPartImage, apply };
}
