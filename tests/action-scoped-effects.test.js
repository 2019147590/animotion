const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

function test(name, fn) {
  try {
    fn();
    console.log(`PASS ${name}`);
  } catch (error) {
    console.error(`FAIL ${name}`);
    throw error;
  }
}

function runScript(context, path) {
  vm.runInContext(fs.readFileSync(path, "utf8"), context, { filename: path });
}

function loadAnimotion() {
  const context = { window: { Animotion: {} }, crypto: { randomUUID: () => "test-id" } };
  vm.createContext(context);
  for (const path of [
    "scripts/coordinate-spaces.js",
    "scripts/hidden-completion-assets.js",
    "scripts/motion-hints.js",
    "scripts/motion-drafts.js",
    "scripts/cutscene-action-selectors.js",
    "scripts/motion-draft-action-store.js",
    "scripts/action-scoped-effects.js",
    "scripts/action-part-visibility.js",
    "scripts/part-visibility-masks.js",
    "scripts/cutscene-model.js",
  ]) runScript(context, path);
  return context.window.Animotion;
}

test("same local frame does not mix effects across action ids", () => {
  const Animotion = loadAnimotion();
  const action = {
    comboTimeline: {
      id: "jab_jab_cross",
      steps: [
        { index: 0, actionId: "jab", startFrame: 1, endFrame: 18, holdEndFrame: 20 },
        { index: 1, actionId: "rearCross", startFrame: 42, endFrame: 59, holdEndFrame: 59 },
      ],
    },
    effectTracks: [
      { type: "impactFlash", actionId: "jab", localFrame: 8, effectId: "jab-flash" },
      { type: "impactFlash", actionId: "rearCross", localFrame: 8, effectId: "cross-flash" },
    ],
  };

  assert.deepEqual(Animotion.actionScopedEffects.effectsForFrame(action, 8, "impactFlash").map((item) => item.effectId), ["jab-flash"]);
  assert.deepEqual(Animotion.actionScopedEffects.effectsForFrame(action, 49, "impactFlash").map((item) => item.effectId), ["cross-flash"]);
});

test("rearCross hidden completion draft migrates into action scoped effect track", () => {
  const Animotion = loadAnimotion();
  const bridge = Animotion.cutsceneModel.normalizeBridge({
    durationFrames: 18,
    jointAction: {
      source: "motion-planner-punch-anchors-v1",
      actionTimeline: { template: "punch", durationFrames: 18, impactFrame: 15 },
      targetDebug: { punchStyle: "rear-cross" },
      beats: [{ id: "impact", at: 15, pose: { hand: [1, 2] } }],
      motionDraft: {
        partId: "rearUpper",
        hiddenCompletion: { needed: true, status: "candidate", assetStatus: "ready", assetId: "hidden-rearUpper" },
      },
    },
  });

  const tracks = bridge.jointAction.effectTracks;
  assert.equal(tracks.length, 1);
  assert.equal(tracks[0].type, "hiddenCompletion");
  assert.equal(tracks[0].actionId, "rearCross");
  assert.equal(tracks[0].localFrame, 1);
  assert.equal(tracks[0].endLocalFrame, 18);
  assert.equal(tracks[0].assetId, "hidden-rearUpper");
});

test("visibility masks respect current action and local frame", () => {
  const Animotion = loadAnimotion();
  const part = {
    id: "rearUpper",
    visibilityMasks: [{
      id: "rear-mask",
      mask: { kind: "polygon", points: [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }] },
      keyframes: [{ frame: 8, strength: 1 }],
    }],
  };
  const comboAction = {
    comboTimeline: {
      id: "jab_jab_cross",
      steps: [
        { index: 0, actionId: "jab", startFrame: 1, endFrame: 18, holdEndFrame: 20 },
        { index: 1, actionId: "rearCross", startFrame: 42, endFrame: 59, holdEndFrame: 59 },
      ],
    },
    effectTracks: [{ type: "visibilityMask", actionId: "rearCross", localFrame: 8, maskId: "rear-mask", partId: "rearUpper" }],
  };

  assert.equal(Animotion.partVisibilityMasks.activeMasks(part, 8, { action: { targetDebug: { punchStyle: "jab" } } }).length, 0);
  assert.equal(Animotion.partVisibilityMasks.activeMasks(part, 8, { action: { targetDebug: { punchStyle: "rear-cross" } } }).length, 1);
  assert.equal(Animotion.partVisibilityMasks.activeMasks(part, 8, { action: comboAction }).length, 0);
  assert.equal(Animotion.partVisibilityMasks.activeMasks(part, 49, { action: comboAction }).length, 1);
});

test("visibility mask owner fields do not apply across actions", () => {
  const Animotion = loadAnimotion();
  const part = {
    id: "rearUpper",
    visibilityMasks: [{
      id: "rear-mask",
      ownerActionId: "rearCross",
      mask: { kind: "polygon", points: [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }] },
      keyframes: [{ frame: 8, strength: 1 }],
    }],
  };

  assert.equal(Animotion.partVisibilityMasks.activeMasks(part, 8, { action: { targetDebug: { punchStyle: "jab" } } }).length, 0);
  assert.equal(Animotion.partVisibilityMasks.activeMasks(part, 8, { action: { targetDebug: { punchStyle: "rear-cross" } } }).length, 1);
});
