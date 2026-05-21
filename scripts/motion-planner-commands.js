{
  const global = typeof window !== "undefined" ? window : globalThis;
  const Animotion = global.Animotion || (global.Animotion = {});
  const PUNCH_ROLES = new Set(["arm", "upperArm", "forearm", "hand"]);
  const KICK_ROLES = new Set(["leg", "thigh", "shin", "foot"]);
  let blockedStatus = null;

  function generateFromSelection(options = {}) {
    const plan = currentPlan();
    const template = plan.template;
    const primary = selectedPart();
    const canonical = isCanonicalAction(template);
    if (options.onlyCanonicalActions && !canonical) return { handled: false, generated: false };
    const message = canonical ? primaryGuardMessage(template, primary) : "";
    if (message) {
      blockedStatus = { template, partId: primary?.id || null, message };
      refresh();
      return { handled: true, generated: false, reason: "invalid-primary", message };
    }
    if (!primary) return { handled: canonical, generated: false, reason: "missing-primary" };
    blockedStatus = null;
    const previous = Animotion.cutsceneModel.normalizeBridge(Animotion.state.cutsceneBridge);
    const bridge = Animotion.cutsceneControls.preservePanelTransform(
      Animotion.cutsceneModel.createBridge(Animotion.state.parts, primary.id),
      previous
    );
    const result = Animotion.motionPlanner.createPlan(Animotion.state.parts, primary.id, bridge, plan);
    Animotion.motionCommands.applyMotionPlanResult(bridge, plan, result);
    Animotion.dom.els.motionTemplate.value = "cutscene";
    if (options.setFrame !== false) Animotion.timelineControls.setCurrentFrame(bridge.impactFrame);
    else refresh();
    return { handled: true, generated: true, bridge: Animotion.state.cutsceneBridge, result };
  }

  function statusMessage(plan = currentPlan(), part = selectedPart()) {
    if (!blockedStatus) return "";
    if (blockedStatus.template !== plan.template) return "";
    if ((part?.id || null) !== blockedStatus.partId) return "";
    return blockedStatus.message;
  }

  function clearStatus() {
    blockedStatus = null;
  }

  function primaryGuardMessage(template, part) {
    if (!part) return template === "punch"
      ? "펀치 동작을 만들려면 arm/hand 파츠를 선택하세요."
      : "킥 동작을 만들려면 leg/foot 파츠를 선택하세요.";
    if (template === "punch" && !PUNCH_ROLES.has(partKind(part))) return "펀치 동작은 arm/hand 계열 파츠를 선택한 뒤 생성하세요.";
    if (template === "kick" && !KICK_ROLES.has(partKind(part))) return "킥 동작은 leg/foot 계열 파츠를 선택한 뒤 생성하세요.";
    return "";
  }

  function isCanonicalAction(template) {
    return template === "punch" || template === "kick";
  }

  function partKind(part = {}) {
    if (part.humanRole) return part.humanRole;
    return part.type || "";
  }

  function selectedPart() {
    return Animotion.parts?.selectedPart?.() || Animotion.state?.parts?.find((part) => part.id === Animotion.state?.selectedPartId) || null;
  }

  function currentPlan() {
    return Animotion.motionCommands?.currentMotionPlan?.() || Animotion.motionPlanner?.normalizePlan?.(Animotion.state?.motionPlan) || {};
  }

  function refresh() {
    Animotion.ui?.refreshUi?.();
  }

  Animotion.motionPlannerCommands = { generateFromSelection, statusMessage, clearStatus };
  if (typeof module !== "undefined") module.exports = Animotion.motionPlannerCommands;
}
