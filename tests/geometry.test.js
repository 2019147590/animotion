const assert = require("node:assert/strict");
const fs = require("node:fs");
const geometry = require("../scripts/geometry.js");
globalThis.Animotion.state = { panelSetup: {}, panelEditTarget: "source" };
const panelEditor = require("../scripts/panel-editor.js");
const rigging = require("../scripts/rigging.js");
const motionModel = require("../scripts/motion-model.js");
const jointCoordinates = require("../scripts/joint-coordinates.js");
const cutsceneModel = require("../scripts/cutscene-model.js");
const poseAssist = require("../scripts/pose-assist.js");
const timeline = require("../scripts/timeline.js");
const motionPlanner = require("../scripts/motion-planner.js");
const trajectoryEditor = require("../scripts/motion-trajectory-editor.js");
const cutsceneEffects = require("../scripts/cutscene-effects.js");
const previewTransform = require("../scripts/preview-transform.js");

function test(name, fn) {
  try {
    fn();
    console.log(`PASS ${name}`);
  } catch (error) {
    console.error(`FAIL ${name}`);
    throw error;
  }
}

const imageBounds = { width: 100, height: 80 };

test("B cut reference opacity control is wired into the app shell", () => {
  const html = fs.readFileSync("index.html", "utf8");
  const config = fs.readFileSync("scripts/config.js", "utf8");
  assert.equal(html.includes('id="impactReferenceOpacity"'), true);
  assert.equal(config.includes('impactReferenceOpacity: "#impactReferenceOpacity"'), true);
});

test("editing reference layers are hidden during playback and export", () => {
  const preview = fs.readFileSync("scripts/preview.js", "utf8");
  const trajectory = fs.readFileSync("scripts/motion-trajectory-editor.js", "utf8");
  assert.equal(preview.includes("state.nextImage && editingLayerVisible()"), true);
  assert.equal(preview.includes("return !state.running && !state.exporting"), true);
  assert.equal(trajectory.includes("if (!editingLayerVisible()) return"), true);
});

test("rectShape creates four closed corner points", () => {
  const shape = geometry.rectShape({ x: 10, y: 20, w: 30, h: 40 });
  assert.equal(shape.closed, true);
  assert.deepEqual(shape.points, [
    { x: 10, y: 20 },
    { x: 40, y: 20 },
    { x: 40, y: 60 },
    { x: 10, y: 60 },
  ]);
});

test("pointsBounds clamps points to image bounds", () => {
  const bounds = geometry.pointsBounds([
    { x: -5, y: -2 },
    { x: 120, y: 90 },
  ], imageBounds);
  assert.deepEqual(bounds, { x: 0, y: 0, w: 100, h: 80 });
});

test("shapeIsReady rejects open or too-small shapes", () => {
  const openShape = { kind: "polygon", closed: false, points: [{ x: 0, y: 0 }, { x: 5, y: 0 }, { x: 5, y: 5 }] };
  const tinyShape = { kind: "polygon", closed: true, points: [{ x: 0, y: 0 }, { x: 2, y: 0 }, { x: 2, y: 2 }] };
  assert.equal(geometry.shapeIsReady(openShape, imageBounds, 4), false);
  assert.equal(geometry.shapeIsReady(tinyShape, imageBounds, 4), false);
});

test("shapeToMask converts image points into part-local points", () => {
  const shape = geometry.rectShape({ x: 10, y: 12, w: 20, h: 10 });
  const mask = geometry.shapeToMask(shape, { x: 10, y: 12, w: 20, h: 10 });
  assert.deepEqual(mask.points[0], { x: 0, y: 0 });
  assert.deepEqual(mask.points[2], { x: 20, y: 10 });
});

test("panel editor normalizes saved crop and character mask data", () => {
  const panel = panelEditor.normalizePanel({
    crop: { x: "3.4", y: 2, w: "40.6", h: 20 },
    characterMask: { kind: "polygon", points: [{ x: "1", y: 2 }, { x: 4, y: "5" }] },
  });
  assert.deepEqual(panel.crop, { x: 3, y: 2, w: 41, h: 20 });
  assert.equal(panel.characterMask.closed, true);
  assert.deepEqual(panel.characterMask.points[1], { x: 4, y: 5 });
});

test("panel renderer keeps cropped panels scaled relative to the source image", () => {
  const image = {
    width: 40,
    height: 20,
    animotionPanel: { sourceWidth: 100, sourceHeight: 80 },
  };
  const rect = cutsceneEffects.fittedPanelRect(image, { w: 200, h: 160 }, 0.5);
  assert.deepEqual(rect, { w: 40, h: 20 });
});

