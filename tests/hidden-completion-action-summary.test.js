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

function loadSummary() {
  const document = fakeDocument();
  const context = {
    window: {
      Animotion: {
        state: stateFixture(),
        hiddenCompletionPartPanel: { refreshControls: () => "panel-refreshed" },
      },
    },
    document,
  };
  vm.createContext(context);
  for (const path of [
    "scripts/hidden-completion-assets.js",
    "scripts/cutscene-action-selectors.js",
    "scripts/motion-draft-action-store.js",
    "scripts/hidden-completion-action-summary.js",
  ]) vm.runInContext(fs.readFileSync(path, "utf8"), context, { filename: path });
  return { Animotion: context.window.Animotion, document };
}

function stateFixture() {
  return {
    parts: [{ id: "body", name: "body" }, { id: "rear_forearm", name: "rear forearm" }],
    project: {
      assets: [
        { id: "hidden-body", type: "hiddenCompletionPatch", sourcePartId: "body", name: "body side fill", completionMethod: "symmetry" },
        { id: "hidden-forearm", type: "hiddenCompletionPatch", sourcePartId: "rear_forearm", name: "forearm fill", completionMethod: "symmetry" },
      ],
    },
    cutsceneBridge: {
      jointAction: {
        beats: [{ id: "impact", at: 12, pose: { p: [1, 2] } }],
        hiddenCompletionDrafts: [
          { partId: "body", hiddenCompletion: { assetStatus: "ready", assetId: "hidden-body" } },
          { partId: "rear_forearm", hiddenCompletion: { assetStatus: "ready", assetId: "hidden-forearm" } },
        ],
      },
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
    className: "",
    textContent: "",
    title: "",
    children: [],
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
    append(child) {
      this.children.push(child);
      register(child, nodes);
    },
    replaceChildren(...children) {
      this.children = children;
      for (const child of children) register(child, nodes);
    },
  };
  return element;
}

function register(node, nodes) {
  if (!node?.id) return;
  nodes.set(`#${node.id}`, node);
}

test("action summary shows linked hidden completion boxes for multiple action parts", () => {
  const { Animotion, document } = loadSummary();

  Animotion.hiddenCompletionActionSummary.renderControls();

  const root = document.querySelector("#hiddenCompletionActionSummary");
  const count = document.querySelector("#hiddenCompletionActionSummaryCount");
  const list = document.querySelector("#hiddenCompletionActionSummaryList");
  assert.equal(root.classList.contains("hidden"), false);
  assert.equal(count.textContent, "2");
  assert.equal(list.children.length, 2);
  assert.equal(list.children[0].children[1].textContent, "body");
  assert.equal(list.children[1].children[1].textContent, "rear forearm");
});

test("action summary hides after linked patches are removed", () => {
  const { Animotion, document } = loadSummary();
  Animotion.state.cutsceneBridge.jointAction.hiddenCompletionDrafts = [
    { partId: "body", hiddenCompletion: { assetStatus: "missing", assetId: null } },
  ];

  Animotion.hiddenCompletionActionSummary.renderControls();

  assert.equal(document.querySelector("#hiddenCompletionActionSummary").classList.contains("hidden"), true);
});

test("action summary renders after the hidden completion panel refreshes", () => {
  const { Animotion, document } = loadSummary();
  Animotion.state.cutsceneBridge.jointAction.hiddenCompletionDrafts = [
    { partId: "body", hiddenCompletion: { assetStatus: "ready", assetId: "hidden-body" } },
  ];

  assert.equal(Animotion.hiddenCompletionPartPanel.refreshControls(), "panel-refreshed");

  assert.equal(document.querySelector("#hiddenCompletionActionSummaryCount").textContent, "1");
});
