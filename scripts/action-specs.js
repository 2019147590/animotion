{
  const global = typeof window !== "undefined" ? window : globalThis;
  const Animotion = global.Animotion || (global.Animotion = {});

  const SPECS = Object.freeze({
    punch: spec({
      id: "punch",
      family: "attack",
      label: "Punch",
      requiredRoles: ["forearm"],
      optionalRoles: ["upperArm", "hand", "torso", "head"],
      primaryFocus: focus("bodyPart", "forearm", "handTip"),
      motionScope: "body-follow",
      editableFrames: ["guard", "windup", "drive", "extension", "impact", "recover"],
      beats: [
        beat("guard", 0, 0, 0, 0),
        beat("windup", 0.2, -0.24, 0.06, 0.1),
        beat("drive", 0.52, 0.18, -0.03, 0.62),
        beat("extension", 0.78, 0.38, -0.01, 0.9),
        beat("impact", 1, 0, 0, 1),
        beat("recover", "duration", 0.04, 0.02, 0.22),
      ],
    }),
    rearHandPunch01: spec({
      id: "rearHandPunch01",
      family: "attack",
      label: "\uB4B7\uC190\uD380\uCE58_01",
      baseTemplate: "punch",
      punchStyle: "rear-cross",
      defaultDurationFrames: 18,
      requiredRoles: ["hand"],
      optionalRoles: ["upperArm", "forearm", "torso", "head"],
      primaryFocus: focus("bodyPart", "hand", "handTip"),
      motionScope: "body-follow",
      editableFrames: ["guard", "windup", "drive", "extension", "impact", "recover"],
      beats: [
        beat("guard", 0, 0, 0, 0),
        beat("windup", 0.2, -0.24, 0.06, 0.1),
        beat("drive", 0.52, 0.18, -0.03, 0.62),
        beat("extension", 0.78, 0.38, -0.01, 0.9),
        beat("impact", 1, 0, 0, 1),
        beat("recover", "duration", 0.04, 0.02, 0.22),
      ],
    }),
    kick: spec({
      id: "kick",
      family: "attack",
      label: "Kick",
      requiredRoles: ["shin"],
      optionalRoles: ["thigh", "foot", "torso", "head"],
      primaryFocus: focus("bodyPart", "shin", "footTip"),
      motionScope: "body-follow",
      editableFrames: ["ready", "compress", "chamber", "extend", "impact", "recover"],
      beats: [
        beat("ready", 0, 0, 0, 0),
        beat("compress", 0.18, -0.2, 0.1, 0.14),
        beat("chamber", 0.46, 0.04, -0.16, 0.38),
        beat("extend", 0.76, 0.42, -0.06, 0.84),
        beat("impact", 1, 0, 0, 1),
        beat("recover", "duration", 0.04, 0.02, 0.22),
      ],
    }),
    dash: spec({
      id: "dash",
      family: "locomotion",
      label: "Dash",
      requiredRoles: ["torso"],
      optionalRoles: ["pelvis", "head", "leg", "foot"],
      primaryFocus: focus("bodyPart", "torso", "chest"),
      motionScope: "full-character",
      timelineEnabled: false,
      editableFrames: ["ready", "lean", "launch", "snap", "arrive"],
      beats: [
        beat("ready", 0, 0, 0, 0),
        beat("lean", 0.28, -0.08, 0.04, 0.2),
        beat("launch", 0.62, 0.45, -0.08, 0.58),
        beat("snap", 0.86, 0.82, -0.02, 0.86),
        beat("arrive", 1, 0, 0, 1),
      ],
    }),
    boxingStep: spec({
      id: "boxingStep",
      family: "locomotion",
      label: "Boxing step",
      defaultDurationFrames: 16,
      requiredRoles: ["torso"],
      optionalRoles: ["pelvis", "head", "upperArm", "forearm", "hand", "thigh", "shin", "foot"],
      primaryFocus: focus("bodyPart", "torso", "hip"),
      motionScope: "full-character",
      editableFrames: ["guard", "weightShift", "leadFootStep", "rearFootFollow", "settle"],
      beats: [
        beat("guard", 0, 0, 0, 0),
        beat("weightShift", 0.24, 0, 0, 0),
        beat("leadFootStep", 0.46, 0, 0, 0),
        beat("rearFootFollow", 0.72, 0, 0, 0),
        beat("settle", "duration", 0, 0, 0),
      ],
    }),
  });

  function specFor(id) {
    return SPECS[String(id || "")] || null;
  }

  function hasSpec(id) {
    return Boolean(specFor(id));
  }

  function timelineSpecFor(id) {
    const found = specFor(id);
    return found && found.timelineEnabled !== false ? found : null;
  }

  function templateIds() {
    return Object.keys(SPECS);
  }

  function timelineTemplateIds() {
    return templateIds().filter((id) => timelineSpecFor(id));
  }

  function editableFrameIds(id) {
    return clone(specFor(id)?.editableFrames || []);
  }

  function baseTemplateFor(id) {
    const found = specFor(id);
    return found?.baseTemplate || found?.id || null;
  }

  function punchStyleFor(id) {
    return specFor(id)?.punchStyle || null;
  }

  function isPunchLike(id) {
    return baseTemplateFor(id) === "punch";
  }

  function plannerTemplates() {
    return Object.fromEntries(templateIds().map((id) => [id, plannerTemplate(SPECS[id])]));
  }

  function plannerTemplate(found) {
    return {
      label: found.label,
      family: found.family,
      motionScope: found.motionScope,
      beats: found.beats.map((item) => [item.id, item.phase, item.recoil, item.lift, item.reach]),
    };
  }

  function optionSpecs() {
    return templateIds().map((id) => ({ id, label: SPECS[id].label, family: SPECS[id].family }));
  }

  function spec(input) {
    const primaryFocus = normalizeFocus(input.primaryFocus);
    return Object.freeze({
      ...input,
      primaryFocus,
      focusTarget: normalizeFocus(input.focusTarget || primaryFocus),
      ...(input.baseTemplate ? { baseTemplate: String(input.baseTemplate) } : {}),
      ...(input.punchStyle ? { punchStyle: String(input.punchStyle) } : {}),
      beats: Object.freeze(input.beats.map((item) => Object.freeze({ ...item }))),
      editableFrames: Object.freeze([...(input.editableFrames || [])]),
      requiredRoles: Object.freeze([...(input.requiredRoles || [])]),
      optionalRoles: Object.freeze([...(input.optionalRoles || [])]),
      requiredProps: Object.freeze([...(input.requiredProps || [])].map((item) => Object.freeze({ ...item }))),
      attachments: Object.freeze([...(input.attachments || [])].map((item) => Object.freeze({ ...item }))),
    });
  }

  function beat(id, phase, recoil, lift, reach) {
    return { id, phase, recoil, lift, reach };
  }

  function focus(owner, role, point) {
    return { owner, role, point };
  }

  function normalizeFocus(value) {
    const source = value && typeof value === "object" ? value : {};
    return Object.freeze({
      owner: source.owner === "prop" ? "prop" : "bodyPart",
      role: String(source.role || ""),
      point: String(source.point || source.role || ""),
    });
  }

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  Animotion.actionSpecs = {
    SPECS,
    specFor,
    hasSpec,
    timelineSpecFor,
    templateIds,
    timelineTemplateIds,
    editableFrameIds,
    baseTemplateFor,
    punchStyleFor,
    isPunchLike,
    plannerTemplates,
    optionSpecs,
  };
  if (typeof module !== "undefined") module.exports = Animotion.actionSpecs;
}
