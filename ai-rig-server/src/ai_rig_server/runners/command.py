from __future__ import annotations

import json
import shlex
import subprocess
from pathlib import Path
from typing import Any

from ai_rig_server.errors import InvalidRunnerOutputError, RunnerFailedError, RunnerNotConfiguredError


def run_json_command(command: str | None, payload: dict[str, Any], cwd: Path, timeout: int) -> dict[str, Any]:
    if not command:
        raise RunnerNotConfiguredError("model runner command is not configured")
    try:
        result = subprocess.run(
            shlex.split(command),
            input=json.dumps(payload),
            text=True,
            capture_output=True,
            cwd=cwd,
            timeout=timeout,
            check=False,
        )
    except (OSError, subprocess.TimeoutExpired) as error:
        raise RunnerFailedError(str(error)) from error
    if result.returncode != 0:
        raise RunnerFailedError(result.stderr.strip() or f"runner exited with {result.returncode}")
    try:
        output = json.loads(result.stdout)
    except json.JSONDecodeError as error:
        raise InvalidRunnerOutputError("runner stdout was not valid JSON") from error
    if not isinstance(output, dict):
        raise InvalidRunnerOutputError("runner JSON output must be an object")
    return output

