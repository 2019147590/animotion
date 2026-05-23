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
    "scripts/character-root-motion.js",
    "scripts/pose-assist.js",
    "scripts/joint-coordinates.js",
    "scripts/cutscene-model.js",
    "scripts/motion-anchors.js",
    "scripts/action-timeline-model.js",
    "scripts/impact-exaggeration-layer.js",
    "scripts/render-layer-utils.js",
    "scripts/render-order-debug.js",
    "scripts/arm-chain-resolver.js",
    "scripts/cutscene-depth.js",
    "scripts/timeline.js",
    "scripts/arm-extension-controls.js",
    "scripts/arm-extension.js",
    "scripts/motion-replacement-layer.js",
    "scripts/motion-replacement-render.js",
    "scripts/motion-planner.js",
    "scripts/cutscene-motion-status.js",
  ]) runScript(context, path);
  return context.window.Animotion;
}

function runScript(context, path) {
  vm.runInContext(fs.readFileSync(path, "utf8"), context, { filename: path });
}

test("punch cutscene status reports type beat impact body root and target reach", () => {
  const Animotion = loadAnimotion();
  const bridge = Animotion.cutsceneModel.normalizeBridge({ durationFrames: 36, impactFrame: 24, primaryPartId: "arm" });
  const plan = Animotion.motionPlanner.createPlan(parts(), "arm", bridge, { template: "punch", target: { x: 160, y: 30 } });
  const status = Animotion.cutsceneMotionStatus.statusForBridge({
    ...bridge,
    jointAction: plan.jointAction,
  }, { parts: parts(), currentFrame: 24 });
  assert.equal(status.active, true);
  assert.equal(status.actionType, "punch");
  assert.equal(status.currentBeatId, "impact");
  assert.equal(status.impactFrame, 24);
  assert.equal(status.primaryPartRole, "forearm");
  assert.equal(status.primaryPartId, "arm");
  assert.equal(status.bodyRootAssistActive, true);
  assert.equal(status.hipRootAnchorPresent, true);
  assert.deepEqual(JSON.parse(JSON.stringify(status.primaryImpactTarget)), { key: "rHand", x: 160, y: 30 });
  assert.equal(status.recoverFrame, 36);
  const text = Animotion.cutsceneMotionStatus.statusText(status);
  assert.equal(text.includes("punch"), true);
  assert.equal(text.includes("impact 24"), true);
  assert.equal(text.includes("windup 6"), false);
  assert.equal(text.includes("recoil 6"), false);
  assert.equal(text.includes("recover 36"), false);
});

test("kick cutscene status reports chamber and extension timing", () => {
  const Animotion = loadAnimotion();
  const bridge = Animotion.cutsceneModel.normalizeBridge({ durationFrames: 36, impactFrame: 24, primaryPartId: "leg" });
  const plan = Animotion.motionPlanner.createPlan(parts(), "leg", bridge, { template: "kick", target: { x: 160, y: 70 } });
  const status = Animotion.cutsceneMotionStatus.statusForBridge({
    ...bridge,
    jointAction: plan.jointAction,
  }, { parts: parts(), currentFrame: 12 });
  assert.equal(status.actionType, "kick");
  assert.equal(status.currentBeatId, "chamber");
  assert.equal(status.impactFrame, 24);
  assert.equal(status.primaryPartRole, "shin");
  assert.equal(status.hipRootAnchorPresent, true);
  assert.equal(status.extendFrame < status.impactFrame, true);
  assert.equal(status.recoverFrame, 36);
});

