{
  const global = typeof window !== "undefined" ? window : globalThis;
  const Animotion = global.Animotion || (global.Animotion = {});
  const TEMPLATES = Animotion.actionSpecs?.plannerTemplates?.() || fallbackTemplates();

  function normalizePlan(plan = {}, options = {}) {
    const bounds = options.imageBounds || sourceBounds();
    const target = normalizeTarget(plan.target, plan.targetNormalized, bounds);
    const targetSource = normalizeTargetSource(plan.targetSource, target);
    const targetState = Animotion.motionTargetState?.normalizeTargetState?.({ ...plan, target, targetSource }, bounds) || {};
    return {
      template: templateFor(plan.template) ? plan.template : "kick",
      target,
      targetNormalized: target ? normalizedPoint(target, bounds) : null,
      anchors: Animotion.motionAnchors?.normalizeAnchors?.(plan.anchors, { imageBounds: bounds }) || [],
      targetMode: Boolean(plan.targetMode),
      selectedBeatId: plan.selectedBeatId ? String(plan.selectedBeatId) : null,
      targetSource,
      ...targetState,
      motionScope: Animotion.motionTargetDebug?.normalizeMotionScope?.(plan.motionScope, plan.template) || "body-follow",
      rootMotionTuning: Animotion.motionTargetDebug?.normalizeRootMotionTuning?.(plan.rootMotionTuning) || null,
      targetDebug: Animotion.motionTargetDebug?.normalizeTargetDebug?.(plan.targetDebug) || null,
      motionHints: Animotion.motionHints?.normalize?.(plan.motionHints) || null,
      motionDraft: Animotion.motionDrafts?.normalize?.(plan.motionDraft, { assets: options.assets }) || Animotion.motionDrafts?.compileFromHints?.(plan.motionHints) || null,
      ...(plan.demoMotionPresetId ? { demoMotionPresetId: String(plan.demoMotionPresetId) } : {}),
      ...(Array.isArray(plan.trajectoryPoints) ? { trajectoryPoints: clonePlain(plan.trajectoryPoints) } : {}),
      ...(plan.rootMotion && typeof plan.rootMotion === "object" ? { rootMotion: clonePlain(plan.rootMotion) } : {}),
    };
  }

  function createPlan(parts, primaryId, bridge, options = {}) {
    const plan = normalizePlan(options);
    parts = Animotion.armExtension?.partsWithInferredHandTips?.(parts, primaryId, plan.template) || parts;
    if (plan.template === "boxingStep") return Animotion.boxingStepLocomotion.createPlan(parts, primaryId, bridge, plan);
    const base = Animotion.jointCoordinates.inferJointPose(parts);
    const primary = parts.find((part) => part.id === primaryId) || parts[0];
    const active = activeKeys(primary, parts);
    const direction = bridge.effectDirection || Animotion.cutsceneModel.inferEffectDirection(parts, primaryId);
    const targetInfo = targetForPlan(plan, base, active, direction, primary);
    let target = leadTarget(plan, base[active.end], targetInfo.point);
    let activeMotionTarget = motionTargetForPlan(plan, target);
    let targetDebug = targetDebugFor(plan, base, active, target, activeMotionTarget);
    let scopedPlan = { ...plan, targetDebug };
    let punchStyle = punchStyleFor(scopedPlan, parts, primary, base, active, direction, target);
    if (targetInfo.generated && plan.template === "punch" && punchStyle === "rear-cross") {
      target = leadTarget(plan, base[active.end], rearCrossAutoTarget(base, active, direction, primary, parts));
      activeMotionTarget = motionTargetForPlan(plan, target);
      targetDebug = targetDebugFor(plan, base, active, target, activeMotionTarget);
      scopedPlan = { ...plan, targetDebug };
      punchStyle = punchStyleFor(scopedPlan, parts, primary, base, active, direction, target) || punchStyle;
    }
    targetDebug.punchStyle = punchStyle;
    targetDebug.roleDecision = Animotion.motionAnchors?.classificationDebug?.(scopedPlan, parts, primary, base, active, direction, target, { selectedPartId: options.selectedPartId || primaryId, explicitActionOverride: Boolean(plan.targetDebug?.punchStyle) }) || null;
    Object.assign(targetDebug, Animotion.armChainResolver?.targetDebug?.(parts, options.selectedPartId || primaryId, primary, targetDebug.roleDecision) || {});
    if (targetDebug.hiddenCompletionCandidate) targetDebug.hiddenCompletionReason = "wrist/forearm area may be exposed by separate glove motion";
    const anchors = Animotion.motionAnchors?.anchorsFromPlan?.(scopedPlan, parts, primary, base, active, direction, target) || [];
    const actionTimeline = actionTimelineFor(plan.template, bridge);
    const beats = templateBeats(plan.template, bridge).map((spec) => poseBeat(spec, base, active, target, direction, anchors, punchStyle));
    const trajectorySamples = Animotion.motionTargetState?.trajectorySamples?.(beats, active.end) || [];
    Object.assign(targetDebug, Animotion.characterRootMotion?.debugForPlan?.(parts, primary, beats, base, plan, targetDebug) || {});
    return {
      target,
      motionScope: plan.motionScope,
      targetDebug,
      activeMotionTarget,
      trajectoryPoints: trajectorySamples,
      trajectorySamples,
      anchors,
      active,
      jointAction: {
        source: `motion-planner-${plan.template}-anchors-v1`,
        focusKey: active.end,
        actionTimeline,
        impactExaggeration: impactExaggerationFor(actionTimeline, parts, primary),
        anchors,
        beats,
        targetDebug,
        activeMotionTarget,
        trajectoryPoints: trajectorySamples,
        trajectorySamples,
        motionHints: plan.motionHints,
        motionDraft: Animotion.motionDrafts?.snapshot?.(plan.motionDraft) || plan.motionDraft,
      },
      partTracks: Animotion.motionTrackBuilder.tracksForParts(parts, primary, beats, base, active, { ...bridge, jointAction: { targetDebug } }),
    };
  }

  function tracksForJointAction(parts, primaryId, action) {
    return Animotion.motionTrackBuilder.tracksForJointAction(parts, primaryId, action);
  }

  function activeKeys(primary, parts) {
    return Animotion.motionTrackBuilder?.activeKeys?.(primary, parts) || { root: "hip", mid: "chest", end: "chest", motion: "translate" };
  }

  function templateBeats(template, bridge) {
    const normalized = Animotion.cutsceneModel.normalizeBridge(bridge);
    const action = actionTimelineFor(template, normalized);
    if (action) return action.beats.map((spec) => ({ id: spec.id, at: spec.at, recoil: spec.recoil, lift: spec.lift, reach: spec.reach }));
    const impact = normalized.impactFrame;
    return TEMPLATES[template].beats.map(([id, n, recoil, lift, reach]) => ({ id, at: frameForTemplateBeat(n, normalized, impact), recoil, lift, reach }));
  }

  function frameForTemplateBeat(position, bridge, impact) {
    if (position === "duration") return bridge.durationFrames || impact;
    return Math.max(1, Math.round(1 + (impact - 1) * Number(position || 0)));
  }

  function poseBeat(spec, base, active, target, direction, anchors, punchStyle = "jab") {
    const rearCross = punchStyle === "rear-cross";
    const strikeDirection = rearCross ? directionFrom(base[active.end], target, direction) : direction;
    const pose = shiftBody(base, { x: 0, y: 0 }, spec.recoil, direction);
    applyAnchorPose(pose, base, anchors, spec.reach, [active.end, active.mid]);
    const root = pointFromArray(pose[active.root] || pose.hip);
    const startEnd = pointFromArray(base[active.end] || base.head);
    const end = lerpPoint(startEnd, Animotion.motionAnchors?.anchorPoint?.(anchors, active.end) || target, spec.reach);
    end.x += strikeDirection.x * spec.recoil * 80;
    end.y += rearCross ? strikeDirection.y * spec.recoil * 40 + spec.lift * 20 : spec.lift * 40;
    if (rearCross && spec.recoil < 0) applyRearWindup(end, startEnd, strikeDirection, direction, target, spec);
    if (active.motion === "translate") {
      pose[active.end] = rounded(end);
      return { id: spec.id, at: spec.at, pose };
    }
    const midTarget = Animotion.motionAnchors?.anchorPoint?.(anchors, active.mid);
    pose[active.mid] = rounded(midTarget ? lerpPoint(pointFromArray(base[active.mid]), midTarget, spec.reach) : solveMid(root, end, base, active, spec.reach));
    pose[active.end] = rounded(end);
    return { id: spec.id, at: spec.at, pose };
  }

  function applyRearWindup(end, startEnd, strikeDirection, direction, target, spec) {
    const targetSide = Math.sign(target.x - startEnd.x) || Math.sign(strikeDirection.x) || Math.sign(direction.x) || 1;
    end.x = startEnd.x - targetSide * Math.abs(spec.recoil) * 45;
    end.y = startEnd.y - strikeDirection.y * Math.abs(spec.recoil) * 20 + spec.lift * 10;
  }

  function shiftBody(base, shift, recoil, direction) {
    const pose = { ...base };
    for (const key of ["hip", "chest", "head"]) {
      const point = pointFromArray(base[key]);
      pose[key] = rounded({ x: point.x + shift.x - direction.x * recoil * 22, y: point.y + shift.y });
    }
    return pose;
  }

  function applyAnchorPose(pose, base, anchors, reach, excludedKeys = []) {
    for (const anchor of anchors || []) {
      if (excludedKeys.includes(anchor.key) || !base[anchor.key]) continue;
      pose[anchor.key] = rounded(lerpPoint(pointFromArray(base[anchor.key]), anchor.point, reach));
    }
  }

  function solveMid(root, end, base, active, bendScale) {
    const baseRoot = pointFromArray(base[active.root] || base.hip);
    const baseMid = pointFromArray(base[active.mid] || base.head);
    const baseEnd = pointFromArray(base[active.end] || base.head);
    const a = distance(baseRoot, baseMid);
    const b = distance(baseMid, baseEnd);
    const c = Math.max(1, distance(root, end));
    const along = Math.max(0.05, Math.min(0.95, (a * a + c * c - b * b) / (2 * c * c)));
    const height = Math.sqrt(Math.max(0, a * a - (along * c) ** 2)) * Math.max(0.25, 1 - bendScale * 0.35);
    const normal = bendNormal(baseRoot, baseMid, baseEnd, root, end);
    return { x: root.x + (end.x - root.x) * along + normal.x * height, y: root.y + (end.y - root.y) * along + normal.y * height };
  }

  function targetForPlan(plan, base, active, direction, primary) {
    const anchored = Animotion.motionAnchors?.anchorPoint?.(plan.anchors, active.end);
    if (anchored) return { point: anchored, generated: false };
    const activeTarget = activeTargetPoint(plan);
    if (activeTarget) return { point: activeTarget, generated: false };
    return { point: autoTarget(base[active.end], direction, primary), generated: true };
  }

  function targetDebugFor(plan, base, active, target, activeMotionTarget) {
    const targetDebug = Animotion.motionTargetDebug?.analyzeTarget?.(plan, base, active, target) || {};
    targetDebug.activeMotionTarget = Animotion.motionTargetState?.activeMotionTargetDebug?.({ ...plan, activeMotionTarget }) || null;
    return targetDebug;
  }

  function autoTarget(start, direction, primary) {
    const p = pointFromArray(start || [0, 0]);
    const move = partKind(primary) === "leg" ? 170 : 120;
    return { x: Math.round(p.x + direction.x * move), y: Math.round(p.y + direction.y * move) };
  }

  function rearCrossAutoTarget(base, active, direction, primary, parts) {
    const root = pointFromArray(base[active.root] || base.chest || base.hip);
    const end = pointFromArray(base[active.end] || base.head);
    const face = coveringBounds(parts);
    const sign = Math.sign(direction.x) || Math.sign(end.x - root.x) || 1;
    const reach = Math.max(120, distance(root, end) * 1.2, (parts.find((part) => partKind(part) === "body")?.rect?.w || 0) * 1.45);
    return clampTargetToBounds(pushTargetOutsideCover({ x: Math.round(end.x + sign * reach), y: Math.round(end.y + (direction.y || 0) * reach * 0.25) }, face, sign));
  }

  function normalizeTarget(target, normalized, bounds) {
    const restored = Animotion.coordinateSpaces?.pointFromNormalizedImagePoint?.(normalized, bounds);
    const source = restored || target;
    return source ? { x: Math.round(Number(source.x) || 0), y: Math.round(Number(source.y) || 0) } : null;
  }

  function normalizeTargetSource(source, target = null) {
    if (!source) return target ? { type: "manual" } : null;
    const type = ["correspondence", "manual", "generated", "planner-default"].includes(source.type) ? source.type : "manual";
    return { type, ...(source.correspondenceId ? { correspondenceId: String(source.correspondenceId) } : {}), ...(source.targetPartType ? { targetPartType: String(source.targetPartType) } : {}), ...(source.coordinateSpace ? { coordinateSpace: String(source.coordinateSpace) } : {}) };
  }

  function punchStyleFor(plan, parts, primary, base, active, direction, target) { return Animotion.motionAnchors?.punchStyleFor?.(plan, parts, primary, base, active, direction, target) || "jab"; }
  function leadTarget(plan, start, target) { return Animotion.motionTargetDebug?.primaryLeadTarget?.(plan, start, target) || target; }
  function activeTargetPoint(plan) { return plan.activeMotionTarget?.point || plan.target || null; }
  function motionTargetForPlan(plan, point) { return plan.activeMotionTarget ? { ...plan.activeMotionTarget, point } : Animotion.motionTargetState?.generatedTarget?.(point) || null; }
  function templateFor(template) { return TEMPLATES[template] || (Animotion.actionTimelineModel?.hasTemplate?.(template) ? Animotion.actionTimelineModel.timelineForTemplate(template) : null); }
  function actionTimelineFor(template, bridge) { return Animotion.actionTimelineModel?.hasTemplate?.(template) ? Animotion.actionTimelineModel.timelineForTemplate(template, bridge) : null; }
  function impactExaggerationFor(actionTimeline, parts, primary) { return Animotion.impactExaggerationLayer?.createDefaultImpactExaggerationForActionTimeline?.(actionTimeline, { parts, primaryPartId: primary?.id }) || null; }
  function partKind(part = {}) { if (["thigh", "shin", "foot"].includes(part.humanRole) || part.type === "leg") return "leg"; if (["upperArm", "forearm", "hand", "glove"].includes(part.humanRole) || ["arm", "glove"].includes(part.type)) return "arm"; if (["torso", "pelvis"].includes(part.humanRole) || part.type === "body" || part.type === "spine") return "body"; if (part.humanRole === "head" || part.type === "head") return "head"; return part.type || null; }
  function directionFrom(startPoint, endPoint, fallback) { const start = pointFromArray(startPoint), end = pointFromArray(endPoint), dx = end.x - start.x, dy = end.y - start.y, length = Math.hypot(dx, dy); return length > 0.001 ? { x: dx / length, y: dy / length } : fallback; }
  function bendNormal(baseRoot, baseMid, baseEnd, root, end) { const sign = Math.sign((baseMid.x - baseRoot.x) * (baseEnd.y - baseRoot.y) - (baseMid.y - baseRoot.y) * (baseEnd.x - baseRoot.x)) || 1; const dx = end.x - root.x, dy = end.y - root.y, length = Math.max(1, Math.hypot(dx, dy)); return { x: -dy / length * sign, y: dx / length * sign }; }
  function pointFromArray(point) { return { x: Number(point?.[0]) || 0, y: Number(point?.[1]) || 0 }; }
  function lerpPoint(a, b, ratio) { return { x: a.x + (b.x - a.x) * ratio, y: a.y + (b.y - a.y) * ratio }; }
  function rounded(point) { return [Math.round(point.x), Math.round(point.y)]; }
  function distance(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }
  function normalizedPoint(point, bounds) { return Animotion.coordinateSpaces?.normalizedImagePointFromPoint?.(point, bounds) || null; }
  function clonePlain(value) { return JSON.parse(JSON.stringify(value)); }
  function sourceBounds() { return Animotion.state?.image ? { width: Animotion.state.image.naturalWidth, height: Animotion.state.image.naturalHeight } : typeof Animotion.imageBounds === "function" ? Animotion.imageBounds() : null; }

  function coveringBounds(parts) {
    const list = parts.filter((part) => isFaceOrHeadLayer(part)).map((part) => rectBounds(part.rect)).filter((rect) => rect.w || rect.h);
    if (!list.length) return null;
    const minX = Math.min(...list.map((rect) => rect.x)), minY = Math.min(...list.map((rect) => rect.y));
    const maxX = Math.max(...list.map((rect) => rect.x + rect.w)), maxY = Math.max(...list.map((rect) => rect.y + rect.h));
    return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
  }

  function pushTargetOutsideCover(target, cover, sign) {
    if (!cover) return target;
    const padding = 32;
    if (sign > 0 && (target.x <= cover.x + cover.w + padding || insideRect(target, cover))) return { ...target, x: Math.round(cover.x + cover.w + padding) };
    if (sign < 0 && (target.x >= cover.x - padding || insideRect(target, cover))) return { ...target, x: Math.round(cover.x - padding) };
    return target;
  }

  function clampTargetToBounds(target) {
    const bounds = sourceBounds();
    return bounds ? { x: Math.round(clamp(target.x, 0, bounds.width)), y: Math.round(clamp(target.y, 0, bounds.height)) } : target;
  }

  function rectBounds(rect = {}) { return { x: Number(rect.x) || 0, y: Number(rect.y) || 0, w: Number(rect.w) || 0, h: Number(rect.h) || 0 }; }
  function insideRect(point, rect) { return point.x >= rect.x && point.x <= rect.x + rect.w && point.y >= rect.y && point.y <= rect.y + rect.h; }
  function isFaceOrHeadLayer(part = {}) { const text = `${part.id || ""} ${part.name || ""} ${part.type || ""} ${part.humanRole || ""}`.toLowerCase(); return /head|face|hair|eye|eyes|mouth|nose|facial/.test(text) || /\uC5BC\uAD74|\uBA38\uB9AC|\uB208|\uC785|\uCF54/.test(text); }
  function clamp(value, min, max) { return Math.min(max, Math.max(min, value)); }
  function fallbackTemplates() { return { kick: { label: "Kick", beats: [["ready", 0, 0, 0, 0], ["compress", 0.24, -0.16, 0.08, 0.2], ["chamber", 0.56, 0.1, -0.12, 0.48], ["extend", 0.82, 0.58, -0.04, 0.82], ["impact", 1, 0, 0, 1]] }, punch: { label: "Punch", beats: [["guard", 0, 0, 0, 0], ["windup", 0.25, -0.2, 0.04, 0.15], ["drive", 0.58, 0.24, -0.02, 0.58], ["extension", 0.84, 0.75, 0, 0.86], ["impact", 1, 0, 0, 1]] }, dash: { label: "Dash", beats: [["ready", 0, 0, 0, 0], ["lean", 0.28, -0.08, 0.04, 0.2], ["launch", 0.62, 0.45, -0.08, 0.58], ["snap", 0.86, 0.82, -0.02, 0.86], ["arrive", 1, 0, 0, 1]] } }; }

  Animotion.motionPlanner = { normalizePlan, createPlan, tracksForJointAction };
  if (typeof module !== "undefined") module.exports = Animotion.motionPlanner;
}
