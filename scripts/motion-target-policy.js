{
  const global = typeof window !== "undefined" ? window : globalThis;
  const Animotion = global.Animotion || (global.Animotion = {});

  function correspondenceApplyPolicy(plan = {}, draft = null) {
    if (!draft) return denied("적용할 correspondence target이 없습니다.");
    if (!plan.target) return allowed();
    const type = plan.targetSource?.type || "manual";
    if (type === "correspondence" || type === "planner-default") return allowed();
    return denied("수동 목표가 있어 correspondence로 덮어쓰지 않았습니다.");
  }

  function allowed() {
    return { allowed: true, message: "" };
  }

  function denied(message) {
    return { allowed: false, message };
  }

  Animotion.motionTargetPolicy = { correspondenceApplyPolicy };
  if (typeof module !== "undefined") module.exports = Animotion.motionTargetPolicy;
}
