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

function loadPanel() {
  const document = fakeDocument();
  const context = {
    window: {
      Animotion: {
        state: { project: { assets: [] }, parts: [], selectedPartId: null },
        parts: { selectedPart: () => null },
      },
    },
    document,
  };
  vm.createContext(context);
  vm.runInContext(fs.readFileSync("scripts/hidden-completion-part-panel.js", "utf8"), context, {
    filename: "scripts/hidden-completion-part-panel.js",
  });
  return { Animotion: context.window.Animotion, document };
}

function fakeDocument() {
  const nodes = new Map();
  const editHiddenLabel = fakeElement("editHiddenLabel", nodes);
  const editHidden = fakeElement("editHidden", nodes);
  const partInspector = fakeElement("partInspector", nodes);
  editHidden.closest = () => editHiddenLabel;
  nodes.set("#editHidden", editHidden);
  nodes.set("#partInspector", partInspector);
  return {
    querySelector: (selector) => nodes.get(selector) || null,
    createElement: (tag) => fakeElement("", nodes, tag),
  };
}

function fakeElement(id, nodes, tag = "div") {
  const element = {
    id,
    tag,
    dataset: {},
    disabled: false,
    textContent: "",
    value: "",
    children: [],
    listeners: {},
    classList: {
      values: new Set(),
      toggle(name, force) {
        if (force) this.values.add(name);
        else this.values.delete(name);
      },
      contains(name) {
        return this.values.has(name);
      },
    },
    addEventListener(type, handler) {
      this.listeners[type] = handler;
    },
    click() {
      this.listeners.click?.({ target: this });
    },
    change() {
      this.listeners.change?.({ target: this });
    },
    after(child) {
      registerNode(child, nodes);
    },
    append(child) {
      this.children.push(child);
    },
    replaceChildren(...children) {
      this.children = children;
    },
  };
  Object.defineProperty(element, "innerHTML", {
    set(value) {
      for (const match of String(value).matchAll(/id="([^"]+)"/g)) {
        registerNode(fakeElement(match[1], nodes), nodes);
      }
    },
  });
  return element;
}

function registerNode(node, nodes) {
  if (node.id) nodes.set(`#${node.id}`, node);
}

test("hidden completion part panel installs without motion draft inspector", () => {
  const { document } = loadPanel();
  assert.ok(document.querySelector("#hiddenCompletionPartTools"));
  assert.equal(document.querySelector("#motionDraftInspector"), null);
});

test("hidden completion part panel refresh is hidden when no part is selected", () => {
  const { Animotion, document } = loadPanel();
  assert.doesNotThrow(() => Animotion.hiddenCompletionPartPanel.refreshControls());
  assert.equal(document.querySelector("#hiddenCompletionPartTools").classList.contains("hidden"), true);
  assert.equal(document.querySelector("#createHiddenCompletionGuideFromPart").disabled, true);
});

test("hidden completion part panel enables existing guide creation only for selected draft part", () => {
  const { Animotion, document } = loadPanel();
  const part = { id: "head-a", name: "head" };
  let calls = 0;
  Animotion.state.parts = [part];
  Animotion.state.selectedPartId = part.id;
  Animotion.parts.selectedPart = () => part;
  Animotion.motionDraftEditor = { activeDraftContext: () => ({ draft: { partId: part.id, hiddenCompletion: {} } }) };
  Animotion.hiddenCompletionGuideEditor = { createGuideFromSelectedPart: () => { calls += 1; return { id: "hidden-head-a-guide" }; } };
  Animotion.hiddenCompletionAssets = { findById: () => null };

  Animotion.hiddenCompletionPartPanel.refreshControls();
  const button = document.querySelector("#createHiddenCompletionGuideFromPart");
  assert.equal(button.disabled, false);
  button.click();
  assert.equal(calls, 1);
});

test("hidden completion part panel creates a selected 2D mesh guide through the guide editor", () => {
  const { Animotion, document } = loadPanel();
  const part = { id: "head-a", name: "head" };
  let options = null;
  Animotion.state.parts = [part];
  Animotion.state.selectedPartId = part.id;
  Animotion.parts.selectedPart = () => part;
  Animotion.motionDraftEditor = { activeDraftContext: () => ({ draft: { partId: part.id, hiddenCompletion: {} } }) };
  Animotion.hiddenCompletionAssets = {
    defaultGuideForPart: () => ({
      kind: "meshGuide",
      meshVerticesNormalized: [],
      meshFaces: [],
      silhouetteVerticesNormalized: [],
      guideStrength: 1,
    }),
    findById: () => null,
  };
  Animotion.hiddenCompletionGuideEditor = {
    createGuideFromSelectedPart: (nextOptions) => {
      options = nextOptions;
      return { id: "hidden-head-a-guide", guide: nextOptions.guide };
    },
  };

  Animotion.hiddenCompletionPartPanel.refreshControls();
  const preset = document.querySelector("#hiddenCompletionMeshPreset");
  preset.value = "centerFan";
  document.querySelector("#createHiddenCompletionMeshGuide").click();
  assert.equal(options.guide.meshVerticesNormalized.length, 5);
  assert.deepEqual(Array.from(options.guide.meshFaces[0]), [0, 1, 4]);
  assert.equal(options.preview.label, "2D mesh guide");
});

