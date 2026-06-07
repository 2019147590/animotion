{
  const global = typeof window !== "undefined" ? window : globalThis;
  const Animotion = global.Animotion || (global.Animotion = {});

  function installProjectModelPatch() {
    const model = Animotion.projectModel;
    if (!model || model.supplementalFollowWrapped) return;
    const originalPart = model.normalizeProjectPart;
    const originalProject = model.normalizeProject;
    model.normalizeProjectPart = function normalizeFollowProjectPart(part, index, options) {
      return preserveFollow(originalPart.call(this, part, index, options), part);
    };
    model.normalizeProject = function normalizeFollowProject(payload, options) {
      const project = originalProject.call(this, payload, options);
      project.parts = (project.parts || []).map((part) => preserveFollow(part, sourcePartPayload(payload, part.id)));
      return project;
    };
    model.supplementalFollowWrapped = true;
  }

  function sourcePartPayload(payload, partId) {
    return (payload?.parts || []).find((part) => part.id === partId) || {};
  }

  function preserveFollow(normalized, source = {}) {
    const follow = normalizeSupplementalFollow(source.supplementalFollow);
    if (!normalized || !follow) return normalized;
    return { ...normalized, supplementalFollow: follow };
  }

  function normalizeSupplementalFollow(value) {
    if (!value || typeof value !== "object") return null;
    if (value.kind === "shoulderFill" && value.mode === "staticAttach") {
      const driverPartId = stringOrNull(value.driverPartId);
      if (!driverPartId) return null;
      return clean({
        kind: "shoulderFill",
        mode: "staticAttach",
        driverPartId,
        bind: normalizeStaticBind(value.bind),
        paddingPx: numberOrDefault(value.paddingPx, 8),
        rotationMode: stringOrDefault(value.rotationMode, "bisector"),
      });
    }
    if (value.kind === "elbowJointFill" && value.mode === "jointBridge") {
      const driverAId = stringOrNull(value.driverAId), driverBId = stringOrNull(value.driverBId);
      if (!driverAId || !driverBId) return null;
      return clean({
        kind: "elbowJointFill",
        mode: "jointBridge",
        driverAId,
        driverBId,
        anchorA: anchorOrDefault(value.anchorA, "joint"),
        anchorB: anchorOrDefault(value.anchorB, "pivot"),
        bind: normalizeJointBind(value.bind),
        paddingPx: numberOrDefault(value.paddingPx, 8),
        rotationMode: stringOrDefault(value.rotationMode, "bisector"),
      });
    }
    return null;
  }

  function normalizeStaticBind(bind = {}) {
    const matrix = bind.matrix;
    if (!matrix || typeof matrix !== "object") return {};
    return { matrix: normalizeMatrix(matrix) };
  }

  function normalizeJointBind(bind = {}) {
    return clean({
      offset: { x: numberOrDefault(bind.offset?.x, 0), y: numberOrDefault(bind.offset?.y, 0) },
      rotationOffset: numberOrDefault(bind.rotationOffset, 0),
      baseDistance: Math.max(1, numberOrDefault(bind.baseDistance, 1)),
      scaleX: numberOrDefault(bind.scaleX, 1),
      scaleY: numberOrDefault(bind.scaleY, 1),
    });
  }

  function normalizeMatrix(matrix) {
    return {
      a: numberOrDefault(matrix.a, 1),
      b: numberOrDefault(matrix.b, 0),
      c: numberOrDefault(matrix.c, 0),
      d: numberOrDefault(matrix.d, 1),
      e: numberOrDefault(matrix.e, 0),
      f: numberOrDefault(matrix.f, 0),
    };
  }

  function clean(value) {
    return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined && item !== null));
  }

  function anchorOrDefault(value, fallback) {
    return value === "pivot" || value === "joint" || value === "handTip" ? value : fallback;
  }

  function stringOrNull(value) {
    return value === undefined || value === null || value === "" ? null : String(value);
  }

  function stringOrDefault(value, fallback) {
    return value === undefined || value === null || value === "" ? String(fallback) : String(value);
  }

  function numberOrDefault(value, fallback) {
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
  }

  installProjectModelPatch();
  Animotion.supplementalFollowProject = { installProjectModelPatch, normalizeSupplementalFollow, preserveFollow };
  if (typeof module !== "undefined") module.exports = Animotion.supplementalFollowProject;
}
