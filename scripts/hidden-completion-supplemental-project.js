{
  const global = typeof window !== "undefined" ? window : globalThis;
  const Animotion = global.Animotion || (global.Animotion = {});
  const KIND = "hiddenCompletionSymmetry";
  const META_KEYS = [
    "isSupplementalPart", "supplementalKind", "completionMethod", "sourcePatchAssetId",
    "sourcePartId", "counterpartPartId", "targetRegion", "sourceRegion",
    "createdForActionId", "createdFromJointActionId", "originalPatchAssetType",
    "supplementalMaskScale", "supplementalWarp", "supplementalCanvasDataUrl",
    "supplementalCanvasWidth", "supplementalCanvasHeight", "supplementalCanvasVersion",
  ];
  const SNAPSHOT_VERSION = 1;

  function installProjectModelPatch() {
    const model = Animotion.projectModel;
    if (!model || model.supplementalPartWrapped) return;
    const originalPart = model.normalizeProjectPart;
    const originalProject = model.normalizeProject;
    model.normalizeProjectPart = function normalizeSupplementalProjectPart(part, index, options) {
      return preserveMetadata(originalPart.call(this, part, index, options), part);
    };
    model.normalizeProject = function normalizeSupplementalProject(payload, options) {
      const project = originalProject.call(this, payload, options);
      project.parts = (project.parts || []).map((part) => preserveMetadata(part, sourcePartPayload(payload, part.id)));
      return project;
    };
    model.supplementalPartWrapped = true;
  }

  function sourcePartPayload(payload, partId) {
    return (payload?.parts || []).find((part) => part.id === partId) || {};
  }

  function preserveMetadata(normalized, source = {}) {
    if (!normalized || source.isSupplementalPart !== true) return normalized;
    const preserved = { ...normalized, isSupplementalPart: true };
    for (const key of META_KEYS) {
      if (source[key] !== undefined && source[key] !== null && source[key] !== "") preserved[key] = source[key];
    }
    preserved.supplementalKind = preserved.supplementalKind || KIND;
    preserved.completionMethod = preserved.completionMethod || "symmetry";
    preserved.originalPatchAssetType = preserved.originalPatchAssetType || "hiddenCompletionPatch";
    if (preserved.supplementalWarp) preserved.supplementalWarp = Animotion.hiddenCompletionSupplementalWarp?.normalizeWarp?.(preserved.supplementalWarp, preserved) || preserved.supplementalWarp;
    return preserved;
  }

  function snapshotFieldsForPart(part = {}) {
    if (part.isSupplementalPart !== true) return {};
    const dataUrl = canvasDataUrl(part.canvas) || existingDataUrl(part);
    if (!dataUrl) return {};
    const width = Math.round(Number(part.canvas?.width || part.supplementalCanvasWidth || part.rect?.w) || 1);
    const height = Math.round(Number(part.canvas?.height || part.supplementalCanvasHeight || part.rect?.h) || 1);
    return {
      supplementalCanvasDataUrl: dataUrl,
      supplementalCanvasWidth: Math.max(1, width),
      supplementalCanvasHeight: Math.max(1, height),
      supplementalCanvasVersion: SNAPSHOT_VERSION,
    };
  }

  function restoreCanvasSnapshot(part = {}, options = {}) {
    const dataUrl = existingDataUrl(part);
    if (!dataUrl || typeof document === "undefined") return null;
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(Number(part.supplementalCanvasWidth || part.rect?.w) || 1));
    canvas.height = Math.max(1, Math.round(Number(part.supplementalCanvasHeight || part.rect?.h) || 1));
    canvas.__sourceSamplingPath = "saved-supplemental-canvas-snapshot";
    canvas.__snapshotDataUrl = dataUrl;
    canvas.__snapshotLoaded = false;
    const diagnostics = snapshotDiagnostics(part, canvas, { restoredCanvasFromSnapshot: true, regeneratedCanvasFromMetadata: false });
    const ImageCtor = global.Image;
    if (typeof ImageCtor === "function") {
      const image = new ImageCtor();
      image.onload = () => {
        const ctx = canvas.getContext?.("2d");
        ctx?.clearRect?.(0, 0, canvas.width, canvas.height);
        ctx?.drawImage?.(image, 0, 0, canvas.width, canvas.height);
        canvas.__snapshotLoaded = true;
        options.onLoad?.(part, canvas);
      };
      image.src = dataUrl;
      canvas.__snapshotImage = image;
    }
    return { ok: true, canvas, diagnostics };
  }

  function snapshotDiagnostics(part = {}, canvas = {}, patch = {}) {
    return {
      hasSavedSupplementalCanvas: Boolean(existingDataUrl(part)),
      restoredCanvasFromSnapshot: Boolean(patch.restoredCanvasFromSnapshot),
      regeneratedCanvasFromMetadata: Boolean(patch.regeneratedCanvasFromMetadata),
      supplementalCanvasWidth: Math.round(Number(canvas.width || part.supplementalCanvasWidth || 0)),
      supplementalCanvasHeight: Math.round(Number(canvas.height || part.supplementalCanvasHeight || 0)),
      sourcePatchAssetId: part.sourcePatchAssetId || null,
      sourcePartId: part.sourcePartId || null,
    };
  }

  function canvasDataUrl(canvas) {
    if (typeof canvas?.toDataURL !== "function") return null;
    try {
      const dataUrl = canvas.toDataURL("image/png");
      return validDataUrl(dataUrl) ? dataUrl : null;
    } catch (_error) {
      return null;
    }
  }

  function existingDataUrl(part = {}) {
    return validDataUrl(part.supplementalCanvasDataUrl) ? part.supplementalCanvasDataUrl : null;
  }

  function validDataUrl(value) {
    return typeof value === "string" && /^data:image\/png;base64,/.test(value);
  }

  installProjectModelPatch();
  Animotion.hiddenCompletionSupplementalProject = { installProjectModelPatch, preserveMetadata, snapshotFieldsForPart, restoreCanvasSnapshot, snapshotDiagnostics };
  if (typeof module !== "undefined") module.exports = Animotion.hiddenCompletionSupplementalProject;
}
