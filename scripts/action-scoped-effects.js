{
  const global = typeof window !== "undefined" ? window : globalThis;
  const Animotion = global.Animotion || (global.Animotion = {});
  const TYPES = Object.freeze(["patchVisibility", "hiddenCompletion", "visibilityMask", "depthOverride", "impactFlash"]);

  function frameContext(action = {}, frame = 1) {
    const globalFrame = normalizeFrame(frame);
    const combo = action.comboTimeline || action.targetDebug?.comboTimeline || null;
    const step = comboStep(combo, globalFrame);
    if (step) {
      return {
        actionId: normalizeActionId(step.actionId),
        localFrame: Math.max(1, globalFrame - normalizeFrame(step.startFrame) + 1),
        globalFrame,
        comboId: combo.id || null,
        actionIndex: Math.max(0, Math.round(Number(step.index) || 0)),
      };
    }
    return { actionId: actionIdFor(action), localFrame: globalFrame, globalFrame, comboId: null, actionIndex: 0 };
  }

  function actionIdFor(action = {}) {
    const explicit = normalizeActionId(action.actionId || action.id);
    if (explicit) return explicit;
    const style = action.targetDebug?.punchStyle;
    if (style === "rear-cross") return "rearCross";
    if (style === "jab") return "jab";
    const timeline = timelineFor(action);
    const template = Animotion.cutsceneActionSelectors?.actionTemplate?.(action) || timeline?.template || null;
    if (template === "rearHandPunch01") return "rearCross";
    if (template === "punch") return "jab";
    return normalizeActionId(template || action.source) || null;
  }

  function normalizeEffectTracks(value = [], options = {}) {
    const defaults = { actionId: normalizeActionId(options.actionId), durationFrames: normalizeFrame(options.durationFrames || 1) };
    return (Array.isArray(value) ? value : [])
      .map((effect) => normalizeEffect(effect, defaults))
      .filter(Boolean);
  }

  function migratedEffectTracks(action = {}, options = {}) {
    const actionId = actionIdFor(action);
    const durationFrames = normalizeFrame(options.durationFrames || timelineFor(action)?.durationFrames || 1);
    const existing = normalizeEffectTracks(action.effectTracks, { actionId, durationFrames });
    if (existing.length) return existing;
    const legacy = legacyEffects(action, actionId, durationFrames);
    return dedupeEffects([...existing, ...legacy]);
  }

  function effectsForFrame(action = {}, frame = 1, type = null) {
    const context = frameContext(action, frame);
    return normalizeEffectTracks(action.effectTracks, { actionId: actionIdFor(action), durationFrames: timelineFor(action)?.durationFrames })
      .filter((effect) => (!type || effect.type === type) && effectMatches(effect, context));
  }

  function draftAllowed(draft = {}, action = {}, frame = 1, partId = null) {
    const context = frameContext(action, frame);
    if (!ownerMatches(draft, context)) return false;
    const hidden = draft.hiddenCompletion || {};
    if (!ownerMatches(hidden, context)) return false;
    const tracks = effectsForFrame(action, frame, "hiddenCompletion");
    if (!tracks.length) return context.actionId !== "jab";
    return tracks.some((effect) => (
      (!partId || !effect.partId || effect.partId === partId) &&
      (!hidden.assetId || !effect.assetId || effect.assetId === hidden.assetId)
    ));
  }

  function supplementalAllowed(part = {}, action = {}, frame = 1) {
    const context = frameContext(action, frame);
    if (!ownerMatches(part, context)) return false;
    const tracks = effectsForFrame(action, frame, "hiddenCompletion");
    if (!tracks.length) return context.actionId !== "jab";
    return tracks.some((effect) => (
      (!effect.partId || effect.partId === part.sourcePartId) &&
      (!effect.assetId || effect.assetId === part.sourcePatchAssetId)
    ));
  }

  function shiftEffect(effect = {}, offset = 0, tempo = 1, sourceActionId = null) {
    const normalized = normalizeEffect(effect, { actionId: sourceActionId, durationFrames: effect.endLocalFrame || effect.localFrame || 1 });
    if (!normalized) return null;
    const localFrame = scaledFrame(normalized.localFrame, tempo);
    const endLocalFrame = scaledFrame(normalized.endLocalFrame || normalized.localFrame, tempo);
    return {
      ...normalized,
      sourceActionId: normalizeActionId(sourceActionId || normalized.actionId),
      sourceLocalFrame: localFrame,
      sourceEndLocalFrame: endLocalFrame,
      globalFrame: offset + localFrame,
      endGlobalFrame: offset + endLocalFrame,
    };
  }

  function normalizeEffect(effect = {}, defaults = {}) {
    const type = TYPES.includes(effect.type) ? effect.type : null;
    if (!type) return null;
    const actionId = normalizeActionId(effect.actionId || effect.ownerActionId || effect.sourceActionId || defaults.actionId);
    const localFrame = normalizeFrame(effect.localFrame || effect.sourceLocalFrame || effect.frame || effect.at || effect.startFrame || 1);
    const endLocalFrame = normalizeFrame(effect.endLocalFrame || effect.sourceEndLocalFrame || effect.endFrame || defaults.durationFrames || localFrame);
    return {
      ...clone(effect),
      type,
      actionId,
      ownerActionId: normalizeActionId(effect.ownerActionId || actionId),
      localFrame,
      endLocalFrame: Math.max(localFrame, endLocalFrame),
    };
  }

  function legacyEffects(action, actionId, durationFrames) {
    const result = [];
    for (const draft of actionDrafts(action)) {
      const hidden = draft.hiddenCompletion || {};
      if (!draft.partId || hidden.assetStatus !== "ready" || !hidden.assetId) continue;
      result.push({ type: "hiddenCompletion", actionId, ownerActionId: actionId, localFrame: 1, endLocalFrame: durationFrames, partId: draft.partId, assetId: hidden.assetId });
    }
    for (const item of Array.isArray(action.patchSchedule) ? action.patchSchedule : []) result.push(frameEffect("patchVisibility", item, actionId, durationFrames));
    for (const item of Array.isArray(action.maskSchedule) ? action.maskSchedule : []) result.push(frameEffect("visibilityMask", item, actionId, durationFrames));
    return result.filter(Boolean);
  }

  function frameEffect(type, item = {}, actionId, durationFrames) {
    return normalizeEffect({ ...item, type, actionId, ownerActionId: actionId, localFrame: item.localFrame || item.at || item.frame || item.startFrame || 1, endLocalFrame: item.endLocalFrame || item.endFrame || item.at || item.frame || durationFrames }, { actionId, durationFrames });
  }

  function effectMatches(effect, context) {
    if (!ownerMatches(effect, context)) return false;
    return context.localFrame >= effect.localFrame && context.localFrame <= effect.endLocalFrame;
  }

  function ownerMatches(value = {}, context = {}) {
    const owner = normalizeActionId(value.ownerActionId || value.sourceActionId || value.actionId || value.createdForActionId || value.createdFromJointActionId);
    if (!owner) return true;
    return owner === context.actionId;
  }

  function comboStep(combo, frame) {
    const steps = Array.isArray(combo?.steps) ? combo.steps : [];
    return steps.find((step) => frame >= normalizeFrame(step.startFrame) && frame <= normalizeFrame(step.holdEndFrame || step.endFrame))
      || steps.find((step) => frame <= normalizeFrame(step.startFrame))
      || steps[steps.length - 1] || null;
  }

  function timelineFor(action = {}) {
    return Animotion.cutsceneActionSelectors?.rawActionTimeline?.(action) || null;
  }

  function actionDrafts(action = {}) {
    const drafts = Animotion.motionDraftActionStore?.normalizeList?.(action.hiddenCompletionDrafts) || [];
    const primary = Animotion.motionDrafts?.normalize?.(action.motionDraft) || action.motionDraft || null;
    if (!primary) return drafts;
    return Animotion.motionDraftActionStore?.upsertDraft?.(drafts, primary, { setPrimary: false }) || [...drafts, primary];
  }

  function dedupeEffects(effects) {
    const unique = new Map();
    for (const effect of effects) unique.set([effect.type, effect.actionId, effect.localFrame, effect.endLocalFrame, effect.partId || "", effect.assetId || ""].join("|"), effect);
    return [...unique.values()];
  }

  function normalizeActionId(value) {
    const id = String(value || "");
    if (!id) return null;
    if (id === "rearHandPunch01" || id.includes("rear-cross")) return "rearCross";
    if (id === "punch" || id.includes("motion-planner-punch")) return null;
    return id;
  }

  function scaledFrame(frame, tempo = 1) { return Math.max(1, Math.round(1 + (normalizeFrame(frame) - 1) / (Number(tempo) || 1))); }
  function normalizeFrame(value) { return Math.max(1, Math.round(Number(value) || 1)); }
  function clone(value) { return JSON.parse(JSON.stringify(value || {})); }

  Animotion.actionScopedEffects = { TYPES, frameContext, actionIdFor, normalizeEffectTracks, migratedEffectTracks, effectsForFrame, draftAllowed, supplementalAllowed, shiftEffect };
  if (typeof module !== "undefined") module.exports = Animotion.actionScopedEffects;
}
