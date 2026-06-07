{
  const global = typeof window !== "undefined" ? window : globalThis;
  const Animotion = global.Animotion || (global.Animotion = {});

  function rebasedRigPoints(part, parts = [], nextRect = part?.rect) {
    const anchors = linkedAnchors(part, parts);
    const own = ownAnchors(part);
    return {
      pivot: localPointFromAbsolute(anchors.pivot || own.pivot, nextRect),
      joint: localPointFromAbsolute(anchors.joint || own.joint, nextRect),
      ...(own.handTip ? { handTip: localPointFromAbsolute(own.handTip, nextRect) } : {}),
    };
  }

  function linkedAnchors(part, parts) {
    const role = roleFor(part);
    if (role === "upperArm") return upperArmAnchors(part, parts);
    if (role === "forearm") return forearmAnchors(part, parts);
    if (role === "hand") return handAnchors(part, parts);
    return {};
  }

  function upperArmAnchors(part, parts) {
    const forearm = childWithRole(part, parts, "forearm");
    return forearm?.pivot ? { joint: absolutePoint(forearm, forearm.pivot) } : {};
  }

  function forearmAnchors(part, parts) {
    const parent = parentPart(part, parts);
    const hand = childWithRole(part, parts, "hand");
    return {
      ...(roleFor(parent) === "upperArm" && parent?.joint ? { pivot: absolutePoint(parent, parent.joint) } : {}),
      ...(hand?.pivot ? { joint: absolutePoint(hand, hand.pivot) } : {}),
    };
  }

  function handAnchors(part, parts) {
    const parent = parentPart(part, parts);
    return roleFor(parent) === "forearm" && parent?.joint
      ? { pivot: absolutePoint(parent, parent.joint) }
      : {};
  }

  function ownAnchors(part) {
    return {
      pivot: absolutePoint(part, part.pivot),
      joint: absolutePoint(part, part.joint),
      handTip: part.handTip ? absolutePoint(part, part.handTip) : null,
    };
  }

  function childWithRole(part, parts, role) {
    return parts.find((candidate) => parentIdFor(candidate) === part.id && roleFor(candidate) === role) || null;
  }

  function parentPart(part, parts) {
    const parentId = parentIdFor(part);
    return parentId ? parts.find((candidate) => candidate.id === parentId) || null : null;
  }

  function roleFor(part = null) {
    return part ? Animotion.armChainResolver?.roleFor?.(part) || part.humanRole || part.type || null : null;
  }

  function parentIdFor(part = {}) {
    return Animotion.rigConnection?.parentIdFor?.(part) || part.parentId || part.parentPartId || null;
  }

  function absolutePoint(part, point) {
    return { x: Number(part.rect?.x || 0) + Number(point?.x || 0), y: Number(part.rect?.y || 0) + Number(point?.y || 0) };
  }

  function localPointFromAbsolute(point, rect) {
    return { x: point.x - rect.x, y: point.y - rect.y };
  }

  Animotion.partShapeRigLink = { rebasedRigPoints };
  if (typeof module !== "undefined") module.exports = Animotion.partShapeRigLink;
}
