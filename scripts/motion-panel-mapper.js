{
  const global = typeof window !== "undefined" ? window : globalThis;
  const Animotion = global.Animotion || (global.Animotion = {});

  function currentImpactToSourcePoint(point) {
    return panelPointToSourceTarget(point, {
      sourceFrame: Animotion.previewTransform?.sourceFrame?.(),
      sourceTransform: sourceTransform(),
      impactFrame: impactFrame(),
      impactTransform: impactTransform(),
      view: Animotion.state?.previewView,
    });
  }

  function panelPointToSourceTarget(point, context = {}) {
    const { sourceFrame, sourceTransform, impactFrame, impactTransform, view } = context;
    if (!point || !sourceFrame || !impactFrame || !view) return null;
    const screen = panelPointToScreen(point, view, impactFrame, impactTransform);
    return screenToPanelPoint(screen, view, sourceFrame, sourceTransform);
  }

  function panelPointToScreen(point, view, frame, transform = {}) {
    const scale = panelScale(view, frame, transform);
    const center = panelCenter(view, transform);
    const local = rotate({
      x: point.x - frame.x - frame.w * 0.5,
      y: point.y - frame.y - frame.h * 0.5,
    }, Number(transform.rotation) || 0);
    return { x: center.x + local.x * scale, y: center.y + local.y * scale };
  }

  function screenToPanelPoint(screen, view, frame, transform = {}) {
    const scale = panelScale(view, frame, transform);
    const center = panelCenter(view, transform);
    const local = rotate({
      x: (screen.x - center.x) / scale,
      y: (screen.y - center.y) / scale,
    }, -(Number(transform.rotation) || 0));
    return {
      x: Math.round(frame.x + frame.w * 0.5 + local.x),
      y: Math.round(frame.y + frame.h * 0.5 + local.y),
    };
  }

  function panelScale(view, frame, transform = {}) {
    return Math.min(view.w / frame.sourceWidth, view.h / frame.sourceHeight) * (Number(transform.scale) || 1);
  }

  function panelCenter(view, transform = {}) {
    return {
      x: view.x + view.w * 0.5 + (Number(transform.x) || 0),
      y: view.y + view.h * 0.5 + (Number(transform.y) || 0),
    };
  }

  function rotate(point, radians) {
    const c = Math.cos(radians);
    const s = Math.sin(radians);
    return { x: point.x * c - point.y * s, y: point.x * s + point.y * c };
  }

  function sourceTransform() {
    const bridge = Animotion.cutsceneModel?.normalizeBridge?.(Animotion.state?.cutsceneBridge) || {};
    return { x: bridge.sourceX, y: bridge.sourceY, scale: bridge.sourceScale };
  }

  function impactTransform() {
    const bridge = Animotion.cutsceneModel?.normalizeBridge?.(Animotion.state?.cutsceneBridge) || {};
    return { x: bridge.impactX, y: bridge.impactY, scale: bridge.impactScale };
  }

  function impactFrame() {
    const image = Animotion.state?.nextImage;
    if (!image) return null;
    const crop = Animotion.panelEditor?.setupFor?.("impact")?.crop;
    const frame = crop || { x: 0, y: 0, w: image.naturalWidth, h: image.naturalHeight };
    return { ...frame, sourceWidth: image.naturalWidth, sourceHeight: image.naturalHeight };
  }

  Animotion.motionPanelMapper = { currentImpactToSourcePoint, panelPointToSourceTarget };

  if (typeof module !== "undefined") module.exports = Animotion.motionPanelMapper;
}
