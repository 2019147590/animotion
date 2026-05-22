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
    "scripts/timeline.js",
    "scripts/arm-extension.js",
    "scripts/motion-planner.js",
    "scripts/motion-path-explainer.js",
  ]) runScript(context, path);
  return context.window.Animotion;
}

function runScript(context, path) {
  vm.runInContext(fs.readFileSync(path, "utf8"), context, { filename: path });
}

test("explainer is inactive for image upload reset with no cutscene bridge", () => {
  const Animotion = loadAnimotion();
  assert.equal(Animotion.motionPathExplainer.explain(null, { parts: [] }).active, false);
  assert.equal(Animotion.motionPathExplainer.explain({ jointAction: null }, { parts: [] }).active, false);
});

test("rear arm-only punch explainer exposes endpoint style beats and follow rules", () => {
  const Animotion = loadAnimotion();
  const parts = rearArmOnlyParts();
  const bridge = Animotion.cutsceneModel.normalizeBridge({ durationFrames: 36, impactFrame: 24, primaryPartId: "arm_01" });
  const plan = Animotion.motionPlanner.createPlan(parts, "arm_01", bridge, { template: "punch", target: { x: 160, y: 30 } });
  const info = Animotion.motionPathExplainer.explain({ ...bridge, jointAction: plan.jointAction }, { parts, plan });
  assert.equal(info.active, true);
  assert.equal(info.type, "punch");
  assert.equal(info.style, "rear-cross");
  assert.equal(info.styleSource, "explicit");
  assert.equal(info.rearArmOnly, true);
  assert.equal(info.endpoint.includes("추정 handTip"), true);
  assert.equal(info.beats.some((entry) => entry.includes("당김")), true);
  assert.equal(info.beats.some((entry) => entry.includes("타격")), true);
  assert.equal(info.anchors.includes("lHand:목표"), true);
  assert.equal(info.anchors.includes("lElbow:굽힘"), true);
});

test("legacy rear punch explainer reports inferred legacy style without requiring saved metadata", () => {
  const Animotion = loadAnimotion();
  const parts = rearArmOnlyParts();
  const bridge = {
    primaryPartId: "arm_01",
    durationFrames: 36,
    impactFrame: 24,
    jointAction: {
      source: "motion-planner-punch-anchors-v1",
      focusKey: "lHand",
      actionTimeline: { template: "punch" },
      beats: [{ id: "impact", at: 24, pose: { lHand: [160, 30] } }],
    },
  };
  const info = Animotion.motionPathExplainer.explain(bridge, { parts });
  assert.equal(info.style, "rear-cross");
  assert.equal(info.styleSource, "inferredLegacy");
  assert.equal(info.legacy, true);
});

test("front jab explainer stays on jab path and bootstrap loads it before ui", () => {
  const Animotion = loadAnimotion();
  const parts = rearArmOnlyParts();
  const bridge = Animotion.cutsceneModel.normalizeBridge({ durationFrames: 36, impactFrame: 24, primaryPartId: "arm_02" });
  const plan = Animotion.motionPlanner.createPlan(parts, "arm_02", bridge, { template: "punch", target: { x: 160, y: 60 } });
  const info = Animotion.motionPathExplainer.explain({ ...bridge, jointAction: plan.jointAction }, { parts, plan });
  const bootstrap = fs.readFileSync("scripts/bootstrap.js", "utf8");
  const css = fs.readFileSync("styles/components.css", "utf8");
  assert.equal(info.style, "jab");
  assert.equal(info.rearArmOnly, false);
  assert.equal(bootstrap.indexOf('"motion-path-explainer"') < bootstrap.indexOf('"ui"'), true);
  assert.equal(css.includes(".motion-path-explainer.hidden"), true);
});

function rearArmOnlyParts() {
  return [
    { id: "body", name: "body", type: "body", humanRole: "torso", rect: { x: 40, y: 20, w: 20, h: 50 }, pivot: { x: 10, y: 25 }, joint: { x: 10, y: 40 } },
    { id: "head", name: "head", type: "head", humanRole: "head", rect: { x: 38, y: 4, w: 24, h: 20 }, pivot: { x: 12, y: 10 }, joint: { x: 12, y: 16 } },
    { id: "arm_01", name: "rear arm", type: "arm", humanRole: "forearm", rect: { x: 16, y: 28, w: 36, h: 36 }, pivot: { x: 18, y: 7 }, joint: { x: 24, y: 13 }, keyframes: [] },
    { id: "arm_02", name: "front arm", type: "arm", humanRole: "forearm", rect: { x: 64, y: 28, w: 36, h: 36 }, pivot: { x: 18, y: 7 }, joint: { x: 12, y: 13 }, handTip: { x: 32, y: 31 }, keyframes: [] },
  ];
}
