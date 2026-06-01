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
  const context = { window: { Animotion: { state: {} } } };
  vm.createContext(context);
  for (const path of [
    "scripts/config.js",
    "scripts/coordinate-spaces.js",
    "scripts/human-rig-schema.js",
    "scripts/motion-model.js",
    "scripts/motion-hints.js",
    "scripts/motion-drafts.js",
    "scripts/motion-target-state.js",
    "scripts/motion-target-debug.js",
    "scripts/pose-assist.js",
    "scripts/joint-coordinates.js",
    "scripts/cutscene-model.js",
    "scripts/motion-anchors.js",
    "scripts/action-specs.js",
    "scripts/action-timeline-model.js",
    "scripts/motion-track-builder.js",
    "scripts/boxing-step-locomotion.js",
    "scripts/motion-planner.js",
  ]) runScript(context, path);
  return context.window.Animotion;
}

function runScript(context, path) {
  vm.runInContext(fs.readFileSync(path, "utf8"), context, { filename: path });
}

test("punch timeline normalizes required beats and metadata", () => {
  const model = loadAnimotion().actionTimelineModel;
  const timeline = model.timelineForTemplate("punch", { durationFrames: 36, impactFrame: 24 });
  assert.deepEqual(ids(timeline), ["guard", "windup", "drive", "extension", "impact", "recover"]);
  assert.equal(timeline.durationFrames, 36);
  assert.equal(timeline.impactFrame, 24);
  assert.equal(timeline.primaryPartRole, "forearm");
  assert.equal(timeline.rootMotionHint.motionScope, "body-follow");
  assert.equal(timeline.beats.find((beat) => beat.id === "impact").at, 24);
  assert.equal(timeline.beats.find((beat) => beat.id === "recover").at, 36);
});

test("kick timeline normalizes required beats and clamps frames", () => {
  const model = loadAnimotion().actionTimelineModel;
  const timeline = model.timelineForTemplate("kick", { durationFrames: 12, impactFrame: 40 });
  assert.deepEqual(ids(timeline), ["ready", "compress", "chamber", "extend", "impact", "recover"]);
  assert.equal(timeline.impactFrame, 12);
  assert.equal(timeline.primaryPartRole, "shin");
  assert.equal(timeline.beats.find((beat) => beat.id === "impact").at, 12);
});

test("motion planner reads punch and kick beats from action timeline model", () => {
  const Animotion = loadAnimotion();
  const bridge = Animotion.cutsceneModel.normalizeBridge({ durationFrames: 36, impactFrame: 24 });
  const punch = Animotion.motionPlanner.createPlan(sampleParts(), "arm", bridge, { template: "punch", target: { x: 160, y: 30 } });
  const kick = Animotion.motionPlanner.createPlan(sampleParts(), "leg", bridge, { template: "kick", target: { x: 160, y: 70 } });
  assert.deepEqual(ids(punch.jointAction), ["guard", "windup", "drive", "extension", "impact", "recover"]);
  assert.deepEqual(ids(kick.jointAction), ["ready", "compress", "chamber", "extend", "impact", "recover"]);
  assert.equal(punch.jointAction.actionTimeline.primaryPartRole, "forearm");
  assert.equal(kick.jointAction.actionTimeline.primaryPartRole, "shin");
  assert.equal(punch.jointAction.beats.find((beat) => beat.id === "impact").at, 24);
  assert.equal(punch.jointAction.beats.find((beat) => beat.id === "recover").at, 36);
});

