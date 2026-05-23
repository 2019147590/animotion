{
  const global = typeof window !== "undefined" ? window : globalThis;
  const Animotion = global.Animotion || (global.Animotion = {});

  function drawForPart(ctx, part, context = {}) {
    const asset = linkedSymmetryAsset(part, context);
    if (!asset) return null;
    const source = counterpartPart(asset, context.parts || []);
    if (!source?.canvas) return { ok: false, reason: "missing-counterpart-canvas", assetId: asset.id };
    const matrix = context.worldMatrix?.(part, context.t, context.matrixCache);
    if (!matrix) return { ok: false, reason: "missing-target-transform", assetId: asset.id };
    ctx.save();
    applyMatrix(ctx, matrix);
    clipToGuide(ctx, asset, part);
    drawMirroredSource(ctx, source, part, asset.patchTransform);
    ctx.restore();
    return {
      ok: true,
      assetId: asset.id,
      method: "symmetry",
      counterpartPartId: source.id,
      drawnBounds: Animotion.renderOrderDebug?.boundsFromMatrix?.(part, matrix) || part.rect,
    };
  }

  function linkedSymmetryAsset(part, context = {}) {
    const draft = activeDraftForPart(part, context.state);
    const hidden = draft?.hiddenCompletion;
    if (!hidden?.assetId || hidden.assetStatus !== "ready") return null;
    const asset = Animotion.hiddenCompletionAssets?.findById?.(context.state?.project?.assets, hidden.assetId);
    if (asset?.completionMethod !== "symmetry" || asset.sourcePartId !== part?.id) return null;
    return asset;
  }

  function activeDraftForPart(part, state = {}) {
    const action = Animotion.cutsceneActionSelectors?.getActiveJointAction?.(state)?.action;
    const drafts = [
      action?.motionDraft,
      state.motionPlan?.motionDraft,
    ];
    return drafts.find((draft) => draft && (!draft.partId || draft.partId === part?.id)) || null;
  }

  function counterpartPart(asset, parts = []) {
    const id = asset?.symmetrySource?.counterpartPartId;
    return parts.find((part) => part.id === id) || null;
  }

  function clipToGuide(ctx, asset, part) {
    const points = asset.guide?.silhouetteVerticesNormalized || asset.guide?.meshVerticesNormalized || [];
    if (points.length < 3) return;
    ctx.beginPath();
    points.forEach((point, index) => {
      const x = part.rect.x + Number(point.xNorm ?? point.x ?? 0) * part.rect.w;
      const y = part.rect.y + Number(point.yNorm ?? point.y ?? 0) * part.rect.h;
      if (index === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.closePath();
    ctx.clip();
  }

  function drawMirroredSource(ctx, source, target, transform = {}) {
    const rect = target.rect;
    const translation = transform.translationNormalized || {};
    const x = rect.x + rect.w * 0.5 + Number(translation.xNorm || 0) * rect.w;
    const y = rect.y + rect.h * 0.5 + Number(translation.yNorm || 0) * rect.h;
    ctx.translate(x, y);
    if (transform.rotation) ctx.rotate(Number(transform.rotation) * Math.PI / 180);
    ctx.scale(-Math.abs(Number(transform.scaleX) || 1), Math.abs(Number(transform.scaleY) || 1));
    ctx.drawImage(source.canvas, -rect.w * 0.5, -rect.h * 0.5, rect.w, rect.h);
  }

  function applyMatrix(ctx, matrix) {
    ctx.transform(matrix.a, matrix.b, matrix.c, matrix.d, matrix.e, matrix.f);
  }

  Animotion.hiddenCompletionRender = { drawForPart, linkedSymmetryAsset };
  if (typeof module !== "undefined") module.exports = Animotion.hiddenCompletionRender;
}
