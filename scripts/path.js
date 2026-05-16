{
  const global = window;
  const Animotion = global.Animotion;
  const { localBounds } = Animotion.geometry;
  const { ellipse } = Animotion.shapeKind;

  function pathFromShape(shape, offsetX = 0, offsetY = 0) {
    const path = new Path2D();
    if (!shape || shape.points.length === 0) return path;

    if (shape.kind === ellipse) {
      const bounds = localBounds(shape.points);
      path.ellipse(
        offsetX + bounds.x + bounds.w / 2,
        offsetY + bounds.y + bounds.h / 2,
        Math.max(1, bounds.w / 2),
        Math.max(1, bounds.h / 2),
        0,
        0,
        Math.PI * 2
      );
      return path;
    }

    path.moveTo(offsetX + shape.points[0].x, offsetY + shape.points[0].y);
    for (let i = 1; i < shape.points.length; i += 1) {
      path.lineTo(offsetX + shape.points[i].x, offsetY + shape.points[i].y);
    }
    if (shape.closed) path.closePath();
    return path;
  }

  Animotion.path = { pathFromShape };
}
