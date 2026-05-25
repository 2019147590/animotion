{
  const global = window;
  const Animotion = global.Animotion;
  const { previewCanvas, previewCtx, els } = Animotion.dom;
  const state = Animotion.state;
  const geometry = Animotion.geometry;
  const { pathFromShape } = Animotion.path;
  let lastCutsceneGhostTime = 0;
  function drawPreview(now, drawEmpty, drawPivot) {
    Animotion.view.resizeCanvas(previewCanvas);
    const dpr = window.devicePixelRatio || 1;
    const w = previewCanvas.width / dpr;
    const h = previewCanvas.height / dpr;
    previewCtx.save();
    previewCtx.scale(dpr, dpr);
    previewCtx.clearRect(0, 0, w, h);
    if (!state.image) {
      previewCtx.restore();
      drawEmpty(previewCtx, previewCanvas, "리그 미리보기가 여기에 표시됩니다");
      return;
    }
    if (state.lookismPreset?.active && els.motionTemplate.value === "cutscene") {
      Animotion.lookismPreset.drawPreview(previewCtx, w, h, now);
      previewCtx.restore();
      return;
    }
    const view = geometry.fitRect(state.image.naturalWidth, state.image.naturalHeight, w, h);
    state.previewView = view;
    const cutscene = cutsceneValues(now);
    state.previewSourceFrame = Animotion.previewTransform.sourceFrame();
    state.previewSourceTransform = sourceTransformFor(cutscene);
    Animotion.renderOrderDebug?.begin?.(state, state.currentFrame);
    previewCtx.translate(cutscene.shake, -cutscene.shake * 0.28);
    drawBackground(view, w, h, cutscene);
    drawCutsceneEffects(view, w, h, cutscene);
    drawGhostParts(view, now, cutscene);
    const matrixCache = drawParts(view, now, cutscene);
    drawImpactLayers(view, w, h, cutscene, now);
    drawSelectedRigPoints(view, now, matrixCache, drawPivot);
    lastCutsceneGhostTime = cutscene.time || 0;
    Animotion.correspondenceEditor?.drawOverlay?.(previewCtx, view);
    recordDraw({ kind: "overlay", pass: "correspondence-overlay" });
    Animotion.motionPlanner?.drawOverlay?.(previewCtx, view, cutscene);
    recordDraw({ kind: "overlay", pass: "motion-planner-overlay" });
    Animotion.hiddenCompletionGuideEditor?.drawOverlay?.(previewCtx, view);
    recordDraw({ kind: "overlay", pass: "hidden-completion-overlay" });
    Animotion.hiddenCompletionSupplementalWarpEditor?.drawOverlay?.(previewCtx, view);
    recordDraw({ kind: "overlay", pass: "hidden-completion-warp-overlay" });
    previewCtx.restore();
  }
  function drawBackground(view, w, h, cutscene) {
    previewCtx.fillStyle = "#f7f0df";
    previewCtx.fillRect(0, 0, w, h);
    recordDraw({ kind: "background", pass: "background-fill" });
    drawSourcePanel(view, cutscene, Number(els.backgroundOpacity.value));
    if (state.nextImage && editingLayerVisible()) {
      const bridge = Animotion.cutsceneModel.normalizeBridge(state.cutsceneBridge);
      Animotion.cutsceneEffects.drawPanelImage(previewCtx, impactPanelImage(), view, Number(els.impactReferenceOpacity.value), { x: bridge.impactX, y: bridge.impactY, scale: bridge.impactScale });
    }
    previewCtx.globalAlpha = 1;
  }
  function drawSourcePanel(view, cutscene, baseAlpha) {
    const transform = sourceTransformFor(cutscene);
    const alpha = baseAlpha * (cutscene.active && cutscene.bridge.sourceMotionEnabled ? cutscene.values.sourceAlpha : 1);
    const source = sourcePanelImage(cutscene);
    if (cutscene.active && cutscene.bridge.sourceMotionEnabled) drawSourcePanelGhosts(source.image, view, cutscene, baseAlpha);
    Animotion.cutsceneEffects.drawPanelImage(previewCtx, source.image, view, alpha, transform);
    recordDraw({ kind: "panel", pass: "source-panel", drawPath: "source-panel", alpha, sourcePanelMode: source.mode, erasedPartIds: source.erasedPartIds, sourcePanelConflictRisk: source.conflictRisk });
  }
  function drawSourcePanelGhosts(image, view, cutscene, baseAlpha) {
    if (!cutscene.bridge.ghostEnabled) return;
    const values = cutscene.values;
    if (values.launch <= 0.02 || values.sourceAlpha <= 0.02) return;
    const start = cutscene.bridge;
    for (let i = 3; i >= 1; i -= 1) {
      const ghost = i / 4;
      const transform = { x: values.sourceX - (values.sourceX - start.sourceX) * ghost, y: values.sourceY - (values.sourceY - start.sourceY) * ghost, scale: values.sourceScale * (1 + ghost * 0.06), rotation: values.sourceRotation + ghost * 0.12 * Math.sign(cutscene.bridge.effectDirection.x) };
      const alpha = baseAlpha * values.sourceAlpha * values.launch * 0.12 * (4 - i);
      Animotion.cutsceneEffects.drawPanelImage(previewCtx, image, view, alpha, transform);
      recordDraw({ kind: "panel", pass: "source-panel-ghost", drawPath: "source-panel-ghost", alpha });
    }
  }
  function sourcePanelImage(cutscene) {
    const runtimeErase = shouldEraseSourceRigParts(cutscene);
    const erasedPartIds = runtimeErase || state.separateCharacter ? visiblePartIds() : [];
    if (Animotion.panelEditor) {
      const plate = Animotion.panelEditor.createPanelCanvas("source", { removeCharacter: state.separateCharacter || runtimeErase });
      if ((state.separateCharacter || runtimeErase) && !Animotion.panelEditor.characterMask("source")) erasePartsFromPanel(plate);
      return sourcePanelResult(plate, runtimeErase, erasedPartIds);
    }
    if ((!state.separateCharacter && !runtimeErase) || state.parts.length === 0) return sourcePanelResult(state.image, false, []);
    const plate = document.createElement("canvas");
    plate.width = state.image.naturalWidth;
    plate.height = state.image.naturalHeight;
    const ctx = plate.getContext("2d");
    ctx.drawImage(state.image, 0, 0);
    erasePartsFromPanel(plate);
    return sourcePanelResult(plate, runtimeErase, erasedPartIds);
  }
  function erasePartsFromPanel(plate) {
    if (!plate || !state.parts.length) return;
    const crop = Animotion.panelEditor?.setupFor?.("source")?.crop || { x: 0, y: 0 };
    const ctx = plate.getContext("2d");
    ctx.globalCompositeOperation = "destination-out";
    for (const part of state.parts) {
      if (!part.hidden) ctx.fill(pathFromShape(geometry.absoluteShapeFromPart(part), -crop.x, -crop.y));
    }
    ctx.globalCompositeOperation = "source-over";
  }
  function sourcePanelResult(image, runtimeErase, erasedPartIds) {
    const mode = runtimeErase ? "runtime-part-erased" : state.separateCharacter ? "separated-character" : "source-original";
    return { image, mode, erasedPartIds, conflictRisk: mode === "source-original" && erasedPartIds.length === 0 };
  }
  function shouldEraseSourceRigParts(cutscene) {
    if (!cutscene?.active || !state.parts.length) return false;
    const actionStatus = Animotion.cutsceneActionSelectors?.getActiveJointAction?.(cutscene.bridge) || {};
    if (actionStatus.active && Array.isArray(actionStatus.action?.beats)) return true;
    return state.parts.some((part) => Array.isArray(part.keyframes) && part.keyframes.length);
  }
  function visiblePartIds() {
    return state.parts.filter((part) => !part.hidden).map((part) => part.id);
  }
  function impactPanelImage() {
    return Animotion.panelEditor?.createPanelCanvas("impact") || state.nextImage;
  }
  function drawParts(view, now, cutscene) {
    const t = state.running ? (now - state.startTime) / 1000 : state.pausedTime;
    syncTimelineFrame(t);
    const matrixCache = new Map();
    const drawnSupplementalIds = new Set();
    const drawnHiddenCompletionAssetIds = new Set();
    const ordered = orderedPartsForFrame(t, cutscene);
    const hiddenFillRequests = hiddenCompletionFillRequests(cutscene);
    previewCtx.save();
    Animotion.previewTransform.applySourceFrame(previewCtx, view, state.previewSourceFrame, state.previewSourceTransform);
    for (const part of ordered) {
      drawDueHiddenCompletionFillsBefore(part, t, matrixCache, view, 1, cutscene, "main-part", hiddenFillRequests, drawnHiddenCompletionAssetIds, drawnSupplementalIds);
      if (part.hidden || isSupplementalPart(part)) continue;
      drawDueSupplementalsBefore(part, t, matrixCache, view, 1, cutscene, "main-part", drawnSupplementalIds, hiddenFillRequests);
      drawPart(part, t, matrixCache, view, 1, cutscene, null, { drawnSupplementalIds, hiddenFillRequests });
    }
    drawRemainingHiddenCompletionFills(t, matrixCache, view, 1, cutscene, "main-part", hiddenFillRequests, drawnHiddenCompletionAssetIds, drawnSupplementalIds);
    previewCtx.restore();
    state.motionEvaluationDebug = cutscene?.active
      ? Animotion.characterRootMotion?.evaluationDebug?.(state.parts, state.currentFrame, cutscene.bridge)
      : null;
    return matrixCache;
  }
  function drawHiddenCompletionPatch(part, t, matrixCache, request = null) {
    const result = Animotion.hiddenCompletionRender?.drawForPart?.(previewCtx, part, { state, parts: state.parts, t, matrixCache, worldMatrix });
    if (!result) return;
    recordPartDraw(part, result.ok ? "hidden-completion-symmetry" : "hidden-completion-symmetry-failed", "hidden-completion-patch", result.drawnBounds, {
      hiddenCompletionPatchId: result.assetId,
      completionMethod: result.method || "symmetry",
      counterpartPartId: result.counterpartPartId || null,
      hiddenCompletionRenderFailure: result.ok === false,
      hiddenCompletionRenderReason: result.reason || null,
      ...hiddenFillDebug(request),
    });
    return result;
  }
  function drawGhostParts(view, now, cutscene) {
    if (!state.running) return;
    if (!cutscene.active || !cutscene.bridge.ghostEnabled || cutscene.values.ghostAlpha <= 0.01) return;
    previewCtx.save();
    Animotion.previewTransform.applySourceFrame(previewCtx, view, state.previewSourceFrame, state.previewSourceTransform);
    for (const delay of Animotion.cutsceneModel.GHOST_DELAYS) drawGhostPass(Math.max(0, lastCutsceneGhostTime - delay), Animotion.cutsceneModel.GHOST_ALPHA_RATIO, cutscene);
    previewCtx.restore();
  }
  function drawGhostPass(t, alpha, cutscene) {
    if (t < 0) return;
    const matrixCache = new Map();
    for (const part of orderedPartsForFrame(t, cutscene)) {
      if (!part.hidden && !isSupplementalPart(part)) drawPart(part, t, matrixCache, state.previewView, alpha, cutscene);
    }
  }
  function syncTimelineFrame(t) {
    if (!state.running || !timelineLikeMode()) return;
    state.currentFrame = currentMotionFrame(t);
    els.currentFrame.value = String(state.currentFrame);
    els.frameLabel.textContent = String(state.currentFrame);
  }
  function drawPart(part, t, matrixCache, view, alpha = 1, cutscene = null, pass = null, options = {}) {
    const drawPass = pass || (alpha === 1 ? "main-part" : "ghost-part");
    const drawSupplementals = options.drawSupplementals !== false;
    const frame = state.running ? currentMotionFrame(t) : state.currentFrame;
    const context = { parts: state.parts, bridge: cutscene?.bridge, frame, selectedPartId: state.selectedPartId };
    const replacementPlan = Animotion.motionReplacementLayer?.planForPart?.(part, context);
    const replacement = replacementPlan?.active
      ? Animotion.motionReplacementRender?.draw?.(previewCtx, part, replacementPlan, alpha) || { ok: false, reason: "missing-replacement-renderer", fallbackUsed: true }
      : null;
    if (replacement?.ok) {
      recordPartDraw(part, "motion-replacement", drawPass, replacement.drawnBounds, {
        handTipSource: replacementPlan.handTipSource,
        punchStyleSource: replacementPlan.punchStyleSource,
        legacyDepthCompat: replacementPlan.legacyDepthCompat,
        replacementRenderOk: true,
        skippedNormalArmDraw: true,
        replacementRenderResult: compactReplacementResult(replacement),
      });
      if (drawSupplementals) drawSupplementalPartsForSource(part, t, matrixCache, view, alpha, cutscene, drawPass, null, options.drawnSupplementalIds, options.hiddenFillRequests);
      return;
    }
    if (replacement && replacement.ok === false) {
      recordPartDraw(part, "motion-replacement-failed", drawPass, replacement.drawnBounds || Animotion.renderOrderDebug?.boundsFromControls?.(replacementPlan.controls), {
        handTipSource: replacementPlan.handTipSource,
        punchStyleSource: replacementPlan.punchStyleSource,
        legacyDepthCompat: replacementPlan.legacyDepthCompat,
        replacementRenderFailure: true,
        replacementRenderReason: replacement.reason,
        replacementRenderResult: compactReplacementResult(replacement),
      });
    }
    const hint = replacement ? null : Animotion.armExtension?.renderHintForPart?.(part, context);
    const segmented = hint?.active ? Animotion.armExtension.drawSegmentedPart(previewCtx, part, hint, alpha) : null;
    if (segmented?.ok) {
      const drawPath = segmented.renderMode === "action-pose-patch" ? "action-pose-patch" : "segmented-arm";
      recordPartDraw(part, drawPath, drawPass, segmented.drawnBounds || Animotion.renderOrderDebug?.boundsFromControls?.(hint.controls), { handTipSource: hint.handTipSource, punchStyleSource: hint.punchStyleSource, legacyDepthCompat: hint.legacyDepthCompat, segmentedRenderResult: compactSegmentedResult(segmented) });
      if (drawSupplementals) drawSupplementalPartsForSource(part, t, matrixCache, view, alpha, cutscene, drawPass, null, options.drawnSupplementalIds, options.hiddenFillRequests);
      return;
    }
    if (segmented && segmented.ok === false) recordPartDraw(part, "segmented-arm-failed", drawPass, segmented.drawnBounds || Animotion.renderOrderDebug?.boundsFromControls?.(hint.controls), { handTipSource: hint.handTipSource, punchStyleSource: hint.punchStyleSource, legacyDepthCompat: hint.legacyDepthCompat, segmentedRenderFailure: true, segmentedRenderReason: segmented.reason, segmentedRenderResult: compactSegmentedResult(segmented) });
    const matrix = worldMatrix(part, t, matrixCache);
    previewCtx.save();
    applyMatrix(previewCtx, matrix);
    previewCtx.globalAlpha = part.alpha * alpha;
    previewCtx.drawImage(part.canvas, part.rect.x, part.rect.y, part.rect.w, part.rect.h);
    recordPartDraw(part, "normal-part", drawPass, Animotion.renderOrderDebug?.boundsFromMatrix?.(part, matrix), { fallbackForSegmentedRender: Boolean(segmented && segmented.ok === false), segmentedRenderReason: segmented?.reason || null, fallbackToNormalArm: Boolean(replacement && replacement.ok === false), replacementRenderReason: replacement?.reason || null });
    if (drawSupplementals) drawSupplementalPartsForSource(part, t, matrixCache, view, alpha, cutscene, drawPass, matrix, options.drawnSupplementalIds, options.hiddenFillRequests);
    if (drawPass === "main-part" && alpha === 1 && editingLayerVisible() && part.id === state.selectedPartId) {
      previewCtx.lineWidth = 2 / sourceScale(view);
      previewCtx.strokeStyle = "#e1462e";
      previewCtx.stroke(pathFromShape(geometry.absoluteShapeFromPart(part)));
      recordPartDraw(part, "selection-overlay", "selection-overlay", Animotion.renderOrderDebug?.boundsFromMatrix?.(part, matrix));
    }
    previewCtx.restore();
  }
  function drawDueHiddenCompletionFillsBefore(part, t, matrixCache, view, alpha, cutscene, drawPass, requests, drawnAssetIds, drawnSupplementalIds) {
    for (const request of requests) {
      if (!request.schedule.scheduledBeforePartIds.includes(part.id)) continue;
      drawHiddenCompletionFill(request, t, matrixCache, view, alpha, cutscene, drawPass, drawnAssetIds, drawnSupplementalIds);
    }
  }
  function drawRemainingHiddenCompletionFills(t, matrixCache, view, alpha, cutscene, drawPass, requests, drawnAssetIds, drawnSupplementalIds) {
    for (const request of requests) drawHiddenCompletionFill(request, t, matrixCache, view, alpha, cutscene, drawPass, drawnAssetIds, drawnSupplementalIds);
  }
  function drawHiddenCompletionFill(request, t, matrixCache, view, alpha, cutscene, drawPass, drawnAssetIds, drawnSupplementalIds) {
    if (request.visiblePath === "direct-ready-patch") {
      if (drawnAssetIds.has(request.asset.id)) return;
      const result = drawHiddenCompletionPatch(request.source, t, matrixCache, request);
      if (result?.assetId) drawnAssetIds.add(result.assetId);
      return;
    }
    if (drawnSupplementalIds.has(request.part.id)) return;
    const matrix = worldMatrix(request.source, t, matrixCache);
    previewCtx.save();
    applyMatrix(previewCtx, matrix);
    drawSupplementalPart(request.part, request.source, matrix, view, alpha, drawPass, request);
    drawnSupplementalIds.add(request.part.id);
    previewCtx.restore();
  }
  function drawDueSupplementalsBefore(part, t, matrixCache, view, alpha, cutscene, drawPass, drawnSupplementalIds, hiddenFillRequests = []) {
    const currentOrder = baseOrder(part);
    for (const source of supplementalSourcesBefore(currentOrder, cutscene, drawnSupplementalIds)) {
      drawSupplementalPartsForSource(source, t, matrixCache, view, alpha, cutscene, drawPass, null, drawnSupplementalIds, hiddenFillRequests);
    }
  }
  function supplementalSourcesBefore(order, cutscene, drawnSupplementalIds) {
    const sources = new Map();
    for (const supplemental of state.parts) {
      if (!isSupplementalPart(supplemental) || drawnSupplementalIds.has(supplemental.id)) continue;
      const source = state.parts.find((part) => part.id === supplemental.sourcePartId);
      if (!source || source.hidden || isSupplementalPart(source) || baseOrder(source) >= order) continue;
      if (shouldDrawSupplementalPart(supplemental, source, cutscene)) sources.set(source.id, source);
    }
    return [...sources.values()].sort((a, b) => baseOrder(a) - baseOrder(b));
  }
  function drawSupplementalPartsForSource(source, t, matrixCache, view, alpha, cutscene, drawPass, activeMatrix = null, drawnSupplementalIds = null, hiddenFillRequests = []) {
    const items = state.parts.filter((part) => shouldDrawSupplementalPart(part, source, cutscene));
    if (!items.length) return;
    const matrix = activeMatrix || worldMatrix(source, t, matrixCache);
    let restore = false;
    if (!activeMatrix) {
      previewCtx.save();
      applyMatrix(previewCtx, matrix);
      restore = true;
    }
    for (const part of items) {
      if (drawnSupplementalIds?.has(part.id)) continue;
      drawSupplementalPart(part, source, matrix, view, alpha, drawPass, requestForSupplemental(part, hiddenFillRequests));
      drawnSupplementalIds?.add(part.id);
    }
    if (restore) previewCtx.restore();
  }
  function drawSupplementalPart(part, source, matrix, view, alpha, drawPass, request = null) {
    const coverage = Animotion.hiddenCompletionSupplementalPart?.coverageForPart?.(part) || null;
    if (coverage) part.supplementalCoverage = coverage;
    previewCtx.save();
    clipSupplementalPart(previewCtx, part);
    previewCtx.globalAlpha = (part.alpha ?? 1) * alpha;
    const warped = Animotion.hiddenCompletionSupplementalWarp?.drawImage?.(previewCtx, part);
    if (warped === undefined) previewCtx.drawImage(part.canvas, part.rect.x, part.rect.y, part.rect.w, part.rect.h);
    previewCtx.restore();
    recordPartDraw(part, "supplemental-part", drawPass, Animotion.renderOrderDebug?.boundsFromMatrix?.(part, matrix), {
      renderGroupPartId: source.id,
      sourcePatchAssetId: part.sourcePatchAssetId || null,
      supplementalCoverage: coverage,
      supplementalWarpApplied: Boolean(warped),
      finalSortKey: Animotion.renderLayerUtils?.baseOrder?.(source) ?? Number(source.order || 0),
      ...hiddenFillDebug(request),
    });
    if (drawPass === "main-part" && alpha === 1 && editingLayerVisible() && part.id === state.selectedPartId) {
      previewCtx.lineWidth = 2 / sourceScale(view);
      previewCtx.strokeStyle = "#e1462e";
      previewCtx.stroke(pathFromShape(geometry.absoluteShapeFromPart(part)));
      recordPartDraw(part, "selection-overlay", "selection-overlay", Animotion.renderOrderDebug?.boundsFromMatrix?.(part, matrix), { renderGroupPartId: source.id });
    }
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
  function hiddenCompletionFillRequests(cutscene) {
    const requests = [];
    for (const source of state.parts) {
      if (!source || source.hidden || isSupplementalPart(source)) continue;
      const direct = directFillRequest(source);
      if (direct) requests.push(direct);
      for (const supplemental of state.parts) {
        if (shouldDrawSupplementalPart(supplemental, source, cutscene)) requests.push(supplementalFillRequest(supplemental, source));
      }
    }
    return requests.filter(Boolean).map((request) => ({
      ...request,
      schedule: Animotion.hiddenCompletionFillScheduler?.schedule?.(request, state.parts) || emptyFillSchedule(request),
    }));
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
  function boundsFromPoints(points = []) {
    if (!points.length) return null;
    const xs = points.map((point) => Number(point.x) || 0), ys = points.map((point) => Number(point.y) || 0);
    const x = Math.min(...xs), y = Math.min(...ys);
    return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y };
  }
  function rectBounds(rect = {}) {
    return { x: Number(rect.x) || 0, y: Number(rect.y) || 0, w: Number(rect.w) || 0, h: Number(rect.h) || 0 };
  }
  function requestForSupplemental(part, requests = []) {
    return requests.find((request) => request.visiblePath === "supplemental-part" && request.part?.id === part.id) || null;
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
  function emptyFillSchedule(request) {
    return {
      visiblePath: request.visiblePath || null,
      sourcePartId: request.sourcePartId || null,
      requestId: request.requestId || null,
      foregroundOccluderIds: [],
      scheduledBeforePartIds: [],
    };
  }
  function shouldDrawSupplementalPart(part, source, cutscene) {
    if (!isSupplementalPart(part) || part.hidden || part.sourcePartId !== source.id || !part.canvas) return false;
    const actionId = currentActionId(cutscene);
    return !part.createdForActionId || !actionId || part.createdForActionId === actionId;
  }
  function isSupplementalPart(part) {
    return part?.isSupplementalPart === true;
  }
  function currentActionId(cutscene) {
    const action = cutscene?.bridge?.jointAction;
    return action?.id || action?.actionId || action?.source || null;
  }
  function drawSelectedRigPoints(view, now, matrixCache, drawPivot) {
    const part = Animotion.parts.selectedPart();
    if (!editingLayerVisible() || !part) return;
    state.renderedPointDebug = [];
    const t = state.running ? (now - state.startTime) / 1000 : state.pausedTime;
    const matrix = worldMatrix(part, t, matrixCache);
    for (const point of rigPointsFor(part)) drawRigPoint(part, point, matrix, view, drawPivot);
    const root = Animotion.rigConnection?.bodyRootPoint?.(state.parts);
    if (root) drawRigPoint(root.part, root, worldMatrix(root.part, t, matrixCache), view, drawPivot);
  }
  function rigPointsFor(part) {
    const parent = parentPart(part);
    return (Animotion.rigConnection?.previewPoints?.(part, parent) || [
      { role: "rotationPivot", localPoint: part.pivot },
      { role: "joint", localPoint: part.joint },
    ]);
  }
  function cutsceneValues(now) {
    if (els.motionTemplate.value !== "cutscene") return { active: false, shake: 0 };
    const bridge = Animotion.cutsceneModel.normalizeBridge(state.cutsceneBridge || Animotion.cutsceneModel.createBridge(state.parts, state.selectedPartId));
    const t = state.running ? (now - state.startTime) / 1000 : state.pausedTime;
    const values = Animotion.cutsceneModel.bridgeValues(t, bridge, Animotion.config.timelineFps);
    return { active: true, bridge, values, shake: values.shake, time: t };
  }
  function drawCutsceneEffects(view, w, h, cutscene) {
    if (!cutscene.active) return;
    const size = { w, h };
    Animotion.cutsceneEffects.drawSpeedLines(previewCtx, size, cutscene.bridge.effectDirection, cutscene.values.speedPower);
    recordDraw({ kind: "effect", pass: "speed-lines" });
    Animotion.cutsceneEffects.drawInkField(previewCtx, size, cutscene.bridge.effectDirection, cutscene.values.speedPower);
    recordDraw({ kind: "effect", pass: "ink-field" });
  }
  function drawImpactLayers(view, w, h, cutscene, now) {
    if (!cutscene.active) return;
    const size = { w, h };
    Animotion.cutsceneEffects.drawImpactPanel(previewCtx, impactPanelImage(), view, cutscene.values.impactAlpha, impactTransition(cutscene));
    recordDraw({ kind: "effect", pass: "impact-panel", alpha: cutscene.values.impactAlpha });
    Animotion.cutsceneEffects.drawFlash(previewCtx, size, cutscene.values.flashAlpha);
    recordDraw({ kind: "effect", pass: "flash", alpha: cutscene.values.flashAlpha });
    drawDepthTopUp(view, now, cutscene);
    Animotion.cutsceneEffects.drawPanelMask(previewCtx, size);
    recordDraw({ kind: "effect", pass: "panel-mask" });
  }

  function drawDepthTopUp(view, now, cutscene) {
    const frame = state.running ? currentMotionFrame((now - state.startTime) / 1000) : state.currentFrame;
    const part = Animotion.cutsceneDepth?.postPassLiftPart?.(state.parts, { bridge: cutscene?.bridge, frame, parts: state.parts, selectedPartId: state.selectedPartId });
    if (!part || part.hidden) return;
    const t = state.running ? (now - state.startTime) / 1000 : state.pausedTime;
    previewCtx.save();
    Animotion.previewTransform.applySourceFrame(previewCtx, view, state.previewSourceFrame, state.previewSourceTransform);
    drawPart(part, t, new Map(), view, 1, cutscene, "depth-top-up", { drawSupplementals: false });
    previewCtx.restore();
  }

  function editingLayerVisible() { return !state.running && !state.exporting; }

  function sourceTransition(cutscene) { const values = cutscene.values; return { x: values.sourceX, y: values.sourceY, scale: values.sourceScale, rotation: values.sourceRotation }; }
  function sourceTransformFor(cutscene) {
    if (cutscene.active && cutscene.bridge.sourceMotionEnabled) return sourceTransition(cutscene);
    const bridge = Animotion.cutsceneModel.normalizeBridge(state.cutsceneBridge);
    return { x: bridge.sourceX, y: bridge.sourceY, scale: bridge.sourceScale };
  }
  function impactTransition(cutscene) { const values = cutscene.values; return { x: values.impactX, y: values.impactY, scale: values.impactScale, rotation: values.impactRotation }; }
  function currentMotionFrame(t) {
    if (els.motionTemplate.value === "cutscene") {
      const bridge = state.cutsceneBridge || Animotion.cutsceneModel.createBridge(state.parts, state.selectedPartId);
      return Animotion.cutsceneModel.bridgeFrameFromTime(t, bridge, Animotion.config.timelineFps);
    }
    return Animotion.timeline.frameFromTime(t, Animotion.config.timelineFrames, Animotion.config.timelineFps);
  }
  function timelineLikeMode() { return els.motionTemplate.value === "keyframes" || els.motionTemplate.value === "cutscene"; }
  function orderedPartsForFrame(t, cutscene) { const frame = state.running ? currentMotionFrame(t) : state.currentFrame; return Animotion.cutsceneDepth?.orderedParts?.(state.parts, { bridge: cutscene?.bridge, frame, parts: state.parts, selectedPartId: state.selectedPartId }) || [...state.parts].sort((a, b) => a.order - b.order); }
  function baseOrder(part) { return Animotion.renderLayerUtils?.baseOrder?.(part) ?? Number(part?.order || 0); }
  function drawRigPoint(part, spec, matrix, view, drawPivot) {
    const local = Animotion.previewRigPoints.localPoint(part, spec, { timelineLike: timelineLikeMode() });
    const image = Animotion.previewRigPoints.imagePoint(part, spec, matrix, { timelineLike: timelineLikeMode() });
    const screen = Animotion.previewTransform.imagePointToScreen(image, view, state.previewSourceFrame, state.previewSourceTransform);
    if (!local || !screen) return;
    recordPointDebug(part, local, spec.role, screen);
    drawPivot(previewCtx, { x: 0, y: 0, scale: 1 }, screen.x, screen.y, true, spec.role);
    if (state.showPointDebugLabels) drawPointDebugLabel(screen, `${part.id}:${spec.role}`);
  }
  function recordPointDebug(part, localPoint, role, screen) { state.renderedPointDebug.push({ pointId: `${part.id}:${role}`, pointKind: role, coordinateSpace: "part-local", stored: { x: localPoint.x, y: localPoint.y }, rendered: screen }); }
  function drawPointDebugLabel(screen, label) {
    previewCtx.save();
    previewCtx.font = "700 11px Aptos, sans-serif";
    previewCtx.fillStyle = "#151515";
    previewCtx.fillText(label, screen.x + 9, screen.y - 8);
    previewCtx.restore();
  }
  function sourceScale(view) { return Animotion.previewTransform.sourceScale(view, state.previewSourceFrame, state.previewSourceTransform); } function applyMatrix(ctx, matrix) { ctx.transform(matrix.a, matrix.b, matrix.c, matrix.d, matrix.e, matrix.f); }
  function recordDraw(entry) { Animotion.renderOrderDebug?.record?.(state, entry); }
  function recordPartDraw(part, drawPath, pass, bounds, extra = {}) {
    const bias = Animotion.cutsceneDepth?.depthBiasForPart?.(part, { parts: state.parts, bridge: state.cutsceneBridge, frame: state.currentFrame, selectedPartId: state.selectedPartId }) || 0;
    recordDraw(Animotion.renderOrderDebug?.partEntry?.(part, drawPath, pass, bounds, { evaluatedDepthBias: bias, ...extra }));
  }
  function compactSegmentedResult(result = {}) {
    return {
      ok: Boolean(result.ok),
      reason: result.reason || null,
      drawnBounds: result.drawnBounds || null,
      sourceBounds: result.sourceBounds || null,
      segmentCount: Number(result.segmentCount || 0),
      fallbackUsed: Boolean(result.fallbackUsed),
      renderMode: result.renderMode || "segmented-arm",
      actionPatch: result.actionPatch || null,
      leadingControl: result.leadingControl || null,
      shoulder: result.shoulder || null,
      elbow: result.elbow || null,
      handTip: result.handTip || null,
    };
  }
  function compactReplacementResult(result = {}) {
    return {
      ok: Boolean(result.ok),
      reason: result.reason || null,
      partId: result.partId || null,
      frame: result.frame || null,
      beatLabel: result.beatLabel || null,
      skippedNormalDraw: Boolean(result.skippedNormalDraw),
      drawnBounds: result.drawnBounds || null,
      sourceBounds: result.sourceBounds || null,
      shoulder: result.shoulder || null,
      elbow: result.elbow || null,
      handTip: result.handTip || null,
      target: result.target || null,
    };
  }
  function worldMatrix(part, t, cache) {
    if (cache.has(part.id)) return cache.get(part.id);
    const local = localMatrix(part, t);
    const parent = parentPart(part);
    const matrix = parent ? worldMatrix(parent, t, cache).multiply(local) : local;
    cache.set(part.id, matrix);
    return matrix;
  }

  function parentPart(part) { const parentId = Animotion.rigConnection?.parentIdFor?.(part); return state.parts.find((candidate) => candidate.id === parentId) || null; }
  function localMatrix(part, t) {
    const transform = Animotion.motion.motionFor(part, t), impactHint = impactTransformHint(part);
    const pivotX = part.rect.x + part.pivot.x;
    const pivotY = part.rect.y + part.pivot.y;
    const rotate = transform.rotate + jointRotation(part, transform);
    return new DOMMatrix().translate(pivotX + transform.x, pivotY + transform.y).rotate(rotate).scale(transform.scaleX * impactHint.scaleX, transform.scaleY * impactHint.scaleY).translate(-pivotX, -pivotY);
  }
  function impactTransformHint(part) {
    if (els.motionTemplate.value !== "cutscene") return { scaleX: 1, scaleY: 1 };
    const action = Animotion.cutsceneActionSelectors?.getActiveJointAction?.(state)?.action;
    const layer = action?.impactExaggeration;
    return Animotion.impactExaggerationLayer?.transformHintForPart?.(layer, part, state.currentFrame) || { scaleX: 1, scaleY: 1 };
  }
  function jointRotation(part, transform) {
    if (!part.joint || (!transform.jointX && !transform.jointY)) return 0;
    const base = { x: part.joint.x - part.pivot.x, y: part.joint.y - part.pivot.y };
    const target = { x: base.x + transform.jointX, y: base.y + transform.jointY };
    if (Math.hypot(base.x, base.y) < 1 || Math.hypot(target.x, target.y) < 1) return 0;
    return (Math.atan2(target.y, target.x) - Math.atan2(base.y, base.x)) * 180 / Math.PI;
  }

  Animotion.preview = { drawPreview, worldMatrix, localMatrix };
}
