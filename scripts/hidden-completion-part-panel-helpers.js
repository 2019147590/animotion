{
  const global = typeof window !== "undefined" ? window : globalThis;
  const Animotion = global.Animotion || (global.Animotion = {});

  function isTorsoPart(part = {}) {
    return Boolean(part) && (part.humanRole === "torso" || ["body", "spine"].includes(part.type));
  }

  function symmetryTargetRegion(part, value, asset = null) {
    if (!isTorsoPart(part)) return null;
    if (value === "left" || value === "right") return value;
    const source = asset?.symmetrySource?.targetRegion;
    return source === "right" ? "right" : "left";
  }

  function meshGuideForPreset(part, preset) {
    const base = Animotion.hiddenCompletionAssets.defaultGuideForPart(part);
    if (preset !== "centerFan") return base;
    return {
      ...base,
      meshVerticesNormalized: [
        point(0, 0), point(1, 0), point(1, 1), point(0, 1), point(0.5, 0.5),
      ],
      meshFaces: [[0, 1, 4], [1, 2, 4], [2, 3, 4], [3, 0, 4]],
    };
  }

  function point(xNorm, yNorm) {
    return { xNorm, yNorm, coordinateSpace: "part-local-normalized" };
  }

  Animotion.hiddenCompletionPartPanelHelpers = { isTorsoPart, symmetryTargetRegion, meshGuideForPreset };
  if (typeof module !== "undefined") module.exports = Animotion.hiddenCompletionPartPanelHelpers;
}
