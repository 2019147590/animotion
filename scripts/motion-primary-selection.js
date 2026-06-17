{
  const global = typeof window !== "undefined" ? window : globalThis;
  const Animotion = global.Animotion || (global.Animotion = {});

  function runtimePrimaryId(parts = [], bridge = {}, selectedPartId = null, options = {}) {
    const action = bridge?.jointAction || {};
    const template = options.template || actionTemplate(action) || "punch";
    const selected = selectedPrimary(parts, selectedPartId, template);
    const savedId = bridge?.primaryPartId || action.targetDebug?.primaryPartId || null;
    if (selected && !samePartReference(savedId, selectedPartId, selected.id, parts)) return selected.id;
    return savedId || selected?.id || null;
  }

  function selectedPrimary(parts = [], selectedPartId = null, template = "punch") {
    const selected = parts.find((part) => part.id === selectedPartId) || null;
    if (!selected || !isPunchTemplate(template)) return selected;
    const resolved = Animotion.armChainResolver?.resolve?.(parts, selected);
    if (resolved?.terminalPart) return resolved.terminalPart;
    return terminalPunchPart(selected, parts) || selected;
  }

  function samePartReference(previousPartId, selectedPartId, primaryPartId, parts = []) {
    if (Animotion.armChainResolver?.sameChainReference?.(previousPartId, selectedPartId, primaryPartId, parts)) return true;
    if (!previousPartId) return false;
    if (previousPartId === primaryPartId || previousPartId === selectedPartId) return true;
    const primary = parts.find((part) => part.id === primaryPartId);
    const previous = parts.find((part) => part.id === previousPartId);
    if (primary && isDescendantOf(primary, previousPartId, parts)) return true;
    const previousSuffix = numberedSuffix(previous);
    return Boolean(primary && previousSuffix && previousSuffix === numberedSuffix(primary));
  }

  function actionTemplate(action = {}) {
    const template = Animotion.cutsceneActionSelectors?.actionTemplate?.(action);
    return isPunchTemplate(template) || template === "kick" ? template : null;
  }

  function terminalPunchPart(part, parts) {
    if (partKind(part) === "hand") return part;
    return descendantHand(part, parts) || numberedHand(part, parts);
  }

  function descendantHand(part, parts) {
    return parts.find((candidate) => candidate.id !== part.id && partKind(candidate) === "hand" && isDescendantOf(candidate, part.id, parts)) || null;
  }

  function numberedHand(part, parts) {
    const suffix = numberedSuffix(part);
    return suffix ? parts.find((candidate) => partKind(candidate) === "hand" && numberedSuffix(candidate) === suffix) || null : null;
  }

  function isDescendantOf(part, ancestorId, parts) {
    let current = part;
    const seen = new Set();
    while (parentIdFor(current)) {
      const parentId = parentIdFor(current);
      if (parentId === ancestorId) return true;
      if (seen.has(parentId)) return false;
      seen.add(parentId);
      current = parts.find((candidate) => candidate.id === parentId);
      if (!current) return false;
    }
    return false;
  }

  function partKind(part = {}) {
    return Animotion.armChainResolver?.roleFor?.(part) || part.humanRole || part.type || "";
  }

  function parentIdFor(part = {}) {
    return Animotion.rigConnection?.parentIdFor?.(part) || part.parentId || part.parentPartId || null;
  }

  function numberedSuffix(part) {
    return String(`${part?.id || ""} ${part?.name || ""}`).match(/(?:^|[^0-9])([0-9]+)(?!.*[0-9])/)?.[1] || null;
  }

  function isPunchTemplate(template) {
    return Animotion.actionSpecs?.isPunchLike?.(template) || template === "punch";
  }

  Animotion.motionPrimarySelection = { runtimePrimaryId, selectedPrimary, samePartReference, actionTemplate };
  if (typeof module !== "undefined") module.exports = Animotion.motionPrimarySelection;
}
