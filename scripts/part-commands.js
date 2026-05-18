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
    state.selectedPartId = part.id;
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
    const oldPivot = absolutePoint(part.rect, part.pivot);
    const oldJoint = absolutePoint(part.rect, part.joint);
    part.rect = rect;
    part.sourceRect = rect;
    part.mask = geometry.shapeToMask(normalized, rect);
    part.pivot = clampedLocalPoint(oldPivot, rect);
    part.joint = clampedLocalPoint(oldJoint, rect);
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

  function deletePart(partOrId) {
    const part = findPart(partOrId);
    if (!part) return null;
    state.parts = state.parts
      .filter((candidate) => candidate.id !== part.id)
      .map((candidate) => candidate.parentId === part.id ? { ...candidate, parentId: null } : candidate);
    state.selectedPartId = state.parts[0]?.id || null;
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
    if (hasOwn(next, "customMotion")) next.customMotion = Animotion.motionModel.normalizeCustomMotion(next.customMotion);
    Object.assign(next, Animotion.rigConnection?.metadataForPart?.({ ...part, ...next }, findPart(next.parentId ?? part.parentId)) || {});
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
    while (current?.parentId) {
      if (current.parentId === partId) return null;
      current = findPart(current.parentId);
    }
    return parentId;
  }

  function findPart(partOrId) {
    const id = typeof partOrId === "string" ? partOrId : partOrId?.id;
    return state.parts.find((part) => part.id === id) || null;
  }

  function absolutePoint(rect, point) {
    return { x: rect.x + point.x, y: rect.y + point.y };
  }

  function clampedLocalPoint(point, rect) {
    return {
      x: geometry.clamp(point.x - rect.x, 0, rect.w),
      y: geometry.clamp(point.y - rect.y, 0, rect.h),
    };
  }

  function syncProjectParts() {
    if (state.project) state.project.parts = state.parts;
  }

  Animotion.partCommands = {
    createPartFromShape,
    createPart,
    applyShapeToPart,
    updatePart,
    updateSelectedPart,
    updateSelectedPartMotion,
    resetSelectedPartMotion,
    deletePart,
    deleteSelectedPart,
  };
}
