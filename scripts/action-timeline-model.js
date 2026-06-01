{
  const global = typeof window !== "undefined" ? window : globalThis;
  const Animotion = global.Animotion || (global.Animotion = {});

  const DEFAULT_DURATION_FRAMES = 18;
  const DEFAULT_IMPACT_FRAME = 15;
  const FALLBACK_SPECS = {
    punch: fallbackSpec("punch", "Punch", focus("bodyPart", "forearm", "handTip"), "body-follow", [
      beat("guard", 0, 0, 0, 0),
      beat("windup", 0.2, -0.24, 0.06, 0.1),
      beat("drive", 0.52, 0.18, -0.03, 0.62),
      beat("extension", 0.78, 0.38, -0.01, 0.9),
      beat("impact", 1, 0, 0, 1),
      beat("recover", "duration", 0.04, 0.02, 0.22),
    ]),
    kick: fallbackSpec("kick", "Kick", focus("bodyPart", "shin", "footTip"), "body-follow", [
      beat("ready", 0, 0, 0, 0),
      beat("compress", 0.18, -0.2, 0.1, 0.14),
      beat("chamber", 0.46, 0.04, -0.16, 0.38),
      beat("extend", 0.76, 0.42, -0.06, 0.84),
      beat("impact", 1, 0, 0, 1),
      beat("recover", "duration", 0.04, 0.02, 0.22),
    ]),
  };

  function timelineForTemplate(templateId, options = {}) {
    return normalizeTimeline(specFor(templateId) || specFor("kick"), options);
  }

  function normalizeTimeline(input = {}, options = {}) {
    const source = sourceTimeline(input);
    const templateId = supportedTemplate(source.template || source.id);
    const spec = specFor(templateId);
    const durationFrames = clampInt(source.durationFrames ?? options.durationFrames, 2, 240, spec?.defaultDurationFrames || DEFAULT_DURATION_FRAMES);
    const impactFrame = normalizedImpactFrame(source, options, durationFrames, spec);
    return {
      template: templateId,
      id: templateId,
      label: String(source.label || spec.label),
      durationFrames,
      impactFrame,
      primaryPartRole: normalizeRole(source.primaryPartRole, focusRole(spec.primaryFocus)),
      rootMotionHint: normalizeRootMotionHint(source.rootMotionHint, { motionScope: spec.motionScope }),
      beats: normalizeBeats(source.beats || spec.beats, durationFrames, impactFrame, spec),
    };
  }

  function normalizeBeats(beats = [], durationFrames, impactFrame, spec) {
    return (Array.isArray(beats) ? beats : []).map((entry) => normalizeBeat(entry, durationFrames, impactFrame, spec)).filter(Boolean);
  }

  function normalizeBeat(entry, durationFrames, impactFrame, spec) {
    if (!entry) return null;
    const id = String(entry.id || "beat");
    const position = entry.position ?? entry.phase;
    const phase = position === "duration" ? 1 : numberOrDefault(position, 0);
    return {
      id,
      phase,
      at: clampInt(entry.at ?? frameForPosition(position, durationFrames, impactFrame, spec), 1, durationFrames, id === "recover" || id === "settle" ? durationFrames : 1),
      recoil: numberOrDefault(entry.recoil, 0),
      lift: numberOrDefault(entry.lift, 0),
      reach: numberOrDefault(entry.reach, 0),
    };
  }

  function sourceTimeline(input) {
    if (typeof input === "string") return specFor(input) || specFor("kick");
    const template = input?.template || input?.id;
    return template && specFor(template) ? { ...specFor(template), ...input } : input;
  }

  function normalizedImpactFrame(source, options, durationFrames, spec) {
    const fallback = spec.family === "locomotion" ? durationFrames : Math.min(DEFAULT_IMPACT_FRAME, durationFrames);
    return clampInt(source.impactFrame ?? options.impactFrame, 1, durationFrames, fallback);
  }

  function frameForPosition(position, durationFrames, impactFrame, spec) {
    if (position === "duration") return durationFrames;
    const focusFrame = spec.family === "locomotion" ? durationFrames : impactFrame;
    return Math.round(1 + (focusFrame - 1) * numberOrDefault(position, 0));
  }

  function templateIds() {
    return Animotion.actionSpecs?.timelineTemplateIds?.() || Object.keys(FALLBACK_SPECS);
  }

  function hasTemplate(templateId) {
    return Boolean(specFor(templateId));
  }

  function supportedTemplate(templateId) {
    return hasTemplate(templateId) ? String(templateId) : "kick";
  }

  function specFor(templateId) {
    return Animotion.actionSpecs?.timelineSpecFor?.(templateId) || FALLBACK_SPECS[String(templateId || "")] || null;
  }

  function fallbackSpec(id, label, primaryFocus, motionScope, beats) {
    return { id, template: id, label, family: "attack", primaryFocus, motionScope, beats };
  }

  function focus(owner, role, point) {
    return { owner, role, point };
  }

  function focusRole(primaryFocus) {
    return primaryFocus && typeof primaryFocus === "object" ? primaryFocus.role : primaryFocus;
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

  Animotion.actionTimelineModel = { templateIds, hasTemplate, timelineForTemplate, normalizeTimeline };
  if (typeof module !== "undefined") module.exports = Animotion.actionTimelineModel;
}
