{
  const global = typeof window !== "undefined" ? window : globalThis;
  const Animotion = global.Animotion || (global.Animotion = {});
  const DRAG_KIND = "hidden-completion-guide";
  function installControls() {
    if (typeof document === "undefined") return;
    const anchor = document.querySelector("#motionDraftInspector");
    if (!anchor || document.querySelector("#createHiddenCompletionGuide")) return;
    anchor.append(guideMarkup());
    bindControls();
  }
  function refreshControls() {
    if (typeof document === "undefined") return;
    const ui = refs();
    if (!ui.create) return;
    const part = selectedPart();
    const draft = activeDraft();
    const asset = activePatchAsset();
    const visible = Boolean(part && draft);
    ui.box.classList.toggle("hidden", !visible);
    ui.create.disabled = !visible;
    ui.status.textContent = statusText(part, draft, asset);
  }
  function createGuideFromSelectedPart() {
    const part = selectedPart();
    const draft = activeDraft();
    if (!part || !draft) return null;
    const asset = Animotion.hiddenCompletionAssets.createForPart(part, {
      id: guideAssetId(part),
      name: `${part.name || part.id} \uBCF4\uC644 \uAC00\uC774\uB4DC`,
      patchStatus: "guide",
      renderMode: "guideOnly",
      preview: { label: "\uBCF4\uC644 \uAC00\uC774\uB4DC" },
    });
    if (!asset) return null;
    upsertAsset(asset);
    Animotion.motionDraftEditor.updateHiddenCompletion({
      status: draft.hiddenCompletion.status === "none" ? "candidate" : draft.hiddenCompletion.status,
      assetKind: "hiddenCompletionPatch",
      assetStatus: "ready",
      assetId: asset.id,
    });
    refresh();
    return asset;
  }
  function drawOverlay(ctx, view) {
    if (!editingLayerVisible()) return;
    const asset = activePatchAsset();
    const part = sourcePartFor(asset);
    if (!asset?.guide || !part || !view) return;
    const points = guideScreenPoints(asset, part, view);
    if (!points.mesh.length) return;
    ctx.save();
    drawSilhouette(ctx, points.silhouette);
    drawMesh(ctx, points.mesh, asset.guide.meshFaces);
    drawHandles(ctx, points.mesh);
    drawLabel(ctx, points.mesh[0], asset.preview?.label || "\uBCF4\uC644 \uAC00\uC774\uB4DC");
    ctx.restore();
  }
  function beginDrag(event) {
    if (!editingLayerVisible()) return false;
    const hit = hitGuideVertex(event);
    if (!hit) return false;
    freezePlayback();
    Animotion.state.previewDrag = { kind: DRAG_KIND, assetId: hit.asset.id, vertexIndex: hit.index };
    Animotion.dom.previewCanvas.setPointerCapture(event.pointerId);
    event.preventDefault();
    return true;
  }
  function updateDrag(event) {
    const drag = Animotion.state.previewDrag;
    if (drag?.kind !== DRAG_KIND) return false;
    const point = previewPoint(event);
    if (!point) return true;
    updateSelectedGuideVertexFromImagePoint(drag.vertexIndex, point);
    event.preventDefault();
    refresh();
    return true;
  }
  function endDrag(event) {
    if (Animotion.state.previewDrag?.kind !== DRAG_KIND) return false;
    if (Animotion.dom.previewCanvas.hasPointerCapture(event.pointerId)) {
      Animotion.dom.previewCanvas.releasePointerCapture(event.pointerId);
    }
    Animotion.state.previewDrag = null;
    refresh();
    return true;
  }
  function updateSelectedGuideVertexFromImagePoint(index, point) {
    const asset = activePatchAsset();
    const part = sourcePartFor(asset);
    if (!asset?.guide || !part) return null;
    const vertex = normalizedPointInPart(part, point);
    const guide = {
      ...asset.guide,
      meshVerticesNormalized: asset.guide.meshVerticesNormalized.map((candidate, candidateIndex) => (
        candidateIndex === index ? vertex : candidate
      )),
    };
    return upsertAsset({ ...asset, guide });
  }
  function guideAssetId(part) {
    const existing = activePatchAsset();
    if (existing?.sourcePartId === part.id) return existing.id;
    const base = `hidden-${part.id}-guide`;
    return uniqueAssetId(base);
  }
  function upsertAsset(asset) {
    const project = ensureProject();
    const normalized = Animotion.hiddenCompletionAssets.normalizeAsset(asset);
    if (!normalized) return null;
    const assets = Array.isArray(project.assets) ? project.assets : [];
    const index = assets.findIndex((candidate) => candidate.id === normalized.id);
    project.assets = index >= 0
      ? assets.map((candidate, candidateIndex) => candidateIndex === index ? normalized : candidate)
      : [...assets, normalized];
    return normalized;
  }
  function hitGuideVertex(event) {
    const asset = activePatchAsset();
    const part = sourcePartFor(asset);
    if (!asset?.guide || !part || !Animotion.state.previewView) return null;
    const screen = canvasPoint(event);
    const points = guideScreenPoints(asset, part, Animotion.state.previewView).mesh;
    const tolerance = Animotion.config.hitTolerancePx;
    const hits = points
      .map((point, index) => ({ index, distance: Animotion.geometry.distance(screen, point) }))
      .filter((hit) => hit.distance <= tolerance)
      .sort((a, b) => a.distance - b.distance);
    return hits.length ? { asset, index: hits[0].index } : null;
  }
  function guideScreenPoints(asset, part, view) {
    const runtime = Animotion.hiddenCompletionAssets.runtimeGuideMesh(asset, part.rect);
    const matrix = currentPartMatrix(part);
    return {
      mesh: localPointsToScreen(runtime.meshVertices, part, matrix, view),
      silhouette: localPointsToScreen(runtime.silhouetteVertices, part, matrix, view),
    };
  }
  function localPointsToScreen(points, part, matrix, view) {
    return points
      .map((point) => new DOMPoint(part.rect.x + point.x, part.rect.y + point.y).matrixTransform(matrix))
      .map((point) => Animotion.previewTransform.imagePointToScreen(point, view, Animotion.state.previewSourceFrame, Animotion.state.previewSourceTransform))
      .filter(Boolean);
  }
  function drawSilhouette(ctx, points) {
    if (points.length < 3) return;
    pathPoints(ctx, points);
    ctx.fillStyle = "rgba(143, 211, 255, 0.18)";
    ctx.strokeStyle = "#0f7f79";
    ctx.lineWidth = 2;
    ctx.setLineDash([7, 5]);
    ctx.fill();
    ctx.stroke();
    ctx.setLineDash([]);
  }
  function drawMesh(ctx, points, faces = []) {
    ctx.strokeStyle = "#151515";
    ctx.lineWidth = 1.5;
    for (const face of faces) {
      const triangle = face.map((index) => points[index]).filter(Boolean);
      if (triangle.length !== 3) continue;
      pathPoints(ctx, triangle);
      ctx.closePath();
      ctx.stroke();
    }
  }
  function drawHandles(ctx, points) {
    for (const point of points) {
      ctx.beginPath();
      ctx.fillStyle = "#f1b83b";
      ctx.strokeStyle = "#151515";
      ctx.lineWidth = 2;
      ctx.arc(point.x, point.y, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
  }
  function drawLabel(ctx, point, label) {
    if (!point) return;
    ctx.fillStyle = "#151515";
    ctx.font = "800 12px Aptos, sans-serif";
    ctx.fillText(label, point.x + 9, point.y - 9);
  }
  function pathPoints(ctx, points) {
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (const point of points.slice(1)) ctx.lineTo(point.x, point.y);
  }
  function normalizedPointInPart(part, point) {
    const local = {
      x: Animotion.geometry.clamp(point.x - part.rect.x, 0, part.rect.w),
      y: Animotion.geometry.clamp(point.y - part.rect.y, 0, part.rect.h),
    };
    return Animotion.coordinateSpaces.normalizedLocalPointFromPoint(local, part.rect);
  }
  function currentPartMatrix(part) {
    const t = Animotion.state.running ? (performance.now() - Animotion.state.startTime) / 1000 : Animotion.state.pausedTime;
    return Animotion.preview.worldMatrix(part, t, new Map());
  }
  function activePatchAsset() {
    const assetId = activeDraft()?.hiddenCompletion?.assetId;
    return Animotion.hiddenCompletionAssets.findById(Animotion.state.project?.assets, assetId);
  }
  function activeDraft() {
    return Animotion.motionDraftEditor?.activeDraftContext?.()?.draft || null;
  }
  function sourcePartFor(asset) {
    if (!asset?.sourcePartId) return null;
    return Animotion.state.parts.find((part) => part.id === asset.sourcePartId) || null;
  }
  function selectedPart() {
    return Animotion.parts?.selectedPart?.() || Animotion.state.parts.find((part) => part.id === Animotion.state.selectedPartId) || null;
  }
  function previewPoint(event) {
    const point = Animotion.previewTransform.screenPointToImage(
      canvasPoint(event),
      Animotion.state.previewView,
      Animotion.state.previewSourceFrame,
      Animotion.state.previewSourceTransform
    );
    const bounds = Animotion.panelEditor?.imageBounds?.("source") || Animotion.imageBounds();
    return point ? {
      x: Animotion.geometry.clamp(point.x, 0, bounds.width),
      y: Animotion.geometry.clamp(point.y, 0, bounds.height),
    } : null;
  }
  function canvasPoint(event) {
    const rect = Animotion.dom.previewCanvas.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  }
  function ensureProject() {
    if (!Animotion.state.project) Animotion.state.project = Animotion.projectModel.createEmptyProject();
    return Animotion.state.project;
  }
  function uniqueAssetId(base) {
    const ids = new Set((Animotion.state.project?.assets || []).map((asset) => asset.id));
    if (!ids.has(base)) return base;
    let index = 2;
    while (ids.has(`${base}-${index}`)) index += 1;
    return `${base}-${index}`;
  }
  function editingLayerVisible() {
    return !Animotion.state.running && !Animotion.state.exporting;
  }
  function freezePlayback() {
    if (!Animotion.state.running) return;
    Animotion.state.pausedTime = (performance.now() - Animotion.state.startTime) / 1000;
    Animotion.state.running = false;
    Animotion.dom.els.playPause.textContent = "\uC7AC\uC0DD";
  }
  function statusText(part, draft, asset) {
    if (!part) return "Select a part to create a guide patch.";
    if (!draft) return "A 2.5D draft is required before linking a guide patch.";
    if (!asset) return `Create a guideOnly patch from ${part.name}.`;
    return `${asset.id} / ${asset.renderMode || "guideOnly"} / vertices ${asset.guide?.meshVerticesNormalized?.length || 0}`;
  }
  function refs() {
    return {
      box: document.querySelector("#hiddenCompletionGuideTools"),
      create: document.querySelector("#createHiddenCompletionGuide"),
      status: document.querySelector("#hiddenCompletionGuideStatus"),
    };
  }
  function guideMarkup() {
    const box = document.createElement("div");
    box.id = "hiddenCompletionGuideTools";
    box.className = "hidden-completion-guide-tools hidden";
    box.innerHTML = `
      <h2>\uBCF4\uC644 \uAC00\uC774\uB4DC</h2>
      <button id="createHiddenCompletionGuide" type="button">\uC120\uD0DD \uD30C\uCE20\uB85C \uBCF4\uC644 \uAC00\uC774\uB4DC \uB9CC\uB4E4\uAE30</button>
      <p id="hiddenCompletionGuideStatus" class="hint"></p>
    `;
    return box;
  }
  function bindControls() {
    refs().create?.addEventListener("click", createGuideFromSelectedPart);
  }
  function refresh() {
    Animotion.ui?.refreshUi?.();
  }
  Animotion.hiddenCompletionGuideEditor = {
    installControls,
    refreshControls,
    createGuideFromSelectedPart,
    updateSelectedGuideVertexFromImagePoint,
    drawOverlay,
    beginDrag,
    updateDrag,
    endDrag,
  };
  installControls();
  if (typeof module !== "undefined") module.exports = Animotion.hiddenCompletionGuideEditor;
}
