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
  const context = { window: { Animotion: {} }, crypto: { randomUUID: () => "test-id" } };
  vm.createContext(context);
  for (const path of [
    "scripts/config.js",
    "scripts/coordinate-spaces.js",
    "scripts/motion-model.js",
    "scripts/human-rig-schema.js",
    "scripts/arm-role-semantics.js",
    "scripts/rig-connection.js",
    "scripts/part-visibility-masks.js",
    "scripts/project-model.js",
  ]) vm.runInContext(fs.readFileSync(path, "utf8"), context, { filename: path });
  return context.window.Animotion;
}

test("legacy rearCross hidden fill copies receive action ownership metadata", () => {
  const Animotion = loadAnimotion();
  const project = Animotion.projectModel.normalizeProject({
    metadata: { name: "migration" },
    canvas: { width: 200, height: 160 },
    parts: [
      hiddenFillPart("body_01 copy", "hidden-body-fill"),
      hiddenFillPart("front_upperarm copy", "hidden-upper-fill"),
      plainCopyPart("arm copy"),
    ],
  });
  const [bodyFill, upperFill, plainCopy] = project.parts;

  assert.equal(bodyFill.usage, "rearCrossHiddenFill");
  assert.equal(bodyFill.createdForActionId, "rearCross");
  assert.equal(bodyFill.ownerActionId, "rearCross");
  assert.equal(bodyFill.sourcePatchAssetId, "hidden-body-fill");
  assert.equal(upperFill.usage, "rearCrossHiddenFill");
  assert.equal(plainCopy.usage, undefined);
  assert.equal(plainCopy.createdForActionId, undefined);
});

function hiddenFillPart(name, sourcePatchAssetId) {
  return {
    id: name,
    name,
    type: "arm",
    rect: { x: 1, y: 2, w: 30, h: 40 },
    sourcePatchAssetId,
    layerIndex: 9000,
    visibilityMasks: [{
      id: `${name}-mask`,
      mask: { kind: "polygon", points: [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }] },
      keyframes: [{ frame: 1, strength: 1 }],
    }],
  };
}

function plainCopyPart(name) {
  return { id: name, name, type: "arm", rect: { x: 1, y: 2, w: 30, h: 40 }, layerIndex: 10 };
}
