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
    "scripts/human-rig-schema.js",
    "scripts/arm-role-semantics.js",
    "scripts/rigging.js",
    "scripts/rig-connection.js",
    "scripts/arm-chain-resolver.js",
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
    "scripts/action-scoped-effects.js",
    "scripts/impact-exaggeration-layer.js",
    "scripts/pose-assist.js",
    "scripts/joint-coordinates.js",
    "scripts/cutscene-model.js",
    "scripts/motion-anchors.js",
    "scripts/timeline.js",
    "scripts/arm-extension-controls.js",
    "scripts/arm-extension.js",
    "scripts/lead-arm-composite.js",
    "scripts/action-part-visibility.js",
    "scripts/motion-track-builder.js",
    "scripts/boxing-step-locomotion.js",
    "scripts/motion-planner.js",
    "scripts/motion-primary-selection.js",
    "scripts/legacy-action-clips.js",
    "scripts/combo-timeline.js",
    "scripts/cutscene-motion-status.js",
  ]) runScript(context, path);
  return context.window.Animotion;
}

function runScript(context, path) {
  vm.runInContext(fs.readFileSync(path, "utf8"), context, { filename: path });
}

function projectParts(Animotion, file) {
  const payload = JSON.parse(fs.readFileSync(file, "utf8"));
  const project = Animotion.projectModel.normalizeProject(payload, { imageBounds: { width: payload.canvas.width, height: payload.canvas.height } });
  return Animotion.projectModel.editorPartsFromProject(project);
}

test("17 jab uses lead arm composite ownership instead of segmented member tracks", () => {
  const Animotion = loadAnimotion();
  const parts = projectParts(Animotion, "animotion-project (17).json");
  const ids = frontChainIds();
  const bridge = Animotion.cutsceneModel.normalizeBridge({ durationFrames: 18, impactFrame: 15, effectDirection: { x: 1, y: 0 } });
  const plan = Animotion.motionPlanner.createPlan(parts, ids.hand, bridge, { template: "punch" });
  const impact = plan.jointAction.beats.find((beat) => beat.id === "impact").at;

  assert.equal(plan.jointAction.targetDebug.punchStyle, "jab");
  assert.equal(plan.jointAction.bindingProfile.leadArm.mode, "compositeRigid");
  assert.equal(JSON.stringify(plan.jointAction.bindingProfile.lockedPartIds), JSON.stringify([ids.upper, ids.forearm, ids.hand]));
  assert.equal(plan.jointAction.targetDebug.leadArmComposite.mode, "compositeRigid");
  assert.equal(poseMagnitude(poseAt(plan, ids.upper, impact)) > 0, true);
  assert.deepEqual(poseAt(plan, ids.forearm, impact), Animotion.motionModel.defaultCustomMotion());
  assert.deepEqual(poseAt(plan, ids.hand, impact), Animotion.motionModel.defaultCustomMotion());
});