test("rear arm-only punch status reports extension and depth runtime debug", () => {
  const Animotion = loadAnimotion();
  const punchParts = rearArmOnlyParts();
  const bridge = Animotion.cutsceneModel.normalizeBridge({ durationFrames: 36, impactFrame: 24, primaryPartId: "arm_01" });
  const plan = Animotion.motionPlanner.createPlan(punchParts, "arm_01", bridge, { template: "punch", target: { x: 160, y: 30 } });
  for (const track of plan.partTracks) punchParts.find((part) => part.id === track.partId).keyframes = track.keyframes;
  const regenerated = { ...bridge, jointAction: plan.jointAction };
  const status = Animotion.cutsceneMotionStatus.statusForBridge(regenerated, { parts: punchParts, currentFrame: 24, selectedPartId: "arm_01", motionTemplate: "cutscene" });
  assert.equal(status.runtime.rearCrossArmOnlyPunch, true);
  assert.equal(status.runtime.armExtensionActive, true);
  assert.equal(status.runtime.handTipSource, "inferred");
  assert.equal(status.runtime.oldWholeArmTranslationReplaced, true);
  assert.equal(status.runtime.replacementActive, true);
  assert.equal(status.runtime.replacementFrame, 24);
  assert.equal(status.runtime.replacementBeat, "impact");
  assert.equal(status.runtime.impactPoseMode, "arm-extension");
  assert.equal(status.runtime.cutsceneDepthActive, true);
  assert.equal(status.runtime.selectedAboveCoveringParts, true);
  assert.equal(status.runtime.punchStyle, "rear-cross");
  assert.equal(status.runtime.punchStyleSource, "explicit");
  assert.equal(Animotion.cutsceneMotionStatus.statusText(status).includes("뒷손 arm-only"), true);
  assert.equal(Animotion.cutsceneMotionStatus.debugText(status).includes("runtime rearCrossArmOnly=yes"), true);
  assert.equal(Animotion.cutsceneMotionStatus.debugText(status).includes("replacement=yes"), true);
});

test("legacy rear arm-only punch status reports inferred style and depth compatibility", () => {
  const Animotion = loadAnimotion();
  const punchParts = rearArmOnlyParts();
  const bridge = {
    primaryPartId: "arm_01",
    impactFrame: 24,
    durationFrames: 36,
    jointAction: {
      source: "motion-planner-punch-anchors-v1",
      focusKey: "lHand",
      actionTimeline: { template: "punch" },
      beats: [{ id: "impact", at: 24, pose: { lHand: [160, 30] } }],
    },
  };
  const status = Animotion.cutsceneMotionStatus.statusForBridge(bridge, { parts: punchParts, currentFrame: 24, selectedPartId: "arm_01", motionTemplate: "cutscene" });
  assert.equal(status.runtime.rearCrossArmOnlyPunch, true);
  assert.equal(status.runtime.punchStyleSource, "inferredLegacy");
  assert.equal(status.runtime.legacyDepthCompat, true);
  assert.equal(status.runtime.cutsceneDepthActive, true);
  assert.equal(Animotion.cutsceneMotionStatus.statusText(status).includes("깊이 보정"), true);
  assert.equal(Animotion.cutsceneMotionStatus.debugText(status).includes("styleSource=inferredLegacy"), true);
});

test("cutscene status reports target-generation failure separately from source-panel and draw-order failures", () => {
  const Animotion = loadAnimotion();
  const punchParts = videoLikeRearCrossParts();
  const bridge = Animotion.cutsceneModel.normalizeBridge({
    primaryPartId: "arm_01",
    impactFrame: 24,
    durationFrames: 36,
    jointAction: {
      source: "motion-planner-punch-anchors-v1",
      focusKey: "lHand",
      actionTimeline: { template: "punch" },
      targetDebug: { punchStyle: "rear-cross", convertedTarget: { x: 550, y: 278 }, selectedPartCurrentPosition: { x: 430, y: 307 } },
      beats: [{ id: "impact", at: 24, pose: { lHand: [550, 278] } }],
    },
  });

  const status = Animotion.cutsceneMotionStatus.statusForBridge(bridge, { parts: punchParts, currentFrame: 24, selectedPartId: "arm_01", motionTemplate: "cutscene" });

  assert.equal(status.runtime.target.rearHandTipStartPosition.x, 430);
  assert.equal(status.runtime.target.generatedTarget.x, 550);
  assert.deepEqual(JSON.parse(JSON.stringify(status.runtime.target.headFaceBounds)), { x: 500, y: 145, w: 130, h: 150 });
  assert.equal(status.runtime.target.targetInsideHeadFaceBounds, true);
  assert.equal(status.runtime.targetGenerationFailure, true);
  assert.equal(status.runtime.sourcePanelOverlapFailure, false);
  assert.equal(status.runtime.actualDrawOrderFailure, false);
  assert.equal(Animotion.cutsceneMotionStatus.debugText(status).includes("targetFailure=yes"), true);
});

