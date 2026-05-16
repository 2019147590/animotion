import test from "node:test";
import assert from "node:assert/strict";
import { DURATION } from "../src/action-data.mjs";
import { sampleAction } from "../src/action.mjs";
import { isSoundEffectInk } from "../src/assets.mjs";
import { cutsceneValues, flashAlpha, phaseLabel, sceneEffectPowers } from "../src/cutscene-values.mjs";
import { POST_ACTION, POST_RIG_LINKS } from "../src/post-action-data.mjs";

test("cutscene timing moves from strike to follow-through", () => {
  const start = cutsceneValues(0);
  const impact = cutsceneValues(0.5);
  const end = cutsceneValues(DURATION);

  assert.equal(start.strikeN, 0);
  assert.equal(start.followN, 0);
  assert.equal(impact.strikeN, 1);
  assert.equal(impact.followN, 0);
  assert.equal(end.strikeN, 1);
  assert.equal(end.followN, 1);
  assert.equal(end.endSnap, 1);
});

test("follow-through is staged as blackout, blade slash, then end reveal", () => {
  const dodgePause = cutsceneValues(0.52);
  const readableImpact = cutsceneValues(0.74);
  const blackout = cutsceneValues(0.77);
  const whip = cutsceneValues(0.87);
  const settle = cutsceneValues(0.94);

  assert.ok(dodgePause.dodgePause > 0.5);
  assert.ok(readableImpact.blackoutAlpha < 0.1);
  assert.ok(readableImpact.impactAlpha > 0.9);
  assert.ok(readableImpact.bladeEnter < 0.1);
  assert.ok(readableImpact.endAlpha < 0.1);
  assert.ok(blackout.blackoutAlpha > 0.8);
  assert.ok(whip.bladeEnter > 0.5);
  assert.ok(whip.slashCut > 0.5);
  assert.ok(dodgePause.panelWhip < whip.panelWhip);
  assert.ok(whip.panelWhip > 0.5);
  assert.ok(settle.endAlpha > whip.endAlpha);
  assert.ok(settle.slashReveal > whip.slashReveal);
  assert.equal(cutsceneValues(DURATION).endSnap, 1);
});

test("phase labels switch after impact and settle on end motion", () => {
  const sample = { beat: { label: "IMPACT" } };

  assert.equal(phaseLabel(sample, cutsceneValues(0.56)), "IMPACT");
  assert.equal(phaseLabel(sample, cutsceneValues(0.74)), "IMPACT");
  assert.equal(phaseLabel(sample, cutsceneValues(0.82)), "BLADE SLASH");
  assert.equal(phaseLabel(sample, cutsceneValues(0.9)), "END MOTION");
});

test("post action samples both attacker pressure and evader dodge keys", () => {
  const sample = sampleAction(POST_ACTION, 0.32);

  assert.ok(sample.pose.attackerStrikeHand[0] > sample.pose.attackerStrikeShoulder[0]);
  assert.ok(sample.pose.evaderHead[1] < sample.pose.evaderChest[1]);
  assert.equal(Object.keys(POST_RIG_LINKS).length, 10);
});

test("global effect powers are limited to the first strike", () => {
  const heldImpact = sceneEffectPowers(cutsceneValues(0.74));
  const bladeSlash = sceneEffectPowers(cutsceneValues(0.86));
  const end = sceneEffectPowers(cutsceneValues(DURATION));

  assert.equal(heldImpact.speed, 0);
  assert.equal(heldImpact.ink, 0);
  assert.equal(bladeSlash.speed, 0);
  assert.equal(bladeSlash.ink, 0);
  assert.equal(end.speed, 0);
  assert.equal(end.ink, 0);
});

test("flash alpha is absent at rest and bounded during impacts", () => {
  assert.equal(flashAlpha(0), 0);
  assert.ok(flashAlpha(0.5) > 0);
  assert.ok(flashAlpha(0.5) <= 0.28);
  assert.equal(flashAlpha(1), 0);
});

test("sound effect ink classifier only removes very dark visible pixels", () => {
  const darkVisible = new Uint8ClampedArray([12, 10, 8, 255]);
  const grayVisible = new Uint8ClampedArray([90, 90, 90, 255]);
  const darkTransparent = new Uint8ClampedArray([12, 10, 8, 0]);

  assert.equal(isSoundEffectInk(darkVisible, 0), true);
  assert.equal(isSoundEffectInk(grayVisible, 0), false);
  assert.equal(isSoundEffectInk(darkTransparent, 0), false);
});
