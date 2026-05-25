{
  const global = typeof window !== "undefined" ? window : globalThis;
  const Animotion = global.Animotion || (global.Animotion = {});
  const state = Animotion.state;

  function createMaskFromSelection(strength = 1) {
    const part = selectedPart();
    if (!part) return response(false, "select a part first");
    if (!readyShape()) return response(false, "draw and close a polygon area first");
    const mask = Animotion.partVisibilityMasks.maskFromShape(part, state.selection, state.currentFrame, strength);
    if (!mask) return response(false, "invalid visibility mask");
    const masks = [...Animotion.partVisibilityMasks.normalizeList(part.visibilityMasks), mask];
    const updated = Animotion.partCommands.updatePart(part, { visibilityMasks: masks });
    state.selectedVisibilityMaskId = mask.id;
    return response(Boolean(updated), "visibility mask added", { mask });
  }

  function setCurrentFrameStrength(strength) {
    const part = selectedPart();
    const mask = selectedMask(part);
    if (!part || !mask) return response(false, "select a visibility mask first");
    const masks = Animotion.partVisibilityMasks.normalizeList(part.visibilityMasks).map((item) =>
      item.id === mask.id ? Animotion.partVisibilityMasks.withKeyframe(item, state.currentFrame, strength) : item
    );
    const updated = Animotion.partCommands.updatePart(part, { visibilityMasks: masks });
    return response(Boolean(updated), "visibility keyframe set", { maskId: mask.id });
  }

  function removeSelectedMask() {
    const part = selectedPart();
    const mask = selectedMask(part);
    if (!part || !mask) return response(false, "select a visibility mask first");
    const masks = Animotion.partVisibilityMasks.normalizeList(part.visibilityMasks).filter((item) => item.id !== mask.id);
    const updated = Animotion.partCommands.updatePart(part, { visibilityMasks: masks });
    state.selectedVisibilityMaskId = masks[0]?.id || null;
    return response(Boolean(updated), "visibility mask removed");
  }

  function selectMask(maskId) {
    const part = selectedPart();
    const masks = Animotion.partVisibilityMasks.normalizeList(part?.visibilityMasks);
    const mask = masks.find((item) => item.id === maskId) || masks[0] || null;
    state.selectedVisibilityMaskId = mask?.id || null;
    return response(Boolean(mask), mask ? "visibility mask selected" : "no visibility mask", { mask });
  }

  function selectedMask(part = selectedPart()) {
    const masks = Animotion.partVisibilityMasks.normalizeList(part?.visibilityMasks);
    return masks.find((item) => item.id === state.selectedVisibilityMaskId) || masks[0] || null;
  }

  function selectedStrength() {
    const mask = selectedMask();
    return mask ? Animotion.partVisibilityMasks.evaluatedStrength(mask, state.currentFrame) : 0;
  }

  function readyShape() {
    return Boolean(state.selection && Animotion.geometry.shapeIsReady(state.selection, Animotion.imageBounds(), Animotion.config.minShapeSize));
  }

  function selectedPart() {
    return Animotion.parts?.selectedPart?.() || state.parts.find((part) => part.id === state.selectedPartId) || null;
  }

  function response(ok, message, extra = {}) {
    return { ok, message, ...extra };
  }

  Animotion.partVisibilityMaskCommands = { createMaskFromSelection, setCurrentFrameStrength, removeSelectedMask, selectMask, selectedMask, selectedStrength };
}
