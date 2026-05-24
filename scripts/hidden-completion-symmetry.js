{
  const global = typeof window !== "undefined" ? window : globalThis;
  const Animotion = global.Animotion || (global.Animotion = {});
  const ARM_ROLES = new Set(["upperArm", "forearm", "hand"]);
  const LOW_CONFIDENCE = 0.7;

  function createPatchAsset(targetPart, parts = [], options = {}) {
    const candidate = resolveCounterpart(targetPart, parts, options);
    if (!candidate.ok) return candidate;
    if (candidate.confidence < LOW_CONFIDENCE) return warning("symmetry counterpart confidence is too low");
    const guide = guideForTarget(targetPart, candidate, options);
    if (!guide) return warning("symmetry target region is required for torso");
    const asset = Animotion.hiddenCompletionAssets?.createForPart?.(targetPart, {
      id: options.id || `hidden-${targetPart.id}-symmetry`,
      name: options.name || `${targetPart.name || targetPart.id} symmetry hidden completion`,
      guide,
      maskVerticesNormalized: guide.silhouetteVerticesNormalized,
      patchStatus: "draft",
      renderMode: "manualOverride",
      completionMethod: "symmetry",
      symmetrySource: {
        method: "symmetry",
        counterpartPartId: candidate.counterpart.id,
        targetPartId: targetPart.id,
        targetRegion: candidate.targetRegion,
        sourceRegion: candidate.sourceRegion,
        confidence: candidate.confidence,
        warnings: [],
      },
      preview: { label: "symmetry draft", color: "#f1b83b", visible: true },
    });
    return asset ? { ok: true, asset, counterpart: candidate.counterpart } : warning("failed to create symmetry patch asset");
  }

  function resolveCounterpart(part, parts = [], options = {}) {
    if (!part?.id) return warning("select a hidden surface candidate first");
    const role = partRole(part);
    if (role === "torso") return torsoCounterpart(part, options);
    if (!ARM_ROLES.has(role)) return warning("symmetry draft supports torso, upperArm, forearm, and hand/glove parts");
    const side = sideFor(part, parts);
    if (!side) return warning("selected part needs front/rear or left/right side metadata, or a torso/body part for geometry matching");
    const counterpartSide = oppositeSide(side);
    const counterpart = parts
      .filter((candidate) => candidate.id !== part.id && partRole(candidate) === role && sideFor(candidate, parts) === counterpartSide)
      .sort((a, b) => counterpartScore(b, part, parts) - counterpartScore(a, part, parts))[0];
    if (!counterpart) return warning(`missing ${counterpartSide} ${role} counterpart`);
    return { ok: true, counterpart, targetRegion: side, sourceRegion: counterpartSide, confidence: 0.9 };
  }

  function torsoCounterpart(part, options) {
    const region = options.targetRegion || regionFromGuide(options.activeAsset?.guide);
    if (!["left", "right"].includes(region)) return warning("torso symmetry needs a left/right guide region");
    return { ok: true, counterpart: part, targetRegion: region, sourceRegion: oppositeSide(region), confidence: 0.82 };
  }

  function guideForTarget(part, candidate, options) {
    if (options.activeAsset?.guide) return clone(options.activeAsset.guide);
    if (partRole(part) !== "torso") return Animotion.hiddenCompletionAssets?.defaultGuideForPart?.(part);
    return halfGuide(candidate.targetRegion);
  }

  function halfGuide(region) {
    if (!["left", "right"].includes(region)) return null;
    const a = region === "left" ? 0 : 0.5, b = region === "left" ? 0.5 : 1;
    return {
      kind: "meshGuide",
      meshVerticesNormalized: [point(a, 0), point(b, 0), point(b, 1), point(a, 1)],
      meshFaces: [[0, 1, 2], [0, 2, 3]],
      silhouetteVerticesNormalized: [point(a, 0), point(b, 0), point(b, 1), point(a, 1)],
      guideStrength: 1,
      coordinateSpace: "part-local-normalized",
    };
  }

  function regionFromGuide(guide) {
    const points = guide?.silhouetteVerticesNormalized || guide?.meshVerticesNormalized || [];
    if (!points.length) return null;
    const center = points.reduce((sum, point) => sum + Number(point.xNorm ?? point.x ?? 0), 0) / points.length;
    return center < 0.5 ? "left" : "right";
  }

  function partRole(part = {}) {
    const textRole = String(part.humanRole || "").replace(/[_-]+/g, "").toLowerCase();
    if (textRole === "upperarm") return "upperArm";
    if (textRole === "forearm") return "forearm";
    if (textRole === "hand" || String(part.type || "").toLowerCase() === "glove") return "hand";
    if (textRole === "torso" || ["body", "spine"].includes(part.type)) return "torso";
    return Animotion.armChainResolver?.roleFor?.(part) || null;
  }

  function sideFor(part = {}, parts = []) {
    return sideHint(part) || geometrySide(part, parts);
  }

  function sideHint(part = {}) {
    const text = `${part.id || ""} ${part.name || ""}`.replace(/[_-]+/g, " ").toLowerCase();
    if (/\b(front|lead)\b/.test(text)) return "front";
    if (/\b(rear|back|trailing)\b/.test(text)) return "rear";
    if (/\bleft\b/.test(text)) return "left";
    if (/\bright\b/.test(text)) return "right";
    return null;
  }

  function geometrySide(part, parts = []) {
    const torso = parts.find((candidate) => partRole(candidate) === "torso");
    if (!part?.rect || !torso?.rect) return null;
    return centerX(part) < centerX(torso) ? "rear" : "front";
  }

  function oppositeSide(side) {
    return ({ front: "rear", rear: "front", left: "right", right: "left" })[side] || null;
  }

  function counterpartScore(part, target, parts) {
    const chain = Animotion.armChainResolver?.resolve?.(parts, part.id);
    return (chain?.separateRigPath ? 10 : 0)
      + (splitSourceId(part) ? 3 : 0)
      + geometryPairScore(part, target);
  }

  function geometryPairScore(part = {}, target = {}) {
    if (!part.rect || !target.rect) return 0;
    const yDelta = Math.abs(centerY(part) - centerY(target));
    const sizeDelta = Math.abs(Number(part.rect.h || 0) - Number(target.rect?.h || 0));
    return Math.max(0, 3 - yDelta / 40) + Math.max(0, 2 - sizeDelta / 30);
  }

  function splitSourceId(part = {}) {
    return part.sourceArmOnlyPartId || part.splitFromPartId || part.originalSourcePartId || null;
  }

  function warning(message) {
    return { ok: false, warning: message, confidence: 0 };
  }

  function point(xNorm, yNorm) {
    return { xNorm, yNorm, coordinateSpace: "part-local-normalized" };
  }

  function centerX(part = {}) {
    return Number(part.rect?.x || 0) + Number(part.rect?.w || 0) / 2;
  }

  function centerY(part = {}) {
    return Number(part.rect?.y || 0) + Number(part.rect?.h || 0) / 2;
  }

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  Animotion.hiddenCompletionSymmetry = { LOW_CONFIDENCE, createPatchAsset, resolveCounterpart };
  if (typeof module !== "undefined") module.exports = Animotion.hiddenCompletionSymmetry;
}
