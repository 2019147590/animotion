{
  const global = typeof window !== "undefined" ? window : globalThis;
  const Animotion = global.Animotion || (global.Animotion = {});
  const state = Animotion.state;

  function addSelectedPartToMergeSet() {
    const part = selectedPart();
    if (!part) return result(false, "select a part first");
    const ids = mergeSet();
    if (!ids.includes(part.id)) ids.push(part.id);
    state.partStructureSelection = ids;
    return result(true, "part added", { selectedIds: ids });
  }

  function clearMergeSet() {
    state.partStructureSelection = [];
    return result(true, "merge set cleared", { selectedIds: [] });
  }

  function extractSelectionToPart(shape = state.selection, options = {}) {
    const source = selectedPart();
    if (!state.image) return result(false, "load an image first");
    if (!source) return result(false, "select a source part first");
    const normalized = readyShape(shape);
    if (!normalized) return result(false, "draw and close a polygon area first");
    const before = historySnapshot();
    const extracted = partFromShape(source, normalized, {
      id: uuid(),
      name: uniqueName(`${source.name || source.type} split`),
      order: nextOrder(),
      splitFromPartId: source.id,
      originalSourcePartId: source.originalSourcePartId || source.id,
      splitMethod: "manual-polygon",
      parentId: parentIdFor(source),
      parentPartId: parentIdFor(source),
      ...armSplitMetadata(source),
    });
    state.parts.push(extracted);
    state.selectedPartId = extracted.id;
    syncProjectParts();
    recordHistory("extract-part-selection", before, historySnapshot(), options);
    return result(true, "selection extracted", { part: extracted });
  }

  function mergeSelectionWithShape(shape = state.selection, options = {}) {
    if (!state.image) return result(false, "load an image first");
    const parts = selectedMergeParts();
    if (parts.length < 2) return result(false, "add at least two parts to the merge set");
    const normalized = readyShape(shape);
    if (!normalized) return result(false, "draw and close the merged polygon outline first");
    const before = historySnapshot();
    const merged = mergedPartFromShape(parts, normalized);
    const mergedIds = new Set(parts.map((part) => part.id));
    state.parts = state.parts
      .filter((part) => !mergedIds.has(part.id))
      .map((part) => reparentIfNeeded(part, mergedIds, merged.id));
    state.parts.push(merged);
    state.partStructureSelection = [];
    state.selectedPartId = merged.id;
    syncProjectParts();
    recordHistory("merge-parts-selection", before, historySnapshot(), options);
    return result(true, "parts merged", { part: merged });
  }

  function selectedMergeParts() {
    const ids = new Set(mergeSet());
    return state.parts.filter((part) => ids.has(part.id));
  }

  function mergeSet() {
    const valid = new Set((state.parts || []).map((part) => part.id));
    return (state.partStructureSelection || []).filter((id) => valid.has(id));
  }

  function mergedPartFromShape(parts, shape) {
    const base = parts.find((part) => part.id === state.selectedPartId) || parts[0];
    const parentId = commonParentId(parts);
    const merged = partFromShape(base, shape, {
      id: uuid(),
      name: uniqueName(`${base.name || base.type} merged`),
      order: Math.min(...parts.map((part) => Number(part.order) || 1)),
      parentId,
      parentPartId: parentId,
      transform: commonTransform(parts),
    });
    merged.visibilityMasks = mergedVisibilityMasks(parts, merged);
    clearSplitMetadata(merged);
    return merged;
  }

  function partFromShape(source, shape, patch) {
    const rect = Animotion.geometry.pointsBounds(shape.points, Animotion.imageBounds());
    const mask = Animotion.geometry.shapeToMask(shape, rect);
    const part = {
      ...cloneWithoutCanvas(source),
      ...patch,
      rect,
      sourceRect: rect,
      mask,
      pivot: localFromImagePoint(rect, imagePoint(source.rect, source.pivot)),
      joint: localFromImagePoint(rect, imagePoint(source.rect, source.joint)),
      layerIndex: patch.order,
      hidden: false,
      visible: true,
    };
    if (source.handTip) part.handTip = localFromImagePoint(rect, imagePoint(source.rect, source.handTip));
    Animotion.parts?.updatePartCanvas?.(part);
    return part;
  }

  function readyShape(shape) {
    if (!shape || !Animotion.geometry.shapeIsReady(shape, Animotion.imageBounds(), Animotion.config.minShapeSize)) return null;
    return Animotion.geometry.normalizeShape(shape, Animotion.imageBounds());
  }

  function reparentIfNeeded(part, mergedIds, mergedId) {
    const parentId = parentIdFor(part);
    if (!mergedIds.has(parentId)) return part;
    return { ...part, parentId: mergedId, parentPartId: mergedId };
  }

  function commonParentId(parts) {
    const mergedIds = new Set(parts.map((part) => part.id));
    const parents = parts.map(parentIdFor).filter((id) => id && !mergedIds.has(id));
    if (!parents.length) return null;
    return parents.every((id) => id === parents[0]) ? parents[0] : null;
  }

  function commonTransform(parts) {
    const first = JSON.stringify(parts[0]?.transform || {});
    return parts.every((part) => JSON.stringify(part.transform || {}) === first)
      ? clone(parts[0].transform || {})
      : { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 };
  }

  function mergedVisibilityMasks(parts, merged) {
    return parts.flatMap((part) => {
      const masks = Animotion.partVisibilityMasks?.normalizeList?.(part.visibilityMasks) || [];
      return masks.map((mask) => movedVisibilityMask(part, mask, merged));
    });
  }

  function movedVisibilityMask(source, mask, target) {
    const imagePoints = Animotion.partTransformGeometry?.partLocalPointsToImage?.(source, mask.mask.points, state.parts)
      || mask.mask.points.map((point) => imagePoint(source.rect, point));
    const targetPoints = Animotion.partTransformGeometry?.imagePointsToPartLocal?.(target, imagePoints, [...state.parts, target])
      || imagePoints.map((point) => localFromImagePoint(target.rect, point));
    return {
      ...mask,
      id: uuid(),
      name: `${source.name || source.id} ${mask.name || "visibility mask"}`,
      mask: { ...mask.mask, points: targetPoints },
    };
  }

  function armSplitMetadata(part = {}) {
    const kind = `${part.type || ""} ${part.humanRole || ""}`;
    return /arm|hand|glove|upperArm|forearm/.test(kind)
      ? { sourceArmOnlyPartId: part.sourceArmOnlyPartId || part.id }
      : {};
  }

  function clearSplitMetadata(part) {
    delete part.splitFromPartId;
    delete part.originalSourcePartId;
    delete part.splitMethod;
    delete part.sourceArmOnlyPartId;
  }

  function parentIdFor(part = {}) {
    return Animotion.rigConnection?.parentIdFor?.(part) || part.parentId || part.parentPartId || null;
  }

  function selectedPart() {
    return Animotion.parts?.selectedPart?.() || state.parts.find((part) => part.id === state.selectedPartId) || null;
  }

  function imagePoint(rect, point) {
    return { x: rect.x + point.x, y: rect.y + point.y };
  }

  function localFromImagePoint(rect, point) {
    return { x: point.x - rect.x, y: point.y - rect.y };
  }

  function nextOrder() {
    return Math.max(0, ...state.parts.map((part) => Number(part.order) || 0)) + 1;
  }

  function uniqueName(base) {
    const names = new Set(state.parts.map((part) => part.name));
    if (!names.has(base)) return base;
    for (let index = 2; index < 1000; index += 1) {
      const candidate = `${base} ${index}`;
      if (!names.has(candidate)) return candidate;
    }
    return `${base} ${Date.now()}`;
  }

  function cloneWithoutCanvas(part) {
    const { canvas, ...data } = part;
    return clone(data);
  }

  function historySnapshot() {
    return Animotion.partCommands?.historySnapshot?.() || { selectedPartId: state.selectedPartId || null, parts: state.parts.map(cloneWithoutCanvas) };
  }

  function recordHistory(label, before, after, options) {
    return Animotion.partCommands?.recordHistorySnapshot?.(label, before, after, options);
  }

  function syncProjectParts() {
    if (state.project) state.project.parts = state.parts;
  }

  function uuid() {
    return crypto.randomUUID();
  }

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function result(ok, message, extra = {}) {
    return { ok, message, ...extra };
  }

  Animotion.partStructureCommands = {
    addSelectedPartToMergeSet,
    clearMergeSet,
    extractSelectionToPart,
    mergeSelectionWithShape,
    selectedMergeParts,
    mergeSet,
  };
}