test("17 jab uses lead whole-arm proxy when usage is present", () => {
  const Animotion = loadAnimotion();
  const parts = withLeadProxy(projectParts(Animotion, "animotion-project (17).json"));
  const ids = frontChainIds();
  const bridge = Animotion.cutsceneModel.normalizeBridge({ durationFrames: 18, impactFrame: 15, effectDirection: { x: 1, y: 0 } });
  const plan = Animotion.motionPlanner.createPlan(parts, ids.hand, bridge, { template: "punch" });
  const impact = plan.jointAction.beats.find((beat) => beat.id === "impact").at;
  const proxyTrack = trackFor(plan.partTracks, "leadWholeArmJabProxy");

  assert.equal(plan.primaryPartId, "leadWholeArmJabProxy");
  assert.equal(plan.effectivePrimaryPartId, "leadWholeArmJabProxy");
  assert.equal(plan.originalPrimaryPartId, ids.hand);
  assert.equal(plan.jointAction.effectivePrimaryPartId, "leadWholeArmJabProxy");
  assert.equal(plan.jointAction.targetDebug.primaryPartId, "leadWholeArmJabProxy");
  assert.equal(plan.jointAction.targetDebug.effectivePrimaryPartId, "leadWholeArmJabProxy");
  assert.equal(plan.jointAction.targetDebug.originalSelectedPartId, ids.hand);
  assert.equal(plan.jointAction.targetDebug.originalPrimaryPartId, ids.hand);
  assert.equal(plan.jointAction.targetDebug.terminalPunchPartId, "leadWholeArmJabProxy");
  assert.equal(plan.jointAction.targetDebug.originalTerminalPunchPartId, ids.hand);
  assert.equal(plan.jointAction.targetDebug.separateRigPath, false);
  assert.equal(plan.jointAction.targetDebug.segmentedLeadLocked, true);
  assert.equal(plan.jointAction.bindingProfile.leadArm.mode, "wholeArmProxy");
  assert.equal(plan.jointAction.bindingProfile.leadArm.proxyPartId, "leadWholeArmJabProxy");
  assert.equal(plan.jointAction.targetDebug.leadArmComposite.mode, "wholeArmProxy");
  assert.equal(JSON.stringify(proxyTrack.keyframes.map((keyframe) => keyframe.frame)), JSON.stringify([1, 4, 8, 12, 15, 18]));
  assert.equal(proxyTrack.keyframes.length > 0, true);
  assert.equal(Math.hypot(poseAt(plan, "leadWholeArmJabProxy", impact).jointX, poseAt(plan, "leadWholeArmJabProxy", impact).jointY) > 0, true);
  assert.equal(poseMagnitude(poseAt(plan, "leadWholeArmJabProxy", impact)) > 0, true);
  assert.deepEqual(poseAt(plan, ids.upper, impact), Animotion.motionModel.defaultCustomMotion());
  assert.deepEqual(poseAt(plan, ids.forearm, impact), Animotion.motionModel.defaultCustomMotion());
  assert.deepEqual(poseAt(plan, ids.hand, impact), Animotion.motionModel.defaultCustomMotion());
  assert.equal(trackFor(plan.partTracks, ids.upper).keyframes.every((keyframe) => samePose(keyframe.pose, Animotion.motionModel.defaultCustomMotion())), true);
  assert.equal(trackFor(plan.partTracks, ids.forearm).keyframes.every((keyframe) => samePose(keyframe.pose, Animotion.motionModel.defaultCustomMotion())), true);
  assert.equal(trackFor(plan.partTracks, ids.hand).keyframes.every((keyframe) => samePose(keyframe.pose, Animotion.motionModel.defaultCustomMotion())), true);
  assert.equal(Animotion.leadArmComposite.runtimeVisible(parts.find((part) => part.id === "leadWholeArmJabProxy"), { action: plan.jointAction }), true);
  assert.equal(Animotion.leadArmComposite.runtimeVisible(parts.find((part) => part.id === ids.upper), { action: plan.jointAction }), false);

  const status = Animotion.cutsceneMotionStatus.statusForBridge({ ...bridge, primaryPartId: plan.primaryPartId, jointAction: plan.jointAction }, { parts, currentFrame: impact });
  const text = Animotion.cutsceneMotionStatus.statusText(status);
  assert.equal(status.primaryPartId, "leadWholeArmJabProxy");
  assert.equal(text.includes("leadArmMode=wholeArmProxy"), true);
  assert.equal(text.includes("proxyPartId=leadWholeArmJabProxy"), true);
  assert.equal(text.includes("effectivePrimaryPartId=leadWholeArmJabProxy"), true);
  assert.equal(text.includes(`originalSelectedPartId=${ids.hand}`), true);
  assert.equal(text.includes("segmentedLeadLocked=true"), true);
});

