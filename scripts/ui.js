{
  const global = window;
  const Animotion = global.Animotion;
  const { els } = Animotion.dom;
  const state = Animotion.state;
  const geometry = Animotion.geometry;

  function refreshUi() {
    const ready = geometry.shapeIsReady(state.selection, Animotion.imageBounds(), Animotion.config.minShapeSize);
    const rigEdit = Animotion.panelEditor?.canEditRig() !== false;
    els.capturePart.disabled = !state.image || !ready || !rigEdit;
    els.applyOutline.disabled = !state.image || !Animotion.parts.selectedPart() || !ready || !rigEdit;
    els.finishSelection.disabled = !state.selection || state.selection.closed || state.selection.points.length < 3;
    els.clearSelection.disabled = !state.selection;
    els.guideParts.disabled = !state.image || !rigEdit;
    els.applyDemoGengaMotion.disabled = !Animotion.scriptedGengaMotionPreset?.canApplyToApp?.();
    els.exportWebm.disabled = !state.image || state.parts.length === 0;
    els.saveRig.disabled = !state.image || state.parts.length === 0;
    els.sourceStatus.textContent = sourceStatusText();
    els.previewStatus.textContent = previewStatusText();
    els.currentFrame.max = String(currentFrameLimit());
    state.currentFrame = geometry.clamp(state.currentFrame, 1, currentFrameLimit());
    els.currentFrame.value = String(state.currentFrame);
    els.frameLabel.textContent = String(state.currentFrame);
    els.sourceZoom.value = String(state.sourceZoom);
    els.zoomReset.textContent = `${Math.round(state.sourceZoom * 100)}%`;
    els.separateCharacter.checked = state.separateCharacter;
    Animotion.panelEditor?.refreshControls?.();
    Animotion.motionPlanner?.refreshControls?.();
    Animotion.armChainRebind?.refreshControls?.();
    Animotion.actionFrameEditor?.refreshControls?.();
    Animotion.motionAnchorPicker?.refreshControls?.();
    Animotion.motionPathExplainer?.refreshControls?.();
    Animotion.motionDraftEditor?.refreshControls?.();
    Animotion.hiddenCompletionGuideEditor?.refreshControls?.();
    Animotion.hiddenCompletionPartPanel?.refreshControls?.();
    Animotion.correspondenceEditor?.refreshControls?.();
    Animotion.cutsceneOptions?.refreshControls?.();
    renderLookismPresetStatus();
    renderPanelScaleControls();
    renderKeyframeStatus();
    renderImpactExaggerationStatus();
    renderCutsceneMotionStatus();
    renderPartsList();
    renderInspector();
    Animotion.editTargetInspector?.refreshControls?.();
  }

  function renderKeyframeStatus() {
    const part = Animotion.parts.selectedPart();
    const frames = part ? Animotion.timeline.sortedKeyframes(part).map((keyframe) => keyframe.frame) : [];
    const keyframeMode = timelineLikeMode();
    els.insertKeyframe.disabled = !part || !keyframeMode;
    els.deleteKeyframe.disabled = !part || !keyframeMode || !frames.includes(state.currentFrame);
    els.autoAnticipation.disabled = !part || !state.parts.length;
    els.keyframeStatus.textContent = frames.length ? `키프레임: ${frames.join(", ")}` : "선택 파츠에 키프레임이 없습니다.";
  }

  function renderImpactExaggerationStatus() {
    if (!els.impactExaggerationStatus) return;
    const action = Animotion.cutsceneActionSelectors?.getActiveJointAction?.(state)?.action;
    const layer = action?.impactExaggeration;
    if (!layer) {
      if (els.impactExaggerationEnabled) {
        els.impactExaggerationEnabled.checked = false;
        els.impactExaggerationEnabled.disabled = true;
      }
      els.impactExaggerationStatus.textContent = "타격 과장 없음";
      return;
    }
    if (els.impactExaggerationEnabled) {
      els.impactExaggerationEnabled.checked = layer.enabled !== false;
      els.impactExaggerationEnabled.disabled = false;
    }
    els.impactExaggerationStatus.textContent = Animotion.impactExaggerationLayer?.summaryText?.(layer, state.parts)
      || (layer.enabled === false ? "타격 과장 꺼짐" : "타격 과장 켜짐");
  }

  function renderCutsceneMotionStatus() {
    if (!els.cutsceneMotionStatus) return;
    const status = Animotion.cutsceneMotionStatus?.statusForBridge?.(state.cutsceneBridge, { parts: state.parts, currentFrame: state.currentFrame, selectedPartId: state.selectedPartId, motionTemplate: els.motionTemplate.value, previewDrawSequence: state.previewDrawSequenceDebug, actionFrame: Animotion.actionFrameEditor?.selectionStatus?.() });
    els.cutsceneMotionStatus.textContent = Animotion.cutsceneMotionStatus?.statusText?.(status) || "Punch/kick motion status: unavailable";
  }

  function renderPartsList() {
    if (!state.parts.length) {
      els.partsList.className = "parts-list empty";
      els.partsList.textContent = "아직 파츠가 없습니다.";
      return;
    }
    els.partsList.className = "parts-list";
    const items = [...state.parts].sort((a, b) => a.order - b.order).map(createPartItem);
    els.partsList.replaceChildren(...items);
  }

  function createPartItem(part) {
    const item = document.createElement("button");
    item.className = `part-item${part.id === state.selectedPartId ? " selected" : ""}`;
    item.type = "button";
    item.innerHTML = `
      <div>
        <strong>${escapeHtml(part.name)}</strong>
        <span>${Animotion.partTypeLabels[part.type]} · ${part.rect.w}x${part.rect.h} · ${part.mask?.kind || Animotion.shapeKind.rect}</span>
      </div>
      <span class="layer-pill">${part.order}</span>
    `;
    item.addEventListener("click", () => {
      state.selectedPartId = part.id;
      els.selectionTool.value = Animotion.tool.edit;
      if (els.motionTemplate.value === "keyframes") Animotion.timelineControls.syncSelectedPartPoseToFrame();
      refreshUi();
    });
    return item;
  }

  function renderInspector() {
    const part = Animotion.parts.selectedPart();
    els.emptyInspector.classList.toggle("hidden", Boolean(part));
    els.partInspector.classList.toggle("hidden", !part);
    if (!part) return;
    els.editName.value = part.name;
    els.editType.value = part.type;
    if (els.editHumanRole) els.editHumanRole.value = part.humanRole || "";
    els.pivotEditTarget.value = els.pivotEditTarget.value || "anchor";
    renderRigSemanticControls(part);
    renderArmHandleAutoPlace(part);
    els.pivotX.value = part.rect.w ? part.pivot.x / part.rect.w : 0.5;
    els.pivotY.value = part.rect.h ? part.pivot.y / part.rect.h : 0.5;
    els.jointX.value = part.rect.w ? part.joint.x / part.rect.w : 0.5;
    els.jointY.value = part.rect.h ? part.joint.y / part.rect.h : 0.5;
    const handTip = Animotion.armRoleSemantics?.contactPointForPart?.(part, parentPart(part)) || Animotion.rigging?.handTipForPart?.(part) || part.joint;
    els.handTipX.value = part.rect.w ? handTip.x / part.rect.w : 0.5;
    els.handTipY.value = part.rect.h ? handTip.y / part.rect.h : 0.5;
    els.editOrder.value = part.order;
    els.editAlpha.value = part.alpha;
    els.editHidden.checked = part.hidden;
    renderMotionControls(part);
    renderParentOptions(part);
  }

  function renderRigSemanticControls(part) {
    const pivot = Animotion.armRoleSemantics?.labelFor?.(part, "rotationPivot") || "회전 중심";
    const joint = Animotion.armRoleSemantics?.labelFor?.(part, "joint") || "관절점";
    const handTip = Animotion.armRoleSemantics?.labelFor?.(part, "handTip") || "손끝점";
    setText(els.pivotXLabel, `${pivot} X`);
    setText(els.pivotYLabel, `${pivot} Y`);
    setText(els.jointXLabel, `${joint} X`);
    setText(els.jointYLabel, `${joint} Y`);
    setText(els.handTipXLabel, `${handTip} X`);
    setText(els.handTipYLabel, `${handTip} Y`);
    const jointEditable = Animotion.armRoleSemantics?.isRoleEditable?.(part, "joint") ?? true;
    const handTipEditable = Animotion.armRoleSemantics?.isRoleEditable?.(part, "handTip") ?? part.type === "arm";
    els.jointX.disabled = !jointEditable;
    els.jointY.disabled = !jointEditable;
    els.handTipX.disabled = !handTipEditable;
    els.handTipY.disabled = !handTipEditable;
    if (!handTipEditable && els.pivotEditTarget.value === "handTip") els.pivotEditTarget.value = "anchor";
  }

  function renderArmHandleAutoPlace(part) {
    if (!els.autoPlaceArmHandles) return;
    const preview = Animotion.armHandleAutoPlace?.preview?.(state.parts, part.id);
    els.autoPlaceArmHandles.disabled = !preview?.ok;
    if (els.autoPlaceArmHandlesStatus) {
      const currentStatus = state.armHandleAutoPlaceStatus?.partId === part.id ? state.armHandleAutoPlaceStatus.text : null;
      els.autoPlaceArmHandlesStatus.textContent = currentStatus || Animotion.armHandleAutoPlace?.statusText?.(preview) || "Auto place arm handles: unavailable";
    }
  }

  function renderMotionControls(part) {
    const motion = Animotion.motionModel.normalizeCustomMotion(part.customMotion);
    els.motionX.value = motion.x;
    els.motionY.value = motion.y;
    els.motionRotate.value = motion.rotate;
    els.motionScaleY.value = motion.scaleY;
    els.motionJointX.value = motion.jointX;
    els.motionJointY.value = motion.jointY;
    els.motionPhase.value = motion.phase;
  }

  function renderParentOptions(part) {
    els.editParent.replaceChildren(new Option("없음", ""));
    for (const candidate of state.parts) {
      if (candidate.id === part.id || isDescendant(candidate.id, part.id)) continue;
      els.editParent.append(new Option(candidate.name, candidate.id));
    }
    els.editParent.value = parentIdFor(part) || "";
  }

  function isDescendant(candidateId, ancestorId) {
    let current = state.parts.find((part) => part.id === candidateId);
    while (parentIdFor(current)) {
      const currentParentId = parentIdFor(current);
      if (currentParentId === ancestorId) return true;
      current = state.parts.find((part) => part.id === currentParentId);
    }
    return false;
  }

  function parentIdFor(part) {
    return Animotion.rigConnection?.parentIdFor?.(part) || part?.parentId || part?.parentPartId || null;
  }

  function parentPart(part) {
    const parentId = parentIdFor(part);
    return state.parts.find((candidate) => candidate.id === parentId) || null;
  }

  function setText(element, value) {
    if (element) element.textContent = value;
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, (char) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;",
    })[char]);
  }

  function updateSelectedPart(updater) {
    const part = Animotion.parts.selectedPart();
    if (!part) return;
    const patch = typeof updater === "function" ? updater(part) : updater;
    if (patch) Animotion.partCommands.updatePart(part, patch);
    refreshUi();
  }

  function previewStatusText() {
    if (state.lookismPreset?.active && els.motionTemplate.value === "cutscene") return "Lookism preset + impact";
    const suffix = state.nextImage && els.motionTemplate.value === "cutscene" ? " + impact" : "";
    return `${state.parts.length} parts${suffix}`;
  }

  function sourceStatusText() {
    const image = Animotion.panelEditor?.imageFor() || state.image;
    if (!image) return "이미지 없음";
    const prefix = Animotion.panelEditor?.activeTarget() === "impact" ? "B컷" : "A컷";
    return `${prefix} ${image.naturalWidth} x ${image.naturalHeight}`;
  }

  function renderLookismPresetStatus() {
    if (!els.lookismPresetStatus) return;
    if (state.lookismPreset?.loading) {
      els.lookismPresetStatus.textContent = "Lookism 컷신 자산을 불러오는 중입니다.";
      return;
    }
    if (state.lookismPreset?.error) {
      els.lookismPresetStatus.textContent = state.lookismPreset.error;
      return;
    }
    if (state.lookismPreset?.active) {
      els.lookismPresetStatus.textContent = "Lookism 컷신 프리셋이 적용되었습니다. 모션 템플릿은 웹툰 컷신으로 고정되어 재생됩니다.";
      return;
    }
    els.lookismPresetStatus.textContent = "lookism 폴더의 PNG 2개와 파츠를 사용해 0.5초 컷신을 즉시 재현합니다.";
  }

  function renderPanelScaleControls() {
    const bridge = Animotion.cutsceneModel.normalizeBridge(state.cutsceneBridge);
    els.sourcePanelX.value = bridge.sourceX;
    els.sourcePanelY.value = bridge.sourceY;
    els.sourcePanelScale.value = bridge.sourceScale;
    els.impactPanelX.value = bridge.impactX;
    els.impactPanelY.value = bridge.impactY;
    els.impactPanelScale.value = bridge.impactScale;
    els.impactPanelX.disabled = !state.nextImage;
    els.impactPanelY.disabled = !state.nextImage;
    els.impactPanelScale.disabled = !state.nextImage;
    els.impactReferenceOpacity.disabled = !state.nextImage;
  }

  function currentFrameLimit() {
    if (els.motionTemplate.value === "cutscene") {
      return Animotion.cutsceneModel.normalizeBridge(state.cutsceneBridge).durationFrames;
    }
    return Animotion.config.timelineFrames;
  }

  function timelineLikeMode() {
    return els.motionTemplate.value === "keyframes" || els.motionTemplate.value === "cutscene";
  }

  Animotion.ui = { refreshUi, updateSelectedPart };
}
