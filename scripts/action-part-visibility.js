{
  const global = typeof window !== "undefined" ? window : globalThis;
  const Animotion = global.Animotion || (global.Animotion = {});
  const REAR_CROSS_HIDDEN_FILL = "rearCrossHiddenFill";

  function runtimeVisible(part, context = {}) {
    if (!part) return false;
    const action = actionAtFrame(context.action || null, context.frame);
    if (Animotion.leadArmComposite?.runtimeVisible?.(part, { ...context, action }) === false) return false;
    const actionId = currentActionId(context.action || null, context.frame);
    if (String(part.usage || "") === REAR_CROSS_HIDDEN_FILL) return actionId === "rearCross";
    const owners = [
      part.visibleForActionId,
      part.ownerActionId,
      part.createdForActionId,
      part.createdFromJointActionId,
    ].map(normalizeActionId).filter(Boolean);
    if (!owners.length) return true;
    return Boolean(actionId) && owners.includes(actionId);
  }

  function currentActionId(action, frame) {
    if (!action) return null;
    if (Animotion.actionScopedEffects?.frameContext && frame !== undefined) {
      return normalizeActionId(Animotion.actionScopedEffects.frameContext(action, frame).actionId);
    }
    return normalizeActionId(Animotion.actionScopedEffects?.actionIdFor?.(action) || action.actionId || action.id);
  }

  function actionAtFrame(action, frame) {
    const step = comboStep(action?.comboTimeline || action?.targetDebug?.comboTimeline, frame);
    if (!step) return action;
    return {
      ...action,
      actionId: step.actionId || action?.actionId || null,
      bindingProfile: step.bindingProfile || action?.bindingProfile || null,
      targetDebug: { ...(action?.targetDebug || {}), ...(step.targetDebug || {}) },
      primaryPartId: step.primaryPartId || action?.primaryPartId || null,
    };
  }

  function comboStep(combo, frame) {
    const current = Math.max(1, Math.round(Number(frame) || 1));
    const steps = Array.isArray(combo?.steps) ? combo.steps : [];
    return steps.find((step) => current >= frameValue(step.startFrame) && current <= frameValue(step.holdEndFrame || step.endFrame))
      || steps.find((step) => current <= frameValue(step.startFrame))
      || steps[steps.length - 1] || null;
  }

  function frameValue(value) {
    return Math.max(1, Math.round(Number(value) || 1));
  }

  function normalizeActionId(value) {
    if (value === undefined || value === null || value === "") return null;
    const text = String(value);
    if (text === "rearCross" || text === "rear-cross" || text === "rearHandPunch01") return "rearCross";
    if (text === "jab" || text === "leadJab" || text === "frontJab") return "jab";
    return text;
  }

  Animotion.actionPartVisibility = { REAR_CROSS_HIDDEN_FILL, runtimeVisible, currentActionId, actionAtFrame, normalizeActionId };
  if (typeof module !== "undefined") module.exports = Animotion.actionPartVisibility;
}
