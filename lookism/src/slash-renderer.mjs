import { drawImageAt } from "./canvas.mjs";
import { lerp } from "./math.mjs";

export function drawBladeTransition(ctx, canvas, values, pose) {
  if (values.followN <= 0) return;
  drawBlackout(ctx, canvas, values.blackoutAlpha);
  drawBladeGlint(ctx, canvas, values, pose);
  drawSlashTear(ctx, canvas, values);
}

export function drawSlashRevealedImage(ctx, canvas, image, transform, values) {
  if (values.slashReveal >= 0.98) {
    drawImageAt(ctx, image, transform);
    return;
  }

  ctx.save();
  clipSlashReveal(ctx, canvas, values.slashReveal);
  drawImageAt(ctx, image, transform);
  ctx.restore();
}

function drawBlackout(ctx, canvas, alpha) {
  if (alpha <= 0.01) return;
  const panel = panelBounds(canvas);
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = "#050505";
  ctx.fillRect(panel.x, panel.y, panel.width, panel.height);
  ctx.restore();
}

function panelBounds(canvas) {
  return {
    x: 34,
    y: 34,
    width: canvas.width - 68,
    height: canvas.height - 68,
  };
}

function drawBladeGlint(ctx, canvas, values, pose) {
  const power = Math.max(values.bladeEnter, values.slashCut);
  if (power <= 0.01 || !pose) return;
  const bladeLine = bladeLineFromPose(canvas, pose);
  if (!bladeLine) return;

  ctx.save();
  ctx.globalAlpha = 0.25 + power * 0.55;
  ctx.lineCap = "round";
  ctx.strokeStyle = "#fffdf8";
  ctx.lineWidth = 6 + values.slashCut * 18;
  ctx.beginPath();
  ctx.moveTo(bladeLine.from[0], bladeLine.from[1]);
  ctx.lineTo(bladeLine.to[0], bladeLine.to[1]);
  ctx.stroke();

  ctx.restore();
}

function bladeLineFromPose(canvas, pose) {
  const shoulder = pose.attackerStrikeShoulder;
  const hand = pose.attackerStrikeHand;
  if (!shoulder || !hand) return null;
  const dx = hand[0] - shoulder[0];
  const dy = hand[1] - shoulder[1];
  const length = Math.hypot(dx, dy) || 1;
  const ux = -dx / length;
  const uy = dy / length;
  const panel = panelBounds(canvas);
  const start = [panel.x + panel.width - 76, panel.y + 72];

  return {
    from: start,
    to: [start[0] + ux * 760, start[1] + uy * 760],
  };
}

function drawSlashTear(ctx, canvas, values) {
  if (values.slashCut <= 0.01) return;
  const reveal = values.slashReveal;
  const width = lerp(36, 250, reveal) * values.slashCut;
  const x = lerp(160, 690, reveal);

  ctx.save();
  ctx.globalAlpha = 0.18 + values.slashCut * 0.38;
  ctx.fillStyle = "#fffdf8";
  ctx.beginPath();
  ctx.moveTo(x - width, -40);
  ctx.lineTo(x + width * 0.55, -40);
  ctx.lineTo(x + width * 1.15, canvas.height + 40);
  ctx.lineTo(x - width * 0.65, canvas.height + 40);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function clipSlashReveal(ctx, canvas, reveal) {
  const x = lerp(130, canvas.width + 260, reveal);
  const spread = lerp(90, 430, reveal);
  ctx.beginPath();
  ctx.moveTo(x - spread, -80);
  ctx.lineTo(x + spread * 0.42, -80);
  ctx.lineTo(x + spread, canvas.height + 80);
  ctx.lineTo(x - spread * 0.75, canvas.height + 80);
  ctx.closePath();
  ctx.clip();
}
