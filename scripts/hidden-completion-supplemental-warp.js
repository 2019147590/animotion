{
  const global = typeof window !== "undefined" ? window : globalThis;
  const Animotion = global.Animotion || (global.Animotion = {});
  const IDS = ["tl", "tr", "br", "bl"];
  const SEAM_IDS = ["seamA", "seamB"];

  function defaultWarp(part = {}) {
    const rect = part.rect || {};
    const w = Number(rect.w) || 1, h = Number(rect.h) || 1;
    return { coordinateSpace: "part-local", points: [
      { id: "tl", x: 0, y: 0 },
      { id: "tr", x: w, y: 0 },
      { id: "br", x: w, y: h },
      { id: "bl", x: 0, y: h },
    ] };
  }

  function normalizeWarp(warp, part = {}) {
    if (!warp?.points?.length) return null;
    const fallback = defaultWarp(part);
    const source = new Map(warp.points.map((point) => [String(point.id || ""), point]));
    return {
      coordinateSpace: "part-local",
      points: fallback.points.map((point) => normalizePoint(source.get(point.id), point)),
      ...(warp.materialSeam ? { materialSeam: normalizeMaterialSeam(warp.materialSeam, part) } : {}),
    };
  }

  function drawImage(ctx, part = {}) {
    if (!ctx || !part.canvas) return false;
    const warp = normalizeWarp(part.supplementalWarp, part);
    if (!warp) {
      ctx.drawImage(part.canvas, part.rect.x, part.rect.y, part.rect.w, part.rect.h);
      return false;
    }
    const src = sourcePoints(part.canvas);
    const dst = warp.points.map((point) => ({ x: part.rect.x + point.x, y: part.rect.y + point.y }));
    const materialClip = materialClipPoints(part);
    const seam = sourceMappedMaterialSeam(warp.materialSeam, part);
    if (seam) drawSeamedImage(ctx, part.canvas, src, dst, seam, materialClip);
    else drawQuad(ctx, part.canvas, src, dst, materialClip);
    return true;
  }

  function pointById(part, id) {
    const warp = normalizeWarp(part?.supplementalWarp, part) || defaultWarp(part);
    return warp.points.find((point) => point.id === id) || null;
  }

  function setPoint(part, id, point) {
    if (!part || !IDS.includes(id)) return null;
    const warp = normalizeWarp(part.supplementalWarp, part) || defaultWarp(part);
    return {
      ...warp,
      points: warp.points.map((candidate) => candidate.id === id ? { ...candidate, x: number(point.x), y: number(point.y) } : candidate),
    };
  }

  function materialSeam(part) {
    return normalizeMaterialSeam(part?.supplementalWarp?.materialSeam, part);
  }

  function materialSeamPointById(part, id) {
    return materialSeam(part).points.find((point) => point.id === id) || null;
  }

  function setMaterialSeamPoint(part, id, point) {
    if (!part || !SEAM_IDS.includes(id)) return null;
    const warp = normalizeWarp(part.supplementalWarp, part) || defaultWarp(part);
    const seam = normalizeMaterialSeam(warp.materialSeam, part);
    return {
      ...warp,
      materialSeam: {
        ...seam,
        points: seam.points.map((candidate) => candidate.id === id ? { ...candidate, x: number(point.x), y: number(point.y) } : candidate),
      },
    };
  }

  function translateMaterialSeam(part, delta = {}) {
    const warp = normalizeWarp(part?.supplementalWarp, part) || defaultWarp(part);
    const seam = normalizeMaterialSeam(warp.materialSeam, part);
    return {
      ...warp,
      materialSeam: {
        ...seam,
        points: seam.points.map((point) => ({ ...point, x: point.x + number(delta.x), y: point.y + number(delta.y) })),
      },
    };
  }

  function drawQuad(ctx, image, src, dst, materialClip = null) {
    drawTriangle(ctx, image, [src[0], src[1], src[2]], [dst[0], dst[1], dst[2]], materialClip);
    drawTriangle(ctx, image, [src[0], src[2], src[3]], [dst[0], dst[2], dst[3]], materialClip);
  }

  function drawSeamedImage(ctx, image, src, dst, seam, materialClip) {
    const sourceSeam = seam.sourcePoints, destSeam = seam.points;
    drawQuad(ctx, image, [src[0], src[1], sourceSeam[1], sourceSeam[0]], [dst[0], dst[1], destSeam[1], destSeam[0]], materialClip);
    drawQuad(ctx, image, [sourceSeam[0], sourceSeam[1], src[2], src[3]], [destSeam[0], destSeam[1], dst[2], dst[3]], materialClip);
  }

  function drawTriangle(ctx, image, src, dst, materialClip = null) {
    const matrix = triangleMatrix(src, dst);
    if (!matrix) return;
    ctx.save();
    path(ctx, dst);
    ctx.clip();
    ctx.transform(matrix.a, matrix.b, matrix.c, matrix.d, matrix.e, matrix.f);
    if (materialClip?.length >= 3) {
      polygon(ctx, materialClip);
      ctx.clip();
    }
    ctx.drawImage(image, 0, 0);
    ctx.restore();
  }

  function triangleMatrix(src, dst) {
    const [s1, s2, s3] = src, [d1, d2, d3] = dst;
    const det = s1.x * (s2.y - s3.y) + s2.x * (s3.y - s1.y) + s3.x * (s1.y - s2.y);
    if (Math.abs(det) < 0.0001) return null;
    return {
      a: (d1.x * (s2.y - s3.y) + d2.x * (s3.y - s1.y) + d3.x * (s1.y - s2.y)) / det,
      b: (d1.y * (s2.y - s3.y) + d2.y * (s3.y - s1.y) + d3.y * (s1.y - s2.y)) / det,
      c: (d1.x * (s3.x - s2.x) + d2.x * (s1.x - s3.x) + d3.x * (s2.x - s1.x)) / det,
      d: (d1.y * (s3.x - s2.x) + d2.y * (s1.x - s3.x) + d3.y * (s2.x - s1.x)) / det,
      e: (d1.x * (s2.x * s3.y - s3.x * s2.y) + d2.x * (s3.x * s1.y - s1.x * s3.y) + d3.x * (s1.x * s2.y - s2.x * s1.y)) / det,
      f: (d1.y * (s2.x * s3.y - s3.x * s2.y) + d2.y * (s3.x * s1.y - s1.x * s3.y) + d3.y * (s1.x * s2.y - s2.x * s1.y)) / det,
    };
  }

  function sourcePoints(canvas = {}) {
    const w = Number(canvas.width) || 1, h = Number(canvas.height) || 1;
    return [{ x: 0, y: 0 }, { x: w, y: 0 }, { x: w, y: h }, { x: 0, y: h }];
  }

  function defaultMaterialSeam(part = {}) {
    const rect = part.rect || {};
    const w = Number(rect.w) || 1, h = Number(rect.h) || 1;
    const points = [{ id: "seamA", x: 0, y: h * 0.5 }, { id: "seamB", x: w, y: h * 0.5 }];
    return { coordinateSpace: "part-local", sourcePoints: points.map((point) => ({ ...point })), points };
  }

  function normalizeMaterialSeam(seam, part = {}) {
    const fallback = defaultMaterialSeam(part);
    const source = pointMap(seam?.points);
    const material = pointMap(seam?.sourcePoints);
    return {
      coordinateSpace: "part-local",
      sourcePoints: fallback.sourcePoints.map((point) => normalizePoint(material.get(point.id) || source.get(point.id), point)),
      points: fallback.points.map((point) => normalizePoint(source.get(point.id), point)),
    };
  }

  function sourceMappedMaterialSeam(seam, part = {}) {
    if (!seam) return null;
    const rect = part.rect || {};
    const sx = (Number(part.canvas?.width) || 1) / Math.max(1, Number(rect.w) || 1);
    const sy = (Number(part.canvas?.height) || 1) / Math.max(1, Number(rect.h) || 1);
    return {
      sourcePoints: seam.sourcePoints.map((point) => ({ x: point.x * sx, y: point.y * sy })),
      points: seam.points.map((point) => ({ x: (Number(rect.x) || 0) + point.x, y: (Number(rect.y) || 0) + point.y })),
    };
  }

  function pointMap(points) {
    return new Map((points || []).map((point) => [String(point.id || ""), point]));
  }

  function materialClipPoints(part = {}) {
    const points = part.mask?.points;
    if (!Array.isArray(points) || points.length < 3) return null;
    const rect = part.rect || {};
    const sx = (Number(part.canvas?.width) || 1) / Math.max(1, Number(rect.w) || 1);
    const sy = (Number(part.canvas?.height) || 1) / Math.max(1, Number(rect.h) || 1);
    return points.map((point) => ({ x: number(point.x) * sx, y: number(point.y) * sy }));
  }

  function path(ctx, points) {
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    ctx.lineTo(points[1].x, points[1].y);
    ctx.lineTo(points[2].x, points[2].y);
    ctx.closePath();
  }

  function polygon(ctx, points) {
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (const point of points.slice(1)) ctx.lineTo(point.x, point.y);
    ctx.closePath();
  }

  function normalizePoint(point, fallback) {
    return { id: fallback.id, x: number(point?.x ?? fallback.x), y: number(point?.y ?? fallback.y) };
  }

  function number(value) {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : 0;
  }

  Animotion.hiddenCompletionSupplementalWarp = {
    IDS,
    SEAM_IDS,
    defaultWarp,
    normalizeWarp,
    drawImage,
    pointById,
    setPoint,
    materialSeam,
    materialSeamPointById,
    setMaterialSeamPoint,
    translateMaterialSeam,
  };
  if (typeof module !== "undefined") module.exports = Animotion.hiddenCompletionSupplementalWarp;
}
