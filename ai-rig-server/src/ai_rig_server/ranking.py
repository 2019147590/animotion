from __future__ import annotations

from typing import Any


def select_character_instance(instances: list[dict[str, Any]], image_size: dict[str, int]) -> dict[str, Any] | None:
    if not instances:
        return None
    return max(instances, key=lambda instance: character_score(instance, image_size))


def character_score(instance: dict[str, Any], image_size: dict[str, int]) -> float:
    bbox = instance.get("bbox") or {}
    confidence = _number(instance.get("confidence"), 0.0)
    area = _normalized_area(bbox, image_size)
    center_bias = _center_bias(bbox, image_size)
    full_body = _number(instance.get("full_body_likelihood"), 0.5)
    return confidence * 0.45 + area * 0.30 + center_bias * 0.15 + full_body * 0.10


def _normalized_area(bbox: dict[str, Any], image_size: dict[str, int]) -> float:
    image_area = max(1, _number(image_size.get("width"), 1) * _number(image_size.get("height"), 1))
    return min(1.0, max(0.0, _number(bbox.get("w"), 0) * _number(bbox.get("h"), 0) / image_area))


def _center_bias(bbox: dict[str, Any], image_size: dict[str, int]) -> float:
    width = max(1.0, _number(image_size.get("width"), 1))
    height = max(1.0, _number(image_size.get("height"), 1))
    cx = _number(bbox.get("x"), 0) + _number(bbox.get("w"), 0) * 0.5
    cy = _number(bbox.get("y"), 0) + _number(bbox.get("h"), 0) * 0.5
    distance = ((cx / width - 0.5) ** 2 + (cy / height - 0.5) ** 2) ** 0.5
    return max(0.0, 1.0 - distance / 0.7072)


def _number(value: Any, fallback: float) -> float:
    try:
        return float(value)
    except (TypeError, ValueError):
        return fallback

