{
  const global = typeof window !== "undefined" ? window : globalThis;
  const Animotion = global.Animotion || (global.Animotion = {});
  const PUNCH_ROLES = new Set(["arm", "upperArm", "forearm", "hand"]);
  const KICK_ROLES = new Set(["leg", "thigh", "shin", "foot"]);
  let blockedStatus = null;

  function generateFromSelection(options = {}) {
    const plan = currentPlan();
    const template = plan.template;
    const selected = selectedPart();
    const primary = primaryForAction(template, selected);
    const canonical = isCanonicalAction(template);
    if (options.onlyCanonicalActions && !canonical) return { handled: false, generated: false };
    const message = canonical ? primaryGuardMessage(template, selected) : "";
    if (message) {
      blockedStatus = { template, partId: selected?.id || null, message };
      refresh();
      return { handled: true, generated: false, reason: "invalid-primary", message };
    }
    if (!primary) return { handled: canonical, generated: false, reason: "missing-primary" };
    blockedStatus = null;
    const previous = Animotion.cutsceneModel.normalizeBridge(Animotion.state.cutsceneBridge);
    const generationPlan = planForGeneration(plan, template, selected, primary, previous);
    const bridge = bridgeForGeneration(
      Animotion.cutsceneModel.createBridge(Animotion.state.parts, primary.id),
      previous,
      template,
      primary
    );
    const result = Animotion.motionPlanner.createPlan(Animotion.state.parts, primary.id, bridge, generationPlan);
    Animotion.motionCommands.applyMotionPlanResult(bridge, generationPlan, result);
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

  function planForGeneration(plan, template, selected, primary, previousBridge) {
    const scoped = planForGenerationBase(plan, template, selected, primary, previousBridge);
    return isCanonicalAction(template) ? { ...scoped, selectedPartId: selected?.id || primary?.id || null } : scoped;
  }

  function planForGenerationBase(plan, template, selected, primary, previousBridge) {
    if (!isCanonicalAction(template)) return plan;
    const previousAction = previousBridge?.jointAction;
    if (!previousAction) return plan;
    if (sameActionContext(previousBridge, previousAction, template, selected?.id, primary?.id)) return plan;
    return invalidatedDraftPlan(plan);
  }

  function bridgeForGeneration(nextBridge, previousBridge, template, primary) {
    const preserved = Animotion.cutsceneControls.preservePanelTransform(nextBridge, previousBridge);
    if (!shouldPreserveFacingDirection(previousBridge, template, primary)) return preserved;
    return { ...preserved, effectDirection: previousBridge.effectDirection };
  }

  function shouldPreserveFacingDirection(previousBridge, template, primary) {
    if (template !== "punch" || actionTemplate(previousBridge?.jointAction) !== "punch") return false;
    const previousId = previousBridge?.primaryPartId || previousBridge?.jointAction?.targetDebug?.primaryPartId;
    return !samePartReference(previousId, primary?.id, primary?.id);
  }

  function sameActionContext(previousBridge, previousAction, template, selectedPartId, primaryPartId) {
    const previousPartId = previousBridge?.primaryPartId;
    return actionTemplate(previousAction) === template && samePartReference(previousPartId, selectedPartId, primaryPartId);
  }

  function samePartReference(previousPartId, selectedPartId, primaryPartId) {
    if (Animotion.armChainResolver?.sameChainReference?.(previousPartId, selectedPartId, primaryPartId, Animotion.state?.parts || [])) return true;
    if (Animotion.motionPrimarySelection?.samePartReference) {
      return Animotion.motionPrimarySelection.samePartReference(previousPartId, selectedPartId, primaryPartId, Animotion.state?.parts || []);
    }
    if (!previousPartId) return false;
    if (previousPartId === primaryPartId || previousPartId === selectedPartId) return true;
    const parts = Animotion.state?.parts || [];
    const primary = parts.find((part) => part.id === primaryPartId);
    const previous = parts.find((part) => part.id === previousPartId);
    if (primary && isDescendantOf(primary, previousPartId, parts)) return true;
    const previousSuffix = numberedSuffix(previous);
    return Boolean(primary && previousSuffix && previousSuffix === numberedSuffix(primary));
  }

  function actionTemplate(action) {
    const timelineTemplate = action?.actionTimeline?.template;
    if (isCanonicalAction(timelineTemplate)) return timelineTemplate;
    const source = String(action?.source || "");
    const match = source.match(/^motion-planner-(punch|kick)-anchors-v1$/);
    return match?.[1] || null;
  }

  function invalidatedDraftPlan(plan) {
    return {
      ...plan,
      target: null,
      targetNormalized: null,
      targetSource: null,
      manualMotionTarget: null,
      activeMotionTarget: null,
      anchors: [],
      trajectoryPoints: [],
      selectedBeatId: null,
      targetDebug: null,
      motionHints: null,
      motionDraft: null,
    };
  }

  function partKind(part = {}) {
    return Animotion.armChainResolver?.roleFor?.(part) || part.humanRole || part.type || "";
  }

  function primaryForAction(template, part) {
    if (template !== "punch" || !part) return part;
    const resolved = Animotion.armChainResolver?.resolve?.(Animotion.state?.parts || [], part);
    return resolved?.terminalPart || terminalPunchPart(part) || part;
  }

  function terminalPunchPart(part) {
    if (partKind(part) === "hand") return part;
    const parts = Animotion.state?.parts || [];
    return descendantHand(part, parts) || numberedHand(part, parts);
  }

  function descendantHand(part, parts) {
    return parts.find((candidate) => (
      candidate.id !== part.id
      && partKind(candidate) === "hand"
      && isDescendantOf(candidate, part.id, parts)
    )) || null;
  }

  function isDescendantOf(part, ancestorId, parts) {
    let current = part;
    const seen = new Set();
    while (parentIdFor(current)) {
      const parentId = parentIdFor(current);
      if (parentId === ancestorId) return true;
      if (seen.has(parentId)) return false;
      seen.add(parentId);
      current = parts.find((candidate) => candidate.id === parentId);
      if (!current) return false;
    }
    return false;
  }

  function numberedHand(part, parts) {
    const suffix = numberedSuffix(part);
    if (!suffix) return null;
    return parts.find((candidate) => partKind(candidate) === "hand" && numberedSuffix(candidate) === suffix) || null;
  }

  function numberedSuffix(part) {
    return String(`${part?.id || ""} ${part?.name || ""}`).match(/(?:^|[^0-9])([0-9]+)(?!.*[0-9])/)?.[1] || null;
  }

  function parentIdFor(part = {}) {
    return Animotion.rigConnection?.parentIdFor?.(part) || part.parentId || part.parentPartId || null;
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
