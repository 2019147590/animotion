const assert = require("node:assert/strict");
const fs = require("node:fs");

require("../scripts/motion-model.js");
require("../scripts/coordinate-spaces.js");
require("../scripts/motion-hints.js");
require("../scripts/motion-drafts.js");
const motionTargetPolicy = require("../scripts/motion-target-policy.js");
require("../scripts/motion-target-debug.js");
require("../scripts/pose-assist.js");
require("../scripts/joint-coordinates.js");
require("../scripts/motion-anchors.js");
const motionPanelMapper = require("../scripts/motion-panel-mapper.js");
const cutsceneModel = require("../scripts/cutscene-model.js");
const motionPlanner = require("../scripts/motion-planner.js");
const trajectoryEditor = require("../scripts/motion-trajectory-editor.js");
const anchorPicker = require("../scripts/motion-anchor-picker.js");

function test(name, fn) {
  try {
    fn();
    console.log(`PASS ${name}`);
  } catch (error) {
    console.error(`FAIL ${name}`);
    throw error;
  }
}

function sampleParts() {
  return [
    { id: "body", type: "body", rect: { x: 40, y: 20, w: 20, h: 50 }, pivot: { x: 10, y: 25 }, joint: { x: 10, y: 40 } },
    { id: "head", type: "head", rect: { x: 38, y: 4, w: 24, h: 20 }, pivot: { x: 12, y: 10 }, joint: { x: 12, y: 16 } },
    { id: "leg", type: "leg", rect: { x: 67, y: 60, w: 18, h: 45 }, pivot: { x: 2, y: 6 }, joint: { x: 16, y: 40 } },
  ];
}

test("cutscene bridge defaults to part-only source motion with body assist enabled", () => {
  const bridge = cutsceneModel.normalizeBridge({});
  assert.equal(bridge.sourceMotionEnabled, false);
  assert.equal(bridge.bodyAssistEnabled, true);
  assert.equal(cutsceneModel.normalizeBridge({ sourceMotionEnabled: true }).sourceMotionEnabled, true);
  assert.equal(cutsceneModel.normalizeBridge({ bodyAssistEnabled: false }).bodyAssistEnabled, false);
});

test("motion planner can disable auxiliary body and head tracks", () => {
  const bridge = cutsceneModel.normalizeBridge({ bodyAssistEnabled: false, impactFrame: 15 });
  const plan = motionPlanner.createPlan(sampleParts(), "leg", bridge, { template: "kick", target: { x: 140, y: 40 } });
  const regenerated = motionPlanner.tracksForJointAction(sampleParts(), "leg", { ...bridge, jointAction: plan.jointAction });
  const bodyTrack = regenerated.find((track) => track.partId === "body");
  const headTrack = regenerated.find((track) => track.partId === "head");
  const legTrack = regenerated.find((track) => track.partId === "leg");
  assert.equal(legTrack.keyframes.some((keyframe) => keyframe.pose.jointX !== 0 || keyframe.pose.jointY !== 0), true);
  assert.equal(bodyTrack.keyframes.every((keyframe) => keyframe.pose.x === 0 && keyframe.pose.y === 0), true);
  assert.equal(headTrack.keyframes.every((keyframe) => keyframe.pose.x === 0 && keyframe.pose.y === 0), true);
});

test("body primary moves by translation without joint rotation", () => {
  const bridge = cutsceneModel.normalizeBridge({ impactFrame: 15 });
  const plan = motionPlanner.createPlan(sampleParts(), "body", bridge, { template: "dash", target: { x: 80, y: 10 } });
  const bodyTrack = plan.partTracks.find((track) => track.partId === "body");
  const headTrack = plan.partTracks.find((track) => track.partId === "head");
  const impact = bodyTrack.keyframes.find((keyframe) => keyframe.frame === 15);
  assert.equal(plan.jointAction.focusKey, "chest");
  assert.deepEqual(plan.jointAction.beats.find((beat) => beat.id === "arrive").pose.chest, [80, 10]);
  assert.equal(impact.pose.x !== 0 || impact.pose.y !== 0, true);
  assert.equal(impact.pose.jointX, 0);
  assert.equal(impact.pose.jointY, 0);
  assert.equal(headTrack.keyframes.every((keyframe) => keyframe.pose.x === 0 && keyframe.pose.y === 0), true);
});

test("leg body assist scales up only for distant targets", () => {
  const bridge = cutsceneModel.normalizeBridge({ impactFrame: 15 });
  const near = motionPlanner.createPlan(sampleParts(), "leg", bridge, { template: "kick", target: { x: 90, y: 96 } });
  const far = motionPlanner.createPlan(sampleParts(), "leg", bridge, { template: "kick", target: { x: 150, y: 70 } });
  const nearBody = near.partTracks.find((track) => track.partId === "body").keyframes.find((keyframe) => keyframe.frame === 15).pose;
  const farBody = far.partTracks.find((track) => track.partId === "body").keyframes.find((keyframe) => keyframe.frame === 15).pose;
  assert.deepEqual({ x: nearBody.x, y: nearBody.y }, { x: 0, y: 0 });
  assert.equal(Math.hypot(farBody.x, farBody.y) > 0, true);
});

