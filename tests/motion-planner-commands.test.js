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
    "scripts/lead-arm-composite.js",
    "scripts/motion-track-builder.js",
    "scripts/boxing-step-locomotion.js",
    "scripts/motion-planner.js",
    "scripts/motion-primary-selection.js",
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

function armOnlyPunchParts() {
  return [
    part("body", "body", { x: 44, y: 20, w: 20, h: 54 }),
    part("head", "head", { x: 42, y: 4, w: 24, h: 20 }),
    { ...part("arm_01", "arm", { x: 18, y: 28, w: 20, h: 36 }), humanRole: "forearm", pivot: { x: 18, y: 7 }, joint: { x: 11, y: 23 }, handTip: { x: 4, y: 34 } },
    { ...part("arm_02", "arm", { x: 66, y: 28, w: 20, h: 36 }), humanRole: "forearm", pivot: { x: 2, y: 7 }, joint: { x: 13, y: 23 }, handTip: { x: 18, y: 34 } },
  ];
}

function separateBoxerParts() {
  return [
    part("body", "body", { x: 70, y: 28, w: 24, h: 70 }),
    part("head", "head", { x: 68, y: 6, w: 28, h: 24 }),
    { ...part("front_upperArm", "arm", { x: 96, y: 34, w: 28, h: 28 }), humanRole: "upperArm", parentId: "body", pivot: { x: 0, y: 14 }, joint: { x: 22, y: 14 } },
    { ...part("front_forearm", "arm", { x: 118, y: 40, w: 26, h: 28 }), humanRole: "forearm", parentId: "front_upperArm", pivot: { x: 0, y: 8 }, joint: { x: 22, y: 16 } },
    { ...part("front_glove", "glove", { x: 140, y: 48, w: 16, h: 16 }), parentId: "front_forearm", pivot: { x: 0, y: 8 }, handTip: { x: 16, y: 8 } },
    { ...part("rear_upperArm", "arm", { x: 42, y: 34, w: 28, h: 28 }), humanRole: "upperArm", parentId: "body", pivot: { x: 28, y: 14 }, joint: { x: 8, y: 14 } },
    { ...part("rear_forearm", "arm", { x: 24, y: 40, w: 26, h: 28 }), humanRole: "forearm", parentId: "rear_upperArm", pivot: { x: 26, y: 8 }, joint: { x: 0, y: 16 } },
    { ...part("rear_glove", "glove", { x: 10, y: 48, w: 16, h: 16 }), parentId: "rear_forearm", pivot: { x: 14, y: 8 }, handTip: { x: 0, y: 8 } },
  ];
}

function faceLeftArm02RearParts() {
  return [
    part("body", "body", { x: 90, y: 28, w: 20, h: 64 }),
    part("head", "head", { x: 52, y: 8, w: 28, h: 30 }),
    { ...part("arm_01", "arm", { x: 42, y: 38, w: 28, h: 44 }), humanRole: "forearm", pivot: { x: 24, y: 8 }, joint: { x: 12, y: 24 }, handTip: { x: 4, y: 34 } },
    { ...part("arm_02", "arm", { x: 118, y: 38, w: 28, h: 44 }), humanRole: "forearm", pivot: { x: 4, y: 8 }, joint: { x: 16, y: 24 }, handTip: { x: 24, y: 34 } },
  ];
}

function foldedGuardArm02RearParts() {
  return [
    part("body", "body", { x: 90, y: 30, w: 22, h: 70 }),
    part("head", "head", { x: 52, y: 10, w: 32, h: 34 }),
    part("face_layer", "prop", { x: 56, y: 18, w: 24, h: 22 }),
    { ...part("arm_01", "arm", { x: 34, y: 42, w: 42, h: 50 }), humanRole: "forearm", pivot: { x: 34, y: 8 }, joint: { x: 20, y: 28 }, handTip: { x: 5, y: 36 } },
    { ...part("arm_02", "arm", { x: 86, y: 40, w: 60, h: 54 }), humanRole: "forearm", pivot: { x: 45, y: 10 }, joint: { x: 18, y: 28 }, handTip: { x: -8, y: 33 } },
  ];
}

function loadedFrontJabBridge(Animotion) {
  return Animotion.cutsceneModel.normalizeBridge({
    primaryPartId: "arm_02",
    durationFrames: 36,
    impactFrame: 24,
    effectDirection: { x: 1, y: -0.25 },
    jointAction: {
      source: "motion-planner-punch-anchors-v1",
      focusKey: "rHand",
      actionTimeline: { template: "punch" },
      targetDebug: { primaryPartId: "arm_02", punchStyle: "jab" },
      beats: [{ id: "impact", at: 24, pose: { rHand: [160, 40] } }],
    },
  });
}

