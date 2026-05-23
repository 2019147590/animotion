{
  const global = typeof window !== "undefined" ? window : globalThis;
  const Animotion = global.Animotion || (global.Animotion = {});

  const DEFAULT_BRIDGE = {
    primaryPartId: null,
    durationFrames: 18,
    impactFrame: 15,
    effectDirection: { x: 1, y: -0.25 },
    effectStrength: 1,
    sourceX: 0,
    sourceY: 0,
    sourceScale: 1,
    impactX: 0,
    impactY: 0,
    impactScale: 1,
    sourceMotionEnabled: false,
    bodyAssistEnabled: true,
    ghostEnabled: true,
  };
  const PANEL_KEYS = ["sourceX", "sourceY", "sourceScale", "impactX", "impactY", "impactScale"];
  const PANEL_SCALE_RANGE = { min: 0.25, max: 3.6 };
  const GHOST_DELAYS = [0.14, 0.08];
  const GHOST_ALPHA_RATIO = 0.22;

  function createBridge(parts = [], primaryPartId = null) {
    const primary = primaryPartId || parts[0]?.id || null;
    return normalizeBridge({
      ...DEFAULT_BRIDGE,
      primaryPartId: primary,
      effectDirection: inferEffectDirection(parts, primary),
      jointAction: Animotion.jointCoordinates?.createJointAction(parts, primary, DEFAULT_BRIDGE),
    });
  }

  function normalizeBridge(bridge = {}, options = {}) {
    bridge = bridge || {};
    const imageBounds = options.imageBounds || sourceBounds();
    const durationFrames = clampInt(bridge.durationFrames, 8, 120, DEFAULT_BRIDGE.durationFrames);
    return {
      primaryPartId: bridge.primaryPartId || null,
      durationFrames,
      impactFrame: clampInt(bridge.impactFrame, 2, durationFrames, Math.min(DEFAULT_BRIDGE.impactFrame, durationFrames)),
      effectDirection: normalizeDirection(bridge.effectDirection),
      effectStrength: clampNumber(bridge.effectStrength, 0, 2, DEFAULT_BRIDGE.effectStrength),
      sourceX: clampNumber(bridge.sourceX, -400, 400, DEFAULT_BRIDGE.sourceX),
      sourceY: clampNumber(bridge.sourceY, -400, 400, DEFAULT_BRIDGE.sourceY),
      sourceScale: clampNumber(bridge.sourceScale, PANEL_SCALE_RANGE.min, PANEL_SCALE_RANGE.max, DEFAULT_BRIDGE.sourceScale),
      impactX: clampNumber(bridge.impactX, -400, 400, DEFAULT_BRIDGE.impactX),
      impactY: clampNumber(bridge.impactY, -400, 400, DEFAULT_BRIDGE.impactY),
      impactScale: clampNumber(bridge.impactScale, PANEL_SCALE_RANGE.min, PANEL_SCALE_RANGE.max, DEFAULT_BRIDGE.impactScale),
      sourceMotionEnabled: bridge.sourceMotionEnabled === true,
      bodyAssistEnabled: bridge.bodyAssistEnabled !== false,
      ghostEnabled: bridge.ghostEnabled !== false,
      jointAction: normalizeJointAction(bridge.jointAction, { imageBounds, durationFrames, impactFrame: bridge.impactFrame }),
    };
  }

  function mergePanelTransform(baseBridge, overrideBridge) {
    const base = baseBridge ? normalizeBridge(baseBridge) : null;
    const override = overrideBridge ? normalizeBridge(overrideBridge) : null;
    if (!override || !hasPanelTransform(override)) return base;
    return normalizeBridge({
      ...(base || {}),
      ...panelTransform(override),
    });
  }

  function bridgeFrameFromTime(t, bridge, fps) {
    const safe = normalizeBridge(bridge);
    const duration = safe.durationFrames / fps;
    return Math.floor((((t % duration) + duration) % duration) * fps) + 1;
  }

  function bridgeValues(t, bridge, fps) {
    const safe = normalizeBridge(bridge);
    const frame = bridgeFrameFromTime(t, safe, fps);
    const n = (frame - 1) / Math.max(1, safe.durationFrames - 1);
    const impact = (safe.impactFrame - 1) / Math.max(1, safe.durationFrames - 1);
    const crouch = smoothstep(clamp(n / 0.2, 0, 1));
    const launch = easeInCubic(clamp((n - 0.18) / Math.max(0.01, impact - 0.18), 0, 1));
    const impactStart = Math.max(0.68, impact - 0.12);
    const snapStart = Math.max(impactStart, impact - 0.04);
    const impactIn = smoothstep(clamp((n - impactStart) / 0.14, 0, 1));
    const finalSnap = easeOutCubic(clamp((n - snapStart) / 0.18, 0, 1));
    return {
      frame,
      n,
      crouch,
      launch,
      speedPower: launch * safe.effectStrength,
      ghostAlpha: safe.ghostEnabled ? launch * (1 - impactIn) * 0.28 * safe.effectStrength : 0,
      impactAlpha: impactIn,
      flashAlpha: impactIn * 0.42 * safe.effectStrength,
      shake: n > impactStart ? Math.sin(n * 140) * (1 - n) * 24 * safe.effectStrength : 0,
      sourceAlpha: 1 - smoothstep(clamp((n - 0.3) / 0.34, 0, 1)),
      sourceX: lerp(safe.sourceX, safe.impactX, launch),
      sourceY: lerp(safe.sourceY + crouch * 18, safe.impactY, launch),
      sourceScale: lerp(safe.sourceScale * (1 + crouch * 0.08), safe.impactScale * 0.94, launch),
      sourceRotation: -safe.effectDirection.x * (0.04 + crouch * 0.06 + launch * 0.18),
      finalSnap,
      impactX: safe.impactX - safe.effectDirection.x * (1 - finalSnap) * 80 * safe.effectStrength,
      impactY: safe.impactY - safe.effectDirection.y * (1 - finalSnap) * 80 * safe.effectStrength,
      impactScale: safe.impactScale * (0.92 + finalSnap * 0.08),
      impactRotation: safe.effectDirection.x * (1 - finalSnap) * 0.1,
    };
  }

  function inferEffectDirection(parts, primaryPartId) {
    const primary = parts.find((part) => part.id === primaryPartId) || parts[0];
    const body = parts.find((part) => part.type === "spine") || parts.find((part) => part.type === "body");
    if (!primary || !body) return { ...DEFAULT_BRIDGE.effectDirection };
    const side = faceDirection(parts, body) || (centerX(primary) >= centerX(body) ? 1 : -1);
    const upward = primary.type === "leg" || primary.type === "arm" ? -0.25 : -0.08;
    return normalizeDirection({ x: side, y: upward });
  }

  function faceDirection(parts = [], body) {
    const face = faceBounds(parts);
    if (!face || !body) return 0;
    const delta = face.x + face.w * 0.5 - centerX(body);
    const threshold = Math.max(4, Number(body.rect?.w || 0) * 0.15);
    return Math.abs(delta) > threshold ? Math.sign(delta) : 0;
  }

  function faceBounds(parts = []) {
    const faces = parts.filter((part) => likelyFacePart(part) && part.rect);
    if (!faces.length) return null;
    const minX = Math.min(...faces.map((part) => Number(part.rect.x) || 0));
    const minY = Math.min(...faces.map((part) => Number(part.rect.y) || 0));
    const maxX = Math.max(...faces.map((part) => Number(part.rect.x || 0) + Number(part.rect.w || 0)));
    const maxY = Math.max(...faces.map((part) => Number(part.rect.y || 0) + Number(part.rect.h || 0)));
    return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
  }

  function likelyFacePart(part = {}) {
    const text = `${part.id || ""} ${part.name || ""} ${part.type || ""} ${part.humanRole || ""}`;
    return /\b(head|face|hair_front|front_hair|eye|eyes|mouth|nose|facial)\b|얼굴|머리|앞머리|눈|입|코/i.test(text)
      || ["head", "face", "eye", "mouth", "nose"].includes(part.type)
      || ["head", "face", "eye", "mouth", "nose"].includes(part.humanRole);
  }

  function normalizeDirection(direction = DEFAULT_BRIDGE.effectDirection) {
    const x = Number.isFinite(Number(direction.x)) ? Number(direction.x) : 1;
    const y = Number.isFinite(Number(direction.y)) ? Number(direction.y) : 0;
    const length = Math.hypot(x, y);
    if (length < 0.001) return { ...DEFAULT_BRIDGE.effectDirection };
    return { x: x / length, y: y / length };
  }

  function centerX(part) {
    return part.rect.x + part.rect.w * 0.5;
  }

  function hasPanelTransform(bridge) {
    return PANEL_KEYS.some((key) => Math.abs(Number(bridge[key]) - DEFAULT_BRIDGE[key]) > 0.001);
  }

  function panelTransform(bridge) {
    return Object.fromEntries(PANEL_KEYS.map((key) => [key, bridge[key]]));
  }

  function normalizeJointAction(action, options = {}) {
    if (!action?.beats?.length) return null;
    const timeline = Animotion.cutsceneActionSelectors?.rawActionTimeline?.(action) || null;
    return {
      source: String(action.source || "part-pivots-v1"),
      focusKey: action.focusKey ? String(action.focusKey) : null,
      ...(timeline ? { actionTimeline: Animotion.actionTimelineModel?.normalizeTimeline?.(timeline, options) || clonePlain(timeline) } : {}),
      ...(action.impactExaggeration ? { impactExaggeration: Animotion.impactExaggerationLayer?.normalizeImpactExaggerationLayer?.(action.impactExaggeration) || clonePlain(action.impactExaggeration) } : {}),
      anchors: Animotion.motionAnchors?.normalizeAnchors?.(action.anchors, options) || [],
      beats: action.beats.map((beat) => normalizeBeat(beat, options)).filter(Boolean),
      ...(action.targetDebug ? { targetDebug: clonePlain(action.targetDebug) } : {}),
      ...(action.activeMotionTarget ? { activeMotionTarget: clonePlain(action.activeMotionTarget) } : {}),
      ...(action.trajectoryPoints ? { trajectoryPoints: clonePlain(action.trajectoryPoints) } : {}),
      ...(action.motionHints ? { motionHints: Animotion.motionHints?.normalize?.(action.motionHints) || action.motionHints } : {}),
      ...(action.motionDraft ? { motionDraft: Animotion.motionDrafts?.normalize?.(action.motionDraft, { assets: options.assets }) || action.motionDraft } : {}),
    };
  }

  function normalizeBeat(beat, options = {}) {
    const pose = normalizePose(beat?.pose, beat?.poseNormalized, options.imageBounds);
    if (!pose) return null;
    return {
      id: String(beat.id || "beat"),
      at: Math.max(1, Math.round(Number(beat.at) || 1)),
      pose,
      poseNormalized: normalizedPose(pose, options.imageBounds),
    };
  }

  function normalizePose(pose, normalizedPose, bounds) {
    const restored = poseFromNormalized(normalizedPose, bounds);
    const source = restored || pose;
    if (!source) return null;
    return Object.fromEntries(Object.entries(source).map(([key, point]) => [key, normalizePoint(point)]));
  }

  function normalizePoint(point) {
    return [Math.round(Number(point?.x ?? point?.[0]) || 0), Math.round(Number(point?.y ?? point?.[1]) || 0)];
  }

  function poseFromNormalized(pose, bounds) {
    if (!pose || !bounds) return null;
    const restored = Object.entries(pose)
      .map(([key, point]) => [key, Animotion.coordinateSpaces?.pointFromNormalizedImagePoint?.(point, bounds)])
      .filter((entry) => entry[1]);
    return restored.length ? Object.fromEntries(restored) : null;
  }

  function normalizedPose(pose, bounds) {
    if (!pose || !bounds) return {};
    return Object.fromEntries(Object.entries(pose)
      .map(([key, point]) => [key, Animotion.coordinateSpaces?.normalizedImagePointFromPoint?.(point, bounds)])
      .filter((entry) => entry[1]));
  }

  function clonePlain(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function smoothstep(value) {
    return value * value * (3 - 2 * value);
  }

  function easeInCubic(value) {
    return value * value * value;
  }

  function easeOutCubic(value) {
    return 1 - Math.pow(1 - value, 3);
  }

  function lerp(a, b, ratio) {
    return a + (b - a) * ratio;
  }

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function clampNumber(value, min, max, fallback) {
    const number = Number(value);
    return Number.isFinite(number) ? clamp(number, min, max) : fallback;
  }

  function clampInt(value, min, max, fallback) {
    return Math.round(clampNumber(value, min, max, fallback));
  }

  function sourceBounds() {
    if (Animotion.state?.image) return { width: Animotion.state.image.naturalWidth, height: Animotion.state.image.naturalHeight };
    return typeof Animotion.imageBounds === "function" ? Animotion.imageBounds() : null;
  }

  Animotion.cutsceneModel = {
    createBridge,
    normalizeBridge,
    mergePanelTransform,
    bridgeFrameFromTime,
    bridgeValues,
    inferEffectDirection,
    PANEL_SCALE_RANGE,
    GHOST_DELAYS,
    GHOST_ALPHA_RATIO,
  };

  if (typeof module !== "undefined") module.exports = Animotion.cutsceneModel;
}
