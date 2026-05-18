{
  const global = typeof window !== "undefined" ? window : globalThis;
  const Animotion = global.Animotion || (global.Animotion = {});
  const DEFAULT_ENDPOINT = "http://127.0.0.1:8787/hidden-completion/generate";
  const DEFAULT_PROVIDER_CONFIG = {
    provider: "stability-image-edit",
    apiKeyEnvName: "STABILITY_API_KEY",
    outputFormat: "png",
    promptVersion: "stability-hidden-completion-v1",
  };

  async function generateActiveHiddenCompletion(assetId = activeAssetId()) {
    if (!assetId || !Animotion.state?.project || !Animotion.state?.image) return null;
    const request = Animotion.hiddenCompletionRequest.buildHiddenCompletionRequest(Animotion.state.project, assetId, {
      promptVersion: DEFAULT_PROVIDER_CONFIG.promptVersion,
    });
    const images = await renderRequestImages(request, Animotion.state.image);
    const result = await requestLocalGeneration({
      request,
      sourceImage: images.sourceImage,
      maskImage: images.maskImage,
      providerConfig: DEFAULT_PROVIDER_CONFIG,
    });
    if (result.status === "queued") return result;
    const write = Animotion.hiddenCompletionResult.writeHiddenCompletionResult(Animotion.state.project, assetId, result, {
      inputAssetIds: ["source-image", assetId],
      promptVersion: result.rawProviderMetadata?.promptVersion || DEFAULT_PROVIDER_CONFIG.promptVersion,
    });
    Animotion.ui?.refreshUi?.();
    return { ...result, generatedAssetId: write.generatedAssetId };
  }

  async function requestLocalGeneration(payload, options = {}) {
    const endpoint = options.endpoint || DEFAULT_ENDPOINT;
    try {
      const response = await (options.fetchImpl || fetch)(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!response.ok) throw new Error(await responseText(response));
      return Animotion.hiddenCompletionResult.normalizeProviderResult(await response.json());
    } catch (error) {
      return {
        status: "queued",
        reason: "provider-unavailable",
        message: `Hidden completion provider unavailable: ${error.message}`,
      };
    }
  }

  async function renderRequestImages(request, sourceImage) {
    const prepared = Animotion.hiddenCompletionPrep.prepareHiddenCompletionImages({ request, sourceImage });
    const sourceCanvas = canvasFor(prepared.sourceImage.width, prepared.sourceImage.height);
    sourceCanvas.getContext("2d").drawImage(
      sourceImage,
      prepared.sourceImage.cropRect.x,
      prepared.sourceImage.cropRect.y,
      prepared.sourceImage.cropRect.w,
      prepared.sourceImage.cropRect.h,
      0,
      0,
      prepared.sourceImage.width,
      prepared.sourceImage.height
    );
    const maskCanvas = canvasFor(prepared.maskImage.width, prepared.maskImage.height);
    drawMask(maskCanvas.getContext("2d"), prepared.maskImage.polygonPoints);
    return {
      sourceImage: await imagePayload(sourceCanvas),
      maskImage: await imagePayload(maskCanvas),
    };
  }

  function drawMask(ctx, points) {
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    ctx.fillStyle = "black";
    ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    if (!points?.length) return;
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (const point of points.slice(1)) ctx.lineTo(point.x, point.y);
    ctx.closePath();
    ctx.fillStyle = "white";
    ctx.fill();
  }

  async function imagePayload(canvas) {
    const dataUrl = await canvasDataUrl(canvas);
    return {
      width: canvas.width,
      height: canvas.height,
      imageBase64: dataUrl.replace(/^data:[^;]+;base64,/, ""),
      mimeType: "image/png",
    };
  }

  function canvasDataUrl(canvas) {
    if (canvas.toBlob) {
      return new Promise((resolve, reject) => {
        canvas.toBlob((blob) => {
          if (!blob) return reject(new Error("failed to encode hidden completion image"));
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result);
          reader.onerror = () => reject(reader.error);
          reader.readAsDataURL(blob);
        }, "image/png");
      });
    }
    return Promise.resolve(canvas.toDataURL("image/png"));
  }

  function canvasFor(width, height) {
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(width));
    canvas.height = Math.max(1, Math.round(height));
    return canvas;
  }

  function activeAssetId() {
    return Animotion.motionDraftEditor?.activeDraftContext?.()?.draft?.hiddenCompletion?.assetId || null;
  }

  async function responseText(response) {
    try {
      return await response.text();
    } catch (_error) {
      return response.statusText || "provider request failed";
    }
  }

  Animotion.hiddenCompletionClient = {
    DEFAULT_ENDPOINT,
    generateActiveHiddenCompletion,
    requestLocalGeneration,
    renderRequestImages,
  };
  if (typeof module !== "undefined") module.exports = Animotion.hiddenCompletionClient;
}
