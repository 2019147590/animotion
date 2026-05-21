{
  const global = typeof window !== "undefined" ? window : globalThis;
  const Animotion = global.Animotion || (global.Animotion = {});
  const TEMPLATES = { kick: { label: "킥", beats: [["ready", 0, 0, 0, 0], ["compress", 0.24, -0.16, 0.08, 0.2], ["chamber", 0.56, 0.1, -0.12, 0.48], ["extend", 0.82, 0.58, -0.04, 0.82], ["impact", 1, 0, 0, 1]] }, punch: { label: "펀치", beats: [["guard", 0, 0, 0, 0], ["windup", 0.25, -0.2, 0.04, 0.15], ["drive", 0.58, 0.24, -0.02, 0.58], ["extension", 0.84, 0.75, 0, 0.86], ["impact", 1, 0, 0, 1]] }, dash: { label: "돌진", beats: [["ready", 0, 0, 0, 0], ["lean", 0.28, -0.08, 0.04, 0.2], ["launch", 0.62, 0.45, -0.08, 0.58], ["snap", 0.86, 0.82, -0.02, 0.86], ["arrive", 1, 0, 0, 1]] } };
  function normalizePlan(plan = {}, options = {}) {
    const bounds = options.imageBounds || sourceBounds();
    const target = normalizeTarget(plan.target, plan.targetNormalized, bounds);
    const targetSource = normalizeTargetSource(plan.targetSource, target);
    const targetState = Animotion.motionTargetState?.normalizeTargetState?.({ ...plan, target, targetSource }, bounds) || {};
    return {
      template: templateFor(plan.template) ? plan.template : "kick",
      target,
      targetNormalized: target ? normalizedPoint(target, bounds) : null,
      anchors: Animotion.motionAnchors?.normalizeAnchors?.(plan.anchors, { imageBounds: bounds }) || [],
      targetMode: Boolean(plan.targetMode),
      selectedBeatId: plan.selectedBeatId ? String(plan.selectedBeatId) : null,
      targetSource,
      ...targetState,
      motionScope: Animotion.motionTargetDebug?.normalizeMotionScope?.(plan.motionScope, plan.template) || "body-follow",
      rootMotionTuning: Animotion.motionTargetDebug?.normalizeRootMotionTuning?.(plan.rootMotionTuning) || null,
      targetDebug: Animotion.motionTargetDebug?.normalizeTargetDebug?.(plan.targetDebug) || null,
      motionHints: Animotion.motionHints?.normalize?.(plan.motionHints) || null,
      motionDraft: Animotion.motionDrafts?.normalize?.(plan.motionDraft, { assets: options.assets }) || Animotion.motionDrafts?.compileFromHints?.(plan.motionHints) || null,
      ...(plan.demoMotionPresetId ? { demoMotionPresetId: String(plan.demoMotionPresetId) } : {}),
      ...(Array.isArray(plan.trajectoryPoints) ? { trajectoryPoints: clonePlain(plan.trajectoryPoints) } : {}),
      ...(plan.rootMotion && typeof plan.rootMotion === "object" ? { rootMotion: clonePlain(plan.rootMotion) } : {}),
    };
  }
  function normalizeTarget(target, normalized, bounds) {
    const restored = Animotion.coordinateSpaces?.pointFromNormalizedImagePoint?.(normalized, bounds);
    const source = restored || target;
    if (!source) return null;
    return { x: Math.round(Number(source.x) || 0), y: Math.round(Number(source.y) || 0) };
  }
  function normalizeTargetSource(source, target = null) {
    if (!source) return target ? { type: "manual" } : null;
    const type = ["correspondence", "manual", "generated", "planner-default"].includes(source.type) ? source.type : "manual";
    return { type, ...(source.correspondenceId ? { correspondenceId: String(source.correspondenceId) } : {}), ...(source.targetPartType ? { targetPartType: String(source.targetPartType) } : {}), ...(source.coordinateSpace ? { coordinateSpace: String(source.coordinateSpace) } : {}) };
  }
  function installControls() {
    if (typeof document === "undefined") return;
    const anchor = document.querySelector("#autoAnticipation");
    if (!anchor || document.querySelector("#motionPlanTemplate")) return;
    const box = document.createElement("div");
    box.className = "motion-planner-tools";
    box.innerHTML = `
      <label>
        컷신 동작 타입
        <select id="motionPlanTemplate">
          <option value="kick">킥</option>
          <option value="punch">펀치</option>
          <option value="dash">돌진</option>
        </select>
      </label>
      <div class="button-row">
        <button id="pickMotionTarget" type="button">움직임 목표 찍기</button>
        <button id="generateMotionPlan" type="button">비트/이동 궤적 생성</button>
      </div>
      <p id="motionPlanStatus" class="hint">선택 파츠와 움직임 목표로 중간 관절 좌표를 생성합니다.</p>
    `;
    anchor.after(box);
    refs().template.addEventListener("change", updateTemplate);
    refs().pickTarget.addEventListener("click", toggleTargetMode);
    refs().generate.addEventListener("click", () => Animotion.motionPlannerCommands?.generateFromSelection?.());
  }
  function refreshControls() {
    const ui = refs();
    if (!ui.template) return;
    const plan = currentPlan();
    const part = Animotion.parts?.selectedPart?.();
    ui.template.value = plan.template;
    ui.pickTarget.classList.toggle("active", plan.targetMode);
    ui.pickTarget.disabled = !Animotion.state.image || !part;
    ui.generate.disabled = !Animotion.state.image || !part;
    ui.status.textContent = Animotion.motionPlannerCommands?.statusMessage?.(plan, part) || statusText(plan, part);
  }
  function currentPlan() {
    return Animotion.motionCommands?.currentMotionPlan?.() || normalizePlan(Animotion.state.motionPlan);
  }
  function updateTemplate() {
    Animotion.motionPlannerCommands?.clearStatus?.();
    Animotion.motionCommands.setMotionPlan({ template: refs().template.value });
    refresh();
  }
  function toggleTargetMode() { setTargetMode(!currentPlan().targetMode); }
  function setTargetMode(active, options = {}) {
    if (active && !options.skipExclusive) Animotion.previewPointerArbitration?.activateExclusivePicker?.("motionPlanner");
    const plan = Animotion.motionCommands.setMotionPlan({ targetMode: Boolean(active) });
    if (!plan.targetMode) Animotion.previewPointerArbitration?.clearActivePicker?.("motionPlanner");
    const shouldPause = plan.targetMode && Animotion.state.running;
    if (shouldPause) Object.assign(Animotion.state, { pausedTime: (performance.now() - Animotion.state.startTime) / 1000, running: false });
    if (shouldPause) Animotion.dom.els.playPause.textContent = "재생";
    if (options.refresh !== false) refresh();
    return plan.targetMode;
  }
  function hitTarget(event) {
    const plan = currentPlan();
    if (!plan.targetMode || !Animotion.state.previewView || !Animotion.state.image) return null;
    const point = previewPoint(event);
    return point ? { label: "움직임 목표", point } : null;
  }
  function beginDragFromTarget(event, target) {
    const payload = target?.payload || target?.hit || target;
    const point = payload?.point || previewPoint(event);
    if (!point) return false;
    const bounds = Animotion.panelEditor?.imageBounds?.("source") || Animotion.imageBounds();
    Animotion.motionCommands.setMotionPlan(Animotion.motionTargetState?.manualTargetPatch?.({
      x: Math.round(Animotion.geometry.clamp(point.x, 0, bounds.width)),
      y: Math.round(Animotion.geometry.clamp(point.y, 0, bounds.height)),
      }) || { target: point, anchors: [], targetMode: false, targetSource: { type: "manual" } });
    refresh();
    return true;
  }
  function createPlan(parts, primaryId, bridge, options = {}) {
    const plan = normalizePlan(options);
    const base = Animotion.jointCoordinates.inferJointPose(parts);
    const primary = parts.find((part) => part.id === primaryId) || parts[0];
    const active = activeKeys(primary, parts);
    const direction = Animotion.cutsceneModel.inferEffectDirection(parts, primaryId);
    const rawTarget = Animotion.motionAnchors?.anchorPoint?.(plan.anchors, active.end) || activeTargetPoint(plan) || autoTarget(base[active.end], direction, primary);
    const target = Animotion.motionTargetDebug?.primaryLeadTarget?.(plan, base[active.end], rawTarget) || rawTarget;
    const activeMotionTarget = motionTargetForPlan(plan, target);
    const targetDebug = Animotion.motionTargetDebug?.analyzeTarget?.(plan, base, active, target) || {};
    targetDebug.activeMotionTarget = Animotion.motionTargetState?.activeMotionTargetDebug?.({ ...plan, activeMotionTarget }) || null;
    const scopedPlan = { ...plan, targetDebug };
    const anchors = Animotion.motionAnchors?.anchorsFromPlan?.(scopedPlan, parts, primary, base, active, direction, target) || [], actionTimeline = actionTimelineFor(plan.template, bridge);
    const beats = templateBeats(plan.template, bridge).map((spec) => poseBeat(spec, base, active, target, direction, anchors));
    const trajectorySamples = Animotion.motionTargetState?.trajectorySamples?.(beats, active.end) || [];
    Object.assign(targetDebug, Animotion.characterRootMotion?.debugForPlan?.(parts, primary, beats, base, plan, targetDebug) || {});
    return {
      target,
      motionScope: plan.motionScope,
      targetDebug,
      activeMotionTarget,
      trajectoryPoints: trajectorySamples, trajectorySamples,
      anchors,
      active,
      jointAction: { source: `motion-planner-${plan.template}-anchors-v1`, focusKey: active.end, actionTimeline, impactExaggeration: impactExaggerationFor(actionTimeline, parts, primary), anchors, beats, targetDebug, activeMotionTarget, trajectoryPoints: trajectorySamples, trajectorySamples, motionHints: plan.motionHints, motionDraft: Animotion.motionDrafts?.snapshot?.(plan.motionDraft) || plan.motionDraft },
      partTracks: tracksForParts(parts, primary, beats, base, active, { ...bridge, jointAction: { targetDebug } }),
    };
  }
  function activeKeys(primary, parts) {
    const side = Animotion.poseAssist?.actionSide?.(primary, parts) < 0 ? "l" : "r";
    if (partKind(primary) === "arm") return { root: `${side}Shoulder`, mid: `${side}Elbow`, end: `${side}Hand` };
    if (partKind(primary) === "leg") return { root: "hip", mid: `${side}Knee`, end: `${side}Foot` };
    if (isBodyPrimary(primary)) return { root: "hip", mid: "chest", end: "chest", motion: "translate" };
    return { root: "chest", mid: "head", end: "head" };
  }
  function templateBeats(template, bridge) {
    const normalized = Animotion.cutsceneModel.normalizeBridge(bridge);
    const action = actionTimelineFor(template, normalized);
    if (action) return action.beats.map((spec) => ({ id: spec.id, at: spec.at, recoil: spec.recoil, lift: spec.lift, reach: spec.reach }));
    const impact = normalized.impactFrame;
    return TEMPLATES[template].beats.map(([id, n, recoil, lift, reach]) => ({ id, at: Math.max(1, Math.round(1 + (impact - 1) * n)), recoil, lift, reach }));
  }
  function poseBeat(spec, base, active, target, direction, anchors) {
    const pose = shiftBody(base, { x: 0, y: 0 }, spec.recoil, direction);
    applyAnchorPose(pose, base, anchors, spec.reach, [active.end, active.mid]);
    const root = pointFromArray(pose[active.root] || pose.hip);
    const startEnd = pointFromArray(base[active.end] || base.head);
    const end = lerpPoint(startEnd, Animotion.motionAnchors?.anchorPoint?.(anchors, active.end) || target, spec.reach);
    end.x += direction.x * spec.recoil * 80;
    end.y += spec.lift * 40;
    if (active.motion === "translate") {
      pose[active.end] = rounded(end);
      return { id: spec.id, at: spec.at, pose };
    }
    const midTarget = Animotion.motionAnchors?.anchorPoint?.(anchors, active.mid);
    const mid = midTarget ? lerpPoint(pointFromArray(base[active.mid]), midTarget, spec.reach) : solveMid(root, end, base, active, spec.reach);
    pose[active.mid] = rounded(mid);
    pose[active.end] = rounded(end);
    return { id: spec.id, at: spec.at, pose };
  }
  function shiftBody(base, shift, recoil, direction) {
    const pose = { ...base };
    for (const key of ["hip", "chest", "head"]) {
      const point = pointFromArray(base[key]);
      pose[key] = rounded({ x: point.x + shift.x - direction.x * recoil * 22, y: point.y + shift.y });
    }
    return pose;
  }
  function applyAnchorPose(pose, base, anchors, reach, excludedKeys = []) {
    for (const anchor of anchors || []) {
      if (excludedKeys.includes(anchor.key) || !base[anchor.key]) continue;
      pose[anchor.key] = rounded(lerpPoint(pointFromArray(base[anchor.key]), anchor.point, reach));
    }
  }
  function solveMid(root, end, base, active, bendScale) {
    const baseRoot = pointFromArray(base[active.root] || base.hip);
    const baseMid = pointFromArray(base[active.mid] || base.head);
    const baseEnd = pointFromArray(base[active.end] || base.head);
    const a = distance(baseRoot, baseMid);
    const b = distance(baseMid, baseEnd);
    const c = Math.max(1, distance(root, end));
    const along = Math.max(0.05, Math.min(0.95, (a * a + c * c - b * b) / (2 * c * c)));
    const height = Math.sqrt(Math.max(0, a * a - (along * c) ** 2)) * Math.max(0.25, 1 - bendScale * 0.35);
    const normal = bendNormal(baseRoot, baseMid, baseEnd, root, end);
    return { x: root.x + (end.x - root.x) * along + normal.x * height, y: root.y + (end.y - root.y) * along + normal.y * height };
  }
  function tracksForParts(parts, primary, beats, base, active, bridge) {
    return parts.map((part) => ({ partId: part.id, keyframes: beats.map((beat) => trackKeyframe(part, primary, beat, base, active, bridge)) }));
  }
  function tracksForJointAction(parts, primaryId, action) {
    const base = Animotion.jointCoordinates.inferJointPose(parts);
    const primary = parts.find((part) => part.id === primaryId) || parts[0];
    const active = activeKeys(primary, parts);
    const bridge = action?.jointAction ? action : { jointAction: action, bodyAssistEnabled: true };
    return tracksForParts(parts, primary, bridge.jointAction?.beats || [], base, active, bridge);
  }
  function trackKeyframe(part, primary, beat, base, active, bridge) {
    const pose = Animotion.motionModel.defaultCustomMotion();
    const parentId = parentIdFor(part);
    if (part.id === primary.id) {
      if (active.motion === "translate") {
        pose.x = beat.pose[active.end][0] - base[active.end][0];
        pose.y = beat.pose[active.end][1] - base[active.end][1];
      } else {
        pose.jointX = beat.pose[active.end][0] - base[active.end][0];
        pose.jointY = beat.pose[active.end][1] - base[active.end][1];
      }
      return { frame: beat.at, pose };
    }
    if (!parentId && bridge.bodyAssistEnabled !== false && bridge?.jointAction?.targetDebug?.chosenMotionScope === "full-character") {
      Object.assign(pose, { x: beat.pose.hip[0] - base.hip[0], y: beat.pose.hip[1] - base.hip[1] });
      return { frame: beat.at, pose };
    }
    if (!parentId && bridge.bodyAssistEnabled !== false && !isBodyPrimary(primary) && isBodyPrimary(part)) {
      Object.assign(pose, { x: beat.pose.hip[0] - base.hip[0], y: beat.pose.hip[1] - base.hip[1] });
    }
    if (!parentId && bridge.bodyAssistEnabled !== false && !isBodyPrimary(primary) && partKind(part) === "head") {
      pose.x = (beat.pose.head[0] - base.head[0]) * 0.7;
      pose.y = (beat.pose.head[1] - base.head[1]) * 0.7;
    }
    return { frame: beat.at, pose };
  }
  function statusText(plan, part) {
    if (!part) return "파츠를 선택하면 움직임 목표 기반 궤적을 만들 수 있습니다.";
    const target = plan.target ? `움직임 목표 ${plan.target.x}, ${plan.target.y}` : "움직임 목표 없음";
    const debug = Animotion.motionTargetState?.activeMotionTargetDebug?.(plan);
    const source = debug?.source ? ` · 현재 움직임 목표 ${sourceLabel(debug.source)} · 위치 ${debug.point.x},${debug.point.y} · 좌표계 ${debug.coordinateSpace} · B컷 참조 ${debug.bReferenceUsedForMotion ? "사용" : "미사용"}` : "";
    const hints = Animotion.motionHints?.statusText?.(plan.motionHints);
    const selected = plan.selectedBeatId ? ` · beat ${plan.selectedBeatId}` : "";
    const scope = plan.targetDebug?.chosenMotionScope ? ` · ${plan.targetDebug.chosenMotionScope}` : "";
    const distance = Number.isFinite(plan.targetDebug?.computedDistance) ? ` · d ${Math.round(plan.targetDebug.computedDistance)}` : "";
    return `${templateFor(plan.template).label} · ${target}${source}${scope}${distance}${hints ? ` · ${hints}` : ""}${plan.anchors.length ? ` · anchors ${plan.anchors.length}` : ""}${selected}`;
  }
  function autoTarget(start, direction, primary) {
    const p = pointFromArray(start || [0, 0]);
    const distance = partKind(primary) === "leg" ? 170 : 120;
    return { x: Math.round(p.x + direction.x * distance), y: Math.round(p.y + direction.y * distance) };
  }
  function activeTargetPoint(plan) { return plan.activeMotionTarget?.point || plan.target || null; }
  function motionTargetForPlan(plan, point) { return plan.activeMotionTarget ? { ...plan.activeMotionTarget, point } : Animotion.motionTargetState?.generatedTarget?.(point) || null; }
  function sourceLabel(source) { return ({ manual: "수동", correspondence: "B컷 참조", generated: "자동 생성" })[source] || source; } function partKind(part = {}) { if (["thigh", "shin", "foot"].includes(part.humanRole) || part.type === "leg") return "leg"; if (["upperArm", "forearm", "hand"].includes(part.humanRole) || part.type === "arm") return "arm"; if (["torso", "pelvis"].includes(part.humanRole) || part.type === "body" || part.type === "spine") return "body"; if (part.humanRole === "head" || part.type === "head") return "head"; return part.type || null; } function isBodyPrimary(part) { return partKind(part) === "body"; }
  function templateFor(template) { return TEMPLATES[template] || (Animotion.actionTimelineModel?.hasTemplate?.(template) ? Animotion.actionTimelineModel.timelineForTemplate(template) : null); } function actionTimelineFor(template, bridge) { return Animotion.actionTimelineModel?.hasTemplate?.(template) ? Animotion.actionTimelineModel.timelineForTemplate(template, bridge) : null; }
  function impactExaggerationFor(actionTimeline, parts, primary) { return Animotion.impactExaggerationLayer?.createDefaultImpactExaggerationForActionTimeline?.(actionTimeline, { parts, primaryPartId: primary?.id }) || null; }
  function parentIdFor(part) { return Animotion.rigConnection?.parentIdFor?.(part) || null; }
  function bendNormal(baseRoot, baseMid, baseEnd, root, end) {
    const sign = Math.sign((baseMid.x - baseRoot.x) * (baseEnd.y - baseRoot.y) - (baseMid.y - baseRoot.y) * (baseEnd.x - baseRoot.x)) || 1;
    const dx = end.x - root.x;
    const dy = end.y - root.y;
    const length = Math.max(1, Math.hypot(dx, dy));
    return { x: -dy / length * sign, y: dx / length * sign };
  }
  function refs() {
    return { template: document.querySelector("#motionPlanTemplate"), pickTarget: document.querySelector("#pickMotionTarget"), generate: document.querySelector("#generateMotionPlan"), status: document.querySelector("#motionPlanStatus") };
  }
  function previewPoint(event) {
    const canvas = Animotion.dom.previewCanvas;
    const rect = canvas.getBoundingClientRect();
    const screen = { x: event.clientX - rect.left, y: event.clientY - rect.top };
    return Animotion.previewTransform?.screenPointToImage?.(
      screen,
      Animotion.state.previewView,
      Animotion.state.previewSourceFrame,
      Animotion.state.previewSourceTransform
    ) || screen;
  }
  function pointFromArray(point) { return { x: Number(point?.[0]) || 0, y: Number(point?.[1]) || 0 }; }
  function lerpPoint(a, b, ratio) {
    return { x: a.x + (b.x - a.x) * ratio, y: a.y + (b.y - a.y) * ratio };
  }
  function rounded(point) { return [Math.round(point.x), Math.round(point.y)]; }
  function distance(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }
  function normalizedPoint(point, bounds) { return Animotion.coordinateSpaces?.normalizedImagePointFromPoint?.(point, bounds) || null; }
  function clonePlain(value) { return JSON.parse(JSON.stringify(value)); }
  function sourceBounds() { return Animotion.state?.image ? { width: Animotion.state.image.naturalWidth, height: Animotion.state.image.naturalHeight } : typeof Animotion.imageBounds === "function" ? Animotion.imageBounds() : null; }
  function refresh() { Animotion.ui?.refreshUi?.(); }
  Animotion.motionPlanner = { normalizePlan, createPlan, installControls, refreshControls, tracksForJointAction, hitTarget, beginDragFromTarget, setTargetMode };
  installControls();
  if (typeof module !== "undefined") module.exports = Animotion.motionPlanner;
}
