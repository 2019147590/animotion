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
  const context = { window: { Animotion: {} } };
  vm.createContext(context);
  for (const path of [
    "scripts/motion-hints.js",
    "scripts/motion-drafts.js",
    "scripts/motion-draft-editor.js",
  ]) runScript(context, path);
  const Animotion = context.window.Animotion;
  Animotion.state = { motionPlan: {}, cutsceneBridge: null };
  Animotion.motionCommands = {
    currentMotionPlan: () => Animotion.state.motionPlan,
    setMotionPlan(patch) {
      Animotion.state.motionPlan = { ...Animotion.state.motionPlan, ...patch };
      return Animotion.state.motionPlan;
    },
    updateJointAction(action) {
      Animotion.state.cutsceneBridge.jointAction = action;
      return action;
    },
  };
  return Animotion;
}

function runScript(context, path) {
  vm.runInContext(fs.readFileSync(path, "utf8"), context, { filename: path });
}

test("motion draft editor edits the plan draft before action generation", () => {
  const Animotion = loadAnimotion();
  Animotion.state.motionPlan.motionDraft = Animotion.motionDrafts.compileFromHints({
    source: "correspondence",
    occlusion: "partial",
    depthOrder: "behind",
    hiddenCompletion: "required",
  }, { partId: "leg-a", correspondenceId: "corr-1", targetPartType: "foot" });
  const updated = Animotion.motionDraftEditor.updateVisibilityImpactValue(0.35);
  assert.equal(updated.draftScope, "plan");
  assert.equal(Animotion.state.motionPlan.motionDraft.visibility.keyframes[1].value, 0.35);
  const row = Animotion.motionDraftEditor.draftRows()[0];
  assert.equal(row[0], "scope");
  assert.equal(row[1], "plan");
});

test("motion draft editor edits action snapshots without touching the plan draft", () => {
  const Animotion = loadAnimotion();
  const planDraft = Animotion.motionDrafts.compileFromHints({
    source: "correspondence",
    occlusion: "partial",
    depthOrder: "behind",
    hiddenCompletion: "candidate",
  }, { partId: "leg-a", correspondenceId: "corr-1", targetPartType: "foot" });
  Animotion.state.motionPlan.motionDraft = planDraft;
  Animotion.state.cutsceneBridge = {
    jointAction: {
      motionDraft: Animotion.motionDrafts.snapshot(planDraft),
    },
  };
  const updated = Animotion.motionDraftEditor.updateHiddenCompletion({ assetStatus: "ready", assetId: "asset-hidden-leg" });
  assert.equal(updated.draftScope, "action-snapshot");
  assert.equal(updated.hiddenCompletion.assetStatus, "ready");
  assert.equal(updated.hiddenCompletion.assetId, "asset-hidden-leg");
  assert.equal(Animotion.state.motionPlan.motionDraft.hiddenCompletion.assetStatus, "missing");
});

test("motion draft editor is loaded after ui refresh hooks are available", () => {
  const bootstrap = fs.readFileSync("scripts/bootstrap.js", "utf8");
  assert.equal(bootstrap.indexOf('"ui"') < bootstrap.indexOf('"motion-draft-editor"'), true);
  assert.equal(bootstrap.includes("motion-draft-editor"), true);
});
