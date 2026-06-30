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
    const renderRect = coverageRect(asset, part, context);
    const sample = sourceSample(asset, source, part, renderRect, context);
    ctx.save();
    applyMatrix(ctx, matrix);
    clipToGuide(ctx, asset, part);
    drawMirroredSource(ctx, sample.image, renderRect, asset.patchTransform, sample.rect, sample.drawBounds);
    ctx.restore();
    return {
      ok: true,
      assetId: asset.id,
      method: "symmetry",
      counterpartPartId: source.id,
      drawnBounds: boundsFromMatrix(renderRect, matrix),
      counterpartMaterialBounds: sample.materialBounds || null,
    };
  }

  function linkedSymmetryAsset(part, context = {}) {
    const draft = activeDraftForPart(part, context.state);
    const hidden = draft?.hiddenCompletion;
    if (!hidden?.assetId || hidden.assetStatus !== "ready") return null;
    const action = Animotion.cutsceneActionSelectors?.getActiveJointAction?.(context.state)?.action;
    const frame = context.frame || context.state?.currentFrame || 1;
    if (Animotion.actionScopedEffects?.draftAllowed && !Animotion.actionScopedEffects.draftAllowed(draft, action, frame, part?.id)) return null;
    const asset = Animotion.hiddenCompletionAssets?.findById?.(context.state?.project?.assets, hidden.assetId);
    if (asset?.completionMethod !== "symmetry" || asset.sourcePartId !== part?.id) return null;
    if (Animotion.hiddenCompletionSupplementalPart?.hasVisiblePartForPatch?.(context.state?.parts, asset.id, { action })) return null;
    return asset;
  }

  function activeDraftForPart(part, state = {}) {
    const action = Animotion.cutsceneActionSelectors?.getActiveJointAction?.(state)?.action;
    const linked = Animotion.motionDraftActionStore?.draftForPart?.(action, part?.id, { assets: state.project?.assets });
    if (linked) return linked;
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

  function drawMirroredSource(ctx, image, rect, transform = {}, sampleRect = null, drawBounds = null) {
    const translation = transform.translationNormalized || {};
    const baseX = rect.x + rect.w * 0.5, baseY = rect.y + rect.h * 0.5;
    const x = baseX + Number(translation.xNorm || 0) * rect.w;
    const y = baseY + Number(translation.yNorm || 0) * rect.h;
    const target = drawBounds || rect;
    ctx.translate(x, y);
    if (transform.rotation) ctx.rotate(Number(transform.rotation) * Math.PI / 180);
    ctx.scale(-Math.abs(Number(transform.scaleX) || 1), Math.abs(Number(transform.scaleY) || 1));
    const dx = baseX - target.x - target.w, dy = target.y - baseY;
    if (sampleRect) ctx.drawImage(image, sampleRect.x, sampleRect.y, sampleRect.w, sampleRect.h, dx, dy, target.w, target.h);
    else ctx.drawImage(image, dx, dy, target.w, target.h);
  }

  function coverageRect(asset, part, context = {}) {
    const rect = normalizeRect(part.rect);
    const points = guidePoints(asset);
    if (!Array.isArray(points) || points.length < 3) return rect;
    return clampRect(expandRect(unionRect(rect, guideRect(points, rect)), padding()), imageBounds(context.state));
  }

  function sourceSample(asset, counterpart, target, renderRect, context = {}) {
    const image = context.state?.image || null;
    const sampleRect = image && shouldSampleSourceImage(asset, target, counterpart)
      ? counterpartSampleRect(renderRect, target, counterpart, imageBounds(context.state))
      : null;
    if (!sampleRect) return { image: counterpart.canvas, rect: null };
    const materialBounds = expandedMaterialBounds(asset, target);
    const drawBounds = materialBounds ? drawBoundsForMaterial(sampleRect, counterpartMaterialRect(counterpart), materialBounds) : null;
    return { image, rect: sampleRect, drawBounds, materialBounds };
  }

  function shouldSampleSourceImage(asset, target, counterpart) {
    return guideExceedsSource(asset, target) || needsContextSampling(target, counterpart);
  }

  function guideExceedsSource(asset, target) {
    const rect = normalizeRect(target.rect);
    const bounds = guideRect(guidePoints(asset), rect);
    return bounds ? !containsRect(rect, bounds) : false;
  }

  function needsContextSampling(target, counterpart) {
    return [target?.humanRole, counterpart?.humanRole]
      .map((role) => String(role || "").toLowerCase())
      .some((role) => role === "upperarm");
  }

  function guidePoints(asset) {
    return asset?.guide?.silhouetteVerticesNormalized || asset?.maskVerticesNormalized || asset?.guide?.meshVerticesNormalized || [];
  }

  function guideRect(points, rect) {
    if (!Array.isArray(points) || !points.length) return null;
    const xs = points.map((point) => rect.x + number(point.xNorm ?? point.x ?? point[0]) * rect.w);
    const ys = points.map((point) => rect.y + number(point.yNorm ?? point.y ?? point[1]) * rect.h);
    return { x: Math.min(...xs), y: Math.min(...ys), w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys) };
  }

  function counterpartSampleRect(renderRect, target, counterpart, bounds) {
    const targetRect = normalizeRect(target.rect);
    const sourceRect = normalizeRect(counterpart.rect);
    const left = (renderRect.x - targetRect.x) / targetRect.w;
    const right = (renderRect.x + renderRect.w - targetRect.x) / targetRect.w;
    const top = (renderRect.y - targetRect.y) / targetRect.h;
    const bottom = (renderRect.y + renderRect.h - targetRect.y) / targetRect.h;
    return clampRect({
      x: sourceRect.x + (1 - right) * sourceRect.w,
      y: sourceRect.y + top * sourceRect.h,
      w: (right - left) * sourceRect.w,
      h: (bottom - top) * sourceRect.h,
    }, bounds);
  }

  function expandedMaterialBounds(asset, target) {
    if (!guideExceedsSource(asset, target)) return null;
    return guideRect(guidePoints(asset), normalizeRect(target.rect));
  }

  function counterpartMaterialRect(part = {}) {
    const rect = normalizeRect(part.rect);
    const local = localBounds(part.mask?.points);
    return local ? normalizeRect({ x: rect.x + local.x, y: rect.y + local.y, w: local.w, h: local.h }) : rect;
  }

  function drawBoundsForMaterial(sample, material, target) {
    const w = target.w * sample.w / Math.max(1, material.w);
    const h = target.h * sample.h / Math.max(1, material.h);
    const rightRatio = (material.x + material.w - sample.x) / Math.max(1, sample.w);
    const topRatio = (material.y - sample.y) / Math.max(1, sample.h);
    return { x: target.x - w + rightRatio * w, y: target.y - topRatio * h, w, h };
  }

  function localBounds(points = []) {
    if (!Array.isArray(points) || !points.length) return null;
    const xs = points.map((point) => number(point.x));
    const ys = points.map((point) => number(point.y));
    return { x: Math.min(...xs), y: Math.min(...ys), w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys) };
  }

  function boundsFromMatrix(rect, matrix) {
    if (!matrix) return rect;
    const points = [
      transformPoint(matrix, rect.x, rect.y),
      transformPoint(matrix, rect.x + rect.w, rect.y),
      transformPoint(matrix, rect.x + rect.w, rect.y + rect.h),
      transformPoint(matrix, rect.x, rect.y + rect.h),
    ];
    const xs = points.map((point) => point.x), ys = points.map((point) => point.y);
    return { x: Math.min(...xs), y: Math.min(...ys), w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys) };
  }

  function transformPoint(matrix, x, y) {
    return { x: matrix.a * x + matrix.c * y + matrix.e, y: matrix.b * x + matrix.d * y + matrix.f };
  }

  function unionRect(a, b) {
    if (!b) return a;
    const x = Math.min(a.x, b.x), y = Math.min(a.y, b.y);
    return { x, y, w: Math.max(a.x + a.w, b.x + b.w) - x, h: Math.max(a.y + a.h, b.y + b.h) - y };
  }

  function expandRect(rect, amount) {
    return { x: rect.x - amount, y: rect.y - amount, w: rect.w + amount * 2, h: rect.h + amount * 2 };
  }

  function containsRect(outer, inner) {
    const e = 0.001;
    return inner.x >= outer.x - e && inner.y >= outer.y - e && inner.x + inner.w <= outer.x + outer.w + e && inner.y + inner.h <= outer.y + outer.h + e;
  }

  function padding() {
    return Number(Animotion.hiddenCompletionCoverageBounds?.DEFAULT_PADDING || 4);
  }

  function clampRect(rect, bounds) {
    if (!bounds) return normalizeRect(rect);
    const width = Math.max(1, Number(bounds.width || bounds.w) || 1);
    const height = Math.max(1, Number(bounds.height || bounds.h) || 1);
    const x = Math.max(0, rect.x), y = Math.max(0, rect.y);
    const maxX = Math.min(width, rect.x + rect.w), maxY = Math.min(height, rect.y + rect.h);
    return normalizeRect({ x, y, w: Math.max(1, maxX - x), h: Math.max(1, maxY - y) });
  }

  function imageBounds(state = {}) {
    return state.image ? { width: state.image.naturalWidth, height: state.image.naturalHeight } : null;
  }

  function normalizeRect(rect = {}) {
    return { x: Math.round(Number(rect.x) || 0), y: Math.round(Number(rect.y) || 0), w: Math.max(1, Math.round(Number(rect.w) || 1)), h: Math.max(1, Math.round(Number(rect.h) || 1)) };
  }

  function number(value) {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : 0;
  }

  function applyMatrix(ctx, matrix) {
    ctx.transform(matrix.a, matrix.b, matrix.c, matrix.d, matrix.e, matrix.f);
  }

  Animotion.hiddenCompletionRender = { drawForPart, linkedSymmetryAsset };
  if (typeof module !== "undefined") module.exports = Animotion.hiddenCompletionRender;
}
