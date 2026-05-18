{
  const global = window;
  const Animotion = global.Animotion;
  const state = Animotion.state;
  const data = Animotion.lookismPresetData;

  const FRAME_COUNT = 12;
  const IMPACT_FRAME = 11;

  async function loadIntoApp() {
    state.lookismPreset = { loading: true, active: false, error: "" };
    Animotion.ui.refreshUi();
    try {
      applyPresetState(await Animotion.lookismPresetAssets.loadImagesAndRig());
    } catch (error) {
      state.lookismPreset = presetError(error);
    }
    Animotion.ui.refreshUi();
  }

  function applyPresetState(assets) {
    const parts = Animotion.lookismPresetParts.createParts();
    Animotion.sessionCommands.applyLookismPreset({
      ready: assets.ready,
      impact: assets.impact,
      imageName: data.READY_IMAGE,
      nextImageName: data.ASSETS.impact.src,
      parts,
      selectedPartId: selectedImpactPartId(parts),
      bridge: createBridge(parts),
      lookismPreset: activePreset(assets),
    });
    applyControls();
  }

  function selectedImpactPartId(parts) {
    return parts.find((part) => part.name === "right_shin")?.id || parts[0]?.id || null;
  }

  function createBridge(parts) {
    return Animotion.cutsceneModel.normalizeBridge({
      primaryPartId: selectedImpactPartId(parts),
      durationFrames: FRAME_COUNT,
      impactFrame: IMPACT_FRAME,
      effectDirection: { x: 1, y: -0.25 },
      effectStrength: 1,
      jointAction: {
        source: "lookism-action-table-v1",
        beats: Animotion.lookismPresetAction.bridgeBeats(FRAME_COUNT),
      },
    });
  }

  function activePreset(assets) {
    return {
      loading: false,
      active: true,
      error: "",
      sprites: assets.sprites,
      rig: assets.rig,
      lastTime: 0,
    };
  }

  function presetError(error) {
    return {
      loading: false,
      active: false,
      error: `Lookism 컷신을 불러오지 못했습니다: ${error.message}`,
    };
  }

  function applyControls() {
    const { els } = Animotion.dom;
    els.motionTemplate.value = "cutscene";
    els.motionStrength.value = "1";
    els.backgroundOpacity.value = "0.45";
    els.playPause.textContent = "일시정지";
  }

  Animotion.lookismPreset = {
    loadIntoApp,
    drawPreview: Animotion.lookismPresetRenderer.drawPreview,
  };
}
