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
  const els = fakeEls();
  const context = {
    window: { Animotion: {
      dom: { els },
      state: { image: {}, parts: [{ id: "part-1" }], selectedPartId: "part-1" },
      parts: { selectedPart: () => ({ id: "part-1" }) },
      panelEditor: { canEditRig: () => true },
      ui: { refreshUi() { els.refreshed = true; } },
      partCommands: commandSpies(els),
    } },
    document: { createElement: fakeElement },
  };
  vm.createContext(context);
  runScript(context, "scripts/part-action-controls.js");
  return context.window.Animotion;
}

function runScript(context, path) {
  vm.runInContext(fs.readFileSync(path, "utf8"), context, { filename: path });
}

function commandSpies(els) {
  return {
    copySelectedPart: () => record(els, "copySelectedPart"),
    flipSelectedPartHorizontal: () => record(els, "flipSelectedPartHorizontal"),
    rotateSelectedPartCounterClockwise: (degrees) => record(els, "rotateSelectedPartCounterClockwise", degrees),
    rotateSelectedPartClockwise: (degrees) => record(els, "rotateSelectedPartClockwise", degrees),
  };
}

function record(els, command, degrees = null) {
  els.calls.push({ command, degrees });
  return true;
}

function fakeEls() {
  const partInspector = fakeElement("div");
  const supplementalPartEditor = fakeElement("details");
  const dangerSection = fakeElement("details");
  const dangerBody = fakeElement("div");
  const deletePart = fakeElement("button");
  dangerBody.append(deletePart);
  dangerSection.append(dangerBody);
  partInspector.append(supplementalPartEditor, dangerSection);
  deletePart.closest = () => dangerSection;
  return { partInspector, supplementalPartEditor, deletePart, calls: [] };
}

function fakeElement(tagName = "div") {
  return {
    tagName,
    id: "",
    type: "",
    min: "",
    max: "",
    step: "",
    value: "",
    open: false,
    disabled: false,
    textContent: "",
    className: "",
    children: [],
    listeners: {},
    append(...items) {
      for (const item of items) {
        item.parentNode = this;
        this.children.push(item);
      }
    },
    insertBefore(child, anchor) {
      child.parentNode = this;
      const index = anchor ? this.children.indexOf(anchor) : -1;
      if (index < 0) this.children.push(child);
      else this.children.splice(index, 0, child);
    },
    addEventListener(event, handler) {
      this.listeners[event] = handler;
    },
    click() {
      this.listeners.click?.();
    },
    closest() {
      return null;
    },
  };
}

function ancestors(node) {
  const result = [];
  for (let current = node.parentNode; current; current = current.parentNode) result.push(current);
  return result;
}

test("part action controls install outside the danger section", () => {
  const Animotion = loadControls();
  const { els } = Animotion.dom;
  const transformSection = els.partTransformControls;
  const dangerSection = els.deletePart.closest(".inspector-section");

  assert.equal(transformSection.parentNode, els.partInspector);
  assert.equal(els.partInspector.children.indexOf(transformSection), 0);
  assert.equal(ancestors(els.copyPart).includes(dangerSection), false);
  assert.equal(ancestors(els.rotatePartClockwise).includes(dangerSection), false);
});

test("rotation buttons pass the user selected angle", () => {
  const Animotion = loadControls();
  const { els } = Animotion.dom;
  els.rotatePartDegrees.value = "37.5";

  els.rotatePartClockwise.click();
  els.rotatePartCounterClockwise.click();

  assert.deepEqual(els.calls, [
    { command: "rotateSelectedPartClockwise", degrees: 37.5 },
    { command: "rotateSelectedPartCounterClockwise", degrees: 37.5 },
  ]);
  assert.equal(els.refreshed, true);
});