test("preview source transform applies panel scale to rig coordinates", () => {
  const frame = { x: 10, y: 5, w: 40, h: 20, sourceWidth: 100, sourceHeight: 80 };
  const scale = previewTransform.sourceScale({ w: 200, h: 160 }, frame, { scale: 0.5 });
  assert.equal(scale, 1);
});

test("arm pivot moves to the shoulder side closest to the body", () => {
  const body = { x: 40, y: 20, w: 20, h: 50 };
  const leftArm = { x: 15, y: 25, w: 18, h: 45 };
  const rightArm = { x: 67, y: 25, w: 18, h: 45 };
  assert.deepEqual(rigging.defaultPivotForPart("arm", leftArm, body), { x: 15.84, y: 6.300000000000001 });
  assert.deepEqual(rigging.defaultPivotForPart("arm", rightArm, body), { x: 2.16, y: 6.300000000000001 });
});

test("leg pivot moves to the hip side closest to the body", () => {
  const body = { x: 40, y: 20, w: 20, h: 50 };
  const leftLeg = { x: 36, y: 68, w: 12, h: 38 };
  const rightLeg = { x: 52, y: 68, w: 12, h: 38 };
  assert.deepEqual(rigging.defaultPivotForPart("leg", leftLeg, body), { x: 10.56, y: 3.04 });
  assert.deepEqual(rigging.defaultPivotForPart("leg", rightLeg, body), { x: 1.44, y: 3.04 });
});

test("limb joint defaults to the opposite movable side", () => {
  const body = { x: 40, y: 20, w: 20, h: 50 };
  const leftArm = { x: 15, y: 25, w: 18, h: 45 };
  const rightLeg = { x: 52, y: 68, w: 12, h: 38 };
  assert.deepEqual(rigging.defaultJointForPart("arm", leftArm, body), { x: 2.16, y: 30.6 });
  assert.deepEqual(rigging.defaultJointForPart("leg", rightLeg, body), { x: 10.56, y: 33.44 });
});

test("localPointFromImagePoint preserves rig handles outside the part rect", () => {
  const rect = { x: 20, y: 30, w: 50, h: 60 };
  assert.deepEqual(rigging.localPointFromImagePoint(rect, { x: 45, y: 70 }), { x: 25, y: 40 });
  assert.deepEqual(rigging.localPointFromImagePoint(rect, { x: 10, y: 120 }), { x: -10, y: 90 });
});

test("custom motion returns user-authored sinusoidal transform", () => {
  const settings = { x: 10, y: -5, rotate: 20, scaleY: 0.1, jointX: 7, jointY: -3, phase: 0 };
  const motion = motionModel.customMotionForPart(settings, 0.25, 1);
  assert.equal(Math.round(motion.x), 10);
  assert.equal(Math.round(motion.y), -5);
  assert.equal(Math.round(motion.rotate), 20);
  assert.equal(Number(motion.scaleY.toFixed(2)), 1.1);
  assert.equal(Math.round(motion.jointX), 7);
  assert.equal(Math.round(motion.jointY), -3);
});

test("timeline interpolates keyframes like a simple graph editor", () => {
  const part = {
    keyframes: [
      { frame: 1, pose: { x: 0, rotate: 0 } },
      { frame: 11, pose: { x: 20, rotate: 10 } },
    ],
  };
  const pose = timeline.evaluatePartAtFrame(part, 6);
  assert.equal(pose.x, 10);
  assert.equal(pose.rotate, 5);
});

test("timeline keyframe helpers return new arrays without mutating parts", () => {
  const part = {
    keyframes: [
      { frame: 10, pose: { x: 20 } },
      { frame: 1, pose: { x: 0 } },
    ],
  };
  const inserted = timeline.upsertedKeyframes(part, 5, { x: 8 });
  const deleted = timeline.deletedKeyframes(part, 10);
  assert.deepEqual(part.keyframes.map((keyframe) => keyframe.frame), [10, 1]);
  assert.deepEqual(inserted.map((keyframe) => keyframe.frame), [1, 5, 10]);
  assert.deepEqual(deleted.map((keyframe) => keyframe.frame), [1]);
});

