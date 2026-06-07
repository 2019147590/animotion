{
  const global = typeof window !== "undefined" ? window : globalThis;
  const Animotion = global.Animotion || (global.Animotion = {});
  const MatrixCtor = global.DOMMatrix || globalThis.DOMMatrix;
  const DEFAULT_PADDING = 8;

  function resolveSupplementalFollow(part, context = {}) {
    const follow = normalizeFollow(part?.supplementalFollow);
    if (!follow) return null;
    if (follow.kind === "shoulderFill") return computeStaticAttachTransform(part, follow, context);
    if (follow.kind === "elbowJointFill") return computeJointBridgeTransform(part, follow, context);
    return null;
  }

  function computeStaticAttachTransform(part, follow, context = {}) {
    const driver = partById(follow.driverPartId, context);
    const driverMatrix = driver && matrixForPart(driver, context);
    if (!driverMatrix) return null;
    const bind = matrixFromBind(follow.bind?.matrix) || identityMatrix();
    return { active: true, kind: follow.kind, matrix: multiplyMatrices(driverMatrix, bind), driverPartId: driver.id };
  }

  function computeJointBridgeTransform(part, follow, context = {}) {
    const driverA = partById(follow.driverAId, context);
    const driverB = partById(follow.driverBId, context);
    const anchorA = driverA && worldPointForRigAnchor(driverA, follow.anchorA || "joint", context);
    const anchorB = driverB && worldPointForRigAnchor(driverB, follow.anchorB || "pivot", context);
    if (!anchorA || !anchorB) return null;
    const bind = normalizeJointBridgeBind(follow.bind, part, anchorA, anchorB);
    const distance = Math.hypot(anchorB.x - anchorA.x, anchorB.y - anchorA.y);
    const angle = Math.atan2(anchorB.y - anchorA.y, anchorB.x - anchorA.x) * 180 / Math.PI;
    const midpoint = { x: (anchorA.x + anchorB.x) / 2, y: (anchorA.y + anchorB.y) / 2 };
    const stretch = stretchForDistance(distance, bind.baseDistance, follow.paddingPx);
    const offset = rotatePoint(bind.offset, angle);
    const target = { x: midpoint.x + offset.x, y: midpoint.y + offset.y };
    const matrix = matrixAroundPartPivot(part, target, angle + bind.rotationOffset, bind.scaleX * stretch, bind.scaleY);
    return { active: true, kind: follow.kind, matrix, anchorA, anchorB, midpoint, distance, rotation: angle, scaleX: bind.scaleX * stretch, scaleY: bind.scaleY };
  }

  function shoulderFillMetadata(part, driver, context = {}) {
    const driverMatrix = matrixForPart(driver, context);
    const partMatrix = matrixForPart(part, context);
    return {
      kind: "shoulderFill",
      mode: "staticAttach",
      driverPartId: driver?.id || null,
      bind: { matrix: matrixToBind(multiplyMatrices(inverseMatrix(driverMatrix), partMatrix)) },
      paddingPx: DEFAULT_PADDING,
      rotationMode: "bisector",
    };
  }

  function elbowJointFillMetadata(part, driverA, driverB, context = {}) {
    const anchorA = worldPointForRigAnchor(driverA, "joint", context);
    const anchorB = worldPointForRigAnchor(driverB, "pivot", context);
    const partPivot = transformPoint(matrixForPart(part, context), absoluteLocalPoint(part, "pivot"));
    const distance = anchorA && anchorB ? Math.hypot(anchorB.x - anchorA.x, anchorB.y - anchorA.y) : 1;
    const angle = anchorA && anchorB ? Math.atan2(anchorB.y - anchorA.y, anchorB.x - anchorA.x) * 180 / Math.PI : 0;
    const midpoint = anchorA && anchorB ? { x: (anchorA.x + anchorB.x) / 2, y: (anchorA.y + anchorB.y) / 2 } : partPivot;
    return {
      kind: "elbowJointFill",
      mode: "jointBridge",
      driverAId: driverA?.id || null,
      driverBId: driverB?.id || null,
      anchorA: "joint",
      anchorB: "pivot",
      bind: {
        offset: { x: 0, y: 0 },
        rotationOffset: rotationFromMatrix(matrixForPart(part, context)) - angle,
        baseDistance: Math.max(1, distance),
        scaleX: 1,
        scaleY: 1,
      },
      paddingPx: DEFAULT_PADDING,
      rotationMode: "bisector",
    };
  }

  function worldPointForRigAnchor(part, anchor, context = {}) {
    if (!part) return null;
    return transformPoint(matrixForPart(part, context), absoluteLocalPoint(part, anchor));
  }

  function matrixForPart(part, context = {}) {
    if (!part) return identityMatrix();
    if (typeof context.worldMatrix === "function") return context.worldMatrix(part);
    if (typeof Animotion.preview?.worldMatrix === "function") {
      const cache = context.matrixCache || new Map();
      return Animotion.preview.worldMatrix(part, context.t || 0, cache);
    }
    return matrixAroundPartPivot(part, transformPoint(identityMatrix(), absoluteLocalPoint(part, "pivot")), 0, 1, 1);
  }

  function normalizeFollow(value) {
    if (!value || typeof value !== "object") return null;
    if (value.kind === "shoulderFill" && value.mode === "staticAttach") {
      return { ...value, driverPartId: stringOrNull(value.driverPartId), paddingPx: numberOrDefault(value.paddingPx, DEFAULT_PADDING) };
    }
    if (value.kind === "elbowJointFill" && value.mode === "jointBridge") {
      return {
        ...value,
        driverAId: stringOrNull(value.driverAId),
        driverBId: stringOrNull(value.driverBId),
        anchorA: anchorOrDefault(value.anchorA, "joint"),
        anchorB: anchorOrDefault(value.anchorB, "pivot"),
        paddingPx: numberOrDefault(value.paddingPx, DEFAULT_PADDING),
        rotationMode: value.rotationMode || "bisector",
      };
    }
    return null;
  }

  function normalizeJointBridgeBind(bind = {}, part, anchorA, anchorB) {
    const distance = Math.max(1, Math.hypot(anchorB.x - anchorA.x, anchorB.y - anchorA.y));
    return {
      offset: { x: numberOrDefault(bind.offset?.x, 0), y: numberOrDefault(bind.offset?.y, 0) },
      rotationOffset: numberOrDefault(bind.rotationOffset, 0),
      baseDistance: Math.max(1, numberOrDefault(bind.baseDistance, distance || part?.rect?.w || 1)),
      scaleX: numberOrDefault(bind.scaleX, 1),
      scaleY: numberOrDefault(bind.scaleY, 1),
    };
  }

  function stretchForDistance(distance, baseDistance, paddingPx) {
    const padded = Math.max(0, distance - baseDistance + numberOrDefault(paddingPx, DEFAULT_PADDING));
    return 1 + padded / Math.max(1, baseDistance) * 0.35;
  }

  function matrixAroundPartPivot(part, target, rotation, scaleX, scaleY) {
    const pivot = absoluteLocalPoint(part, "pivot");
    return identityMatrix()
      .translate(target.x, target.y)
      .rotate(rotation)
      .scale(scaleX, scaleY)
      .translate(-pivot.x, -pivot.y);
  }

  function absoluteLocalPoint(part = {}, anchor = "pivot") {
    const rect = part.rect || {};
    const local = localPoint(part, anchor);
    return { x: numberOrDefault(rect.x, 0) + local.x, y: numberOrDefault(rect.y, 0) + local.y };
  }

  function localPoint(part = {}, anchor = "pivot") {
    const rect = part.rect || {};
    const fallback = { x: numberOrDefault(rect.w, 1) / 2, y: numberOrDefault(rect.h, 1) / 2 };
    const point = anchor === "handTip" ? part.handTip : anchor === "joint" ? part.joint : part.pivot;
    return { x: numberOrDefault(point?.x, fallback.x), y: numberOrDefault(point?.y, fallback.y) };
  }

  function partById(id, context = {}) {
    const parts = context.parts || context.state?.parts || Animotion.state?.parts || [];
    return parts.find((part) => part.id === id) || null;
  }

  function transformPoint(matrix, point) {
    return { x: matrix.a * point.x + matrix.c * point.y + matrix.e, y: matrix.b * point.x + matrix.d * point.y + matrix.f };
  }

  function rotatePoint(point, degrees) {
    const radians = degrees * Math.PI / 180;
    const cos = Math.cos(radians), sin = Math.sin(radians);
    return { x: point.x * cos - point.y * sin, y: point.x * sin + point.y * cos };
  }

  function rotationFromMatrix(matrix) {
    return Math.atan2(matrix.b || 0, matrix.a || 1) * 180 / Math.PI;
  }

  function identityMatrix() {
    return new MatrixCtor();
  }

  function matrixFromBind(value) {
    if (!value) return null;
    return makeMatrix(value);
  }

  function matrixToBind(matrix) {
    return { a: matrix.a, b: matrix.b, c: matrix.c, d: matrix.d, e: matrix.e, f: matrix.f };
  }

  function makeMatrix(value = {}) {
    const matrix = identityMatrix();
    matrix.a = numberOrDefault(value.a, 1);
    matrix.b = numberOrDefault(value.b, 0);
    matrix.c = numberOrDefault(value.c, 0);
    matrix.d = numberOrDefault(value.d, 1);
    matrix.e = numberOrDefault(value.e, 0);
    matrix.f = numberOrDefault(value.f, 0);
    return matrix;
  }

  function multiplyMatrices(left, right) {
    if (typeof left?.multiply === "function") return left.multiply(right);
    return makeMatrix({
      a: left.a * right.a + left.c * right.b,
      b: left.b * right.a + left.d * right.b,
      c: left.a * right.c + left.c * right.d,
      d: left.b * right.c + left.d * right.d,
      e: left.a * right.e + left.c * right.f + left.e,
      f: left.b * right.e + left.d * right.f + left.f,
    });
  }

  function inverseMatrix(matrix) {
    if (typeof matrix?.inverse === "function") return matrix.inverse();
    const det = matrix.a * matrix.d - matrix.b * matrix.c;
    if (Math.abs(det) < 0.000001) return identityMatrix();
    return makeMatrix({
      a: matrix.d / det,
      b: -matrix.b / det,
      c: -matrix.c / det,
      d: matrix.a / det,
      e: (matrix.c * matrix.f - matrix.d * matrix.e) / det,
      f: (matrix.b * matrix.e - matrix.a * matrix.f) / det,
    });
  }

  function anchorOrDefault(value, fallback) {
    return value === "pivot" || value === "joint" || value === "handTip" ? value : fallback;
  }

  function stringOrNull(value) {
    return value === undefined || value === null || value === "" ? null : String(value);
  }

  function numberOrDefault(value, fallback) {
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
  }

  Animotion.supplementalFollow = {
    resolveSupplementalFollow,
    computeStaticAttachTransform,
    computeJointBridgeTransform,
    worldPointForRigAnchor,
    shoulderFillMetadata,
    elbowJointFillMetadata,
    normalizeFollow,
    inverseMatrix,
  };
  if (typeof module !== "undefined") module.exports = Animotion.supplementalFollow;
}
