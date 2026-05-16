{
  const global = window;
  const Animotion = global.Animotion;
  const state = Animotion.state;
  const config = Animotion.config;
  const geometry = Animotion.geometry;
  const { pathFromShape } = Animotion.path;

  function makePartCanvas(rect, mask = null) {
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(rect.w));
    canvas.height = Math.max(1, Math.round(rect.h));
    const ctx = canvas.getContext("2d");
    ctx.drawImage(state.image, rect.x, rect.y, rect.w, rect.h, 0, 0, rect.w, rect.h);
    if (mask) {
      ctx.globalCompositeOperation = "destination-in";
      ctx.fillStyle = "#000";
      ctx.fill(pathFromShape({ ...mask, closed: true }));
      ctx.globalCompositeOperation = "source-over";
    }
    return canvas;
  }

  function updatePartCanvas(part) {
    part.canvas = makePartCanvas(part.rect, part.mask);
  }

  function suggestParent(type) {
    if (type === "eye" || type === "mouth" || type === "hair") {
      return state.parts.find((part) => part.type === "head")?.id || null;
    }
    if (type === "spine") return state.parts.find((part) => part.type === "body")?.id || null;
    if (type === "arm" || type === "leg" || type === "head") {
      return state.parts.find((part) => part.type === "spine")?.id || state.parts.find((part) => part.type === "body")?.id || null;
    }
    return null;
  }

  function suggestedParentPart(type) {
    const parentId = suggestParent(type);
    return state.parts.find((part) => part.id === parentId) || null;
  }

  function createPartFromShape(type, shape, name = "") {
    const normalized = geometry.normalizeShape(shape, Animotion.imageBounds());
    const rect = geometry.pointsBounds(normalized.points, Animotion.imageBounds());
    const mask = geometry.shapeToMask(normalized, rect);
    const count = state.parts.filter((part) => part.type === type).length + 1;
    const parent = suggestedParentPart(type);
    const part = {
      id: crypto.randomUUID(),
      name: name || `${type}_${String(count).padStart(2, "0")}`,
      type,
      rect,
      mask,
      pivot: Animotion.rigging.defaultPivotForPart(type, rect, parent?.rect || null),
      joint: Animotion.rigging.defaultJointForPart(type, rect, parent?.rect || null),
      parentId: parent?.id || null,
      order: state.parts.length + 1,
      alpha: 1,
      hidden: false,
      customMotion: Animotion.motionModel.defaultCustomMotion(),
    };
    updatePartCanvas(part);
    state.parts.push(part);
    state.selectedPartId = part.id;
    Animotion.ui.refreshUi();
  }

  function createPart(type, rect, name = "") {
    createPartFromShape(type, geometry.rectShape(rect), name);
  }

  function applyShapeToPart(part, shape) {
    const normalized = geometry.normalizeShape(shape, Animotion.imageBounds());
    const rect = geometry.pointsBounds(normalized.points, Animotion.imageBounds());
    if (rect.w < config.minShapeSize || rect.h < config.minShapeSize) return;
    const oldPivot = { x: part.rect.x + part.pivot.x, y: part.rect.y + part.pivot.y };
    const oldJoint = { x: part.rect.x + part.joint.x, y: part.rect.y + part.joint.y };
    part.rect = rect;
    part.mask = geometry.shapeToMask(normalized, rect);
    part.pivot = {
      x: geometry.clamp(oldPivot.x - rect.x, 0, rect.w),
      y: geometry.clamp(oldPivot.y - rect.y, 0, rect.h),
    };
    part.joint = {
      x: geometry.clamp(oldJoint.x - rect.x, 0, rect.w),
      y: geometry.clamp(oldJoint.y - rect.y, 0, rect.h),
    };
    updatePartCanvas(part);
  }

  function selectedPart() {
    return state.parts.find((part) => part.id === state.selectedPartId) || null;
  }

  function resetForNewImage(image, imageName) {
    state.image = image;
    state.imageName = imageName;
    state.parts = [];
    state.selection = null;
    state.drag = null;
    state.selectedPartId = null;
    state.sourceZoom = 1;
    state.sourcePan = { x: 0, y: 0 };
    state.startTime = performance.now();
    state.cutsceneBridge = null;
    state.lookismPreset = null;
  }

  Animotion.parts = { createPartFromShape, createPart, applyShapeToPart, selectedPart, resetForNewImage, updatePartCanvas };
}
