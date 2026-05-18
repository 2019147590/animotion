{
  const global = typeof window !== "undefined" ? window : globalThis;
  const Animotion = global.Animotion || (global.Animotion = {});
  const TYPE = "hiddenCompletionPatch";
  const STATUSES = new Set(["draft", "missing", "requested", "ready"]);

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
      patchTransform: options.patchTransform,
      patchStatus: options.patchStatus || "draft",
      preview: options.preview,
    });
  }

  function normalizeAsset(asset = {}) {
    if (asset.type !== TYPE || !asset.id) return null;
    return {
      id: String(asset.id),
      type: TYPE,
      name: stringOrDefault(asset.name, asset.id),
      uri: stringOrDefault(asset.uri, `hidden-completion://${asset.id}`),
      sourcePartId: stringOrNull(asset.sourcePartId),
      sourceRectNormalized: normalizeImageRect(asset.sourceRectNormalized),
      maskVerticesNormalized: normalizeLocalPoints(asset.maskVerticesNormalized),
      patchTransform: normalizeTransform(asset.patchTransform),
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

  function normalizedRect(part) {
    return Animotion.coordinateSpaces?.normalizedImageRectFromRect?.(part.sourceRect || part.rect, Animotion.imageBounds?.()) || null;
  }

  function normalizedMask(part) {
    return Animotion.coordinateSpaces?.normalizedLocalPointsFromPoints?.(part.mask?.points, part.sourceRect || part.rect) || [];
  }

  function normalizeImageRect(rect) {
    if (!rect) return null;
    return {
      xNorm: clamp01(rect.xNorm),
      yNorm: clamp01(rect.yNorm),
      wNorm: clamp01(rect.wNorm),
      hNorm: clamp01(rect.hNorm),
      coordinateSpace: "normalized-image",
    };
  }

  function normalizeLocalPoints(points = []) {
    return (Array.isArray(points) ? points : []).map((point) => ({
      xNorm: clamp01(point.xNorm),
      yNorm: clamp01(point.yNorm),
      coordinateSpace: "part-local-normalized",
    }));
  }

  function normalizeTransform(transform = {}) {
    return {
      coordinateSpace: "part-local",
      translationNormalized: normalizeTranslation(transform.translationNormalized || transform.translation),
      scaleX: numberOrDefault(transform.scaleX, 1),
      scaleY: numberOrDefault(transform.scaleY, 1),
      rotation: numberOrDefault(transform.rotation, 0),
    };
  }

  function normalizeTranslation(point = {}) {
    return {
      xNorm: clamp01(point.xNorm),
      yNorm: clamp01(point.yNorm),
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
    return STATUSES.has(status) ? status : "draft";
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

  Animotion.hiddenCompletionAssets = { TYPE, createForPart, normalizeAsset, isPatchAsset, findById };
  if (typeof module !== "undefined") module.exports = Animotion.hiddenCompletionAssets;
}
