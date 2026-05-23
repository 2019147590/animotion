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

function loadArmExtension() {
  const context = { window: { Animotion: {} } };
  vm.createContext(context);
  for (const path of ["scripts/cutscene-action-selectors.js", "scripts/arm-extension-controls.js", "scripts/arm-extension.js"]) {
    vm.runInContext(fs.readFileSync(path, "utf8"), context, { filename: path });
  }
  return context.window.Animotion;
}

function rearArm() {
  return { id: "arm_01", type: "arm", humanRole: "forearm", rect: { x: 0, y: 0, w: 100, h: 80 }, pivot: { x: 5, y: 40 }, joint: { x: 50, y: 75 }, handTip: { x: 95, y: 40 }, customMotion: {}, keyframes: [] };
}

function rearCrossAction() {
  return {
    focusKey: "lHand",
    actionTimeline: { template: "punch" },
    targetDebug: { primaryPartId: "arm_01", punchStyle: "rear-cross" },
    beats: [
      { id: "guard", at: 1, pose: { lShoulder: [5, 40], lElbow: [50, 75], lHand: [95, 40] } },
      { id: "impact", at: 24, pose: { lShoulder: [17, 40], lElbow: [164, 40], lHand: [170, 40] } },
    ],
  };
}

function legacyHandOnlyAction() {
  return {
    focusKey: "lHand",
    actionTimeline: { template: "punch" },
    targetDebug: { primaryPartId: "arm_01", punchStyle: "rear-cross" },
    beats: [{ id: "impact", at: 24, pose: { lHand: [170, 40] } }],
  };
}

function hintAt(frame, action = rearCrossAction()) {
  const Animotion = loadArmExtension();
  const part = rearArm();
  return Animotion.armExtension.renderHintForPart(part, { parts: [part], frame, selectedPartId: part.id, bridge: { primaryPartId: part.id, jointAction: action } });
}

function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function angleAtElbow(controls) {
  const a = controls.shoulder, b = controls.elbow, c = controls.hand;
  const ab = { x: a.x - b.x, y: a.y - b.y };
  const cb = { x: c.x - b.x, y: c.y - b.y };
  const dot = ab.x * cb.x + ab.y * cb.y;
  const length = Math.max(1, Math.hypot(ab.x, ab.y) * Math.hypot(cb.x, cb.y));
  return Math.acos(Math.max(-1, Math.min(1, dot / length))) * 180 / Math.PI;
}

function projectionRatio(point, start, end) {
  const dx = end.x - start.x, dy = end.y - start.y;
  return ((point.x - start.x) * dx + (point.y - start.y) * dy) / Math.max(1, dx * dx + dy * dy);
}

test("rear arm-only impact maps generated target to fist and keeps elbow behind it", () => {
  const target = { x: 170, y: 40 };
  const hint = hintAt(24);
  const base = hint.controls.base, impact = hint.controls.target;
  const handMove = distance(base.hand, impact.hand);
  const elbowMove = distance(base.elbow, impact.elbow);
  const shoulderMove = distance(base.shoulder, impact.shoulder);
  const elbowRatio = projectionRatio(impact.elbow, impact.shoulder, impact.hand);

  assert.equal(hint.active, true);
  assert.equal(impact.hand.x, target.x);
  assert.equal(impact.hand.y, target.y);
  assert.equal(distance(impact.hand, target) < distance(impact.elbow, target), true);
  assert.equal(handMove > elbowMove, true);
  assert.equal(elbowMove > shoulderMove, true);
  assert.equal(elbowRatio > 0.25 && elbowRatio < 0.75, true);
  assert.equal(angleAtElbow(impact) > angleAtElbow(base) + 25, true);
});

test("rear arm-only debug controls report the fist as the leading control", () => {
  const Animotion = loadArmExtension();
  const hint = hintAt(24);

  assert.equal(Animotion.armExtensionControls.leadingControl(hint.controls.target), "handTip");
});

test("legacy hand-only loaded action gets runtime fist-led controls without mutating beats", () => {
  const Animotion = loadArmExtension();
  const part = rearArm();
  const action = legacyHandOnlyAction();
  const savedAction = JSON.stringify(action);
  const hint = Animotion.armExtension.renderHintForPart(part, { parts: [part], frame: 24, selectedPartId: part.id, bridge: { primaryPartId: part.id, jointAction: action } });
  const target = { x: 170, y: 40 };

  assert.equal(JSON.stringify(action), savedAction);
  assert.equal(hint.controls.target.hand.x, target.x);
  assert.equal(hint.controls.target.hand.y, target.y);
  assert.equal(distance(hint.controls.target.hand, target) < distance(hint.controls.target.elbow, target), true);
  assert.equal(Animotion.armExtensionControls.leadingControl(hint.controls.target), "handTip");
});

test("explicit rear-cross loaded whole-arm keyframe still activates replacement render", () => {
  const Animotion = loadArmExtension();
  const part = rearArm();
  part.customMotion = { x: 60, y: 0, rotate: 0, scaleY: 0, jointX: 0, jointY: 0, phase: 0 };
  const action = legacyHandOnlyAction();
  const hint = Animotion.armExtension.renderHintForPart(part, { parts: [part], frame: 24, selectedPartId: part.id, bridge: { primaryPartId: part.id, jointAction: action } });

  assert.equal(hint.legacyWholeTranslation, true);
  assert.equal(hint.punchStyleSource, "explicit");
  assert.equal(hint.controls.source, "action");
  assert.equal(hint.active, true);
  assert.equal(Animotion.armExtensionControls.leadingControl(hint.controls.target), "handTip");
});

test("front jab remains outside the rear arm-only extension path", () => {
  const Animotion = loadArmExtension();
  const part = rearArm();
  const action = rearCrossAction();
  action.targetDebug.punchStyle = "jab";
  const hint = Animotion.armExtension.renderHintForPart(part, { parts: [part], frame: 24, selectedPartId: part.id, bridge: { primaryPartId: part.id, jointAction: action } });

  assert.equal(hint.active, false);
  assert.equal(hint.reason, "not-rear-cross-punch");
});