test("jab uses lead whole-arm proxy even when proxy itself is selected", () => {
  const Animotion = loadAnimotion();
  const parts = withLeadProxy(projectParts(Animotion, "animotion-project (17).json"));
  const ids = frontChainIds();
  const bridge = Animotion.cutsceneModel.normalizeBridge({ durationFrames: 18, impactFrame: 15, effectDirection: { x: 1, y: 0 } });
  const plan = Animotion.motionPlanner.createPlan(parts, "leadWholeArmJabProxy", bridge, { template: "punch" });
  const proxyTrack = trackFor(plan.partTracks, "leadWholeArmJabProxy");

  assert.equal(plan.primaryPartId, "leadWholeArmJabProxy");
  assert.equal(plan.jointAction.bindingProfile.leadArm.mode, "wholeArmProxy");
  assert.equal(plan.jointAction.bindingProfile.leadArm.proxyPartId, "leadWholeArmJabProxy");
  assert.equal(plan.jointAction.bindingProfile.leadArm.members.leadUpperArm, ids.upper);
  assert.equal(plan.jointAction.bindingProfile.leadArm.members.leadForearm, ids.forearm);
  assert.equal(plan.jointAction.bindingProfile.leadArm.members.leadHand, ids.hand);
  assert.equal(JSON.stringify(plan.jointAction.bindingProfile.lockedPartIds), JSON.stringify([ids.upper, ids.forearm, ids.hand, "leadWholeArmJabProxy"]));
  assert.equal(plan.jointAction.targetDebug.segmentedLeadLocked, true);
  assert.equal(plan.jointAction.targetDebug.leadArmComposite.mode, "wholeArmProxy");
  assert.equal(plan.jointAction.targetDebug.proxyPartId, "leadWholeArmJabProxy");
  assert.equal(plan.jointAction.targetDebug.originalSelectedPartId, "leadWholeArmJabProxy");
  assert.equal(plan.jointAction.targetDebug.originalSegmentedLeadHandId, ids.hand);
  assert.equal(plan.jointAction.targetDebug.originalTerminalPunchPartId, ids.hand);
  assert.equal(plan.jointAction.targetDebug.resolvedArmChain.handOrGloveId, ids.hand);
  assert.equal(JSON.stringify(plan.jointAction.impactExaggeration.targetPartIds), JSON.stringify(["leadWholeArmJabProxy"]));
  for (const frame of [8, 12, 15]) {
    const pose = proxyTrack.keyframes.find((keyframe) => keyframe.frame === frame).pose;
    assert.equal(Math.hypot(pose.jointX, pose.jointY) > 0, true);
    assert.equal(Math.hypot(pose.x, pose.y) <= 0.001, true);
  }
  assert.equal(trackFor(plan.partTracks, ids.upper).keyframes.every((keyframe) => samePose(keyframe.pose, Animotion.motionModel.defaultCustomMotion())), true);
  assert.equal(trackFor(plan.partTracks, ids.forearm).keyframes.every((keyframe) => samePose(keyframe.pose, Animotion.motionModel.defaultCustomMotion())), true);
  assert.equal(trackFor(plan.partTracks, ids.hand).keyframes.every((keyframe) => samePose(keyframe.pose, Animotion.motionModel.defaultCustomMotion())), true);
});

test("17 rearCross keeps rear segmented chain behavior", () => {
  const Animotion = loadAnimotion();
  const parts = projectParts(Animotion, "animotion-project (17).json");
  const ids = rearChainIds();
  const bridge = Animotion.cutsceneModel.normalizeBridge({ durationFrames: 18, impactFrame: 15, effectDirection: { x: 1, y: 0 } });
  const plan = Animotion.motionPlanner.createPlan(parts, ids.hand, bridge, { template: "rearHandPunch01" });
  const impact = plan.jointAction.beats.find((beat) => beat.id === "impact").at;

  assert.equal(plan.jointAction.targetDebug.punchStyle, "rear-cross");
  assert.equal(plan.jointAction.bindingProfile, undefined);
  assert.equal(poseMagnitude(poseAt(plan, ids.upper, impact)) > 0, true);
  assert.equal(poseMagnitude(poseAt(plan, ids.forearm, impact)) > poseMagnitude(poseAt(plan, ids.upper, impact)), true);
  assert.equal(poseMagnitude(poseAt(plan, ids.hand, impact)) > 0, true);
});

