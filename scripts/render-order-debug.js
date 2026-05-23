{
  const global = typeof window !== "undefined" ? window : globalThis;
  const Animotion = global.Animotion || (global.Animotion = {});

  function begin(state, frame) {
    if (!state) return null;
    state.previewDrawSequenceDebug = { frame, sequence: [] };
    return state.previewDrawSequenceDebug;
  }

  function record(state, entry = {}) {
    const debug = state?.previewDrawSequenceDebug;
    if (!debug) return null;
    const normalized = { index: debug.sequence.length, ...entry };
    debug.sequence.push(normalized);
    return normalized;
  }

  function partEntry(part, drawPath, pass, bounds = null, extra = {}) {
    const base = baseOrder(part);
    const bias = Number(extra.evaluatedDepthBias || 0);
    return {
      kind: "part",
      pass,
      drawPath,
      partId: part?.id || null,
      name: part?.name || "",
      type: part?.type || "",
      humanRole: part?.humanRole || "",
      order: base,
      baseOrder: base,
      evaluatedDepthBias: bias,
      finalSortKey: Number(extra.finalSortKey ?? base + bias),
      likelyCoveringLayer: isLikelyCoveringPart(part),
      bounds: bounds || rectBounds(part?.rect),
      ...extra,
    };
  }

  function analyze(debug = {}, options = {}) {
    const sequence = Array.isArray(debug?.sequence) ? debug.sequence : [];
    const selectedId = options.selectedPartId || options.bridge?.primaryPartId || options.bridge?.jointAction?.targetDebug?.primaryPartId || null;
    const selectedDraws = sequence.filter((entry) => entry.kind === "part" && entry.partId === selectedId);
    const segmentedDraws = selectedDraws.filter((entry) => entry.drawPath === "segmented-arm" || entry.drawPath === "action-pose-patch");
    const segmentedFailures = selectedDraws.filter((entry) => entry.segmentedRenderFailure || entry.drawPath === "segmented-arm-failed");
    const motionReplacementDraws = selectedDraws.filter((entry) => entry.drawPath === "motion-replacement");
    const motionReplacementFailures = selectedDraws.filter((entry) => entry.replacementRenderFailure || entry.drawPath === "motion-replacement-failed");
    const visualDraws = selectedDraws.filter((entry) => entry.drawPath === "segmented-arm" || entry.drawPath === "action-pose-patch" || entry.drawPath === "motion-replacement" || entry.drawPath === "normal-part" || entry.drawPath === "hidden-completion-symmetry");
    const selectedDraw = motionReplacementDraws[motionReplacementDraws.length - 1] || segmentedDraws[segmentedDraws.length - 1] || selectedDraws[selectedDraws.length - 1] || null;
    const selectedBounds = selectedDraw?.bounds || rectBounds((options.parts || []).find((part) => part.id === selectedId)?.rect);
    const coverDraws = sequence.filter((entry) => entry.kind === "part" && entry.partId !== selectedId && (entry.likelyCoveringLayer || boundsOverlap(entry.bounds, selectedBounds)));
    const comparisons = coverDraws.map((entry) => ({ partId: entry.partId, name: entry.name, type: entry.type, humanRole: entry.humanRole, drawPath: entry.drawPath, index: entry.index, selectedAfter: selectedDraw ? selectedDraw.index > entry.index : false }));
    const sourcePanel = [...sequence].reverse().find((entry) => entry.kind === "panel" && entry.pass === "source-panel") || null;
    const sourceErased = new Set(sourcePanel?.erasedPartIds || []);
    const sourcePanelConflictRisk = sourcePanel ? !sourceErased.has(selectedId) && sourcePanel.sourcePanelMode === "source-original" : null;
    const sourceEraseWithoutReplacement = Boolean(sourcePanel && sourceErased.has(selectedId) && !visualDraws.length);
    return {
      finalDrawSequence: sequence,
      selectedDrawIndex: selectedDraw?.index ?? null,
      selectedDrawPath: selectedDraw?.drawPath || null,
      coveringComparisons: comparisons,
      selectedAfterCoveringParts: comparisons.length ? comparisons.every((entry) => entry.selectedAfter) : null,
      segmentedReplacesNormal: Boolean(selectedDraw && (selectedDraw.drawPath === "segmented-arm" || selectedDraw.drawPath === "action-pose-patch" || selectedDraw.drawPath === "motion-replacement") && !selectedDraws.some((entry) => entry.drawPath === "normal-part")),
      segmentedRenderFailure: segmentedFailures.length > 0,
      segmentedRenderReason: segmentedFailures[segmentedFailures.length - 1]?.segmentedRenderReason || null,
      replacementRenderOk: motionReplacementDraws.length > 0,
      replacementRenderFailure: motionReplacementFailures.length > 0,
      replacementRenderReason: motionReplacementFailures[motionReplacementFailures.length - 1]?.replacementRenderReason || null,
      skippedNormalArmDraw: Boolean(selectedDraw?.skippedNormalArmDraw && !selectedDraws.some((entry) => entry.drawPath === "normal-part")),
      fallbackToNormalArm: selectedDraws.some((entry) => entry.fallbackToNormalArm === true),
      sourceEraseWithoutReplacement,
      postPassesAfterSelected: selectedDraw ? sequence.filter((entry) => entry.index > selectedDraw.index && entry.kind !== "part") : [],
      punchStyleSource: selectedDraw?.punchStyleSource || null,
      legacyDepthCompat: Boolean(selectedDraw?.legacyDepthCompat),
      sourcePanelMode: sourcePanel?.sourcePanelMode || null,
      sourcePanelErasedPartIds: sourcePanel?.erasedPartIds || [],
      sourcePanelConflictRisk,
    };
  }

  function boundsFromMatrix(part, matrix) {
    const rect = part?.rect;
    if (!rect || !matrix) return rectBounds(rect);
    const points = [
      transform(matrix, rect.x, rect.y),
      transform(matrix, rect.x + rect.w, rect.y),
      transform(matrix, rect.x + rect.w, rect.y + rect.h),
      transform(matrix, rect.x, rect.y + rect.h),
    ];
    return pointsBounds(points);
  }

  function boundsFromControls(controls) {
    const points = Object.values(controls?.target || {}).filter(Boolean);
    return points.length ? expandBounds(pointsBounds(points), 18) : null;
  }

  function isLikelyCoveringPart(part = {}) {
    return Animotion.renderLayerUtils?.isLikelyCoveringPart?.(part) || fallbackCoveringPart(part);
  }

  function rectBounds(rect = {}) {
    return { x: Number(rect.x) || 0, y: Number(rect.y) || 0, w: Number(rect.w) || 0, h: Number(rect.h) || 0 };
  }

  function baseOrder(part = {}) {
    return Animotion.renderLayerUtils?.baseOrder?.(part) ?? (Number(part?.order) || 0);
  }

  function boundsOverlap(a, b) {
    return Animotion.renderLayerUtils?.boundsOverlap?.(a, b) ?? fallbackBoundsOverlap(a, b);
  }

  function transform(matrix, x, y) {
    return { x: matrix.a * x + matrix.c * y + matrix.e, y: matrix.b * x + matrix.d * y + matrix.f };
  }

  function pointsBounds(points) {
    const xs = points.map((point) => point.x), ys = points.map((point) => point.y);
    const minX = Math.min(...xs), minY = Math.min(...ys);
    return { x: minX, y: minY, w: Math.max(...xs) - minX, h: Math.max(...ys) - minY };
  }

  function expandBounds(bounds, amount) {
    return { x: bounds.x - amount, y: bounds.y - amount, w: bounds.w + amount * 2, h: bounds.h + amount * 2 };
  }
  function fallbackCoveringPart(part = {}) { return ["head", "hair", "eye", "mouth", "nose"].includes(part.type) || ["head", "face", "hair", "eye", "mouth", "nose"].includes(part.humanRole); }
  function fallbackBoundsOverlap(a, b) { return Boolean(a && b && a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y); }

  Animotion.renderOrderDebug = { begin, record, partEntry, analyze, boundsFromMatrix, boundsFromControls, isLikelyCoveringPart, boundsOverlap };
  if (typeof module !== "undefined") module.exports = Animotion.renderOrderDebug;
}
