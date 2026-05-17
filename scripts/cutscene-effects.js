{
  const global = typeof window !== "undefined" ? window : globalThis;
  const Animotion = global.Animotion || (global.Animotion = {});

  function drawSpeedLines(ctx, canvasSize, direction, power) {
    if (power <= 0.01) return;
    const angle = Math.atan2(direction.y, direction.x);
    ctx.save();
    ctx.globalAlpha = 0.1 + power * 0.22;
    ctx.strokeStyle = "#151515";
    ctx.lineWidth = 1 + power * 4;
    ctx.rotate(angle);
    for (let i = -8; i < 42; i += 1) {
      const y = i * 26;
      const offset = (i % 6) * 44;
      drawLine(ctx, -240 + offset, y, canvasSize.w * 0.9 + offset + power * 280, y - 52 * power);
    }
    ctx.restore();
  }

  function drawInkField(ctx, canvasSize, direction, power) {
    if (power <= 0.01) return;
    ctx.save();
    ctx.globalAlpha = 0.07 + power * 0.12;
    ctx.fillStyle = "#10100f";
    for (let i = 0; i < 18; i += 1) {
      const x = 40 + ((i * 73) % Math.max(80, canvasSize.w - 80)) + direction.x * power * 60;
      const y = 50 + ((i * 47) % Math.max(80, canvasSize.h - 80)) + direction.y * power * 90;
      const r = 2 + ((i * 5) % 13) * power;
      ctx.beginPath();
      ctx.ellipse(x, y, r * 1.8, r, -0.7, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawTrajectory(ctx, points, view, progress, offset = { x: 0, y: 0 }) {
    if (!points?.length) return;
    ctx.save();
    ctx.globalAlpha = 0.24;
    ctx.strokeStyle = "#811515";
    ctx.lineWidth = 3;
    ctx.setLineDash([12, 14]);
    ctx.beginPath();
    moveToPoint(ctx, points[0], view, offset);
    for (let i = 1; i < points.length; i += 1) lineToPoint(ctx, points[i], view, offset);
    ctx.stroke();
    ctx.setLineDash([]);
    drawMarker(ctx, points, view, progress, offset);
    ctx.restore();
  }

  function drawPanelImage(ctx, image, view, alpha, transform = {}) {
    if (!image || alpha <= 0.01) return;
    const scale = transform.scale ?? 1;
    const dx = transform.x ?? 0;
    const dy = transform.y ?? 0;
    const rotation = transform.rotation ?? 0;
    const rect = fittedPanelRect(image, view, scale);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(view.x + view.w * 0.5 + dx, view.y + view.h * 0.5 + dy);
    ctx.rotate(rotation);
    ctx.drawImage(image, -rect.w * 0.5, -rect.h * 0.5, rect.w, rect.h);
    ctx.restore();
  }

  function fittedPanelRect(image, view, scale) {
    const source = image.animotionPanel;
    const sourceWidth = source?.sourceWidth || image.width;
    const sourceHeight = source?.sourceHeight || image.height;
    const fit = Math.min(view.w / sourceWidth, view.h / sourceHeight);
    return { w: image.width * fit * scale, h: image.height * fit * scale };
  }

  function drawImpactPanel(ctx, image, view, alpha, transform = {}) {
    drawPanelImage(ctx, image, view, alpha, transform);
  }

  function drawFlash(ctx, canvasSize, alpha) {
    if (alpha <= 0.01) return;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvasSize.w, canvasSize.h);
    ctx.restore();
  }

  function drawPanelMask(ctx, canvasSize) {
    ctx.save();
    ctx.strokeStyle = "#10100f";
    ctx.lineWidth = 12;
    ctx.strokeRect(6, 6, canvasSize.w - 12, canvasSize.h - 12);
    ctx.globalAlpha = 0.22;
    ctx.lineWidth = 2;
    ctx.strokeRect(24, 24, canvasSize.w - 48, canvasSize.h - 48);
    ctx.restore();
  }

  function drawLine(ctx, x1, y1, x2, y2) {
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  }

  function moveToPoint(ctx, point, view, offset) {
    ctx.moveTo(view.x + point[0] * view.scale + offset.x, view.y + point[1] * view.scale + offset.y);
  }

  function lineToPoint(ctx, point, view, offset) {
    ctx.lineTo(view.x + point[0] * view.scale + offset.x, view.y + point[1] * view.scale + offset.y);
  }

  function drawMarker(ctx, points, view, progress, offset) {
    const index = Math.min(points.length - 1, Math.floor(progress * (points.length - 1)));
    const point = points[index];
    ctx.globalAlpha = 0.85;
    ctx.fillStyle = "#c32222";
    ctx.beginPath();
    ctx.arc(view.x + point[0] * view.scale + offset.x, view.y + point[1] * view.scale + offset.y, 5, 0, Math.PI * 2);
    ctx.fill();
  }

  Animotion.cutsceneEffects = {
    drawSpeedLines,
    drawInkField,
    drawTrajectory,
    drawPanelImage,
    drawImpactPanel,
    drawFlash,
    drawPanelMask,
    fittedPanelRect,
  };

  if (typeof module !== "undefined") module.exports = Animotion.cutsceneEffects;
}
