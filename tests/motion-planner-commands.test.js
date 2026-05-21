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
