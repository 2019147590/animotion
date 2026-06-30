{
  const global = typeof window !== "undefined" ? window : globalThis;
  const Animotion = global.Animotion || (global.Animotion = {});
  let statusMessage = "";

  function installControls() {
    if (typeof document === "undefined") return;
    const anchor = document.querySelector("#motionPlanStatus");
    if (!anchor || document.querySelector("#comboTimelineControls")) return;
    const panel = document.createElement("div");
    panel.id = "comboTimelineControls";
    panel.className = "motion-planner-tools";
    panel.innerHTML = controlsMarkup();
    anchor.after(panel);
    refs().mode.addEventListener("change", refreshControls);
    refs().generate.addEventListener("click", generateSelected);
    refreshControls();
  }

  function refreshControls() {
    const ui = refs();
    if (!ui.panel) return;
    ui.generate.disabled = !Animotion.state?.parts?.length;
    ui.status.textContent = statusMessage || selectedText(ui.mode.value);
  }

  function generateSelected() {
    const selected = parseSelection(refs().mode.value);
    if (selected.kind === "combo") return generateCombo(selected.id);
    return generateAction(selected.id);
  }

  function generateAction(actionId) {
    const template = Animotion.comboTimeline?.ACTION_ALIASES?.[actionId] || actionId;
    Animotion.motionCommands?.setMotionPlan?.({ template });
    const result = Animotion.motionPlannerCommands?.generateFromSelection?.();
    statusMessage = result?.generated ? `action ${actionId} generated` : actionFailureText(result?.reason);
    refreshControls();
  }

  function generateCombo(comboId) {
    const spec = Animotion.comboTimeline?.specFor?.(comboId);
    const built = Animotion.comboTimeline?.buildComboTimeline?.(spec, {
      parts: Animotion.state.parts,
      bridge: Animotion.state.cutsceneBridge,
      plan: Animotion.motionCommands?.currentMotionPlan?.() || Animotion.state.motionPlan,
      selectedPartId: Animotion.state.selectedPartId,
    });
    if (!built?.generated) {
      statusMessage = comboFailureText(built?.reason);
      refreshControls();
      return;
    }
    Animotion.motionCommands.applyMotionPlanResult(built.bridge, built.plan, built.result);
    Animotion.state.comboTimelineSelection = { mode: "combo", comboId };
    if (Animotion.dom?.els?.motionTemplate) Animotion.dom.els.motionTemplate.value = "cutscene";
    if (Animotion.timelineControls?.setCurrentFrame) Animotion.timelineControls.setCurrentFrame(1);
    else Animotion.ui?.refreshUi?.();
    statusMessage = `combo ${comboId} generated`;
    refreshControls();
  }

  function controlsMarkup() {
    return `
      <div class="action-frame-title">Action / Combo preview</div>
      <label>
        Mode
        <select id="comboTimelineMode">${optionMarkup()}</select>
      </label>
      <div class="button-row">
        <button id="generateComboTimeline" type="button">Generate selected</button>
      </div>
      <p id="comboTimelineStatus" class="hint"></p>
    `;
  }

  function optionMarkup() {
    const actions = [
      ["action:jab", "action: jab"],
      ["action:rearCross", "action: rearCross"],
    ];
    const combos = Animotion.comboTimeline?.optionSpecs?.().map((item) => [`combo:${item.id}`, `combo: ${item.label}`]) || [];
    return [...actions, ...combos].map(([value, label]) => `<option value="${escapeHtml(value)}">${escapeHtml(label)}</option>`).join("");
  }

  function parseSelection(value) {
    const [kind, id] = String(value || "action:jab").split(":");
    return { kind: kind === "combo" ? "combo" : "action", id: id || "jab" };
  }

  function selectedText(value) {
    const selected = parseSelection(value);
    return selected.kind === "combo"
      ? `combo ${selected.id}: actionId array timeline`
      : `action ${selected.id}: standalone generator`;
  }

  function actionFailureText(reason) {
    if (reason === "invalid-primary") return "Select an arm/hand part for jab/rearCross.";
    if (reason === "missing-primary") return "Could not find a punching part.";
    return "Action generation failed.";
  }

  function comboFailureText(reason) {
    const messages = {
      "missing-parts": "Load or create rig parts before generating a combo.",
      "missing-combo-spec": "Combo spec is not registered.",
      "missing-primary": "Could not find a punching part for the combo.",
      "combo-too-long": "Combo timeline exceeds 120 frames.",
      "action-generator-failed": "An action in the combo failed to generate.",
    };
    return messages[reason] || "Combo generation failed.";
  }

  function refs() {
    return {
      panel: document.querySelector("#comboTimelineControls"),
      mode: document.querySelector("#comboTimelineMode"),
      generate: document.querySelector("#generateComboTimeline"),
      status: document.querySelector("#comboTimelineStatus"),
    };
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[char]);
  }

  Animotion.comboTimelineControls = { installControls, refreshControls };
  installControls();
  if (typeof module !== "undefined") module.exports = Animotion.comboTimelineControls;
}
