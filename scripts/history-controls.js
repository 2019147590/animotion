{
  const global = typeof window !== "undefined" ? window : globalThis;
  const Animotion = global.Animotion || (global.Animotion = {});

  function installControls() {
    const els = Animotion.dom?.els;
    if (!els?.undoCommand || !els?.redoCommand || els.undoCommand.dataset?.historyBound) return;
    els.undoCommand.addEventListener("click", undo);
    els.redoCommand.addEventListener("click", redo);
    els.undoCommand.dataset.historyBound = "true";
    refreshControls();
  }

  function refreshControls() {
    const els = Animotion.dom?.els;
    if (!els?.undoCommand || !els?.redoCommand) return;
    els.undoCommand.disabled = !Animotion.commandHistory?.canUndo?.();
    els.redoCommand.disabled = !Animotion.commandHistory?.canRedo?.();
  }

  function undo() {
    Animotion.commandHistory?.undo?.();
    refreshControls();
  }

  function redo() {
    Animotion.commandHistory?.redo?.();
    refreshControls();
  }

  Animotion.historyControls = { installControls, refreshControls, undo, redo };
  installControls();

  if (typeof module !== "undefined") module.exports = Animotion.historyControls;
}