test("motion planner stores multi-anchor action drafts", () => {
  const bridge = cutsceneModel.normalizeBridge({ impactFrame: 15 });
  const plan = motionPlanner.createPlan(sampleParts(), "leg", bridge, { template: "kick", target: { x: 150, y: 70 } });
  const keys = plan.anchors.map((anchor) => anchor.key).sort();
  assert.deepEqual(keys, ["chest", "head", "hip", "rFoot", "rKnee"]);
  assert.equal(plan.jointAction.anchors.length, 5);
  assert.deepEqual(plan.jointAction.beats.find((beat) => beat.id === "impact").pose.rKnee, [88, 77]);
  assert.equal(cutsceneModel.normalizeBridge({ jointAction: plan.jointAction }).jointAction.anchors.length, 5);
});

test("edited action anchors regenerate beat poses", () => {
  const bridge = cutsceneModel.normalizeBridge({ impactFrame: 15 });
  const plan = motionPlanner.createPlan(sampleParts(), "leg", bridge, { template: "kick", target: { x: 150, y: 70 } });
  assert.equal(trajectoryEditor.editAnchorPoint(plan.jointAction, "chest", { x: 82, y: 24 }), true);
  const regenerated = motionPlanner.createPlan(sampleParts(), "leg", bridge, {
    template: "kick",
    target: plan.target,
    anchors: plan.jointAction.anchors,
  });
  assert.deepEqual(regenerated.jointAction.beats.find((beat) => beat.id === "impact").pose.chest, [82, 24]);
});

test("anchor picker updates a selected anchor as a locked user point", () => {
  const updated = anchorPicker.updateAnchorPoint([
    { key: "rFoot", role: "primary", point: { x: 90, y: 70 }, locked: true },
    { key: "chest", role: "balance", point: { x: 52, y: 29 }, locked: false },
  ], "chest", { x: 84.4, y: 24.2 });
  assert.deepEqual(updated.find((anchor) => anchor.key === "chest").point, { x: 84, y: 24 });
  assert.equal(updated.find((anchor) => anchor.key === "chest").locked, true);
  assert.deepEqual(updated.find((anchor) => anchor.key === "rFoot").point, { x: 90, y: 70 });
});

test("motion target and anchors restore from source-image normalized points", () => {
  globalThis.Animotion.imageBounds = () => ({ width: 200, height: 160 });
  const plan = motionPlanner.normalizePlan({
    template: "kick",
    target: { x: 10, y: 20 },
    targetNormalized: { xNorm: 0.5, yNorm: 0.25, coordinateSpace: "normalized-image" },
    anchors: [{
      key: "rFoot",
      role: "primary",
      point: { x: 10, y: 20 },
      pointNormalized: { xNorm: 0.75, yNorm: 0.5, coordinateSpace: "normalized-image" },
    }],
  });
  assert.deepEqual(plan.target, { x: 100, y: 40 });
  assert.deepEqual(plan.anchors[0].point, { x: 150, y: 80 });
  assert.equal(plan.targetNormalized.xNorm, 0.5);
  assert.equal(plan.anchors[0].pointNormalized.yNorm, 0.5);
  const bridge = cutsceneModel.normalizeBridge({
    jointAction: {
      source: "test",
      anchors: plan.anchors,
      beats: [{ id: "impact", at: 15, pose: { rFoot: [1, 1] } }],
    },
  });
  assert.deepEqual(bridge.jointAction.anchors[0].point, { x: 150, y: 80 });
  delete globalThis.Animotion.imageBounds;
});

test("trajectory beat poses restore from source-image normalized points", () => {
  globalThis.Animotion.imageBounds = () => ({ width: 200, height: 160 });
  const bridge = cutsceneModel.normalizeBridge({
    jointAction: {
      source: "test",
      focusKey: "rFoot",
      beats: [{
        id: "impact",
        at: 15,
        pose: { rFoot: [10, 20] },
        poseNormalized: { rFoot: { xNorm: 0.75, yNorm: 0.5, coordinateSpace: "normalized-image" } },
      }],
    },
  });
  assert.deepEqual(bridge.jointAction.beats[0].pose.rFoot, [150, 80]);
  assert.equal(bridge.jointAction.beats[0].poseNormalized.rFoot.xNorm, 0.75);
  assert.equal(trajectoryEditor.editBeatPoint(bridge.jointAction, 0, "rFoot", { x: 100, y: 40 }), true);
  assert.equal(bridge.jointAction.beats[0].poseNormalized.rFoot.xNorm, 0.5);
  assert.equal(bridge.jointAction.beats[0].poseNormalized.rFoot.yNorm, 0.25);
  delete globalThis.Animotion.imageBounds;
});

