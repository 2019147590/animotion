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
    "scripts/action-timeline-model.js",
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

function ids(timeline) {
  return JSON.parse(JSON.stringify(timeline.beats.map((beat) => beat.id)));
}
