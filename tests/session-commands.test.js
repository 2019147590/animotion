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
  const motionTemplate = { value: "breathe" };
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
  Animotion.dom = { els: { motionTemplate } };
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
  assert.equal(Animotion.state.parts.length, 0);
  assert.equal(Animotion.state.selectedPartId, null);
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

test("cutscene panel scale keeps wider values through project save and restore", () => {
  const Animotion = loadAnimotion();
  Animotion.state.image = { naturalWidth: 100, naturalHeight: 80 };
  Animotion.sessionCommands.updateCutsceneBridge({ sourceScale: 0.25, impactScale: 3.6 });
  const saved = Animotion.projectModel.projectFromEditorState(Animotion.state);
  const restored = Animotion.projectModel.normalizeProject(saved);
  Animotion.sessionCommands.restoreProject(restored, [], null);
  assert.equal(Animotion.state.cutsceneBridge.sourceScale, 0.25);
  assert.equal(Animotion.state.cutsceneBridge.impactScale, 3.6);
});

test("cutscene ghost toggle survives project save and restore", () => {
  const Animotion = loadAnimotion();
  Animotion.state.image = { naturalWidth: 100, naturalHeight: 80 };
  Animotion.sessionCommands.updateCutsceneBridge({ ghostEnabled: false });
  const saved = Animotion.projectModel.projectFromEditorState(Animotion.state);
  const restored = Animotion.projectModel.normalizeProject(saved);
  Animotion.sessionCommands.restoreProject(restored, [], null);
  assert.equal(Animotion.state.cutsceneBridge.ghostEnabled, false);
});

test("project restore uses saved cutscene bridge instead of current panel transform", () => {
  const Animotion = loadAnimotion();
  const project = Animotion.projectModel.normalizeProject({
    format: "animotion-project",
    version: "1.0.0",
    metadata: { name: "Project", createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z" },
    canvas: { width: 100, height: 80, fps: 24, durationFrames: 18 },
    parts: [],
    editor: {
      cutsceneBridge: { durationFrames: 18, impactFrame: 12, sourceX: 80, sourceScale: 1.8, impactX: -40, impactScale: 0.7 },
    },
  });
  const currentBridge = { durationFrames: 18, impactFrame: 15, sourceX: -120, sourceScale: 0.35, impactX: 90, impactScale: 2.4 };
  Animotion.sessionCommands.restoreProject(project, [], currentBridge);
  assert.equal(Animotion.state.cutsceneBridge.impactFrame, 12);
  assert.equal(Animotion.state.cutsceneBridge.sourceX, 80);
  assert.equal(Animotion.state.cutsceneBridge.sourceScale, 1.8);
  assert.equal(Animotion.state.cutsceneBridge.impactX, -40);
  assert.equal(Animotion.state.cutsceneBridge.impactScale, 0.7);
});

test("project restore returns the motion UI to cutscene mode when a cutscene bridge is saved", () => {
  const Animotion = loadAnimotion();
  const project = Animotion.projectModel.normalizeProject({
    format: "animotion-project",
    version: "1.0.0",
    metadata: { name: "Project", createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z" },
    canvas: { width: 100, height: 80, fps: 24, durationFrames: 18 },
    parts: [],
    editor: {
      cutsceneBridge: {
        durationFrames: 18,
        impactFrame: 12,
        jointAction: { source: "motion-planner-kick-anchors-v1", beats: [{ id: "impact", at: 12, pose: { rFoot: [30, 40] } }] },
      },
    },
  });
  Animotion.dom.els.motionTemplate.value = "breathe";
  Animotion.sessionCommands.restoreProject(project, [], null);
  assert.equal(Animotion.dom.els.motionTemplate.value, "cutscene");
});

test("empty parts project sync and serialization stays valid after image reset", () => {
  const Animotion = loadAnimotion();
  const image = { naturalWidth: 320, naturalHeight: 240 };
  Animotion.sessionCommands.resetForNewImage(image, "empty.png");
  const saved = Animotion.projectModel.projectFromEditorState(Animotion.state);
  assert.equal(saved.parts.length, 0);
  assert.equal(saved.rigs[0].rootPartId, null);
  assert.equal(saved.rigs[0].bones.length, 0);
  assert.equal(saved.editor.selectedPartId, null);
  assert.equal(saved.assets.some((asset) => asset.id === "source-image"), true);
});
