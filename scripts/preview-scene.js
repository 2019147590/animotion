{
  const global = window;
  const Animotion = global.Animotion;
  const { previewCtx, els } = Animotion.dom;
  const state = Animotion.state;
  const geometry = Animotion.geometry;
  const { pathFromShape } = Animotion.path;

  function drawBackground(context) {
    const { view, w, h, cutscene } = context;
    previewCtx.fillStyle = "#f7f0df";
    previewCtx.fillRect(0, 0, w, h);
    context.recordDraw({ kind: "background", pass: "background-fill" });
    drawSourcePanel(context, Number(els.backgroundOpacity.value));
    if (context.shouldDrawImpactReference()) {
      const bridge = Animotion.cutsceneModel.normalizeBridge(state.cutsceneBridge);
      Animotion.cutsceneEffects.drawPanelImage(previewCtx, impactPanelImage(), view, Number(els.impactReferenceOpacity.value), { x: bridge.impactX, y: bridge.impactY, scale: bridge.impactScale });
    }
    previewCtx.globalAlpha = 1;
  }

  function drawSourcePanel(context, baseAlpha) {
    const { view, cutscene } = context;
    const transform = sourceTransformFor(cutscene);
    const alpha = baseAlpha * (cutscene.active && cutscene.bridge.sourceMotionEnabled ? cutscene.values.sourceAlpha : 1);
    const source = sourcePanelImage(cutscene);
    if (cutscene.active && cutscene.bridge.sourceMotionEnabled) drawSourcePanelGhosts(context, source.image, baseAlpha);
    Animotion.cutsceneEffects.drawPanelImage(previewCtx, source.image, view, alpha, transform);
    context.recordDraw({ kind: "panel", pass: "source-panel", drawPath: "source-panel", alpha, sourcePanelMode: source.mode, erasedPartIds: source.erasedPartIds, sourcePanelConflictRisk: source.conflictRisk });
  }

  function drawSourcePanelGhosts(context, image, baseAlpha) {
    const { view, cutscene } = context;
    if (!cutscene.bridge.ghostEnabled) return;
    const values = cutscene.values;
    if (values.launch <= 0.02 || values.sourceAlpha <= 0.02) return;
    for (let i = 3; i >= 1; i -= 1) {
      const ghost = i / 4, start = cutscene.bridge;
      const transform = { x: values.sourceX - (values.sourceX - start.sourceX) * ghost, y: values.sourceY - (values.sourceY - start.sourceY) * ghost, scale: values.sourceScale * (1 + ghost * 0.06), rotation: values.sourceRotation + ghost * 0.12 * Math.sign(cutscene.bridge.effectDirection.x) };
      const alpha = baseAlpha * values.sourceAlpha * values.launch * 0.12 * (4 - i);
      Animotion.cutsceneEffects.drawPanelImage(previewCtx, image, view, alpha, transform);
      context.recordDraw({ kind: "panel", pass: "source-panel-ghost", drawPath: "source-panel-ghost", alpha });
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
    if ((!state.separateCharacter && !runtimeErase) || !state.parts.length) return sourcePanelResult(state.image, false, []);
    const plate = document.createElement("canvas");
    plate.width = state.image.naturalWidth;
    plate.height = state.image.naturalHeight;
    plate.getContext("2d").drawImage(state.image, 0, 0);
    erasePartsFromPanel(plate);
    return sourcePanelResult(plate, runtimeErase, erasedPartIds);
  }

  function erasePartsFromPanel(plate) {
    if (!plate || !state.parts.length) return;
    const crop = Animotion.panelEditor?.setupFor?.("source")?.crop || { x: 0, y: 0 };
    const ctx = plate.getContext("2d");
    ctx.globalCompositeOperation = "destination-out";
    const action = state.cutsceneBridge?.jointAction || null;
    const frame = state.currentFrame || 1;
    for (const part of state.parts) if (!part.hidden && runtimeVisible(part, action, frame)) ctx.fill(pathFromShape(geometry.absoluteShapeFromPart(part), -crop.x, -crop.y));
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

  function drawCutsceneEffects(context) {
    const { w, h, cutscene } = context;
    if (!cutscene.active) return;
    const size = { w, h };
    Animotion.cutsceneEffects.drawSpeedLines(previewCtx, size, cutscene.bridge.effectDirection, cutscene.values.speedPower);
    context.recordDraw({ kind: "effect", pass: "speed-lines" });
    Animotion.cutsceneEffects.drawInkField(previewCtx, size, cutscene.bridge.effectDirection, cutscene.values.speedPower);
    context.recordDraw({ kind: "effect", pass: "ink-field" });
  }

  function drawImpactLayers(context) {
    const { view, w, h, cutscene } = context;
    if (!cutscene.active) return;
    const size = { w, h };
    Animotion.cutsceneEffects.drawImpactPanel(previewCtx, impactPanelImage(), view, cutscene.values.impactAlpha, impactTransition(cutscene));
    context.recordDraw({ kind: "effect", pass: "impact-panel", alpha: cutscene.values.impactAlpha });
    Animotion.cutsceneEffects.drawFlash(previewCtx, size, cutscene.values.flashAlpha);
    context.recordDraw({ kind: "effect", pass: "flash", alpha: cutscene.values.flashAlpha });
    drawDepthTopUp(context);
    Animotion.cutsceneEffects.drawPanelMask(previewCtx, size);
    context.recordDraw({ kind: "effect", pass: "panel-mask" });
  }

  function drawDepthTopUp(context) {
    const frame = state.running ? context.currentMotionFrame(Animotion.playbackSpeed.playbackSeconds(state, context.now)) : state.currentFrame;
    const part = Animotion.cutsceneDepth?.postPassLiftPart?.(state.parts, { bridge: context.cutscene?.bridge, frame, parts: state.parts, selectedPartId: state.selectedPartId });
    if (!part || part.hidden || !runtimeVisible(part, context.cutscene?.bridge?.jointAction, frame)) return;
    const t = Animotion.playbackSpeed.playbackSeconds(state, context.now);
    previewCtx.save();
    Animotion.previewTransform.applySourceFrame(previewCtx, context.view, state.previewSourceFrame, state.previewSourceTransform);
    Animotion.previewPartRenderer.drawPart(part, { ...context, t, matrixCache: new Map(), alpha: 1, pass: "depth-top-up", drawSupplementals: false });
    previewCtx.restore();
  }

  function cutsceneValues(now) {
    if (els.motionTemplate.value !== "cutscene") return { active: false, shake: 0 };
    const bridge = Animotion.cutsceneModel.normalizeBridge(state.cutsceneBridge || Animotion.cutsceneModel.createBridge(state.parts, state.selectedPartId));
    const t = Animotion.playbackSpeed.playbackSeconds(state, now);
    const values = Animotion.cutsceneModel.bridgeValues(t, bridge, Animotion.config.timelineFps);
    return { active: true, bridge, values, shake: values.shake, time: t };
  }

  function sourceTransformFor(cutscene) {
    if (cutscene.active && cutscene.bridge.sourceMotionEnabled) return sourceTransition(cutscene);
    const bridge = Animotion.cutsceneModel.normalizeBridge(state.cutsceneBridge);
    return { x: bridge.sourceX, y: bridge.sourceY, scale: bridge.sourceScale };
  }

  function sourceTransition(cutscene) {
    const values = cutscene.values;
    return { x: values.sourceX, y: values.sourceY, scale: values.sourceScale, rotation: values.sourceRotation };
  }

  function impactTransition(cutscene) {
    const values = cutscene.values;
    return { x: values.impactX, y: values.impactY, scale: values.impactScale, rotation: values.impactRotation };
  }

  function visiblePartIds() {
    const action = state.cutsceneBridge?.jointAction || null;
    const frame = state.currentFrame || 1;
    return state.parts.filter((part) => !part.hidden && runtimeVisible(part, action, frame)).map((part) => part.id);
  }
  function runtimeVisible(part, action, frame) {
    return Animotion.actionPartVisibility?.runtimeVisible?.(part, { action, frame }) !== false;
  }
  function impactPanelImage() { return Animotion.panelEditor?.createPanelCanvas("impact") || state.nextImage; }
  Animotion.previewScene = { drawBackground, drawCutsceneEffects, drawImpactLayers, cutsceneValues, sourceTransformFor, impactPanelImage };
}
