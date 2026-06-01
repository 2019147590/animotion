const assert = require("node:assert/strict");
const fs = require("node:fs");

require("../scripts/coordinate-spaces.js");
const targetState = require("../scripts/motion-target-state.js");
const targetPolicy = require("../scripts/motion-target-policy.js");
require("../scripts/motion-target-debug.js");
require("../scripts/motion-model.js");
require("../scripts/timeline.js");
require("../scripts/motion-hints.js");
require("../scripts/motion-drafts.js");
require("../scripts/pose-assist.js");
require("../scripts/joint-coordinates.js");
require("../scripts/motion-anchors.js");
require("../scripts/cutscene-model.js");
const characterRootMotion = require("../scripts/character-root-motion.js");
require("../scripts/action-specs.js");
require("../scripts/motion-track-builder.js");
require("../scripts/boxing-step-locomotion.js");
const motionPlanner = require("../scripts/motion-planner.js");
const trajectoryEditor = require("../scripts/motion-trajectory-editor.js");

function test(name, fn) {
  try {
    fn();
    console.log(`PASS ${name}`);
  } catch (error) {
    console.error(`FAIL ${name}`);
    throw error;
  }
}

test("manual target overrides correspondence only when explicitly active", () => {
  const plan = motionPlanner.normalizePlan({
    target: { x: 30, y: 40 },
    targetSource: { type: "manual" },
    correspondenceAnchor: correspondenceAnchor(),
  });
  const policy = targetPolicy.correspondenceApplyPolicy(plan, correspondenceDraft());
  assert.equal(plan.activeMotionTarget.source, "manual");
  assert.equal(policy.allowed, false);
  assert.equal(policy.message, "현재 움직임 목표는 수동 목표입니다. B컷 참조 위치는 저장되어 있지만 현재 모션에는 사용하지 않습니다.");
  assert.equal(targetState.statusText(plan), "현재 움직임 목표는 수동 목표입니다. B컷 참조 위치는 저장되어 있지만 현재 모션에는 사용하지 않습니다.");
  assert.equal(targetPolicy.correspondenceApplyPolicy(plan, correspondenceDraft(), { explicit: true }).allowed, true);
});

test("active motion target source is preserved and displayed", () => {
  const plan = motionPlanner.normalizePlan({
    target: { x: 80, y: 90 },
    targetSource: { type: "correspondence", correspondenceId: "corr-1", targetPartType: "foot" },
  });
  assert.equal(plan.activeMotionTarget.source, "correspondence");
  assert.equal(plan.activeMotionTarget.correspondenceId, "corr-1");
  assert.equal(targetState.statusText(plan), "현재 움직임 목표: B컷 참조");
  assert.deepEqual(targetState.activeMotionTargetDebug(plan), {
    source: "correspondence",
    point: { x: 80, y: 90 },
    coordinateSpace: "sourceImage",
    bReferenceUsedForMotion: true,
  });
});

test("use correspondence as motion target changes active target", () => {
  const patch = targetState.correspondenceTargetPatch(correspondenceDraft());
  const plan = motionPlanner.normalizePlan({ ...targetState.manualTargetPatch({ x: 10, y: 20 }), ...patch });
  assert.equal(plan.target.x, 120);
  assert.equal(plan.activeMotionTarget.source, "correspondence");
  assert.equal(plan.manualMotionTarget.point.x, 10);
});

test("manual target remains active when B reference is only saved", () => {
  const plan = motionPlanner.normalizePlan({
    ...targetState.manualTargetPatch({ x: 10, y: 20 }),
    ...targetState.correspondenceAnchorPatch(correspondenceDraft()),
  });
  assert.equal(plan.activeMotionTarget.source, "manual");
  assert.equal(targetState.activeMotionTargetDebug(plan).bReferenceUsedForMotion, false);
});

test("clear manual target keeps saved correspondence inactive", () => {
  const before = motionPlanner.normalizePlan({
    ...targetState.manualTargetPatch({ x: 10, y: 20 }),
    ...targetState.correspondenceAnchorPatch(correspondenceDraft()),
  });
  const after = motionPlanner.normalizePlan({ ...before, ...targetState.clearManualTargetPatch(before) });
  assert.equal(after.manualMotionTarget, null);
  assert.equal(after.activeMotionTarget, null);
  assert.equal(after.correspondenceAnchor.source, "correspondence");
  assert.equal(targetState.statusText(after), "B컷 참조 위치는 저장되어 있지만 현재 모션에는 사용하지 않습니다.");
});

