{
  const global = typeof window !== "undefined" ? window : globalThis;
  const Animotion = global.Animotion || (global.Animotion = {});
  const OWNER_ID = "leadArmComposite";

  function bindingProfileFor(parts = [], primary = null, targetDebug = {}) {
    if (targetDebug.punchStyle !== "jab") return null;
    const proxy = wholeArmProxy(parts, primary);
    const chain = chainFromDebug(parts, primary, targetDebug);
    if (!chain.upperArmId || !chain.forearmId || !chain.handOrGloveId) return null;
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
      return part.id === profile.leadArm.proxyPartId ? null : pose;
    }
    const upperId = profile.leadArm?.members?.leadUpperArm;
    if (part.id !== upperId) return pose;
    return groupPose(beat, context, pose);
  }

  function effectivePrimaryFor(parts = [], primary = null, targetDebug = {}, bindingProfile = null) {
    const proxyId = bindingProfile?.leadArm?.mode === "wholeArmProxy" ? bindingProfile.leadArm.proxyPartId : null;
    if (!proxyId || targetDebug.punchStyle !== "jab") return primary;
    return parts.find((part) => part.id === proxyId) || primary;
  }

  function isWholeArmProxyPrimary(part, context = {}) {
    const profile = context.bindingProfile;
    return Boolean(part?.id && profile?.leadArm?.mode === "wholeArmProxy" && part.id === profile.leadArm.proxyPartId);
  }

  function proxyPrimaryPose(part, beat, context = {}, pose = null) {
    const next = pose || Animotion.motionModel?.defaultCustomMotion?.() || defaultPose();
    const reference = referencePoseForFrame(context.bindingProfile?.leadArm?.referenceCurve || part.jabReferenceCurve, beat.at);
    if (reference) return Object.assign(next, reference);
    const active = context.active || {};
    const base = context.base || {};
    const baseEnd = pointFromArray(base[active.end]);
    const targetEnd = pointFromArray(beat.pose?.[active.end]);
    if (!baseEnd || !targetEnd) return next;
    next.jointX = round(targetEnd.x - baseEnd.x);
    next.jointY = round(targetEnd.y - baseEnd.y);
    const baseRoot = pointFromArray(base[active.root]);
    const targetRoot = pointFromArray(beat.pose?.[active.root]);
    if (baseRoot && targetRoot) {
      const baseVector = { x: baseEnd.x - baseRoot.x, y: baseEnd.y - baseRoot.y };
      const targetVector = { x: targetEnd.x - targetRoot.x, y: targetEnd.y - targetRoot.y };
      next.rotate = round(clamp(angle(targetVector) - angle(baseVector), -18, 18));
    }
    return next;
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

  function referencePoseForFrame(curve = null, frame = 1) {
    const frames = Array.isArray(curve?.frames) ? curve.frames : [];
    if (!frames.length) return null;
    const current = Math.max(1, Math.round(Number(frame) || 1));
    const exact = frames.find((item) => item.frame === current);
    if (exact) return normalizePose(exact.pose);
    const before = [...frames].reverse().find((item) => item.frame <= current) || frames[0];
    const after = frames.find((item) => item.frame >= current) || frames[frames.length - 1];
    if (!before || !after || before.frame === after.frame) return normalizePose(before?.pose || after?.pose);
    const ratio = (current - before.frame) / (after.frame - before.frame);
    const a = normalizePose(before.pose), b = normalizePose(after.pose);
    return {
      ...defaultPose(),
      jointX: round(lerp(a.jointX, b.jointX, ratio)),
      jointY: round(lerp(a.jointY, b.jointY, ratio)),
      rotate: round(lerp(a.rotate, b.rotate, ratio)),
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
    const chain = {
      upperArmId: resolved?.upperArmId || null,
      forearmId: resolved?.forearmId || null,
      handOrGloveId: resolved?.handOrGloveId || null,
    };
    if (chain.upperArmId && chain.forearmId && chain.handOrGloveId) return chain;
    const proxy = wholeArmProxy(parts, primary);
    return proxy ? nearestLeadChain(parts, proxy) || chain : chain;
  }

  function wholeArmProxy(parts = [], preferred = null) {
    if (preferred?.usage === "leadWholeArmJabProxy") return preferred;
    return parts.find((part) => part?.usage === "leadWholeArmJabProxy") || null;
  }

  function nearestLeadChain(parts = [], proxy = null) {
    const chains = uniqueChains(parts).filter((chain) => chain.upperArmId && chain.forearmId && chain.handOrGloveId);
    if (!chains.length) return null;
    return chains.sort((a, b) => chainScore(a, proxy) - chainScore(b, proxy))[0] || null;
  }

  function uniqueChains(parts = []) {
    const seen = new Set(), chains = [];
    for (const part of parts) {
      if (part?.usage === "leadWholeArmJabProxy") continue;
      const resolved = Animotion.armChainResolver?.resolve?.(parts, part);
      const handId = resolved?.handOrGloveId;
      if (!handId || seen.has(handId)) continue;
      seen.add(handId);
      chains.push({
        upperArmId: resolved.upperArmId || null,
        forearmId: resolved.forearmId || null,
        handOrGloveId: handId,
        upperArm: resolved.upperArm || parts.find((item) => item.id === resolved.upperArmId) || null,
        forearm: resolved.forearm || parts.find((item) => item.id === resolved.forearmId) || null,
        handOrGlove: resolved.handOrGlove || parts.find((item) => item.id === handId) || null,
      });
    }
    return chains;
  }

  function chainScore(chain, proxy) {
    const proxyCenter = centerPoint(proxy);
    const bounds = chainBounds(chain);
    const chainCenter = centerPoint({ rect: bounds });
    const distance = proxyCenter && chainCenter ? Math.hypot(proxyCenter.x - chainCenter.x, proxyCenter.y - chainCenter.y) : 9999;
    const overlapBonus = proxy?.rect && bounds && rectsOverlap(proxy.rect, bounds) ? -120 : 0;
    const leadBonus = /(^|[^a-z])(front|lead|rhand|right)([^a-z]|$)/i.test(chainText(chain)) ? -40 : 0;
    return distance + overlapBonus + leadBonus;
  }

  function chainBounds(chain) {
    const rects = [chain.upperArm, chain.forearm, chain.handOrGlove].map((part) => part?.rect).filter(Boolean);
    if (!rects.length) return null;
    const minX = Math.min(...rects.map((rect) => Number(rect.x) || 0));
    const minY = Math.min(...rects.map((rect) => Number(rect.y) || 0));
    const maxX = Math.max(...rects.map((rect) => Number(rect.x || 0) + Number(rect.w || 0)));
    const maxY = Math.max(...rects.map((rect) => Number(rect.y || 0) + Number(rect.h || 0)));
    return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
  }

  function centerPoint(part = {}) {
    const rect = part?.rect || part;
    if (!rect) return null;
    return { x: Number(rect.x || 0) + Number(rect.w || 0) * 0.5, y: Number(rect.y || 0) + Number(rect.h || 0) * 0.5 };
  }

  function rectsOverlap(a = {}, b = {}) {
    return Number(a.x || 0) < Number(b.x || 0) + Number(b.w || 0)
      && Number(a.x || 0) + Number(a.w || 0) > Number(b.x || 0)
      && Number(a.y || 0) < Number(b.y || 0) + Number(b.h || 0)
      && Number(a.y || 0) + Number(a.h || 0) > Number(b.y || 0);
  }

  function chainText(chain = {}) {
    return [chain.upperArm, chain.forearm, chain.handOrGlove]
      .map((part) => `${part?.id || ""} ${part?.name || ""} ${part?.humanRole || ""}`)
      .join(" ");
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

  function lerp(a, b, ratio) {
    return Number(a || 0) + (Number(b || 0) - Number(a || 0)) * ratio;
  }

  function numberOrDefault(value, fallback) {
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
  }

  Animotion.leadArmComposite = { OWNER_ID, bindingProfileFor, effectivePrimaryFor, poseForPart, isWholeArmProxyPrimary, proxyPrimaryPose, isLockedPart, runtimeVisible, referenceCurveFromPart };
  if (typeof module !== "undefined") module.exports = Animotion.leadArmComposite;
}
