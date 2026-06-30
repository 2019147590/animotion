{
  const global = window;
  const Animotion = global.Animotion;
  const { els } = Animotion.dom;
  const state = Animotion.state;
  const geometry = Animotion.geometry;
  function bindEvents() {
    Animotion.sourceCanvasEvents.bindSourceCanvasEvents();
    Animotion.previewEvents.bindPreviewCanvasEvents();
    bindControlEvents();
    bindWindowEvents();
  }

  function bindControlEvents() {
    els.imageInput.addEventListener("change", Animotion.io.handleImageUpload);
    els.nextImageInput.addEventListener("change", Animotion.io.handleNextImageUpload);
    els.loadLookismPreset.addEventListener("click", Animotion.lookismPreset.loadIntoApp);
    els.generateDemoGengaCut.addEventListener("click", generateDemoGengaCut);
    els.applyDemoGengaMotion.addEventListener("click", applyDemoGengaMotion);
    els.sourceZoom.addEventListener("input", () => Animotion.view.setSourceZoom(Number(els.sourceZoom.value)));
    els.zoomOut.addEventListener("click", () => Animotion.view.setSourceZoom(state.sourceZoom / Animotion.config.zoomStep));
    els.zoomReset.addEventListener("click", Animotion.view.resetSourceView);
    els.zoomIn.addEventListener("click", () => Animotion.view.setSourceZoom(state.sourceZoom * Animotion.config.zoomStep));
    els.selectionTool.addEventListener("change", () => { state.drag = null; Animotion.ui.refreshUi(); });
    els.capturePart.addEventListener("click", capturePart);
    els.applyOutline.addEventListener("click", applyOutline);
    els.finishSelection.addEventListener("click", Animotion.sourceCanvasEvents.closeSelection);
    els.clearSelection.addEventListener("click", clearSelection);
    els.guideParts.addEventListener("click", Animotion.io.createGuideParts);
    els.motionTemplate.addEventListener("change", onMotionTemplateChange);
    els.impactExaggerationEnabled.addEventListener("change", updateImpactExaggerationEnabled);
    els.separateCharacter.addEventListener("change", () => {
      state.separateCharacter = els.separateCharacter.checked;
      Animotion.ui.refreshUi();
    });
    Animotion.cutsceneControls.bindPanelTransformEvents();
    els.playPause.addEventListener("click", togglePlayback);
    els.exportWebm.addEventListener("click", Animotion.exporter.exportWebm);
    els.saveRig.addEventListener("click", Animotion.io.saveRig);
    els.loadRig.addEventListener("change", Animotion.io.loadRig);
    bindInspectorEvents();
  }

  function capturePart() {
    if (Animotion.panelEditor?.canEditRig() === false) return;
    const ready = geometry.shapeIsReady(state.selection, Animotion.imageBounds(), Animotion.config.minShapeSize);
    if (!ready) return;
    Animotion.partCommands.createPartFromShape(els.partType.value, state.selection, els.partName.value.trim());
    els.partName.value = "";
    clearSelection();
  }

  async function generateDemoGengaCut() {
    try {
      els.demoGengaStatus.textContent = "오리지널 원화 컷 fixture를 생성하는 중입니다.";
      await Animotion.scriptedGengaGenerator.loadIntoApp();
    } catch (error) {
      els.demoGengaStatus.textContent = error.message;
    }
  }

  function applyDemoGengaMotion() {
    try {
      Animotion.scriptedGengaMotionPreset.applyToApp();
    } catch (error) {
      els.demoGengaStatus.textContent = error.message;
    }
  }

  function applyOutline() {
    if (Animotion.panelEditor?.canEditRig() === false) return;
    const part = Animotion.parts.selectedPart();
    const ready = geometry.shapeIsReady(state.selection, Animotion.imageBounds(), Animotion.config.minShapeSize);
    if (!part || !ready) return;
    Animotion.partCommands.applyShapeToPart(part, state.selection);
    clearSelection();
  }

  function clearSelection() {
    state.selection = null;
    state.drag = null;
    els.selectionTool.value = Animotion.tool.edit;
    Animotion.ui.refreshUi();
  }

  function togglePlayback() {
    state.running = !state.running;
    if (state.running) {
      state.startTime = keyframeStartTime(performance.now());
      els.playPause.textContent = "일시정지";
      return;
    }
    Animotion.playbackSpeed.pauseAtNow(state);
    els.playPause.textContent = "재생";
  }

  function keyframeStartTime(now) {
    const seconds = timelineLikeMode()
      ? Animotion.playbackSpeed.secondsForFrame(state.currentFrame, Animotion.config.timelineFps)
      : state.pausedTime;
    return Animotion.playbackSpeed.startTimeForPlaybackSeconds(seconds, now, state.playbackSpeed);
  }

  function onMotionTemplateChange() {
    state.startTime = performance.now();
    const missingBridge = !state.cutsceneBridge || !state.cutsceneBridge.primaryPartId;
    if (els.motionTemplate.value === "cutscene" && missingBridge) {
      Animotion.motionCommands.setCutsceneBridge(Animotion.cutsceneControls.preservePanelTransform(
        Animotion.cutsceneModel.createBridge(state.parts, state.selectedPartId),
        state.cutsceneBridge
      ));
      state.currentFrame = state.cutsceneBridge.impactFrame;
    }
    if (timelineLikeMode()) {
      Animotion.timelineControls.setCurrentFrame(state.currentFrame);
    }
    Animotion.ui.refreshUi();
  }

  function updateImpactExaggerationEnabled() {
    const action = Animotion.cutsceneActionSelectors?.getActiveJointAction?.(state)?.action;
    if (!action?.impactExaggeration) return;
    Animotion.motionCommands.updateJointAction({
      ...action,
      impactExaggeration: { ...action.impactExaggeration, enabled: els.impactExaggerationEnabled.checked },
    });
    Animotion.ui.refreshUi();
  }

  function bindInspectorEvents() {
    const update = updateSelectedPart;
    els.editName.addEventListener("input", () => update({ name: els.editName.value }));
    els.editType.addEventListener("change", () => update({ type: els.editType.value }));
    els.editHumanRole?.addEventListener("change", () => update({ humanRole: els.editHumanRole.value || null }));
    els.editUsage?.addEventListener("change", () => update({ usage: els.editUsage.value || null }));
    els.editParent.addEventListener("change", () => update({ parentId: els.editParent.value || null }));
    els.autoPlaceArmHandles?.addEventListener("click", autoPlaceArmHandles);
    els.pivotX.addEventListener("input", () => updatePoint("pivot", "x", Number(els.pivotX.value)));
    els.pivotY.addEventListener("input", () => updatePoint("pivot", "y", Number(els.pivotY.value)));
    els.jointX.addEventListener("input", () => updatePoint("joint", "x", Number(els.jointX.value)));
    els.jointY.addEventListener("input", () => updatePoint("joint", "y", Number(els.jointY.value)));
    els.handTipX.addEventListener("input", () => updatePoint("handTip", "x", Number(els.handTipX.value)));
    els.handTipY.addEventListener("input", () => updatePoint("handTip", "y", Number(els.handTipY.value)));
    els.editOrder.addEventListener("input", () => update({ order: Number(els.editOrder.value) }));
    els.editAlpha.addEventListener("input", () => update({ alpha: Number(els.editAlpha.value) }));
    els.editHidden.addEventListener("change", () => update({ hidden: els.editHidden.checked }));
    bindSupplementalPartEvents();
    els.motionX.addEventListener("input", () => updateMotion("x", els.motionX.value));
    els.motionY.addEventListener("input", () => updateMotion("y", els.motionY.value));
    els.motionRotate.addEventListener("input", () => updateMotion("rotate", els.motionRotate.value));
    els.motionScaleY.addEventListener("input", () => updateMotion("scaleY", els.motionScaleY.value));
    els.motionJointX.addEventListener("input", () => updateMotion("jointX", els.motionJointX.value));
    els.motionJointY.addEventListener("input", () => updateMotion("jointY", els.motionJointY.value));
    els.motionPhase.addEventListener("input", () => updateMotion("phase", els.motionPhase.value));
    els.resetPartMotion.addEventListener("click", resetPartMotion);
    els.deletePart.addEventListener("click", deleteSelectedPart);
  }

  function bindSupplementalPartEvents() {
    const fields = [
      [els.supplementalPartX, "x"],
      [els.supplementalPartY, "y"],
      [els.supplementalPartW, "w"],
      [els.supplementalPartH, "h"],
      [els.supplementalMaskScale, "maskScale"],
    ];
    for (const [element, key] of fields) element?.addEventListener("input", () => updateSupplementalPart(key, element.value));
  }

  function updateSelectedPart(patch) {
    if (Animotion.partCommands.updateSelectedPart(patch)) Animotion.ui.refreshUi();
  }

  function updateSupplementalPart(key, value) {
    const number = Number(value);
    if (!Number.isFinite(number)) return;
    if (Animotion.partCommands.transformSelectedSupplementalPart({ [key]: number })) Animotion.ui.refreshUi();
  }

  function updatePoint(pointKey, axis, ratio) {
    const part = Animotion.parts.selectedPart();
    if (!part) return;
    const role = pointKey === "pivot" ? "rotationPivot" : pointKey;
    if (Animotion.armRoleSemantics?.isRoleEditable?.(part, role) === false) return;
    const sizeKey = axis === "x" ? "w" : "h";
    const parent = parentPart(part);
    updateSelectedPart({ [pointKey]: { ...((pointKey === "handTip" ? Animotion.armRoleSemantics?.contactPointForPart?.(part, parent) || Animotion.rigging?.handTipForPart?.(part) : part[pointKey]) || part.joint || part.pivot), [axis]: ratio * part.rect[sizeKey] } });
  }

  function parentPart(part) {
    const parentId = Animotion.rigConnection?.parentIdFor?.(part) || part?.parentId || part?.parentPartId || null;
    return state.parts.find((candidate) => candidate.id === parentId) || null;
  }

  function updateMotion(key, value) {
    if (timelineLikeMode()) {
      state.running = false;
      els.playPause.textContent = "재생";
    }
    updateSelectedPartMotion(key, value);
  }

  function resetPartMotion() {
    Animotion.partCommands.resetSelectedPartMotion();
    Animotion.ui.refreshUi();
  }

  function autoPlaceArmHandles() {
    Animotion.partCommands.autoPlaceSelectedArmHandles();
    Animotion.ui.refreshUi();
  }

  function updateSelectedPartMotion(key, value) {
    if (Animotion.partCommands.updateSelectedPartMotion(key, value)) Animotion.ui.refreshUi();
  }

  function deleteSelectedPart() {
    if (Animotion.partCommands.deleteSelectedPart()) Animotion.ui.refreshUi();
  }

  function bindWindowEvents() {
    window.addEventListener("resize", () => {
      Animotion.render.drawSource();
      Animotion.render.drawPreview();
    });
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", (event) => { if (event.code === "Space") state.spaceDown = false; });
  }

  function onKeyDown(event) {
    if (Animotion.historyShortcuts?.handleKeyDown?.(event)) return;
    if (event.code === "Space" && !Animotion.view.isTypingTarget(event.target)) {
      state.spaceDown = true;
      event.preventDefault();
    }
  }

  function timelineLikeMode() {
    return els.motionTemplate.value === "keyframes" || els.motionTemplate.value === "cutscene";
  }

  Animotion.events = { bindEvents, onSourcePointerDown: Animotion.sourceCanvasEvents.onSourcePointerDown };
}
