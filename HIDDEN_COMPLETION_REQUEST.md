# Hidden Completion Request Contract

## Problem 1-Pager

### Context

`hiddenCompletionPatch` assets store user-authored hidden-area guide geometry in Animotion project JSON. A later local AI server or inpainting adapter needs a stable request payload derived from that asset.

Hidden completion is a creator-assistance feature for original, licensed, or commercially usable assets. It should fill or extend user-controlled parts, not reproduce unauthorized source panels or IP-specific styles.

### Problem

Provider-specific request fields would make the browser app depend on one model or service. Ambiguous coordinate spaces would also make adapters place masks and guide vertices incorrectly.

### Goal

Define a provider-neutral hidden completion request payload that any adapter can translate to OpenAI, Replicate, ComfyUI, Stable Diffusion, or a custom local runner.

### Non-Goals

- No AI server call.
- No model-specific parameters.
- No image generation.
- No renderer compositing.
- No manual PNG patch upload.

### Constraints

- The browser app emits semantic intent and normalized geometry only.
- Adapters own provider-specific translation.
- Guide coordinates must preserve values outside `0..1` when users extend beyond the source part.

## Options Compared

1. Emit provider-ready parameters from the app.
   - Pros: adapter code can be thinner.
   - Cons: couples app JSON to one provider's vocabulary.
   - Risk: changing models forces app-level migrations.

2. Emit a semantic provider-neutral request.
   - Pros: keeps AI replaceable and local-first.
   - Cons: each adapter must translate the neutral contract.
   - Risk: contract must document coordinate spaces precisely.

Decision: choose option 2. `buildHiddenCompletionRequest` returns adapter input, not model input.

## Payload Contract

The payload is model-independent. It must not contain sampler names, checkpoint IDs, denoise strength, CFG scale, scheduler names, LoRA names, API endpoint names, or provider request keys.

`buildHiddenCompletionRequest` options must not include provider-specific options. Provider, model, API, endpoint, sampler, checkpoint, seed, LoRA, and workflow options belong to provider adapters or runner config, not the request builder.

Allowed request builder options:

- `promptVersion`
- `includeWarnings`
- `strictMode`
- `requestId`

`provenance` is a placeholder for result metadata and is emitted as null values before generation:

```json
{
  "provider": null,
  "modelId": null,
  "modelLicense": null
}
```

## Coordinate Spaces

- `sourceRectNormalized`: source image normalized rect. `xNorm/yNorm/wNorm/hNorm` are relative to the full source image.
- `sourcePartRectNormalized`: source image normalized rect for the original source part. This lets adapters map source-part-local mask and guide coordinates into an expanded source crop.
- `maskVerticesNormalized`: source part local normalized vertices. `xNorm: 0` is the source part left edge, `xNorm: 1` is the right edge, `yNorm: 0` is the top edge, and `yNorm: 1` is the bottom edge.
- `guide.meshVerticesNormalized`: source part local normalized vertices. Values outside `0..1` are valid and must not be clamped.
- `guide.silhouetteVerticesNormalized`: source part local normalized vertices. Values outside `0..1` are valid and must not be clamped.
- `patchTransform.translationNormalized`: source part local normalized translation.
- `guide.meshFaces`: index triples into `guide.meshVerticesNormalized`; this is topology, not a coordinate space.

Adapters that need image pixels, canvas pixels, masks, or provider-specific crop coordinates must convert from these canonical fields at the adapter boundary.

## Stability Adapter

The first real provider is `stability-image-edit`, implemented as a server-side adapter only. It uses Stability's current image edit inpaint flow (`/v2beta/stable-image/edit/inpaint`) behind the provider boundary.

Runtime rules:

- The browser must not call Stability directly.
- The Stability API key is read from an environment variable only.
- Default env var: `STABILITY_API_KEY`.
- `providerConfig.apiKeyEnvName` may name a different environment variable.
- `providerConfig.apiKey` is rejected.
- Stability-specific fields such as endpoint, output format, seed, grow mask, negative prompt, model label, and license label belong in `providerConfig`, not in `HiddenCompletionRequestPayload`.
- Source image and mask image dimensions must match before the adapter calls Stability.
- Source and mask images must be server-prepared image bytes, such as PNG bytes, before the adapter call.

## Local Stable Diffusion Adapter

`local-sd-inpaint` is a server-side adapter for local, VESSL, RunPod, or other worker-hosted Stable Diffusion validation. It is another provider plugin; the app must not know whether the result came from Stability, Local SD, ComfyUI, or a future fine-tuned model.

Runtime rules:

- The browser must not run Stable Diffusion.
- Normal project loading and editing must not require GPU or worker availability.
- `providerConfig.endpoint` is required. Example: `http://127.0.0.1:7861/inpaint`.
- Local SD settings such as model id, checkpoint path, workflow path, steps, CFG/guidance scale, denoise/strength, seed, negative prompt, and output dimensions belong in `providerConfig`.
- The optional future ComfyUI provider id is reserved as `comfyui-inpaint`.
- Tests must mock the worker endpoint.
