const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
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
  const context = { window: { Animotion: {} }, performance: { now: () => 1000 }, Option: function Option(label, value) { return { label, value }; } };
  vm.createContext(context);
  for (const file of [
    "scripts/config.js",
    "scripts/project-model.js",
    "scripts/cutscene-action-selectors.js",
    "scripts/cutscene-motion-status.js",
  ]) runScript(context, file);
  const Animotion = context.window.Animotion;
  const els = fakeElements();
  const project = Animotion.projectModel.createEmptyProject();
  Object.assign(Animotion, {
    dom: { els },
    state: stateFixture(project),
    geometry: { shapeIsReady: () => false, clamp: (value, min, max) => Math.min(max, Math.max(min, value)) },
    imageBounds: () => ({ width: 100, height: 80 }),
    panelEditor: { canEditRig: () => true, refreshControls() {}, activeTarget: () => "source", imageFor: () => Animotion.state.image },
    parts: { selectedPart: () => Animotion.state.parts.find((part) => part.id === Animotion.state.selectedPartId) || null },
    timeline: { sortedKeyframes: (part) => part.keyframes || [] },
    motionModel: { normalizeCustomMotion: (motion = {}) => ({ x: motion.x || 0, y: motion.y || 0, rotate: motion.rotate || 0, scaleY: motion.scaleY || 0, jointX: motion.jointX || 0, jointY: motion.jointY || 0, phase: motion.phase || 0 }) },
    motionPlanner: { normalizePlan: (plan = {}) => ({ template: plan.template || "kick", target: plan.target || null, targetMode: Boolean(plan.targetMode) }), refreshControls() {} },
    motionCommands: { currentMotionPlan: () => Animotion.state.motionPlan, updateJointAction: (action) => { Animotion.state.cutsceneBridge.jointAction = action; return action; } },
    cutsceneModel: { normalizeBridge: (bridge = {}) => ({ durationFrames: 36, impactFrame: 24, ...(bridge || {}) }) },
    partTypeLabels: { body: "body" },
    shapeKind: { rect: "rect" },
    tool: { edit: "edit" },
  });
  runScript(context, "scripts/arm-chain-rebind.js");
  runScript(context, "scripts/hidden-completion-symmetry.js");
  runScript(context, "scripts/motion-draft-editor.js");
  runScript(context, "scripts/hidden-completion-part-panel.js");
  runScript(context, "scripts/session-commands.js");
  runScript(context, "scripts/ui.js");
  return Animotion;
}

function runScript(context, file) {
  vm.runInContext(fs.readFileSync(file, "utf8"), context, { filename: file });
}

function stateFixture(project) {
  return {
    project,
    image: { naturalWidth: 100, naturalHeight: 80 },
    imageName: "",
    nextImage: null,
    nextImageName: "",
    parts: project.parts,
    selection: null,
    selectedPartId: null,
    currentFrame: 1,
    sourceZoom: 1,
    sourcePan: { x: 0, y: 0 },
    separateCharacter: false,
    cutsceneBridge: null,
    panelSetup: {},
    correspondences: [],
    motionPlan: { template: "kick", target: null, targetMode: false },
  };
}

function fakeElements() {
  const keys = [
    "capturePart", "applyOutline", "finishSelection", "clearSelection", "guideParts", "applyDemoGengaMotion",
    "exportWebm", "saveRig", "sourceStatus", "previewStatus", "currentFrame", "frameLabel", "sourceZoom",
    "zoomReset", "separateCharacter", "partsList", "emptyInspector", "partInspector", "insertKeyframe",
    "deleteKeyframe", "autoAnticipation", "keyframeStatus", "impactExaggerationStatus", "impactExaggerationEnabled",
    "cutsceneMotionStatus", "editName", "editType", "pivotEditTarget", "pivotX", "pivotY", "jointX", "jointY",
    "editHumanRole", "editUsage", "pivotXLabel", "pivotYLabel", "jointXLabel", "jointYLabel", "handTipXLabel", "handTipYLabel",
    "autoPlaceArmHandles", "autoPlaceArmHandlesStatus", "handTipX", "handTipY", "editOrder", "editAlpha",
    "editHidden", "motionX", "motionY", "motionRotate", "motionScaleY", "motionJointX", "motionJointY",
    "motionPhase", "editParent", "motionTemplate", "selectionTool", "sourcePanelX", "sourcePanelY",
    "sourcePanelScale", "impactPanelX", "impactPanelY", "impactPanelScale", "impactReferenceOpacity",
  ];
  return Object.fromEntries(keys.map((key) => [key, key === "editParent" ? fakeSelect() : fakeElement(key)]));
}

