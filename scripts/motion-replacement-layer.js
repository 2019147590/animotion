{
  const global = typeof window !== "undefined" ? window : globalThis;
  const Animotion = global.Animotion || (global.Animotion = {});
  const ACTIVE_BEATS = new Set(["extension", "extend", "impact"]);

  function planForPart(part, context = {}) {
    const parts = context.parts || [];
    const bridge = context.bridge || {};
    const action = bridge.jointAction || {};
    const frame = normalizedFrame(context.frame);
    const beat = beatForFrame(action, frame);
    const inactive = (reason) => inactivePlan(part, frame, beat, reason);
    if (!isPunchAction(action)) return inactive("not-punch-action");
    const existingHint = Animotion.armExtension?.renderHintForPart?.(part, context);
    if (!part?.id || (part.id !== primaryIdFor(bridge, action, context) && !existingHint?.active)) return inactive("not-primary");
    if (!isArmPart(part)) return inactive("not-arm-part");
    if (terminalHandFor(part, parts)) return inactive("separate-hand-rig");
    const handTip = handTipForPart(part);
    if (!handTip) return inactive("missing-handTip");
    const style = punchStyleInfo(context, part);
    if (style.punchStyle !== "rear-cross") return inactive("not-strong-extension-style");
    if (!activeBeatFrame(action, frame, beat)) return inactive("not-extension-or-impact-frame");
    return activePlan(part, context, action, frame, beat, handTip, style);
  }

  function debugForFrame(context = {}) {
    const bridge = context.bridge || {};
    const action = bridge.jointAction || {};
    const id = primaryIdFor(bridge, action, context);
    const part = (context.parts || []).find((candidate) => candidate.id === id);
    const plan = part ? planForPart(part, context) : inactivePlan(null, context.frame, null, "missing-primary");
    return {
      replacementActive: plan.active,
      replacementReason: plan.active ? "active" : plan.reason,
      replacementFrame: plan.frame,
      replacementBeat: plan.beatLabel,
      replacementPartId: plan.partId,
      replacementSkipsNormalDraw: Boolean(plan.skipNormalDraw),
    };
  }

  function activePlan(part, context, action, frame, beat, handTip, style) {
    const pose = Animotion.timeline?.evaluatePartAtFrame?.(part, frame) || part.customMotion || {};
    const base = baseControls(part, handTip);
    const evaluated = evaluatedControls(part, base, pose);
    return {
      active: true,
      reason: "active",
      partId: part.id,
      frame,
      beatLabel: beat?.label || beat?.id || "impact",
      sourceRect: rectBounds(part.rect),
      sourceBounds: rectBounds(part.rect),
      shoulder: evaluated.shoulder,
      elbow: evaluated.elbow,
      handTip: evaluated.handTip,
      fist: evaluated.handTip,
      target: actionTargetForFrame(action, frame) || evaluated.handTip,
      baseControls: base,
      evaluatedPose: pose,
      controls: { base, target: { shoulder: evaluated.shoulder, elbow: evaluated.elbow, hand: evaluated.handTip } },
      skipNormalDraw: true,
      handTipSource: handTip.source,
      punchStyleSource: style.source,
      legacyDepthCompat: style.legacyDepthCompat,
    };
  }

  function inactivePlan(part, frame, beat, reason) {
    return {
      active: false,
      reason,
      partId: part?.id || null,
      frame: normalizedFrame(frame),
      beatLabel: beat?.label || beat?.id || null,
      sourceRect: part?.rect ? rectBounds(part.rect) : null,
      skipNormalDraw: false,
    };
  }

  function activeBeatFrame(action, frame, beat) {
    if (beat && ACTIVE_BEATS.has(normalizeBeatId(beat.id))) return true;
    const frames = actionBeats(action)
      .map((entry) => ({ id: normalizeBeatId(entry.id), frame: normalizedFrame(entry.at) }))
      .filter((entry) => ACTIVE_BEATS.has(entry.id));
    return frames.some((entry) => Math.abs(entry.frame - frame) <= 1);
  }

  function beatForFrame(action = {}, frame) {
    const beats = actionBeats(action);
    const exact = beats.find((beat) => normalizedFrame(beat.at) === frame);
    const nearby = beats.find((beat) => Math.abs(normalizedFrame(beat.at) - frame) <= 1);
    return labelBeat(exact || nearby || currentBeat(beats, frame));
  }

  function actionBeats(action = {}) {
    const beats = Array.isArray(action.beats) ? action.beats : [];
    const timeline = Array.isArray(action.actionTimeline?.beats) ? action.actionTimeline.beats : [];
    const byId = new Map(beats.map((beat) => [beat.id, beat]));
    return timeline.length ? timeline.map((beat) => ({ ...beat, ...(byId.get(beat.id) || {}) })) : beats;
  }

  function currentBeat(beats, frame) {
    return beats.reduce((best, beat) => {
      if (normalizedFrame(beat.at) > frame) return best;
      return !best || normalizedFrame(beat.at) >= normalizedFrame(best.at) ? beat : best;
    }, null);
  }

  function actionTargetForFrame(action = {}, frame) {
    const focus = action.focusKey;
    if (!focus) return pointObject(action.targetDebug?.convertedTarget);
    const beat = actionBeats(action).find((entry) => normalizedFrame(entry.at) === frame)
      || actionBeats(action).find((entry) => normalizeBeatId(entry.id) === "impact");
    return pointFromArray(beat?.pose?.[focus]) || pointObject(action.targetDebug?.convertedTarget);
  }

  function baseControls(part, handTip) {
    return {
      shoulder: absolutePoint(part, part.pivot),
      elbow: absolutePoint(part, part.joint),
      handTip: absolutePoint(part, handTip.point),
    };
  }

  function evaluatedControls(part, base, pose) {
    return Object.fromEntries(Object.entries(base).map(([key, point]) => [key, transformedPoint(part, point, pose)]));
  }

  function transformedPoint(part, point, pose = {}) {
    const pivot = absolutePoint(part, part.pivot);
    const radians = (Number(pose.rotate || 0) + jointRotation(part, pose)) * Math.PI / 180;
    const scaleY = 1 + Number(pose.scaleY || 0);
    const x = point.x - pivot.x;
    const y = (point.y - pivot.y) * scaleY;
    return {
      x: pivot.x + Number(pose.x || 0) + Math.cos(radians) * x - Math.sin(radians) * y,
      y: pivot.y + Number(pose.y || 0) + Math.sin(radians) * x + Math.cos(radians) * y,
    };
  }

  function jointRotation(part, pose = {}) {
    const base = { x: Number(part.joint?.x || 0) - Number(part.pivot?.x || 0), y: Number(part.joint?.y || 0) - Number(part.pivot?.y || 0) };
    const target = { x: base.x + Number(pose.jointX || 0), y: base.y + Number(pose.jointY || 0) };
    if (distance({ x: 0, y: 0 }, base) < 1 || distance({ x: 0, y: 0 }, target) < 1) return 0;
    return (Math.atan2(target.y, target.x) - Math.atan2(base.y, base.x)) * 180 / Math.PI;
  }

  function handTipForPart(part) {
    const saved = Animotion.rigging?.handTipForPart?.(part) || (part.handTip ? pointObject(part.handTip) : null);
    if (saved) return { source: "saved", point: saved };
    const inferred = Animotion.armExtension?.inferredHandTip?.(part);
    return inferred ? { source: "inferred", point: inferred } : null;
  }

  function terminalHandFor(part, parts) {
    return parts.find((candidate) => candidate.id !== part?.id && partKind(candidate) === "hand" && isDescendantOf(candidate, part.id, parts))
      || parts.find((candidate) => candidate.id !== part?.id && partKind(candidate) === "hand" && numberedSuffix(candidate) === numberedSuffix(part));
  }

  function isDescendantOf(part, ancestorId, parts) {
    let current = part;
    const seen = new Set();
    while (parentIdFor(current)) {
      const parentId = parentIdFor(current);
      if (parentId === ancestorId) return true;
      if (seen.has(parentId)) return false;
      seen.add(parentId);
      current = parts.find((candidate) => candidate.id === parentId);
      if (!current) return false;
    }
    return false;
  }

  function primaryIdFor(bridge = {}, action = {}, context = {}) {
    return bridge.primaryPartId || action.targetDebug?.primaryPartId || context.selectedPartId || null;
  }

  function punchStyleInfo(context, part) {
    return Animotion.armExtension?.punchStyleInfo?.(context, part) || { punchStyle: context.bridge?.jointAction?.targetDebug?.punchStyle || null, source: "targetDebug", legacyDepthCompat: false };
  }

  function labelBeat(beat) {
    if (!beat) return null;
    const id = normalizeBeatId(beat.id);
    return { ...beat, label: id === "extend" ? "extension" : id };
  }

  function isPunchAction(action = {}) { return action.actionTimeline?.template === "punch" || String(action.source || "").includes("punch"); }
  function isArmPart(part = {}) { return part.type === "arm" || ["upperArm", "forearm"].includes(part.humanRole); }
  function partKind(part = {}) { return part.humanRole || part.type || ""; }
  function parentIdFor(part = {}) { return Animotion.rigConnection?.parentIdFor?.(part) || part.parentId || part.parentPartId || null; }
  function numberedSuffix(part) { return String(`${part?.id || ""} ${part?.name || ""}`).match(/(?:^|[^0-9])([0-9]+)(?!.*[0-9])/)?.[1] || null; }
  function normalizeBeatId(id) { return String(id || "").toLowerCase(); }
  function normalizedFrame(frame) { return Math.max(1, Math.round(Number(frame) || 1)); }
  function rectBounds(rect = {}) { return { x: Number(rect.x), y: Number(rect.y), w: Number(rect.w), h: Number(rect.h) }; }
  function absolutePoint(part, local) { return { x: Number(part.rect?.x || 0) + Number(local?.x || 0), y: Number(part.rect?.y || 0) + Number(local?.y || 0) }; }
  function pointFromArray(point) { return point ? finitePoint({ x: Number(point.x ?? point[0]), y: Number(point.y ?? point[1]) }) : null; }
  function pointObject(point) { return point ? finitePoint({ x: Number(point.x), y: Number(point.y) }) : null; }
  function finitePoint(point) { return Number.isFinite(point.x) && Number.isFinite(point.y) ? point : null; }
  function distance(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }

  Animotion.motionReplacementLayer = { planForPart, debugForFrame };
  if (typeof module !== "undefined") module.exports = Animotion.motionReplacementLayer;
}
