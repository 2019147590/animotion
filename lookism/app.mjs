import {
  ACTION,
  CUTSCENE_ASSETS,
  CUTSCENE_RIG_DRAW_ORDER,
  DURATION,
  RIG_LINKS,
} from "./src/action-data.mjs";
import { sampleAction } from "./src/action.mjs";
import { createCutout, loadImage, loadRig } from "./src/assets.mjs";
import { drawImageAt, drawInkField, drawPanelMask, drawPaper, drawSpeedLines, drawTrajectory } from "./src/canvas.mjs";
import { cutsceneValues, flashAlpha, phaseLabel, sceneEffectPowers } from "./src/cutscene-values.mjs";
import { clamp, lerp, smoothstep } from "./src/math.mjs";
import { POST_ACTION, POST_RIG_DRAW_ORDER, POST_RIG_LINKS } from "./src/post-action-data.mjs";
import { drawRigLayer } from "./src/rig-renderer.mjs";
import { drawBladeTransition, drawSlashRevealedImage } from "./src/slash-renderer.mjs";

const elements = {
  canvas: document.getElementById("stage"),
  playButton: document.getElementById("playButton"),
  resetButton: document.getElementById("resetButton"),
  timeLabel: document.getElementById("timeLabel"),
  beatLabel: document.getElementById("beatLabel"),
  progress: document.getElementById("progress"),
};

const ctx = elements.canvas.getContext("2d");
const state = {
  sprites: {},
  rig: null,
  postRig: null,
  playing: false,
  startMs: 0,
  lastTime: 0,
};

function drawReadyLayer(values) {
  const { crouch, launch, readyAlpha } = values;
  if (readyAlpha <= 0.02) return;
  const transform = {
    x: lerp(292, 448, launch),
    y: lerp(422 + crouch * 30, 334, launch),
    scaleX: lerp(1.25 + crouch * 0.12, 0.88, launch),
    scaleY: lerp(1.16 - crouch * 0.1, 0.94, launch),
    rotation: lerp(-0.06 - crouch * 0.1, -0.4, launch),
    alpha: readyAlpha,
  };

  for (let i = 3; i >= 1; i -= 1) {
    drawImageAt(ctx, state.sprites.ready, ghostTransform(transform, i, launch));
  }
  drawImageAt(ctx, state.sprites.ready, transform);
}

function ghostTransform(base, index, launch) {
  const ghost = index / 4;
  return {
    x: base.x - 58 * index * launch,
    y: base.y + 34 * index * launch,
    scaleX: base.scaleX * (1 + ghost * 0.06),
    scaleY: base.scaleY * (1 - ghost * 0.05),
    rotation: base.rotation + ghost * 0.12,
    alpha: base.alpha * launch * 0.16 * (4 - index),
  };
}

function drawRigBridge(sample, values) {
  if (!state.rig) return;
  const alphaIn = smoothstep(clamp((values.strikeN - 0.18) / 0.14, 0, 1));
  const alphaOut = 1 - smoothstep(clamp((values.strikeN - 0.78) / 0.12, 0, 1));
  const alpha = alphaIn * alphaOut;
  if (alpha <= 0.01) return;
  const scale = lerp(1.44, 1.62, smoothstep(clamp((values.strikeN - 0.4) / 0.38, 0, 1)));

  for (const delay of [0.14, 0.08]) {
    const ghostTime = clamp(state.lastTime - delay, 0, DURATION);
    drawRigLayer(ctx, state.rig, sampleAction(ACTION, ghostTime).pose, ghostOptions(scale, alpha));
  }
  drawRigLayer(ctx, state.rig, sample.pose, { scale, alpha, drawOrder: CUTSCENE_RIG_DRAW_ORDER });
}

function ghostOptions(scale, alpha) {
  return { scale, alpha: alpha * 0.22, drawOrder: CUTSCENE_RIG_DRAW_ORDER };
}

function drawImpact(values) {
  if (values.impactAlpha <= 0.01) return;
  const dodgeCarry = smoothstep(clamp((values.followN - 0.5) / 0.28, 0, 1));
  const whip = values.panelWhip;
  const transform = {
    x: lerp(lerp(670, 590, values.finalSnap), 544, dodgeCarry),
    y: lerp(lerp(360, 356, values.finalSnap), 344, dodgeCarry),
    scaleX: lerp(lerp(0.88, 0.94, values.finalSnap), 0.98, dodgeCarry),
    scaleY: lerp(lerp(0.88, 0.94, values.finalSnap), 0.98, dodgeCarry),
    rotation: lerp(lerp(0.1, 0, values.finalSnap), -0.08, dodgeCarry),
    alpha: values.impactAlpha,
  };

  if (values.followN > 0) {
    for (let i = 3; i >= 1; i -= 1) {
      drawImageAt(ctx, state.sprites.impact, {
        ...transform,
        x: transform.x + i * (38 + whip * 34),
        y: transform.y - i * (14 + whip * 20),
        rotation: transform.rotation + i * 0.05,
        alpha: transform.alpha * (0.08 + whip * 0.08) * i,
      });
    }
  }
  drawImageAt(ctx, state.sprites.impact, transform);
}