test("motion planner preserves correspondence target source metadata", () => {
  const plan = motionPlanner.normalizePlan({
    template: "kick",
    target: { x: 80, y: 40 },
    targetSource: { type: "correspondence", correspondenceId: "corr-1", targetPartType: "foot", coordinateSpace: "sourceImage" },
  });
  assert.equal(plan.targetSource.type, "correspondence");
  assert.equal(plan.targetSource.correspondenceId, "corr-1");
  assert.equal(plan.targetSource.targetPartType, "foot");
});

test("motion planner treats missing target source as manual legacy data", () => {
  const plan = motionPlanner.normalizePlan({
    template: "kick",
    target: { x: 80, y: 40 },
    motionHints: null,
  });
  assert.equal(plan.targetSource.type, "manual");
  assert.equal(plan.motionDraft, null);
});

test("correspondence target policy protects manual targets", () => {
  const draft = { target: { x: 20, y: 30 } };
  assert.equal(motionTargetPolicy.correspondenceApplyPolicy({ target: null }, draft).allowed, true);
  assert.equal(motionTargetPolicy.correspondenceApplyPolicy({
    target: { x: 1, y: 2 },
    targetSource: { type: "correspondence" },
  }, draft).allowed, true);
  assert.equal(motionTargetPolicy.correspondenceApplyPolicy({
    target: { x: 1, y: 2 },
    targetSource: { type: "planner-default" },
  }, draft).allowed, true);
  assert.equal(motionTargetPolicy.correspondenceApplyPolicy({
    target: { x: 1, y: 2 },
    targetSource: { type: "manual" },
  }, draft).allowed, false);
});

test("motion planner carries correspondence hints into generated actions", () => {
  const bridge = cutsceneModel.normalizeBridge({ impactFrame: 15 });
  const plan = motionPlanner.createPlan(sampleParts(), "leg", bridge, {
    template: "kick",
    target: { x: 150, y: 70 },
    targetSource: { type: "correspondence", correspondenceId: "corr-1" },
    motionHints: { occlusion: "partial", depthOrder: "behind", hiddenCompletion: "required" },
  });
  assert.equal(plan.jointAction.motionHints.occlusion, "partial");
  assert.equal(plan.jointAction.motionHints.depthOrder, "behind");
  assert.equal(plan.jointAction.motionHints.hiddenCompletion, "required");
  assert.equal(plan.jointAction.motionDraft.draftScope, "action-snapshot");
  assert.equal(plan.jointAction.motionDraft.visibility.keyframes[1].value, 0.55);
  assert.equal(plan.jointAction.motionDraft.zOrder.keyframes[1].value, "behind");
  assert.equal(plan.jointAction.motionDraft.hiddenCompletion.needed, true);
  assert.equal(plan.jointAction.motionDraft.hiddenCompletion.assetStatus, "missing");
  assert.equal(plan.jointAction.motionDraft.hiddenCompletion.assetId, null);
  assert.equal(cutsceneModel.normalizeBridge({ jointAction: plan.jointAction }).jointAction.motionDraft.hiddenCompletion.status, "required");
  const primary = plan.jointAction.anchors.find((anchor) => anchor.role === "primary");
  assert.equal(primary.source, "correspondence");
  assert.equal(primary.motionHints.hiddenCompletion, "required");
});

test("motion panel mapper converts B impact coordinates into source coordinates", () => {
  const target = motionPanelMapper.panelPointToSourceTarget({ x: 60, y: 40 }, {
    view: { x: 0, y: 0, w: 200, h: 100 },
    sourceFrame: { x: 0, y: 0, w: 100, h: 50, sourceWidth: 100, sourceHeight: 50 },
    sourceTransform: { x: 0, y: 0, scale: 1 },
    impactFrame: { x: 20, y: 10, w: 80, h: 40, sourceWidth: 100, sourceHeight: 50 },
    impactTransform: { x: 10, y: -4, scale: 1 },
  });
  assert.deepEqual(target, { x: 55, y: 33 });
});

test("anchor picker is loaded after planner before trajectory editor", () => {
  const bootstrap = fs.readFileSync("scripts/bootstrap.js", "utf8");
  assert.equal(bootstrap.indexOf('"motion-hints"') < bootstrap.indexOf('"motion-planner"'), true);
  assert.equal(bootstrap.indexOf('"motion-target-policy"') < bootstrap.indexOf('"correspondence-editor"'), true);
  assert.equal(bootstrap.indexOf('"motion-target-debug"') < bootstrap.indexOf('"motion-planner"'), true);
  assert.equal(bootstrap.indexOf('"character-root-motion"') < bootstrap.indexOf('"motion-planner"'), true);
  assert.equal(bootstrap.indexOf('"motion-panel-mapper"') < bootstrap.indexOf('"motion-planner"'), true);
  assert.equal(bootstrap.indexOf('"motion-planner"') < bootstrap.indexOf('"motion-anchor-picker"'), true);
  assert.equal(bootstrap.indexOf('"motion-anchor-picker"') < bootstrap.indexOf('"motion-trajectory-editor"'), true);
});
