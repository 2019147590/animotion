{
  const global = window;
  const Animotion = global.Animotion;
  const { sourceCanvas, previewCanvas, sourceCtx, previewCtx, els } = Animotion.dom;
  const state = Animotion.state;
  const geometry = Animotion.geometry;
  const { pathFromShape } = Animotion.path;

  function drawEmpty(ctx, canvas, message) {
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.width / dpr;
    const h = canvas.height / dpr;
    ctx.save();
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = "#fffaf0";
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = "#766f64";
    ctx.textAlign = "center";
    ctx.font = "700 16px Aptos, sans-serif";
    ctx.fillText(message, w / 2, h / 2);
    ctx.restore();
  }

  function drawSource() {
    Animotion.view.resizeCanvas(sourceCanvas);
    const dpr = window.devicePixelRatio || 1;
    const w = sourceCanvas.width / dpr;
    const h = sourceCanvas.height / dpr;
    sourceCtx.save();
    sourceCtx.scale(dpr, dpr);
    sourceCtx.clearRect(0, 0, w, h);
    const image = Animotion.panelEditor?.imageFor() || state.image;
    if (!image) {
      sourceCtx.restore();
      drawEmpty(sourceCtx, sourceCanvas, "원화/캐릭터 컷을 업로드하세요");
      return;
    }
    const view = Animotion.view.sourceImageView(w, h);
    state.sourceView = view;
    sourceCtx.fillStyle = "#f7f0df";
    sourceCtx.fillRect(0, 0, w, h);
    sourceCtx.drawImage(image, view.x, view.y, view.w, view.h);
    drawSourceTransformedParts(view);
    drawSourceOverlays(view);
    sourceCtx.restore();
  }

  function drawSourceTransformedParts(view) {
    if (Animotion.panelEditor?.canEditRig() === false) return;
    sourceCtx.save();
    sourceCtx.translate(view.x, view.y);
    sourceCtx.scale(view.scale, view.scale);
    for (const part of [...state.parts].sort((a, b) => a.order - b.order)) drawSourceTransformedPart(part);
    sourceCtx.restore();
  }

  function drawSourceTransformedPart(part) {
    const matrix = Animotion.partTransformGeometry?.worldMatrix?.(part, state.parts);
    if (part.hidden || !part.canvas || !matrix || !hasWorldTransform(matrix)) return;
    sourceCtx.save();
    sourceCtx.transform(matrix.a, matrix.b, matrix.c, matrix.d, matrix.e, matrix.f);
    sourceCtx.globalAlpha = part.alpha ?? 1;
    drawPartImage(sourceCtx, part, state.currentFrame);
    sourceCtx.restore();
  }

  function drawPartImage(ctx, part, frame) {
    if (Animotion.partVisibilityMaskRender?.drawPartImage) return Animotion.partVisibilityMaskRender.drawPartImage(ctx, part, frame, pathFromShape);
    ctx.drawImage(part.canvas, part.rect.x, part.rect.y, part.rect.w, part.rect.h);
    return null;
  }

  function drawSourceOverlays(view) {
    drawPanelEditorOverlays(view);
    if (Animotion.panelEditor?.canEditRig() !== false) {
      for (const part of state.parts) {
        const selected = part.id === state.selectedPartId;
        const target = Animotion.editTarget?.current?.() || { kind: "part", partId: state.selectedPartId, maskId: null };
        const showHandles = selected && target.kind === "part" && els.selectionTool.value === Animotion.tool.edit;
        drawShapeOverlay(sourceCtx, view, sourcePartShape(part), selected, part.name, false, showHandles);
        if (selected) drawVisibilityMaskOverlays(sourceCtx, view, part, target);
        drawPartPoint(sourceCtx, view, part, part.pivot, selected, "anchor");
        drawPartPoint(sourceCtx, view, part, part.joint, selected, "joint");
        if (part.handTip) drawPartPoint(sourceCtx, view, part, part.handTip, selected, "handTip");
      }
    }
    if (state.selection) {
      drawShapeOverlay(sourceCtx, view, state.selection, true, "new part", !state.selection.closed, true);
    }
  }

  function drawPanelEditorOverlays(view) {
    if (!Animotion.panelEditor) return;
    const crop = Animotion.panelEditor.cropShape();
    const mask = Animotion.panelEditor.characterMask();
    if (crop) drawShapeOverlay(sourceCtx, view, crop, false, "crop", true, false);
    if (mask) drawShapeOverlay(sourceCtx, view, mask, true, "character", false, false);
  }

  function hasWorldTransform(matrix) {
    return Math.abs((matrix.a ?? 1) - 1) > 0.001
      || Math.abs(matrix.b || 0) > 0.001
      || Math.abs(matrix.c || 0) > 0.001
      || Math.abs((matrix.d ?? 1) - 1) > 0.001
      || Math.abs(matrix.e || 0) > 0.001
      || Math.abs(matrix.f || 0) > 0.001;
  }

  function sourcePartShape(part) {
    return Animotion.partTransformGeometry?.shapeFromPart?.(part, state.parts) || geometry.absoluteShapeFromPart(part);
  }

  function drawVisibilityMaskOverlays(ctx, view, part, target) {
    const masks = Animotion.partVisibilityMasks?.normalizeList?.(part.visibilityMasks) || [];
    for (const mask of masks) {
      const active = target.kind === "visibilityMask" && target.partId === part.id && target.maskId === mask.id;
      drawVisibilityMaskOverlay(ctx, view, visibilityMaskShape(part, mask), active, mask.name || "visibility mask");
    }
  }

  function visibilityMaskShape(part, mask) {
    const points = Animotion.partTransformGeometry?.partLocalPointsToImage?.(part, mask.mask.points, state.parts)
      || mask.mask.points.map((point) => ({ x: part.rect.x + point.x, y: part.rect.y + point.y }));
    return { kind: mask.mask.kind || Animotion.shapeKind.polygon, closed: true, points };
  }

  function drawVisibilityMaskOverlay(ctx, view, shape, active, label) {
    ctx.save();
    ctx.translate(view.x, view.y);
    ctx.scale(view.scale, view.scale);
    ctx.lineWidth = active ? 3 / view.scale : 1.5 / view.scale;
    ctx.strokeStyle = active ? "#7b3ff2" : "rgba(123, 63, 242, 0.42)";
    ctx.fillStyle = active ? "rgba(123, 63, 242, 0.15)" : "rgba(123, 63, 242, 0.05)";
    ctx.setLineDash(active ? [] : [7 / view.scale, 6 / view.scale]);
    ctx.fill(pathFromShape(shape));
    ctx.stroke(pathFromShape(shape));
    ctx.setLineDash([]);
    if (active) drawShapeHandles(ctx, shape, view);
    ctx.restore();
    if (active) drawShapeLabel(ctx, view, shape, true, label);
  }

  function drawPartPoint(ctx, view, part, localPoint, selected, role) {
    const point = Animotion.partTransformGeometry?.pointToImage?.(part, localPoint, state.parts)
      || { x: part.rect.x + localPoint.x, y: part.rect.y + localPoint.y };
    drawPivot(ctx, view, point.x, point.y, selected, role);
  }

  function drawShapeOverlay(ctx, view, shape, selected, label, dashed = false, handles = false) {
    ctx.save();
    ctx.translate(view.x, view.y);
    ctx.scale(view.scale, view.scale);
    ctx.lineWidth = selected ? 3 / view.scale : 2 / view.scale;
    ctx.strokeStyle = selected ? "#e1462e" : "#0f7f79";
    ctx.fillStyle = selected ? "rgba(225, 70, 46, 0.12)" : "rgba(15, 127, 121, 0.08)";
    if (dashed) ctx.setLineDash([9 / view.scale, 6 / view.scale]);
    ctx.fill(pathFromShape(shape));
    ctx.stroke(pathFromShape(shape));
    ctx.setLineDash([]);
    drawOpenShapeHint(ctx, shape);
    if (handles) drawShapeHandles(ctx, shape, view);
    ctx.restore();
    drawShapeLabel(ctx, view, shape, selected, label);
  }

  function drawOpenShapeHint(ctx, shape) {
    if (shape.closed || shape.points.length <= 1) return;
    ctx.strokeStyle = "#e1462e";
    ctx.beginPath();
    ctx.moveTo(shape.points[shape.points.length - 1].x, shape.points[shape.points.length - 1].y);
    ctx.lineTo(shape.points[0].x, shape.points[0].y);
    ctx.stroke();
  }

  function drawShapeHandles(ctx, shape, view) {
    for (const point of shape.points) {
      ctx.beginPath();
      ctx.fillStyle = "#f1b83b";
      ctx.strokeStyle = "#151515";
      ctx.lineWidth = 2 / view.scale;
      ctx.arc(point.x, point.y, 5 / view.scale, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
  }

  function drawShapeLabel(ctx, view, shape, selected, label) {
    const bounds = geometry.pointsBounds(shape.points, Animotion.imageBounds());
    const x = view.x + bounds.x * view.scale;
    const y = view.y + bounds.y * view.scale;
    ctx.save();
    ctx.fillStyle = selected ? "#e1462e" : "#0f7f79";
    ctx.font = "800 12px Aptos, sans-serif";
    ctx.fillRect(x, Math.max(0, y - 21), ctx.measureText(label || "").width + 10, 19);
    ctx.fillStyle = "white";
    ctx.fillText(label || "", x + 5, Math.max(13, y - 7));
    ctx.restore();
  }

  function drawPivot(ctx, view, x, y, selected, role = "anchor") {
    const px = view.x + x * view.scale;
    const py = view.y + y * view.scale;
    const style = pointStyle(role, selected);
    ctx.save();
    ctx.strokeStyle = style.stroke;
    ctx.fillStyle = style.fill;
    ctx.lineWidth = 2;
    ctx.beginPath();
    if (style.square) ctx.rect(px - 5, py - 5, 10, 10);
    else ctx.arc(px, py, selected ? 6 : 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(px - 9, py);
    ctx.lineTo(px + 9, py);
    ctx.moveTo(px, py - 9);
    ctx.lineTo(px, py + 9);
    ctx.stroke();
    ctx.restore();
  }

  function pointStyle(role, selected) {
    if (role === "joint") return { fill: "#8fd3ff", stroke: "#151515" };
    if (role === "handTip") return { fill: "#f16fb1", stroke: "#151515" };
    if (role === "connection" || role === "parentConnection") return { fill: "#0f7f79", stroke: "#151515", square: true };
    if (role === "bodyRoot") return { fill: "#151515", stroke: "#f1b83b" };
    if (role === "trajectory") return { fill: "#e1462e", stroke: "#fffaf0" };
    if (role === "hiddenGuide") return { fill: "#f1b83b", stroke: "#151515" };
    return { fill: selected ? "#f1b83b" : "#fff", stroke: selected ? "#151515" : "#e1462e" };
  }

  function drawPreview(now = performance.now()) {
    Animotion.preview.drawPreview(now, drawEmpty, drawPivot);
  }

  Animotion.render = { drawSource, drawPreview, drawShapeOverlay, drawPivot, drawEmpty };
}
