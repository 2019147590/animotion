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
  return Animotion;
}

function eventStub() {
  return {
    prevented: 0,
    stopped: 0,
    preventDefault() { this.prevented += 1; },
    stopImmediatePropagation() { this.stopped += 1; },
  };
}

function capturedEvent() {
  const event = eventStub();
  event.pointerId = 1;
  return event;
}

test("selected rigging point wins over overlapping trajectory point", () => {
  reset({
    previewEvents: { hitTarget: () => ({ kind: "selected-part-rigging-point", label: "관절점" }) },
    trajectoryEditor: { hitTarget: () => ({ label: "이동 경로점" }) },
  });
  const target = arbitration.decideTarget(arbitration.collectTargets(eventStub()));
  assert.equal(target.kind, "selected-part-rigging-point");
});

test("active guide point wins over motion trajectory point", () => {
  reset({
    hiddenCompletionGuideEditor: { hitTarget: () => ({ label: "보완 가이드 점" }) },
    trajectoryEditor: { hitTarget: () => ({ label: "이동 경로점" }) },
  });
  const target = arbitration.decideTarget(arbitration.collectTargets(eventStub()));
  assert.equal(target.kind, "active-mode-guide-point");
});

test("selected rigging point wins over active motion target picker", () => {
  reset({
    previewEvents: { hitTarget: () => ({ kind: "selected-part-rigging-point", label: "관절점" }) },
    motionPlanner: { hitTarget: () => ({ label: "움직임 목표" }) },
  });
  const target = arbitration.decideTarget(arbitration.collectTargets(eventStub()));
  assert.equal(target.kind, "selected-part-rigging-point");
});

test("active drag session wins over new pointerdown candidates", () => {
  reset({
    dom: { previewCanvas: { hasPointerCapture: () => true } },
    state: { previewDrag: { mode: "rig" } },
    previewEvents: { hitTarget: () => ({ kind: "selected-part-rigging-point", label: "관절점" }) },
  });
  const target = arbitration.decideTarget(arbitration.collectTargets(capturedEvent()));
  assert.equal(target.kind, "active-drag-session");
});

test("stale drag session without pointer capture is cleared before arbitration", () => {
  const Animotion = reset({
    dom: { previewCanvas: { hasPointerCapture: () => false } },
    state: { trajectoryDrag: { beatIndex: 0 } },
    previewEvents: { hitTarget: () => ({ kind: "selected-part-rigging-point", label: "관절점" }) },
  });
  const target = arbitration.decideTarget(arbitration.collectTargets(capturedEvent()));
  assert.equal(target.kind, "selected-part-rigging-point");
  assert.equal(Animotion.state.trajectoryDrag, null);
});

test("empty preview background is selected when no editor hits", () => {
  reset();
  const target = arbitration.decideTarget(arbitration.collectTargets(eventStub()));
  assert.equal(target.kind, "empty-preview-background");
});

test("beginPointerDown starts only the selected target and records debug", () => {
  let rigStarted = 0;
  let trajectoryStarted = 0;
  const event = eventStub();
  const Animotion = reset({
    previewEvents: {
      hitTarget: () => ({ kind: "selected-part-rigging-point", label: "관절점" }),
      beginDragFromTarget: () => { rigStarted += 1; return true; },
    },
    trajectoryEditor: {
      hitTarget: () => ({ label: "이동 경로점" }),
      beginDragFromTarget: () => { trajectoryStarted += 1; return true; },
    },
  });
  const result = arbitration.beginPointerDown(event);
  assert.equal(result.handled, true);
  assert.equal(rigStarted, 1);
  assert.equal(trajectoryStarted, 0);
  assert.equal(event.prevented, 1);
  assert.equal(event.stopped, 1);
  assert.equal(Animotion.state.previewPointerArbitrationDebug.selected.kind, "selected-part-rigging-point");
});

test("beginPointerDown dispatches active mode pickers through the arbiter", () => {
  let picked = 0;
  const event = eventStub();
  reset({
    correspondenceEditor: {
      hitTarget: () => ({ label: "B컷 참조 위치", point: { x: 10, y: 20 } }),
      beginDragFromTarget: () => { picked += 1; return true; },
    },
  });
  const result = arbitration.beginPointerDown(event);
  assert.equal(result.target.kind, "active-mode-guide-point");
  assert.equal(result.target.editorKey, "correspondenceEditor");
  assert.equal(picked, 1);
  assert.equal(event.stopped, 1);
});