test("17 rearCross hides lead whole-arm proxy and keeps lead segmented members visible", () => {
  const Animotion = loadAnimotion();
  const parts = withLeadProxy(projectParts(Animotion, "animotion-project (17).json"));
  const front = frontChainIds(), rear = rearChainIds();
  const bridge = Animotion.cutsceneModel.normalizeBridge({ durationFrames: 18, impactFrame: 15, effectDirection: { x: 1, y: 0 } });
  const plan = Animotion.motionPlanner.createPlan(parts, rear.hand, bridge, { template: "rearHandPunch01" });

  assert.equal(plan.jointAction.targetDebug.punchStyle, "rear-cross");
  assert.equal(plan.jointAction.bindingProfile, undefined);
  assert.equal(Animotion.leadArmComposite.runtimeVisible(parts.find((part) => part.id === "leadWholeArmJabProxy"), { action: plan.jointAction }), false);
  assert.equal(Animotion.leadArmComposite.runtimeVisible(parts.find((part) => part.id === front.upper), { action: plan.jointAction }), true);
  assert.equal(Animotion.leadArmComposite.runtimeVisible(parts.find((part) => part.id === front.forearm), { action: plan.jointAction }), true);
  assert.equal(Animotion.leadArmComposite.runtimeVisible(parts.find((part) => part.id === front.hand), { action: plan.jointAction }), true);
});

test("jab_jab_cross keeps jab composite frames and rearCross segmented frame", () => {
  const Animotion = loadAnimotion();
  const parts = projectParts(Animotion, "animotion-project (17).json");
  const front = frontChainIds(), rear = rearChainIds();
  const built = Animotion.comboTimeline.buildComboTimeline(Animotion.comboTimeline.specFor("jab_jab_cross"), {
    parts,
    selectedPartId: front.forearm,
    plan: { template: "punch", targetMode: false },
  });
  const impacts = built.bridge.jointAction.beats.filter((beat) => beat.id.endsWith(":impact")).map((beat) => beat.at);

  assert.equal(JSON.stringify(impacts), JSON.stringify([15, 35, 56]));
  assert.deepEqual(poseAtTrack(built.result.partTracks, front.forearm, 15), Animotion.motionModel.defaultCustomMotion());
  assert.deepEqual(poseAtTrack(built.result.partTracks, front.hand, 35), Animotion.motionModel.defaultCustomMotion());
  assert.equal(poseMagnitude(poseAtTrack(built.result.partTracks, front.upper, 35)) > 0, true);
  assert.equal(poseMagnitude(poseAtTrack(built.result.partTracks, rear.forearm, 56)) > 0, true);
});

test("jab_jab_cross uses lead whole-arm proxy for jab steps when available", () => {
  const Animotion = loadAnimotion();
  const parts = withLeadProxy(projectParts(Animotion, "animotion-project (17).json"));
  const front = frontChainIds(), rear = rearChainIds();
  const built = Animotion.comboTimeline.buildComboTimeline(Animotion.comboTimeline.specFor("jab_jab_cross"), {
    parts,
    selectedPartId: front.forearm,
    plan: { template: "punch", targetMode: false },
  });

  assert.equal(poseMagnitude(poseAtTrack(built.result.partTracks, "leadWholeArmJabProxy", 15)) > 0, true);
  assert.equal(poseMagnitude(poseAtTrack(built.result.partTracks, "leadWholeArmJabProxy", 35)) > 0, true);
  assert.equal(built.bridge.jointAction.comboTimeline.steps[0].bindingProfile.leadArm.mode, "wholeArmProxy");
  assert.equal(built.bridge.jointAction.comboTimeline.steps[1].bindingProfile.leadArm.mode, "wholeArmProxy");
  assert.deepEqual(poseAtTrack(built.result.partTracks, front.upper, 15), Animotion.motionModel.defaultCustomMotion());
  assert.deepEqual(poseAtTrack(built.result.partTracks, front.hand, 35), Animotion.motionModel.defaultCustomMotion());
  assert.equal(poseMagnitude(poseAtTrack(built.result.partTracks, rear.forearm, 56)) > 0, true);
});

