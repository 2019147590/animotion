{
  const global = typeof window !== "undefined" ? window : globalThis;
  const Animotion = global.Animotion || (global.Animotion = {});
  const MAX_SHOULDER_FOLLOW_RATIO = 0.18;
  const MAX_SHOULDER_FOLLOW_PIXELS = 18;
  const MIN_ELBOW_RATIO = 0.34;
  const MAX_ELBOW_RATIO = 0.68;
  const MIN_HAND_GAP_RATIO = 0.24;
  const MAX_STRAIGHT_OFFSET_RATIO = 0.045;

  function fistLedControls(base, raw) {
    if (!validControls(base) || !validControls(raw)) return raw;
    const hand = raw.hand;
    const handMove = distance(base.hand, hand);
    const shoulder = limitedShoulder(base.shoulder, raw.shoulder, handMove);
    const axis = unitVector(shoulder, hand);
    if (!axis) return raw;
    const length = Math.max(1, distance(shoulder, hand));
    const straighten = straighteningAmount(base, shoulder, hand);
    const elbow = clampedElbow(base, raw, shoulder, hand, axis, length, straighten, handMove);
    return { ...raw, shoulder, elbow, hand };
  }

  function leadingControl(controls = {}) {
    const target = controls.hand;
    const candidates = Object.entries({ shoulder: controls.shoulder, elbow: controls.elbow, handTip: controls.hand }).filter(([, point]) => finitePoint(point));
    if (!finitePoint(target) || !candidates.length) return null;
    return candidates.sort((a, b) => distance(a[1], target) - distance(b[1], target))[0][0];
  }

  function clampedElbow(base, raw, shoulder, hand, axis, length, straighten, handMove) {
    const ratio = elbowRatio(base, raw, shoulder, hand, straighten);
    const offset = elbowOffset(base, raw, shoulder, hand, length, straighten);
    const normal = { x: -axis.y, y: axis.x };
    let elbow = { x: shoulder.x + axis.x * length * ratio + normal.x * offset, y: shoulder.y + axis.y * length * ratio + normal.y * offset };
    elbow = limitElbowDisplacement(base, elbow, handMove, distance(base.shoulder, shoulder));
    return ensureBetween(shoulder, hand, elbow);
  }

  function elbowRatio(base, raw, shoulder, hand, straighten) {
    const upper = distance(base.shoulder, base.elbow);
    const fore = distance(base.elbow, base.hand);
    const baseRatio = clamp(upper / Math.max(1, upper + fore), MIN_ELBOW_RATIO, MAX_ELBOW_RATIO);
    const rawRatio = projectionRatio(raw.elbow, shoulder, hand);
    const gapLimit = 1 - MIN_HAND_GAP_RATIO;
    return clamp(lerp(rawRatio, baseRatio, straighten), MIN_ELBOW_RATIO, Math.min(MAX_ELBOW_RATIO, gapLimit));
  }

  function elbowOffset(base, raw, shoulder, hand, length, straighten) {
    const rawOffset = signedDistance(raw.elbow, shoulder, hand);
    const baseOffset = signedDistance(base.elbow, base.shoulder, base.hand);
    const maxOffset = length * lerp(0.18, MAX_STRAIGHT_OFFSET_RATIO, straighten);
    return clamp(rawOffset * (1 - straighten) + baseOffset * 0.12 * straighten, -maxOffset, maxOffset);
  }

  function limitElbowDisplacement(base, elbow, handMove, shoulderMove) {
    const move = distance(base.elbow, elbow);
    const maxMove = Math.max(shoulderMove + 1, handMove * 0.72);
    if (move <= maxMove || move <= 0.001) return elbow;
    const ratio = maxMove / move;
    return { x: base.elbow.x + (elbow.x - base.elbow.x) * ratio, y: base.elbow.y + (elbow.y - base.elbow.y) * ratio };
  }

  function ensureBetween(shoulder, hand, elbow) {
    const ratio = clamp(projectionRatio(elbow, shoulder, hand), MIN_ELBOW_RATIO, MAX_ELBOW_RATIO);
    const axis = unitVector(shoulder, hand) || { x: 1, y: 0 };
    const normal = { x: -axis.y, y: axis.x };
    const length = Math.max(1, distance(shoulder, hand));
    const offset = signedDistance(elbow, shoulder, hand);
    return { x: shoulder.x + axis.x * length * ratio + normal.x * offset, y: shoulder.y + axis.y * length * ratio + normal.y * offset };
  }

  function limitedShoulder(baseShoulder, rawShoulder, handMove) {
    const requested = { x: rawShoulder.x - baseShoulder.x, y: rawShoulder.y - baseShoulder.y };
    const length = Math.hypot(requested.x, requested.y);
    const maxMove = Math.min(MAX_SHOULDER_FOLLOW_PIXELS, Math.max(2, handMove * MAX_SHOULDER_FOLLOW_RATIO));
    if (length <= maxMove || length <= 0.001) return rawShoulder;
    return { x: baseShoulder.x + requested.x / length * maxMove, y: baseShoulder.y + requested.y / length * maxMove };
  }

  function straighteningAmount(base, shoulder, hand) {
    const baseLength = Math.max(1, distance(base.shoulder, base.hand));
    return clamp((distance(shoulder, hand) / baseLength - 0.92) / 0.28, 0, 1);
  }

  function projectionRatio(point, start, end) {
    const dx = end.x - start.x, dy = end.y - start.y;
    const lengthSq = Math.max(1, dx * dx + dy * dy);
    return ((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSq;
  }

  function signedDistance(point, start, end) {
    const dx = end.x - start.x, dy = end.y - start.y;
    const length = Math.max(1, Math.hypot(dx, dy));
    return ((point.x - start.x) * -dy + (point.y - start.y) * dx) / length;
  }

  function validControls(controls = {}) { return finitePoint(controls.shoulder) && finitePoint(controls.elbow) && finitePoint(controls.hand); }
  function finitePoint(point) { return Number.isFinite(Number(point?.x)) && Number.isFinite(Number(point?.y)); }
  function unitVector(start, end) { const length = distance(start, end); return length > 0.001 ? { x: (end.x - start.x) / length, y: (end.y - start.y) / length } : null; }
  function distance(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }
  function lerp(a, b, ratio) { return a + (b - a) * ratio; }
  function clamp(value, min, max) { return Math.min(max, Math.max(min, Number(value) || 0)); }

  Animotion.armExtensionControls = { fistLedControls, leadingControl };
  if (typeof module !== "undefined") module.exports = Animotion.armExtensionControls;
}
