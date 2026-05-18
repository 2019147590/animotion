{
  const global = window;
  const Animotion = global.Animotion;

  function handleKeyDown(event) {
    if (!(event.ctrlKey || event.metaKey) || event.altKey || editableShortcutTarget(event.target)) return false;
    const key = event.key.toLowerCase();
    if (key !== "z" && key !== "y") return false;
    const didApply = event.shiftKey || key === "y"
      ? Animotion.commandHistory?.redo?.()
      : Animotion.commandHistory?.undo?.();
    if (didApply) event.preventDefault();
    return Boolean(didApply);
  }

  function editableShortcutTarget(target) {
    if (!target) return false;
    if (isDomInstance(target, "HTMLSelectElement")) return true;
    if (isDomInstance(target, "HTMLTextAreaElement")) return true;
    if (isDomInstance(target, "HTMLInputElement")) return true;
    if (target.isContentEditable) return true;
    return Boolean(target.closest?.("[contenteditable=''], [contenteditable='true']"));
  }

  function isDomInstance(target, typeName) {
    return typeof global[typeName] !== "undefined" && target instanceof global[typeName];
  }

  Animotion.historyShortcuts = { handleKeyDown };
}
