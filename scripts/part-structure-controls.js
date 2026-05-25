{
  const global = typeof window !== "undefined" ? window : globalThis;
  const Animotion = global.Animotion || (global.Animotion = {});
  const { els } = Animotion.dom;

  function installControls() {
    ensureControls();
    wrapRefreshUi();
    bind(els.addPartToMergeSet, addSelected);
    bind(els.clearPartMergeSet, clearSet);
    bind(els.extractPartSelection, extractSelection);
    bind(els.mergePartSet, mergeSet);
    refreshControls();
  }

  function ensureControls() {
    if (els.partStructureControls || !els.partInspector) return;
    const section = structureSection();
    const anchor = els.partTransformControls || els.supplementalPartEditor || els.deletePart?.closest?.(".inspector-section") || null;
    els.partInspector.insertBefore(section, anchor);
    els.partStructureControls = section;
  }

  function structureSection() {
    const section = document.createElement("details");
    section.id = "partStructureControls";
    section.className = "inspector-section";
    section.open = true;
    const summary = document.createElement("summary");
    const title = document.createElement("span");
    title.textContent = "Part structure";
    summary.append(title);
    const body = document.createElement("div");
    body.className = "inspector-section-body";
    body.append(
      buttonRow([["addPartToMergeSet", "Add to merge"], ["clearPartMergeSet", "Clear set"]]),
      buttonRow([["extractPartSelection", "Extract polygon"], ["mergePartSet", "Merge polygon"]]),
      statusLine()
    );
    section.append(summary, body);
    return section;
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

  function statusLine() {
    const status = document.createElement("p");
    status.id = "partStructureStatus";
    status.className = "hint";
    status.textContent = "merge set: 0";
    els.partStructureStatus = status;
    return status;
  }

  function wrapRefreshUi() {
    if (!Animotion.ui?.refreshUi || Animotion.ui.refreshUi.partStructureWrapped) return;
    const original = Animotion.ui.refreshUi;
    function wrappedRefreshUi(...args) {
      const value = original.apply(this, args);
      refreshControls();
      return value;
    }
    wrappedRefreshUi.partStructureWrapped = true;
    Animotion.ui.refreshUi = wrappedRefreshUi;
  }

  function refreshControls() {
    const imageReady = Boolean(Animotion.state?.image);
    const partReady = Boolean(Animotion.parts?.selectedPart?.());
    const shapeReady = readyShape();
    const count = Animotion.partStructureCommands?.mergeSet?.().length || 0;
    setDisabled(els.addPartToMergeSet, !imageReady || !partReady || !canEditRig());
    setDisabled(els.clearPartMergeSet, count === 0 || !canEditRig());
    setDisabled(els.extractPartSelection, !imageReady || !partReady || !shapeReady || !canEditRig());
    setDisabled(els.mergePartSet, !imageReady || count < 2 || !shapeReady || !canEditRig());
    if (els.partStructureStatus) {
      const selected = partReady ? Animotion.parts.selectedPart().name : "none";
      els.partStructureStatus.textContent = `merge set: ${count} / selected: ${selected}`;
    }
  }

  function addSelected() {
    const response = Animotion.partStructureCommands?.addSelectedPartToMergeSet?.();
    finish(response);
  }

  function clearSet() {
    const response = Animotion.partStructureCommands?.clearMergeSet?.();
    finish(response);
  }

  function extractSelection() {
    const response = Animotion.partStructureCommands?.extractSelectionToPart?.();
    finish(response);
  }

  function mergeSet() {
    const response = Animotion.partStructureCommands?.mergeSelectionWithShape?.();
    finish(response);
  }

  function finish(response) {
    if (els.partStructureStatus && response?.message) els.partStructureStatus.textContent = response.message;
    if (response?.ok) Animotion.ui?.refreshUi?.();
    else refreshControls();
  }

  function readyShape() {
    const shape = Animotion.state?.selection;
    return Boolean(shape && Animotion.geometry?.shapeIsReady?.(shape, Animotion.imageBounds(), Animotion.config.minShapeSize));
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

  Animotion.partStructureControls = { installControls, refreshControls };
  installControls();
}
