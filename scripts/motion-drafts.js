{
  const global = typeof window !== "undefined" ? window : globalThis;
  const Animotion = global.Animotion || (global.Animotion = {});
  const DRAFT_KIND = "non-destructive-2.5d";
  const HINTS_VERSION = 1;

  function compileFromHints(hints, options = {}) {
    const normalized = Animotion.motionHints?.normalize?.(hints);
    if (!normalized || !hasDraftWork(normalized)) return null;
    const frames = draftFrames(options);
    const partId = stringOrNull(options.partId);
    return normalize({
      source: normalized.source,
      partId,
      draftKind: DRAFT_KIND,
      draftScope: "plan",
      compiledFromHintsVersion: HINTS_VERSION,
      sourceCorrespondenceId: options.correspondenceId,
      sourceTargetId: options.targetId || options.targetPartType,
      generatedFrom: normalized.source,
      visibility: visibilityDraft(normalized, frames),
      zOrder: zOrderDraft(normalized, frames, options),
      hiddenCompletion: hiddenCompletionDraft(normalized),
      warnings: normalized.warnings,
    });
  }

  function snapshot(draft, options = {}) {
    const normalized = normalize(draft, options);
    return normalized ? { ...normalized, draftScope: "action-snapshot" } : null;
  }

  function requestHiddenCompletion(draft, options = {}) {
    return updateHiddenCompletion(draft, {
      needed: true,
      assetStatus: "requested",
      assetId: null,
      requestId: stringOrNull(options.requestId),
      requestedAt: isoOrNull(options.requestedAt),
    });
  }

  function markHiddenCompletionReady(draft, assetId, options = {}) {
    return updateHiddenCompletion(draft, {
      needed: true,
      assetStatus: "ready",
      assetId: requiredString(assetId),
      completedAt: isoOrNull(options.completedAt),
    });
  }

  function removeHiddenCompletionAsset(draft) {
    return updateHiddenCompletion(draft, {
      needed: true,
      assetStatus: "missing",
      assetId: null,
      completedAt: null,
    });
  }

  function updateHiddenCompletion(draft, patch) {
    const normalized = normalize(draft);
    if (!normalized) return null;
    return normalize({
      ...normalized,
      hiddenCompletion: {
        ...normalized.hiddenCompletion,
        ...patch,
      },
    });
  }

  function normalize(draft, options = {}) {
    if (!draft || typeof draft !== "object") return null;
    return {
      source: String(draft.source || draft.generatedFrom || "manual"),
      partId: stringOrNull(draft.partId),
      draftKind: draft.draftKind === DRAFT_KIND ? DRAFT_KIND : DRAFT_KIND,
      draftScope: draft.draftScope === "action-snapshot" ? "action-snapshot" : "plan",
      compiledFromHintsVersion: Math.max(1, Math.round(Number(draft.compiledFromHintsVersion) || HINTS_VERSION)),
      sourceCorrespondenceId: stringOrNull(draft.sourceCorrespondenceId),
      sourceTargetId: stringOrNull(draft.sourceTargetId),
      generatedFrom: String(draft.generatedFrom || draft.source || "unknown"),
      visibility: normalizeVisibility(draft.visibility),
      zOrder: normalizeZOrder(draft.zOrder),
      hiddenCompletion: normalizeHiddenCompletion(draft.hiddenCompletion, options),
      warnings: normalizeWarnings(draft.warnings),
    };
  }

  function visibilityDraft(hints, frames) {
    const value = hints.occlusion === "hidden" ? 0.15 : hints.occlusion === "partial" ? 0.55 : null;
    if (value === null) return null;
    return {
      property: "opacity",
      reason: `occlusion-${hints.occlusion}`,
      keyframes: [
        { frame: frames.start, value: 1 },
        { frame: frames.impact, value },
      ],
    };
  }

  function zOrderDraft(hints, frames, options) {
    if (hints.depthOrder === "unknown") return null;
    return {
      property: "layerIndex",
      reason: `depth-${hints.depthOrder}`,
      keyframes: [
        { frame: frames.start, value: stringOrDefault(options.currentOrder, "current") },
        { frame: frames.impact, value: hints.depthOrder },
      ],
    };
  }

  function hiddenCompletionDraft(hints) {
    const needed = hints.hiddenCompletion !== "none";
    return {
      needed,
      status: hints.hiddenCompletion,
      assetKind: "hiddenCompletionPatch",
      assetStatus: needed ? "missing" : "none",
      assetId: null,
    };
  }

  function normalizeVisibility(visibility) {
    if (!visibility) return null;
    return {
      property: "opacity",
      reason: String(visibility.reason || "occlusion"),
      keyframes: normalizeKeyframes(visibility.keyframes, numberValue),
    };
  }

  function normalizeZOrder(zOrder) {
    if (!zOrder) return null;
    return {
      property: "layerIndex",
      reason: String(zOrder.reason || "depth"),
      keyframes: normalizeKeyframes(zOrder.keyframes, stringOrDefault),
    };
  }

  function normalizeHiddenCompletion(hiddenCompletion = {}, options = {}) {
    hiddenCompletion = hiddenCompletion && typeof hiddenCompletion === "object" ? hiddenCompletion : {};
    const status = ["none", "candidate", "required"].includes(hiddenCompletion.status) ? hiddenCompletion.status : "none";
    const needed = hiddenCompletion.needed === true || status !== "none";
    const legacy = hiddenCompletion.placeholderAsset;
    const assetId = stringOrNull(hiddenCompletion.assetId || legacy?.id);
    const assetStatus = normalizeAssetStatus(hiddenCompletion.assetStatus || legacy?.state, needed, assetId, options.assets);
    return {
      needed,
      status,
      assetKind: normalizeAssetKind(hiddenCompletion.assetKind || legacy?.type),
      assetStatus,
      assetId: assetIdForStatus(assetStatus, assetId),
      requestId: ["requested", "queued", "processing", "failed"].includes(assetStatus) ? stringOrNull(hiddenCompletion.requestId) : null,
      requestedAt: ["requested", "queued", "processing"].includes(assetStatus) ? isoOrNull(hiddenCompletion.requestedAt) : null,
      completedAt: assetStatus === "ready" ? isoOrNull(hiddenCompletion.completedAt) : null,
    };
  }

  function normalizeAssetStatus(value, needed, assetId = null, assets = null) {
    if (value === "ready") return hasReadyAsset(assetId, assets) ? "ready" : "missing";
    if (["queued", "processing", "failed"].includes(value)) return value;
    if (value === "requested") return "requested";
    if (value === "missing") return "missing";
    return needed ? "missing" : "none";
  }

  function assetIdForStatus(status, assetId) {
    return ["ready", "queued", "processing", "failed"].includes(status) ? assetId : null;
  }

  function normalizeAssetKind(kind) {
    if (!kind || kind === "inpaintedPatch") return "hiddenCompletionPatch";
    return String(kind);
  }

  function hasReadyAsset(assetId, assets) {
    if (!assetId) return false;
    if (!Array.isArray(assets)) return true;
    return Boolean(Animotion.hiddenCompletionAssets?.findById?.(assets, assetId));
  }

  function normalizeKeyframes(keyframes, valueNormalizer) {
    return (Array.isArray(keyframes) ? keyframes : []).map((keyframe) => ({
      frame: Math.max(1, Math.round(Number(keyframe.frame) || 1)),
      value: valueNormalizer(keyframe.value, "current"),
    }));
  }

  function draftFrames(options) {
    const duration = Math.max(1, Math.round(Number(options.durationFrames) || 18));
    return {
      start: 1,
      impact: Math.min(duration, Math.max(1, Math.round(Number(options.impactFrame) || Math.ceil(duration * 0.82)))),
    };
  }

  function hasDraftWork(hints) {
    return hints.occlusion === "partial" || hints.occlusion === "hidden" || hints.depthOrder !== "unknown" || hints.hiddenCompletion !== "none";
  }

  function normalizeWarnings(warnings) {
    return Array.isArray(warnings) ? warnings.map((item) => String(item)).filter(Boolean) : [];
  }

  function numberValue(value) {
    const number = Number(value);
    return Number.isFinite(number) ? Math.min(1, Math.max(0, number)) : 1;
  }

  function stringOrNull(value) {
    return value === undefined || value === null || value === "" ? null : String(value);
  }

  function requiredString(value) {
    const normalized = stringOrNull(value);
    if (!normalized) throw new Error("hidden completion assetId is required");
    return normalized;
  }

  function isoOrNull(value) {
    if (!value) return null;
    const time = Date.parse(value);
    return Number.isFinite(time) ? new Date(time).toISOString() : null;
  }

  function stringOrDefault(value, fallback) {
    return value === undefined || value === null || value === "" ? String(fallback) : String(value);
  }

  Animotion.motionDrafts = {
    compileFromHints,
    snapshot,
    normalize,
    requestHiddenCompletion,
    markHiddenCompletionReady,
    removeHiddenCompletionAsset,
  };
  if (typeof module !== "undefined") module.exports = Animotion.motionDrafts;
}
