{
  const global = typeof window !== "undefined" ? window : globalThis;
  const Animotion = global.Animotion || (global.Animotion = {});

  const DEFAULT_DURATION_FRAMES = 18;
  const DEFAULT_IMPACT_FRAME = 15;
  const TIMELINES = Object.freeze({
    punch: timeline("punch", "펀치", "forearm", "body-follow", [
      beat("guard", 0, 0, 0, 0),
      beat("windup", 0.2, -0.24, 0.06, 0.1),
      beat("drive", 0.52, 0.18, -0.03, 0.62),
      beat("extension", 0.78, 0.38, -0.01, 0.9),
      beat("impact", 1, 0, 0, 1),
      beat("recover", "duration", 0.04, 0.02, 0.22),
    ]),
    kick: timeline("kick", "킥", "shin", "body-follow", [
      beat("ready", 0, 0, 0, 0),
      beat("compress", 0.18, -0.2, 0.1, 0.14),
      beat("chamber", 0.46, 0.04, -0.16, 0.38),
      beat("extend", 0.76, 0.42, -0.06, 0.84),
      beat("impact", 1, 0, 0, 1),
      beat("recover", "duration", 0.04, 0.02, 0.22),
    ]),
  });

  function timelineForTemplate(templateId, options = {}) {
    return normalizeTimeline(TIMELINES[templateId] || TIMELINES.kick, options);
  }

  function normalizeTimeline(input = {}, options = {}) {
    const source = typeof input === "string" ? TIMELINES[input] || TIMELINES.kick : input;
    const durationFrames = clampInt(source.durationFrames ?? options.durationFrames, 2, 240, DEFAULT_DURATION_FRAMES);
    const impactFrame = clampInt(source.impactFrame ?? options.impactFrame, 1, durationFrames, Math.min(DEFAULT_IMPACT_FRAME, durationFrames));
    const templateId = supportedTemplate(source.template || source.id);
    return {
      template: templateId,
      id: templateId,
      label: String(source.label || TIMELINES[templateId].label),
      durationFrames,
      impactFrame,
      primaryPartRole: normalizeRole(source.primaryPartRole, TIMELINES[templateId].primaryPartRole),
      rootMotionHint: normalizeRootMotionHint(source.rootMotionHint, TIMELINES[templateId].rootMotionHint),
      beats: normalizeBeats(source.beats || TIMELINES[templateId].beats, durationFrames, impactFrame),
    };
  }

  function normalizeBeats(beats = [], durationFrames, impactFrame) {
    return (Array.isArray(beats) ? beats : []).map((entry) => normalizeBeat(entry, durationFrames, impactFrame)).filter(Boolean);
  }

  function normalizeBeat(entry, durationFrames, impactFrame) {
    if (!entry) return null;
    const id = String(entry.id || "beat");
    const position = entry.position ?? entry.phase;
    const phase = position === "duration" ? 1 : numberOrDefault(position, 0);
    return {
      id,
      phase,
      at: clampInt(entry.at ?? frameForPosition(position, durationFrames, impactFrame), 1, durationFrames, id === "recover" ? durationFrames : 1),
      recoil: numberOrDefault(entry.recoil, 0),
      lift: numberOrDefault(entry.lift, 0),
      reach: numberOrDefault(entry.reach, 0),
    };
  }

  function frameForPosition(position, durationFrames, impactFrame) {
    if (position === "duration") return durationFrames;
    return Math.round(1 + (impactFrame - 1) * numberOrDefault(position, 0));
  }

  function templateIds() {
    return Object.keys(TIMELINES);
  }

  function hasTemplate(templateId) {
    return Boolean(TIMELINES[templateId]);
  }

  function supportedTemplate(templateId) {
    return hasTemplate(templateId) ? String(templateId) : "kick";
  }

  function timeline(id, label, primaryPartRole, rootMotionScope, beats) {
    return { id, template: id, label, primaryPartRole, rootMotionHint: { motionScope: rootMotionScope }, beats };
  }

  function beat(id, phase, recoil, lift, reach) {
    return { id, phase, recoil, lift, reach };
  }

  function normalizeRole(role, fallback) {
    return Animotion.humanRigSchema?.normalizeRole?.(role) || fallback;
  }

  function normalizeRootMotionHint(hint, fallback = {}) {
    const source = hint && typeof hint === "object" ? hint : fallback;
    const motionScope = ["limb-only", "body-follow", "full-character"].includes(source.motionScope) ? source.motionScope : "body-follow";
    return { motionScope };
  }

  function clampInt(value, min, max, fallback) {
    return Math.round(Math.min(max, Math.max(min, numberOrDefault(value, fallback))));
  }

  function numberOrDefault(value, fallback) {
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
  }

  Animotion.actionTimelineModel = { TIMELINES, templateIds, hasTemplate, timelineForTemplate, normalizeTimeline };
  if (typeof module !== "undefined") module.exports = Animotion.actionTimelineModel;
}
