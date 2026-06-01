{
  const global = typeof window !== "undefined" ? window : globalThis;
  const Animotion = global.Animotion || (global.Animotion = {});
  const ACTION_ID = "boxingStep";
  const DEFAULT_DISTANCE_PX = 24;

  function createPlan(parts = [], primaryId = null, bridge = {}, plan = {}) {
    const spec = Animotion.actionSpecs?.specFor?.(ACTION_ID) || {};
    const focusKey = spec.primaryFocus?.owner === "bodyPart" ? spec.primaryFocus.point || "hip" : "hip";
    const actionTimeline = Animotion.actionTimelineModel.timelineForTemplate(ACTION_ID, bridge);
    const base = Animotion.jointCoordinates.inferJointPose(parts);
    const direction = forwardDirection(bridge.effectDirection);
    const distance = stepDistance(parts, plan);
    const foot = footKeys(base, direction);
    const beats = actionTimeline.beats.map((beat) => poseBeat(beat, base, direction, distance, foot));
    const primary = primaryPart(parts, primaryId);
    const targetDebug = {
      ...targetDebugFor(parts, primary, direction, distance, foot),
      primaryFocus: clonePlain(spec.primaryFocus),
      focusTarget: clonePlain(spec.focusTarget),
    };
    const trajectorySamples = Animotion.motionTargetState?.trajectorySamples?.(beats, focusKey) || [];
    return {
      target: null,
      motionScope: "full-character",
      targetDebug,
      activeMotionTarget: null,
      trajectoryPoints: trajectorySamples,
      trajectorySamples,
      anchors: [],
      active: { root: "hip", mid: "chest", end: focusKey, motion: "locomotion" },
      jointAction: {
        source: "motion-planner-boxingStep-locomotion-v1",
        focusKey,
        actionTimeline,
        anchors: [],
        beats,
        targetDebug,
        activeMotionTarget: null,
        trajectoryPoints: trajectorySamples,
        trajectorySamples,
        motionHints: plan.motionHints,
        motionDraft: Animotion.motionDrafts?.snapshot?.(plan.motionDraft) || plan.motionDraft,
      },
      partTracks: tracksForParts(parts, beats, base, direction, distance, foot),
    };
  }

  function poseBeat(beat, base, direction, distance, foot) {
    const ratio = rootRatio(beat.id);
    const root = scaled(direction, distance * ratio);
    const pose = shiftedPose(base, root);
    applyFootPose(pose, base, foot.lead, scaled(direction, distance * leadFootRatio(beat.id)));
    applyFootPose(pose, base, foot.rear, scaled(direction, distance * rearFootRatio(beat.id)));
    if (beat.id === "weightShift") pose.chest = rounded(add(pointFromArray(pose.chest), scaled(direction, -2)));
    return { id: beat.id, at: beat.at, pose };
  }

  function tracksForParts(parts, beats, base, direction, distance, foot) {
    return parts.map((part) => ({
      partId: part.id,
      keyframes: beats.map((beat) => ({ frame: beat.at, pose: poseForPart(part, beat, base, direction, distance, foot) })),
    }));
  }

  function poseForPart(part, beat, base, direction, distance, foot) {
    const pose = Animotion.motionModel.defaultCustomMotion();
    const root = scaled(direction, distance * rootRatio(beat.id));
    const side = sideForPart(part, base);
    if (isBodyLike(part) || isHeadLike(part) || isArmLike(part)) {
      pose.x = root.x;
      pose.y = root.y;
      return pose;
    }
    if (isLegLike(part) && side) {
      const key = side === "l" ? "lFoot" : "rFoot";
      const target = beat.pose[key] || base[key];
      pose.x = target[0] - base[key][0];
      pose.y = target[1] - base[key][1];
      if (!isFootLike(part)) {
        pose.x *= 0.55;
        pose.y *= 0.55;
      }
    }
    return pose;
  }

  function targetDebugFor(parts, primary, direction, distance, foot) {
    return {
      actionFamily: "locomotion",
      chosenMotionScope: "full-character",
      primaryPartId: primary?.id || null,
      bodyRootPartId: rootPart(parts)?.id || null,
      direction: "forward",
      directionVector: roundedObject(direction),
      distance,
      leadFootKey: foot.lead,
      rearFootKey: foot.rear,
      rootDelta: { ...scaled(direction, distance), coordinateSpace: "sourceImage" },
      characterRootDelta: { ...scaled(direction, distance), coordinateSpace: "sourceImage" },
      bodyFollowStrength: 1,
      rootDeltaPartIds: parts.filter((part) => !parentIdFor(part) && characterPart(part)).map((part) => part.id),
      legFallback: !parts.some(isLegLike),
    };
  }

  function footKeys(base, direction) {
    const left = pointFromArray(base.lFoot);
    const right = pointFromArray(base.rFoot);
    const lead = direction.x >= 0
      ? (right.x >= left.x ? "rFoot" : "lFoot")
      : (left.x <= right.x ? "lFoot" : "rFoot");
    return { lead, rear: lead === "lFoot" ? "rFoot" : "lFoot" };
  }

  function applyFootPose(pose, base, key, delta) {
    if (!pose[key] || !base[key]) return;
    pose[key] = rounded(add(pointFromArray(base[key]), delta));
  }

  function shiftedPose(base, delta) {
    return Object.fromEntries(Object.entries(base).map(([key, point]) => [key, rounded(add(pointFromArray(point), delta))]));
  }

  function rootRatio(id) {
    return ({ guard: 0, weightShift: 0.18, leadFootStep: 0.5, rearFootFollow: 0.82, settle: 1 })[id] ?? 0;
  }

  function leadFootRatio(id) {
    return ({ guard: 0, weightShift: 0.08, leadFootStep: 0.9, rearFootFollow: 0.95, settle: 1 })[id] ?? rootRatio(id);
  }

  function rearFootRatio(id) {
    return ({ guard: 0, weightShift: 0, leadFootStep: 0.12, rearFootFollow: 0.7, settle: 1 })[id] ?? rootRatio(id);
  }

  function stepDistance(parts, plan = {}) {
    const explicit = Number(plan.distancePx || plan.stepDistance);
    if (Number.isFinite(explicit) && explicit > 0) return clamp(Math.round(explicit), 8, 48);
    const body = rootPart(parts);
    return clamp(Math.round(Math.max(DEFAULT_DISTANCE_PX, Number(body?.rect?.w || 0) * 0.45)), 14, 36);
  }

  function forwardDirection(effectDirection = {}) {
    const x = Math.sign(Number(effectDirection.x) || 1) || 1;
    return { x, y: 0 };
  }

  function primaryPart(parts, primaryId) {
    return rootPart(parts) || parts.find((part) => part.id === primaryId) || parts[0] || null;
  }

  function rootPart(parts = []) {
    return parts.find((part) => ["torso", "pelvis"].includes(part.humanRole))
      || parts.find((part) => part.type === "spine" || part.type === "body")
      || null;
  }

  function sideForPart(part, base) {
    const center = centerPoint(part);
    const left = pointFromArray(base.lFoot);
    const right = pointFromArray(base.rFoot);
    return Math.abs(center.x - left.x) <= Math.abs(center.x - right.x) ? "l" : "r";
  }

  function isBodyLike(part = {}) {
    return ["torso", "pelvis"].includes(part.humanRole) || part.type === "body" || part.type === "spine";
  }

  function isHeadLike(part = {}) {
    return part.humanRole === "head" || part.type === "head";
  }

  function isArmLike(part = {}) {
    return ["upperArm", "forearm", "hand", "glove"].includes(part.humanRole) || ["arm", "hand", "glove"].includes(part.type);
  }

  function isLegLike(part = {}) {
    return ["thigh", "shin", "foot"].includes(part.humanRole) || part.type === "leg" || part.type === "foot";
  }

  function isFootLike(part = {}) {
    return part.humanRole === "foot" || part.type === "foot";
  }

  function characterPart(part = {}) {
    return isBodyLike(part) || isHeadLike(part) || isArmLike(part) || isLegLike(part);
  }

  function parentIdFor(part = {}) {
    return Animotion.rigConnection?.parentIdFor?.(part) || part.parentId || part.parentPartId || null;
  }

  function centerPoint(part = {}) {
    return { x: Number(part.rect?.x || 0) + Number(part.rect?.w || 0) / 2, y: Number(part.rect?.y || 0) + Number(part.rect?.h || 0) / 2 };
  }

  function pointFromArray(point) {
    return { x: Number(point?.[0]) || 0, y: Number(point?.[1]) || 0 };
  }

  function add(point, delta) {
    return { x: point.x + delta.x, y: point.y + delta.y };
  }

  function scaled(direction, distance) {
    return { x: Math.round(direction.x * distance), y: Math.round(direction.y * distance) };
  }

  function rounded(point) {
    return [Math.round(point.x), Math.round(point.y)];
  }

  function roundedObject(point) {
    return { x: Math.round(point.x), y: Math.round(point.y) };
  }

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function clonePlain(value) {
    return value ? JSON.parse(JSON.stringify(value)) : null;
  }

  Animotion.boxingStepLocomotion = { createPlan };
  if (typeof module !== "undefined") module.exports = Animotion.boxingStepLocomotion;
}
