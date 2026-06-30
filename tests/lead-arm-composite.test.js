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
    "scripts/impact-exaggeration-layer.js",
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
  assert.deepEqual(poseAtTrack(built.result.partTracks, front.upper, 15), Animotion.motionModel.defaultCustomMotion());
  assert.deepEqual(poseAtTrack(built.result.partTracks, front.hand, 35), Animotion.motionModel.defaultCustomMotion());
  assert.equal(poseMagnitude(poseAtTrack(built.result.partTracks, rear.forearm, 56)) > 0, true);
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

function trackFor(tracks, partId) {
  return tracks.find((track) => track.partId === partId);
}

function poseMagnitude(pose = {}) {
  return Math.hypot(Number(pose.x) || 0, Number(pose.y) || 0, Number(pose.rotate) || 0, Number(pose.jointX) || 0, Number(pose.jointY) || 0);
}

function samePose(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}
