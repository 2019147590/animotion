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

function loadControls() {
  const root = fakeElement("details");
  root.id = "supplementalPartEditor";
  const body = fakeElement("div");
  body.className = "inspector-section-body";
  root.append(body);
  const document = fakeDocument(root, body);
  const calls = [];
  const context = {
    window: { Animotion: {
      state: { selectedPartId: "supp", parts: [{ id: "supp", isSupplementalPart: true }] },
      parts: { selectedPart: () => context.window.Animotion.state.parts[0] },
      dom: { els: {} },
      partCommands: {
        markSelectedAsSupplementalPart: () => record(calls, "convert"),
        setSelectedSupplementalShoulderFill: () => record(calls, "shoulder"),
        setSelectedSupplementalElbowJointFill: () => record(calls, "elbow"),
        clearSelectedSupplementalFollow: () => record(calls, "clear"),
      },
      supplementalFollow: {},
      supplementalFollowCommands: { canConvertSelectedPart: () => false, canShowForPart: () => true },
      ui: { refreshUi: () => calls.push("refresh") },
    } },
    document,
  };
  vm.createContext(context);
  vm.runInContext(fs.readFileSync("scripts/supplemental-follow-controls.js", "utf8"), context, { filename: "scripts/supplemental-follow-controls.js" });
  return { Animotion: context.window.Animotion, document, calls };
}

function record(calls, command) {
  calls.push(command);
  return true;
}

function fakeDocument(root, body) {
  return {
    createElement: fakeElement,
    querySelector(selector) {
      if (selector === "#supplementalPartEditor .inspector-section-body") return body;
      if (selector.startsWith("#")) return findById(root, selector.slice(1));
      return null;
    },
  };
}

function fakeElement(tagName = "div") {
  return {
    tagName,
    id: "",
    type: "",
    textContent: "",
    className: "",
    disabled: false,
    children: [],
    parentNode: null,
    listeners: {},
    dataset: {},
    append(...items) {
      for (const item of items) {
        item.parentNode = this;
        this.children.push(item);
      }
    },
    addEventListener(event, handler) {
      this.listeners[event] = handler;
    },
    click() {
      this.listeners.click?.();
    },
  };
}

function findById(node, id) {
  if (node.id === id) return node;
  for (const child of node.children || []) {
    const found = findById(child, id);
    if (found) return found;
  }
  return null;
}

test("supplemental follow controls install in the supplemental inspector and run commands", () => {
  const { document, calls } = loadControls();
  const shoulder = document.querySelector("#setSupplementalShoulderFill");
  const convert = document.querySelector("#markSupplementalFollowPart");
  const elbow = document.querySelector("#setSupplementalElbowJointFill");
  const clear = document.querySelector("#clearSupplementalFollow");
  const status = document.querySelector("#supplementalFollowStatus");

  assert.equal(Boolean(convert), true);
  assert.equal(Boolean(shoulder), true);
  assert.equal(Boolean(elbow), true);
  assert.equal(clear.disabled, true);
  assert.equal(status.textContent, "Supplemental follow: none.");

  shoulder.click();
  elbow.click();

  assert.deepEqual(calls, ["shoulder", "refresh", "elbow", "refresh"]);
});
