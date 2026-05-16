from __future__ import annotations

from typing import Any


def rect_polygon(rect: dict[str, Any]) -> list[dict[str, float]]:
    x = float(rect["x"])
    y = float(rect["y"])
    w = float(rect["w"])
    h = float(rect["h"])
    return [
        {"x": x, "y": y},
        {"x": x + w, "y": y},
        {"x": x + w, "y": y + h},
        {"x": x, "y": y + h},
    ]


def local_point(rect: dict[str, Any], point: dict[str, Any]) -> dict[str, float]:
    return {
        "x": clamp(float(point["x"]) - float(rect["x"]), 0.0, float(rect["w"])),
        "y": clamp(float(point["y"]) - float(rect["y"]), 0.0, float(rect["h"])),
    }


def clamp(value: float, low: float, high: float) -> float:
    return min(high, max(low, value))

