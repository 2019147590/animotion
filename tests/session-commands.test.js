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
  const context = { window: { Animotion: {} }, performance: { now: () => 1000 } };
  vm.createContext(context);
  for (const path of [
    "scripts/config.js",
    "scripts/geometry.js",
    "scripts/motion-model.js",
    "scripts/timeline.js",
    "scripts/project-model.js",
    "scripts/correspondence-model.js",
    "scripts/project-serialization.js",
    "scripts/cutscene-model.js",
    "scripts/motion-planner.js",
  ]) runScript(context, path);
  const Animotion = context.window.Animotion;
  const project = Animotion.projectModel.createEmptyProject();
  Animotion.state = {
    project,
    image: null,
    imageName: "",
    nextImage: null,
    nextImageName: "",
    parts: project.parts,
    selectedPartId: null,
    currentFrame: 1,
    cutsceneBridge: null,
    panelSetup: {},
    correspondences: [],
    motionPlan: { template: "kick", target: null, targetMode: false },
    separateCharacter: false,
  };
  runScript(context, "scripts/motion-commands.js");
  runScript(context, "scripts/correspondence-commands.js");
  runScript(context, "scripts/session-commands.js");
  return Animotion;
}

function runScript(context, path) {
  vm.runInContext(fs.readFileSync(path, "utf8"), context, { filename: path });
}

test("session command resets state for a new source image", () => {
  const Animotion = loadAnimotion();
  const image = { naturalWidth: 640, naturalHeight: 480 };
  Animotion.sessionCommands.resetForNewImage(image, "panel.png");
  assert.equal(Animotion.state.image, image);
  assert.equal(Animotion.state.imageName, "panel.png");
  assert.equal(Animotion.state.parts, Animotion.state.project.parts);
  assert.equal(Animotion.state.panelSetup.source.crop, null);
  assert.equal(Animotion.state.motionPlan.template, "kick");
});

test("session command restores a project and preserves valid selection", () => {
  const Animotion = loadAnimotion();
  const part = { id: "head", name: "head", type: "head", rect: { x: 0, y: 0, w: 10, h: 10 } };
  const project = Animotion.projectModel.normalizeProject({
    format: "animotion-project",
    version: "1.0.0",
    metadata: { name: "Project", createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z" },
    canvas: { width: 100, height: 80, fps: 24, durationFrames: 12 },
    assets: [{ id: "source-image", type: "sourceImage", name: "panel.png", uri: "panel.png" }],
    parts: [{ id: "head", name: "head", type: "head", sourceRect: part.rect }],
    editor: {
      imageName: "panel.png",
      selectedPartId: "head",
      motionPlan: { template: "dash" },
      correspondences: [{
        sourcePartId: "head",
        sourcePartType: "head",
        targetPartType: "head",
        impactAnchor: { x: 12, y: 14 },
      }],
    },
    timeline: { currentFrame: 7, durationFrames: 12, tracks: [] },
  });
  Animotion.sessionCommands.restoreProject(project, [part], null);
  assert.equal(Animotion.state.project.parts[0].id, "head");
  assert.equal(Animotion.state.selectedPartId, "head");
  assert.equal(Animotion.state.currentFrame, 7);
  assert.equal(Animotion.state.motionPlan.template, "dash");
  assert.equal(Animotion.state.correspondences[0].impactAnchor.x, 12);
});

test("session command updates cutscene bridge through motion command", () => {
  const Animotion = loadAnimotion();
  Animotion.sessionCommands.updateCutsceneBridge({ durationFrames: 18, sourceScale: 0.8 });
  assert.equal(Animotion.state.cutsceneBridge.durationFrames, 18);
  assert.equal(Animotion.state.cutsceneBridge.sourceScale, 0.8);
});
