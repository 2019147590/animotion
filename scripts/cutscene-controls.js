{
  const global = window;
  const Animotion = global.Animotion;
  const { els } = Animotion.dom;
  const state = Animotion.state;

  function bindPanelTransformEvents() {
    syncScaleInputLimits();
    els.sourcePanelX.addEventListener("input", () => updateBridgeTransform("sourceX", els.sourcePanelX.value));
    els.sourcePanelY.addEventListener("input", () => updateBridgeTransform("sourceY", els.sourcePanelY.value));
    els.sourcePanelScale.addEventListener("input", () => updateBridgeTransform("sourceScale", els.sourcePanelScale.value));
    els.impactPanelX.addEventListener("input", () => updateBridgeTransform("impactX", els.impactPanelX.value));
    els.impactPanelY.addEventListener("input", () => updateBridgeTransform("impactY", els.impactPanelY.value));
    els.impactPanelScale.addEventListener("input", () => updateBridgeTransform("impactScale", els.impactPanelScale.value));
  }

  function updateBridgeTransform(key, value) {
    Animotion.sessionCommands.updateCutsceneBridge({ [key]: Number(value) });
    Animotion.ui.refreshUi();
  }

  function syncScaleInputLimits() {
    const range = Animotion.cutsceneModel.PANEL_SCALE_RANGE;
    for (const input of [els.sourcePanelScale, els.impactPanelScale]) {
      input.min = String(range.min);
      input.max = String(range.max);
    }
  }

  function preservePanelTransform(nextBridge, previousBridge) {
    const previous = Animotion.cutsceneModel.normalizeBridge(previousBridge);
    return {
      ...nextBridge,
      sourceX: previous.sourceX,
      sourceY: previous.sourceY,
      sourceScale: previous.sourceScale,
      impactX: previous.impactX,
      impactY: previous.impactY,
      impactScale: previous.impactScale,
      sourceMotionEnabled: previous.sourceMotionEnabled,
      bodyAssistEnabled: previous.bodyAssistEnabled,
      ghostEnabled: previous.ghostEnabled,
    };
  }

  Animotion.cutsceneControls = { bindPanelTransformEvents, preservePanelTransform };
}
