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
  const els = fakeElements();
  const context = {
    window: { Animotion: {} },
    document: { createElement: () => fakeElement() },
    Option: function Option(label, value) { return { label, value }; },
  };
  vm.createContext(context);
  runScript(context, "scripts/rig-connection.js");
  const Animotion = context.window.Animotion;
  const state = sampleState();
  Object.assign(Animotion, {
    config: { minShapeSize: 4, timelineFrames: 120 },
    dom: { els },
    state,
    geometry: { shapeIsReady: () => false, clamp: (value, min, max) => Math.min(max, Math.max(min, value)) },
    imageBounds: () => ({ width: 100, height: 100 }),
    panelEditor: { canEditRig: () => true, refreshControls() {}, activeTarget: () => "source", imageFor: () => state.image },
    parts: { selectedPart: () => state.parts.find((part) => part.id === state.selectedPartId) || null },
    timeline: { sortedKeyframes: (part) => part.keyframes || [] },
    motionModel: { normalizeCustomMotion: (motion = {}) => ({ x: motion.x || 0, y: motion.y || 0, rotate: motion.rotate || 0, scaleY: motion.scaleY || 0, jointX: motion.jointX || 0, jointY: motion.jointY || 0, phase: motion.phase || 0 }) },
    cutsceneModel: { normalizeBridge: (bridge = {}) => ({ durationFrames: 36, ...bridge }) },
    cutsceneMotionStatus: { statusForBridge: () => ({ active: false }), statusText: () => "Punch/kick motion status: no active punch/kick draft" },
    partTypeLabels: { body: "몸통", head: "머리", eye: "눈" },
    shapeKind: { rect: "rect" },
    tool: { edit: "edit" },
  });
  runScript(context, "scripts/ui.js");
  return Animotion;
}

function runScript(context, path) {
  vm.runInContext(fs.readFileSync(path, "utf8"), context, { filename: path });
}

function fakeElements() {
  const keys = [
    "capturePart", "applyOutline", "finishSelection", "clearSelection", "guideParts", "applyDemoGengaMotion",
    "exportWebm", "saveRig", "sourceStatus", "previewStatus", "currentFrame", "frameLabel", "sourceZoom",
    "zoomReset", "separateCharacter", "partsList", "emptyInspector", "partInspector", "insertKeyframe",
    "deleteKeyframe", "autoAnticipation", "keyframeStatus", "impactExaggerationStatus", "impactExaggerationEnabled",
    "cutsceneMotionStatus", "editName", "editType", "pivotEditTarget", "pivotX", "pivotY", "jointX", "jointY",
    "handTipX", "handTipY", "editOrder", "editAlpha", "editHidden", "motionX", "motionY", "motionRotate", "motionScaleY", "motionJointX",
    "motionJointY", "motionPhase", "editParent", "motionTemplate", "selectionTool", "sourcePanelX", "sourcePanelY",
    "sourcePanelScale", "impactPanelX", "impactPanelY", "impactPanelScale", "impactReferenceOpacity",
  ];
  return Object.fromEntries(keys.map((key) => [key, key === "editParent" ? fakeSelect() : fakeElement(key)]));
}

function fakeElement(key = "") {
  return {
    value: key === "motionTemplate" ? "keyframes" : "",
    checked: false,
    disabled: false,
    textContent: "",
    className: "",
    classList: { lastToggle: null, toggle(name, force) { this.lastToggle = { name, force }; } },
    replaceChildren(...children) { this.children = children; },
    append(...children) { this.children = [...(this.children || []), ...children]; },
    addEventListener() {},
  };
}

function fakeSelect() {
  return { ...fakeElement(), options: [], replaceChildren(...children) { this.options = [...children]; }, append(option) { this.options.push(option); } };
}

function sampleState() {
  return {
    image: { naturalWidth: 100, naturalHeight: 100 },
    selection: null,
    parts: [
      part("torso", "body", null),
      part("head", "head", "torso"),
      part("eye", "eye", "head"),
    ],
    selectedPartId: "head",
    currentFrame: 1,
    sourceZoom: 1,
    separateCharacter: false,
    cutsceneBridge: null,
  };
}

function part(id, type, parentPartId) {
  return {
    id,
    type,
    name: id,
    parentId: null,
    parentPartId,
    rect: { x: 0, y: 0, w: 20, h: 20 },
    pivot: { x: 10, y: 10 },
    joint: { x: 10, y: 18 },
    order: id === "torso" ? 1 : id === "head" ? 2 : 3,
    alpha: 1,
    hidden: false,
    customMotion: {},
    keyframes: [],
  };
}

test("inspector parent select follows selected part parentPartId fallback", () => {
  const Animotion = loadAnimotion();
  Animotion.ui.refreshUi();
  assert.equal(Animotion.dom.els.editName.value, "head");
  assert.equal(Animotion.dom.els.editParent.value, "torso");
});

test("inspector parent options exclude descendants through parentPartId fallback", () => {
  const Animotion = loadAnimotion();
  Animotion.state.selectedPartId = "torso";
  Animotion.ui.refreshUi();
  const values = Animotion.dom.els.editParent.options.map((option) => option.value);
  assert.equal(values.includes("head"), false);
  assert.equal(values.includes("eye"), false);
});

test("ui refresh treats an uploaded image with no selected part as empty inspector state", () => {
  const Animotion = loadAnimotion();
  Animotion.state.parts = [];
  Animotion.state.selectedPartId = null;
  assert.doesNotThrow(() => Animotion.ui.refreshUi());
  assert.equal(Animotion.dom.els.emptyInspector.classList.lastToggle.force, false);
  assert.equal(Animotion.dom.els.partInspector.classList.lastToggle.force, true);
});

test("inspector parent select refresh is skipped when no part is selected", () => {
  const Animotion = loadAnimotion();
  Animotion.state.selectedPartId = null;
  assert.doesNotThrow(() => Animotion.ui.refreshUi());
  assert.deepEqual(Animotion.dom.els.editParent.options, []);
});
