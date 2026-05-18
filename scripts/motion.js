{
  const global = window;
  const Animotion = global.Animotion;
  const state = Animotion.state;

  function motionFor(part, t) {
    const els = Animotion.dom.els;
    const strength = Number(els.motionStrength.value);
    const phase = Math.sin(t * Math.PI * 2 * 0.75);
    const quick = Math.sin(t * Math.PI * 2 * 2.4);
    const motion = { x: 0, y: 0, rotate: 0, scaleX: 1, scaleY: 1 };
    const template = els.motionTemplate.value;

    if (template === "breathe") applyBreathe(part, motion, phase, strength);
    if (template === "nod") applyNod(part, motion, phase, strength);
    if (template === "talk") applyTalk(part, motion, phase, quick, strength);
    if (template === "look") applyLook(part, motion, phase, strength);
    if (template === "panel-drift") applyPanelDrift(part, motion, phase, t, strength);
    if (template === "custom") return Animotion.motionModel.customMotionForPart(part.customMotion, t, strength);
    if (template === "keyframes") return keyframeMotionForPart(part, t);
    if (template === "cutscene") return cutsceneMotionForPart(part, t);
    return motion;
  }

  function cutsceneMotionForPart(part, t) {
    const bridge = state.cutsceneBridge || Animotion.cutsceneModel.createBridge(state.parts, state.selectedPartId);
    const frame = state.running
      ? Animotion.cutsceneModel.bridgeFrameFromTime(t, bridge, Animotion.config.timelineFps)
      : state.currentFrame;
    const transform = Animotion.motionModel.poseToTransform(Animotion.timeline.evaluatePartAtFrame(part, frame));
    return Animotion.characterRootMotion?.applyToTransform?.(transform, part, {
      parts: state.parts,
      frame,
      targetDebug: bridge.jointAction?.targetDebug,
    }) || transform;
  }

  function keyframeMotionForPart(part, t) {
    const frame = currentKeyframeFrame(t);
    if (!Animotion.state.running && part.id === Animotion.state.selectedPartId) {
      return Animotion.motionModel.poseToTransform(part.customMotion);
    }
    return Animotion.motionModel.poseToTransform(Animotion.timeline.evaluatePartAtFrame(part, frame));
  }

  function currentKeyframeFrame(t) {
    const state = Animotion.state;
    if (!state.running) return state.currentFrame;
    return Animotion.timeline.frameFromTime(t, Animotion.config.timelineFrames, Animotion.config.timelineFps);
  }

  function applyBreathe(part, motion, phase, strength) {
    if (part.type === "body" || part.type === "spine") motion.scaleY = 1 + 0.018 * phase * strength;
    if (part.type === "head") motion.y = -2.2 * phase * strength;
    if (part.type === "arm") motion.rotate = 3.5 * phase * strength;
    if (part.type === "leg") motion.rotate = -1.2 * phase * strength;
    if (part.type === "hair") motion.rotate = 2.5 * phase * strength;
  }

  function applyNod(part, motion, phase, strength) {
    if (part.type === "head") motion.rotate = 4 * phase * strength;
    if (part.type === "hair") motion.rotate = 5 * phase * strength;
    if (part.type === "body" || part.type === "spine") motion.y = 1.2 * phase * strength;
    if (part.type === "leg") motion.rotate = 0.8 * phase * strength;
  }

  function applyTalk(part, motion, phase, quick, strength) {
    if (part.type === "mouth") motion.scaleY = 1 + Math.max(0, quick) * 0.45 * strength;
    if (part.type === "head") motion.rotate = 1.4 * phase * strength;
    if (part.type === "body" || part.type === "spine") motion.y = 0.8 * phase * strength;
  }

  function applyLook(part, motion, phase, strength) {
    if (part.type === "head") motion.x = 2.5 * phase * strength;
    if (part.type === "eye") motion.x = 4.5 * phase * strength;
    if (part.type === "hair") motion.rotate = -2 * phase * strength;
  }

  function applyPanelDrift(part, motion, phase, t, strength) {
    const depth = 1 + part.order * 0.16;
    if (!part.parentId) {
      motion.x = Math.sin(t * 0.85) * depth * 2.2 * strength;
      motion.y = Math.cos(t * 0.7) * depth * 1.4 * strength;
    }
    if (part.type === "hair" || part.type === "arm") motion.rotate = 1.8 * phase * strength;
    if (part.type === "leg") motion.rotate = 0.9 * phase * strength;
  }

  Animotion.motion = { motionFor };
}
