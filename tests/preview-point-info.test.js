const assert = require("node:assert/strict");

globalThis.Animotion = {};
require("../scripts/arm-role-semantics.js");
const pointInfo = require("../scripts/preview-point-info.js");

function test(name, fn) {
  try {
    fn();
    console.log(`PASS ${name}`);
  } catch (error) {
    console.error(`FAIL ${name}`);
    throw error;
  }
}

test("rear arm hand tip click reports trajectory participation", () => {
  globalThis.Animotion.armExtension = { punchStyleInfo: () => ({ punchStyle: "rear-cross" }) };
  const part = { id: "arm_01", name: "rear arm", type: "arm" };
  const info = pointInfo.rigPointInfo(part, "handTip", {
    parts: [part],
    selectedPartId: "arm_01",
    bridge: { primaryPartId: "arm_01", jointAction: { actionTimeline: { template: "punch" } } },
  });
  assert.equal(info.role, "손끝/타격 끝점");
  assert.equal(info.participatesInTrajectory, true);
  assert.equal(info.trajectoryRole, "primary");
});

test("trajectory beat and anchor descriptions explain generation roles", () => {
  const beat = pointInfo.trajectoryBeatInfo({ id: "impact", at: 24 }, "lHand", {});
  const anchor = pointInfo.anchorInfo({ key: "lElbow", role: "bendHint", locked: false });
  assert.equal(beat.role, "이동 경로점");
  assert.equal(beat.participatesInTrajectory, true);
  assert.match(beat.detail, /직접 보간/);
  assert.equal(anchor.role, "궤적 조정점");
  assert.equal(anchor.trajectoryRole, "bendHint");
  assert.match(anchor.label, /굽힘 보조/);
});

test("human arm rig point labels use strict role semantics", () => {
  assert.equal(pointInfo.rigPointInfo({ humanRole: "upperArm" }, "rotationPivot").role, "어깨 회전점 / shoulder pivot");
  assert.equal(pointInfo.rigPointInfo({ humanRole: "upperArm" }, "joint").role, "팔꿈치 연결점 / elbow joint");
  assert.equal(pointInfo.rigPointInfo({ humanRole: "forearm" }, "rotationPivot").role, "팔꿈치 회전점 / elbow pivot");
  assert.equal(pointInfo.rigPointInfo({ humanRole: "forearm" }, "joint").role, "손목 연결점 / wrist joint");
  assert.equal(pointInfo.rigPointInfo({ humanRole: "hand" }, "rotationPivot").role, "손목 회전점 / wrist pivot");
  assert.equal(pointInfo.rigPointInfo({ humanRole: "hand" }, "handTip").role, "주먹 타격점 / punch contact point");
});
