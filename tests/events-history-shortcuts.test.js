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
  const listeners = {};
  class HTMLInputElement {
    constructor(type = "text") {
      this.type = type;
    }
  }
  class HTMLTextAreaElement {}
  class HTMLSelectElement {}
  class EditableElement {
    constructor({ isContentEditable = false, parent = null } = {}) {
      this.isContentEditable = isContentEditable;
      this.parent = parent;
    }

    closest(selector) {
      if (selector !== "[contenteditable=''], [contenteditable='true']") return null;
      return this.parent?.isContentEditable ? this.parent : null;
    }
  }
  const context = {
    window: {
      Animotion: {},
      HTMLInputElement,
      HTMLTextAreaElement,
      HTMLSelectElement,
      addEventListener(type, handler) {
        listeners[type] = handler;
      },
    },
    HTMLInputElement,
    HTMLTextAreaElement,
    HTMLSelectElement,
  };
  vm.createContext(context);
  runScript(context, "scripts/config.js");
  runScript(context, "scripts/command-history.js");
  runScript(context, "scripts/history-shortcuts.js");
  const Animotion = context.window.Animotion;
  Animotion.dom = { sourceCanvas: eventTarget(), els: elementMap(Animotion.selectors) };
  Animotion.state = { spaceDown: false };
  Animotion.geometry = {};
  Animotion.previewEvents = { bindPreviewCanvasEvents() {} };
  Animotion.cutsceneControls = { bindPanelTransformEvents() {} };
  Animotion.io = {
    handleImageUpload() {},
    handleNextImageUpload() {},
    createGuideParts() {},
    saveRig() {},
    loadRig() {},
  };
  Animotion.lookismPreset = { loadIntoApp() {} };
  Animotion.view = {
    isTypingTarget(target) {
      return target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement;
    },
  };
  Animotion.exporter = { exportWebm() {} };
  Animotion.editor = {};
  Animotion.panelEditor = {};
  Animotion.parts = { selectedPart: () => null };
  Animotion.ui = { refreshUi() {} };
  runScript(context, "scripts/history-controls.js");
  Animotion.historyControls.installControls();
  runScript(context, "scripts/source-canvas-events.js");
  runScript(context, "scripts/events.js");
  Animotion.events.bindEvents();
  return { Animotion, listeners, HTMLInputElement, HTMLTextAreaElement, HTMLSelectElement, EditableElement };
}

function runScript(context, path) {
  vm.runInContext(fs.readFileSync(path, "utf8"), context, { filename: path });
}

function eventTarget() {
  return {
    listeners: {},
    addEventListener(type, handler) {
      this.listeners[type] = handler;
    },
  };
}

function elementMap(selectors) {
  return Object.fromEntries(
    Object.keys(selectors)
      .filter((key) => key !== "sourceCanvas" && key !== "previewCanvas")
      .map((key) => [key, controlElement()])
  );
}

function controlElement() {
  return {
    checked: false,
    dataset: {},
    disabled: false,
    listeners: {},
    textContent: "",
    value: "",
    addEventListener(type, handler) {
      this.listeners[type] = handler;
    },
  };
}

function keyEvent(overrides = {}) {
  return {
    ctrlKey: true,
    metaKey: false,
    altKey: false,
    shiftKey: false,
    key: "z",
    code: "KeyZ",
    target: {},
    prevented: false,
    preventDefault() {
      this.prevented = true;
    },
    ...overrides,
  };
}

test("Ctrl+Z triggers command history undo at runtime", () => {
  const { Animotion, listeners } = loadAnimotion();
  let undoCount = 0;
  Animotion.commandHistory.record({ undo: () => { undoCount += 1; }, redo() {} });
  const event = keyEvent();
  listeners.keydown(event);
  assert.equal(undoCount, 1);
  assert.equal(event.prevented, true);
});

