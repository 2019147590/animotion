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
    "scripts/motion-model.js",
    "scripts/human-rig-schema.js",
    "scripts/rig-connection.js",
    "scripts/hidden-completion-assets.js",
    "scripts/hidden-completion-supplemental-warp.js",
    "scripts/project-model.js",
    "scripts/project-serialization.js",
    "scripts/hidden-completion-supplemental-project.js",
  ]) vm.runInContext(fs.readFileSync(path, "utf8"), context, { filename: path });
  return context.window.Animotion;
}

test("supplemental warp survives save load save without affecting legacy parts", () => {
  const Animotion = loadAnimotion();
  const supplemental = {
    id: "supp-hidden-body",
    name: "body 보완",
    type: "body",
    rect: { x: 10, y: 20, w: 40, h: 30 },
    sourceRect: { x: 10, y: 20, w: 40, h: 30 },
    pivot: { x: 20, y: 8 },
    joint: { x: 20, y: 24 },
    mask: { points: [{ x: 0, y: 0 }, { x: 40, y: 0 }, { x: 40, y: 30 }, { x: 0, y: 30 }] },
    isSupplementalPart: true,
    sourcePatchAssetId: "hidden-body",
    supplementalWarp: { points: [{ id: "tl", x: -2, y: 1 }, { id: "tr", x: 40, y: 0 }, { id: "br", x: 42, y: 29 }, { id: "bl", x: 0, y: 32 }] },
    customMotion: {},
    keyframes: [],
  };
  const normal = { ...supplemental, id: "body", isSupplementalPart: false, supplementalWarp: undefined };
  const project = Animotion.projectModel.projectFromEditorState({
    project: Animotion.projectModel.createEmptyProject({ canvas: { width: 100, height: 100 } }),
    image: { naturalWidth: 100, naturalHeight: 100 },
    imageName: "panel.png",
    parts: [normal, supplemental],
    currentFrame: 1,
  });
  const loaded = Animotion.projectModel.normalizeProject(JSON.parse(JSON.stringify(project)), { imageBounds: { width: 100, height: 100 } });
  const savedAgain = Animotion.projectModel.projectFromEditorState({
    project: loaded,
    image: { naturalWidth: 100, naturalHeight: 100 },
    imageName: "panel.png",
    parts: Animotion.projectModel.editorPartsFromProject(loaded),
    currentFrame: 1,
  });

  assert.equal(savedAgain.parts.find((part) => part.id === "body").supplementalWarp, undefined);
  assert.deepEqual(JSON.parse(JSON.stringify(savedAgain.parts.find((part) => part.id === "supp-hidden-body").supplementalWarp.points[0])), { id: "tl", x: -2, y: 1 });
});
