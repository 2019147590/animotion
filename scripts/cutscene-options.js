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
      <label class="check-row">
        <input id="ghostEnabled" type="checkbox" />
        잔상효과
      </label>
    `;
    anchor.after(box);
    refs().sourceMotion.addEventListener("change", () => updateBridge("sourceMotionEnabled", refs().sourceMotion.checked));
    refs().bodyAssist.addEventListener("change", () => updateBridge("bodyAssistEnabled", refs().bodyAssist.checked));
    refs().ghost.addEventListener("change", () => updateBridge("ghostEnabled", refs().ghost.checked));
  }

  function refreshControls() {
    const ui = refs();
    if (!ui.sourceMotion || !ui.bodyAssist || !ui.ghost) return;
    const bridge = Animotion.cutsceneModel.normalizeBridge(Animotion.state.cutsceneBridge);
    ui.sourceMotion.checked = bridge.sourceMotionEnabled;
    ui.bodyAssist.checked = bridge.bodyAssistEnabled;
    ui.ghost.checked = bridge.ghostEnabled;
    ui.sourceMotion.disabled = !Animotion.state.image;
    ui.bodyAssist.disabled = !Animotion.state.parts.length;
    ui.ghost.disabled = !Animotion.state.image;
  }

  function updateBridge(key, value) {
    Animotion.sessionCommands.updateCutsceneBridge({ [key]: value });
    Animotion.ui?.refreshUi?.();
  }

  function refs() {
    return {
      sourceMotion: document.querySelector("#sourceMotionEnabled"),
      bodyAssist: document.querySelector("#bodyAssistEnabled"),
      ghost: document.querySelector("#ghostEnabled"),
    };
  }

  Animotion.cutsceneOptions = { installControls, refreshControls };
  installControls();
}
