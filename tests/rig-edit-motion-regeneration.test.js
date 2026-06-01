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
  const context = { window: { Animotion: {} }, document: undefined, crypto: { randomUUID: () => "id" } };
  vm.createContext(context);
  for (const path of [
    "scripts/config.js",
    "scripts/geometry.js",
    "scripts/coordinate-spaces.js",
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
    "scripts/project-model.js",
    "scripts/project-serialization.js",
    "scripts/rigging.js",
    "scripts/command-history.js",
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
  ]) runScript(context, path);
  const Animotion = context.window.Animotion;
  Animotion.state = stateFixture();
  Animotion.imageBounds = () => ({ width: 200, height: 160 });
  runScript(context, "scripts/part-supplemental-transform.js");
  runScript(context, "scripts/part-commands.js");
  runScript(context, "scripts/motion-commands.js");
  return Animotion;
}

function runScript(context, path) {
  vm.runInContext(fs.readFileSync(path, "utf8"), context, { filename: path });
}

function stateFixture() {
  const oldKeyframes = [{ frame: 24, pose: { x: 0, y: 0, rotate: 0, scaleY: 0, jointX: 52, jointY: -40, phase: 0 } }];
  const parts = [
    part("body", "body", { x: 40, y: 20, w: 20, h: 50 }),
    part("head", "head", { x: 38, y: 4, w: 24, h: 20 }),
    { ...part("arm_01", "arm", { x: 16, y: 28, w: 36, h: 36 }), humanRole: "forearm", joint: { x: 24, y: 13 }, handTip: { x: 24, y: 13 }, keyframes: oldKeyframes },
    { ...part("arm_02", "arm", { x: 64, y: 28, w: 36, h: 36 }), humanRole: "forearm", joint: { x: 12, y: 13 }, handTip: { x: 32, y: 31 } },
  ];
  return {
    image: { naturalWidth: 200, naturalHeight: 160 },
    parts,
    selectedPartId: "arm_01",
    currentFrame: 24,
    project: { parts },
    cutsceneBridge: legacyBridge(),
    motionPlan: { template: "punch", target: { x: 160, y: 30 } },
    oldKeyframes,
  };
}

function legacyBridge() {
  return {
    primaryPartId: "arm_01",
    durationFrames: 36,
    impactFrame: 24,
    jointAction: {
      source: "motion-planner-punch-anchors-v1",
      focusKey: "lHand",
      actionTimeline: { template: "punch" },
      beats: [{ id: "impact", at: 24, pose: { lHand: [40, 41], lElbow: [40, 41], hip: [50, 63] } }],
    },
  };
}

function part(id, type, rect) {
  return {
    id,
    type,
    name: id,
    rect,
    pivot: { x: rect.w / 2, y: rect.h * 0.2 },
    joint: { x: rect.w / 2, y: rect.h * 0.9 },
    customMotion: { x: 0, y: 0, rotate: 0, scaleY: 0, jointX: 0, jointY: 0, phase: 0 },
    keyframes: [],
  };
}

function keyframePose(part, frame) {
  return part.keyframes.find((keyframe) => keyframe.frame === frame)?.pose;
}

function absolutePoint(part, localPoint) {
  return { x: part.rect.x + localPoint.x, y: part.rect.y + localPoint.y };
}

function transformedPoint(part, localPoint, pose) {
  const pivot = absolutePoint(part, part.pivot);
  const point = absolutePoint(part, localPoint);
  const rad = Number(pose.rotate || 0) * Math.PI / 180;
  const scaleY = 1 + Number(pose.scaleY || 0);
  const x = point.x - pivot.x;
  const y = (point.y - pivot.y) * scaleY;
  return {
    x: pivot.x + Number(pose.x || 0) + Math.cos(rad) * x - Math.sin(rad) * y,
    y: pivot.y + Number(pose.y || 0) + Math.sin(rad) * x + Math.cos(rad) * y,
  };
}

function pointDistance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

test("editing an invalid elbow handTip regenerates punch motion from the corrected fist point", () => {
  const Animotion = loadAnimotion();
  const arm = Animotion.state.parts.find((candidate) => candidate.id === "arm_01");
  assert.equal(Animotion.rigging.validHandTipForPart(arm, arm.handTip), false);
  assert.deepEqual(JSON.parse(JSON.stringify(arm.keyframes)), Animotion.state.oldKeyframes);

  Animotion.partCommands.updatePart(arm.id, { handTip: { x: 4, y: 31 } });

  assert.equal(Animotion.state.motionRegenerationDebug.attempted, true);
  assert.equal(Animotion.state.motionRegenerationDebug.generated, true);
  assert.equal(Animotion.state.motionRegenerationDebug.reason, "generated");
  assert.equal(Animotion.state.motionRegenerationDebug.changedKeys.includes("handTip"), true);
  const impact = Animotion.state.cutsceneBridge.jointAction.beats.find((beat) => beat.id === "impact");
  const pose = keyframePose(arm, impact.at);
  const baseHand = absolutePoint(arm, arm.handTip);
  const baseElbow = absolutePoint(arm, arm.joint);
  const baseShoulder = absolutePoint(arm, arm.pivot);
  const impactHand = transformedPoint(arm, arm.handTip, pose);
  const impactElbow = transformedPoint(arm, arm.joint, pose);
  const impactShoulder = transformedPoint(arm, arm.pivot, pose);
  assert.notDeepEqual(JSON.parse(JSON.stringify(arm.keyframes)), Animotion.state.oldKeyframes);
  assert.equal(pose.jointX, 0);
  assert.equal(pose.jointY, 0);
  assert.equal(pointDistance(baseHand, impactHand) > pointDistance(baseElbow, impactElbow), true);
  assert.equal(pointDistance(baseElbow, impactElbow) > pointDistance(baseShoulder, impactShoulder), true);
});

test("editing non-rig metadata does not regenerate punch motion", () => {
  const Animotion = loadAnimotion();
  const arm = Animotion.state.parts.find((candidate) => candidate.id === "arm_01");
  const beforeKeyframes = JSON.stringify(arm.keyframes);
  const beforeAction = JSON.stringify(Animotion.state.cutsceneBridge.jointAction);

  Animotion.partCommands.updatePart(arm.id, { name: "renamed_arm" });

  assert.equal(Animotion.state.motionRegenerationDebug.attempted, false);
  assert.equal(Animotion.state.motionRegenerationDebug.generated, false);
  assert.equal(Animotion.state.motionRegenerationDebug.reason, "non-rig-geometry-change");
  assert.equal(Animotion.state.motionRegenerationDebug.changedKeys.includes("name"), true);
  assert.equal(JSON.stringify(arm.keyframes), beforeKeyframes);
  assert.equal(JSON.stringify(Animotion.state.cutsceneBridge.jointAction), beforeAction);
});
