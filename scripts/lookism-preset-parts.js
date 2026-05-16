{
  const global = window;
  const Animotion = global.Animotion;
  const data = Animotion.lookismPresetData;

  const PARENT_BY_NAME = {
    head: "torso",
    front_upper_arm: "torso",
    front_forearm: "front_upper_arm",
    back_upper_arm: "torso",
    back_forearm: "back_upper_arm",
    pelvis: "torso",
    left_thigh: "pelvis",
    left_shin: "left_thigh",
    right_thigh: "pelvis",
    right_shin: "right_thigh",
  };

  function createParts() {
    const parts = data.MANIFEST.parts.map(createPart);
    assignParents(parts);
    return parts;
  }

  function createPart(entry, index) {
    const rect = partRect(entry);
    const link = data.RIG_LINKS[entry.name];
    const part = {
      id: randomId(),
      name: entry.name,
      type: partType(entry.name),
      rect,
      mask: partMask(entry, rect),
      pivot: localPoint(entry.pivot, rect),
      joint: link ? localArrayPoint(link[3], rect) : centerPoint(rect),
      parentId: null,
      order: index + 1,
      alpha: 1,
      hidden: false,
      customMotion: Animotion.motionModel.defaultCustomMotion(),
      keyframes: [],
    };
    Animotion.parts.updatePartCanvas(part);
    return part;
  }

  function assignParents(parts) {
    const byName = new Map(parts.map((part) => [part.name, part]));
    for (const part of parts) {
      const parent = byName.get(PARENT_BY_NAME[part.name]);
      if (parent) part.parentId = parent.id;
    }
  }

  function partMask(entry, rect) {
    const shape = {
      kind: Animotion.shapeKind.polygon,
      closed: true,
      points: pointsFromArray(entry.polygon),
    };
    return Animotion.geometry.shapeToMask(shape, rect);
  }

  function partRect(entry) {
    return {
      x: entry.bounds.x,
      y: entry.bounds.y,
      w: entry.bounds.width,
      h: entry.bounds.height,
    };
  }

  function pointsFromArray(values) {
    const points = [];
    for (let i = 0; i < values.length; i += 2) points.push({ x: values[i], y: values[i + 1] });
    return points;
  }

  function partType(name) {
    if (name === "head") return "head";
    if (name === "torso") return "spine";
    if (name === "pelvis") return "body";
    if (name.includes("arm") || name.includes("forearm")) return "arm";
    if (name.includes("thigh") || name.includes("shin")) return "leg";
    return "prop";
  }

  function localPoint(point, rect) {
    return { x: point.x - rect.x, y: point.y - rect.y };
  }

  function localArrayPoint(point, rect) {
    return { x: point[0] - rect.x, y: point[1] - rect.y };
  }

  function centerPoint(rect) {
    return { x: rect.w * 0.5, y: rect.h * 0.5 };
  }

  function randomId() {
    return global.crypto?.randomUUID ? global.crypto.randomUUID() : `lookism-${Math.random().toString(36).slice(2)}`;
  }

  Animotion.lookismPresetParts = { createParts };
}
