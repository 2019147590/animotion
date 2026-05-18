{
  const global = typeof window !== "undefined" ? window : globalThis;
  const Animotion = global.Animotion || (global.Animotion = {});
  const MOTION_SCOPES = new Set(["limb-only", "body-follow", "full-character"]);

  function normalizeMotionScope(scope, template = "kick") {
    if (MOTION_SCOPES.has(scope)) return String(scope);
    return template === "kick" ? "body-follow" : "body-follow";
  }

  function normalizeTargetDebug(debug) {
    if (!debug || typeof debug !== "object") return null;
    return JSON.parse(JSON.stringify(debug));
  }

  function analyzeTarget(plan = {}, base = {}, active = {}, target = {}) {
    const current = pointFromArray(base[active.end] || base.head);
    const root = pointFromArray(base[active.root] || base.hip);
    const delta = { x: target.x - current.x, y: target.y - current.y };
    const threshold = bodyFollowThreshold(current, root);
    const distanceValue = distance(current, target);
    const requested = normalizeMotionScope(plan.motionScope, plan.template);
    return {
      ...(plan.targetDebug || {}),
      convertedTarget: { ...target, coordinateSpace: "sourceImage" },
      selectedPartCurrentPosition: { ...current, coordinateSpace: "sourceImage" },
      delta: { x: Math.round(delta.x), y: Math.round(delta.y), coordinateSpace: "sourceImage" },
      computedDistance: roundNumber(distanceValue),
      distanceThreshold: roundNumber(threshold),
      requestedMotionScope: requested,
      chosenMotionScope: chosenMotionScope(requested, distanceValue, threshold),
      coordinateSpace: "sourceImage",
    };
  }

  function chosenMotionScope(scope, distanceValue, threshold) {
    if (scope === "limb-only" || scope === "full-character") return scope;
    return distanceValue >= threshold ? "body-follow" : "limb-only";
  }

  function bodyFollowThreshold(current, root) {
    return Math.max(32, distance(current, root) * 0.85);
  }

  function pointFromArray(point) {
    return { x: Number(point?.[0]) || Number(point?.x) || 0, y: Number(point?.[1]) || Number(point?.y) || 0 };
  }

  function distance(a, b) {
    return Math.hypot(a.x - b.x, a.y - b.y);
  }

  function roundNumber(value) {
    return Math.round(value * 100) / 100;
  }

  Animotion.motionTargetDebug = { normalizeMotionScope, normalizeTargetDebug, analyzeTarget };

  if (typeof module !== "undefined") module.exports = Animotion.motionTargetDebug;
}
