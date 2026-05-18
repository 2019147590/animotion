{
  const global = typeof window !== "undefined" ? window : globalThis;
  const Animotion = global.Animotion || (global.Animotion = {});

  function validateLocalSdWorkerRequest(request = {}) {
    if (request.task !== "hidden_completion_inpaint") throw new Error("Local SD worker request task must be hidden_completion_inpaint");
    requireString(request.prompt, "prompt");
    requireString(request.imageBase64, "imageBase64");
    requireString(request.maskBase64, "maskBase64");
    requireString(request.requestHash, "requestHash");
    requireString(request.promptVersion, "promptVersion");
    optionalNumber(request.width, "width");
    optionalNumber(request.height, "height");
    optionalNumber(request.steps, "steps");
    optionalNumber(request.cfgScale, "cfgScale");
    optionalNumber(request.denoise, "denoise");
    optionalNumber(request.seed, "seed");
    return request;
  }

  function validateLocalSdWorkerResponse(response = {}) {
    if (!response.imageBase64 && !response.imageBytes) throw new Error("Local SD worker response imageBase64 or imageBytes is required");
    if (response.provider && response.provider !== "local-sd-inpaint") throw new Error("Local SD worker response provider must be local-sd-inpaint");
    if (response.warnings !== undefined && !Array.isArray(response.warnings)) throw new Error("Local SD worker response warnings must be an array");
    if (response.rawProviderMetadata !== undefined && typeof response.rawProviderMetadata !== "object") {
      throw new Error("Local SD worker response rawProviderMetadata must be an object");
    }
    return response;
  }

  function requireString(value, field) {
    if (typeof value !== "string" || value.length === 0) throw new Error(`Local SD worker request ${field} is required`);
  }

  function optionalNumber(value, field) {
    if (value !== null && value !== undefined && !Number.isFinite(Number(value))) {
      throw new Error(`Local SD worker request ${field} must be a number`);
    }
  }

  Animotion.hiddenCompletionLocalSdWorkerContract = {
    validateLocalSdWorkerRequest,
    validateLocalSdWorkerResponse,
  };
  if (typeof module !== "undefined") module.exports = Animotion.hiddenCompletionLocalSdWorkerContract;
}
