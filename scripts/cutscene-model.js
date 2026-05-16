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
  };

  function createBridge(parts = [], primaryPartId = null) {
    const primary = primaryPartId || parts[0]?.id || null;
    return normalizeBridge({
      ...DEFAULT_BRIDGE,
      primaryPartId: primary,
      effectDirection: inferEffectDirection(parts, primary),
      jointAction: Animotion.jointCoordinates?.createJointAction(parts, primary, DEFAULT_BRIDGE),
    });
  }

  function normalizeBridge(bridge = {}) {
    bridge = bridge || {};
    const durationFrames = clampInt(bridge.durationFrames, 8, 120, DEFAULT_BRIDGE.durationFrames);
    return {
      primaryPartId: bridge.primaryPartId || null,
      durationFrames,
      impactFrame: clampInt(bridge.impactFrame, 2, durationFrames, Math.min(DEFAULT_BRIDGE.impactFrame, durationFrames)),
      effectDirection: normalizeDirection(bridge.effectDirection),
      effectStrength: clampNumber(bridge.effectStrength, 0, 2, DEFAULT_BRIDGE.effectStrength),
      sourceX: clampNumber(bridge.sourceX, -400, 400, DEFAULT_BRIDGE.sourceX),
      sourceY: clampNumber(bridge.sourceY, -400, 400, DEFAULT_BRIDGE.sourceY),
      sourceScale: clampNumber(bridge.sourceScale, 0.5, 1.8, DEFAULT_BRIDGE.sourceScale),
      impactX: clampNumber(bridge.impactX, -400, 400, DEFAULT_BRIDGE.impactX),
      impactY: clampNumber(bridge.impactY, -400, 400, DEFAULT_BRIDGE.impactY),
      impactScale: clampNumber(bridge.impactScale, 0.5, 1.8, DEFAULT_BRIDGE.impactScale),
      jointAction: normalizeJointAction(bridge.jointAction),
    };
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
      ghostAlpha: launch * (1 - impactIn) * 0.28 * safe.effectStrength,
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
    const side = centerX(primary) >= centerX(body) ? 1 : -1;
    const upward = primary.type === "leg" || primary.type === "arm" ? -0.25 : -0.08;
    return normalizeDirection({ x: side, y: upward });
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

  function normalizeJointAction(action) {
    if (!action?.beats?.length) return null;
    return {
      source: String(action.source || "part-pivots-v1"),
      beats: action.beats.map(normalizeBeat).filter(Boolean),
    };
  }

  function normalizeBeat(beat) {
    if (!beat?.pose) return null;
    return {
      id: String(beat.id || "beat"),
      at: Math.max(1, Math.round(Number(beat.at) || 1)),
      pose: normalizePose(beat.pose),
    };
  }

  function normalizePose(pose) {
    return Object.fromEntries(Object.entries(pose).map(([key, point]) => [key, normalizePoint(point)]));
  }

  function normalizePoint(point) {
    return [Math.round(Number(point?.[0]) || 0), Math.round(Number(point?.[1]) || 0)];
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

  Animotion.cutsceneModel = { createBridge, normalizeBridge, bridgeFrameFromTime, bridgeValues, inferEffectDirection };

  if (typeof module !== "undefined") module.exports = Animotion.cutsceneModel;
}
