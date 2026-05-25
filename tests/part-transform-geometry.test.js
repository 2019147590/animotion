const assert = require("node:assert/strict");

globalThis.Animotion = { shapeKind: { rect: "rect" }, rigConnection: { parentIdFor: (part) => part.parentId || null } };
const geometry = require("../scripts/part-transform-geometry.js");

function test(name, fn) {
  try {
    fn();
    console.log(`PASS ${name}`);
  } catch (error) {
    console.error(`FAIL ${name}`);
    throw error;
  }
}

function part(patch = {}) {
  return {
    id: "part",
    rect: { x: 10, y: 10, w: 20, h: 10 },
    pivot: { x: 10, y: 5 },
    transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 },
    ...patch,
  };
}

test("shapeFromPart mirrors and moves source overlay geometry like preview static transform", () => {
  const source = part({ transform: { x: 30, y: 0, rotation: 0, scaleX: -1, scaleY: 1 } });

  const shape = geometry.shapeFromPart(source, [source]);

  assert.deepEqual(shape.points, [
    { x: 60, y: 10 }, { x: 40, y: 10 }, { x: 40, y: 20 }, { x: 60, y: 20 },
  ]);
});

test("pointToImage rotates source overlay rig points around the part pivot", () => {
  const source = part({ pivot: { x: 0, y: 0 }, transform: { x: 0, y: 0, rotation: 90, scaleX: 1, scaleY: 1 } });

  const point = geometry.pointToImage(source, { x: 20, y: 10 }, [source]);

  assert.deepEqual(point, { x: 0, y: 30 });
});

test("shapeFromPart inherits parent static transforms on the source overlay", () => {
  const parent = part({ id: "parent", rect: { x: 0, y: 0, w: 10, h: 10 }, pivot: { x: 0, y: 0 }, transform: { x: 10, y: 5, rotation: 0, scaleX: 1, scaleY: 1 } });
  const child = part({ id: "child", parentId: parent.id });

  const point = geometry.pointToImage(child, { x: 0, y: 0 }, [parent, child]);

  assert.deepEqual(point, { x: 20, y: 15 });
});
