{
  const global = typeof window !== "undefined" ? window : globalThis;
  const Animotion = global.Animotion || (global.Animotion = {});
  const MAX_HISTORY = 100;

  function ensureState() {
    const state = Animotion.state || (Animotion.state = {});
    state.commandHistory ||= { undoStack: [], redoStack: [], applying: false };
    return state.commandHistory;
  }

  function record(command) {
    const history = ensureState();
    if (history.applying || !isCommand(command)) return null;
    history.undoStack.push(command);
    if (history.undoStack.length > MAX_HISTORY) history.undoStack.shift();
    history.redoStack = [];
    notify();
    return command;
  }

  function undo() {
    return applyFrom("undoStack", "redoStack", "undo");
  }

  function redo() {
    return applyFrom("redoStack", "undoStack", "redo");
  }

  function clear() {
    const history = ensureState();
    history.undoStack = [];
    history.redoStack = [];
    notify();
  }

  function canUndo() {
    return ensureState().undoStack.length > 0;
  }

  function canRedo() {
    return ensureState().redoStack.length > 0;
  }

  function applyFrom(sourceKey, targetKey, method) {
    const history = ensureState();
    const command = history[sourceKey].pop();
    if (!command) return false;
    history.applying = true;
    try {
      command[method]();
      history[targetKey].push(command);
      Animotion.ui?.refreshUi?.();
      notify();
      return true;
    } finally {
      history.applying = false;
    }
  }

  function isCommand(command) {
    return command && typeof command.undo === "function" && typeof command.redo === "function";
  }

  function notify() {
    Animotion.historyControls?.refreshControls?.();
  }

  Animotion.commandHistory = { record, undo, redo, clear, canUndo, canRedo };
}
