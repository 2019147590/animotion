{
  const global = typeof window !== "undefined" ? window : globalThis;
  const Animotion = global.Animotion || (global.Animotion = {});
  const MIN_SEGMENT_LENGTH = 2;
  const MIN_CLIP_AREA_RATIO = 0.02;
  const MAX_LENGTH_RATIO = 3.1;
  const MAX_AREA_RATIO = 12;
  const MAX_PERPENDICULAR_RATIO = 2.25;
  const MAX_PERPENDICULAR_PIXELS = 128;
  const ACTION_PATCH_BEND_RATIO = 0.18;
  const ACTION_PATCH_EXTENSION_RATIO = 1.08;
  const ACTION_PATCH_STRAIGHT_RATIO = 0.12;

  function drawSegmentedPart(ctx, part, hint, alpha = 1) {
    const validation = validateSegmentedPart(part, hint);
    const actionPatch = actionPosePatchSpec(part, hint);
    if (actionPatch.use) return actionPatch.ok ? drawActionPosePatch(ctx, part, hint, actionPatch, alpha) : actionPatchFailure(part, hint, actionPatch);
    if (!validation.ok) return validation;
    const { base, target } = hint.controls;
    const sourceHand = visualHandAnchor(part.rect, base.elbow, base.hand);
    ctx.save();
    ctx.globalAlpha = Number(part.alpha ?? 1) * alpha;
    const proximal = drawSegment(ctx, part, validation.segments[0].clip, base.shoulder, base.elbow, target.shoulder, target.elbow);
    const distal = drawSegment(ctx, part, validation.segments[1].clip, base.elbow, sourceHand, target.elbow, target.hand);
    const glove = drawGlovePatch(ctx, part, base, target, sourceHand);
    ctx.restore();
    return { ...validation, drawnBounds: unionBounds([proximal, distal, glove.bounds]), glovePatch: glove, fallbackUsed: false };
  }

  function drawActionPosePatch(ctx, part, hint, patch, alpha = 1) {
    const { base, target } = hint.controls;
    ctx.save();
    ctx.globalAlpha = Number(part.alpha ?? 1) * alpha;
    const arm = drawStraightArmPatch(ctx, part, patch);
    const glove = drawGlovePatch(ctx, part, base, target, patch.sourceHand);
    ctx.restore();
    return { ...result(true, "ok", part, hint, [], unionBounds([arm, glove.bounds])), renderMode: "action-pose-patch", actionPatch: patchSummary(patch), glovePatch: glove, fallbackUsed: false };
  }

  function drawStraightArmPatch(ctx, part, patch) {
    const clip = straightPatchClip(patch);
    ctx.save();
    applySegmentTransform(ctx, patch.base.shoulder, patch.sourceHand, patch.target.shoulder, patch.target.hand);
    clipPath(ctx, clip);
    ctx.clip();
    ctx.drawImage(part.canvas, part.rect.x, part.rect.y, part.rect.w, part.rect.h);
    ctx.restore();
    return polygonBounds(clip.map((point) => transformSegmentPoint(point, patch.base.shoulder, patch.sourceHand, patch.target.shoulder, patch.target.hand)));
  }

  function validateSegmentedPart(part, hint) {
    const base = hint?.controls?.base, target = hint?.controls?.target;
    const points = [base?.shoulder, base?.elbow, base?.hand, target?.shoulder, target?.elbow, target?.hand];
    if (!part?.canvas) return failure("missing-canvas", part, hint);
    if (!validRect(part.rect)) return failure("invalid-source-rect", part, hint);
    if (!points.every(finitePoint)) return failure("invalid-control-point", part, hint);
    const sourceArea = Math.max(1, Number(part.rect.w) * Number(part.rect.h));
    const segments = segmentSpecs(part, base, target);
    for (const segment of segments) {
      if (segment.baseLength < MIN_SEGMENT_LENGTH || segment.targetLength < MIN_SEGMENT_LENGTH) return failure("degenerate-segment", part, hint);
      if (segment.lengthRatio > MAX_LENGTH_RATIO || segment.lengthRatio < 1 / MAX_LENGTH_RATIO) return failure("invalid-segment-scale", part, hint);
      if (segment.clipArea < sourceArea * MIN_CLIP_AREA_RATIO) return failure("clip-area-too-small", part, hint);
      if (segment.maxDistanceFromBaseLine > MAX_PERPENDICULAR_PIXELS) return failure("source-segment-too-wide", part, hint);
      if (segment.maxDistanceFromTargetLine > maxSegmentWidth(segment.targetLength)) return failure("segment-too-wide", part, hint);
    }
    const drawnBounds = unionBounds(segments.map((segment) => polygonBounds(segment.targetClip)));
    if (!validRect(drawnBounds)) return failure("invalid-drawn-bounds", part, hint);
    if (area(drawnBounds) > sourceArea * MAX_AREA_RATIO) return failure("drawn-bounds-too-large", part, hint);
    return result(true, "ok", part, hint, segments, drawnBounds);
  }

  function segmentSpecs(part, base, target) {
    const sourceHand = visualHandAnchor(part.rect, base.elbow, base.hand);
    const proximal = clippedRect(part.rect, base.shoulder, sourceHand, base.elbow, -1);
    const distal = clippedRect(part.rect, base.shoulder, sourceHand, base.elbow, 1);
    return [
      segmentSpec(proximal, base.shoulder, base.elbow, target.shoulder, target.elbow),
      segmentSpec(distal, base.elbow, sourceHand, target.elbow, target.hand),
    ];
  }

  function segmentSpec(clip, baseStart, baseEnd, targetStart, targetEnd) {
    const baseLength = Math.max(1, distance(baseStart, baseEnd)), targetLength = Math.max(1, distance(targetStart, targetEnd));
    const targetClip = clip.map((point) => transformSegmentPoint(point, baseStart, baseEnd, targetStart, targetEnd));
    return { clip, targetClip, baseLength, targetLength, lengthRatio: targetLength / baseLength, clipArea: polygonArea(clip), maxDistanceFromBaseLine: maxDistanceToLine(clip, baseStart, baseEnd), maxDistanceFromTargetLine: maxDistanceToLine(targetClip, targetStart, targetEnd) };
  }

  function drawSegment(ctx, part, clip, baseStart, baseEnd, targetStart, targetEnd) {
    ctx.save();
    applySegmentTransform(ctx, baseStart, baseEnd, targetStart, targetEnd);
    clipPath(ctx, clip);
    ctx.clip();
    ctx.drawImage(part.canvas, part.rect.x, part.rect.y, part.rect.w, part.rect.h);
    ctx.restore();
    return polygonBounds(clip.map((point) => transformSegmentPoint(point, baseStart, baseEnd, targetStart, targetEnd)));
  }

  function drawGlovePatch(ctx, part, base, target, sourceAnchor) {
    const clip = gloveClip(part.rect, sourceAnchor);
    if (!clip.length) return { sourceAnchor, bounds: null };
    ctx.save();
    applySegmentTransform(ctx, base.elbow, sourceAnchor, target.elbow, target.hand);
    clipPath(ctx, clip);
    ctx.clip();
    ctx.drawImage(part.canvas, part.rect.x, part.rect.y, part.rect.w, part.rect.h);
    ctx.restore();
    const bounds = polygonBounds(clip.map((point) => transformSegmentPoint(point, base.elbow, sourceAnchor, target.elbow, target.hand)));
    return { sourceAnchor, bounds };
  }

  function actionPosePatchSpec(part, hint) {
    const base = hint?.controls?.base, target = hint?.controls?.target;
    const points = [base?.shoulder, base?.elbow, base?.hand, target?.shoulder, target?.elbow, target?.hand];
    if (!part?.canvas || !validRect(part?.rect) || !points.every(finitePoint)) return { use: false, ok: false, reason: "invalid-action-patch-input" };
    const sourceHand = visualHandAnchor(part.rect, base.elbow, base.hand);
    const sourceLength = Math.max(1, distance(base.shoulder, sourceHand)), targetLength = Math.max(1, distance(target.shoulder, target.hand));
    const sourceBendRatio = distanceToLine(base.elbow, base.shoulder, sourceHand) / sourceLength;
    const targetStraightRatio = distanceToLine(target.elbow, target.shoulder, target.hand) / targetLength;
    const extensionRatio = targetLength / sourceLength;
    const use = sourceBendRatio >= ACTION_PATCH_BEND_RATIO && targetStraightRatio <= ACTION_PATCH_STRAIGHT_RATIO && extensionRatio >= ACTION_PATCH_EXTENSION_RATIO;
    if (!use) return { use: false, ok: false, reason: "deformation-safe", sourceBendRatio, targetStraightRatio, extensionRatio };
    if (extensionRatio > MAX_LENGTH_RATIO) return { use: true, ok: false, reason: "action-patch-scale-too-large", sourceBendRatio, targetStraightRatio, extensionRatio };
    const widths = patchWidths(part.rect, sourceLength), sourceElbow = pointOnLine(base.shoulder, sourceHand, distance(target.shoulder, target.elbow) / targetLength);
    const sourceBounds = Math.max(1, Number(part.rect.w) * Number(part.rect.h));
    const targetBounds = patchTargetBounds({ base, target, sourceHand, sourceElbow, widths });
    if (!validRect(targetBounds) || area(targetBounds) > sourceBounds * MAX_AREA_RATIO) return { use: true, ok: false, reason: "action-patch-bounds-too-large", sourceBendRatio, targetStraightRatio, extensionRatio };
    return { use: true, ok: true, reason: "bent-source-straight-impact", base, target, sourceHand, sourceElbow, widths, sourceBendRatio, targetStraightRatio, extensionRatio };
  }

  function actionPatchFailure(part, hint, patch) {
    return { ...failure(patch.reason || "action-patch-failed", part, hint), renderMode: "action-pose-patch", actionPatch: patchSummary(patch) };
  }

  function patchSummary(patch = {}) {
    return { reason: patch.reason || null, sourceBendRatio: rounded(patch.sourceBendRatio), targetStraightRatio: rounded(patch.targetStraightRatio), extensionRatio: rounded(patch.extensionRatio) };
  }

  function straightPatchClip(patch) {
    const { base, sourceHand, sourceElbow, widths } = patch;
    return limbPolygon(base.shoulder, sourceElbow, sourceHand, widths);
  }

  function patchTargetBounds(patch) {
    const { base, target, sourceHand } = patch;
    return polygonBounds(straightPatchClip(patch).map((point) => transformSegmentPoint(point, base.shoulder, sourceHand, target.shoulder, target.hand)));
  }

  function limbPolygon(shoulder, elbow, hand, widths) {
    const normal = perpendicular(unitVector(shoulder, hand) || { x: 1, y: 0 });
    const points = [[shoulder, widths.shoulder], [elbow, widths.elbow], [hand, widths.hand]];
    return [...points.map(([point, width]) => offsetPoint(point, normal, width)), ...points.reverse().map(([point, width]) => offsetPoint(point, normal, -width))];
  }

  function patchWidths(rect, length) {
    const maxDim = Math.max(Number(rect.w || 0), Number(rect.h || 0)), base = clamp(maxDim * 0.18, 7, Math.max(9, length * 0.16));
    return { shoulder: base * 0.85, elbow: base, hand: base * 1.35 };
  }

  function visualHandAnchor(rect, elbow, hand) {
    const direction = unitVector(elbow, hand);
    if (!direction) return hand;
    const bounds = rectBounds(rect);
    if (!bounds) return hand;
    const center = { x: bounds.x + bounds.w / 2, y: bounds.y + bounds.h / 2 };
    const tx = direction.x > 0 ? (bounds.x + bounds.w - center.x) / direction.x : (bounds.x - center.x) / direction.x;
    const ty = direction.y > 0 ? (bounds.y + bounds.h - center.y) / direction.y : (bounds.y - center.y) / direction.y;
    const candidates = [tx, ty].filter((value) => Number.isFinite(value) && value >= 0);
    const distanceToEdge = candidates.length ? Math.min(...candidates) : 0;
    return { x: center.x + direction.x * distanceToEdge, y: center.y + direction.y * distanceToEdge };
  }

  function gloveClip(rect, anchor) {
    const radius = Math.max(18, Math.min(Math.max(Number(rect.w || 0), Number(rect.h || 0)) * 0.42, 72));
    const x1 = Math.max(Number(rect.x || 0), anchor.x - radius), y1 = Math.max(Number(rect.y || 0), anchor.y - radius);
    const x2 = Math.min(Number(rect.x || 0) + Number(rect.w || 0), anchor.x + radius), y2 = Math.min(Number(rect.y || 0) + Number(rect.h || 0), anchor.y + radius);
    return x2 > x1 && y2 > y1 ? rectPoints({ x: x1, y: y1, w: x2 - x1, h: y2 - y1 }) : [];
  }

  function unitVector(start, end) {
    const length = distance(start, end);
    return length > 0.001 ? { x: (end.x - start.x) / length, y: (end.y - start.y) / length } : null;
  }

  function applySegmentTransform(ctx, baseStart, baseEnd, targetStart, targetEnd) {
    ctx.translate(targetStart.x, targetStart.y);
    ctx.rotate(radians(targetEnd, targetStart) - radians(baseEnd, baseStart));
    ctx.scale(Math.max(0.05, distance(targetStart, targetEnd) / Math.max(1, distance(baseStart, baseEnd))), 1);
    ctx.rotate(-radians(baseEnd, baseStart));
    ctx.translate(-baseStart.x, -baseStart.y);
  }

  function clippedRect(rect, shoulder, hand, split, side) {
    const axis = unitVector(shoulder, hand) || { x: 1, y: 0 }, limit = dot(split, axis);
    const keep = (point) => side < 0 ? dot(point, axis) <= limit : dot(point, axis) >= limit;
    return clipPolygon(rectPoints(rect), axis, limit, keep);
  }

  function clipPolygon(points, normal, limit, keep) {
    const output = [];
    for (let index = 0; index < points.length; index += 1) {
      const current = points[index], previous = points[(index + points.length - 1) % points.length];
      const currentInside = keep(current), previousInside = keep(previous);
      if (currentInside !== previousInside) output.push(intersection(previous, current, normal, limit));
      if (currentInside) output.push(current);
    }
    return output.filter(finitePoint);
  }

  function intersection(a, b, normal, limit) {
    const da = dot(a, normal) - limit, db = dot(b, normal) - limit, t = da / (da - db || 1);
    return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
  }

  function transformSegmentPoint(point, baseStart, baseEnd, targetStart, targetEnd) {
    const baseAngle = radians(baseEnd, baseStart), deltaAngle = radians(targetEnd, targetStart) - baseAngle;
    const ratio = Math.max(0.05, distance(targetStart, targetEnd) / Math.max(1, distance(baseStart, baseEnd)));
    const dx = point.x - baseStart.x, dy = point.y - baseStart.y;
    const localX = Math.cos(-baseAngle) * dx - Math.sin(-baseAngle) * dy;
    const localY = Math.sin(-baseAngle) * dx + Math.cos(-baseAngle) * dy;
    const scaledX = localX * ratio, scaledY = localY;
    return { x: targetStart.x + Math.cos(deltaAngle) * scaledX - Math.sin(deltaAngle) * scaledY, y: targetStart.y + Math.sin(deltaAngle) * scaledX + Math.cos(deltaAngle) * scaledY };
  }

  function failure(reason, part, hint) { return result(false, reason, part, hint, [], null); }

  function result(ok, reason, part, hint, segments, drawnBounds) {
    return {
      ok, reason, drawnBounds, sourceBounds: rectBounds(part?.rect), segmentCount: segments.length, fallbackUsed: !ok,
      leadingControl: Animotion.armExtensionControls?.leadingControl?.(hint?.controls?.target) || null,
      shoulder: hint?.controls?.target?.shoulder || null, elbow: hint?.controls?.target?.elbow || null, handTip: hint?.controls?.target?.hand || null,
      segments,
    };
  }

  function validRect(rect) { return finiteNumber(rect?.x) && finiteNumber(rect?.y) && finiteNumber(rect?.w) && finiteNumber(rect?.h) && rect.w > 0 && rect.h > 0; }
  function finitePoint(point) { return finiteNumber(point?.x) && finiteNumber(point?.y); }
  function finiteNumber(value) { return Number.isFinite(Number(value)); }
  function rectPoints(rect = {}) { const x = Number(rect.x || 0), y = Number(rect.y || 0), w = Number(rect.w || 0), h = Number(rect.h || 0); return [{ x, y }, { x: x + w, y }, { x: x + w, y: y + h }, { x, y: y + h }]; }
  function rectBounds(rect = {}) { return validRect(rect) ? { x: Number(rect.x), y: Number(rect.y), w: Number(rect.w), h: Number(rect.h) } : null; }
  function polygonBounds(points = []) { if (!points.length || !points.every(finitePoint)) return null; const xs = points.map((point) => point.x), ys = points.map((point) => point.y); return { x: Math.min(...xs), y: Math.min(...ys), w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys) }; }
  function unionBounds(boundsList = []) { const bounds = boundsList.filter(validRect); if (!bounds.length) return null; const minX = Math.min(...bounds.map((box) => box.x)), minY = Math.min(...bounds.map((box) => box.y)); const maxX = Math.max(...bounds.map((box) => box.x + box.w)), maxY = Math.max(...bounds.map((box) => box.y + box.h)); return { x: minX, y: minY, w: maxX - minX, h: maxY - minY }; }
  function clipPath(ctx, points) { ctx.beginPath(); for (const [index, point] of points.entries()) index ? ctx.lineTo(point.x, point.y) : ctx.moveTo(point.x, point.y); ctx.closePath(); }
  function area(bounds) { return Math.max(0, Number(bounds?.w || 0) * Number(bounds?.h || 0)); }
  function maxSegmentWidth(length) { return Math.max(24, Math.min(MAX_PERPENDICULAR_PIXELS, Number(length || 0) * MAX_PERPENDICULAR_RATIO + 24)); }
  function maxDistanceToLine(points = [], a, b) { return points.reduce((max, point) => Math.max(max, distanceToLine(point, a, b)), 0); }
  function distanceToLine(point, a, b) { const length = Math.max(1, distance(a, b)); return Math.abs((b.x - a.x) * (a.y - point.y) - (a.x - point.x) * (b.y - a.y)) / length; }
  function polygonArea(points = []) { return Math.abs(points.reduce((sum, point, index) => { const next = points[(index + 1) % points.length]; return sum + point.x * next.y - next.x * point.y; }, 0)) / 2; }
  function distance(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }
  function radians(end, start) { return Math.atan2(end.y - start.y, end.x - start.x); }
  function pointOnLine(start, end, ratio) { return { x: start.x + (end.x - start.x) * clamp(ratio, 0, 1), y: start.y + (end.y - start.y) * clamp(ratio, 0, 1) }; }
  function perpendicular(vector) { return { x: -vector.y, y: vector.x }; }
  function offsetPoint(point, normal, amount) { return { x: point.x + normal.x * amount, y: point.y + normal.y * amount }; }
  function clamp(value, min, max) { return Math.min(max, Math.max(min, Number(value) || 0)); }
  function rounded(value) { return Number.isFinite(Number(value)) ? Math.round(Number(value) * 1000) / 1000 : null; }
  function dot(point, normal) { return point.x * normal.x + point.y * normal.y; }

  Animotion.armExtensionRender = { drawSegmentedPart, validateSegmentedPart };
  if (typeof module !== "undefined") module.exports = Animotion.armExtensionRender;
}
