from __future__ import annotations

from pathlib import Path
from typing import Any

from ai_rig_server.config import ServerConfig
from ai_rig_server.manifest import build_manifest
from ai_rig_server.ranking import select_character_instance
from ai_rig_server.runners.command import run_json_command


def run_pipeline(image_path: Path, image_size: dict[str, int], config: ServerConfig) -> dict[str, Any]:
    workspace = _job_workspace(image_path, config.workspace)
    workspace.mkdir(parents=True, exist_ok=True)
    segmentation = _run(config.segmentation_cmd, image_path, workspace, image_size, config)
    character = select_character_instance(segmentation.get("instances", []), image_size)
    if not character:
        return _empty_manifest(image_path, image_size, ["no_character_instance"])
    pose = _run(config.dwpose_cmd, image_path, workspace, image_size, config, character)
    layers = _run(config.seethrough_cmd, image_path, workspace, image_size, config, character)
    return build_manifest({
        "source_image": str(image_path),
        "canvas": image_size,
        "character": character,
        "parts": _parts_from_layers(layers, pose),
        "models": {"pose": "dwpose", "layerDecomposition": "see-through"},
        "warnings": pose.get("quality", {}).get("warnings", []),
    })


def _run(command: str | None, image_path: Path, workspace: Path, image_size: dict[str, int], config: ServerConfig, character: dict[str, Any] | None = None) -> dict[str, Any]:
    return run_json_command(command, {
        "image": str(image_path),
        "workspace": str(workspace),
        "imageSize": image_size,
        "character": character,
    }, workspace, config.command_timeout_seconds)


def _parts_from_layers(layers: dict[str, Any], pose: dict[str, Any]) -> list[dict[str, Any]]:
    parts = layers.get("parts")
    if isinstance(parts, list):
        return parts
    return []


def _empty_manifest(image_path: Path, image_size: dict[str, int], warnings: list[str]) -> dict[str, Any]:
    return {"version": 3, "sourceImage": str(image_path), "canvas": image_size, "ai": {"warnings": warnings}, "characters": []}


def _job_workspace(image_path: Path, root: Path) -> Path:
    safe_name = image_path.stem.replace(" ", "_")[:64]
    return root / safe_name

