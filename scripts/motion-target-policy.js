{
  const global = typeof window !== "undefined" ? window : globalThis;
  const Animotion = global.Animotion || (global.Animotion = {});

  function correspondenceApplyPolicy(plan = {}, draft = null, options = {}) {
    if (!draft) return denied("적용할 B컷 참조 위치가 없습니다.");
    if (options.explicit === true) return allowed();
    if (!plan.target) return allowed();
    const type = plan.activeMotionTarget?.source || plan.targetSource?.type || "manual";
    if (type === "correspondence" || type === "planner-default") return allowed();
    return denied("현재 움직임 목표는 수동 목표입니다. B컷 참조 위치는 저장되어 있지만 현재 모션에는 사용하지 않습니다.");
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
