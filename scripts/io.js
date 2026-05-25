{
  const global = window;
  const Animotion = global.Animotion;
  const state = Animotion.state;
  const { loadImageFromFile } = Animotion.view;

  async function handleImageUpload(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      Animotion.parts.resetForNewImage(await loadImageFromFile(file), file.name);
      Animotion.ui.refreshUi();
    } catch (error) {
      alert(error.message);
    }
  }

  async function handleNextImageUpload(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      Animotion.sessionCommands.setImpactImage(await loadImageFromFile(file), file.name);
      Animotion.ui.refreshUi();
    } catch (error) {
      alert(error.message);
    }
  }

  function createGuideParts() {
    if (Animotion.panelEditor?.canEditRig() === false) return;
    if (!state.image) return;
    const w = state.image.naturalWidth;
    const h = state.image.naturalHeight;
    const boxes = [
      ["body", { x: w * 0.37, y: h * 0.46, w: w * 0.27, h: h * 0.36 }],
      ["spine", { x: w * 0.43, y: h * 0.48, w: w * 0.15, h: h * 0.3 }],
      ["head", { x: w * 0.36, y: h * 0.18, w: w * 0.28, h: h * 0.28 }],
      ["hair", { x: w * 0.33, y: h * 0.13, w: w * 0.34, h: h * 0.22 }],
      ["arm", { x: w * 0.25, y: h * 0.48, w: w * 0.17, h: h * 0.28 }],
      ["arm", { x: w * 0.58, y: h * 0.48, w: w * 0.17, h: h * 0.28 }],
      ["leg", { x: w * 0.38, y: h * 0.76, w: w * 0.12, h: h * 0.2 }],
      ["leg", { x: w * 0.5, y: h * 0.76, w: w * 0.12, h: h * 0.2 }],
      ["eye", { x: w * 0.42, y: h * 0.29, w: w * 0.16, h: h * 0.06 }],
      ["mouth", { x: w * 0.45, y: h * 0.38, w: w * 0.1, h: h * 0.05 }],
    ];
    const before = Animotion.partCommands.historySnapshot?.();
    for (const [type, rect] of boxes) Animotion.parts.createPart(type, roundedRect(rect, w, h), "", { recordHistory: false });
    Animotion.partCommands.recordHistorySnapshot?.("create-guide-parts", before, Animotion.partCommands.historySnapshot?.());
    Animotion.ui.refreshUi();
  }

  function roundedRect(rect, imageWidth, imageHeight) {
    const clamp = Animotion.geometry.clamp;
    return {
      x: Math.round(clamp(rect.x, 0, imageWidth - 1)),
      y: Math.round(clamp(rect.y, 0, imageHeight - 1)),
      w: Math.round(clamp(rect.w, 8, imageWidth - rect.x)),
      h: Math.round(clamp(rect.h, 8, imageHeight - rect.y)),
    };
  }

  function createRigPayload() {
    const imageBounds = currentImageBounds();
    const bridge = state.cutsceneBridge ? Animotion.cutsceneModel.normalizeBridge(state.cutsceneBridge, { imageBounds, assets: state.project?.assets }) : null;
    return Animotion.projectModel.projectFromEditorState({
      ...state,
      cutsceneBridge: bridge,
      panelSetup: Animotion.panelEditor?.ensureSetup?.() || null,
      motionPlan: Animotion.motionPlanner?.normalizePlan?.(state.motionPlan, { imageBounds, assets: state.project?.assets }) || null,
    });
  }

  function deserializeRigPart(part, options = {}) {
    const geometry = Animotion.geometry;
    const mask = part.mask || geometry.shapeToMask(geometry.rectShape(part.rect), part.rect);
    const customMotion = Animotion.motionModel.normalizeCustomMotion(part.customMotion);
    const joint = part.joint || Animotion.rigging.defaultJointForPart(part.type, part.rect, null);
    const restored = { ...part, mask, customMotion, joint, keyframes: normalizeKeyframes(part) };
    if (!options.deferCanvas) Animotion.parts.updatePartCanvas(restored);
    return restored;
  }

  function deserializeProjectParts(project) {
    const parts = Animotion.projectModel.editorPartsFromProject(project)
      .map((part) => deserializeRigPart(part, { deferCanvas: true }));
    for (const part of parts) {
      if (!part.isSupplementalPart) Animotion.parts.updatePartCanvas(part);
    }
    for (const part of parts) {
      if (part.isSupplementalPart) restoreSupplementalCanvas(part, parts, project);
    }
    return parts;
  }

  function restoreSupplementalCanvas(part, parts, project) {
    const snapshot = Animotion.hiddenCompletionSupplementalProject?.restoreCanvasSnapshot?.(part, {
      onLoad: () => Animotion.ui?.refreshUi?.(),
    });
    if (snapshot?.ok) {
      part.canvas = snapshot.canvas;
      part.supplementalCanvasDiagnostics = snapshot.diagnostics;
      part.supplementalCoverage = Animotion.hiddenCompletionSupplementalPart?.coverageForPart?.(part) || part.supplementalCoverage;
      return snapshot;
    }
    const result = Animotion.hiddenCompletionSupplementalPart?.regenerateCanvasForPart?.(part, parts, {
      assets: project.assets || [],
      imageBounds: currentImageBounds(),
      sourceImage: state.image,
    });
    if (result?.ok) {
      part.supplementalCanvasDiagnostics = Animotion.hiddenCompletionSupplementalProject?.snapshotDiagnostics?.(part, part.canvas, { regeneratedCanvasFromMetadata: true }) || null;
      return result;
    }
    Animotion.parts.updatePartCanvas(part);
    return result || null;
  }

  function normalizeKeyframes(part) {
    return (part.keyframes || []).map((keyframe) => ({
      frame: Math.max(1, Math.round(Number(keyframe.frame) || 1)),
      pose: Animotion.motionModel.normalizeCustomMotion(keyframe.pose),
    }));
  }

  function saveRig() {
    const blob = new Blob([JSON.stringify(createRigPayload(), null, 2)], { type: "application/json" });
    downloadUrl(URL.createObjectURL(blob), "animotion-project.json");
  }

  async function loadRig(event) {
    const file = event.target.files?.[0];
    if (!file || !state.image) return;
    try {
      const currentBridge = state.cutsceneBridge ? Animotion.cutsceneModel.normalizeBridge(state.cutsceneBridge) : null;
      const payload = JSON.parse(await file.text());
      restorePayload(payload, currentBridge);
      state.selectedPartId = state.selectedPartId || state.parts[0]?.id || null;
      Animotion.ui.refreshUi();
    } catch (error) {
      alert(`리그 JSON을 불러오지 못했습니다: ${error.message}`);
    }
  }

  function rigPartsFromPayload(payload) {
    if (Animotion.projectModel?.isProjectPayload?.(payload)) {
      return Animotion.projectModel.editorPartsFromProject(
        Animotion.projectModel.normalizeProject(payload, { imageBounds: currentImageBounds() })
      );
    }
    if (Array.isArray(payload.parts)) return payload.parts;
    if (Number(payload.version) === 3) {
      const parts = payload.characters?.[0]?.parts;
      if (Array.isArray(parts)) return parts.map(normalizeAiRigPart);
    }
    throw new Error("지원하지 않는 리그 JSON 형식입니다.");
  }

  function normalizeAiRigPart(part) {
    return {
      ...part,
      type: normalizePartType(part.type),
      mask: inlineMask(part.mask, part.rect),
      customMotion: Animotion.motionModel.defaultCustomMotion(),
    };
  }

  function restorePayload(payload, currentBridge) {
    if (Animotion.projectModel?.isProjectPayload?.(payload)) return restoreProjectPayload(payload, currentBridge);
    Animotion.sessionCommands.restoreLegacyRig(
      payload,
      rigPartsFromPayload(payload).map(deserializeRigPart),
      currentBridge
    );
  }

  function restoreProjectPayload(payload, currentBridge) {
    const project = Animotion.projectModel.normalizeProject(payload, { imageBounds: currentImageBounds() });
    Animotion.sessionCommands.restoreProject(
      project,
      deserializeProjectParts(project),
      currentBridge
    );
  }

  function normalizePartType(type) {
    return Animotion.partTypeLabels[type] ? type : "prop";
  }

  function inlineMask(mask, rect) {
    if (mask?.points) return mask;
    return Animotion.geometry.shapeToMask(Animotion.geometry.rectShape(rect), rect);
  }

  function currentImageBounds() {
    return state.image ? { width: state.image.naturalWidth, height: state.image.naturalHeight } : null;
  }

  function downloadUrl(url, filename) {
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 500);
  }

  Animotion.io = { handleImageUpload, handleNextImageUpload, createGuideParts, createRigPayload, saveRig, loadRig, rigPartsFromPayload, deserializeProjectParts, downloadUrl };
}
