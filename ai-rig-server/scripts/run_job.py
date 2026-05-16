from __future__ import annotations

import json
import sys
from pathlib import Path

from ai_rig_server.config import ServerConfig
from ai_rig_server.pipeline import run_pipeline


def main() -> int:
    if len(sys.argv) < 2:
        print("usage: run_job.py IMAGE_PATH [WIDTH HEIGHT]", file=sys.stderr)
        return 2
    image_path = Path(sys.argv[1]).resolve()
    width = int(sys.argv[2]) if len(sys.argv) > 2 else 1280
    height = int(sys.argv[3]) if len(sys.argv) > 3 else 1280
    manifest = run_pipeline(image_path, {"width": width, "height": height}, ServerConfig.from_env())
    print(json.dumps(manifest, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

