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
    "scripts/config.js",
    "scripts/coordinate-spaces.js",
    "scripts/human-rig-schema.js",
    "scripts/hidden-completion-assets.js",
    "scripts/motion-model.js",
    "scripts/project-model.js",
    "scripts/project-serialization.js",
  ]) runScript(context, path);
  return context.window.Animotion;
}

function runScript(context, path) {
  vm.runInContext(fs.readFileSync(path, "utf8"), context, { filename: path });
}

test("human rig schema normalizes supported roles without changing part type", () => {
  const schema = loadAnimotion().humanRigSchema;
  const part = schema.normalizePart({ id: "arm-a", type: "arm", humanRole: "forearm" });
  assert.equal(part.type, "arm");
  assert.equal(part.humanRole, "forearm");
  assert.equal(schema.normalizePart({ type: "arm", humanRole: "claw" }).humanRole, null);
});

test("human rig schema reports missing roles and parent-chain issues", () => {
  const schema = loadAnimotion().humanRigSchema;
  const result = schema.validateRig([
    part("torso", "torso", null),
    part("head", "head", "torso"),
    part("forearm", "forearm", "missing-upper-arm"),
  ], { requiredRoles: ["torso", "pelvis", "head", "forearm"] });
  assert.equal(result.valid, false);
  assert.deepEqual(result.missingRoles, ["pelvis"]);
  assert.equal(result.parentIssues[0].type, "missing-parent");
});

test("human rig schema detects parent cycles", () => {
  const schema = loadAnimotion().humanRigSchema;
  const result = schema.validateRig([
    part("torso", "torso", "head"),
    part("head", "head", "torso"),
  ], { requiredRoles: ["torso", "head"] });
  assert.equal(result.parentIssues.some((issue) => issue.type === "cycle"), true);
});

test("project save load round trip preserves humanRole metadata", () => {
  const Animotion = loadAnimotion();
  const sourcePart = {
    id: "right-forearm",
    name: "right forearm",
    type: "arm",
    humanRole: "forearm",
    rect: { x: 10, y: 20, w: 30, h: 40 },
    pivot: { x: 5, y: 6 },
    joint: { x: 20, y: 35 },
    customMotion: {},
    keyframes: [],
  };
  const saved = Animotion.projectModel.projectFromEditorState({
    imageName: "human.png",
    image: { naturalWidth: 100, naturalHeight: 100 },
    parts: [sourcePart],
    currentFrame: 1,
    project: { assets: [] },
  });
  const loaded = Animotion.projectModel.normalizeProject(JSON.parse(JSON.stringify(saved)), { imageBounds: { width: 100, height: 100 } });
  const editorParts = Animotion.projectModel.editorPartsFromProject(loaded);
  assert.equal(saved.parts[0].humanRole, "forearm");
  assert.equal(loaded.parts[0].humanRole, "forearm");
  assert.equal(editorParts[0].humanRole, "forearm");
  assert.equal(editorParts[0].type, "arm");
});

function part(id, humanRole, parentId) {
  return { id, type: "prop", humanRole, parentId };
}
