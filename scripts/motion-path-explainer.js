{
  const global = typeof window !== "undefined" ? window : globalThis;
  const Animotion = global.Animotion || (global.Animotion = {});
  const BEAT_LABELS = { guard: "가드", windup: "당김", drive: "전진", extension: "뻗음", impact: "타격", recover: "복귀", ready: "준비", compress: "압축", chamber: "접기", extend: "뻗음" };

  function installControls() {
    if (typeof document === "undefined" || document.querySelector("#motionPathExplainer")) return;
    const anchor = document.querySelector("#motionPlanStatus");
    if (!anchor) return;
    const box = document.createElement("div");
    box.id = "motionPathExplainer";
    box.className = "motion-path-explainer hidden";
    anchor.after(box);
  }

  function refreshControls() {
    const box = typeof document !== "undefined" ? document.querySelector("#motionPathExplainer") : null;
    if (!box) return;
    const info = explain(Animotion.state?.cutsceneBridge, { parts: Animotion.state?.parts || [], plan: Animotion.state?.motionPlan || {}, frame: Animotion.state?.currentFrame || 1 });
    box.classList.toggle("hidden", !info.active);
    if (info.active) box.innerHTML = html(info);
  }

  function explain(bridge = {}, options = {}) {
    const safe = Animotion.cutsceneModel?.normalizeBridge?.(bridge) || bridge || {};
    const status = Animotion.cutsceneActionSelectors?.getCutsceneActionStatus?.(safe, options) || {};
    const action = status.action;
    if (!action) return { active: false, reason: status.reason || "no-cutscene-action" };
    const type = status.template;
    if (!["punch", "kick"].includes(type)) return { active: false };
    const parts = options.parts || [];
    const primary = parts.find((part) => part.id === (safe.primaryPartId || action.targetDebug?.primaryPartId)) || null;
    const style = styleInfo(safe, parts, primary);
    const focusKey = action.focusKey || primaryKeyFor(type);
    const impact = beat(action, type === "punch" ? "impact" : "impact") || lastBeat(action);
    const target = pointFrom(impact?.pose?.[focusKey]);
    const base = Animotion.jointCoordinates?.inferJointPose?.(parts) || {};
    const start = pointFrom(base[focusKey]);
    return {
      active: true,
      type,
      primaryName: primary?.name || primary?.id || "none",
      endpoint: endpointLabel(primary, parts, focusKey),
      style: style.punchStyle || (type === "kick" ? "kick" : "unknown"),
      styleSource: style.source,
      target,
      delta: target && start ? { x: Math.round(target.x - start.x), y: Math.round(target.y - start.y) } : null,
      scope: action.targetDebug?.chosenMotionScope || options.plan?.motionScope || "body-follow",
      beats: (action.beats || []).map((entry) => `${labelForBeat(entry.id)}@${entry.at}`),
      anchors: anchorSummary(action.anchors),
      rearArmOnly: style.punchStyle === "rear-cross" && primary && isArmOnly(primary, parts),
      legacy: style.source === "inferredLegacy",
    };
  }

  function drawOverlay(ctx, view, cutscene) {
    const action = Animotion.cutsceneActionSelectors?.getActiveJointAction?.(cutscene?.bridge)?.action;
    if (!action?.beats?.length || Animotion.state?.running || Animotion.state?.exporting) return;
    const focusKey = action.focusKey;
    drawBeatLabels(ctx, view, action, focusKey);
    drawRearPunchControls(ctx, view, cutscene.bridge);
  }

  function drawBeatLabels(ctx, view, action, focusKey) {
    if (!focusKey) return;
    ctx.save();
    ctx.font = "700 11px Aptos, sans-serif";
    ctx.textBaseline = "middle";
    for (const beatItem of action.beats || []) {
      const point = pointFrom(beatItem.pose?.[focusKey]);
      if (!point) continue;
      const screen = imagePointToScreen(point, view);
      label(ctx, screen.x + 10, screen.y - 10, labelForBeat(beatItem.id), "#fffdf5");
    }
    ctx.restore();
  }

  function drawRearPunchControls(ctx, view, bridge) {
    const parts = Animotion.state?.parts || [], primary = parts.find((part) => part.id === bridge?.primaryPartId);
    const info = styleInfo(bridge, parts, primary);
    if (info.punchStyle !== "rear-cross" || !primary || !isArmOnly(primary, parts)) return;
    const base = Animotion.jointCoordinates?.inferJointPose?.(parts) || {};
    const side = String(Animotion.cutsceneActionSelectors?.getActiveJointAction?.(bridge)?.action?.focusKey || "").startsWith("l") ? "l" : "r";
    const points = [
      [base[`${side}Shoulder`], "어깨 기준", "#0f7f79"],
      [base[`${side}Elbow`], "팔꿈치 보조", "#f1b83b"],
      [base[`${side}Hand`], "손끝 경로", "#e1462e"],
    ].map(([point, text, color]) => ({ point: pointFrom(point), text, color })).filter((item) => item.point);
    ctx.save();
    ctx.lineWidth = 2;
    for (const item of points) {
      const screen = imagePointToScreen(item.point, view);
      ctx.fillStyle = item.color;
      ctx.beginPath();
      ctx.arc(screen.x, screen.y, 4, 0, Math.PI * 2);
      ctx.fill();
      label(ctx, screen.x + 8, screen.y + 12, item.text, "#fffdf5");
    }
    ctx.restore();
  }

  function html(info) {
    return `<div class="motion-path-title">궤적 생성 원리</div>
      <div class="motion-path-grid">
        <span>끝점</span><strong>${escapeHtml(info.endpoint)}</strong>
        <span>판정</span><strong>${escapeHtml(styleLabel(info))}</strong>
        <span>목표</span><strong>${escapeHtml(pointLabel(info.target, info.delta))}</strong>
        <span>보정</span><strong>${escapeHtml(scopeLabel(info.scope))}</strong>
        <span>비트</span><strong>${escapeHtml(info.beats.join(" → "))}</strong>
        <span>앵커</span><strong>${escapeHtml(info.anchors || "자동")}</strong>
      </div>
      <div class="motion-path-note">${escapeHtml(note(info))}</div>`;
  }

  function note(info) {
    if (info.rearArmOnly) return `${info.legacy ? "저장 metadata가 없어 런타임에서 뒷손으로 추론했습니다. " : ""}뒷손은 당김에서 목표 반대쪽으로 빠지고, 전진/타격에서 손끝이 가장 크게 이동합니다. 단일 팔 파츠는 어깨 기준점은 적게, 팔꿈치는 중간, 손끝은 최대로 움직이게 그립니다.`;
    if (info.type === "punch") return "앞손 잽은 선택 손/손끝을 목표까지 우선 보간하고, 팔꿈치 bendHint와 몸통 follow는 거리와 motion scope에 따라 따라갑니다.";
    return "킥은 발끝 목표를 먼저 정하고 무릎 bendHint, 골반 root, 가슴/머리 balance anchor를 단계별로 보간합니다.";
  }

  function styleInfo(bridge, parts, primary) {
    const action = Animotion.cutsceneActionSelectors?.getActiveJointAction?.(bridge)?.action;
    return Animotion.armExtension?.punchStyleInfo?.({ parts, bridge }, primary) || { punchStyle: action?.targetDebug?.punchStyle || null, source: action?.targetDebug?.punchStyle ? "explicit" : "missing" };
  }
  function endpointLabel(part, parts, focusKey) {
    if (!part) return focusKey || "none";
    if (part.type === "hand" || part.humanRole === "hand") return `${part.name || part.id} 별도 손 파츠`;
    if (part.type === "arm" && part.handTip) return `${part.name || part.id} handTip`;
    if (part.type === "arm") return `${part.name || part.id} 추정 handTip`;
    return `${part.name || part.id} ${focusKey || ""}`.trim();
  }
  function styleLabel(info) {
    const source = info.styleSource === "explicit" ? "명시" : info.styleSource === "inferredLegacy" ? "legacy 추론" : "자동";
    return info.style === "rear-cross" ? `뒷손 크로스 · ${source}` : info.style === "jab" ? `앞손 잽 · ${source}` : info.style;
  }
  function scopeLabel(scope) { return ({ "limb-only": "팔다리만", "body-follow": "몸통 보조", "full-character": "전체 캐릭터" })[scope] || scope; }
  function pointLabel(point, delta) { return point ? `${point.x},${point.y}${delta ? ` · Δ${delta.x},${delta.y}` : ""}` : "없음"; }
  function anchorSummary(anchors = []) { return (anchors || []).map((anchor) => `${anchor.key}:${roleLabel(anchor.role)}`).join(", "); }
  function roleLabel(role) { return ({ primary: "목표", bendHint: "굽힘", root: "몸통", balance: "균형", follow: "따라감" })[role] || role; }
  function labelForBeat(id) { return BEAT_LABELS[id] || id; }
  function actionType(action = {}) { return Animotion.cutsceneActionSelectors?.actionTemplate?.(action) || null; }
  function primaryKeyFor(type) { return type === "kick" ? "rFoot" : "rHand"; }
  function isArmOnly(part, parts) { return part?.type === "arm" && !parts.some((candidate) => candidate.id !== part.id && (candidate.type === "hand" || candidate.humanRole === "hand")); }
  function beat(action, id) { return (action?.beats || []).find((entry) => entry.id === id) || null; }
  function lastBeat(action = {}) { const beats = action?.beats || []; return beats[beats.length - 1] || null; }
  function pointFrom(point) { return point ? { x: Number(point.x ?? point[0]) || 0, y: Number(point.y ?? point[1]) || 0 } : null; }
  function imagePointToScreen(point, view) { return Animotion.previewTransform.imagePointToScreen(point, view, Animotion.state.previewSourceFrame, Animotion.state.previewSourceTransform); }
  function label(ctx, x, y, text, fill) { ctx.fillStyle = fill; ctx.strokeStyle = "#27221b"; ctx.lineWidth = 3; ctx.strokeText(text, x, y); ctx.fillText(text, x, y); }
  function escapeHtml(value) { return String(value || "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[char]); }

  Animotion.motionPathExplainer = { installControls, refreshControls, explain, drawOverlay };
  installControls();
  if (typeof module !== "undefined") module.exports = Animotion.motionPathExplainer;
}
