{
  const global = typeof window !== "undefined" ? window : globalThis;
  const Animotion = global.Animotion || (global.Animotion = {});

  const TARGETS = {
    source: "A컷",
    impact: "B컷",
  };

  function ensureSetup() {
    const setup = Animotion.state.panelSetup || {};
    Animotion.state.panelSetup = {
      source: normalizePanel(setup.source),
      impact: normalizePanel(setup.impact),
    };
    if (!Animotion.state.panelEditTarget) Animotion.state.panelEditTarget = "source";
    return Animotion.state.panelSetup;
  }

  function normalizePanel(panel = {}) {
    return {
      crop: panel.crop ? normalizeRect(panel.crop) : null,
      characterMask: panel.characterMask ? normalizeShape(panel.characterMask) : null,
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

  function activeTarget() {
    return Animotion.state.panelEditTarget === "impact" ? "impact" : "source";
  }

  function setActiveTarget(target) {
    Animotion.panelCommands.setActiveTarget(target);
  }

  function imageFor(target = activeTarget()) {
    return target === "impact" ? Animotion.state.nextImage : Animotion.state.image;
  }

  function imageBounds(target = activeTarget()) {
    const image = imageFor(target);
    return image ? { width: image.naturalWidth, height: image.naturalHeight } : { width: 1, height: 1 };
  }

  function canEditRig() {
    return activeTarget() === "source";
  }

  function setupFor(target = activeTarget()) {
    return ensureSetup()[target === "impact" ? "impact" : "source"];
  }

  function setCropFromSelection() {
    const shape = normalizedSelection();
    if (!shape) return;
    Animotion.panelCommands.setCropFromSelection(activeTarget(), shape, imageBounds());
  }

  function clearCrop() {
    Animotion.panelCommands.setCrop(activeTarget(), null);
  }

  function setCharacterMaskFromSelection() {
    const shape = normalizedSelection();
    if (!shape) return;
    Animotion.panelCommands.setCharacterMaskFromSelection(activeTarget(), shape);
  }

  function clearCharacterMask() {
    Animotion.panelCommands.setCharacterMask(activeTarget(), null);
  }

  function normalizedSelection() {
    const selection = Animotion.state.selection;
    if (!Animotion.geometry.shapeIsReady(selection, imageBounds(), Animotion.config.minShapeSize)) return null;
    return normalizeShape(Animotion.geometry.normalizeShape(selection, imageBounds()));
  }

  function createPanelCanvas(target, options = {}) {
    const image = imageFor(target);
    if (!image) return null;
    const setup = setupFor(target);
    const crop = setup.crop || { x: 0, y: 0, w: image.naturalWidth, h: image.naturalHeight };
    const canvas = document.createElement("canvas");
    canvas.width = crop.w;
    canvas.height = crop.h;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(image, crop.x, crop.y, crop.w, crop.h, 0, 0, crop.w, crop.h);
    applyMask(ctx, setup.characterMask, crop, options);
    canvas.animotionPanel = {
      sourceWidth: image.naturalWidth,
      sourceHeight: image.naturalHeight,
      crop: { ...crop },
    };
    return canvas;
  }

  function applyMask(ctx, mask, crop, options) {
    if (!mask) return;
    if (!options.removeCharacter && !options.characterOnly) return;
    ctx.globalCompositeOperation = options.removeCharacter ? "destination-out" : "destination-in";
    ctx.fillStyle = "#000";
    ctx.fill(Animotion.path.pathFromShape(mask, -crop.x, -crop.y));
    ctx.globalCompositeOperation = "source-over";
  }

  function cropShape(target = activeTarget()) {
    const crop = setupFor(target).crop;
    return crop ? Animotion.geometry.rectShape(crop) : null;
  }

  function characterMask(target = activeTarget()) {
    return setupFor(target).characterMask;
  }

  function installControls() {
    if (typeof document === "undefined") return;
    const anchor = document.querySelector("#lookismPresetStatus");
    if (!anchor || document.querySelector("#panelEditTarget")) return;
    const box = document.createElement("div");
    box.className = "panel-editor-tools";
    box.innerHTML = `
      <label>
        컷 영역 편집 대상
        <select id="panelEditTarget">
          <option value="source">A컷 / 리깅 원본</option>
          <option value="impact">B컷 / 다음 장면</option>
        </select>
      </label>
      <div class="button-row">
        <button id="setPanelCrop" type="button">선택을 컷 영역으로</button>
        <button id="clearPanelCrop" type="button">컷 전체 사용</button>
      </div>
      <div class="button-row">
        <button id="setCharacterMask" type="button">선택을 캐릭터 영역으로</button>
        <button id="clearCharacterMask" type="button">캐릭터 영역 해제</button>
      </div>
      <p id="panelEditStatus" class="hint">A컷 리깅과 B컷 도착 장면의 사용 영역을 따로 저장합니다.</p>
    `;
    anchor.after(box);
    refs().target.addEventListener("change", () => setActiveTarget(refs().target.value));
    refs().setCrop.addEventListener("click", setCropFromSelection);
    refs().clearCrop.addEventListener("click", clearCrop);
    refs().setMask.addEventListener("click", setCharacterMaskFromSelection);
    refs().clearMask.addEventListener("click", clearCharacterMask);
  }

  function refreshControls() {
    ensureSetup();
    const ui = refs();
    if (!ui.target) return;
    if (activeTarget() === "impact" && !Animotion.state.nextImage) {
      Animotion.panelCommands.setActiveTarget("source", { refresh: false, resetView: false });
    }
    const target = activeTarget();
    const image = imageFor(target);
    const ready = Boolean(normalizedSelection());
    ui.target.value = target;
    ui.target.options[1].disabled = !Animotion.state.nextImage;
    ui.setCrop.disabled = !image || !ready;
    ui.setMask.disabled = !image || !ready;
    ui.clearCrop.disabled = !image || !setupFor(target).crop;
    ui.clearMask.disabled = !image || !setupFor(target).characterMask;
    ui.status.textContent = statusText(target);
  }

  function statusText(target) {
    const setup = setupFor(target);
    const crop = setup.crop ? `${setup.crop.w}x${setup.crop.h}` : "전체 컷";
    const mask = setup.characterMask ? "캐릭터 영역 있음" : "캐릭터 영역 없음";
    return `${TARGETS[target]}: ${crop} · ${mask}`;
  }

  function refs() {
    return {
      target: document.querySelector("#panelEditTarget"),
      setCrop: document.querySelector("#setPanelCrop"),
      clearCrop: document.querySelector("#clearPanelCrop"),
      setMask: document.querySelector("#setCharacterMask"),
      clearMask: document.querySelector("#clearCharacterMask"),
      status: document.querySelector("#panelEditStatus"),
    };
  }

  function refresh() {
    Animotion.ui?.refreshUi?.();
  }

  Animotion.panelEditor = {
    ensureSetup,
    normalizePanel,
    activeTarget,
    setActiveTarget,
    imageFor,
    imageBounds,
    canEditRig,
    setupFor,
    createPanelCanvas,
    cropShape,
    characterMask,
    installControls,
    refreshControls,
  };

  ensureSetup();
  installControls();

  if (typeof module !== "undefined") module.exports = Animotion.panelEditor;
}
