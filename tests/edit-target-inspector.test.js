const assert = require("node:assert/strict");

globalThis.Animotion = {};
const inspector = require("../scripts/edit-target-inspector.js");

function test(name, fn) {
  try {
    fn();
    console.log(`PASS ${name}`);
  } catch (error) {
    console.error(`FAIL ${name}`);
    throw error;
  }
}

test("inspector reports pose target for selected part", () => {
  globalThis.Animotion.partTypeLabels = { arm: "팔" };
  const target = inspector.currentTarget({
    parts: [{ id: "arm-a", name: "front arm", type: "arm" }],
    selectedPartId: "arm-a",
  }, { pivotEditTarget: { value: "joint" } });
  assert.equal(target.kind, "pose");
  assert.equal(target.role, "관절점");
  assert.match(target.detail, /front arm/);
});

test("inspector reports motion path target for selected beat", () => {
  globalThis.Animotion.motionCommands = { currentMotionPlan: () => ({ selectedBeatId: "impact" }) };
  const target = inspector.currentTarget({ motionPlan: {}, parts: [] }, {});
  assert.equal(target.kind, "motion-path");
  assert.equal(target.role, "선택 비트");
  assert.equal(target.detail, "beat impact");
  delete globalThis.Animotion.motionCommands;
});

test("inspector reports active trajectory drag before stale hovered rig point", () => {
  const target = inspector.currentTarget({
    hoveredEditPoint: { kind: "joint", role: "관절점", label: "head" },
    trajectoryDrag: { beatIndex: 0, focusKey: "rFoot" },
  }, {});
  assert.equal(target.kind, "motion-path");
  assert.equal(target.role, "이동 궤적 미리보기");
});

test("inspector reports hidden completion guide drag before pose", () => {
  const target = inspector.currentTarget({
    previewDrag: { kind: "hidden-completion-guide" },
    parts: [{ id: "leg-a", name: "leg", type: "leg" }],
    selectedPartId: "leg-a",
  }, {});
  assert.equal(target.kind, "hidden-guide");
  assert.equal(target.role, "가이드 꼭짓점");
});

test("inspector reports hovered connection point role", () => {
  const target = inspector.currentTarget({
    hoveredEditPoint: { kind: "connection", role: "연결점", label: "목 연결점" },
  }, {});
  assert.equal(target.kind, "pose");
  assert.equal(target.role, "연결점");
  assert.equal(target.detail, "목 연결점");
});

test("inspector reports clicked rig point trajectory participation", () => {
  const target = inspector.currentTarget({
    selectedEditPoint: { kind: "handTip", role: "손끝/타격 끝점", label: "rear arm", detail: "궤적 참여: 손끝/주먹 타격 끝점입니다.", participatesInTrajectory: true },
  }, {});
  assert.equal(target.kind, "motion-path");
  assert.equal(target.role, "손끝/타격 끝점");
  assert.match(target.detail, /궤적 참여/);
});

test("inspector reports no target without selection", () => {
  const target = inspector.currentTarget({ parts: [] }, {});
  assert.equal(target.kind, "none");
  assert.equal(target.role, "대기");
});
