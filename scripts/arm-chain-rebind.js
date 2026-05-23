{
  const global = typeof window !== "undefined" ? window : globalThis;
  const Animotion = global.Animotion || (global.Animotion = {});
  const SPLIT_KEYS = ["sourceArmOnlyPartId", "splitFromPartId", "originalSourcePartId"];

  function installControls() {
    if (typeof document === "undefined" || document.querySelector("#rebindSplitArmChain")) return;
    const anchor = document.querySelector("#generateMotionPlan") || document.querySelector("#autoAnticipation");
    if (!anchor) return;
    const button = document.createElement("button");
    button.id = "rebindSplitArmChain";
    button.type = "button";
    button.textContent = "분리된 팔 체인으로 다시 연결";
    const status = document.createElement("p");
    status.id = "rebindSplitArmChainStatus";
    status.className = "hint";
    anchor.after(status);
    anchor.after(button);
    button.addEventListener("click", applyActiveRebind);
  }

  function refreshControls() {
    if (typeof document === "undefined") return;
    installControls();
    const button = document.querySelector("#rebindSplitArmChain");
    const status = document.querySelector("#rebindSplitArmChainStatus");
    if (!button || !status) return;
    const context = contextForState(Animotion.state);
    button.disabled = !context.canRebind;
    status.textContent = statusText(context);
  }

  function contextForState(state = Animotion.state) {
    const parts = state?.parts || [];
    const bridge = Animotion.cutsceneModel?.normalizeBridge?.(state?.cutsceneBridge) || state?.cutsceneBridge || {};
    const actionStatus = Animotion.cutsceneActionSelectors?.getCutsceneActionStatus?.(bridge, { parts, selectedPartId: state?.selectedPartId }) || {};
    if (!actionStatus.isPunch) return inactive("active punch action is required");
    const stale = staleArmOnlyPart(parts, bridge, state?.selectedPartId);
    if (!stale) return inactive("no stale arm-only punch reference found");
    const replacement = replacementChainFor(stale.id, parts);
    if (!replacement) return inactive("no valid manually split replacement chain found", stale.id);
    const pairs = counterpartPairs(parts, replacement);
    return {
      canRebind: replacement.separateRigPath === true,
      stalePartId: stale.id,
      replacement,
      counterpartPairs: pairs,
      bridge,
      reason: replacement.separateRigPath ? "ready" : "replacement chain is not structurally valid",
    };
  }

  function applyActiveRebind(options = {}) {
    const state = Animotion.state;
    const context = contextForState(state);
    if (!context.canRebind) return { ok: false, reason: context.reason };
    const selectedId = context.replacement.forearmId || context.replacement.upperArmId || context.replacement.handOrGloveId;
    const primaryId = context.replacement.handOrGloveId;
    const previous = context.bridge;
    const bridge = {
      ...Animotion.cutsceneModel.createBridge(state.parts, primaryId),
      effectDirection: previous.effectDirection,
    };
    const plan = rebindPlan(options.plan || Animotion.motionCommands.currentMotionPlan(), selectedId);
    const result = Animotion.motionPlanner.createPlan(state.parts, primaryId, bridge, plan);
    Animotion.motionCommands.applyMotionPlanResult(bridge, plan, result);
    return { ok: true, context, result };
  }

  function rebindPlan(plan = {}, selectedPartId) {
    return {
      ...plan,
      template: "punch",
      selectedPartId,
      anchors: [],
      trajectoryPoints: [],
      selectedBeatId: null,
      targetDebug: null,
      motionDraft: null,
    };
  }

  function staleArmOnlyPart(parts, bridge, selectedPartId = null) {
    const ids = [
      bridge?.primaryPartId,
      bridge?.jointAction?.targetDebug?.primaryPartId,
      selectedPartId,
    ].filter(Boolean);
    return ids.map((id) => byId(parts, id)).find((part) => isArmOnlyReference(part, parts) && replacementChainFor(part.id, parts)) || null;
  }

  function replacementChainFor(sourcePartId, parts = []) {
    const candidates = parts.filter((part) => splitSourceId(part) === sourcePartId);
    const chains = candidates.map((part) => Animotion.armChainResolver?.resolve?.(parts, part.id)).filter((chain) => chain?.handOrGloveId);
    return chains
      .filter((chain, index, all) => all.findIndex((item) => item.handOrGloveId === chain.handOrGloveId) === index)
      .sort((a, b) => chainScore(b) - chainScore(a))[0] || null;
  }

  function counterpartPairs(parts = [], chain = {}) {
    return {
      upperArm: counterpartFor(parts, chain.upperArm, chain),
      forearm: counterpartFor(parts, chain.forearm, chain),
      hand: counterpartFor(parts, chain.handOrGlove, chain),
    };
  }

  function counterpartFor(parts, part, chain) {
    if (!part) return null;
    const role = Animotion.armChainResolver?.roleFor?.(part);
    const side = chainSide(chain, parts);
    const opposite = oppositeSide(side);
    return candidateChains(parts)
      .filter((candidate) => candidate.handOrGloveId !== chain.handOrGloveId)
      .map((candidate) => partForRole(candidate, role))
      .filter(Boolean)
      .filter((candidate) => !opposite || sideForPart(candidate, parts) === opposite)
      .sort((a, b) => counterpartScore(b, part, parts) - counterpartScore(a, part, parts))[0] || null;
  }

  function candidateChains(parts) {
    return parts.map((part) => Animotion.armChainResolver?.resolve?.(parts, part.id))
      .filter((chain) => chain?.separateRigPath && chain.handOrGloveId)
      .filter((chain, index, all) => all.findIndex((item) => item.handOrGloveId === chain.handOrGloveId) === index);
  }

  function partForRole(chain, role) {
    if (role === "upperArm") return chain.upperArm;
    if (role === "forearm") return chain.forearm;
    if (role === "hand") return chain.handOrGlove;
    return null;
  }

  function isArmOnlyReference(part, parts) {
    if (!part || Animotion.armChainResolver?.roleFor?.(part) === "hand") return false;
    if (!["arm", "glove"].includes(part.type) && !["upperArm", "forearm"].includes(part.humanRole)) return false;
    return !parts.some((candidate) => candidate.id !== part.id && Animotion.armChainResolver?.roleFor?.(candidate) === "hand" && isDescendantOf(candidate, part.id, parts));
  }

  function splitSourceId(part = {}) {
    for (const key of SPLIT_KEYS) if (part[key]) return String(part[key]);
    return null;
  }

  function chainScore(chain = {}) {
    return (chain.separateRigPath ? 10 : 0) + (chain.upperArmId ? 3 : 0) + (chain.forearmId ? 2 : 0) + (chain.handOrGloveId ? 1 : 0);
  }

  function counterpartScore(candidate, target, parts) {
    return (sameSideFamily(candidate, target) ? 4 : 0) + (sideForPart(candidate, parts) ? 2 : 0);
  }

  function sameSideFamily(a = {}, b = {}) {
    return Boolean(sideHint(a) && sideHint(a) === sideHint(b));
  }

  function chainSide(chain, parts) {
    return sideForPart(chain.forearm || chain.upperArm || chain.handOrGlove, parts);
  }

  function sideForPart(part, parts = []) {
    return sideHint(part) || geometrySide(part, parts);
  }

  function sideHint(part = {}) {
    const text = `${part.id || ""} ${part.name || ""}`.replace(/[_-]+/g, " ").toLowerCase();
    if (/\b(front|lead|right)\b/.test(text)) return text.includes("right") ? "right" : "front";
    if (/\b(rear|back|trailing|left)\b/.test(text)) return text.includes("left") ? "left" : "rear";
    return null;
  }

  function geometrySide(part, parts) {
    const torso = parts.find((candidate) => ["torso", "pelvis"].includes(candidate.humanRole) || ["body", "spine"].includes(candidate.type));
    if (!part?.rect || !torso?.rect) return null;
    return centerX(part) < centerX(torso) ? "rear" : "front";
  }

  function oppositeSide(side) {
    return ({ front: "rear", rear: "front", left: "right", right: "left" })[side] || null;
  }

  function isDescendantOf(part, ancestorId, parts) {
    let current = part;
    const seen = new Set();
    while (parentIdFor(current)) {
      const parentId = parentIdFor(current);
      if (parentId === ancestorId) return true;
      if (seen.has(parentId)) return false;
      seen.add(parentId);
      current = byId(parts, parentId);
      if (!current) return false;
    }
    return false;
  }

  function parentIdFor(part = {}) {
    return Animotion.rigConnection?.parentIdFor?.(part) || part.parentId || part.parentPartId || null;
  }

  function centerX(part) {
    return Number(part.rect?.x || 0) + Number(part.rect?.w || 0) / 2;
  }

  function byId(parts, id) {
    return parts.find((part) => part.id === id) || null;
  }

  function isPunchAction(action = {}) {
    return Animotion.cutsceneActionSelectors?.isPunchAction?.(action) || false;
  }

  function inactive(reason, stalePartId = null) {
    return { canRebind: false, reason, stalePartId, replacement: null, counterpartPairs: {} };
  }

  function statusText(context) {
    if (!context.canRebind) return `Rebind split arm chain: ${context.reason}`;
    return `Rebind ${context.stalePartId} -> ${context.replacement.handOrGloveId}`;
  }

  Animotion.armChainRebind = { contextForState, applyActiveRebind, replacementChainFor, counterpartPairs, refreshControls };
  installControls();
  if (typeof module !== "undefined") module.exports = Animotion.armChainRebind;
}
