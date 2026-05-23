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

  function postPassLiftPart(parts = [], context = {}) {
    const bridge = context.bridge || {}, action = bridge.jointAction;
    const primary = primaryPart(parts, bridge, action, context);
    if (!primary || depthBiasForPart(primary, { ...context, parts }) <= 0) return null;
    return primary;
  }

  function depthBiasForPart(part, context = {}) {
    const bridge = context.bridge || {};
    const action = bridge.jointAction;
    const style = punchStyleInfo(context);
    if (!part || style.punchStyle !== "rear-cross") return 0;
    const weight = depthWeight(action, context.frame, bridge);
    if (weight <= 0) return 0;
    const primary = primaryPart(context.parts || [], bridge, action, context);
    if (!primary) return 0;
    if (part.id === primary.id) return Math.round(Math.max(PRIMARY_BIAS, coveringLiftBias(part, context.parts || [])) * weight);
    if (part.id === parentIdFor(primary) && isArmPart(part)) return Math.round(SECONDARY_BIAS * weight);
    return 0;
  }

  function depthWeight(action, frame, bridge = {}) {
    const impact = beatFrame(action, "impact") || Math.round(Number(frame) || 1);
    const drive = beatFrame(action, "drive") || Math.max(1, impact - 8);
    const recover = beatFrame(action, "recover") || Math.round(Number(bridge.durationFrames) || impact + 12);
    const current = Math.round(Number(frame) || 1);
    if (!impact || current < drive) return 0;
    if (current <= impact) return 0.35 + 0.65 * ratio(current, drive, impact);
    if (!recover || current >= recover) return 0;
    return 1 - ratio(current, impact, recover);
  }

  function punchStyleInfo(context = {}) {
    const bridge = context.bridge || {}, action = bridge.jointAction || {};
    if (!isPunchAction(action)) return { punchStyle: null, source: "missing", legacyDepthCompat: false };
    if (Animotion.armExtension?.punchStyleInfo) return Animotion.armExtension.punchStyleInfo(context);
    if (selectedOverrideId(context.parts || [], bridge, action, context)) return { punchStyle: "rear-cross", source: "selectedOverrideFromLoadedJab", legacyDepthCompat: true };
    const explicit = action.targetDebug?.punchStyle;
    if (explicit) return { punchStyle: explicit, source: "explicit", legacyDepthCompat: false };
    const primary = primaryPart(context.parts || [], bridge, action, context);
    if (isLegacyRearArmOnlyPunch(primary, context.parts || [], action)) return { punchStyle: "rear-cross", source: "inferredLegacy", legacyDepthCompat: true };
    if (isLayerCoveredLegacyArmPunch(primary, context.parts || [], context, action)) return { punchStyle: "rear-cross", source: "inferredLegacyLayer", legacyDepthCompat: true };
    return { punchStyle: null, source: "missing", legacyDepthCompat: false };
  }

  function primaryPart(parts, bridge, action, context = {}) {
    const id = selectedOverrideId(parts, bridge, action, context) || bridge.primaryPartId || action?.targetDebug?.primaryPartId || context.selectedPartId;
    return parts.find((part) => part.id === id) || null;
  }

  function beatFrame(action, id) {
    return Math.round(Number((action?.beats || []).find((beat) => beat.id === id)?.at) || 0);
  }

  function isLegacyRearArmOnlyPunch(primary, parts, action) {
    if (!primary || !isPunchAction(action) || !isArmOnly(primary, parts)) return false;
    const target = pointFromArray(action.focusKey ? (action.beats || []).find((beat) => beat.id === "impact")?.pose?.[action.focusKey] : null);
    const hand = absolutePoint(primary, primary.handTip || inferredHandTip(primary));
    if (!target || !hand || Math.abs(target.x - hand.x) < 1) return false;
    return Math.sign(target.x - hand.x) !== Math.sign(partCenterX(primary) - characterCenterX(parts));
  }

  function isLayerCoveredLegacyArmPunch(primary, parts, context, action) {
    if (!primary || !isPunchAction(action) || !isArmOnly(primary, parts)) return false;
    if (context.selectedPartId && context.selectedPartId !== primary.id) return false;
    if (pointFromArray(action.focusKey ? beatById(action, "impact")?.pose?.[action.focusKey] : null)) return false;
    return hasHigherCoveringOverlap(primary, parts);
  }

  function selectedOverrideId(parts = [], bridge = {}, action = {}, context = {}) {
    const selectedId = context.selectedPartId;
    const savedId = bridge.primaryPartId || action?.targetDebug?.primaryPartId || null;
    if (!selectedId || !savedId || selectedId === savedId || action?.targetDebug?.punchStyle !== "jab" || !isPunchAction(action)) return null;
    const selected = parts.find((part) => part.id === selectedId);
    if (!isArmOnly(selected, parts) || !hasPunchMotionEvidence(selected, context)) return null;
    return hasHigherCoveringOverlap(selected, parts) ? selectedId : null;
  }

  function hasPunchMotionEvidence(part, context = {}) {
    const pose = Animotion.timeline?.evaluatePartAtFrame?.(part, context.frame);
    if (poseHasMotion(pose) || poseHasMotion(part?.customMotion)) return true;
    const frame = Math.round(Number(context.frame) || 0);
    return (part?.keyframes || []).some((key) => Math.abs(Math.round(Number(key.frame) || 0) - frame) <= 2 && poseHasMotion(key.pose || key));
  }

  function ratio(value, start, end) {
    return Math.min(1, Math.max(0, (value - start) / Math.max(1, end - start)));
  }

  function baseOrder(part) { return Animotion.renderLayerUtils?.baseOrder?.(part) ?? (Number(part?.order) || 0); }
  function coveringLiftBias(part, parts) {
    const coveringOrders = parts.filter((candidate) => candidate.id !== part?.id && likelyCoveringPart(candidate)).map(baseOrder);
    return Math.max(0, ...coveringOrders) - baseOrder(part) + 1;
  }
  function likelyCoveringPart(part = {}) {
    return Animotion.renderLayerUtils?.isLikelyCoveringPart?.(part) || fallbackCoveringPart(part);
  }
  function isPunchAction(action = {}) { return Animotion.cutsceneActionSelectors?.isPunchAction?.(action) || false; }
  function poseHasMotion(pose = {}) { return ["x", "y", "rotate", "scaleY", "jointX", "jointY"].some((key) => Math.abs(Number(pose?.[key] || 0)) > 0.001); }
  function isArmOnly(part, parts) { return isArmPart(part) && partKind(part) !== "hand" && !terminalHandFor(part, parts); }
  function terminalHandFor(part, parts) { return parts.find((candidate) => candidate.id !== part?.id && partKind(candidate) === "hand" && numberedSuffix(candidate) === numberedSuffix(part)); }
  function inferredHandTip(part = {}) {
    const rect = part.rect || {}, pivot = part.pivot || { x: Number(rect.w || 0) * 0.5, y: Number(rect.h || 0) * 0.16 }, joint = part.joint || { x: Number(rect.w || 0) * 0.5, y: Number(rect.h || 0) * 0.88 };
    const dx = joint.x - pivot.x, dy = joint.y - pivot.y, length = Math.max(1, Math.hypot(dx, dy)), extension = Math.max(8, Math.min(length * 0.42, Math.max(Number(rect.w || 0), Number(rect.h || 0)) * 0.45));
    return { x: Math.round(joint.x + dx / length * extension), y: Math.round(joint.y + dy / length * extension) };
  }
  function pointFromArray(point) { const next = point ? { x: Number(point.x ?? point[0]), y: Number(point.y ?? point[1]) } : null; return next && Number.isFinite(next.x) && Number.isFinite(next.y) ? next : null; }
  function absolutePoint(part, local) { return local ? { x: Number(part.rect?.x || 0) + Number(local.x || 0), y: Number(part.rect?.y || 0) + Number(local.y || 0) } : null; }
  function partCenterX(part = {}) { return Number(part.rect?.x || 0) + Number(part.rect?.w || 0) / 2; }
  function characterCenterX(parts = []) {
    const visible = parts.filter((part) => part?.rect);
    if (!visible.length) return 0;
    const minX = Math.min(...visible.map((part) => Number(part.rect.x || 0))), maxX = Math.max(...visible.map((part) => Number(part.rect.x || 0) + Number(part.rect.w || 0)));
    return (minX + maxX) / 2;
  }
  function beatById(action, id) { return (Array.isArray(action?.beats) ? action.beats : []).find((beat) => beat.id === id) || null; }
  function partKind(part = {}) { return Animotion.armChainResolver?.roleFor?.(part) || part.humanRole || part.type || ""; }
  function numberedSuffix(part) { return String(`${part?.id || ""} ${part?.name || ""}`).match(/(?:^|[^0-9])([0-9]+)(?!.*[0-9])/)?.[1] || null; }
  function parentIdFor(part) { return Animotion.rigConnection?.parentIdFor?.(part) || part.parentId || part.parentPartId || null; }
  function isArmPart(part) { return part?.type === "arm" || part?.type === "glove" || ["upperArm", "forearm", "hand", "glove"].includes(part?.humanRole); }
  function fallbackCoveringPart(part = {}) { return ["head", "hair", "eye", "mouth", "nose"].includes(part.type) || ["head", "face", "hair", "eye", "mouth", "nose"].includes(part.humanRole); }
  function boundsOverlap(a, b) { return Animotion.renderLayerUtils?.boundsOverlap?.(a, b) ?? Boolean(a && b && a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y); }
  function hasHigherCoveringOverlap(part, parts) {
    return Animotion.renderLayerUtils?.hasHigherCoveringOverlap?.(part, parts, 24)
      ?? parts.some((cover) => cover.id !== part?.id && likelyCoveringPart(cover) && baseOrder(cover) > baseOrder(part) && boundsOverlap(expandRect(part?.rect, 24), cover.rect));
  }
  function expandRect(rect = {}, amount) { return { x: Number(rect.x || 0) - amount, y: Number(rect.y || 0) - amount, w: Number(rect.w || 0) + amount * 2, h: Number(rect.h || 0) + amount * 2 }; }

  Animotion.cutsceneDepth = { orderedParts, postPassLiftPart, depthBiasForPart, likelyCoveringPart, punchStyleInfo };
  if (typeof module !== "undefined") module.exports = Animotion.cutsceneDepth;
}
