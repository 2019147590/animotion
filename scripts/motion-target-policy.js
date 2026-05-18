{
  const global = typeof window !== "undefined" ? window : globalThis;
  const Animotion = global.Animotion || (global.Animotion = {});

  function correspondenceApplyPolicy(plan = {}, draft = null, options = {}) {
    if (!draft) return denied("적용할 correspondence target이 없습니다.");
    if (options.explicit === true) return allowed();
    if (!plan.target) return allowed();
    const type = plan.activeMotionTarget?.source || plan.targetSource?.type || "manual";
    if (type === "correspondence" || type === "planner-default") return allowed();
    return denied("Manual target is active. B correspondence is saved but not driving motion.");
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
