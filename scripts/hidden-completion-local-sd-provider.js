{
  const global = typeof window !== "undefined" ? window : globalThis;
  const Animotion = global.Animotion || (global.Animotion = {});
  const PROVIDER_ID = "local-sd-inpaint";
  const FUTURE_COMFYUI_PROVIDER_ID = "comfyui-inpaint";
  const DEFAULT_ENDPOINT = "http://127.0.0.1:7861/inpaint";
  const DEFAULT_MODEL_ID = "local-stable-diffusion-inpaint";
  const DEFAULT_PROMPT_VERSION = "local-sd-hidden-completion-v1";

  function createLocalSdInpaintProvider(options = {}) {
    return {
      id: PROVIDER_ID,
      capabilities: {
        supportsSourceImage: true,
        supportsMask: true,
        supportsGuideMesh: false,
        supportsGuideSilhouette: true,
        supportsControlImage: false,
        supportsLoRA: false,
        supportsFineTune: false,
        supportsAsyncJobs: false,
        maxResolution: 1024,
      },
      run: (input) => callLocalSdWorker(input, options),
    };
  }

  async function callLocalSdWorker({ request, sourceImage, maskImage, providerConfig = {} }, options = {}) {
    assertServerRuntime(options);
    const endpoint = requiredEndpoint(providerConfig);
    const fetchImpl = options.fetchImpl || global.fetch;
    if (typeof fetchImpl !== "function") throw new Error("Local SD provider requires a server-side fetch implementation");
    const prompt = buildLocalSdHiddenCompletionPrompt(request, providerConfig);
    const body = workerPayload(request, sourceImage, maskImage, providerConfig, prompt);
    validateWorkerRequest(body);
    const response = await fetchImpl(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return normalizeWorkerResponse(response, request, providerConfig, prompt);
  }

  function workerPayload(request, sourceImage, maskImage, providerConfig, prompt) {
    return {
      task: "hidden_completion_inpaint",
      imageBase64: imageBase64(sourceImage),
      maskBase64: imageBase64(maskImage),
      prompt: prompt.text,
      negativePrompt: stringOrNull(providerConfig.negativePrompt),
      width: numberOrNull(providerConfig.width),
      height: numberOrNull(providerConfig.height),
      steps: numberOrNull(providerConfig.steps),
      cfgScale: numberOrNull(providerConfig.cfgScale ?? providerConfig.guidanceScale),
      denoise: numberOrNull(providerConfig.denoise ?? providerConfig.strength),
      seed: numberOrNull(providerConfig.seed),
      modelId: stringOrNull(providerConfig.modelId),
      checkpointPath: stringOrNull(providerConfig.checkpointPath),
      workflowPath: stringOrNull(providerConfig.workflowPath),
      requestHash: stringOrDefault(providerConfig.requestHash, stableRequestHash(request)),
      promptVersion: prompt.version,
    };
  }

  function buildLocalSdHiddenCompletionPrompt(request, providerConfig = {}) {
    return Animotion.hiddenCompletionPrompt?.buildHiddenCompletionPrompt?.(request, {
      promptVersion: providerConfig.promptVersion || DEFAULT_PROMPT_VERSION,
    }) || {
      version: stringOrDefault(providerConfig.promptVersion, request?.promptVersion || DEFAULT_PROMPT_VERSION),
      text: "Fill the masked hidden or missing area while preserving webtoon line art, character identity, pose continuity, texture, lighting, and color consistency.",
    };
  }

  async function normalizeWorkerResponse(response, request, providerConfig, prompt) {
    const status = Number(response?.status) || 0;
    if (status < 200 || status >= 300) throw new Error(`Local SD inpaint worker failed: ${status} ${await responseText(response)}`);
    const data = await response.json();
    validateWorkerResponse(data);
    return {
      imageBase64: data.imageBase64 || data.image,
      imageBytes: data.imageBytes || null,
      mimeType: stringOrDefault(data.mimeType, "image/png"),
      provider: PROVIDER_ID,
      modelId: stringOrDefault(data.modelId || providerConfig.modelId, DEFAULT_MODEL_ID),
      modelLicense: stringOrNull(data.modelLicense || providerConfig.modelLicense),
      requestHash: stringOrDefault(data.requestHash || providerConfig.requestHash, stableRequestHash(request)),
      createdAt: data.createdAt || new Date().toISOString(),
      warnings: Array.isArray(data.warnings) ? data.warnings : [],
      rawProviderMetadata: {
        endpoint: requiredEndpoint(providerConfig),
        promptVersion: prompt.version,
        ...(data.rawProviderMetadata && typeof data.rawProviderMetadata === "object" ? data.rawProviderMetadata : {}),
      },
    };
  }

  function validateWorkerRequest(request) {
    return Animotion.hiddenCompletionLocalSdWorkerContract?.validateLocalSdWorkerRequest?.(request) || request;
  }

  function validateWorkerResponse(response) {
    return Animotion.hiddenCompletionLocalSdWorkerContract?.validateLocalSdWorkerResponse?.(response) || response;
  }

  function requiredEndpoint(providerConfig = {}) {
    const endpoint = stringOrNull(providerConfig.endpoint);
    if (!endpoint) throw new Error(`local-sd-inpaint providerConfig.endpoint is required; example ${DEFAULT_ENDPOINT}`);
    return endpoint;
  }

  function imageBase64(image) {
    if (image?.base64 || image?.imageBase64) return String(image.base64 || image.imageBase64).replace(/^data:[^;]+;base64,/, "");
    const source = image?.bytes || image?.imageBytes || image?.buffer;
    if (!source) throw new Error("Local SD provider requires prepared source and mask image bytes or base64");
    if (typeof Buffer !== "undefined") return Buffer.from(source).toString("base64");
    let binary = "";
    for (const byte of source) binary += String.fromCharCode(byte);
    return btoa(binary);
  }

  function assertServerRuntime(options) {
    if (options.allowBrowserForTests) return;
    if (global.window?.document) throw new Error("Local SD provider must run server-side; browser code must not run Stable Diffusion");
  }

  async function responseText(response) {
    try {
      return await response.text();
    } catch (_error) {
      return "";
    }
  }

  function stableRequestHash(request) {
    let hash = 2166136261;
    const input = JSON.stringify(request || {});
    for (let i = 0; i < input.length; i += 1) hash = Math.imul(hash ^ input.charCodeAt(i), 16777619);
    return `fnv1a-${(hash >>> 0).toString(16)}`;
  }

  function numberOrNull(value) {
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
  }

  function stringOrNull(value) {
    return value === undefined || value === null || value === "" ? null : String(value);
  }

  function stringOrDefault(value, fallback) {
    return value === undefined || value === null || value === "" ? String(fallback) : String(value);
  }

  Animotion.hiddenCompletionLocalSdProvider = {
    PROVIDER_ID,
    FUTURE_COMFYUI_PROVIDER_ID,
    DEFAULT_ENDPOINT,
    DEFAULT_PROMPT_VERSION,
    createLocalSdInpaintProvider,
    buildLocalSdHiddenCompletionPrompt,
  };
  if (typeof module !== "undefined") module.exports = Animotion.hiddenCompletionLocalSdProvider;
}
