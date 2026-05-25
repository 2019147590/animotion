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
    window: { Animotion: { view: {}, state: {} } },
    document: { createElement: () => fakeCanvas(), querySelector: () => null },
    performance: { now: () => 1000 },
    Image: class Image {
      set src(value) { this._src = value; this.id = "snapshot-image"; this.onload?.(); }
      get src() { return this._src; }
    },
    Path2D: class Path2D {
      moveTo() {}
      lineTo() {}
      closePath() {}
      ellipse() {}
    },
  };
  vm.createContext(context);
  for (const path of [
    "scripts/config.js",
    "scripts/geometry.js",
    "scripts/path.js",
    "scripts/coordinate-spaces.js",
    "scripts/motion-model.js",
    "scripts/human-rig-schema.js",
    "scripts/rig-connection.js",
    "scripts/hidden-completion-coverage-bounds.js",
    "scripts/hidden-completion-assets.js",
    "scripts/project-model.js",
    "scripts/project-serialization.js",
    "scripts/hidden-completion-supplemental-coverage.js",
    "scripts/hidden-completion-supplemental-part.js",
    "scripts/hidden-completion-supplemental-warp.js",
    "scripts/hidden-completion-supplemental-project.js",
    "scripts/cutscene-action-selectors.js",
    "scripts/cutscene-model.js",
    "scripts/motion-planner.js",
    "scripts/motion-commands.js",
    "scripts/correspondence-model.js",
    "scripts/correspondence-commands.js",
    "scripts/session-commands.js",
    "scripts/parts.js",
    "scripts/io.js",
  ]) vm.runInContext(fs.readFileSync(path, "utf8"), context, { filename: path });
  const Animotion = context.window.Animotion;
  Object.assign(Animotion.state, {
    image: { id: "source-image", naturalWidth: 200, naturalHeight: 160 },
    imageName: "panel.png",
    parts: [],
    project: Animotion.projectModel.createEmptyProject({ canvas: { width: 200, height: 160 } }),
    currentFrame: 1,
    panelSetup: {},
    correspondences: [],
    motionPlan: { template: "kick" },
  });
  Animotion.dom = { els: { motionTemplate: { value: "breathe" } } };
  return Animotion;
}

function fakeCanvas(width = 1, height = 1, patch = {}) {
  const ops = [];
  const canvas = {
    width,
    height,
    __ops: ops,
    getContext: () => ({
      clearRect() {},
      save() {},
      restore() {},
      translate() {},
      rotate() {},
      scale() {},
      fill() {},
      drawImage(...args) {
        ops.push({ name: "drawImage", args });
        if (args[0]?.src) canvas.__dataUrl = args[0].src;
      },
    }),
    toDataURL: () => canvas.__dataUrl || canvas.__snapshotDataUrl || "data:image/png;base64,ZmFrZS1jYW52YXM=",
    ...patch,
  };
  return canvas;
}

