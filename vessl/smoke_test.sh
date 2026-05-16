#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR/ai-rig-server"

if [[ -f .env ]]; then
  set -a
  source .env
  set +a
fi

PYTHONPATH=src uv run python -m unittest discover -s tests

for name in AI_RIG_SEGMENTATION_CMD AI_RIG_DWPOSE_CMD AI_RIG_SEETHROUGH_CMD; do
  if [[ -z "${!name:-}" ]]; then
    echo "[animotion] missing $name"
  else
    echo "[animotion] configured $name=${!name}"
  fi
done

