#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

echo "[animotion] workspace: $ROOT_DIR"
nvidia-smi || true
python --version

if ! command -v uv >/dev/null 2>&1; then
  echo "[animotion] installing uv"
  curl -LsSf https://astral.sh/uv/install.sh | sh
  export PATH="$HOME/.local/bin:$PATH"
fi

mkdir -p /workspace/animotion-rig-jobs
cd ai-rig-server
uv sync --extra dev
PYTHONPATH=src uv run python -m unittest discover -s tests

echo "[animotion] backend scaffold is ready"
echo "[animotion] copy vessl/env.example to ai-rig-server/.env and set runner commands"

