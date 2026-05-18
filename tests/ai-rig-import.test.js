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
  return loadAnimotion().io;
}

function loadAnimotion() {
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
  runScript(context, "scripts/coordinate-spaces.js");
  runScript(context, "scripts/hidden-completion-assets.js");
  runScript(context, "scripts/motion-model.js");
  runScript(context, "scripts/project-model.js");
  runScript(context, "scripts/project-serialization.js");
  runScript(context, "scripts/io.js");
  return context.window.Animotion;
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

test("save payload uses the central AnimotionProject model", () => {
  const Animotion = loadAnimotion();
  Object.assign(Animotion.state, {
    imageName: "panel.png",
    image: { naturalWidth: 640, naturalHeight: 480 },
    currentFrame: 7,
    separateCharacter: true,
    panelSetup: { source: { crop: { x: 1, y: 2, w: 300, h: 200 } } },
    motionPlan: { template: "kick", target: { x: 10, y: 20 } },
    project: {
      assets: [{
        id: "hidden-part-arm",
        type: "hiddenCompletionPatch",
        name: "arm hidden",
        uri: "hidden-completion://hidden-part-arm",
        sourcePartId: "part-arm",
        sourceRectNormalized: { xNorm: 0.1, yNorm: 0.2, wNorm: 0.3, hNorm: 0.4, coordinateSpace: "normalized-image" },
        maskVerticesNormalized: [{ xNorm: 0.5, yNorm: 0.25, coordinateSpace: "part-local-normalized" }],
        guide: {
          meshVerticesNormalized: [
            { xNorm: 0, yNorm: 0, coordinateSpace: "part-local-normalized" },
            { xNorm: 1, yNorm: 0, coordinateSpace: "part-local-normalized" },
            { xNorm: 1, yNorm: 1, coordinateSpace: "part-local-normalized" },
            { xNorm: 0, yNorm: 1, coordinateSpace: "part-local-normalized" },
          ],
          meshFaces: [[0, 1, 2], [0, 2, 3]],
          silhouetteVerticesNormalized: [{ xNorm: 0.5, yNorm: 0.25, coordinateSpace: "part-local-normalized" }],
          guideStrength: 1,
          coordinateSpace: "part-local-normalized",
        },
        generatedResult: { status: "none", assetId: null, generatedAt: null, sourceGuideVersion: null },
        renderMode: "guideOnly",
        patchTransform: { translationNormalized: { xNorm: 0.2, yNorm: 0.3 }, scaleX: 1.1, scaleY: 1, rotation: 0.2 },
        patchStatus: "ready",
        preview: { label: "arm back", color: "#8fd3ff", visible: true },
      }],
    },
    parts: [{
      id: "part-arm",
      name: "arm",
      type: "arm",
      rect: { x: 10, y: 20, w: 30, h: 40 },
      pivot: { x: 5, y: 6 },
      joint: { x: 25, y: 30 },
      order: 3,
      alpha: 0.5,
      hidden: true,
      customMotion: { x: 4, rotate: 12 },
      keyframes: [{ frame: 7, pose: { x: 9, rotate: 3 } }],
    }],
  });
  const project = Animotion.io.createRigPayload();
  assert.equal(project.format, "animotion-project");
  assert.equal(typeof project.version, "string");
  assert.equal(project.canvas.width, 640);
  assert.equal(project.parts[0].sourceRect.x, 10);
  assert.equal(project.parts[0].layerIndex, 3);
  assert.equal(project.parts[0].visible, false);
  assert.equal(project.parts[0].opacity, 0.5);
  assert.equal(project.parts[0].sourceRectNormalized.coordinateSpace, "normalized-image");
  assert.equal(project.parts[0].sourceRectNormalized.xNorm, 10 / 640);
  assert.equal(project.parts[0].pivotNormalized.coordinateSpace, "part-local-normalized");
  assert.equal(project.parts[0].pivotNormalized.xNorm, 5 / 30);
  assert.equal(project.parts[0].jointNormalized.yNorm, 30 / 40);
  assert.equal(project.parts[0].maskVerticesNormalized.length, 0);
  assert.equal(project.motions[0].keyframes[0].targetId, "part-arm");
  assert.equal(project.timeline.currentFrame, 7);
  assert.equal(project.editor.separateCharacter, true);
  const patch = project.assets.find((asset) => asset.id === "hidden-part-arm");
  assert.equal(patch.type, "hiddenCompletionPatch");
  assert.equal(patch.sourcePartId, "part-arm");
  assert.equal(patch.patchStatus, "ready");
  assert.equal(patch.maskVerticesNormalized[0].xNorm, 0.5);
  assert.equal(patch.guide.meshVerticesNormalized.length, 4);
  assert.equal(patch.generatedResult.status, "none");
  assert.equal(patch.renderMode, "guideOnly");
});

test("project importer restores normalized part coordinates against the current source image size", () => {
  const Animotion = loadAnimotion();
  Animotion.state.image = { naturalWidth: 200, naturalHeight: 160 };
  const parts = Animotion.io.rigPartsFromPayload({
    format: "animotion-project",
    version: "1.0.0",
    metadata: { name: "Scaled", createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z" },
    canvas: { width: 100, height: 80, fps: 24, durationFrames: 12 },
    assets: [{ id: "source-image", type: "sourceImage", name: "small.png", uri: "small.png" }],
    parts: [{
      id: "part-leg",
      name: "leg",
      type: "leg",
      assetId: "asset-leg",
      sourceRect: { x: 10, y: 20, w: 30, h: 40 },
      sourceRectNormalized: { xNorm: 0.1, yNorm: 0.25, wNorm: 0.3, hNorm: 0.5, coordinateSpace: "normalized-image" },
      pivot: { x: 15, y: 10 },
      joint: { x: 24, y: 30 },
      pivotNormalized: { xNorm: 0.5, yNorm: 0.25, coordinateSpace: "part-local-normalized" },
      jointNormalized: { xNorm: 0.8, yNorm: 0.75, coordinateSpace: "part-local-normalized" },
      mask: { kind: "polygon", points: [{ x: 0, y: 0 }, { x: 3, y: 4 }, { x: 15, y: 20 }] },
      maskVerticesNormalized: [
        { xNorm: 0, yNorm: 0, coordinateSpace: "part-local-normalized" },
        { xNorm: 1, yNorm: 1, coordinateSpace: "part-local-normalized" },
        { xNorm: 0.5, yNorm: 0.5, coordinateSpace: "part-local-normalized" },
      ],
      transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 },
    }],
    motions: [],
  });
  assert.equal(parts[0].rect.x, 20);
  assert.equal(parts[0].rect.y, 40);
  assert.equal(parts[0].rect.w, 60);
  assert.equal(parts[0].rect.h, 80);
  assert.equal(parts[0].pivot.x, 30);
  assert.equal(parts[0].pivot.y, 20);
  assert.equal(parts[0].joint.x, 48);
  assert.equal(parts[0].joint.y, 60);
  assert.equal(parts[0].mask.points[1].x, 60);
  assert.equal(parts[0].mask.points[1].y, 80);
});

test("project serialization preserves hidden completion patch assets after reload", () => {
  const Animotion = loadAnimotion();
  const project = Animotion.projectModel.normalizeProject({
    format: "animotion-project",
    version: "1.0.0",
    metadata: { name: "Patch", createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z" },
    canvas: { width: 100, height: 80, fps: 24, durationFrames: 12 },
    assets: [{
      id: "hidden-leg",
      type: "hiddenCompletionPatch",
      name: "leg hidden",
      uri: "hidden-completion://hidden-leg",
      sourcePartId: "part-leg",
      guide: {
        meshVerticesNormalized: [{ xNorm: 0, yNorm: 0 }, { xNorm: 1, yNorm: 0 }, { xNorm: 1, yNorm: 1 }],
        meshFaces: [[0, 1, 2]],
        silhouetteVerticesNormalized: [{ xNorm: 0.5, yNorm: 0.5 }],
      },
      renderMode: "guideOnly",
      patchStatus: "ready",
    }],
    parts: [{ id: "part-leg", name: "leg", type: "leg", sourceRect: { x: 10, y: 20, w: 30, h: 40 } }],
  });
  const saved = Animotion.projectModel.projectFromEditorState({
    project,
    imageName: "panel.png",
    image: { naturalWidth: 100, naturalHeight: 80 },
    parts: Animotion.projectModel.editorPartsFromProject(project),
    currentFrame: 1,
  });
  const patch = saved.assets.find((asset) => asset.id === "hidden-leg");
  assert.equal(patch.type, "hiddenCompletionPatch");
  assert.equal(patch.patchStatus, "ready");
  assert.equal(patch.guide.meshFaces[0].length, 3);
  assert.equal(patch.renderMode, "guideOnly");
});

test("project importer restores editor part fields from AnimotionProject", () => {
  const io = loadIo();
  const parts = io.rigPartsFromPayload({
    format: "animotion-project",
    version: "1.0.0",
    metadata: { name: "Round trip", createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z" },
    canvas: { width: 100, height: 80, fps: 24, durationFrames: 12 },
    assets: [{ id: "source-image", type: "sourceImage", name: "panel.png", uri: "panel.png" }],
    parts: [{
      id: "part-head",
      name: "head",
      type: "head",
      assetId: "asset-head",
      sourceRect: { x: 3, y: 4, w: 20, h: 22 },
      layerIndex: 2,
      visible: false,
      opacity: 0.75,
      pivot: { x: 10, y: 11 },
      joint: { x: 12, y: 18 },
      transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 },
      motionSettings: { y: 5 },
    }],
    motions: [{
      id: "motion-part-head",
      name: "head motion",
      durationFrames: 12,
      keyframes: [{ frame: 4, targetId: "part-head", targetType: "part", property: "customMotion", value: { x: 6 } }],
    }],
  });
  assert.equal(parts[0].rect.x, 3);
  assert.equal(parts[0].rect.y, 4);
  assert.equal(parts[0].rect.w, 20);
  assert.equal(parts[0].rect.h, 22);
  assert.equal(parts[0].order, 2);
  assert.equal(parts[0].hidden, true);
  assert.equal(parts[0].alpha, 0.75);
  assert.equal(parts[0].customMotion.y, 5);
  assert.equal(parts[0].keyframes[0].pose.x, 6);
});
