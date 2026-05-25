{
  const global = window;
  const Animotion = global.Animotion;
  const { sourceCanvas, els } = Animotion.dom;
  const state = Animotion.state;
  const geometry = Animotion.geometry;
  function bindEvents() {
    bindSourceCanvasEvents();
    Animotion.previewEvents.bindPreviewCanvasEvents();
    bindControlEvents();
    bindWindowEvents();
  }
  function bindSourceCanvasEvents() {
    sourceCanvas.addEventListener("pointerdown", onSourcePointerDown);
    sourceCanvas.addEventListener("pointermove", onSourcePointerMove);
    sourceCanvas.addEventListener("pointerup", onSourcePointerUp);
    sourceCanvas.addEventListener("dblclick", closeSelection);
    sourceCanvas.addEventListener("wheel", onSourceWheel, { passive: false });
  }
  function onSourcePointerDown(event) {
    if (!(Animotion.panelEditor?.imageFor() || state.image) || !state.sourceView) return;
    if (event.button === 1 || state.spaceDown) return beginPan(event);
    const point = Animotion.view.canvasPoint(event, sourceCanvas, state.sourceView);
    if (!point) return;
    handleToolPointerDown(event, point);
  }

  function beginPan(event) {
    event.preventDefault();
    state.drag = {
      kind: Animotion.dragKind.panSource,
      startClient: { x: event.clientX, y: event.clientY },
      startPan: { ...state.sourcePan },
    };
    sourceCanvas.setPointerCapture(event.pointerId);
  }

  function handleToolPointerDown(event, point) {
    const tool = els.selectionTool.value;
    if (tool === Animotion.tool.edit) {
      const editing = Animotion.panelEditor?.canEditRig() === false
        ? Animotion.editor.beginSelectionEditOnly(point)
        : Animotion.editor.beginShapeEdit(point);
      if (editing) sourceCanvas.setPointerCapture(event.pointerId);
      return;
    }
    if (tool === Animotion.tool.polygon) return addPolygonPoint(point);
    if (tool === Animotion.tool.lasso) return beginLasso(event, point);
    if (tool === Animotion.tool.rect || tool === Animotion.tool.ellipse) beginBox(event, point, tool);
  }

  function addPolygonPoint(point) {
    if (!state.selection || state.selection.kind !== Animotion.shapeKind.polygon || state.selection.closed) {
      state.selection = { kind: Animotion.shapeKind.polygon, closed: false, points: [point] };
    } else if (shouldClosePolygon(point)) {
      closeSelection();
    } else {
      state.selection.points.push(point);
    }
    Animotion.ui.refreshUi();
  }

  function shouldClosePolygon(point) {
    return state.selection.points.length >= 3 &&
      geometry.distance(state.selection.points[0], point) <= Animotion.config.hitTolerancePx / state.sourceView.scale;
  }

  function beginLasso(event, point) {
    state.selection = { kind: Animotion.shapeKind.lasso, closed: false, points: [point] };
    state.drag = { kind: Animotion.dragKind.drawLasso };
    sourceCanvas.setPointerCapture(event.pointerId);
    Animotion.ui.refreshUi();
  }

  function beginBox(event, point, tool) {
    state.selection = { kind: tool, closed: true, points: geometry.rectPoints(point, point) };
    state.drag = { kind: Animotion.dragKind.drawBox, start: point, tool };
    sourceCanvas.setPointerCapture(event.pointerId);
    Animotion.ui.refreshUi();
  }

  function onSourcePointerMove(event) {
    if (!state.drag || !(Animotion.panelEditor?.imageFor() || state.image) || !state.sourceView) return;
    if (state.drag.kind === Animotion.dragKind.panSource) return updatePan(event);
    const point = Animotion.view.canvasPoint(event, sourceCanvas, state.sourceView);
    if (!point) return;
    if (state.drag.kind === Animotion.dragKind.drawBox) updateBox(point);
    if (state.drag.kind === Animotion.dragKind.drawLasso) updateLasso(point);
    if (isEditDrag()) Animotion.editor.applyDragEdit(point);
    Animotion.ui.refreshUi();
  }

  function updatePan(event) {
    state.sourcePan = {
      x: state.drag.startPan.x + event.clientX - state.drag.startClient.x,
      y: state.drag.startPan.y + event.clientY - state.drag.startClient.y,
    };
    Animotion.ui.refreshUi();
  }

  function updateBox(point) {
    state.selection = { kind: state.drag.tool, closed: true, points: geometry.rectPoints(state.drag.start, point) };
  }

  function updateLasso(point) {
    const last = state.selection.points[state.selection.points.length - 1];
    if (!last || geometry.distance(last, point) > Animotion.config.lassoPointSpacing) {
      state.selection.points.push(point);
    }
  }

  function isEditDrag() {
    return state.drag.kind === Animotion.dragKind.editSelection || state.drag.kind === Animotion.dragKind.editPart;
  }

  function onSourcePointerUp(event) {
    if (sourceCanvas.hasPointerCapture(event.pointerId)) sourceCanvas.releasePointerCapture(event.pointerId);
    if (state.drag?.kind === Animotion.dragKind.drawLasso && state.selection?.points.length >= 3) closeSelection();
    state.drag = null;
    Animotion.ui.refreshUi();
  }

  function closeSelection() {
    if (!state.selection || state.selection.points.length < 3) return;
    state.selection.closed = true;
    els.selectionTool.value = Animotion.tool.edit;
    Animotion.ui.refreshUi();
  }

  function onSourceWheel(event) {
    if (!state.image) return;
    event.preventDefault();
    const rect = sourceCanvas.getBoundingClientRect();
    const anchor = { x: event.clientX - rect.left, y: event.clientY - rect.top };
    const factor = event.deltaY < 0 ? Animotion.config.wheelZoomStep : 1 / Animotion.config.wheelZoomStep;
    Animotion.view.setSourceZoom(state.sourceZoom * factor, anchor);
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
    els.finishSelection.addEventListener("click", closeSelection);
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
      state.startTime = keyframeStartTime();
      els.playPause.textContent = "일시정지";
      return;
    }
    state.pausedTime = (performance.now() - state.startTime) / 1000;
    els.playPause.textContent = "재생";
  }

  function keyframeStartTime() {
    if (!timelineLikeMode()) return performance.now() - state.pausedTime * 1000;
    return performance.now() - ((state.currentFrame - 1) / Animotion.config.timelineFps) * 1000;
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

  Animotion.events = { bindEvents, onSourcePointerDown };
}
