from __future__ import annotations

from typing import Any

from ai_rig_server.geometry import rect_polygon


def build_manifest(args: dict[str, Any]) -> dict[str, Any]:
    character = args["character"]
    parts = [_normalize_part(part, index + 1) for index, part in enumerate(args.get("parts", []))]
    return {
        "version": 3,
        "sourceImage": args["source_image"],
        "canvas": args.get("canvas"),
        "ai": {
            "pipelineVersion": "ai-rig-v1",
            "models": args.get("models", {}),
            "warnings": args.get("warnings", []),
        },
        "characters": [
            {
                "id": character["id"],
                "sourceRect": character["bbox"],
                "confidence": character.get("confidence", 0),
                "parts": parts,
            }
        ],
    }


def _normalize_part(part: dict[str, Any], order: int) -> dict[str, Any]:
    rect = part["rect"]
    mask = part.get("mask") or {"kind": "polygon", "points": rect_polygon({"x": 0, "y": 0, "w": rect["w"], "h": rect["h"]})}
    return {
        "id": part["id"],
        "name": part["name"],
        "type": part["type"],
        "subtype": part.get("subtype"),
        "side": part.get("side"),
        "image": part.get("image"),
        "mask": mask,
        "rect": rect,
        "pivot": part["pivot"],
        "joint": part["joint"],
        "parentId": part.get("parentId"),
        "order": int(part.get("order", order)),
        "alpha": float(part.get("alpha", 1)),
        "hidden": bool(part.get("hidden", False)),
        "confidence": float(part.get("confidence", 0)),
        "diagnostics": list(part.get("diagnostics", [])),
    }

