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
    "scripts/cutscene-action-selectors.js",
    "scripts/impact-exaggeration-layer.js",
    "scripts/arm-role-semantics.js",
    "scripts/rig-connection.js",
    "scripts/arm-chain-resolver.js",
    "scripts/pose-assist.js",
    "scripts/joint-coordinates.js",
    "scripts/cutscene-model.js",
    "scripts/motion-anchors.js",
    "scripts/timeline.js",
    "scripts/arm-extension-controls.js",
    "scripts/arm-extension.js",
    "scripts/motion-planner.js",
    "scripts/motion-primary-selection.js",
    "scripts/motion-planner-commands.js",
    "scripts/arm-chain-rebind.js",
  ]) runScript(context, path);
  const Animotion = context.window.Animotion;
  Animotion.state = stateFixture();
  Animotion.dom = { els: fakeElements() };
  Animotion.parts = { selectedPart: () => Animotion.state.parts.find((part) => part.id === Animotion.state.selectedPartId) || null };
  Animotion.partCommands = { updatePart: (part, patch) => Object.assign(part, patch) };
  Animotion.cutsceneControls = { preservePanelTransform: (next) => next };
  Animotion.ui = { refreshUi() {} };
  runScript(context, "scripts/motion-commands.js");
  return Animotion;
}

function loadProjectModel() {
  const context = { window: { Animotion: {} } };
  vm.createContext(context);
  for (const path of ["scripts/coordinate-spaces.js", "scripts/motion-model.js", "scripts/human-rig-schema.js", "scripts/rig-connection.js", "scripts/project-model.js"]) {
    runScript(context, path);
  }
  return context.window.Animotion;
}

function runScript(context, path) {
  vm.runInContext(fs.readFileSync(path, "utf8"), context, { filename: path });
}

function fakeElements() {
  return { motionTemplate: { value: "cutscene" }, currentFrame: { value: "1" }, frameLabel: { textContent: "1" }, playPause: { textContent: "재생" } };
}

function stateFixture() {
  const parts = legacyMixedParts();
  return {
    image: { naturalWidth: 240, naturalHeight: 180 },
    parts,
    selectedPartId: "rear_forearm_new",
    currentFrame: 1,
    running: false,
    cutsceneBridge: staleBridge(),
    motionPlan: { template: "punch", targetMode: false },
    project: { parts },
  };
}

function staleBridge() {
  return {
    primaryPartId: "rear_arm_old",
    durationFrames: 36,
    impactFrame: 24,
    sourceMotionEnabled: false,
    ghostEnabled: false,
    jointAction: {
      source: "motion-planner-punch-anchors-v1",
      focusKey: "lHand",
      actionTimeline: { template: "punch" },
      beats: [{ id: "impact", at: 24, pose: { lHand: [42, 62], lElbow: [54, 48], hip: [92, 118] } }],
      targetDebug: { primaryPartId: "rear_arm_old", punchStyle: "rear-cross" },
    },
  };
}

function legacyMixedParts() {
  return [
    part("body", "body", { x: 80, y: 40, w: 34, h: 86 }, { humanRole: "torso" }),
    part("front_upperArm", "arm", { x: 116, y: 52, w: 24, h: 26 }, { humanRole: "upperArm", parentId: "body", pivot: { x: 0, y: 13 }, joint: { x: 20, y: 13 } }),
    part("front_forearm", "arm", { x: 136, y: 58, w: 26, h: 24 }, { humanRole: "forearm", parentId: "front_upperArm", pivot: { x: 0, y: 8 }, joint: { x: 22, y: 12 } }),
    part("front_hand", "hand", { x: 158, y: 64, w: 14, h: 14 }, { humanRole: "hand", parentId: "front_forearm", pivot: { x: 0, y: 7 }, handTip: { x: 14, y: 7 } }),
    part("rear_arm_old", "arm", { x: 34, y: 52, w: 44, h: 46 }, { humanRole: "forearm", pivot: { x: 38, y: 8 }, joint: { x: 20, y: 24 }, handTip: { x: 4, y: 40 }, keyframes: [{ frame: 24, pose: { x: 24, y: -8, rotate: -20, scaleY: 0, jointX: 0, jointY: 0, phase: 0 } }] }),
    part("rear_upperArm_new", "arm", { x: 56, y: 52, w: 24, h: 26 }, splitMeta("rear_arm_old", { humanRole: "upperArm", parentId: "body", pivot: { x: 24, y: 13 }, joint: { x: 4, y: 13 } })),
    part("rear_forearm_new", "arm", { x: 34, y: 58, w: 26, h: 24 }, splitMeta("rear_arm_old", { humanRole: "forearm", parentId: "rear_upperArm_new", pivot: { x: 26, y: 8 }, joint: { x: 0, y: 12 } })),
    part("rear_hand_new", "hand", { x: 20, y: 64, w: 14, h: 14 }, splitMeta("rear_arm_old", { humanRole: "hand", parentId: "rear_forearm_new", pivot: { x: 14, y: 7 }, handTip: { x: 0, y: 7 } })),
  ];
}

