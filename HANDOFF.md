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
- Cropped panel size is preserved relative to the original source image.
- JSON load preserves an already-adjusted A cut panel transform when the user changed it before import.
- Preview pointer input and rig/target overlays are converted through the current A cut panel scale/position.

Recent commit:

```text
979274e Add manual panel crop and mask editor
```

### Motion Planning Draft

Implemented in `scripts/motion-planner.js` and `scripts/motion-trajectory-editor.js`.

- Motion templates: kick, punch, dash.
- Target point picking on the preview canvas.
- Template-based beat generation.
- Joint trajectory draft from current A rig plus target.
- Generated `cutsceneBridge.jointAction` with focus joint and beats.
- Generated part keyframes for the selected active part and body/head support.
- Preview target marker, trajectory line, and beat handles.
- Beat handle selection and dragging updates `cutsceneBridge.jointAction`.
- Dragging a beat regenerates the selected primary part keyframes.
- Target picking freezes playback so the editing reference stays visible.
- Target point and beat handles are editing references only; they are hidden during playback/export.
- Motion plan saved/restored through rig JSON as `motionPlan`.

Important behavior:

- The target point is the end position of the selected part's focus joint.
- For a leg this focus joint is the inferred foot point, not the whole leg rectangle.
- Current generation still requires selecting a part and then generating beats; simply placing a target does not create motion until `beat/trajectory generation` is clicked.

### Cutscene Preview Options

Implemented in `scripts/cutscene-options.js`, `scripts/preview.js`, and `scripts/cutscene-model.js`.

- B cut reference opacity can be adjusted in the preview.
- Editing reference layers are separated from actual cutscene playback/export layers.
- B reference, target marker, beat handles, selected outlines, and rig handles are hidden during playback/export.
- A cut source panel movement/zoom is optional through `sourceMotionEnabled`.
- Default is part-only source motion: A cut panel does not auto-move/zoom unless the user enables `A cut move/zoom`.
- Body/head auxiliary movement is optional through `bodyAssistEnabled`.
- Default keeps body assist enabled for better motion draft quality.
- When body assist is disabled, generated and regenerated tracks keep body/head auxiliary movement at zero while the selected part still follows the trajectory.

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
- Target point placement alone does not generate a trajectory; generation is still an explicit user action.
- Natural connection into B cut is limited because A/B body-part correspondence and B cut impact anchors are not implemented.

## Important Files

- `index.html`: static app shell and existing controls.
- `scripts/panel-editor.js`: A/B crop and character mask setup.
- `scripts/motion-planner.js`: target-driven beat and trajectory draft generation.
- `scripts/motion-trajectory-editor.js`: editable beat handles and trajectory overlay.
- `scripts/cutscene-options.js`: A cut source-motion and body-assist option controls.
- `scripts/preview-transform.js`: coordinate conversion for A cut panel scale/position.
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
node tests\cutscene-options.test.js
node tests\ai-rig-import.test.js
node tests\lookism-preset.test.js
node --test lookism\test\cutscene-values.test.mjs
cd ai-rig-server
$env:PYTHONPATH='src'; python -m unittest discover -s tests
```

## Suggested Next Work Unit

Implement manual B cut impact anchoring / correspondence, not a new AI feature.

Smallest next scope:

```text
Let the user choose the active A part
-> show B cut reference with adjustable opacity
-> allow placing a matching B cut impact anchor for that part
-> store the anchor in project JSON
-> use that anchor as the generated trajectory target
-> keep the result editable through existing beat handles
-> save/load through existing JSON
```

Why this is next:

- It attacks the current main naturalness problem directly.
- A cut selected-part trajectory already exists, but it does not know where the matching B cut body point is.
- Manual anchors keep the MVP manual-first and avoid depending on AI correspondence too early.

Do not jump straight to AI matching. First make the manual correspondence data model and editor usable; later AI can propose those anchors as editable drafts.

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

## Current Working Tree Notes

As of the latest handoff update, local uncommitted work includes:

- B cut reference opacity.
- A/B panel scale preservation and JSON load behavior.
- Source transform-aware preview/input coordinates.
- Trajectory beat handle editing.
- Editing-reference vs playback/export layer separation.
- Optional A cut move/zoom.
- Optional body assist for generated/regenerated trajectory tracks.
- Regression test `tests/cutscene-options.test.js`.
