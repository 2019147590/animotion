{
  const global = typeof window !== "undefined" ? window : globalThis;
  const Animotion = global.Animotion || (global.Animotion = {});

  function tracksForParts(parts, primary, beats, base, active, bridge) {
    const chain = Animotion.armChainResolver?.resolve?.(parts, primary?.id);
    return parts.map((part) => ({
      partId: part.id,
      keyframes: beats.map((beat) => trackKeyframe(part, primary, beat, base, active, bridge, chain)),
    }));
  }

  function tracksForJointAction(parts, primaryId, action) {
    const bridge = action?.jointAction ? action : { jointAction: action, bodyAssistEnabled: true };
    const template = actionTemplateName(bridge.jointAction);
    const prepared = Animotion.armExtension?.partsWithInferredHandTips?.(parts, primaryId, template) || parts;
    const base = Animotion.jointCoordinates.inferJointPose(prepared);
    const primary = prepared.find((part) => part.id === primaryId) || prepared[0];
    return tracksForParts(prepared, primary, bridge.jointAction?.beats || [], base, activeKeys(primary, prepared), bridge);
  }

  function trackKeyframe(part, primary, beat, base, active, bridge, chain = null) {
    const pose = Animotion.motionModel.defaultCustomMotion();
    const parentId = parentIdFor(part);
    const chainFactor = separateChainMotionFactor(part, chain);
    if (part.id === primary.id) return primaryKeyframe(part, beat, base, active, bridge, chainFactor, pose);
    if (chainFactor > 0) return chainKeyframe(beat, base, active, chainFactor, pose);
    if (receivesFullCharacterRoot(part, primary, bridge, parentId)) {
      Object.assign(pose, rootDelta(beat, base));
      return { frame: beat.at, pose };
    }
    if (receivesBodyAssist(part, primary, bridge, parentId)) Object.assign(pose, rootDelta(beat, base));
    if (receivesHeadAssist(part, primary, bridge, parentId)) {
      pose.x = (beat.pose.head[0] - base.head[0]) * 0.7;
      pose.y = (beat.pose.head[1] - base.head[1]) * 0.7;
    }
    return { frame: beat.at, pose };
  }

  function primaryKeyframe(part, beat, base, active, bridge, chainFactor, pose) {
    const extensionPose = Animotion.armExtension?.poseForArmOnlyRearPunch?.(part, beat, base, active, bridge);
    if (extensionPose) Object.assign(pose, extensionPose);
    else if (active.motion === "translate" || drivesHandTipEndpoint(part, active) || chainFactor > 0) {
      pose.x = (beat.pose[active.end][0] - base[active.end][0]) * (chainFactor || 1);
      pose.y = (beat.pose[active.end][1] - base[active.end][1]) * (chainFactor || 1);
    } else {
      pose.jointX = beat.pose[active.end][0] - base[active.end][0];
      pose.jointY = beat.pose[active.end][1] - base[active.end][1];
    }
    return { frame: beat.at, pose };
  }

  function chainKeyframe(beat, base, active, chainFactor, pose) {
    pose.x = (beat.pose[active.end][0] - base[active.end][0]) * chainFactor;
    pose.y = (beat.pose[active.end][1] - base[active.end][1]) * chainFactor;
    pose.rotate = chainFactor * 8 * Math.sign(pose.x || 1);
    return { frame: beat.at, pose };
  }

  function activeKeys(primary, parts) {
    const side = Animotion.poseAssist?.actionSide?.(primary, parts) < 0 ? "l" : "r";
    if (partKind(primary) === "arm") return { root: `${side}Shoulder`, mid: `${side}Elbow`, end: `${side}Hand` };
    if (partKind(primary) === "leg") return { root: "hip", mid: `${side}Knee`, end: `${side}Foot` };
    if (isBodyPrimary(primary)) return { root: "hip", mid: "chest", end: "chest", motion: "translate" };
    return { root: "chest", mid: "head", end: "head" };
  }

  function rootDelta(beat, base) {
    return { x: beat.pose.hip[0] - base.hip[0], y: beat.pose.hip[1] - base.hip[1] };
  }

  function receivesFullCharacterRoot(part, primary, bridge, parentId) {
    return !parentId && bridge.bodyAssistEnabled !== false
      && bridge?.jointAction?.targetDebug?.chosenMotionScope === "full-character"
      && part.id !== primary.id;
  }

  function receivesBodyAssist(part, primary, bridge, parentId) {
    return !parentId && bridge.bodyAssistEnabled !== false && !isBodyPrimary(primary) && isBodyPrimary(part);
  }

  function receivesHeadAssist(part, primary, bridge, parentId) {
    return !parentId && bridge.bodyAssistEnabled !== false && !isBodyPrimary(primary) && partKind(part) === "head";
  }

  function drivesHandTipEndpoint(part, active) {
    return partKind(part) === "arm" && Boolean(Animotion.rigging?.handTipForPart?.(part) || part.handTip) && String(active.end || "").endsWith("Hand");
  }

  function separateChainMotionFactor(part, chain) {
    if (!chain?.separateRigPath || !chain.handOrGloveId) return 0;
    if (part.id === chain.upperArmId) return chain.forearmId ? 0.15 : 0.22;
    if (part.id === chain.forearmId) return chain.upperArmId ? 0.3 : 0.35;
    if (part.id === chain.handOrGloveId) return chain.upperArmId && chain.forearmId ? 0.55 : chain.forearmId ? 0.65 : 1;
    return 0;
  }

  function partKind(part = {}) {
    if (["thigh", "shin", "foot"].includes(part.humanRole) || part.type === "leg") return "leg";
    if (["upperArm", "forearm", "hand", "glove"].includes(part.humanRole) || ["arm", "glove"].includes(part.type)) return "arm";
    if (["torso", "pelvis"].includes(part.humanRole) || part.type === "body" || part.type === "spine") return "body";
    if (part.humanRole === "head" || part.type === "head") return "head";
    return part.type || null;
  }

  function isBodyPrimary(part) {
    return partKind(part) === "body";
  }

  function actionTemplateName(action = {}) {
    return Animotion.cutsceneActionSelectors?.actionTemplate?.(action) || null;
  }

  function parentIdFor(part) {
    return Animotion.rigConnection?.parentIdFor?.(part) || null;
  }

  Animotion.motionTrackBuilder = { tracksForParts, tracksForJointAction, activeKeys };
  if (typeof module !== "undefined") module.exports = Animotion.motionTrackBuilder;
}
