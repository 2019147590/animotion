{
  const global = typeof window !== "undefined" ? window : globalThis;
  const Animotion = global.Animotion || (global.Animotion = {});
  const SIDE_PIVOT = { innerNear: 0.12, innerFar: 0.88, armY: 0.14, legY: 0.08 };

  function defaultPivotForPart(type, rect, parentRect = null) {
    if (type === "arm") return armShoulderPivot(rect, parentRect);
    if (type === "leg") return legHipPivot(rect, parentRect);
    if (type === "hair") return { x: rect.w * 0.5, y: rect.h * 0.12 };
    return { x: rect.w * 0.5, y: rect.h * 0.5 };
  }

  function defaultJointForPart(type, rect, parentRect = null) {
    if (type === "arm") return limbJoint(rect, parentRect, 0.68);
    if (type === "leg") return limbJoint(rect, parentRect, 0.88);
    return { x: rect.w * 0.5, y: rect.h * 0.5 };
  }

  function defaultHandTipForPart(type, rect, parentRect = null) {
    if (type !== "arm") return null;
    return limbJoint(rect, parentRect, 0.88);
  }

  function handTipForPart(part = {}) {
    if (validHandTipForPart(part, part.handTip)) return localPoint(part.handTip);
    return inferredHandTipForPart(part);
  }

  function validHandTipForPart(part = {}, point = part.handTip) {
    if (!isArmPart(part)) return false;
    const handTip = localPoint(point);
    const joint = localPoint(part.joint);
    if (!handTip || !joint) return false;
    return distance(handTip, joint) >= minimumHandTipGap(part);
  }

  function inferredHandTipForPart(part = {}) {
    if (!isArmPart(part)) return null;
    const rect = part.rect || {};
    const pivot = part.pivot || { x: Number(rect.w || 0) * 0.5, y: Number(rect.h || 0) * 0.16 };
    const joint = part.joint || { x: Number(rect.w || 0) * 0.5, y: Number(rect.h || 0) * 0.88 };
    const dx = Number(joint.x || 0) - Number(pivot.x || 0);
    const dy = Number(joint.y || 0) - Number(pivot.y || 0);
    const length = Math.max(1, Math.hypot(dx, dy));
    const extension = Math.max(8, Math.min(length * 0.42, Math.max(Number(rect.w || 0), Number(rect.h || 0)) * 0.45));
    return { x: Math.round(Number(joint.x || 0) + dx / length * extension), y: Math.round(Number(joint.y || 0) + dy / length * extension) };
  }

  function armShoulderPivot(rect, parentRect) {
    if (!parentRect) return { x: rect.w * 0.5, y: rect.h * 0.12 };
    return sidePivot(rect, parentRect, SIDE_PIVOT.armY);
  }

  function legHipPivot(rect, parentRect) {
    if (!parentRect) return { x: rect.w * 0.5, y: rect.h * 0.08 };
    return sidePivot(rect, parentRect, SIDE_PIVOT.legY);
  }

  function sidePivot(rect, parentRect, yRatio) {
    const partCenter = rect.x + rect.w * 0.5;
    const parentCenter = parentRect.x + parentRect.w * 0.5;
    const xRatio = partCenter < parentCenter ? SIDE_PIVOT.innerFar : SIDE_PIVOT.innerNear;
    return { x: rect.w * xRatio, y: rect.h * yRatio };
  }

  function limbJoint(rect, parentRect, yRatio) {
    if (!parentRect) return { x: rect.w * 0.5, y: rect.h * yRatio };
    const pivot = sidePivot(rect, parentRect, yRatio);
    const xRatio = pivot.x > rect.w * 0.5 ? SIDE_PIVOT.innerNear : SIDE_PIVOT.innerFar;
    return { x: rect.w * xRatio, y: rect.h * yRatio };
  }

  function localPointFromImagePoint(rect, point) {
    return {
      x: point.x - rect.x,
      y: point.y - rect.y,
    };
  }

  function isArmPart(part = {}) {
    return part.type === "arm" || part.humanRole === "forearm" || part.humanRole === "upperArm";
  }

  function localPoint(point = null) {
    if (!point) return null;
    const x = Number(point.x ?? point[0]);
    const y = Number(point.y ?? point[1]);
    return Number.isFinite(x) && Number.isFinite(y) ? { x, y } : null;
  }

  function minimumHandTipGap(part = {}) {
    const rect = part.rect || {};
    return Math.max(2, Math.min(8, Math.max(Number(rect.w) || 0, Number(rect.h) || 0) * 0.12));
  }

  function distance(a, b) {
    return Math.hypot(a.x - b.x, a.y - b.y);
  }

  Animotion.rigging = { defaultPivotForPart, defaultJointForPart, defaultHandTipForPart, handTipForPart, validHandTipForPart, inferredHandTipForPart, localPointFromImagePoint };

  if (typeof module !== "undefined") module.exports = Animotion.rigging;
}
