{
  const global = typeof window !== "undefined" ? window : globalThis;
  const Animotion = global.Animotion || (global.Animotion = {});

  const PROJECT_FORMAT = "animotion-project";
  const PROJECT_VERSION = "1.0.0";
  const DEFAULT_CANVAS = { width: 1, height: 1, fps: 24, durationFrames: 120, backgroundColor: "#f7f0df" };
  const PART_TYPES = new Set(["head", "body", "spine", "arm", "leg", "hand", "hair", "eye", "mouth", "clothes", "prop", "background"]);

  /**
   * Central AnimotionProject model.
   * Current MVP-only fields such as sourceRect and motionSettings are kept on Part
   * so the existing canvas renderer can round-trip without a full UI rewrite.
   */

  function createEmptyProject(options = {}) {
    const now = isoNow();
    const canvas = normalizeCanvas(options.canvas);
    return {
      version: PROJECT_VERSION,
      format: PROJECT_FORMAT,
      metadata: {
        name: stringOrDefault(options.name, "Untitled Animotion Project"),
        createdAt: stringOrDefault(options.createdAt, now),
        updatedAt: stringOrDefault(options.updatedAt, now),
      },
      canvas,
      assets: [],
      parts: [],
      proxies: [],
      rigs: [],
      motions: [],
      effects: [],
      timeline: { currentFrame: 1, durationFrames: canvas.durationFrames, tracks: [] },
      editor: {},
    };
  }

  function normalizeProject(payload) {
    const project = createEmptyProject({
      name: payload?.metadata?.name,
      createdAt: payload?.metadata?.createdAt,
      updatedAt: payload?.metadata?.updatedAt,
      canvas: payload?.canvas,
    });
    project.assets = normalizeArray(payload?.assets, normalizeAsset);
    project.parts = normalizeArray(payload?.parts, normalizeProjectPart);
    project.proxies = Array.isArray(payload?.proxies) ? payload.proxies : [];
    project.rigs = Array.isArray(payload?.rigs) ? payload.rigs : [];
    project.motions = normalizeArray(payload?.motions, normalizeMotionClip);
    project.effects = Array.isArray(payload?.effects) ? payload.effects : [];
    project.timeline = normalizeTimeline(payload?.timeline, project.canvas.durationFrames);
    project.editor = objectOrEmpty(payload?.editor);
    return project;
  }

  function editorPartsFromProject(project) {
    const motionByPart = partKeyframesFromMotions(project.motions || []);
    return (project.parts || []).map((part, index) => editorPartFromProjectPart(part, motionByPart, index));
  }

  function attachEditorParts(project, parts) {
    project.parts = parts || [];
    return project;
  }

  function isProjectPayload(payload) {
    return payload?.format === PROJECT_FORMAT || (payload?.metadata && payload?.canvas && Array.isArray(payload?.assets));
  }

  function normalizeProjectPart(part = {}, index = 0) {
    const id = stringOrDefault(part.id, `part-${index + 1}`);
    const rect = normalizeRect(part.rect || part.sourceRect);
    const layerIndex = intOrDefault(part.order, intOrDefault(part.layerIndex, index + 1));
    return {
      id,
      name: stringOrDefault(part.name, `part_${index + 1}`),
      type: PART_TYPES.has(part.type) ? part.type : "prop",
      assetId: stringOrDefault(part.assetId, `asset-${id}`),
      sourceAssetId: stringOrDefault(part.sourceAssetId, "source-image"),
      parentId: part.parentId || null,
      layerIndex,
      visible: part.hidden !== undefined ? part.hidden !== true : part.visible !== false,
      opacity: clampNumber(part.alpha ?? part.opacity, 0, 1, 1),
      pivot: normalizePoint(part.pivot, { x: rect.w * 0.5, y: rect.h * 0.5 }),
      joint: normalizePoint(part.joint, { x: rect.w * 0.5, y: rect.h * 0.5 }),
      mask: normalizeMask(part.mask),
      transform: normalizeTransform(part.transform),
      sourceRect: rect,
      motionSettings: normalizeCustomMotion(part.customMotion || part.motionSettings),
      keyframes: normalizeLegacyKeyframes(part.keyframes),
    };
  }

  function editorPartFromProjectPart(part, motionByPart, index) {
    const rect = normalizeRect(part.sourceRect || part.rect);
    return {
      ...part,
      rect,
      order: intOrDefault(part.layerIndex, index + 1),
      alpha: clampNumber(part.opacity, 0, 1, 1),
      hidden: part.visible === false,
      customMotion: normalizeCustomMotion(part.customMotion || part.motionSettings),
      keyframes: motionByPart.get(part.id) || normalizeLegacyKeyframes(part.keyframes),
    };
  }

  function partKeyframesFromMotions(motions) {
    const byPart = new Map();
    for (const motion of motions) {
      for (const keyframe of motion.keyframes || []) {
        if (keyframe.targetType !== "part" || keyframe.property !== "customMotion") continue;
        const list = byPart.get(keyframe.targetId) || [];
        list.push({ frame: intOrDefault(keyframe.frame, 1), pose: normalizeCustomMotion(keyframe.value) });
        byPart.set(keyframe.targetId, list);
      }
    }
    return byPart;
  }

  function normalizeArray(values, normalizer) {
    return Array.isArray(values) ? values.map(normalizer).filter(Boolean) : [];
  }

  function normalizeAsset(asset) {
    if (!asset?.id || !asset?.type) return null;
    return {
      id: String(asset.id),
      type: String(asset.type),
      name: stringOrDefault(asset.name, asset.id),
      uri: stringOrDefault(asset.uri, asset.name || asset.id),
      ...(asset.width ? { width: intOrDefault(asset.width, 1) } : {}),
      ...(asset.height ? { height: intOrDefault(asset.height, 1) } : {}),
    };
  }

  function normalizeMotionClip(clip = {}) {
    return {
      id: stringOrDefault(clip.id, "motion"),
      name: stringOrDefault(clip.name, "Motion"),
      durationFrames: intOrDefault(clip.durationFrames, DEFAULT_CANVAS.durationFrames),
      keyframes: Array.isArray(clip.keyframes) ? clip.keyframes : [],
    };
  }

  function normalizeTimeline(timeline = {}, durationFrames) {
    return {
      currentFrame: intOrDefault(timeline.currentFrame, 1),
      durationFrames: intOrDefault(timeline.durationFrames, durationFrames),
      tracks: Array.isArray(timeline.tracks) ? timeline.tracks : [],
    };
  }

  function normalizeCanvas(canvas = {}) {
    return {
      width: intOrDefault(canvas.width, DEFAULT_CANVAS.width),
      height: intOrDefault(canvas.height, DEFAULT_CANVAS.height),
      fps: intOrDefault(canvas.fps, Animotion.config?.timelineFps || DEFAULT_CANVAS.fps),
      durationFrames: intOrDefault(canvas.durationFrames, Animotion.config?.timelineFrames || DEFAULT_CANVAS.durationFrames),
      backgroundColor: stringOrDefault(canvas.backgroundColor, DEFAULT_CANVAS.backgroundColor),
    };
  }

  function normalizeLegacyKeyframes(keyframes = []) {
    return (Array.isArray(keyframes) ? keyframes : []).map((keyframe) => ({
      frame: intOrDefault(keyframe.frame, 1),
      pose: normalizeCustomMotion(keyframe.pose),
    }));
  }

  function normalizeCustomMotion(motion = {}) {
    return Animotion.motionModel?.normalizeCustomMotion?.(motion) || {
      x: numberOrDefault(motion.x, 0),
      y: numberOrDefault(motion.y, 0),
      rotate: numberOrDefault(motion.rotate, 0),
      scaleY: numberOrDefault(motion.scaleY, 0),
      jointX: numberOrDefault(motion.jointX, 0),
      jointY: numberOrDefault(motion.jointY, 0),
      phase: numberOrDefault(motion.phase, 0),
    };
  }

  function normalizeRect(rect = {}) {
    return {
      x: intOrDefault(rect.x, 0),
      y: intOrDefault(rect.y, 0),
      w: Math.max(1, intOrDefault(rect.w, 1)),
      h: Math.max(1, intOrDefault(rect.h, 1)),
    };
  }

  function normalizeMask(mask) {
    if (!mask?.points) return null;
    return { ...mask, points: mask.points.map((point) => normalizePoint(point, { x: 0, y: 0 })) };
  }

  function normalizeTransform(transform = {}) {
    return {
      x: numberOrDefault(transform.x, 0),
      y: numberOrDefault(transform.y, 0),
      rotation: numberOrDefault(transform.rotation, 0),
      scaleX: numberOrDefault(transform.scaleX, 1),
      scaleY: numberOrDefault(transform.scaleY, 1),
    };
  }

  function normalizePoint(point = {}, fallback) {
    return { x: numberOrDefault(point.x, fallback.x), y: numberOrDefault(point.y, fallback.y) };
  }

  function objectOrEmpty(value) {
    return value && typeof value === "object" ? value : {};
  }

  function clampNumber(value, min, max, fallback) {
    return Math.min(max, Math.max(min, numberOrDefault(value, fallback)));
  }

  function intOrDefault(value, fallback) {
    return Math.round(numberOrDefault(value, fallback));
  }

  function numberOrDefault(value, fallback) {
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
  }

  function stringOrDefault(value, fallback) {
    return value === undefined || value === null || value === "" ? String(fallback) : String(value);
  }

  function isoNow() {
    return new Date().toISOString();
  }

  Animotion.projectModel = {
    PROJECT_FORMAT,
    PROJECT_VERSION,
    createEmptyProject,
    normalizeProject,
    normalizeProjectPart,
    normalizeLegacyKeyframes,
    normalizeRect,
    normalizeCustomMotion,
    editorPartsFromProject,
    attachEditorParts,
    isProjectPayload,
  };

  if (typeof module !== "undefined") module.exports = Animotion.projectModel;
}
