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

function loadAnimotion() {
  const context = { window: { Animotion: {} }, performance: { now: () => 1000 } };
  vm.createContext(context);
  for (const path of [
    "scripts/config.js",
    "scripts/geometry.js",
    "scripts/coordinate-spaces.js",
    "scripts/project-model.js",
    "scripts/motion-model.js",
    "scripts/motion-hints.js",
    "scripts/motion-drafts.js",
    "scripts/motion-target-state.js",
    "scripts/motion-target-debug.js",
    "scripts/character-root-motion.js",
    "scripts/action-specs.js",
    "scripts/action-timeline-model.js",
    "scripts/cutscene-action-selectors.js",
    "scripts/action-scoped-effects.js",
    "scripts/impact-exaggeration-layer.js",
    "scripts/rig-connection.js",
    "scripts/arm-chain-resolver.js",
    "scripts/pose-assist.js",
    "scripts/joint-coordinates.js",
    "scripts/cutscene-model.js",
    "scripts/motion-anchors.js",
    "scripts/timeline.js",
    "scripts/arm-extension-controls.js",
    "scripts/arm-extension.js",
    "scripts/lead-arm-composite.js",
    "scripts/motion-track-builder.js",
    "scripts/boxing-step-locomotion.js",
    "scripts/motion-planner.js",
    "scripts/motion-primary-selection.js",
    "scripts/combo-timeline.js",
    "scripts/motion-trajectory-tracks.js",
    "scripts/cutscene-depth.js",
    "scripts/render-layer-utils.js",
    "scripts/render-order-debug.js",
    "scripts/hidden-completion-diagnostics.js",
    "scripts/motion-replacement-layer.js",
    "scripts/motion-replacement-render.js",
    "scripts/cutscene-motion-status.js",
  ]) runScript(context, path);
  const Animotion = context.window.Animotion;
  const parts = separateBoxerParts();
  Animotion.state = {
    image: { naturalWidth: 180, naturalHeight: 140 },
    parts,
    selectedPartId: "front_forearm",
    motionPlan: { template: "punch", targetMode: false },
    cutsceneBridge: null,
    project: { assets: [], parts },
  };
  return Animotion;
}

function runScript(context, path) {
  vm.runInContext(fs.readFileSync(path, "utf8"), context, { filename: path });
}

test("jab_jab_cross builds a combo timeline from action ids", () => {
  const Animotion = loadAnimotion();
  const built = Animotion.comboTimeline.buildComboTimeline(
    Animotion.comboTimeline.specFor("jab_jab_cross"),
    { parts: Animotion.state.parts, selectedPartId: "front_forearm", plan: Animotion.state.motionPlan }
  );
  const action = built.bridge.jointAction;
  const combo = action.comboTimeline;

  assert.equal(built.generated, true);
  assert.equal(built.bridge.durationFrames, 59);
  assert.equal(built.bridge.impactFrame, 56);
  assert.equal(action.source, "combo-timeline-v1");
  assert.equal(JSON.stringify(combo.steps.map((step) => step.actionId)), JSON.stringify(["jab", "jab", "rearCross"]));
  assert.equal(JSON.stringify(combo.steps.map((step) => step.focusKey)), JSON.stringify(["rHand", "rHand", "lHand"]));
  assert.equal(JSON.stringify(combo.steps.map((step) => step.primaryPartId)), JSON.stringify(["front_hand", "front_hand", "back_hand"]));
  assert.equal(JSON.stringify(action.beats.filter((beat) => beat.id.endsWith(":impact")).map((beat) => beat.at)), JSON.stringify([15, 35, 56]));
  assert.equal(keyframesFor(built.result.partTracks, "front_hand").some((keyframe) => keyframe.frame === 15), true);
  assert.equal(keyframesFor(built.result.partTracks, "front_hand").some((keyframe) => keyframe.frame === 35), true);
  assert.equal(keyframesFor(built.result.partTracks, "back_hand").some((keyframe) => keyframe.frame === 56), true);
  assert.equal(keyframesFor(built.result.partTracks, "front_hand").some((keyframe) => keyframe.frame === 20), true);
  assert.equal(JSON.stringify(Animotion.motionTrajectoryTracks.trajectoryKeys(action)), JSON.stringify(["lHand", "rHand", "hip"]));
});

