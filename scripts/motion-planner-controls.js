{
  const global = typeof window !== "undefined" ? window : globalThis;
  const Animotion = global.Animotion || (global.Animotion = {});

  function installControls() {
    if (typeof document === "undefined") return;
    const anchor = document.querySelector("#autoAnticipation");
    if (!anchor || document.querySelector("#motionPlanTemplate")) return;
    const box = document.createElement("div");
    box.className = "motion-planner-tools";
    box.innerHTML = controlsMarkup();
    anchor.after(box);
    refs().template.addEventListener("change", updateTemplate);
    refs().pickTarget.addEventListener("click", toggleTargetMode);
    refs().generate.addEventListener("click", () => Animotion.motionPlannerCommands?.generateFromSelection?.());
  }

  function refreshControls() {
    const ui = refs();
    if (!ui.template) return;
    const plan = currentPlan();
    const part = Animotion.parts?.selectedPart?.();
    ui.template.value = plan.template;
    ui.pickTarget.classList.toggle("active", plan.targetMode);
    ui.pickTarget.disabled = !Animotion.state.image || !part || actionFamily(plan.template) === "locomotion";
    ui.generate.disabled = !Animotion.state.image || !part;
    ui.status.textContent = Animotion.motionPlannerCommands?.statusMessage?.(plan, part) || statusText(plan, part);
  }

  function setTargetMode(active, options = {}) {
    if (active && !options.skipExclusive) Animotion.previewPointerArbitration?.activateExclusivePicker?.("motionPlanner");
    const plan = Animotion.motionCommands.setMotionPlan({ targetMode: Boolean(active) });
    if (!plan.targetMode) Animotion.previewPointerArbitration?.clearActivePicker?.("motionPlanner");
    const shouldPause = plan.targetMode && Animotion.state.running;
    if (shouldPause) pausePlayback();
    if (options.refresh !== false) refresh();
    return plan.targetMode;
  }

  function hitTarget(event) {
    const plan = currentPlan();
    if (!plan.targetMode || !Animotion.state.previewView || !Animotion.state.image) return null;
    const point = previewPoint(event);
    return point ? { label: "motion target", point } : null;
  }

  function beginDragFromTarget(event, target) {
    const payload = target?.payload || target?.hit || target;
    const point = payload?.point || previewPoint(event);
    if (!point) return false;
    const bounds = Animotion.panelEditor?.imageBounds?.("source") || Animotion.imageBounds();
    Animotion.motionCommands.setMotionPlan(Animotion.motionTargetState?.manualTargetPatch?.({
      x: Math.round(Animotion.geometry.clamp(point.x, 0, bounds.width)),
      y: Math.round(Animotion.geometry.clamp(point.y, 0, bounds.height)),
    }) || { target: point, anchors: [], targetMode: false, targetSource: { type: "manual" } });
    refresh();
    return true;
  }

  function controlsMarkup() {
    return `
      <label>
        Action
        <select id="motionPlanTemplate">${optionMarkup()}</select>
      </label>
      <div class="button-row">
        <button id="pickMotionTarget" type="button">Pick motion target</button>
        <button id="generateMotionPlan" type="button">Generate beats/path</button>
      </div>
      <p id="motionPlanStatus" class="hint">Select a part and generate an editable action draft.</p>
    `;
  }

  function optionMarkup() {
    const specs = Animotion.actionSpecs?.optionSpecs?.() || [
      { id: "kick", label: "Kick" },
      { id: "punch", label: "Punch" },
      { id: "dash", label: "Dash" },
    ];
    return specs.map((item) => `<option value="${item.id}">${item.label}</option>`).join("");
  }

  function updateTemplate() {
    Animotion.motionPlannerCommands?.clearStatus?.();
    Animotion.motionCommands.setMotionPlan({ template: refs().template.value });
    refresh();
  }

  function toggleTargetMode() {
    setTargetMode(!currentPlan().targetMode);
  }

  function statusText(plan, part) {
    if (!part) return "Select a part to generate an action draft.";
    if (actionFamily(plan.template) === "locomotion") return `${templateLabel(plan.template)} - direction forward, short step`;
    const target = plan.target ? `target ${plan.target.x}, ${plan.target.y}` : "no target";
    const debug = Animotion.motionTargetState?.activeMotionTargetDebug?.(plan);
    const source = debug?.source ? ` - active ${debug.source} ${debug.point.x},${debug.point.y}` : "";
    const hints = Animotion.motionHints?.statusText?.(plan.motionHints);
    const selected = plan.selectedBeatId ? ` - beat ${plan.selectedBeatId}` : "";
    const scope = plan.targetDebug?.chosenMotionScope ? ` - ${plan.targetDebug.chosenMotionScope}` : "";
    const distance = Number.isFinite(plan.targetDebug?.computedDistance) ? ` - d ${Math.round(plan.targetDebug.computedDistance)}` : "";
    return `${templateLabel(plan.template)} - ${target}${source}${scope}${distance}${hints ? ` - ${hints}` : ""}${plan.anchors.length ? ` - anchors ${plan.anchors.length}` : ""}${selected}`;
  }

  function templateLabel(template) {
    return templateFor(template)?.label || template || "Action";
  }

  function actionFamily(template) {
    return templateFor(template)?.family || null;
  }

  function templateFor(template) {
    return Animotion.actionSpecs?.plannerTemplates?.()[template] || null;
  }

  function currentPlan() {
    return Animotion.motionCommands?.currentMotionPlan?.() || Animotion.motionPlanner?.normalizePlan?.(Animotion.state.motionPlan) || {};
  }

  function pausePlayback() {
    Object.assign(Animotion.state, { pausedTime: (performance.now() - Animotion.state.startTime) / 1000, running: false });
    if (Animotion.dom?.els?.playPause) Animotion.dom.els.playPause.textContent = "play";
  }

  function refs() {
    return {
      template: document.querySelector("#motionPlanTemplate"),
      pickTarget: document.querySelector("#pickMotionTarget"),
      generate: document.querySelector("#generateMotionPlan"),
      status: document.querySelector("#motionPlanStatus"),
    };
  }

  function previewPoint(event) {
    const canvas = Animotion.dom.previewCanvas;
    const rect = canvas.getBoundingClientRect();
    const screen = { x: event.clientX - rect.left, y: event.clientY - rect.top };
    return Animotion.previewTransform?.screenPointToImage?.(
      screen,
      Animotion.state.previewView,
      Animotion.state.previewSourceFrame,
      Animotion.state.previewSourceTransform
    ) || screen;
  }

  function refresh() {
    Animotion.ui?.refreshUi?.();
  }

  Animotion.motionPlannerControls = { installControls, refreshControls, setTargetMode, hitTarget, beginDragFromTarget, statusText };
  Object.assign(Animotion.motionPlanner || {}, { installControls, refreshControls, setTargetMode, hitTarget, beginDragFromTarget });
  installControls();
  if (typeof module !== "undefined") module.exports = Animotion.motionPlannerControls;
}
