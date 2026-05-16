from __future__ import annotations

import shutil
from pathlib import Path
from uuid import uuid4

from ai_rig_server.config import ServerConfig
from ai_rig_server.pipeline import run_pipeline

try:
    from fastapi import FastAPI, File, HTTPException, UploadFile
except ModuleNotFoundError as error:  # pragma: no cover
    raise RuntimeError("Install API dependencies with `uv sync --extra api`.") from error

app = FastAPI(title="Animotion AI Rig Server")


@app.post("/api/rig-jobs")
async def create_rig_job(file: UploadFile = File(...), width: int = 1280, height: int = 1280):
    config = ServerConfig.from_env()
    job_dir = config.workspace / uuid4().hex
    job_dir.mkdir(parents=True, exist_ok=True)
    image_path = job_dir / _safe_filename(file.filename or "panel.png")
    try:
        with image_path.open("wb") as target:
            shutil.copyfileobj(file.file, target)
        return run_pipeline(image_path, {"width": width, "height": height}, config)
    except Exception as error:
        raise HTTPException(status_code=500, detail=str(error)) from error


def _safe_filename(filename: str) -> str:
    return Path(filename).name.replace(" ", "_") or "panel.png"