test("punch has distinct windup drive impact and recover transforms with body follow", () => {
  const Animotion = loadAnimotion();
  const bridge = Animotion.cutsceneModel.normalizeBridge({ durationFrames: 36, impactFrame: 24 });
  const plan = Animotion.motionPlanner.createPlan(sampleParts(), "arm", bridge, { template: "punch", target: { x: 160, y: 30 } });
  const beats = beatMap(plan.jointAction);
  assert.equal(beats.windup.at < beats.drive.at && beats.drive.at < beats.impact.at && beats.impact.at < beats.recover.at, true);
  assert.notDeepEqual(beats.windup.pose.rHand, beats.drive.pose.rHand);
  assert.notDeepEqual(beats.drive.pose.rHand, beats.impact.pose.rHand);
  assert.notDeepEqual(beats.impact.pose.rHand, beats.recover.pose.rHand);
  assert.equal(Math.abs(bodyPoseAt(plan, "body", beats.impact.at).x) > 0, true);
});

test("front hand punch keeps the existing jab motion", () => {
  const Animotion = loadAnimotion();
  const bridge = Animotion.cutsceneModel.normalizeBridge({ durationFrames: 36, impactFrame: 24 });
  const plan = Animotion.motionPlanner.createPlan(boxingParts(), "front_forearm", bridge, { template: "punch", target: { x: 160, y: 30 } });
  const impact = beatMap(plan.jointAction).impact;
  const primary = bodyPoseAt(plan, "front_forearm", impact.at);
  const body = bodyPoseAt(plan, "body", impact.at);
  assert.equal(plan.jointAction.targetDebug.punchStyle, "jab");
  assert.equal(impact.pose.rHand[0], 160);
  assert.equal(impact.pose.rHand[1], 30);
  assert.equal(primary.jointX, 80);
  assert.equal(primary.jointY, -22);
  assert.equal(body.x, 9);
});

test("rear hand punch stays a punch while the hand drives toward impact", () => {
  const Animotion = loadAnimotion();
  const bridge = Animotion.cutsceneModel.normalizeBridge({ durationFrames: 36, impactFrame: 24 });
  const parts = boxingParts();
  const base = Animotion.jointCoordinates.inferJointPose(parts);
  const plan = Animotion.motionPlanner.createPlan(parts, "back_forearm", bridge, { template: "punch", target: { x: 160, y: 30 } });
  const beats = beatMap(plan.jointAction);
  assert.equal(plan.jointAction.actionTimeline.template, "punch");
  assert.equal(plan.jointAction.targetDebug.punchStyle, "rear-cross");
  assert.equal(beats.impact.pose.lHand[0], 160);
  assert.equal(beats.impact.pose.lHand[1], 30);
  assert.equal(beats.impact.pose.lHand[0] > base.lHand[0], true);
});

test("rear hand punch does not send the hand forward during windup", () => {
  const Animotion = loadAnimotion();
  const bridge = Animotion.cutsceneModel.normalizeBridge({ durationFrames: 36, impactFrame: 24 });
  const parts = boxingParts();
  const base = Animotion.jointCoordinates.inferJointPose(parts);
  const plan = Animotion.motionPlanner.createPlan(parts, "back_forearm", bridge, { template: "punch", target: { x: 160, y: 30 } });
  const windup = beatMap(plan.jointAction).windup;
  assert.equal(windup.pose.lHand[0] <= base.lHand[0], true);
});

test("rear hand punch keeps elbow support smaller than hand drive and adds stronger body follow", () => {
  const Animotion = loadAnimotion();
  const bridge = Animotion.cutsceneModel.normalizeBridge({ durationFrames: 36, impactFrame: 24 });
  const parts = boxingParts();
  const base = Animotion.jointCoordinates.inferJointPose(parts);
  const front = Animotion.motionPlanner.createPlan(parts, "front_forearm", bridge, { template: "punch", target: { x: 160, y: 30 } });
  const rear = Animotion.motionPlanner.createPlan(parts, "back_forearm", bridge, { template: "punch", target: { x: 160, y: 30 } });
  const rearImpact = beatMap(rear.jointAction).impact;
  const handMove = distance(base.lHand, rearImpact.pose.lHand);
  const elbowMove = distance(base.lElbow, rearImpact.pose.lElbow);
  assert.equal(elbowMove < handMove * 0.55, true);
  assert.equal(Math.abs(bodyPoseAt(rear, "body", 24).x) > Math.abs(bodyPoseAt(front, "body", 24).x), true);
});

