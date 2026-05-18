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
  const context = {
    window: { Animotion: { state: { panelSetup: {}, panelEditTarget: "source", selection: { points: [] } } } },
    document: undefined,
  };
  vm.createContext(context);
  for (const path of [
    "scripts/config.js",
    "scripts/geometry.js",
    "scripts/panel-editor.js",
    "scripts/panel-commands.js",
  ]) runScript(context, path);
  return context.window.Animotion;
}

function runScript(context, path) {
  vm.runInContext(fs.readFileSync(path, "utf8"), context, { filename: path });
}

test("panel command switches active target and clears selection", () => {
  const Animotion = loadAnimotion();
  Animotion.panelCommands.setActiveTarget("impact", { refresh: false, resetView: false });
  assert.equal(Animotion.state.panelEditTarget, "impact");
  assert.equal(Animotion.state.selection, null);
});

test("panel command sets and clears crop", () => {
  const Animotion = loadAnimotion();
  Animotion.panelCommands.setCrop("source", { x: "3.2", y: 4, w: "20.7", h: 30 });
  const crop = Animotion.state.panelSetup.source.crop;
  assert.equal(crop.x, 3);
  assert.equal(crop.y, 4);
  assert.equal(crop.w, 21);
  assert.equal(crop.h, 30);
  Animotion.panelCommands.setCrop("source", null);
  assert.equal(Animotion.state.panelSetup.source.crop, null);
});

test("panel command stores normalized character mask", () => {
  const Animotion = loadAnimotion();
  Animotion.panelCommands.setCharacterMask("impact", {
    kind: "polygon",
    closed: false,
    points: [{ x: "1", y: 2 }, { x: 3, y: "4" }],
  });
  const mask = Animotion.state.panelSetup.impact.characterMask;
  assert.equal(mask.closed, false);
  assert.equal(mask.points[1].x, 3);
  assert.equal(mask.points[1].y, 4);
});
