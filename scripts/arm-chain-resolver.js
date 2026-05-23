{
  const global = typeof window !== "undefined" ? window : globalThis;
  const Animotion = global.Animotion || (global.Animotion = {});
  const ARM_ROLES = new Set(["upperArm", "forearm", "hand"]);
  function resolve(parts = [], selected = null) {
    const selectedPart = typeof selected === "string" ? byId(parts, selected) : selected;
    if (!selectedPart || !ARM_ROLES.has(roleFor(selectedPart))) return inactive(selectedPart, "not-arm-chain-part");
    const map = new Map(parts.map((part) => [part.id, part]));
    const ancestry = ancestors(selectedPart, map);
    if (ancestry.invalid) return inactive(selectedPart, ancestry.reason);
    const family = chainFamily(parts, selectedPart, ancestry.items);
    if (family.invalid) return inactive(selectedPart, family.reason);
    const terminal = terminalHand(family.items, selectedPart);
    if (!terminal) return armOnlyOrInactive(selectedPart);
    const terminalAncestry = ancestors(terminal, map);
    if (terminalAncestry.invalid) return inactive(selectedPart, terminalAncestry.reason);
    const terminalFamily = chainFamily(parts, terminal, terminalAncestry.items);
    const upperArm = closestRole(terminalFamily.items, "upperArm");
    const forearm = closestRole(terminalFamily.items, "forearm");
    const relationship = chainRelationshipStatus(parts, { upperArm, forearm, handOrGlove: terminal });
    const terminalContact = terminalContactPoint(terminal, forearm);
    return {
      ok: true,
      reason: "connected-terminal-hand",
      selectedPartId: selectedPart.id,
      upperArm,
      forearm,
      handOrGlove: terminal,
      upperArmId: upperArm?.id || null,
      forearmId: forearm?.id || null,
      handOrGloveId: terminal.id,
      terminalPart: terminal,
      terminalPunchPartId: terminal.id,
      terminalContactPoint: terminalContact,
      terminalPunchPointSource: terminalContact.source,
      separateRigPath: relationship.chainClean,
      armOnlyHandTipPath: false,
      armOnlyFallback: false,
      ...relationship,
      chainPartIds: compact([upperArm?.id, forearm?.id, terminal.id]),
    };
  }

  function sameChainReference(previousPartId, selectedPartId, primaryPartId, parts = []) {
    if (!previousPartId) return false;
    if (previousPartId === selectedPartId || previousPartId === primaryPartId) return true;
    const selected = resolve(parts, selectedPartId);
    const primary = resolve(parts, primaryPartId);
    return chainContains(selected, previousPartId) || chainContains(primary, previousPartId);
  }

  function targetDebug(parts = [], selectedPartId = null, primary = null, roleDecision = null) {
    const chain = resolve(parts, selectedPartId || primary?.id);
    const separateRigPath = chain.separateRigPath === true;
    const side = roleDecision?.result === "rear-cross" ? "rear/rear-cross" : roleDecision?.result === "jab" ? "front/jab" : null;
    return {
      selectedPartId: selectedPartId || chain.selectedPartId || primary?.id || null,
      resolvedArmChain: {
        upperArmId: chain.upperArmId || null,
        forearmId: chain.forearmId || null,
        handOrGloveId: chain.handOrGloveId || null,
      },
      terminalPunchPartId: chain.terminalPunchPartId || primary?.id || null,
      terminalPunchPointSource: chain.terminalPunchPointSource || null,
      punchSide: side,
      classificationBasis: roleDecision?.classificationBasis || chain.reason || null,
      separateRigPath,
      armOnlyFallback: chain.armOnlyFallback === true || chain.armOnlyHandTipPath === true,
      handParentIsForearm: chain.handParentIsForearm === true,
      forearmParentIsUpperArm: chain.forearmParentIsUpperArm === true,
      elbowConnectionValid: chain.elbowConnectionValid === true,
      wristConnectionValid: chain.wristConnectionValid === true,
      chainParentingValid: chain.chainParentingValid === true,
      chainParentingWarning: chain.chainParentingWarning || null,
      chainWarnings: chain.chainWarnings || [],
      replacementLayerUsed: separateRigPath ? false : null,
      wristOverlapHandled: separateRigPath ? wristOverlapHandled(chain) : false,
      hiddenCompletionCandidate: separateRigPath ? hiddenCompletionCandidate(chain) : false,
      selectedToEndpointText: selectedPartId && chain.terminalPunchPartId && selectedPartId !== chain.terminalPunchPartId
        ? `selected ${selectedPartId} -> punching endpoint ${chain.terminalPunchPartId}`
        : null,
    };
  }

  function roleFor(part = {}) {
    const human = roleFromText(part.humanRole, true);
    if (human) return human;
    const typed = roleFromText(part.type, true);
    if (typed) return typed;
    return roleFromText(`${part.id || ""} ${part.name || ""}`, false);
  }

  function armOnlyOrInactive(part) {
    const hasHandTip = Boolean(Animotion.rigging?.handTipForPart?.(part) || part.handTip);
    return {
      ...inactive(part, hasHandTip ? "arm-only-handTip" : "missing-terminal-hand"),
      armOnlyHandTipPath: hasHandTip,
      armOnlyFallback: hasHandTip,
    };
  }

  function inactive(part, reason) {
    return {
      ok: false,
      reason,
      selectedPartId: part?.id || null,
      upperArmId: null,
      forearmId: null,
      handOrGloveId: null,
      terminalPunchPartId: null,
      terminalPunchPointSource: null,
      separateRigPath: false,
      armOnlyHandTipPath: false,
      armOnlyFallback: false,
      handParentIsForearm: false,
      forearmParentIsUpperArm: false,
      elbowConnectionValid: false,
      wristConnectionValid: false,
      chainParentingValid: false,
      chainParentingWarning: reason || null,
      chainWarnings: reason ? [reason] : [],
      chainPartIds: part?.id ? [part.id] : [],
    };
  }

  function ancestors(part, map) {
    const items = [part], seen = new Set([part.id]);
    let current = part;
    while (parentIdFor(current)) {
      const parentId = parentIdFor(current);
      if (seen.has(parentId)) return { invalid: true, reason: "cycle" };
      const parent = map.get(parentId);
      if (!parent) return { invalid: true, reason: "missing-parent" };
      seen.add(parentId);
      items.push(parent);
      current = parent;
    }
    return { invalid: false, items };
  }

  function chainFamily(parts, selected, ancestry) {
    const items = [...ancestry];
    const queue = [selected], seen = new Set(items.map((part) => part.id));
    while (queue.length) {
      const current = queue.shift();
      for (const child of parts.filter((part) => parentIdFor(part) === current.id)) {
        if (seen.has(child.id)) return { invalid: true, reason: "cycle" };
        seen.add(child.id);
        items.push(child);
        queue.push(child);
      }
    }
    return { invalid: false, items: items.filter((part) => ARM_ROLES.has(roleFor(part))) };
  }

  function terminalHand(items, selectedPart) {
    if (roleFor(selectedPart) === "hand") return selectedPart;
    return items.filter((part) => part.id !== selectedPart.id && roleFor(part) === "hand")
      .sort((a, b) => depthOf(b, items) - depthOf(a, items))[0] || null;
  }

  function closestRole(items, role) {
    return items.filter((part) => roleFor(part) === role).sort((a, b) => depthOf(b, items) - depthOf(a, items))[0] || null;
  }

  function depthOf(part, items) {
    let depth = 0, current = part;
    const ids = new Set(items.map((item) => item.id));
    while (parentIdFor(current) && ids.has(parentIdFor(current))) {
      depth += 1;
      current = items.find((item) => item.id === parentIdFor(current));
      if (!current) break;
    }
    return depth;
  }

  function roleFromText(value, exact) {
    const text = String(value || "").replace(/[_-]+/g, " ").toLowerCase();
    if (!text) return null;
    if (exact && (text === "upperarm" || text === "upper arm")) return "upperArm";
    if (exact && (text === "forearm" || text === "lowerarm" || text === "lower arm")) return "forearm";
    if (exact && (text === "hand" || text === "glove" || text === "fist")) return "hand";
    if (!exact && /\b(upperarm|upper arm|upper|shoulder|arm)\b/.test(text)) return "upperArm";
    if (!exact && /\b(forearm|lowerarm|lower arm|elbow)\b/.test(text)) return "forearm";
    if (!exact && /\b(hand|fist|glove)\b/.test(text)) return "hand";
    return null;
  }

  function wristOverlapHandled(chain) {
    return Boolean(chain.forearmId && chain.handOrGloveId);
  }

  function terminalContactPoint(terminal, forearm = null) {
    const saved = localPoint(terminal.handTip);
    const inferred = roleFor(terminal) === "hand" ? Animotion.armRoleSemantics?.inferredContactPoint?.(terminal, forearm) : null;
    const fallback = localPoint(terminal.joint) || centerPoint(terminal);
    const local = saved || inferred || fallback;
    const source = saved ? "handTip" : inferred ? "inferredContactPoint" : "fallback";
    return { local, image: local ? { x: Number(terminal.rect?.x || 0) + local.x, y: Number(terminal.rect?.y || 0) + local.y } : null, source };
  }

  function chainRelationshipStatus(parts = [], chain = {}) {
    const map = new Map(parts.map((part) => [part.id, part]));
    const hand = chain.handOrGlove || null, forearm = chain.forearm || null, upperArm = chain.upperArm || null;
    const handParent = parentPart(hand, map), forearmParent = parentPart(forearm, map), upperParent = parentPart(upperArm, map);
    const torso = parts.find(isTorsoPart) || null;
    const handParentIsForearm = Boolean(hand && forearm && handParent?.id === forearm.id && roleFor(handParent) === "forearm");
    const forearmParentIsUpperArm = Boolean(forearm && upperArm && forearmParent?.id === upperArm.id && roleFor(forearmParent) === "upperArm");
    const upperArmParentIsTorso = !torso || Boolean(upperArm && upperParent && isTorsoPart(upperParent));
    const elbowConnectionValid = Boolean(upperArm && forearm && connectedAt(upperArm, "joint", forearm, "pivot"));
    const wristConnectionValid = Boolean(forearm && hand && connectedAt(forearm, "joint", hand, "pivot"));
    const warnings = [];
    if (hand && !handParentIsForearm) warnings.push(parentIdFor(hand) ? "hand/glove parent must be forearm" : "hand/glove has no forearm parent");
    if (forearm && !forearmParentIsUpperArm) warnings.push(upperArm ? "forearm parent must be upperArm" : "forearm has no upperArm parent");
    if (upperArm && !upperArmParentIsTorso) warnings.push(parentIdFor(upperArm) ? "upperArm parent should be torso/shoulder" : "upperArm has no torso/shoulder parent");
    if (upperArm && forearm && !elbowConnectionValid) warnings.push("elbowConnection: upperArm.joint and forearm.pivot are not aligned");
    if (forearm && hand && !wristConnectionValid) warnings.push("wristConnection: forearm.joint and hand/glove.pivot are not aligned");
    const chainParentingValid = Boolean(hand && forearm && upperArm && handParentIsForearm && forearmParentIsUpperArm && upperArmParentIsTorso);
    const chainClean = chainParentingValid && elbowConnectionValid && wristConnectionValid;
    return {
      handParentIsForearm,
      forearmParentIsUpperArm,
      upperArmParentIsTorso,
      elbowConnectionValid,
      wristConnectionValid,
      chainParentingValid,
      chainClean,
      chainParentingWarning: warnings.join("; ") || null,
      chainWarnings: warnings,
    };
  }

  function connectedAt(parent, parentKey, child, childKey) {
    const a = worldPoint(parent, localPoint(parent?.[parentKey]));
    const b = worldPoint(child, localPoint(child?.[childKey]));
    return Boolean(a && b && distance(a, b) <= connectionTolerance(parent, child));
  }

  function worldPoint(part, point) {
    return part?.rect && point ? { x: Number(part.rect.x || 0) + point.x, y: Number(part.rect.y || 0) + point.y } : null;
  }

  function connectionTolerance(a = {}, b = {}) {
    const maxSize = Math.max(Number(a.rect?.w || 0), Number(a.rect?.h || 0), Number(b.rect?.w || 0), Number(b.rect?.h || 0));
    return Math.max(8, Math.min(24, maxSize * 0.25));
  }

  function distance(a, b) {
    return Math.hypot(a.x - b.x, a.y - b.y);
  }

  function parentPart(part, map) {
    const id = part ? parentIdFor(part) : null;
    return id ? map.get(id) || null : null;
  }

  function isTorsoPart(part = {}) {
    return ["torso", "pelvis"].includes(part.humanRole) || ["body", "spine"].includes(part.type);
  }

  function hiddenCompletionCandidate(chain) {
    const forearm = chain.forearm, hand = chain.handOrGlove;
    if (!forearm?.rect || !hand?.rect) return false;
    return !expandedOverlap(forearm.rect, hand.rect, 6);
  }

  function expandedOverlap(a, b, amount) {
    return a.x - amount < b.x + b.w && a.x + a.w + amount > b.x && a.y - amount < b.y + b.h && a.y + a.h + amount > b.y;
  }

  function chainContains(chain, partId) {
    return Boolean(partId && chain?.chainPartIds?.includes(partId));
  }

  function byId(parts, id) {
    return parts.find((part) => part.id === id) || null;
  }

  function parentIdFor(part = {}) {
    return Animotion.rigConnection?.parentIdFor?.(part) || part.parentId || part.parentPartId || null;
  }

  function localPoint(point = null) {
    if (!point) return null;
    const x = Number(point.x ?? point[0]);
    const y = Number(point.y ?? point[1]);
    return Number.isFinite(x) && Number.isFinite(y) ? { x, y } : null;
  }

  function centerPoint(part = {}) {
    return part.rect ? { x: Number(part.rect.w || 0) * 0.5, y: Number(part.rect.h || 0) * 0.5 } : null;
  }

  function compact(values) {
    return values.filter(Boolean);
  }

  Animotion.armChainResolver = { resolve, roleFor, sameChainReference, targetDebug };
  if (typeof module !== "undefined") module.exports = Animotion.armChainResolver;
}
