{
  const global = typeof window !== "undefined" ? window : globalThis;
  const Animotion = global.Animotion || (global.Animotion = {});

  const STRENGTH_RANGE = { min: 0, max: 2 };
  const HOLD_FRAMES_RANGE = { min: 1, max: 12 };

  function normalizeImpactExaggerationLayer(layer = {}) {
    if (!layer || typeof layer !== "object") return null;
    const frame = Math.max(1, Math.round(Number(layer.frame) || 1));
    return {
      kind: "impactExaggeration",
      enabled: layer.enabled !== false,
      frame,
      holdFrames: clampInt(layer.holdFrames, HOLD_FRAMES_RANGE.min, HOLD_FRAMES_RANGE.max, 2),
      strength: clampNumber(layer.strength, STRENGTH_RANGE.min, STRENGTH_RANGE.max, 1),
      targetPartIds: normalizeIds(layer.targetPartIds),
      scaleHints: normalizeHints(layer.scaleHints, normalizeScaleHint),
      stretchHints: normalizeHints(layer.stretchHints, normalizeStretchHint),
    };
  }

  function createDefaultImpactExaggerationForActionTimeline(actionTimeline, options = {}) {
    const timeline = Animotion.actionTimelineModel?.normalizeTimeline?.(actionTimeline, options) || actionTimeline;
    const impact = impactBeat(timeline);
    if (!impact) return null;
    const targetPartIds = normalizeIds(options.targetPartIds);
    const targets = targetPartIds.length ? targetPartIds : inferTargetPartIds(options.parts, timeline, options);
    return normalizeImpactExaggerationLayer({
      frame: impact.at || timeline.impactFrame,
      enabled: options.enabled !== false,
      holdFrames: options.holdFrames ?? 2,
      strength: options.strength ?? 1,
      targetPartIds: targets,
      scaleHints: options.scaleHints || defaultScaleHints(targets),
      stretchHints: options.stretchHints || defaultStretchHints(targets, timeline),
    });
  }

  function transformHintForPart(layer, part, frame) {
    const normalized = normalizeImpactExaggerationLayer(layer);
    if (!normalized || !normalized.enabled || !part || !frameInHold(normalized, frame) || !normalized.targetPartIds.includes(part.id)) return null;
    const scale = normalized.scaleHints.find((hint) => hint.partId === part.id) || { scaleX: 1, scaleY: 1 };
    const stretch = normalized.stretchHints.find((hint) => hint.partId === part.id) || { axis: "x", amount: 0 };
    return { scaleX: scale.scaleX + stretchScale(stretch, "x") * normalized.strength, scaleY: scale.scaleY + stretchScale(stretch, "y") * normalized.strength };
  }

  function impactBeat(timeline = {}) {
    return (timeline.beats || []).find((beat) => beat.id === "impact") || null;
  }

  function inferTargetPartIds(parts = [], timeline = {}, options = {}) {
    const list = Array.isArray(parts) ? parts : [];
    const priorities = priorityRoles(timeline.template || timeline.id);
    for (const role of priorities) {
      const roleMatch = list.filter((part) => part.humanRole === role);
      if (roleMatch.length) return roleMatch.map((part) => part.id);
      const nameMatch = list.filter((part) => partMatchesRole(part, role));
      if (nameMatch.length) return nameMatch.map((part) => part.id);
    }
    return options.primaryPartId ? [String(options.primaryPartId)] : [];
  }

  function priorityRoles(template) {
    return template === "kick" ? ["foot", "shin", "thigh"] : ["hand", "forearm", "upperArm"];
  }

  function partMatchesRole(part = {}, role) {
    const text = `${part.id || ""} ${part.name || ""}`.toLowerCase();
    if (role === "hand") return text.includes("hand") || text.includes("fist") || text.includes("주먹") || text.includes("손");
    if (role === "foot") return text.includes("foot") || text.includes("feet") || text.includes("발");
    return text.includes(role.toLowerCase());
  }

  function defaultScaleHints(targetPartIds) {
    return targetPartIds.map((partId) => ({ partId, scaleX: 1.06, scaleY: 0.96 }));
  }

  function defaultStretchHints(targetPartIds, timeline = {}) {
    const axis = timeline.template === "kick" ? "y" : "x";
    return targetPartIds.map((partId) => ({ partId, axis, amount: 0.1 }));
  }

  function normalizeHints(hints, normalize) {
    return (Array.isArray(hints) ? hints : []).map(normalize).filter(Boolean);
  }

  function normalizeScaleHint(hint = {}) {
    const partId = stringOrNull(hint.partId);
    if (!partId) return null;
    return { partId, scaleX: clampNumber(hint.scaleX, 0.5, 1.8, 1), scaleY: clampNumber(hint.scaleY, 0.5, 1.8, 1) };
  }

  function normalizeStretchHint(hint = {}) {
    const partId = stringOrNull(hint.partId);
    if (!partId) return null;
    return { partId, axis: hint.axis === "y" ? "y" : "x", amount: clampNumber(hint.amount, -0.5, 0.5, 0) };
  }

  function frameInHold(layer, frame) {
    return Math.round(Number(frame) || 1) >= layer.frame && Math.round(Number(frame) || 1) < layer.frame + layer.holdFrames;
  }

  function stretchScale(stretch, axis) {
    if (stretch.axis !== axis) return 0;
    return stretch.amount;
  }

  function normalizeIds(ids) {
    return (Array.isArray(ids) ? ids : []).map(stringOrNull).filter(Boolean);
  }

  function clampInt(value, min, max, fallback) {
    return Math.round(clampNumber(value, min, max, fallback));
  }

  function clampNumber(value, min, max, fallback) {
    const number = Number(value);
    return Number.isFinite(number) ? Math.min(max, Math.max(min, number)) : fallback;
  }

  function stringOrNull(value) {
    return value === undefined || value === null || value === "" ? null : String(value);
  }

  Animotion.impactExaggerationLayer = { normalizeImpactExaggerationLayer, createDefaultImpactExaggerationForActionTimeline, transformHintForPart };
  if (typeof module !== "undefined") module.exports = Animotion.impactExaggerationLayer;
}
