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
    "scripts/motion-model.js",
    "scripts/motion-hints.js",
    "scripts/motion-drafts.js",
    "scripts/motion-target-state.js",
    "scripts/motion-target-debug.js",
    "scripts/character-root-motion.js",
    "scripts/action-timeline-model.js",
    "scripts/impact-exaggeration-layer.js",
    "scripts/rig-connection.js",
    "scripts/pose-assist.js",
    "scripts/joint-coordinates.js",
    "scripts/cutscene-model.js",
    "scripts/motion-anchors.js",
    "scripts/timeline.js",
    "scripts/motion-planner.js",
    "scripts/motion-planner-commands.js",
  ]) runScript(context, path);
  const Animotion = context.window.Animotion;
  Animotion.state = stateFixture();
  Animotion.dom = { els: fakeElements() };
  Animotion.parts = { selectedPart: () => Animotion.state.parts.find((part) => part.id === Animotion.state.selectedPartId) || null };
  Animotion.partCommands = { updatePart: (part, patch) => Object.assign(part, patch) };
  Animotion.cutsceneControls = { preservePanelTransform: (next) => next };
  Animotion.ui = { refreshUi() {} };
  runScript(context, "scripts/motion-commands.js");
  runScript(context, "scripts/timeline-controls.js");
  Animotion.timelineControls.bindTimelineControls();
  return Animotion;
}

function runScript(context, path) {
  vm.runInContext(fs.readFileSync(path, "utf8"), context, { filename: path });
}

function fakeElements() {
  return {
    motionTemplate: fakeElement("cutscene"),
    currentFrame: fakeElement("1"),
    frameLabel: fakeElement("1"),
    playPause: fakeElement("재생"),
    autoAnticipation: fakeElement(""),
    insertKeyframe: fakeElement(""),
    deleteKeyframe: fakeElement(""),
  };
}

function fakeElement(value) {
  return {
    value,
    textContent: value,
    addEventListener(type, handler) {
      this[type] = handler;
    },
    click() {
      this.click?.();
    },
  };
}

