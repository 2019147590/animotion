{
  const global = typeof window !== "undefined" ? window : globalThis;
  const Animotion = global.Animotion || (global.Animotion = {});
  const BEAT_LABELS = {
    guard: "Guard",
    ready: "Ready",
    start: "Start",
    windup: "Windup",
    drive: "Drive",
    extension: "Extension",
    extend: "Extend",
    impact: "Impact",
    hold: "Hold",
    recover: "Recover",
    compress: "Compress",
    chamber: "Chamber",
    weightshift: "Weight shift",
    leadfootstep: "Lead foot",
    rearfootfollow: "Rear foot",
    settle: "Settle",
  };

  function installControls() {
    if (typeof document === "undefined") return;
    const anchor = document.querySelector("#cutsceneMotionStatus");
    if (!anchor || document.querySelector("#actionFrameControls")) return;
    const panel = document.createElement("div");
    panel.id = "actionFrameControls";
    panel.className = "action-frame-tools hidden";
    panel.innerHTML = `<div class="action-frame-title">Action frames</div><div class="action-frame-list"></div>`;
    anchor.after(panel);
  }

  function refreshControls() {
    const panel = typeof document !== "undefined" ? document.querySelector("#actionFrameControls") : null;
    if (!panel) return;
    const frames = framesForBridge(Animotion.state?.cutsceneBridge);
    panel.classList.toggle("hidden", !frames.length);
    panel.querySelector(".action-frame-list").replaceChildren(...frames.map(frameButton));
  }

  function framesForBridge(bridge = Animotion.state?.cutsceneBridge) {
    const status = Animotion.cutsceneActionSelectors?.getCutsceneActionStatus?.(bridge) || {};
    const template = status.template;
    const action = status.action;
    if (!template || !action) return [];
    const editable = editableIds(template);
    if (!editable.length) return [];
    return uniqueFrames(actionBeats(action))
      .filter((beat) => editable.includes(normalizeBeatId(beat.id)) || hasPose(beat))
      .sort((a, b) => a.frame - b.frame);
  }

  function selectBeat(beatId, options = {}) {
    const frame = framesForBridge().find((candidate) => candidate.id === beatId);
    const template = currentTemplate();
    if (!frame || !template) return null;
    Animotion.state.actionFrameSelection = {
      selectedBeatId: frame.id,
      selectedFrameNumber: frame.frame,
      selectedLabel: frame.label,
      actionType: template,
    };
    if (options.setFrame !== false) setCurrentFrame(frame.frame);
    refresh();
    return Animotion.state.actionFrameSelection;
  }

  function clearSelection() {
    if (Animotion.state) Animotion.state.actionFrameSelection = null;
    refresh();
  }

  function isEditingActionFrame() {
    return Boolean(currentSelectedFrame());
  }

  function selectedFrameNumber() {
    return currentSelectedFrame()?.frame || null;
  }

  function trajectoryReadOnly() {
    return isEditingActionFrame();
  }

  function selectionStatus() {
    const selected = Animotion.state?.actionFrameSelection;
    const frame = currentSelectedFrame();
    if (!frame) return null;
    return {
      selectedBeatId: selected.selectedBeatId,
      selectedFrame: frame.frame,
      selectedLabel: frame.label,
      actionType: selected.actionType,
      writesToKeyframes: true,
      trajectoryReadOnly: true,
    };
  }

  function frameButton(frame) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `action-frame-button${isSelected(frame) ? " selected" : ""}`;
    button.textContent = `${frame.label} ${frame.frame}`;
    button.addEventListener("click", () => selectBeat(frame.id));
    return button;
  }

  function actionBeats(action = {}) {
    return Animotion.cutsceneActionSelectors?.timelineBeats?.(action) || (Array.isArray(action.beats) ? action.beats : []);
  }

  function uniqueFrames(beats = []) {
    const seen = new Set();
    return beats.map(frameForBeat).filter((frame) => {
      if (!frame || seen.has(frame.id)) return false;
      seen.add(frame.id);
      return true;
    });
  }

  function frameForBeat(beat = {}) {
    const frame = Math.round(Number(beat.at) || 0);
    if (!beat.id || frame < 1) return null;
    const normalizedId = normalizeBeatId(beat.id);
    return { id: beat.id, normalizedId, label: BEAT_LABELS[normalizedId] || beat.id, frame };
  }

  function editableIds(template) {
    const ids = Animotion.actionSpecs?.editableFrameIds?.(template);
    return Array.isArray(ids) && ids.length ? ids.map(normalizeBeatId) : legacyEditableIds(template);
  }

  function legacyEditableIds(template) {
    if (template !== "punch") return [];
    return ["guard", "start", "windup", "drive", "extension", "extend", "impact", "hold", "recover"];
  }

  function currentSelectedFrame() {
    const selected = Animotion.state?.actionFrameSelection;
    if (!selected || selected.actionType !== currentTemplate()) return null;
    return framesForBridge().find((frame) => frame.id === selected.selectedBeatId) || null;
  }

  function currentTemplate() {
    return Animotion.cutsceneActionSelectors?.getCutsceneActionStatus?.(Animotion.state?.cutsceneBridge)?.template || null;
  }

  function setCurrentFrame(frame) {
    if (Animotion.timelineControls?.setCurrentFrame) Animotion.timelineControls.setCurrentFrame(frame);
    else if (Animotion.state) Animotion.state.currentFrame = frame;
  }

  function normalizeBeatId(id) {
    return String(id || "").toLowerCase();
  }

  function hasPose(beat = {}) {
    return Boolean(beat.pose && Object.keys(beat.pose).length);
  }

  function isSelected(frame) {
    return Animotion.state?.actionFrameSelection?.selectedBeatId === frame.id;
  }

  function refresh() {
    Animotion.ui?.refreshUi?.();
  }

  Animotion.actionFrameEditor = { installControls, refreshControls, framesForBridge, selectBeat, clearSelection, isEditingActionFrame, selectedFrameNumber, trajectoryReadOnly, selectionStatus };
  installControls();
  if (typeof module !== "undefined") module.exports = Animotion.actionFrameEditor;
}