function splitMeta(sourceId, patch) {
  return { ...patch, splitFromPartId: sourceId, originalSourcePartId: sourceId, sourceArmOnlyPartId: sourceId, splitMethod: "manual" };
}

function part(id, type, rect, patch = {}) {
  return {
    id,
    name: id,
    type,
    rect,
    pivot: { x: rect.w / 2, y: rect.h * 0.2 },
    joint: { x: rect.w / 2, y: rect.h * 0.9 },
    customMotion: { x: 0, y: 0, rotate: 0, scaleY: 0, jointX: 0, jointY: 0, phase: 0 },
    keyframes: [],
    ...patch,
  };
}

function poseMagnitude(part, frame) {
  const pose = part.keyframes.find((keyframe) => keyframe.frame === frame)?.pose || {};
  return Math.hypot(Number(pose.x) || 0, Number(pose.y) || 0, Number(pose.rotate) || 0);
}

test("loaded mixed arm project remains unchanged before explicit rebind", () => {
  const Animotion = loadAnimotion();
  const before = JSON.stringify({ bridge: Animotion.state.cutsceneBridge, parts: Animotion.state.parts });

  const context = Animotion.armChainRebind.contextForState(Animotion.state);

  assert.equal(context.canRebind, true);
  assert.equal(JSON.stringify({ bridge: Animotion.state.cutsceneBridge, parts: Animotion.state.parts }), before);
});

test("manual split metadata survives project normalization without rebind", () => {
  const Animotion = loadProjectModel();
  const project = Animotion.projectModel.normalizeProject({
    format: "animotion-project",
    metadata: { name: "legacy mixed" },
    canvas: { width: 240, height: 180 },
    parts: legacyMixedParts(),
    assets: [],
  }, { imageBounds: { width: 240, height: 180 } });
  const split = project.parts.find((part) => part.id === "rear_forearm_new");

  assert.equal(split.sourceArmOnlyPartId, "rear_arm_old");
  assert.equal(split.splitFromPartId, "rear_arm_old");
  assert.equal(split.splitMethod, "manual");
  assert.equal(project.parts.find((part) => part.id === "rear_arm_old").keyframes.length, 1);
});

test("resolver detects manually split replacement chain metadata", () => {
  const Animotion = loadAnimotion();
  const context = Animotion.armChainRebind.contextForState(Animotion.state);

  assert.equal(context.stalePartId, "rear_arm_old");
  assert.equal(context.replacement.handOrGloveId, "rear_hand_new");
  assert.equal(context.replacement.separateRigPath, true);
  assertJsonEqual(context.replacement.chainPartIds, ["rear_upperArm_new", "rear_forearm_new", "rear_hand_new"]);
});

test("counterpart matching pairs separated arm roles", () => {
  const Animotion = loadAnimotion();
  const pairs = Animotion.armChainRebind.counterpartPairs(Animotion.state.parts, Animotion.armChainRebind.contextForState(Animotion.state).replacement);

  assert.equal(pairs.upperArm.id, "front_upperArm");
  assert.equal(pairs.forearm.id, "front_forearm");
  assert.equal(pairs.hand.id, "front_hand");
});

test("explicit rebind regenerates punch with new terminal hand and preserves old part", () => {
  const Animotion = loadAnimotion();

  const result = Animotion.armChainRebind.applyActiveRebind();

  assert.equal(result.ok, true);
  assert.equal(Animotion.state.cutsceneBridge.primaryPartId, "rear_hand_new");
  assert.equal(Animotion.state.cutsceneBridge.jointAction.targetDebug.terminalPunchPartId, "rear_hand_new");
  assert.equal(Animotion.state.parts.some((part) => part.id === "rear_arm_old"), true);
  const impactFrame = Animotion.state.cutsceneBridge.jointAction.beats.find((beat) => beat.id === "impact").at;
  assert.equal(poseMagnitude(Animotion.state.parts.find((part) => part.id === "rear_hand_new"), impactFrame) > poseMagnitude(Animotion.state.parts.find((part) => part.id === "rear_forearm_new"), impactFrame), true);
  assert.notDeepEqual(Animotion.state.parts.find((part) => part.id === "rear_arm_old").keyframes, [{ frame: 24, pose: { x: 24, y: -8, rotate: -20, scaleY: 0, jointX: 0, jointY: 0, phase: 0 } }]);
});

function assertJsonEqual(actual, expected) {
  assert.deepEqual(JSON.parse(JSON.stringify(actual)), expected);
}
