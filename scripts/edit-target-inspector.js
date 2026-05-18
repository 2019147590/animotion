{
  const global = typeof window !== "undefined" ? window : globalThis;
  const Animotion = global.Animotion || (global.Animotion = {});
  const TARGETS = {
    pose: {
      kind: "pose",
      label: "Pose",
      title: "포즈 편집",
      color: "#e1462e",
      fallbackRole: "피벗 / 관절",
      instructions: ["미리보기에서 선택 파츠의 피벗 또는 관절을 드래그합니다.", "키프레임/컷신 모드에서 관절을 움직이면 현재 프레임 포즈로 기록됩니다."],
    },
    "motion-path": {
      kind: "motion-path",
      label: "Motion path",
      title: "모션 경로",
      color: "#0f7f79",
      fallbackRole: "이동 궤적 미리보기",
      instructions: ["컷신 모드에서 비트 핸들을 드래그해 프레임별 경로 샘플을 조정합니다.", "사각 조정점은 생성된 앵커이며 드래그하면 경로가 다시 계산됩니다."],
    },
    "hidden-guide": {
      kind: "hidden-guide",
      label: "Hidden guide",
      title: "보완 가이드",
      color: "#f1b83b",
      fallbackRole: "가이드 메시",
      instructions: ["보완 가이드의 노란 꼭짓점을 드래그해 숨은 부위의 메시 형태를 조정합니다.", "가이드는 생성 요청에 쓰이는 편집 데이터이며 일반 포즈 핸들이 아닙니다."],
    },
    none: {
      kind: "none",
      label: "No target",
      title: "편집 대상 없음",
      color: "#8a8170",
      fallbackRole: "대기",
      instructions: ["파츠를 선택하거나 컷신 경로, 보완 가이드를 활성화하면 조작법이 표시됩니다."],
    },
  };

  function installPanel() {
    if (typeof document === "undefined" || document.querySelector("#editTargetInspector")) return;
    const anchor = document.querySelector(".inspector .control-group");
    if (!anchor) return;
    anchor.after(panelMarkup());
  }

  function refreshControls() {
    if (typeof document === "undefined") return;
    installPanel();
    const ui = refs();
    if (!ui.box) return;
    const target = currentTarget();
    ui.box.dataset.targetKind = target.kind;
    ui.swatch.style.background = target.color;
    ui.kind.textContent = target.label;
    ui.title.textContent = target.title;
    ui.role.textContent = target.role;
    ui.detail.textContent = target.detail;
    ui.instructions.replaceChildren(...target.instructions.map(instructionItem));
  }

  function currentTarget(state = Animotion.state || {}, els = Animotion.dom?.els || {}) {
    if (state.previewDrag?.kind === "hidden-completion-guide") return hiddenGuideTarget("가이드 꼭짓점", "드래그 중");
    if (state.trajectoryDrag) return motionPathDragTarget(state.trajectoryDrag);
    if (state.hoveredEditPoint || state.selectedEditPoint) return pointTarget(state.hoveredEditPoint || state.selectedEditPoint);
    const plan = currentPlan(state);
    if (plan?.selectedBeatId) return motionPathTarget("선택 비트", `beat ${plan.selectedBeatId}`);
    const guide = activeGuideAsset(state);
    if (guide) return hiddenGuideTarget("보완 가이드 메시", guide.id);
    if (isCutscenePathActive(state, els)) return motionPathTarget("이동 궤적 미리보기", motionPathDetail(state));
    const part = selectedPart(state);
    if (part) return poseTarget(state, els, part);
    return target("none", TARGETS.none.fallbackRole, "선택된 파츠가 없습니다.");
  }

  function poseTarget(state, els, part) {
    const drag = state.previewDrag;
    const role = drag?.mode === "pose" ? "관절 포즈 핸들" : poseRoleLabel(drag?.role || els.pivotEditTarget?.value);
    return target("pose", role, `${part.name || part.id} · ${Animotion.partTypeLabels?.[part.type] || part.type || "part"}`);
  }

  function pointTarget(point) {
    if (point.kind === "trajectory") return motionPathTarget(point.role, point.label);
    if (point.kind === "hiddenGuide") return hiddenGuideTarget(point.role, point.label);
    return target("pose", point.role, point.label || "리깅 포인트");
  }

  function motionPathDragTarget(drag) {
    if (drag.anchorKey) return motionPathTarget("궤적 조정점", drag.anchorKey);
    return motionPathTarget("이동 궤적 미리보기", drag.beatIndex === undefined ? "비트 드래그" : `sample ${drag.beatIndex + 1}`);
  }

  function motionPathTarget(role, detail) {
    return target("motion-path", role, detail || "컷신 경로");
  }

  function hiddenGuideTarget(role, detail) {
    return target("hidden-guide", role, detail || "guideOnly patch");
  }

  function target(kind, role, detail) {
    const spec = TARGETS[kind] || TARGETS.none;
    return { ...spec, role: role || spec.fallbackRole, detail: detail || "" };
  }

  function poseRoleLabel(role) {
    if (role === "joint") return "관절점";
    if (role === "connection" || role === "parentConnection") return "연결점";
    if (role === "bodyRoot") return "몸 기준점";
    return "회전 중심";
  }

  function isCutscenePathActive(state, els) {
    return els.motionTemplate?.value === "cutscene" && Boolean(state.cutsceneBridge?.jointAction);
  }

  function motionPathDetail(state) {
    const action = state.cutsceneBridge?.jointAction;
    const samples = action?.trajectorySamples || action?.trajectoryPoints || [];
    return samples.length ? `${samples.length} samples` : "생성된 경로 없음";
  }

  function currentPlan(state) {
    return Animotion.motionCommands?.currentMotionPlan?.() || Animotion.motionPlanner?.normalizePlan?.(state.motionPlan) || state.motionPlan;
  }

  function activeGuideAsset(state) {
    const draft = Animotion.motionDraftEditor?.activeDraftContext?.()?.draft;
    const assetId = draft?.hiddenCompletion?.assetId;
    if (!assetId) return null;
    const asset = Animotion.hiddenCompletionAssets?.findById?.(state.project?.assets, assetId);
    return asset?.guide ? asset : null;
  }

  function selectedPart(state) {
    return Animotion.parts?.selectedPart?.() || state.parts?.find((part) => part.id === state.selectedPartId) || null;
  }

  function panelMarkup() {
    const box = document.createElement("section");
    box.id = "editTargetInspector";
    box.className = "control-group edit-target-panel";
    box.dataset.targetKind = "none";
    box.innerHTML = `
      <div class="edit-target-header">
        <span id="editTargetSwatch" class="edit-target-swatch"></span>
        <div>
          <h2 id="editTargetTitle">편집 대상 없음</h2>
          <span id="editTargetKind" class="edit-target-kind">No target</span>
        </div>
      </div>
      <div class="edit-target-meta">
        <span>역할</span>
        <strong id="editTargetRole">대기</strong>
        <span>상태</span>
        <strong id="editTargetDetail">선택된 파츠가 없습니다.</strong>
      </div>
      <ul id="editTargetInstructions" class="edit-target-instructions"></ul>
    `;
    return box;
  }

  function instructionItem(text) {
    const item = document.createElement("li");
    item.textContent = text;
    return item;
  }

  function refs() {
    return {
      box: document.querySelector("#editTargetInspector"),
      swatch: document.querySelector("#editTargetSwatch"),
      kind: document.querySelector("#editTargetKind"),
      title: document.querySelector("#editTargetTitle"),
      role: document.querySelector("#editTargetRole"),
      detail: document.querySelector("#editTargetDetail"),
      instructions: document.querySelector("#editTargetInstructions"),
    };
  }

  Animotion.editTargetInspector = { installPanel, refreshControls, currentTarget };
  installPanel();
  if (typeof module !== "undefined") module.exports = Animotion.editTargetInspector;
}
