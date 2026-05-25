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

function loadUi() {
  const document = fakeDocument();
  const context = {
    window: {
      Animotion: {
        state: { selectedPartId: "body", parts: [{ id: "body", name: "body" }], project: { assets: [] } },
        parts: { selectedPart: () => context.window.Animotion.state.parts.find((part) => part.id === context.window.Animotion.state.selectedPartId) || null },
        hiddenCompletionPartPanel: { refreshControls: () => "panel" },
        hiddenCompletionSupplementalPart: {
          activeLinkedSymmetryPatch: () => ({ ok: true, asset: { id: "hidden-body" } }),
          linkedSymmetryPatchesForAction: () => [{ asset: { id: "hidden-body" } }, { asset: { id: "hidden-upper" } }],
          insertForSelectedLinkedPatch: (state) => {
            const part = { id: "supp-hidden-body", name: "body 보완", isSupplementalPart: true, sourcePatchAssetId: "hidden-body", sourcePartId: "body", counterpartPartId: "body-ref" };
            state.parts.push(part);
            state.selectedPartId = part.id;
            return { ok: true, part };
          },
          insertAllLinkedPatches: (state) => {
            const body = { id: "supp-hidden-body", name: "body 보완", isSupplementalPart: true, sourcePatchAssetId: "hidden-body", sourcePartId: "body" };
            const upper = { id: "supp-hidden-upper", name: "upper 보완", isSupplementalPart: true, sourcePatchAssetId: "hidden-upper", sourcePartId: "upper" };
            state.parts.push(body, upper);
            state.selectedPartId = upper.id;
            return { ok: true, inserted: [body, upper], existing: [] };
          },
          coverageForPart: () => ({
            maskBounds: { x: 0, y: 0, w: 40, h: 60 },
            rectBounds: { x: 0, y: 0, w: 40, h: 60 },
            coverageRatio: 0.5,
            warnings: ["canvas-opaque-bounds-too-small"],
          }),
        },
        ui: { refreshUi: () => {} },
      },
    },
    document,
  };
  vm.createContext(context);
  vm.runInContext(fs.readFileSync("scripts/hidden-completion-supplemental-part-ui.js", "utf8"), context, { filename: "scripts/hidden-completion-supplemental-part-ui.js" });
  return { Animotion: context.window.Animotion, document };
}

function fakeDocument() {
  const nodes = new Map();
  nodes.set("#hiddenCompletionPartTools", fakeElement("hiddenCompletionPartTools", nodes));
  nodes.set("#partInspector", fakeElement("partInspector", nodes));
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
    children: [],
    listeners: {},
    classList: { values: new Set(), toggle(name, force) { force ? this.values.add(name) : this.values.delete(name); }, contains(name) { return this.values.has(name); } },
    addEventListener(type, handler) { this.listeners[type] = handler; },
    click() { this.listeners.click?.({ target: this }); },
    append(child) { this.children.push(child); register(child, nodes); },
    prepend(child) { this.children.unshift(child); register(child, nodes); },
    replaceChildren(...children) { this.children = children; for (const child of children) register(child, nodes); },
  };
  return element;
}

function register(node, nodes) {
  if (node?.id) nodes.set(`#${node.id}`, node);
}

test("supplemental part UI adds an insert button and status to the hidden-completion panel", () => {
  const { document } = loadUi();

  assert.ok(document.querySelector("#insertHiddenCompletionSupplementalPart"));
  assert.ok(document.querySelector("#insertAllHiddenCompletionSupplementalParts"));
  assert.equal(document.querySelector("#insertHiddenCompletionSupplementalPart").disabled, false);
  assert.equal(document.querySelector("#insertAllHiddenCompletionSupplementalParts").disabled, false);
  assert.match(document.querySelector("#hiddenCompletionSupplementalPartStatus").textContent, /보완 파츠/);
});

test("supplemental part UI button inserts and selects the generated part", () => {
  const { Animotion, document } = loadUi();

  document.querySelector("#insertHiddenCompletionSupplementalPart").click();

  assert.equal(Animotion.state.parts.length, 2);
  assert.equal(Animotion.state.selectedPartId, "supp-hidden-body");
});

test("supplemental part UI all button inserts multiple generated parts", () => {
  const { Animotion, document } = loadUi();

  document.querySelector("#insertAllHiddenCompletionSupplementalParts").click();

  assert.equal(Animotion.state.parts.length, 3);
  assert.equal(Animotion.state.parts.filter((part) => part.isSupplementalPart).length, 2);
  assert.equal(Animotion.state.selectedPartId, "supp-hidden-upper");
});

test("supplemental part inspector status is visible for selected supplemental part", () => {
  const { Animotion, document } = loadUi();
  document.querySelector("#insertHiddenCompletionSupplementalPart").click();

  Animotion.hiddenCompletionSupplementalPartUi.refreshControls();

  const status = document.querySelector("#supplementalPartInspectorStatus");
  assert.equal(status.classList.contains("hidden"), false);
  assert.match(status.textContent, /symmetry에서 생성됨/);
  assert.match(status.textContent, /hidden-body/);
  assert.match(status.textContent, /coverage 50%/);
  assert.match(status.textContent, /canvas-opaque-bounds-too-small/);
});
