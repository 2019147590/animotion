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
    "scripts/geometry.js",
    "scripts/coordinate-spaces.js",
    "scripts/hidden-completion-assets.js",
    "scripts/rig-connection.js",
    "scripts/motion-model.js",
    "scripts/motion-drafts.js",
    "scripts/timeline.js",
    "scripts/cutscene-model.js",
    "scripts/motion-planner.js",
    "scripts/project-model.js",
    "scripts/project-serialization.js",
    "scripts/scripted-genga-runner.js",
    "scripts/scripted-genga-sample-definition.js",
    "scripts/scripted-genga-generator.js",
    "scripts/scripted-genga-motion-preset.js",
  ]) runScript(context, path);
  return context.window.Animotion;
}

function runScript(context, path) {
  vm.runInContext(fs.readFileSync(path, "utf8"), context, { filename: path });
}

function saveFixtureProject(Animotion, fixture, project, parts, options = {}) {
  return Animotion.projectModel.projectFromEditorState({
    project,
    image: { naturalWidth: fixture.preview.width, naturalHeight: fixture.preview.height },
    imageName: "scripted-genga-cut.svg",
    parts,
    currentFrame: options.currentFrame || 1,
    cutsceneBridge: options.cutsceneBridge || project.editor.cutsceneBridge,
    motionPlan: options.motionPlan || project.editor.motionPlan,
  });
}

test("scripted genga generator is deterministic", () => {
  const Animotion = loadAnimotion();
  const first = Animotion.scriptedGengaGenerator.createFixture();
  const second = Animotion.scriptedGengaGenerator.createFixture();
  assert.deepEqual(second, first);
  assert.equal(first.preview.uri.startsWith("data:image/svg+xml"), true);
});

test("sample scripted genga definition runner is deterministic", () => {
  const Animotion = loadAnimotion();
  const definition = Animotion.scriptedGengaSampleDefinition.createDefinition();
  const first = Animotion.scriptedGengaRunner.runScriptedGengaDefinition(definition);
  const second = Animotion.scriptedGengaRunner.runScriptedGengaDefinition(definition);
  assert.deepEqual(second, first);
  assert.equal(first.project.assets[0].name, "scripted-genga-cut-v1.svg");
});

test("scripted genga JSON script compiles without app state access", () => {
  const Animotion = loadAnimotion();
  const definition = Animotion.scriptedGengaSampleDefinition.createDefinition();
  const compiled = Animotion.scriptedGengaRunner.compileScriptedGengaScript(JSON.stringify(definition));
  const result = Animotion.scriptedGengaRunner.runScriptedGengaDefinition(compiled);
  assert.equal(result.id, definition.id);
  assert.throws(() => Animotion.scriptedGengaRunner.compileScriptedGengaScript("while(true){}"), /valid JSON/);
});

test("scripted genga fixture includes motion-ready part metadata", () => {
  const Animotion = loadAnimotion();
  const fixture = Animotion.scriptedGengaGenerator.createFixture();
  assert.equal(fixture.parts.length >= 10, true);
  for (const part of fixture.parts) {
    assert.equal(Boolean(part.id), true);
    assert.equal(Boolean(part.type), true);
    assert.equal(part.sourceRect.w > 0, true);
    assert.equal(part.sourceRect.h > 0, true);
    assert.equal(Number.isFinite(part.pivot.x), true);
    assert.equal(Number.isFinite(part.joint.y), true);
    assert.equal(Number.isInteger(part.layerIndex), true);
    assert.equal(Array.isArray(part.maskVerticesNormalized), true);
  }
  const forearm = fixture.parts.find((part) => part.id === "part-right-forearm");
  assert.equal(forearm.parentId, "part-right-upper-arm");
  assert.equal(fixture.layers.find((layer) => layer.id === forearm.id).order, forearm.layerIndex);
});

test("scripted genga fixture survives project normalize and save", () => {
  const Animotion = loadAnimotion();
  const fixture = Animotion.scriptedGengaGenerator.createFixture();
  const loaded = Animotion.projectModel.normalizeProject(fixture.project, {
    imageBounds: { width: fixture.preview.width, height: fixture.preview.height },
  });
  const parts = Animotion.projectModel.editorPartsFromProject(loaded);
  const saved = saveFixtureProject(Animotion, fixture, loaded, parts);
  const savedForearm = saved.parts.find((part) => part.id === "part-right-forearm");
  assert.equal(saved.format, "animotion-project");
  assert.equal(saved.canvas.width, fixture.preview.width);
  assert.equal(savedForearm.parentId, "part-right-upper-arm");
  assert.equal(savedForearm.pivotNormalized.xNorm < 0, true);
  assert.equal(saved.rigs[0].rootPartId, "part-torso");
});

