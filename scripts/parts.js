{
  const global = window;
  const Animotion = global.Animotion;
  const state = Animotion.state;
  const { pathFromShape } = Animotion.path;

  function makePartCanvas(rect, mask = null) {
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(rect.w));
    canvas.height = Math.max(1, Math.round(rect.h));
    const ctx = canvas.getContext("2d");
    ctx.drawImage(state.image, rect.x, rect.y, rect.w, rect.h, 0, 0, rect.w, rect.h);
    if (mask) {
      ctx.globalCompositeOperation = "destination-in";
      ctx.fillStyle = "#000";
      ctx.fill(pathFromShape({ ...mask, closed: true }));
      ctx.globalCompositeOperation = "source-over";
    }
    return canvas;
  }

  function updatePartCanvas(part) {
    part.canvas = makePartCanvas(part.rect, part.mask);
  }

  function createPartFromShape(type, shape, name = "", options = {}) {
    return Animotion.partCommands.createPartFromShape(type, shape, name, options);
  }

  function createPart(type, rect, name = "", options = {}) {
    return Animotion.partCommands.createPart(type, rect, name, options);
  }

  function applyShapeToPart(part, shape, options = {}) {
    return Animotion.partCommands.applyShapeToPart(part, shape, options);
  }

  function selectedPart() {
    return state.parts.find((part) => part.id === state.selectedPartId) || null;
  }

  function resetForNewImage(image, imageName) {
    Animotion.sessionCommands.resetForNewImage(image, imageName);
  }

  Animotion.parts = { createPartFromShape, createPart, applyShapeToPart, selectedPart, resetForNewImage, updatePartCanvas };
}
