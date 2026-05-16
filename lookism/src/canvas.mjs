export function drawPaper(ctx, canvas) {
  ctx.fillStyle = "#fffdf8";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.save();
  ctx.strokeStyle = "rgba(17, 16, 15, 0.08)";
  for (let y = 30; y < canvas.height; y += 30) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(canvas.width, y);
    ctx.stroke();
  }
  ctx.restore();
}

export function drawImageAt(ctx, image, transform) {
  const { x, y, scaleX, scaleY, rotation, alpha } = transform;
  const width = image.width * scaleX;
  const height = image.height * scaleY;
  ctx.save();
  ctx.globalAlpha = alpha ?? 1;
  ctx.translate(x, y);
  ctx.rotate(rotation ?? 0);
  ctx.drawImage(image, -width / 2, -height / 2, width, height);
  ctx.restore();
}

export function drawPanelMask(ctx, canvas) {
  ctx.save();
  ctx.strokeStyle = "#10100f";
  ctx.lineWidth = 18;
  ctx.strokeRect(9, 9, canvas.width - 18, canvas.height - 18);
  ctx.lineWidth = 2;
  ctx.globalAlpha = 0.28;
  ctx.strokeRect(34, 34, canvas.width - 68, canvas.height - 68);
  ctx.restore();
}

export function drawSpeedLines(ctx, power) {
  ctx.save();
  ctx.globalAlpha = 0.12 + power * 0.32;
  ctx.strokeStyle = "#141414";
  ctx.lineWidth = 1.2 + power * 4.8;
  for (let i = 0; i < 34; i += 1) {
    const y = 36 + i * 24;
    const offset = (i % 7) * 42;
    drawLine(ctx, [-160 + offset, y + power * 120], [560 + offset + power * 360, y - 300 * power]);
  }
  ctx.restore();
}

export function drawInkField(ctx, power) {
  ctx.save();
  ctx.globalAlpha = 0.08 + power * 0.14;
  ctx.fillStyle = "#10100f";
  for (let i = 0; i < 18; i += 1) {
    const radius = 2 + ((i * 7) % 18) * power;
    ctx.beginPath();
    ctx.ellipse(140 + i * 61 + power * 70, 630 - ((i * 47) % 270), radius * 1.8, radius, -0.7, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

export function drawTrajectory(ctx, points, progressValue) {
  ctx.save();
  ctx.globalAlpha = 0.28;
  ctx.strokeStyle = "#811515";
  ctx.lineWidth = 3;
  ctx.setLineDash([12, 14]);
  ctx.beginPath();
  ctx.moveTo(points[0][0], points[0][1]);
  for (let i = 1; i < points.length; i += 1) {
    ctx.lineTo(points[i][0], points[i][1]);
  }
  ctx.stroke();
  ctx.setLineDash([]);
  drawMarker(ctx, points, progressValue);
  ctx.restore();
}

function drawLine(ctx, from, to) {
  ctx.beginPath();
  ctx.moveTo(from[0], from[1]);
  ctx.lineTo(to[0], to[1]);
  ctx.stroke();
}

function drawMarker(ctx, points, progressValue) {
  const index = Math.min(points.length - 1, Math.floor(progressValue * (points.length - 1)));
  const point = points[index];
  ctx.globalAlpha = 0.9;
  ctx.fillStyle = "#c32222";
  ctx.beginPath();
  ctx.arc(point[0], point[1], 6, 0, Math.PI * 2);
  ctx.fill();
}