test("cutscene status separates replacement render and source erase failures", () => {
  const Animotion = loadAnimotion();
  const punchParts = rearArmOnlyParts();
  const bridge = {
    primaryPartId: "arm_01",
    impactFrame: 24,
    durationFrames: 36,
    jointAction: {
      source: "motion-planner-punch-anchors-v1",
      focusKey: "lHand",
      actionTimeline: { template: "punch" },
      targetDebug: { punchStyle: "rear-cross" },
      beats: [{ id: "impact", at: 24, pose: { lHand: [160, 30] } }],
    },
  };
  const previewDrawSequence = {
    sequence: [
      { index: 0, kind: "panel", pass: "source-panel", sourcePanelMode: "runtime-part-erased", erasedPartIds: ["arm_01"] },
      { index: 1, kind: "part", partId: "arm_01", drawPath: "motion-replacement-failed", pass: "main-part", replacementRenderFailure: true, replacementRenderReason: "degenerate-shoulder-handTip" },
    ],
  };

  const status = Animotion.cutsceneMotionStatus.statusForBridge(bridge, { parts: punchParts, currentFrame: 24, selectedPartId: "arm_01", motionTemplate: "cutscene", previewDrawSequence });

  assert.equal(status.runtime.replacementRenderFailure, true);
  assert.equal(status.runtime.replacementRenderReason, "degenerate-shoulder-handTip");
  assert.equal(status.runtime.sourceEraseWithoutReplacement, true);
  assert.equal(status.runtime.sourcePanelOverlapFailure, false);
  assert.equal(Animotion.cutsceneMotionStatus.statusText(status).includes("대체 렌더 실패"), true);
  assert.equal(Animotion.cutsceneMotionStatus.debugText(status).includes("sourceEraseWithoutReplacement=yes"), true);
});

test("generated rear-cross target evidence shows the fixed target outside head face bounds", () => {
  const Animotion = loadAnimotion();
  const punchParts = videoLikeRearCrossParts();
  const bridge = Animotion.cutsceneModel.normalizeBridge({ primaryPartId: "arm_01", impactFrame: 24, durationFrames: 36, effectDirection: { x: 1, y: 0 } });
  const plan = Animotion.motionPlanner.createPlan(punchParts, "arm_01", bridge, { template: "punch" });
  const status = Animotion.cutsceneMotionStatus.statusForBridge({ ...bridge, jointAction: plan.jointAction }, { parts: punchParts, currentFrame: 24, selectedPartId: "arm_01", motionTemplate: "cutscene" });

  assert.equal(status.runtime.punchStyle, "rear-cross");
  assert.equal(status.runtime.target.generatedTarget.x > status.runtime.target.headFaceBounds.x + status.runtime.target.headFaceBounds.w, true);
  assert.equal(status.runtime.target.targetInsideHeadFaceBounds, false);
  assert.equal(status.runtime.target.targetNearHeadFaceBounds, false);
  assert.equal(status.runtime.targetGenerationFailure, false);
});