function fakeElement(key = "") {
  return {
    value: key === "motionTemplate" ? "cutscene" : "",
    checked: false,
    disabled: false,
    textContent: "",
    className: "",
    classList: { toggle(name, force) { this.lastToggle = { name, force }; } },
    replaceChildren(...children) { this.children = children; },
    append(...children) { this.children = [...(this.children || []), ...children]; },
    addEventListener() {},
  };
}

function fakeSelect() {
  return { ...fakeElement(), options: [], replaceChildren(...children) { this.options = [...children]; }, append(option) { this.options.push(option); } };
}

test("selectors report explicit inactive states for missing action boundaries", () => {
  const Animotion = loadAnimotion();
  const missing = Animotion.cutsceneActionSelectors.getActiveJointAction({ cutsceneBridge: null });
  assert.equal(missing.active, false);
  assert.equal(missing.reason, "no-cutscene-bridge");
  assert.equal(Animotion.cutsceneActionSelectors.getActiveJointAction({ cutsceneBridge: { jointAction: null } }).reason, "no-cutscene-action");
  assert.equal(Animotion.cutsceneActionSelectors.getActiveActionTimeline({ cutsceneBridge: { jointAction: { source: "manual", beats: [] } } }).reason, "no-action-timeline");
  assert.equal(Animotion.cutsceneActionSelectors.getCutsceneActionStatus({ parts: [], selectedPartId: null, cutsceneBridge: null }).active, false);
});

test("image upload reset clears stale cutscene action atomically", () => {
  const Animotion = loadAnimotion();
  Animotion.state.selectedPartId = "old-arm";
  Animotion.state.actionFrameSelection = { selectedBeatId: "impact" };
  Animotion.state.cutsceneBridge = { primaryPartId: "old-arm", jointAction: { source: "motion-planner-punch-anchors-v1", beats: [{ id: "impact", at: 24, pose: { rHand: [1, 1] } }] } };
  Animotion.sessionCommands.resetForNewImage({ naturalWidth: 200, naturalHeight: 120 }, "upload.png");
  assert.equal(Animotion.state.imageName, "upload.png");
  assert.equal(Animotion.state.cutsceneBridge, null);
  assert.equal(Animotion.state.selectedPartId, null);
  assert.equal(Animotion.state.actionFrameSelection, null);
  assert.equal(Animotion.state.motionPlan.template, "kick");
});

test("ui refresh is safe for cleared and incomplete cutscene states", () => {
  const Animotion = loadAnimotion();
  for (const bridge of [null, { jointAction: null }, { jointAction: { source: "motion-planner-punch-anchors-v1", beats: [{ id: "impact", at: 24, pose: {} }] } }]) {
    Animotion.state.cutsceneBridge = bridge;
    Animotion.state.parts = [];
    Animotion.state.selectedPartId = null;
    assert.doesNotThrow(() => Animotion.ui.refreshUi());
    assert.match(Animotion.dom.els.cutsceneMotionStatus.textContent, /없음|motion punch/);
    assert.equal(Animotion.dom.els.impactExaggerationEnabled.disabled, true);
  }
});

test("only centralized selector reads actionTimeline directly in scripts", () => {
  const offenders = fs.readdirSync("scripts")
    .filter((file) => file.endsWith(".js") && file !== "cutscene-action-selectors.js")
    .flatMap((file) => {
      const text = fs.readFileSync(path.join("scripts", file), "utf8");
      return /\.actionTimeline\b/.test(text) ? [file] : [];
    });
  assert.deepEqual(offenders, []);
});
