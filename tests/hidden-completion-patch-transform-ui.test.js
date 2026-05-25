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

function loadUi(options = {}) {
  const document = fakeDocument();
  const context = {
    window: {
      Animotion: {
        state: stateFixture(options),
        parts: { selectedPart: () => context.window.Animotion.state.parts.find((part) => part.id === context.window.Animotion.state.selectedPartId) },
        motionDraftEditor: { activeDraftContext: () => options.selectedSupplemental ? null : ({ draft: { partId: "body", hiddenCompletion: { assetId: "hidden-body" } } }) },
        hiddenCompletionPartPanel: { refreshControls: () => "panel" },
        hiddenCompletionSupplementalPart: { syncPartForPatch: (...args) => { context.syncArgs = args; } },
        ui: { refreshUi: () => { context.refreshCount = (context.refreshCount || 0) + 1; } },
      },
    },
    document,
    syncArgs: null,
    refreshCount: 0,
  };
  vm.createContext(context);
  runScript(context, "scripts/hidden-completion-assets.js");
  if (options.manualAsset) context.window.Animotion.state.project.assets[0].completionMethod = "manual";
  runScript(context, "scripts/hidden-completion-patch-transform-ui.js");
  return { Animotion: context.window.Animotion, document, context };
}

function runScript(context, path) {
  vm.runInContext(fs.readFileSync(path, "utf8"), context, { filename: path });
}

function stateFixture(options = {}) {
  const parts = [{ id: "body", name: "body" }];
  if (options.selectedSupplemental) parts.push({ id: "supp-hidden-body", name: "body 보완", isSupplementalPart: true, sourcePatchAssetId: "hidden-body" });
  return {
    parts,
    selectedPartId: options.selectedSupplemental ? "supp-hidden-body" : "body",
    project: {
      assets: [{
        id: "hidden-body",
        type: "hiddenCompletionPatch",
        sourcePartId: "body",
        completionMethod: "symmetry",
        patchTransform: {
          translationNormalized: { xNorm: 0.1, yNorm: -0.2 },
          scaleX: 1.1,
          scaleY: 0.9,
          rotation: 5,
        },
      }],
    },
  };
}

function fakeDocument() {
  const nodes = new Map();
  nodes.set("#hiddenCompletionPartTools", fakeElement("hiddenCompletionPartTools", nodes));
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
    classList: { values: new Set(), toggle(name, force) { force ? this.values.add(name) : this.values.delete(name); }, contains(name) { return this.values.has(name); } },
    addEventListener(type, handler) { this.listeners[type] = handler; },
    input() { this.listeners.input?.({ target: this }); },
    click() { this.listeners.click?.({ target: this }); },
    append(child) { this.children.push(child); register(child, nodes); },
  };
  Object.defineProperty(element, "innerHTML", {
    set(value) {
      for (const match of String(value).matchAll(/id="([^"]+)"/g)) register(fakeElement(match[1], nodes), nodes);
    },
  });
  return element;
}

function register(node, nodes) {
  if (node?.id) nodes.set(`#${node.id}`, node);
}

test("patch transform UI exposes current symmetry patch sampling controls", () => {
  const { document } = loadUi();

  assert.equal(document.querySelector("#hiddenCompletionPatchTransformTools").classList.contains("hidden"), false);
  assert.equal(document.querySelector("#hiddenCompletionPatchOffsetX").value, 0.1);
  assert.equal(document.querySelector("#hiddenCompletionPatchOffsetY").value, -0.2);
  assert.equal(document.querySelector("#hiddenCompletionPatchScaleX").value, 1.1);
  assert.equal(document.querySelector("#hiddenCompletionPatchRotation").value, 5);
});

test("patch transform UI stores signed offsets and regenerates supplemental canvas", () => {
  const { Animotion, document, context } = loadUi();

  const input = document.querySelector("#hiddenCompletionPatchOffsetX");
  input.value = "-0.35";
  input.input();

  const asset = Animotion.state.project.assets[0];
  assert.equal(asset.patchTransform.translationNormalized.xNorm, -0.35);
  assert.equal(asset.patchTransform.translationNormalized.yNorm, -0.2);
  assert.equal(context.syncArgs[0].id, "hidden-body");
  assert.deepEqual(JSON.parse(JSON.stringify(context.syncArgs[2])), { regenerateCanvas: true });
  assert.equal(context.refreshCount, 1);
});

test("patch transform UI reset keeps the existing schema shape", () => {
  const { Animotion, document } = loadUi();

  document.querySelector("#resetHiddenCompletionPatchTransform").click();

  const transform = Animotion.state.project.assets[0].patchTransform;
  assert.deepEqual(JSON.parse(JSON.stringify(transform)), {
    coordinateSpace: "part-local",
    translationNormalized: { xNorm: 0, yNorm: 0, coordinateSpace: "part-local-normalized" },
    scaleX: 1,
    scaleY: 1,
    rotation: 0,
  });
});

test("patch transform UI stays hidden for non symmetry patches", () => {
  const { document } = loadUi({ manualAsset: true });

  assert.equal(document.querySelector("#hiddenCompletionPatchTransformTools").classList.contains("hidden"), true);
});

test("patch transform UI works after selecting the generated supplemental part", () => {
  const { Animotion, document, context } = loadUi({ selectedSupplemental: true });

  assert.equal(document.querySelector("#hiddenCompletionPatchTransformTools").classList.contains("hidden"), false);
  const input = document.querySelector("#hiddenCompletionPatchOffsetY");
  input.value = "0.25";
  input.input();

  assert.equal(Animotion.state.project.assets[0].patchTransform.translationNormalized.yNorm, 0.25);
  assert.equal(context.syncArgs[0].id, "hidden-body");
  assert.deepEqual(JSON.parse(JSON.stringify(context.syncArgs[2])), { regenerateCanvas: true });
});
