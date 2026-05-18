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
    "scripts/motion-hints.js",
    "scripts/motion-drafts.js",
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
  assert.equal(correspondence.schemaVersion, "editor-correspondence-v1");
  assert.equal(correspondence.kind, "manual");
  assert.equal(correspondence.source.partId, "leg-a");
  assert.equal(correspondence.source.partType, "leg");
  assert.equal(correspondence.target.partType, "foot");
  assert.equal(correspondence.target.anchor.x, 42);
  assert.equal(correspondence.target.anchor.y, 80);
  assert.equal(correspondence.target.coordinateSpace, "impactImage");
  assert.equal(correspondence.target.bImpact, null);
  assert.equal(correspondence.occlusion.status, "partial");
  assert.equal(correspondence.occlusion.hiddenCompletion, "required");
  assert.equal(Animotion.state.project.editor.correspondences.length, 1);
});

test("correspondence stores normalized B impact coordinates separately from display pixels", () => {
  const Animotion = loadAnimotion();
  const normalizedPoint = Animotion.correspondenceModel.normalizedPointFromImagePoint({ x: 500, y: 600 }, {
    width: 1000,
    height: 1000,
  });
  const correspondence = Animotion.correspondenceCommands.upsertForSelectedPart({
    targetPartType: "foot",
    impactAnchor: { x: 500, y: 600 },
    bImpact: normalizedPoint,
  });
  assert.equal(correspondence.bImpact.xNorm, 0.5);
  assert.equal(correspondence.bImpact.yNorm, 0.6);
  assert.equal(correspondence.bImpact.coordinateSpace, "normalized-image");
  const scaled = Animotion.correspondenceModel.imagePointFromNormalized(correspondence.bImpact, {
    width: 500,
    height: 500,
  });
  assert.equal(scaled.x, 250);
  assert.equal(scaled.y, 300);
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
    bImpact: { xNorm: 0.5, yNorm: 0.75, coordinateSpace: "normalized-image" },
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
  assert.equal(normalized.editor.correspondences[0].bImpact.xNorm, 0.5);
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

test("correspondence normalization migrates nested relation data", () => {
  const Animotion = loadAnimotion();
  const normalized = Animotion.correspondenceModel.normalize({
    id: "nested",
    kind: "imported",
    source: { partId: "leg-a", partType: "leg" },
    target: { partType: "foot", anchor: { x: 10.7, y: "20.2" }, coordinateSpace: "sourceImage" },
    occlusion: { depthOrder: "front" },
  }, Animotion.state.parts);
  assert.equal(normalized.kind, "imported");
  assert.equal(normalized.targetPartType, "foot");
  assert.equal(normalized.impactAnchor.x, 11);
  assert.equal(normalized.impactAnchor.y, 20);
  assert.equal(normalized.target.coordinateSpace, "sourceImage");
  assert.equal(normalized.occlusion.depthOrder, "front");
});

test("correspondence model compiles a planner draft from the relation", () => {
  const Animotion = loadAnimotion();
  const draft = Animotion.correspondenceModel.compileForPlanner({
    id: "leg-target",
    sourcePartId: "leg-a",
    targetPartType: "foot",
    impactAnchor: { x: 50, y: 90 },
    occlusion: { status: "partial", hiddenCompletion: "candidate" },
  }, Animotion.state.parts, {
    mapImpactPoint: (point) => ({ x: point.x + 5, y: point.y - 10 }),
  });
  assert.equal(draft.source, "correspondence-compile-v1");
  assert.equal(draft.sourcePartId, "leg-a");
  assert.equal(draft.target.x, 55);
  assert.equal(draft.target.y, 80);
  assert.equal(draft.targetCoordinateSpace, "sourceImage");
  assert.equal(draft.anchors.length, 0);
  assert.equal(draft.motionHints.occlusion, "partial");
  assert.equal(draft.motionHints.hiddenCompletion, "candidate");
  assert.equal(draft.motionHints.warnings[0], "hidden-completion-candidate");
  assert.equal(draft.motionDraft.source, "correspondence");
  assert.equal(draft.motionDraft.draftKind, "non-destructive-2.5d");
  assert.equal(draft.motionDraft.draftScope, "plan");
  assert.equal(draft.motionDraft.compiledFromHintsVersion, 1);
  assert.equal(draft.motionDraft.sourceCorrespondenceId, "leg-target");
  assert.equal(draft.motionDraft.sourceTargetId, "foot");
  assert.equal(draft.motionDraft.visibility.keyframes[1].value, 0.55);
  assert.equal(draft.motionDraft.hiddenCompletion.assetKind, "inpaintedPatch");
  assert.equal(draft.motionDraft.hiddenCompletion.assetStatus, "missing");
  assert.equal(draft.motionDraft.hiddenCompletion.assetId, null);
  assert.equal(draft.relation.occlusion.hiddenCompletion, "candidate");
});

test("correspondence model compiles from normalized B impact after image size changes", () => {
  const Animotion = loadAnimotion();
  const draft = Animotion.correspondenceModel.compileForPlanner({
    id: "leg-target",
    sourcePartId: "leg-a",
    targetPartType: "foot",
    bImpact: { xNorm: 0.5, yNorm: 0.6, coordinateSpace: "normalized-image" },
    target: { bImpact: { xNorm: 0.5, yNorm: 0.6, coordinateSpace: "normalized-image" } },
  }, Animotion.state.parts, {
    impactImageBounds: { width: 500, height: 500 },
    mapImpactPoint: (point) => ({ x: point.x + 10, y: point.y - 20 }),
  });
  assert.equal(draft.target.x, 260);
  assert.equal(draft.target.y, 280);
  assert.equal(draft.relation.target.anchor.x, 250);
  assert.equal(draft.relation.target.anchor.y, 300);
  assert.equal(draft.relation.target.bImpact.xNorm, 0.5);
});

test("correspondence model refuses to compile without an impact anchor", () => {
  const Animotion = loadAnimotion();
  const draft = Animotion.correspondenceModel.compileForPlanner({
    sourcePartId: "leg-a",
    targetPartType: "foot",
  }, Animotion.state.parts);
  assert.equal(draft, null);
});
