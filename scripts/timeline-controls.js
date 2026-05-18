{
  const global = window;
  const Animotion = global.Animotion;
  const { els } = Animotion.dom;
  const state = Animotion.state;

  function bindTimelineControls() {
    els.currentFrame.addEventListener("input", () => setCurrentFrame(Number(els.currentFrame.value)));
    els.insertKeyframe.addEventListener("click", insertKeyframe);
    els.deleteKeyframe.addEventListener("click", deleteKeyframe);
    els.autoAnticipation.addEventListener("click", generateAnticipation);
  }

  function setCurrentFrame(frame) {
    state.currentFrame = clampFrame(frame);
    state.running = false;
    els.playPause.textContent = "재생";
    syncSelectedPartPoseToFrame();
    Animotion.ui.refreshUi();
  }

  function syncSelectedPartPoseToFrame() {
    const part = Animotion.parts.selectedPart();
    if (!part || !timelineLikeMode()) return;
    Animotion.motionCommands.syncPartPoseToFrame(part, state.currentFrame);
  }

  function insertKeyframe() {
    const part = Animotion.parts.selectedPart();
    if (!part) return;
    const pose = Animotion.motionModel.normalizeCustomMotion(part.customMotion);
    Animotion.motionCommands.insertKeyframe(part, state.currentFrame, pose);
    Animotion.ui.refreshUi();
  }

  function deleteKeyframe() {
    const part = Animotion.parts.selectedPart();
    if (!part) return;
    Animotion.motionCommands.deleteKeyframe(part, state.currentFrame);
    Animotion.ui.refreshUi();
  }

  function generateAnticipation() {
    const primary = Animotion.parts.selectedPart();
    if (!primary) return;
    const cutsceneMode = els.motionTemplate.value === "cutscene";
    const previousBridge = Animotion.cutsceneModel.normalizeBridge(state.cutsceneBridge);
    if (cutsceneMode || state.nextImage) {
      Animotion.motionCommands.setCutsceneBridge(Animotion.cutsceneControls.preservePanelTransform(
        Animotion.cutsceneModel.createBridge(state.parts, primary.id),
        previousBridge
      ));
    }
    if (state.cutsceneBridge) {
      Animotion.motionCommands.updateJointAction(
        Animotion.jointCoordinates.createJointAction(state.parts, primary.id, state.cutsceneBridge)
      );
    }
    const frameLimit = currentFrameLimit();
    const impactFrame = cutsceneMode || state.cutsceneBridge ? state.cutsceneBridge.impactFrame : state.currentFrame;
    const result = Animotion.poseAssist.generateAnticipation(
      state.parts,
      primary.id,
      impactFrame,
      frameLimit
    );
    Animotion.motionCommands.applyGeneratedTracks(result.tracks);
    els.motionTemplate.value = state.cutsceneBridge ? "cutscene" : "keyframes";
    setCurrentFrame(result.impactFrame);
  }

  function clampFrame(frame) {
    return Animotion.geometry.clamp(Math.round(frame), 1, currentFrameLimit());
  }

  function currentFrameLimit() {
    if (els.motionTemplate.value === "cutscene" || state.cutsceneBridge) {
      return Animotion.cutsceneModel.normalizeBridge(state.cutsceneBridge).durationFrames;
    }
    return Animotion.config.timelineFrames;
  }

  function timelineLikeMode() {
    return els.motionTemplate.value === "keyframes" || els.motionTemplate.value === "cutscene";
  }

  Animotion.timelineControls = { bindTimelineControls, setCurrentFrame, syncSelectedPartPoseToFrame };
}
