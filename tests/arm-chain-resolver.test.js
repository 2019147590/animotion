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

function loadResolver() {
  const context = { window: { Animotion: {} } };
  vm.createContext(context);
  for (const path of ["scripts/arm-role-semantics.js", "scripts/rig-connection.js", "scripts/arm-chain-resolver.js"]) {
    vm.runInContext(fs.readFileSync(path, "utf8"), context, { filename: path });
  }
  return context.window.Animotion.armChainResolver;
}

function part(id, patch = {}) {
  return { id, name: id, type: "arm", rect: { x: 0, y: 0, w: 10, h: 10 }, ...patch };
}

function separateParts() {
  return [
    part("front_upperArm", { humanRole: "upperArm", rect: { x: 0, y: 0, w: 20, h: 20 }, joint: { x: 18, y: 10 } }),
    part("front_forearm", { humanRole: "forearm", parentId: "front_upperArm", rect: { x: 18, y: 0, w: 26, h: 18 }, pivot: { x: 0, y: 10 }, joint: { x: 22, y: 9 } }),
    part("front_glove", { type: "glove", parentId: "front_forearm", rect: { x: 40, y: 2, w: 14, h: 14 }, pivot: { x: 0, y: 7 }, handTip: { x: 13, y: 7 } }),
    part("rear_upperArm", { humanRole: "upperArm", rect: { x: 50, y: 0, w: 20, h: 20 }, joint: { x: 2, y: 10 } }),
    part("rear_forearm", { humanRole: "forearm", parentId: "rear_upperArm", rect: { x: 32, y: 0, w: 20, h: 20 }, pivot: { x: 20, y: 10 }, joint: { x: 0, y: 10 } }),
    part("rear_glove", { type: "glove", parentId: "rear_forearm", rect: { x: 20, y: 2, w: 14, h: 14 }, pivot: { x: 12, y: 8 }, handTip: { x: 0, y: 8 } }),
  ];
}

test("front forearm and upperArm resolve to front glove terminal", () => {
  const resolver = loadResolver();
  const parts = separateParts();

  assert.equal(resolver.resolve(parts, "front_forearm").terminalPunchPartId, "front_glove");
  assert.equal(resolver.resolve(parts, "front_upperArm").terminalPunchPartId, "front_glove");
  assert.equal(resolver.resolve(parts, "front_forearm").separateRigPath, true);
  assert.equal(resolver.resolve(parts, "front_forearm").handParentIsForearm, true);
  assert.equal(resolver.resolve(parts, "front_forearm").forearmParentIsUpperArm, true);
  assert.equal(resolver.resolve(parts, "front_forearm").elbowConnectionValid, true);
  assert.equal(resolver.resolve(parts, "front_forearm").wristConnectionValid, true);
  assert.equal(resolver.resolve(parts, "front_forearm").chainParentingValid, true);
});

test("rear forearm resolves to rear glove terminal", () => {
  const resolver = loadResolver();
  const resolved = resolver.resolve(separateParts(), "rear_forearm");

  assert.equal(resolved.upperArmId, "rear_upperArm");
  assert.equal(resolved.forearmId, "rear_forearm");
  assert.equal(resolved.handOrGloveId, "rear_glove");
  assert.equal(resolved.handParentIsForearm, true);
  assert.equal(resolved.forearmParentIsUpperArm, true);
  assert.equal(resolved.elbowConnectionValid, true);
  assert.equal(resolved.wristConnectionValid, true);
  assert.equal(resolved.chainParentingValid, true);
  assert.equal(resolved.separateRigPath, true);
});

test("humanRole is preferred before name hints", () => {
  const resolver = loadResolver();
  const misleading = part("rear_glove", { name: "rear_glove", humanRole: "forearm" });

  assert.equal(resolver.roleFor(misleading), "forearm");
});

test("explicit UI humanRole hand beats glove type and chain name hints", () => {
  const resolver = loadResolver();
  const parts = [
    part("rear_upperArm", { humanRole: "upperArm" }),
    part("rear_forearm", { humanRole: "forearm", parentId: "rear_upperArm" }),
    part("rear_glove", { type: "prop", humanRole: "hand", parentId: "rear_forearm" }),
  ];

  assert.equal(resolver.resolve(parts, "rear_upperArm").terminalPunchPartId, "rear_glove");
});

