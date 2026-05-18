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
    if (primary?.type === "leg") return legAnchors(parts, primary, base, active, primaryAnchor, plan);
    if (primary?.type === "arm") return armAnchors(parts, primary, base, active, primaryAnchor, plan);
    if (primary?.type === "body" || primary?.type === "spine") return bodyAnchors(parts, primary, base, primaryAnchor);
    return [primaryAnchor, followAnchor(parts, "head", base.head, target, 0.7)].filter(Boolean);
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
      followAnchor(parts, "head", base.head, add(base.head, scaled(rootShift, 0.7, secondaryFollow(plan))), 1),
    ].filter(Boolean);
  }

  function armAnchors(parts, primary, base, active, primaryAnchor, plan) {
    const rootShift = rootShiftFor(plan, base, active, primaryAnchor.point);
    return [
      primaryAnchor,
      anchor(active.mid, primary?.id, "bendHint", kneeHint(base, active, primaryAnchor.point), false),
      anchor("chest", bodyPartId(parts), "balance", add(base.chest, rootShift), false),
      followAnchor(parts, "head", base.head, add(base.head, scaled(rootShift, 0.5, secondaryFollow(plan))), 1),
    ].filter(Boolean);
  }

  function bodyAnchors(parts, primary, base, primaryAnchor) {
    const delta = { x: primaryAnchor.point.x - base.chest[0], y: primaryAnchor.point.y - base.chest[1] };
    return [
      primaryAnchor,
      anchor("hip", primary?.id || bodyPartId(parts), "root", add(base.hip, delta), false),
      followAnchor(parts, "head", base.head, add(base.head, { x: delta.x * 0.7, y: delta.y * 0.7 }), 1),
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

  function followAnchor(parts, type, basePoint, target, amount) {
    const part = parts.find((candidate) => candidate.type === type);
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
    return parts.find((part) => part.type === "spine")?.id || parts.find((part) => part.type === "body")?.id || null;
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

  Animotion.motionAnchors = { normalizeAnchors, anchorsFromPlan, anchorPoint };

  if (typeof module !== "undefined") module.exports = Animotion.motionAnchors;
}
