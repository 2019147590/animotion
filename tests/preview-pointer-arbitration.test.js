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

test("rig handle wins when trajectory sample control and active target overlap", () => {
  reset({
    previewEvents: { hitTarget: () => ({ kind: "selected-part-rigging-point", label: "관절점" }) },
    motionPlanner: { hitTarget: () => ({ label: "움직임 목표", point: { x: 40, y: 50 } }) },
    trajectoryEditor: { hitTarget: () => ({ type: "beat", label: "이동 경로점", hit: { beat: { id: "impact" }, focusKey: "rFoot" } }) },
  });
  const targets = arbitration.collectTargets(eventStub());
  const target = arbitration.decideTarget(targets);
  assert.equal(target.kind, "selected-part-rigging-point");
  assert.equal(targets.some((candidate) => candidate.kind === "active-mode-guide-point" && candidate.editorKey === "motionPlanner"), true);
  assert.equal(targets.some((candidate) => candidate.kind === "motion-trajectory-point"), true);
});

test("action-frame mode makes trajectory controls read-only for pointer arbitration", () => {
  reset({
    actionFrameEditor: { trajectoryReadOnly: () => true },
    trajectoryEditor: { hitTarget: () => ({ type: "beat", label: "impact" }) },
  });
  const targets = arbitration.collectTargets(eventStub());
  assert.equal(targets.some((candidate) => candidate.kind === "motion-trajectory-point"), false);
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

test("stale drag session without pointer capture is ignored without mutating drag state", () => {
  const Animotion = reset({
    dom: { previewCanvas: { hasPointerCapture: () => false } },
    state: { trajectoryDrag: { beatIndex: 0 } },
    previewEvents: { hitTarget: () => ({ kind: "selected-part-rigging-point", label: "관절점" }) },
  });
  const target = arbitration.decideTarget(arbitration.collectTargets(capturedEvent()));
  assert.equal(target.kind, "selected-part-rigging-point");
  assert.deepEqual(Animotion.state.trajectoryDrag, { beatIndex: 0 });
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

test("beginPointerDown falls through when a higher-priority target cannot start", () => {
  let rigStarted = 0;
  let trajectoryStarted = 0;
  const event = eventStub();
  const Animotion = reset({
    previewEvents: {
      hitTarget: () => ({ kind: "selected-part-rigging-point", label: "관절점" }),
      beginDragFromTarget: () => { rigStarted += 1; return false; },
    },
    trajectoryEditor: {
      hitTarget: () => ({ type: "beat", label: "이동 경로점", hit: { beat: { id: "impact" } } }),
      beginDragFromTarget: () => { trajectoryStarted += 1; return true; },
    },
  });
  const result = arbitration.beginPointerDown(event);
  assert.equal(result.handled, true);
  assert.equal(result.target.kind, "motion-trajectory-point");
  assert.equal(rigStarted, 1);
  assert.equal(trajectoryStarted, 1);
  assert.equal(event.stopped, 1);
  assert.equal(Animotion.state.previewPointerArbitrationDebug.selected.kind, "motion-trajectory-point");
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

test("supplemental warp handles are routed as active mode picker targets", () => {
  let started = 0;
  const event = eventStub();
  reset({
    hiddenCompletionSupplementalWarpEditor: {
      hitTarget: () => ({ label: "보완 파츠 변형점", pointId: "tl" }),
      beginDragFromTarget: () => { started += 1; return true; },
    },
  });
  const result = arbitration.beginPointerDown(event);
  assert.equal(result.target.kind, "active-mode-guide-point");
  assert.equal(result.target.editorKey, "hiddenCompletionSupplementalWarpEditor");
  assert.equal(started, 1);
  assert.equal(event.stopped, 1);
});

test("active drag target uses the owner pointer capture", () => {
  reset({
    dom: { previewCanvas: { hasPointerCapture: (pointerId) => pointerId === 7 } },
    state: { activePreviewDrag: { editorKey: "trajectoryEditor", pointerId: 7, kind: "trajectory" } },
    previewEvents: { hitTarget: () => ({ kind: "selected-part-rigging-point", label: "관절점" }) },
  });
  const event = capturedEvent();
  event.pointerId = 2;
  const target = arbitration.decideTarget(arbitration.collectTargets(event));
  assert.equal(target.kind, "active-drag-session");
});

test("pointermove is routed only to the active drag owner", () => {
  let trajectoryMoves = 0;
  let previewMoves = 0;
  const event = capturedEvent();
  reset({
    dom: { previewCanvas: { hasPointerCapture: (pointerId) => pointerId === 1 } },
    state: { activePreviewDrag: { editorKey: "trajectoryEditor", pointerId: 1, kind: "trajectory" } },
    trajectoryEditor: { updateDrag: () => { trajectoryMoves += 1; return true; } },
    previewEvents: { updateDrag: () => { previewMoves += 1; return true; } },
  });
  assert.equal(arbitration.handlePointerMove(event), true);
  assert.equal(trajectoryMoves, 1);
  assert.equal(previewMoves, 0);
  assert.equal(event.prevented, 1);
});

test("starting a trajectory drag clears stale preview drag state", () => {
  const event = capturedEvent();
  const Animotion = reset({
    state: {
      previewDrag: { mode: "rig" },
      trajectoryDrag: { beatIndex: 0 },
    },
  });
  arbitration.setActiveDragOwner("trajectoryEditor", event, { kind: "trajectory" });
  assert.equal(Animotion.state.previewDrag, null);
  assert.deepEqual(Animotion.state.trajectoryDrag, { beatIndex: 0 });
});

test("starting a preview drag clears stale trajectory drag state", () => {
  const event = capturedEvent();
  const Animotion = reset({
    state: {
      previewDrag: { mode: "rig" },
      trajectoryDrag: { beatIndex: 0 },
    },
  });
  arbitration.setActiveDragOwner("previewEvents", event, { kind: "rig" });
  assert.deepEqual(Animotion.state.previewDrag, { mode: "rig" });
  assert.equal(Animotion.state.trajectoryDrag, null);
});

test("pointerup is routed to the active drag owner and clears ownership", () => {
  let ended = 0;
  const event = capturedEvent();
  const Animotion = reset({
    state: { activePreviewDrag: { editorKey: "trajectoryEditor", pointerId: 1, kind: "trajectory" } },
    trajectoryEditor: { endDrag: () => { ended += 1; return true; } },
  });
  assert.equal(arbitration.handlePointerUp(event), true);
  assert.equal(ended, 1);
  assert.equal(Animotion.state.activePreviewDrag, null);
});

test("overlapping active picker candidates are all visible to debug", () => {
  reset({
    correspondenceEditor: { hitTarget: () => ({ label: "B컷 참조 위치", point: { x: 10, y: 20 } }) },
    motionPlanner: { hitTarget: () => ({ label: "움직임 목표", point: { x: 30, y: 40 } }) },
  });
  const targets = arbitration.collectTargets(eventStub());
  const activeModes = targets.filter((target) => target.kind === "active-mode-guide-point");
  assert.equal(activeModes.length, 2);
  assert.equal(activeModes[0].editorKey, "correspondenceEditor");
  assert.deepEqual(activeModes[0].payload.point, { x: 10, y: 20 });
});

test("exclusive picker activation deactivates other picker modes", () => {
  const calls = [];
  const Animotion = reset({
    correspondenceEditor: { setPickMode: (active) => calls.push(["correspondence", active]) },
    motionAnchorPicker: { setPickMode: (active) => calls.push(["anchor", active]) },
    motionPlanner: { setTargetMode: (active) => calls.push(["planner", active]) },
  });
  arbitration.activateExclusivePicker("motionAnchorPicker");
  assert.deepEqual(calls, [["correspondence", false], ["planner", false]]);
  assert.equal(Animotion.state.activePreviewPicker, "motionAnchorPicker");
});
