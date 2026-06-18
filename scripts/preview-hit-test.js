{
  const global = typeof window !== "undefined" ? window : globalThis;
  const Animotion = global.Animotion || (global.Animotion = {});
  const EDITABLE_RIG_ROLES = new Set(["joint", "rotationPivot", "anchor", "handTip"]);

  function selectedEditableRigPoint(event) {
    const part = selectedPart();
    if (!part || !Animotion.state?.previewView) return null;
    const point = imagePointFromEvent(event);
    return point ? selectedEditableRigPointAtImagePoint(part, point) : null;
  }

  function selectedEditableRigPointAtImagePoint(part, point) {
    const hit = closestRigPoint(part, point);
    if (!hit || !EDITABLE_RIG_ROLES.has(hit.role)) return null;
    return Animotion.armRoleSemantics?.isRoleEditable?.(part, hit.role) === false ? null : hit;
  }

  function closestRigPoint(part, point) {
    const tolerance = hitTolerance();
    const matrix = currentPartMatrix(part);
    const hits = rigPointSpecs(part)
      .map((spec) => ({ ...spec, distance: Animotion.geometry.distance(point, rigPointImagePoint(part, spec, matrix)) }))
      .filter((hit) => hit.distance <= tolerance);
    return sortRigPointHits(hits)[0] || null;
  }

  function sortRigPointHits(hits = []) {
    const preferredRole = preferredRigPointRole();
    const tieDistance = preferredRole ? hitTolerance() : handTipTieDistance();
    return [...hits].sort((a, b) => compareRigPointHits(a, b, preferredRole, tieDistance));
  }

  function compareRigPointHits(a, b, preferredRole, tieDistance) {
    const distanceDelta = a.distance - b.distance;
    if (Math.abs(distanceDelta) > tieDistance) return distanceDelta;
    const preferredDelta = preferredRank(a, preferredRole) - preferredRank(b, preferredRole);
    return preferredDelta || endpointTieRank(a) - endpointTieRank(b) || distanceDelta;
  }

  function preferredRank(hit, preferredRole) {
    return preferredRole && hit.role === preferredRole ? 0 : 1;
  }

  function endpointTieRank(hit) {
    if (hit.role === "handTip") return 0;
    if (hit.role === "joint") return 1;
    return 2;
  }

  function preferredRigPointRole() {
    const selected = selectedPart();
    return Animotion.dom?.els?.pivotEditTarget?.value === "handTip" && Animotion.armRoleSemantics?.isRoleEditable?.(selected, "handTip") !== false ? "handTip" : null;
  }

  function handTipTieDistance() {
    return Math.max(0.5 / hitSourceScale(), 0.001);
  }

  function rigPointImagePoint(part, spec, matrix) {
    return Animotion.previewRigPoints.imagePoint(part, spec, matrix, { timelineLike: timelineLikeMode() });
  }

  function rigPointSpecs(part) {
    const parent = parentPart(part);
    return Animotion.rigConnection?.previewPoints?.(part, parent) || [
      { role: "rotationPivot", localPoint: part.pivot, label: "회전 중심" },
      { role: "joint", localPoint: part.joint, label: "관절점" },
    ];
  }

  function parentPart(part) {
    const parentId = Animotion.rigConnection?.parentIdFor?.(part);
    return Animotion.state.parts.find((candidate) => candidate.id === parentId) || null;
  }

  function imagePointFromEvent(event) {
    const canvas = Animotion.dom?.previewCanvas;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    return Animotion.previewTransform.screenPointToImage(
      { x: event.clientX - rect.left, y: event.clientY - rect.top },
      Animotion.state.previewView,
      Animotion.state.previewSourceFrame,
      Animotion.state.previewSourceTransform
    );
  }

  function currentPartMatrix(part) {
    const state = Animotion.state;
    const t = Animotion.playbackSpeed.playbackSeconds(state, performance.now());
    return Animotion.preview.worldMatrix(part, t, new Map());
  }

  function hitTolerance() {
    return Animotion.config.hitTolerancePx / hitSourceScale();
  }

  function hitSourceScale() {
    return Animotion.previewTransform.sourceScale(
      Animotion.state.previewView,
      Animotion.state.previewSourceFrame,
      Animotion.state.previewSourceTransform
    );
  }

  function selectedPart() {
    return Animotion.parts?.selectedPart?.()
      || Animotion.state?.parts?.find((part) => part.id === Animotion.state.selectedPartId)
      || null;
  }

  function timelineLikeMode() {
    return Animotion.dom?.els?.motionTemplate?.value === "keyframes" || Animotion.dom?.els?.motionTemplate?.value === "cutscene";
  }

  Animotion.previewHitTest = { selectedEditableRigPoint, selectedEditableRigPointAtImagePoint, sortRigPointHits };
  if (typeof module !== "undefined") module.exports = Animotion.previewHitTest;
}
