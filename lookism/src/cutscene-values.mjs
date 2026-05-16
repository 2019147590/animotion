import { DURATION, FOLLOW_THROUGH_DURATION, STRIKE_DURATION } from "./action-data.mjs";
import { clamp, easeInCubic, easeOutCubic, smoothstep } from "./math.mjs";

const READY_FADE_START = 0.3;
const READY_FADE_SPAN = 0.34;
const FOLLOW_RUSH_SPAN = 0.56;
const HOLD_FOLLOW_N = 0.5;
const END_REVEAL_START = 0.68;
const END_REVEAL_SPAN = 0.18;

export function cutsceneValues(time) {
  const n = time / DURATION;
  const strikeN = clamp(time / STRIKE_DURATION, 0, 1);
  const followN = clamp((time - STRIKE_DURATION) / FOLLOW_THROUGH_DURATION, 0, 1);
  const launch = launchProgress(strikeN);
  const slashReveal = smoothstep(clamp((followN - 0.72) / 0.16, 0, 1));
  const endSnap = easeOutCubic(clamp((followN - 0.78) / 0.22, 0, 1));

  return {
    n,
    strikeN,
    followN,
    crouch: smoothstep(clamp(strikeN / 0.2, 0, 1)),
    launch,
    followRush: easeInCubic(clamp((followN - HOLD_FOLLOW_N) / FOLLOW_RUSH_SPAN, 0, 1)),
    dodgePause: 1 - smoothstep(clamp((followN - HOLD_FOLLOW_N) / 0.18, 0, 1)),
    panelWhip: panelWhip(followN),
    blackoutAlpha: blackoutAlpha(followN),
    bladeEnter: bladeEnter(followN),
    slashCut: slashCut(followN),
    slashReveal,
    readyAlpha: 1 - smoothstep(clamp((strikeN - READY_FADE_START) / READY_FADE_SPAN, 0, 1)),
    impactAlpha: impactAlpha(strikeN, followN),
    endAlpha: smoothstep(clamp((followN - END_REVEAL_START) / END_REVEAL_SPAN, 0, 1)),
    endSnap,
    shake: shakeAmount(strikeN, followN),
    finalSnap: easeOutCubic(clamp((strikeN - 0.82) / 0.18, 0, 1)),
  };
}

export function sceneEffectPowers(values) {
  const strikePower = values.launch * (1 - smoothstep(clamp(values.followN / 0.16, 0, 1)));

  return {
    speed: clamp(strikePower, 0, 1),
    ink: clamp(strikePower, 0, 1),
  };
}

export function flashAlpha(n) {
  if (n <= 0.38) return 0;
  const strikeFlash = smoothstep(clamp((n - 0.38) / 0.12, 0, 1)) * (1 - smoothstep(clamp((n - 0.55) / 0.2, 0, 1)));
  const endFlash = smoothstep(clamp((n - 0.78) / 0.12, 0, 1)) * (1 - smoothstep(clamp((n - 0.92) / 0.08, 0, 1)));
  return Math.max(strikeFlash * 0.28, endFlash * 0.2);
}

export function phaseLabel(sample, values) {
  if (values.followN > 0.76) return "END MOTION";
  if (values.followN > HOLD_FOLLOW_N) return "BLADE SLASH";
  return sample.beat.label;
}

function launchProgress(strikeN) {
  return easeInCubic(clamp((strikeN - 0.18) / 0.46, 0, 1));
}

function impactAlpha(strikeN, followN) {
  const impactIn = smoothstep(clamp((strikeN - 0.72) / 0.14, 0, 1));
  const impactOut = 1 - smoothstep(clamp((followN - 0.58) / 0.24, 0, 1));
  return impactIn * impactOut;
}

function panelWhip(followN) {
  const inValue = smoothstep(clamp((followN - 0.52) / 0.18, 0, 1));
  const outValue = 1 - smoothstep(clamp((followN - 0.86) / 0.14, 0, 1));
  return inValue * outValue;
}

function blackoutAlpha(followN) {
  const inValue = smoothstep(clamp((followN - 0.5) / 0.04, 0, 1));
  const outValue = 1 - smoothstep(clamp((followN - 0.66) / 0.18, 0, 1));
  return inValue * outValue * 0.92;
}

function bladeEnter(followN) {
  const inValue = smoothstep(clamp((followN - 0.54) / 0.12, 0, 1));
  const outValue = 1 - smoothstep(clamp((followN - 0.9) / 0.1, 0, 1));
  return inValue * outValue;
}

function slashCut(followN) {
  const inValue = smoothstep(clamp((followN - 0.64) / 0.1, 0, 1));
  const outValue = 1 - smoothstep(clamp((followN - 0.92) / 0.08, 0, 1));
  return inValue * outValue;
}

function shakeAmount(strikeN, followN) {
  const strikeShake = strikeN > 0.78 ? Math.sin(strikeN * 140) * (1 - strikeN) * 28 : 0;
  const nearMissShake = followN > HOLD_FOLLOW_N ? Math.sin(followN * 220) * 8 * (1 - smoothstep(clamp((followN - HOLD_FOLLOW_N) / 0.18, 0, 1))) : 0;
  const slashShake = followN > 0.58 && followN < 0.92 ? Math.sin(followN * 104) * (1 - followN) * 18 : 0;
  return strikeShake + nearMissShake + slashShake;
}
