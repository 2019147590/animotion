{
  const global = typeof window !== "undefined" ? window : globalThis;
  const Animotion = global.Animotion || (global.Animotion = {});

  function normalizeAnchors(anchors = [], options = {}) {
    if (!Array.isArray(anchors)) return [];
    return anchors.map((anchor) => normalizeAnchor(anchor, options)).filter(Boolean);
  }

  function normalizeAnchor(anchor, options = {}) {
    const bounds = options.imageBounds || sourceBounds();
    const point = normalizedImagePoint(anchor?.pointNormalized, bounds) || normalizePoint(anchor?.point);
    if (!anchor?.key || !point) return null;
    return {
      key: String(anchor.key),
      partId: anchor.partId ? String(anchor.partId) : null,
      role: String(anchor.role || "draft"),
      point,
      pointNormalized: normalizedPoint(point, bounds),
      locked: anchor.locked === true,
      ...(anchor.source ? { source: String(anchor.source) } : {}),
      ...(anchor.motionHints ? { motionHints: Animotion.motionHints?.normalize?.(anchor.motionHints) || anchor.motionHints } : {}),
    };
  }

  function createAnchors(parts, primary, base, active, direction, target, plan = {}) {
    const primaryAnchor = anchor(active.end, primary?.id, "primary", target, true);
    const primaryKind = roleKind(primary);
    if (primaryKind === "leg") return legAnchors(parts, primary, base, active, primaryAnchor, plan);
    if (primaryKind === "arm") return armAnchors(parts, primary, base, active, primaryAnchor, plan, direction);
    if (primaryKind === "body") return bodyAnchors(parts, primary, base, primaryAnchor);
    return [primaryAnchor, followAnchor(parts, "head", ["head"], base.head, target, 0.7)].filter(Boolean);
  }

  function anchorsFromPlan(plan, parts, primary, base, active, direction, target) {
    const existing = normalizeAnchors(plan.anchors);
    if (existing.length) return applyPlanHints(mergePrimaryAnchor(existing, active, primary, target), plan, active);
    return applyPlanHints(createAnchors(parts, primary, base, active, direction, target, plan), plan, active);
  }

  function applyPlanHints(anchors, plan, active) {
    if (plan.targetSource?.type !== "correspondence" || !plan.motionHints) return anchors;
    return anchors.map((candidate) => candidate.key === active.end && candidate.role === "primary"
      ? { ...candidate, source: "correspondence", motionHints: plan.motionHints }
      : candidate);
  }

  function mergePrimaryAnchor(anchors, active, primary, target) {
    const index = anchors.findIndex((candidate) => candidate.key === active.end && candidate.role === "primary");
    const primaryAnchor = anchor(active.end, primary?.id, "primary", target, true);
    if (index === -1) return [primaryAnchor, ...anchors];
    return anchors.map((candidate, candidateIndex) => candidateIndex === index ? withPoint(candidate, target, true) : candidate);
  }

  function legAnchors(parts, primary, base, active, primaryAnchor, plan) {
    const rootShift = rootShiftFor(plan, base, active, primaryAnchor.point);
    return [
      primaryAnchor,
      anchor(active.mid, primary?.id, "bendHint", kneeHint(base, active, primaryAnchor.point), false),
      anchor("hip", bodyPartId(parts), "root", add(base.hip, rootShift), false),
      anchor("chest", bodyPartId(parts), "balance", add(base.chest, scaled(rootShift, 0.9, secondaryFollow(plan))), false),
      followAnchor(parts, "head", ["head"], base.head, add(base.head, scaled(rootShift, 0.7, secondaryFollow(plan))), 1),
    ].filter(Boolean);
  }

  function armAnchors(parts, primary, base, active, primaryAnchor, plan, direction) {
    const rootShift = rootShiftFor(plan, base, active, primaryAnchor.point);
    if (isRearPunchArm(plan, parts, primary, base, active, direction, primaryAnchor.point)) return [
      primaryAnchor,
      anchor(active.mid, primary?.id, "bendHint", straightArmHint(base, active, primaryAnchor.point), false),
      anchor("hip", bodyPartId(parts), "root", add(base.hip, scaled(rootShift, 1.15, secondaryFollow(plan))), false),
      anchor("chest", bodyPartId(parts), "balance", add(base.chest, scaled(rootShift, 1.35, secondaryFollow(plan))), false),
      followAnchor(parts, "head", ["head"], base.head, add(base.head, scaled(rootShift, 0.65, secondaryFollow(plan))), 1),
    ].filter(Boolean);
    return [
      primaryAnchor,
      anchor(active.mid, primary?.id, "bendHint", kneeHint(base, active, primaryAnchor.point), false),
      anchor("hip", bodyPartId(parts), "root", add(base.hip, scaled(rootShift, 0.75, secondaryFollow(plan))), false),
      anchor("chest", bodyPartId(parts), "balance", add(base.chest, rootShift), false),
      followAnchor(parts, "head", ["head"], base.head, add(base.head, scaled(rootShift, 0.5, secondaryFollow(plan))), 1),
    ].filter(Boolean);
  }

  function bodyAnchors(parts, primary, base, primaryAnchor) {
    const delta = { x: primaryAnchor.point.x - base.chest[0], y: primaryAnchor.point.y - base.chest[1] };
    return [
      primaryAnchor,
      anchor("hip", primary?.id || bodyPartId(parts), "root", add(base.hip, delta), false),
      followAnchor(parts, "head", ["head"], base.head, add(base.head, { x: delta.x * 0.7, y: delta.y * 0.7 }), 1),
    ].filter(Boolean);
  }

  function anchorPoint(anchors, key) {
    return normalizeAnchors(anchors).find((candidate) => candidate.key === key)?.point || null;
  }

  function anchor(key, partId, role, point, locked) {
    return withPoint({ key, partId: partId || null, role }, point, locked);
  }

  function withPoint(anchor, point, locked) {
    const normalized = normalizePoint(point);
    return { ...anchor, point: normalized, pointNormalized: normalizedPoint(normalized, sourceBounds()), locked };
  }

  function followAnchor(parts, type, roles, basePoint, target, amount) {
    const part = parts.find((candidate) => candidate.type === type || roles.includes(candidate.humanRole));
    if (!part || !basePoint || !target) return null;
    const start = pointFromArray(basePoint);
    return anchor(type, part.id, "follow", lerp(start, target, amount), false);
  }

  function kneeHint(base, active, target) {
    const root = pointFromArray(base[active.root] || base.hip);
    const current = pointFromArray(base[active.mid]);
    const end = normalizePoint(target);
    const midpoint = lerp(root, end, 0.52);
    return { x: midpoint.x + (current.x - midpoint.x) * 0.55, y: midpoint.y + (current.y - midpoint.y) * 0.55 };
  }

  function straightArmHint(base, active, target) {
    const root = pointFromArray(base[active.root] || base.hip);
    return lerp(root, normalizePoint(target), 0.48);
  }

  function punchStyleFor(plan, parts, primary, base, active, direction, target) {
    return isRearPunchArm(plan, parts, primary, base, active, direction, target) ? "rear-cross" : "jab";
  }

  function classificationDebug(plan, parts, primary, base, active, direction, target, options = {}) {
    const torso = torsoPoint(parts, base);
    const selected = pointFromArray(base[active.end] || endPoint(primary));
    const shoulder = shoulderPoint(primary, base, active);
    const opposite = oppositeHandPoint(base, active.end);
    const targetPoint = normalizePoint(target) || { x: selected.x + Number(direction?.x || 0), y: selected.y + Number(direction?.y || 0) };
    const targetSide = Math.sign(targetPoint.x - torso.x) || Math.sign(Number(direction?.x || 0)) || 1;
    const selectedSide = Math.sign(selected.x - torso.x);
    const shoulderSide = Math.sign(shoulder.x - torso.x);
    const namedRear = namedRearState(primary);
    const style = punchStyleFor(plan, parts, primary, base, active, direction, target);
    return {
      selectedPartId: options.selectedPartId || primary?.id || null,
      resolvedPrimaryPartId: primary?.id || null,
      endpointSource: endpointSource(primary),
      torsoCenter: roundedPointObject(torso),
      headFaceBounds: coveringBounds(parts),
      handTipPositions: { left: pointObject(base.lHand), right: pointObject(base.rHand) },
      facingDirection: roundedPointObject(direction),
      selectedHandTipPosition: roundedPointObject(selected),
      shoulderPosition: roundedPointObject(shoulder),
      oppositeHandTipPosition: roundedPointObject(opposite),
      targetPoint: roundedPointObject(targetPoint),
      selectedSide,
      shoulderSide,
      targetSide,
      namedRearOverride: namedRear,
      result: style,
      classificationBasis: classificationBasis(namedRear, shoulderSide, opposite, shoulder, targetSide, selectedSide),
      explicitActionOverride: Boolean(options.explicitActionOverride ?? plan?.targetDebug?.punchStyle),
    };
  }

  function isRearPunchArm(plan = {}, parts = [], primary = {}, base = {}, active = {}, direction = {}, target = null) {
    if (plan.template !== "punch") return false;
    const namedRear = namedRearState(primary);
    return namedRear !== null ? namedRear : geometryRearArm(parts, primary, base, active, direction, target);
  }

  function namedRearState(part = {}) {
    const text = partText(part);
    if (/\b(back|rear|trailing)\b/i.test(text)) return true;
    if (/\b(front|lead|leading)\b/i.test(text)) return false;
    return null;
  }

  function geometryRearArm(parts, primary, base, active, direction, target) {
    if (roleKind(primary) !== "arm") return false;
    const torso = torsoPoint(parts, base);
    const selected = pointFromArray(base[active.end] || endPoint(primary));
    const shoulder = shoulderPoint(primary, base, active);
    const targetSide = Math.sign((target?.x ?? selected.x + Number(direction?.x || 0)) - torso.x) || Math.sign(Number(direction?.x || 0)) || 1;
    const shoulderSide = Math.sign(shoulder.x - torso.x);
    if (shoulderSide) return shoulderSide !== targetSide;
    const opposite = oppositeHandPoint(base, active.end);
    if (opposite) return Math.sign(shoulder.x - opposite.x) === -targetSide;
    const selectedSide = Math.sign(selected.x - torso.x);
    return selectedSide ? selectedSide !== targetSide : false;
  }

  function classificationBasis(namedRear, shoulderSide, opposite, shoulder, targetSide, selectedSide) {
    if (namedRear !== null) return "name-hint";
    if (shoulderSide) return "shoulder-side";
    if (opposite && Math.sign(shoulder.x - opposite.x) === -targetSide) return "opposite-hand";
    if (selectedSide) return "handTip-fallback";
    return "undetermined";
  }

  function torsoPoint(parts, base) {
    const chest = pointFromArray(base.chest);
    const hip = pointFromArray(base.hip);
    if (base.chest || base.hip) return { x: (chest.x + hip.x) / 2, y: (chest.y + hip.y) / 2 };
    return centerPoint(parts.find((part) => roleKind(part) === "body") || parts[0]);
  }

  function oppositeHandPoint(base, key) {
    const oppositeKey = key === "lHand" ? "rHand" : key === "rHand" ? "lHand" : null;
    return oppositeKey && base[oppositeKey] ? pointFromArray(base[oppositeKey]) : null;
  }

  function shoulderPoint(primary, base, active) {
    return pointFromArray(base[active.root]) || absolutePoint(primary, primary?.pivot) || centerPoint(primary);
  }

  function partText(part = {}) {
    return `${part.id || ""} ${part.name || ""}`.replace(/[_-]+/g, " ");
  }

  function rootShiftFor(plan, base, active, target) {
    const scope = plan?.targetDebug?.chosenMotionScope || plan?.motionScope || "body-follow";
    if (scope === "limb-only") return { x: 0, y: 0 };
    const start = pointFromArray(base[active.end]);
    const root = pointFromArray(base[active.root] || base.hip);
    const limb = Math.max(1, distance(root, start));
    const tuning = plan?.rootMotionTuning || plan?.targetDebug?.rootMotionTuning || {};
    const ratio = (scope === "full-character" ? 0.65 : 0.35) * Number(tuning.bodyFollowStrength ?? 1);
    return limitedDelta({ x: target.x - start.x, y: target.y - start.y }, ratio, limb * Number(tuning.maxRootDeltaRatio ?? (scope === "full-character" ? 0.9 : 0.55)));
  }

  function secondaryFollow(plan) {
    return Number(plan?.rootMotionTuning?.secondaryFollowStrength ?? plan?.targetDebug?.rootMotionTuning?.secondaryFollowStrength ?? 1);
  }

  function scaled(delta, amount, strength) {
    return { x: delta.x * amount * strength, y: delta.y * amount * strength };
  }

  function limitedDelta(delta, ratio, maxLength) {
    const scaled = { x: delta.x * ratio, y: delta.y * ratio };
    const length = distance({ x: 0, y: 0 }, scaled);
    if (length <= maxLength) return { x: Math.round(scaled.x), y: Math.round(scaled.y) };
    const scale = maxLength / Math.max(1, length);
    return { x: Math.round(scaled.x * scale), y: Math.round(scaled.y * scale) };
  }

  function bodyPartId(parts) {
    return parts.find((part) => part.humanRole === "torso")?.id || parts.find((part) => part.humanRole === "pelvis")?.id || parts.find((part) => part.type === "spine")?.id || parts.find((part) => part.type === "body")?.id || null;
  }

  function roleKind(part = {}) {
    if (["thigh", "shin", "foot"].includes(part.humanRole) || part.type === "leg") return "leg";
    if (["upperArm", "forearm", "hand"].includes(part.humanRole) || part.type === "arm") return "arm";
    if (["torso", "pelvis"].includes(part.humanRole) || part.type === "body" || part.type === "spine") return "body";
    if (part.humanRole === "head" || part.type === "head") return "head";
    return part.type || null;
  }

  function normalizePoint(point) {
    if (!point) return null;
    return { x: Math.round(Number(point.x) || Number(point[0]) || 0), y: Math.round(Number(point.y) || Number(point[1]) || 0) };
  }

  function normalizedPoint(point, bounds) {
    return Animotion.coordinateSpaces?.normalizedImagePointFromPoint?.(point, bounds) || null;
  }

  function normalizedImagePoint(point, bounds) {
    return Animotion.coordinateSpaces?.pointFromNormalizedImagePoint?.(point, bounds) || null;
  }

  function sourceBounds() {
    if (Animotion.state?.image) return { width: Animotion.state.image.naturalWidth, height: Animotion.state.image.naturalHeight };
    return typeof Animotion.imageBounds === "function" ? Animotion.imageBounds() : null;
  }

  function pointFromArray(point) {
    return { x: Number(point?.[0]) || 0, y: Number(point?.[1]) || 0 };
  }

  function centerPoint(part = {}) {
    const rect = part.rect || {};
    return { x: Number(rect.x || 0) + Number(rect.w || 0) * 0.5, y: Number(rect.y || 0) + Number(rect.h || 0) * 0.5 };
  }

  function endPoint(part = {}) {
    const rect = part.rect || {};
    const joint = part.handTip || part.joint || { x: Number(rect.w || 0) * 0.5, y: Number(rect.h || 0) * 0.88 };
    return { x: Number(rect.x || 0) + Number(joint.x || 0), y: Number(rect.y || 0) + Number(joint.y || 0) };
  }

  function absolutePoint(part = {}, local = null) {
    return local ? { x: Number(part.rect?.x || 0) + Number(local.x || 0), y: Number(part.rect?.y || 0) + Number(local.y || 0) } : null;
  }

  function endpointSource(part = {}) {
    if (part.type === "hand" || part.humanRole === "hand") return "terminal hand";
    if (part.handTip) return "handTip";
    return part.joint ? "joint" : "part center";
  }

  function coveringBounds(parts = []) {
    const covering = parts.filter((part) => isLikelyFacePart(part)).map((part) => rectBounds(part.rect)).filter((rect) => rect.w || rect.h);
    if (!covering.length) return null;
    const minX = Math.min(...covering.map((rect) => rect.x)), minY = Math.min(...covering.map((rect) => rect.y));
    const maxX = Math.max(...covering.map((rect) => rect.x + rect.w)), maxY = Math.max(...covering.map((rect) => rect.y + rect.h));
    return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
  }

  function isLikelyFacePart(part = {}) {
    const text = `${part.id || ""} ${part.name || ""} ${part.type || ""} ${part.humanRole || ""}`;
    return /\b(head|face|hair_front|front_hair|eye|eyes|mouth|nose|facial)\b|얼굴|머리|앞머리|눈|입|코/i.test(text)
      || ["head", "face", "eye", "mouth", "nose"].includes(part.type)
      || ["head", "face", "eye", "mouth", "nose"].includes(part.humanRole);
  }

  function rectBounds(rect = {}) {
    return { x: Number(rect.x) || 0, y: Number(rect.y) || 0, w: Number(rect.w) || 0, h: Number(rect.h) || 0 };
  }

  function pointObject(point) {
    return point ? { x: Math.round(Number(point.x ?? point[0]) || 0), y: Math.round(Number(point.y ?? point[1]) || 0) } : null;
  }

  function roundedPointObject(point = {}) {
    return point ? { x: Math.round(Number(point.x) || 0), y: Math.round(Number(point.y) || 0) } : null;
  }

  function add(point, delta) {
    const base = pointFromArray(point);
    return { x: Math.round(base.x + delta.x), y: Math.round(base.y + delta.y) };
  }

  function lerp(a, b, ratio) {
    return { x: Math.round(a.x + (b.x - a.x) * ratio), y: Math.round(a.y + (b.y - a.y) * ratio) };
  }

  function distance(a, b) {
    return Math.hypot(a.x - b.x, a.y - b.y);
  }

  Animotion.motionAnchors = { normalizeAnchors, anchorsFromPlan, anchorPoint, punchStyleFor, classificationDebug };

  if (typeof module !== "undefined") module.exports = Animotion.motionAnchors;
}
