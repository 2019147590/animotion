const assert = require("node:assert/strict");

globalThis.Animotion = {};
const actionSpecs = require("../scripts/action-specs.js");

function test(name, fn) {
  try {
    fn();
    console.log(`PASS ${name}`);
  } catch (error) {
    console.error(`FAIL ${name}`);
    throw error;
  }
}

test("actionSpecs preserves punch and kick beat ids", () => {
  assert.deepEqual(ids("punch"), ["guard", "windup", "drive", "extension", "impact", "recover"]);
  assert.deepEqual(ids("kick"), ["ready", "compress", "chamber", "extend", "impact", "recover"]);
  assert.equal(actionSpecs.specFor("punch").beats.find((beat) => beat.id === "windup").recoil, -0.24);
  assert.equal(actionSpecs.specFor("kick").beats.find((beat) => beat.id === "chamber").lift, -0.16);
});

test("boxingStep spec exposes editable locomotion frames", () => {
  const spec = actionSpecs.specFor("boxingStep");
  assert.equal(spec.family, "locomotion");
  assert.equal(spec.defaultDurationFrames >= 12 && spec.defaultDurationFrames <= 18, true);
  assert.deepEqual(actionSpecs.editableFrameIds("boxingStep"), [
    "guard",
    "weightShift",
    "leadFootStep",
    "rearFootFollow",
    "settle",
  ]);
});

test("current action specs use extensible body-part focus without requiring props", () => {
  for (const id of ["punch", "kick", "dash", "boxingStep"]) {
    const spec = actionSpecs.specFor(id);
    assert.equal(spec.primaryFocus.owner, "bodyPart");
    assert.equal(spec.focusTarget.owner, "bodyPart");
    assert.deepEqual(spec.requiredProps, []);
    assert.deepEqual(spec.attachments, []);
  }
  assert.deepEqual(actionSpecs.specFor("punch").primaryFocus, { owner: "bodyPart", role: "forearm", point: "handTip" });
  assert.deepEqual(actionSpecs.specFor("kick").primaryFocus, { owner: "bodyPart", role: "shin", point: "footTip" });
  assert.equal(actionSpecs.timelineSpecFor("dash"), null);
});

function ids(template) {
  return actionSpecs.specFor(template).beats.map((beat) => beat.id);
}