test("separate chain endpoint uses terminal hand handTip and ignores legacy parent handTip", () => {
  const resolver = loadResolver();
  const parts = [
    part("rear_upperArm", { humanRole: "upperArm", handTip: { x: 99, y: 99 } }),
    part("rear_forearm", { humanRole: "forearm", parentId: "rear_upperArm", handTip: { x: 88, y: 88 } }),
    part("rear_glove", { type: "prop", humanRole: "hand", parentId: "rear_forearm", handTip: { x: 13, y: 7 }, rect: { x: 30, y: 10, w: 20, h: 16 } }),
  ];
  const resolved = resolver.resolve(parts, "rear_upperArm");

  assert.equal(resolved.terminalPunchPartId, "rear_glove");
  assert.equal(resolved.terminalContactPoint.local.x, 13);
  assert.equal(resolved.terminalContactPoint.local.y, 7);
  assert.equal(resolved.terminalContactPoint.image.x, 43);
  assert.equal(resolved.terminalContactPoint.image.y, 17);
  assert.equal(resolved.terminalPunchPointSource, "handTip");
});

test("missing terminal handTip falls back to inferred contact point", () => {
  const resolver = loadResolver();
  const parts = [
    part("front_upperArm", { humanRole: "upperArm" }),
    part("front_forearm", { humanRole: "forearm", parentId: "front_upperArm", rect: { x: 10, y: 10, w: 18, h: 12 } }),
    part("front_glove", { type: "prop", humanRole: "hand", parentId: "front_forearm", pivot: { x: 2, y: 8 }, rect: { x: 30, y: 10, w: 20, h: 16 } }),
  ];
  const resolved = resolver.resolve(parts, "front_forearm");

  assert.equal(resolved.terminalPunchPartId, "front_glove");
  assert.equal(resolved.terminalContactPoint.source, "inferredContactPoint");
  assert.equal(resolved.terminalPunchPointSource, "inferredContactPoint");
  assert.equal(resolved.terminalContactPoint.local.x > 10, true);
});

test("name-hinted terminal glove without handTip also infers contact point", () => {
  const resolver = loadResolver();
  const parts = [
    part("front_upperArm", { humanRole: "upperArm" }),
    part("front_forearm", { humanRole: "forearm", parentId: "front_upperArm", rect: { x: 10, y: 10, w: 18, h: 12 } }),
    part("front_glove", { type: "prop", parentId: "front_forearm", pivot: { x: 2, y: 8 }, rect: { x: 30, y: 10, w: 20, h: 16 } }),
  ];
  const resolved = resolver.resolve(parts, "front_upperArm");

  assert.equal(resolved.terminalPunchPartId, "front_glove");
  assert.equal(resolved.terminalContactPoint.source, "inferredContactPoint");
  assert.equal(resolved.terminalContactPoint.local.x > 10, true);
});

test("name id hints classify roles when humanRole is absent", () => {
  const resolver = loadResolver();

  assert.equal(resolver.roleFor(part("lead_upper")), "upperArm");
  assert.equal(resolver.roleFor(part("lead_lowerArm")), "forearm");
  assert.equal(resolver.roleFor(part("lead_fist")), "hand");
});

test("hand parented directly to torso is not a clean separate arm chain", () => {
  const resolver = loadResolver();
  const parts = [
    part("body", { type: "body", humanRole: "torso" }),
    part("front_glove", { type: "glove", humanRole: "hand", parentId: "body" }),
  ];
  const resolved = resolver.resolve(parts, "front_glove");

  assert.equal(resolved.terminalPunchPartId, "front_glove");
  assert.equal(resolved.separateRigPath, false);
  assert.equal(resolved.handParentIsForearm, false);
  assert.equal(resolved.forearmParentIsUpperArm, false);
  assert.equal(resolved.chainParentingValid, false);
  assert.match(resolved.chainParentingWarning, /parent must be forearm/);
});

test("hand without a forearm parent reports a chain parenting warning", () => {
  const resolver = loadResolver();
  const parts = [part("rear_glove", { type: "glove", humanRole: "hand" })];
  const resolved = resolver.resolve(parts, "rear_glove");

  assert.equal(resolved.terminalPunchPartId, "rear_glove");
  assert.equal(resolved.separateRigPath, false);
  assert.equal(resolved.chainParentingValid, false);
  assert.match(resolved.chainParentingWarning, /no forearm parent/);
});

