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

function loadDepth() {
  const context = { window: { Animotion: {} } };
  vm.createContext(context);
  for (const path of ["scripts/rig-connection.js", "scripts/render-layer-utils.js", "scripts/cutscene-depth.js"]) {
    vm.runInContext(fs.readFileSync(path, "utf8"), context, { filename: path });
  }
  return context.window.Animotion.cutsceneDepth;
}

test("rear punch raises arm-only punching part above head only during drive impact", () => {
  const depth = loadDepth();
  const parts = [
    part("body", "body", 1),
    part("rear_arm", "arm", 2),
    part("head", "head", 5),
  ];
  const bridge = rearPunchBridge("rear_arm");
  assert.deepEqual(ids(depth.orderedParts(parts, { parts, bridge, frame: 1 })), ["body", "rear_arm", "head"]);
  assert.equal(depth.depthBiasForPart(parts[1], { parts, bridge, frame: 10 }) > 0, true);
  assert.deepEqual(ids(depth.orderedParts(parts, { parts, bridge, frame: 20 })), ["body", "head", "rear_arm"]);
  assert.deepEqual(ids(depth.orderedParts(parts, { parts, bridge, frame: 30 })), ["body", "rear_arm", "head"]);
  assert.deepEqual(parts.map((item) => item.order), [1, 2, 5]);
});

test("rear punch raises primary above high-order face and front hair layers at impact", () => {
  const depth = loadDepth();
  const parts = [
    part("body", "body", 1),
    part("rear_arm", "arm", 2),
    part("face_layer", "prop", 5000, null, "face"),
    part("hair_front", "hair", 7000),
  ];
  const bridge = rearPunchBridge("rear_arm");
  assert.deepEqual(ids(depth.orderedParts(parts, { parts, bridge, frame: 1 })), ["body", "rear_arm", "face_layer", "hair_front"]);
  assert.deepEqual(ids(depth.orderedParts(parts, { parts, bridge, frame: 20 })), ["body", "face_layer", "hair_front", "rear_arm"]);
  assert.deepEqual(parts.map((item) => item.order), [1, 2, 5000, 7000]);
});

test("separate hand rig gives terminal hand stronger depth bias than forearm", () => {
  const depth = loadDepth();
  const parts = [
    part("body", "body", 1),
    { ...part("forearm", "arm", 2), humanRole: "forearm" },
    part("hand", "arm", 3, "forearm", "hand"),
    part("head", "head", 6),
  ];
  const bridge = rearPunchBridge("hand");
  const forearmBias = depth.depthBiasForPart(parts[1], { parts, bridge, frame: 20 });
  const handBias = depth.depthBiasForPart(parts[2], { parts, bridge, frame: 20 });
  assert.equal(handBias > forearmBias, true);
  assert.deepEqual(ids(depth.orderedParts(parts, { parts, bridge, frame: 20 })), ["body", "head", "forearm", "hand"]);
});

test("front jab and non punch actions keep base render order", () => {
  const depth = loadDepth();
  const parts = [part("body", "body", 1), part("front_arm", "arm", 2), part("head", "head", 5)];
  assert.deepEqual(ids(depth.orderedParts(parts, { parts, bridge: frontJabBridge("front_arm"), frame: 20 })), ["body", "front_arm", "head"]);
  assert.deepEqual(ids(depth.orderedParts(parts, { parts, bridge: kickBridge("front_arm"), frame: 20 })), ["body", "front_arm", "head"]);
});

