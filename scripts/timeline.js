{
  const global = typeof window !== "undefined" ? window : globalThis;
  const Animotion = global.Animotion || (global.Animotion = {});

  function frameFromTime(t, totalFrames, fps) {
    return Math.floor((t * fps) % totalFrames) + 1;
  }

  function normalizeKeyframe(keyframe = {}) {
    return {
      frame: Math.max(1, Math.round(Number(keyframe.frame) || 1)),
      pose: Animotion.motionModel.normalizeCustomMotion(keyframe.pose),
    };
  }

  function evaluatePartAtFrame(part, frame) {
    const keyframes = sortedKeyframes(part);
    if (keyframes.length === 0) return Animotion.motionModel.defaultCustomMotion();
    const exact = keyframes.find((keyframe) => keyframe.frame === frame);
    if (exact) return { ...exact.pose };
    const previous = [...keyframes].reverse().find((keyframe) => keyframe.frame < frame);
    const next = keyframes.find((keyframe) => keyframe.frame > frame);
    if (!previous) return { ...keyframes[0].pose };
    if (!next) return { ...keyframes[keyframes.length - 1].pose };
    return interpolatePose(previous, next, frame);
  }

  function sortedKeyframes(part) {
    return (part.keyframes || []).map(normalizeKeyframe).sort((a, b) => a.frame - b.frame);
  }

  function interpolatePose(previous, next, frame) {
    const ratio = (frame - previous.frame) / (next.frame - previous.frame);
    const pose = {};
    for (const key of Object.keys(previous.pose)) {
      pose[key] = lerp(previous.pose[key], next.pose[key], ratio);
    }
    return pose;
  }

  function lerp(a, b, ratio) {
    return a + (b - a) * ratio;
  }

  function upsertedKeyframes(part, frame, pose) {
    const target = normalizedFrame(frame);
    const keyframes = sortedKeyframes(part).filter((keyframe) => keyframe.frame !== target);
    keyframes.push(normalizeKeyframe({ frame, pose }));
    return keyframes.sort((a, b) => a.frame - b.frame);
  }

  function deletedKeyframes(part, frame) {
    const target = normalizedFrame(frame);
    return sortedKeyframes(part).filter((keyframe) => keyframe.frame !== target);
  }

  function normalizedFrame(frame) {
    return Math.max(1, Math.round(Number(frame) || 1));
  }

  Animotion.timeline = { frameFromTime, evaluatePartAtFrame, upsertedKeyframes, deletedKeyframes, sortedKeyframes };

  if (typeof module !== "undefined") module.exports = Animotion.timeline;
}
