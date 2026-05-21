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
  assert.equal(text.includes("windup 6"), true);
  assert.equal(text.includes("recoil 6"), false);
  assert.equal(text.includes("recover 36"), true);
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
    "Punch/kick motion status: no active punch/kick draft"
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