function beatMap(action) {
  return Object.fromEntries(action.beats.map((beat) => [beat.id, beat]));
}

function distance(a, b) {
  return Math.hypot(Number(b[0]) - Number(a[0]), Number(b[1]) - Number(a[1]));
}

function keyPose(parts, id, frame) {
  return parts.find((part) => part.id === id)?.keyframes.find((keyframe) => keyframe.frame === frame)?.pose || {};
}

function poseMagnitude(pose = {}) {
  return Math.hypot(Number(pose.x) || 0, Number(pose.y) || 0);
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

test("front jab load then rear punch generation keeps facing direction and clears stale jab target", () => {
  const Animotion = loadAnimotion();
  Animotion.state.parts = armOnlyPunchParts();
  Animotion.state.project.parts = Animotion.state.parts;
  Animotion.state.selectedPartId = "arm_01";
  Animotion.state.motionPlan = { template: "punch", target: { x: 5, y: 40 }, anchors: [{ key: "rHand", role: "primary", point: { x: 160, y: 40 } }] };
  Animotion.state.cutsceneBridge = loadedFrontJabBridge(Animotion);
  const base = Animotion.jointCoordinates.inferJointPose(Animotion.state.parts);

  clickAuto(Animotion);

  const bridge = Animotion.state.cutsceneBridge;
  const impact = beatMap(bridge.jointAction).impact;
  assert.equal(bridge.primaryPartId, "arm_01");
  assert.equal(bridge.effectDirection.x > 0, true);
  assert.equal(bridge.jointAction.targetDebug.punchStyle, "rear-cross");
  assert.equal(Animotion.state.motionPlan.target.x > base.lHand[0], true);
  assert.equal(Animotion.state.motionPlan.target.x, impact.pose.lHand[0]);
  assert.equal(impact.pose.lHand[0] > base.lHand[0], true);
  assert.equal(bridge.jointAction.anchors.some((anchor) => anchor.key === "rHand"), false);
});

test("arm_02 handTip can classify as rear-cross when face geometry indicates it is the rear hand", () => {
  const Animotion = loadAnimotion();
  Animotion.state.parts = faceLeftArm02RearParts();
  Animotion.state.project.parts = Animotion.state.parts;
  Animotion.state.selectedPartId = "arm_02";
  Animotion.state.motionPlan = { template: "punch", targetMode: false };
  Animotion.state.cutsceneBridge = null;

  clickAuto(Animotion);

  const bridge = Animotion.state.cutsceneBridge;
  const role = bridge.jointAction.targetDebug.roleDecision;
  assert.equal(bridge.primaryPartId, "arm_02");
  assert.equal(bridge.effectDirection.x < 0, true);
  assert.equal(bridge.jointAction.targetDebug.punchStyle, "rear-cross");
  assert.equal(role.selectedPartId, "arm_02");
  assert.equal(role.resolvedPrimaryPartId, "arm_02");
  assert.equal(role.endpointSource, "handTip");
  assert.equal(role.facingDirection.x < 0, true);
  assert.equal(role.handTipPositions.right.x > role.torsoCenter.x, true);
  assert.equal(role.result, "rear-cross");
  assert.equal(role.explicitActionOverride, false);
});

test("folded rear guard handTip near face still classifies arm_02 as rear-cross and targets forward", () => {
  const Animotion = loadAnimotion();
  Animotion.state.parts = foldedGuardArm02RearParts();
  Animotion.state.project.parts = Animotion.state.parts;
  Animotion.state.selectedPartId = "arm_02";
  Animotion.state.motionPlan = { template: "punch", targetMode: false };
  Animotion.state.cutsceneBridge = null;
  const base = Animotion.jointCoordinates.inferJointPose(Animotion.state.parts);

  clickAuto(Animotion);

  const bridge = Animotion.state.cutsceneBridge;
  const role = bridge.jointAction.targetDebug.roleDecision;
  const target = bridge.jointAction.targetDebug.convertedTarget;
  const head = Animotion.state.parts.find((part) => part.id === "head").rect;
  assert.equal(bridge.primaryPartId, "arm_02");
  assert.equal(bridge.jointAction.targetDebug.punchStyle, "rear-cross");
  assert.equal(role.endpointSource, "handTip");
  assert.equal(role.selectedHandTipPosition.x < role.torsoCenter.x, true);
  assert.equal(role.shoulderPosition.x > role.torsoCenter.x, true);
  assert.equal(role.classificationBasis, "shoulder-side");
  assert.equal(target.x < head.x - 20, true);
  assert.equal(target.y <= base.rHand[1], true);
  assert.equal(bridge.jointAction.beats.find((beat) => beat.id === "impact").pose.rHand[0], target.x);
});

test("separate front chain uses terminal glove endpoint and jab path", () => {
  const Animotion = loadAnimotion();
  Animotion.state.parts = separateBoxerParts();
  Animotion.state.project.parts = Animotion.state.parts;
  Animotion.state.selectedPartId = "front_forearm";
  Animotion.state.motionPlan = { template: "punch", targetMode: false };

  clickAuto(Animotion);

  const bridge = Animotion.state.cutsceneBridge;
  const impact = beatMap(bridge.jointAction).impact;
  assert.equal(bridge.primaryPartId, "front_glove");
  assert.equal(bridge.jointAction.actionTimeline.template, "punch");
  assert.equal(bridge.jointAction.targetDebug.punchStyle, "jab");
  assert.equal(bridge.jointAction.targetDebug.terminalPunchPartId, "front_glove");
  assert.equal(bridge.jointAction.targetDebug.separateRigPath, true);
  assert.equal(bridge.jointAction.targetDebug.handParentIsForearm, true);
  assert.equal(bridge.jointAction.targetDebug.forearmParentIsUpperArm, true);
  assert.equal(bridge.jointAction.targetDebug.elbowConnectionValid, true);
  assert.equal(bridge.jointAction.targetDebug.wristConnectionValid, true);
  assert.equal(bridge.jointAction.targetDebug.chainParentingValid, true);
  assert.equal(bridge.jointAction.targetDebug.terminalPunchPointSource, "handTip");
  assert.equal(bridge.jointAction.targetDebug.replacementLayerUsed, false);
  assert.equal(bridge.jointAction.targetDebug.selectedToEndpointText, "selected front_forearm -> punching endpoint front_glove");
  assert.equal(bridge.jointAction.bindingProfile.leadArm.mode, "compositeRigid");
  assert.equal(JSON.stringify(bridge.jointAction.bindingProfile.lockedPartIds), JSON.stringify(["front_upperArm", "front_forearm", "front_glove"]));
  assert.equal(poseMagnitude(keyPose(Animotion.state.parts, "front_upperArm", impact.at)) > 0, true);
  assert.deepEqual(keyPose(Animotion.state.parts, "front_forearm", impact.at), Animotion.motionModel.defaultCustomMotion());
  assert.deepEqual(keyPose(Animotion.state.parts, "front_glove", impact.at), Animotion.motionModel.defaultCustomMotion());
});

test("separate rear chain uses terminal glove endpoint and rear-cross path", () => {
  const Animotion = loadAnimotion();
  Animotion.state.parts = separateBoxerParts();
  Animotion.state.project.parts = Animotion.state.parts;
  Animotion.state.selectedPartId = "rear_upperArm";
  Animotion.state.motionPlan = { template: "punch", targetMode: false };

  clickAuto(Animotion);

  const bridge = Animotion.state.cutsceneBridge;
  assert.equal(bridge.primaryPartId, "rear_glove");
  assert.equal(bridge.jointAction.actionTimeline.template, "punch");
  assert.equal(bridge.jointAction.targetDebug.punchStyle, "rear-cross");
  assert.equal(bridge.jointAction.targetDebug.punchSide, "rear/rear-cross");
  assert.equal(bridge.jointAction.targetDebug.resolvedArmChain.upperArmId, "rear_upperArm");
  assert.equal(bridge.jointAction.targetDebug.resolvedArmChain.forearmId, "rear_forearm");
  assert.equal(bridge.jointAction.targetDebug.resolvedArmChain.handOrGloveId, "rear_glove");
  assert.equal(bridge.jointAction.targetDebug.handParentIsForearm, true);
  assert.equal(bridge.jointAction.targetDebug.forearmParentIsUpperArm, true);
  assert.equal(bridge.jointAction.targetDebug.elbowConnectionValid, true);
  assert.equal(bridge.jointAction.targetDebug.wristConnectionValid, true);
  assert.equal(bridge.jointAction.targetDebug.chainParentingValid, true);
});

test("same separate chain selection preserves adjusted punch target", () => {
  const Animotion = loadAnimotion();
  Animotion.state.parts = separateBoxerParts();
  Animotion.state.project.parts = Animotion.state.parts;
  Animotion.state.selectedPartId = "front_forearm";
  Animotion.state.motionPlan = { template: "punch", target: { x: 176, y: 52 } };
  clickAuto(Animotion);

  Animotion.motionCommands.setMotionPlan({ target: { x: 172, y: 50 } });
  Animotion.state.selectedPartId = "front_upperArm";
  clickAuto(Animotion);

  assert.equal(Animotion.state.cutsceneBridge.primaryPartId, "front_glove");
  assert.deepEqual(JSON.parse(JSON.stringify(Animotion.state.motionPlan.target)), { x: 172, y: 50 });
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
