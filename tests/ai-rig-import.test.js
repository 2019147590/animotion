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
  assert.equal(project.motions[0].keyframes[0].targetId, "part-arm");
  assert.equal(project.timeline.currentFrame, 7);
  assert.equal(project.editor.separateCharacter, true);
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
