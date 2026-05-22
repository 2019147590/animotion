{
  const global = typeof window !== "undefined" ? window : globalThis;
  const Animotion = global.Animotion || (global.Animotion = {});
  const COVER_RE = /\b(face|head|hair|hair_front|front_hair|eye|eyes|mouth|nose|facial)\b|얼굴|머리|헤어|앞머리|눈|입|코|표정/i;
  const COVER_TYPES = new Set(["head", "hair", "eye", "mouth", "nose"]);
  const COVER_ROLES = new Set(["head", "face", "hair", "eye", "mouth", "nose"]);

  function isLikelyCoveringPart(part = {}) {
    const text = `${part.id || ""} ${part.name || ""} ${part.type || ""} ${part.humanRole || ""}`;
    return COVER_RE.test(text) || COVER_TYPES.has(part.type) || COVER_ROLES.has(part.humanRole);
  }

  function coveringParts(parts = [], selectedId = null) {
    return (Array.isArray(parts) ? parts : []).filter((part) => part?.id !== selectedId && isLikelyCoveringPart(part));
  }

  function hasHigherCoveringOverlap(part, parts = [], padding = 24) {
    if (!part?.rect) return false;
    const bounds = expandRect(rectBounds(part.rect), padding);
    return coveringParts(parts, part.id).some((cover) => baseOrder(cover) > baseOrder(part) && boundsOverlap(bounds, rectBounds(cover.rect)));
  }

  function baseOrder(part = {}) {
    return Number(part.order) || 0;
  }

  function rectBounds(rect = {}) {
    return { x: Number(rect.x) || 0, y: Number(rect.y) || 0, w: Number(rect.w) || 0, h: Number(rect.h) || 0 };
  }

  function boundsOverlap(a, b) {
    if (!a || !b) return false;
    return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  }

  function expandRect(rect = {}, amount) {
    return { x: Number(rect.x || 0) - amount, y: Number(rect.y || 0) - amount, w: Number(rect.w || 0) + amount * 2, h: Number(rect.h || 0) + amount * 2 };
  }

  Animotion.renderLayerUtils = { isLikelyCoveringPart, coveringParts, hasHigherCoveringOverlap, baseOrder, rectBounds, boundsOverlap };
  if (typeof module !== "undefined") module.exports = Animotion.renderLayerUtils;
}
