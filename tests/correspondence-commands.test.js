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
  const context = { window: { Animotion: {} }, crypto: { randomUUID: () => "corr-id" } };
  vm.createContext(context);
  for (const path of [
    "scripts/config.js",
    "scripts/geometry.js",
    "scripts/motion-model.js",
    "scripts/project-model.js",
    "scripts/project-serialization.js",
    "scripts/command-history.js",
    "scripts/correspondence-model.js",
  ]) runScript(context, path);
  const Animotion = context.window.Animotion;
  Animotion.state = {
    parts: [{ id: "leg-a", name: "leg", type: "leg" }],
    selectedPartId: "leg-a",
    correspondences: [],
    project: Animotion.projectModel.createEmptyProject(),
  };
  runScript(context, "scripts/correspondence-commands.js");
  return Animotion;
}

function runScript(context, path) {
  vm.runInContext(fs.readFileSync(path, "utf8"), context, { filename: path });
}

test("correspondence command creates 2.5D-ready selected part metadata", () => {
  const Animotion = loadAnimotion();
  const correspondence = Animotion.correspondenceCommands.upsertForSelectedPart({
    targetPartType: "foot",
    impactAnchor: { x: "42.4", y: 80 },
    occlusion: { status: "partial", depthOrder: "behind", hiddenCompletion: "required" },
  });
  assert.equal(correspondence.sourcePartId, "leg-a");
  assert.equal(correspondence.sourcePartType, "leg");
  assert.equal(correspondence.targetPartType, "foot");
  assert.equal(correspondence.impactAnchor.x, 42);
  assert.equal(correspondence.impactAnchor.y, 80);
  assert.equal(correspondence.occlusion.status, "partial");
  assert.equal(correspondence.occlusion.hiddenCompletion, "required");
  assert.equal(Animotion.state.project.editor.correspondences.length, 1);
});

test("correspondence command records undo and redo", () => {
  const Animotion = loadAnimotion();
  Animotion.correspondenceCommands.upsertForSelectedPart({ targetPartType: "foot" });
  assert.equal(Animotion.state.correspondences.length, 1);
  assert.equal(Animotion.commandHistory.undo(), true);
  assert.equal(Animotion.state.correspondences.length, 0);
  assert.equal(Animotion.commandHistory.redo(), true);
  assert.equal(Animotion.state.correspondences[0].targetPartType, "foot");
});

test("project serialization round-trips editor correspondences", () => {
  const Animotion = loadAnimotion();
  Animotion.correspondenceCommands.upsertForSelectedPart({
    targetPartType: "foot",
    impactAnchor: { x: 50, y: 90 },
    occlusion: { status: "hidden" },
  });
  const project = Animotion.projectModel.projectFromEditorState({
    imageName: "a.png",
    image: { naturalWidth: 100, naturalHeight: 80 },
    parts: Animotion.state.parts,
    correspondences: Animotion.state.correspondences,
    currentFrame: 1,
  });
  assert.equal(project.editor.correspondences[0].sourcePartId, "leg-a");
  const normalized = Animotion.projectModel.normalizeProject(project);
  assert.equal(normalized.editor.correspondences[0].impactAnchor.x, 50);
});

test("correspondence normalization drops missing source parts", () => {
  const Animotion = loadAnimotion();
  const normalized = Animotion.correspondenceModel.normalizeList([
    { sourcePartId: "missing", targetPartType: "hand" },
    { sourcePartId: "leg-a", targetPartType: "foot" },
  ], Animotion.state.parts);
  assert.equal(normalized.length, 1);
  assert.equal(normalized[0].sourcePartId, "leg-a");
});
