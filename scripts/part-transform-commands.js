{
  const global = typeof window !== "undefined" ? window : globalThis;
  const Animotion = global.Animotion || (global.Animotion = {});
  const ROTATION_STEP_DEGREES = 90;
  const COPY_OFFSET_PX = 16;

  function copySelectedPart() {
    return copyPart(selectedPart());
  }

  function flipSelectedPartHorizontal() {
    return updateSelectedTransform((transform) => ({ ...transform, scaleX: -safeScale(transform.scaleX) }));
  }

  function rotateSelectedPartClockwise(degrees = ROTATION_STEP_DEGREES) {
    return rotateSelectedPartBy(degrees);
  }

  function rotateSelectedPartCounterClockwise(degrees = ROTATION_STEP_DEGREES) {
    return rotateSelectedPartBy(-degrees);
  }

  function rotateSelectedPartBy(degrees) {
    const angle = Number(degrees);
    if (!Number.isFinite(angle)) return null;
    return rotateSelectedPart(angle);
  }

  function rotateSelectedPart(degrees) {
    return updateSelectedTransform((transform) => ({ ...transform, rotation: normalizeAngle(transform.rotation + degrees) }));
  }

  function copyPart(partOrId) {
    const source = findPart(partOrId);
    if (!source) return null;
    const before = historySnapshot();
    const copy = duplicatePart(source);
    Animotion.state.parts.push(copy);
    Animotion.state.selectedPartId = copy.id;
    syncProjectParts();
    recordHistory("copy-part", before, historySnapshot());
    return copy;
  }

  function updateSelectedTransform(updater) {
    const part = selectedPart();
    if (!part) return null;
    const transform = normalizeTransform(part.transform);
    return Animotion.partCommands.updatePart(part, { transform: updater(transform) });
  }

  function duplicatePart(source) {
    const copy = clonePart(source);
    copy.id = crypto.randomUUID();
    copy.name = uniqueCopyName(source.name);
    copy.order = nextOrder();
    copy.layerIndex = copy.order;
    copy.transform = offsetTransform(copy.transform);
    Animotion.parts?.updatePartCanvas?.(copy);
    return copy;
  }

  function clonePart(source) {
    const { canvas, ...data } = source;
    return clone(data);
  }

  function offsetTransform(transform) {
    const next = normalizeTransform(transform);
    return {
      ...next,
      x: next.x + COPY_OFFSET_PX,
      y: next.y + COPY_OFFSET_PX,
    };
  }

  function normalizeTransform(transform = {}) {
    return {
      x: numberOrDefault(transform.x, 0),
      y: numberOrDefault(transform.y, 0),
      rotation: numberOrDefault(transform.rotation, 0),
      scaleX: numberOrDefault(transform.scaleX, 1),
      scaleY: numberOrDefault(transform.scaleY, 1),
    };
  }

  function safeScale(value) {
    const scale = numberOrDefault(value, 1);
    return Math.abs(scale) < 0.001 ? 1 : scale;
  }

  function normalizeAngle(value) {
    const angle = numberOrDefault(value, 0) % 360;
    return Object.is(angle, -0) ? 0 : angle;
  }

  function uniqueCopyName(name) {
    const base = `${name || "part"} copy`;
    const names = new Set((Animotion.state.parts || []).map((part) => part.name));
    if (!names.has(base)) return base;
    for (let index = 2; index < 1000; index += 1) {
      const candidate = `${base} ${index}`;
      if (!names.has(candidate)) return candidate;
    }
    return `${base} ${Date.now()}`;
  }

  function nextOrder() {
    return Math.max(0, ...(Animotion.state.parts || []).map((part) => Number(part.order) || 0)) + 1;
  }

  function selectedPart() {
    return Animotion.parts?.selectedPart?.()
      || findPart(Animotion.state?.selectedPartId)
      || null;
  }

  function findPart(partOrId) {
    const id = typeof partOrId === "string" ? partOrId : partOrId?.id;
    return (Animotion.state.parts || []).find((part) => part.id === id) || null;
  }

  function historySnapshot() {
    return Animotion.partCommands?.historySnapshot?.() || fallbackSnapshot();
  }

  function fallbackSnapshot() {
    return {
      selectedPartId: Animotion.state?.selectedPartId || null,
      parts: (Animotion.state?.parts || []).map(clonePart),
    };
  }

  function recordHistory(label, before, after) {
    if (Animotion.partCommands?.recordHistorySnapshot) {
      return Animotion.partCommands.recordHistorySnapshot(label, before, after);
    }
    return Animotion.commandHistory?.record?.({
      label,
      undo: () => restoreFallbackSnapshot(before),
      redo: () => restoreFallbackSnapshot(after),
    });
  }

  function restoreFallbackSnapshot(snapshot) {
    Animotion.state.parts = (snapshot?.parts || []).map((part) => {
      const restored = clone(part);
      Animotion.parts?.updatePartCanvas?.(restored);
      return restored;
    });
    Animotion.state.selectedPartId = snapshot?.selectedPartId || null;
    syncProjectParts();
  }

  function syncProjectParts() {
    if (Animotion.state.project) Animotion.state.project.parts = Animotion.state.parts;
  }

  function numberOrDefault(value, fallback) {
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
  }

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  Object.assign(Animotion.partCommands, {
    copyPart,
    copySelectedPart,
    flipSelectedPartHorizontal,
    rotateSelectedPartBy,
    rotateSelectedPartClockwise,
    rotateSelectedPartCounterClockwise,
  });
}
