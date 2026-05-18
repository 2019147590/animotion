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
    "scripts/config.js",
    "scripts/geometry.js",
    "scripts/motion-model.js",
    "scripts/timeline.js",
    "scripts/cutscene-model.js",
    "scripts/motion-planner.js",
  ]) runScript(context, path);
  const Animotion = context.window.Animotion;
  Animotion.state = { currentFrame: 1, parts: [], project: { parts: [] }, cutsceneBridge: null };
  Animotion.partCommands = {
    updatePart(part, patch) {
      Object.assign(part, patch);
      return part;
    },
  };
  runScript(context, "scripts/motion-commands.js");
  return Animotion;
}

function runScript(context, path) {
  vm.runInContext(fs.readFileSync(path, "utf8"), context, { filename: path });
}

test("motion command inserts sorted keyframes and replaces same-frame pose", () => {
  const Animotion = loadAnimotion();
  const part = partFixture();
  Animotion.state.parts = [part];
  Animotion.motionCommands.insertKeyframe(part, 10, { x: 4 });
  Animotion.motionCommands.insertKeyframe(part, 4, { x: 2 });
  Animotion.motionCommands.insertKeyframe(part, 10, { x: 8 });
  assert.deepEqual(part.keyframes.map((keyframe) => keyframe.frame), [4, 10]);
  assert.equal(part.keyframes[1].pose.x, 8);
  assert.equal(Animotion.state.project.parts, Animotion.state.parts);
});

test("motion command deletes a keyframe and syncs current pose", () => {
  const Animotion = loadAnimotion();
  const part = partFixture({
    keyframes: [
      { frame: 1, pose: { x: 0 } },
      { frame: 9, pose: { x: 16 } },
    ],
  });
  Animotion.state.parts = [part];
  Animotion.motionCommands.deleteKeyframe(part.id, 9);
  assert.deepEqual(part.keyframes.map((keyframe) => keyframe.frame), [1]);
  assert.equal(part.customMotion.x, 0);
});

test("motion command applies generated tracks by part id", () => {
  const Animotion = loadAnimotion();
  const arm = partFixture({ id: "arm" });
  const head = partFixture({ id: "head" });
  Animotion.state.parts = [arm, head];
  Animotion.motionCommands.applyGeneratedTracks([
    { partId: "head", keyframes: [{ frame: 5, pose: { rotate: 12 } }] },
  ]);
  assert.equal(head.keyframes[0].pose.rotate, 12);
  assert.equal(arm.keyframes.length, 0);
});

test("motion command applies a planner result as one state change", () => {
  const Animotion = loadAnimotion();
  const part = partFixture({ id: "leg" });
  Animotion.state.parts = [part];
  Animotion.state.selectedPartId = "leg";
  Animotion.motionCommands.applyMotionPlanResult(
    { primaryPartId: "leg", durationFrames: 18, impactFrame: 15 },
    { template: "unknown", targetMode: true },
    {
      target: { x: 30, y: 40 },
      anchors: [{ key: "rFoot", role: "primary", point: { x: 30, y: 40 } }],
      jointAction: { source: "test", beats: [{ id: "impact", at: 15, pose: { rFoot: [30, 40] } }] },
      partTracks: [{ partId: "leg", keyframes: [{ frame: 15, pose: { x: 9 } }] }],
    }
  );
  assert.equal(Animotion.state.cutsceneBridge.primaryPartId, "leg");
  assert.equal(Animotion.state.motionPlan.template, "kick");
  assert.equal(Animotion.state.motionPlan.target.x, 30);
  assert.equal(part.keyframes[0].pose.x, 9);
});

test("motion command normalizes motion plan patches", () => {
  const Animotion = loadAnimotion();
  Animotion.motionCommands.setMotionPlan({ template: "dash", targetMode: true });
  Animotion.motionCommands.setMotionPlan({ template: "invalid" });
  assert.equal(Animotion.state.motionPlan.template, "kick");
  assert.equal(Animotion.state.motionPlan.targetMode, true);
});

test("motion command normalizes cutscene bridge joint action updates", () => {
  const Animotion = loadAnimotion();
  Animotion.motionCommands.setCutsceneBridge({ durationFrames: 18, impactFrame: 15 });
  Animotion.motionCommands.updateJointAction({
    source: "test",
    beats: [{ id: "impact", at: 15, pose: { head: [10, 20] } }],
  });
  assert.equal(Animotion.state.cutsceneBridge.durationFrames, 18);
  assert.equal(Animotion.state.cutsceneBridge.jointAction.beats[0].pose.head[0], 10);
});

function partFixture(overrides = {}) {
  return {
    id: "part",
    type: "arm",
    rect: { x: 0, y: 0, w: 10, h: 20 },
    customMotion: { x: 0, y: 0, rotate: 0, scaleY: 0, jointX: 0, jointY: 0, phase: 0 },
    keyframes: [],
    ...overrides,
  };
}
