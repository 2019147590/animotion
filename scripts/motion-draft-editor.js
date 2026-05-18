{
  const global = typeof window !== "undefined" ? window : globalThis;
  const Animotion = global.Animotion || (global.Animotion = {});

  function installControls() {
    if (typeof document === "undefined") return;
    const timelineAnchor = document.querySelector("#keyframeStatus");
    const inspectorAnchor = document.querySelector("#partInspector");
    if (timelineAnchor && !document.querySelector("#motionDraftTimeline")) timelineAnchor.after(timelineMarkup());
    if (inspectorAnchor && !document.querySelector("#motionDraftInspector")) inspectorAnchor.after(inspectorMarkup());
    bindControls();
  }

  function refreshControls() {
    if (typeof document === "undefined") return;
    const context = activeDraftContext();
    renderTimeline(context);
    renderInspector(context);
  }
  function activeDraftContext() {
    const action = Animotion.state?.cutsceneBridge?.jointAction;
    if (action?.motionDraft) return { scope: "action-snapshot", draft: Animotion.motionDrafts.normalize(action.motionDraft) };
    const plan = Animotion.motionCommands?.currentMotionPlan?.() || Animotion.motionPlanner?.normalizePlan?.(Animotion.state?.motionPlan);
    if (plan?.motionDraft) return { scope: "plan", draft: Animotion.motionDrafts.normalize(plan.motionDraft) };
    return null;
  }
  function updateVisibilityImpactValue(value) {
    return updateActiveDraft((draft) => ({
      ...draft,
      visibility: updateLastKeyframe(draft.visibility, numberValue(value)),
    }));
  }
  function updateZOrderImpactValue(value) {
    return updateActiveDraft((draft) => ({
      ...draft,
      zOrder: updateLastKeyframe(draft.zOrder, String(value || "current")),
    }));
  }
  function updateHiddenCompletion(patch = {}) {
    return updateActiveDraft((draft) => ({
      ...draft,
      hiddenCompletion: {
        ...draft.hiddenCompletion,
        ...patch,
      },
    }));
  }
  function requestHiddenCompletion() {
    const assetId = currentAssetId();
    const requested = updateActiveDraft((draft) => Animotion.motionDrafts.requestHiddenCompletion(draft, {
      requestId: assetId,
      requestedAt: new Date().toISOString(),
    }));
    Animotion.hiddenCompletionClient?.generateActiveHiddenCompletion?.(assetId).then((result) => {
      if (result?.status === "queued") updateHiddenCompletion({ assetStatus: "queued" });
      else if (result && assetId) markHiddenCompletionReady(assetId);
    }).catch((error) => updateHiddenCompletion({ assetStatus: "queued", requestId: error.message }));
    return requested;
  }
  function markHiddenCompletionReady(assetId = currentAssetId()) {
    if (!assetId) return null;
    return updateActiveDraft((draft) => Animotion.motionDrafts.markHiddenCompletionReady(draft, assetId, {
      completedAt: new Date().toISOString(),
    }));
  }
  function removeHiddenCompletionAsset() {
    return updateActiveDraft((draft) => Animotion.motionDrafts.removeHiddenCompletionAsset(draft));
  }

  function draftRows(context = activeDraftContext()) {
    if (!context?.draft) return [];
    const draft = context.draft;
    return [
      ["scope", draft.draftScope],
      ["source", sourceLabel(draft)],
      ["visibility", keyframeLabel(draft.visibility)],
      ["z-order", keyframeLabel(draft.zOrder)],
      ["hidden", hiddenLabel(draft.hiddenCompletion)],
    ];
  }

  function updateActiveDraft(updater) {
    const context = activeDraftContext();
    if (!context?.draft) return null;
    const next = Animotion.motionDrafts.normalize(updater(context.draft), { assets: projectAssets() });
    if (context.scope === "action-snapshot") updateActionDraft(next);
    else Animotion.motionCommands.setMotionPlan({ motionDraft: next });
    refresh();
    return next;
  }

  function updateActionDraft(draft) {
    const action = Animotion.state.cutsceneBridge?.jointAction;
    if (!action) return;
    Animotion.motionCommands.updateJointAction({ ...action, motionDraft: { ...draft, draftScope: "action-snapshot" } });
  }
  function updateLastKeyframe(track, value) {
    if (!track?.keyframes?.length) return track;
    const keyframes = track.keyframes.map((keyframe, index) => (
      index === track.keyframes.length - 1 ? { ...keyframe, value } : { ...keyframe }
    ));
    return { ...track, keyframes };
  }
  function renderTimeline(context) {
    const box = document.querySelector("#motionDraftTimeline");
    if (!box) return;
    box.classList.toggle("hidden", !context);
    if (!context) return;
    setText("#motionDraftTimelineScope", context.draft.draftScope);
    document.querySelector("#motionDraftTimelineRows").replaceChildren(...draftRows(context).map(rowElement));
    setInputValue("#motionDraftVisibilityValue", lastValue(context.draft.visibility, 1));
    setInputValue("#motionDraftZOrderValue", lastValue(context.draft.zOrder, "current"));
  }
  function renderInspector(context) {
    const box = document.querySelector("#motionDraftInspector");
    if (!box) return;
    const visible = Boolean(context?.draft && selectedPartMatches(context.draft));
    box.classList.toggle("hidden", !visible);
    if (!visible) return;
    setText("#motionDraftInspectorStatus", sourceLabel(context.draft));
    setInputValue("#motionDraftHiddenStatus", context.draft.hiddenCompletion.status);
    setInputValue("#motionDraftAssetStatus", context.draft.hiddenCompletion.assetStatus);
    setInputValue("#motionDraftAssetId", context.draft.hiddenCompletion.assetId || "");
    setButtonState("#requestHiddenCompletion", context.draft.hiddenCompletion.assetStatus === "requested");
    setButtonState("#markHiddenCompletionReady", !currentAssetId());
    setButtonState("#removeHiddenCompletionAsset", context.draft.hiddenCompletion.assetStatus !== "ready");
  }
  function timelineMarkup() {
    const box = document.createElement("div");
    box.id = "motionDraftTimeline";
    box.className = "motion-draft-tools hidden";
    box.innerHTML = `
      <div class="motion-draft-header">
        <strong>2.5D draft</strong>
        <span id="motionDraftTimelineScope" class="layer-pill">plan</span>
      </div>
      <div id="motionDraftTimelineRows" class="motion-draft-rows"></div>
      <label>
        impact visibility
        <input id="motionDraftVisibilityValue" type="range" min="0" max="1" step="0.05" />
      </label>
      <label>
        impact depth
        <select id="motionDraftZOrderValue">
          <option value="current">current</option>
          <option value="front">front</option>
          <option value="behind">behind</option>
          <option value="intersect">intersect</option>
        </select>
      </label>
    `;
    return box;
  }
  function inspectorMarkup() {
    const box = document.createElement("div");
    box.id = "motionDraftInspector";
    box.className = "motion-draft-inspector hidden";
    box.innerHTML = `
      <h2>2.5D draft</h2>
      <p id="motionDraftInspectorStatus" class="hint"></p>
      <label>
        hidden completion
        <select id="motionDraftHiddenStatus">
          <option value="none">none</option>
          <option value="candidate">candidate</option>
          <option value="required">required</option>
        </select>
      </label>
      <label>
        asset status
        <select id="motionDraftAssetStatus">
          <option value="none">none</option>
          <option value="missing">missing</option>
          <option value="queued">queued</option>
          <option value="processing">processing</option>
          <option value="requested">requested</option>
          <option value="ready">ready</option>
          <option value="failed">failed</option>
        </select>
      </label>
      <label>
        asset id
        <input id="motionDraftAssetId" type="text" placeholder="asset id" />
      </label>
      <div class="button-row">
        <button id="requestHiddenCompletion" type="button">request/generate</button>
        <button id="markHiddenCompletionReady" type="button">mark ready / replace</button>
      </div>
      <button id="removeHiddenCompletionAsset" type="button">remove ready asset</button>
    `;
    return box;
  }
  function bindControls() {
    bindInput("#motionDraftVisibilityValue", (event) => updateVisibilityImpactValue(event.target.value));
    bindInput("#motionDraftZOrderValue", (event) => updateZOrderImpactValue(event.target.value));
    bindInput("#motionDraftHiddenStatus", (event) => updateHiddenCompletion({ status: event.target.value }));
    bindInput("#motionDraftAssetStatus", (event) => updateHiddenCompletion({ assetStatus: event.target.value }));
    bindInput("#motionDraftAssetId", (event) => setButtonState("#markHiddenCompletionReady", !event.target.value));
    bindClick("#requestHiddenCompletion", requestHiddenCompletion);
    bindClick("#markHiddenCompletionReady", () => markHiddenCompletionReady());
    bindClick("#removeHiddenCompletionAsset", removeHiddenCompletionAsset);
  }
  function bindInput(selector, handler) {
    const element = document.querySelector(selector);
    if (element && !element.dataset.motionDraftBound) {
      element.addEventListener("input", handler);
      element.dataset.motionDraftBound = "true";
    }
  }
  function bindClick(selector, handler) {
    const element = document.querySelector(selector);
    if (element && !element.dataset.motionDraftBound) {
      element.addEventListener("click", handler);
      element.dataset.motionDraftBound = "true";
    }
  }
  function selectedPartMatches(draft) {
    const selected = Animotion.parts?.selectedPart?.() || null;
    return !draft.partId || !selected || selected.id === draft.partId;
  }

  function rowElement([label, value]) {
    const row = document.createElement("div");
    row.className = "motion-draft-row";
    row.replaceChildren(textSpan(label), textStrong(value || "-"));
    return row;
  }
  function textSpan(value) {
    const span = document.createElement("span");
    span.textContent = value;
    return span;
  }
  function textStrong(value) {
    const strong = document.createElement("strong");
    strong.textContent = value;
    return strong;
  }
  function sourceLabel(draft) {
    return [draft.source, draft.sourceCorrespondenceId, draft.sourceTargetId].filter(Boolean).join(" · ");
  }

  function keyframeLabel(track) {
    if (!track?.keyframes?.length) return "none";
    return track.keyframes.map((keyframe) => `${keyframe.frame}:${keyframe.value}`).join(", ");
  }
  function hiddenLabel(hidden) {
    if (!hidden?.needed) return "none";
    return `${hidden.status} · ${hidden.assetStatus}${hidden.assetId ? ` · ${hidden.assetId}` : ""}`;
  }

  function lastValue(track, fallback) {
    return track?.keyframes?.[track.keyframes.length - 1]?.value ?? fallback;
  }

  function setText(selector, value) {
    const element = document.querySelector(selector);
    if (element) element.textContent = value;
  }
  function setInputValue(selector, value) {
    const element = document.querySelector(selector);
    if (element) element.value = String(value);
  }
  function setButtonState(selector, disabled) {
    const element = document.querySelector(selector);
    if (element) element.disabled = disabled;
  }
  function currentAssetId() {
    if (typeof document !== "undefined") return document.querySelector("#motionDraftAssetId")?.value || "";
    return activeDraftContext()?.draft?.hiddenCompletion?.assetId || "";
  }

  function numberValue(value) {
    const number = Number(value);
    return Number.isFinite(number) ? Math.min(1, Math.max(0, number)) : 1;
  }
  function refresh() {
    Animotion.ui?.refreshUi?.();
  }

  function projectAssets() {
    return Animotion.state?.project?.assets || null;
  }

  Animotion.motionDraftEditor = { installControls, refreshControls, activeDraftContext, updateVisibilityImpactValue, updateZOrderImpactValue, updateHiddenCompletion, requestHiddenCompletion, markHiddenCompletionReady, removeHiddenCompletionAsset, draftRows };
  installControls();

  if (typeof module !== "undefined") module.exports = Animotion.motionDraftEditor;
}
