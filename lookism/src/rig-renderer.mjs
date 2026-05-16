import { angleBetween } from "./math.mjs";

export function orderedParts(manifest, drawOrder = null) {
  if (!drawOrder) {
    return [...manifest.parts].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  }
  const partsByName = new Map(manifest.parts.map((part) => [part.name, part]));
  return drawOrder.map((name) => partsByName.get(name)).filter(Boolean);
}

export function drawRigLayer(ctx, rig, pose, options = {}) {
  const { manifest, images, links } = rig;
  const scale = options.scale ?? 1;
  const alpha = options.alpha ?? 1;

  for (const part of orderedParts(manifest, options.drawOrder)) {
    drawRigPart(ctx, { part, image: images[part.name], link: links[part.name], pose, scale, alpha });
  }
}

function drawRigPart(ctx, args) {
  const { part, image, pose, scale, alpha } = args;
  const link = resolveRigLink(args.link);
  if (!part || !image || !link) return;
  const pivot = pose[link.pivotKey];
  const target = pose[link.targetKey];
  const angleFrom = pose[link.angleFromKey];
  const angleTo = pose[link.angleToKey];
  const localPivot = [(part.pivot.x - part.bounds.x) * scale, (part.pivot.y - part.bounds.y) * scale];
  const rotation = angleBetween(angleFrom, angleTo) - angleBetween(link.sourceFrom, link.sourceTo);

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(pivot[0], pivot[1]);
  ctx.rotate(rotation);
  ctx.drawImage(image, -localPivot[0], -localPivot[1], image.width * scale, image.height * scale);
  ctx.restore();
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
