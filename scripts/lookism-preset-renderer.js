{
  const global = window;
  const Animotion = global.Animotion;
  const state = Animotion.state;
  const data = Animotion.lookismPresetData;
  const action = Animotion.lookismPresetAction;

  function drawPreview(ctx, width, height, now) {
    const preset = state.lookismPreset;
    if (!preset?.active) return;
    const fit = Animotion.geometry.fitRect(data.VIRTUAL_STAGE.width, data.VIRTUAL_STAGE.height, width, height);
    const time = currentTime(now);
    const sample = action.sampleAction(time);
    const values = action.cutsceneValues(time);
    syncFrame(time, sample.beat.label);
    drawScene(ctx, { width, height, fit, sample, values, preset });
    preset.lastTime = time;
  }

  function currentTime(now) {
    if (state.running && state.exporting) return exportTime(now);
    if (state.running) return (((now - state.startTime) / 1000) % data.DURATION + data.DURATION) % data.DURATION;
    const frameCount = Animotion.cutsceneModel.normalizeBridge(state.cutsceneBridge).durationFrames;
    return ((state.currentFrame - 1) / Math.max(1, frameCount - 1)) * data.DURATION;
  }

  function exportTime(now) {
    const elapsedMs = now - state.startTime;
    const ratio = action.clamp(elapsedMs / data.EXPORT_MOTION_MS, 0, 1);
    return ratio * data.DURATION;
  }

  function syncFrame(time, label) {
    if (!state.running) return;
    const { els } = Animotion.dom;
    const frameCount = Animotion.cutsceneModel.normalizeBridge(state.cutsceneBridge).durationFrames;
    state.currentFrame = Math.min(frameCount, Math.floor((time / data.DURATION) * frameCount) + 1);
    els.currentFrame.value = String(state.currentFrame);
    els.frameLabel.textContent = String(state.currentFrame);
    if (state.lookismPreset) state.lookismPreset.beatLabel = label;
  }

  function drawScene(ctx, args) {
    ctx.fillStyle = "#151515";
    ctx.fillRect(0, 0, args.width, args.height);
    ctx.save();
    ctx.translate(args.fit.x, args.fit.y);
    ctx.scale(args.fit.scale, args.fit.scale);
    drawPaper(ctx);
    ctx.translate(args.values.shake, -args.values.shake * 0.28);
    drawMotionEffects(ctx, args.values);
    drawCharacterLayers(ctx, args.preset, args.sample, args.values);
    drawFlash(ctx, args.values.n);
    drawPanelMask(ctx);
    ctx.restore();
  }

  function drawMotionEffects(ctx, values) {
    drawSpeedLines(ctx, values.launch);
    drawInkField(ctx, values.launch);
    drawTrajectory(ctx, data.ACTION.beats.map((beat) => beat.pose.hip), values.n);
  }

  function drawCharacterLayers(ctx, preset, sample, values) {
    drawReadyLayer(ctx, preset.sprites.ready, values);
    drawRigBridge(ctx, preset.rig, sample, values);
    drawImpact(ctx, preset.sprites.impact, values);
  }

  function drawReadyLayer(ctx, image, values) {
    const transform = readyTransform(values);
    if (transform.alpha <= 0.02) return;
    if (ghostEnabled()) for (let i = 3; i >= 1; i -= 1) drawImageAt(ctx, image, ghostTransform(transform, i, values.launch));
    drawImageAt(ctx, image, transform);
  }

  function readyTransform(values) {
    return {
      x: action.lerp(292, 448, values.launch),
      y: action.lerp(422 + values.crouch * 30, 334, values.launch),
      scaleX: action.lerp(1.25 + values.crouch * 0.12, 0.88, values.launch),
      scaleY: action.lerp(1.16 - values.crouch * 0.1, 0.94, values.launch),
      rotation: action.lerp(-0.06 - values.crouch * 0.1, -0.4, values.launch),
      alpha: values.readyAlpha,
    };
  }

  function ghostTransform(base, index, launch) {
    const ghost = index / 4;
    return {
      x: base.x - 58 * index * launch,
      y: base.y + 34 * index * launch,
      scaleX: base.scaleX * (1 + ghost * 0.06),
      scaleY: base.scaleY * (1 - ghost * 0.05),
      rotation: base.rotation + ghost * 0.12,
      alpha: base.alpha * launch * 0.16 * (4 - index),
    };
  }

  function drawRigBridge(ctx, rig, sample, values) {
    const alpha = rigAlpha(values.n);
    if (alpha <= 0.01) return;
    const scale = action.lerp(1.44, 1.62, action.smoothstep(action.clamp((values.n - 0.4) / 0.38, 0, 1)));
    if (ghostEnabled()) drawRigGhosts(ctx, rig, scale, alpha);
    drawRigLayer(ctx, rig, sample.pose, { scale, alpha, drawOrder: data.DRAW_ORDER });
  }

  function ghostEnabled() {
    return Animotion.cutsceneModel.normalizeBridge(state.cutsceneBridge).ghostEnabled;
  }

  function rigAlpha(n) {
    const alphaIn = action.smoothstep(action.clamp((n - 0.18) / 0.14, 0, 1));
    const alphaOut = 1 - action.smoothstep(action.clamp((n - 0.78) / 0.12, 0, 1));
    return alphaIn * alphaOut;
  }

  function drawRigGhosts(ctx, rig, scale, alpha) {
    for (const delay of Animotion.cutsceneModel.GHOST_DELAYS) {
      const lastTime = state.lookismPreset?.lastTime || 0;
      const ghostTime = action.clamp(lastTime - delay, 0, data.DURATION);
      drawRigLayer(ctx, rig, action.sampleAction(ghostTime).pose, { scale, alpha: alpha * Animotion.cutsceneModel.GHOST_ALPHA_RATIO });
    }
  }

  function drawImpact(ctx, image, values) {
    drawImageAt(ctx, image, {
      x: action.lerp(670, 590, values.finalSnap),
      y: action.lerp(360, 356, values.finalSnap),
      scaleX: action.lerp(0.88, 0.94, values.finalSnap),
      scaleY: action.lerp(0.88, 0.94, values.finalSnap),
      rotation: action.lerp(0.1, 0, values.finalSnap),
      alpha: values.impactAlpha,
    });
  }

  function drawRigLayer(ctx, rig, pose, options = {}) {
    const parts = orderedParts(rig.manifest, options.drawOrder);
    for (const part of parts) drawRigPart(ctx, rig, pose, part, options);
  }

  function drawRigPart(ctx, rig, pose, part, options) {
    const link = resolveRigLink(rig.links[part.name]);
    const image = rig.images[part.name];
    if (!part || !image || !link) return;
    const scale = options.scale ?? 1;
    const localPivot = [(part.pivot.x - part.bounds.x) * scale, (part.pivot.y - part.bounds.y) * scale];
    ctx.save();
    ctx.globalAlpha = options.alpha ?? 1;
    ctx.translate(pose[link.pivotKey][0], pose[link.pivotKey][1]);
    ctx.rotate(partRotation(pose, link));
    ctx.drawImage(image, -localPivot[0], -localPivot[1], image.width * scale, image.height * scale);
    ctx.restore();
  }

  function partRotation(pose, link) {
    return angleBetween(pose[link.angleFromKey], pose[link.angleToKey]) - angleBetween(link.sourceFrom, link.sourceTo);
  }

  function orderedParts(manifest, drawOrder = null) {
    if (!drawOrder) return [...manifest.parts];
    const partsByName = new Map(manifest.parts.map((part) => [part.name, part]));
    return drawOrder.map((name) => partsByName.get(name)).filter(Boolean);
  }

  function resolveRigLink(link) {
    if (!link) return null;
    const [pivotKey, targetKey, sourceFrom, sourceTo, angleFromKey, angleToKey] = link;
    return {
      pivotKey,
      targetKey,
      sourceFrom,
      sourceTo,
      angleFromKey: angleFromKey ?? pivotKey,
      angleToKey: angleToKey ?? targetKey,
    };
  }

  function drawPaper(ctx) {
    ctx.fillStyle = "#fffdf8";
    ctx.fillRect(0, 0, data.VIRTUAL_STAGE.width, data.VIRTUAL_STAGE.height);
    ctx.save();
    ctx.strokeStyle = "rgba(17, 16, 15, 0.08)";
    for (let y = 30; y < data.VIRTUAL_STAGE.height; y += 30) drawLine(ctx, 0, y, data.VIRTUAL_STAGE.width, y);
    ctx.restore();
  }

  function drawImageAt(ctx, image, transform) {
    const width = image.width * transform.scaleX;
    const height = image.height * transform.scaleY;
    ctx.save();
    ctx.globalAlpha = transform.alpha ?? 1;
    ctx.translate(transform.x, transform.y);
    ctx.rotate(transform.rotation ?? 0);
    ctx.drawImage(image, -width / 2, -height / 2, width, height);
    ctx.restore();
  }

  function drawPanelMask(ctx) {
    ctx.save();
    ctx.strokeStyle = "#10100f";
    ctx.lineWidth = 18;
    ctx.strokeRect(9, 9, data.VIRTUAL_STAGE.width - 18, data.VIRTUAL_STAGE.height - 18);
    ctx.lineWidth = 2;
    ctx.globalAlpha = 0.28;
    ctx.strokeRect(34, 34, data.VIRTUAL_STAGE.width - 68, data.VIRTUAL_STAGE.height - 68);
    ctx.restore();
  }

  function drawSpeedLines(ctx, power) {
    ctx.save();
    ctx.globalAlpha = 0.12 + power * 0.32;
    ctx.strokeStyle = "#141414";
    ctx.lineWidth = 1.2 + power * 4.8;
    for (let i = 0; i < 34; i += 1) drawSpeedLine(ctx, i, power);
    ctx.restore();
  }

  function drawSpeedLine(ctx, index, power) {
    const y = 36 + index * 24;
    const offset = (index % 7) * 42;
    drawLine(ctx, -160 + offset, y + power * 120, 560 + offset + power * 360, y - 300 * power);
  }

  function drawInkField(ctx, power) {
    ctx.save();
    ctx.globalAlpha = 0.08 + power * 0.14;
    ctx.fillStyle = "#10100f";
    for (let i = 0; i < 18; i += 1) drawInkSpot(ctx, i, power);
    ctx.restore();
  }

  function drawInkSpot(ctx, index, power) {
    const radius = 2 + ((index * 7) % 18) * power;
    ctx.beginPath();
    ctx.ellipse(140 + index * 61 + power * 70, 630 - ((index * 47) % 270), radius * 1.8, radius, -0.7, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawTrajectory(ctx, points, progressValue) {
    ctx.save();
    ctx.globalAlpha = 0.28;
    ctx.strokeStyle = "#811515";
    ctx.lineWidth = 3;
    ctx.setLineDash([12, 14]);
    drawTrajectoryPath(ctx, points);
    ctx.setLineDash([]);
    drawTrajectoryMarker(ctx, points, progressValue);
    ctx.restore();
  }

  function drawTrajectoryPath(ctx, points) {
    ctx.beginPath();
    ctx.moveTo(points[0][0], points[0][1]);
    for (let i = 1; i < points.length; i += 1) ctx.lineTo(points[i][0], points[i][1]);
    ctx.stroke();
  }

  function drawTrajectoryMarker(ctx, points, progressValue) {
    const index = Math.min(points.length - 1, Math.floor(progressValue * (points.length - 1)));
    ctx.globalAlpha = 0.9;
    ctx.fillStyle = "#c32222";
    ctx.beginPath();
    ctx.arc(points[index][0], points[index][1], 6, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawFlash(ctx, n) {
    if (n <= 0.76) return;
    ctx.save();
    ctx.globalAlpha = (n - 0.76) / 0.24;
    ctx.fillStyle = "rgba(255, 255, 255, 0.36)";
    ctx.fillRect(0, 0, data.VIRTUAL_STAGE.width, data.VIRTUAL_STAGE.height);
    ctx.restore();
  }

  function drawLine(ctx, x1, y1, x2, y2) {
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  }

  function angleBetween(a, b) {
    return Math.atan2(b[1] - a[1], b[0] - a[0]);
  }

  Animotion.lookismPresetRenderer = { drawPreview };
}
