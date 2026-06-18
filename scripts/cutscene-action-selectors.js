{
  const global = typeof window !== "undefined" ? window : globalThis;
  const Animotion = global.Animotion || (global.Animotion = {});
  const INACTIVE_NO_BRIDGE = "no-cutscene-bridge";
  const INACTIVE_NO_ACTION = "no-cutscene-action";
  const INACTIVE_NO_TIMELINE = "no-action-timeline";

  function getActiveJointAction(stateOrBridge = Animotion.state) {
    const bridge = bridgeFrom(stateOrBridge);
    if (!bridge) return inactive(INACTIVE_NO_BRIDGE);
    const action = bridge.jointAction || null;
    if (!action) return inactive(INACTIVE_NO_ACTION, { bridge });
    return { active: true, bridge, action };
  }

  function getActiveActionTimeline(stateOrBridge = Animotion.state) {
    const actionStatus = getActiveJointAction(stateOrBridge);
    if (!actionStatus.active) return actionStatus;
    const timeline = rawActionTimeline(actionStatus.action);
    if (!timeline) return inactive(INACTIVE_NO_TIMELINE, { bridge: actionStatus.bridge, action: actionStatus.action });
    return { active: true, bridge: actionStatus.bridge, action: actionStatus.action, timeline };
  }

  function getCutsceneActionStatus(stateOrBridge = Animotion.state, options = {}) {
    const actionStatus = getActiveJointAction(stateOrBridge);
    if (!actionStatus.active) return actionStatus;
    const action = actionStatus.action;
    const timeline = rawActionTimeline(action);
    const template = actionTemplate(action);
    return {
      active: true,
      bridge: actionStatus.bridge,
      action,
      timeline,
      template,
      isPunch: isPunchTemplate(template),
      isKick: template === "kick",
      family: Animotion.actionSpecs?.specFor?.(template)?.family || null,
      selectedPartId: options.selectedPartId ?? stateOrBridge?.selectedPartId ?? null,
      partCount: Array.isArray(options.parts) ? options.parts.length : (Array.isArray(stateOrBridge?.parts) ? stateOrBridge.parts.length : 0),
    };
  }

  function actionTemplate(action = {}) {
    const timeline = rawActionTimeline(action);
    const template = timeline?.template || timeline?.id || "";
    if (Animotion.actionSpecs?.hasSpec?.(template)) return template;
    if (template === "punch" || template === "kick") return template;
    const source = String(action?.source || "");
    const match = source.match(/^motion-planner-([A-Za-z0-9_-]+)-(?:anchors|locomotion)-v1$/);
    if (match && Animotion.actionSpecs?.hasSpec?.(match[1])) return match[1];
    if (match && (match[1] === "punch" || match[1] === "kick")) return match[1];
    if (source.includes("punch")) return "punch";
    if (source.includes("kick")) return "kick";
    return null;
  }

  function isPunchAction(action = {}) {
    return isPunchTemplate(actionTemplate(action));
  }

  function isPunchTemplate(template) {
    return Animotion.actionSpecs?.isPunchLike?.(template) || template === "punch";
  }

  function timelineBeats(action = {}) {
    const beats = Array.isArray(action?.beats) ? action.beats : [];
    const timeline = rawActionTimeline(action);
    const timelineItems = Array.isArray(timeline?.beats) ? timeline.beats : [];
    if (!timelineItems.length) return beats;
    const byId = new Map(beats.map((beat) => [beat.id, beat]));
    return timelineItems.map((beat) => ({ ...beat, ...(byId.get(beat.id) || {}) }));
  }

  function rawActionTimeline(action = {}) {
    return action && typeof action === "object" ? action.actionTimeline || null : null;
  }

  function resetMotionStateForImageUpload(state = Animotion.state) {
    if (!state) return inactive("missing-state");
    Object.assign(state, {
      cutsceneBridge: null,
      selectedPartId: null,
      actionFrameSelection: null,
      trajectoryDrag: null,
      selectedEditPoint: null,
      hoveredEditPoint: null,
      previewDrag: null,
      previewDrawSequenceDebug: null,
      actionSequence: { steps: [] },
      actionSequenceClips: [],
      motionEvaluationDebug: null,
      motionRegenerationDebug: null,
      renderedPointDebug: [],
      armHandleAutoPlaceStatus: null,
      motionPlan: defaultMotionPlan(),
    });
    return { active: false, reason: INACTIVE_NO_ACTION };
  }

  function bridgeFrom(stateOrBridge) {
    if (!stateOrBridge) return null;
    if (Object.prototype.hasOwnProperty.call(stateOrBridge, "cutsceneBridge")) return stateOrBridge.cutsceneBridge || null;
    return stateOrBridge;
  }

  function defaultMotionPlan() {
    return Animotion.motionPlanner?.normalizePlan?.() || { template: "kick", target: null, targetMode: false };
  }

  function inactive(reason, extras = {}) {
    return { active: false, reason, ...extras };
  }

  Animotion.cutsceneActionSelectors = {
    getActiveJointAction,
    getActiveActionTimeline,
    getCutsceneActionStatus,
    actionTemplate,
    isPunchAction,
    isPunchTemplate,
    timelineBeats,
    rawActionTimeline,
    resetMotionStateForImageUpload,
  };
  if (typeof module !== "undefined") module.exports = Animotion.cutsceneActionSelectors;
}
