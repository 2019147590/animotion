{
  const global = window;
  const Animotion = global.Animotion;
  const state = Animotion.state;

  function resetForNewImage(image, imageName) {
    state.project = Animotion.projectModel.createEmptyProject({
      name: imageName,
      canvas: { width: image.naturalWidth, height: image.naturalHeight },
    });
    Object.assign(state, {
      image,
      imageName,
      nextImage: null,
      nextImageName: "",
      parts: state.project.parts,
      selection: null,
      drag: null,
      selectedPartId: null,
      sourceZoom: 1,
      sourcePan: { x: 0, y: 0 },
      startTime: performance.now(),
      lookismPreset: null,
      panelEditTarget: "source",
      panelSetup: defaultPanelSetup(),
      correspondences: [],
    });
    resetMotionStateForImageUpload();
    clearHistory();
  }

  function setImpactImage(image, imageName) {
    state.nextImage = image;
    state.nextImageName = imageName;
    state.panelSetup.impact = normalizePanel();
  }

  function restoreLegacyRig(payload, parts, currentBridge) {
    state.parts = parts;
    state.project = Animotion.projectModel.projectFromEditorState({ ...state, parts });
    state.project.parts = parts;
    state.separateCharacter = Boolean(payload.separateCharacter);
    setPanelSetup(payload.panelSetup);
    setCorrespondences(payload.correspondences);
    Animotion.motionCommands.setMotionPlan(payload.motionPlan || state.motionPlan);
    setMergedBridge(payload.cutsceneBridge, currentBridge);
    restoreMotionTemplate();
    clearHistory();
  }

  function restoreProject(project, parts, currentBridge) {
    state.parts = parts;
    state.project = Animotion.projectModel.attachEditorParts(project, parts);
    state.imageName = project.editor?.imageName || state.imageName;
    state.nextImageName = project.editor?.nextImageName || state.nextImageName;
    state.separateCharacter = Boolean(project.editor?.separateCharacter);
    setPanelSetup(project.editor?.panelSetup);
    setCorrespondences(project.editor?.correspondences);
    Animotion.motionCommands.setMotionPlan(project.editor?.motionPlan || state.motionPlan);
    Animotion.motionCommands.setCutsceneBridge(project.editor?.cutsceneBridge || null);
    state.currentFrame = project.timeline?.currentFrame || state.currentFrame;
    state.selectedPartId = loadedSelectedPartId(project.editor?.selectedPartId);
    restoreMotionTemplate();
    clearHistory();
  }

  function applyLookismPreset(options) {
    Object.assign(state, {
      image: options.ready,
      imageName: options.imageName,
      nextImage: options.impact,
      nextImageName: options.nextImageName,
      parts: options.parts,
      selection: null,
      drag: null,
      previewDrag: null,
      sourceZoom: 1,
      sourcePan: { x: 0, y: 0 },
      running: true,
      pausedTime: 0,
      startTime: performance.now(),
      currentFrame: 1,
      separateCharacter: false,
      correspondences: [],
    });
    state.project = Animotion.projectModel.projectFromEditorState(state);
    state.project.parts = state.parts;
    state.selectedPartId = options.selectedPartId;
    Animotion.motionCommands.setCutsceneBridge(options.bridge);
    state.lookismPreset = options.lookismPreset;
    clearHistory();
  }

  function updateCutsceneBridge(patch) {
    return Animotion.motionCommands.setCutsceneBridge({
      ...state.cutsceneBridge,
      ...patch,
    });
  }

  function setPanelSetup(panelSetup) {
    if (Animotion.panelCommands) return Animotion.panelCommands.setPanelSetup(panelSetup);
    state.panelSetup = { source: normalizePanel(panelSetup?.source), impact: normalizePanel(panelSetup?.impact) };
    return state.panelSetup;
  }

  function setMergedBridge(baseBridge, currentBridge) {
    Animotion.motionCommands.setCutsceneBridge(
      Animotion.cutsceneModel.mergePanelTransform(baseBridge, currentBridge)
    );
  }

  function restoreMotionTemplate() {
    const template = Animotion.dom?.els?.motionTemplate;
    if (!template) return;
    if (state.cutsceneBridge?.jointAction) template.value = "cutscene";
    else if (state.parts.some((part) => part.keyframes?.length)) template.value = "keyframes";
  }

  function defaultPanelSetup() {
    return { source: normalizePanel(), impact: normalizePanel() };
  }

  function normalizePanel(panel) {
    return Animotion.panelEditor?.normalizePanel?.(panel) || {
      crop: panel?.crop || null,
      characterMask: panel?.characterMask || null,
    };
  }

  function defaultMotionPlan() {
    return Animotion.motionPlanner?.normalizePlan?.() || { template: "kick", target: null, targetMode: false };
  }

  function resetMotionStateForImageUpload() {
    return Animotion.cutsceneActionSelectors?.resetMotionStateForImageUpload?.(state) || Object.assign(state, {
      cutsceneBridge: null,
      selectedPartId: null,
      motionPlan: defaultMotionPlan(),
    });
  }

  function loadedSelectedPartId(partId) {
    return state.parts.some((part) => part.id === partId) ? partId : null;
  }

  function setCorrespondences(correspondences) {
    if (Animotion.correspondenceCommands) {
      return Animotion.correspondenceCommands.setCorrespondences(correspondences || [], { recordHistory: false });
    }
    state.correspondences = Animotion.correspondenceModel?.normalizeList?.(correspondences, state.parts) || [];
    return state.correspondences;
  }

  function clearHistory() {
    Animotion.commandHistory?.clear?.();
  }

  Animotion.sessionCommands = {
    resetForNewImage,
    setImpactImage,
    restoreLegacyRig,
    restoreProject,
    applyLookismPreset,
    updateCutsceneBridge,
    setPanelSetup,
  };
}
