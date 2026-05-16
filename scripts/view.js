{
  const global = window;
  const Animotion = global.Animotion;
  const { clamp, fitRect } = Animotion.geometry;
  const { sourceCanvas, els } = Animotion.dom;
  const state = Animotion.state;

  function loadImageFromFile(file) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("이미지를 불러오지 못했습니다."));
      img.src = URL.createObjectURL(file);
    });
  }

  function sourceImageView(targetW, targetH) {
    if (!state.image) return null;
    const base = fitRect(state.image.naturalWidth, state.image.naturalHeight, targetW, targetH);
    const scale = base.scale * state.sourceZoom;
    const w = state.image.naturalWidth * scale;
    const h = state.image.naturalHeight * scale;
    return {
      x: (targetW - w) / 2 + state.sourcePan.x,
      y: (targetH - h) / 2 + state.sourcePan.y,
      w,
      h,
      scale,
    };
  }

  function resizeCanvas(canvas) {
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const width = Math.max(1, Math.round(rect.width * dpr));
    const height = Math.max(1, Math.round(rect.height * dpr));
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
  }

  function canvasPoint(event, canvas, view) {
    const rect = canvas.getBoundingClientRect();
    if (!view || !state.image) return null;
    return {
      x: clamp((event.clientX - rect.left - view.x) / view.scale, 0, state.image.naturalWidth),
      y: clamp((event.clientY - rect.top - view.y) / view.scale, 0, state.image.naturalHeight),
    };
  }

  function setSourceZoom(nextZoom, anchor = null) {
    const oldZoom = state.sourceZoom;
    const newZoom = clamp(nextZoom, Number(els.sourceZoom.min), Number(els.sourceZoom.max));
    if (!state.image || Math.abs(oldZoom - newZoom) < 0.001) {
      state.sourceZoom = newZoom;
      Animotion.ui.refreshUi();
      return;
    }
    const rect = sourceCanvas.getBoundingClientRect();
    const target = anchor || { x: rect.width / 2, y: rect.height / 2 };
    const before = state.sourceView ? {
      x: (target.x - state.sourceView.x) / state.sourceView.scale,
      y: (target.y - state.sourceView.y) / state.sourceView.scale,
    } : null;
    state.sourceZoom = newZoom;
    if (before) {
      const nextView = sourceImageView(rect.width, rect.height);
      state.sourcePan.x += target.x - (nextView.x + before.x * nextView.scale);
      state.sourcePan.y += target.y - (nextView.y + before.y * nextView.scale);
    }
    Animotion.ui.refreshUi();
  }

  function resetSourceView() {
    state.sourceZoom = 1;
    state.sourcePan = { x: 0, y: 0 };
    Animotion.ui.refreshUi();
  }

  function isTypingTarget(target) {
    return target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement;
  }

  Animotion.view = { loadImageFromFile, sourceImageView, resizeCanvas, canvasPoint, setSourceZoom, resetSourceView, isTypingTarget };
}
