const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const { test, loadPreview, part } = require("./preview-render-order-fixture");

function runtimeContext(Animotion) {
  const cache = new Map();
  return {
    state: Animotion.state,
    t: 0,
    frame: Animotion.state.currentFrame,
    matrixCache: cache,
    worldMatrix: (driver) => Animotion.preview.worldMatrix(driver, 0, cache),
  };
}

function transformPoint(matrix, point) {
  return {
    x: matrix.a * point.x + matrix.c * point.y + matrix.e,
    y: matrix.b * point.x + matrix.d * point.y + matrix.f,
  };
}

function absolutePivot(item) {
  return { x: item.rect.x + item.pivot.x, y: item.rect.y + item.pivot.y };
}

function rounded(point) {
  return { x: Math.round(point.x), y: Math.round(point.y) };
}

function serializableParts(parts) {
  return JSON.stringify(parts.map((item) => {
    const { canvas, supplementalCoverage, ...rest } = item;
    return rest;
  }));
}

test("shoulderFill follows torso driver and ignores upper arm motion", () => {
  const Animotion = loadPreview();
  const body = Animotion.state.parts.find((item) => item.id === "body");
  const upper = { ...part("rear-upper", "arm", 2, { x: 78, y: 42, w: 22, h: 42 }), humanRole: "upperArm" };
  const fill = {
    ...part("rear-shoulder-fill", "arm", 3, { x: 70, y: 40, w: 18, h: 18 }),
    isSupplementalPart: true,
    sourcePartId: body.id,
    canvas: { id: "rear-shoulder-fill" },
  };
  Animotion.state.parts.push(upper, fill);
  fill.supplementalFollow = Animotion.supplementalFollow.shoulderFillMetadata(fill, body, runtimeContext(Animotion));

  const baseline = Animotion.supplementalFollow.resolveSupplementalFollow(fill, runtimeContext(Animotion)).matrix;
  upper.keyframes = [{ frame: 24, pose: { x: 80, y: -20, rotate: 95 } }];
  const afterUpperMove = Animotion.supplementalFollow.resolveSupplementalFollow(fill, runtimeContext(Animotion)).matrix;
  body.keyframes = [{ frame: 24, pose: { x: 24, y: 6, rotate: 8 } }];
  const afterBodyMove = Animotion.supplementalFollow.resolveSupplementalFollow(fill, runtimeContext(Animotion)).matrix;

  assert.deepEqual(rounded(transformPoint(afterUpperMove, absolutePivot(fill))), rounded(transformPoint(baseline, absolutePivot(fill))));
  assert.notDeepEqual(rounded(transformPoint(afterBodyMove, absolutePivot(fill))), rounded(transformPoint(baseline, absolutePivot(fill))));
});

test("elbowJointFill tracks upper joint to forearm pivot midpoint", () => {
  const Animotion = loadPreview();
  const upper = { ...part("rear-upper", "arm", 2, { x: 54, y: 28, w: 20, h: 42 }), humanRole: "upperArm", joint: { x: 10, y: 40 }, pivot: { x: 10, y: 8 } };
  const fore = { ...part("rear-fore", "arm", 3, { x: 56, y: 72, w: 20, h: 40 }), humanRole: "forearm", pivot: { x: 10, y: 0 } };
  const fill = {
    ...part("rear-elbow-fill", "arm", 4, { x: 55, y: 62, w: 16, h: 16 }),
    isSupplementalPart: true,
    sourcePartId: upper.id,
    canvas: { id: "rear-elbow-fill" },
  };
  Animotion.state.parts.push(upper, fore, fill);
  fill.supplementalFollow = Animotion.supplementalFollow.elbowJointFillMetadata(fill, upper, fore, runtimeContext(Animotion));

  const resolved = Animotion.supplementalFollow.resolveSupplementalFollow(fill, runtimeContext(Animotion));
  const actual = transformPoint(resolved.matrix, absolutePivot(fill));

  assert.deepEqual(rounded(actual), rounded(resolved.midpoint));
});

