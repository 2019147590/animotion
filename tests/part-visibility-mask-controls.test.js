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
    window: { Animotion: {} },
    document: { createElement: (tag) => fakeElement(tag) },
    crypto: { randomUUID: () => "mask-new" },
  };
  vm.createContext(context);
  const Animotion = context.window.Animotion;
  const part = {
    id: "part-1",
    visibilityMasks: [{ id: "mask-1", name: "mask 1", mask: { kind: "polygon", points: [{ x: 0, y: 0 }, { x: 8, y: 0 }, { x: 8, y: 8 }] }, keyframes: [{ frame: 1, strength: 0.5 }] }],
  };
  Object.assign(Animotion, {
    dom: { els },
    state: { parts: [part], selectedPartId: part.id, editTarget: { kind: "part", partId: part.id, maskId: null }, selection: null, currentFrame: 1 },
    parts: { selectedPart: () => part },
    geometry: { shapeIsReady: () => false },
    imageBounds: () => ({ width: 100, height: 100 }),
    config: { minShapeSize: 4 },
    panelEditor: { canEditRig: () => true },
    partCommands: { updatePart(target, patch) { Object.assign(target, patch); return target; } },
    ui: { refreshUi() { Animotion.partVisibilityMaskControls.refreshControls(); } },
  });
  runScript(context, "scripts/part-visibility-masks.js");
  runScript(context, "scripts/edit-target.js");
  runScript(context, "scripts/part-visibility-mask-commands.js");
  runScript(context, "scripts/part-visibility-mask-controls.js");
  return Animotion;
}

function runScript(context, path) {
  vm.runInContext(fs.readFileSync(path, "utf8"), context, { filename: path });
}

test("visibility mask keyframe controls enable only for an active mask edit target", () => {
  const Animotion = loadControls();
  const { els } = Animotion.dom;

  Animotion.partVisibilityMaskControls.refreshControls();
  assert.equal(els.setVisibilityMaskKeyframe.disabled, true);
  assert.equal(els.removeVisibilityMask.disabled, true);
  assert.equal(els.visibilityMaskStrength.disabled, true);

  els.visibilityMaskList.children[1].click();

  assert.deepEqual(plain(Animotion.state.editTarget), { kind: "visibilityMask", partId: "part-1", maskId: "mask-1" });
  assert.equal(els.setVisibilityMaskKeyframe.disabled, false);
  assert.equal(els.removeVisibilityMask.disabled, false);
  assert.equal(els.visibilityMaskStrength.disabled, false);
});

function fakeEls() {
  const partInspector = fakeElement("div");
  const deletePart = fakeElement("button");
  return { partInspector, deletePart };
}

function plain(value) {
  return JSON.parse(JSON.stringify(value));
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
    disabled: false,
    open: false,
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
    replaceChildren(...items) {
      this.children = [];
      this.append(...items);
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