function stateFixture() {
  const oldKeyframes = [{ frame: 24, pose: { x: 0, y: 0, rotate: 0, scaleY: 0, jointX: 52, jointY: -40, phase: 0 } }];
  const parts = [
    part("body", "body", { x: 40, y: 20, w: 20, h: 50 }),
    part("head", "head", { x: 38, y: 4, w: 24, h: 20 }),
    { ...part("arm_01", "arm", { x: 16, y: 28, w: 36, h: 36 }), humanRole: "forearm", joint: { x: 24, y: 13 }, handTip: { x: 4, y: 31 }, keyframes: oldKeyframes },
    { ...part("arm_02", "arm", { x: 64, y: 28, w: 36, h: 36 }), humanRole: "forearm", joint: { x: 12, y: 13 }, handTip: { x: 32, y: 31 } },
  ];
  return {
    image: { naturalWidth: 200, naturalHeight: 160 },
    parts,
    selectedPartId: "arm_01",
    currentFrame: 1,
    running: false,
    startTime: 1000,
    cutsceneBridge: legacyBridge(),
    motionPlan: { template: "punch", target: { x: 160, y: 30 } },
    project: { parts },
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

function beatMap(action) {
  return Object.fromEntries(action.beats.map((beat) => [beat.id, beat]));
}

function distance(a, b) {
  return Math.hypot(Number(b[0]) - Number(a[0]), Number(b[1]) - Number(a[1]));
}

function pointDistance(a, b) {
  return Math.hypot(Number(b.x) - Number(a.x), Number(b.y) - Number(a.y));
}

function absoluteLocalPoint(part, localPoint) {
  return { x: part.rect.x + localPoint.x, y: part.rect.y + localPoint.y };
}

function movedLocalPoint(part, localPoint, pose) {
  return { x: part.rect.x + localPoint.x + pose.x, y: part.rect.y + localPoint.y + pose.y };
}

function keyframePose(part, frame) {
  return part.keyframes.find((keyframe) => keyframe.frame === frame)?.pose;
}

test("explicit punch regeneration uses arm hand tip when no hand part exists", () => {
  const Animotion = loadAnimotion();
  const arm = Animotion.state.parts.find((part) => part.id === "arm_01");
  const base = Animotion.jointCoordinates.inferJointPose(Animotion.state.parts);
  assert.deepEqual(JSON.parse(JSON.stringify(base.lElbow)), [40, 41]);
  assert.deepEqual(JSON.parse(JSON.stringify(base.lHand)), [20, 59]);
  assert.deepEqual(JSON.parse(JSON.stringify(arm.keyframes)), Animotion.state.oldKeyframes);

  Animotion.dom.els.autoAnticipation.click();

  const bridge = Animotion.state.cutsceneBridge;
  const generatedArm = Animotion.state.parts.find((part) => part.id === "arm_01");
  const beats = beatMap(bridge.jointAction);
  const handMove = distance(base.lHand, beats.impact.pose.lHand);
  const elbowMove = distance(base.lElbow, beats.impact.pose.lElbow);
  const regenerated = generatedArm.keyframes;
  const impactPose = keyframePose(generatedArm, beats.impact.at);
  const recoverPose = keyframePose(generatedArm, beats.recover.at);
  const baseHandTip = absoluteLocalPoint(arm, arm.handTip);
  const baseElbow = absoluteLocalPoint(arm, arm.joint);
  const impactHandTip = movedLocalPoint(generatedArm, generatedArm.handTip, impactPose);
  const impactElbow = movedLocalPoint(generatedArm, generatedArm.joint, impactPose);
  const recoverHandTip = movedLocalPoint(generatedArm, generatedArm.handTip, recoverPose);
  const target = Animotion.state.motionPlan.target;
  assert.equal(bridge.primaryPartId, "arm_01");
  assert.equal(bridge.jointAction.actionTimeline.template, "punch");
  assert.notDeepEqual(JSON.parse(JSON.stringify(regenerated)), Animotion.state.oldKeyframes);
  assert.equal(handMove > elbowMove, true);
  assert.equal(beats.windup.pose.lHand[0] <= base.lHand[0], true);
  assert.equal(impactPose.jointX, 0);
  assert.equal(impactPose.jointY, 0);
  assert.deepEqual(JSON.parse(JSON.stringify(impactHandTip)), JSON.parse(JSON.stringify(target)));
  assert.equal(pointDistance(baseElbow, impactElbow) <= pointDistance(baseHandTip, impactHandTip), true);
  assert.equal(pointDistance(baseHandTip, recoverHandTip) < pointDistance(baseHandTip, impactHandTip), true);
});

test("front jab regeneration also drives an arm-only hand tip", () => {
  const Animotion = loadAnimotion();
  Animotion.state.selectedPartId = "arm_02";
  Animotion.state.motionPlan = { template: "punch", target: { x: 160, y: 60 } };

  const arm = Animotion.state.parts.find((part) => part.id === "arm_02");
  const baseHandTip = absoluteLocalPoint(arm, arm.handTip);
  Animotion.dom.els.autoAnticipation.click();

  const generatedArm = Animotion.state.parts.find((part) => part.id === "arm_02");
  const impact = beatMap(Animotion.state.cutsceneBridge.jointAction).impact;
  const impactPose = keyframePose(generatedArm, impact.at);
  const impactHandTip = movedLocalPoint(generatedArm, generatedArm.handTip, impactPose);
  assert.equal(Animotion.state.cutsceneBridge.primaryPartId, "arm_02");
  assert.equal(Animotion.state.cutsceneBridge.jointAction.actionTimeline.template, "punch");
  assert.equal(impactPose.jointX, 0);
  assert.equal(impactPose.jointY, 0);
  assert.equal(pointDistance(impactHandTip, Animotion.state.motionPlan.target) < pointDistance(baseHandTip, Animotion.state.motionPlan.target), true);
});
