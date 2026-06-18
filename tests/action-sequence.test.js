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
    "scripts/motion-track-builder.js",
    "scripts/boxing-step-locomotion.js",
    "scripts/motion-planner.js",
    "scripts/motion-primary-selection.js",
    "scripts/action-sequence.js",
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

test("action sequence normalizes known action templates and caps steps", () => {
  const Animotion = loadAnimotion();
  const sequence = Animotion.actionSequence.normalizeSequence({
    steps: ["punch", "missing", "rearHandPunch01", "kick", "punch", "punch", "punch", "punch"],
  });
  assert.deepEqual(sequence.steps.map((step) => step.template), [
    "punch",
    "rearHandPunch01",
    "kick",
    "punch",
    "punch",
    "punch",
  ]);
});

test("jab jab rear-hand punch compiles into one shifted cutscene action", () => {
  const Animotion = loadAnimotion();
  const compiled = Animotion.actionSequence.compileSequence(Animotion.state.parts, Animotion.actionSequence.defaultSequence(), {
    plan: Animotion.state.motionPlan,
    selectedPartId: "front_forearm",
  });
  const action = compiled.result.jointAction;
  const steps = action.targetDebug.actionSequence.steps;

  assert.equal(compiled.generated, true);
  assert.equal(compiled.bridge.durationFrames, 54);
  assert.equal(compiled.bridge.impactFrame, 51);
  assert.equal(action.source, "motion-planner-sequence-v1");
  assert.equal(action.actionTimeline.durationFrames, 54);
  assert.equal(JSON.stringify(action.beats.filter((beat) => beat.id.endsWith(":impact")).map((beat) => beat.at)), JSON.stringify([15, 33, 51]));
  assert.equal(JSON.stringify(steps.map((step) => step.template)), JSON.stringify(["punch", "punch", "rearHandPunch01"]));
  assert.equal(JSON.stringify(steps.map((step) => step.primaryPartId)), JSON.stringify(["front_hand", "front_hand", "back_hand"]));
  assert.equal(keyframesFor(compiled.result.partTracks, "front_hand").some((keyframe) => keyframe.frame === 15), true);
  assert.equal(keyframesFor(compiled.result.partTracks, "front_hand").some((keyframe) => keyframe.frame === 33), true);
  assert.equal(keyframesFor(compiled.result.partTracks, "back_hand").some((keyframe) => keyframe.frame === 51), true);
});

test("action sequence reports an empty sequence as a generation failure", () => {
  const Animotion = loadAnimotion();
  const compiled = Animotion.actionSequence.compileSequence(Animotion.state.parts, { steps: [] });
  assert.equal(compiled.generated, false);
  assert.equal(compiled.reason, "empty-sequence");
});

test("uploaded json clips can repeat as jab jab rear-hand punch", () => {
  const Animotion = loadAnimotion();
  const jabPayload = JSON.parse(fs.readFileSync("animotion-project (8).json", "utf8"));
  const rearPayload = JSON.parse(fs.readFileSync("animotion-project (17).json", "utf8"));
  const rearProject = Animotion.projectModel.normalizeProject(rearPayload, { imageBounds: canvasBounds(rearPayload) });
  const parts = Animotion.projectModel.editorPartsFromProject(rearProject);
  const jab = Animotion.actionSequence.clipFromProjectPayload(jabPayload, { id: "jab8", name: "animotion-project (8)" });
  const rear = Animotion.actionSequence.clipFromProjectPayload(rearPayload, { id: "rear17", name: "animotion-project (17)" });

  const compiled = Animotion.actionSequence.compileSequence(parts, {
    steps: [{ clipId: "jab8" }, { clipId: "jab8" }, { clipId: "rear17" }],
  }, { clips: [jab, rear] });
  const action = compiled.result.jointAction;
  const rearImpact = rear.bridge.jointAction.beats.find((beat) => beat.id === "impact");
  const finalImpact = action.beats.find((beat) => beat.id === "s3:impact");

  assert.equal(compiled.generated, true);
  assert.equal(compiled.bridge.durationFrames, 54);
  assert.equal(compiled.bridge.impactFrame, 51);
  assert.equal(JSON.stringify(action.beats.filter((beat) => beat.id.endsWith(":impact")).map((beat) => beat.at)), JSON.stringify([15, 33, 51]));
  assert.equal(finalImpact.pose[rear.bridge.jointAction.focusKey][0], rearImpact.pose[rear.bridge.jointAction.focusKey][0]);
  assert.equal(finalImpact.pose[rear.bridge.jointAction.focusKey][1], rearImpact.pose[rear.bridge.jointAction.focusKey][1]);
  assert.equal(keyframesFor(compiled.result.partTracks, rear.bridge.primaryPartId).some((keyframe) => keyframe.frame === 51), true);
});

test("json clip sequences can compile without preloaded app parts", () => {
  const Animotion = loadAnimotion();
  const jab = Animotion.actionSequence.clipFromProjectPayload(JSON.parse(fs.readFileSync("animotion-project (8).json", "utf8")), { id: "jab8" });
  const compiled = Animotion.actionSequence.compileSequence([], { steps: [{ clipId: "jab8" }] }, { clips: [jab] });
  assert.equal(compiled.generated, true);
  assert.equal(compiled.result.partTracks.length > 0, true);
});

function keyframesFor(tracks, partId) {
  return tracks.find((track) => track.partId === partId)?.keyframes || [];
}

function canvasBounds(payload) {
  return { width: payload.canvas.width, height: payload.canvas.height };
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
    customMotion: { x: 0, y: 0, rotate: 0, scaleY: 0, jointX: 0, jointY: 0, phase: 0 },
    keyframes: [],
  };
}
