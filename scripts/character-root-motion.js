{
  const global = typeof window !== "undefined" ? window : globalThis;
  const Animotion = global.Animotion || (global.Animotion = {});
  const CHARACTER_TYPES = new Set(["head", "body", "spine", "arm", "leg", "hand", "hair", "eye", "mouth", "clothes"]);

  function debugForPlan(parts, primary, beats, base, plan, targetDebug = {}) {
    const scope = targetDebug.chosenMotionScope || plan.motionScope || "body-follow";
    const root = rootPart(parts);
    const rootDelta = beatRootDelta(base, impactBeat(beats));
    return {
      rootDelta: { ...rootDelta, coordinateSpace: "sourceImage" },
      bodyFollowStrength: scope === "limb-only" ? 0 : 1,
      primaryPartId: primary?.id || null,
      bodyRootPartId: root?.id || null,
      rootDeltaPartIds: rootDeltaPartIds(parts, scope),
    };
  }

  function applyToTransform(transform, part, context = {}) {
    const scope = context.targetDebug?.chosenMotionScope || "limb-only";
    if (scope === "limb-only" || !receivesRootDelta(part)) return transform;
    const rootDelta = context.rootDelta || rootDeltaForFrame(context.parts, context.frame);
    const desired = scaled(rootDelta, context.targetDebug?.bodyFollowStrength ?? 1);
    return {
      ...transform,
      x: (Number(transform.x) || 0) + desired.x - (Number(transform.x) || 0),
      y: (Number(transform.y) || 0) + desired.y - (Number(transform.y) || 0),
    };
  }

  function evaluationDebug(parts = [], frame = 1, bridge = {}) {
    const targetDebug = bridge?.jointAction?.targetDebug || {};
    const rootDelta = rootDeltaForFrame(parts, frame);
    return {
      motionScope: targetDebug.chosenMotionScope || "limb-only",
      rootDelta,
      bodyFollowStrength: targetDebug.bodyFollowStrength ?? 0,
      primaryPartId: bridge.primaryPartId || targetDebug.primaryPartId || null,
      bodyRootPartId: targetDebug.bodyRootPartId || rootPart(parts)?.id || null,
      rootDeltaPartIds: rootDeltaPartIds(parts, targetDebug.chosenMotionScope),
      parts: parts.filter((part) => !part.hidden).map((part) => finalPartDebug(part, parts, frame, bridge, rootDelta)),
    };
  }

  function finalPartDebug(part, parts, frame, bridge, rootDelta) {
    const base = Animotion.motionModel.poseToTransform(Animotion.timeline.evaluatePartAtFrame(part, frame));
    const final = applyToTransform(base, part, { parts, frame, rootDelta, targetDebug: bridge?.jointAction?.targetDebug });
    return { id: part.id, type: part.type, x: final.x, y: final.y, rotation: final.rotate };
  }

  function rootDeltaForFrame(parts = [], frame = 1) {
    const root = rootPart(parts);
    if (!root) return { x: 0, y: 0, coordinateSpace: "sourceImage" };
    const pose = Animotion.timeline.evaluatePartAtFrame(root, frame);
    return { x: Number(pose.x) || 0, y: Number(pose.y) || 0, coordinateSpace: "sourceImage" };
  }

  function rootDeltaPartIds(parts = [], scope = "limb-only") {
    return scope === "limb-only" ? [] : parts.filter(receivesRootDelta).map((part) => part.id);
  }

  function receivesRootDelta(part) {
    return part?.hidden !== true && CHARACTER_TYPES.has(part?.type);
  }

  function rootPart(parts = []) {
    return parts.find((part) => part.type === "spine") || parts.find((part) => part.type === "body") || null;
  }

  function impactBeat(beats = []) {
    return beats.find((beat) => beat.id === "impact" || beat.id === "arrive") || beats[beats.length - 1] || null;
  }

  function beatRootDelta(base, beat) {
    if (!base?.hip || !beat?.pose?.hip) return { x: 0, y: 0 };
    return { x: beat.pose.hip[0] - base.hip[0], y: beat.pose.hip[1] - base.hip[1] };
  }

  function scaled(delta, strength) {
    return { x: (Number(delta?.x) || 0) * strength, y: (Number(delta?.y) || 0) * strength };
  }

  Animotion.characterRootMotion = { debugForPlan, applyToTransform, evaluationDebug, rootDeltaForFrame, rootDeltaPartIds };

  if (typeof module !== "undefined") module.exports = Animotion.characterRootMotion;
}
