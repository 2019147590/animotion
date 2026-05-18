{
  const global = window;
  const Animotion = global.Animotion;
  let pickMode = false;
  let targetPolicyMessage = "";

  function installControls() {
    if (typeof document === "undefined" || !Animotion.dom?.previewCanvas) return;
    const anchor = document.querySelector("#motionPlanStatus");
    if (!anchor || document.querySelector("#correspondenceTargetType")) return;
    const box = document.createElement("div");
    box.className = "correspondence-tools";
    box.innerHTML = controlsMarkup();
    anchor.after(box);
    bindControls();
    Animotion.dom.previewCanvas.addEventListener("pointerdown", onPreviewPointerDown, true);
  }

  function controlsMarkup() {
    return `
      <label>
        B컷 대응 파츠
        <select id="correspondenceTargetType">
          <option value="head">머리</option>
          <option value="chest">가슴</option>
          <option value="hip">골반</option>
          <option value="arm">팔</option>
          <option value="hand">손</option>
          <option value="leg">다리</option>
          <option value="foot">발</option>
          <option value="hair">머리카락</option>
          <option value="prop">소품</option>
        </select>
      </label>
      <div class="button-row">
        <button id="saveCorrespondence" type="button">대응 저장</button>
        <button id="pickImpactAnchor" type="button">B impact 찍기</button>
        <button id="useCorrespondenceTarget" type="button">motion 목표로 사용</button>
      </div>
      <label>
        가림 상태
        <select id="correspondenceOcclusion">
          <option value="unknown">미정</option>
          <option value="visible">보임</option>
          <option value="partial">일부 가림</option>
          <option value="hidden">숨김</option>
        </select>
      </label>
      <label>
        깊이 관계
        <select id="correspondenceDepth">
          <option value="unknown">미정</option>
          <option value="front">앞</option>
          <option value="behind">뒤</option>
          <option value="intersect">교차</option>
        </select>
      </label>
      <label>
        숨은 부위 보완
        <select id="correspondenceHiddenCompletion">
          <option value="none">필요 없음</option>
          <option value="candidate">후보 필요</option>
          <option value="required">필수</option>
        </select>
      </label>
      <p id="correspondenceStatus" class="hint">A/B 파츠 대응과 B컷 도착/가림 정보를 저장합니다.</p>
    `;
  }

  function bindControls() {
    refs().save.addEventListener("click", saveFromControls);
    refs().pick.addEventListener("click", togglePickMode);
    refs().useTarget.addEventListener("click", useAsMotionTarget);
  }

  function refreshControls() {
    const ui = refs();
    if (!ui.targetType) return;
    const part = selectedPart();
    const correspondence = Animotion.correspondenceCommands.selectedCorrespondence();
    ui.targetType.value = correspondence?.targetPartType || Animotion.correspondenceModel.defaultTargetType(part?.type);
    ui.occlusion.value = correspondence?.occlusion?.status || "unknown";
    ui.depth.value = correspondence?.occlusion?.depthOrder || "unknown";
    ui.hidden.value = correspondence?.occlusion?.hiddenCompletion || "none";
    ui.save.disabled = !part || !Animotion.state.nextImage;
    ui.pick.disabled = !part || !Animotion.state.nextImage;
    ui.useTarget.disabled = !compiledCorrespondenceDraft();
    ui.pick.classList.toggle("active", pickMode);
    ui.status.textContent = statusText(part, correspondence);
  }

  function saveFromControls(extra = {}) {
    if (!selectedPart()) return null;
    const ui = refs();
    const correspondence = Animotion.correspondenceCommands.upsertForSelectedPart({
      targetPartType: ui.targetType.value,
      ...extra,
      occlusion: {
        status: ui.occlusion.value,
        depthOrder: ui.depth.value,
        hiddenCompletion: ui.hidden.value,
      },
    });
    refresh();
    return correspondence;
  }

  function togglePickMode() {
    if (!selectedPart() || !Animotion.state.nextImage) return;
    pickMode = !pickMode;
    freezePlayback();
    refresh();
  }

  function useAsMotionTarget() {
    const draft = compiledCorrespondenceDraft();
    if (!draft) return;
    const policy = Animotion.motionTargetPolicy.correspondenceApplyPolicy(Animotion.motionCommands.currentMotionPlan(), draft);
    if (!policy.allowed) {
      targetPolicyMessage = policy.message;
      refresh();
      return;
    }
    Animotion.motionCommands.setMotionPlan({
      target: draft.target,
      anchors: draft.anchors,
      targetMode: false,
      motionHints: draft.motionHints,
      targetSource: {
        type: "correspondence",
        correspondenceId: draft.correspondenceId,
        targetPartType: draft.targetPartType,
        coordinateSpace: draft.targetCoordinateSpace,
      },
    });
    targetPolicyMessage = "대응 목표를 motion target으로 적용했습니다.";
    refresh();
  }

  function compiledCorrespondenceDraft() {
    const correspondence = Animotion.correspondenceCommands?.selectedCorrespondence?.();
    if (!correspondence?.impactAnchor || !Animotion.state.previewView) return null;
    return Animotion.correspondenceModel?.compileForPlanner?.(correspondence, Animotion.state.parts, {
      mapImpactPoint: (point) => Animotion.motionPanelMapper?.currentImpactToSourcePoint?.(point),
    });
  }

  function onPreviewPointerDown(event) {
    if (!pickMode || !selectedPart() || !Animotion.state.nextImage) return;
    const point = impactPoint(event);
    if (!point) return;
    saveFromControls({ impactAnchor: point });
    pickMode = false;
    event.preventDefault();
    event.stopImmediatePropagation();
    refresh();
  }

  function drawOverlay(ctx, view) {
    if (!editingLayerVisible()) return;
    const correspondence = Animotion.correspondenceCommands.selectedCorrespondence();
    if (!correspondence?.impactAnchor || !Animotion.state.nextImage) return;
    const screen = impactPointToScreen(correspondence.impactAnchor, view);
    if (!screen) return;
    ctx.save();
    ctx.lineWidth = 3;
    ctx.strokeStyle = "#151515";
    ctx.fillStyle = "#f1b83b";
    ctx.beginPath();
    ctx.arc(screen.x, screen.y, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(screen.x - 12, screen.y);
    ctx.lineTo(screen.x + 12, screen.y);
    ctx.moveTo(screen.x, screen.y - 12);
    ctx.lineTo(screen.x, screen.y + 12);
    ctx.stroke();
    ctx.restore();
  }

  function impactPoint(event) {
    const rect = Animotion.dom.previewCanvas.getBoundingClientRect();
    const point = Animotion.previewTransform.screenPointToImage(
      { x: event.clientX - rect.left, y: event.clientY - rect.top },
      Animotion.state.previewView,
      impactFrame(),
      impactTransform()
    );
    const bounds = Animotion.panelEditor?.imageBounds?.("impact");
    if (!point || !bounds) return null;
    return {
      x: Math.round(Animotion.geometry.clamp(point.x, 0, bounds.width)),
      y: Math.round(Animotion.geometry.clamp(point.y, 0, bounds.height)),
    };
  }

  function impactPointToScreen(point, view) {
    return Animotion.previewTransform.imagePointToScreen(point, view, impactFrame(), impactTransform());
  }

  function impactFrame() {
    const image = Animotion.state.nextImage;
    if (!image) return null;
    const crop = Animotion.panelEditor?.setupFor?.("impact")?.crop;
    const frame = crop || { x: 0, y: 0, w: image.naturalWidth, h: image.naturalHeight };
    return { ...frame, sourceWidth: image.naturalWidth, sourceHeight: image.naturalHeight };
  }

  function impactTransform() {
    const bridge = Animotion.cutsceneModel.normalizeBridge(Animotion.state.cutsceneBridge);
    return { x: bridge.impactX, y: bridge.impactY, scale: bridge.impactScale };
  }

  function statusText(part, correspondence) {
    if (!part) return "A컷 파츠를 선택하면 2.5D 대응 데이터를 만들 수 있습니다.";
    if (!Animotion.state.nextImage) return "B컷을 업로드하면 대응 anchor를 찍을 수 있습니다.";
    const point = correspondence?.impactAnchor ? ` · B ${correspondence.impactAnchor.x}, ${correspondence.impactAnchor.y}` : " · B anchor 없음";
    const policy = targetPolicyMessage ? ` · ${targetPolicyMessage}` : "";
    return `${part.name} -> ${correspondence?.targetPartType || Animotion.correspondenceModel.defaultTargetType(part.type)}${point}${policy}`;
  }

  function selectedPart() {
    return Animotion.parts?.selectedPart?.() || Animotion.state.parts.find((part) => part.id === Animotion.state.selectedPartId) || null;
  }

  function refs() {
    return {
      targetType: document.querySelector("#correspondenceTargetType"),
      save: document.querySelector("#saveCorrespondence"),
      pick: document.querySelector("#pickImpactAnchor"),
      useTarget: document.querySelector("#useCorrespondenceTarget"),
      occlusion: document.querySelector("#correspondenceOcclusion"),
      depth: document.querySelector("#correspondenceDepth"),
      hidden: document.querySelector("#correspondenceHiddenCompletion"),
      status: document.querySelector("#correspondenceStatus"),
    };
  }

  function editingLayerVisible() {
    const state = Animotion.state;
    return !state.running && !state.exporting;
  }

  function freezePlayback() {
    if (!Animotion.state.running) return;
    Animotion.state.pausedTime = (performance.now() - Animotion.state.startTime) / 1000;
    Animotion.state.running = false;
    Animotion.dom.els.playPause.textContent = "재생";
  }

  function refresh() {
    Animotion.ui?.refreshUi?.();
  }

  Animotion.correspondenceEditor = { refreshControls, drawOverlay, impactPoint, impactPointToScreen, compiledCorrespondenceDraft };
  installControls();
}
