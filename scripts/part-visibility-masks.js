{
  const global = typeof window !== "undefined" ? window : globalThis;
  const Animotion = global.Animotion || (global.Animotion = {});
  const KIND = "animatedVisibility";

  function normalizeList(values = []) {
    return (Array.isArray(values) ? values : []).map(normalizeMask).filter(Boolean);
  }

  function normalizeMask(mask = {}) {
    const points = Array.isArray(mask.mask?.points) ? mask.mask.points : mask.points;
    if (!Array.isArray(points) || points.length < 3) return null;
    const keyframes = normalizeKeyframes(mask.keyframes);
    return {
      id: stringOrDefault(mask.id, cryptoId()),
      name: stringOrDefault(mask.name, "visibility mask"),
      kind: KIND,
      enabled: mask.enabled !== false,
      ...ownerFields(mask),
      mask: { kind: mask.mask?.kind || mask.shapeKind || "polygon", points: points.map(point) },
      keyframes: keyframes.length ? keyframes : [{ frame: 1, strength: 1 }],
    };
  }

  function maskFromShape(part, shape, frame, strength = 1) {
    if (!part || !shape?.points?.length) return null;
    const normalized = Animotion.geometry.normalizeShape(shape, Animotion.imageBounds());
    const local = Animotion.partTransformGeometry?.imagePointsToPartLocal?.(part, normalized.points, Animotion.state?.parts)
      || normalized.points.map((item) => ({ x: item.x - part.rect.x, y: item.y - part.rect.y }));
    return normalizeMask({
      id: cryptoId(),
      name: `mask ${normalizeList(part.visibilityMasks).length + 1}`,
      mask: { kind: normalized.kind, points: local },
      keyframes: [{ frame: normalizeFrame(frame), strength: normalizeStrength(strength) }],
    });
  }

  function withKeyframe(mask, frame, strength) {
    const next = normalizeMask(mask);
    if (!next) return null;
    const target = normalizeFrame(frame);
    const keyframe = { frame: target, strength: normalizeStrength(strength) };
    const rest = next.keyframes.filter((item) => item.frame !== target);
    return { ...next, keyframes: [...rest, keyframe].sort((a, b) => a.frame - b.frame) };
  }

  function evaluatedStrength(mask, frame) {
    const data = normalizeMask(mask);
    if (!data || !data.enabled) return 0;
    const keyframes = data.keyframes;
    const target = normalizeFrame(frame);
    if (target <= keyframes[0].frame) return keyframes[0].strength;
    const last = keyframes[keyframes.length - 1];
    if (target >= last.frame) return last.strength;
    for (let index = 1; index < keyframes.length; index += 1) {
      const next = keyframes[index];
      const prev = keyframes[index - 1];
      if (target <= next.frame) return lerp(prev.strength, next.strength, (target - prev.frame) / (next.frame - prev.frame));
    }
    return 0;
  }

  function activeMasks(part, frame, options = {}) {
    return normalizeList(part?.visibilityMasks)
      .map((mask) => ({ mask, strength: evaluatedStrength(mask, frame) }))
      .filter((item) => item.strength > 0.001 && maskAllowed(item.mask, part, frame, options));
  }

  function maskAllowed(mask, part, frame, options = {}) {
    const action = options.action || null;
    if (!action || !Animotion.actionScopedEffects?.frameContext) return true;
    const context = Animotion.actionScopedEffects.frameContext(action, frame);
    const owner = actionOwner(mask);
    if (owner) return owner === normalizeActionId(context.actionId);
    const effects = Animotion.actionScopedEffects.effectsForFrame?.(action, frame, "visibilityMask") || [];
    if (effects.length) return effects.some((effect) => (!effect.maskId || effect.maskId === mask.id) && (!effect.partId || effect.partId === part?.id));
    return context.actionId !== "jab";
  }

  function normalizeKeyframes(values = []) {
    return (Array.isArray(values) ? values : [])
      .map((item) => ({ frame: normalizeFrame(item.frame), strength: normalizeStrength(item.strength) }))
      .sort((a, b) => a.frame - b.frame);
  }

  function normalizeFrame(value) {
    return Math.max(1, Math.round(Number(value) || 1));
  }

  function normalizeStrength(value) {
    return Math.min(1, Math.max(0, Number(value) || 0));
  }

  function ownerFields(mask = {}) {
    return ["ownerActionId", "sourceActionId", "actionId", "createdForActionId", "createdFromJointActionId", "visibleForActionId"]
      .reduce((result, key) => (mask[key] ? { ...result, [key]: normalizeActionId(mask[key]) || String(mask[key]) } : result), {});
  }

  function actionOwner(mask = {}) {
    return normalizeActionId(mask.ownerActionId || mask.visibleForActionId || mask.sourceActionId || mask.actionId || mask.createdForActionId || mask.createdFromJointActionId);
  }

  function normalizeActionId(value) {
    return Animotion.actionPartVisibility?.normalizeActionId?.(value)
      || Animotion.actionScopedEffects?.actionIdFor?.({ actionId: value })
      || (value ? String(value) : null);
  }

  function point(value = {}) {
    return { x: Number(value.x) || 0, y: Number(value.y) || 0 };
  }

  function lerp(a, b, t) {
    return a + (b - a) * t;
  }

  function stringOrDefault(value, fallback) {
    return value === undefined || value === null || value === "" ? String(fallback) : String(value);
  }

  function cryptoId() {
    return crypto.randomUUID();
  }

  Animotion.partVisibilityMasks = { KIND, normalizeList, normalizeMask, maskFromShape, withKeyframe, evaluatedStrength, activeMasks };
  if (typeof module !== "undefined") module.exports = Animotion.partVisibilityMasks;
}
