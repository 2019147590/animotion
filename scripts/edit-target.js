{
  const global = typeof window !== "undefined" ? window : globalThis;
  const Animotion = global.Animotion || (global.Animotion = {});

  function current() {
    const state = Animotion.state || {};
    const target = state.editTarget || partTarget(state.selectedPartId);
    if (target.kind === "visibilityMask") return resolvedMaskTarget(target);
    return setPart(target.partId || state.selectedPartId || null);
  }

  function setPart(partOrId) {
    const state = Animotion.state || {};
    const part = findPart(partOrId);
    const partId = part?.id || null;
    state.selectedPartId = partId;
    state.selectedVisibilityMaskId = null;
    state.selectedVisibilityMaskPartId = null;
    state.editTarget = partTarget(partId);
    return state.editTarget;
  }

  function setVisibilityMask(partOrId, maskId) {
    const state = Animotion.state || {};
    const part = findPart(partOrId);
    const mask = maskForPart(part, maskId);
    if (!part || !mask) return setPart(part || state.selectedPartId || null);
    state.selectedPartId = part.id;
    state.selectedVisibilityMaskId = mask.id;
    state.selectedVisibilityMaskPartId = part.id;
    state.editTarget = { kind: "visibilityMask", partId: part.id, maskId: mask.id };
    return state.editTarget;
  }

  function selectedMask(partOrId = null) {
    const target = current();
    if (target.kind !== "visibilityMask") return null;
    const part = findPart(partOrId || target.partId);
    if (!part || part.id !== target.partId) return null;
    return maskForPart(part, target.maskId);
  }

  function selectedPart() {
    return findPart(current().partId);
  }

  function isPartTarget(partOrId) {
    const part = findPart(partOrId);
    const target = current();
    return Boolean(part && target.kind === "part" && target.partId === part.id);
  }

  function isVisibilityMaskTarget(partOrId, maskId = null) {
    const part = findPart(partOrId);
    const target = current();
    return Boolean(part && target.kind === "visibilityMask" && target.partId === part.id && (!maskId || target.maskId === maskId));
  }

  function partTarget(partId) {
    return { kind: "part", partId: partId || null, maskId: null };
  }

  function resolvedMaskTarget(target) {
    const state = Animotion.state || {};
    const part = findPart(target.partId);
    if (!part || state.selectedPartId !== part.id) return setPart(state.selectedPartId || null);
    const mask = maskForPart(part, target.maskId || state.selectedVisibilityMaskId);
    return mask ? setVisibilityMask(part, mask.id) : setPart(part);
  }

  function findPart(partOrId) {
    const id = typeof partOrId === "string" ? partOrId : partOrId?.id;
    return (Animotion.state?.parts || []).find((part) => part.id === id) || null;
  }

  function maskForPart(part, maskId) {
    const masks = Animotion.partVisibilityMasks?.normalizeList?.(part?.visibilityMasks) || [];
    return masks.find((mask) => mask.id === maskId) || null;
  }

  Animotion.editTarget = {
    current,
    setPart,
    setVisibilityMask,
    selectedMask,
    selectedPart,
    isPartTarget,
    isVisibilityMaskTarget,
  };
}
