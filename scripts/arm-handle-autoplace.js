{
  const global = typeof window !== "undefined" ? window : globalThis;
  const Animotion = global.Animotion || (global.Animotion = {});

  function preview(parts = [], selected = null) {
    const chain = Animotion.armChainResolver?.resolve?.(parts, selected);
    if (!chain?.terminalPunchPartId) return result(false, chain, [], ["select an upperArm, forearm, or hand/glove chain"]);
    const upperArm = chain.upperArm || byId(parts, chain.upperArmId);
    const forearm = chain.forearm || byId(parts, chain.forearmId);
    const hand = chain.handOrGlove || byId(parts, chain.handOrGloveId);
    if (!upperArm || !forearm || !hand) return result(false, chain, [], compact(["separate arm chain requires upperArm, forearm, and hand/glove", chain.chainParentingWarning]));
    if (!chain.handParentIsForearm || !chain.forearmParentIsUpperArm) return result(false, chain, [], chain.chainWarnings || [chain.chainParentingWarning]);
    const patches = patchesFor(parts, upperArm, forearm, hand);
    return result(true, chain, patches, chain.chainWarnings || []);
  }

  function statusText(info = {}) {
    const chain = info.after || info.chain || {};
    const warnings = info.chainWarnings?.length ? ` · warnings ${info.chainWarnings.join("; ")}` : "";
    if (!info.ok) return `Auto place arm handles: unavailable${warnings}`;
    return `Auto place arm handles: elbow=${yesNo(chain.elbowConnectionValid)} wrist=${yesNo(chain.wristConnectionValid)} parenting=${yesNo(chain.chainParentingValid)} separateRig=${yesNo(chain.separateRigPath)}${warnings}`;
  }

  function patchesFor(parts, upperArm, forearm, hand) {
    const torso = torsoPart(parts), elbow = midpoint(center(upperArm), center(forearm)), wrist = midpoint(center(forearm), center(hand));
    const shoulder = shoulderPoint(upperArm, elbow, torso);
    const contact = contactPoint(hand, wrist);
    return [
      { partId: upperArm.id, patch: { pivot: localFromWorld(upperArm, shoulder), joint: localFromWorld(upperArm, elbow) } },
      { partId: forearm.id, patch: { pivot: localFromWorld(forearm, elbow), joint: localFromWorld(forearm, wrist) } },
      { partId: hand.id, patch: { pivot: localFromWorld(hand, wrist), handTip: localFromWorld(hand, contact) } },
    ];
  }

  function shoulderPoint(upperArm, elbow, torso) {
    const origin = center(upperArm);
    const target = torso ? center(torso) : { x: origin.x + (origin.x - elbow.x), y: origin.y + (origin.y - elbow.y) };
    return rectEdgePoint(upperArm.rect, origin, unitVector(origin, target) || { x: 0, y: -1 }, 0);
  }

  function contactPoint(hand, wrist) {
    const origin = center(hand);
    const direction = unitVector(wrist, origin) || { x: 1, y: 0 };
    const outset = Math.max(4, Math.max(Number(hand.rect?.w || 0), Number(hand.rect?.h || 0)) * 0.18);
    return rectEdgePoint(hand.rect, wrist, direction, outset);
  }

  function rectEdgePoint(rect = {}, origin, direction, outset = 0) {
    const left = Number(rect.x || 0), top = Number(rect.y || 0), right = left + Number(rect.w || 0), bottom = top + Number(rect.h || 0);
    const tx = direction.x > 0 ? (right - origin.x) / direction.x : direction.x < 0 ? (left - origin.x) / direction.x : Infinity;
    const ty = direction.y > 0 ? (bottom - origin.y) / direction.y : direction.y < 0 ? (top - origin.y) / direction.y : Infinity;
    const distance = Math.max(0, Math.min(...[tx, ty].filter(Number.isFinite))) + outset;
    return { x: origin.x + direction.x * distance, y: origin.y + direction.y * distance };
  }

  function result(ok, chain, patches, warnings) {
    return { ok, chain, patches, chainWarnings: compact(warnings), after: null };
  }

  function byId(parts, id) {
    return parts.find((part) => part.id === id) || null;
  }

  function torsoPart(parts = []) {
    return parts.find((part) => ["torso", "pelvis"].includes(part.humanRole) || ["body", "spine"].includes(part.type)) || null;
  }

  function center(part = {}) {
    return { x: Number(part.rect?.x || 0) + Number(part.rect?.w || 0) * 0.5, y: Number(part.rect?.y || 0) + Number(part.rect?.h || 0) * 0.5 };
  }

  function midpoint(a, b) {
    return { x: (a.x + b.x) * 0.5, y: (a.y + b.y) * 0.5 };
  }

  function localFromWorld(part, point) {
    return { x: point.x - Number(part.rect?.x || 0), y: point.y - Number(part.rect?.y || 0) };
  }

  function unitVector(from, to) {
    const dx = to.x - from.x, dy = to.y - from.y, length = Math.hypot(dx, dy);
    return length > 0.001 ? { x: dx / length, y: dy / length } : null;
  }

  function yesNo(value) {
    return value ? "yes" : "no";
  }

  function compact(values = []) {
    return values.filter((value) => value !== null && value !== undefined && value !== "");
  }

  Animotion.armHandleAutoPlace = { preview, statusText };
  if (typeof module !== "undefined") module.exports = Animotion.armHandleAutoPlace;
}
