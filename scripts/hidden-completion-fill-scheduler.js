{
  const global = typeof window !== "undefined" ? window : globalThis;
  const Animotion = global.Animotion || (global.Animotion = {});
  const LIMB_ORDER = new Map([["upperarm", 1], ["forearm", 2], ["hand", 3], ["glove", 3]]);
  const FOREGROUND_ROLES = new Set(["upperarm", "forearm", "hand", "glove", "head", "face", "hair", "eye", "mouth", "nose", "clothes", "clothing"]);
  const FOREGROUND_TYPES = new Set(["arm", "hand", "glove", "head", "hair", "eye", "mouth", "nose", "clothes"]);
  const COVER_RE = /\b(face|head|hair|front_hair|hair_front|eye|mouth|nose|cloth|clothes|shirt|jacket|sleeve|hand|forearm)\b/i;

  function schedule(request = {}, parts = []) {
    const occluders = foregroundOccluders(request, parts);
    const ids = occluders.map((part) => part.id).filter(Boolean);
    return {
      visiblePath: request.visiblePath || null,
      sourcePartId: request.sourcePartId || request.source?.id || null,
      requestId: request.requestId || request.part?.id || request.asset?.id || null,
      foregroundOccluderIds: ids,
      scheduledBeforePartIds: ids,
    };
  }

  function foregroundOccluders(request, parts) {
    const source = request.source;
    const fill = expandRect(request.bounds, 8);
    if (!source || !fill) return [];
    return (parts || []).filter((candidate) => (
      candidate &&
      candidate.id !== source.id &&
      candidate.id !== request.part?.id &&
      candidate.hidden !== true &&
      candidate.isSupplementalPart !== true &&
      isForegroundForFill(source, candidate, fill, parts)
    ));
  }

  function isForegroundForFill(source, candidate, fillBounds, parts) {
    if (sameLimbChainOccluder(source, candidate, parts, fillBounds)) return true;
    if (!boundsOverlap(fillBounds, rectBounds(candidate.rect))) return false;
    return foregroundCandidate(candidate);
  }

  function sameLimbChainOccluder(source, candidate, parts, fillBounds) {
    const sourceRank = limbRank(source);
    const candidateRank = limbRank(candidate);
    if (!sourceRank || !candidateRank || candidateRank <= sourceRank) return false;
    if (isDescendantOf(candidate, source, parts)) return true;
    return boundsOverlap(expandRect(fillBounds, 32), rectBounds(candidate.rect));
  }

  function foregroundCandidate(part = {}) {
    const role = roleKey(part);
    const type = String(part.type || "").toLowerCase();
    const text = `${part.id || ""} ${part.name || ""} ${part.humanRole || ""} ${part.type || ""}`;
    return FOREGROUND_ROLES.has(role) || FOREGROUND_TYPES.has(type) || COVER_RE.test(text);
  }

  function isDescendantOf(part, ancestor, parts = []) {
    const byId = new Map((parts || []).map((item) => [item.id, item]));
    let current = part;
    for (let guard = 0; guard < 24; guard += 1) {
      const parentId = Animotion.rigConnection?.parentIdFor?.(current) || current?.parentId || current?.parentPartId || null;
      if (!parentId) return false;
      if (parentId === ancestor.id) return true;
      current = byId.get(parentId);
      if (!current) return false;
    }
    return false;
  }

  function limbRank(part) {
    return LIMB_ORDER.get(roleKey(part)) || 0;
  }

  function roleKey(part = {}) {
    return String(part.humanRole || part.type || "").replace(/[^a-z]/gi, "").toLowerCase();
  }

  function rectBounds(rect = {}) {
    return rect ? { x: number(rect.x), y: number(rect.y), w: number(rect.w), h: number(rect.h) } : null;
  }

  function expandRect(rect, amount) {
    if (!rect) return null;
    return { x: rect.x - amount, y: rect.y - amount, w: rect.w + amount * 2, h: rect.h + amount * 2 };
  }

  function boundsOverlap(a, b) {
    return Boolean(a && b && a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y);
  }

  function number(value) {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : 0;
  }

  Animotion.hiddenCompletionFillScheduler = { schedule };
  if (typeof module !== "undefined") module.exports = Animotion.hiddenCompletionFillScheduler;
}