test("pose assist treats the uploaded cut as impact and builds anticipation", () => {
  const parts = [
    { id: "body", type: "body", rect: { x: 40, y: 20, w: 20, h: 50 } },
    { id: "arm", type: "arm", rect: { x: 67, y: 25, w: 18, h: 45 } },
  ];
  const result = poseAssist.generateAnticipation(parts, "arm", 18, 120);
  const armTrack = result.tracks.find((track) => track.partId === "arm");
  assert.equal(result.impactFrame, 18);
  assert.equal(armTrack.keyframes.find((keyframe) => keyframe.frame === 18).pose.rotate, 0);
  assert.equal(armTrack.keyframes.find((keyframe) => keyframe.frame === 11).pose.rotate, 22);
});

test("control rig drag propagates a limb pull into spine and head poses", () => {
  const parts = [
    { id: "spine", type: "spine", rect: { x: 40, y: 20, w: 20, h: 50 } },
    { id: "head", type: "head", rect: { x: 38, y: 4, w: 24, h: 20 } },
    { id: "arm", type: "arm", rect: { x: 67, y: 25, w: 18, h: 45 } },
  ];
  const tracks = poseAssist.solveControlPose(parts, "arm", { x: 40, y: 10 });
  const spine = tracks.find((track) => track.partId === "spine").pose;
  const head = tracks.find((track) => track.partId === "head").pose;
  const arm = tracks.find((track) => track.partId === "arm").pose;
  assert.equal(arm.jointX, 40);
  assert.equal(spine.rotate, 4.8);
  assert.equal(head.rotate, -2);
});

test("control rig drag keeps large selected joint pulls unclamped", () => {
  const parts = [
    { id: "spine", type: "spine", rect: { x: 40, y: 20, w: 20, h: 50 } },
    { id: "arm", type: "arm", rect: { x: 67, y: 25, w: 18, h: 45 } },
  ];
  const tracks = poseAssist.solveControlPose(parts, "arm", { x: 140, y: -120 });
  const arm = tracks.find((track) => track.partId === "arm").pose;
  assert.equal(arm.jointX, 140);
  assert.equal(arm.jointY, -120);
});

test("cutscene bridge infers direction from the primary part side", () => {
  const parts = [
    { id: "body", type: "body", rect: { x: 40, y: 20, w: 20, h: 50 } },
    { id: "leg", type: "leg", rect: { x: 70, y: 55, w: 15, h: 35 } },
  ];
  const bridge = cutsceneModel.createBridge(parts, "leg");
  assert.equal(bridge.primaryPartId, "leg");
  assert.equal(bridge.effectDirection.x > 0, true);
  assert.equal(bridge.effectDirection.y < 0, true);
});

test("cutscene values snap into impact near the configured impact frame", () => {
  const bridge = cutsceneModel.normalizeBridge({ durationFrames: 18, impactFrame: 15, effectStrength: 1 });
  const before = cutsceneModel.bridgeValues(13 / 24, bridge, 24);
  const after = cutsceneModel.bridgeValues(16 / 24, bridge, 24);
  assert.equal(before.impactAlpha < after.impactAlpha, true);
  assert.equal(after.flashAlpha > 0, true);
  assert.equal(after.finalSnap > before.finalSnap, true);
});

test("cutscene values move source toward the positioned impact panel", () => {
  const bridge = cutsceneModel.normalizeBridge({ sourceX: -80, sourceY: 20, impactX: 120, impactY: -40, impactFrame: 15 });
  const early = cutsceneModel.bridgeValues(1 / 24, bridge, 24);
  const late = cutsceneModel.bridgeValues(17 / 24, bridge, 24);
  assert.equal(early.sourceAlpha > late.sourceAlpha, true);
  assert.equal(late.sourceX > early.sourceX, true);
  assert.equal(late.sourceY < early.sourceY, true);
  assert.equal(Math.round(late.impactX), 120);
});

test("cutscene bridge keeps pre-load panel scale when it was changed", () => {
  const loaded = { primaryPartId: "leg", sourceScale: 1, impactFrame: 12 };
  const current = { sourceScale: 0.5, sourceX: -40 };
  const bridge = cutsceneModel.mergePanelTransform(loaded, current);
  assert.equal(bridge.primaryPartId, "leg");
  assert.equal(bridge.impactFrame, 12);
  assert.equal(bridge.sourceScale, 0.5);
  assert.equal(bridge.sourceX, -40);
});

test("cutscene bridge keeps loaded panel scale when pre-load controls are default", () => {
  const loaded = { sourceScale: 0.65, sourceX: -30 };
  const current = { sourceScale: 1, sourceX: 0 };
  const bridge = cutsceneModel.mergePanelTransform(loaded, current);
  assert.equal(bridge.sourceScale, 0.65);
  assert.equal(bridge.sourceX, -30);
});

