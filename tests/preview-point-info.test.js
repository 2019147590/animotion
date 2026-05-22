const assert = require("node:assert/strict");

globalThis.Animotion = {};
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
  const part = { id: "arm_01", name: "rear arm", type: "arm", humanRole: "forearm" };
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
