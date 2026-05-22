{
  const global = typeof window !== "undefined" ? window : globalThis;
  const Animotion = global.Animotion || (global.Animotion = {});
  const ROOT_FOLLOW = 0.14;
  const MAX_ROTATE = 128;
  const MIN_SCALE_DELTA = -0.45;
  const MAX_SCALE_DELTA = 0.72;

  function partsWithInferredHandTips(parts = [], primaryId = null, template = "") {
    if (template !== "punch") return parts;
    const primary = parts.find((part) => part.id === primaryId);
    if (!primary || !isArmPart(primary) || primary.handTip || terminalHandFor(primary, parts)) return parts;
    const inferred = inferredHandTip(primary);
    if (!inferred) return parts;
    return parts.map((part) => part.id === primary.id ? { ...part, handTip: inferred } : part);
  }

  function poseForArmOnlyRearPunch(part, beat, base, active, bridge = {}) {
    if (!isArmHandTipPart(part, active) || punchStyleInfo({ parts: [], bridge }, part).punchStyle !== "rear-cross") return null;
    const pose = Animotion.motionModel.defaultCustomMotion();
    const root = pointFromArray(base?.[active.root]) || absolutePoint(part, part.pivot);
    const hand = pointFromArray(base?.[active.end]) || absolutePoint(part, part.handTip);
    const target = pointFromArray(beat?.pose?.[active.end]);
    if (!root || !hand || !target) return null;
    const delta = { x: target.x - hand.x, y: target.y - hand.y };
    pose.x = Math.round(delta.x * ROOT_FOLLOW);
    pose.y = Math.round(delta.y * ROOT_FOLLOW);
    const movedRoot = { x: root.x + pose.x, y: root.y + pose.y };
    const baseVector = { x: hand.x - root.x, y: hand.y - root.y };
    const targetVector = { x: target.x - movedRoot.x, y: target.y - movedRoot.y };
    const baseLength = Math.max(1, Math.hypot(baseVector.x, baseVector.y));
    const targetLength = Math.max(1, Math.hypot(targetVector.x, targetVector.y));
    pose.rotate = rounded(clamp(angle(targetVector) - angle(baseVector), -MAX_ROTATE, MAX_ROTATE));
    pose.scaleY = rounded(clamp(targetLength / baseLength - 1, MIN_SCALE_DELTA, MAX_SCALE_DELTA));
    return pose;
  }

  function renderHintForPart(part, context = {}) {
    const action = context.bridge?.jointAction;
    const style = punchStyleInfo(context, part);
    if (!action || !isPunchAction(action) || style.punchStyle !== "rear-cross") return { active: false, reason: "not-rear-cross-punch", punchStyleSource: style.source, legacyDepthCompat: style.legacyDepthCompat };
    const primaryId = primaryIdFor(context.bridge, action, context);
    if (primaryId !== part?.id) return { active: false, reason: "not-primary", punchStyleSource: style.source, legacyDepthCompat: style.legacyDepthCompat };
    if (!isArmPart(part) || terminalHandFor(part, context.parts || [])) return { active: false, reason: "not-arm-only" };
    const handTip = handTipWithSource(part), pose = Animotion.timeline?.evaluatePartAtFrame?.(part, context.frame) || part.customMotion || {};
    if (!handTip.point) return { active: false, reason: "missing-handTip", handTipSource: handTip.source };
    const controls = controlsForActionFrame(part, handTip.point, action, context.frame, pose);
    const legacyWholeTranslation = legacyTranslationPose(pose);
    return { active: style.legacyDepthCompat || !legacyWholeTranslation, mode: "arm-extension-segmented", handTipSource: handTip.source, legacyWholeTranslation, pose, controls, punchStyleSource: style.source, legacyDepthCompat: style.legacyDepthCompat };
  }

  function debugForFrame(context = {}) {
    const bridge = context.bridge || {}, action = bridge.jointAction || {};
    const primary = (context.parts || []).find((part) => part.id === primaryIdFor(bridge, action, context));
    const hint = primary ? renderHintForPart(primary, context) : { active: false, reason: "missing-primary" };
    const style = punchStyleInfo(context, primary);
    return {
      rearCrossArmOnlyPunch: style.punchStyle === "rear-cross" && Boolean(primary) && isArmPart(primary) && !terminalHandFor(primary, context.parts || []),
      armExtensionActive: hint.active,
      handTipSource: hint.handTipSource || "missing",
      oldWholeArmTranslationReplaced: hint.active && !hint.legacyWholeTranslation,
      impactPoseMode: hint.legacyWholeTranslation ? "legacy-whole-arm-translation" : hint.active ? "arm-extension" : hint.reason,
      primaryPartId: primary?.id || null,
      punchStyleSource: style.source,
      legacyDepthCompat: style.legacyDepthCompat,
    };
  }

  function drawSegmentedPart(ctx, part, hint, alpha = 1) {
    if (!hint?.active || !hint.controls) return { ok: false, reason: "inactive", fallbackUsed: true, segmentCount: 0 };
    return Animotion.armExtensionRender?.drawSegmentedPart?.(ctx, part, hint, alpha)
      || { ok: false, reason: "missing-renderer", fallbackUsed: true, segmentCount: 0, sourceBounds: part?.rect || null };
  }

  function isArmHandTipPart(part, active) {
    return part?.handTip && part?.pivot && isArmPart(part) && String(active?.end || "").endsWith("Hand");
  }

  function punchStyleInfo(context = {}, part = null) {
    const bridge = context.bridge || {}, action = bridge.jointAction || {};
    const explicit = action.targetDebug?.punchStyle;
    const overrideId = selectedOverrideId(bridge, action, context);
    const primary = part || (context.parts || []).find((candidate) => candidate.id === (overrideId || primaryIdFor(bridge, action, context)));
    if (explicit && overrideId && (!part || part.id === overrideId)) return { punchStyle: "rear-cross", source: "selectedOverrideFromLoadedJab", legacyDepthCompat: true };
    if (explicit) return { punchStyle: explicit, source: "explicit", legacyDepthCompat: false };
    if (isLegacyRearArmOnlyPunch(primary, context.parts || [], bridge, action)) return { punchStyle: "rear-cross", source: "inferredLegacy", legacyDepthCompat: true };
    if (isLayerCoveredLegacyArmPunch(primary, context.parts || [], context, action)) return { punchStyle: "rear-cross", source: "inferredLegacyLayer", legacyDepthCompat: true };
    return { punchStyle: null, source: "missing", legacyDepthCompat: false };
  }

  function isLegacyRearArmOnlyPunch(primary, parts, bridge, action) {
    if (!primary || !isPunchAction(action) || !isArmPart(primary) || terminalHandFor(primary, parts)) return false;
    if (!handTipWithSource(primary).point) return false;
    const impact = beatById(action, "impact"), focus = action.focusKey;
    const target = pointFromArray(focus ? impact?.pose?.[focus] : null);
    const baseHand = absolutePoint(primary, handTipWithSource(primary).point);
    if (!target || !baseHand || Math.abs(target.x - baseHand.x) < 1) return false;
    return Math.sign(target.x - baseHand.x) !== Math.sign(partCenterX(primary) - characterCenterX(parts));
  }

  function isLayerCoveredLegacyArmPunch(primary, parts, context, action) {
    if (!primary || !isPunchAction(action) || !isArmPart(primary) || terminalHandFor(primary, parts)) return false;
    if (context.selectedPartId && context.selectedPartId !== primary.id) return false;
    if (pointFromArray(beatById(action, "impact")?.pose?.[action.focusKey])) return false;
    return hasHigherCoveringOverlap(primary, parts);
  }

  function inferredHandTip(part = {}) {
    if (part.handTip) return part.handTip;
    const rect = part.rect || {};
    const pivot = part.pivot || { x: Number(rect.w || 0) * 0.5, y: Number(rect.h || 0) * 0.16 };
    const joint = part.joint || { x: Number(rect.w || 0) * 0.5, y: Number(rect.h || 0) * 0.88 };
    const dx = joint.x - pivot.x, dy = joint.y - pivot.y;
    const length = Math.max(1, Math.hypot(dx, dy));
    const extension = Math.max(8, Math.min(length * 0.42, Math.max(Number(rect.w || 0), Number(rect.h || 0)) * 0.45));
    return { x: Math.round(joint.x + dx / length * extension), y: Math.round(joint.y + dy / length * extension) };
  }

  function handTipWithSource(part) {
    if (part?.handTip) return { source: "saved", point: part.handTip };
    const inferred = inferredHandTip(part);
    return inferred ? { source: "inferred", point: inferred } : { source: "missing", point: null };
  }

  function controlsForActionFrame(part, localHandTip, action, frame, fallbackPose) {
    const base = baseControls(part, localHandTip);
    const target = actionControlsForFrame(action, frame);
    return target ? { base, target: straightCrossControls(base, target) } : { base, target: transformedControls(part, base, fallbackPose) };
  }

  function baseControls(part, localHandTip) {
    return {
      shoulder: absolutePoint(part, part.pivot),
      elbow: absolutePoint(part, part.joint),
      hand: absolutePoint(part, localHandTip),
    };
  }

  function transformedControls(part, base, pose) {
    return Object.fromEntries(Object.entries(base).map(([key, point]) => [key, transformedPoint(part, point, pose)]));
  }

  function actionControlsForFrame(action = {}, frame) {
    const keys = controlKeys(action.focusKey);
    if (!keys) return null;
    const controls = (action.beats || [])
      .map((beat) => ({ frame: Math.round(Number(beat.at) || 0), controls: controlsFromBeat(beat, keys) }))
      .filter((beat) => beat.frame > 0 && beat.controls)
      .sort((a, b) => a.frame - b.frame);
    if (!controls.length) return null;
    const current = Math.round(Number(frame) || controls[0].frame);
    const exact = controls.find((beat) => beat.frame === current);
    if (exact) return exact.controls;
    const previous = [...controls].reverse().find((beat) => beat.frame < current);
    const next = controls.find((beat) => beat.frame > current);
    if (!previous) return controls[0].controls;
    if (!next) return controls[controls.length - 1].controls;
    return lerpControls(previous.controls, next.controls, (current - previous.frame) / Math.max(1, next.frame - previous.frame));
  }

  function controlKeys(focusKey) {
    const match = String(focusKey || "").match(/^([lr])Hand$/);
    if (!match) return null;
    const side = match[1];
    const base = {
      shoulder: `${side}Shoulder`,
      elbow: `${side}Elbow`,
      hand: `${side}Hand`,
    };
    return base;
  }

  function controlsFromBeat(beat, keys) {
    const pose = beat?.pose || {};
    const controls = Object.fromEntries(Object.entries(keys).map(([role, key]) => [role, pointFromArray(pose[key])]));
    return Object.values(controls).every(Boolean) ? controls : null;
  }

  function lerpControls(a, b, ratio) {
    return Object.fromEntries(Object.keys(a).map((key) => [key, {
      x: a[key].x + (b[key].x - a[key].x) * ratio,
      y: a[key].y + (b[key].y - a[key].y) * ratio,
    }]));
  }

  function straightCrossControls(base, target) {
    const line = unitVector(target.shoulder, target.hand);
    if (!line) return target;
    const length = distance(target.shoulder, target.hand);
    const sourceForearm = distance(base.elbow, base.hand);
    const gap = clamp(sourceForearm * 1.2, Math.max(16, length * 0.24), length * 0.46);
    return { ...target, elbow: { x: target.hand.x - line.x * gap, y: target.hand.y - line.y * gap } };
  }

  function unitVector(start, end) {
    const length = distance(start, end);
    return length > 0.001 ? { x: (end.x - start.x) / length, y: (end.y - start.y) / length } : null;
  }

  function transformedPoint(part, point, pose = {}) {
    const pivot = absolutePoint(part, part.pivot);
    const rad = Number(pose.rotate || 0) * Math.PI / 180;
    const scaleY = 1 + Number(pose.scaleY || 0);
    const x = point.x - pivot.x;
    const y = (point.y - pivot.y) * scaleY;
    return { x: pivot.x + Number(pose.x || 0) + Math.cos(rad) * x - Math.sin(rad) * y, y: pivot.y + Number(pose.y || 0) + Math.sin(rad) * x + Math.cos(rad) * y };
  }

  function legacyTranslationPose(pose = {}) {
    return (Math.abs(Number(pose.x || 0)) > 0.001 || Math.abs(Number(pose.y || 0)) > 0.001)
      && Math.abs(Number(pose.rotate || 0)) < 0.001
      && Math.abs(Number(pose.scaleY || 0)) < 0.001
      && Math.abs(Number(pose.jointX || 0)) < 0.001
      && Math.abs(Number(pose.jointY || 0)) < 0.001;
  }

  function terminalHandFor(part, parts) {
    return parts.find((candidate) => candidate.id !== part.id && partKind(candidate) === "hand" && isDescendantOf(candidate, part.id, parts))
      || parts.find((candidate) => partKind(candidate) === "hand" && numberedSuffix(candidate) === numberedSuffix(part));
  }

  function isPunchAction(action = {}) { return action.actionTimeline?.template === "punch" || String(action.source || "").includes("punch"); }
  function primaryIdFor(bridge = {}, action = {}, context = {}) { return selectedOverrideId(bridge, action, context) || bridge.primaryPartId || action.targetDebug?.primaryPartId || context.selectedPartId || null; }
  function selectedOverrideId(bridge = {}, action = {}, context = {}) {
    const selectedId = context.selectedPartId;
    const savedId = bridge.primaryPartId || action.targetDebug?.primaryPartId || null;
    if (!selectedId || !savedId || selectedId === savedId || action.targetDebug?.punchStyle !== "jab" || !isPunchAction(action)) return null;
    const parts = context.parts || [];
    const selected = parts.find((part) => part.id === selectedId);
    if (!selected || !isArmPart(selected) || terminalHandFor(selected, parts)) return null;
    if (!hasPunchMotionEvidence(selected, context)) return null;
    return hasHigherCoveringOverlap(selected, parts) ? selectedId : null;
  }
  function hasPunchMotionEvidence(part, context = {}) {
    const pose = Animotion.timeline?.evaluatePartAtFrame?.(part, context.frame);
    if (poseHasMotion(pose) || poseHasMotion(part.customMotion)) return true;
    const frame = Math.round(Number(context.frame) || 0);
    return (part.keyframes || []).some((key) => Math.abs(Math.round(Number(key.frame) || 0) - frame) <= 2 && poseHasMotion(key.pose || key));
  }
  function poseHasMotion(pose = {}) { return ["x", "y", "rotate", "scaleY", "jointX", "jointY"].some((key) => Math.abs(Number(pose?.[key] || 0)) > 0.001); }
  function beatById(action = {}, id) { return (Array.isArray(action.beats) ? action.beats : []).find((beat) => beat.id === id) || null; }
  function partCenterX(part = {}) { return Number(part.rect?.x || 0) + Number(part.rect?.w || 0) / 2; }
  function characterCenterX(parts = []) {
    const visible = parts.filter((part) => part?.rect);
    if (!visible.length) return 0;
    const minX = Math.min(...visible.map((part) => Number(part.rect.x || 0)));
    const maxX = Math.max(...visible.map((part) => Number(part.rect.x || 0) + Number(part.rect.w || 0)));
    return (minX + maxX) / 2;
  }

  function isDescendantOf(part, ancestorId, parts) {
    let current = part;
    const seen = new Set();
    while (parentIdFor(current)) {
      const parentId = parentIdFor(current);
      if (parentId === ancestorId) return true;
      if (seen.has(parentId)) return false;
      seen.add(parentId);
      current = parts.find((candidate) => candidate.id === parentId);
      if (!current) return false;
    }
    return false;
  }

  function pointFromArray(point) {
    if (!point) return null;
    const next = { x: Number(point.x ?? point[0]), y: Number(point.y ?? point[1]) };
    return Number.isFinite(next.x) && Number.isFinite(next.y) ? next : null;
  }

  function absolutePoint(part, local) {
    return local ? { x: Number(part.rect?.x || 0) + Number(local.x || 0), y: Number(part.rect?.y || 0) + Number(local.y || 0) } : null;
  }

  function angle(vector) {
    return Math.atan2(vector.y, vector.x) * 180 / Math.PI;
  }

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function rounded(value) { return Math.round(value * 100) / 100; }

  function partKind(part = {}) { return part.humanRole || part.type || ""; }
  function isArmPart(part = {}) { return part.type === "arm" || ["upperArm", "forearm"].includes(part.humanRole); }
  function parentIdFor(part = {}) { return Animotion.rigConnection?.parentIdFor?.(part) || part.parentId || part.parentPartId || null; }
  function numberedSuffix(part) { return String(`${part?.id || ""} ${part?.name || ""}`).match(/(?:^|[^0-9])([0-9]+)(?!.*[0-9])/)?.[1] || null; }
  function likelyCover(part) { return Animotion.renderLayerUtils?.isLikelyCoveringPart?.(part) || ["head", "hair", "eye", "mouth", "nose"].includes(part?.type) || ["head", "face", "hair"].includes(part?.humanRole); }
  function baseOrder(part = {}) { return Animotion.renderLayerUtils?.baseOrder?.(part) ?? (Number(part.order) || 0); }
  function boundsOverlap(a, b) { return Animotion.renderLayerUtils?.boundsOverlap?.(a, b) ?? Boolean(a && b && a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y); }
  function hasHigherCoveringOverlap(part, parts) {
    return Animotion.renderLayerUtils?.hasHigherCoveringOverlap?.(part, parts, 24)
      ?? parts.some((cover) => cover.id !== part?.id && likelyCover(cover) && baseOrder(cover) > baseOrder(part) && boundsOverlap(expandRect(part?.rect, 24), cover.rect));
  }
  function expandRect(rect = {}, amount) { return { x: Number(rect.x || 0) - amount, y: Number(rect.y || 0) - amount, w: Number(rect.w || 0) + amount * 2, h: Number(rect.h || 0) + amount * 2 }; }

  Animotion.armExtension = { partsWithInferredHandTips, poseForArmOnlyRearPunch, renderHintForPart, debugForFrame, drawSegmentedPart, inferredHandTip, punchStyleInfo };
  if (typeof module !== "undefined") module.exports = Animotion.armExtension;
}
