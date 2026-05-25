{
  const global = typeof window !== "undefined" ? window : globalThis;
  const Animotion = global.Animotion || (global.Animotion = {});
  let wrapped = false;

  function installControls() {
    if (typeof document === "undefined") return;
    const panel = document.querySelector("#hiddenCompletionPartTools");
    if (!panel || document.querySelector("#hiddenCompletionActionSummary")) return;
    const root = document.createElement("div");
    root.id = "hiddenCompletionActionSummary";
    root.className = "hidden-completion-action-summary hidden";
    root.replaceChildren(summaryHeader(), summaryList());
    panel.append(root);
  }

  function renderControls() {
    installControls();
    const root = document.querySelector("#hiddenCompletionActionSummary");
    const list = document.querySelector("#hiddenCompletionActionSummaryList");
    const count = document.querySelector("#hiddenCompletionActionSummaryCount");
    if (!root || !list || !count) return;
    const rows = linkedRows();
    root.classList.toggle("hidden", rows.length === 0);
    count.textContent = `${rows.length}`;
    list.replaceChildren(...rows.map(rowElement));
  }

  function wrapPanelRefresh() {
    if (wrapped || !Animotion.hiddenCompletionPartPanel?.refreshControls) return;
    wrapped = true;
    const original = Animotion.hiddenCompletionPartPanel.refreshControls;
    Animotion.hiddenCompletionPartPanel.refreshControls = function refreshWithActionSummary(...args) {
      const result = original.apply(this, args);
      renderControls();
      return result;
    };
  }

  function linkedRows() {
    const action = Animotion.cutsceneActionSelectors?.getActiveJointAction?.(Animotion.state)?.action;
    const drafts = actionDrafts(action).filter((draft) => draft?.hiddenCompletion?.assetId);
    return drafts.map((draft) => rowFromDraft(draft)).filter(Boolean);
  }

  function actionDrafts(action) {
    const drafts = Animotion.motionDraftActionStore?.normalizeList?.(action?.hiddenCompletionDrafts, { assets: assets() }) || [];
    if (action?.motionDraft?.hiddenCompletion?.assetId) {
      return Animotion.motionDraftActionStore?.upsertDraft?.(drafts, action.motionDraft, { assets: assets() }) || drafts;
    }
    return drafts;
  }

  function rowFromDraft(draft) {
    const asset = Animotion.hiddenCompletionAssets?.findById?.(assets(), draft.hiddenCompletion.assetId) || null;
    const part = partFor(draft.partId || asset?.sourcePartId);
    return {
      partId: draft.partId || asset?.sourcePartId || "",
      partName: part?.name || draft.partId || asset?.sourcePartId || "unknown part",
      assetName: asset?.name || draft.hiddenCompletion.assetId,
      assetId: draft.hiddenCompletion.assetId,
      method: asset?.completionMethod || draft.hiddenCompletion.assetKind || "patch",
      status: draft.hiddenCompletion.assetStatus || "linked",
    };
  }

  function rowElement(row) {
    const item = document.createElement("div");
    item.className = "hidden-completion-action-item";
    item.replaceChildren(swatch(), title(row), meta(row));
    return item;
  }

  function summaryHeader() {
    const header = document.createElement("div");
    header.className = "hidden-completion-action-header";
    const label = document.createElement("strong");
    label.textContent = "현재 액션 보완 파츠";
    const count = document.createElement("span");
    count.id = "hiddenCompletionActionSummaryCount";
    count.className = "layer-pill";
    count.textContent = "0";
    header.replaceChildren(label, count);
    return header;
  }

  function summaryList() {
    const list = document.createElement("div");
    list.id = "hiddenCompletionActionSummaryList";
    list.className = "hidden-completion-action-list";
    return list;
  }

  function swatch() {
    const node = document.createElement("span");
    node.className = "hidden-completion-action-swatch";
    return node;
  }

  function title(row) {
    const node = document.createElement("strong");
    node.textContent = row.partName;
    return node;
  }

  function meta(row) {
    const node = document.createElement("span");
    node.textContent = `${row.assetName} · ${row.status} · ${row.method}`;
    node.title = row.assetId;
    return node;
  }

  function partFor(partId) {
    return Animotion.state?.parts?.find((part) => part.id === partId) || null;
  }

  function assets() {
    return Animotion.state?.project?.assets || [];
  }

  Animotion.hiddenCompletionActionSummary = { installControls, renderControls, linkedRows, wrapPanelRefresh };
  wrapPanelRefresh();
  renderControls();
  if (typeof module !== "undefined") module.exports = Animotion.hiddenCompletionActionSummary;
}
