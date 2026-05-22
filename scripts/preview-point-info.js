{
  const global = typeof window !== "undefined" ? window : globalThis;
  const Animotion = global.Animotion || (global.Animotion = {});
  const BEAT_LABELS = { guard: "가드", windup: "당김", drive: "전진", impact: "타격", recover: "복귀", chamber: "접기", extend: "뻗음" };
  const ANCHOR_ROLES = { primary: "타격 끝점", bendHint: "굽힘 보조", root: "몸 기준", balance: "균형 보정", follow: "따라감" };

  function rigPointInfo(part = {}, role = "", context = {}) {
    const participation = rigParticipation(part, role, context);
    return {
      kind: role,
      role: rigRoleLabel(part, role, participation),
      label: part.name || part.id || "",
      detail: participation.detail || "리깅 포즈 기준점",
      participatesInTrajectory: participation.active,
      trajectoryRole: participation.trajectoryRole || null,
    };
  }

  function trajectoryBeatInfo(beat = {}, focusKey = "", action = {}) {
    const label = `${beatLabel(beat.id)}@${beat.at || "?"}`;
    return {
      role: "이동 경로점",
      label,
      detail: `${focusKey || action.focusKey || "pose"} 키의 프레임 위치를 직접 보간합니다.`,
      participatesInTrajectory: true,
      trajectoryRole: "beat",
    };
  }

  function anchorInfo(anchor = {}) {
    const role = ANCHOR_ROLES[anchor.role] || anchor.role || "앵커";
    return {
      role: "궤적 조정점",
      label: `${anchor.key || "anchor"} · ${role}`,
      detail: anchor.locked ? "사용자가 고정한 생성 앵커입니다." : "플래너가 경로 생성을 위해 사용하는 보조 앵커입니다.",
      participatesInTrajectory: true,
      trajectoryRole: anchor.role || "anchor",
    };
  }

  function rigParticipation(part, role, context) {
    if (!isPrimaryPunchArm(part, context)) return { active: false };
    if (role === "handTip") return { active: true, trajectoryRole: "primary", detail: "궤적 참여: 손끝/주먹 타격 끝점입니다." };
    if (role === "joint") return { active: true, trajectoryRole: "bendHint", detail: "궤적 참여: 팔꿈치/bend 보조점으로 중간만 따라갑니다." };
    if (role === "rotationPivot" || role === "anchor") return { active: true, trajectoryRole: "proximal", detail: "궤적 참여: 어깨/proximal 기준점으로 가장 적게 움직입니다." };
    return { active: false };
  }

  function isPrimaryPunchArm(part = {}, context = {}) {
    const bridge = context.bridge || Animotion.state?.cutsceneBridge || {};
    const action = bridge.jointAction || {};
    if (!isPunchAction(action) || !isArmPart(part)) return false;
    const primaryId = bridge.primaryPartId || action.targetDebug?.primaryPartId || context.selectedPartId || Animotion.state?.selectedPartId;
    const style = Animotion.armExtension?.punchStyleInfo?.({ parts: context.parts || Animotion.state?.parts || [], bridge, selectedPartId: primaryId }, part);
    return part.id === primaryId && (style?.punchStyle === "rear-cross" || action.targetDebug?.punchStyle === "rear-cross");
  }

  function rigRoleLabel(part = {}, role = "", participation = {}) {
    if (role === "handTip") return participation.active ? "손끝/타격 끝점" : "손끝점";
    if (role === "joint") return participation.active ? "팔꿈치/bend 보조점" : "관절점";
    if (role === "rotationPivot" || role === "anchor") return isArmPart(part) ? "어깨/회전 기준점" : "회전 중심";
    if (role === "bodyRoot") return "몸 기준점";
    if (role === "connection" || role === "parentConnection") return "연결점";
    return role || "편집점";
  }

  function beatLabel(id) {
    return BEAT_LABELS[id] || id || "beat";
  }

  function isPunchAction(action = {}) {
    return action?.actionTimeline?.template === "punch" || String(action?.source || "").includes("punch");
  }

  function isArmPart(part = {}) {
    return part.type === "arm" || ["upperArm", "forearm"].includes(part.humanRole);
  }

  Animotion.previewPointInfo = { rigPointInfo, trajectoryBeatInfo, anchorInfo, beatLabel };
  if (typeof module !== "undefined") module.exports = Animotion.previewPointInfo;
}
