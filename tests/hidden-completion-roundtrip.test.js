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
  const context = { window: { Animotion: { state: {} } } };
  vm.createContext(context);
  for (const path of [
    "scripts/coordinate-spaces.js",
    "scripts/hidden-completion-assets.js",
    "scripts/motion-drafts.js",
    "scripts/project-model.js",
    "scripts/project-serialization.js",
  ]) runScript(context, path);
  return context.window.Animotion;
}

function runScript(context, path) {
  vm.runInContext(fs.readFileSync(path, "utf8"), context, { filename: path });
}

function saveProject(Animotion, project, image, parts, motionPlan = null, cutsceneBridge = null) {
  return Animotion.projectModel.projectFromEditorState({
    project,
    image,
    imageName: "panel.png",
    parts,
    currentFrame: 1,
    motionPlan,
    cutsceneBridge,
  });
}

test("hidden completion guide accepts document-style normalized aliases", () => {
  const Animotion = loadAnimotion();
  const asset = Animotion.hiddenCompletionAssets.normalizeAsset({
    id: "asset_hidden_patch_001",
    type: "hiddenCompletionPatch",
    sourcePartId: "part_leg_right",
    sourceRectNormalized: { x: 0.42, y: 0.35, width: 0.12, height: 0.28 },
    maskVerticesNormalized: [{ x: 0.1, y: 0.7 }],
    guide: {
      meshVerticesNormalized: [{ x: 0.15, y: 0.75 }, { x: 0.42, y: 1.05 }],
      meshFaces: [[0, 1, 1]],
      silhouetteVerticesNormalized: [{ x: 0.12, y: 0.72 }, { x: 0.43, y: 1.02 }],
    },
    patchTransform: { x: 0.2, y: 0.3, scaleX: 1, scaleY: 1, rotation: 0 },
    patchStatus: "guide",
  });

  assert.equal(asset.sourceRectNormalized.xNorm, 0.42);
  assert.equal(asset.sourceRectNormalized.wNorm, 0.12);
  assert.equal(asset.maskVerticesNormalized[0].xNorm, 0.1);
  assert.equal(asset.guide.meshVerticesNormalized[1].yNorm, 1.05);
  assert.equal(asset.guide.silhouetteVerticesNormalized[1].yNorm, 1.02);
  assert.equal(asset.patchTransform.translationNormalized.xNorm, 0.2);
});

test("hidden completion guide survives save load save round trip", () => {
  const Animotion = loadAnimotion();
  const sourcePart = {
    id: "part_leg_right",
    name: "right leg",
    type: "leg",
    rect: { x: 42, y: 35, w: 12, h: 28 },
    pivot: { x: 6, y: 6 },
    joint: { x: 7, y: 24 },
    mask: { points: [{ x: 1.2, y: 19.6 }, { x: 4.8, y: 21 }, { x: 6, y: 28 }] },
    customMotion: {},
    keyframes: [],
  };
  const project = Animotion.projectModel.createEmptyProject({ canvas: { width: 100, height: 100 } });
  project.assets = [Animotion.hiddenCompletionAssets.normalizeAsset({
    id: "asset_hidden_patch_001",
    type: "hiddenCompletionPatch",
    sourcePartId: sourcePart.id,
    sourceRectNormalized: { x: 0.42, y: 0.35, width: 0.12, height: 0.28 },
    maskVerticesNormalized: [{ x: 0.1, y: 0.7 }, { x: 0.4, y: 0.75 }, { x: 0.5, y: 1 }],
    guide: {
      meshVerticesNormalized: [{ x: 0.15, y: 0.75 }, { x: 0.35, y: 0.82 }, { x: 0.42, y: 1.05 }],
      meshFaces: [[0, 1, 2]],
      silhouetteVerticesNormalized: [{ x: 0.12, y: 0.72 }, { x: 0.43, y: 1.02 }],
    },
    patchTransform: { x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0 },
    patchStatus: "guide",
    renderMode: "guideOnly",
  })];
  const firstSave = saveProject(Animotion, project, { naturalWidth: 100, naturalHeight: 100 }, [sourcePart], {
    motionDraft: { hiddenCompletion: { needed: true, status: "required", assetStatus: "ready", assetId: "asset_hidden_patch_001" } },
  });

  const loaded = Animotion.projectModel.normalizeProject(JSON.parse(JSON.stringify(firstSave)), {
    imageBounds: { width: 200, height: 200 },
  });
  const loadedParts = Animotion.projectModel.editorPartsFromProject(loaded);
  const secondSave = saveProject(Animotion, loaded, { naturalWidth: 200, naturalHeight: 200 }, loadedParts, loaded.editor.motionPlan);
  const patch = secondSave.assets.find((asset) => asset.id === "asset_hidden_patch_001");
  const runtime = Animotion.hiddenCompletionAssets.runtimeGuideMesh(patch, loadedParts[0].rect);

  assert.equal(loadedParts[0].rect.x, 84);
  assert.equal(loadedParts[0].rect.w, 24);
  assert.equal(patch.guide.meshVerticesNormalized[2].xNorm, 0.42);
  assert.equal(patch.guide.meshVerticesNormalized[2].yNorm, 1.05);
  assert.equal(patch.guide.silhouetteVerticesNormalized[1].yNorm, 1.02);
  assert.equal(runtime.meshVertices[2].x, 10.08);
  assert.equal(runtime.meshVertices[2].y, 58.800000000000004);
});

