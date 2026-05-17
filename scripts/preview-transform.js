{
  const global = typeof window !== "undefined" ? window : globalThis;
  const Animotion = global.Animotion || (global.Animotion = {});

  function sourceFrame() {
    const image = Animotion.state?.image;
    if (!image) return null;
    const crop = Animotion.panelEditor?.setupFor?.("source")?.crop;
    const frame = crop || { x: 0, y: 0, w: image.naturalWidth, h: image.naturalHeight };
    return {
      x: frame.x,
      y: frame.y,
      w: frame.w,
      h: frame.h,
      sourceWidth: image.naturalWidth,
      sourceHeight: image.naturalHeight,
    };
  }

  function applySourceFrame(ctx, view, frame, transform = {}) {
    const matrix = sourceMatrix(view, frame, transform);
    ctx.transform(matrix.a, matrix.b, matrix.c, matrix.d, matrix.e, matrix.f);
  }

  function imagePointToScreen(point, view, frame, transform = {}) {
    if (!point || !view || !frame) return null;
    const matrix = sourceMatrix(view, frame, transform);
    const screen = new DOMPoint(point.x, point.y).matrixTransform(matrix);
    return { x: screen.x, y: screen.y };
  }

  function screenPointToImage(point, view, frame, transform = {}) {
    if (!point || !view || !frame) return null;
    const matrix = sourceMatrix(view, frame, transform).inverse();
    const image = new DOMPoint(point.x, point.y).matrixTransform(matrix);
    return { x: image.x, y: image.y };
  }

  function sourceScale(view, frame, transform = {}) {
    return baseScale(view, frame) * (Number(transform.scale) || 1);
  }

  function sourceMatrix(view, frame, transform = {}) {
    const scale = sourceScale(view, frame, transform);
    const rotation = Number(transform.rotation) || 0;
    const center = frameCenter(view, transform);
    return new DOMMatrix()
      .translate(center.x, center.y)
      .rotate(rotation * 180 / Math.PI)
      .scale(scale, scale)
      .translate(-frame.x - frame.w * 0.5, -frame.y - frame.h * 0.5);
  }

  function frameCenter(view, transform) {
    return {
      x: view.x + view.w * 0.5 + (Number(transform.x) || 0),
      y: view.y + view.h * 0.5 + (Number(transform.y) || 0),
    };
  }

  function baseScale(view, frame) {
    return Math.min(view.w / frame.sourceWidth, view.h / frame.sourceHeight);
  }

  Animotion.previewTransform = {
    sourceFrame,
    applySourceFrame,
    imagePointToScreen,
    screenPointToImage,
    sourceScale,
  };

  if (typeof module !== "undefined") module.exports = Animotion.previewTransform;
}