function drawPostRigBridge(sample, values) {
  if (!state.postRig || values.followN <= 0) return;
  const alphaIn = smoothstep(clamp((values.followN - 0.5) / 0.14, 0, 1));
  const alphaOut = 1 - smoothstep(clamp((values.followN - 0.9) / 0.1, 0, 1));
  const alpha = alphaIn * alphaOut;
  if (alpha <= 0.01) return;

  for (const delay of [0.11, 0.06]) {
    const ghostTime = clamp(sample.time - delay, 0, POST_ACTION.duration);
    const ghostPose = sampleAction(POST_ACTION, ghostTime).pose;
    drawRigLayer(ctx, state.postRig, ghostPose, postGhostOptions(alpha));
  }

  drawRigLayer(ctx, state.postRig, sample.pose, {
    scale: 0.94,
    alpha,
    drawOrder: POST_RIG_DRAW_ORDER,
  });
}

function postGhostOptions(alpha) {
  return { scale: 0.94, alpha: alpha * 0.2, drawOrder: POST_RIG_DRAW_ORDER };
}

function drawEndMotion(values) {
  if (values.endAlpha <= 0.01) return;
  const arrival = smoothstep(clamp((values.followN - 0.28) / 0.44, 0, 1));
  const transform = {
    x: lerp(360, 590, arrival),
    y: lerp(284, 356, arrival),
    scaleX: lerp(1.24, 0.94, values.endSnap),
    scaleY: lerp(1.18, 0.94, values.endSnap),
    rotation: lerp(-0.22, 0, values.endSnap),
    alpha: values.endAlpha,
  };

  for (let i = 4; i >= 1; i -= 1) {
    const lag = i / 5;
    drawSlashRevealedImage(ctx, elements.canvas, state.sprites.end, {
      x: transform.x - 86 * lag * (1 - values.endSnap),
      y: transform.y - 34 * lag,
      scaleX: transform.scaleX * (1 + lag * 0.05),
      scaleY: transform.scaleY * (1 + lag * 0.03),
      rotation: transform.rotation - lag * 0.07,
      alpha: transform.alpha * (1 - values.endSnap) * 0.16,
    }, values);
  }

  drawSlashRevealedImage(ctx, elements.canvas, state.sprites.end, transform, values);
}

function render(time) {
  const safeTime = clamp(time, 0, DURATION);
  const actionTime = clamp(safeTime, 0, ACTION.duration);
  const postStart = ACTION.duration + 0.25;
  const postTime = clamp((safeTime - postStart) / 0.25, 0, 1) * POST_ACTION.duration;
  const sample = sampleAction(ACTION, actionTime);
  const postSample = { ...sampleAction(POST_ACTION, postTime), time: postTime };
  const values = cutsceneValues(safeTime);

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  drawPaper(ctx, elements.canvas);
  ctx.translate(values.shake, -values.shake * 0.28);
  const effectPowers = sceneEffectPowers(values);
  drawSpeedLines(ctx, effectPowers.speed);
  drawInkField(ctx, effectPowers.ink);
  drawTrajectory(ctx, ACTION.beats.map((beat) => beat.pose.hip), values.strikeN);
  drawReadyLayer(values);
  drawRigBridge(sample, values);
  drawImpact(values);
  drawBladeTransition(ctx, elements.canvas, values, postSample.pose);
  drawPostRigBridge(postSample, values);
  drawEndMotion(values);
  drawFlash(values.n);
  drawPanelMask(ctx, elements.canvas);
  updateReadout(safeTime, values.n, phaseLabel(sample, values));
  state.lastTime = safeTime;
}

function drawFlash(n) {
  const alpha = flashAlpha(n);
  if (alpha <= 0) return;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = "rgba(255, 255, 255, 0.36)";
  ctx.fillRect(0, 0, elements.canvas.width, elements.canvas.height);
  ctx.restore();
}

function updateReadout(time, normalizedTime, beatLabel) {
  elements.timeLabel.textContent = `${time.toFixed(2)}s`;
  elements.beatLabel.textContent = beatLabel;
  elements.progress.style.width = `${normalizedTime * 100}%`;
}

function tick(now) {
  if (!state.playing) return;
  const time = clamp((now - state.startMs) / 1000, 0, DURATION);
  render(time);
  if (time >= DURATION) {
    state.playing = false;
    elements.playButton.textContent = "Replay";
    return;
  }
  requestAnimationFrame(tick);
}

async function boot() {
  const ready = await loadImage(CUTSCENE_ASSETS.ready.src);
  const impact = await loadImage(CUTSCENE_ASSETS.impact.src);
  const end = await loadImage(CUTSCENE_ASSETS.end.src);
  state.sprites.ready = createCutout(ready, CUTSCENE_ASSETS.ready.crop);
  state.sprites.impact = createCutout(impact, CUTSCENE_ASSETS.impact.crop);
  state.sprites.end = createCutout(end, CUTSCENE_ASSETS.end.crop);
  const rig = await loadRig("parts/manifest.json");
  state.rig = { ...rig, links: RIG_LINKS };
  const postRig = await loadRig("post_parts/manifest.json");
  state.postRig = { ...postRig, links: POST_RIG_LINKS };
  render(0);
}

elements.playButton.addEventListener("click", () => {
  state.playing = true;
  state.startMs = performance.now();
  elements.playButton.textContent = "Playing";
  requestAnimationFrame(tick);
});

elements.resetButton.addEventListener("click", () => {
  state.playing = false;
  elements.playButton.textContent = "Play";
  render(0);
});

boot().catch((error) => {
  console.error(error);
  elements.beatLabel.textContent = "LOAD ERROR";
});
