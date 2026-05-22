{
  const global = typeof window !== "undefined" ? window : globalThis;
  const Animotion = global.Animotion || (global.Animotion = {});
  const MIN_LENGTH = 4;
  const MAX_AREA_RATIO = 12;
  const MAX_DIMENSION_RATIO = 4;

  function draw(ctx, part, plan, alpha = 1) {
    const validation = validate(plan);
    if (!validation.ok) return result(false, validation.reason, part, plan, null);
    const bounds = replacementBounds(plan);
    ctx.save();
    ctx.globalAlpha = Number(part?.alpha ?? 1) * alpha;
    drawProxyArm(ctx, plan);
    ctx.restore();
    return result(true, "ok", part, plan, bounds);
  }

  function validate(plan = {}) {
    if (!plan.active) return { ok: false, reason: plan.reason || "inactive" };
    if (!validRect(plan.sourceRect)) return { ok: false, reason: "invalid-source-rect" };
    if (![plan.shoulder, plan.elbow, plan.handTip, plan.target].every(finitePoint)) return { ok: false, reason: "invalid-control-point" };
    if (distance(plan.shoulder, plan.handTip) < MIN_LENGTH) return { ok: false, reason: "degenerate-shoulder-handTip" };
    if (distance(plan.shoulder, plan.target) < MIN_LENGTH) return { ok: false, reason: "degenerate-target-vector" };
    const bounds = replacementBounds(plan);
    if (!validRect(bounds)) return { ok: false, reason: "invalid-drawn-bounds" };
    if (area(bounds) > area(plan.sourceRect) * MAX_AREA_RATIO) return { ok: false, reason: "replacement-bounds-too-large" };
    if (maxDimension(bounds) > maxDimension(plan.sourceRect) * MAX_DIMENSION_RATIO) return { ok: false, reason: "replacement-dimension-too-large" };
    return { ok: true, reason: "ok" };
  }

  function drawProxyArm(ctx, plan) {
    const path = proxyPolygon(plan);
    ctx.beginPath();
    for (const [index, point] of path.entries()) index ? ctx.lineTo(point.x, point.y) : ctx.moveTo(point.x, point.y);
    ctx.closePath();
    ctx.fillStyle = "rgba(225, 72, 46, 0.86)";
    ctx.fill();
    const fist = fistPolygon(plan);
    ctx.beginPath();
    for (const [index, point] of fist.entries()) index ? ctx.lineTo(point.x, point.y) : ctx.moveTo(point.x, point.y);
    ctx.closePath();
    ctx.fillStyle = "rgba(50, 36, 36, 0.92)";
    ctx.fill();
  }

  function result(ok, reason, part, plan = {}, drawnBounds) {
    return {
      ok,
      reason,
      partId: part?.id || plan.partId || null,
      frame: plan.frame || null,
      beatLabel: plan.beatLabel || null,
      skippedNormalDraw: ok && plan.skipNormalDraw !== false,
      drawnBounds,
      sourceBounds: validRect(plan.sourceRect) ? rectBounds(plan.sourceRect) : null,
      shoulder: plan.shoulder || null,
      elbow: plan.elbow || null,
      handTip: plan.handTip || null,
      target: plan.target || null,
      fallbackUsed: !ok,
      renderMode: "motion-replacement",
    };
  }

  function replacementBounds(plan) {
    return unionBounds([polygonBounds(proxyPolygon(plan)), polygonBounds(fistPolygon(plan))]);
  }

  function proxyPolygon(plan) {
    const axis = unitVector(plan.shoulder, plan.handTip) || { x: 1, y: 0 };
    const normal = { x: -axis.y, y: axis.x };
    const width = armWidth(plan);
    const shoulder = plan.shoulder;
    const elbow = projectedElbow(plan);
    const hand = plan.handTip;
    return [
      offset(shoulder, normal, width.shoulder),
      offset(elbow, normal, width.elbow),
      offset(hand, normal, width.hand),
      offset(hand, normal, -width.hand),
      offset(elbow, normal, -width.elbow),
      offset(shoulder, normal, -width.shoulder),
    ];
  }

  function projectedElbow(plan) {
    const length = distance(plan.shoulder, plan.handTip);
    const sourceRatio = clamp(distance(plan.shoulder, plan.elbow) / Math.max(1, distance(plan.shoulder, plan.target)), 0.38, 0.72);
    return {
      x: plan.shoulder.x + (plan.handTip.x - plan.shoulder.x) * Math.min(0.72, sourceRatio),
      y: plan.shoulder.y + (plan.handTip.y - plan.shoulder.y) * Math.min(0.72, sourceRatio),
      length,
    };
  }

  function fistPolygon(plan) {
    const axis = unitVector(plan.shoulder, plan.handTip) || { x: 1, y: 0 };
    const normal = { x: -axis.y, y: axis.x };
    const center = plan.handTip;
    const radius = Math.max(6, Math.min(maxDimension(plan.sourceRect) * 0.22, distance(plan.shoulder, plan.handTip) * 0.18));
    return [
      offset(center, axis, radius * 0.9),
      offset(offset(center, axis, radius * 0.25), normal, radius),
      offset(center, axis, -radius * 0.9),
      offset(offset(center, axis, radius * 0.25), normal, -radius),
    ];
  }

  function armWidth(plan) {
    const base = Math.max(5, Math.min(maxDimension(plan.sourceRect) * 0.14, distance(plan.shoulder, plan.handTip) * 0.16));
    return { shoulder: base * 0.9, elbow: base, hand: base * 0.78 };
  }

  function unitVector(start, end) {
    const length = distance(start, end);
    return length > 0.001 ? { x: (end.x - start.x) / length, y: (end.y - start.y) / length } : null;
  }

  function offset(point, vector, amount) {
    return { x: point.x + vector.x * amount, y: point.y + vector.y * amount };
  }

  function unionBounds(boundsList = []) {
    const bounds = boundsList.filter(validRect);
    if (!bounds.length) return null;
    const minX = Math.min(...bounds.map((box) => box.x));
    const minY = Math.min(...bounds.map((box) => box.y));
    const maxX = Math.max(...bounds.map((box) => box.x + box.w));
    const maxY = Math.max(...bounds.map((box) => box.y + box.h));
    return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
  }

  function polygonBounds(points = []) {
    if (!points.length || !points.every(finitePoint)) return null;
    const xs = points.map((point) => point.x);
    const ys = points.map((point) => point.y);
    return { x: Math.min(...xs), y: Math.min(...ys), w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys) };
  }

  function rectBounds(rect = {}) { return { x: Number(rect.x), y: Number(rect.y), w: Number(rect.w), h: Number(rect.h) }; }
  function validRect(rect) { return finiteNumber(rect?.x) && finiteNumber(rect?.y) && finiteNumber(rect?.w) && finiteNumber(rect?.h) && rect.w > 0 && rect.h > 0; }
  function finitePoint(point) { return finiteNumber(point?.x) && finiteNumber(point?.y); }
  function finiteNumber(value) { return Number.isFinite(Number(value)); }
  function distance(a, b) { return Math.hypot(Number(a?.x) - Number(b?.x), Number(a?.y) - Number(b?.y)); }
  function area(bounds) { return Math.max(0, Number(bounds?.w || 0) * Number(bounds?.h || 0)); }
  function maxDimension(rect = {}) { return Math.max(Number(rect.w) || 0, Number(rect.h) || 0); }
  function clamp(value, min, max) { return Math.min(max, Math.max(min, Number(value) || 0)); }

  Animotion.motionReplacementRender = { draw, validate };
  if (typeof module !== "undefined") module.exports = Animotion.motionReplacementRender;
}