test("combo status reports current action and impact at the global frame", () => {
  const Animotion = loadAnimotion();
  const built = Animotion.comboTimeline.buildComboTimeline(Animotion.comboTimeline.specFor("jab_jab_cross"), {
    parts: Animotion.state.parts,
    selectedPartId: "front_forearm",
    plan: Animotion.state.motionPlan,
  });
  const bridge = Animotion.cutsceneModel.normalizeBridge(built.bridge);
  const status = Animotion.cutsceneMotionStatus.statusForBridge(bridge, { parts: Animotion.state.parts, currentFrame: 35 });
  const text = Animotion.cutsceneMotionStatus.statusText(status);

  assert.equal(status.combo.id, "jab_jab_cross");
  assert.equal(status.combo.currentActionIndex, 1);
  assert.equal(status.combo.currentActionId, "jab");
  assert.equal(status.combo.localFrame, 15);
  assert.equal(status.combo.globalFrame, 35);
  assert.equal(status.combo.impact, true);
  assert.equal(text.includes("combo jab_jab_cross action 2/3 jab local 15 global 35 impact yes"), true);

  const gapStatus = Animotion.cutsceneMotionStatus.statusForBridge(bridge, { parts: Animotion.state.parts, currentFrame: 19 });
  assert.equal(gapStatus.combo.currentActionIndex, 0);
  assert.equal(gapStatus.combo.currentActionId, "jab");
  assert.equal(gapStatus.combo.localFrame, 18);
  assert.equal(gapStatus.combo.impact, false);
});

test("combo timeline offsets events and schedules from local to global frames", () => {
  const Animotion = loadAnimotion();
  const spec = {
    id: "two_step_schedule",
    actions: [{ actionId: "jab", gapAfterFrames: 2 }, { actionId: "jab", gapAfterFrames: 0 }],
  };
  const built = Animotion.comboTimeline.buildComboTimeline(spec, {
    parts: Animotion.state.parts,
    selectedPartId: "front_forearm",
    actionFrameGenerator: fakeActionFrameGenerator,
  });
  const action = Animotion.cutsceneModel.normalizeBridge(built.bridge).jointAction;

  assert.equal(JSON.stringify(action.events.map((event) => event.frame)), JSON.stringify([3, 9]));
  assert.equal(JSON.stringify(action.impact.map((impact) => impact.frame)), JSON.stringify([3, 9]));
  assert.equal(JSON.stringify(action.patchSchedule.map((patch) => [patch.startFrame, patch.endFrame])), JSON.stringify([[2, 4], [8, 10]]));
  assert.equal(JSON.stringify(action.maskSchedule.map((mask) => mask.at)), JSON.stringify([1, 7]));
  assert.equal(JSON.stringify(action.effectTracks.map((effect) => [effect.type, effect.actionId, effect.sourceLocalFrame, effect.globalFrame])), JSON.stringify([["patchVisibility", "jab", 2, 2], ["visibilityMask", "jab", 1, 1], ["patchVisibility", "jab", 2, 8], ["visibilityMask", "jab", 1, 7]]));
});

