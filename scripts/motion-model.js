{
  const global = typeof window !== "undefined" ? window : globalThis;
  const Animotion = global.Animotion || (global.Animotion = {});

  const DEFAULT_CUSTOM_MOTION = {
    x: 0,
    y: 0,
    rotate: 0,
    scaleY: 0,
    jointX: 0,
    jointY: 0,
    phase: 0,
  };

  function defaultCustomMotion() {
    return { ...DEFAULT_CUSTOM_MOTION };
  }

  function normalizeCustomMotion(motion = {}) {
    return {
      x: numberOrDefault(motion.x, 0),
      y: numberOrDefault(motion.y, 0),
      rotate: numberOrDefault(motion.rotate, 0),
      scaleY: numberOrDefault(motion.scaleY, 0),
      jointX: numberOrDefault(motion.jointX, 0),
      jointY: numberOrDefault(motion.jointY, 0),
      phase: numberOrDefault(motion.phase, 0),
    };
  }

  function customMotionForPart(settings, t, strength = 1) {
    const motion = normalizeCustomMotion(settings);
    const wave = Math.sin(t * Math.PI * 2 + motion.phase * Math.PI * 2);
    return {
      x: motion.x * wave * strength,
      y: motion.y * wave * strength,
      rotate: motion.rotate * wave * strength,
      scaleX: 1,
      scaleY: 1 + motion.scaleY * wave * strength,
      jointX: motion.jointX * wave * strength,
      jointY: motion.jointY * wave * strength,
    };
  }

  function poseToTransform(settings) {
    const pose = normalizeCustomMotion(settings);
    return {
      x: pose.x,
      y: pose.y,
      rotate: pose.rotate,
      scaleX: 1,
      scaleY: 1 + pose.scaleY,
      jointX: pose.jointX,
      jointY: pose.jointY,
    };
  }

  function numberOrDefault(value, fallback) {
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
  }

  Animotion.motionModel = { defaultCustomMotion, normalizeCustomMotion, customMotionForPart, poseToTransform };

  if (typeof module !== "undefined") module.exports = Animotion.motionModel;
}
