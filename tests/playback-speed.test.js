const assert = require("node:assert/strict");
const fs = require("node:fs");

globalThis.window = { Animotion: {} };
const playbackSpeed = require("../scripts/playback-speed.js");

function test(name, fn) {
  try {
    fn();
    console.log(`PASS ${name}`);
  } catch (error) {
    console.error(`FAIL ${name}`);
    throw error;
  }
}

test("normalizes playback speed to the supported range", () => {
  assert.equal(playbackSpeed.normalizeSpeed(0), 0.25);
  assert.equal(playbackSpeed.normalizeSpeed(2.333), 2.33);
  assert.equal(playbackSpeed.normalizeSpeed(9), 3);
  assert.equal(playbackSpeed.normalizeSpeed("bad"), 1);
});

test("running playback seconds scale with speed", () => {
  const state = { running: true, startTime: 1000, pausedTime: 0, playbackSpeed: 2 };
  assert.equal(playbackSpeed.playbackSeconds(state, 1750), 1.5);
});

test("changing speed preserves the current playback position", () => {
  const state = { running: true, startTime: 1000, pausedTime: 0, playbackSpeed: 1 };
  assert.equal(playbackSpeed.playbackSeconds(state, 1500), 0.5);
  playbackSpeed.setSpeed(state, 2, 1500);
  assert.equal(playbackSpeed.playbackSeconds(state, 1500), 0.5);
  assert.equal(playbackSpeed.playbackSeconds(state, 1750), 1);
});

test("pauseAtNow stores scaled playback seconds", () => {
  const state = { running: true, startTime: 1000, pausedTime: 0, playbackSpeed: 3 };
  playbackSpeed.pauseAtNow(state, 1500);
  assert.equal(state.running, false);
  assert.equal(state.pausedTime, 1.5);
});

test("frame resume seconds match one-based timeline frames", () => {
  assert.equal(playbackSpeed.secondsForFrame(1, 24), 0);
  assert.equal(playbackSpeed.secondsForFrame(25, 24), 1);
  assert.equal(playbackSpeed.labelForSpeed(2), "2x");
});

test("playback speed scripts load before runtime consumers", () => {
  const bootstrap = fs.readFileSync("scripts/bootstrap.js", "utf8");
  assert.equal(bootstrap.indexOf('"playback-speed"') < bootstrap.indexOf('"dom-state"'), true);
  assert.equal(bootstrap.indexOf('"playback-speed"') < bootstrap.indexOf('"playback-speed-controls"'), true);
  assert.equal(bootstrap.indexOf('"playback-speed-controls"') < bootstrap.indexOf('"motion"'), true);
});

test("playback speed control exposes the intended range", () => {
  const controls = fs.readFileSync("scripts/playback-speed-controls.js", "utf8");
  assert.equal(controls.includes('id="playbackSpeed"'), true);
  assert.equal(controls.includes('min="0.25"'), true);
  assert.equal(controls.includes('max="3"'), true);
  assert.equal(controls.includes('step="0.25"'), true);
});
