{
  const global = typeof window !== "undefined" ? window : globalThis;
  const Animotion = global.Animotion || (global.Animotion = {});
  const MIN_SPEED = 0.25;
  const MAX_SPEED = 3;
  const DEFAULT_SPEED = 1;

  function normalizeSpeed(value) {
    const number = Number(value);
    if (!Number.isFinite(number)) return DEFAULT_SPEED;
    return clamp(Math.round(number * 100) / 100, MIN_SPEED, MAX_SPEED);
  }

  function speedFromState(state = Animotion.state) {
    return normalizeSpeed(state?.playbackSpeed ?? DEFAULT_SPEED);
  }

  function playbackSeconds(state = Animotion.state, now = performance.now()) {
    if (!state?.running) return Number(state?.pausedTime) || 0;
    return Math.max(0, ((now - Number(state.startTime || now)) / 1000) * speedFromState(state));
  }

  function startTimeForPlaybackSeconds(seconds, now = performance.now(), speed = DEFAULT_SPEED) {
    return now - (Math.max(0, Number(seconds) || 0) / normalizeSpeed(speed)) * 1000;
  }

  function pauseAtNow(state = Animotion.state, now = performance.now()) {
    if (!state) return null;
    state.pausedTime = playbackSeconds(state, now);
    state.running = false;
    return state.pausedTime;
  }

  function setSpeed(state = Animotion.state, speed = DEFAULT_SPEED, now = performance.now()) {
    if (!state) return DEFAULT_SPEED;
    const currentSeconds = playbackSeconds(state, now);
    state.playbackSpeed = normalizeSpeed(speed);
    if (state.running) state.startTime = startTimeForPlaybackSeconds(currentSeconds, now, state.playbackSpeed);
    return state.playbackSpeed;
  }

  function secondsForFrame(frame, fps) {
    return (Math.max(1, Math.round(Number(frame) || 1)) - 1) / Math.max(1, Number(fps) || 1);
  }

  function labelForSpeed(speed) {
    return `${normalizeSpeed(speed).toFixed(2).replace(/\.?0+$/, "")}x`;
  }

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  Animotion.playbackSpeed = {
    MIN_SPEED,
    MAX_SPEED,
    DEFAULT_SPEED,
    normalizeSpeed,
    speedFromState,
    playbackSeconds,
    startTimeForPlaybackSeconds,
    pauseAtNow,
    setSpeed,
    secondsForFrame,
    labelForSpeed,
  };

  if (typeof module !== "undefined") module.exports = Animotion.playbackSpeed;
}