test("scripted genga hidden completion guide survives round trip", () => {
  const Animotion = loadAnimotion();
  const fixture = Animotion.scriptedGengaGenerator.createFixture();
  const loaded = Animotion.projectModel.normalizeProject(JSON.parse(JSON.stringify(fixture.project)), {
    imageBounds: { width: fixture.preview.width, height: fixture.preview.height },
  });
  const parts = Animotion.projectModel.editorPartsFromProject(loaded);
  const saved = saveFixtureProject(Animotion, fixture, loaded, parts);
  const patch = saved.assets.find((asset) => asset.id === "hidden-right-forearm-extension");
  assert.equal(patch.type, "hiddenCompletionPatch");
  assert.equal(patch.renderMode, "guideOnly");
  assert.equal(patch.guide.meshVerticesNormalized[0].xNorm, -0.12);
  assert.equal(patch.guide.meshVerticesNormalized[2].yNorm, 1.08);
  assert.equal(saved.editor.motionPlan.motionDraft.hiddenCompletion.assetId, patch.id);
});

test("scripted genga demo motion preset applies to generated fixture parts", () => {
  const Animotion = loadAnimotion();
  const fixture = Animotion.scriptedGengaGenerator.createFixture();
  const project = Animotion.projectModel.normalizeProject(fixture.project, {
    imageBounds: { width: fixture.preview.width, height: fixture.preview.height },
  });
  const parts = Animotion.projectModel.editorPartsFromProject(project);
  const preset = Animotion.scriptedGengaMotionPreset.createPreset({ fixture });
  Animotion.scriptedGengaMotionPreset.applyToParts(parts, preset);
  const torso = parts.find((part) => part.id === "part-torso");
  const head = parts.find((part) => part.id === "part-neck-head");
  const forearm = parts.find((part) => part.id === "part-right-forearm");
  assert.equal(preset.selectedPartId, "part-right-forearm");
  assert.equal(torso.keyframes.length, 4);
  assert.equal(head.parentId, "part-torso");
  assert.equal(head.keyframes.find((keyframe) => keyframe.frame === 24).pose.rotate, 7);
  assert.equal(forearm.keyframes.find((keyframe) => keyframe.frame === 24).pose.jointX, 62);
  assert.equal(preset.cutsceneBridge.jointAction.trajectoryPoints.length, 4);
});

test("scripted genga demo motion survives save and load round trip", () => {
  const Animotion = loadAnimotion();
  const fixture = Animotion.scriptedGengaGenerator.createFixture();
  const project = Animotion.projectModel.normalizeProject(JSON.parse(JSON.stringify(fixture.project)), {
    imageBounds: { width: fixture.preview.width, height: fixture.preview.height },
  });
  const parts = Animotion.projectModel.editorPartsFromProject(project);
  const preset = Animotion.scriptedGengaMotionPreset.createPreset({ fixture });
  const normalizedPlan = Animotion.motionPlanner.normalizePlan(preset.motionPlan, { assets: project.assets });
  Animotion.scriptedGengaMotionPreset.applyToParts(parts, preset);
  const saved = saveFixtureProject(Animotion, fixture, project, parts, {
    currentFrame: preset.impactFrame,
    cutsceneBridge: preset.cutsceneBridge,
    motionPlan: normalizedPlan,
  });
  const reloaded = Animotion.projectModel.normalizeProject(JSON.parse(JSON.stringify(saved)), {
    imageBounds: { width: fixture.preview.width, height: fixture.preview.height },
  });
  const reloadedParts = Animotion.projectModel.editorPartsFromProject(reloaded);
  const resaved = saveFixtureProject(Animotion, fixture, reloaded, reloadedParts, {
    currentFrame: reloaded.timeline.currentFrame,
    cutsceneBridge: reloaded.editor.cutsceneBridge,
    motionPlan: reloaded.editor.motionPlan,
  });
  const forearmMotion = resaved.motions.find((motion) => motion.id === "motion-part-right-forearm");
  assert.equal(forearmMotion.keyframes.length, 4);
  assert.equal(resaved.timeline.currentFrame, preset.impactFrame);
  assert.equal(resaved.editor.motionPlan.demoMotionPresetId, "scripted-genga-demo-motion-v1");
  assert.equal(resaved.editor.motionPlan.trajectoryPoints.length, 4);
  assert.equal(resaved.editor.motionPlan.rootMotion.keyframes[1].x, 26);
  assert.equal(resaved.editor.cutsceneBridge.jointAction.trajectoryPoints[2].point.x, 706);
  assert.equal(resaved.editor.cutsceneBridge.jointAction.motionDraft.hiddenCompletion.assetId, "hidden-right-forearm-extension");
});
