# Animotion Handoff

This document preserves the current product direction and implementation status so the project can be resumed after an editor/session restart.

## Product Direction

Animotion is moving toward a manual-first 2D motion comic authoring tool.

The intended MVP flow is:

```text
A cut / B cut upload
-> manual panel crop, placement, and character mask setup
-> manual A cut rig parts and joint handles
-> motion type and target point selection
-> automatic beat and joint trajectory draft
-> user edits trajectory / joints / keyframes
-> LOOKISM-style Canvas playback
-> export or save JSON
```

The AI/GPU plan remains an input automation layer, not the core renderer. Later AI should propose character masks, parts, joints, and corrections. The app must still work when the user provides those values manually.

## Key Principles

- Implement the feature before discussing the next step.
- Separate implemented behavior from future work in every report.
- Keep work units small and push each completed unit to GitHub.
- Treat AI-generated or automatic results as editable drafts.
- Avoid hardcoded per-image motion data in app code; save generated motion as project data.

## Current Implemented State

### Manual Rigging

- A cut image upload.
- B cut image upload for impact/next-panel reference.
- Rect, ellipse, lasso, and polygon selection tools.
- Manual part extraction from selected regions.
- Part mask editing by vertex/edge/move interactions.
- Part type, name, parent, layer, opacity, pivot, and joint editing.
- Keyframe insertion/deletion and frame-based interpolation.

### Panel Quality Setup

Implemented in `scripts/panel-editor.js`.

- A/B panel edit target switch.
- Manual crop for A cut and B cut.
- Manual character mask for A cut and B cut.
- A/B panel position and scale controls.
- A cut character/background separation using character mask first, then parts fallback.
- Panel setup saved/restored through rig JSON as `panelSetup`.

Recent commit:

```text
979274e Add manual panel crop and mask editor
```

### Motion Planning Draft

Implemented in `scripts/motion-planner.js`.

- Motion templates: kick, punch, dash.
- Target point picking on the preview canvas.
- Template-based beat generation.
- Joint trajectory draft from current A rig plus target.
- Generated `cutsceneBridge.jointAction` with focus joint and beats.
- Generated part keyframes for the selected active part and body/head support.
- Preview trajectory overlay.
- Motion plan saved/restored through rig JSON as `motionPlan`.

Recent commit:

```text
c537a36 Add target-driven motion planner
```

## Current Limits

- No AI model is connected locally.
- No DWPose, See-through, SAM, or VLM runner is implemented in the browser.
- A/B body-part correspondence is not implemented.
- Hidden limb estimation is not implemented.
- Time-varying z-order / z-swap editing is not implemented.
- The motion planner is template/rule based, not image-understanding based.
- The generated motion is a draft; user correction UI still needs more detail.

## Important Files

- `index.html`: static app shell and existing controls.
- `scripts/panel-editor.js`: A/B crop and character mask setup.
- `scripts/motion-planner.js`: target-driven beat and trajectory draft generation.
- `scripts/preview.js`: Canvas preview rendering and trajectory overlays.
- `scripts/cutscene-model.js`: cutscene bridge timing and panel transition values.
- `scripts/joint-coordinates.js`: joint pose inference from current parts.
- `scripts/pose-assist.js`: older keyframe anticipation helper.
- `scripts/io.js`: JSON save/load including `panelSetup` and `motionPlan`.
- `lookism/`: proof-of-concept Canvas cutscene renderer.
- `ai-rig-server/`: backend scaffold for future GPU model runners.

## How To Run

Static app:

```powershell
python -m http.server 8765
```

Open:

```text
http://localhost:8765/index.html
```

Port 5500 also works if VS Code Live Server serves the repository root.

## Verification Commands

Use these before committing behavior changes:

```powershell
node tests\geometry.test.js
node tests\ai-rig-import.test.js
node tests\lookism-preset.test.js
node --test lookism\test\cutscene-values.test.mjs
cd ai-rig-server
$env:PYTHONPATH='src'; python -m unittest discover -s tests
```

## Suggested Next Work Unit

Implement trajectory editing, not a new AI feature.

Smallest next scope:

```text
Show generated beat points on the preview canvas
-> allow selecting a beat
-> allow dragging the focus joint for that beat
-> update cutsceneBridge.jointAction
-> regenerate selected part keyframes
-> save/load through existing JSON
```

Why this is next:

- It directly completes the manual-first workflow.
- It lets users correct the automatic beat draft.
- It turns generated motion from a black box into an editable motion JSON artifact.

## GitHub State

Remote:

```text
origin https://github.com/2019147590/animotion.git
```

Branch:

```text
master
```

Latest known commit at handoff time:

```text
c537a36 Add target-driven motion planner
```

