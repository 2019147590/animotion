{
  const global = typeof window !== "undefined" ? window : globalThis;
  const Animotion = global.Animotion || (global.Animotion = {});
  const PRIMARY_BIAS = 1000;
  const SECONDARY_BIAS = 500;

  function orderedParts(parts = [], context = {}) {
    return parts.map((part, index) => ({ part, index, order: baseOrder(part) + depthBiasForPart(part, context) }))
      .sort((a, b) => a.order - b.order || a.index - b.index)
      .map((entry) => entry.part);
  }

  function depthBiasForPart(part, context = {}) {
    const bridge = context.bridge || {};
    const action = bridge.jointAction;
    if (!part || !isRearPunch(action)) return 0;
    const weight = depthWeight(action, context.frame);
    if (weight <= 0) return 0;
    const primary = primaryPart(context.parts || [], bridge, action);
    if (!primary) return 0;
    if (part.id === primary.id) return Math.round(PRIMARY_BIAS * weight);
    if (part.id === parentIdFor(primary) && isArmPart(part)) return Math.round(SECONDARY_BIAS * weight);
    return 0;
  }

  function depthWeight(action, frame) {
    const drive = beatFrame(action, "drive"), impact = beatFrame(action, "impact"), recover = beatFrame(action, "recover");
    const current = Math.round(Number(frame) || 1);
    if (!drive || !impact || current < drive) return 0;
    if (current <= impact) return 0.35 + 0.65 * ratio(current, drive, impact);
    if (!recover || current >= recover) return 0;
    return 1 - ratio(current, impact, recover);
  }

  function isRearPunch(action) {
    const timeline = action?.actionTimeline;
    return timeline?.template === "punch" && action?.targetDebug?.punchStyle === "rear-cross";
  }

  function primaryPart(parts, bridge, action) {
    const id = bridge.primaryPartId || action?.targetDebug?.primaryPartId;
    return parts.find((part) => part.id === id) || null;
  }

  function beatFrame(action, id) {
    return Math.round(Number((action?.beats || []).find((beat) => beat.id === id)?.at) || 0);
  }

  function ratio(value, start, end) {
    return Math.min(1, Math.max(0, (value - start) / Math.max(1, end - start)));
  }

  function baseOrder(part) { return Number(part?.order) || 0; }
  function parentIdFor(part) { return Animotion.rigConnection?.parentIdFor?.(part) || part.parentId || part.parentPartId || null; }
  function isArmPart(part) { return part?.type === "arm" || ["upperArm", "forearm", "hand"].includes(part?.humanRole); }

  Animotion.cutsceneDepth = { orderedParts, depthBiasForPart };
  if (typeof module !== "undefined") module.exports = Animotion.cutsceneDepth;
}
