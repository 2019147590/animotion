{
  const global = window;
  const Animotion = global.Animotion;
  const { previewCtx, els } = Animotion.dom;
  const state = Animotion.state;

  function drawParts(baseContext) {
    const t = Animotion.playbackSpeed.playbackSeconds(state, baseContext.now);
    syncTimelineFrame(t, baseContext.currentMotionFrame);
    const matrixCache = new Map();
    const drawnSupplementalIds = new Set();
    const drawnHiddenCompletionAssetIds = new Set();
    const frame = state.running ? baseContext.currentMotionFrame(t) : state.currentFrame;
    const hiddenFillRequests = Animotion.previewHiddenFill.requests(baseContext.cutscene);
    const context = { ...baseContext, t, matrixCache, alpha: 1, drawPass: "main-part", hiddenFillRequests };
    previewCtx.save();
    Animotion.previewTransform.applySourceFrame(previewCtx, context.view, state.previewSourceFrame, state.previewSourceTransform);
    for (const part of baseContext.orderedPartsForFrame(t, baseContext.cutscene)) {
      if (!runtimeVisible(part, baseContext.cutscene, frame)) continue;
      Animotion.previewHiddenFill.drawDueBefore(part, context, hiddenFillRequests, drawnHiddenCompletionAssetIds, drawnSupplementalIds);
      if (part.hidden || Animotion.previewHiddenFill.isSupplementalPart(part)) continue;
      Animotion.previewSupplementalRenderer.drawDueSupplementalsBefore(part, context, drawnSupplementalIds, hiddenFillRequests);
      drawPart(part, { ...context, drawnSupplementalIds });
    }
    Animotion.previewHiddenFill.drawRemaining(context, hiddenFillRequests, drawnHiddenCompletionAssetIds, drawnSupplementalIds);
    previewCtx.restore();
    state.motionEvaluationDebug = baseContext.cutscene?.active
      ? Animotion.characterRootMotion?.evaluationDebug?.(state.parts, state.currentFrame, baseContext.cutscene.bridge)
      : null;
    return matrixCache;
  }

  function drawGhostParts(baseContext, lastCutsceneGhostTime) {
    const cutscene = baseContext.cutscene;
    if (!state.running || !cutscene.active || !cutscene.bridge.ghostEnabled || cutscene.values.ghostAlpha <= 0.01) return;
    previewCtx.save();
    Animotion.previewTransform.applySourceFrame(previewCtx, baseContext.view, state.previewSourceFrame, state.previewSourceTransform);
    for (const delay of baseContext.ghostDelays) drawGhostPass(baseContext, Math.max(0, lastCutsceneGhostTime - delay), baseContext.ghostAlphaRatio);
    previewCtx.restore();
  }

  function drawGhostPass(baseContext, t, alpha) {
    if (t < 0) return;
    const matrixCache = new Map();
    for (const part of baseContext.orderedPartsForFrame(t, baseContext.cutscene)) {
      if (!part.hidden && runtimeVisible(part, baseContext.cutscene, baseContext.currentMotionFrame(t)) && !Animotion.previewHiddenFill.isSupplementalPart(part)) drawPart(part, { ...baseContext, t, matrixCache, alpha, drawPass: "ghost-part" });
    }
  }

  function drawPart(part, context) {
    const drawPass = context.pass || context.drawPass || (context.alpha === 1 ? "main-part" : "ghost-part");
    const frame = state.running ? context.currentMotionFrame(context.t) : state.currentFrame;
    if (!runtimeVisible(part, context.cutscene, frame)) return;
    const planContext = { parts: state.parts, bridge: context.cutscene?.bridge, frame, selectedPartId: state.selectedPartId };
    const replacementPlan = Animotion.motionReplacementLayer?.planForPart?.(part, planContext);
    const replacement = replacementFor(part, replacementPlan, context.alpha);
    const fullContext = { ...context, drawPass };
    if (replacement?.ok) return drawReplacement(part, replacementPlan, replacement, fullContext);
    if (replacement?.ok === false) recordReplacementFailure(part, replacementPlan, replacement, fullContext);
    const hint = replacement ? null : Animotion.armExtension?.renderHintForPart?.(part, planContext);
    const segmented = hint?.active ? Animotion.armExtension.drawSegmentedPart(previewCtx, part, hint, context.alpha) : null;
    if (segmented?.ok) return drawSegmented(part, hint, segmented, fullContext);
    if (segmented?.ok === false) recordSegmentedFailure(part, hint, segmented, fullContext);
    drawNormalPart(part, replacement, segmented, frame, fullContext);
  }

  function replacementFor(part, replacementPlan, alpha) {
    if (!replacementPlan?.active) return null;
    return Animotion.motionReplacementRender?.draw?.(previewCtx, part, replacementPlan, alpha)
      || { ok: false, reason: "missing-replacement-renderer", fallbackUsed: true };
  }

  function drawReplacement(part, plan, replacement, context) {
    context.recordPartDraw(part, "motion-replacement", context.drawPass, replacement.drawnBounds, {
      handTipSource: plan.handTipSource, punchStyleSource: plan.punchStyleSource, legacyDepthCompat: plan.legacyDepthCompat,
      replacementRenderOk: true, skippedNormalArmDraw: true, replacementRenderResult: compactReplacementResult(replacement),
    });
    drawSupplementalsForPart(part, context, null);
  }

  function recordReplacementFailure(part, plan, replacement, context) {
    context.recordPartDraw(part, "motion-replacement-failed", context.drawPass, replacement.drawnBounds || Animotion.renderOrderDebug?.boundsFromControls?.(plan.controls), {
      handTipSource: plan.handTipSource, punchStyleSource: plan.punchStyleSource, legacyDepthCompat: plan.legacyDepthCompat,
      replacementRenderFailure: true, replacementRenderReason: replacement.reason, replacementRenderResult: compactReplacementResult(replacement),
    });
  }

  function drawSegmented(part, hint, segmented, context) {
    const drawPath = segmented.renderMode === "action-pose-patch" ? "action-pose-patch" : "segmented-arm";
    context.recordPartDraw(part, drawPath, context.drawPass, segmented.drawnBounds || Animotion.renderOrderDebug?.boundsFromControls?.(hint.controls), {
      handTipSource: hint.handTipSource, punchStyleSource: hint.punchStyleSource, legacyDepthCompat: hint.legacyDepthCompat, segmentedRenderResult: compactSegmentedResult(segmented),
    });
    drawSupplementalsForPart(part, context, null);
  }

  function recordSegmentedFailure(part, hint, segmented, context) {
    context.recordPartDraw(part, "segmented-arm-failed", context.drawPass, segmented.drawnBounds || Animotion.renderOrderDebug?.boundsFromControls?.(hint.controls), {
      handTipSource: hint.handTipSource, punchStyleSource: hint.punchStyleSource, legacyDepthCompat: hint.legacyDepthCompat,
      segmentedRenderFailure: true, segmentedRenderReason: segmented.reason, segmentedRenderResult: compactSegmentedResult(segmented),
    });
  }

  function drawNormalPart(part, replacement, segmented, frame, context) {
    const matrix = context.worldMatrix(part, context.t, context.matrixCache);
    previewCtx.save();
    context.applyMatrix(previewCtx, matrix);
    previewCtx.globalAlpha = part.alpha * context.alpha;
    const visibilityMaskResult = drawPartImage(part, frame, context);
    context.recordPartDraw(part, "normal-part", context.drawPass, Animotion.renderOrderDebug?.boundsFromMatrix?.(part, matrix), {
      fallbackForSegmentedRender: Boolean(segmented && segmented.ok === false), segmentedRenderReason: segmented?.reason || null,
      fallbackToNormalArm: Boolean(replacement && replacement.ok === false), replacementRenderReason: replacement?.reason || null,
      visibilityMaskResult,
    });
    drawSupplementalsForPart(part, context, matrix);
    drawSelectedPartOutline(part, matrix, context);
    previewCtx.restore();
  }

  function drawPartImage(part, frame, context) {
    if (Animotion.partVisibilityMaskRender?.drawPartImage) return Animotion.partVisibilityMaskRender.drawPartImage(previewCtx, part, frame, context.pathFromShape, { action: context.cutscene?.bridge?.jointAction || null });
    previewCtx.drawImage(part.canvas, part.rect.x, part.rect.y, part.rect.w, part.rect.h);
    return null;
  }

  function drawSupplementalsForPart(part, context, activeMatrix) {
    if (context.drawSupplementals === false) return;
    Animotion.previewSupplementalRenderer.drawSupplementalPartsForSource(part, context, activeMatrix, context.drawnSupplementalIds, context.hiddenFillRequests);
  }

  function drawSelectedPartOutline(part, matrix, context) {
    if (context.drawPass !== "main-part" || context.alpha !== 1 || !context.editingLayerVisible() || part.id !== state.selectedPartId) return;
    previewCtx.lineWidth = 2 / context.sourceScale(context.view);
    previewCtx.strokeStyle = "#e1462e";
    previewCtx.stroke(context.pathFromShape(context.geometry.absoluteShapeFromPart(part)));
    context.recordPartDraw(part, "selection-overlay", "selection-overlay", Animotion.renderOrderDebug?.boundsFromMatrix?.(part, matrix));
  }

  function drawHiddenCompletionPatch(part, context, request = null) {
    const result = Animotion.hiddenCompletionRender?.drawForPart?.(previewCtx, part, { state, parts: state.parts, t: context.t, matrixCache: context.matrixCache, worldMatrix: context.worldMatrix });
    if (!result) return null;
    context.recordPartDraw(part, result.ok ? "hidden-completion-symmetry" : "hidden-completion-symmetry-failed", "hidden-completion-patch", result.drawnBounds, {
      hiddenCompletionPatchId: result.assetId, completionMethod: result.method || "symmetry", counterpartPartId: result.counterpartPartId || null,
      hiddenCompletionRenderFailure: result.ok === false, hiddenCompletionRenderReason: result.reason || null, ...Animotion.previewHiddenFill.hiddenFillDebug(request),
    });
    return result;
  }

  function syncTimelineFrame(t, currentMotionFrame) {
    if (!state.running || !timelineLikeMode()) return;
    state.currentFrame = currentMotionFrame(t);
    els.currentFrame.value = String(state.currentFrame);
    els.frameLabel.textContent = String(state.currentFrame);
  }

  function compactSegmentedResult(result = {}) {
    return { ok: Boolean(result.ok), reason: result.reason || null, drawnBounds: result.drawnBounds || null, sourceBounds: result.sourceBounds || null, segmentCount: Number(result.segmentCount || 0), fallbackUsed: Boolean(result.fallbackUsed), renderMode: result.renderMode || "segmented-arm", actionPatch: result.actionPatch || null, leadingControl: result.leadingControl || null, shoulder: result.shoulder || null, elbow: result.elbow || null, handTip: result.handTip || null };
  }

  function compactReplacementResult(result = {}) {
    return { ok: Boolean(result.ok), reason: result.reason || null, partId: result.partId || null, frame: result.frame || null, beatLabel: result.beatLabel || null, skippedNormalDraw: Boolean(result.skippedNormalDraw), drawnBounds: result.drawnBounds || null, sourceBounds: result.sourceBounds || null, shoulder: result.shoulder || null, elbow: result.elbow || null, handTip: result.handTip || null, target: result.target || null };
  }

  function timelineLikeMode() { return els.motionTemplate.value === "keyframes" || els.motionTemplate.value === "cutscene"; }
  function runtimeVisible(part, cutscene, frame) {
    return Animotion.actionPartVisibility?.runtimeVisible?.(part, { action: cutscene?.bridge?.jointAction || null, frame }) !== false;
  }

  Animotion.previewPartRenderer = { drawParts, drawGhostParts, drawPart, drawHiddenCompletionPatch };
}
