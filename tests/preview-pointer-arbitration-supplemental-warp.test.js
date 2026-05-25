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

test("supplemental warp handles participate in active preview arbitration", () => {
  reset({
    hiddenCompletionSupplementalWarpEditor: { hitTarget: () => ({ label: "보완 파츠 변형점", pointId: "tl" }) },
    trajectoryEditor: { hitTarget: () => ({ label: "이동 경로점" }) },
  });

  const targets = arbitration.collectTargets({});
  const target = arbitration.decideTarget(targets);

  assert.equal(target.kind, "active-mode-guide-point");
  assert.equal(target.editorKey, "hiddenCompletionSupplementalWarpEditor");
  assert.equal(targets.some((candidate) => candidate.kind === "motion-trajectory-point"), true);
});
