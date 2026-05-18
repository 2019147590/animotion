{
  const global = window;
  const Animotion = global.Animotion;

  function installControls() {
    const anchor = document.querySelector("#impactPanelY")?.closest("label");
    if (!anchor || document.querySelector("#sourceMotionEnabled")) return;
    const box = document.createElement("div");
    box.className = "cutscene-option-tools";
    box.innerHTML = `
      <label class="check-row">
        <input id="sourceMotionEnabled" type="checkbox" />
        A컷 이동/확대
      </label>
      <label class="check-row">
        <input id="bodyAssistEnabled" type="checkbox" />
        보조 몸 움직임
      </label>
    `;
    anchor.after(box);
    refs().sourceMotion.addEventListener("change", () => updateBridge("sourceMotionEnabled", refs().sourceMotion.checked));
    refs().bodyAssist.addEventListener("change", () => updateBridge("bodyAssistEnabled", refs().bodyAssist.checked));
  }

  function refreshControls() {
    const ui = refs();
    if (!ui.sourceMotion || !ui.bodyAssist) return;
    const bridge = Animotion.cutsceneModel.normalizeBridge(Animotion.state.cutsceneBridge);
    ui.sourceMotion.checked = bridge.sourceMotionEnabled;
    ui.bodyAssist.checked = bridge.bodyAssistEnabled;
    ui.sourceMotion.disabled = !Animotion.state.image;
    ui.bodyAssist.disabled = !Animotion.state.parts.length;
  }

  function updateBridge(key, value) {
    Animotion.sessionCommands.updateCutsceneBridge({ [key]: value });
    Animotion.ui?.refreshUi?.();
  }

  function refs() {
    return {
      sourceMotion: document.querySelector("#sourceMotionEnabled"),
      bodyAssist: document.querySelector("#bodyAssistEnabled"),
    };
  }

  Animotion.cutsceneOptions = { installControls, refreshControls };
  installControls();
}
