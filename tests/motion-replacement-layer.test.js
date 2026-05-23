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
  const context = { window: { Animotion: { state: {} } } };
  vm.createContext(context);
  for (const path of [
    "scripts/coordinate-spaces.js",
    "scripts/hidden-completion-assets.js",
    "scripts/project-model.js",
    "scripts/project-serialization.js",
    "scripts/motion-model.js",
    "scripts/timeline.js",
    "scripts/rig-connection.js",
    "scripts/arm-chain-resolver.js",
    "scripts/render-layer-utils.js",
    "scripts/arm-extension-controls.js",
    "scripts/arm-extension.js",
    "scripts/motion-replacement-layer.js",
    "scripts/motion-replacement-render.js",
  ]) runScript(context, path);
  return context.window.Animotion;
}

function runScript(context, path) {
  vm.runInContext(fs.readFileSync(path, "utf8"), context, { filename: path });
}

function bridge(overrides = {}) {
  return {
    primaryPartId: "arm",
    impactFrame: 24,
    durationFrames: 36,
    jointAction: {
      source: "motion-planner-punch-anchors-v1",
      focusKey: "lHand",
      actionTimeline: { template: "punch" },
      targetDebug: { primaryPartId: "arm", punchStyle: "rear-cross" },
      beats: [
        { id: "windup", at: 6, pose: { lHand: [36, 62] } },
        { id: "extension", at: 20, pose: { lHand: [92, 36] } },
        { id: "impact", at: 24, pose: { lHand: [116, 34] } },
        { id: "recover", at: 36, pose: { lHand: [58, 48] } },
      ],
      ...overrides.jointAction,
    },
    ...overrides,
  };
}

function armPart(patch = {}) {
  return {
    id: "arm",
    name: "arm",
    type: "arm",
    humanRole: "forearm",
    order: 2,
    rect: { x: 20, y: 20, w: 80, h: 60 },
    pivot: { x: 8, y: 18 },
    joint: { x: 42, y: 44 },
    handTip: { x: 72, y: 34 },
    alpha: 1,
    customMotion: {},
    keyframes: [],
    ...patch,
  };
}

function parts(extra = []) {
  return [
    { id: "body", type: "body", humanRole: "torso", order: 1, rect: { x: 45, y: 28, w: 40, h: 80 }, pivot: { x: 20, y: 24 }, joint: { x: 20, y: 64 } },
    armPart(),
    ...extra,
  ];
}

function fakeContext() {
  const calls = [];
  const noop = () => {};
  return { calls, save: noop, restore: noop, beginPath: noop, moveTo: noop, lineTo: noop, closePath: noop, fill: () => calls.push("fill") };
}

function stableProject(project) {
  const copy = JSON.parse(JSON.stringify(project));
  delete copy.metadata.updatedAt;
  return copy;
}

test("replacement detection activates for arm-only rear punch impact", () => {
  const Animotion = loadAnimotion();
  const punchParts = parts();
  const plan = Animotion.motionReplacementLayer.planForPart(punchParts[1], {
    parts: punchParts,
    bridge: bridge(),
    frame: 24,
    selectedPartId: "arm",
  });

  assert.equal(plan.active, true);
  assert.equal(plan.partId, "arm");
  assert.equal(plan.frame, 24);
  assert.equal(plan.beatLabel, "impact");
  assert.ok(plan.sourceRect);
  assert.ok(Number.isFinite(plan.shoulder.x));
  assert.ok(Number.isFinite(plan.elbow.x));
  assert.ok(Number.isFinite(plan.handTip.x));
  assert.ok(Number.isFinite(plan.target.x));
  assert.equal(plan.skipNormalDraw, true);
});

test("separate hand rigs are not forced into replacement mode", () => {
  const Animotion = loadAnimotion();
  const hand = { id: "hand", type: "arm", humanRole: "hand", parentPartId: "arm", rect: { x: 92, y: 42, w: 18, h: 16 }, pivot: { x: 4, y: 8 }, joint: { x: 14, y: 8 } };
  const punchParts = parts([hand]);
  const plan = Animotion.motionReplacementLayer.planForPart(punchParts[1], {
    parts: punchParts,
    bridge: bridge(),
    frame: 24,
    selectedPartId: "arm",
  });

  assert.equal(plan.active, false);
  assert.equal(plan.reason, "separate-hand-rig");
});

