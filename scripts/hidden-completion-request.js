{
  const global = typeof window !== "undefined" ? window : globalThis;
  const Animotion = global.Animotion || (global.Animotion = {});
  const TASK = "hidden_completion";
  const GUIDE_MISSING_WARNING = "hidden-completion-guide-missing";
  const ALLOWED_OPTION_KEYS = new Set(["promptVersion", "includeWarnings", "strictMode", "requestId"]);

  function buildHiddenCompletionRequest(project, patchAssetId, options = {}) {
    validateOptions(options);
    const asset = validatedPatchAsset(project, patchAssetId);
    const rawAsset = findRawAsset(project, patchAssetId);
    const warnings = guideWarnings(rawAsset);
    if (options.strictMode && warnings.length) throw new Error(warnings[0]);
    return {
      task: TASK,
      requestId: stringOrNull(options.requestId),
      promptVersion: stringOrNull(options.promptVersion),
      patchAssetId: asset.id,
      sourcePartId: asset.sourcePartId,
      sourceRectNormalized: asset.sourceRectNormalized,
      maskVerticesNormalized: asset.maskVerticesNormalized,
      guide: requestGuide(asset, rawAsset),
      patchTransform: asset.patchTransform,
      intent: requestIntent(),
      provenance: requestProvenance(),
      warnings: options.includeWarnings === false ? [] : warnings,
    };
  }

  function validateOptions(options = {}) {
    for (const key of Object.keys(options || {})) {
      if (!ALLOWED_OPTION_KEYS.has(key)) throw new Error(`unsupported hidden completion request option: ${key}`);
    }
  }

  function validatedPatchAsset(project, patchAssetId) {
    const rawAsset = findRawAsset(project, patchAssetId);
    if (!rawAsset) throw new Error(`hidden completion patch asset not found: ${patchAssetId}`);
    if (rawAsset.type !== Animotion.hiddenCompletionAssets?.TYPE) {
      throw new Error(`asset is not a hiddenCompletionPatch: ${patchAssetId}`);
    }
    const asset = Animotion.hiddenCompletionAssets.normalizeAsset(rawAsset);
    if (!asset) throw new Error(`invalid hiddenCompletionPatch asset: ${patchAssetId}`);
    if (!asset.sourcePartId) throw new Error(`hiddenCompletionPatch sourcePartId is required: ${patchAssetId}`);
    return asset;
  }

  function findRawAsset(project, patchAssetId) {
    const id = stringOrNull(patchAssetId);
    if (!id || !Array.isArray(project?.assets)) return null;
    return project.assets.find((asset) => asset?.id === id) || null;
  }

  function requestGuide(asset, rawAsset) {
    if (!hasGuideMesh(rawAsset)) return emptyGuide();
    return {
      meshVerticesNormalized: cloneArray(asset.guide.meshVerticesNormalized),
      meshFaces: cloneArray(asset.guide.meshFaces),
      silhouetteVerticesNormalized: cloneArray(asset.guide.silhouetteVerticesNormalized),
    };
  }

  function guideWarnings(rawAsset) {
    return hasGuideMesh(rawAsset) ? [] : [GUIDE_MISSING_WARNING];
  }

  function hasGuideMesh(asset) {
    return Array.isArray(asset?.guide?.meshVerticesNormalized) && asset.guide.meshVerticesNormalized.length > 0;
  }

  function emptyGuide() {
    return {
      meshVerticesNormalized: [],
      meshFaces: [],
      silhouetteVerticesNormalized: [],
    };
  }

  function requestIntent() {
    return {
      mode: "extend_same_part",
      preserveStyle: true,
      preserveLineArt: true,
      avoidNewDesign: true,
    };
  }

  function requestProvenance() {
    return {
      provider: null,
      modelId: null,
      modelLicense: null,
    };
  }

  function cloneArray(value) {
    return JSON.parse(JSON.stringify(Array.isArray(value) ? value : []));
  }

  function stringOrNull(value) {
    return value === undefined || value === null || value === "" ? null : String(value);
  }

  Animotion.hiddenCompletionRequest = { buildHiddenCompletionRequest };
  if (typeof module !== "undefined") module.exports = Animotion.hiddenCompletionRequest;
}
