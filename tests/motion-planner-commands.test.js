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
  const els = {
    motionTemplate: fakeElement("cutscene"),
    currentFrame: fakeElement("1"),
    frameLabel: fakeElement("1"),
    playPause: fakeElement("재생"),
    autoAnticipation: fakeElement(""),
    insertKeyframe: fakeElement(""),
    deleteKeyframe: fakeElement(""),
  };
  return els;
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
  const parts = partsFixture();
  return {
    image: { naturalWidth: 200, naturalHeight: 160 },
    parts,
    selectedPartId: "arm",
    currentFrame: 1,
    running: false,
    startTime: 1000,
    cutsceneBridge: null,
    motionPlan: { template: "punch", target: { x: 160, y: 30 }, targetMode: false },
    project: { parts },
  };
}

function partsFixture() {
  return [
    part("body", "body", { x: 40, y: 20, w: 20, h: 50 }),
    part("head", "head", { x: 38, y: 4, w: 24, h: 20 }),
    part("arm", "arm", { x: 64, y: 28, w: 18, h: 32 }),
    part("leg", "leg", { x: 67, y: 60, w: 18, h: 45 }),
    part("mouth", "mouth", { x: 45, y: 18, w: 10, h: 8 }),
  ];
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

function clickAuto(Animotion) {
  Animotion.dom.els.autoAnticipation.click();
}

function legacyRearHandParts(oldKeyframes) {
  return [
    part("body", "body", { x: 40, y: 20, w: 20, h: 50 }),
    part("head", "head", { x: 38, y: 4, w: 24, h: 20 }),
    { ...part("upper_01", "arm", { x: 28, y: 24, w: 20, h: 20 }), humanRole: "upperArm" },
    { ...part("arm_01", "arm", { x: 16, y: 28, w: 18, h: 32 }), humanRole: "forearm", parentId: "upper_01", keyframes: oldKeyframes },
    { ...part("hand_01", "hand", { x: 10, y: 49, w: 12, h: 12 }), humanRole: "hand", parentId: "arm_01" },
    { ...part("upper_02", "arm", { x: 60, y: 24, w: 20, h: 20 }), humanRole: "upperArm" },
    { ...part("arm_02", "arm", { x: 64, y: 28, w: 18, h: 32 }), humanRole: "forearm", parentId: "upper_02" },
    { ...part("hand_02", "hand", { x: 80, y: 49, w: 12, h: 12 }), humanRole: "hand", parentId: "arm_02" },
  ];
}

function beatMap(action) {
  return Object.fromEntries(action.beats.map((beat) => [beat.id, beat]));
}

function distance(a, b) {
  return Math.hypot(Number(b[0]) - Number(a[0]), Number(b[1]) - Number(a[1]));
}

test("auto cutscene button generates canonical punch action for an arm part", () => {
  const Animotion = loadAnimotion();
  Animotion.state.selectedPartId = "arm";
  Animotion.state.motionPlan = { template: "punch", target: { x: 160, y: 30 } };
  clickAuto(Animotion);
  assert.equal(Animotion.state.cutsceneBridge.jointAction.source, "motion-planner-punch-anchors-v1");
  assert.equal(Animotion.state.cutsceneBridge.jointAction.actionTimeline.template, "punch");
});

test("auto cutscene button generates canonical kick action for a leg part", () => {
  const Animotion = loadAnimotion();
  Animotion.state.selectedPartId = "leg";
  Animotion.state.motionPlan = { template: "kick", target: { x: 160, y: 70 } };
  clickAuto(Animotion);
  assert.equal(Animotion.state.cutsceneBridge.jointAction.source, "motion-planner-kick-anchors-v1");
  assert.equal(Animotion.state.cutsceneBridge.jointAction.actionTimeline.template, "kick");
});

test("auto cutscene button invalidates stale punch target and anchors before kick generation", () => {
  const Animotion = loadAnimotion();
  Animotion.state.selectedPartId = "arm";
  Animotion.state.motionPlan = {
    template: "punch",
    target: { x: 160, y: 30 },
    anchors: [{ key: "rHand", role: "primary", point: { x: 160, y: 30 } }],
    motionDraft: { source: "test", hiddenCompletion: { needed: true } },
  };
  clickAuto(Animotion);

  Animotion.state.selectedPartId = "leg";
  Animotion.state.motionPlan = {
    ...Animotion.state.motionPlan,
    template: "kick",
  };
  clickAuto(Animotion);

  assert.equal(Animotion.state.cutsceneBridge.primaryPartId, "leg");
  assert.equal(Animotion.state.cutsceneBridge.jointAction.actionTimeline.template, "kick");
  assert.notDeepEqual(Animotion.state.motionPlan.target, { x: 160, y: 30 });
  assert.equal(Animotion.state.cutsceneBridge.jointAction.motionDraft, undefined);
  assert.equal(
    Animotion.state.cutsceneBridge.jointAction.anchors.some((anchor) => anchor.key === "rHand"),
    false
  );
});

test("auto cutscene button invalidates stale target when selected primary part changes", () => {
  const Animotion = loadAnimotion();
  Animotion.state.parts.push(part("leg-left", "leg", { x: 10, y: 60, w: 18, h: 45 }));
  Animotion.state.selectedPartId = "leg";
  Animotion.state.motionPlan = { template: "kick", target: { x: 160, y: 70 } };
  clickAuto(Animotion);

  Animotion.state.selectedPartId = "leg-left";
  Animotion.state.motionPlan = {
    ...Animotion.state.motionPlan,
    template: "kick",
  };
  clickAuto(Animotion);

  assert.equal(Animotion.state.cutsceneBridge.primaryPartId, "leg-left");
  assert.equal(Animotion.state.cutsceneBridge.jointAction.actionTimeline.template, "kick");
  assert.notDeepEqual(Animotion.state.motionPlan.target, { x: 160, y: 70 });
});

test("auto cutscene button preserves adjusted trajectory for the same action and part", () => {
  const Animotion = loadAnimotion();
  Animotion.state.selectedPartId = "arm";
  Animotion.state.motionPlan = { template: "punch", target: { x: 160, y: 30 } };
  clickAuto(Animotion);

  Animotion.motionCommands.setMotionPlan({
    target: { x: 150, y: 26 },
    anchors: [{ key: "rHand", role: "primary", point: { x: 150, y: 26 }, locked: true }],
  });
  clickAuto(Animotion);

  assert.equal(Animotion.state.motionPlan.target.x, 150);
  assert.equal(Animotion.state.motionPlan.target.y, 26);
  assert.equal(Animotion.state.cutsceneBridge.jointAction.actionTimeline.template, "punch");
  const primaryAnchor = Animotion.state.cutsceneBridge.jointAction.anchors.find((anchor) => anchor.key === "rHand");
  assert.equal(primaryAnchor.point.x, 150);
  assert.equal(primaryAnchor.point.y, 26);
});

test("explicit punch regeneration after legacy load targets the terminal rear hand", () => {
  for (const selectedPartId of ["arm_01", "hand_01"]) {
    const Animotion = loadAnimotion();
    const oldKeyframes = [{ frame: 24, pose: { x: 0, y: 0, rotate: 0, scaleY: 0, jointX: 52, jointY: -40, phase: 0 } }];
    Animotion.state.parts = legacyRearHandParts(oldKeyframes);
    Animotion.state.project.parts = Animotion.state.parts;
    Animotion.state.selectedPartId = selectedPartId;
    Animotion.state.motionPlan = { template: "punch", target: { x: 160, y: 30 } };
    Animotion.state.cutsceneBridge = Animotion.cutsceneModel.normalizeBridge({
      primaryPartId: "arm_01",
      durationFrames: 36,
      impactFrame: 24,
      jointAction: {
        source: "motion-planner-punch-anchors-v1",
        focusKey: "lHand",
        actionTimeline: { template: "punch" },
        beats: [{ id: "impact", at: 24, pose: { lHand: [70, 8], lElbow: [68, -16], hip: [50, 63] } }],
      },
    });
    const base = Animotion.jointCoordinates.inferJointPose(Animotion.state.parts);

    assert.deepEqual(JSON.parse(JSON.stringify(Animotion.state.parts.find((part) => part.id === "arm_01").keyframes)), oldKeyframes);
    clickAuto(Animotion);

    const bridge = Animotion.state.cutsceneBridge;
    const beats = beatMap(bridge.jointAction);
    const handMove = distance(base.lHand, beats.impact.pose.lHand);
    const elbowMove = distance(base.lElbow, beats.impact.pose.lElbow);
    assert.equal(bridge.primaryPartId, "hand_01");
    assert.equal(bridge.jointAction.actionTimeline.template, "punch");
    assert.notDeepEqual(JSON.parse(JSON.stringify(Animotion.state.parts.find((part) => part.id === "arm_01").keyframes)), oldKeyframes);
    assert.equal(handMove > elbowMove, true);
    assert.equal(beats.windup.pose.lHand[0] <= base.lHand[0], true);
  }
});

test("auto cutscene button blocks punch and kick for an invalid selected part", () => {
  const Animotion = loadAnimotion();
  Animotion.state.selectedPartId = "mouth";
  Animotion.state.motionPlan = { template: "punch", target: { x: 160, y: 30 } };
  clickAuto(Animotion);
  assert.equal(Animotion.state.cutsceneBridge, null);
  assert.match(Animotion.motionPlannerCommands.statusMessage(), /arm\/hand/);
});

test("auto cutscene button keeps legacy part pivots for non punch kick actions", () => {
  const Animotion = loadAnimotion();
  Animotion.state.selectedPartId = "body";
  Animotion.state.motionPlan = { template: "dash", target: { x: 80, y: 10 } };
  clickAuto(Animotion);
  assert.equal(Animotion.state.cutsceneBridge.jointAction.source, "part-pivots-v1");
  assert.equal(Animotion.state.cutsceneBridge.jointAction.actionTimeline, undefined);
});
