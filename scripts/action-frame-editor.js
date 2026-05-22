{
  const global = typeof window !== "undefined" ? window : globalThis;
  const Animotion = global.Animotion || (global.Animotion = {});
  const BEAT_LABELS = {
    guard: "가드",
    start: "시작",
    windup: "예비",
    drive: "전진",
    extension: "확장",
    extend: "확장",
    impact: "타격",
    hold: "유지",
    recover: "회수",
  };
  const PUNCH_BEAT_ORDER = ["guard", "start", "windup", "drive", "extension", "extend", "impact", "hold", "recover"];

  function installControls() {
    if (typeof document === "undefined") return;
    const anchor = document.querySelector("#cutsceneMotionStatus");
    if (!anchor || document.querySelector("#actionFrameControls")) return;
    const panel = document.createElement("div");
    panel.id = "actionFrameControls";
    panel.className = "action-frame-tools hidden";
    panel.innerHTML = `<div class="action-frame-title">Punch action frames</div><div class="action-frame-list"></div>`;
    anchor.after(panel);
  }

  function refreshControls() {
    const panel = typeof document !== "undefined" ? document.querySelector("#actionFrameControls") : null;
    if (!panel) return;
    const frames = framesForBridge(Animotion.state?.cutsceneBridge);
    panel.classList.toggle("hidden", !frames.length);
    const list = panel.querySelector(".action-frame-list");
    list.replaceChildren(...frames.map(frameButton));
  }

  function frameButton(frame) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `action-frame-button${isSelected(frame) ? " selected" : ""}`;
    button.textContent = `${frame.label} ${frame.frame}`;
    button.addEventListener("click", () => selectBeat(frame.id));
    return button;
  }

  function framesForBridge(bridge = Animotion.state?.cutsceneBridge) {
    const action = bridge?.jointAction;
    if (actionType(action) !== "punch") return [];
    return uniqueFrames(actionBeats(action))
      .filter((beat) => PUNCH_BEAT_ORDER.includes(normalizeBeatId(beat.id)) || hasPose(beat))
      .sort((a, b) => a.frame - b.frame);
  }

  function selectBeat(beatId, options = {}) {
    const frame = framesForBridge().find((candidate) => candidate.id === beatId);
    if (!frame) return null;
    Animotion.state.actionFrameSelection = {
      selectedBeatId: frame.id,
      selectedFrameNumber: frame.frame,
      selectedLabel: frame.label,
      actionType: "punch",
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
      writesToKeyframes: true,
      trajectoryReadOnly: true,
    };
  }

  function actionBeats(action = {}) {
    const beats = Array.isArray(action.beats) ? action.beats : [];
    const timeline = Array.isArray(action.actionTimeline?.beats) ? action.actionTimeline.beats : [];
    const byId = new Map(beats.map((beat) => [beat.id, beat]));
    const timelineFrames = timeline.map((beat) => ({ ...beat, ...(byId.get(beat.id) || {}) }));
    return timelineFrames.length ? timelineFrames : beats;
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
    const id = normalizeBeatId(beat.id);
    return { id: beat.id, normalizedId: id, label: BEAT_LABELS[id] || beat.id, frame };
  }

  function setCurrentFrame(frame) {
    if (Animotion.timelineControls?.setCurrentFrame) Animotion.timelineControls.setCurrentFrame(frame);
    else if (Animotion.state) Animotion.state.currentFrame = frame;
  }

  function actionType(action = {}) {
    const template = action?.actionTimeline?.template || action?.actionTimeline?.id;
    if (template === "punch") return "punch";
    return String(action?.source || "").includes("punch") ? "punch" : null;
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

  function currentSelectedFrame() {
    const selected = Animotion.state?.actionFrameSelection;
    if (selected?.actionType !== "punch") return null;
    return framesForBridge().find((frame) => frame.id === selected.selectedBeatId) || null;
  }

  function refresh() {
    Animotion.ui?.refreshUi?.();
  }

  Animotion.actionFrameEditor = { installControls, refreshControls, framesForBridge, selectBeat, clearSelection, isEditingActionFrame, selectedFrameNumber, trajectoryReadOnly, selectionStatus };
  installControls();
  if (typeof module !== "undefined") module.exports = Animotion.actionFrameEditor;
}
