const assert = require("node:assert/strict");

globalThis.Animotion = {};
const arbitration = require("../scripts/preview-pointer-arbitration.js");

function test(name, fn) {
  try {
    fn();
    console.log(`PASS ${name}`);
  } catch (error) {
    console.error(`FAIL ${name}`);
    throw error;
  }
}

function reset(overrides = {}) {
  const Animotion = globalThis.Animotion;
  for (const key of Object.keys(Animotion)) delete Animotion[key];
  Object.assign(Animotion, { state: {}, ...overrides });
}

function eventStub() {
  return {
    stopped: 0,
    preventDefault() {},
    stopImmediatePropagation() { this.stopped += 1; },
  };
}

test("motion trajectory wins over selected part body hit", () => {
  reset({
    previewPartDrag: { partBodyTarget: () => ({ label: "selected part" }) },
    trajectoryEditor: { hitTarget: () => ({ label: "trajectory point" }) },
  });
  const target = arbitration.decideTarget(arbitration.collectTargets(eventStub()));
  assert.equal(target.kind, "motion-trajectory-point");
});

test("beginPointerDown dispatches selected part body drag through the arbiter", () => {
  let started = 0;
  const event = eventStub();
  reset({
    previewPartDrag: {
      partBodyTarget: () => ({ label: "selected part" }),
      beginDragFromTarget: () => { started += 1; return true; },
    },
  });
  const result = arbitration.beginPointerDown(event);
  assert.equal(result.target.kind, "part-body");
  assert.equal(started, 1);
  assert.equal(event.stopped, 1);
});
