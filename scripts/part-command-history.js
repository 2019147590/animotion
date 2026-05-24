{
  const global = typeof window !== "undefined" ? window : globalThis;
  const Animotion = global.Animotion || (global.Animotion = {});

  function installHistoryWrappers() {
    const commands = Animotion.partCommands;
    if (!commands || commands.historyWrapped) return;
    const original = { ...commands };
    commands.createPartFromShape = withPartsSnapshot("create-part", original.createPartFromShape);
    commands.createPart = withPartsSnapshot("create-part", original.createPart);
    commands.applyShapeToPart = withPartsSnapshot("apply-part-shape", original.applyShapeToPart);
    commands.deletePart = withPartsSnapshot("delete-part", original.deletePart);
    commands.deleteSelectedPart = (options = {}) => commands.deletePart(Animotion.parts.selectedPart(), options);
    commands.historySnapshot = historySnapshot;
    commands.restoreHistorySnapshot = restoreHistorySnapshot;
    commands.recordHistorySnapshot = recordHistorySnapshot;
    commands.historyWrapped = true;
  }

  function withPartsSnapshot(label, action) {
    return function wrappedPartCommand(...args) {
      const options = historyOptions(args);
      const before = historySnapshot();
      const result = action(...args);
      recordHistorySnapshot(label, before, historySnapshot(), options);
      return result;
    };
  }

  function historySnapshot() {
    return {
      selectedPartId: Animotion.state?.selectedPartId || null,
      parts: (Animotion.state?.parts || []).map(partSnapshot),
    };
  }

  function restoreHistorySnapshot(snapshot) {
    const state = Animotion.state;
    state.parts = (snapshot?.parts || []).map(restorePart);
    const ids = new Set(state.parts.map((part) => part.id));
    state.selectedPartId = ids.has(snapshot?.selectedPartId) ? snapshot.selectedPartId : null;
    if (state.project) state.project.parts = state.parts;
  }

  function recordHistorySnapshot(label, before, after, options = {}) {
    if (options.recordHistory === false || sameValue(before, after)) return null;
    return Animotion.commandHistory?.record?.({
      label,
      undo: () => restoreHistorySnapshot(before),
      redo: () => restoreHistorySnapshot(after),
    });
  }

  function historyOptions(args) {
    const last = args[args.length - 1];
    return last && typeof last === "object" && Object.prototype.hasOwnProperty.call(last, "recordHistory") ? last : {};
  }

  function partSnapshot(part) {
    const { canvas, ...rest } = part;
    return clone(rest);
  }

  function restorePart(part) {
    const restored = clone(part);
    if (Animotion.state?.image && Animotion.parts?.updatePartCanvas) Animotion.parts.updatePartCanvas(restored);
    return restored;
  }

  function sameValue(left, right) {
    return JSON.stringify(left) === JSON.stringify(right);
  }

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  installHistoryWrappers();

  if (typeof module !== "undefined") module.exports = Animotion.partCommands;
}
