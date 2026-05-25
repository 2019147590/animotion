{
  const global = window;
  const Animotion = global.Animotion;
  const { previewCtx } = Animotion.dom;
  const state = Animotion.state;

  function drawSelectedRigPoints(context, matrixCache, drawPivot) {
    const part = Animotion.parts.selectedPart();
    if (!context.editingLayerVisible() || !part) return;
    state.renderedPointDebug = [];
    const t = state.running ? (context.now - state.startTime) / 1000 : state.pausedTime;
    const matrix = context.worldMatrix(part, t, matrixCache);
    for (const point of rigPointsFor(part, context.parentPart)) drawRigPoint(part, point, matrix, context, drawPivot);
    const root = Animotion.rigConnection?.bodyRootPoint?.(state.parts);
    if (root) drawRigPoint(root.part, root, context.worldMatrix(root.part, t, matrixCache), context, drawPivot);
  }

  function rigPointsFor(part, parentPart) {
    const parent = parentPart(part);
    return (Animotion.rigConnection?.previewPoints?.(part, parent) || [
      { role: "rotationPivot", localPoint: part.pivot },
      { role: "joint", localPoint: part.joint },
    ]);
  }

  function drawRigPoint(part, spec, matrix, context, drawPivot) {
    const options = { timelineLike: context.timelineLikeMode() };
    const local = Animotion.previewRigPoints.localPoint(part, spec, options);
    const image = Animotion.previewRigPoints.imagePoint(part, spec, matrix, options);
    const screen = Animotion.previewTransform.imagePointToScreen(image, context.view, state.previewSourceFrame, state.previewSourceTransform);
    if (!local || !screen) return;
    recordPointDebug(part, local, spec.role, screen);
    drawPivot(previewCtx, { x: 0, y: 0, scale: 1 }, screen.x, screen.y, true, spec.role);
    if (state.showPointDebugLabels) drawPointDebugLabel(screen, `${part.id}:${spec.role}`);
  }

  function recordPointDebug(part, localPoint, role, screen) {
    state.renderedPointDebug.push({ pointId: `${part.id}:${role}`, pointKind: role, coordinateSpace: "part-local", stored: { x: localPoint.x, y: localPoint.y }, rendered: screen });
  }

  function drawPointDebugLabel(screen, label) {
    previewCtx.save();
    previewCtx.font = "700 11px Aptos, sans-serif";
    previewCtx.fillStyle = "#151515";
    previewCtx.fillText(label, screen.x + 9, screen.y - 8);
    previewCtx.restore();
  }

  Animotion.previewRigOverlay = { drawSelectedRigPoints };
}
