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
  for (const path of ["scripts/rig-connection.js", "scripts/cutscene-depth.js"]) {
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

function ids(parts) {
  return parts.map((part) => part.id);
}
