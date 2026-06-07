{
  const global = typeof window !== "undefined" ? window : globalThis;
  const Animotion = global.Animotion || (global.Animotion = {});
  const state = Animotion.state;

  function markSelectedAsSupplementalPart() {
    const part = selectedPart();
    const source = supplementalSource(part);
    if (!part || part.isSupplementalPart === true || !source) return null;
    return Animotion.partCommands.updatePart(part, supplementalPatch(source));
  }

  function setSelectedSupplementalShoulderFill() {
    const part = selectedPart();
    const driver = shoulderFillDriver(part);
    if (!part || !driver || !Animotion.supplementalFollow) return null;
    const patch = {
      ...conversionPatch(part),
      supplementalFollow: Animotion.supplementalFollow.shoulderFillMetadata(part, driver, followContext()),
    };
    return Animotion.partCommands.updatePart(part, patch);
  }

  function setSelectedSupplementalElbowJointFill() {
    const part = selectedPart();
    const drivers = elbowJointDrivers(part);
    if (!part || !drivers || !Animotion.supplementalFollow) return null;
    const patch = {
      ...conversionPatch(part),
      supplementalFollow: Animotion.supplementalFollow.elbowJointFillMetadata(part, drivers.upperArm, drivers.forearm, followContext()),
    };
    return Animotion.partCommands.updatePart(part, patch);
  }

  function clearSelectedSupplementalFollow() {
    const part = selectedPart();
    if (!part?.supplementalFollow) return null;
    return Animotion.partCommands.updatePart(part, { supplementalFollow: undefined });
  }

  function canShowForPart(part) {
    return Boolean(part?.isSupplementalPart === true || supplementalSource(part));
  }

  function canConvertSelectedPart() {
    const part = selectedPart();
    return Boolean(part && part.isSupplementalPart !== true && supplementalSource(part));
  }

  function conversionPatch(part) {
    return part?.isSupplementalPart === true ? {} : supplementalPatch(supplementalSource(part));
  }

  function supplementalPatch(source) {
    return {
      isSupplementalPart: true,
      supplementalKind: "manualCopy",
      completionMethod: "manualCopy",
      sourcePartId: source.id,
      supplementalMaskScale: 1,
    };
  }

  function supplementalSource(part) {
    const sourceId = part?.sourcePartId || part?.supplementalCandidateSourcePartId || part?.originalSourcePartId;
    const source = findPart(sourceId);
    return source && source.id !== part?.id ? source : null;
  }

  function shoulderFillDriver(part) {
    const source = supplementalSource(part) || part;
    return nearestBodyDriver(source) || nearestBodyDriver(part) || state.parts.find(isBodyDriver) || null;
  }

  function elbowJointDrivers(part) {
    const source = supplementalSource(part) || part;
    const upperArm = roleIs(source, "upperArm") ? source : parentWithRole(source, "upperArm");
    const forearm = roleIs(source, "forearm") ? source : childWithRole(upperArm, "forearm");
    return upperArm && forearm ? { upperArm, forearm } : null;
  }

  function followContext() {
    const cache = new Map();
    return {
      state,
      parts: state.parts,
      t: 0,
      frame: state.currentFrame,
      matrixCache: cache,
      worldMatrix: (part) => runtimeWorldMatrix(part, cache),
    };
  }

  function runtimeWorldMatrix(part, cache) {
    if (Animotion.preview?.worldMatrix) return Animotion.preview.worldMatrix(part, 0, cache);
    return Animotion.partTransformGeometry?.worldMatrix?.(part, state.parts) || identityMatrix();
  }

  function nearestBodyDriver(part) {
    for (let current = part; current; current = findPart(parentIdFor(current))) {
      if (isBodyDriver(current)) return current;
    }
    return null;
  }

  function parentWithRole(part, role) {
    for (let current = findPart(parentIdFor(part)); current; current = findPart(parentIdFor(current))) {
      if (roleIs(current, role)) return current;
    }
    return null;
  }

  function childWithRole(part, role) {
    if (!part) return null;
    return state.parts.find((candidate) => parentIdFor(candidate) === part.id && roleIs(candidate, role)) || null;
  }

  function isBodyDriver(part) {
    return ["torso", "spine", "pelvis"].includes(part?.humanRole) || ["body", "spine"].includes(part?.type);
  }

  function roleIs(part, role) {
    return part?.humanRole === role;
  }

  function selectedPart() {
    return Animotion.parts?.selectedPart?.() || findPart(state.selectedPartId) || null;
  }

  function findPart(partId) {
    return state.parts.find((part) => part.id === partId) || null;
  }

  function parentIdFor(part) {
    return Animotion.rigConnection?.parentIdFor?.(part) || part?.parentId || part?.parentPartId || null;
  }

  function identityMatrix() {
    return { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 };
  }

  Object.assign(Animotion.partCommands, {
    markSelectedAsSupplementalPart,
    setSelectedSupplementalShoulderFill,
    setSelectedSupplementalElbowJointFill,
    clearSelectedSupplementalFollow,
  });
  Animotion.supplementalFollowCommands = { canShowForPart, canConvertSelectedPart, supplementalSource };
  if (typeof module !== "undefined") module.exports = Animotion.supplementalFollowCommands;
}
