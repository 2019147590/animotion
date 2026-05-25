const assert = require("node:assert/strict");

globalThis.Animotion = {};
const warp = require("../scripts/hidden-completion-supplemental-warp.js");

function test(name, fn) {
  try {
    fn();
    console.log(`PASS ${name}`);
  } catch (error) {
    console.error(`FAIL ${name}`);
    throw error;
  }
}

function contextStub() {
  const ops = [];
  return {
    ops,
    save: () => ops.push(["save"]),
    restore: () => ops.push(["restore"]),
    beginPath: () => ops.push(["beginPath"]),
    moveTo: (x, y) => ops.push(["moveTo", x, y]),
    lineTo: (x, y) => ops.push(["lineTo", x, y]),
    closePath: () => ops.push(["closePath"]),
    clip: () => ops.push(["clip"]),
    transform: (...args) => ops.push(["transform", ...args]),
    drawImage: (...args) => ops.push(["drawImage", ...args]),
  };
}

function part(overrides = {}) {
  return {
    id: "supplemental",
    rect: { x: 10, y: 20, w: 40, h: 50 },
    canvas: { width: 40, height: 50 },
    ...overrides,
  };
}

test("missing supplementalWarp keeps legacy rectangular draw", () => {
  const ctx = contextStub();
  const item = part();
  const result = warp.drawImage(ctx, item);
  const drawOps = ctx.ops.filter((op) => op[0] === "drawImage");

  assert.equal(result, false);
  assert.equal(drawOps.length, 1);
  assert.deepEqual(drawOps[0], ["drawImage", item.canvas, 10, 20, 40, 50]);
});

test("supplementalWarp draws the asset through a two-triangle mesh", () => {
  const ctx = contextStub();
  const item = part({ supplementalWarp: warp.setPoint(part(), "tr", { x: 48, y: 6 }) });
  const result = warp.drawImage(ctx, item);

  assert.equal(result, true);
  assert.equal(ctx.ops.filter((op) => op[0] === "drawImage").length, 2);
  assert.equal(ctx.ops.filter((op) => op[0] === "transform").length, 2);
  assert.equal(ctx.ops.filter((op) => op[0] === "clip").length, 2);
});

test("warped supplemental material is clipped to the supplemental mask source area", () => {
  const ctx = contextStub();
  const item = part({
    canvas: { width: 80, height: 100 },
    mask: { points: [{ x: 5, y: 6 }, { x: 35, y: 7 }, { x: 34, y: 45 }, { x: 4, y: 44 }] },
    supplementalWarp: warp.setPoint(part(), "br", { x: 47, y: 54 }),
  });
  const result = warp.drawImage(ctx, item);
  const firstDraw = ctx.ops.findIndex((op) => op[0] === "drawImage");
  const beforeFirstDraw = ctx.ops.slice(0, firstDraw);

  assert.equal(result, true);
  assert.equal(ctx.ops.filter((op) => op[0] === "clip").length, 4);
  assert.equal(beforeFirstDraw.some((op) => op[0] === "moveTo" && op[1] === 10 && op[2] === 12), true);
  assert.equal(beforeFirstDraw.some((op) => op[0] === "lineTo" && op[1] === 70 && op[2] === 14), true);
});

test("material seam redistributes adjacent supplemental regions without shrinking both", () => {
  const ctx = contextStub();
  const base = part();
  const item = part({
    supplementalWarp: {
      ...warp.defaultWarp(base),
      materialSeam: {
        sourcePoints: [{ id: "seamA", x: 0, y: 25 }, { id: "seamB", x: 40, y: 25 }],
        points: [{ id: "seamA", x: 0, y: 16 }, { id: "seamB", x: 40, y: 16 }],
      },
    },
  });
  const result = warp.drawImage(ctx, item);

  assert.equal(result, true);
  assert.equal(ctx.ops.filter((op) => op[0] === "drawImage").length, 4);
  assert.equal(ctx.ops.some((op) => op[0] === "moveTo" && op[1] === 10 && op[2] === 36), true);
  assert.equal(ctx.ops.some((op) => op[0] === "lineTo" && op[1] === 50 && op[2] === 36), true);
});

test("normalization fills missing handles without changing legacy defaults", () => {
  const item = part();
  const normalized = warp.normalizeWarp({ points: [{ id: "tl", x: 3, y: 4 }] }, item);

  assert.deepEqual(normalized.points[0], { id: "tl", x: 3, y: 4 });
  assert.deepEqual(normalized.points[1], { id: "tr", x: 40, y: 0 });
  assert.deepEqual(warp.pointById(item, "bl"), { id: "bl", x: 0, y: 50 });
});

test("setPoint updates only the selected warp handle", () => {
  const item = part();
  const next = warp.setPoint(item, "br", { x: 35, y: 60 });

  assert.deepEqual(next.points.map((point) => point.id), ["tl", "tr", "br", "bl"]);
  assert.deepEqual(next.points[2], { id: "br", x: 35, y: 60 });
  assert.deepEqual(next.points[0], { id: "tl", x: 0, y: 0 });
});

test("setMaterialSeamPoint preserves source material boundary while moving display boundary", () => {
  const item = part();
  const next = warp.setMaterialSeamPoint(item, "seamA", { x: 0, y: 18 });

  assert.deepEqual(next.materialSeam.sourcePoints[0], { id: "seamA", x: 0, y: 25 });
  assert.deepEqual(next.materialSeam.points[0], { id: "seamA", x: 0, y: 18 });
  assert.deepEqual(next.points.map((point) => point.id), ["tl", "tr", "br", "bl"]);
});
