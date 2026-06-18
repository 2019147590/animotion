{
  const global = typeof window !== "undefined" ? window : globalThis;
  const Animotion = global.Animotion || (global.Animotion = {});

  async function clipFromCurrentState(state = Animotion.state, options = {}) {
    const bridge = normalizedCurrentBridge(state);
    if (!bridge?.jointAction || !Array.isArray(state?.parts) || !state.parts.length) return null;
    const video = await safeRecordCurrentPreview(state, bridge, options);
    if (!video.ok) return { ok: false, reason: video.reason };
    const id = String(options.id || `cutscene-${Date.now()}`);
    const name = String(options.name || nextClipName(state.actionSequenceClips));
    return {
      id,
      name,
      source: "saved-video-cutscene",
      primaryPartId: bridge.primaryPartId,
      durationFrames: bridge.durationFrames,
      impactFrame: bridge.impactFrame,
      mimeType: video.mimeType,
      videoBlob: video.blob,
      videoUrl: video.url,
      durationMs: video.durationMs,
      capturedVideo: true,
    };
  }

  async function safeRecordCurrentPreview(state, bridge, options) {
    try {
      return await recordCurrentPreview(state, bridge, options);
    } catch (error) {
      return { ok: false, reason: "video-recording-failed" };
    }
  }

  function clearLoadedJsonState(state = Animotion.state) {
    if (!state) return { ok: false, reason: "missing-state" };
    const clips = Array.isArray(state.actionSequenceClips) ? state.actionSequenceClips : [];
    const sequence = state.actionSequence || { steps: [] };
    const project = emptyProjectForCurrentImage(state);
    Object.assign(state, {
      project,
      parts: project.parts,
      selection: null,
      drag: null,
      previewDrag: null,
      selectedPartId: null,
      editTarget: { kind: "part", partId: null, maskId: null },
      currentFrame: 1,
      cutsceneBridge: null,
      actionFrameSelection: null,
      trajectoryDrag: null,
      selectedEditPoint: null,
      hoveredEditPoint: null,
      previewDrawSequenceDebug: null,
      motionEvaluationDebug: null,
      motionRegenerationDebug: null,
      renderedPointDebug: [],
      motionPlan: defaultMotionPlan(),
      actionSequence: sequence,
      actionSequenceClips: clips,
    });
    if (Animotion.dom?.els?.motionTemplate) Animotion.dom.els.motionTemplate.value = "keyframes";
    Animotion.commandHistory?.clear?.();
    return { ok: true };
  }

  function nextClipName(clips = []) {
    return `cutscene${Array.isArray(clips) ? clips.length + 1 : 1}`;
  }

  async function playSequence(sequence = {}, clips = [], options = {}) {
    const ordered = orderedVideoClips(sequence, clips);
    if (!ordered.length) return { ok: false, reason: "missing-video-clip" };
    const video = options.video || ensurePreviewVideo();
    if (!video) return { ok: false, reason: "missing-video-player" };
    try {
      for (const clip of ordered) {
        await prepareClip(video, clip);
        setPreviewPlayback(video, clip);
        await playPreparedClip(video);
      }
      return { ok: true, count: ordered.length };
    } catch (error) {
      return { ok: false, reason: "video-playback-failed" };
    } finally {
      clearPreviewPlayback(video);
    }
  }

  function drawPreviewPlayback(ctx, size) {
    const playback = Animotion.state?.actionSequenceVideoPlayback;
    const video = playback?.video;
    if (!playback?.active || !video) return false;
    if (!videoIsDrawable(video)) return false;
    ctx.fillStyle = "#151515";
    ctx.fillRect(0, 0, size.w, size.h);
    drawVideoFrame(ctx, video, size);
    return true;
  }

  function normalizedCurrentBridge(state) {
    if (!state?.cutsceneBridge) return null;
    const imageBounds = state.image ? { width: state.image.naturalWidth, height: state.image.naturalHeight } : null;
    return Animotion.cutsceneModel?.normalizeBridge?.(state.cutsceneBridge, {
      imageBounds,
      assets: state.project?.assets,
    }) || null;
  }

  async function recordCurrentPreview(state, bridge, options) {
    const canvas = options.canvas || Animotion.dom?.previewCanvas;
    const Recorder = options.MediaRecorder || global.MediaRecorder;
    if (!canvas?.captureStream || typeof Recorder === "undefined") return { ok: false, reason: "unsupported-video-recording" };
    const durationMs = Math.max(120, Math.round((bridge.durationFrames / Animotion.config.timelineFps) * 1000));
    const mimeType = supportedMimeType(Recorder);
    const chunks = [];
    const recorder = new Recorder(canvas.captureStream(Animotion.config.exportFps), mimeType ? { mimeType } : undefined);
    recorder.ondataavailable = (event) => { if (event.data?.size) chunks.push(event.data); };
    const stopped = stoppedRecorder(recorder);
    const restore = beginRecordingState(state);
    try {
      await waitForRenderFrame();
      recorder.start(250);
      await sleep(durationMs);
      if (recorder.state === "recording") recorder.requestData();
      if (recorder.state === "recording") recorder.stop();
      await stopped;
      if (!chunks.length) return { ok: false, reason: "empty-video-recording" };
      const blob = new Blob(chunks, { type: recorder.mimeType || mimeType || "video/webm" });
      return { ok: true, blob, url: URL.createObjectURL(blob), mimeType: blob.type, durationMs };
    } finally {
      restore();
    }
  }

  function beginRecordingState(state) {
    const previous = { running: state.running, startTime: state.startTime, exporting: state.exporting, template: Animotion.dom?.els?.motionTemplate?.value };
    if (Animotion.dom?.els?.motionTemplate) Animotion.dom.els.motionTemplate.value = "cutscene";
    Object.assign(state, { running: true, exporting: true, startTime: performance.now() });
    return () => {
      state.running = previous.running;
      state.startTime = previous.startTime;
      state.exporting = previous.exporting;
      if (Animotion.dom?.els?.motionTemplate && previous.template) Animotion.dom.els.motionTemplate.value = previous.template;
    };
  }

  function stoppedRecorder(recorder) {
    return new Promise((resolve, reject) => {
      recorder.onstop = resolve;
      recorder.onerror = () => reject(new Error(recorder.error?.message || "video-recorder-error"));
    });
  }

  function orderedVideoClips(sequence, clips) {
    const byId = new Map((clips || []).map((clip) => [clip.id, clip]));
    return (sequence.steps || []).map((step) => byId.get(step.clipId)).filter((clip) => clip?.videoUrl);
  }

  async function prepareClip(video, clip) {
    if (video.src !== clip.videoUrl) video.src = clip.videoUrl;
    video.currentTime = 0;
    video.load?.();
    await waitForVideoReady(video);
  }

  function playPreparedClip(video) {
    return new Promise((resolve, reject) => {
      video.onended = resolve;
      video.onerror = () => reject(new Error("video-playback-error"));
      video.play().catch(reject);
    });
  }

  function ensurePreviewVideo() {
    if (typeof document === "undefined") return null;
    if (Animotion.state?.actionSequencePreviewVideo) return Animotion.state.actionSequencePreviewVideo;
    const video = document.createElement("video");
    Object.assign(video, { muted: true, playsInline: true, preload: "auto" });
    Object.assign(video.style, { position: "fixed", width: "1px", height: "1px", opacity: "0", pointerEvents: "none" });
    document.body.append(video);
    Animotion.state.actionSequencePreviewVideo = video;
    return video;
  }

  function setPreviewPlayback(video, clip) {
    Animotion.state.actionSequenceVideoPlayback = { active: true, video, clip };
  }

  function clearPreviewPlayback(video) {
    if (video) video.pause?.();
    Animotion.state.actionSequenceVideoPlayback = null;
  }

  function drawVideoFrame(ctx, video, size) {
    const bounds = fitRect(video.videoWidth || size.w, video.videoHeight || size.h, size.w, size.h);
    ctx.drawImage(video, bounds.x, bounds.y, bounds.w, bounds.h);
  }

  function fitRect(srcW, srcH, dstW, dstH) {
    const scale = Math.min(dstW / Math.max(1, srcW), dstH / Math.max(1, srcH));
    const w = srcW * scale, h = srcH * scale;
    return { x: (dstW - w) / 2, y: (dstH - h) / 2, w, h };
  }

  function supportedMimeType(Recorder) {
    return ["video/webm;codecs=vp8", "video/webm;codecs=vp9", "video/webm"].find((type) => Recorder.isTypeSupported?.(type));
  }

  function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  function waitForRenderFrame() {
    const root = typeof globalThis !== "undefined" ? globalThis : global;
    const raf = global.requestAnimationFrame || root.requestAnimationFrame || global.setTimeout || root.setTimeout;
    return new Promise((resolve) => raf(resolve));
  }

  function waitForVideoReady(video) {
    if (videoIsDrawable(video) || typeof video.addEventListener !== "function") return Promise.resolve();
    return new Promise((resolve, reject) => {
      const ready = () => cleanup(resolve);
      const error = () => cleanup(() => reject(new Error("video-load-error")));
      const cleanup = (done) => {
        video.removeEventListener("loadeddata", ready);
        video.removeEventListener("canplay", ready);
        video.removeEventListener("error", error);
        done();
      };
      video.addEventListener("loadeddata", ready, { once: true });
      video.addEventListener("canplay", ready, { once: true });
      video.addEventListener("error", error, { once: true });
    });
  }

  function videoIsDrawable(video) {
    return video.readyState >= 2 || Boolean(video.videoWidth && video.videoHeight);
  }

  function emptyProjectForCurrentImage(state) {
    return Animotion.projectModel.createEmptyProject({
      name: state.imageName || "Untitled Animotion Project",
      canvas: state.image ? {
        width: state.image.naturalWidth,
        height: state.image.naturalHeight,
      } : state.project?.canvas,
    });
  }

  function defaultMotionPlan() {
    return Animotion.motionPlanner?.normalizePlan?.() || { template: "kick", target: null, targetMode: false };
  }

  function clonePlain(value) {
    return JSON.parse(JSON.stringify(value));
  }

  Animotion.cutsceneClipStore = { clipFromCurrentState, clearLoadedJsonState, nextClipName, playSequence, drawPreviewPlayback };
  if (typeof module !== "undefined") module.exports = Animotion.cutsceneClipStore;
}