test("geometry fallback treats unnamed rear arm as rear-hand punch on regeneration", () => {
  const Animotion = loadAnimotion();
  const bridge = Animotion.cutsceneModel.normalizeBridge({ durationFrames: 36, impactFrame: 24 });
  const parts = numberedBoxingParts();
  const base = Animotion.jointCoordinates.inferJointPose(parts);
  const front = Animotion.motionPlanner.createPlan(parts, "arm_02", bridge, { template: "punch", target: { x: 160, y: 30 } });
  const rear = Animotion.motionPlanner.createPlan(parts, "arm_01", bridge, { template: "punch", target: { x: 160, y: 30 } });
  const rearBeats = beatMap(rear.jointAction);
  const handMove = distance(base.lHand, rearBeats.impact.pose.lHand);
  const elbowMove = distance(base.lElbow, rearBeats.impact.pose.lElbow);
  assert.equal(rear.jointAction.actionTimeline.template, "punch");
  assert.equal(rearBeats.windup.pose.lHand[0] <= base.lHand[0], true);
  assert.equal(rearBeats.impact.pose.lHand[0], 160);
  assert.equal(elbowMove < handMove * 0.55, true);
  assert.equal(Math.abs(bodyPoseAt(rear, "body", 24).x) > Math.abs(bodyPoseAt(front, "body", 24).x), true);
});

test("rear-cross auto target is pushed beyond face bounds instead of landing near the chin", () => {
  const Animotion = loadAnimotion();
  const bridge = Animotion.cutsceneModel.normalizeBridge({ durationFrames: 36, impactFrame: 24, effectDirection: { x: 1, y: 0 } });
  const parts = videoLikeRearCrossParts();
  const plan = Animotion.motionPlanner.createPlan(parts, "arm_01", bridge, { template: "punch" });
  const target = plan.jointAction.targetDebug.convertedTarget;
  const head = parts.find((part) => part.id === "head_01").rect;

  assert.equal(plan.jointAction.targetDebug.punchStyle, "rear-cross");
  assert.equal(target.x > head.x + head.w + 20, true);
  assert.equal(pointInsideRect(target, head), false);
});

test("front jab auto target keeps the existing hand-tip offset behavior", () => {
  const Animotion = loadAnimotion();
  const bridge = Animotion.cutsceneModel.normalizeBridge({ durationFrames: 36, impactFrame: 24, effectDirection: { x: 1, y: 0 } });
  const parts = videoLikeRearCrossParts();
  const base = Animotion.jointCoordinates.inferJointPose(parts);
  const plan = Animotion.motionPlanner.createPlan(parts, "arm_02", bridge, { template: "punch" });
  const target = plan.jointAction.targetDebug.convertedTarget;

  assert.equal(plan.jointAction.targetDebug.punchStyle, "jab");
  assert.equal(Math.round(target.x), Math.round(base.rHand[0] + 120));
  assert.equal(Math.round(target.y), Math.round(base.rHand[1]));
});

test("kick has chamber extend impact and recover transforms with body follow", () => {
  const Animotion = loadAnimotion();
  const bridge = Animotion.cutsceneModel.normalizeBridge({ durationFrames: 36, impactFrame: 24 });
  const plan = Animotion.motionPlanner.createPlan(sampleParts(), "leg", bridge, { template: "kick", target: { x: 160, y: 70 } });
  const beats = beatMap(plan.jointAction);
  assert.equal(beats.chamber.at < beats.extend.at && beats.extend.at < beats.impact.at && beats.impact.at < beats.recover.at, true);
  assert.notDeepEqual(beats.chamber.pose.rFoot, beats.extend.pose.rFoot);
  assert.notDeepEqual(beats.extend.pose.rFoot, beats.impact.pose.rFoot);
  assert.notDeepEqual(beats.impact.pose.rFoot, beats.recover.pose.rFoot);
  assert.equal(Math.hypot(bodyPoseAt(plan, "body", beats.impact.at).x, bodyPoseAt(plan, "body", beats.impact.at).y) > 0, true);
});