test("loaded front jab metadata does not block selected rear arm runtime depth when rear arm has punch motion", () => {
  const depth = loadDepth();
  const parts = [
    rectPart("body", "body", 1, { x: 50, y: 30, w: 24, h: 70 }),
    { ...rectPart("rear_arm", "arm", 2, { x: 28, y: 34, w: 36, h: 40 }), handTip: { x: 5, y: 36 }, keyframes: [{ frame: 20, pose: { x: 6, y: -2, rotate: -34, scaleY: 0.8 } }] },
    { ...rectPart("front_arm", "arm", 3, { x: 80, y: 34, w: 36, h: 40 }), handTip: { x: 31, y: 36 } },
    rectPart("face_layer", "prop", 5000, { x: 48, y: 22, w: 34, h: 30 }, null, "face"),
    rectPart("hair_front", "hair", 7000, { x: 44, y: 16, w: 46, h: 24 }),
  ];
  const bridge = frontJabBridge("front_arm");
  const before = JSON.stringify(bridge);

  const context = { parts, bridge, frame: 20, selectedPartId: "rear_arm" };
  assert.equal(depth.punchStyleInfo(context).source, "selectedOverrideFromLoadedJab");
  assert.deepEqual(ids(depth.orderedParts(parts, context)), ["body", "front_arm", "face_layer", "hair_front", "rear_arm"]);
  assert.equal(JSON.stringify(bridge), before);
});

test("loaded front jab metadata remains stable when selected rear arm has no punch motion", () => {
  const depth = loadDepth();
  const parts = [
    rectPart("body", "body", 1, { x: 50, y: 30, w: 24, h: 70 }),
    { ...rectPart("rear_arm", "arm", 2, { x: 28, y: 34, w: 36, h: 40 }), handTip: { x: 5, y: 36 } },
    { ...rectPart("front_arm", "arm", 3, { x: 80, y: 34, w: 36, h: 40 }), handTip: { x: 31, y: 36 } },
    rectPart("face_layer", "prop", 5000, { x: 48, y: 22, w: 34, h: 30 }, null, "face"),
  ];
  const bridge = frontJabBridge("front_arm");
  const context = { parts, bridge, frame: 20, selectedPartId: "rear_arm" };

  assert.equal(depth.punchStyleInfo(context).punchStyle, "jab");
  assert.deepEqual(ids(depth.orderedParts(parts, context)), ["body", "rear_arm", "front_arm", "face_layer"]);
});

test("legacy rear arm-only punch infers depth but legacy front jab and hand rigs do not", () => {
  const depth = loadDepth();
  const rearParts = [
    rectPart("body", "body", 1, { x: 50, y: 30, w: 24, h: 70 }),
    { ...rectPart("rear_arm", "arm", 2, { x: 28, y: 34, w: 36, h: 40 }), pivot: { x: 26, y: 8 }, joint: { x: 18, y: 25 }, handTip: { x: 5, y: 36 } },
    rectPart("face_layer", "prop", 5000, { x: 48, y: 22, w: 34, h: 30 }, null, "face"),
  ];
  assert.deepEqual(ids(depth.orderedParts(rearParts, { parts: rearParts, bridge: legacyPunchBridge("rear_arm", "lHand", [100, 42]), frame: 24 })), ["body", "face_layer", "rear_arm"]);

  const frontParts = [
    rectPart("body", "body", 1, { x: 50, y: 30, w: 24, h: 70 }),
    { ...rectPart("front_arm", "arm", 2, { x: 82, y: 34, w: 36, h: 40 }), handTip: { x: 31, y: 36 } },
    rectPart("face_layer", "prop", 5000, { x: 48, y: 22, w: 34, h: 30 }, null, "face"),
  ];
  assert.deepEqual(ids(depth.orderedParts(frontParts, { parts: frontParts, bridge: legacyPunchBridge("front_arm", "rHand", [145, 42]), frame: 24 })), ["body", "front_arm", "face_layer"]);

  const handParts = [
    rectPart("body", "body", 1, { x: 50, y: 30, w: 24, h: 70 }),
    rectPart("hand", "arm", 2, { x: 28, y: 56, w: 14, h: 14 }, null, "hand"),
    rectPart("face_layer", "prop", 5000, { x: 48, y: 22, w: 34, h: 30 }, null, "face"),
  ];
  assert.deepEqual(ids(depth.orderedParts(handParts, { parts: handParts, bridge: legacyPunchBridge("hand", "lHand", [100, 42]), frame: 24 })), ["body", "hand", "face_layer"]);
});

