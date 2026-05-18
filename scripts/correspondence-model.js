{
  const global = typeof window !== "undefined" ? window : globalThis;
  const Animotion = global.Animotion || (global.Animotion = {});
  const TARGET_TYPES = new Set(["head", "chest", "hip", "arm", "hand", "leg", "foot", "hair", "prop"]);
  const OCCLUSION_STATUS = new Set(["visible", "partial", "hidden", "unknown"]);
  const DEPTH_ORDER = new Set(["front", "behind", "intersect", "unknown"]);
  const HIDDEN_COMPLETION = new Set(["none", "candidate", "required"]);

  function normalizeList(correspondences = [], parts = []) {
    return (Array.isArray(correspondences) ? correspondences : [])
      .map((item, index) => normalize(item, parts, index))
      .filter(Boolean);
  }

  function normalize(input = {}, parts = [], index = 0) {
    const sourcePartId = stringOrNull(input.sourcePartId);
    if (!sourcePartId) return null;
    const part = parts.find((candidate) => candidate.id === sourcePartId);
    if (parts.length && !part) return null;
    return {
      id: String(input.id || `corr-${sourcePartId}-${index + 1}`),
      sourcePartId,
      sourcePartType: part?.type || stringOrDefault(input.sourcePartType, "prop"),
      targetPartType: validSetValue(TARGET_TYPES, input.targetPartType, part?.type || "prop"),
      impactAnchor: normalizePoint(input.impactAnchor),
      occlusion: normalizeOcclusion(input.occlusion),
    };
  }

  function createForPart(part, patch = {}) {
    return normalize({
      ...patch,
      id: patch.id || randomId(part.id),
      sourcePartId: part.id,
      sourcePartType: part.type,
      targetPartType: patch.targetPartType || defaultTargetType(part.type),
    }, [part]);
  }

  function normalizeOcclusion(occlusion = {}) {
    return {
      status: validSetValue(OCCLUSION_STATUS, occlusion.status, "unknown"),
      depthOrder: validSetValue(DEPTH_ORDER, occlusion.depthOrder, "unknown"),
      hiddenCompletion: validSetValue(HIDDEN_COMPLETION, occlusion.hiddenCompletion, "none"),
    };
  }

  function normalizePoint(point) {
    if (!point) return null;
    return { x: Math.round(Number(point.x) || Number(point[0]) || 0), y: Math.round(Number(point.y) || Number(point[1]) || 0) };
  }

  function defaultTargetType(partType) {
    if (partType === "leg") return "foot";
    if (partType === "arm") return "hand";
    if (partType === "body" || partType === "spine") return "chest";
    return TARGET_TYPES.has(partType) ? partType : "prop";
  }

  function validSetValue(set, value, fallback) {
    const normalized = value === undefined || value === null ? fallback : String(value);
    return set.has(normalized) ? normalized : fallback;
  }

  function stringOrNull(value) {
    return value === undefined || value === null || value === "" ? null : String(value);
  }

  function stringOrDefault(value, fallback) {
    return value === undefined || value === null || value === "" ? String(fallback) : String(value);
  }

  function randomId(partId) {
    return `corr-${partId}-${global.crypto?.randomUUID?.() || Date.now()}`;
  }

  Animotion.correspondenceModel = { normalizeList, normalize, createForPart, normalizePoint, defaultTargetType };

  if (typeof module !== "undefined") module.exports = Animotion.correspondenceModel;
}
