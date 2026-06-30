{
  const global = typeof window !== "undefined" ? window : globalThis;
  const Animotion = global.Animotion || (global.Animotion = {});
  const OWNER_ID = "leadArmComposite";

  function bindingProfileFor(parts = [], primary = null, targetDebug = {}) {
    if (targetDebug.punchStyle !== "jab") return null;
    const chain = chainFromDebug(parts, primary, targetDebug);
    if (!chain.upperArmId || !chain.forearmId || !chain.handOrGloveId) return null;
    const proxy = wholeArmProxy(parts);
    const lockedPartIds = [chain.upperArmId, chain.forearmId, chain.handOrGloveId];
    if (proxy?.id) lockedPartIds.push(proxy.id);
    return {
      leadArm: {
        mode: proxy ? "wholeArmProxy" : "compositeRigid",
        ownerId: OWNER_ID,
        ...(proxy ? { proxyPartId: proxy.id, proxyUsage: "leadWholeArmJabProxy" } : {}),
        members: {
          leadUpperArm: chain.upperArmId,
          leadForearm: chain.forearmId,
          leadHand: chain.handOrGloveId,
        },
      },
      lockedPartIds,
      exclusiveOwnership: [{ ownerId: OWNER_ID, partIds: lockedPartIds }],
    };
  }

  function poseForPart(part, beat, context = {}) {
    const profile = context.bindingProfile;
    if (!isLockedPart(profile, part?.id)) return null;
    const pose = Animotion.motionModel?.defaultCustomMotion?.() || defaultPose();
    if (profile.leadArm?.mode === "wholeArmProxy") {
      return part.id === profile.leadArm.proxyPartId ? groupPose(beat, context, pose) : pose;
    }
    const upperId = profile.leadArm?.members?.leadUpperArm;
    if (part.id !== upperId) return pose;
    return groupPose(beat, context, pose);
  }

  function isLockedPart(profile = null, partId = null) {
    return Boolean(partId && ["compositeRigid", "wholeArmProxy"].includes(profile?.leadArm?.mode) && profile.lockedPartIds?.includes(partId));
  }

  function runtimeVisible(part, context = {}) {
    const profile = context.action?.bindingProfile || context.bindingProfile || null;
    const mode = profile?.leadArm?.mode;
    if (mode !== "wholeArmProxy") return part?.usage !== "leadWholeArmJabProxy";
    if (part?.id === profile.leadArm.proxyPartId) return true;
    return !profile.lockedPartIds?.includes(part?.id);
  }

  function referenceCurveFromPart(part = {}) {
    const keyframes = (Array.isArray(part.keyframes) ? part.keyframes : []).map((keyframe) => ({
      frame: Math.max(1, Math.round(Number(keyframe.frame) || 1)),
      pose: normalizePose(keyframe.pose),
    })).sort((a, b) => a.frame - b.frame);
    const duration = keyframes.reduce((max, keyframe) => Math.max(max, keyframe.frame), 1);
    return {
      sourcePartId: part.id || null,
      sourcePartName: part.name || null,
      durationFrames: duration,
      frames: keyframes.map((keyframe) => ({ ...keyframe, phase: duration > 1 ? (keyframe.frame - 1) / (duration - 1) : 0 })),
    };
  }

  function groupPose(beat = {}, context = {}, pose) {
    const active = context.active || {};
    const base = context.base || {};
    const baseRoot = pointFromArray(base[active.root]);
    const baseEnd = pointFromArray(base[active.end]);
    const targetRoot = pointFromArray(beat.pose?.[active.root]);
    const targetEnd = pointFromArray(beat.pose?.[active.end]);
    if (!baseEnd || !targetEnd) return pose;
    const parentDelta = parentRootDelta(base, beat.pose || {});
    pose.x = round(targetEnd.x - baseEnd.x - parentDelta.x);
    pose.y = round(targetEnd.y - baseEnd.y - parentDelta.y);
    if (baseRoot && targetRoot) {
      const baseVector = { x: baseEnd.x - baseRoot.x, y: baseEnd.y - baseRoot.y };
      const targetVector = { x: targetEnd.x - targetRoot.x, y: targetEnd.y - targetRoot.y };
      pose.rotate = round(clamp(angle(targetVector) - angle(baseVector), -36, 36));
    }
    return pose;
  }

  function chainFromDebug(parts, primary, targetDebug) {
    const debug = targetDebug.resolvedArmChain || {};
    if (debug.upperArmId || debug.forearmId || debug.handOrGloveId) {
      return {
        upperArmId: debug.upperArmId || null,
        forearmId: debug.forearmId || null,
        handOrGloveId: debug.handOrGloveId || null,
      };
    }
    const resolved = Animotion.armChainResolver?.resolve?.(parts, primary?.id || primary);
    return {
      upperArmId: resolved?.upperArmId || null,
      forearmId: resolved?.forearmId || null,
      handOrGloveId: resolved?.handOrGloveId || null,
    };
  }

  function wholeArmProxy(parts = []) {
    return parts.find((part) => part?.usage === "leadWholeArmJabProxy") || null;
  }

  function parentRootDelta(base = {}, pose = {}) {
    const baseHip = pointFromArray(base.hip);
    const poseHip = pointFromArray(pose.hip);
    if (!baseHip || !poseHip) return { x: 0, y: 0 };
    return { x: poseHip.x - baseHip.x, y: poseHip.y - baseHip.y };
  }

  function normalizePose(pose = {}) {
    return Animotion.motionModel?.normalizeCustomMotion?.(pose) || {
      x: numberOrDefault(pose.x, 0),
      y: numberOrDefault(pose.y, 0),
      rotate: numberOrDefault(pose.rotate, 0),
      scaleY: numberOrDefault(pose.scaleY, 0),
      jointX: numberOrDefault(pose.jointX, 0),
      jointY: numberOrDefault(pose.jointY, 0),
      phase: numberOrDefault(pose.phase, 0),
    };
  }

  function defaultPose() {
    return { x: 0, y: 0, rotate: 0, scaleY: 0, jointX: 0, jointY: 0, phase: 0 };
  }

  function pointFromArray(point) {
    if (!point) return null;
    const x = Number(point.x ?? point[0]);
    const y = Number(point.y ?? point[1]);
    return Number.isFinite(x) && Number.isFinite(y) ? { x, y } : null;
  }

  function angle(vector) {
    return Math.atan2(vector.y, vector.x) * 180 / Math.PI;
  }

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function round(value) {
    return Math.round(value * 100) / 100;
  }

  function numberOrDefault(value, fallback) {
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
  }

  Animotion.leadArmComposite = { OWNER_ID, bindingProfileFor, poseForPart, isLockedPart, runtimeVisible, referenceCurveFromPart };
  if (typeof module !== "undefined") module.exports = Animotion.leadArmComposite;
}
