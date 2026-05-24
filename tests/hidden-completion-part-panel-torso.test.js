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
  const context = { window: { Animotion: { state: { project: { assets: [] }, parts: [], selectedPartId: null }, parts: { selectedPart: () => null } } }, document };
  vm.createContext(context);
  for (const path of [
    "scripts/cutscene-action-selectors.js",
    "scripts/hidden-completion-part-panel-helpers.js",
    "scripts/hidden-completion-part-panel.js",
  ]) vm.runInContext(fs.readFileSync(path, "utf8"), context, { filename: path });
  return { Animotion: context.window.Animotion, document };
}

function fakeDocument() {
  const nodes = new Map();
  const editHidden = fakeElement("editHidden", nodes);
  editHidden.closest = () => fakeElement("editHiddenLabel", nodes);
  nodes.set("#editHidden", editHidden);
  nodes.set("#partInspector", fakeElement("partInspector", nodes));
  return { querySelector: (selector) => nodes.get(selector) || null, createElement: () => fakeElement("", nodes) };
}

function fakeElement(id, nodes) {
  const element = {
    id,
    dataset: {},
    disabled: false,
    value: "",
    children: [],
    listeners: {},
    classList: { toggle() {} },
    addEventListener(type, handler) { this.listeners[type] = handler; },
    click() { this.listeners.click?.({ target: this }); },
    change() { this.listeners.change?.({ target: this }); },
    after(child) { if (child.id) nodes.set(`#${child.id}`, child); },
    append(child) { this.children.push(child); },
    replaceChildren(...children) { this.children = children; },
  };
  Object.defineProperty(element, "innerHTML", {
    set(value) {
      for (const match of String(value).matchAll(/id="([^"]+)"/g)) nodes.set(`#${match[1]}`, fakeElement(match[1], nodes));
    },
  });
  return element;
}

test("torso symmetry draft uses the selected left right target region", () => {
  const { Animotion, document } = loadPanel();
  const part = { id: "body", name: "body", type: "body", humanRole: "torso" };
  let options = null, hiddenCompletion = null;
  Animotion.state.parts = [part];
  Animotion.state.selectedPartId = part.id;
  Animotion.parts.selectedPart = () => part;
  Animotion.motionDraftEditor = {
    activeDraftContext: () => ({ draft: { partId: part.id, hiddenCompletion: { status: "none" } } }),
    updateHiddenCompletion: (next) => { hiddenCompletion = next; return { hiddenCompletion: next }; },
  };
  Animotion.hiddenCompletionAssets = { isPatchAsset: (asset) => asset.type === "hiddenCompletionPatch", findById: () => null };
  Animotion.hiddenCompletionSymmetry = {
    createPatchAsset: (target, parts, createOptions) => {
      options = createOptions;
      return { ok: true, asset: { id: "hidden-body-symmetry", type: "hiddenCompletionPatch", sourcePartId: target.id } };
    },
  };

  Animotion.hiddenCompletionPartPanel.refreshControls();
  document.querySelector("#hiddenCompletionSymmetryRegion").value = "right";
  document.querySelector("#createHiddenCompletionSymmetryDraft").click();

  assert.equal(options.targetRegion, "right");
  assert.equal(hiddenCompletion.assetId, "hidden-body-symmetry");
  assert.equal(Animotion.state.project.assets[0].id, "hidden-body-symmetry");
});
