{
  const global = typeof window !== "undefined" ? window : globalThis;
  const Animotion = global.Animotion || (global.Animotion = {});
  let pickMode = false;
  let selectedKey = null;

  function installControls() {
    if (typeof document === "undefined" || !Animotion.dom?.previewCanvas) return;
    const anchor = document.querySelector("#motionPlanStatus");
    if (!anchor || document.querySelector("#motionAnchorSelect")) return;
    const box = document.createElement("div");
    box.className = "motion-anchor-picker-tools";
    box.innerHTML = `
      <label>
        수정 앵커
        <select id="motionAnchorSelect"></select>
      </label>
      <button id="pickMotionAnchor" type="button">선택 앵커 찍기</button>
    `;
    anchor.after(box);
    refs().select.addEventListener("change", () => { selectedKey = refs().select.value || null; });
    refs().pick.addEventListener("click", togglePickMode);
  }

  function refreshControls() {
    const ui = refs();
    if (!ui.select || !ui.pick) return;
    const anchors = currentAnchors();
    if (!anchors.some((anchor) => anchor.key === selectedKey)) selectedKey = anchors[0]?.key || null;
    ui.select.replaceChildren(...anchors.map((anchor) => new Option(anchorLabel(anchor), anchor.key)));
    ui.select.value = selectedKey || "";
    ui.select.disabled = anchors.length === 0;
    ui.pick.disabled = anchors.length === 0 || !isCutsceneEditable();
    ui.pick.classList.toggle("active", pickMode);
  }

  function togglePickMode() {
    if (!selectedKey) return;
    setPickMode(!pickMode);
  }

  function setPickMode(active, options = {}) {
    if (active && !options.skipExclusive) {
      Animotion.previewPointerArbitration?.activateExclusivePicker?.("motionAnchorPicker");
    }
    pickMode = Boolean(active);
    if (!pickMode) Animotion.previewPointerArbitration?.clearActivePicker?.("motionAnchorPicker");
    if (pickMode) freezePlayback();
    if (options.refresh !== false) refresh();
    return pickMode;
  }

  function hitTarget(event) {
    if (!pickMode || !selectedKey || !isCutsceneEditable()) return null;
    const point = previewPoint(event);
    return point ? { label: "궤적 조정점", point, selectedKey } : null;
  }

  function beginDragFromTarget(event, target) {
    const payload = target?.payload || target?.hit || target;
    const point = payload?.point || previewPoint(event);
    const key = payload?.selectedKey || selectedKey;
    if (!point || !key) return false;
    setAnchorAndRegenerate(key, point);
    setPickMode(false);
    return true;
  }

  function setAnchorAndRegenerate(anchorKey, point) {
    const state = Animotion.state;
    const bridge = Animotion.cutsceneModel.normalizeBridge(state.cutsceneBridge);
    const primaryId = Animotion.motionPrimarySelection?.runtimePrimaryId?.(state.parts, bridge, state.selectedPartId) || bridge.primaryPartId || state.selectedPartId;
    const anchors = updateAnchorPoint(bridge.jointAction?.anchors, anchorKey, point);
    const primary = anchors.find((anchor) => anchor.key === bridge.jointAction?.focusKey && anchor.role === "primary");
    const plan = { ...currentPlan(), anchors, target: primary?.point || currentPlan().target };
    const result = Animotion.motionPlanner.createPlan(state.parts, primaryId, bridge, plan);
    Animotion.motionCommands.applyMotionPlanResult(bridge, plan, result);
    return result;
  }

  function updateAnchorPoint(anchors, anchorKey, point) {
    const next = Animotion.motionAnchors.normalizeAnchors(anchors);
    return next.map((anchor) => anchor.key === anchorKey ? {
      ...anchor,
      point: normalizePoint(point),
      pointNormalized: normalizedPoint(point),
      locked: true,
    } : anchor);
  }

  function currentAnchors() {
    const action = Animotion.cutsceneActionSelectors?.getActiveJointAction?.(Animotion.state)?.action;
    return Animotion.motionAnchors.normalizeAnchors(action?.anchors || currentPlan().anchors);
  }

  function currentPlan() {
    return Animotion.motionCommands?.currentMotionPlan?.() || Animotion.motionPlanner.normalizePlan(Animotion.state.motionPlan);
  }

  function previewPoint(event) {
    const rect = Animotion.dom.previewCanvas.getBoundingClientRect();
    const point = Animotion.previewTransform.screenPointToImage(
      { x: event.clientX - rect.left, y: event.clientY - rect.top },
      Animotion.state.previewView,
      Animotion.state.previewSourceFrame,
      Animotion.state.previewSourceTransform
    );
    const bounds = Animotion.panelEditor?.imageBounds?.("source") || Animotion.imageBounds();
    return point ? { x: Animotion.geometry.clamp(point.x, 0, bounds.width), y: Animotion.geometry.clamp(point.y, 0, bounds.height) } : null;
  }

  function anchorLabel(anchor) {
    return `${anchor.key} · ${anchor.role}`;
  }

  function normalizePoint(point) {
    return { x: Math.round(Number(point.x) || 0), y: Math.round(Number(point.y) || 0) };
  }

  function normalizedPoint(point) {
    return Animotion.coordinateSpaces?.normalizedImagePointFromPoint?.(point, sourceBounds()) || null;
  }

  function sourceBounds() {
    if (Animotion.state?.image) return { width: Animotion.state.image.naturalWidth, height: Animotion.state.image.naturalHeight };
    return typeof Animotion.imageBounds === "function" ? Animotion.imageBounds() : null;
  }

  function isCutsceneEditable() {
    return Animotion.dom?.els?.motionTemplate?.value === "cutscene" && Boolean(Animotion.cutsceneActionSelectors?.getActiveJointAction?.(Animotion.state)?.active);
  }

  function freezePlayback() {
    if (!Animotion.state?.running) return;
    Animotion.playbackSpeed?.pauseAtNow?.(Animotion.state);
    Animotion.state.running = false;
    Animotion.dom.els.playPause.textContent = "재생";
  }

  function refs() {
    return {
      select: document.querySelector("#motionAnchorSelect"),
      pick: document.querySelector("#pickMotionAnchor"),
    };
  }

  function refresh() {
    Animotion.ui?.refreshUi?.();
  }

  Animotion.motionAnchorPicker = { refreshControls, updateAnchorPoint, setAnchorAndRegenerate, hitTarget, beginDragFromTarget, setPickMode };
  installControls();

  if (typeof module !== "undefined") module.exports = Animotion.motionAnchorPicker;
}
