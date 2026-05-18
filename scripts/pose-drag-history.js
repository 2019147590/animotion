{
  const global = typeof window !== "undefined" ? window : globalThis;
  const Animotion = global.Animotion || (global.Animotion = {});

  function snapshot(parts = []) {
    return parts.map((part) => ({
      id: part.id,
      customMotion: clone(Animotion.motionModel.normalizeCustomMotion(part.customMotion)),
      keyframes: clone(part.keyframes || []),
    }));
  }

  function record(before, after) {
    if (!before || !after || JSON.stringify(before) === JSON.stringify(after)) return null;
    return Animotion.commandHistory?.record?.({
      label: "pose-drag",
      undo: () => apply(before),
      redo: () => apply(after),
    });
  }

  function apply(items = []) {
    for (const item of items) {
      const part = Animotion.state?.parts?.find((candidate) => candidate.id === item.id);
      if (!part) continue;
      Animotion.partCommands?.updatePart?.(part, { customMotion: clone(item.customMotion) }, { recordHistory: false });
      Animotion.motionCommands?.setPartKeyframes?.(part, clone(item.keyframes || []));
    }
    if (Animotion.state?.project) Animotion.state.project.parts = Animotion.state.parts;
  }

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  Animotion.poseDragHistory = { snapshot, record };
  if (typeof module !== "undefined") module.exports = Animotion.poseDragHistory;
}