test("elbowJointFill stretch increases as joint anchors separate", () => {
  const Animotion = loadPreview();
  const upper = { ...part("rear-upper", "arm", 2, { x: 54, y: 28, w: 20, h: 42 }), humanRole: "upperArm", joint: { x: 10, y: 40 }, pivot: { x: 10, y: 8 } };
  const fore = { ...part("rear-fore", "arm", 3, { x: 56, y: 72, w: 20, h: 40 }), humanRole: "forearm", pivot: { x: 10, y: 0 } };
  const fill = { ...part("rear-elbow-fill", "arm", 4, { x: 55, y: 62, w: 16, h: 16 }), isSupplementalPart: true, sourcePartId: upper.id, canvas: { id: "rear-elbow-fill" } };
  Animotion.state.parts.push(upper, fore, fill);
  fill.supplementalFollow = Animotion.supplementalFollow.elbowJointFillMetadata(fill, upper, fore, runtimeContext(Animotion));

  const base = Animotion.supplementalFollow.resolveSupplementalFollow(fill, runtimeContext(Animotion));
  fore.keyframes = [{ frame: 24, pose: { y: 32 } }];
  const stretched = Animotion.supplementalFollow.resolveSupplementalFollow(fill, runtimeContext(Animotion));

  assert.equal(stretched.distance > base.distance, true);
  assert.equal(stretched.scaleX > base.scaleX, true);
});

test("preview supplementalFollow runtime draw does not mutate parts or their order", () => {
  const Animotion = loadPreview();
  const body = Animotion.state.parts.find((item) => item.id === "body");
  const fill = {
    ...part("runtime-shoulder-fill", "arm", 3, { x: 70, y: 40, w: 18, h: 18 }),
    isSupplementalPart: true,
    sourcePartId: body.id,
    canvas: { id: "runtime-shoulder-fill" },
  };
  Animotion.state.parts.push(fill);
  fill.supplementalFollow = Animotion.supplementalFollow.shoulderFillMetadata(fill, body, runtimeContext(Animotion));
  const before = serializableParts(Animotion.state.parts);

  Animotion.preview.drawPreview(0, () => {}, () => {});

  assert.equal(serializableParts(Animotion.state.parts), before);
  assert.equal(Animotion.state.previewDrawSequenceDebug.sequence.some((entry) => entry.partId === fill.id && entry.drawPath === "supplemental-part"), true);
});

test("project normalize and save preserve optional supplementalFollow without migrating legacy parts", () => {
  const Animotion = loadProjectModel();
  const legacy = projectPart("legacy-supp");
  const followed = {
    ...projectPart("followed-supp"),
    supplementalFollow: {
      kind: "elbowJointFill",
      mode: "jointBridge",
      driverAId: "upper",
      driverBId: "fore",
      anchorA: "joint",
      anchorB: "pivot",
      bind: { baseDistance: 12, rotationOffset: 3, offset: { x: 1, y: -2 }, scaleX: 1, scaleY: 1 },
      paddingPx: 8,
      rotationMode: "bisector",
    },
  };
  const project = Animotion.projectModel.normalizeProject({
    format: "animotion-project",
    canvas: { width: 120, height: 120 },
    parts: [legacy, followed],
  }, { imageBounds: { width: 120, height: 120 } });

  assert.equal(project.parts.find((item) => item.id === "legacy-supp").supplementalFollow, undefined);
  assert.equal(project.parts.find((item) => item.id === "followed-supp").supplementalFollow.kind, "elbowJointFill");

  const saved = Animotion.projectModel.projectFromEditorState({ image: { naturalWidth: 120, naturalHeight: 120 }, parts: project.parts, project });
  assert.equal(saved.parts.find((item) => item.id === "followed-supp").supplementalFollow.mode, "jointBridge");
});

test("part commands assign supplementalFollow metadata to the selected supplemental part", () => {
  const Animotion = loadCommandModel();
  const supplemental = Animotion.state.parts.find((item) => item.id === "supp-elbow");

  const elbow = Animotion.partCommands.setSelectedSupplementalElbowJointFill();
  assert.equal(elbow.supplementalFollow.kind, "elbowJointFill");
  assert.equal(elbow.supplementalFollow.driverAId, "upper");
  assert.equal(elbow.supplementalFollow.driverBId, "fore");

  const shoulder = Animotion.partCommands.setSelectedSupplementalShoulderFill();
  assert.equal(shoulder.supplementalFollow.kind, "shoulderFill");
  assert.equal(shoulder.supplementalFollow.driverPartId, "body");

  Animotion.partCommands.clearSelectedSupplementalFollow();
  assert.equal(supplemental.supplementalFollow, undefined);
});

