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

function loadIo() {
  const context = {
    window: {
      Animotion: {
        view: { loadImageFromFile: async () => null },
        state: {},
      },
    },
  };
  vm.createContext(context);
  runScript(context, "scripts/config.js");
  runScript(context, "scripts/geometry.js");
  runScript(context, "scripts/motion-model.js");
  runScript(context, "scripts/io.js");
  return context.window.Animotion.io;
}

function runScript(context, path) {
  vm.runInContext(fs.readFileSync(path, "utf8"), context, { filename: path });
}

test("rig importer reads version 3 character parts", () => {
  const io = loadIo();
  const parts = io.rigPartsFromPayload({
    version: 3,
    characters: [{
      parts: [{
        id: "part_head",
        name: "head",
        type: "head",
        rect: { x: 10, y: 20, w: 30, h: 40 },
      }],
    }],
  });
  assert.equal(parts[0].type, "head");
  assert.equal(parts[0].mask.points[0].x, 0);
  assert.equal(parts[0].mask.points[0].y, 0);
});

test("rig importer maps unknown AI part types to prop", () => {
  const io = loadIo();
  const parts = io.rigPartsFromPayload({
    version: 3,
    characters: [{
      parts: [{
        id: "part_upper_arm",
        name: "upper_arm",
        type: "upper_arm",
        rect: { x: 0, y: 0, w: 10, h: 10 },
      }],
    }],
  });
  assert.equal(parts[0].type, "prop");
});
