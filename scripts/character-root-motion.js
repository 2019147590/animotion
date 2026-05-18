{
  const global = typeof window !== "undefined" ? window : globalThis;
  const Animotion = global.Animotion || (global.Animotion = {});
  const CHARACTER_TYPES = new Set(["head", "body", "spine", "arm", "leg", "hand", "hair", "eye", "mouth", "clothes"]);

  function debugForPlan(parts, primary, beats, base, plan, targetDebug = {}) {
    const scope = targetDebug.chosenMotionScope || plan.motionScope || "body-follow";
    const root = rootPart(parts);
    const rootDelta = beatRootDelta(base, impactBeat(beats));
    const tuning = targetDebug.rootMotionTuning || plan.rootMotionTuning || {};
    const characterRootDelta = { ...rootDelta, coordinateSpace: "sourceImage" };
    return {
      rootDelta: characterRootDelta,
      characterRootDelta,
      bodyFollowStrength: scope === "limb-only" ? 0 : Number(tuning.bodyFollowStrength ?? 1),
      primaryPartId: primary?.id || null,
      bodyRootPartId: root?.id || null,
      rootDeltaPartIds: rootDeltaPartIds(parts, scope),
    };
  }

  function applyToTransform(transform, part, context = {}) {
    const scope = context.targetDebug?.chosenMotionScope || "limb-only";
    const headFollow = unparentedHeadFollowDelta(part, context, scope);
    if (headFollow) return applyHeadFollow(transform, headFollow, context.targetDebug);
    if (scope === "limb-only" || !receivesRootDelta(part)) return transform;
    if (part.id === context.targetDebug?.primaryPartId && (part.type === "body" || part.type === "spine")) return transform;
    const rootDelta = context.rootDelta || rootDeltaForFrame(context.parts, context.frame);
    const desired = scaled(rootDelta, context.targetDebug?.bodyFollowStrength ?? 1);
    return {
      ...transform,
      x: (Number(transform.x) || 0) + desired.x - (Number(transform.x) || 0),
      y: (Number(transform.y) || 0) + desired.y - (Number(transform.y) || 0),
    };
  }

  function applyHeadFollow(transform, delta, targetDebug) {
    if (targetDebug?.chosenMotionScope === "full-character" && sameTranslation(transform, delta)) return transform;
    return {
      ...transform,
      x: (Number(transform.x) || 0) + delta.x,
      y: (Number(transform.y) || 0) + delta.y,
    };
  }

  function sameTranslation(transform = {}, delta = {}) {
    return Math.abs((Number(transform.x) || 0) - (Number(delta.x) || 0)) < 0.001
      && Math.abs((Number(transform.y) || 0) - (Number(delta.y) || 0)) < 0.001;
  }

  function unparentedHeadFollowDelta(part, context, scope) {
    if (!shouldHeadFollowRoot(part, context, scope)) return null;
    const root = rootPart(context.parts);
    if (!root) return null;
    const rootTransform = rootPoseTransform(root, context.frame);
    if (!hasTransform(rootTransform)) return null;
    return rootDisplacementAtPoint(root, rootTransform, partPivotImagePoint(part));
  }

  function shouldHeadFollowRoot(part, context, scope) {
    if (part?.type !== "head" || part.hidden === true || parentIdFor(part)) return false;
    if (!context.parts?.length || part.id === rootPart(context.parts)?.id) return false;
    if (context.targetDebug?.chosenMotionScope) return scope !== "limb-only";
    return true;
  }

  function rootPoseTransform(root, frame) {
    return Animotion.motionModel.poseToTransform(Animotion.timeline.evaluatePartAtFrame(root, frame));
  }

  function hasTransform(transform = {}) {
    return Boolean(Number(transform.x) || Number(transform.y) || Number(transform.rotate));
  }

  function rootDisplacementAtPoint(root, transform, point) {
    const pivot = partPivotImagePoint(root);
    const next = rotatePoint(point, pivot, degreesToRadians(transform.rotate));
    next.x += Number(transform.x) || 0;
    next.y += Number(transform.y) || 0;
    return { x: next.x - point.x, y: next.y - point.y };
  }

  function rotatePoint(point, pivot, radians) {
    const cos = Math.cos(radians);
    const sin = Math.sin(radians);
    const dx = point.x - pivot.x;
    const dy = point.y - pivot.y;
    return {
      x: pivot.x + dx * cos - dy * sin,
      y: pivot.y + dx * sin + dy * cos,
    };
  }

  function partPivotImagePoint(part) {
    const pivot = part?.pivot || { x: (Number(part?.rect?.w) || 0) * 0.5, y: (Number(part?.rect?.h) || 0) * 0.5 };
    return { x: (Number(part?.rect?.x) || 0) + (Number(pivot.x) || 0), y: (Number(part?.rect?.y) || 0) + (Number(pivot.y) || 0) };
  }

  function degreesToRadians(degrees) {
    return (Number(degrees) || 0) * Math.PI / 180;
  }

  function evaluationDebug(parts = [], frame = 1, bridge = {}) {
    const targetDebug = bridge?.jointAction?.targetDebug || {};
    const rootDelta = rootDeltaForFrame(parts, frame);
    return {
      motionScope: targetDebug.chosenMotionScope || "limb-only",
      rootDelta,
      characterRootDelta: rootDelta,
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
    return part?.hidden !== true && !parentIdFor(part) && CHARACTER_TYPES.has(part?.type);
  }

  function parentIdFor(part) {
    return Animotion.rigConnection?.parentIdFor?.(part) || null;
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
