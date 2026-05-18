const assert = require("node:assert/strict");

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
  assert.match(policy.message, /Manual target is active/);
  assert.equal(targetPolicy.correspondenceApplyPolicy(plan, correspondenceDraft(), { explicit: true }).allowed, true);
});

test("active motion target source is preserved and displayed", () => {
  const plan = motionPlanner.normalizePlan({
    target: { x: 80, y: 90 },
    targetSource: { type: "correspondence", correspondenceId: "corr-1", targetPartType: "foot" },
  });
  assert.equal(plan.activeMotionTarget.source, "correspondence");
  assert.equal(plan.activeMotionTarget.correspondenceId, "corr-1");
  assert.equal(targetState.statusText(plan), "Active motion target: correspondence");
});

test("use correspondence as motion target changes active target", () => {
  const patch = targetState.correspondenceTargetPatch(correspondenceDraft());
  const plan = motionPlanner.normalizePlan({ ...targetState.manualTargetPatch({ x: 10, y: 20 }), ...patch });
  assert.equal(plan.target.x, 120);
  assert.equal(plan.activeMotionTarget.source, "correspondence");
  assert.equal(plan.manualMotionTarget.point.x, 10);
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
  assert.match(targetState.statusText(after), /not driving motion/);
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
