{
  const global = typeof window !== "undefined" ? window : globalThis;
  const Animotion = global.Animotion || (global.Animotion = {});

  function tracksForParts(parts, primary, beats, options = {}) {
    const context = trackContext(parts, primary, options);
    return parts.map((part) => ({
      partId: part.id,
      keyframes: beats.map((beat) => trackKeyframe(part, beat, context)),
    }));
  }

  function tracksForJointAction(parts, primaryId, action) {
    const bridge = action?.jointAction ? action : { jointAction: action, bodyAssistEnabled: true };
    const template = actionTemplateName(bridge.jointAction);
    const prepared = Animotion.armExtension?.partsWithInferredHandTips?.(parts, primaryId, template) || parts;
    const base = Animotion.jointCoordinates.inferJointPose(prepared);
    const primary = prepared.find((part) => part.id === primaryId) || prepared[0];
    return tracksForParts(prepared, primary, bridge.jointAction?.beats || [], { base, active: activeKeys(primary, prepared), bridge });
  }

  function trackKeyframe(part, beat, context) {
    const pose = Animotion.motionModel.defaultCustomMotion();
    const parentId = parentIdFor(part);
    const chainFactor = separateChainMotionFactor(part, context.chain);
    if (part.id === context.primary.id) return primaryKeyframe(part, beat, context, chainFactor, pose);
    if (chainFactor > 0) return chainKeyframe(part, beat, context, chainFactor, pose);
    const retreatFactor = leadRetreatFactor(part, context.leadRetreat);
    if (retreatFactor) return leadRetreatKeyframe(part, beat, context.leadRetreat, retreatFactor, pose);
    if (receivesRearCrossLowerBodyAssist(part, context, parentId)) {
      Object.assign(pose, rootDelta(beat, context.base));
      return { frame: beat.at, pose };
    }
    if (receivesFullCharacterRoot(part, context.primary, context.bridge, parentId)) {
      Object.assign(pose, rootDelta(beat, context.base));
      return { frame: beat.at, pose };
    }
    if (receivesBodyAssist(part, context.primary, context.bridge, parentId)) Object.assign(pose, rootDelta(beat, context.base));
    if (receivesHeadAssist(part, context.primary, context.bridge, parentId)) {
      pose.x = (beat.pose.head[0] - context.base.head[0]) * 0.7;
      pose.y = (beat.pose.head[1] - context.base.head[1]) * 0.7;
    }
    return { frame: beat.at, pose };
  }

  function primaryKeyframe(part, beat, context, chainFactor, pose) {
    const { base, active, bridge } = context;
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

  function chainKeyframe(part, beat, context, chainFactor, pose) {
    const { base, active } = context;
    pose.x = (beat.pose[active.end][0] - base[active.end][0]) * chainFactor;
    pose.y = (beat.pose[active.end][1] - base[active.end][1]) * chainFactor;
    pose.rotate = chainFactor * 8 * Math.sign(pose.x || 1);
    return { frame: beat.at, pose };
  }

  function leadRetreatKeyframe(part, beat, context, factor, pose) {
    const progress = leadRetreatProgress(beat.id);
    pose.x = cleanNumber(context.delta.x * progress * factor.move);
    pose.y = cleanNumber(context.delta.y * progress * factor.move);
    pose.rotate = cleanNumber(context.side * factor.rotate * progress);
    if (factor.joint) {
      const bend = Math.min(36, Math.hypot(context.delta.x, context.delta.y) * progress * factor.joint);
      pose.jointX = cleanNumber(clampNumber(context.delta.x * progress * factor.joint * 0.35, -24, 24));
      pose.jointY = cleanNumber(-bend);
    }
    if (factor.worldAngle) pose.rotate = cleanNumber(-context.side * factor.worldAngle * progress - parentLeadRotation(context, progress) - jointRotation(part, pose));
    if (locksElbowToUpperArm(part, context.chain)) pose.x = pose.y = 0;
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

  function receivesRearCrossLowerBodyAssist(part, context, parentId) {
    return !parentId
      && context.bridge.bodyAssistEnabled !== false
      && isRearCrossPunch(context.bridge)
      && partKind(part) === "leg";
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

  function locksElbowToUpperArm(part, chain) {
    return part?.id === chain?.forearmId && chain.forearmParentIsUpperArm === true && chain.elbowConnectionValid === true;
  }

  function trackContext(parts, primary, options) {
    const base = options.base || {}, active = options.active || activeKeys(primary, parts), bridge = options.bridge || {};
    const chain = Animotion.armChainResolver?.resolve?.(parts, primary?.id);
    const context = { parts, primary, base, active, bridge, chain, leadRetreat: null };
    context.leadRetreat = leadHandRetreatContext(context);
    return context;
  }

  function leadHandRetreatContext(context) {
    const { parts, base, active, bridge, chain: primaryChain } = context;
    if (!isRearCrossPunch(bridge) || !primaryChain?.separateRigPath) return null;
    const keys = oppositeArmKeys(active);
    const chain = leadArmChain(parts, primaryChain, base, keys.end);
    if (!chain?.separateRigPath) return null;
    const hand = leadHandPoint(bridge.jointAction?.targetDebug, keys.end) || pointFromArray(base[keys.end]);
    const shoulder = pointFromArray(base[keys.root]);
    const chest = pointFromArray(base.chest || base.hip);
    const target = leadGuardPoint(hand, shoulder, chest);
    const delta = limitedDelta({ x: target.x - hand.x, y: target.y - hand.y }, hand, shoulder);
    return {
      chain,
      parts,
      side: Math.sign(hand.x - chest.x) || 1,
      delta,
    };
  }

  function isRearCrossPunch(bridge = {}) {
    const template = actionTemplateName(bridge.jointAction);
    const rearCross = bridge.jointAction?.targetDebug?.punchStyle === "rear-cross";
    return rearCross && (!template || isPunchTemplate(template));
  }

  function isPunchTemplate(template) {
    return Animotion.actionSpecs?.isPunchLike?.(template) || template === "punch";
  }

  function oppositeArmKeys(active = {}) {
    const side = String(active.end || "").startsWith("l") ? "r" : "l";
    return { root: `${side}Shoulder`, mid: `${side}Elbow`, end: `${side}Hand` };
  }

  function leadArmChain(parts, primaryChain, base, handKey) {
    if (!Animotion.armChainResolver?.resolve || !base[handKey]) return null;
    const target = pointFromArray(base[handKey]);
    return uniqueArmChains(parts)
      .filter((chain) => chain.handOrGloveId !== primaryChain.handOrGloveId)
      .sort((a, b) => chainDistance(a, target) - chainDistance(b, target))[0] || null;
  }

  function uniqueArmChains(parts) {
    const seen = new Set(), chains = [];
    for (const part of parts || []) {
      const chain = Animotion.armChainResolver.resolve(parts, part);
      if (!chain?.separateRigPath || !chain.handOrGloveId || seen.has(chain.handOrGloveId)) continue;
      seen.add(chain.handOrGloveId);
      chains.push(chain);
    }
    return chains;
  }

  function chainDistance(chain, target) {
    const point = chain.terminalContactPoint?.image || centerPoint(chain.handOrGlove);
    return point ? Math.hypot(point.x - target.x, point.y - target.y) : Number.POSITIVE_INFINITY;
  }

  function leadGuardPoint(hand, shoulder, chest) {
    const side = Math.sign(hand.x - chest.x) || 1;
    return {
      x: Math.round(shoulder.x + side * 8),
      y: Math.round(shoulder.y + Math.max(8, Math.abs(chest.y - shoulder.y) * 0.35)),
    };
  }

  function leadRetreatFactor(part, context) {
    if (!context?.chain) return null;
    if (part.id === context.chain.upperArmId) return { move: 0, rotate: 70 };
    if (part.id === context.chain.forearmId) return { move: 0.22, rotate: -22, joint: 0.1, worldAngle: 45 };
    if (part.id === context.chain.handOrGloveId) return { move: 0.12, rotate: -2 };
    return null;
  }

  function leadRetreatProgress(beatId) {
    if (beatId === "guard") return 0;
    if (beatId === "windup") return 0.2;
    if (beatId === "drive") return 0.55;
    if (beatId === "extension") return 0.85;
    if (beatId === "impact") return 1;
    if (beatId === "recover") return 0.65;
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

  function pointFromArray(point) {
    return { x: Number(point?.[0]) || 0, y: Number(point?.[1]) || 0 };
  }

  function leadHandPoint(debug = {}, key = "") {
    const side = String(key).startsWith("l") ? "left" : "right";
    const point = debug.roleDecision?.handTipPositions?.[side];
    return validPoint(point) ? { x: Number(point.x), y: Number(point.y) } : null;
  }

  function limitedDelta(delta, hand, shoulder) {
    const length = Math.hypot(delta.x, delta.y);
    const limit = Math.max(36, Math.min(260, Math.hypot(hand.x - shoulder.x, hand.y - shoulder.y) * 0.85));
    if (length <= limit || length <= 0.001) return delta;
    return { x: delta.x / length * limit, y: delta.y / length * limit };
  }

  function validPoint(point) {
    return Number.isFinite(Number(point?.x)) && Number.isFinite(Number(point?.y));
  }

  function centerPoint(part = {}) {
    const rect = part.rect || {};
    return { x: Number(rect.x || 0) + Number(rect.w || 0) * 0.5, y: Number(rect.y || 0) + Number(rect.h || 0) * 0.5 };
  }

  function jointRotation(part = {}, pose = {}) {
    if (!part.joint || !part.pivot || (!pose.jointX && !pose.jointY)) return 0;
    const base = { x: part.joint.x - part.pivot.x, y: part.joint.y - part.pivot.y };
    const target = { x: base.x + Number(pose.jointX || 0), y: base.y + Number(pose.jointY || 0) };
    if (Math.hypot(base.x, base.y) < 1 || Math.hypot(target.x, target.y) < 1) return 0;
    return (Math.atan2(target.y, target.x) - Math.atan2(base.y, base.x)) * 180 / Math.PI;
  }

  function parentLeadRotation(context = {}, progress = 0) {
    const upper = context.chain?.upperArmId ? context.parts.find((part) => part.id === context.chain.upperArmId) : null;
    const factor = upper ? leadRetreatFactor(upper, context) : null;
    return Number(context.side || 0) * Number(factor?.rotate || 0) * progress;
  }

  function cleanNumber(value) {
    return Object.is(value, -0) || Math.abs(value) < 1e-9 ? 0 : value;
  }

  function clampNumber(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  Animotion.motionTrackBuilder = { tracksForParts, tracksForJointAction, activeKeys };
  if (typeof module !== "undefined") module.exports = Animotion.motionTrackBuilder;
}
