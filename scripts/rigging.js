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

  Animotion.rigging = { defaultPivotForPart, defaultJointForPart, localPointFromImagePoint };

  if (typeof module !== "undefined") module.exports = Animotion.rigging;
}
