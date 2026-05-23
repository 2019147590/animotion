{
  const global = typeof window !== "undefined" ? window : globalThis;
  const Animotion = global.Animotion || (global.Animotion = {});
  let symmetryWarning = "";

  function installControls() {
    if (typeof document === "undefined" || document.querySelector("#hiddenCompletionPartTools")) return;
    const anchor = document.querySelector("#editHidden")?.closest?.("label") || document.querySelector("#partInspector");
    if (!anchor) return;
    anchor.after(panelMarkup());
    bindControls();
  }

  function refreshControls() {
    if (typeof document === "undefined") return;
    installControls();
    const ui = refs();
    if (!ui.box) return;
    const state = panelState({ selectedAssetId: ui.patchSelect?.value || undefined });
    ui.box.classList.toggle("hidden", !state.part);
    ui.create.disabled = !state.canCreate;
    ui.createMesh.disabled = !state.canCreate;
    if (ui.symmetry) ui.symmetry.disabled = !state.canCreateSymmetry;
    if (ui.meshPreset && !ui.meshPreset.value) ui.meshPreset.value = "quad";
    renderPatchSelect(ui.patchSelect, state);
    const selectedState = panelState({ selectedAssetId: ui.patchSelect?.value || "" });
    ui.link.disabled = !selectedState.canLinkSelected;
    ui.unlink.disabled = !selectedState.canUnlink;
    ui.status.textContent = selectedState.status;
  }

  function createGuide() {
    ensureDraftForGuide();
    const state = panelState();
    if (!state.canCreate) return null;
    const asset = Animotion.hiddenCompletionGuideEditor?.createGuideFromSelectedPart?.() || null;
    refresh();
    return asset;
  }
  function createMeshGuide() {
    ensureDraftForGuide();
    const state = panelState();
    if (!state.canCreate) return null;
    const preset = refs().meshPreset?.value || "quad";
    const guide = meshGuideForPreset(state.part, preset);
    const asset = Animotion.hiddenCompletionGuideEditor.createGuideFromSelectedPart({
      guide,
      name: `${state.part.name || state.part.id} 2D mesh guide`,
      preview: { label: "2D mesh guide" },
    });
    refresh();
    return asset;
  }
  function createSymmetryDraft() {
    ensureDraftForGuide();
    const state = panelState();
    if (!state.canCreateSymmetry) return null;
    const result = Animotion.hiddenCompletionSymmetry.createPatchAsset(state.part, Animotion.state.parts, {
      id: uniqueAssetId(`hidden-${state.part.id}-symmetry`),
      activeAsset: state.asset,
    });
    if (!result.ok) return setSymmetryWarning(result.warning);
    upsertAsset(result.asset);
    Animotion.motionDraftEditor.updateHiddenCompletion({
      status: state.draft.hiddenCompletion?.status && state.draft.hiddenCompletion.status !== "none" ? state.draft.hiddenCompletion.status : "candidate",
      assetKind: "hiddenCompletionPatch",
      assetStatus: "ready",
      assetId: result.asset.id,
    });
    symmetryWarning = "";
    refresh();
    return result.asset;
  }
  function linkSelectedPatch() {
    const assetId = refs().patchSelect?.value || "";
    ensureDraftForGuide();
    const state = panelState({ selectedAssetId: assetId });
    if (!state.canLinkSelected) return null;
    const nextStatus = state.draft.hiddenCompletion.status === "none" ? "candidate" : state.draft.hiddenCompletion.status;
    const draft = Animotion.motionDraftEditor.updateHiddenCompletion({
      status: nextStatus,
      assetKind: "hiddenCompletionPatch",
      assetStatus: "ready",
      assetId,
    });
    refresh();
    return draft;
  }

  function unlinkPatch() {
    const state = panelState();
    if (!state.canUnlink) return null;
    const draft = Animotion.motionDraftEditor.removeHiddenCompletionAsset?.() || null;
    refresh();
    return draft;
  }

  function panelState(options = {}) {
    const part = selectedPart();
    const context = Animotion.motionDraftEditor?.activeDraftContext?.() || null;
    const draft = selectedDraft(context?.draft, part);
    const asset = activePatchAsset(draft, part);
    const patches = patchAssetsForPart(part);
    const selectedAssetId = options.selectedAssetId ?? asset?.id ?? "";
    return {
      part,
      draft,
      asset,
      patches,
      selectedAssetId,
      canCreate: Boolean(part && canUseOrCreateDraft(draft) && Animotion.hiddenCompletionGuideEditor?.createGuideFromSelectedPart),
      canCreateSymmetry: Boolean(part && canUseOrCreateDraft(draft) && Animotion.hiddenCompletionSymmetry?.createPatchAsset && Animotion.motionDraftEditor?.updateHiddenCompletion),
      canLinkSelected: Boolean(part && canUseOrCreateDraft(draft) && patches.some((patch) => patch.id === selectedAssetId)),
      canUnlink: Boolean(part && draft?.hiddenCompletion?.assetId),
      status: statusText(part, draft, asset),
    };
  }

  function selectedDraft(draft, part) {
    if (!draft || !part) return null;
    return !draft.partId || draft.partId === part.id ? draft : null;
  }

  function canUseOrCreateDraft(draft) {
    return Boolean(draft || canCreateCutsceneDraft());
  }

  function canCreateCutsceneDraft() {
    return Boolean(Animotion.cutsceneActionSelectors?.getActiveJointAction?.(Animotion.state)?.active && Animotion.motionDrafts?.compileFromHints && Animotion.motionCommands?.updateJointAction);
  }

  function ensureDraftForGuide() {
    const part = selectedPart();
    if (!part || panelState().draft || !canCreateCutsceneDraft()) return null;
    const draft = Animotion.motionDrafts.compileFromHints({
      source: "manual",
      hiddenCompletion: "candidate",
    }, { partId: part.id });
    if (!draft) return null;
    const action = Animotion.cutsceneActionSelectors?.getActiveJointAction?.(Animotion.state)?.action;
    if (!action) return null;
    Animotion.motionCommands.updateJointAction({ ...action, motionDraft: Animotion.motionDrafts.snapshot?.(draft) || draft });
    return draft;
  }

  function activePatchAsset(draft, part) {
    const assetId = draft?.hiddenCompletion?.assetId;
    const asset = Animotion.hiddenCompletionAssets?.findById?.(Animotion.state?.project?.assets, assetId) || null;
    return !asset?.sourcePartId || asset.sourcePartId === part?.id ? asset : null;
  }

  function patchAssetsForPart(part) {
    if (!part) return [];
    return (Animotion.state?.project?.assets || [])
      .filter((asset) => Animotion.hiddenCompletionAssets?.isPatchAsset?.(asset))
      .filter((asset) => asset.sourcePartId === part.id)
      .sort((a, b) => String(a.name || a.id).localeCompare(String(b.name || b.id)));
  }

  function selectedPart() {
    return Animotion.parts?.selectedPart?.() || Animotion.state?.parts?.find((part) => part.id === Animotion.state?.selectedPartId) || null;
  }

  function statusText(part, draft, asset) {
    if (!part) return "파츠를 선택하면 숨은 부위 보완을 시작할 수 있습니다.";
    if (!draft) return "먼저 이 파츠로 컷신 초안을 생성하면 보완 가이드를 만들 수 있습니다.";
    if (symmetryWarning) return symmetryWarning;
    if (!asset) return `${part.name || part.id} 기준 guide/mask 패치를 만들거나 기존 패치를 연결합니다.`;
    return `${asset.name || asset.id} 연결됨 · ${asset.renderMode || "guideOnly"}`;
  }

  function meshGuideForPreset(part, preset) {
    const base = Animotion.hiddenCompletionAssets.defaultGuideForPart(part);
    if (preset !== "centerFan") return base;
    return {
      ...base,
      meshVerticesNormalized: [
        point(0, 0),
        point(1, 0),
        point(1, 1),
        point(0, 1),
        point(0.5, 0.5),
      ],
      meshFaces: [[0, 1, 4], [1, 2, 4], [2, 3, 4], [3, 0, 4]],
    };
  }

  function point(xNorm, yNorm) {
    return { xNorm, yNorm, coordinateSpace: "part-local-normalized" };
  }

  function renderPatchSelect(select, state) {
    if (!select) return;
    select.replaceChildren(emptyOption(state.patches.length));
    for (const asset of state.patches) select.append(optionForAsset(asset));
    select.value = state.patches.some((asset) => asset.id === state.selectedAssetId) ? state.selectedAssetId : "";
    select.disabled = !state.part || !state.draft || !state.patches.length;
  }

  function panelMarkup() {
    const box = document.createElement("div");
    box.id = "hiddenCompletionPartTools";
    box.className = "hidden-completion-part-tools hidden";
    box.innerHTML = `
      <h2>가려진 부분 보완</h2>
      <button id="createHiddenCompletionGuideFromPart" type="button">선택 파츠로 보완 가이드 만들기</button>
      <label>
        2D 메시 형태
        <select id="hiddenCompletionMeshPreset">
          <option value="quad">사각 메시 4점</option>
          <option value="centerFan">중앙 분할 메시 5점</option>
        </select>
      </label>
      <button id="createHiddenCompletionMeshGuide" type="button">2D 메시 가이드 만들기</button>
      <button id="createHiddenCompletionSymmetryDraft" type="button">반대 파츠로 대칭 보완 초안 만들기</button>
      <label>
        기존 보완 패치
        <select id="hiddenCompletionPatchSelect"></select>
      </label>
      <div class="button-row">
        <button id="linkHiddenCompletionPatch" type="button">선택 패치 연결</button>
        <button id="unlinkHiddenCompletionPatch" type="button">연결 해제</button>
      </div>
      <p id="hiddenCompletionPartStatus" class="hint"></p>
    `;
    return box;
  }

  function bindControls() {
    bindClick("#createHiddenCompletionGuideFromPart", createGuide);
    bindClick("#createHiddenCompletionMeshGuide", createMeshGuide);
    bindClick("#createHiddenCompletionSymmetryDraft", createSymmetryDraft);
    bindClick("#linkHiddenCompletionPatch", linkSelectedPatch);
    bindClick("#unlinkHiddenCompletionPatch", unlinkPatch);
    bindChange("#hiddenCompletionPatchSelect", refreshControls);
  }

  function bindClick(selector, handler) {
    const button = document.querySelector(selector);
    if (button && !button.dataset.hiddenCompletionPartBound) {
      button.addEventListener("click", handler);
      button.dataset.hiddenCompletionPartBound = "true";
    }
  }

  function bindChange(selector, handler) {
    const select = document.querySelector(selector);
    if (select && !select.dataset.hiddenCompletionPartBound) {
      select.addEventListener("change", handler);
      select.dataset.hiddenCompletionPartBound = "true";
    }
  }

  function refs() {
    return {
      box: document.querySelector("#hiddenCompletionPartTools"), create: document.querySelector("#createHiddenCompletionGuideFromPart"),
      createMesh: document.querySelector("#createHiddenCompletionMeshGuide"), symmetry: document.querySelector("#createHiddenCompletionSymmetryDraft"),
      meshPreset: document.querySelector("#hiddenCompletionMeshPreset"), patchSelect: document.querySelector("#hiddenCompletionPatchSelect"),
      link: document.querySelector("#linkHiddenCompletionPatch"), unlink: document.querySelector("#unlinkHiddenCompletionPatch"), status: document.querySelector("#hiddenCompletionPartStatus"),
    };
  }

  function emptyOption(count) {
    const option = document.createElement("option");
    option.value = "";
    option.textContent = count ? "패치를 선택하세요" : "이 파츠의 보완 패치 없음";
    return option;
  }
  function optionForAsset(asset) {
    const option = document.createElement("option");
    option.value = asset.id; option.textContent = `${asset.name || asset.id} · ${asset.renderMode || "guideOnly"}`;
    return option;
  }

  function refresh() {
    Animotion.ui?.refreshUi?.();
  }

  function upsertAsset(asset) {
    const project = Animotion.state.project || (Animotion.state.project = Animotion.projectModel?.createEmptyProject?.() || { assets: [] });
    const assets = Array.isArray(project.assets) ? project.assets : [];
    const index = assets.findIndex((candidate) => candidate.id === asset.id);
    project.assets = index >= 0 ? assets.map((candidate, i) => i === index ? asset : candidate) : [...assets, asset];
  }
  function uniqueAssetId(base) {
    const ids = new Set((Animotion.state.project?.assets || []).map((asset) => asset.id));
    if (!ids.has(base)) return base;
    for (let index = 2; ; index += 1) if (!ids.has(`${base}-${index}`)) return `${base}-${index}`;
  }
  function setSymmetryWarning(message) {
    symmetryWarning = message || "symmetry patch could not be created";
    refresh();
    return null;
  }

  Animotion.hiddenCompletionPartPanel = { installControls, refreshControls, createGuide, createMeshGuide, createSymmetryDraft, linkSelectedPatch, unlinkPatch, panelState };
  installControls();
  if (typeof module !== "undefined") module.exports = Animotion.hiddenCompletionPartPanel;
}