test("hidden completion part panel creates a draft for cutscene actions before guide creation", () => {
  const { Animotion, document } = loadPanel();
  const part = { id: "head-a", name: "head" };
  let created = false;
  Animotion.state.parts = [part];
  Animotion.state.selectedPartId = part.id;
  Animotion.state.cutsceneBridge = { jointAction: { source: "manual-cutscene", beats: [] } };
  Animotion.parts.selectedPart = () => part;
  Animotion.motionDrafts = {
    compileFromHints: () => ({ partId: part.id, hiddenCompletion: { status: "candidate" } }),
    snapshot: (draft) => ({ ...draft, draftScope: "action-snapshot" }),
  };
  Animotion.motionCommands = {
    updateJointAction: (action) => {
      Animotion.state.cutsceneBridge.jointAction = action;
      return action;
    },
  };
  Animotion.motionDraftEditor = {
    activeDraftContext: () => {
      const draft = Animotion.state.cutsceneBridge.jointAction.motionDraft;
      return draft ? { scope: "action-snapshot", draft } : null;
    },
  };
  Animotion.hiddenCompletionAssets = { findById: () => null };
  Animotion.hiddenCompletionGuideEditor = {
    createGuideFromSelectedPart: () => {
      created = Boolean(Animotion.motionDraftEditor.activeDraftContext()?.draft);
      return created ? { id: "hidden-head-a-guide" } : null;
    },
  };

  Animotion.hiddenCompletionPartPanel.refreshControls();
  assert.equal(document.querySelector("#createHiddenCompletionGuideFromPart").disabled, false);
  document.querySelector("#createHiddenCompletionGuideFromPart").click();
  assert.equal(created, true);
  assert.equal(Animotion.state.cutsceneBridge.jointAction.motionDraft.partId, part.id);
});

test("hidden completion part panel does not create against another part draft", () => {
  const { Animotion, document } = loadPanel();
  const part = { id: "head-a", name: "head" };
  let calls = 0;
  Animotion.state.parts = [part];
  Animotion.state.selectedPartId = part.id;
  Animotion.parts.selectedPart = () => part;
  Animotion.motionDraftEditor = { activeDraftContext: () => ({ draft: { partId: "arm-a", hiddenCompletion: {} } }) };
  Animotion.hiddenCompletionGuideEditor = { createGuideFromSelectedPart: () => { calls += 1; return {}; } };

  Animotion.hiddenCompletionPartPanel.refreshControls();
  assert.equal(document.querySelector("#createHiddenCompletionGuideFromPart").disabled, true);
  assert.equal(Animotion.hiddenCompletionPartPanel.createGuide(), null);
  assert.equal(calls, 0);
});

test("hidden completion part panel links only patches from the selected part", () => {
  const { Animotion, document } = loadPanel();
  const part = { id: "head-a", name: "head" };
  let patch = null;
  Animotion.state.project.assets = [
    { id: "patch-head", type: "hiddenCompletionPatch", sourcePartId: part.id, name: "head patch" },
    { id: "patch-arm", type: "hiddenCompletionPatch", sourcePartId: "arm-a", name: "arm patch" },
  ];
  Animotion.state.parts = [part];
  Animotion.state.selectedPartId = part.id;
  Animotion.parts.selectedPart = () => part;
  Animotion.hiddenCompletionAssets = {
    isPatchAsset: (asset) => asset.type === "hiddenCompletionPatch",
    findById: (assets, id) => assets.find((asset) => asset.id === id) || null,
  };
  Animotion.motionDraftEditor = {
    activeDraftContext: () => ({ draft: { partId: part.id, hiddenCompletion: { status: "none" } } }),
    updateHiddenCompletion: (nextPatch) => {
      patch = nextPatch;
      return { hiddenCompletion: nextPatch };
    },
  };

  Animotion.hiddenCompletionPartPanel.refreshControls();
  const select = document.querySelector("#hiddenCompletionPatchSelect");
  assert.deepEqual(select.children.map((option) => option.value), ["", "patch-head"]);
  select.value = "patch-head";
  select.change();
  assert.equal(document.querySelector("#linkHiddenCompletionPatch").disabled, false);
  document.querySelector("#linkHiddenCompletionPatch").click();
  assert.equal(patch.status, "candidate");
  assert.equal(patch.assetKind, "hiddenCompletionPatch");
  assert.equal(patch.assetStatus, "ready");
  assert.equal(patch.assetId, "patch-head");
});

test("hidden completion part panel unlinks through the existing draft helper", () => {
  const { Animotion, document } = loadPanel();
  const part = { id: "head-a", name: "head" };
  let removed = false;
  Animotion.state.project.assets = [{ id: "patch-head", type: "hiddenCompletionPatch", sourcePartId: part.id }];
  Animotion.state.parts = [part];
  Animotion.state.selectedPartId = part.id;
  Animotion.parts.selectedPart = () => part;
  Animotion.hiddenCompletionAssets = {
    isPatchAsset: (asset) => asset.type === "hiddenCompletionPatch",
    findById: (assets, id) => assets.find((asset) => asset.id === id) || null,
  };
  Animotion.motionDraftEditor = {
    activeDraftContext: () => ({ draft: { partId: part.id, hiddenCompletion: { assetId: "patch-head" } } }),
    removeHiddenCompletionAsset: () => {
      removed = true;
      return { hiddenCompletion: { assetStatus: "missing", assetId: null } };
    },
  };

  Animotion.hiddenCompletionPartPanel.refreshControls();
  assert.equal(document.querySelector("#unlinkHiddenCompletionPatch").disabled, false);
  document.querySelector("#unlinkHiddenCompletionPatch").click();
  assert.equal(removed, true);
});
