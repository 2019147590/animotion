{
  const global = typeof window !== "undefined" ? window : globalThis;
  const Animotion = global.Animotion || (global.Animotion = {});
  const MAX_ACTIONS = 8;
  const MAX_TOTAL_FRAMES = 120;
  const ACTION_ALIASES = Object.freeze({ jab: "punch", rearCross: "rearHandPunch01" });
  const DEFAULT_COMBOS = Object.freeze({
    jab_jab_cross: comboSpec("jab_jab_cross", [
      { actionId: "jab", gapAfterFrames: 2 },
      { actionId: "jab", gapAfterFrames: 3 },
      { actionId: "rearCross", gapAfterFrames: 0 },
    ]),
  });

  /**
   * @typedef {{ actionId: string, gapAfterFrames: number, tempo: number, variant: object|null, options: object|null }} ComboActionItem
   * @typedef {{ id: string, actions: ComboActionItem[] }} ComboSpec
   */

  function comboSpec(id, actions) {
    return Object.freeze({ id, actions: Object.freeze(actions.map((item) => Object.freeze({ ...item }))) });
  }

  function specFor(id) {
    return normalizeComboSpec(DEFAULT_COMBOS[String(id || "")]);
  }

  function optionSpecs() {
    return Object.values(DEFAULT_COMBOS).map((spec) => ({ id: spec.id, label: spec.id }));
  }

  function normalizeComboSpec(spec = {}) {
    const id = String(spec?.id || "");
    const actions = (Array.isArray(spec?.actions) ? spec.actions : [])
      .map(normalizeActionItem)
      .filter(Boolean)
      .slice(0, MAX_ACTIONS);
    return id && actions.length ? { id, actions } : null;
  }

  function buildComboTimeline(comboSpecInput, initialPose = {}) {
    const spec = normalizeComboSpec(comboSpecInput);
    const context = comboContext(initialPose);
    if (!spec) return inactive("missing-combo-spec");
    if (!context.ok) return context;
    const merged = emptyMerge(context.parts);
    let offset = 0, lastStep = null;
    for (let index = 0; index < spec.actions.length; index += 1) {
      const step = buildActionStep(context, spec.actions[index], index + 1);
      if (!step.ok) return step;
      if (offset + step.totalFrames > MAX_TOTAL_FRAMES) return inactive("combo-too-long");
      appendStep(merged, step, offset);
      offset += step.totalFrames;
      lastStep = step;
    }
    return comboResult(context, spec, merged, lastStep, offset);
  }

  function comboContext(input) {
    const parts = Array.isArray(input.parts) ? input.parts : Animotion.state?.parts || [];
    if (!parts.length) return inactive("missing-parts");
    const selectedPartId = input.selectedPartId || Animotion.state?.selectedPartId || null;
    const basePrimary = selectedPrimary(parts, selectedPartId) || bodyRootPart(parts) || parts[0];
    const baseBridge = Animotion.cutsceneModel?.normalizeBridge?.(
      input.bridge || Animotion.cutsceneModel?.createBridge?.(parts, basePrimary?.id) || {},
      { assets: Animotion.state?.project?.assets || null }
    ) || {};
    const plan = Animotion.motionPlanner?.normalizePlan?.(input.plan || Animotion.state?.motionPlan || {}) || {};
    return { ok: true, parts, selectedPartId, basePrimary, baseBridge, plan, actionFrameGenerator: input.actionFrameGenerator || defaultActionFrameGenerator };
  }

  function buildActionStep(context, item, stepNumber) {
    const template = templateForActionId(item.actionId);
    const primary = primaryForAction(context, template);
    if (!template || !primary) return inactive("missing-primary", { actionId: item.actionId });
    const bridge = bridgeForAction(context, primary, template);
    const plan = stepPlan(context.plan, template, primary.id, item);
    const generated = context.actionFrameGenerator(context.parts, primary.id, bridge, plan, item);
    if (!generated?.jointAction?.beats?.length) return inactive("action-generator-failed", { actionId: item.actionId });
    const timeline = Animotion.cutsceneActionSelectors?.rawActionTimeline?.(generated.jointAction)
      || Animotion.actionTimelineModel?.timelineForTemplate?.(template, bridge) || {};
    const durationFrames = scaledFrame(maxFrame(generated.jointAction.beats), item.tempo);
    return { ok: true, item, stepNumber, template, primaryPartId: primary.id, bridge, plan, generated, timeline, durationFrames, totalFrames: durationFrames + item.gapAfterFrames };
  }

  function comboResult(context, spec, merged, lastStep, totalFrames) {
    const impactFrame = merged.lastImpactFrame || totalFrames;
    const bridge = { ...context.baseBridge, primaryPartId: lastStep.primaryPartId, durationFrames: totalFrames, impactFrame };
    const debug = comboDebug(spec, merged.steps, totalFrames);
    const action = {
      source: "combo-timeline-v1",
      focusKey: lastStep.generated.jointAction.focusKey,
      actionTimeline: { template: "punch", id: "punch", label: spec.id, durationFrames: totalFrames, impactFrame, beats: merged.timelineBeats },
      anchors: lastStep.generated.anchors || [],
      beats: merged.beats,
      comboTimeline: debug,
      targetDebug: { ...(lastStep.generated.targetDebug || {}), comboTimeline: debug },
      activeMotionTarget: lastStep.generated.activeMotionTarget || null,
      trajectoryPoints: lastStep.generated.trajectoryPoints || [],
      events: merged.events,
      impact: merged.impacts,
      patchSchedule: merged.patchSchedule,
      maskSchedule: merged.maskSchedule,
      effectTracks: merged.effectTracks,
      ...(lastStep.generated.jointAction.impactExaggeration ? { impactExaggeration: shiftImpactLayer(lastStep.generated.jointAction.impactExaggeration, lastStep.startOffset) } : {}),
    };
    return { handled: true, generated: true, comboSpec: spec, bridge: { ...bridge, jointAction: action }, plan: { ...lastStep.plan, template: lastStep.template }, result: { ...lastStep.generated, jointAction: action, partTracks: merged.tracks, targetDebug: action.targetDebug } };
  }

  function appendStep(merged, step, offset) {
    step.startOffset = offset;
    const prefix = `c${step.stepNumber}`;
    for (const beat of step.generated.jointAction.beats || []) {
      const shifted = shiftBeat(beat, prefix, offset, step.item.tempo);
      merged.beats.push(shifted);
      if (baseId(beat.id) === "impact") merged.lastImpactFrame = shifted.at;
    }
    for (const beat of step.timeline.beats || []) merged.timelineBeats.push(shiftBeat(beat, prefix, offset, step.item.tempo));
    for (const track of step.generated.partTracks || []) appendTrack(merged, track, offset, step);
    appendFrameItems(merged, step.generated.jointAction, offset, step.item.tempo);
    merged.steps.push(stepDebug(step, offset));
  }

  function appendTrack(merged, track, offset, step) {
    const target = merged.trackMap.get(track.partId);
    if (!target) return;
    const shifted = (track.keyframes || []).map((keyframe) => shiftKeyframe(keyframe, offset, step.item.tempo));
    target.keyframes.push(...shifted);
    if (step.item.gapAfterFrames > 0 && shifted.length) {
      const last = shifted[shifted.length - 1];
      target.keyframes.push({ ...last, frame: offset + step.totalFrames });
    }
  }

  function appendFrameItems(merged, action, offset, tempo) {
    merged.events.push(...shiftFrameList(action.events, offset, tempo));
    merged.impacts.push(...shiftImpactItems(action.impact, offset, tempo));
    merged.patchSchedule.push(...shiftFrameList(action.patchSchedule, offset, tempo));
    merged.maskSchedule.push(...shiftFrameList(action.maskSchedule, offset, tempo));
    const effects = Animotion.actionScopedEffects?.migratedEffectTracks?.(action, { durationFrames: maxFrame(action.beats) }) || action.effectTracks;
    merged.effectTracks.push(...shiftEffectTracks(effects, offset, tempo));
  }

  function primaryForAction(context, template) {
    if (!isPunchLike(template)) return selectedPrimary(context.parts, context.selectedPartId) || context.basePrimary;
    const desired = template === "punch" ? "jab" : Animotion.actionSpecs?.punchStyleFor?.(template);
    const ordered = [selectedPrimary(context.parts, context.selectedPartId), ...terminalArmParts(context.parts)].filter(Boolean).filter(uniquePart());
    return ordered.find((part) => !desired || genericPunchStyle(context, part) === desired) || ordered[0] || context.basePrimary;
  }

  function bridgeForAction(context, primary, template) {
    const timeline = Animotion.actionTimelineModel?.timelineForTemplate?.(template, context.baseBridge) || {};
    return { ...context.baseBridge, primaryPartId: primary.id, durationFrames: timeline.durationFrames || context.baseBridge.durationFrames || 18, impactFrame: timeline.impactFrame || Math.min(context.baseBridge.impactFrame || 15, timeline.durationFrames || 18), jointAction: null };
  }

  function stepPlan(basePlan, template, primaryPartId, item) {
    return { ...basePlan, ...(item.options?.plan || {}), template, selectedPartId: primaryPartId, target: null, targetNormalized: null, targetSource: null, activeMotionTarget: null, anchors: [], trajectoryPoints: [], selectedBeatId: null, targetDebug: null, motionDraft: null };
  }

  function stepDebug(step, offset) {
    return { index: step.stepNumber - 1, actionId: step.item.actionId, template: step.template, primaryPartId: step.primaryPartId, focusKey: step.generated.jointAction.focusKey || null, startFrame: offset + 1, endFrame: offset + step.durationFrames, holdEndFrame: offset + step.totalFrames, gapAfterFrames: step.item.gapAfterFrames, impactFrame: impactFrameFor(step, offset), tempo: step.item.tempo, variant: step.item.variant, options: step.item.options };
  }

  function impactFrameFor(step, offset) {
    const impact = (step.generated.jointAction.beats || []).find((beat) => baseId(beat.id) === "impact");
    return impact ? offset + scaledFrame(impact.at, step.item.tempo) : null;
  }

  function genericPunchStyle(context, primary) {
    const bridge = bridgeForAction(context, primary, "punch");
    return defaultActionFrameGenerator(context.parts, primary.id, bridge, stepPlan(context.plan, "punch", primary.id, { options: {} }))?.targetDebug?.punchStyle || null;
  }

  function comboDebug(spec, steps, totalFrames) {
    return { id: spec.id, actions: spec.actions, steps, totalFrames };
  }

  function defaultActionFrameGenerator(parts, primaryId, bridge, plan) {
    return Animotion.motionPlanner?.createPlan?.(parts, primaryId, bridge, plan);
  }

  function normalizeActionItem(item = {}) {
    const actionId = String(item.actionId || "");
    if (!templateForActionId(actionId)) return null;
    return { actionId, gapAfterFrames: clampInt(item.gapAfterFrames, 0, 24, 0), tempo: clampNumber(item.tempo, 0.25, 4, 1), variant: objectOrNull(item.variant), options: objectOrNull(item.options) };
  }

  function shiftBeat(beat, prefix, offset, tempo) { return { ...beat, id: `${prefix}:${baseId(beat.id)}`, at: offset + scaledFrame(beat.at, tempo) }; }
  function shiftKeyframe(keyframe, offset, tempo) { return { ...keyframe, frame: offset + scaledFrame(keyframe.frame, tempo) }; }
  function shiftFrameList(list, offset, tempo) { return (Array.isArray(list) ? list : []).map((item) => shiftFrameObject(item, offset, tempo)); }
  function shiftImpactItems(value, offset, tempo) { return Array.isArray(value) ? shiftFrameList(value, offset, tempo) : value ? [shiftFrameObject(value, offset, tempo)] : []; }
  function shiftEffectTracks(list, offset, tempo) { return (Array.isArray(list) ? list : []).map((effect) => Animotion.actionScopedEffects?.shiftEffect?.(effect, offset, tempo, effect.actionId)).filter(Boolean); }
  function shiftFrameObject(item, offset, tempo) { return Object.fromEntries(Object.entries(item || {}).map(([key, value]) => [key, frameKey(key) ? offset + scaledFrame(value, tempo) : value])); }
  function shiftImpactLayer(layer, offset) { return layer ? { ...layer, frame: Math.round(Number(layer.frame) || 1) + offset } : null; }
  function frameKey(key) { return /^(at|frame|startFrame|endFrame|impactFrame)$/.test(key); }
  function scaledFrame(frame, tempo = 1) { return Math.max(1, Math.round(1 + (Math.round(Number(frame) || 1) - 1) / tempo)); }
  function emptyMerge(parts) { const tracks = parts.map((part) => ({ partId: part.id, keyframes: [] })); return { beats: [], timelineBeats: [], tracks, trackMap: new Map(tracks.map((track) => [track.partId, track])), events: [], impacts: [], patchSchedule: [], maskSchedule: [], effectTracks: [], steps: [], lastImpactFrame: null }; }
  function templateForActionId(actionId) { return ACTION_ALIASES[actionId] || (Animotion.actionSpecs?.hasSpec?.(actionId) ? actionId : null); }
  function terminalArmParts(parts) { const seen = new Set(); return parts.map((part) => Animotion.armChainResolver?.resolve?.(parts, part)?.terminalPart || (isArmPart(part) ? part : null)).filter(Boolean).filter((part) => !seen.has(part.id) && seen.add(part.id)); }
  function selectedPrimary(parts, selectedPartId) { return Animotion.motionPrimarySelection?.selectedPrimary?.(parts, selectedPartId, "punch") || parts.find((part) => part.id === selectedPartId) || null; }
  function bodyRootPart(parts) { return parts.find((part) => ["torso", "pelvis"].includes(part.humanRole)) || parts.find((part) => part.type === "spine" || part.type === "body") || null; }
  function isPunchLike(template) { return Animotion.actionSpecs?.isPunchLike?.(template) || template === "punch"; }
  function isArmPart(part = {}) { return ["upperArm", "forearm", "hand", "glove"].includes(part.humanRole) || ["arm", "hand", "glove"].includes(part.type); }
  function maxFrame(beats = []) { return beats.reduce((max, beat) => Math.max(max, Math.round(Number(beat.at) || 1)), 1); }
  function baseId(id) { return String(id || "beat").split(":").pop(); }
  function objectOrNull(value) { return value && typeof value === "object" && !Array.isArray(value) ? JSON.parse(JSON.stringify(value)) : null; }
  function clampInt(value, min, max, fallback) { return Math.round(clampNumber(value, min, max, fallback)); }
  function clampNumber(value, min, max, fallback) { const number = Number(value); return Number.isFinite(number) ? Math.min(max, Math.max(min, number)) : fallback; }
  function uniquePart() { const seen = new Set(); return (part) => !seen.has(part.id) && seen.add(part.id); }
  function inactive(reason, extras = {}) { return { handled: true, generated: false, reason, ...extras }; }

  Animotion.comboTimeline = { MAX_ACTIONS, MAX_TOTAL_FRAMES, ACTION_ALIASES, DEFAULT_COMBOS, specFor, optionSpecs, normalizeComboSpec, buildComboTimeline };
  if (typeof module !== "undefined") module.exports = Animotion.comboTimeline;
}
