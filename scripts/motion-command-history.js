{
  const global = typeof window !== "undefined" ? window : globalThis;
  const Animotion = global.Animotion || (global.Animotion = {});

  function installHistoryWrappers() {
    const commands = Animotion.motionCommands;
    if (!commands || commands.historyWrapped) return;
    const original = { ...commands };
    commands.applyGeneratedTracks = withMotionSnapshot("generated-tracks", original.applyGeneratedTracks);
    commands.applyMotionPlanResult = withMotionSnapshot("motion-plan", original.applyMotionPlanResult);
    commands.historySnapshot = historySnapshot;
    commands.restoreHistorySnapshot = restoreHistorySnapshot;
    commands.historyWrapped = true;
  }

  function withMotionSnapshot(label, action) {
    return function wrappedMotionCommand(...args) {
      const options = historyOptions(args);
      const before = historySnapshot();
      const result = action(...args);
      recordHistorySnapshot(label, before, historySnapshot(), options);
      return result;
    };
  }

  function historySnapshot() {
    const state = Animotion.state || {};
    return {
      cutsceneBridge: cloneValue(state.cutsceneBridge),
      motionPlan: cloneValue(state.motionPlan),
      parts: (state.parts || []).map((part) => ({
        id: part.id,
        customMotion: cloneValue(Animotion.motionModel?.normalizeCustomMotion?.(part.customMotion) || part.customMotion || {}),
        keyframes: cloneValue(part.keyframes || []),
      })),
    };
  }

  function restoreHistorySnapshot(snapshot) {
    const state = Animotion.state;
    state.cutsceneBridge = cloneValue(snapshot?.cutsceneBridge);
    state.motionPlan = cloneValue(snapshot?.motionPlan);
    for (const item of snapshot?.parts || []) {
      const part = state.parts.find((candidate) => candidate.id === item.id);
      if (!part) continue;
      part.customMotion = cloneValue(item.customMotion);
      part.keyframes = cloneValue(item.keyframes || []);
    }
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

  function sameValue(left, right) {
    return JSON.stringify(left) === JSON.stringify(right);
  }

  function cloneValue(value) {
    if (value === undefined || value === null) return value ?? null;
    return JSON.parse(JSON.stringify(value));
  }

  installHistoryWrappers();

  if (typeof module !== "undefined") module.exports = Animotion.motionCommands;
}