test("app shell exposes action and combo preview controls", () => {
  const bootstrap = fs.readFileSync("scripts/bootstrap.js", "utf8");
  const ui = fs.readFileSync("scripts/ui.js", "utf8");
  const controls = fs.readFileSync("scripts/combo-timeline-controls.js", "utf8");

  assert.equal(bootstrap.includes('"combo-timeline"'), true);
  assert.equal(bootstrap.includes('"combo-timeline-controls"'), true);
  assert.equal(bootstrap.indexOf('"combo-timeline"') < bootstrap.indexOf('"combo-timeline-controls"'), true);
  assert.equal(ui.includes("comboTimelineControls?.refreshControls"), true);
  assert.equal(controls.includes("action:jab"), true);
  assert.equal(controls.includes("action:rearCross"), true);
  assert.equal(controls.includes("combo:"), true);
});

function fakeActionFrameGenerator(parts, primaryId) {
  return {
    target: null,
    anchors: [],
    targetDebug: { primaryPartId: primaryId, punchStyle: "jab" },
    activeMotionTarget: null,
    trajectoryPoints: [],
    jointAction: {
      source: "fake-action",
      focusKey: "rHand",
      actionTimeline: {
        template: "punch",
        durationFrames: 4,
        impactFrame: 3,
        beats: [{ id: "guard", at: 1 }, { id: "impact", at: 3 }, { id: "recover", at: 4 }],
      },
      beats: [
        { id: "guard", at: 1, pose: { rHand: [1, 1] } },
        { id: "impact", at: 3, pose: { rHand: [3, 3] } },
        { id: "recover", at: 4, pose: { rHand: [4, 4] } },
      ],
      events: [{ frame: 3, type: "impact" }],
      impact: { frame: 3, kind: "hit" },
      patchSchedule: [{ startFrame: 2, endFrame: 4, patchId: "p" }],
      maskSchedule: [{ at: 1, maskId: "m" }],
    },
    partTracks: parts.map((part) => ({ partId: part.id, keyframes: [{ frame: 1, pose: zeroPose() }, { frame: 4, pose: zeroPose() }] })),
  };
}

function keyframesFor(tracks, partId) {
  return tracks.find((track) => track.partId === partId)?.keyframes || [];
}

function zeroPose() {
  return { x: 0, y: 0, rotate: 0, scaleY: 0, jointX: 0, jointY: 0, phase: 0 };
}

function separateBoxerParts() {
  return [
    part("body", "body", "torso", { x: 40, y: 20, w: 20, h: 50 }, { x: 10, y: 25 }, { x: 10, y: 43 }),
    part("head", "head", "head", { x: 38, y: 2, w: 24, h: 20 }, { x: 12, y: 10 }, { x: 12, y: 16 }),
    part("back_upper", "arm", "upperArm", { x: 20, y: 30, w: 20, h: 20 }, { x: 20, y: 8 }, { x: 2, y: 10 }, "body"),
    part("back_forearm", "arm", "forearm", { x: 2, y: 30, w: 20, h: 20 }, { x: 20, y: 10 }, { x: 2, y: 10 }, "back_upper"),
    part("back_hand", "hand", "hand", { x: -10, y: 32, w: 14, h: 14 }, { x: 14, y: 8 }, null, "back_forearm", { x: 0, y: 8 }),
    part("front_upper", "arm", "upperArm", { x: 60, y: 30, w: 20, h: 20 }, { x: 0, y: 8 }, { x: 18, y: 10 }, "body"),
    part("front_forearm", "arm", "forearm", { x: 78, y: 30, w: 20, h: 20 }, { x: 0, y: 10 }, { x: 20, y: 10 }, "front_upper"),
    part("front_hand", "hand", "hand", { x: 98, y: 32, w: 14, h: 14 }, { x: 0, y: 8 }, null, "front_forearm", { x: 14, y: 8 }),
  ];
}

function part(id, type, humanRole, rect, pivot, joint, parentId = null, handTip = null) {
  return {
    id,
    name: id,
    type,
    humanRole,
    rect,
    pivot,
    ...(joint ? { joint } : {}),
    ...(parentId ? { parentId } : {}),
    ...(handTip ? { handTip } : {}),
    customMotion: zeroPose(),
    keyframes: [],
  };
}
