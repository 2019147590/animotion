{
  const global = typeof window !== "undefined" ? window : globalThis;
  const Animotion = global.Animotion || (global.Animotion = {});

  function generateAnticipation(parts, primaryId, impactFrame, totalFrames) {
    const primary = parts.find((part) => part.id === primaryId) || parts[0];
    const impact = normalizeImpactFrame(impactFrame, totalFrames);
    const side = actionSide(primary, parts);
    return {
      impactFrame: impact,
      tracks: parts.map((part) => ({
        partId: part.id,
        keyframes: keyframesForPart(part, primary, side, impact, totalFrames),
      })),
    };
  }

  function solveControlPose(parts, primaryId, delta, basePoses = {}) {
    const primary = parts.find((part) => part.id === primaryId);
    if (!primary) return [];
    const side = actionSide(primary, parts);
    const pull = limitDelta(delta);
    return parts.map((part) => ({
      partId: part.id,
      pose: addPose(basePoseFor(part, basePoses), controlPose(part, primary, pull, side)),
    }));
  }

  function keyframesForPart(part, primary, side, impact, totalFrames) {
    const anticipation = anticipationPose(part, primary, side);
    const settle = scaledPose(anticipation, -0.22);
    return [
      { frame: clampFrame(impact - 16, totalFrames), pose: scaledPose(anticipation, 0.55) },
      { frame: clampFrame(impact - 7, totalFrames), pose: anticipation },
      { frame: impact, pose: zeroPose() },
      { frame: clampFrame(impact + 7, totalFrames), pose: settle },
      { frame: clampFrame(impact + 16, totalFrames), pose: zeroPose() },
    ].filter(uniqueFrameFilter());
  }

  function anticipationPose(part, primary, side) {
    const active = part.id === primary.id;
    if (part.type === "body" || part.type === "spine") return torsoPose(side, active);
    if (part.type === "head") return { ...zeroPose(), x: -side * 3, y: 2, rotate: -side * 5 };
    if (part.type === "arm") return active ? activeArmPose(side) : passiveLimbPose(side, -7);
    if (part.type === "leg") return active ? activeLegPose(side) : passiveLimbPose(side, 4);
    if (part.type === "hair") return { ...zeroPose(), rotate: -side * 6, jointX: -side * 4 };
    return zeroPose();
  }

  function torsoPose(side, active) {
    const boost = active ? 1.25 : 1;
    return {
      ...zeroPose(),
      x: -side * 6 * boost,
      y: 3,
      rotate: -side * 8 * boost,
      scaleY: -0.025,
      jointX: -side * 8,
      jointY: 4,
    };
  }

  function activeArmPose(side) {
    return { ...zeroPose(), x: -side * 18, y: 8, rotate: side * 22, jointX: -side * 22, jointY: 9 };
  }

  function activeLegPose(side) {
    return { ...zeroPose(), x: -side * 10, y: -3, rotate: side * 16, jointX: -side * 12, jointY: -5 };
  }

  function passiveLimbPose(side, rotate) {
    return { ...zeroPose(), x: -side * 3, y: 2, rotate: side * rotate, jointX: -side * 5 };
  }

  function controlPose(part, primary, pull, side) {
    const active = part.id === primary.id;
    if (active) return activeControlPose(primary, pull, side);
    if (part.type === "body" || part.type === "spine") return torsoControlPose(pull, side);
    if (part.type === "head") return headControlPose(pull);
    if (part.type === "hair") return hairControlPose(pull);
    if (part.type === "arm" || part.type === "leg") return counterLimbControlPose(pull, side);
    return zeroPose();
  }

  function activeControlPose(part, pull, side) {
    return {
      ...zeroPose(),
      jointX: pull.x,
      jointY: pull.y,
    };
  }

  function torsoControlPose(pull, side) {
    return {
      ...zeroPose(),
      x: pull.x * 0.08,
      y: pull.y * 0.04,
      rotate: clamp(pull.x * side * 0.12, -12, 12),
      scaleY: -Math.min(Math.abs(pull.x) * 0.0008, 0.04),
      jointX: pull.x * 0.12,
      jointY: pull.y * 0.08,
    };
  }

  function headControlPose(pull) {
    return { ...zeroPose(), x: pull.x * 0.04, y: pull.y * 0.03, rotate: clamp(-pull.x * 0.05, -7, 7) };
  }

  function hairControlPose(pull) {
    return { ...zeroPose(), rotate: clamp(-pull.x * 0.07, -9, 9), jointX: -pull.x * 0.08 };
  }

  function counterLimbControlPose(pull, side) {
    return { ...zeroPose(), x: -pull.x * 0.05, y: -pull.y * 0.03, rotate: clamp(-pull.x * side * 0.08, -8, 8) };
  }

  function actionSide(primary, parts) {
    const body = parts.find((part) => part.type === "spine") || parts.find((part) => part.type === "body");
    if (!primary || !body) return 1;
    return centerX(primary) < centerX(body) ? -1 : 1;
  }

  function centerX(part) {
    return part.rect.x + part.rect.w * 0.5;
  }

  function scaledPose(pose, amount) {
    const next = zeroPose();
    for (const key of Object.keys(next)) next[key] = pose[key] * amount;
    return next;
  }

  function addPose(base, delta) {
    const next = zeroPose();
    for (const key of Object.keys(next)) next[key] = base[key] + delta[key];
    return next;
  }

  function basePoseFor(part, basePoses) {
    return Animotion.motionModel.normalizeCustomMotion(basePoses[part.id] || part.customMotion);
  }

  function limitDelta(delta) {
    return {
      x: finiteNumber(delta.x),
      y: finiteNumber(delta.y),
    };
  }

  function finiteNumber(value) {
    const number = Number(value);
    return Number.isFinite(number) ? number : 0;
  }

  function zeroPose() {
    return Animotion.motionModel.defaultCustomMotion();
  }

  function normalizeImpactFrame(frame, totalFrames) {
    const preferred = Math.max(18, Math.round(Number(frame) || 18));
    return clampFrame(preferred, totalFrames);
  }

  function clampFrame(frame, totalFrames) {
    return Math.min(totalFrames, Math.max(1, Math.round(frame)));
  }

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function uniqueFrameFilter() {
    const seen = new Set();
    return (keyframe) => {
      if (seen.has(keyframe.frame)) return false;
      seen.add(keyframe.frame);
      return true;
    };
  }

  Animotion.poseAssist = { generateAnticipation, solveControlPose, actionSide };

  if (typeof module !== "undefined") module.exports = Animotion.poseAssist;
}