test("legacy rear punch can use selected arm fallback and Korean face layer names", () => {
  const depth = loadDepth();
  const parts = [
    rectPart("body", "body", 1, { x: 50, y: 30, w: 24, h: 70 }),
    { ...rectPart("rear_arm", "arm", 2, { x: 28, y: 34, w: 36, h: 40 }), pivot: { x: 26, y: 8 }, joint: { x: 18, y: 25 }, handTip: { x: 5, y: 36 } },
    { ...rectPart("face_layer", "prop", 5000, { x: 48, y: 22, w: 34, h: 30 }), name: "얼굴 가림" },
  ];
  const bridge = legacyPunchBridge(null, "lHand", [100, 42]);
  assert.deepEqual(ids(depth.orderedParts(parts, { parts, bridge, frame: 24, selectedPartId: "rear_arm" })), ["body", "face_layer", "rear_arm"]);
});

test("covered selected legacy punch without target metadata still infers depth", () => {
  const depth = loadDepth();
  const parts = [
    rectPart("body", "body", 1, { x: 50, y: 30, w: 24, h: 70 }),
    { ...rectPart("rear_arm", "arm", 2, { x: 28, y: 34, w: 36, h: 40 }), pivot: { x: 26, y: 8 }, joint: { x: 18, y: 25 }, handTip: { x: 5, y: 36 } },
    rectPart("face_layer", "prop", 5000, { x: 48, y: 22, w: 34, h: 30 }, null, "face"),
  ];
  const bridge = { primaryPartId: null, impactFrame: 24, durationFrames: 36, jointAction: { source: "motion-planner-punch-anchors-v1", actionTimeline: { template: "punch" }, beats: [{ id: "impact", at: 24, pose: {} }] } };
  assert.equal(depth.punchStyleInfo({ parts, bridge, frame: 24, selectedPartId: "rear_arm" }).source, "inferredLegacyLayer");
  assert.deepEqual(ids(depth.orderedParts(parts, { parts, bridge, frame: 24, selectedPartId: "rear_arm" })), ["body", "face_layer", "rear_arm"]);
});

test("cutscene depth module loads before preview", () => {
  const bootstrap = fs.readFileSync("scripts/bootstrap.js", "utf8");
  assert.equal(bootstrap.indexOf('"cutscene-depth"') < bootstrap.indexOf('"preview"'), true);
});

function rearPunchBridge(primaryPartId) {
  return bridge(primaryPartId, "punch", "rear-cross");
}

function frontJabBridge(primaryPartId) {
  return bridge(primaryPartId, "punch", "jab");
}

function kickBridge(primaryPartId) {
  return bridge(primaryPartId, "kick", "rear-cross");
}

function bridge(primaryPartId, template, punchStyle) {
  return {
    primaryPartId,
    jointAction: {
      actionTimeline: { template },
      targetDebug: { punchStyle },
      beats: [{ id: "guard", at: 1 }, { id: "drive", at: 10 }, { id: "impact", at: 20 }, { id: "recover", at: 30 }],
    },
  };
}

function part(id, type, order, parentPartId = null, humanRole = null) {
  return { id, type, order, parentPartId, humanRole };
}

function rectPart(id, type, order, rect, parentPartId = null, humanRole = null) {
  return { ...part(id, type, order, parentPartId, humanRole), rect, pivot: { x: rect.w / 2, y: rect.h * 0.2 }, joint: { x: rect.w / 2, y: rect.h * 0.8 } };
}

function legacyPunchBridge(primaryPartId, focusKey, target) {
  return { primaryPartId, impactFrame: 24, durationFrames: 36, jointAction: { source: "motion-planner-punch-anchors-v1", focusKey, actionTimeline: { template: "punch" }, beats: [{ id: "impact", at: 24, pose: { [focusKey]: target } }] } };
}

function ids(parts) {
  return parts.map((part) => part.id);
}
