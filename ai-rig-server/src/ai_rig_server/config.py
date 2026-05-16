from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path


@dataclass(frozen=True)
class ServerConfig:
    workspace: Path
    segmentation_cmd: str | None
    dwpose_cmd: str | None
    seethrough_cmd: str | None
    max_image_side: int = 1280
    command_timeout_seconds: int = 1800

    @classmethod
    def from_env(cls) -> "ServerConfig":
        return cls(
            workspace=Path(os.getenv("AI_RIG_WORKSPACE", "workspace/jobs")),
            segmentation_cmd=os.getenv("AI_RIG_SEGMENTATION_CMD"),
            dwpose_cmd=os.getenv("AI_RIG_DWPOSE_CMD"),
            seethrough_cmd=os.getenv("AI_RIG_SEETHROUGH_CMD"),
            max_image_side=int(os.getenv("AI_RIG_MAX_IMAGE_SIDE", "1280")),
            command_timeout_seconds=int(os.getenv("AI_RIG_COMMAND_TIMEOUT_SECONDS", "1800")),
        )

