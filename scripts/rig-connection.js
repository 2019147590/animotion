{
  const global = typeof window !== "undefined" ? window : globalThis;
  const Animotion = global.Animotion || (global.Animotion = {});
  const CONNECTION_LABELS = {
    neck: "목 연결점",
    shoulder: "어깨 연결점",
    elbow: "팔꿈치 연결점",
    wrist: "손목 연결점",
    hip: "골반 연결점",
    none: "연결점 없음",
  };

  function metadataForPart(part = {}, parent = null) {
    const self = normalizeAttachKey(part.attachPointSelf || selfAttachKey(part, parent));
    const parentKey = normalizeAttachKey(part.attachPointParent || parentAttachKey(part, parent));
    const rotationPivot = localPoint(part.rotationPivot || part.pivot, part.rect);
    return {
      parentPartId: part.parentPartId || part.parentId || null,
      attachPointSelf: self,
      attachPointParent: parentKey,
      rotationPivot,
      followStrength: numberInRange(part.followStrength, 0, 1, 1),
    };
  }

  function parentIdFor(part = {}) {
    return part.parentId || part.parentPartId || null;
  }

  function previewPoints(part, parent = null) {
    const meta = metadataForPart(part, parent);
    const points = [
      pointSpec("connection", meta.attachPointSelf, localAttachPoint(part, meta.attachPointSelf), labelForAttach(meta.attachPointSelf)),
      pointSpec("rotationPivot", "rotationPivot", meta.rotationPivot, "회전 중심"),
      pointSpec("joint", "joint", localPoint(part.joint, part.rect), "관절점"),
    ];
    if (parent) points.push(pointSpec("parentConnection", meta.attachPointParent, parentAttachPoint(parent, part, meta.attachPointParent), labelForAttach(meta.attachPointParent)));
    return points.filter((point) => point.localPoint);
  }

  function bodyRootPoint(parts = []) {
    const part = rootPart(parts);
    return part ? { part, role: "bodyRoot", localPoint: localPoint(part.pivot, part.rect), label: "몸 기준점" } : null;
  }

  function labelForRole(role) {
    if (role === "connection" || role === "parentConnection") return "연결점";
    if (role === "rotationPivot" || role === "anchor") return "회전 중심";
    if (role === "joint") return "관절점";
    if (role === "trajectory") return "이동 경로점";
    if (role === "hiddenGuide") return "보완 가이드 점";
    if (role === "bodyRoot") return "몸 기준점";
    return "편집점";
  }

  function userDebugLabels() {
    return {
      rootDelta: "몸 전체 이동",
      characterRootDelta: "몸 전체 이동",
      bodyRootPartId: "몸 기준 파츠",
      primaryPartId: "대표 파츠",
      bodyFollowStrength: "몸통 따라가기",
      trajectoryPoint: "이동 경로점",
      pivot: "회전 중심",
      joint: "관절점",
      hiddenCompletionGuideVertex: "보완 가이드 점",
    };
  }

  function pointSpec(role, key, localPointValue, label) {
    return { role, key, localPoint: localPointValue, label };
  }

  function selfAttachKey(part, parent) {
    if (!parent) return "none";
    if (part.type === "head") return "neck";
    if (part.type === "hand") return "wrist";
    if (isForearm(part, parent)) return "elbow";
    if (part.type === "arm") return "shoulder";
    if (part.type === "leg") return "hip";
    return "none";
  }

  function parentAttachKey(part, parent) {
    if (!parent) return "none";
    if (part.type === "head") return "neck";
    if (part.type === "hand") return "wrist";
    if (isForearm(part, parent)) return "elbow";
    if (part.type === "arm") return "shoulder";
    if (part.type === "leg") return "hip";
    return "none";
  }

  function isForearm(part, parent) {
    const name = `${part.name || ""} ${part.id || ""}`.toLowerCase();
    return parent?.type === "arm" || name.includes("forearm") || name.includes("lower_arm");
  }

  function parentAttachPoint(parent, child, key) {
    if (key === "neck") return { x: parent.rect.w * 0.5, y: parent.rect.h * 0.05 };
    if (key === "shoulder") return shoulderPoint(parent, child);
    if (key === "elbow" || key === "wrist") return localPoint(parent.joint, parent.rect);
    if (key === "hip") return { x: parent.rect.w * 0.5, y: parent.rect.h * 0.78 };
    return null;
  }

  function localAttachPoint(part, key) {
    if (key === "none") return null;
    return localPoint(part.pivot, part.rect);
  }

  function shoulderPoint(parent, child) {
    const parentCenter = parent.rect.x + parent.rect.w * 0.5;
    const childCenter = child.rect.x + child.rect.w * 0.5;
    return { x: childCenter < parentCenter ? parent.rect.w * 0.18 : parent.rect.w * 0.82, y: parent.rect.h * 0.18 };
  }

  function localPoint(point, rect = {}) {
    if (!point) return null;
    const x = Number(point.x ?? point[0]);
    const y = Number(point.y ?? point[1]);
    if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
    return { x, y };
  }

  function normalizeAttachKey(value) {
    const key = String(value || "none");
    return Object.hasOwn(CONNECTION_LABELS, key) ? key : "none";
  }

  function labelForAttach(key) {
    return CONNECTION_LABELS[normalizeAttachKey(key)];
  }

  function rootPart(parts = []) {
    return parts.find((part) => part.type === "spine") || parts.find((part) => part.type === "body") || null;
  }

  function numberInRange(value, min, max, fallback) {
    const number = Number(value);
    return Number.isFinite(number) ? Math.min(max, Math.max(min, number)) : fallback;
  }

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  Animotion.rigConnection = { metadataForPart, parentIdFor, previewPoints, bodyRootPoint, labelForRole, userDebugLabels };
  if (typeof module !== "undefined") module.exports = Animotion.rigConnection;
}
