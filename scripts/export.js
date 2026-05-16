{
  const global = window;
  const Animotion = global.Animotion;
  const state = Animotion.state;

  async function exportWebm() {
    const canvas = Animotion.dom.previewCanvas;
    if (!canvas.captureStream || typeof MediaRecorder === "undefined") {
      alert("이 브라우저는 Canvas WebM 내보내기를 지원하지 않습니다.");
      return;
    }
    let recorder = null;
    const chunks = [];
    try {
      recorder = createRecorder(canvas);
      bindRecorderChunks(recorder, chunks);
      const stopped = stoppedRecorder(recorder);
      beginExportRecording(recorder);
      await new Promise((resolve) => setTimeout(resolve, exportDurationMs()));
      flushRecorder(recorder);
      await stopped;
      finishExport(chunks, recorder.mimeType || "video/webm");
    } catch (error) {
      state.exporting = false;
      alert(`WebM 내보내기에 실패했습니다: ${error.message}`);
    }
  }

  function createRecorder(canvas) {
    const stream = canvas.captureStream(Animotion.config.exportFps);
    const mimeType = ["video/webm;codecs=vp8", "video/webm;codecs=vp9", "video/webm"].find((type) =>
      MediaRecorder.isTypeSupported(type)
    );
    return new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
  }

  function bindRecorderChunks(recorder, chunks) {
    recorder.ondataavailable = (event) => {
      if (event.data.size) chunks.push(event.data);
    };
  }

  function stoppedRecorder(recorder) {
    return new Promise((resolve, reject) => {
      recorder.onstop = resolve;
      recorder.onerror = () => reject(new Error(recorder.error?.message || "MediaRecorder 오류"));
    });
  }

  function beginExportRecording(recorder) {
    state.exporting = true;
    state.running = true;
    state.startTime = performance.now();
    recorder.start(250);
  }

  function flushRecorder(recorder) {
    if (recorder.state !== "recording") return;
    recorder.requestData();
    recorder.stop();
  }

  function finishExport(chunks, mimeType) {
    state.exporting = false;
    if (!chunks.length) {
      alert("녹화된 WebM 데이터가 없습니다. 미리보기가 재생 중인지 확인한 뒤 다시 시도하세요.");
      return;
    }
    const blob = new Blob(chunks, { type: mimeType });
    Animotion.io.downloadUrl(URL.createObjectURL(blob), "animotion-preview.webm");
  }

  function exportDurationMs() {
    if (Animotion.dom.els.motionTemplate.value !== "cutscene") return Animotion.config.exportDurationMs;
    const bridge = Animotion.cutsceneModel.normalizeBridge(state.cutsceneBridge);
    const duration = Math.round((bridge.durationFrames / Animotion.config.timelineFps) * 1000);
    return Math.max(duration, Animotion.config.minWebmDurationMs);
  }

  Animotion.exporter = { exportWebm };
}
