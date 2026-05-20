{
  const global = typeof window !== "undefined" ? window : globalThis;
  const Animotion = global.Animotion || (global.Animotion = {});

  const HUMAN_ROLES = Object.freeze(["torso", "pelvis", "head", "upperArm", "forearm", "hand", "thigh", "shin", "foot"]);
  const REQUIRED_ROLES = Object.freeze([...HUMAN_ROLES]);

  function normalizeRole(role) {
    const value = role === undefined || role === null ? "" : String(role);
    return HUMAN_ROLES.includes(value) ? value : null;
  }

  function normalizePart(part = {}) {
    return { ...part, humanRole: normalizeRole(part.humanRole) };
  }

  function validateRig(parts = [], options = {}) {
    const normalized = (Array.isArray(parts) ? parts : []).map(normalizePart);
    const missingRoles = missingRequiredRoles(normalized, options.requiredRoles || REQUIRED_ROLES);
    const parentIssues = validateParentChain(normalized);
    return { valid: missingRoles.length === 0 && parentIssues.length === 0, missingRoles, parentIssues };
  }

  function missingRequiredRoles(parts = [], requiredRoles = REQUIRED_ROLES) {
    const present = new Set((Array.isArray(parts) ? parts : []).map((part) => normalizeRole(part.humanRole)).filter(Boolean));
    return (Array.isArray(requiredRoles) ? requiredRoles : REQUIRED_ROLES)
      .map(normalizeRole)
      .filter((role, index, roles) => role && roles.indexOf(role) === index && !present.has(role));
  }

  function validateParentChain(parts = []) {
    const byId = new Map((Array.isArray(parts) ? parts : []).filter((part) => part?.id).map((part) => [String(part.id), part]));
    return [...byId.values()].flatMap((part) => parentIssuesForPart(part, byId));
  }

  function parentIssuesForPart(part, byId) {
    const issues = [];
    const seen = new Set([String(part.id)]);
    let current = part;
    while (parentIdFor(current)) {
      const parentId = parentIdFor(current);
      const parent = byId.get(parentId);
      if (!parent) return [...issues, issue("missing-parent", part.id, parentId)];
      if (seen.has(parentId)) return [...issues, issue("cycle", part.id, parentId)];
      seen.add(parentId);
      current = parent;
    }
    return issues;
  }

  function parentIdFor(part = {}) {
    const id = part.parentId || part.parentPartId || null;
    return id === undefined || id === null || id === "" ? null : String(id);
  }

  function issue(type, partId, parentId) {
    return { type, partId: String(partId), parentId: String(parentId) };
  }

  Animotion.humanRigSchema = { HUMAN_ROLES, REQUIRED_ROLES, normalizeRole, normalizePart, validateRig, missingRequiredRoles, validateParentChain };
  if (typeof module !== "undefined") module.exports = Animotion.humanRigSchema;
}