test("cutscene status exposes separate rig endpoint and hidden completion debug", () => {
  const Animotion = loadAnimotion();
  const punchParts = [
    { id: "body", type: "body", humanRole: "torso", order: 1, rect: { x: 70, y: 28, w: 24, h: 70 }, pivot: { x: 12, y: 18 }, joint: { x: 12, y: 54 } },
    { id: "rear_upperArm", type: "arm", humanRole: "upperArm", parentId: "body", order: 1, rect: { x: 42, y: 34, w: 28, h: 28 }, pivot: { x: 22, y: 6 }, joint: { x: 8, y: 18 } },
    { id: "rear_forearm", type: "arm", humanRole: "forearm", parentId: "rear_upperArm", order: 2, rect: { x: 24, y: 40, w: 26, h: 28 }, pivot: { x: 20, y: 6 }, joint: { x: 8, y: 18 } },
    { id: "rear_glove", type: "glove", parentId: "rear_forearm", order: 3, rect: { x: 80, y: 48, w: 16, h: 16 }, pivot: { x: 8, y: 8 }, joint: { x: 8, y: 8 } },
  ];
  const bridge = {
    primaryPartId: "rear_glove",
    impactFrame: 24,
    durationFrames: 36,
    jointAction: {
      source: "motion-planner-punch-anchors-v1",
      focusKey: "lHand",
      actionTimeline: { template: "punch" },
      targetDebug: {
        punchStyle: "rear-cross",
        selectedPartId: "rear_forearm",
        terminalPunchPartId: "rear_glove",
        resolvedArmChain: { upperArmId: "rear_upperArm", forearmId: "rear_forearm", handOrGloveId: "rear_glove" },
        punchSide: "rear/rear-cross",
        classificationBasis: "name-hint",
        separateRigPath: true,
        handParentIsForearm: true,
        forearmParentIsUpperArm: true,
        elbowConnectionValid: true,
        wristConnectionValid: true,
        chainParentingValid: true,
        chainParentingWarning: null,
        chainWarnings: [],
        terminalPunchPointSource: "handTip",
        replacementLayerUsed: false,
        wristOverlapHandled: true,
        hiddenCompletionCandidate: true,
        selectedToEndpointText: "selected rear_forearm -> punching endpoint rear_glove",
      },
      beats: [{ id: "drive", at: 10 }, { id: "impact", at: 24, pose: { lHand: [130, 42] } }, { id: "recover", at: 36 }],
    },
  };

  const status = Animotion.cutsceneMotionStatus.statusForBridge(bridge, { parts: punchParts, currentFrame: 24, selectedPartId: "rear_forearm" });

  assert.equal(status.runtime.terminalPunchPartId, "rear_glove");
  assert.equal(status.runtime.handParentIsForearm, true);
  assert.equal(status.runtime.forearmParentIsUpperArm, true);
  assert.equal(status.runtime.elbowConnectionValid, true);
  assert.equal(status.runtime.wristConnectionValid, true);
  assert.equal(status.runtime.chainParentingValid, true);
  assert.equal(status.runtime.chainParentingWarning, null);
  assert.equal(status.runtime.terminalPunchPointSource, "handTip");
  assert.equal(status.runtime.replacementLayerUsed, false);
  assert.equal(status.runtime.wristOverlapHandled, true);
  assert.equal(status.runtime.hiddenCompletionCandidate, true);
  assert.equal(Animotion.cutsceneMotionStatus.statusText(status).includes("selected rear_forearm -> punching endpoint rear_glove"), true);
  assert.equal(Animotion.cutsceneMotionStatus.debugText(status).includes("separateRig=yes"), true);
  assert.equal(Animotion.cutsceneMotionStatus.debugText(status).includes("chainParentingValid=yes"), true);
});

test("cutscene status exposes separate rig parent-chain warning", () => {
  const Animotion = loadAnimotion();
  const punchParts = [
    { id: "body", type: "body", humanRole: "torso", order: 1, rect: { x: 70, y: 28, w: 24, h: 70 }, pivot: { x: 12, y: 18 }, joint: { x: 12, y: 54 } },
    { id: "rear_glove", type: "glove", humanRole: "hand", parentId: "body", order: 3, rect: { x: 80, y: 48, w: 16, h: 16 }, pivot: { x: 8, y: 8 }, joint: { x: 8, y: 8 } },
  ];
  const bridge = {
    primaryPartId: "rear_glove",
    impactFrame: 24,
    durationFrames: 36,
    jointAction: {
      source: "motion-planner-punch-anchors-v1",
      focusKey: "lHand",
      actionTimeline: { template: "punch" },
      targetDebug: {
        punchStyle: "rear-cross",
        selectedPartId: "rear_glove",
        terminalPunchPartId: "rear_glove",
        resolvedArmChain: { upperArmId: null, forearmId: null, handOrGloveId: "rear_glove" },
        separateRigPath: false,
        armOnlyFallback: false,
        handParentIsForearm: false,
        forearmParentIsUpperArm: false,
        elbowConnectionValid: false,
        wristConnectionValid: false,
        chainParentingValid: false,
        chainParentingWarning: "hand/glove parent must be forearm",
        chainWarnings: ["hand/glove parent must be forearm"],
        terminalPunchPointSource: "fallback",
      },
      beats: [{ id: "drive", at: 10 }, { id: "impact", at: 24, pose: { lHand: [130, 42] } }, { id: "recover", at: 36 }],
    },
  };

  const status = Animotion.cutsceneMotionStatus.statusForBridge(bridge, { parts: punchParts, currentFrame: 24, selectedPartId: "rear_glove" });

  assert.equal(status.runtime.handParentIsForearm, false);
  assert.equal(status.runtime.forearmParentIsUpperArm, false);
  assert.equal(status.runtime.elbowConnectionValid, false);
  assert.equal(status.runtime.wristConnectionValid, false);
  assert.equal(status.runtime.chainParentingValid, false);
  assert.equal(status.runtime.chainParentingWarning, "hand/glove parent must be forearm");
  assert.equal(Animotion.cutsceneMotionStatus.statusText(status).includes("chain warning: hand/glove parent must be forearm"), true);
  assert.equal(Animotion.cutsceneMotionStatus.debugText(status).includes("chainParentingValid=no"), true);
});