function projectFixture(Animotion) {
  const source = part("body", "body", { x: 40, y: 30, w: 80, h: 100 }, { humanRole: "torso" });
  const counterpart = part("body_ref", "body", { x: 110, y: 30, w: 80, h: 100 }, { humanRole: "torso" });
  const supplemental = {
    ...part("supp-hidden-body", "body", { x: 36, y: 26, w: 88, h: 108 }, { humanRole: "torso" }),
    isSupplementalPart: true,
    sourcePatchAssetId: "hidden-body-symmetry",
    sourcePartId: "body",
    counterpartPartId: "body_ref",
    supplementalWarp: {
      points: [{ id: "tl", x: -2, y: 1 }, { id: "tr", x: 88, y: 0 }, { id: "br", x: 90, y: 108 }, { id: "bl", x: 0, y: 110 }],
      materialSeam: {
        sourcePoints: [{ id: "seamA", x: 0, y: 54 }, { id: "seamB", x: 88, y: 54 }],
        points: [{ id: "seamA", x: 0, y: 42 }, { id: "seamB", x: 88, y: 42 }],
      },
    },
  };
  const patch = Animotion.hiddenCompletionAssets.normalizeAsset({
    id: "hidden-body-symmetry",
    type: "hiddenCompletionPatch",
    sourcePartId: "body",
    guide: {
      silhouetteVerticesNormalized: [{ xNorm: -0.05, yNorm: -0.04 }, { xNorm: 1.05, yNorm: -0.04 }, { xNorm: 1.05, yNorm: 1.04 }, { xNorm: -0.05, yNorm: 1.04 }],
    },
    completionMethod: "symmetry",
    symmetrySource: { counterpartPartId: "body_ref", targetPartId: "body" },
  });
  return Animotion.projectModel.normalizeProject({
    format: "animotion-project",
    version: "1.0.0",
    metadata: { name: "Project", createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z" },
    canvas: { width: 200, height: 160, fps: 24, durationFrames: 12 },
    assets: [patch],
    parts: [source, counterpart, supplemental],
  }, { imageBounds: { width: 200, height: 160 } });
}

function part(id, type, rect, patch = {}) {
  return {
    id,
    name: id,
    type,
    rect,
    sourceRect: rect,
    pivot: { x: rect.w * 0.5, y: rect.h * 0.25 },
    joint: { x: rect.w * 0.5, y: rect.h * 0.85 },
    mask: { kind: "polygon", points: [{ x: 0, y: 0 }, { x: rect.w, y: 0 }, { x: rect.w, y: rect.h }, { x: 0, y: rect.h }] },
    customMotion: {},
    keyframes: [],
    ...patch,
  };
}

test("project load regenerates supplemental canvas from linked patch instead of source crop", () => {
  const Animotion = loadAnimotion();
  const parts = Animotion.io.deserializeProjectParts(projectFixture(Animotion));
  const supplemental = parts.find((part) => part.id === "supp-hidden-body");

  assert.equal(supplemental.canvas.__sourceSamplingPath, "expanded-source-image-counterpart");
  assert.equal(supplemental.canvas.__ops.some((op) => op.name === "drawImage" && op.args[0].id === "source-image"), true);
  assert.deepEqual(JSON.parse(JSON.stringify(supplemental.supplementalWarp.materialSeam.points[0])), { id: "seamA", x: 0, y: 42 });
});

test("save load save preserves supplemental warp and restores canvas from snapshot", () => {
  const Animotion = loadAnimotion();
  const project = projectFixture(Animotion);
  const parts = Animotion.projectModel.editorPartsFromProject(project);
  const supplemental = parts.find((part) => part.id === "supp-hidden-body");
  supplemental.canvas = fakeCanvas(88, 108, { __dataUrl: "data:image/png;base64,c2F2ZWQtc25hcHNob3Q=" });
  Animotion.state.parts = parts;
  Animotion.state.project = project;

  const saved = Animotion.projectModel.projectFromEditorState(Animotion.state);
  const savedSupplemental = saved.parts.find((part) => part.id === "supp-hidden-body");
  assert.equal(savedSupplemental.supplementalCanvasDataUrl, "data:image/png;base64,c2F2ZWQtc25hcHNob3Q=");
  assert.equal(savedSupplemental.supplementalCanvasWidth, 88);
  assert.equal(savedSupplemental.supplementalCanvasHeight, 108);

  const loadedProject = Animotion.projectModel.normalizeProject(JSON.parse(JSON.stringify(saved)), { imageBounds: { width: 200, height: 160 } });
  const loadedParts = Animotion.io.deserializeProjectParts(loadedProject);
  const loadedSupplemental = loadedParts.find((part) => part.id === "supp-hidden-body");

  assert.deepEqual(JSON.parse(JSON.stringify(loadedSupplemental.supplementalWarp)), JSON.parse(JSON.stringify(supplemental.supplementalWarp)));
  assert.equal(loadedSupplemental.canvas.__sourceSamplingPath, "saved-supplemental-canvas-snapshot");
  assert.equal(loadedSupplemental.canvas.__snapshotDataUrl, "data:image/png;base64,c2F2ZWQtc25hcHNob3Q=");
  assert.equal(loadedSupplemental.supplementalCanvasDiagnostics.restoredCanvasFromSnapshot, true);
  assert.equal(loadedSupplemental.supplementalCanvasDiagnostics.regeneratedCanvasFromMetadata, false);

  const secondSave = Animotion.projectModel.projectFromEditorState({ ...Animotion.state, project: loadedProject, parts: loadedParts });
  assert.equal(secondSave.parts.find((part) => part.id === "supp-hidden-body").supplementalCanvasDataUrl, "data:image/png;base64,c2F2ZWQtc25hcHNob3Q=");
});

test("legacy supplemental without saved canvas still regenerates from metadata", () => {
  const Animotion = loadAnimotion();
  const parts = Animotion.io.deserializeProjectParts(projectFixture(Animotion));
  const supplemental = parts.find((part) => part.id === "supp-hidden-body");

  assert.equal(supplemental.canvas.__sourceSamplingPath, "expanded-source-image-counterpart");
  assert.equal(supplemental.supplementalCanvasDiagnostics.restoredCanvasFromSnapshot, false);
  assert.equal(supplemental.supplementalCanvasDiagnostics.regeneratedCanvasFromMetadata, true);
});

test("saved supplemental canvas snapshot is used even if generation output changes", () => {
  const Animotion = loadAnimotion();
  const project = projectFixture(Animotion);
  const parts = Animotion.projectModel.editorPartsFromProject(project);
  const supplemental = parts.find((part) => part.id === "supp-hidden-body");
  supplemental.canvas = fakeCanvas(88, 108, { __dataUrl: "data:image/png;base64,c3RhYmxlLXNuYXBzaG90" });
  Animotion.state.parts = parts;
  Animotion.state.project = project;
  const saved = Animotion.projectModel.projectFromEditorState(Animotion.state);
  const loadedProject = Animotion.projectModel.normalizeProject(JSON.parse(JSON.stringify(saved)), { imageBounds: { width: 200, height: 160 } });
  Animotion.hiddenCompletionSupplementalPart.regenerateCanvasForPart = () => {
    throw new Error("regeneration should not run when a saved snapshot exists");
  };

  const loadedParts = Animotion.io.deserializeProjectParts(loadedProject);
  const loadedSupplemental = loadedParts.find((part) => part.id === "supp-hidden-body");

  assert.equal(loadedSupplemental.canvas.__snapshotDataUrl, "data:image/png;base64,c3RhYmxlLXNuYXBzaG90");
  assert.equal(loadedSupplemental.canvas.__sourceSamplingPath, "saved-supplemental-canvas-snapshot");
});
