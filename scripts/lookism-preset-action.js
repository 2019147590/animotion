{
  const global = window;
  const Animotion = global.Animotion;
  const data = Animotion.lookismPresetData;

  function sampleAction(time) {
    const safeTime = clamp(time, 0, data.DURATION);
    const beats = data.ACTION.beats;
    const nextIndex = beats.findIndex((beat) => beat.at >= safeTime);
    if (nextIndex <= 0) return { beat: beats[0], pose: clonePose(beats[0].pose) };
    const next = beats[nextIndex] || beats[beats.length - 1];
    const previous = beats[nextIndex - 1] || beats[beats.length - 1];
    return { beat: next, pose: interpolateTimedPose(previous, next, safeTime) };
  }

  function cutsceneValues(time) {
    const n = time / data.DURATION;
    const crouch = smoothstep(clamp(n / 0.2, 0, 1));
    const launch = easeInCubic(clamp((n - 0.18) / 0.46, 0, 1));
    const impactIn = smoothstep(clamp((n - 0.72) / 0.14, 0, 1));
    const finalSnap = easeOutCubic(clamp((n - 0.82) / 0.18, 0, 1));
    return {
      n,
      crouch,
      launch,
      readyAlpha: 1 - smoothstep(clamp((n - 0.3) / 0.34, 0, 1)),
      impactAlpha: impactIn,
      shake: n > 0.78 ? Math.sin(n * 140) * (1 - n) * 28 : 0,
      finalSnap,
    };
  }

  function bridgeBeats(frameCount) {
    return data.ACTION.beats.map((beat) => ({
      id: beat.id,
      at: Math.max(1, Math.round(beat.at / data.DURATION * frameCount)),
      pose: beat.pose,
    }));
  }

  function interpolateTimedPose(previous, next, time) {
    const ratio = next.at === previous.at ? 1 : smoothstep((time - previous.at) / (next.at - previous.at));
    return interpolatePose(previous.pose, next.pose, ratio);
  }

  function interpolatePose(from, to, ratio) {
    const pose = {};
    for (const key of Object.keys(from)) {
      pose[key] = [lerp(from[key][0], to[key][0], ratio), lerp(from[key][1], to[key][1], ratio)];
    }
    return pose;
  }

  function clonePose(pose) {
    return Object.fromEntries(Object.entries(pose).map(([key, point]) => [key, [...point]]));
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function lerp(a, b, ratio) {
    return a + (b - a) * ratio;
  }

  function smoothstep(value) {
    return value * value * (3 - 2 * value);
  }

  function easeInCubic(value) {
    return value * value * value;
  }

  function easeOutCubic(value) {
    return 1 - Math.pow(1 - value, 3);
  }

  Animotion.lookismPresetAction = {
    sampleAction,
    cutsceneValues,
    bridgeBeats,
    clamp,
    lerp,
    smoothstep,
  };
}
