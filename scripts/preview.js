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
    const size = canvasSize();
    previewCtx.save();
    previewCtx.scale(size.dpr, size.dpr);
    previewCtx.clearRect(0, 0, size.w, size.h);
    if (!state.image) return drawEmptyPreview(drawEmpty);
    if (drawLookismPreview(size, now)) return;

    const view = geometry.fitRect(state.image.naturalWidth, state.image.naturalHeight, size.w, size.h);
    state.previewView = view;
    const cutscene = Animotion.previewScene.cutsceneValues(now);
    state.previewSourceFrame = Animotion.previewTransform.sourceFrame();
    state.previewSourceTransform = Animotion.previewScene.sourceTransformFor(cutscene);
    Animotion.renderOrderDebug?.begin?.(state, state.currentFrame);

    previewCtx.translate(cutscene.shake, -cutscene.shake * 0.28);
    const context = previewContext({ ...size, view, now, cutscene });
    Animotion.previewScene.drawBackground(context);
    Animotion.previewScene.drawCutsceneEffects(context);
    Animotion.previewPartRenderer.drawGhostParts(context, lastCutsceneGhostTime);
    const matrixCache = Animotion.previewPartRenderer.drawParts(context);
    Animotion.previewScene.drawImpactLayers(context);
    Animotion.previewRigOverlay.drawSelectedRigPoints(context, matrixCache, drawPivot);
    lastCutsceneGhostTime = cutscene.time || 0;
    drawOverlays(context);
    previewCtx.restore();
  }

  function canvasSize() {
    const dpr = window.devicePixelRatio || 1;
    return { dpr, w: previewCanvas.width / dpr, h: previewCanvas.height / dpr };
  }

  function drawEmptyPreview(drawEmpty) {
    previewCtx.restore();
    drawEmpty(previewCtx, previewCanvas, "리그 미리보기가 여기에 표시됩니다.");
  }

  function drawLookismPreview(size, now) {
    if (!state.lookismPreset?.active || els.motionTemplate.value !== "cutscene") return false;
    Animotion.lookismPreset.drawPreview(previewCtx, size.w, size.h, now);
    previewCtx.restore();
    return true;
  }

  function previewContext(values) {
    return {
      ...values,
      previewCtx,
      state,
      els,
      geometry,
      pathFromShape,
      currentMotionFrame,
      orderedPartsForFrame,
      parentPart,
      worldMatrix,
      localMatrix,
      timelineLikeMode,
      baseOrder,
      sourceScale,
      applyMatrix,
      recordDraw,
      recordPartDraw,
      editingLayerVisible,
      shouldDrawImpactReference,
      ghostDelays: Animotion.cutsceneModel.GHOST_DELAYS,
      ghostAlphaRatio: Animotion.cutsceneModel.GHOST_ALPHA_RATIO,
    };
  }

  function drawOverlays(context) {
    Animotion.correspondenceEditor?.drawOverlay?.(previewCtx, context.view);
    recordDraw({ kind: "overlay", pass: "correspondence-overlay" });
    Animotion.motionPlanner?.drawOverlay?.(previewCtx, context.view, context.cutscene);
    recordDraw({ kind: "overlay", pass: "motion-planner-overlay" });
    Animotion.hiddenCompletionGuideEditor?.drawOverlay?.(previewCtx, context.view);
    recordDraw({ kind: "overlay", pass: "hidden-completion-overlay" });
    Animotion.hiddenCompletionSupplementalWarpEditor?.drawOverlay?.(previewCtx, context.view);
    recordDraw({ kind: "overlay", pass: "hidden-completion-warp-overlay" });
  }

  function currentMotionFrame(t) {
    if (els.motionTemplate.value === "cutscene") {
      const bridge = state.cutsceneBridge || Animotion.cutsceneModel.createBridge(state.parts, state.selectedPartId);
      return Animotion.cutsceneModel.bridgeFrameFromTime(t, bridge, Animotion.config.timelineFps);
    }
    return Animotion.timeline.frameFromTime(t, Animotion.config.timelineFrames, Animotion.config.timelineFps);
  }

  function orderedPartsForFrame(t, cutscene) {
    const frame = state.running ? currentMotionFrame(t) : state.currentFrame;
    return Animotion.cutsceneDepth?.orderedParts?.(state.parts, { bridge: cutscene?.bridge, frame, parts: state.parts, selectedPartId: state.selectedPartId })
      || [...state.parts].sort((a, b) => a.order - b.order);
  }

  function worldMatrix(part, t, cache) {
    if (cache.has(part.id)) return cache.get(part.id);
    const local = localMatrix(part, t);
    const parent = parentPart(part);
    const matrix = parent ? worldMatrix(parent, t, cache).multiply(local) : local;
    cache.set(part.id, matrix);
    return matrix;
  }

  function localMatrix(part, t) {
    const transform = Animotion.motion.motionFor(part, t), impactHint = impactTransformHint(part);
    return Animotion.previewStaticTransform.localMatrix(part, transform, impactHint, jointRotation(part, transform));
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

  function parentPart(part) {
    const parentId = Animotion.rigConnection?.parentIdFor?.(part);
    return state.parts.find((candidate) => candidate.id === parentId) || null;
  }

  function recordPartDraw(part, drawPath, pass, bounds, extra = {}) {
    const bias = Animotion.cutsceneDepth?.depthBiasForPart?.(part, { parts: state.parts, bridge: state.cutsceneBridge, frame: state.currentFrame, selectedPartId: state.selectedPartId }) || 0;
    recordDraw(Animotion.renderOrderDebug?.partEntry?.(part, drawPath, pass, bounds, { evaluatedDepthBias: bias, ...extra }));
  }

  function sourceScale(view) {
    return Animotion.previewTransform.sourceScale(view, state.previewSourceFrame, state.previewSourceTransform);
  }

  function applyMatrix(ctx, matrix) { ctx.transform(matrix.a, matrix.b, matrix.c, matrix.d, matrix.e, matrix.f); }
  function recordDraw(entry) { Animotion.renderOrderDebug?.record?.(state, entry); }
  function editingLayerVisible() { return !state.running && !state.exporting; }
  function shouldDrawImpactReference() { return state.nextImage && editingLayerVisible(); }
  function timelineLikeMode() { return els.motionTemplate.value === "keyframes" || els.motionTemplate.value === "cutscene"; }
  function baseOrder(part) { return Animotion.renderLayerUtils?.baseOrder?.(part) ?? Number(part?.order || 0); }

  Animotion.preview = { drawPreview, worldMatrix, localMatrix, currentMotionFrame };
}
