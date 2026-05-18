# Local Stable Diffusion Worker Contract

## Scope

This contract is provider-specific for `local-sd-inpaint`. It is not part of `HiddenCompletionRequestPayload` and must not change the provider-neutral request format.

The worker runs outside the browser, usually on localhost, VESSL, RunPod, or another GPU host. The normal Animotion app must still load and edit projects without this worker.

Default endpoint example:

```text
POST http://127.0.0.1:7861/inpaint
Content-Type: application/json
```

## Request

The Local SD adapter sends this JSON shape to the worker:

```json
{
  "task": "hidden_completion_inpaint",
  "prompt": "Fill the masked hidden or missing area...",
  "negativePrompt": "blurry, distorted, extra limbs",
  "imageBase64": "<source PNG bytes as base64>",
  "maskBase64": "<mask PNG bytes as base64>",
  "width": 1024,
  "height": 1024,
  "steps": 20,
  "cfgScale": 7,
  "denoise": 0.65,
  "seed": 0,
  "modelId": "local-model-label",
  "checkpointPath": "models/inpaint.safetensors",
  "workflowPath": null,
  "requestHash": "fnv1a-...",
  "promptVersion": "local-sd-hidden-completion-v1"
}
```

Required fields:

- `task`
- `prompt`
- `imageBase64`
- `maskBase64`
- `requestHash`
- `promptVersion`

Optional model parameters:

- `negativePrompt`
- `width`
- `height`
- `steps`
- `cfgScale` or providerConfig `guidanceScale` mapped to `cfgScale`
- `denoise` or providerConfig `strength` mapped to `denoise`
- `seed`
- `modelId`
- `checkpointPath`
- `workflowPath`

The adapter sends base64 image data. A future worker may accept byte descriptors, but the current JS adapter contract uses `imageBase64` and `maskBase64`.

## Response

The worker returns JSON:

```json
{
  "imageBase64": "<generated PNG as base64>",
  "mimeType": "image/png",
  "provider": "local-sd-inpaint",
  "modelId": "local-model-label",
  "modelLicense": "local model license label",
  "seed": 123,
  "requestHash": "fnv1a-...",
  "createdAt": "2026-05-18T00:00:00.000Z",
  "warnings": [],
  "rawProviderMetadata": {
    "sampler": "worker-owned"
  }
}
```

Required fields:

- `imageBase64` or `imageBytes`

Recommended fields:

- `mimeType`
- `provider`
- `modelId`
- `modelLicense`
- `seed`
- `requestHash`
- `createdAt`
- `warnings`
- `rawProviderMetadata`

The app normalizes this into `HiddenCompletionResult` and writes provenance to the generated result/patch asset, not to the neutral request.

## Rules

- Do not expose this worker endpoint directly from browser code when secrets or local filesystem paths are involved.
- Do not require this worker for normal project load/edit.
- Do not put `checkpointPath`, `workflowPath`, sampler, CFG, denoise, or seed into `HiddenCompletionRequestPayload`.
- Tests must mock the worker.
