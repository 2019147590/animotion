{
  const global = typeof window !== "undefined" ? window : globalThis;
  const Animotion = global.Animotion || (global.Animotion = {});
  const REAR_CROSS_HIDDEN_FILL = "rearCrossHiddenFill";

  function runtimeVisible(part, context = {}) {
    if (!part) return false;
    if (Animotion.leadArmComposite?.runtimeVisible?.(part, context) === false) return false;
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

  function normalizeActionId(value) {
    if (value === undefined || value === null || value === "") return null;
    const text = String(value);
    if (text === "rearCross" || text === "rear-cross" || text === "rearHandPunch01") return "rearCross";
    if (text === "jab" || text === "leadJab" || text === "frontJab") return "jab";
    return text;
  }

  Animotion.actionPartVisibility = { REAR_CROSS_HIDDEN_FILL, runtimeVisible, currentActionId, normalizeActionId };
  if (typeof module !== "undefined") module.exports = Animotion.actionPartVisibility;
}