test("Ctrl+Y and Ctrl+Shift+Z trigger command history redo at runtime", () => {
  const { Animotion, listeners } = loadAnimotion();
  let redoCount = 0;
  Animotion.commandHistory.record({ undo() {}, redo: () => { redoCount += 1; } });
  listeners.keydown(keyEvent());
  listeners.keydown(keyEvent({ key: "y", code: "KeyY" }));
  assert.equal(redoCount, 1);
  Animotion.commandHistory.record({ undo() {}, redo: () => { redoCount += 1; } });
  listeners.keydown(keyEvent());
  listeners.keydown(keyEvent({ shiftKey: true }));
  assert.equal(redoCount, 2);
});

test("history buttons trigger command history undo and redo", () => {
  const { Animotion } = loadAnimotion();
  let undoCount = 0;
  let redoCount = 0;
  Animotion.commandHistory.record({
    undo: () => { undoCount += 1; },
    redo: () => { redoCount += 1; },
  });
  Animotion.dom.els.undoCommand.listeners.click();
  assert.equal(undoCount, 1);
  assert.equal(Animotion.dom.els.redoCommand.disabled, false);
  Animotion.dom.els.redoCommand.listeners.click();
  assert.equal(redoCount, 1);
});

test("source double-click delegates selected polygon vertex deletion", () => {
  const { Animotion } = loadAnimotion();
  let deleteCount = 0;
  Animotion.state.image = {};
  Animotion.state.sourceView = { scale: 1 };
  Animotion.dom.els.selectionTool.value = Animotion.tool.edit;
  Animotion.panelEditor.canEditRig = () => true;
  Animotion.view.canvasPoint = () => ({ x: 12, y: 18 });
  Animotion.editor.deleteEditablePointAt = (point) => {
    deleteCount += 1;
    assert.deepEqual(point, { x: 12, y: 18 });
    return true;
  };
  const event = {
    prevented: false,
    preventDefault() { this.prevented = true; },
  };

  Animotion.dom.sourceCanvas.listeners.dblclick(event);

  assert.equal(deleteCount, 1);
  assert.equal(event.prevented, true);
});

test("history shortcuts do not intercept text input targets", () => {
  const { Animotion, listeners, HTMLInputElement } = loadAnimotion();
  let undoCount = 0;
  Animotion.commandHistory.record({ undo: () => { undoCount += 1; }, redo() {} });
  const event = keyEvent({ target: new HTMLInputElement("text") });
  listeners.keydown(event);
  assert.equal(undoCount, 0);
  assert.equal(event.prevented, false);
});

test("history shortcuts do not intercept textarea targets", () => {
  const { Animotion, listeners, HTMLTextAreaElement } = loadAnimotion();
  let undoCount = 0;
  Animotion.commandHistory.record({ undo: () => { undoCount += 1; }, redo() {} });
  const event = keyEvent({ target: new HTMLTextAreaElement() });
  listeners.keydown(event);
  assert.equal(undoCount, 0);
  assert.equal(event.prevented, false);
});

test("history shortcuts do not intercept select targets", () => {
  const { Animotion, listeners, HTMLSelectElement } = loadAnimotion();
  let redoCount = 0;
  Animotion.commandHistory.record({ undo() {}, redo: () => { redoCount += 1; } });
  listeners.keydown(keyEvent());
  const event = keyEvent({ key: "y", code: "KeyY", target: new HTMLSelectElement() });
  listeners.keydown(event);
  assert.equal(redoCount, 0);
  assert.equal(event.prevented, false);
});

test("history shortcuts do not intercept contenteditable targets or descendants", () => {
  const { Animotion, listeners, EditableElement } = loadAnimotion();
  let undoCount = 0;
  Animotion.commandHistory.record({ undo: () => { undoCount += 1; }, redo() {} });
  listeners.keydown(keyEvent({ target: new EditableElement({ isContentEditable: true }) }));
  const parent = new EditableElement({ isContentEditable: true });
  listeners.keydown(keyEvent({ target: new EditableElement({ parent }) }));
  assert.equal(undoCount, 0);
});
