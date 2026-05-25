{
  const global = typeof window !== "undefined" ? window : globalThis;
  const Animotion = global.Animotion || (global.Animotion = {});
  let wrapped = false;

  function installControls() {
    if (typeof document === "undefined") return;
    const panel = document.querySelector("#hiddenCompletionPartTools");
    if (!panel || document.querySelector("#hiddenCompletionPatchTransformTools")) return;
    panel.append(markup());
    bindControls();
  }

  function refreshControls() {
    installControls();
    const ui = refs();
    if (!ui.box) return;
    const state = transformState();
    ui.box.classList.toggle("hidden", !state.asset);
    for (const input of ui.inputs) input.disabled = !state.asset;
    ui.reset.disabled = !state.asset;
    if (state.asset) setInputValues(ui, state.transform);
    ui.status.textContent = state.status;
  }

  function transformState() {
    const asset = activePatchAsset();
    if (!asset || asset.completionMethod !== "symmetry") return { asset: null, transform: defaultTransform(), status: "대칭 보완 데이터를 선택하면 이미지 위치를 조정할 수 있습니다." };
    return { asset, transform: readTransform(asset.patchTransform), status: statusText(asset) };
  }

  function updateTransform(patch = {}) {
    const asset = activePatchAsset();
    if (!asset || asset.completionMethod !== "symmetry") return null;
    const next = Animotion.hiddenCompletionAssets?.normalizeAsset?.({ ...asset, patchTransform: { ...readTransform(asset.patchTransform), ...patch } });
    if (!next) return null;
    replaceAsset(next);
    Animotion.hiddenCompletionSupplementalPart?.syncPartForPatch?.(next, Animotion.state, { regenerateCanvas: true });
    Animotion.ui?.refreshUi?.();
    return next;
  }

  function resetTransform() {
    return updateTransform(defaultTransform());
  }

  function activePatchAsset() {
    const part = selectedPart();
    const supplementalAssetId = part?.isSupplementalPart === true ? part.sourcePatchAssetId : null;
    if (supplementalAssetId) return findPatchAsset(supplementalAssetId);
    const draft = Animotion.motionDraftEditor?.activeDraftContext?.()?.draft || null;
    const assetId = draft?.partId && draft.partId !== part?.id ? null : draft?.hiddenCompletion?.assetId;
    return findPatchAsset(assetId);
  }

  function selectedPart() {
    return Animotion.parts?.selectedPart?.() || Animotion.state?.parts?.find((item) => item.id === Animotion.state?.selectedPartId) || null;
  }

  function findPatchAsset(assetId) {
    return Animotion.hiddenCompletionAssets?.findById?.(Animotion.state?.project?.assets, assetId) || null;
  }

  function readTransform(transform = {}) {
    const translation = transform.translationNormalized || transform.translation || transform;
    return {
      translationNormalized: {
        xNorm: signed(translation.xNorm ?? translation.x),
        yNorm: signed(translation.yNorm ?? translation.y),
        coordinateSpace: "part-local-normalized",
      },
      scaleX: scale(transform.scaleX),
      scaleY: scale(transform.scaleY),
      rotation: angle(transform.rotation),
    };
  }

  function setInputValues(ui, transform) {
    ui.x.value = transform.translationNormalized.xNorm;
    ui.y.value = transform.translationNormalized.yNorm;
    ui.scaleX.value = transform.scaleX;
    ui.scaleY.value = transform.scaleY;
    ui.rotation.value = transform.rotation;
  }

  function bindControls() {
    bindInput("#hiddenCompletionPatchOffsetX", () => updateTransform({ translationNormalized: translationPatch("xNorm", refs().x.value) }));
    bindInput("#hiddenCompletionPatchOffsetY", () => updateTransform({ translationNormalized: translationPatch("yNorm", refs().y.value) }));
    bindInput("#hiddenCompletionPatchScaleX", () => updateTransform({ scaleX: scale(refs().scaleX.value) }));
    bindInput("#hiddenCompletionPatchScaleY", () => updateTransform({ scaleY: scale(refs().scaleY.value) }));
    bindInput("#hiddenCompletionPatchRotation", () => updateTransform({ rotation: angle(refs().rotation.value) }));
    bindClick("#resetHiddenCompletionPatchTransform", resetTransform);
  }

  function translationPatch(axis, value) {
    const current = readTransform(activePatchAsset()?.patchTransform).translationNormalized;
    return { ...current, [axis]: signed(value) };
  }

  function replaceAsset(asset) {
    const project = Animotion.state.project || (Animotion.state.project = { assets: [] });
    const assets = Array.isArray(project.assets) ? project.assets : [];
    const index = assets.findIndex((item) => item.id === asset.id);
    project.assets = index >= 0 ? assets.map((item, i) => i === index ? asset : item) : [...assets, asset];
  }

  function markup() {
    const box = document.createElement("div");
    box.id = "hiddenCompletionPatchTransformTools";
    box.className = "hidden-completion-transform-tools hidden";
    box.innerHTML = `
      <h3>보완 이미지 조정</h3>
      <label>좌우 이동 <input id="hiddenCompletionPatchOffsetX" type="range" min="-1" max="1" step="0.01" /></label>
      <label>상하 이동 <input id="hiddenCompletionPatchOffsetY" type="range" min="-1" max="1" step="0.01" /></label>
      <div class="compact-grid">
        <label>가로 배율 <input id="hiddenCompletionPatchScaleX" type="number" min="0.2" max="3" step="0.01" /></label>
        <label>세로 배율 <input id="hiddenCompletionPatchScaleY" type="number" min="0.2" max="3" step="0.01" /></label>
      </div>
      <label>회전 <input id="hiddenCompletionPatchRotation" type="range" min="-45" max="45" step="0.5" /></label>
      <button id="resetHiddenCompletionPatchTransform" type="button">이미지 조정 초기화</button>
      <p id="hiddenCompletionPatchTransformStatus" class="hint"></p>
    `;
    return box;
  }

  function refs() {
    const x = document.querySelector("#hiddenCompletionPatchOffsetX"), y = document.querySelector("#hiddenCompletionPatchOffsetY");
    const scaleX = document.querySelector("#hiddenCompletionPatchScaleX"), scaleY = document.querySelector("#hiddenCompletionPatchScaleY");
    const rotation = document.querySelector("#hiddenCompletionPatchRotation");
    return {
      box: document.querySelector("#hiddenCompletionPatchTransformTools"), x, y, scaleX, scaleY, rotation,
      reset: document.querySelector("#resetHiddenCompletionPatchTransform"),
      status: document.querySelector("#hiddenCompletionPatchTransformStatus"),
      inputs: [x, y, scaleX, scaleY, rotation].filter(Boolean),
    };
  }

  function wrapPanelRefresh() {
    if (wrapped || !Animotion.hiddenCompletionPartPanel?.refreshControls) return;
    wrapped = true;
    const original = Animotion.hiddenCompletionPartPanel.refreshControls;
    Animotion.hiddenCompletionPartPanel.refreshControls = function refreshWithPatchTransform(...args) {
      const result = original.apply(this, args);
      refreshControls();
      return result;
    };
  }

  function statusText(asset) {
    const part = Animotion.state?.parts?.find((item) => item.sourcePatchAssetId === asset.id && item.isSupplementalPart);
    const path = part?.canvas?.__sourceSamplingPath || "preview transform";
    return `${asset.id} · ${path}`;
  }

  function bindInput(selector, handler) {
    const input = document.querySelector(selector);
    if (input && !input.dataset.patchTransformBound) {
      input.addEventListener("input", handler);
      input.dataset.patchTransformBound = "true";
    }
  }

  function bindClick(selector, handler) {
    const button = document.querySelector(selector);
    if (button && !button.dataset.patchTransformBound) {
      button.addEventListener("click", handler);
      button.dataset.patchTransformBound = "true";
    }
  }

  function defaultTransform() {
    return { translationNormalized: { xNorm: 0, yNorm: 0, coordinateSpace: "part-local-normalized" }, scaleX: 1, scaleY: 1, rotation: 0 };
  }

  function signed(value) {
    const number = Number(value);
    return Number.isFinite(number) ? Math.min(1, Math.max(-1, number)) : 0;
  }

  function scale(value) {
    const number = Number(value);
    return Number.isFinite(number) ? Math.min(3, Math.max(0.2, number)) : 1;
  }

  function angle(value) {
    const number = Number(value);
    return Number.isFinite(number) ? Math.min(180, Math.max(-180, number)) : 0;
  }

  Animotion.hiddenCompletionPatchTransformUi = { installControls, refreshControls, updateTransform, resetTransform };
  wrapPanelRefresh();
  refreshControls();
  if (typeof module !== "undefined") module.exports = Animotion.hiddenCompletionPatchTransformUi;
}
