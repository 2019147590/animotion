{
  const global = typeof window !== "undefined" ? window : globalThis;
  const Animotion = global.Animotion || (global.Animotion = {});

  const TEMPLATES = {
    kick: {
      label: "킥",
      beats: [
        ["ready", 0, 0, 0, 0],
        ["compress", 0.24, -0.16, 0.08, 0.2],
        ["chamber", 0.56, 0.1, -0.12, 0.48],
        ["extend", 0.82, 0.58, -0.04, 0.82],
        ["impact", 1, 0, 0, 1],
      ],
    },
    punch: {
      label: "펀치",
      beats: [
        ["guard", 0, 0, 0, 0],
        ["windup", 0.25, -0.2, 0.04, 0.15],
        ["drive", 0.58, 0.24, -0.02, 0.58],
        ["extension", 0.84, 0.75, 0, 0.86],
        ["impact", 1, 0, 0, 1],
      ],
    },
    dash: {
      label: "돌진",
      beats: [
        ["ready", 0, 0, 0, 0],
        ["lean", 0.28, -0.08, 0.04, 0.2],
        ["launch", 0.62, 0.45, -0.08, 0.58],
        ["snap", 0.86, 0.82, -0.02, 0.86],
        ["arrive", 1, 0, 0, 1],
      ],
    },
  };
  function normalizePlan(plan = {}) {
    return {
      template: TEMPLATES[plan.template] ? plan.template : "kick",
      target: normalizeTarget(plan.target),
      targetMode: Boolean(plan.targetMode),
    };
  }
  function normalizeTarget(target) {
    if (!target) return null;
    return { x: Math.round(Number(target.x) || 0), y: Math.round(Number(target.y) || 0) };
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
        <button id="pickMotionTarget" type="button">목표점 찍기</button>
        <button id="generateMotionPlan" type="button">beat/궤적 생성</button>
      </div>
      <p id="motionPlanStatus" class="hint">선택 파츠와 목표점으로 중간 관절 좌표를 생성합니다.</p>
    `;
    anchor.after(box);
    refs().template.addEventListener("change", updateTemplate);
    refs().pickTarget.addEventListener("click", toggleTargetMode);
    refs().generate.addEventListener("click", generateFromUi);
    Animotion.dom.previewCanvas.addEventListener("pointerdown", onPreviewPointerDown, true);
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
    ui.status.textContent = statusText(plan, part);
  }
  function currentPlan() {
    Animotion.state.motionPlan = normalizePlan(Animotion.state.motionPlan);
    return Animotion.state.motionPlan;
  }
  function updateTemplate() {
    const plan = currentPlan();
    plan.template = refs().template.value;
    refresh();
  }
  function toggleTargetMode() {
    const plan = currentPlan();
    plan.targetMode = !plan.targetMode;
    refresh();
  }
  function onPreviewPointerDown(event) {
    const plan = currentPlan();
    if (!plan.targetMode || !Animotion.state.previewView || !Animotion.state.image) return;
    const rect = Animotion.dom.previewCanvas.getBoundingClientRect();
    const view = Animotion.state.previewView;
    plan.target = {
      x: Math.round((event.clientX - rect.left - view.x) / view.scale),
      y: Math.round((event.clientY - rect.top - view.y) / view.scale),
    };
    plan.targetMode = false;
    event.preventDefault();
    event.stopImmediatePropagation();
    refresh();
  }
  function generateFromUi() {
    const part = Animotion.parts.selectedPart();
    if (!part) return;
    const previous = Animotion.cutsceneModel.normalizeBridge(Animotion.state.cutsceneBridge);
    const bridge = Animotion.cutsceneControls.preservePanelTransform(
      Animotion.cutsceneModel.createBridge(Animotion.state.parts, part.id),
      previous
    );
    const result = createPlan(Animotion.state.parts, part.id, bridge, currentPlan());
    bridge.jointAction = result.jointAction;
    Animotion.state.cutsceneBridge = bridge;
    applyPartTracks(result);
    Animotion.dom.els.motionTemplate.value = "cutscene";
    Animotion.timelineControls.setCurrentFrame(bridge.impactFrame);
  }
  function createPlan(parts, primaryId, bridge, options = {}) {
    const plan = normalizePlan(options);
    const base = Animotion.jointCoordinates.inferJointPose(parts);
    const primary = parts.find((part) => part.id === primaryId) || parts[0];
    const active = activeKeys(primary, parts);
    const direction = Animotion.cutsceneModel.inferEffectDirection(parts, primaryId);
    const target = plan.target || autoTarget(base[active.end], direction, primary);
    const beats = templateBeats(plan.template, bridge).map((spec) => poseBeat(spec, base, active, target, direction));
    return {
      target,
      active,
      jointAction: { source: `motion-planner-${plan.template}-v1`, focusKey: active.end, beats },
      partTracks: tracksForParts(parts, primary, beats, base, active),
    };
  }
  function activeKeys(primary, parts) {
    const side = Animotion.poseAssist?.actionSide?.(primary, parts) < 0 ? "l" : "r";
    if (primary?.type === "arm") return { root: `${side}Shoulder`, mid: `${side}Elbow`, end: `${side}Hand` };
    if (primary?.type === "leg") return { root: "hip", mid: `${side}Knee`, end: `${side}Foot` };
    return { root: "chest", mid: "head", end: "head" };
  }
  function templateBeats(template, bridge) {
    const impact = Animotion.cutsceneModel.normalizeBridge(bridge).impactFrame;
    return TEMPLATES[template].beats.map(([id, n, recoil, lift, reach]) => ({
      id,
      at: Math.max(1, Math.round(1 + (impact - 1) * n)),
      recoil,
      lift,
      reach,
    }));
  }
  function poseBeat(spec, base, active, target, direction) {
    const rootShift = { x: direction.x * spec.reach * 18, y: direction.y * spec.reach * 16 + spec.lift * 80 };
    const pose = shiftBody(base, rootShift, spec.recoil, direction);
    const root = pointFromArray(pose[active.root] || pose.hip);
    const startEnd = pointFromArray(base[active.end] || base.head);
    const end = lerpPoint(startEnd, target, spec.reach);
    end.x += direction.x * spec.recoil * 80;
    end.y += spec.lift * 40;
    const mid = solveMid(root, end, base, active, spec.reach);
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

  function tracksForParts(parts, primary, beats, base, active) {
    return parts.map((part) => ({ partId: part.id, keyframes: beats.map((beat) => trackKeyframe(part, primary, beat, base, active)) }));
  }

  function trackKeyframe(part, primary, beat, base, active) {
    const pose = Animotion.motionModel.defaultCustomMotion();
    if (part.id === primary.id) {
      pose.jointX = beat.pose[active.end][0] - base[active.end][0];
      pose.jointY = beat.pose[active.end][1] - base[active.end][1];
    }
    if (part.type === "body" || part.type === "spine") {
      pose.x = beat.pose.hip[0] - base.hip[0];
      pose.y = beat.pose.hip[1] - base.hip[1];
    }
    if (part.type === "head") {
      pose.x = (beat.pose.head[0] - base.head[0]) * 0.7;
      pose.y = (beat.pose.head[1] - base.head[1]) * 0.7;
    }
    return { frame: beat.at, pose };
  }

  function applyPartTracks(result) {
    for (const track of result.partTracks) {
      const part = Animotion.state.parts.find((candidate) => candidate.id === track.partId);
      if (part) part.keyframes = track.keyframes;
    }
  }

  function drawOverlay(ctx, view, cutscene) {
    const action = cutscene.bridge?.jointAction;
    const key = action?.focusKey || "hip";
    const points = (action?.beats || []).map((beat) => beat.pose[key]).filter(Boolean);
    if (points.length < 2) return;
    Animotion.cutsceneEffects.drawTrajectory(ctx, points, view, cutscene.values.n, { x: cutscene.values.sourceX, y: cutscene.values.sourceY });
    drawTarget(ctx, view);
  }

  function drawTarget(ctx, view) {
    const target = currentPlan().target;
    if (!target) return;
    ctx.save();
    ctx.strokeStyle = "#e1462e";
    ctx.fillStyle = "#fffaf0";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(view.x + target.x * view.scale, view.y + target.y * view.scale, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  function statusText(plan, part) {
    if (!part) return "파츠를 선택하면 목표점 기반 궤적을 만들 수 있습니다.";
    const target = plan.target ? `목표 ${plan.target.x}, ${plan.target.y}` : "목표점 없음";
    return `${TEMPLATES[plan.template].label} · ${target}`;
  }

  function autoTarget(start, direction, primary) {
    const p = pointFromArray(start || [0, 0]);
    const distance = primary?.type === "leg" ? 170 : 120;
    return { x: Math.round(p.x + direction.x * distance), y: Math.round(p.y + direction.y * distance) };
  }

  function bendNormal(baseRoot, baseMid, baseEnd, root, end) {
    const sign = Math.sign((baseMid.x - baseRoot.x) * (baseEnd.y - baseRoot.y) - (baseMid.y - baseRoot.y) * (baseEnd.x - baseRoot.x)) || 1;
    const dx = end.x - root.x;
    const dy = end.y - root.y;
    const length = Math.max(1, Math.hypot(dx, dy));
    return { x: -dy / length * sign, y: dx / length * sign };
  }

  function refs() {
    return {
      template: document.querySelector("#motionPlanTemplate"),
      pickTarget: document.querySelector("#pickMotionTarget"),
      generate: document.querySelector("#generateMotionPlan"),
      status: document.querySelector("#motionPlanStatus"),
    };
  }

  function pointFromArray(point) {
    return { x: Number(point?.[0]) || 0, y: Number(point?.[1]) || 0 };
  }

  function lerpPoint(a, b, ratio) {
    return { x: a.x + (b.x - a.x) * ratio, y: a.y + (b.y - a.y) * ratio };
  }

  function rounded(point) {
    return [Math.round(point.x), Math.round(point.y)];
  }

  function distance(a, b) {
    return Math.hypot(a.x - b.x, a.y - b.y);
  }

  function refresh() {
    Animotion.ui?.refreshUi?.();
  }

  Animotion.motionPlanner = { normalizePlan, createPlan, installControls, refreshControls, drawOverlay };
  installControls();

  if (typeof module !== "undefined") module.exports = Animotion.motionPlanner;
}