test("generated active motion target debug uses generated source", () => {
  const bridge = { impactFrame: 15 };
  const result = motionPlanner.createPlan(sampleParts(), "leg", bridge, { template: "kick" });
  assert.equal(result.activeMotionTarget.source, "generated");
  assert.equal(result.targetDebug.activeMotionTarget.source, "generated");
  assert.deepEqual(result.activeMotionTarget.point, result.target);
  assert.equal(result.targetDebug.activeMotionTarget.bReferenceUsedForMotion, false);
});

test("character root delta debug uses explicit terminology alias", () => {
  const result = motionPlanner.createPlan(sampleParts(), "leg", { impactFrame: 15 }, { template: "kick", target: { x: 150, y: 70 } });
  assert.deepEqual(result.targetDebug.characterRootDelta, result.targetDebug.rootDelta);
  const debug = characterRootMotion.evaluationDebug(partsWithTracks(sampleParts(), result), 15, { jointAction: result.jointAction });
  assert.deepEqual(debug.characterRootDelta, debug.rootDelta);
});

test("root motion tuning is normalized for debug and anchors", () => {
  const plan = motionPlanner.normalizePlan({
    rootMotionTuning: { bodyFollowStrength: 0.5, maxRootDeltaRatio: 0.4, primaryLeadStrength: 1.25, secondaryFollowStrength: 0.7 },
  });
  assert.equal(plan.rootMotionTuning.bodyFollowStrength, 0.5);
  assert.equal(plan.rootMotionTuning.maxRootDeltaRatio, 0.4);
  assert.equal(plan.rootMotionTuning.primaryLeadStrength, 1.25);
  assert.equal(plan.rootMotionTuning.secondaryFollowStrength, 0.7);
});

test("trajectory samples are not treated as anchors", () => {
  const action = {
    focusKey: "rFoot",
    anchors: [{ key: "rFoot", role: "primary", point: { x: 90, y: 70 } }],
    beats: [
      { id: "ready", pose: { rFoot: [80, 100] } },
      { id: "impact", pose: { rFoot: [120, 60] } },
    ],
  };
  const samples = trajectoryEditor.trajectorySamples(action, "rFoot");
  assert.equal(samples.every((sample) => sample.kind === "sample" && sample.editable === false), true);
  assert.equal(action.anchors[0].role, "primary");
});

test("Korean UI text does not expose raw motion target wording", () => {
  const correspondenceEditor = fs.readFileSync("scripts/correspondence-editor.js", "utf8");
  const motionPlannerSource = fs.readFileSync("scripts/motion-planner.js", "utf8");
  assert.equal(correspondenceEditor.includes("B컷 대응 파츠"), false);
  assert.equal(correspondenceEditor.includes("Use B correspondence as motion target"), false);
  assert.equal(correspondenceEditor.includes("motion target으로"), false);
  assert.equal(correspondenceEditor.includes("Manual target cleared"), false);
  assert.equal(motionPlannerSource.includes("목표점"), false);
});

test("kick mode does not default chest correspondence as attack target", () => {
  const anchor = targetState.correspondenceAnchorPatch({ ...correspondenceDraft(), targetPartType: "chest" });
  const plan = motionPlanner.normalizePlan({ template: "kick", ...anchor });
  assert.equal(plan.correspondenceAnchor.role, "reference");
  assert.equal(plan.activeMotionTarget, null);
  assert.equal(plan.target, null);
});

function correspondenceDraft() {
  return {
    correspondenceId: "corr-1",
    targetPartType: "foot",
    target: { x: 120, y: 60 },
    targetCoordinateSpace: "sourceImage",
    anchors: [],
    motionHints: null,
    targetDebug: { rawBTarget: { x: 300, y: 400, coordinateSpace: "impactImage" } },
  };
}

function correspondenceAnchor() {
  return targetState.correspondenceAnchorPatch(correspondenceDraft()).correspondenceAnchor;
}

function sampleParts() {
  return [
    { id: "body", type: "body", rect: { x: 40, y: 20, w: 20, h: 50 }, pivot: { x: 10, y: 25 }, joint: { x: 10, y: 40 } },
    { id: "head", type: "head", rect: { x: 38, y: 4, w: 24, h: 20 }, pivot: { x: 12, y: 10 }, joint: { x: 12, y: 16 } },
    { id: "leg", type: "leg", rect: { x: 67, y: 60, w: 18, h: 45 }, pivot: { x: 2, y: 6 }, joint: { x: 16, y: 40 } },
  ];
}

function partsWithTracks(parts, plan) {
  return parts.map((part) => ({
    ...part,
    keyframes: plan.partTracks.find((track) => track.partId === part.id)?.keyframes || [],
  }));
}
