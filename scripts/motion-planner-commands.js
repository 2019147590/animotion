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
    if (!part) return isPunchTemplate(template)
      ? "펀치 동작을 만들려면 arm/hand 파츠를 선택하세요."
      : "킥 동작을 만들려면 leg/foot 파츠를 선택하세요.";
    if (isPunchTemplate(template) && !PUNCH_ROLES.has(partKind(part))) return "펀치 동작은 arm/hand 계열 파츠를 선택한 뒤 생성하세요.";
    if (template === "kick" && !KICK_ROLES.has(partKind(part))) return "킥 동작은 leg/foot 계열 파츠를 선택한 뒤 생성하세요.";
    return "";
  }

  function isCanonicalAction(template) {
    return isPunchTemplate(template) || template === "kick";
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
    const timed = actionTimedBridge(preserved, template);
    if (!shouldPreserveFacingDirection(previousBridge, template, primary)) return timed;
    return { ...timed, effectDirection: previousBridge.effectDirection };
  }

  function actionTimedBridge(bridge, template) {
    const spec = Animotion.actionSpecs?.specFor?.(template);
    if (!spec?.defaultDurationFrames) return bridge;
    return {
      ...bridge,
      durationFrames: spec.defaultDurationFrames,
      impactFrame: spec.family === "locomotion" ? spec.defaultDurationFrames : Math.min(bridge.impactFrame, spec.defaultDurationFrames),
    };
  }

  function shouldPreserveFacingDirection(previousBridge, template, primary) {
    const previousAction = previousBridge?.jointAction;
    if (!isPunchTemplate(template) || !isPunchTemplate(actionTemplate(previousAction))) return false;
    if (samePunchStyleContext(previousAction, template)) return true;
    const previousId = previousBridge?.primaryPartId || previousBridge?.jointAction?.targetDebug?.primaryPartId;
    return !samePartReference(previousId, primary?.id, primary?.id);
  }

  function sameActionContext(previousBridge, previousAction, template, selectedPartId, primaryPartId) {
    const previousPartId = previousBridge?.primaryPartId;
    return compatibleActionTemplate(previousAction, template) && samePartReference(previousPartId, selectedPartId, primaryPartId);
  }

  function compatibleActionTemplate(previousAction, template) {
    if (actionTemplate(previousAction) === template) return true;
    return samePunchStyleContext(previousAction, template);
  }

  function samePunchStyleContext(previousAction, template) {
    if (!isPunchTemplate(template) || !isPunchTemplate(actionTemplate(previousAction))) return false;
    const nextStyle = Animotion.actionSpecs?.punchStyleFor?.(template) || null;
    if (!nextStyle) return false;
    return previousAction?.targetDebug?.punchStyle === nextStyle;
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
    const template = Animotion.cutsceneActionSelectors?.actionTemplate?.(action);
    return isCanonicalAction(template) ? template : null;
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
    if (Animotion.actionSpecs?.specFor?.(template)?.family === "locomotion") return bodyRootPart() || part;
    if (!isPunchTemplate(template) || !part) return part;
    const resolved = Animotion.armChainResolver?.resolve?.(Animotion.state?.parts || [], part);
    return resolved?.terminalPart || terminalPunchPart(part) || part;
  }

  function bodyRootPart() {
    const parts = Animotion.state?.parts || [];
    return parts.find((part) => ["torso", "pelvis"].includes(part.humanRole))
      || parts.find((part) => part.type === "spine" || part.type === "body")
      || null;
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

  function isPunchTemplate(template) {
    return Animotion.actionSpecs?.isPunchLike?.(template) || template === "punch";
  }

  function refresh() {
    Animotion.ui?.refreshUi?.();
  }

  Animotion.motionPlannerCommands = { generateFromSelection, statusMessage, clearStatus };
  if (typeof module !== "undefined") module.exports = Animotion.motionPlannerCommands;
}