test("humanRole metadata can identify punch and kick body root participation", () => {
  const Animotion = loadAnimotion();
  const bridge = Animotion.cutsceneModel.normalizeBridge({ durationFrames: 36, impactFrame: 24 });
  const parts = roleOnlyParts();
  const punch = Animotion.motionPlanner.createPlan(parts, "right-forearm", bridge, { template: "punch", target: { x: 160, y: 30 } });
  const kick = Animotion.motionPlanner.createPlan(parts, "right-shin", bridge, { template: "kick", target: { x: 160, y: 70 } });
  assert.equal(punch.jointAction.focusKey, "rHand");
  assert.equal(kick.jointAction.focusKey, "rFoot");
  assert.equal(Math.abs(bodyPoseAt(punch, "torso", 24).x) > 0, true);
  assert.equal(Math.hypot(bodyPoseAt(kick, "torso", 24).x, bodyPoseAt(kick, "torso", 24).y) > 0, true);
});

test("missing optional humanRole parts do not crash punch or kick generation", () => {
  const Animotion = loadAnimotion();
  const bridge = Animotion.cutsceneModel.normalizeBridge({ durationFrames: 36, impactFrame: 24 });
  const sparse = sampleParts().map(({ humanRole, ...part }) => part).filter((part) => part.id !== "head");
  const punch = Animotion.motionPlanner.createPlan(sparse, "arm", bridge, { template: "punch", target: { x: 160, y: 30 } });
  const kick = Animotion.motionPlanner.createPlan(sparse, "leg", bridge, { template: "kick", target: { x: 160, y: 70 } });
  assert.equal(punch.jointAction.beats.find((beat) => beat.id === "impact").at, 24);
  assert.equal(kick.jointAction.beats.find((beat) => beat.id === "impact").at, 24);
});

test("legacy punch and kick template strings still normalize", () => {
  const Animotion = loadAnimotion();
  assert.equal(Animotion.motionPlanner.normalizePlan({ template: "punch" }).template, "punch");
  assert.equal(Animotion.motionPlanner.normalizePlan({ template: "kick" }).template, "kick");
  assert.equal(Animotion.motionPlanner.normalizePlan({ template: "unknown" }).template, "kick");
});

function sampleParts() {
  return [
    { id: "body", type: "body", humanRole: "torso", rect: { x: 40, y: 20, w: 20, h: 50 }, pivot: { x: 10, y: 25 }, joint: { x: 10, y: 40 } },
    { id: "head", type: "head", humanRole: "head", rect: { x: 38, y: 4, w: 24, h: 20 }, pivot: { x: 12, y: 10 }, joint: { x: 12, y: 16 } },
    { id: "arm", type: "arm", humanRole: "forearm", rect: { x: 64, y: 28, w: 18, h: 32 }, pivot: { x: 2, y: 6 }, joint: { x: 16, y: 24 } },
    { id: "leg", type: "leg", humanRole: "shin", rect: { x: 67, y: 60, w: 18, h: 45 }, pivot: { x: 2, y: 6 }, joint: { x: 16, y: 40 } },
  ];
}

function roleOnlyParts() {
  return [
    { id: "torso", type: "prop", humanRole: "torso", rect: { x: 40, y: 20, w: 20, h: 50 }, pivot: { x: 10, y: 25 }, joint: { x: 10, y: 40 } },
    { id: "head", type: "prop", humanRole: "head", rect: { x: 38, y: 4, w: 24, h: 20 }, pivot: { x: 12, y: 10 }, joint: { x: 12, y: 16 } },
    { id: "right-forearm", type: "prop", humanRole: "forearm", rect: { x: 64, y: 28, w: 18, h: 32 }, pivot: { x: 2, y: 6 }, joint: { x: 16, y: 24 } },
    { id: "right-shin", type: "prop", humanRole: "shin", rect: { x: 67, y: 60, w: 18, h: 45 }, pivot: { x: 2, y: 6 }, joint: { x: 16, y: 40 } },
  ];
}

