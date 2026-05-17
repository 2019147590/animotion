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
    Animotion.cutsceneOptions?.refreshControls?.();
    renderLookismPresetStatus();
    renderPanelScaleControls();
    renderKeyframeStatus();
    renderPartsList();
    renderInspector();
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
    els.pivotEditTarget.value = els.pivotEditTarget.value || "anchor";
    els.pivotX.value = part.rect.w ? part.pivot.x / part.rect.w : 0.5;
    els.pivotY.value = part.rect.h ? part.pivot.y / part.rect.h : 0.5;
    els.jointX.value = part.rect.w ? part.joint.x / part.rect.w : 0.5;
    els.jointY.value = part.rect.h ? part.joint.y / part.rect.h : 0.5;
    els.editOrder.value = part.order;
    els.editAlpha.value = part.alpha;
    els.editHidden.checked = part.hidden;
    renderMotionControls(part);
    renderParentOptions(part);
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
    els.editParent.value = part.parentId || "";
  }

  function isDescendant(candidateId, ancestorId) {
    let current = state.parts.find((part) => part.id === candidateId);
    while (current?.parentId) {
      if (current.parentId === ancestorId) return true;
      current = state.parts.find((part) => part.id === current.parentId);
    }
    return false;
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
    updater(part);
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