test("motion draft and hidden patch guide survive save load save round trip together", () => {
  const Animotion = loadAnimotion();
  const part = {
    id: "part_arm_right",
    name: "right arm",
    type: "arm",
    rect: { x: 20, y: 10, w: 30, h: 40 },
    pivot: { x: -6, y: 8 },
    joint: { x: 38, y: 44 },
    mask: { points: [{ x: -3, y: 2 }, { x: 28, y: 18 }, { x: 36, y: 45 }] },
    customMotion: {},
    keyframes: [],
  };
  const asset = Animotion.hiddenCompletionAssets.normalizeAsset({
    id: "asset_hidden_arm",
    type: "hiddenCompletionPatch",
    sourcePartId: part.id,
    sourceRectNormalized: { xNorm: 0.2, yNorm: 0.1, wNorm: 0.3, hNorm: 0.4 },
    guide: {
      meshVerticesNormalized: [{ xNorm: -0.1, yNorm: 0.2 }, { xNorm: 1.2, yNorm: 0.4 }, { xNorm: 1.35, yNorm: 1.15 }],
      meshFaces: [[0, 1, 2]],
      silhouetteVerticesNormalized: [{ xNorm: -0.2, yNorm: 0.1 }, { xNorm: 1.25, yNorm: 1.05 }],
    },
    patchStatus: "guide",
    renderMode: "guideOnly",
  });
  const draft = Animotion.motionDrafts.normalize({
    partId: part.id,
    hiddenCompletion: { needed: true, status: "required", assetKind: "hiddenCompletionPatch", assetStatus: "ready", assetId: asset.id },
  }, { assets: [asset] });
  const project = Animotion.projectModel.createEmptyProject({ canvas: { width: 100, height: 100 } });
  project.assets = [asset];
  const firstSave = saveProject(Animotion, project, { naturalWidth: 100, naturalHeight: 100 }, [part], { motionDraft: draft }, { jointAction: { motionDraft: { ...draft, draftScope: "action-snapshot" } } });
  const loaded = Animotion.projectModel.normalizeProject(JSON.parse(JSON.stringify(firstSave)), { imageBounds: { width: 100, height: 100 } });
  const secondSave = saveProject(Animotion, loaded, { naturalWidth: 100, naturalHeight: 100 }, Animotion.projectModel.editorPartsFromProject(loaded), loaded.editor.motionPlan, loaded.editor.cutsceneBridge);
  const patch = secondSave.assets.find((candidate) => candidate.id === asset.id);

  assert.equal(secondSave.editor.motionPlan.motionDraft.hiddenCompletion.assetId, asset.id);
  assert.equal(secondSave.editor.cutsceneBridge.jointAction.motionDraft.hiddenCompletion.assetId, asset.id);
  assert.equal(patch.guide.meshVerticesNormalized[0].xNorm, -0.1);
  assert.equal(patch.guide.meshVerticesNormalized[2].yNorm, 1.15);
  assert.equal(secondSave.parts[0].pivotNormalized.xNorm, -0.2);
  assert.equal(secondSave.parts[0].jointNormalized.yNorm, 1.1);
});

test("project rig serialization preserves parentPartId fallback links", () => {
  const Animotion = loadAnimotion();
  const parts = [
    { id: "body", name: "body", type: "body", rect: { x: 0, y: 0, w: 20, h: 40 }, pivot: { x: 10, y: 20 }, joint: { x: 10, y: 36 }, customMotion: {}, keyframes: [] },
    { id: "head", name: "head", type: "head", parentId: null, parentPartId: "body", rect: { x: 2, y: -14, w: 16, h: 16 }, pivot: { x: 8, y: 14 }, joint: { x: 8, y: 8 }, customMotion: {}, keyframes: [] },
  ];
  const saved = saveProject(Animotion, Animotion.projectModel.createEmptyProject({ canvas: { width: 100, height: 100 } }), { naturalWidth: 100, naturalHeight: 100 }, parts);
  const headBone = saved.rigs[0].bones.find((bone) => bone.partId === "head");
  assert.equal(saved.rigs[0].rootPartId, "body");
  assert.equal(headBone.parentBoneId, "bone-body");
});