test("jab_jab_cross applies proxy jab tracks and step visibility before rearCross", () => {
  const Animotion = loadAnimotion();
  const parts = withLeadProxy(projectParts(Animotion, "animotion-project (17).json"));
  const front = frontChainIds(), rear = rearChainIds();
  const built = Animotion.comboTimeline.buildComboTimeline(Animotion.comboTimeline.specFor("jab_jab_cross"), {
    parts,
    selectedPartId: front.forearm,
    plan: { template: "punch", targetMode: false },
  });
  const action = built.bridge.jointAction;
  const hiddenFill = { id: "body_01 copy", usage: "rearCrossHiddenFill", createdForActionId: "rearCross" };
  const proxyFrame8 = evaluatedPose(Animotion, built.result.partTracks, "leadWholeArmJabProxy", 8);
  const proxyFrame26 = evaluatedPose(Animotion, built.result.partTracks, "leadWholeArmJabProxy", 26);

  assert.equal(Math.hypot(proxyFrame8.jointX, proxyFrame8.jointY) > 0, true);
  assert.equal(Math.hypot(proxyFrame26.jointX, proxyFrame26.jointY) > 0, true);
  assert.equal(Animotion.actionPartVisibility.runtimeVisible(parts.find((part) => part.id === "leadWholeArmJabProxy"), { action, frame: 8 }), true);
  assert.equal(Animotion.actionPartVisibility.runtimeVisible(parts.find((part) => part.id === front.upper), { action, frame: 8 }), false);
  assert.equal(Animotion.actionPartVisibility.runtimeVisible(hiddenFill, { action, frame: 8 }), false);
  assert.equal(Animotion.actionPartVisibility.runtimeVisible(hiddenFill, { action, frame: 26 }), false);
  assert.equal(Animotion.actionPartVisibility.runtimeVisible(hiddenFill, { action, frame: 45 }), true);
  for (const partId of [rear.upper, rear.forearm, rear.hand]) {
    assert.deepEqual(evaluatedPose(Animotion, built.result.partTracks, partId, 8), Animotion.motionModel.defaultCustomMotion());
    assert.deepEqual(evaluatedPose(Animotion, built.result.partTracks, partId, 26), Animotion.motionModel.defaultCustomMotion());
  }
});

test("jab_jab_cross uses legacy rearCross17 clip without calling rear generator", () => {
  const Animotion = loadAnimotion();
  const parts = withLeadProxy(projectParts(Animotion, "animotion-project (17).json"));
  const front = frontChainIds(), rear = rearChainIds();
  let rearGeneratorCalls = 0;
  const built = Animotion.comboTimeline.buildComboTimeline(Animotion.comboTimeline.specFor("jab_jab_cross"), {
    parts,
    selectedPartId: front.forearm,
    plan: { template: "punch", targetMode: false },
    actionFrameGenerator(partsArg, primaryId, bridge, plan, item) {
      if (plan.template === "rearHandPunch01") rearGeneratorCalls += 1;
      return Animotion.motionPlanner.createPlan(partsArg, primaryId, bridge, plan, item);
    },
  });
  const rearStep = built.bridge.jointAction.comboTimeline.steps[2];
  const legacy = Animotion.legacyActionClips.clipFor("legacyRearCross17");

  assert.equal(rearGeneratorCalls, 0);
  assert.equal(rearStep.source, "legacyClip");
  assert.equal(rearStep.clipId, "legacyRearCross17");
  assert.equal(rearStep.primaryPartId, rear.hand);
  assert.equal(rearStep.targetDebug.resolvedArmChain.handOrGloveId, rear.hand);
  for (const partId of [rear.hand, rear.forearm, rear.upper, Animotion.legacyActionClips.IDS.bodyFill]) {
    assert.deepEqual(poseAtTrack(built.result.partTracks, partId, 56), poseAtTrack(legacy.partTracks, partId, 15));
  }
});

