{
  const global = typeof window !== "undefined" ? window : globalThis;
  const Animotion = global.Animotion || (global.Animotion = {});
  const MAX_STEPS = 6;
  const MAX_TOTAL_FRAMES = 120;
  const DEFAULT_STEPS = ["punch", "punch", "rearHandPunch01"];

  function defaultSequence() {
    return { steps: DEFAULT_STEPS.map((template) => ({ template })) };
  }

  function normalizeSequence(sequence = {}) {
    const source = Array.isArray(sequence) ? sequence : sequence.steps;
    const steps = (Array.isArray(source) ? source : [])
      .map(normalizeStep)
      .filter(Boolean)
      .slice(0, MAX_STEPS);
    return { steps };
  }

  function clipFromProjectPayload(payload, options = {}) {
    if (!Animotion.projectModel?.isProjectPayload?.(payload)) return null;
    const bounds = canvasBounds(payload);
    const project = Animotion.projectModel.normalizeProject(payload, { imageBounds: bounds });
    const bridge = Animotion.cutsceneModel?.normalizeBridge?.(project.editor?.cutsceneBridge, { imageBounds: bounds, assets: project.assets }) || null;
    if (!bridge?.jointAction?.beats?.length) return null;
    const parts = Animotion.projectModel.editorPartsFromProject(project);
    const id = String(options.id || project.metadata?.name || `json-${Date.now()}`);
    return {
      id,
      name: String(options.name || project.metadata?.name || id),
      source: "project-json",
      primaryPartId: bridge.primaryPartId,
      durationFrames: bridge.durationFrames,
      impactFrame: bridge.impactFrame,
      bridge: clonePlain(bridge),
      parts: clonePlain(parts),
      partTracks: parts.map((part) => ({ partId: part.id, keyframes: clonePlain(part.keyframes || []) })),
    };
  }

  function compileSequence(parts = [], sequence = {}, options = {}) {
    const normalized = normalizeSequence(sequence);
    if (!normalized.steps.length) return inactive("empty-sequence");
    const sourceParts = parts?.length ? parts : firstClipParts(normalized, options.clips || Animotion.state?.actionSequenceClips);
    const context = compileContext(sourceParts, options);
    if (!context.ok) return context;
    const merged = emptyMerge(context.parts);
    let frameOffset = 0, lastStep = null;
    for (let index = 0; index < normalized.steps.length; index += 1) {
      const step = buildStep(context, normalized.steps[index], index + 1);
      if (!step.ok) return step;
      if (frameOffset + step.durationFrames > MAX_TOTAL_FRAMES) return inactive("sequence-too-long");
      mergeStep(merged, step, frameOffset);
      frameOffset += step.durationFrames;
      lastStep = step;
    }
    return compiledResult(context, normalized, merged, lastStep, frameOffset);
  }

  function compileContext(parts, options) {
    if (!Array.isArray(parts) || !parts.length) return inactive("missing-parts");
    const plan = Animotion.motionPlanner?.normalizePlan?.(options.plan || Animotion.state?.motionPlan || {}) || {};
    const selectedPartId = options.selectedPartId || Animotion.state?.selectedPartId || plan.selectedPartId || null;
    const selected = parts.find((part) => part.id === selectedPartId) || null;
    const basePrimary = selectedPrimary(parts, selectedPartId) || selected || bodyRootPart(parts) || parts[0];
    const baseBridge = Animotion.cutsceneModel?.normalizeBridge?.(
      options.bridge || Animotion.cutsceneModel?.createBridge?.(parts, basePrimary?.id) || {},
      { assets: Animotion.state?.project?.assets || null }
    ) || {};
    return { ok: true, parts, plan, selectedPartId, basePrimary, baseBridge, clips: clipsById(options.clips || Animotion.state?.actionSequenceClips) };
  }

  function buildStep(context, step, stepNumber) {
    if (step.clipId) return buildClipStep(context, step, stepNumber);
    const primary = primaryForStep(context, step.template);
    if (!primary) return inactive("missing-primary", { template: step.template });
    const bridge = bridgeForStep(context, primary, step.template);
    const plan = stepPlan(context.plan, step.template, primary.id);
    const result = Animotion.motionPlanner?.createPlan?.(context.parts, primary.id, bridge, plan);
    if (!result?.jointAction?.beats?.length) return inactive("planner-failed", { template: step.template, primaryPartId: primary.id });
    const timeline = Animotion.cutsceneActionSelectors?.rawActionTimeline?.(result.jointAction)
      || Animotion.actionTimelineModel?.timelineForTemplate?.(step.template, bridge)
      || {};
    return {
      ok: true,
      stepNumber,
      template: step.template,
      label: labelForTemplate(step.template),
      primaryPartId: primary.id,
      bridge,
      plan,
      result,
      timeline,
      durationFrames: Math.max(1, Math.round(Number(timeline.durationFrames || bridge.durationFrames || maxFrame(result.jointAction.beats)))),
      impactFrame: Math.max(1, Math.round(Number(timeline.impactFrame || bridge.impactFrame || 1))),
    };
  }

  function buildClipStep(context, step, stepNumber) {
    const clip = context.clips.get(step.clipId);
    if (!clip?.bridge?.jointAction?.beats?.length) return inactive("missing-clip", { clipId: step.clipId });
    const bridge = clip.bridge, action = bridge.jointAction;
    const timeline = Animotion.cutsceneActionSelectors?.rawActionTimeline?.(action) || timelineFromBeats(action, bridge);
    return {
      ok: true,
      stepNumber,
      template: Animotion.cutsceneActionSelectors?.actionTemplate?.(action) || "punch",
      label: clip.name,
      clipId: clip.id,
      primaryPartId: clip.primaryPartId || bridge.primaryPartId || context.basePrimary?.id || null,
      bridge,
      plan: { ...context.plan, template: Animotion.cutsceneActionSelectors?.actionTemplate?.(action) || context.plan.template },
      result: {
        jointAction: action,
        partTracks: clip.partTracks || [],
        anchors: action.anchors || [],
        target: action.activeMotionTarget?.point || primaryAnchorPoint(action.anchors),
        targetDebug: action.targetDebug || null,
        activeMotionTarget: action.activeMotionTarget || null,
        trajectoryPoints: action.trajectoryPoints || [],
      },
      timeline,
      durationFrames: Math.max(1, Math.round(Number(clip.durationFrames || bridge.durationFrames || maxFrame(action.beats)))),
      impactFrame: Math.max(1, Math.round(Number(clip.impactFrame || bridge.impactFrame || 1))),
    };
  }

  function compiledResult(context, sequence, merged, lastStep, totalFrames) {
    const impactFrame = merged.lastImpactFrame || totalFrames;
    const bridge = {
      ...context.baseBridge,
      primaryPartId: lastStep.primaryPartId,
      durationFrames: totalFrames,
      impactFrame,
    };
    const action = {
      source: "motion-planner-sequence-v1",
      focusKey: lastStep.result.jointAction.focusKey,
      actionTimeline: sequenceTimeline(merged, totalFrames, impactFrame),
      anchors: lastStep.result.anchors || [],
      beats: merged.beats,
      targetDebug: { ...(lastStep.result.targetDebug || {}), actionSequence: sequenceDebug(merged, sequence, totalFrames) },
      activeMotionTarget: lastStep.result.activeMotionTarget,
      trajectoryPoints: lastStep.result.trajectoryPoints,
      trajectorySamples: lastStep.result.trajectorySamples,
    };
    return {
      handled: true,
      generated: true,
      sequence,
      bridge: { ...bridge, jointAction: action },
      plan: { ...lastStep.plan, template: lastStep.template },
      result: {
        ...lastStep.result,
        jointAction: action,
        partTracks: merged.tracks,
        anchors: lastStep.result.anchors || [],
        target: lastStep.result.target,
        targetDebug: action.targetDebug,
        activeMotionTarget: lastStep.result.activeMotionTarget,
        trajectoryPoints: lastStep.result.trajectoryPoints,
      },
    };
  }

  function primaryForStep(context, template) {
    if (specFor(template)?.family === "locomotion") return bodyRootPart(context.parts) || context.basePrimary;
    if (!isPunchLike(template)) return selectedPrimary(context.parts, context.selectedPartId) || context.basePrimary;
    const desiredStyle = template === "punch" ? "jab" : Animotion.actionSpecs?.punchStyleFor?.(template);
    const candidates = terminalArmParts(context.parts);
    const selected = selectedPrimary(context.parts, context.selectedPartId);
    const ordered = [selected, ...candidates].filter(Boolean).filter(uniquePart());
    if (!desiredStyle) return ordered[0] || context.basePrimary;
    return ordered.find((part) => genericPunchStyle(context, part) === desiredStyle) || ordered[0] || context.basePrimary;
  }

  function genericPunchStyle(context, primary) {
    const bridge = bridgeForStep(context, primary, "punch");
    const plan = stepPlan(context.plan, "punch", primary.id);
    return Animotion.motionPlanner?.createPlan?.(context.parts, primary.id, bridge, plan)?.targetDebug?.punchStyle || null;
  }

  function bridgeForStep(context, primary, template) {
    const timeline = Animotion.actionTimelineModel?.timelineForTemplate?.(template, context.baseBridge) || {};
    return {
      ...context.baseBridge,
      primaryPartId: primary.id,
      durationFrames: timeline.durationFrames || specFor(template)?.defaultDurationFrames || context.baseBridge.durationFrames || 18,
      impactFrame: timeline.impactFrame || Math.min(context.baseBridge.impactFrame || 15, timeline.durationFrames || 18),
      jointAction: null,
    };
  }

  function stepPlan(basePlan, template, primaryPartId) {
    return {
      ...basePlan,
      template,
      target: null,
      targetNormalized: null,
      targetSource: null,
      activeMotionTarget: null,
      anchors: [],
      trajectoryPoints: [],
      selectedBeatId: null,
      targetDebug: null,
      motionDraft: null,
      selectedPartId: primaryPartId,
    };
  }

  function mergeStep(merged, step, offset) {
    const prefix = `s${step.stepNumber}`;
    for (const beat of step.result.jointAction.beats || []) {
      const shifted = shiftedBeat(beat, prefix, offset);
      merged.beats.push(shifted);
      if (baseBeatId(beat.id) === "impact") merged.lastImpactFrame = shifted.at;
    }
    for (const beat of step.timeline.beats || []) merged.timelineBeats.push(shiftedTimelineBeat(beat, prefix, offset));
    for (const track of step.result.partTracks || []) {
      const target = merged.trackMap.get(track.partId);
      if (target) target.keyframes.push(...(track.keyframes || []).map((keyframe) => shiftedKeyframe(keyframe, offset)));
    }
    merged.steps.push({ template: step.template, label: step.label, primaryPartId: step.primaryPartId, clipId: step.clipId || null, startFrame: offset + 1, endFrame: offset + step.durationFrames, impactFrame: offset + step.impactFrame });
  }

  function emptyMerge(parts) {
    const tracks = parts.map((part) => ({ partId: part.id, keyframes: [] }));
    return { beats: [], timelineBeats: [], tracks, trackMap: new Map(tracks.map((track) => [track.partId, track])), steps: [], lastImpactFrame: null };
  }

  function sequenceTimeline(merged, durationFrames, impactFrame) {
    return { template: "punch", id: "punch", label: "Action sequence", durationFrames, impactFrame, beats: merged.timelineBeats };
  }

  function sequenceDebug(merged, sequence, totalFrames) {
    return { id: "action-sequence-v1", steps: merged.steps, requestedSteps: sequence.steps, totalFrames };
  }

  function shiftedBeat(beat, prefix, offset) {
    return { ...beat, id: `${prefix}:${baseBeatId(beat.id)}`, at: Math.round(Number(beat.at) || 1) + offset };
  }

  function shiftedTimelineBeat(beat, prefix, offset) {
    return { ...beat, id: `${prefix}:${baseBeatId(beat.id)}`, at: Math.round(Number(beat.at) || 1) + offset };
  }

  function shiftedKeyframe(keyframe, offset) {
    return { ...keyframe, frame: Math.round(Number(keyframe.frame) || 1) + offset };
  }

  function terminalArmParts(parts) {
    const seen = new Set();
    return parts.map((part) => Animotion.armChainResolver?.resolve?.(parts, part)?.terminalPart || (isArmPart(part) ? part : null))
      .filter(Boolean)
      .filter((part) => !seen.has(part.id) && seen.add(part.id));
  }

  function selectedPrimary(parts, selectedPartId) {
    return Animotion.motionPrimarySelection?.selectedPrimary?.(parts, selectedPartId, "punch") || parts.find((part) => part.id === selectedPartId) || null;
  }

  function bodyRootPart(parts) {
    return parts.find((part) => ["torso", "pelvis"].includes(part.humanRole)) || parts.find((part) => part.type === "spine" || part.type === "body") || null;
  }

  function normalizeStep(step) {
    if (typeof step === "object" && step?.clipId) return { clipId: String(step.clipId) };
    const template = typeof step === "string" ? step : step?.template;
    return specFor(template) ? { template: String(template) } : null;
  }

  function clipsById(clips = []) {
    return new Map((Array.isArray(clips) ? clips : []).filter((clip) => clip?.id).map((clip) => [String(clip.id), clip]));
  }
  function firstClipParts(sequence, clips = []) { const ids = new Set(sequence.steps.map((step) => step.clipId).filter(Boolean)); return (clips || []).find((clip) => ids.has(clip.id) && clip.parts?.length)?.parts || []; }

  function timelineFromBeats(action, bridge) {
    return { template: Animotion.cutsceneActionSelectors?.actionTemplate?.(action) || "punch", durationFrames: bridge.durationFrames || maxFrame(action.beats), impactFrame: bridge.impactFrame || 1, beats: action.beats || [] };
  }

  function primaryAnchorPoint(anchors = []) { return (Array.isArray(anchors) ? anchors : []).find((anchor) => anchor.role === "primary")?.point || null; }
  function canvasBounds(payload = {}) { return { width: Math.round(Number(payload.canvas?.width) || 1), height: Math.round(Number(payload.canvas?.height) || 1) }; }
  function clonePlain(value) { return JSON.parse(JSON.stringify(value)); }

  function specFor(template) { return Animotion.actionSpecs?.specFor?.(template) || null; }
  function isPunchLike(template) { return Animotion.actionSpecs?.isPunchLike?.(template) || template === "punch"; }
  function isArmPart(part = {}) { return ["upperArm", "forearm", "hand", "glove"].includes(part.humanRole) || ["arm", "hand", "glove"].includes(part.type); }
  function labelForTemplate(template) { return template === "punch" ? "Jab" : specFor(template)?.label || template; }
  function baseBeatId(id) { return String(id || "beat").split(":").pop(); }
  function maxFrame(beats = []) { return beats.reduce((max, beat) => Math.max(max, Math.round(Number(beat.at) || 1)), 1); }
  function uniquePart() { const seen = new Set(); return (part) => !seen.has(part.id) && seen.add(part.id); }
  function inactive(reason, extras = {}) { return { handled: true, generated: false, reason, ...extras }; }

  Animotion.actionSequence = { MAX_STEPS, MAX_TOTAL_FRAMES, defaultSequence, normalizeSequence, clipFromProjectPayload, compileSequence };
  if (typeof module !== "undefined") module.exports = Animotion.actionSequence;
}
