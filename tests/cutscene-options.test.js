const assert = require("node:assert/strict");
const fs = require("node:fs");

require("../scripts/motion-model.js");
require("../scripts/pose-assist.js");
require("../scripts/joint-coordinates.js");
require("../scripts/motion-anchors.js");
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

test("anchor picker is loaded after planner before trajectory editor", () => {
  const bootstrap = fs.readFileSync("scripts/bootstrap.js", "utf8");
  assert.equal(bootstrap.indexOf('"motion-planner"') < bootstrap.indexOf('"motion-anchor-picker"'), true);
  assert.equal(bootstrap.indexOf('"motion-anchor-picker"') < bootstrap.indexOf('"motion-trajectory-editor"'), true);
});
