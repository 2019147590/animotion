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
    selectMaskTarget(part, mask.id);
    if (updated) state.selection = null;
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
    if (masks[0]) selectMaskTarget(part, masks[0].id);
    else selectPartTarget(part);
    return response(Boolean(updated), "visibility mask removed");
  }

  function selectMask(maskId, partOrId = selectedPart()) {
    const part = typeof partOrId === "string" ? state.parts.find((item) => item.id === partOrId) : partOrId;
    if (part && part.id !== state.selectedPartId) selectPartTarget(part);
    return selectMaskForPart(part, maskId);
  }

  function selectMaskForPart(part, maskId) {
    const masks = Animotion.partVisibilityMasks.normalizeList(part?.visibilityMasks);
    const mask = masks.find((item) => item.id === maskId) || masks[0] || null;
    if (mask) selectMaskTarget(part, mask.id);
    else selectPartTarget(part);
    return response(Boolean(mask), mask ? "visibility mask selected" : "no visibility mask", { mask });
  }

  function selectedMask(part = selectedPart()) {
    if (!part) return null;
    if (!Animotion.editTarget) {
      const masks = Animotion.partVisibilityMasks.normalizeList(part.visibilityMasks);
      return masks.find((item) => item.id === state.selectedVisibilityMaskId) || null;
    }
    const target = Animotion.editTarget?.current?.() || null;
    if (target?.kind !== "visibilityMask" || target.partId !== part.id) return null;
    const masks = Animotion.partVisibilityMasks.normalizeList(part.visibilityMasks);
    return masks.find((item) => item.id === target.maskId) || null;
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

  function selectMaskTarget(part, maskId) {
    if (Animotion.editTarget?.setVisibilityMask) return Animotion.editTarget.setVisibilityMask(part, maskId);
    state.selectedPartId = part?.id || null;
    state.selectedVisibilityMaskId = maskId || null;
    state.selectedVisibilityMaskPartId = part?.id || null;
    state.editTarget = { kind: "visibilityMask", partId: part?.id || null, maskId: maskId || null };
    return state.editTarget;
  }

  function selectPartTarget(part) {
    if (Animotion.editTarget?.setPart) return Animotion.editTarget.setPart(part);
    state.selectedPartId = part?.id || null;
    state.selectedVisibilityMaskId = null;
    state.selectedVisibilityMaskPartId = null;
    state.editTarget = { kind: "part", partId: part?.id || null, maskId: null };
    return state.editTarget;
  }

  function response(ok, message, extra = {}) {
    return { ok, message, ...extra };
  }

  Animotion.partVisibilityMaskCommands = { createMaskFromSelection, setCurrentFrameStrength, removeSelectedMask, selectMask, selectedMask, selectedStrength };
}