test("joint coordinates hard-code lookism-style pose keys from pivots", () => {
  const parts = [
    { id: "body", type: "body", rect: { x: 40, y: 20, w: 20, h: 50 }, pivot: { x: 10, y: 25 }, joint: { x: 10, y: 40 } },
    { id: "arm", type: "arm", rect: { x: 67, y: 25, w: 18, h: 45 }, pivot: { x: 2, y: 6 }, joint: { x: 16, y: 32 } },
  ];
  const pose = jointCoordinates.inferJointPose(parts);
  assert.deepEqual(pose.chest, [50, 29]);
  assert.deepEqual(pose.rShoulder, [69, 31]);
  assert.deepEqual(pose.rHand, [83, 57]);
});

test("cutscene bridge stores generated joint action beats", () => {
  const parts = [
    { id: "body", type: "body", rect: { x: 40, y: 20, w: 20, h: 50 }, pivot: { x: 10, y: 25 }, joint: { x: 10, y: 40 } },
    { id: "leg", type: "leg", rect: { x: 67, y: 60, w: 18, h: 45 }, pivot: { x: 2, y: 6 }, joint: { x: 16, y: 40 } },
  ];
  const bridge = cutsceneModel.createBridge(parts, "leg");
  assert.equal(bridge.jointAction.source, "part-pivots-v1");
  assert.equal(bridge.jointAction.beats.some((beat) => beat.pose.rFoot), true);
});

test("motion planner creates target-driven beat poses and active part tracks", () => {
  const parts = [
    { id: "body", type: "body", rect: { x: 40, y: 20, w: 20, h: 50 }, pivot: { x: 10, y: 25 }, joint: { x: 10, y: 40 } },
    { id: "leg", type: "leg", rect: { x: 67, y: 60, w: 18, h: 45 }, pivot: { x: 2, y: 6 }, joint: { x: 16, y: 40 } },
  ];
  const bridge = cutsceneModel.normalizeBridge({ impactFrame: 15 });
  const plan = motionPlanner.createPlan(parts, "leg", bridge, { template: "kick", target: { x: 140, y: 40 } });
  const impact = plan.jointAction.beats.find((beat) => beat.id === "impact");
  const legTrack = plan.partTracks.find((track) => track.partId === "leg");
  assert.equal(plan.jointAction.focusKey, "rFoot");
  assert.deepEqual(impact.pose.rFoot, [140, 40]);
  assert.equal(legTrack.keyframes.some((keyframe) => keyframe.pose.jointX !== 0), true);
});

test("cutscene bridge preserves the editable motion focus key", () => {
  const bridge = cutsceneModel.normalizeBridge({
    jointAction: {
      source: "motion-planner-kick-v1",
      focusKey: "rFoot",
      beats: [{ id: "impact", at: 15, pose: { rFoot: [140, 40] } }],
    },
  });
  assert.equal(bridge.jointAction.focusKey, "rFoot");
});

test("trajectory edits update a beat point and regenerate primary part keyframes", () => {
  const parts = [
    { id: "body", type: "body", rect: { x: 40, y: 20, w: 20, h: 50 }, pivot: { x: 10, y: 25 }, joint: { x: 10, y: 40 } },
    { id: "leg", type: "leg", rect: { x: 67, y: 60, w: 18, h: 45 }, pivot: { x: 2, y: 6 }, joint: { x: 16, y: 40 } },
  ];
  const bridge = cutsceneModel.normalizeBridge({ impactFrame: 15 });
  const plan = motionPlanner.createPlan(parts, "leg", bridge, { template: "kick", target: { x: 140, y: 40 } });
  const impactIndex = plan.jointAction.beats.findIndex((beat) => beat.id === "impact");
  const edited = trajectoryEditor.editBeatPoint(plan.jointAction, impactIndex, "rFoot", { x: 164, y: 52 });
  const track = motionPlanner.tracksForJointAction(parts, "leg", plan.jointAction).find((candidate) => candidate.partId === "leg");
  const impactKeyframe = track.keyframes.find((keyframe) => keyframe.frame === 15);
  assert.equal(edited, true);
  assert.deepEqual(plan.jointAction.beats[impactIndex].pose.rFoot, [164, 52]);
  assert.deepEqual({ x: impactKeyframe.pose.jointX, y: impactKeyframe.pose.jointY }, { x: 81, y: -48 });
});
