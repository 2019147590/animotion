{
  const global = window;
  const Animotion = global.Animotion;
  const { previewCanvas, previewCtx, els } = Animotion.dom;
  const state = Animotion.state;
  const geometry = Animotion.geometry;
  const { pathFromShape } = Animotion.path;

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
    previewCtx.translate(cutscene.shake, -cutscene.shake * 0.28);
    drawBackground(view, w, h, cutscene);
    drawCutsceneEffects(view, w, h, cutscene);
    drawGhostParts(view, now, cutscene);
    const matrixCache = drawParts(view, now, cutscene);
    drawImpactLayers(view, w, h, cutscene);
    drawSelectedRigPoints(view, now, matrixCache, drawPivot);
    Animotion.correspondenceEditor?.drawOverlay?.(previewCtx, view);
    Animotion.motionPlanner?.drawOverlay?.(previewCtx, view, cutscene);
    Animotion.hiddenCompletionGuideEditor?.drawOverlay?.(previewCtx, view);
    previewCtx.restore();
  }

  function drawBackground(view, w, h, cutscene) {
    previewCtx.fillStyle = "#f7f0df";
    previewCtx.fillRect(0, 0, w, h);
    drawSourcePanel(view, cutscene, Number(els.backgroundOpacity.value));
    if (state.nextImage && editingLayerVisible()) {
      const bridge = Animotion.cutsceneModel.normalizeBridge(state.cutsceneBridge);
      Animotion.cutsceneEffects.drawPanelImage(previewCtx, impactPanelImage(), view, Number(els.impactReferenceOpacity.value), {
        x: bridge.impactX,
        y: bridge.impactY,
        scale: bridge.impactScale,
      });
    }
    previewCtx.globalAlpha = 1;
  }

  function drawSourcePanel(view, cutscene, baseAlpha) {
    const transform = sourceTransformFor(cutscene);
    const alpha = baseAlpha * (cutscene.active && cutscene.bridge.sourceMotionEnabled ? cutscene.values.sourceAlpha : 1);
    const image = sourcePanelImage();
    if (cutscene.active && cutscene.bridge.sourceMotionEnabled) drawSourcePanelGhosts(image, view, cutscene, baseAlpha);
    Animotion.cutsceneEffects.drawPanelImage(previewCtx, image, view, alpha, transform);
  }

  function drawSourcePanelGhosts(image, view, cutscene, baseAlpha) {
    const values = cutscene.values;
    if (values.launch <= 0.02 || values.sourceAlpha <= 0.02) return;
    const start = cutscene.bridge;
    for (let i = 3; i >= 1; i -= 1) {
      const ghost = i / 4;
      const transform = {
        x: values.sourceX - (values.sourceX - start.sourceX) * ghost,
        y: values.sourceY - (values.sourceY - start.sourceY) * ghost,
        scale: values.sourceScale * (1 + ghost * 0.06),
        rotation: values.sourceRotation + ghost * 0.12 * Math.sign(cutscene.bridge.effectDirection.x),
      };
      const alpha = baseAlpha * values.sourceAlpha * values.launch * 0.12 * (4 - i);
      Animotion.cutsceneEffects.drawPanelImage(previewCtx, image, view, alpha, transform);
    }
  }

  function sourcePanelImage() {
    if (Animotion.panelEditor) {
      const plate = Animotion.panelEditor.createPanelCanvas("source", { removeCharacter: state.separateCharacter });
      if (state.separateCharacter && !Animotion.panelEditor.characterMask("source")) erasePartsFromPanel(plate);
      return plate;
    }
    if (!state.separateCharacter || state.parts.length === 0) return state.image;
    const plate = document.createElement("canvas");
    plate.width = state.image.naturalWidth;
    plate.height = state.image.naturalHeight;
    const ctx = plate.getContext("2d");
    ctx.drawImage(state.image, 0, 0);
    ctx.globalCompositeOperation = "destination-out";
    for (const part of state.parts) {
      if (!part.hidden) ctx.fill(pathFromShape(geometry.absoluteShapeFromPart(part)));
    }
    ctx.globalCompositeOperation = "source-over";
    return plate;
  }

  function erasePartsFromPanel(plate) {
    if (!plate || !state.parts.length) return;
    const crop = Animotion.panelEditor.setupFor("source").crop || { x: 0, y: 0 };
    const ctx = plate.getContext("2d");
    ctx.globalCompositeOperation = "destination-out";
    for (const part of state.parts) {
      if (!part.hidden) ctx.fill(pathFromShape(geometry.absoluteShapeFromPart(part), -crop.x, -crop.y));
    }
    ctx.globalCompositeOperation = "source-over";
  }

  function impactPanelImage() {
    return Animotion.panelEditor?.createPanelCanvas("impact") || state.nextImage;
  }

  function drawParts(view, now, cutscene) {
    const t = state.running ? (now - state.startTime) / 1000 : state.pausedTime;
    syncTimelineFrame(t);
    const matrixCache = new Map();
    previewCtx.save();
    Animotion.previewTransform.applySourceFrame(previewCtx, view, state.previewSourceFrame, state.previewSourceTransform);
    for (const part of [...state.parts].sort((a, b) => a.order - b.order)) {
      if (!part.hidden) drawPart(part, t, matrixCache, view);
    }
    previewCtx.restore();
    state.motionEvaluationDebug = cutscene?.active
      ? Animotion.characterRootMotion?.evaluationDebug?.(state.parts, state.currentFrame, cutscene.bridge)
      : null;
    return matrixCache;
  }

  function drawGhostParts(view, now, cutscene) {
    if (!cutscene.active || cutscene.values.ghostAlpha <= 0.01) return;
    const t = state.running ? (now - state.startTime) / 1000 : state.pausedTime;
    previewCtx.save();
    Animotion.previewTransform.applySourceFrame(previewCtx, view, state.previewSourceFrame, state.previewSourceTransform);
    for (const delay of [0.12, 0.07]) drawGhostPass(t - delay, cutscene.values.ghostAlpha);
    previewCtx.restore();
  }

  function drawGhostPass(t, alpha) {
    if (t < 0) return;
    const matrixCache = new Map();
    for (const part of [...state.parts].sort((a, b) => a.order - b.order)) {
      if (!part.hidden) drawPart(part, t, matrixCache, state.previewView, alpha);
    }
  }

  function syncTimelineFrame(t) {
    if (!state.running || !timelineLikeMode()) return;
    state.currentFrame = currentMotionFrame(t);
    els.currentFrame.value = String(state.currentFrame);
    els.frameLabel.textContent = String(state.currentFrame);
  }

  function drawPart(part, t, matrixCache, view, alpha = 1) {
    const matrix = worldMatrix(part, t, matrixCache);
    previewCtx.save();
    applyMatrix(previewCtx, matrix);
    previewCtx.globalAlpha = part.alpha * alpha;
    previewCtx.drawImage(part.canvas, part.rect.x, part.rect.y, part.rect.w, part.rect.h);
    if (alpha === 1 && editingLayerVisible() && part.id === state.selectedPartId) {
      previewCtx.lineWidth = 2 / sourceScale(view);
      previewCtx.strokeStyle = "#e1462e";
      previewCtx.stroke(pathFromShape(geometry.absoluteShapeFromPart(part)));
    }
    previewCtx.restore();
  }

  function drawSelectedRigPoints(view, now, matrixCache, drawPivot) {
    const part = Animotion.parts.selectedPart();
    if (!editingLayerVisible() || !part) return;
    const t = state.running ? (now - state.startTime) / 1000 : state.pausedTime;
    const matrix = worldMatrix(part, t, matrixCache);
    drawRigPoint(part, part.pivot, matrix, view, drawPivot, "anchor");
    drawRigPoint(part, displayedJoint(part), matrix, view, drawPivot, "joint");
  }

  function displayedJoint(part) {
    if (!timelineLikeMode()) return part.joint;
    const motion = displayedJointMotion(part);
    return { x: part.joint.x + motion.jointX, y: part.joint.y + motion.jointY };
  }

  function displayedJointMotion(part) {
    if (state.running) return Animotion.timeline.evaluatePartAtFrame(part, state.currentFrame);
    return Animotion.motionModel.normalizeCustomMotion(part.customMotion);
  }

  function cutsceneValues(now) {
    if (els.motionTemplate.value !== "cutscene") return { active: false, shake: 0 };
    const bridge = state.cutsceneBridge || Animotion.cutsceneModel.createBridge(state.parts, state.selectedPartId);
    const t = state.running ? (now - state.startTime) / 1000 : state.pausedTime;
    const values = Animotion.cutsceneModel.bridgeValues(t, bridge, Animotion.config.timelineFps);
    return { active: true, bridge, values, shake: values.shake };
  }

  function drawCutsceneEffects(view, w, h, cutscene) {
    if (!cutscene.active) return;
    const size = { w, h };
    Animotion.cutsceneEffects.drawSpeedLines(previewCtx, size, cutscene.bridge.effectDirection, cutscene.values.speedPower);
    Animotion.cutsceneEffects.drawInkField(previewCtx, size, cutscene.bridge.effectDirection, cutscene.values.speedPower);
  }

  function drawImpactLayers(view, w, h, cutscene) {
    if (!cutscene.active) return;
    const size = { w, h };
    Animotion.cutsceneEffects.drawImpactPanel(previewCtx, impactPanelImage(), view, cutscene.values.impactAlpha, impactTransition(cutscene));
    Animotion.cutsceneEffects.drawFlash(previewCtx, size, cutscene.values.flashAlpha);
    Animotion.cutsceneEffects.drawPanelMask(previewCtx, size);
  }

  function editingLayerVisible() { return !state.running && !state.exporting; }

  function sourceTransition(cutscene) {
    const values = cutscene.values;
    return {
      x: values.sourceX,
      y: values.sourceY,
      scale: values.sourceScale,
      rotation: values.sourceRotation,
    };
  }

  function sourceTransformFor(cutscene) {
    if (cutscene.active && cutscene.bridge.sourceMotionEnabled) return sourceTransition(cutscene);
    const bridge = Animotion.cutsceneModel.normalizeBridge(state.cutsceneBridge);
    return { x: bridge.sourceX, y: bridge.sourceY, scale: bridge.sourceScale };
  }

  function impactTransition(cutscene) {
    const values = cutscene.values;
    return {
      x: values.impactX,
      y: values.impactY,
      scale: values.impactScale,
      rotation: values.impactRotation,
    };
  }

  function currentMotionFrame(t) {
    if (els.motionTemplate.value === "cutscene") {
      const bridge = state.cutsceneBridge || Animotion.cutsceneModel.createBridge(state.parts, state.selectedPartId);
      return Animotion.cutsceneModel.bridgeFrameFromTime(t, bridge, Animotion.config.timelineFps);
    }
    return Animotion.timeline.frameFromTime(t, Animotion.config.timelineFrames, Animotion.config.timelineFps);
  }

  function timelineLikeMode() {
    return els.motionTemplate.value === "keyframes" || els.motionTemplate.value === "cutscene";
  }

  function drawRigPoint(part, localPoint, matrix, view, drawPivot, role) {
    const point = new DOMPoint(part.rect.x + localPoint.x, part.rect.y + localPoint.y).matrixTransform(matrix);
    const screen = Animotion.previewTransform.imagePointToScreen(point, view, state.previewSourceFrame, state.previewSourceTransform);
    drawPivot(previewCtx, { x: 0, y: 0, scale: 1 }, screen.x, screen.y, true, role);
  }

  function sourceScale(view) { return Animotion.previewTransform.sourceScale(view, state.previewSourceFrame, state.previewSourceTransform); }

  function applyMatrix(ctx, matrix) { ctx.transform(matrix.a, matrix.b, matrix.c, matrix.d, matrix.e, matrix.f); }

  function worldMatrix(part, t, cache) {
    if (cache.has(part.id)) return cache.get(part.id);
    const local = localMatrix(part, t);
    const parent = state.parts.find((candidate) => candidate.id === part.parentId);
    const matrix = parent ? worldMatrix(parent, t, cache).multiply(local) : local;
    cache.set(part.id, matrix);
    return matrix;
  }

  function localMatrix(part, t) {
    const transform = Animotion.motion.motionFor(part, t);
    const pivotX = part.rect.x + part.pivot.x;
    const pivotY = part.rect.y + part.pivot.y;
    const rotate = transform.rotate + jointRotation(part, transform);
    return new DOMMatrix()
      .translate(pivotX + transform.x, pivotY + transform.y)
      .rotate(rotate)
      .scale(transform.scaleX, transform.scaleY)
      .translate(-pivotX, -pivotY);
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