function boxingParts() {
  return [
    { id: "body", type: "body", humanRole: "torso", rect: { x: 40, y: 20, w: 20, h: 50 }, pivot: { x: 10, y: 25 }, joint: { x: 10, y: 40 } },
    { id: "head", type: "head", humanRole: "head", rect: { x: 38, y: 4, w: 24, h: 20 }, pivot: { x: 12, y: 10 }, joint: { x: 12, y: 16 } },
    { id: "back_forearm", name: "back forearm", type: "arm", humanRole: "forearm", rect: { x: 16, y: 28, w: 18, h: 32 }, pivot: { x: 16, y: 6 }, joint: { x: 2, y: 24 } },
    { id: "front_forearm", name: "front forearm", type: "arm", humanRole: "forearm", rect: { x: 64, y: 28, w: 18, h: 32 }, pivot: { x: 2, y: 6 }, joint: { x: 16, y: 24 } },
  ];
}

function numberedBoxingParts() {
  return [
    { id: "body", type: "body", humanRole: "torso", rect: { x: 40, y: 20, w: 20, h: 50 }, pivot: { x: 10, y: 25 }, joint: { x: 10, y: 40 } },
    { id: "head", type: "head", humanRole: "head", rect: { x: 38, y: 4, w: 24, h: 20 }, pivot: { x: 12, y: 10 }, joint: { x: 12, y: 16 } },
    { id: "arm_01", name: "arm_01", type: "arm", humanRole: "forearm", rect: { x: 16, y: 28, w: 18, h: 32 }, pivot: { x: 16, y: 6 }, joint: { x: 2, y: 24 } },
    { id: "arm_02", name: "arm_02", type: "arm", humanRole: "forearm", rect: { x: 64, y: 28, w: 18, h: 32 }, pivot: { x: 2, y: 6 }, joint: { x: 16, y: 24 } },
  ];
}

function videoLikeRearCrossParts() {
  return [
    { id: "body", type: "body", humanRole: "torso", rect: { x: 455, y: 255, w: 80, h: 260 }, pivot: { x: 40, y: 60 }, joint: { x: 40, y: 205 } },
    { id: "head_01", name: "head_01", type: "head", humanRole: "head", rect: { x: 500, y: 145, w: 130, h: 150 }, pivot: { x: 65, y: 75 }, joint: { x: 65, y: 125 } },
    { id: "arm_01", name: "arm_01", type: "arm", humanRole: "forearm", rect: { x: 360, y: 265, w: 92, h: 126 }, pivot: { x: 78, y: 18 }, joint: { x: 48, y: 54 }, handTip: { x: 70, y: 42 } },
    { id: "arm_02", name: "arm_02", type: "arm", humanRole: "forearm", rect: { x: 610, y: 270, w: 92, h: 126 }, pivot: { x: 14, y: 18 }, joint: { x: 48, y: 54 }, handTip: { x: 82, y: 42 } },
  ];
}

function ids(timeline) {
  return JSON.parse(JSON.stringify(timeline.beats.map((beat) => beat.id)));
}

function beatMap(action) {
  return Object.fromEntries(action.beats.map((beat) => [beat.id, beat]));
}

function bodyPoseAt(plan, partId, frame) {
  return plan.partTracks.find((track) => track.partId === partId).keyframes.find((keyframe) => keyframe.frame === frame).pose;
}

function distance(a, b) {
  return Math.hypot(Number(b[0]) - Number(a[0]), Number(b[1]) - Number(a[1]));
}

function pointInsideRect(point, rect) {
  return point.x >= rect.x && point.x <= rect.x + rect.w && point.y >= rect.y && point.y <= rect.y + rect.h;
}
