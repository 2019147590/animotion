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

function loadPresetAction() {
  const context = { window: { Animotion: {} } };
  vm.createContext(context);
  runScript(context, "scripts/lookism-preset-data.js");
  runScript(context, "scripts/lookism-preset-action.js");
  return context.window.Animotion.lookismPresetAction;
}

function runScript(context, path) {
  vm.runInContext(fs.readFileSync(path, "utf8"), context, { filename: path });
}

test("lookism preset samples the first action beat at time zero", () => {
  const action = loadPresetAction();
  const sample = action.sampleAction(0);
  assert.equal(sample.beat.id, "stance");
  assert.equal(sample.pose.hip[0], 305);
  assert.equal(sample.pose.hip[1], 448);
});

test("lookism preset converts action timing into bridge frames", () => {
  const action = loadPresetAction();
  const beats = action.bridgeBeats(12);
  assert.equal(beats.map((beat) => beat.id).join(","), "stance,compress,takeoff,chamber,extend,impact");
  assert.equal(beats.at(-1).at, 12);
});
