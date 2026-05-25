{
  const global = typeof window !== "undefined" ? window : globalThis;
  const Animotion = global.Animotion || (global.Animotion = {});
  const { els } = Animotion.dom;

  function installControls() {
    ensureControls();
    wrapRefreshUi();
    bind(els.createVisibilityMask, () => run("createMaskFromSelection", strengthValue()));
    bind(els.setVisibilityMaskKeyframe, () => run("setCurrentFrameStrength", strengthValue()));
    bind(els.removeVisibilityMask, () => run("removeSelectedMask"));
    els.visibilityMaskStrength?.addEventListener("input", refreshStrengthLabel);
    refreshControls();
  }

  function ensureControls() {
    if (els.visibilityMaskControls || !els.partInspector) return;
    const section = document.createElement("details");
    section.id = "visibilityMaskControls";
    section.className = "inspector-section";
    section.open = true;
    section.append(summary(), body());
    const anchor = els.partTransformControls || els.supplementalPartEditor || els.deletePart?.closest?.(".inspector-section") || null;
    els.partInspector.insertBefore(section, anchor);
    els.visibilityMaskControls = section;
  }

  function summary() {
    const item = document.createElement("summary");
    const title = document.createElement("span");
    title.textContent = "Visibility mask";
    item.append(title);
    return item;
  }

  function body() {
    const bodyElement = document.createElement("div");
    bodyElement.className = "inspector-section-body";
    const strength = document.createElement("input");
    strength.id = "visibilityMaskStrength";
    strength.type = "range";
    strength.min = "0";
    strength.max = "1";
    strength.step = "0.05";
    strength.value = "1";
    els.visibilityMaskStrength = strength;
    bodyElement.append(
      buttonRow([["createVisibilityMask", "Create from polygon"], ["setVisibilityMaskKeyframe", "Set frame"]]),
      labelWith("Strength", strength),
      buttonRow([["removeVisibilityMask", "Remove mask"]]),
      statusLine()
    );
    return bodyElement;
  }

  function buttonRow(items) {
    const row = document.createElement("div");
    row.className = "button-row";
    for (const [id, label] of items) {
      const button = document.createElement("button");
      button.id = id;
      button.type = "button";
      button.textContent = label;
      row.append(button);
      els[id] = button;
    }
    return row;
  }

  function labelWith(text, input) {
    const label = document.createElement("label");
    const value = document.createElement("span");
    value.id = "visibilityMaskStrengthValue";
    value.textContent = "1.00";
    els.visibilityMaskStrengthValue = value;
    label.append(text, " ", value, input);
    return label;
  }

  function statusLine() {
    const status = document.createElement("p");
    status.id = "visibilityMaskStatus";
    status.className = "hint";
    status.textContent = "no visibility mask";
    els.visibilityMaskStatus = status;
    return status;
  }

  function wrapRefreshUi() {
    if (!Animotion.ui?.refreshUi || Animotion.ui.refreshUi.visibilityMaskWrapped) return;
    const original = Animotion.ui.refreshUi;
    function wrappedRefreshUi(...args) {
      const value = original.apply(this, args);
      refreshControls();
      return value;
    }
    wrappedRefreshUi.visibilityMaskWrapped = true;
    Animotion.ui.refreshUi = wrappedRefreshUi;
  }

  function refreshControls() {
    const part = Animotion.parts?.selectedPart?.();
    const shapeReady = readyShape();
    const mask = Animotion.partVisibilityMaskCommands?.selectedMask?.(part);
    setDisabled(els.createVisibilityMask, !part || !shapeReady || !canEditRig());
    setDisabled(els.setVisibilityMaskKeyframe, !part || !mask || !canEditRig());
    setDisabled(els.removeVisibilityMask, !part || !mask || !canEditRig());
    if (els.visibilityMaskStrength && mask) els.visibilityMaskStrength.value = String(Animotion.partVisibilityMaskCommands.selectedStrength().toFixed(2));
    refreshStrengthLabel();
    if (els.visibilityMaskStatus) els.visibilityMaskStatus.textContent = statusText(part, mask);
  }

  function statusText(part, mask) {
    if (!part) return "select a part";
    const count = Animotion.partVisibilityMasks?.normalizeList?.(part.visibilityMasks).length || 0;
    if (!mask) return "draw a polygon and create a visibility mask";
    return `masks: ${count} / frame ${Animotion.state.currentFrame} strength ${Animotion.partVisibilityMaskCommands.selectedStrength().toFixed(2)}`;
  }

  function refreshStrengthLabel() {
    if (els.visibilityMaskStrengthValue) els.visibilityMaskStrengthValue.textContent = strengthValue().toFixed(2);
  }

  function run(name, ...args) {
    const response = Animotion.partVisibilityMaskCommands?.[name]?.(...args);
    if (response?.ok) Animotion.ui?.refreshUi?.();
    else refreshControls();
  }

  function readyShape() {
    const shape = Animotion.state?.selection;
    return Boolean(shape && Animotion.geometry?.shapeIsReady?.(shape, Animotion.imageBounds(), Animotion.config.minShapeSize));
  }

  function strengthValue() {
    const value = Number(els.visibilityMaskStrength?.value);
    return Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 1;
  }

  function canEditRig() {
    return Animotion.panelEditor?.canEditRig?.() !== false;
  }

  function setDisabled(element, disabled) {
    if (element) element.disabled = disabled;
  }

  function bind(element, handler) {
    if (element) element.addEventListener("click", handler);
  }

  Animotion.partVisibilityMaskControls = { installControls, refreshControls };
  installControls();
}
