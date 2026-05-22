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

function loadRender() {
  const context = { window: { Animotion: {} } };
  vm.createContext(context);
  vm.runInContext(fs.readFileSync("scripts/arm-extension-controls.js", "utf8"), context, { filename: "scripts/arm-extension-controls.js" });
  vm.runInContext(fs.readFileSync("scripts/arm-extension-render.js", "utf8"), context, { filename: "scripts/arm-extension-render.js" });
  return context.window.Animotion.armExtensionRender;
}

function part(rect) {
  return { id: "arm", rect, alpha: 1, canvas: { id: "arm-canvas" } };
}

function validHint() {
  return {
    controls: {
      base: { shoulder: { x: 0, y: 0 }, elbow: { x: 24, y: 0 }, hand: { x: 52, y: 0 } },
      target: { shoulder: { x: 0, y: 0 }, elbow: { x: 36, y: 0 }, hand: { x: 82, y: 0 } },
    },
  };
}

function bentPunchHint() {
  return {
    controls: {
      base: { shoulder: { x: 5, y: 40 }, elbow: { x: 50, y: 75 }, hand: { x: 95, y: 40 } },
      target: { shoulder: { x: 5, y: 40 }, elbow: { x: 76, y: 40 }, hand: { x: 125, y: 40 } },
    },
  };
}

function fakeContext() {
  const calls = [];
  const noop = () => {};
  return {
    calls,
    save: noop,
    restore: noop,
    translate: noop,
    rotate: noop,
    scale: noop,
    beginPath: noop,
    moveTo: noop,
    lineTo: noop,
    closePath: noop,
    clip: noop,
    drawImage: (...args) => calls.push({ name: "drawImage", args }),
  };
}

test("segmented renderer accepts a compact arm replacement", () => {
  const render = loadRender();
  const result = render.validateSegmentedPart(part({ x: -6, y: -10, w: 64, h: 20 }), validHint());

  assert.equal(result.ok, true);
  assert.equal(result.reason, "ok");
  assert.equal(result.segmentCount, 2);
});

test("segmented renderer rejects overly wide fragments before drawing", () => {
  const render = loadRender();
  const result = render.validateSegmentedPart(part({ x: -12, y: -160, w: 78, h: 320 }), validHint());

  assert.equal(result.ok, false);
  assert.equal(result.reason, "source-segment-too-wide");
  assert.equal(result.fallbackUsed, true);
});

test("segmented renderer rejects excessive arm length scaling", () => {
  const render = loadRender();
  const hint = validHint();
  hint.controls.target.hand = { x: 260, y: 0 };
  const result = render.validateSegmentedPart(part({ x: -6, y: -10, w: 64, h: 20 }), hint);

  assert.equal(result.ok, false);
  assert.equal(result.reason, "invalid-segment-scale");
  assert.equal(result.fallbackUsed, true);
});

test("segmented renderer pins the visual glove edge to the target hand", () => {
  const render = loadRender();
  const hint = validHint();
  const ctx = fakeContext();
  const result = render.drawSegmentedPart(ctx, part({ x: -6, y: -10, w: 74, h: 20 }), hint);

  assert.equal(result.ok, true);
  assert.equal(result.glovePatch.sourceAnchor.x, 68);
  assert.equal(result.glovePatch.sourceAnchor.y, 0);
  assert.equal(result.handTip.x, hint.controls.target.hand.x);
  assert.equal(result.handTip.y, hint.controls.target.hand.y);
  assert.equal(result.drawnBounds.x + result.drawnBounds.w, hint.controls.target.hand.x);
  assert.equal(result.leadingControl, "handTip");
  assert.equal(ctx.calls.filter((call) => call.name === "drawImage").length, 3);
});

test("bent arm at straight punch impact uses an action pose patch", () => {
  const render = loadRender();
  const hint = bentPunchHint();
  const ctx = fakeContext();
  const result = render.drawSegmentedPart(ctx, part({ x: 0, y: 0, w: 100, h: 80 }), hint);

  assert.equal(result.ok, true);
  assert.equal(result.renderMode, "action-pose-patch");
  assert.equal(result.actionPatch.reason, "bent-source-straight-impact");
  assert.equal(result.handTip.x, hint.controls.target.hand.x);
  assert.equal(result.handTip.y, hint.controls.target.hand.y);
  assert.equal(ctx.calls.filter((call) => call.name === "drawImage").length, 2);
});

test("unsafe action pose patch falls back instead of over-stretching", () => {
  const render = loadRender();
  const hint = bentPunchHint();
  hint.controls.target.hand = { x: 420, y: 40 };
  hint.controls.target.elbow = { x: 310, y: 40 };
  const result = render.drawSegmentedPart(fakeContext(), part({ x: 0, y: 0, w: 100, h: 80 }), hint);

  assert.equal(result.ok, false);
  assert.equal(result.renderMode, "action-pose-patch");
  assert.equal(result.reason, "action-patch-scale-too-large");
  assert.equal(result.fallbackUsed, true);
});
