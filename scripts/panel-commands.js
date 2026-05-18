{
  const global = window;
  const Animotion = global.Animotion;
  const state = Animotion.state;

  function setActiveTarget(target, options = {}) {
    state.panelEditTarget = normalizeTarget(target);
    state.selection = null;
    if (options.resetView !== false) Animotion.view?.resetSourceView?.();
    if (options.refresh !== false) refresh();
    return state.panelEditTarget;
  }

  function setPanelSetup(panelSetup) {
    state.panelSetup = {
      source: normalizePanel(panelSetup?.source),
      impact: normalizePanel(panelSetup?.impact),
    };
    return state.panelSetup;
  }

  function ensurePanelSetup() {
    return setPanelSetup(state.panelSetup || {});
  }

  function setCrop(target, crop) {
    setupFor(target).crop = crop ? normalizeRect(crop) : null;
    refresh();
  }

  function setCharacterMask(target, shape) {
    setupFor(target).characterMask = shape ? normalizeShape(shape) : null;
    refresh();
  }

  function setCropFromSelection(target, shape, imageBounds) {
    if (!shape) return;
    setCrop(target, Animotion.geometry.pointsBounds(shape.points, imageBounds));
  }

  function setCharacterMaskFromSelection(target, shape) {
    if (!shape) return;
    setCharacterMask(target, shape);
  }

  function setupFor(target) {
    return ensurePanelSetup()[normalizeTarget(target)];
  }

  function normalizeTarget(target) {
    return target === "impact" ? "impact" : "source";
  }

  function normalizePanel(panel = {}) {
    return Animotion.panelEditor?.normalizePanel?.(panel) || {
      crop: panel?.crop ? normalizeRect(panel.crop) : null,
      characterMask: panel?.characterMask ? normalizeShape(panel.characterMask) : null,
    };
  }

  function normalizeRect(rect) {
    return {
      x: Math.round(Number(rect.x) || 0),
      y: Math.round(Number(rect.y) || 0),
      w: Math.max(1, Math.round(Number(rect.w) || 1)),
      h: Math.max(1, Math.round(Number(rect.h) || 1)),
    };
  }

  function normalizeShape(shape) {
    return {
      kind: shape.kind || Animotion.shapeKind?.polygon || "polygon",
      closed: shape.closed !== false,
      points: (shape.points || []).map((point) => ({
        x: Number(point.x) || 0,
        y: Number(point.y) || 0,
      })),
    };
  }

  function refresh() {
    Animotion.ui?.refreshUi?.();
  }

  Animotion.panelCommands = {
    setActiveTarget,
    setPanelSetup,
    ensurePanelSetup,
    setCrop,
    setCharacterMask,
    setCropFromSelection,
    setCharacterMaskFromSelection,
    setupFor,
  };
}
