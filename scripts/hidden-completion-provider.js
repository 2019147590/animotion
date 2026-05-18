{
  const global = typeof window !== "undefined" ? window : globalThis;
  const Animotion = global.Animotion || (global.Animotion = {});
  const providers = new Map();
  const DEFAULT_CAPABILITIES = {
    supportsSourceImage: true,
    supportsMask: true,
    supportsGuideMesh: false,
    supportsGuideSilhouette: true,
    supportsControlImage: false,
    supportsLoRA: false,
    supportsFineTune: false,
    supportsAsyncJobs: false,
    maxResolution: 1024,
  };

  function registerProvider(provider) {
    const normalized = normalizeProvider(provider);
    providers.set(normalized.id, normalized);
    return normalized;
  }

  async function runHiddenCompletionProvider({ provider, request, sourceImage, maskImage, providerConfig = {} }) {
    const adapter = providerAdapter(provider);
    assertMatchingDimensions(sourceImage, maskImage);
    const result = await adapter.run({ request, sourceImage, maskImage, providerConfig });
    return Animotion.hiddenCompletionResult.normalizeProviderResult(result, {
      provider: adapter.id,
      modelId: providerConfig.modelId,
      modelLicense: providerConfig.modelLicense,
      requestHash: providerConfig.requestHash,
    });
  }

  function createApiProviderAdapter(options = {}) {
    return normalizeProvider({
      id: options.id || "api-image-edit",
      capabilities: { ...DEFAULT_CAPABILITIES, ...options.capabilities },
      async run(input) {
        const apiKey = resolveApiKey(input.providerConfig);
        if (typeof options.callApi !== "function") throw new Error("API provider callApi mock/implementation is required");
        return options.callApi({ ...input, apiKey });
      },
    });
  }

  function capabilitiesFor(provider) {
    return providerAdapter(provider).capabilities;
  }

  function providerAdapter(provider) {
    if (typeof provider === "string") {
      const adapter = providers.get(provider);
      if (!adapter) throw new Error(`hidden completion provider is not registered: ${provider}`);
      return adapter;
    }
    return normalizeProvider(provider);
  }

  function normalizeProvider(provider = {}) {
    if (!provider.id) throw new Error("hidden completion provider id is required");
    if (typeof provider.run !== "function") throw new Error("hidden completion provider run function is required");
    return {
      id: String(provider.id),
      capabilities: { ...DEFAULT_CAPABILITIES, ...(provider.capabilities || {}) },
      run: provider.run,
    };
  }

  function resolveApiKey(providerConfig = {}) {
    if (providerConfig.apiKey) return providerConfig.apiKey;
    if (providerConfig.resolveSecret && providerConfig.apiKeyEnvName) {
      const value = providerConfig.resolveSecret(providerConfig.apiKeyEnvName);
      if (value) return value;
    }
    if (providerConfig.apiKeyEnvName) throw new Error(`missing API key for ${providerConfig.apiKeyEnvName}`);
    return null;
  }

  function assertMatchingDimensions(sourceImage, maskImage) {
    if (sourceImage?.width !== maskImage?.width || sourceImage?.height !== maskImage?.height) {
      throw new Error("hidden completion source image and mask image dimensions must match");
    }
  }

  Animotion.hiddenCompletionProvider = {
    registerProvider,
    runHiddenCompletionProvider,
    createApiProviderAdapter,
    capabilitiesFor,
  };
  if (typeof module !== "undefined") module.exports = Animotion.hiddenCompletionProvider;
}
