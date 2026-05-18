{
  const global = typeof window !== "undefined" ? window : globalThis;
  const Animotion = global.Animotion || (global.Animotion = {});
  const EDITABLE_RIG_ROLES = new Set(["joint", "rotationPivot", "anchor"]);

  function selectedEditableRigPoint(event) {
    const part = selectedPart();
    if (!part || !Animotion.state?.previewView) return null;
    const point = imagePointFromEvent(event);
    return point ? selectedEditableRigPointAtImagePoint(part, point) : null;
  }

  function selectedEditableRigPointAtImagePoint(part, point) {
    const hit = closestRigPoint(part, point);
    return hit && EDITABLE_RIG_ROLES.has(hit.role) ? hit : null;
  }

  function closestRigPoint(part, point) {
    const tolerance = hitTolerance();
    const matrix = currentPartMatrix(part);
    const hits = rigPointSpecs(part)
      .map((spec) => ({ ...spec, distance: Animotion.geometry.distance(point, rigPoint(part, spec, matrix)) }))
      .filter((hit) => hit.distance <= tolerance)
      .sort((a, b) => a.distance - b.distance);
    return hits[0] || null;
  }

  function rigPoint(part, spec, matrix) {
    const local = rigPointLocal(part, spec);
    const point = new DOMPoint(part.rect.x + local.x, part.rect.y + local.y).matrixTransform(matrix);
    return { x: point.x, y: point.y };
  }

  function rigPointLocal(part, spec) {
    if (spec.role !== "joint") return spec.localPoint || part.pivot;
    const motion = Animotion.motionModel.normalizeCustomMotion(part.customMotion);
    if (!timelineLikeMode()) return part.joint;
    return { x: part.joint.x + motion.jointX, y: part.joint.y + motion.jointY };
  }

  function rigPointSpecs(part) {
    const parent = Animotion.state.parts.find((candidate) => candidate.id === part.parentId);
    return Animotion.rigConnection?.previewPoints?.(part, parent) || [
      { role: "rotationPivot", localPoint: part.pivot, label: "회전 중심" },
      { role: "joint", localPoint: part.joint, label: "관절점" },
    ];
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
    const t = state.running ? (performance.now() - state.startTime) / 1000 : state.pausedTime;
    return Animotion.preview.worldMatrix(part, t, new Map());
  }

  function hitTolerance() {
    return Animotion.config.hitTolerancePx / Animotion.previewTransform.sourceScale(
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

  Animotion.previewHitTest = { selectedEditableRigPoint, selectedEditableRigPointAtImagePoint };
  if (typeof module !== "undefined") module.exports = Animotion.previewHitTest;
}
