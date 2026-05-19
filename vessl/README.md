# Vessl SSH Workspace Runbook

This project uses Vessl as a remote RTX 3090 development workspace. The local machine controls Vessl with `vesslctl`; model inference runs on the remote GPU.

## Problem 1-Pager

### Context

The AI rig pipeline needs DWPose, See-through, and a character segmentation runner for original, licensed, or commercially usable character inputs. These models are too heavy for the static browser app and should run in a GPU workspace.

### Problem

We need a repeatable SSH workflow that keeps the prototype folders preserved, runs AI work in `ai-rig-server/`, and avoids committing model weights, generated artifacts, secrets, or unlicensed sample assets.

### Goal

Use Vessl workspace SSH as the first integration path:

```text
local terminal
-> vesslctl workspace create/start
-> vesslctl workspace ssh
-> clone or sync repo
-> run bootstrap script
-> configure runner commands
-> run offline spike
```

### Non-Goals

- Do not expose a public API before the offline spike works.
- Do not store secrets in this repo.
- Do not commit model weights, generated PNG/PSD, or workspace outputs.
- Do not use unauthorized webtoon/IP images as default samples or demos.

### Constraints

- Target GPU: RTX 3090, 24GB VRAM.
- Primary package manager for our backend: `uv`.
- Vessl CLI: `vesslctl`.
- Current integration mode: SSH workspace, not batch jobs.

## Local Setup

Install and authenticate `vesslctl` locally:

```bash
curl -fsSL https://api.cloud.vessl.ai/cli/install.sh | bash
vesslctl auth login
vesslctl config set default_org <your-org>
vesslctl config set default_team <your-team>
vesslctl auth status
vesslctl config show
```

Create an RTX 3090 workspace. Fill in the actual cluster/resource spec names from Vessl:

```bash
vesslctl workspace create \
  --name animotion-ai-rig \
  --cluster <cluster-name> \
  --resource-spec <rtx-3090-spec> \
  --image pytorch/pytorch:2.5.1-cuda12.4-cudnn9-devel
```

Connect:

```bash
vesslctl workspace list
vesslctl workspace show <workspace-slug>
vesslctl workspace ssh <workspace-slug>
```

Pause when not using the GPU:

```bash
vesslctl workspace pause <workspace-slug>
```

## Remote Workspace Bootstrap

Inside the Vessl SSH session:

```bash
git clone <your-repo-url> animotion
cd animotion
bash vessl/bootstrap_workspace.sh
cp vessl/env.example ai-rig-server/.env
```

Edit `ai-rig-server/.env` and set real runner commands:

```bash
AI_RIG_SEGMENTATION_CMD="python /workspace/models/runners/segment_character.py"
AI_RIG_DWPOSE_CMD="python /workspace/models/runners/run_dwpose.py"
AI_RIG_SEETHROUGH_CMD="python /workspace/models/runners/run_see_through.py"
```

Run the backend tests:

```bash
cd ai-rig-server
PYTHONPATH=src uv run python -m unittest discover -s tests
```

Run an offline spike:

```bash
set -a
source .env
set +a
uv run python scripts/run_job.py /workspace/samples/character.png 1280 1280
```

## Runner Contract

Every model runner command must:

- Read JSON from stdin.
- Write JSON to stdout.
- Write files into the provided `workspace` path.
- Exit non-zero on failure.

The JSON payload shape is:

```json
{
  "image": "/workspace/input/character.png",
  "workspace": "/workspace/animotion-rig-jobs/character",
  "imageSize": { "width": 1280, "height": 1280 },
  "character": null
}
```

The segmentation runner returns `instances`. DWPose returns `keypoints`. See-through returns either final canonical `parts` or raw layer data that a later converter can reconcile.

## Current Missing Pieces

These are not implemented in this repo yet and must be added in the Vessl workspace:

- DWPose installation and `run_dwpose.py` wrapper
- See-through installation and `run_see_through.py` wrapper
- SAM3 or Grounding DINO + SAM installation and `segment_character.py` wrapper
- A small sample image folder, outside git

## Useful Commands

```bash
nvidia-smi
python --version
uv --version
cd ai-rig-server && PYTHONPATH=src uv run python -m unittest discover -s tests
cd ai-rig-server && uv run uvicorn ai_rig_server.server:app --host 0.0.0.0 --port 8000
```

## References

- Vessl CLI cheat sheet: https://docs.cloud.vessl.ai/cli/cheatsheet
- Vessl workspace creation: https://docs.cloud.vessl.ai/member/workspace/create
