{
  const global = typeof window !== "undefined" ? window : globalThis;
  const Animotion = global.Animotion || (global.Animotion = {});
  const PROVIDER_ID = "stability-image-edit";
  const DEFAULT_ENDPOINT = "https://api.stability.ai/v2beta/stable-image/edit/inpaint";
  const DEFAULT_MODEL_ID = "stable-image-edit-inpaint-v2beta";
  const DEFAULT_API_KEY_ENV = "STABILITY_API_KEY";
  const DEFAULT_PROMPT_VERSION = "stability-hidden-completion-v1";

  function createStabilityImageEditProvider(options = {}) {
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
      run: (input) => callStabilityInpaint(input, options),
    };
  }

  async function callStabilityInpaint({ request, sourceImage, maskImage, providerConfig = {} }, options = {}) {
    assertServerRuntime(options);
    const env = options.env || global.process?.env || {};
    const fetchImpl = options.fetchImpl || global.fetch;
    if (typeof fetchImpl !== "function") throw new Error("Stability provider requires a server-side fetch implementation");
    const apiKey = stabilityApiKey(env, providerConfig);
    const prompt = buildStabilityHiddenCompletionPrompt(request, providerConfig);
    const endpoint = stringOrDefault(providerConfig.endpoint, DEFAULT_ENDPOINT);
    const outputFormat = outputFormatFor(providerConfig.outputFormat);
    const form = new FormData();
    form.append("image", imageBlob(sourceImage, "source.png"), "source.png");
    form.append("mask", imageBlob(maskImage, "mask.png"), "mask.png");
    form.append("prompt", prompt.text);
    form.append("output_format", outputFormat);
    appendOptional(form, "negative_prompt", providerConfig.negativePrompt);
    appendOptional(form, "seed", providerConfig.seed);
    appendOptional(form, "grow_mask", providerConfig.growMask);
    const response = await fetchImpl(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        Accept: `image/${outputFormat}`,
      },
      body: form,
    });
    return normalizeStabilityResponse(response, request, providerConfig, prompt);
  }

  function buildStabilityHiddenCompletionPrompt(request, providerConfig = {}) {
    return Animotion.hiddenCompletionPrompt?.buildHiddenCompletionPrompt?.(request, {
      promptVersion: providerConfig.promptVersion || DEFAULT_PROMPT_VERSION,
    }) || fallbackPrompt(request, providerConfig);
  }

  function fallbackPrompt(request, providerConfig = {}) {
    return {
      version: stringOrDefault(providerConfig.promptVersion, request?.promptVersion || DEFAULT_PROMPT_VERSION),
      text: "Fill the masked hidden or missing area while preserving webtoon line art, character identity, pose continuity, lighting, texture, and color consistency.",
    };
  }

  async function normalizeStabilityResponse(response, request, providerConfig, prompt) {
    const status = Number(response?.status) || 0;
    if (status < 200 || status >= 300) throw new Error(`Stability inpaint request failed: ${status} ${await responseText(response)}`);
    const contentType = response.headers?.get?.("content-type") || `image/${outputFormatFor(providerConfig.outputFormat)}`;
    const metadata = {
      endpoint: stringOrDefault(providerConfig.endpoint, DEFAULT_ENDPOINT),
      promptVersion: prompt.version,
    };
    if (contentType.includes("application/json")) {
      const data = await response.json();
      return {
        imageBase64: data.image,
        mimeType: `image/${outputFormatFor(providerConfig.outputFormat)}`,
        provider: PROVIDER_ID,
        modelId: stringOrDefault(providerConfig.modelId, DEFAULT_MODEL_ID),
        modelLicense: stringOrNull(providerConfig.modelLicense),
        requestHash: stringOrDefault(providerConfig.requestHash, stableRequestHash(request)),
        createdAt: isoNow(),
        warnings: data.finish_reason === "CONTENT_FILTERED" ? ["stability-content-filtered"] : [],
        rawProviderMetadata: { ...metadata, seed: data.seed, finishReason: data.finish_reason },
      };
    }
    return {
      imageBytes: new Uint8Array(await response.arrayBuffer()),
      mimeType: contentType.split(";")[0],
      provider: PROVIDER_ID,
      modelId: stringOrDefault(providerConfig.modelId, DEFAULT_MODEL_ID),
      modelLicense: stringOrNull(providerConfig.modelLicense),
      requestHash: stringOrDefault(providerConfig.requestHash, stableRequestHash(request)),
      createdAt: isoNow(),
      warnings: [],
      rawProviderMetadata: metadata,
    };
  }

  function stabilityApiKey(env, providerConfig = {}) {
    if (providerConfig.apiKey) throw new Error("Stability API key must be read from an environment variable, not providerConfig.apiKey");
    const envName = stringOrDefault(providerConfig.apiKeyEnvName, DEFAULT_API_KEY_ENV);
    const apiKey = env?.[envName];
    if (!apiKey) throw new Error(`missing Stability API key in ${envName}`);
    return String(apiKey);
  }

  function imageBlob(image, filename) {
    const bytes = imageBytes(image);
    const mimeType = stringOrDefault(image?.mimeType || image?.contentType, filename.endsWith(".png") ? "image/png" : "application/octet-stream");
    return new Blob([bytes], { type: mimeType });
  }

  function imageBytes(image) {
    const source = image?.bytes || image?.imageBytes || image?.buffer || image?.image?.bytes || image?.image?.imageBytes || image?.image?.buffer;
    if (source) return source instanceof Uint8Array ? source : new Uint8Array(source);
    const base64 = image?.base64 || image?.imageBase64 || image?.image?.base64 || image?.image?.imageBase64;
    if (base64) return bytesFromBase64(base64);
    throw new Error("Stability provider requires prepared source and mask image bytes");
  }

  function bytesFromBase64(value) {
    const clean = String(value).replace(/^data:[^;]+;base64,/, "");
    if (typeof Buffer !== "undefined") return new Uint8Array(Buffer.from(clean, "base64"));
    const binary = atob(clean);
    return Uint8Array.from(binary, (char) => char.charCodeAt(0));
  }

  function appendOptional(form, key, value) {
    if (value !== undefined && value !== null && value !== "") form.append(key, String(value));
  }

  function outputFormatFor(value) {
    return ["png", "jpeg", "webp"].includes(value) ? value : "png";
  }

  function assertServerRuntime(options) {
    if (options.allowBrowserForTests) return;
    const hasDocument = Boolean(global.window?.document);
    if (hasDocument) throw new Error("Stability provider must run server-side; browser code must not call the Stability API");
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

  function isoNow() {
    return new Date().toISOString();
  }

  function stringOrNull(value) {
    return value === undefined || value === null || value === "" ? null : String(value);
  }

  function stringOrDefault(value, fallback) {
    return value === undefined || value === null || value === "" ? String(fallback) : String(value);
  }

  Animotion.hiddenCompletionStabilityProvider = {
    PROVIDER_ID,
    DEFAULT_ENDPOINT,
    DEFAULT_API_KEY_ENV,
    DEFAULT_PROMPT_VERSION,
    createStabilityImageEditProvider,
    buildStabilityHiddenCompletionPrompt,
  };
  if (typeof module !== "undefined") module.exports = Animotion.hiddenCompletionStabilityProvider;
}
