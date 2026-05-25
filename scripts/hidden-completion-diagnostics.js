{
  const global = typeof window !== "undefined" ? window : globalThis;
  const Animotion = global.Animotion || (global.Animotion = {});

  function analyze(options = {}) {
    const sequence = Array.isArray(options.previewDrawSequence?.sequence) ? options.previewDrawSequence.sequence : [];
    const entries = sequence.filter(isHiddenCompletionDraw);
    if (!entries.length) return { status: "unknown", evidence: "no-hidden-completion-draws", items: [] };
    const context = {
      parts: options.parts || [],
      assets: options.assets || [],
      imageBounds: options.imageBounds || null,
      sourcePanel: firstSourcePanel(sequence),
      sequence,
    };
    const items = entries.map((entry) => diagnosticItem(entry, context));
    return {
      status: aggregateStatus(items),
      evidence: evidenceText(items),
      items,
    };
  }

  function diagnosticItem(entry, context) {
    const assetId = entry.hiddenCompletionPatchId || entry.assetId || null;
    const asset = findAsset(context.assets, assetId);
    const sourcePartId = asset?.sourcePartId || entry.partId || null;
    const sourcePart = findPart(context.parts, sourcePartId);
    const counterpartPartId = entry.counterpartPartId || asset?.symmetrySource?.counterpartPartId || null;
    const counterpartPart = findPart(context.parts, counterpartPartId);
    const sourceRect = rectCopy(sourcePart?.sourceRect || sourcePart?.rect);
    const assetRect = rectFromNormalized(asset?.sourceRectNormalized, context.imageBounds) || sourceRect;
    const guideBounds = localAndImageBounds(guidePoints(asset), sourceRect);
    const maskBounds = localAndImageBounds(maskPoints(asset), sourceRect);
    const drawnBounds = rectCopy(entry.bounds || entry.drawnBounds);
    const effective = effectivePixelBounds(counterpartPart || sourcePart, sourceRect);
    const drawOrder = drawOrderRelative(entry, context.sequence, sourcePartId, counterpartPartId);
    const expected = maskBounds?.image || guideBounds?.image || sourceRect;
    const overlap = overlapState(drawnBounds, expected);
    const visibleOverlap = effective ? overlapState(effective, expected) : null;
    const occlusion = postHiddenOcclusion(entry, context.sequence, expected, sourcePartId, counterpartPartId);
    const maskExceeds = Boolean(maskBounds?.image && (assetRect && !containsRect(assetRect, maskBounds.image) || sourceRect && !containsRect(sourceRect, maskBounds.image)));
    const clipped = effective ? overlapRatio(effective, expected) < 0.9 : null;
    const warnings = [];
    const failures = [];

    if (entry.hiddenCompletionRenderFailure) failures.push(entry.hiddenCompletionRenderReason || "hidden-completion-render-failed");
    if (!effective) warnings.push("effective-visible-pixels-unknown");
    if (maskExceeds) warnings.push("mask-bounds-exceed-asset-or-source-rect");
    if (clipped === true) warnings.push("asset-canvas-clipped-or-too-small");
    if (overlap === false) failures.push("drawn-bounds-miss-expected-coverage");
    if (visibleOverlap === false) failures.push("visible-pixels-miss-expected-coverage");
    if (drawOrder.hiddenBeforeSource === true) warnings.push("hidden-completion-drawn-before-source-part");
    if (drawOrder.hiddenBeforeCounterpart === true) warnings.push("hidden-completion-drawn-before-counterpart-part");
    if (occlusion.sourceOverlapRatio > 0) warnings.push("hidden-completion-coverage-may-be-occluded-by-source-part");
    if (occlusion.counterpartOverlapRatio > 0) warnings.push("hidden-completion-coverage-may-be-occluded-by-counterpart-part");
    if (!sourcePart || !asset) warnings.push("coverage-cannot-be-determined");

    return {
      assetId,
      sourcePartId,
      counterpartPartId,
      completionMethod: entry.completionMethod || asset?.completionMethod || null,
      symmetrySource: asset?.symmetrySource || null,
      sourceRect,
      assetRect,
      samplingSourceRect: sourceRect,
      guideBounds,
      maskBounds,
      drawnBounds,
      effectiveNonTransparentPixelBounds: effective,
      maskBoundsExceedAssetOrSourceRect: maskExceeds,
      assetCanvasClippedOrTooSmall: clipped,
      drawPath: entry.drawPath || null,
      drawIndex: Number.isFinite(Number(entry.index)) ? Number(entry.index) : null,
      drawOrder,
      postHiddenOcclusion: occlusion,
      transformFollow: transformFollow(entry, sourcePartId),
      sourceEraseAffectsSameRegion: sourceEraseAffects(context.sourcePanel, sourcePartId),
      overlapsExpectedCoverageRegion: overlap,
      visiblePixelsOverlapExpectedCoverageRegion: visibleOverlap,
      expectedCoverageRegion: expected,
      status: failures.length ? "fail" : warnings.length ? "warning" : "pass",
      warnings,
      failures,
    };
  }

  function isHiddenCompletionDraw(entry) {
    return entry?.kind === "part" && (String(entry.drawPath || "").startsWith("hidden-completion") || entry.hiddenCompletionPatchId || entry.hiddenCompletionRenderFailure);
  }

  function findAsset(assets, id) {
    if (!id) return null;
    return (Array.isArray(assets) ? assets : []).find((asset) => asset?.id === id && asset.type === "hiddenCompletionPatch") || null;
  }

  function findPart(parts, id) {
    if (!id) return null;
    return (Array.isArray(parts) ? parts : []).find((part) => part?.id === id) || null;
  }

  function firstSourcePanel(sequence) {
    return sequence.find((entry) => entry?.kind === "panel" && entry.pass === "source-panel") || null;
  }

  function guidePoints(asset) {
    return asset?.guide?.silhouetteVerticesNormalized || asset?.guide?.meshVerticesNormalized || [];
  }

  function maskPoints(asset) {
    return asset?.maskVerticesNormalized || guidePoints(asset);
  }

  function localAndImageBounds(points, rect) {
    if (!rect || !Array.isArray(points) || !points.length) return null;
    const normalized = points.map((point) => ({
      x: number(point.xNorm ?? point.x ?? point[0]),
      y: number(point.yNorm ?? point.y ?? point[1]),
    }));
    const minX = Math.min(...normalized.map((point) => point.x));
    const minY = Math.min(...normalized.map((point) => point.y));
    const maxX = Math.max(...normalized.map((point) => point.x));
    const maxY = Math.max(...normalized.map((point) => point.y));
    const local = { x: minX * rect.w, y: minY * rect.h, w: (maxX - minX) * rect.w, h: (maxY - minY) * rect.h };
    return { local, image: { x: rect.x + local.x, y: rect.y + local.y, w: local.w, h: local.h } };
  }

  function rectFromNormalized(rect, imageBounds) {
    const width = Number(imageBounds?.width), height = Number(imageBounds?.height);
    if (!rect || !Number.isFinite(width) || !Number.isFinite(height)) return null;
    return {
      x: number(rect.xNorm ?? rect.x) * width,
      y: number(rect.yNorm ?? rect.y) * height,
      w: number(rect.wNorm ?? rect.w ?? rect.width) * width,
      h: number(rect.hNorm ?? rect.h ?? rect.height) * height,
    };
  }

  function effectivePixelBounds(part, targetRect) {
    const bounds = part?.canvas?.__opaqueBounds;
    const width = Number(part?.canvas?.width), height = Number(part?.canvas?.height);
    if (!bounds || !targetRect || !Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return null;
    return {
      x: targetRect.x + number(bounds.x) / width * targetRect.w,
      y: targetRect.y + number(bounds.y) / height * targetRect.h,
      w: number(bounds.w) / width * targetRect.w,
      h: number(bounds.h) / height * targetRect.h,
    };
  }

  function drawOrderRelative(entry, sequence, sourcePartId, counterpartPartId) {
    const drawIndex = Number.isFinite(Number(entry.index)) ? Number(entry.index) : null;
    const sourceDrawIndex = normalPartDrawIndex(sequence, sourcePartId);
    const counterpartDrawIndex = normalPartDrawIndex(sequence, counterpartPartId);
    return {
      sourceDrawIndex,
      counterpartDrawIndex,
      hiddenBeforeSource: drawIndex !== null && sourceDrawIndex !== null ? drawIndex < sourceDrawIndex : null,
      hiddenBeforeCounterpart: drawIndex !== null && counterpartDrawIndex !== null ? drawIndex < counterpartDrawIndex : null,
    };
  }

  function normalPartDrawIndex(sequence, partId) {
    if (!partId) return null;
    const entry = sequence.find((item) => item?.kind === "part" && item.partId === partId && !isHiddenCompletionDraw(item));
    return Number.isFinite(Number(entry?.index)) ? Number(entry.index) : null;
  }

  function postHiddenOcclusion(entry, sequence, expected, sourcePartId, counterpartPartId) {
    const drawIndex = Number.isFinite(Number(entry?.index)) ? Number(entry.index) : null;
    if (drawIndex === null || !expected) return emptyOcclusion();
    const occluders = sequence
      .filter((item) => item?.kind === "part" && !isHiddenCompletionDraw(item) && Number(item.index) > drawIndex)
      .map((item) => occluderFor(item, expected, sourcePartId, counterpartPartId))
      .filter((item) => item.overlapRatio > 0);
    const source = occluders.find((item) => item.partId === sourcePartId) || null;
    const counterpart = occluders.find((item) => item.partId === counterpartPartId) || null;
    return {
      occluders,
      sourceOverlapRatio: source?.overlapRatio || 0,
      counterpartOverlapRatio: counterpart?.overlapRatio || 0,
      sourceDrawIndex: source?.index ?? null,
      counterpartDrawIndex: counterpart?.index ?? null,
      coverageAfterSourceDraw: source ? "likely-occluded-by-source-bounds" : "not-occluded-by-source-bounds",
      coverageAfterCounterpartDraw: counterpart ? "likely-occluded-by-counterpart-bounds" : "not-occluded-by-counterpart-bounds",
      evidenceQuality: "bounds-only",
    };
  }

  function occluderFor(entry, expected, sourcePartId, counterpartPartId) {
    return {
      index: Number(entry.index),
      partId: entry.partId || null,
      drawPath: entry.drawPath || null,
      pass: entry.pass || null,
      relation: entry.partId === sourcePartId ? "source" : entry.partId === counterpartPartId ? "counterpart" : "other",
      bounds: rectCopy(entry.bounds),
      overlapRatio: overlapRatio(entry.bounds, expected),
    };
  }

  function emptyOcclusion() {
    return {
      occluders: [],
      sourceOverlapRatio: 0,
      counterpartOverlapRatio: 0,
      sourceDrawIndex: null,
      counterpartDrawIndex: null,
      coverageAfterSourceDraw: "unknown",
      coverageAfterCounterpartDraw: "unknown",
      evidenceQuality: "bounds-only",
    };
  }

  function transformFollow(entry, sourcePartId) {
    if (!entry?.drawPath) return "unknown";
    if (entry.partId && sourcePartId && entry.partId === sourcePartId && String(entry.drawPath).startsWith("hidden-completion")) return "follows-source-transform";
    return "unknown";
  }

  function sourceEraseAffects(sourcePanel, sourcePartId) {
    return Boolean(sourcePartId && Array.isArray(sourcePanel?.erasedPartIds) && sourcePanel.erasedPartIds.includes(sourcePartId));
  }

  function overlapState(a, b) {
    if (!a || !b) return null;
    return rectsOverlap(a, b);
  }

  function rectsOverlap(a, b) {
    return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  }

  function overlapRatio(a, b) {
    if (!a || !b || b.w <= 0 || b.h <= 0) return 0;
    const x1 = Math.max(a.x, b.x), y1 = Math.max(a.y, b.y);
    const x2 = Math.min(a.x + a.w, b.x + b.w), y2 = Math.min(a.y + a.h, b.y + b.h);
    return Math.max(0, x2 - x1) * Math.max(0, y2 - y1) / (b.w * b.h);
  }

  function containsRect(outer, inner) {
    return inner.x >= outer.x && inner.y >= outer.y && inner.x + inner.w <= outer.x + outer.w && inner.y + inner.h <= outer.y + outer.h;
  }

  function rectCopy(rect) {
    return rect ? { x: number(rect.x), y: number(rect.y), w: number(rect.w), h: number(rect.h) } : null;
  }

  function number(value) {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : 0;
  }

  function aggregateStatus(items) {
    if (items.some((item) => item.status === "fail")) return "fail";
    if (items.some((item) => item.status === "warning")) return "warning";
    if (items.some((item) => item.status === "unknown")) return "unknown";
    return "pass";
  }

  function evidenceText(items) {
    const first = items[0];
    const issues = [...first.failures, ...first.warnings];
    return `draws=${items.length} first=${first.assetId || "n/a"} status=${first.status} ${issues[0] || "coverage-evidence-present"}`;
  }

  Animotion.hiddenCompletionDiagnostics = { analyze };
  if (typeof module !== "undefined") module.exports = Animotion.hiddenCompletionDiagnostics;
}
