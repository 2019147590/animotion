import { clamp, pointLerp, smoothstep } from "./math.mjs";

export function getBeatPair(action, time) {
  const beats = action.beats;
  for (let i = 0; i < beats.length - 1; i += 1) {
    if (time >= beats[i].at && time <= beats[i + 1].at) {
      return [beats[i], beats[i + 1]];
    }
  }
  return [beats[beats.length - 1], beats[beats.length - 1]];
}

export function sampleAction(action, time) {
  const [from, to] = getBeatPair(action, time);
  const span = Math.max(0.001, to.at - from.at);
  const local = clamp((time - from.at) / span, 0, 1);
  const eased = smoothstep(local);
  const pose = {};

  for (const key of Object.keys(from.pose)) {
    pose[key] = pointLerp(from.pose[key], to.pose[key], eased);
  }

  return { beat: local > 0.55 ? to : from, local, pose };
}
