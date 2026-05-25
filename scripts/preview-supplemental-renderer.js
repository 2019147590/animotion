{
  const global = window;
  const Animotion = global.Animotion;
  const state = Animotion.state;

  function drawDueSupplementalsBefore(part, context, drawnSupplementalIds, hiddenFillRequests = []) {
    const currentOrder = context.baseOrder(part);
    for (const source of supplementalSourcesBefore(currentOrder, context.cutscene, drawnSupplementalIds)) {
      drawSupplementalPartsForSource(source, context, null, drawnSupplementalIds, hiddenFillRequests);
    }
  }

  function supplementalSourcesBefore(order, cutscene, drawnSupplementalIds) {
    const sources = new Map();
    for (const supplemental of state.parts) {
      if (!Animotion.previewHiddenFill.isSupplementalPart(supplemental) || drawnSupplementalIds.has(supplemental.id)) continue;
      const source = state.parts.find((part) => part.id === supplemental.sourcePartId);
      if (!source || source.hidden || Animotion.previewHiddenFill.isSupplementalPart(source) || baseOrder(source) >= order) continue;
      if (Animotion.previewHiddenFill.shouldDrawSupplementalPart(supplemental, source, cutscene)) sources.set(source.id, source);
    }
    return [...sources.values()].sort((a, b) => baseOrder(a) - baseOrder(b));
  }

  function drawSupplementalPartsForSource(source, context, activeMatrix = null, drawnSupplementalIds = null, hiddenFillRequests = []) {
    const items = state.parts.filter((part) => Animotion.previewHiddenFill.shouldDrawSupplementalPart(part, source, context.cutscene));
    if (!items.length) return;
    const matrix = activeMatrix || context.worldMatrix(source, context.t, context.matrixCache);
    let restore = false;
    if (!activeMatrix) {
      context.previewCtx.save();
      context.applyMatrix(context.previewCtx, matrix);
      restore = true;
    }
    for (const part of items) {
      if (drawnSupplementalIds?.has(part.id)) continue;
      drawSupplementalPart(part, source, matrix, context, requestForSupplemental(part, hiddenFillRequests));
      drawnSupplementalIds?.add(part.id);
    }
    if (restore) context.previewCtx.restore();
  }

  function drawSupplementalPart(part, source, matrix, context, request = null) {
    const coverage = Animotion.hiddenCompletionSupplementalPart?.coverageForPart?.(part) || null;
    if (coverage) part.supplementalCoverage = coverage;
    context.previewCtx.save();
    clipSupplementalPart(context.previewCtx, part);
    context.previewCtx.globalAlpha = (part.alpha ?? 1) * context.alpha;
    const warped = Animotion.hiddenCompletionSupplementalWarp?.drawImage?.(context.previewCtx, part);
    if (warped === undefined) context.previewCtx.drawImage(part.canvas, part.rect.x, part.rect.y, part.rect.w, part.rect.h);
    context.previewCtx.restore();
    context.recordPartDraw(part, "supplemental-part", context.drawPass, Animotion.renderOrderDebug?.boundsFromMatrix?.(part, matrix), {
      renderGroupPartId: source.id,
      sourcePatchAssetId: part.sourcePatchAssetId || null,
      supplementalCoverage: coverage,
      supplementalWarpApplied: Boolean(warped),
      finalSortKey: Animotion.renderLayerUtils?.baseOrder?.(source) ?? Number(source.order || 0),
      ...Animotion.previewHiddenFill.hiddenFillDebug(request),
    });
    drawSelectedSupplementalOutline(part, source, matrix, context);
  }

  function drawSelectedSupplementalOutline(part, source, matrix, context) {
    if (context.drawPass !== "main-part" || context.alpha !== 1 || !context.editingLayerVisible() || part.id !== state.selectedPartId) return;
    context.previewCtx.lineWidth = 2 / context.sourceScale(context.view);
    context.previewCtx.strokeStyle = "#e1462e";
    context.previewCtx.stroke(context.pathFromShape(context.geometry.absoluteShapeFromPart(part)));
    context.recordPartDraw(part, "selection-overlay", "selection-overlay", Animotion.renderOrderDebug?.boundsFromMatrix?.(part, matrix), { renderGroupPartId: source.id });
  }

  function clipSupplementalPart(ctx, part) {
    const points = part.mask?.points?.length ? part.mask.points : [
      { x: 0, y: 0 },
      { x: part.rect.w, y: 0 },
      { x: part.rect.w, y: part.rect.h },
      { x: 0, y: part.rect.h },
    ];
    ctx.beginPath();
    points.forEach((point, index) => {
      const x = part.rect.x + Number(point.x || 0);
      const y = part.rect.y + Number(point.y || 0);
      if (index) ctx.lineTo(x, y);
      else ctx.moveTo(x, y);
    });
    ctx.closePath();
    ctx.clip();
  }

  function requestForSupplemental(part, requests = []) {
    return requests.find((request) => request.visiblePath === "supplemental-part" && request.part?.id === part.id) || null;
  }

  function baseOrder(part) {
    return Animotion.renderLayerUtils?.baseOrder?.(part) ?? Number(part?.order || 0);
  }

  Animotion.previewSupplementalRenderer = { drawDueSupplementalsBefore, drawSupplementalPartsForSource, drawSupplementalPart };
}