test("valid canonical torso upperArm forearm glove chain is clean", () => {
  const resolver = loadResolver();
  const parts = [
    part("torso", { type: "body", humanRole: "torso", rect: { x: 20, y: 0, w: 20, h: 50 } }),
    part("front_upperArm", { humanRole: "upperArm", parentId: "torso", rect: { x: 42, y: 8, w: 20, h: 20 }, pivot: { x: 0, y: 8 }, joint: { x: 18, y: 12 } }),
    part("front_forearm", { humanRole: "forearm", parentId: "front_upperArm", rect: { x: 60, y: 10, w: 22, h: 18 }, pivot: { x: 0, y: 10 }, joint: { x: 20, y: 10 } }),
    part("front_glove", { type: "glove", humanRole: "hand", parentId: "front_forearm", rect: { x: 80, y: 12, w: 16, h: 16 }, pivot: { x: 0, y: 8 }, handTip: { x: 15, y: 8 } }),
  ];
  const fromUpper = resolver.resolve(parts, "front_upperArm");
  const fromForearm = resolver.resolve(parts, "front_forearm");

  assert.equal(fromUpper.terminalPunchPartId, "front_glove");
  assert.equal(fromForearm.terminalPunchPartId, "front_glove");
  assert.equal(fromUpper.separateRigPath, true);
  assert.equal(fromUpper.chainParentingValid, true);
  assert.equal(fromUpper.elbowConnectionValid, true);
  assert.equal(fromUpper.wristConnectionValid, true);
  assert.equal(fromUpper.chainWarnings.length, 0);
});

test("misaligned anatomical endpoints report elbow and wrist connection warnings", () => {
  const resolver = loadResolver();
  const parts = [
    part("front_upperArm", { humanRole: "upperArm", rect: { x: 0, y: 0, w: 20, h: 20 }, joint: { x: 18, y: 10 } }),
    part("front_forearm", { humanRole: "forearm", parentId: "front_upperArm", rect: { x: 60, y: 60, w: 22, h: 18 }, pivot: { x: 0, y: 0 }, joint: { x: 20, y: 10 } }),
    part("front_glove", { type: "glove", humanRole: "hand", parentId: "front_forearm", rect: { x: 120, y: 120, w: 16, h: 16 }, pivot: { x: 0, y: 0 }, handTip: { x: 15, y: 8 } }),
  ];
  const before = JSON.stringify(parts);
  const resolved = resolver.resolve(parts, "front_upperArm");

  assert.equal(resolved.separateRigPath, false);
  assert.equal(resolved.chainParentingValid, true);
  assert.equal(resolved.elbowConnectionValid, false);
  assert.equal(resolved.wristConnectionValid, false);
  assert.match(resolved.chainParentingWarning, /elbowConnection/);
  assert.match(resolved.chainParentingWarning, /wristConnection/);
  assert.equal(JSON.stringify(parts), before);
});

test("parentPartId legacy links are followed", () => {
  const resolver = loadResolver();
  const parts = [
    part("front_upperArm", { humanRole: "upperArm" }),
    part("front_forearm", { humanRole: "forearm", parentPartId: "front_upperArm" }),
    part("front_hand", { humanRole: "hand", parentPartId: "front_forearm" }),
  ];

  assert.equal(resolver.resolve(parts, "front_upperArm").terminalPunchPartId, "front_hand");
});

test("cycle and missing parent fail safely", () => {
  const resolver = loadResolver();
  const cycle = [
    part("front_forearm", { humanRole: "forearm", parentId: "front_hand" }),
    part("front_hand", { humanRole: "hand", parentId: "front_forearm" }),
  ];
  const missing = [
    part("front_forearm", { humanRole: "forearm", parentId: "missing_upper" }),
    part("front_hand", { humanRole: "hand", parentId: "front_forearm" }),
  ];

  assert.equal(resolver.resolve(cycle, "front_forearm").separateRigPath, false);
  assert.equal(resolver.resolve(cycle, "front_forearm").reason, "cycle");
  assert.equal(resolver.resolve(missing, "front_forearm").separateRigPath, false);
  assert.equal(resolver.resolve(missing, "front_forearm").reason, "missing-parent");
});

test("hidden completion candidate is debug only when wrist gap is exposed", () => {
  const resolver = loadResolver();
  const parts = separateParts();
  const normal = resolver.targetDebug(parts, "front_forearm", parts[2], { result: "jab", classificationBasis: "name-hint" });
  const glove = parts.find((item) => item.id === "front_glove");
  glove.rect.x = 80;
  glove.pivot = { x: -40, y: 7 };
  const gap = resolver.targetDebug(parts, "front_forearm", parts[2], { result: "jab", classificationBasis: "name-hint" });

  assert.equal(normal.wristOverlapHandled, true);
  assert.equal(normal.hiddenCompletionCandidate, false);
  assert.equal(gap.hiddenCompletionCandidate, true);
});
