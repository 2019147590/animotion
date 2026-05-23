{
  const global = typeof window !== "undefined" ? window : globalThis;
  const Animotion = global.Animotion || (global.Animotion = {});
  const ARM_ROLES = new Set(["upperArm", "forearm", "hand"]);
  const LABELS = {
    upperArm: {
      pivot: "어깨 회전점 / shoulder pivot",
      joint: "팔꿈치 연결점 / elbow joint",
      handTip: "손끝점",
    },
    forearm: {
      pivot: "팔꿈치 회전점 / elbow pivot",
      joint: "손목 연결점 / wrist joint",
      handTip: "손끝점",
    },
    hand: {
      pivot: "손목 회전점 / wrist pivot",
      joint: "관절점",
      handTip: "주먹 타격점 / punch contact point",
    },
    legacy: {
      pivot: "회전 중심",
      joint: "관절점",
      handTip: "손끝점",
    },
  };

  function explicitRole(part = {}) {
    const role = part.humanRole ? String(part.humanRole) : "";
    return ARM_ROLES.has(role) ? role : null;
  }

  function isHumanArmPart(part = {}) {
    return Boolean(explicitRole(part));
  }

  function roleLabels(part = {}) {
    return LABELS[explicitRole(part)] || LABELS.legacy;
  }

  function labelFor(part = {}, role = "") {
    const labels = roleLabels(part);
    if (role === "rotationPivot" || role === "anchor" || role === "pivot") return labels.pivot;
    if (role === "joint") return labels.joint;
    if (role === "handTip") return labels.handTip;
    return null;
  }

  function editableRoles(part = {}) {
    const role = explicitRole(part);
    if (role === "upperArm" || role === "forearm") return new Set(["rotationPivot", "anchor", "joint"]);
    if (role === "hand") return new Set(["rotationPivot", "anchor", "handTip"]);
    const legacy = new Set(["rotationPivot", "anchor", "joint"]);
    if (part.type === "arm") legacy.add("handTip");
    return legacy;
  }

  function isRoleEditable(part = {}, role = "") {
    return editableRoles(part).has(role);
  }

  function shouldShowPoint(part = {}, role = "") {
    if (role === "handTip") return isRoleEditable(part, "handTip");
    if (role === "joint") return isRoleEditable(part, "joint");
    if (role === "rotationPivot" || role === "anchor") return true;
    return true;
  }

  function handTipForPart(part = {}, parent = null) {
    if (explicitRole(part) === "hand") return savedHandTip(part) || inferredContactPoint(part, parent);
    if (explicitRole(part)) return null;
    return null;
  }

  function contactPointForPart(part = {}, parent = null) {
    if (explicitRole(part) === "hand") return savedHandTip(part) || inferredContactPoint(part, parent);
    return savedHandTip(part) || null;
  }

  function defaultPivotForRole(role, rect = {}, parentRect = null) {
    if (role === "upperArm") return proximalPoint(rect, parentRect, 0.14);
    if (role === "forearm") return proximalPoint(rect, parentRect, 0.28);
    if (role === "hand") return proximalPoint(rect, parentRect, 0.5);
    return null;
  }

  function defaultJointForRole(role, rect = {}, parentRect = null) {
    if (role === "upperArm") return distalPoint(rect, parentRect, 0.78);
    if (role === "forearm") return distalPoint(rect, parentRect, 0.62);
    return null;
  }

  function defaultHandTipForRole(role, rect = {}, parentRect = null) {
    if (role !== "hand") return null;
    return inferredContactPoint({ rect, pivot: defaultPivotForRole(role, rect, parentRect) }, parentRect ? { rect: parentRect } : null);
  }

  function inferredContactPoint(part = {}, parent = null) {
    const rect = part.rect || {};
    const pivot = localPoint(part.pivot) || { x: Number(rect.w || 0) * 0.5, y: Number(rect.h || 0) * 0.5 };
    const center = { x: Number(rect.w || 0) * 0.5, y: Number(rect.h || 0) * 0.5 };
    const parentCenter = parent?.rect ? absoluteCenter(parent.rect) : null;
    const partCenter = rect ? absoluteCenter(rect) : null;
    const fallback = parentCenter && partCenter
      ? { x: partCenter.x - parentCenter.x, y: partCenter.y - parentCenter.y }
      : { x: center.x - pivot.x, y: center.y - pivot.y };
    const direction = unitVector(fallback) || { x: 1, y: 0 };
    return rectEdgePoint(pivot, direction, rect);
  }

  function savedHandTip(part = {}) {
    return localPoint(part.handTip);
  }

  function proximalPoint(rect = {}, parentRect = null, yRatio = 0.2) {
    if (!parentRect) return { x: Number(rect.w || 0) * 0.5, y: Number(rect.h || 0) * yRatio };
    const parentCenter = absoluteCenter(parentRect), localCenter = absoluteCenter(rect);
    const nearLeft = localCenter.x < parentCenter.x;
    return { x: Number(rect.w || 0) * (nearLeft ? 0.82 : 0.18), y: Number(rect.h || 0) * yRatio };
  }

  function distalPoint(rect = {}, parentRect = null, yRatio = 0.78) {
    const proximal = proximalPoint(rect, parentRect, yRatio);
    const farLeft = proximal.x > Number(rect.w || 0) * 0.5;
    return { x: Number(rect.w || 0) * (farLeft ? 0.18 : 0.82), y: Number(rect.h || 0) * yRatio };
  }

  function rectEdgePoint(origin, direction, rect = {}) {
    const w = Math.max(1, Number(rect.w || 1)), h = Math.max(1, Number(rect.h || 1));
    const tx = direction.x > 0 ? (w - origin.x) / direction.x : direction.x < 0 ? -origin.x / direction.x : Infinity;
    const ty = direction.y > 0 ? (h - origin.y) / direction.y : direction.y < 0 ? -origin.y / direction.y : Infinity;
    const distance = Math.max(1, Math.min(...[tx, ty].filter(Number.isFinite)));
    return { x: clamp(origin.x + direction.x * distance, 0, w), y: clamp(origin.y + direction.y * distance, 0, h) };
  }

  function absoluteCenter(rect = {}) {
    return { x: Number(rect.x || 0) + Number(rect.w || 0) * 0.5, y: Number(rect.y || 0) + Number(rect.h || 0) * 0.5 };
  }

  function unitVector(vector = {}) {
    const length = Math.hypot(Number(vector.x || 0), Number(vector.y || 0));
    return length > 0.001 ? { x: Number(vector.x || 0) / length, y: Number(vector.y || 0) / length } : null;
  }

  function localPoint(point = null) {
    if (!point) return null;
    const x = Number(point.x ?? point[0]);
    const y = Number(point.y ?? point[1]);
    return Number.isFinite(x) && Number.isFinite(y) ? { x, y } : null;
  }

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  Animotion.armRoleSemantics = {
    explicitRole,
    isHumanArmPart,
    roleLabels,
    labelFor,
    editableRoles,
    isRoleEditable,
    shouldShowPoint,
    handTipForPart,
    contactPointForPart,
    inferredContactPoint,
    defaultPivotForRole,
    defaultJointForRole,
    defaultHandTipForRole,
  };
  if (typeof module !== "undefined") module.exports = Animotion.armRoleSemantics;
}
