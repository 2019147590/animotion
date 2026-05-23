{
  const global = typeof window !== "undefined" ? window : globalThis;
  const Animotion = global.Animotion || (global.Animotion = {});
  const TYPE = "hiddenCompletionPatch";
  const PATCH_STATUSES = new Set(["draft", "guide", "missing", "queued", "processing", "requested", "ready", "failed"]);
  const RESULT_STATUSES = new Set(["none", "requested", "ready", "failed"]);
  const RENDER_MODES = new Set(["guideOnly", "generated", "manualOverride"]);

  function createForPart(part, options = {}) {
    if (!part?.id) return null;
    const id = stringOrDefault(options.id, `hidden-${part.id}-${Date.now()}`);
    return normalizeAsset({
      id,
      type: TYPE,
      name: stringOrDefault(options.name, `${part.name || part.id} hidden completion`),
      uri: stringOrDefault(options.uri, `hidden-completion://${id}`),
      sourcePartId: part.id,
      sourceRectNormalized: options.sourceRectNormalized || normalizedRect(part),
      maskVerticesNormalized: options.maskVerticesNormalized || normalizedMask(part),
      guide: options.guide || defaultGuideForPart(part),
      patchTransform: options.patchTransform,
      generatedResult: options.generatedResult || { status: "none" },
      renderMode: options.renderMode || "guideOnly",
      patchStatus: options.patchStatus || "guide",
      completionMethod: options.completionMethod,
      symmetrySource: options.symmetrySource,
      preview: options.preview,
    });
  }

  function normalizeAsset(asset = {}) {
    if (asset.type !== TYPE || !asset.id) return null;
    const guide = normalizeOptionalGuide(asset.guide, asset.maskVerticesNormalized);
    return {
      id: String(asset.id),
      type: TYPE,
      name: stringOrDefault(asset.name, asset.id),
      uri: stringOrDefault(asset.uri, `hidden-completion://${asset.id}`),
      sourcePartId: stringOrNull(asset.sourcePartId),
      sourceRectNormalized: normalizeImageRect(asset.sourceRectNormalized),
      maskVerticesNormalized: normalizeLocalPoints(asset.maskVerticesNormalized),
      patchTransform: normalizeTransform(asset.patchTransform),
      ...(guide ? { guide } : {}),
      ...(asset.generatedResult ? { generatedResult: normalizeGeneratedResult(asset.generatedResult) } : {}),
      ...(asset.renderMode ? { renderMode: normalizeRenderMode(asset.renderMode) } : {}),
      ...(asset.completionMethod ? { completionMethod: normalizeCompletionMethod(asset.completionMethod) } : {}),
      ...(asset.symmetrySource ? { symmetrySource: normalizeSymmetrySource(asset.symmetrySource) } : {}),
      patchStatus: normalizeStatus(asset.patchStatus),
      preview: normalizePreview(asset.preview),
    };
  }

  function isPatchAsset(asset) {
    return asset?.type === TYPE;
  }

  function findById(assets = [], assetId = null) {
    const id = stringOrNull(assetId);
    return id ? assets.find((asset) => asset.id === id && isPatchAsset(asset)) || null : null;
  }

  function defaultGuideForPart(part) {
    const silhouette = normalizedMask(part);
    const quad = quadPoints();
    return normalizeGuide({
      kind: "meshGuide",
      meshVerticesNormalized: quad,
      meshFaces: [[0, 1, 2], [0, 2, 3]],
      silhouetteVerticesNormalized: silhouette.length ? silhouette : quad,
      guideStrength: 1,
    });
  }

  function runtimeGuideMesh(asset, rect) {
    const normalized = normalizeAsset(asset);
    if (!normalized) return null;
    const guide = normalized.guide || normalizeGuide({}, normalized.maskVerticesNormalized);
    return {
      meshVertices: toRuntimePoints(guide.meshVerticesNormalized, rect),
      silhouetteVertices: toRuntimePoints(guide.silhouetteVerticesNormalized, rect),
      meshFaces: guide.meshFaces,
    };
  }

  function normalizedRect(part) {
    return Animotion.coordinateSpaces?.normalizedImageRectFromRect?.(part.sourceRect || part.rect, Animotion.imageBounds?.()) || null;
  }

  function normalizedMask(part) {
    return Animotion.coordinateSpaces?.normalizedLocalPointsFromPoints?.(part.mask?.points, part.sourceRect || part.rect) || [];
  }

  function normalizeImageRect(rect) {
    if (!rect) return null;
    return {
      xNorm: clamp01(rect.xNorm ?? rect.x),
      yNorm: clamp01(rect.yNorm ?? rect.y),
      wNorm: clamp01(rect.wNorm ?? rect.width ?? rect.w),
      hNorm: clamp01(rect.hNorm ?? rect.height ?? rect.h),
      coordinateSpace: "normalized-image",
    };
  }

  function normalizeLocalPoints(points = []) {
    return (Array.isArray(points) ? points : []).map((point) => ({
      xNorm: numberOrDefault(point.xNorm ?? point.x ?? point[0], 0),
      yNorm: numberOrDefault(point.yNorm ?? point.y ?? point[1], 0),
      coordinateSpace: "part-local-normalized",
    }));
  }

  function normalizeGuide(guide = {}, fallbackSilhouette = []) {
    const mesh = normalizeGuidePoints(guide.meshVerticesNormalized);
    const silhouette = normalizeGuidePoints(guide.silhouetteVerticesNormalized);
    const fallback = normalizeLocalPoints(fallbackSilhouette);
    return {
      kind: "meshGuide",
      meshVerticesNormalized: mesh.length ? mesh : quadPoints(),
      meshFaces: normalizeFaces(guide.meshFaces),
      silhouetteVerticesNormalized: silhouette.length ? silhouette : fallback.length ? fallback : quadPoints(),
      guideStrength: clamp01(guide.guideStrength ?? 1),
      coordinateSpace: "part-local-normalized",
    };
  }

  function normalizeGuidePoints(points = []) {
    return (Array.isArray(points) ? points : []).map((point) => ({
      xNorm: numberOrDefault(point.xNorm ?? point.x ?? point[0], 0),
      yNorm: numberOrDefault(point.yNorm ?? point.y ?? point[1], 0),
      coordinateSpace: "part-local-normalized",
    }));
  }

  function normalizeOptionalGuide(guide, fallbackSilhouette = []) {
    return guide ? normalizeGuide(guide, fallbackSilhouette) : null;
  }

  function normalizeFaces(faces = []) {
    const normalized = (Array.isArray(faces) ? faces : [])
      .map((face) => Array.isArray(face) ? face.map((index) => Math.max(0, Math.round(Number(index) || 0))).slice(0, 3) : [])
      .filter((face) => face.length === 3);
    return normalized.length ? normalized : [[0, 1, 2], [0, 2, 3]];
  }

  function normalizeGeneratedResult(result = {}) {
    return {
      status: RESULT_STATUSES.has(result.status) ? result.status : "none",
      assetId: stringOrNull(result.assetId),
      generatedAt: isoOrNull(result.generatedAt),
      sourceGuideVersion: stringOrNull(result.sourceGuideVersion),
      ...(result.provenance ? { provenance: normalizeProvenance(result.provenance) } : {}),
    };
  }

  function normalizeProvenance(provenance = {}) {
    return {
      provider: stringOrNull(provenance.provider),
      modelId: stringOrNull(provenance.modelId),
      modelLicense: stringOrNull(provenance.modelLicense),
      requestHash: stringOrNull(provenance.requestHash),
      inputAssetIds: (Array.isArray(provenance.inputAssetIds) ? provenance.inputAssetIds : []).map(String),
      promptVersion: stringOrNull(provenance.promptVersion),
      createdAt: isoOrNull(provenance.createdAt),
      userSuppliedRights: stringOrDefault(provenance.userSuppliedRights, "assumed-original-or-authorized"),
      rawProviderMetadata: objectOrNull(provenance.rawProviderMetadata),
    };
  }

  function normalizeTransform(transform = {}) {
    return {
      coordinateSpace: "part-local",
      translationNormalized: normalizeTranslation(transform.translationNormalized || transform.translation || transform),
      scaleX: numberOrDefault(transform.scaleX, 1),
      scaleY: numberOrDefault(transform.scaleY, 1),
      rotation: numberOrDefault(transform.rotation, 0),
    };
  }

  function normalizeTranslation(point = {}) {
    return {
      xNorm: clamp01(point.xNorm ?? point.x ?? point[0]),
      yNorm: clamp01(point.yNorm ?? point.y ?? point[1]),
      coordinateSpace: "part-local-normalized",
    };
  }

  function normalizePreview(preview = {}) {
    return {
      label: stringOrNull(preview.label),
      color: stringOrDefault(preview.color, "#8fd3ff"),
      visible: preview.visible !== false,
    };
  }

  function normalizeStatus(status) {
    return PATCH_STATUSES.has(status) ? status : "draft";
  }

  function normalizeRenderMode(mode) {
    return RENDER_MODES.has(mode) ? mode : "guideOnly";
  }

  function normalizeCompletionMethod(method) {
    return method === "symmetry" ? "symmetry" : String(method || "manual");
  }

  function normalizeSymmetrySource(source = {}) {
    return {
      method: "symmetry",
      counterpartPartId: stringOrNull(source.counterpartPartId),
      targetPartId: stringOrNull(source.targetPartId),
      targetRegion: stringOrNull(source.targetRegion),
      sourceRegion: stringOrNull(source.sourceRegion),
      confidence: clamp01(source.confidence ?? 0),
      warnings: (Array.isArray(source.warnings) ? source.warnings : []).map(String).filter(Boolean),
    };
  }

  function quadPoints() {
    return [
      { xNorm: 0, yNorm: 0, coordinateSpace: "part-local-normalized" },
      { xNorm: 1, yNorm: 0, coordinateSpace: "part-local-normalized" },
      { xNorm: 1, yNorm: 1, coordinateSpace: "part-local-normalized" },
      { xNorm: 0, yNorm: 1, coordinateSpace: "part-local-normalized" },
    ];
  }

  function toRuntimePoints(points, rect) {
    const safe = rect || { w: 1, h: 1 };
    return (Array.isArray(points) ? points : []).map((point) => ({
      x: numberOrDefault(point.xNorm ?? point.x ?? point[0], 0) * safe.w,
      y: numberOrDefault(point.yNorm ?? point.y ?? point[1], 0) * safe.h,
    }));
  }

  function clamp01(value) {
    const number = Number(value);
    return Number.isFinite(number) ? Math.min(1, Math.max(0, number)) : 0;
  }

  function numberOrDefault(value, fallback) {
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
  }

  function stringOrNull(value) {
    return value === undefined || value === null || value === "" ? null : String(value);
  }

  function stringOrDefault(value, fallback) {
    return value === undefined || value === null || value === "" ? String(fallback) : String(value);
  }

  function isoOrNull(value) {
    if (!value) return null;
    const time = Date.parse(value);
    return Number.isFinite(time) ? new Date(time).toISOString() : null;
  }

  function objectOrNull(value) {
    return value && typeof value === "object" ? JSON.parse(JSON.stringify(value)) : null;
  }

  Animotion.hiddenCompletionAssets = { TYPE, createForPart, normalizeAsset, isPatchAsset, findById, defaultGuideForPart, runtimeGuideMesh };
  if (typeof module !== "undefined") module.exports = Animotion.hiddenCompletionAssets;
}
