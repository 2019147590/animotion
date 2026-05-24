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
  const context = { window: { Animotion: {} } };
  vm.createContext(context);
  for (const path of [
    "scripts/coordinate-spaces.js",
    "scripts/arm-role-semantics.js",
    "scripts/rig-connection.js",
    "scripts/arm-chain-resolver.js",
    "scripts/hidden-completion-assets.js",
    "scripts/hidden-completion-symmetry.js",
    "scripts/hidden-completion-request.js",
  ]) runScript(context, path);
  return context.window.Animotion;
}

function runScript(context, path) {
  vm.runInContext(fs.readFileSync(path, "utf8"), context, { filename: path });
}

function part(id, humanRole, patch = {}) {
  return {
    id,
    name: id,
    type: humanRole === "hand" ? "glove" : "arm",
    humanRole,
    rect: { x: 10, y: 20, w: 30, h: 40 },
    pivot: { x: 10, y: 8 },
    joint: { x: 24, y: 34 },
    mask: { points: [{ x: 2, y: 2 }, { x: 28, y: 2 }, { x: 28, y: 38 }, { x: 2, y: 38 }] },
    ...patch,
  };
}

test("symmetry patch can be created from opposite upperArm", () => {
  const Animotion = loadAnimotion();
  const target = part("front_upperArm", "upperArm");
  const counterpart = part("rear_upperArm", "upperArm");
  const result = Animotion.hiddenCompletionSymmetry.createPatchAsset(target, [target, counterpart], { id: "hidden-front-upper-symmetry" });

  assert.equal(result.ok, true);
  assert.equal(result.asset.type, "hiddenCompletionPatch");
  assert.equal(result.asset.sourcePartId, "front_upperArm");
  assert.equal(result.asset.patchStatus, "draft");
  assert.equal(result.asset.completionMethod, "symmetry");
  assert.equal(result.asset.symmetrySource.counterpartPartId, "rear_upperArm");
  assert.equal(result.asset.symmetrySource.confidence >= 0.7, true);
});

test("symmetry patch can be created for torso side gap", () => {
  const Animotion = loadAnimotion();
  const torso = { ...part("part_torso", "torso", { type: "body", rect: { x: 40, y: 10, w: 80, h: 120 } }) };
  const result = Animotion.hiddenCompletionSymmetry.createPatchAsset(torso, [torso], { id: "hidden-torso-left", targetRegion: "left" });

  assert.equal(result.ok, true);
  assert.equal(result.asset.symmetrySource.counterpartPartId, "part_torso");
  assert.equal(result.asset.symmetrySource.targetRegion, "left");
  assert.equal(result.asset.symmetrySource.sourceRegion, "right");
  assertJsonEqual(result.asset.guide.silhouetteVerticesNormalized.map((point) => point.xNorm), [0, 0.5, 0.5, 0]);
});

test("missing counterpart reports warning", () => {
  const Animotion = loadAnimotion();
  const target = part("front_forearm", "forearm");
  const result = Animotion.hiddenCompletionSymmetry.createPatchAsset(target, [target], { id: "hidden-front-forearm" });

  assert.equal(result.ok, false);
  assert.match(result.warning, /missing rear forearm counterpart/);
});

test("symmetry patch creation does not mutate original parts", () => {
  const Animotion = loadAnimotion();
  const target = part("front_hand", "hand");
  const counterpart = part("rear_hand", "hand");
  const before = JSON.stringify([target, counterpart]);

  Animotion.hiddenCompletionSymmetry.createPatchAsset(target, [target, counterpart], { id: "hidden-front-hand" });

  assert.equal(JSON.stringify([target, counterpart]), before);
});

test("symmetry metadata does not change hidden completion request contract", () => {
  const Animotion = loadAnimotion();
  const target = part("front_upperArm", "upperArm");
  const counterpart = part("rear_upperArm", "upperArm");
  const asset = Animotion.hiddenCompletionSymmetry.createPatchAsset(target, [target, counterpart], { id: "hidden-front-upper-symmetry" }).asset;
  const request = Animotion.hiddenCompletionRequest.buildHiddenCompletionRequest({ assets: [asset] }, asset.id);

  assert.equal(request.task, "hidden_completion");
  assert.equal("completionMethod" in request, false);
  assert.equal("symmetrySource" in request, false);
  assert.equal(request.intent.mode, "extend_same_part");
});

test("symmetry counterpart prefers manual split forearm over old arm-only part", () => {
  const Animotion = loadAnimotion();
  const target = part("front_forearm", "forearm");
  const oldArmOnly = part("rear_forearm_old", "forearm", { handTip: { x: 2, y: 36 } });
  const splitUpper = part("rear_upperArm_new", "upperArm", { parentId: null, sourceArmOnlyPartId: oldArmOnly.id });
  const splitForearm = part("rear_forearm_new", "forearm", { parentId: splitUpper.id, sourceArmOnlyPartId: oldArmOnly.id });
  const splitHand = part("rear_hand_new", "hand", { parentId: splitForearm.id, sourceArmOnlyPartId: oldArmOnly.id });

  const result = Animotion.hiddenCompletionSymmetry.createPatchAsset(target, [target, oldArmOnly, splitUpper, splitForearm, splitHand], { id: "hidden-front-forearm-symmetry" });

  assert.equal(result.ok, true);
  assert.equal(result.asset.symmetrySource.counterpartPartId, "rear_forearm_new");
});

test("legacy neutral names can match counterparts from edited roles and torso geometry", () => {
  const Animotion = loadAnimotion();
  const torso = { ...part("part_body", "torso", { type: "body", rect: { x: 40, y: 10, w: 40, h: 90 } }) };
  const target = part("arm_01", "forearm", { name: "arm_01", rect: { x: 92, y: 30, w: 22, h: 38 } });
  const counterpart = part("arm_02", "forearm", { name: "arm_02", rect: { x: 8, y: 32, w: 22, h: 38 } });

  const result = Animotion.hiddenCompletionSymmetry.createPatchAsset(target, [torso, target, counterpart], { id: "hidden-arm-01-symmetry" });

  assert.equal(result.ok, true);
  assert.equal(result.asset.sourcePartId, "arm_01");
  assert.equal(result.asset.symmetrySource.counterpartPartId, "arm_02");
  assert.equal(result.asset.symmetrySource.targetRegion, "front");
  assert.equal(result.asset.symmetrySource.sourceRegion, "rear");
});

function assertJsonEqual(actual, expected) {
  assert.deepEqual(JSON.parse(JSON.stringify(actual)), expected);
}
