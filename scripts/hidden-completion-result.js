{
  const global = typeof window !== "undefined" ? window : globalThis;
  const Animotion = global.Animotion || (global.Animotion = {});

  function normalizeProviderResult(result = {}, options = {}) {
    if (!result.imageBase64 && !result.imageBytes) throw new Error("hidden completion provider result image is required");
    return {
      imageBase64: stringOrNull(result.imageBase64),
      imageBytes: result.imageBytes || null,
      mimeType: stringOrDefault(result.mimeType, "image/png"),
      provider: stringOrNull(result.provider || options.provider),
      modelId: stringOrNull(result.modelId || options.modelId),
      modelLicense: stringOrNull(result.modelLicense || options.modelLicense),
      requestHash: stringOrNull(result.requestHash || options.requestHash),
      createdAt: isoOrNow(result.createdAt),
      warnings: arrayOfStrings(result.warnings),
      rawProviderMetadata: objectOrNull(result.rawProviderMetadata),
    };
  }

  function writeHiddenCompletionResult(project, patchAssetId, result, options = {}) {
    const patch = patchAsset(project, patchAssetId);
    const normalized = normalizeProviderResult(result, options);
    const generatedAsset = generatedAssetFromResult(patch, normalized, options);
    const readyPatch = readyPatchAsset(patch, generatedAsset.id, normalized, options);
    project.assets = upsertAsset(project.assets, generatedAsset);
    project.assets = upsertAsset(project.assets, readyPatch);
    if (Animotion.state?.project === project) Animotion.hiddenCompletionSupplementalPart?.syncPartForPatch?.(readyPatch, Animotion.state);
    return { project, patchAssetId: patch.id, generatedAssetId: generatedAsset.id, result: normalized };
  }

  function readyPatchAsset(patch, generatedAssetId, result, options) {
    return {
      ...patch,
      patchStatus: "ready",
      renderMode: "generated",
      generatedResult: {
        status: "ready",
        assetId: generatedAssetId,
        generatedAt: result.createdAt,
        sourceGuideVersion: stringOrNull(options.promptVersion),
        provenance: provenance(result, options),
      },
    };
  }

  function provenance(result, options) {
    return {
      provider: result.provider,
      modelId: result.modelId,
      modelLicense: result.modelLicense,
      requestHash: result.requestHash,
      inputAssetIds: arrayOfStrings(options.inputAssetIds),
      promptVersion: stringOrNull(options.promptVersion),
      createdAt: result.createdAt,
      userSuppliedRights: "assumed-original-or-authorized",
      rawProviderMetadata: result.rawProviderMetadata,
    };
  }

  function generatedAssetFromResult(patch, result, options) {
    const id = stringOrDefault(options.assetId, `generated-${patch.id}`);
    return {
      id,
      type: "texture",
      name: stringOrDefault(options.name, `${patch.name || patch.id} generated hidden completion`),
      uri: result.imageBase64 ? `data:${result.mimeType};base64,${result.imageBase64}` : `hidden-completion-result://${id}`,
      mimeType: result.mimeType,
    };
  }

  function patchAsset(project, patchAssetId) {
    const patch = Animotion.hiddenCompletionAssets?.findById?.(project?.assets, patchAssetId);
    if (!patch) throw new Error(`hidden completion patch asset not found: ${patchAssetId}`);
    return patch;
  }

  function upsertAsset(assets = [], asset) {
    const index = assets.findIndex((candidate) => candidate.id === asset.id);
    return index >= 0 ? assets.map((candidate, i) => i === index ? asset : candidate) : [...assets, asset];
  }

  function arrayOfStrings(value) {
    return (Array.isArray(value) ? value : []).map((item) => String(item)).filter(Boolean);
  }

  function objectOrNull(value) {
    return value && typeof value === "object" ? JSON.parse(JSON.stringify(value)) : null;
  }

  function isoOrNow(value) {
    const time = Date.parse(value);
    return Number.isFinite(time) ? new Date(time).toISOString() : new Date().toISOString();
  }

  function stringOrNull(value) {
    return value === undefined || value === null || value === "" ? null : String(value);
  }

  function stringOrDefault(value, fallback) {
    return value === undefined || value === null || value === "" ? String(fallback) : String(value);
  }

  Animotion.hiddenCompletionResult = { normalizeProviderResult, writeHiddenCompletionResult };
  if (typeof module !== "undefined") module.exports = Animotion.hiddenCompletionResult;
}
