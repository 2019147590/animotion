{
  const global = typeof window !== "undefined" ? window : globalThis;
  const Animotion = global.Animotion || (global.Animotion = {});
  let wrapped = false;

  function installControls() {
    if (typeof document === "undefined") return;
    installPanelControls();
    installInspectorStatus();
  }

  function refreshControls() {
    installControls();
    renderPanelControls();
    renderInspectorStatus();
  }

  function installPanelControls() {
    const panel = document.querySelector("#hiddenCompletionPartTools");
    if (!panel || document.querySelector("#insertHiddenCompletionSupplementalPart")) return;
    const row = document.createElement("div");
    row.className = "hidden-completion-supplemental-tools";
    row.replaceChildren(insertButton(), insertAllButton(), statusNode("hiddenCompletionSupplementalPartStatus"));
    panel.append(row);
    bindInsert();
    bindInsertAll();
  }

  function installInspectorStatus() {
    const inspector = document.querySelector("#partInspector");
    if (!inspector || document.querySelector("#supplementalPartInspectorStatus")) return;
    inspector.prepend(statusNode("supplementalPartInspectorStatus"));
  }

  function renderPanelControls() {
    const button = document.querySelector("#insertHiddenCompletionSupplementalPart");
    const status = document.querySelector("#hiddenCompletionSupplementalPartStatus");
    if (!button || !status) return;
    const linked = Animotion.hiddenCompletionSupplementalPart?.activeLinkedSymmetryPatch?.(Animotion.state);
    const linkedAll = Animotion.hiddenCompletionSupplementalPart?.linkedSymmetryPatchesForAction?.(Animotion.state) || [];
    const missingCount = linkedAll.filter((item) => !existingPart(item.asset.id)).length;
    const duplicate = linked?.ok ? existingPart(linked.asset.id) : null;
    button.disabled = !linked?.ok;
    const allButton = document.querySelector("#insertAllHiddenCompletionSupplementalParts");
    if (allButton) allButton.disabled = missingCount === 0;
    status.textContent = linked?.ok
      ? duplicate ? `이미 보완 파츠가 있습니다: ${duplicate.name || duplicate.id} · 전체 미삽입 ${missingCount}개` : `연결된 보완 데이터를 보완 파츠로 만들 수 있습니다. 전체 미삽입 ${missingCount}개`
      : missingCount ? `현재 선택 파츠와 별개로 활성 액션의 보완 파츠 ${missingCount}개를 삽입할 수 있습니다.`
      : linked?.warning || "연결된 보완 데이터가 있으면 보완 파츠로 만들 수 있습니다.";
  }

  function renderInspectorStatus() {
    const node = document.querySelector("#supplementalPartInspectorStatus");
    if (!node) return;
    const part = Animotion.parts?.selectedPart?.() || null;
    const visible = part?.isSupplementalPart === true;
    node.classList.toggle("hidden", !visible);
    if (!visible) return;
    const coverage = Animotion.hiddenCompletionSupplementalPart?.coverageForPart?.(part) || part.supplementalCoverage || null;
    node.textContent = `보완 파츠 · symmetry에서 생성됨 · 데이터 ${part.sourcePatchAssetId || "-"} · 원본 ${part.sourcePartId || "-"} · 대칭 ${part.counterpartPartId || "-"}${coverageText(coverage)}`;
  }

  function coverageText(coverage) {
    if (!coverage) return "";
    const ratio = Math.round(Number(coverage.coverageRatio || 0) * 100);
    const warnings = coverage.warnings?.length ? ` · 경고 ${coverage.warnings.join(", ")}` : "";
    return ` · mask ${sizeText(coverage.maskBounds)} · rect ${sizeText(coverage.rectBounds)} · coverage ${ratio}%${warnings}`;
  }

  function sizeText(bounds = {}) {
    return `${Math.round(Number(bounds.w || 0))}x${Math.round(Number(bounds.h || 0))}`;
  }

  function insertSupplementalPart() {
    const result = Animotion.hiddenCompletionSupplementalPart?.insertForSelectedLinkedPatch?.(Animotion.state);
    if (result?.part) Animotion.state.selectedPartId = result.part.id;
    Animotion.ui?.refreshUi?.();
    refreshControls();
    return result;
  }

  function insertAllSupplementalParts() {
    const result = Animotion.hiddenCompletionSupplementalPart?.insertAllLinkedPatches?.(Animotion.state);
    Animotion.ui?.refreshUi?.();
    refreshControls();
    return result;
  }

  function wrapPanelRefresh() {
    if (wrapped || !Animotion.hiddenCompletionPartPanel?.refreshControls) return;
    wrapped = true;
    const original = Animotion.hiddenCompletionPartPanel.refreshControls;
    Animotion.hiddenCompletionPartPanel.refreshControls = function refreshWithSupplementalPart(...args) {
      const result = original.apply(this, args);
      refreshControls();
      return result;
    };
  }

  function insertButton() {
    const button = document.createElement("button");
    button.id = "insertHiddenCompletionSupplementalPart";
    button.type = "button";
    button.textContent = "보완 파츠 만들기";
    return button;
  }

  function insertAllButton() {
    const button = document.createElement("button");
    button.id = "insertAllHiddenCompletionSupplementalParts";
    button.type = "button";
    button.textContent = "연결된 보완 파츠 모두 삽입";
    return button;
  }

  function statusNode(id) {
    const node = document.createElement("p");
    node.id = id;
    node.className = "hint";
    return node;
  }

  function bindInsert() {
    const button = document.querySelector("#insertHiddenCompletionSupplementalPart");
    if (button && !button.dataset.supplementalPartBound) {
      button.addEventListener("click", insertSupplementalPart);
      button.dataset.supplementalPartBound = "true";
    }
  }

  function bindInsertAll() {
    const button = document.querySelector("#insertAllHiddenCompletionSupplementalParts");
    if (button && !button.dataset.supplementalPartBound) {
      button.addEventListener("click", insertAllSupplementalParts);
      button.dataset.supplementalPartBound = "true";
    }
  }

  function existingPart(assetId) {
    return Animotion.state?.parts?.find((part) => part.isSupplementalPart === true && part.sourcePatchAssetId === assetId) || null;
  }

  Animotion.hiddenCompletionSupplementalPartUi = { installControls, refreshControls, insertSupplementalPart, insertAllSupplementalParts, wrapPanelRefresh };
  wrapPanelRefresh();
  refreshControls();
  if (typeof module !== "undefined") module.exports = Animotion.hiddenCompletionSupplementalPartUi;
}
