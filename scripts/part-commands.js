{
  const global = window;
  const Animotion = global.Animotion;
  const state = Animotion.state;
  const geometry = Animotion.geometry;

  function createPartFromShape(type, shape, name = "") {
    const normalized = geometry.normalizeShape(shape, Animotion.imageBounds());
    const rect = geometry.pointsBounds(normalized.points, Animotion.imageBounds());
    const mask = geometry.shapeToMask(normalized, rect);
    const count = state.parts.filter((part) => part.type === type).length + 1;
    const parent = suggestedParentPart(type);
    const connection = Animotion.rigConnection?.metadataForPart?.({ type, rect, name }, parent) || {};
    const part = editorPartFromProject({
      id: crypto.randomUUID(),
      name: name || `${type}_${String(count).padStart(2, "0")}`,
      type,
      sourceRect: rect,
      mask,
      pivot: Animotion.rigging.defaultPivotForPart(type, rect, parent?.rect || null),
      joint: Animotion.rigging.defaultJointForPart(type, rect, parent?.rect || null),
      ...(type === "arm" ? { handTip: Animotion.rigging.defaultHandTipForPart(type, rect, parent?.rect || null) } : {}),
      parentId: parent?.id || null,
      parentPartId: parent?.id || null,
      attachPointSelf: connection.attachPointSelf,
      attachPointParent: connection.attachPointParent,
      followStrength: connection.followStrength,
      layerIndex: state.parts.length + 1,
      opacity: 1,
      visible: true,
      motionSettings: Animotion.motionModel.defaultCustomMotion(),
    });
    Animotion.parts.updatePartCanvas(part);
    state.parts.push(part);
    selectPart(part);
    syncProjectParts();
    return part;
  }

  function createPart(type, rect, name = "") {
    return createPartFromShape(type, geometry.rectShape(rect), name);
  }

  function applyShapeToPart(partOrId, shape) {
    const part = findPart(partOrId);
    if (!part) return null;
    const normalized = geometry.normalizeShape(shape, Animotion.imageBounds());
    const rect = geometry.pointsBounds(normalized.points, Animotion.imageBounds());
    if (rect.w < Animotion.config.minShapeSize || rect.h < Animotion.config.minShapeSize) return part;
    const rigPoints = Animotion.partShapeRigLink?.rebasedRigPoints?.(part, state.parts, rect) || {
      pivot: localPointFromAbsolute(absolutePoint(part.rect, part.pivot), rect),
      joint: localPointFromAbsolute(absolutePoint(part.rect, part.joint), rect),
      ...(part.handTip ? { handTip: localPointFromAbsolute(absolutePoint(part.rect, part.handTip), rect) } : {}),
    };
    const visibilityMasks = rebaseVisibilityMasks(part.visibilityMasks, part.rect, rect);
    part.rect = rect;
    part.sourceRect = rect;
    part.mask = geometry.shapeToMask(normalized, rect);
    Object.assign(part, rigPoints);
    if (visibilityMasks) part.visibilityMasks = visibilityMasks;
    Animotion.parts.updatePartCanvas(part);
    syncProjectParts();
    return part;
  }

  function updatePart(partOrId, patch = {}, options = {}) {
    const part = findPart(partOrId);
    if (!part) return null;
    const next = normalizedPatch(part, patch);
    const change = partChange(part, next);
    if (!Object.keys(change.after).length) return part;
    Object.assign(part, change.after);
    syncProjectParts();
    recordPartUpdate(part.id, change, options);
    Animotion.motionCommands?.regenerateForRigChange?.(part.id, change, options);
    return part;
  }

  function updateSelectedPart(patch) {
    return updatePart(Animotion.parts.selectedPart(), patch);
  }

  function updateSelectedPartMotion(key, value) {
    const part = Animotion.parts.selectedPart();
    if (!part) return null;
    const customMotion = Animotion.motionModel.normalizeCustomMotion(part.customMotion);
    customMotion[key] = Number(value);
    return updatePart(part, { customMotion });
  }

  function resetSelectedPartMotion() {
    return updateSelectedPart({ customMotion: Animotion.motionModel.defaultCustomMotion() });
  }

  function autoPlaceSelectedArmHandles() {
    return autoPlaceArmHandles(Animotion.parts.selectedPart());
  }

  function transformSupplementalPart(partOrId, patch = {}) {
    const part = findPart(partOrId);
    if (!part?.isSupplementalPart) return null;
    return updatePart(part, Animotion.partSupplementalTransform.patchForTransform(part, patch));
  }

  function transformSelectedSupplementalPart(patch) {
    return transformSupplementalPart(Animotion.parts.selectedPart(), patch);
  }

  function autoPlaceArmHandles(partOrId) {
    const part = findPart(partOrId);
    const plan = Animotion.armHandleAutoPlace?.preview?.(state.parts, part?.id);
    if (!part || !plan?.ok || !plan.patches.length) {
      state.armHandleAutoPlaceStatus = { partId: part?.id || null, text: Animotion.armHandleAutoPlace?.statusText?.(plan) || "Auto place arm handles: unavailable" };
      return null;
    }
    const before = collectPatchState(plan.patches);
    for (const item of plan.patches) updatePart(item.partId, item.patch, { recordHistory: false });
    const after = collectPatchState(plan.patches);
    const resolved = Animotion.armChainResolver?.resolve?.(state.parts, part.id) || null;
    state.armHandleAutoPlaceStatus = { partId: part.id, text: Animotion.armHandleAutoPlace.statusText({ ...plan, after: resolved }) };
    Animotion.commandHistory?.record?.({
      label: "auto-place-arm-handles",
      undo: () => applyPatchState(before),
      redo: () => applyPatchState(after),
    });
    return { ...plan, before, after, resolved };
  }

  function deletePart(partOrId) {
    const part = findPart(partOrId);
    if (!part) return null;
    state.parts = state.parts
      .filter((candidate) => candidate.id !== part.id)
      .map((candidate) => parentIdFor(candidate) === part.id ? { ...candidate, parentId: null, parentPartId: null } : candidate);
    selectPart(state.parts[0] || null);
    syncProjectParts();
    return part;
  }

  function deleteSelectedPart() {
    return deletePart(Animotion.parts.selectedPart());
  }

  function partChange(part, patch) {
    const before = {};
    const after = {};
    for (const [key, value] of Object.entries(patch)) {
      if (sameValue(part[key], value)) continue;
      before[key] = cloneValue(part[key]);
      after[key] = cloneValue(value);
    }
    return { before, after };
  }

  function recordPartUpdate(partId, change, options) {
    if (options.recordHistory === false) return;
    Animotion.commandHistory?.record?.({
      label: "update-part",
      undo: () => updatePart(partId, change.before, { recordHistory: false }),
      redo: () => updatePart(partId, change.after, { recordHistory: false }),
    });
  }

  function collectPatchState(items = []) {
    return items.map((item) => {
      const part = findPart(item.partId);
      return { partId: item.partId, patch: pickHandles(part) };
    });
  }

  function applyPatchState(items = []) {
    for (const item of items) updatePart(item.partId, item.patch, { recordHistory: false });
  }

  function pickHandles(part = {}) {
    return {
      pivot: cloneValue(part.pivot),
      joint: cloneValue(part.joint),
      ...(part.handTip ? { handTip: cloneValue(part.handTip) } : { handTip: undefined }),
    };
  }

  function suggestedParentPart(type) {
    const parentId = suggestParent(type);
    return state.parts.find((part) => part.id === parentId) || null;
  }

  function suggestParent(type) {
    if (type === "eye" || type === "mouth" || type === "hair") return firstPartId("head");
    if (type === "spine") return firstPartId("body");
    if (type === "arm" || type === "leg" || type === "head") return firstPartId("spine") || firstPartId("body");
    return null;
  }

  function firstPartId(type) {
    return state.parts.find((part) => part.type === type)?.id || null;
  }

  function editorPartFromProject(part) {
    const projectPart = Animotion.projectModel.normalizeProjectPart(part, state.parts.length);
    return Animotion.projectModel.editorPartsFromProject({ parts: [projectPart], motions: [] })[0];
  }

  function normalizedPatch(part, patch) {
    const next = { ...patch };
    if (hasOwn(next, "parentId")) next.parentId = validParentId(part.id, next.parentId);
    if (hasOwn(next, "parentPartId")) next.parentId = validParentId(part.id, next.parentPartId);
    if (hasOwn(next, "parentId")) next.parentPartId = next.parentId;
    if (hasOwn(next, "pivot")) next.rotationPivot = next.pivot;
    if (hasOwn(next, "order")) next.order = Math.max(1, Math.round(Number(next.order) || part.order));
    if (hasOwn(next, "alpha")) next.alpha = geometry.clamp(Number(next.alpha) || 0, 0, 1);
    if (hasOwn(next, "hidden")) next.hidden = Boolean(next.hidden);
    if (hasOwn(next, "humanRole")) next.humanRole = Animotion.humanRigSchema?.normalizeRole?.(next.humanRole) || null;
    if (hasOwn(next, "visibilityMasks")) next.visibilityMasks = Animotion.partVisibilityMasks?.normalizeList?.(next.visibilityMasks) || [];
    if (hasOwn(next, "customMotion")) next.customMotion = Animotion.motionModel.normalizeCustomMotion(next.customMotion);
    if (hasOwn(next, "supplementalMaskScale")) next.supplementalMaskScale = Math.min(1.5, Math.max(0.5, Number(next.supplementalMaskScale) || 1));
    Object.assign(next, Animotion.rigConnection?.metadataForPart?.({ ...part, ...next }, findPart(parentIdFor({ ...part, ...next }))) || {});
    return next;
  }

  function hasOwn(value, key) {
    return Object.prototype.hasOwnProperty.call(value, key);
  }

  function sameValue(left, right) {
    return JSON.stringify(left) === JSON.stringify(right);
  }

  function cloneValue(value) {
    if (value === undefined || value === null) return value;
    return JSON.parse(JSON.stringify(value));
  }

  function validParentId(partId, parentId) {
    if (!parentId || parentId === partId) return null;
    let current = findPart(parentId);
    while (parentIdFor(current)) {
      const currentParentId = parentIdFor(current);
      if (currentParentId === partId) return null;
      current = findPart(currentParentId);
    }
    return parentId;
  }

  function parentIdFor(part) {
    return Animotion.rigConnection?.parentIdFor?.(part) || part?.parentId || part?.parentPartId || null;
  }

  function findPart(partOrId) {
    const id = typeof partOrId === "string" ? partOrId : partOrId?.id;
    return state.parts.find((part) => part.id === id) || null;
  }

  function absolutePoint(rect, point) {
    return { x: rect.x + point.x, y: rect.y + point.y };
  }

  function localPointFromAbsolute(point, rect) {
    return { x: point.x - rect.x, y: point.y - rect.y };
  }

  function rebaseVisibilityMasks(masks, fromRect, toRect) {
    const normalized = Animotion.partVisibilityMasks?.normalizeList?.(masks) || [];
    if (!normalized.length) return null;
    return normalized.map((mask) => ({
      ...mask,
      mask: {
        ...mask.mask,
        points: mask.mask.points.map((point) =>
          localPointFromAbsolute(absolutePoint(fromRect, point), toRect)
        ),
      },
    }));
  }

  function syncProjectParts() {
    if (state.project) state.project.parts = state.parts;
  }

  function selectPart(part) {
    if (Animotion.editTarget?.setPart) Animotion.editTarget.setPart(part);
    else state.selectedPartId = part?.id || null;
  }

  Animotion.partCommands = {
    createPartFromShape,
    createPart,
    applyShapeToPart,
    updatePart,
    updateSelectedPart,
    updateSelectedPartMotion,
    resetSelectedPartMotion,
    transformSelectedSupplementalPart,
    transformSupplementalPart,
    autoPlaceSelectedArmHandles,
    autoPlaceArmHandles,
    deletePart,
    deleteSelectedPart,
  };
}
