{
  const global = window;
  const Animotion = global.Animotion;
  const selectors = Animotion.selectors;

  function selectAll() {
    return Object.fromEntries(
      Object.entries(selectors)
        .filter(([key]) => key !== "sourceCanvas" && key !== "previewCanvas")
        .map(([key, selector]) => [key, document.querySelector(selector)])
    );
  }

  const sourceCanvas = document.querySelector(selectors.sourceCanvas);
  const previewCanvas = document.querySelector(selectors.previewCanvas);

  Animotion.dom = {
    sourceCanvas,
    previewCanvas,
    sourceCtx: sourceCanvas.getContext("2d"),
    previewCtx: previewCanvas.getContext("2d"),
    els: selectAll(),
  };

  Animotion.state = {
    image: null,
    imageName: "",
    nextImage: null,
    selection: null,
    drag: null,
    previewDrag: null,
    parts: [],
    selectedPartId: null,
    running: true,
    startTime: performance.now(),
    pausedTime: 0,
    currentFrame: 1,
    cutsceneBridge: null,
    lookismPreset: null,
    panelEditTarget: "source",
    panelSetup: {
      source: { crop: null, characterMask: null },
      impact: { crop: null, characterMask: null },
    },
    motionPlan: { template: "kick", target: null, targetMode: false },
    separateCharacter: false,
    exporting: false,
    sourceView: null,
    previewView: null,
    sourceZoom: 1,
    sourcePan: { x: 0, y: 0 },
    spaceDown: false,
  };

  Animotion.imageBounds = function imageBounds() {
    if (Animotion.panelEditor) return Animotion.panelEditor.imageBounds();
    const image = Animotion.state.image;
    return image ? { width: image.naturalWidth, height: image.naturalHeight } : { width: 1, height: 1 };
  };
}
