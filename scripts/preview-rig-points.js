{
  const global = typeof window !== "undefined" ? window : globalThis;
  const Animotion = global.Animotion || (global.Animotion = {});

  function localPoint(part, spec = {}, options = {}) {
    if (spec.role === "handTip") return Animotion.rigging?.handTipForPart?.(part) || spec.localPoint || null;
    if (spec.role !== "joint") return spec.localPoint || part?.pivot || null;
    const base = part?.joint || spec.localPoint || null;
    if (!base || !options.timelineLike) return base;
    const motion = Animotion.motionModel.normalizeCustomMotion(part.customMotion);
    return { x: base.x + motion.jointX, y: base.y + motion.jointY };
  }

  function imagePoint(part, spec = {}, matrix = null, options = {}) {
    const local = localPoint(part, spec, options);
    if (!part || !local) return null;
    const image = { x: part.rect.x + local.x, y: part.rect.y + local.y };
    if (spec.role === "joint" && options.timelineLike) return image;
    return applyMatrix(matrix, image);
  }

  function applyMatrix(matrix, point) {
    const m = matrix || {};
    return {
      x: Number(m.a ?? 1) * point.x + Number(m.c ?? 0) * point.y + Number(m.e ?? 0),
      y: Number(m.b ?? 0) * point.x + Number(m.d ?? 1) * point.y + Number(m.f ?? 0),
    };
  }

  Animotion.previewRigPoints = { localPoint, imagePoint };
  if (typeof module !== "undefined") module.exports = Animotion.previewRigPoints;
}
