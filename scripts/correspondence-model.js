{
  const global = typeof window !== "undefined" ? window : globalThis;
  const Animotion = global.Animotion || (global.Animotion = {});
  const TARGET_TYPES = new Set(["head", "chest", "hip", "arm", "hand", "leg", "foot", "hair", "prop"]);
  const OCCLUSION_STATUS = new Set(["visible", "partial", "hidden", "unknown"]);
  const DEPTH_ORDER = new Set(["front", "behind", "intersect", "unknown"]);
  const HIDDEN_COMPLETION = new Set(["none", "candidate", "required"]);
  const SCHEMA_VERSION = "editor-correspondence-v1";
  const SOURCE_KINDS = new Set(["manual", "ai-draft", "imported"]);
  const COORDINATE_SPACES = new Set(["impactImage", "sourceImage", "normalized-image"]);

  function normalizeList(correspondences = [], parts = []) {
    return (Array.isArray(correspondences) ? correspondences : [])
      .map((item, index) => normalize(item, parts, index))
      .filter(Boolean);
  }

  function normalize(input = {}, parts = [], index = 0) {
    const sourcePartId = stringOrNull(input.sourcePartId || input.source?.partId);
    if (!sourcePartId) return null;
    const part = parts.find((candidate) => candidate.id === sourcePartId);
    if (parts.length && !part) return null;
    const sourcePartType = part?.type || stringOrDefault(input.sourcePartType || input.source?.partType, "prop");
    const targetPartType = validSetValue(TARGET_TYPES, input.targetPartType || input.target?.partType, part?.type || "prop");
    const impactAnchor = normalizePoint(input.impactAnchor || input.target?.anchor);
    const bImpact = normalizeNormalizedPoint(input.bImpact || input.target?.bImpact);
    const occlusion = normalizeOcclusion(input.occlusion);
    return {
      id: String(input.id || `corr-${sourcePartId}-${index + 1}`),
      schemaVersion: stringOrDefault(input.schemaVersion, SCHEMA_VERSION),
      kind: validSetValue(SOURCE_KINDS, input.kind, "manual"),
      sourcePartId,
      sourcePartType,
      targetPartType,
      impactAnchor,
      occlusion,
      source: {
        partId: sourcePartId,
        partType: sourcePartType,
      },
      target: {
        partType: targetPartType,
        anchor: impactAnchor,
        coordinateSpace: validSetValue(COORDINATE_SPACES, input.target?.coordinateSpace, "impactImage"),
        bImpact,
      },
      bImpact,
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

  function normalizeNormalizedPoint(point) {
    if (!point) return null;
    return {
      xNorm: clamp01(Number(point.xNorm ?? point[0])),
      yNorm: clamp01(Number(point.yNorm ?? point[1])),
      coordinateSpace: "normalized-image",
    };
  }

  function normalizedPointFromImagePoint(point, bounds) {
    const anchor = normalizePoint(point);
    const width = Math.max(1, Math.round(Number(bounds?.width) || Number(bounds?.w) || 1));
    const height = Math.max(1, Math.round(Number(bounds?.height) || Number(bounds?.h) || 1));
    if (!anchor) return null;
    return normalizeNormalizedPoint({ xNorm: anchor.x / width, yNorm: anchor.y / height });
  }

  function imagePointFromNormalized(point, bounds) {
    const normalized = normalizeNormalizedPoint(point);
    if (!normalized) return null;
    const width = Math.max(1, Math.round(Number(bounds?.width) || Number(bounds?.w) || 1));
    const height = Math.max(1, Math.round(Number(bounds?.height) || Number(bounds?.h) || 1));
    return {
      x: Math.round(normalized.xNorm * width),
      y: Math.round(normalized.yNorm * height),
    };
  }

  function compileForPlanner(input, parts = [], options = {}) {
    const correspondence = normalize(input, parts);
    if (!correspondence) return null;
    const impactPoint = currentImpactPoint(correspondence, options.impactImageBounds);
    if (!impactPoint) return null;
    const mapped = mapPlannerTarget(correspondence, options, impactPoint);
    if (!mapped) return null;
    const motionHints = Animotion.motionHints?.fromCorrespondence?.(correspondence) || fallbackMotionHints(correspondence);
    return {
      source: "correspondence-compile-v1",
      correspondenceId: correspondence.id,
      sourcePartId: correspondence.sourcePartId,
      sourcePartType: correspondence.sourcePartType,
      targetPartType: correspondence.targetPartType,
      target: mapped.point,
      targetCoordinateSpace: mapped.coordinateSpace,
      anchors: [],
      motionHints,
      motionDraft: Animotion.motionDrafts?.compileFromHints?.(motionHints, {
        partId: correspondence.sourcePartId,
        correspondenceId: correspondence.id,
        targetPartType: correspondence.targetPartType,
      }) || null,
      relation: {
        source: correspondence.source,
        target: { ...correspondence.target, anchor: impactPoint },
        occlusion: correspondence.occlusion,
      },
    };
  }

  function mapPlannerTarget(correspondence, options, impactPoint) {
    const mapper = typeof options.mapImpactPoint === "function" ? options.mapImpactPoint : null;
    const coordinateSpace = mapper ? "sourceImage" : correspondence.target.coordinateSpace;
    const point = normalizePoint(mapper ? mapper(impactPoint, correspondence) : impactPoint);
    return point ? { point, coordinateSpace } : null;
  }

  function currentImpactPoint(correspondence, bounds) {
    return imagePointFromNormalized(correspondence.bImpact || correspondence.target?.bImpact, bounds) || correspondence.impactAnchor;
  }

  function fallbackMotionHints(correspondence) {
    return {
      source: "correspondence",
      occlusion: correspondence.occlusion.status,
      depthOrder: correspondence.occlusion.depthOrder,
      hiddenCompletion: correspondence.occlusion.hiddenCompletion,
      warnings: correspondence.occlusion.hiddenCompletion === "none" ? [] : [`hidden-completion-${correspondence.occlusion.hiddenCompletion}`],
    };
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

  function clamp01(value) {
    const number = Number.isFinite(value) ? value : 0;
    return Math.min(1, Math.max(0, number));
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

  Animotion.correspondenceModel = { normalizeList, normalize, createForPart, normalizePoint, normalizedPointFromImagePoint, imagePointFromNormalized, defaultTargetType, compileForPlanner };

  if (typeof module !== "undefined") module.exports = Animotion.correspondenceModel;
}