function loadProjectModel() {
  const context = { window: { Animotion: { config: {} } } };
  vm.createContext(context);
  for (const path of [
    "scripts/coordinate-spaces.js",
    "scripts/motion-model.js",
    "scripts/human-rig-schema.js",
    "scripts/rig-connection.js",
    "scripts/project-model.js",
    "scripts/project-serialization.js",
    "scripts/hidden-completion-supplemental-project.js",
    "scripts/supplemental-follow-project.js",
  ]) vm.runInContext(fs.readFileSync(path, "utf8"), context, { filename: path });
  return context.window.Animotion;
}

function projectPart(id) {
  return {
    id,
    name: id,
    type: "arm",
    rect: { x: 10, y: 10, w: 20, h: 30 },
    sourceRect: { x: 10, y: 10, w: 20, h: 30 },
    pivot: { x: 10, y: 5 },
    joint: { x: 10, y: 25 },
    isSupplementalPart: true,
    sourcePartId: "upper",
  };
}

function loadCommandModel() {
  const context = {
    window: { Animotion: {
      state: { currentFrame: 24, parts: commandParts(), project: {} },
      parts: {},
      rigConnection: {
        parentIdFor: (part) => part?.parentPartId || part?.parentId || null,
        metadataForPart: (part) => ({ parentPartId: part.parentPartId || part.parentId || null, parentId: part.parentPartId || part.parentId || null }),
      },
    } },
    DOMMatrix: createCommandMatrixCtor(),
  };
  context.window.Animotion.parts.selectedPart = () => context.window.Animotion.state.parts.find((item) => item.id === context.window.Animotion.state.selectedPartId);
  context.window.Animotion.state.selectedPartId = "supp-elbow";
  vm.createContext(context);
  for (const path of [
    "scripts/supplemental-follow.js",
    "scripts/part-commands.js",
    "scripts/supplemental-follow-commands.js",
  ]) vm.runInContext(fs.readFileSync(path, "utf8"), context, { filename: path });
  return context.window.Animotion;
}

function commandParts() {
  return [
    { id: "body", name: "body", type: "body", humanRole: "torso", rect: { x: 40, y: 30, w: 30, h: 70 }, pivot: { x: 15, y: 20 }, joint: { x: 15, y: 60 } },
    { id: "upper", name: "upper", type: "arm", humanRole: "upperArm", parentPartId: "body", rect: { x: 64, y: 42, w: 20, h: 42 }, pivot: { x: 10, y: 6 }, joint: { x: 10, y: 40 } },
    { id: "fore", name: "fore", type: "arm", humanRole: "forearm", parentPartId: "upper", rect: { x: 64, y: 80, w: 20, h: 40 }, pivot: { x: 10, y: 0 }, joint: { x: 10, y: 36 } },
    { id: "supp-elbow", name: "supp-elbow", type: "arm", isSupplementalPart: true, sourcePartId: "upper", rect: { x: 62, y: 70, w: 16, h: 16 }, pivot: { x: 8, y: 8 }, joint: { x: 8, y: 14 } },
  ];
}

function createCommandMatrixCtor() {
  return class CommandMatrix {
    constructor(values = {}) { this.a = values.a ?? 1; this.b = values.b ?? 0; this.c = values.c ?? 0; this.d = values.d ?? 1; this.e = values.e ?? 0; this.f = values.f ?? 0; }
    translate(x, y) { return this.multiply(new this.constructor({ e: x, f: y })); }
    rotate(degrees) { const r = degrees * Math.PI / 180, c = Math.cos(r), s = Math.sin(r); return this.multiply(new this.constructor({ a: c, b: s, c: -s, d: c })); }
    scale(x, y) { return this.multiply(new this.constructor({ a: x, d: y })); }
    multiply(right) { return new this.constructor({ a: this.a * right.a + this.c * right.b, b: this.b * right.a + this.d * right.b, c: this.a * right.c + this.c * right.d, d: this.b * right.c + this.d * right.d, e: this.a * right.e + this.c * right.f + this.e, f: this.b * right.e + this.d * right.f + this.f }); }
  };
}
