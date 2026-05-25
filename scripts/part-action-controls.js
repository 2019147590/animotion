{
  const global = typeof window !== "undefined" ? window : globalThis;
  const Animotion = global.Animotion || (global.Animotion = {});
  const { els } = Animotion.dom;
  const DEFAULT_ROTATION_DEGREES = 90;
  const MIN_ROTATION_DEGREES = 0.5;
  const MAX_ROTATION_DEGREES = 360;

  function installControls() {
    ensureControls();
    bind(els.copyPart, () => runCommand("copySelectedPart"));
    bind(els.flipPartHorizontal, () => runCommand("flipSelectedPartHorizontal"));
    bind(els.rotatePartCounterClockwise, () => runCommand("rotateSelectedPartCounterClockwise", rotationDegrees()));
    bind(els.rotatePartClockwise, () => runCommand("rotateSelectedPartClockwise", rotationDegrees()));
    refreshControls();
  }

  function ensureControls() {
    if (els.partTransformControls || els.copyPart || !els.partInspector) return;
    const section = transformSection();
    const anchor = els.supplementalPartEditor || els.deletePart?.closest?.(".inspector-section") || null;
    els.partInspector.insertBefore(section, anchor);
    els.partTransformControls = section;
  }

  function transformSection() {
    const section = document.createElement("details");
    section.id = "partTransformControls";
    section.className = "inspector-section";
    section.open = true;
    const summary = document.createElement("summary");
    const title = document.createElement("span");
    title.textContent = "리깅 파츠 변형";
    summary.append(title);
    const body = document.createElement("div");
    body.className = "inspector-section-body";
    body.append(
      buttonRow([["copyPart", "복사"], ["flipPartHorizontal", "좌우 반전"]]),
      rotationInput(),
      buttonRow([["rotatePartCounterClockwise", "반시계 회전"], ["rotatePartClockwise", "시계 회전"]])
    );
    section.append(summary, body);
    return section;
  }

  function rotationInput() {
    const label = document.createElement("label");
    label.textContent = "회전 각도";
    const input = document.createElement("input");
    input.id = "rotatePartDegrees";
    input.type = "number";
    input.min = String(MIN_ROTATION_DEGREES);
    input.max = String(MAX_ROTATION_DEGREES);
    input.step = "0.5";
    input.value = String(DEFAULT_ROTATION_DEGREES);
    label.append(input);
    els.rotatePartDegrees = input;
    return label;
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

  function refreshControls() {
    const disabled = !canEditSelectedPart();
    if (els.rotatePartDegrees && !els.rotatePartDegrees.value) {
      els.rotatePartDegrees.value = String(DEFAULT_ROTATION_DEGREES);
    }
    for (const element of controlElements()) {
      if (element) element.disabled = disabled;
    }
  }

  function runCommand(commandName, ...args) {
    const result = Animotion.partCommands?.[commandName]?.(...args);
    if (result) Animotion.ui?.refreshUi?.();
  }

  function rotationDegrees() {
    const value = Number(els.rotatePartDegrees?.value);
    if (!Number.isFinite(value)) return DEFAULT_ROTATION_DEGREES;
    return Math.min(MAX_ROTATION_DEGREES, Math.max(MIN_ROTATION_DEGREES, Math.abs(value)));
  }

  function canEditSelectedPart() {
    return Boolean(Animotion.state?.image)
      && Boolean(Animotion.parts?.selectedPart?.())
      && Animotion.panelEditor?.canEditRig?.() !== false;
  }

  function controlElements() {
    return [
      els.copyPart,
      els.flipPartHorizontal,
      els.rotatePartDegrees,
      els.rotatePartCounterClockwise,
      els.rotatePartClockwise,
    ];
  }

  function bind(element, handler) {
    if (element) element.addEventListener("click", handler);
  }

  Animotion.partActionControls = { installControls, refreshControls };
  installControls();
}
