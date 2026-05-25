{
  const global = typeof window !== "undefined" ? window : globalThis;
  const Animotion = global.Animotion || (global.Animotion = {});

  function localMatrix(part, motion, impactHint, jointRotation) {
    const base = normalizeTransform(part.transform);
    const pivotX = part.rect.x + part.pivot.x;
    const pivotY = part.rect.y + part.pivot.y;
    const rotate = base.rotation + numberOrDefault(motion.rotate, 0) + numberOrDefault(jointRotation, 0);
    return new DOMMatrix()
      .translate(pivotX + base.x + numberOrDefault(motion.x, 0), pivotY + base.y + numberOrDefault(motion.y, 0))
      .rotate(rotate)
      .scale(base.scaleX * numberOrDefault(motion.scaleX, 1) * numberOrDefault(impactHint.scaleX, 1), base.scaleY * numberOrDefault(motion.scaleY, 1) * numberOrDefault(impactHint.scaleY, 1))
      .translate(-pivotX, -pivotY);
  }

  function normalizeTransform(transform = {}) {
    return {
      x: numberOrDefault(transform.x, 0),
      y: numberOrDefault(transform.y, 0),
      rotation: numberOrDefault(transform.rotation, 0),
      scaleX: numberOrDefault(transform.scaleX, 1),
      scaleY: numberOrDefault(transform.scaleY, 1),
    };
  }

  function numberOrDefault(value, fallback) {
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
  }

  Animotion.previewStaticTransform = { localMatrix, normalizeTransform };
  if (typeof module !== "undefined") module.exports = Animotion.previewStaticTransform;
}
