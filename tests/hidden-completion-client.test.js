const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const tests = [];

function test(name, fn) {
  tests.push({ name, fn });
}

function loadAnimotion() {
  const context = { window: { Animotion: {} }, fetch: async () => { throw new Error("unavailable"); } };
  vm.createContext(context);
  for (const path of [
    "scripts/hidden-completion-result.js",
    "scripts/hidden-completion-client.js",
  ]) runScript(context, path);
  return context.window.Animotion;
}

function runScript(context, path) {
  vm.runInContext(fs.readFileSync(path, "utf8"), context, { filename: path });
}

test("browser client returns queued when local provider server is unavailable", async () => {
  const Animotion = loadAnimotion();
  const result = await Animotion.hiddenCompletionClient.requestLocalGeneration(payload(), {
    fetchImpl: async () => { throw new Error("connect ECONNREFUSED"); },
  });
  assert.equal(result.status, "queued");
  assert.equal(result.reason, "provider-unavailable");
  assert.equal(result.message.includes("ECONNREFUSED"), true);
});

test("browser client normalizes local server result without API key", async () => {
  const Animotion = loadAnimotion();
  let body = null;
  const result = await Animotion.hiddenCompletionClient.requestLocalGeneration(payload(), {
    fetchImpl: async (_url, init) => {
      body = JSON.parse(init.body);
      return {
        ok: true,
        json: async () => ({
          imageBase64: "abc",
          mimeType: "image/png",
          provider: "stability-image-edit",
          modelId: "stable-image-edit-inpaint-v2beta",
          requestHash: "hash-1",
          createdAt: "2026-05-18T00:00:00+09:00",
          warnings: [],
          rawProviderMetadata: { promptVersion: "stability-hidden-completion-v1" },
        }),
      };
    },
  });
  assert.equal(body.providerConfig.apiKey, undefined);
  assert.equal(body.providerConfig.apiKeyEnvName, "STABILITY_API_KEY");
  assert.equal(result.provider, "stability-image-edit");
  assert.equal(result.imageBase64, "abc");
});

function payload() {
  return {
    request: { task: "hidden_completion", provenance: { provider: null, modelId: null, modelLicense: null } },
    sourceImage: { width: 20, height: 20, imageBase64: "abc", mimeType: "image/png" },
    maskImage: { width: 20, height: 20, imageBase64: "abc", mimeType: "image/png" },
    providerConfig: { provider: "stability-image-edit", apiKeyEnvName: "STABILITY_API_KEY", outputFormat: "png" },
  };
}

(async () => {
  for (const { name, fn } of tests) {
    try {
      await fn();
      console.log(`PASS ${name}`);
    } catch (error) {
      console.error(`FAIL ${name}`);
      throw error;
    }
  }
})();
