{
  const global = typeof window !== "undefined" ? window : globalThis;
  const Animotion = global.Animotion || (global.Animotion = {});

  function inferJointPose(parts = []) {
    const body = mainPart(parts, ["spine", "body"]) || parts[0];
    const head = mainPart(parts, ["head"]);
    const arms = sideParts(parts, "arm", body);
    const legs = sideParts(parts, "leg", body);
    return {
      hip: rounded(bottomPoint(body)),
      chest: rounded(topPoint(body)),
      head: rounded(centerPoint(head || body)),
      ...limbPose("l", arms.left, body, "arm"),
      ...limbPose("r", arms.right, body, "arm"),
      ...limbPose("l", legs.left, body, "leg"),
      ...limbPose("r", legs.right, body, "leg"),
    };
  }

  function createJointAction(parts, primaryId, bridge) {
    const base = inferJointPose(parts);
    const primary = parts.find((part) => part.id === primaryId) || parts[0];
    const side = Animotion.poseAssist?.actionSide?.(primary, parts) || 1;
    const impact = bridge?.impactFrame || 15;
    return {
      source: "part-pivots-v1",
      beats: [
        { id: "stance", at: 1, pose: base },
        { id: "compress", at: Math.max(1, impact - 10), pose: shiftedPose(base, -side * 8, 10) },
        { id: "launch", at: Math.max(1, impact - 5), pose: shiftedPose(base, side * 20, -18) },
        { id: "impact", at: impact, pose: shiftedPose(base, side * 34, -24) },
      ],
    };
  }

  function mainPart(parts, types) {
    return types.map((type) => parts.find((part) => part.type === type)).find(Boolean);
  }

  function sideParts(parts, type, body) {
    const candidates = parts.filter((part) => part.type === type).sort((a, b) => centerPoint(a).x - centerPoint(b).x);
    const bodyX = centerPoint(body || candidates[0]).x;
    return {
      left: candidates.filter((part) => centerPoint(part).x < bodyX).pop() || candidates[0] || null,
      right: candidates.find((part) => centerPoint(part).x >= bodyX) || candidates[1] || candidates[0] || null,
    };
  }

  function limbPose(prefix, part, body, type) {
    const rootKey = type === "arm" ? `${prefix}Shoulder` : null;
    const midKey = type === "arm" ? `${prefix}Elbow` : `${prefix}Knee`;
    const endKey = type === "arm" ? `${prefix}Hand` : `${prefix}Foot`;
    const root = part ? absolutePoint(part, localRoot(part, type)) : bodyFallback(body, prefix, type);
    const end = part ? absolutePoint(part, localEnd(part, type)) : bodyFallback(body, prefix, type);
    const mid = lerpPoint(root, end, 0.56);
    if (type === "arm") return { [rootKey]: rounded(root), [midKey]: rounded(mid), [endKey]: rounded(end) };
    return { [midKey]: rounded(mid), [endKey]: rounded(end) };
  }

  function bodyFallback(body, prefix, type) {
    const box = body || { rect: { x: 0, y: 0, w: 1, h: 1 } };
    const xBias = prefix === "l" ? 0.28 : 0.72;
    const yRatio = type === "arm" ? 0.28 : 0.9;
    return { x: box.rect.x + box.rect.w * xBias, y: box.rect.y + box.rect.h * yRatio };
  }

  function absolutePoint(part, point) {
    return { x: part.rect.x + point.x, y: part.rect.y + point.y };
  }

  function localRoot(part, type) {
    if (part.pivot) return part.pivot;
    const y = type === "arm" ? 0.16 : 0.08;
    return { x: part.rect.w * 0.5, y: part.rect.h * y };
  }

  function localEnd(part) {
    if (part.joint) return part.joint;
    return { x: part.rect.w * 0.5, y: part.rect.h * 0.88 };
  }

  function centerPoint(part) {
    if (!part) return { x: 0, y: 0 };
    return { x: part.rect.x + part.rect.w * 0.5, y: part.rect.y + part.rect.h * 0.5 };
  }

  function topPoint(part) {
    if (!part) return { x: 0, y: 0 };
    return { x: part.rect.x + part.rect.w * 0.5, y: part.rect.y + part.rect.h * 0.18 };
  }

  function bottomPoint(part) {
    if (!part) return { x: 0, y: 0 };
    return { x: part.rect.x + part.rect.w * 0.5, y: part.rect.y + part.rect.h * 0.86 };
  }

  function shiftedPose(pose, x, y) {
    return Object.fromEntries(Object.entries(pose).map(([key, point]) => [key, rounded({ x: point[0] + x, y: point[1] + y })]));
  }

  function lerpPoint(a, b, ratio) {
    return { x: a.x + (b.x - a.x) * ratio, y: a.y + (b.y - a.y) * ratio };
  }

  function rounded(point) {
    return [Math.round(point.x), Math.round(point.y)];
  }

  Animotion.jointCoordinates = { inferJointPose, createJointAction };

  if (typeof module !== "undefined") module.exports = Animotion.jointCoordinates;
}