function rearArmOnlyParts() {
  return [
    { id: "body", type: "body", humanRole: "torso", order: 1, rect: { x: 40, y: 20, w: 20, h: 50 }, pivot: { x: 10, y: 25 }, joint: { x: 10, y: 40 } },
    { id: "arm_01", type: "arm", humanRole: "forearm", order: 2, rect: { x: 16, y: 28, w: 36, h: 36 }, pivot: { x: 18, y: 7 }, joint: { x: 24, y: 13 }, keyframes: [] },
    { id: "arm_02", type: "arm", humanRole: "forearm", order: 3, rect: { x: 64, y: 28, w: 36, h: 36 }, pivot: { x: 18, y: 7 }, joint: { x: 12, y: 13 }, keyframes: [] },
    { id: "head", type: "head", humanRole: "head", order: 5, rect: { x: 38, y: 4, w: 24, h: 20 }, pivot: { x: 12, y: 10 }, joint: { x: 12, y: 16 } },
  ];
}

function videoLikeRearCrossParts() {
  return [
    { id: "body", type: "body", humanRole: "torso", order: 1, rect: { x: 455, y: 255, w: 80, h: 260 }, pivot: { x: 40, y: 60 }, joint: { x: 40, y: 205 } },
    { id: "head_01", name: "head_01", type: "head", humanRole: "head", order: 6, rect: { x: 500, y: 145, w: 130, h: 150 }, pivot: { x: 65, y: 75 }, joint: { x: 65, y: 125 } },
    { id: "arm_01", name: "arm_01", type: "arm", humanRole: "forearm", order: 5, rect: { x: 360, y: 265, w: 92, h: 126 }, pivot: { x: 78, y: 18 }, joint: { x: 48, y: 54 }, handTip: { x: 70, y: 42 }, keyframes: [] },
    { id: "arm_02", name: "arm_02", type: "arm", humanRole: "forearm", order: 7, rect: { x: 610, y: 270, w: 92, h: 126 }, pivot: { x: 14, y: 18 }, joint: { x: 48, y: 54 }, handTip: { x: 82, y: 42 }, keyframes: [] },
  ];
}

test("cutscene status is inactive for non punch kick actions", () => {
  const Animotion = loadAnimotion();
  const status = Animotion.cutsceneMotionStatus.statusForBridge({ jointAction: { beats: [{ id: "arrive", at: 12, pose: { chest: [1, 2] } }] } });
  assert.equal(status.active, false);
});

test("cutscene status is inactive for a new image session without a bridge", () => {
  const Animotion = loadAnimotion();
  assert.equal(Animotion.cutsceneMotionStatus.statusForBridge(null).active, false);
  assert.equal(
    Animotion.cutsceneMotionStatus.statusText(Animotion.cutsceneMotionStatus.statusForBridge(null)),
    "활성 punch/kick 없음"
  );
});

test("app shell exposes punch kick motion status in the motion UI", () => {
  const html = fs.readFileSync("index.html", "utf8");
  const config = fs.readFileSync("scripts/config.js", "utf8");
  const ui = fs.readFileSync("scripts/ui.js", "utf8");
  const bootstrap = fs.readFileSync("scripts/bootstrap.js", "utf8");
  assert.equal(html.includes('id="cutsceneMotionStatus"'), true);
  assert.equal(config.includes("cutsceneMotionStatus"), true);
  assert.equal(ui.includes("renderCutsceneMotionStatus"), true);
  assert.equal(bootstrap.indexOf('"cutscene-motion-status"') < bootstrap.indexOf('"ui"'), true);
});

function parts() {
  return [
    { id: "body", type: "body", humanRole: "torso", rect: { x: 40, y: 20, w: 20, h: 50 }, pivot: { x: 10, y: 25 }, joint: { x: 10, y: 40 } },
    { id: "head", type: "head", humanRole: "head", rect: { x: 38, y: 4, w: 24, h: 20 }, pivot: { x: 12, y: 10 }, joint: { x: 12, y: 16 } },
    { id: "arm", type: "arm", humanRole: "forearm", rect: { x: 64, y: 28, w: 18, h: 32 }, pivot: { x: 2, y: 6 }, joint: { x: 16, y: 24 } },
    { id: "leg", type: "leg", humanRole: "shin", rect: { x: 67, y: 60, w: 18, h: 45 }, pivot: { x: 2, y: 6 }, joint: { x: 16, y: 40 } },
  ];
}