test("rearCross generator fallback runs only when legacy rearCross17 clip is missing", () => {
  const Animotion = loadAnimotion();
  const parts = withLeadProxy(projectParts(Animotion, "animotion-project (17).json"));
  const front = frontChainIds();
  let rearGeneratorCalls = 0;
  const built = Animotion.comboTimeline.buildComboTimeline(Animotion.comboTimeline.specFor("jab_jab_cross"), {
    parts,
    selectedPartId: front.forearm,
    plan: { template: "punch", targetMode: false },
    legacyClips: null,
    actionFrameGenerator(partsArg, primaryId, bridge, plan, item) {
      if (plan.template === "rearHandPunch01") rearGeneratorCalls += 1;
      return Animotion.motionPlanner.createPlan(partsArg, primaryId, bridge, plan, item);
    },
  });
  const rearStep = built.bridge.jointAction.comboTimeline.steps[2];

  assert.equal(rearGeneratorCalls, 1);
  assert.equal(rearStep.source, "generator");
  assert.equal(rearStep.template, "rearHandPunch01");
});

test("project model preserves leadWholeArmJabProxy usage metadata", () => {
  const Animotion = loadAnimotion();
  const parts = withLeadProxy(projectParts(Animotion, "animotion-project (17).json"));
  const projectPart = Animotion.projectModel.normalizeProjectPart(parts.find((part) => part.id === "leadWholeArmJabProxy"), 0, { imageBounds: { width: 1023, height: 1537 } });
  const editorPart = Animotion.projectModel.editorPartsFromProject({ parts: [projectPart], motions: [] })[0];

  assert.equal(projectPart.usage, "leadWholeArmJabProxy");
  assert.equal(editorPart.usage, "leadWholeArmJabProxy");
});

test("8 whole-arm jab curve can be extracted as a reference curve", () => {
  const Animotion = loadAnimotion();
  const parts = projectParts(Animotion, "animotion-project (8).json");
  const wholeArm = parts.find((part) => part.name === "arm_01");
  const curve = Animotion.leadArmComposite.referenceCurveFromPart(wholeArm);

  assert.equal(curve.sourcePartId, wholeArm.id);
  assert.equal(curve.frames.length, 6);
  assert.equal(curve.frames.some((frame) => frame.pose.jointX > 100), true);
});

function frontChainIds() {
  return {
    upper: "43980827-5992-494c-a335-e517c7c520ae",
    forearm: "818af1f7-ceaa-43d3-824a-9f98197c678b",
    hand: "8edc8110-4e13-4df6-8a69-26be8625f523",
  };
}

function rearChainIds() {
  return {
    upper: "344d68b5-da9a-4a05-ae0c-aef075518a3d",
    forearm: "612d3ea0-7471-4649-8a61-7da9055cfc76",
    hand: "316845c3-0e83-4880-94d7-df6d83852448",
  };
}

function withLeadProxy(parts) {
  const source = parts.find((part) => part.id === frontChainIds().upper);
  return [...parts, {
    ...source,
    id: "leadWholeArmJabProxy",
    name: "leadWholeArmJabProxy",
    usage: "leadWholeArmJabProxy",
    parentId: null,
    parentPartId: null,
    keyframes: [],
  }];
}

function poseAt(plan, partId, frame) {
  return poseAtTrack(plan.partTracks, partId, frame);
}

function poseAtTrack(tracks, partId, frame) {
  return tracks.find((track) => track.partId === partId).keyframes.find((keyframe) => keyframe.frame === frame).pose;
}

function evaluatedPose(Animotion, tracks, partId, frame) {
  return Animotion.timeline.evaluatePartAtFrame({ keyframes: trackFor(tracks, partId).keyframes }, frame);
}

function trackFor(tracks, partId) {
  return tracks.find((track) => track.partId === partId);
}

function poseMagnitude(pose = {}) {
  return Math.hypot(Number(pose.x) || 0, Number(pose.y) || 0, Number(pose.rotate) || 0, Number(pose.jointX) || 0, Number(pose.jointY) || 0);
}

function samePose(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}
