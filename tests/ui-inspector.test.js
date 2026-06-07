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
  runScript(context, "scripts/arm-role-semantics.js");
  runScript(context, "scripts/rig-connection.js");
  runScript(context, "scripts/arm-chain-resolver.js");
  runScript(context, "scripts/arm-handle-autoplace.js");
  runScript(context, "scripts/human-rig-schema.js");
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
    supplementalFollowControls: {
      refreshControls: () => state.followControlRefreshes.push({
        selectedPartId: state.selectedPartId,
        hidden: els.supplementalPartEditor.classList.lastToggle?.force,
      }),
    },
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
    "editHumanRole", "pivotXLabel", "pivotYLabel", "jointXLabel", "jointYLabel", "handTipXLabel", "handTipYLabel",
    "autoPlaceArmHandles", "autoPlaceArmHandlesStatus",
    "handTipX", "handTipY", "editOrder", "editAlpha", "editHidden", "motionX", "motionY", "motionRotate", "motionScaleY", "motionJointX",
    "motionJointY", "motionPhase", "editParent", "motionTemplate", "selectionTool", "sourcePanelX", "sourcePanelY",
    "sourcePanelScale", "impactPanelX", "impactPanelY", "impactPanelScale", "impactReferenceOpacity",
    "supplementalPartEditor", "supplementalPartX", "supplementalPartY", "supplementalPartW", "supplementalPartH", "supplementalMaskScale",
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
    followControlRefreshes: [],
  };
}

function part(id, type, parentPartId) {
  return {
    id,
    type,
    humanRole: id === "head" ? "head" : null,
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
  assert.equal(Animotion.dom.els.editHumanRole.value, "head");
  assert.equal(Animotion.dom.els.editParent.value, "torso");
});

test("inspector exposes optional humanRole without replacing part type", () => {
  const Animotion = loadAnimotion();
  const part = Animotion.state.parts.find((item) => item.id === "head");
  Animotion.partCommands = { updatePart: (target, patch) => Object.assign(target, patch) };
  Animotion.ui.refreshUi();

  Animotion.dom.els.editHumanRole.value = "hand";
  Animotion.ui.updateSelectedPart({ humanRole: "hand" });

  assert.equal(part.type, "head");
  assert.equal(part.humanRole, "hand");
});

test("inspector labels and disables arm handles by explicit humanRole", () => {
  const Animotion = loadAnimotion();
  const head = Animotion.state.parts.find((item) => item.id === "head");

  Object.assign(head, { type: "arm", humanRole: "upperArm", handTip: { x: 19, y: 19 } });
  Animotion.ui.refreshUi();
  assert.equal(Animotion.dom.els.pivotXLabel.textContent, "어깨 회전점 / shoulder pivot X");
  assert.equal(Animotion.dom.els.jointXLabel.textContent, "팔꿈치 연결점 / elbow joint X");
  assert.equal(Animotion.dom.els.handTipX.disabled, true);

  Object.assign(head, { humanRole: "forearm" });
  Animotion.ui.refreshUi();
  assert.equal(Animotion.dom.els.pivotXLabel.textContent, "팔꿈치 회전점 / elbow pivot X");
  assert.equal(Animotion.dom.els.jointXLabel.textContent, "손목 연결점 / wrist joint X");
  assert.equal(Animotion.dom.els.handTipX.disabled, true);

  Object.assign(head, { type: "prop", humanRole: "hand", handTip: { x: 18, y: 10 } });
  Animotion.ui.refreshUi();
  assert.equal(Animotion.dom.els.pivotXLabel.textContent, "손목 회전점 / wrist pivot X");
  assert.equal(Animotion.dom.els.handTipXLabel.textContent, "주먹 타격점 / punch contact point X");
  assert.equal(Animotion.dom.els.handTipX.disabled, false);
  assert.equal(Animotion.dom.els.jointX.disabled, true);
});

test("inspector exposes auto-place arm handles for selected separate chain", () => {
  const Animotion = loadAnimotion();
  Animotion.state.parts = [
    part("body", "body", null),
    { ...part("front_upperArm", "arm", "body"), humanRole: "upperArm", rect: { x: 30, y: 10, w: 20, h: 20 } },
    { ...part("front_forearm", "arm", "front_upperArm"), humanRole: "forearm", rect: { x: 58, y: 14, w: 18, h: 18 } },
    { ...part("front_glove", "prop", "front_forearm"), humanRole: "hand", rect: { x: 86, y: 16, w: 14, h: 14 } },
  ];
  Animotion.state.selectedPartId = "front_forearm";

  Animotion.ui.refreshUi();

  assert.equal(Animotion.dom.els.autoPlaceArmHandles.disabled, false);
  assert.match(Animotion.dom.els.autoPlaceArmHandlesStatus.textContent, /Auto place arm handles/);
});

test("inspector shows supplemental part transform controls only for supplemental parts", () => {
  const Animotion = loadAnimotion();
  const head = Animotion.state.parts.find((item) => item.id === "head");
  Object.assign(head, { isSupplementalPart: true, supplementalMaskScale: 1.12 });

  Animotion.ui.refreshUi();

  assert.equal(Animotion.dom.els.supplementalPartEditor.classList.lastToggle.force, false);
  assert.equal(Animotion.dom.els.supplementalPartX.value, 0);
  assert.equal(Animotion.dom.els.supplementalPartW.value, 20);
  assert.equal(Animotion.dom.els.supplementalMaskScale.value, 1.12);

  delete head.isSupplementalPart;
  Animotion.ui.refreshUi();
  assert.equal(Animotion.dom.els.supplementalPartEditor.classList.lastToggle.force, true);
});

test("supplemental follow controls refresh after supplemental inspector visibility returns", () => {
  const Animotion = loadAnimotion();
  const head = Animotion.state.parts.find((item) => item.id === "head");
  Object.assign(head, { isSupplementalPart: true, supplementalMaskScale: 1 });

  Animotion.ui.refreshUi();
  delete head.isSupplementalPart;
  Animotion.ui.refreshUi();
  Object.assign(head, { isSupplementalPart: true });
  Animotion.ui.refreshUi();

  assert.deepEqual(Animotion.state.followControlRefreshes.at(-1), { selectedPartId: "head", hidden: false });
});

test("copied regular part can show supplemental follow controls before conversion", () => {
  const Animotion = loadAnimotion();
  const head = Animotion.state.parts.find((item) => item.id === "head");
  const copy = { ...part("head-copy", "head", "torso"), supplementalCandidateSourcePartId: head.id };
  Animotion.state.parts.push(copy);
  Animotion.state.selectedPartId = copy.id;
  Animotion.supplementalFollowCommands = { canShowForPart: (item) => item?.supplementalCandidateSourcePartId === head.id };

  Animotion.ui.refreshUi();

  assert.equal(Animotion.dom.els.supplementalPartEditor.classList.lastToggle.force, false);
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
