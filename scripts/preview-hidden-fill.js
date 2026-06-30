{
  const global = window;
  const Animotion = global.Animotion;
  const state = Animotion.state;

  function requests(cutscene) {
    const items = [];
    for (const source of state.parts) {
      if (!source || source.hidden || !runtimeVisible(source, cutscene, state.currentFrame || 1) || isSupplementalPart(source)) continue;
      const direct = directFillRequest(source);
      if (direct) items.push(direct);
      for (const supplemental of state.parts) {
        if (shouldDrawSupplementalPart(supplemental, source, cutscene)) items.push(supplementalFillRequest(supplemental, source));
      }
    }
    return items.filter(Boolean).map((request) => ({
      ...request,
      schedule: Animotion.hiddenCompletionFillScheduler?.schedule?.(request, state.parts) || emptyFillSchedule(request),
    }));
  }

  function drawDueBefore(part, context, requestList, drawnAssetIds, drawnSupplementalIds) {
    for (const request of requestList) {
      if (request.schedule.scheduledBeforePartIds.includes(part.id)) {
        drawFill(request, context, drawnAssetIds, drawnSupplementalIds);
      }
    }
  }

  function drawRemaining(context, requestList, drawnAssetIds, drawnSupplementalIds) {
    for (const request of requestList) drawFill(request, context, drawnAssetIds, drawnSupplementalIds);
  }

  function drawFill(request, context, drawnAssetIds, drawnSupplementalIds) {
    if (request.visiblePath === "direct-ready-patch") {
      if (drawnAssetIds.has(request.asset.id)) return;
      const result = Animotion.previewPartRenderer.drawHiddenCompletionPatch(request.source, context, request);
      if (result?.assetId) drawnAssetIds.add(result.assetId);
      return;
    }
    if (drawnSupplementalIds.has(request.part.id)) return;
    const sourceMatrix = context.worldMatrix(request.source, context.t, context.matrixCache);
    const matrix = Animotion.previewSupplementalRenderer?.supplementalRuntimeMatrix?.(request.part, sourceMatrix, context) || sourceMatrix;
    context.previewCtx.save();
    context.applyMatrix(context.previewCtx, matrix);
    Animotion.previewSupplementalRenderer.drawSupplementalPart(request.part, request.source, matrix, context, request);
    drawnSupplementalIds.add(request.part.id);
    context.previewCtx.restore();
  }

  function directFillRequest(source) {
    const asset = Animotion.hiddenCompletionRender?.linkedSymmetryAsset?.(source, { state, parts: state.parts });
    if (!asset) return null;
    return {
      visiblePath: "direct-ready-patch",
      requestId: asset.id,
      sourcePartId: source.id,
      counterpartPartId: asset.symmetrySource?.counterpartPartId || null,
      source,
      asset,
      bounds: directFillBounds(asset, source),
    };
  }

  function supplementalFillRequest(part, source) {
    return {
      visiblePath: "supplemental-part",
      requestId: part.id,
      sourcePartId: source.id,
      counterpartPartId: part.counterpartPartId || null,
      source,
      part,
      bounds: supplementalFillBounds(part),
    };
  }

  function directFillBounds(asset, source) {
    const rect = source.rect || {};
    const points = asset?.guide?.silhouetteVerticesNormalized || asset?.maskVerticesNormalized || asset?.guide?.meshVerticesNormalized || [];
    return boundsFromPoints(points.map((point) => ({
      x: Number(rect.x || 0) + Number(point.xNorm ?? point.x ?? 0) * Number(rect.w || 0),
      y: Number(rect.y || 0) + Number(point.yNorm ?? point.y ?? 0) * Number(rect.h || 0),
    }))) || rectBounds(rect);
  }

  function supplementalFillBounds(part) {
    const rect = part.rect || {};
    return boundsFromPoints((part.mask?.points || []).map((point) => ({
      x: Number(rect.x || 0) + Number(point.x || 0),
      y: Number(rect.y || 0) + Number(point.y || 0),
    }))) || rectBounds(rect);
  }

  function hiddenFillDebug(request) {
    if (!request) return {};
    const foregroundBefore = drawnForegroundBefore(request);
    return {
      hiddenCompletionFillScheduler: true,
      visiblePath: request.visiblePath,
      scheduledBeforePartIds: request.schedule.scheduledBeforePartIds,
      foregroundOccluderIds: request.schedule.foregroundOccluderIds,
      foregroundDrawnBeforeFill: foregroundBefore,
      unexpectedForegroundBeforeFill: foregroundBefore.length > 0,
      wasDepthTopUpSkipped: true,
    };
  }

  function drawnForegroundBefore(request) {
    const occluders = new Set(request.schedule?.foregroundOccluderIds || []);
    const sequence = state.previewDrawSequenceDebug?.sequence || [];
    return sequence.filter((entry) => entry.kind === "part" && occluders.has(entry.partId) && entry.pass === "main-part").map((entry) => entry.partId);
  }

  function shouldDrawSupplementalPart(part, source, cutscene) {
    if (!isSupplementalPart(part) || part.hidden || part.sourcePartId !== source.id || !part.canvas) return false;
    if (!runtimeVisible(source, cutscene, state.currentFrame || 1)) return false;
    if (!runtimeVisible(part, cutscene, state.currentFrame || 1)) return false;
    const action = cutscene?.bridge?.jointAction || null;
    const frame = state.currentFrame || 1;
    return Animotion.actionScopedEffects?.supplementalAllowed?.(part, action, frame) !== false;
  }

  function boundsFromPoints(points = []) {
    if (!points.length) return null;
    const xs = points.map((point) => Number(point.x) || 0), ys = points.map((point) => Number(point.y) || 0);
    const x = Math.min(...xs), y = Math.min(...ys);
    return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y };
  }

  function rectBounds(rect = {}) {
    return { x: Number(rect.x) || 0, y: Number(rect.y) || 0, w: Number(rect.w) || 0, h: Number(rect.h) || 0 };
  }

  function emptyFillSchedule(request) {
    return { visiblePath: request.visiblePath || null, sourcePartId: request.sourcePartId || null, requestId: request.requestId || null, foregroundOccluderIds: [], scheduledBeforePartIds: [] };
  }

  function isSupplementalPart(part) { return part?.isSupplementalPart === true; }
  function runtimeVisible(part, cutscene, frame) {
    return Animotion.actionPartVisibility?.runtimeVisible?.(part, { action: cutscene?.bridge?.jointAction || null, frame }) !== false;
  }

  Animotion.previewHiddenFill = { requests, drawDueBefore, drawRemaining, hiddenFillDebug, shouldDrawSupplementalPart, isSupplementalPart };
}
