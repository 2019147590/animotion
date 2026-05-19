# AI Rig Server

## Problem 1-Pager

### Context

Animotion needs an AI backend that turns a user-uploaded original, licensed, or commercially usable character image into editable Canvas rig data. The browser app should not run DWPose, See-through, or SAM directly.

### Problem

The model pipeline depends on Vessl RTX 3090 GPU execution and external research repos. The frontend still needs a stable contract now, before the model runners are fully wired.

### Goal

Create a small backend scaffold with deterministic contracts:

```text
image path
-> character segmentation runner
-> automatic target ranking
-> DWPose runner
-> See-through runner
-> version 3 rig manifest
```

The backend is a creator-assistance layer. It must not be positioned as a service for copying unauthorized webtoon panels, original poses, silhouettes, layouts, or IP-specific styles.

### Non-Goals

- Do not vendor DWPose or See-through code into this repo.
- Do not commit model weights or generated workspaces.
- Do not pretend to produce real masks when model runners are not configured.
- Do not use unlicensed webtoon/IP samples as product demos or default fixtures.

### Constraints

- Use `uv` for Python environment management.
- Keep model execution behind command adapters.
- Emit PNG + JSON artifacts for the Canvas app.

## Vessl Setup Shape

Set these environment variables in the Vessl job or service:

```bash
AI_RIG_WORKSPACE=/workspace/animotion-rig-jobs
AI_RIG_SEGMENTATION_CMD="python /models/segment_character.py"
AI_RIG_DWPOSE_CMD="python /models/run_dwpose.py"
AI_RIG_SEETHROUGH_CMD="python /models/run_see_through.py"
```

Each command receives a JSON payload on stdin and must write JSON to stdout.

## Runner Contracts

Segmentation output:

```json
{
  "instances": [
    {
      "id": "char_01",
      "bbox": { "x": 10, "y": 20, "w": 300, "h": 500 },
      "confidence": 0.91,
      "mask": "characters/char_01/mask.png"
    }
  ]
}
```

DWPose output:

```json
{
  "keypoints": {
    "left_shoulder": { "x": 100, "y": 220, "confidence": 0.88 }
  },
  "quality": { "score": 0.82, "warnings": [] }
}
```

See-through output:

```json
{
  "layers": [
    {
      "name": "front_hair",
      "tag": "hair",
      "image": "layers/front_hair.png",
      "bbox": { "x": 80, "y": 30, "w": 220, "h": 180 },
      "order": 20,
      "confidence": 0.76
    }
  ]
}
```

## Local Commands

```bash
uv run python -m unittest discover -s tests
uv run python scripts/run_job.py path/to/character.png
uv run uvicorn ai_rig_server.server:app --host 0.0.0.0 --port 8000
```