test("replacement plan responds to edited impact keyframe pose only", () => {
  const Animotion = loadAnimotion();
  const arm = armPart({
    keyframes: [
      { frame: 6, pose: { x: 0, y: 0, rotate: 0, scaleY: 0, jointX: 0, jointY: 0, phase: 0 } },
      { frame: 24, pose: { x: 0, y: 0, rotate: 0, scaleY: 0, jointX: 28, jointY: -12, phase: 0 } },
      { frame: 36, pose: { x: 0, y: 0, rotate: 0, scaleY: 0, jointX: 0, jointY: 0, phase: 0 } },
    ],
  });
  const punchParts = [parts()[0], arm];
  const plan = Animotion.motionReplacementLayer.planForPart(arm, {
    parts: punchParts,
    bridge: bridge(),
    frame: 24,
    selectedPartId: "arm",
  });
  const windup = arm.keyframes.find((keyframe) => keyframe.frame === 6).pose;
  const recover = arm.keyframes.find((keyframe) => keyframe.frame === 36).pose;

  assert.equal(plan.active, true);
  assert.notDeepEqual(JSON.parse(JSON.stringify(plan.handTip)), { x: 92, y: 54 });
  assert.equal(windup.jointX, 0);
  assert.equal(recover.jointX, 0);
});

test("successful replacement render skips normal whole-arm draw", () => {
  const Animotion = loadAnimotion();
  const punchParts = parts();
  const plan = Animotion.motionReplacementLayer.planForPart(punchParts[1], {
    parts: punchParts,
    bridge: bridge(),
    frame: 24,
    selectedPartId: "arm",
  });
  const result = Animotion.motionReplacementRender.draw(fakeContext(), punchParts[1], plan, 1);

  assert.equal(result.ok, true);
  assert.equal(result.skippedNormalDraw, true);
  assert.equal(result.partId, "arm");
  assert.equal(result.beatLabel, "impact");
  assert.ok(result.drawnBounds.w > 0);
});

test("failed replacement render reports failure and does not request skip", () => {
  const Animotion = loadAnimotion();
  const punchParts = parts();
  const badPlan = Animotion.motionReplacementLayer.planForPart({ ...punchParts[1], handTip: { ...punchParts[1].pivot } }, {
    parts: punchParts,
    bridge: bridge(),
    frame: 24,
    selectedPartId: "arm",
  });
  const result = Animotion.motionReplacementRender.draw(fakeContext(), punchParts[1], badPlan, 1);

  assert.equal(result.ok, false);
  assert.equal(result.reason, "degenerate-shoulder-handTip");
  assert.equal(result.skippedNormalDraw, false);
  assert.equal(result.fallbackUsed, true);
});

test("old JSON save output is unchanged by deriving replacement plans", () => {
  const Animotion = loadAnimotion();
  const punchParts = parts();
  const state = {
    project: Animotion.projectModel.createEmptyProject({ canvas: { width: 200, height: 160 } }),
    image: { naturalWidth: 200, naturalHeight: 160 },
    imageName: "panel.png",
    parts: punchParts,
    currentFrame: 24,
    cutsceneBridge: bridge(),
    motionPlan: { template: "punch" },
  };
  const before = stableProject(Animotion.projectModel.projectFromEditorState(state));
  Animotion.motionReplacementLayer.planForPart(punchParts[1], { parts: punchParts, bridge: state.cutsceneBridge, frame: 24, selectedPartId: "arm" });
  Animotion.motionReplacementRender.draw(fakeContext(), punchParts[1], Animotion.motionReplacementLayer.planForPart(punchParts[1], { parts: punchParts, bridge: state.cutsceneBridge, frame: 24, selectedPartId: "arm" }), 1);
  const after = stableProject(Animotion.projectModel.projectFromEditorState(state));

  assert.deepEqual(after, before);
  assert.equal(JSON.stringify(after).includes("motionReplacement"), false);
});

test("bootstrap loads replacement modules before preview", () => {
  const bootstrap = fs.readFileSync("scripts/bootstrap.js", "utf8");
  assert.equal(bootstrap.indexOf('"motion-replacement-layer"') < bootstrap.indexOf('"preview"'), true);
  assert.equal(bootstrap.indexOf('"motion-replacement-render"') < bootstrap.indexOf('"preview"'), true);
});
