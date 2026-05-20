{
  const global = typeof window !== "undefined" ? window : globalThis;
  const Animotion = global.Animotion || (global.Animotion = {});
  const ELEMENTS = new Set(["circle", "ellipse", "line", "path", "polygon", "polyline", "rect"]);
  const ATTRS = new Set(["cx", "cy", "d", "fill", "height", "opacity", "points", "r", "rx", "ry", "stroke", "stroke-linecap", "stroke-linejoin", "stroke-width", "viewBox", "width", "x", "x1", "x2", "y", "y1", "y2"]);

  function compileScriptedGengaScript(source) {
    if (typeof source !== "string") return normalizeDefinition(source);
    try {
      return normalizeDefinition(JSON.parse(source));
    } catch (error) {
      throw new Error(`Scripted genga definition must be valid JSON: ${error.message}`);
    }
  }

  function runScriptedGengaDefinition(input, options = {}) {
    const definition = compileScriptedGengaScript(input);
    const markup = svgMarkup(definition);
    const uri = svgDataUri(markup);
    const parts = definition.parts.map((part, index) => partFromDefinition(part, index, definition.canvas));
    const hiddenPatches = definition.hiddenCompletionGuides.map((guide) => hiddenPatchFromDefinition(guide, parts, definition.canvas));
    const project = projectFromDefinition(definition, parts, hiddenPatches, uri);
    return {
      id: definition.id,
      seed: definition.seed,
      name: definition.name,
      preview: { width: definition.canvas.width, height: definition.canvas.height, uri },
      layers: parts.map(layerFromPart),
      parts,
      hiddenCompletionPatch: hiddenPatches[0] || null,
      hiddenCompletionPatches: hiddenPatches,
      project,
    };
  }

  async function loadGeneratedCutIntoApp(result) {
    const image = await imageFromUri(result.preview.uri);
    Animotion.sessionCommands.resetForNewImage(image, result.project.editor.imageName);
    const project = Animotion.projectModel.normalizeProject(result.project, { imageBounds: imageBounds(image) });
    const parts = Animotion.projectModel.editorPartsFromProject(project);
    for (const part of parts) Animotion.parts.updatePartCanvas(part);
    Animotion.sessionCommands.restoreProject(project, parts, null);
    Animotion.state.selectedPartId = result.project.editor.selectedPartId || parts[0]?.id || null;
    Animotion.state.scriptedGengaFixture = result;
    Animotion.ui.refreshUi();
    return result;
  }

  function normalizeDefinition(definition = {}) {
    const canvas = normalizeCanvas(definition.canvas);
    const parts = arrayOrThrow(definition.parts, "parts").map(normalizePartDefinition);
    return {
      id: requiredString(definition.id, "id"),
      seed: String(definition.seed || definition.id),
      name: String(definition.name || definition.id),
      canvas,
      visual: { elements: normalizeElements(definition.visual?.elements || []) },
      parts,
      hiddenCompletionGuides: (definition.hiddenCompletionGuides || []).map(normalizeHiddenGuide),
      editor: definition.editor && typeof definition.editor === "object" ? definition.editor : {},
    };
  }

  function normalizeCanvas(canvas = {}) {
    return {
      width: positiveInt(canvas.width, 960),
      height: positiveInt(canvas.height, 540),
      fps: positiveInt(canvas.fps, 24),
      durationFrames: positiveInt(canvas.durationFrames, 120),
      backgroundColor: String(canvas.backgroundColor || "#f7f0df"),
    };
  }

  function normalizePartDefinition(part) {
    const sourceRect = rect(part.sourceRect || part.rect);
    return {
      id: requiredString(part.id, "part.id"),
      name: String(part.name || part.id),
      type: String(part.type || "prop"),
      sourceRect,
      rect: sourceRect,
      pivot: point(part.pivot, { x: sourceRect.w * 0.5, y: sourceRect.h * 0.5 }),
      joint: point(part.joint, { x: sourceRect.w * 0.5, y: sourceRect.h * 0.5 }),
      parentId: part.parentId || part.parentPartId || null,
      layerIndex: Math.round(Number(part.layerIndex ?? part.order) || 1),
      opacity: clampNumber(part.opacity ?? part.alpha, 0, 1, 1),
    };
  }

  function partFromDefinition(source, index, canvas) {
    const mask = maskForRect(source.sourceRect);
    return {
      ...source,
      assetId: `asset-${source.id}`,
      sourceAssetId: "source-image",
      parentPartId: source.parentId,
      visible: true,
      sourceRectNormalized: normalizedImageRect(source.sourceRect, canvas),
      pivotNormalized: normalizedLocalPoint(source.pivot, source.sourceRect),
      jointNormalized: normalizedLocalPoint(source.joint, source.sourceRect),
      mask,
      maskVerticesNormalized: mask.points.map((item) => normalizedLocalPoint(item, source.sourceRect)),
      transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 },
      layerIndex: source.layerIndex || index + 1,
    };
  }

  function hiddenPatchFromDefinition(guide, parts, canvas) {
    const part = parts.find((item) => item.id === guide.sourcePartId);
    if (!part) throw new Error(`hidden completion guide sourcePartId not found: ${guide.sourcePartId}`);
    const asset = {
      id: guide.id,
      type: "hiddenCompletionPatch",
      name: guide.name,
      uri: `hidden-completion://${guide.id}`,
      sourcePartId: part.id,
      sourceRectNormalized: normalizedImageRect(part.sourceRect, canvas),
      maskVerticesNormalized: part.maskVerticesNormalized,
      guide: { kind: "meshGuide", meshVerticesNormalized: guide.meshVerticesNormalized, meshFaces: guide.meshFaces, silhouetteVerticesNormalized: guide.silhouetteVerticesNormalized, guideStrength: guide.guideStrength },
      patchTransform: { translationNormalized: { xNorm: 0, yNorm: 0 }, scaleX: 1, scaleY: 1, rotation: 0 },
      generatedResult: { status: "none" },
      renderMode: "guideOnly",
      patchStatus: "guide",
      preview: guide.preview || { label: guide.name, color: "#f1b83b", visible: true },
    };
    return Animotion.hiddenCompletionAssets?.normalizeAsset?.(asset) || asset;
  }

  function projectFromDefinition(definition, parts, hiddenPatches, uri) {
    return {
      format: "animotion-project",
      version: "1.0.0",
      metadata: { name: definition.name, createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z", seed: definition.seed },
      canvas: definition.canvas,
      assets: [{ id: "source-image", type: "sourceImage", name: `${definition.id}.svg`, uri, width: definition.canvas.width, height: definition.canvas.height }, ...hiddenPatches],
      parts,
      proxies: [],
      rigs: [rigFromParts(parts, definition.editor.rootPartId)],
      motions: [],
      effects: [],
      timeline: { currentFrame: 1, durationFrames: definition.canvas.durationFrames, tracks: [] },
      editor: editorFromDefinition(definition, hiddenPatches[0]),
    };
  }

  function editorFromDefinition(definition, hiddenPatch) {
    const selected = definition.editor.selectedPartId || definition.parts[0]?.id || null;
    const motionPlan = definition.editor.motionPlan || { template: "kick", target: null, targetMode: false };
    if (!hiddenPatch) return { imageName: `${definition.id}.svg`, selectedPartId: selected, motionPlan };
    return { imageName: `${definition.id}.svg`, selectedPartId: selected, motionPlan: { ...motionPlan, motionDraft: motionPlan.motionDraft || { draftKind: "scripted-genga-fixture", hiddenCompletion: { needed: true, assetKind: "hiddenCompletionPatch", assetStatus: "ready", assetId: hiddenPatch.id } } } };
  }

  function rigFromParts(parts, rootPartId) {
    return { id: "scripted-genga-rig", name: "Scripted Genga Rig", rootPartId: rootPartId || parts.find((part) => !part.parentId)?.id || parts[0]?.id || null, bones: parts.filter((part) => part.type !== "prop").map(boneFromPart) };
  }

  function boneFromPart(part) {
    return { id: `bone-${part.id}`, name: `${part.name} bone`, parentBoneId: part.parentId ? `bone-${part.parentId}` : undefined, partId: part.id, start: { x: part.sourceRect.x + part.pivot.x, y: part.sourceRect.y + part.pivot.y }, end: { x: part.sourceRect.x + part.joint.x, y: part.sourceRect.y + part.joint.y } };
  }

  function svgMarkup(definition) {
    const { width, height } = definition.canvas;
    const body = definition.visual.elements.map(svgElement).join("");
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">${body}</svg>`;
  }

  function svgElement(element) {
    const attrs = Object.entries(element.attrs).map(([key, value]) => `${key}="${escapeAttr(value)}"`).join(" ");
    return `<${element.type}${attrs ? ` ${attrs}` : ""}/>`;
  }

  function normalizeElements(elements) {
    return elements.map((element) => {
      const type = String(element.type || "");
      if (!ELEMENTS.has(type)) throw new Error(`Unsupported scripted genga SVG element: ${type}`);
      return { type, attrs: normalizeAttrs(element.attrs || {}) };
    });
  }

  function normalizeAttrs(attrs) {
    return Object.fromEntries(Object.entries(attrs).filter(([key]) => ATTRS.has(key)).map(([key, value]) => [key, String(value)]));
  }

  function normalizeHiddenGuide(guide) {
    return { id: requiredString(guide.id, "hiddenCompletionGuide.id"), name: String(guide.name || guide.id), sourcePartId: requiredString(guide.sourcePartId, "hiddenCompletionGuide.sourcePartId"), meshVerticesNormalized: normalizeNormPoints(guide.meshVerticesNormalized), meshFaces: guide.meshFaces || [], silhouetteVerticesNormalized: normalizeNormPoints(guide.silhouetteVerticesNormalized), guideStrength: clampNumber(guide.guideStrength, 0, 1, 0.8), preview: guide.preview || null };
  }

  function normalizeNormPoints(points = []) {
    return points.map((item) => ({ xNorm: Number(item.xNorm), yNorm: Number(item.yNorm) })).filter((item) => Number.isFinite(item.xNorm) && Number.isFinite(item.yNorm));
  }

  function rect(source = {}) {
    return { x: Math.round(Number(source.x) || 0), y: Math.round(Number(source.y) || 0), w: positiveInt(source.w, 1), h: positiveInt(source.h, 1) };
  }
  function point(source = {}, fallback = { x: 0, y: 0 }) {
    return { x: Number.isFinite(Number(source.x)) ? Number(source.x) : fallback.x, y: Number.isFinite(Number(source.y)) ? Number(source.y) : fallback.y };
  }
  function maskForRect(sourceRect) {
    return { kind: "polygon", points: [{ x: 0, y: 0 }, { x: sourceRect.w, y: 0 }, { x: sourceRect.w, y: sourceRect.h }, { x: 0, y: sourceRect.h }] };
  }
  function normalizedImageRect(sourceRect, canvas) {
    return { xNorm: sourceRect.x / canvas.width, yNorm: sourceRect.y / canvas.height, wNorm: sourceRect.w / canvas.width, hNorm: sourceRect.h / canvas.height, coordinateSpace: "normalized-image" };
  }
  function normalizedLocalPoint(sourcePoint, sourceRect) {
    return { xNorm: sourcePoint.x / sourceRect.w, yNorm: sourcePoint.y / sourceRect.h, coordinateSpace: "part-local-normalized" };
  }
  function layerFromPart(part) {
    return { id: part.id, name: part.name, type: part.type, rect: part.sourceRect, order: part.layerIndex, parentId: part.parentId };
  }
  function imageFromUri(uri) {
    return new Promise((resolve, reject) => { const image = new Image(); image.onload = () => resolve(image); image.onerror = () => reject(new Error("Scripted genga image failed to load.")); image.src = uri; });
  }
  function imageBounds(image) { return { width: image.naturalWidth, height: image.naturalHeight }; }
  function arrayOrThrow(value, key) { if (!Array.isArray(value)) throw new Error(`Scripted genga definition requires ${key}.`); return value; }
  function requiredString(value, key) { if (value === undefined || value === null || value === "") throw new Error(`Scripted genga definition requires ${key}.`); return String(value); }
  function positiveInt(value, fallback) { return Math.max(1, Math.round(Number(value) || fallback)); }
  function clampNumber(value, min, max, fallback) { const number = Number(value); return Number.isFinite(number) ? Math.min(max, Math.max(min, number)) : fallback; }
  function escapeAttr(value) { return String(value).replace(/[&"]/g, (char) => ({ "&": "&amp;", '"': "&quot;" })[char]); }
  function svgDataUri(markup) { return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(markup)}`; }

  Animotion.scriptedGengaRunner = { compileScriptedGengaScript, runScriptedGengaDefinition, loadGeneratedCutIntoApp };
  if (typeof module !== "undefined") module.exports = Animotion.scriptedGengaRunner;
}
