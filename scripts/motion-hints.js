{
  const global = typeof window !== "undefined" ? window : globalThis;
  const Animotion = global.Animotion || (global.Animotion = {});
  const OCCLUSION = new Set(["visible", "partial", "hidden", "unknown"]);
  const DEPTH = new Set(["front", "behind", "intersect", "unknown"]);
  const COMPLETION = new Set(["none", "candidate", "required"]);

  function normalize(hints = {}) {
    hints = hints && typeof hints === "object" ? hints : {};
    const occlusion = typeof hints.occlusion === "string" ? { status: hints.occlusion } : hints.occlusion || {};
    return {
      source: hints.source ? String(hints.source) : "manual",
      occlusion: valueFrom(OCCLUSION, hints.occlusionStatus || occlusion.status, "unknown"),
      depthOrder: valueFrom(DEPTH, hints.depthOrder || occlusion.depthOrder, "unknown"),
      hiddenCompletion: valueFrom(COMPLETION, hints.hiddenCompletion || occlusion.hiddenCompletion, "none"),
      warnings: normalizeWarnings(hints.warnings),
    };
  }

  function fromCorrespondence(correspondence) {
    const hints = normalize({
      source: "correspondence",
      occlusion: correspondence?.occlusion,
    });
    return {
      ...hints,
      warnings: hiddenWarnings(hints),
    };
  }

  function statusText(hints) {
    const normalized = normalize(hints);
    const labels = [];
    if (normalized.occlusion === "partial") labels.push("일부 가림");
    if (normalized.occlusion === "hidden") labels.push("숨김");
    if (normalized.depthOrder !== "unknown") labels.push(`depth ${normalized.depthOrder}`);
    if (normalized.hiddenCompletion !== "none") labels.push("보완 필요");
    return labels.join(" · ");
  }

  function hiddenWarnings(hints) {
    if (hints.hiddenCompletion === "required") return ["hidden-completion-required"];
    if (hints.hiddenCompletion === "candidate") return ["hidden-completion-candidate"];
    return [];
  }

  function normalizeWarnings(warnings) {
    return Array.isArray(warnings) ? warnings.map((item) => String(item)).filter(Boolean) : [];
  }

  function valueFrom(set, value, fallback) {
    const normalized = value === undefined || value === null ? fallback : String(value);
    return set.has(normalized) ? normalized : fallback;
  }

  Animotion.motionHints = { normalize, fromCorrespondence, statusText };
  if (typeof module !== "undefined") module.exports = Animotion.motionHints;
}
