{
  const global = typeof window !== "undefined" ? window : globalThis;
  const Animotion = global.Animotion || (global.Animotion = {});
  const KIND = "hiddenCompletionSymmetry";

  function payloadFromPatch(asset, parts = [], options = {}) {
    const patch = Animotion.hiddenCompletionAssets?.normalizeAsset?.(asset) || asset;
    const valid = validatePatch(patch);
    if (!valid.ok) return valid;
    const source = parts.find((part) => part.id === patch.sourcePartId) || null;
    const counterpart = parts.find((part) => part.id === patch.symmetrySource?.counterpartPartId) || null;
    if (!source) return warning("source part not found for supplemental hidden-completion part");
    const geometry = geometryForPatch(patch, source, { imageBounds: options.imageBounds, parts, counterpart });
    const rect = geometry.rect;
    const mask = geometry.mask;
    if (!mask?.points?.length) return warning("hidden-completion patch has no guide silhouette to convert");
    const part = {
      id: uniquePartId(options.id || `supp-${patch.id}`, parts),
      name: options.name || `${source.name || source.id} 보완 파츠`,
      type: source.type || "prop",
      humanRole: source.humanRole || null,
      rect,
      sourceRect: rect,
      mask,
      pivot: clonePoint(source.pivot) || centerPoint(rect),
      joint: clonePoint(source.joint) || centerPoint(rect),
      parentId: suggestedParentId(source, patch),
      parentPartId: suggestedParentId(source, patch),
      layerIndex: layerNear(source),
      order: layerNear(source),
      opacity: 1,
      alpha: 1,
      visible: true,
      hidden: false,
      customMotion: Animotion.motionModel?.defaultCustomMotion?.() || {},
      keyframes: [],
      isSupplementalPart: true,
      supplementalKind: KIND,
      completionMethod: "symmetry",
      sourcePatchAssetId: patch.id,
      sourcePartId: patch.sourcePartId,
      counterpartPartId: patch.symmetrySource?.counterpartPartId || null,
      targetRegion: patch.symmetrySource?.targetRegion || null,
      sourceRegion: patch.symmetrySource?.sourceRegion || null,
      createdForActionId: options.actionId || null,
      createdFromJointActionId: options.actionId || null,
      originalPatchAssetType: "hiddenCompletionPatch",
      supplementalMaskScale: 1,
    };
    const warnings = [];
    if (!part.parentId) warnings.push("supplemental part parent could not be inferred");
    if (options.preserveCanvas) part.canvas = options.canvas || null;
    else {
      part.canvas = canvasForPatch(patch, part, counterpart, source, options);
      if (!part.canvas) warnings.push("supplemental part canvas could not be generated from counterpart");
    }
    part.supplementalCoverage = coverageForPart(part);
    warnings.push(...part.supplementalCoverage.warnings);
    return { ok: true, part, warnings };
  }

  function insertForSelectedLinkedPatch(state = Animotion.state) {
    const linked = activeLinkedSymmetryPatch(state);
    if (!linked.ok) return linked;
    const existing = existingPartForPatch(state.parts, linked.asset.id);
    if (existing) {
      state.selectedPartId = existing.id;
      syncPartForPatch(linked.asset, state, { regenerateCanvas: true });
      return { ok: true, part: existing, duplicate: true, warning: "supplemental part already exists for this patch" };
    }
    const actionId = actionIdentity(linked.action);
    const result = payloadFromPatch(linked.asset, state.parts, { imageBounds: imageBounds(), actionId });
    if (!result.ok) return result;
    insertPart(result.part, { recordHistory: true });
    return result;
  }

  function insertAllLinkedPatches(state = Animotion.state) {
    const linked = linkedSymmetryPatchesForAction(state);
    if (!linked.length) return warning("active action has no ready symmetry hidden-completion patches");
    const before = Animotion.partCommands?.historySnapshot?.();
    const inserted = [];
    const existing = [];
    const warnings = [];
    for (const item of linked) {
      const duplicate = existingPartForPatch(state.parts, item.asset.id);
      if (duplicate) {
        existing.push(duplicate);
        continue;
      }
      const result = payloadFromPatch(item.asset, state.parts, { imageBounds: imageBounds(), actionId: actionIdentity(item.action) });
      if (!result.ok) {
        warnings.push(result.warning);
        continue;
      }
      insertPart(result.part, { recordHistory: false, preserveSelection: true });
      inserted.push(result.part);
    }
    if (inserted.length) {
      state.selectedPartId = inserted[inserted.length - 1].id;
      Animotion.partCommands?.recordHistorySnapshot?.("create-all-supplemental-parts", before, Animotion.partCommands?.historySnapshot?.(), { recordHistory: true });
    } else if (existing.length) {
      state.selectedPartId = existing[existing.length - 1].id;
    }
    return { ok: true, inserted, existing, warnings };
  }

  function syncPartForPatch(asset, state = Animotion.state, options = {}) {
    const patch = Animotion.hiddenCompletionAssets?.normalizeAsset?.(asset) || asset;
    const existing = existingPartForPatch(state.parts, patch?.id);
    if (!existing) return null;
    const preserveCanvas = options.regenerateCanvas !== true;
    const result = payloadFromPatch(patch, state.parts, { imageBounds: imageBounds(), id: existing.id, name: existing.name, preserveCanvas, canvas: preserveCanvas ? existing.canvas : null });
    if (!result.ok) return result;
    const next = result.part;
    const absolute = absoluteRigPoints(existing);
    Object.assign(existing, {
      rect: next.rect,
      sourceRect: next.sourceRect,
      mask: next.mask,
      canvas: preserveCanvas ? existing.canvas : next.canvas,
      pivot: localPointFromAbsolute(absolute.pivot, next.rect),
      joint: localPointFromAbsolute(absolute.joint, next.rect),
      ...(existing.handTip ? { handTip: localPointFromAbsolute(absolute.handTip, next.rect) } : {}),
      sourcePartId: next.sourcePartId,
      counterpartPartId: next.counterpartPartId,
      targetRegion: next.targetRegion,
      sourceRegion: next.sourceRegion,
      supplementalMaskScale: 1,
    });
    existing.supplementalCoverage = coverageForPart(existing);
    if (state.project) state.project.parts = state.parts;
    return { ok: true, part: existing, patch: next };
  }

  function regenerateCanvasForPart(part, parts = Animotion.state?.parts || [], options = {}) {
    if (!part?.isSupplementalPart || !part.sourcePatchAssetId) return warning("part is not a linked supplemental part");
    const patch = Animotion.hiddenCompletionAssets?.findById?.(options.assets || assets(Animotion.state), part.sourcePatchAssetId);
    if (!patch) return warning("linked hidden-completion patch asset not found");
    const source = parts.find((candidate) => candidate.id === patch.sourcePartId) || null;
    const counterpart = parts.find((candidate) => candidate.id === patch.symmetrySource?.counterpartPartId) || null;
    if (!source) return warning("source part not found for supplemental hidden-completion part");
    const canvas = canvasForPatch(patch, part, counterpart, source, { ...options, imageBounds: options.imageBounds || imageBounds() });
    if (!canvas) return warning("supplemental part canvas could not be regenerated");
    part.canvas = canvas; part.supplementalCoverage = coverageForPart(part); return { ok: true, part, patch };
  }

  function hasVisiblePartForPatch(parts = [], assetId, options = {}) {
    const actionId = options.actionId || actionIdentity(options.action);
    return Boolean(parts.find((part) => (
      part.isSupplementalPart === true &&
      part.sourcePatchAssetId === assetId &&
      part.hidden !== true &&
      actionMatches(part, actionId)
    )));
  }

  function activeLinkedSymmetryPatch(state = Animotion.state) {
    const selected = selectedPart(state);
    if (!selected) return warning("select a part with a ready symmetry hidden-completion patch");
    const status = Animotion.cutsceneActionSelectors?.getActiveJointAction?.(state) || {};
    const action = status.action || null;
    const draft = Animotion.motionDraftActionStore?.draftForPart?.(action, selected.id, { assets: assets(state) }) || action?.motionDraft || null;
    const hidden = draft?.hiddenCompletion;
    if (!hidden?.assetId || hidden.assetStatus !== "ready") return warning("selected part has no ready hidden-completion patch linked");
    const asset = Animotion.hiddenCompletionAssets?.findById?.(assets(state), hidden.assetId);
    if (asset?.completionMethod !== "symmetry") return warning("linked hidden-completion patch is not a symmetry patch");
    if (asset.sourcePartId !== selected.id) return warning("linked patch source part does not match selected part");
    return { ok: true, asset, draft, action, part: selected };
  }

  function linkedSymmetryPatchesForAction(state = Animotion.state) {
    const status = Animotion.cutsceneActionSelectors?.getActiveJointAction?.(state) || {};
    const action = status.action || null;
    if (!action) return [];
    const drafts = actionDrafts(action, { assets: assets(state) });
    return drafts.map((draft) => linkedItemFromDraft(draft, action, state)).filter(Boolean);
  }

  function insertPart(part, options = {}) {
    const state = Animotion.state;
    const before = Animotion.partCommands?.historySnapshot?.();
    state.parts = [...(state.parts || []), part];
    if (!options.preserveSelection) state.selectedPartId = part.id;
    if (state.project) state.project.parts = state.parts;
    if (!part.canvas) Animotion.parts?.updatePartCanvas?.(part);
    Animotion.partCommands?.recordHistorySnapshot?.("create-supplemental-part", before, Animotion.partCommands?.historySnapshot?.(), options);
    return part;
  }

  function actionDrafts(action, options = {}) {
    const drafts = Animotion.motionDraftActionStore?.normalizeList?.(action?.hiddenCompletionDrafts, options) || [];
    const primary = Animotion.motionDrafts?.normalize?.(action?.motionDraft, options) || action?.motionDraft || null;
    if (!primary) return drafts;
    return Animotion.motionDraftActionStore?.upsertDraft?.(drafts, primary, { ...options, setPrimary: false }) || [...drafts, primary];
  }

  function linkedItemFromDraft(draft, action, state) {
    const hidden = draft?.hiddenCompletion;
    if (!draft?.partId || !hidden?.assetId || hidden.assetStatus !== "ready") return null;
    const asset = Animotion.hiddenCompletionAssets?.findById?.(assets(state), hidden.assetId);
    if (!asset || asset.completionMethod !== "symmetry" || asset.sourcePartId !== draft.partId) return null;
    if (!state.parts?.some((part) => part.id === draft.partId)) return null;
    return { asset, draft, action };
  }

  function validatePatch(patch) {
    if (!patch?.id || patch.type !== "hiddenCompletionPatch") return warning("asset is not a hiddenCompletionPatch");
    if (patch.completionMethod !== "symmetry") return warning("only symmetry hidden-completion patches can become supplemental parts");
    if (!patch.sourcePartId) return warning("hidden-completion patch sourcePartId is required");
    return { ok: true };
  }

  function geometryForPatch(patch, source, options) {
    return coverageModule()?.geometryForPatch?.(patch, source, options)
      || { rect: normalizeRect(source.rect || source.sourceRect), mask: { kind: "polygon", points: [] } };
  }

  function canvasForPatch(patch, part, counterpart, source, options) {
    return coverageModule()?.canvasForPatch?.(patch, part, counterpart, source, options) || null;
  }

  function coverageForPart(part = {}) {
    return coverageModule()?.coverageForPart?.(part) || { coverageRatio: 0, warnings: ["coverage-unavailable"] };
  }

  function selectedPart(state) {
    return Animotion.parts?.selectedPart?.() || state?.parts?.find((part) => part.id === state?.selectedPartId) || null;
  }

  function existingPartForPatch(parts = [], assetId) {
    return parts.find((part) => part.isSupplementalPart === true && part.sourcePatchAssetId === assetId) || null;
  }

  function suggestedParentId(source) {
    return source?.id || null;
  }

  function actionIdentity(action = {}) {
    if (typeof action === "string") return action || null;
    return Animotion.actionScopedEffects?.actionIdFor?.(action) || action.id || action.actionId || action.source || null;
  }

  function actionMatches(part, actionId) {
    const partActionId = part.createdForActionId || part.createdFromJointActionId || null;
    return !partActionId || !actionId || partActionId === actionId;
  }

  function layerNear(part = {}) {
    return Math.max(1, Math.round(Number(part.order ?? part.layerIndex) || 1) + 1);
  }

  function imageBounds() {
    return Animotion.imageBounds?.() || (Animotion.state?.image ? { width: Animotion.state.image.naturalWidth, height: Animotion.state.image.naturalHeight } : null);
  }

  function assets(state) {
    return state?.project?.assets || [];
  }

  function uniquePartId(base, parts = []) {
    const ids = new Set(parts.map((part) => part.id));
    if (!ids.has(base)) return base;
    for (let index = 2; ; index += 1) if (!ids.has(`${base}-${index}`)) return `${base}-${index}`;
  }

  function normalizeRect(rect = {}) {
    return { x: Math.round(Number(rect.x) || 0), y: Math.round(Number(rect.y) || 0), w: Math.max(1, Math.round(Number(rect.w) || 1)), h: Math.max(1, Math.round(Number(rect.h) || 1)) };
  }

  function coverageModule() {
    return Animotion.hiddenCompletionSupplementalCoverage || null;
  }

  function centerPoint(rect) { return { x: rect.w * 0.5, y: rect.h * 0.5 }; }

  function clonePoint(point) { return point ? { x: Number(point.x) || 0, y: Number(point.y) || 0 } : null; }

  function absoluteRigPoints(part) {
    return {
      pivot: absolutePoint(part.rect, part.pivot),
      joint: absolutePoint(part.rect, part.joint),
      handTip: part.handTip ? absolutePoint(part.rect, part.handTip) : null,
    };
  }

  function absolutePoint(rect, point = {}) {
    return { x: rect.x + Number(point.x || 0), y: rect.y + Number(point.y || 0) };
  }

  function localPointFromAbsolute(point, rect) { return point ? { x: point.x - rect.x, y: point.y - rect.y } : null; }

  function warning(message) {
    return { ok: false, warning: message };
  }

  Animotion.hiddenCompletionSupplementalPart = { KIND, payloadFromPatch, insertForSelectedLinkedPatch, insertAllLinkedPatches, syncPartForPatch, regenerateCanvasForPart, hasVisiblePartForPatch, coverageForPart, activeLinkedSymmetryPatch, linkedSymmetryPatchesForAction };
  if (typeof module !== "undefined") module.exports = Animotion.hiddenCompletionSupplementalPart;
}
