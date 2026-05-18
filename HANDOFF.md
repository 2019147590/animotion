# Animotion Handoff

This document preserves the current product direction and implementation status so the project can be resumed after an editor/session restart.

## Product Direction

Animotion is moving toward a manual-first 2D motion comic authoring tool.

The intended MVP flow is:

```text
A cut / B cut upload
-> manual panel crop, placement, and character mask setup
-> manual A cut rig parts and joint handles
-> motion type, target point, and action-anchor selection
-> automatic beat, joint trajectory, and multi-anchor draft
-> user edits trajectory / anchors / joints / keyframes
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
- Part creation, shape edits, inspector updates, deletion, pivot/joint edits, and selected pose updates now go through command helpers instead of ad hoc UI mutation.

Implemented command layer:

- `scripts/part-commands.js`: create/update/delete parts, apply part masks, validate parent updates, sync project parts.
- `tests/part-commands.test.js`: part creation/project sync, cyclic parent rejection, child parent clearing on delete.

### Panel Quality Setup

Implemented in `scripts/panel-editor.js` and `scripts/panel-commands.js`.

- A/B panel edit target switch.
- Manual crop for A cut and B cut.
- Manual character mask for A cut and B cut.
- A/B panel position and scale controls.
- A cut character/background separation using character mask first, then parts fallback.
- Panel setup saved/restored through rig JSON as `panelSetup`.
- Cropped panel size is preserved relative to the original source image.
- JSON load preserves an already-adjusted A cut panel transform when the user changed it before import.
- Preview pointer input and rig/target overlays are converted through the current A cut panel scale/position.
- Panel target, crop, mask, and panel setup mutation now go through `scripts/panel-commands.js`.

Recent commit:

```text
979274e Add manual panel crop and mask editor
```

### Motion Planning And Anchor Draft

Implemented in `scripts/motion-planner.js`, `scripts/motion-anchors.js`, `scripts/motion-anchor-picker.js`, and `scripts/motion-trajectory-editor.js`.

- Motion templates: kick, punch, dash.
- Target point picking on the preview canvas.
- Template-based beat generation.
- Joint trajectory draft from current A rig plus target.
- Generated action anchors from the selected part and target.
- Generated `cutsceneBridge.jointAction` with focus joint, anchors, and beats.
- Generated part keyframes for the selected active part and body/head support.
- Preview target marker, trajectory line, beat handles, and action-anchor markers.
- Beat handle selection and dragging updates `cutsceneBridge.jointAction`.
- Dragging a beat regenerates the selected primary part keyframes.
- Dragging an action anchor regenerates the full action plan and part keyframes.
- The user can choose a generated anchor from the anchor picker and place it directly on the preview canvas.
- Target picking freezes playback so the editing reference stays visible.
- Target point, beat handles, anchors, selected outlines, and rig handles are editing references only; they are hidden during playback/export.
- Motion plan saved/restored through rig JSON as `motionPlan`.
- Timeline keyframe edits, generated track application, cutscene bridge updates, motion plan updates, anchor regeneration, and trajectory regeneration now go through `scripts/motion-commands.js`.

Important behavior:

- The target point is the end position of the selected part's primary focus joint.
- For a leg this focus joint is the inferred foot point, not the whole leg rectangle.
- For a body/spine primary action, the focus joint is the inferred chest point and the generated primary motion uses translation (`x/y`) rather than `jointX/jointY`; this avoids accidental 180-degree body rotation.
- A leg action generates `foot`, `knee`, `hip`, `chest`, and `head` anchors. A body action generates `chest`, `hip`, and `head` anchors.
- Far leg targets move body anchors more; near leg targets keep body movement small so the leg can move locally.
- Anchor direct-picking is now implemented for generated anchors. A separate full anchor-management UI is still future work.
- Current generation still requires selecting a part and then generating beats; simply placing a target does not create motion until `beat/trajectory generation` is clicked.

Recent commits:

```text
ff72e63 Add multi-anchor motion planner drafts
5044e0e Allow dragging generated motion anchors
5064c57 Add direct motion anchor picking
```

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
- Source/impact panel transform and cutscene option updates now call session/motion command helpers.

Recent commit:

```text
5064c57 Add direct motion anchor picking
```

### Project Model And Commands

Implemented on `master`.

- `scripts/project-model.js`: central `AnimotionProject` runtime normalization and project part/editor part conversion.
- `scripts/project-serialization.js`: converts current editor state into `AnimotionProject`.
- `scripts/project-model.d.ts`: TypeScript type declarations for `AnimotionProject`, assets, parts, rigs, motions, effects, timeline, and editor metadata.
- Project JSON now saves as `format: "animotion-project"` with string `version`, metadata, canvas, assets, parts, rigs, motions, effects, timeline, and editor compatibility data.
- Existing legacy rig JSON with `parts` and AI rig payloads with `version: 3` still import.
- Save downloads `animotion-project.json` instead of `animotion-rig.json`.
- `scripts/session-commands.js`: new source image reset, B cut image setup, project/legacy restore, Lookism preset application, cutscene bridge updates, and panel setup restore.
- `scripts/panel-commands.js`: panel edit target, crop, and character mask state changes.
- `scripts/part-commands.js`: part-level state changes.
- `scripts/motion-commands.js`: keyframes, generated tracks, cutscene bridge, motion plan, and planner result application.
- `scripts/timeline.js`: pure timeline/keyframe utilities. It returns evaluated poses and next keyframe arrays but does not mutate parts.
- `scripts/correspondence-model.js`: 2.5D-ready A/B correspondence normalization for source part, B target type, normalized B impact anchor, occlusion metadata, relation schema migration, and planner draft compilation.
- `scripts/correspondence-commands.js`: correspondence create/update/restore commands with Undo/Redo records.
- `scripts/correspondence-editor.js`: manual B cut impact anchor picker, occlusion metadata controls, and explicit correspondence-to-motion-target application.
- `scripts/motion-panel-mapper.js`: converts B impact panel coordinates into A/source planner target coordinates using current crop/transform assumptions.
- `scripts/motion-hints.js`: normalizes correspondence-derived motion hints for occlusion, depth order, hidden completion, and warnings.
- `scripts/motion-drafts.js`: compiles correspondence motion hints into non-destructive 2.5D motion drafts and manages hidden-completion placeholder lifecycle metadata.
- `scripts/motion-draft-editor.js`: surfaces motion draft visibility/depth/hidden-completion data in the inspector/timeline and provides minimal safe editing controls.
- `scripts/motion-target-policy.js`: guards correspondence target application so manual motion targets are not overwritten without a future confirm UI.
- `scripts/command-history.js`: bounded command history scaffold with undo/redo stacks.
- Part inspector and rig-point updates through `partCommands.updatePart` now record old/new patches for Undo/Redo.
- Panel crop and character-mask updates through `panelCommands.setCrop` and `panelCommands.setCharacterMask` now record old/new patches for Undo/Redo.
- `Ctrl+Z`, `Ctrl+Y`, and `Ctrl+Shift+Z` trigger history undo/redo outside text-entry inputs.
- `project.editor.correspondences` stores manual A/B body-part correspondence metadata and round-trips through JSON.
- Correspondences now carry a B-lite relation schema alongside legacy flat fields: `schemaVersion`, `kind`, `source`, `target`, `impactAnchor`, `bImpact`, and `occlusion`.
- B impact anchors are saved in normalized image coordinates as `bImpact: { xNorm, yNorm, coordinateSpace: "normalized-image" }` and converted back to current image/panel pixels at display and compile boundaries. Legacy `impactAnchor` remains for compatibility.
- The selected correspondence can be explicitly applied as `motionPlan.target`; this compiles the B impact anchor into A/source coordinates and preserves `targetSource: { type: "correspondence" }`.
- Correspondence-derived `motionHints` are carried into `motionPlan`, generated primary action anchors, and `cutsceneBridge.jointAction`.
- `motionPlan.motionDraft` is the current input/planning-level draft. `cutsceneBridge.jointAction.motionDraft` is the generated action snapshot copied at generation time.
- Motion draft metadata records correspondence source fields such as source correspondence/target IDs, compiled hint version, and `draftKind: "non-destructive-2.5d"`.
- Hidden completion placeholder state is metadata only: `needed`, `assetKind`, `assetStatus`, and `assetId`. The current lifecycle is `missing -> requested -> ready -> missing`; `ready` requires an asset id.
- `hiddenCompletion.assetKind` now normalizes legacy `inpaintedPatch` to `hiddenCompletionPatch`.
- `hiddenCompletion.assetId` can point to a project asset with `type: "hiddenCompletionPatch"`; when project assets are available, `ready` requires the referenced patch asset to exist.
- `hiddenCompletionPatch` assets preserve source part, source rect, part-local mask vertices, patch transform, guide-only render mode, and future generated-result metadata.
- Guide mesh data is stored separately from generated output: `guide.meshVerticesNormalized`, `guide.meshFaces`, and `guide.silhouetteVerticesNormalized` are part-local normalized guide data, not final rendered image data.
- `scripts/hidden-completion-guide-editor.js` adds the first user-facing guide flow: create a guide-only patch from the selected part, add it to `project.assets`, link it to `motionDraft.hiddenCompletion.assetId`, draw the guide mesh/silhouette on the preview, and drag guide vertices while saving normalized part-local coordinates.
- Correspondence target overwrite policy is explicit: no target, correspondence target, and planner-default target can be overwritten; manual target overwrite is blocked until a confirm UI is added.
- New image reset, project restore, legacy rig restore, and Lookism preset load clear command history.

Current architecture note:

- Renderers still read runtime editor state such as `state.parts`, `state.cutsceneBridge`, `state.motionPlan`, `state.panelSetup`, and `state.correspondences`.
- The central project model is currently the save/load and normalization boundary, not yet the single in-memory source of truth.
- The command layer is an intermediate step toward broad Undo/Redo and eventually making `state.project` the primary editable data store.
- Undo/Redo currently covers part updates plus panel crop/mask edits. Part creation/deletion, timeline keyframes, generated motion plans, and session-level changes are still not undoable.

## Current Limits

- No AI model is connected locally.
- No DWPose, See-through, SAM, or VLM runner is implemented in the browser.
- Manual 2.5D-ready A/B body-part correspondence metadata is implemented and can be explicitly compiled into the motion planner target.
- B cut impact anchors can be stored per selected A part and explicitly converted into a generated primary action target through `motion 목표로 사용`.
- B cut impact anchors are now stored as normalized image coordinates, but other point-like data such as pivots, joints, generated anchors, and trajectory points still need the same coordinate-space treatment.
- Occlusion/depth/hidden-completion metadata is preserved as planner/action hints and compiled into non-destructive `motionDraft` data.
- Motion draft visibility/depth/hidden-completion data is visible and minimally editable in the inspector/timeline, but it does not yet drive renderer opacity, z-order transitions, mesh/proxy deformation, or AI generation.
- Hidden completion patch assets and guide mesh authoring exist, but request/ready states do not yet call AI generation, manual upload, part replacement, generated patch rendering, or renderer compositing.
- Guide mesh preview is currently an editor overlay. It is not a final image patch and should be treated as AI/input guidance only.
- Time-varying z-order / z-swap editing is not implemented.
- The motion planner is template/rule based, not image-understanding based.
- The generated motion is a draft; anchor editing exists, but detailed anchor/keyframe graph tooling is still limited.
- Target point placement alone does not generate a trajectory; generation is still an explicit user action.
- Natural connection into B cut is improved by explicit correspondence target application, but motion still remains template/rule based.
- Undo/Redo is implemented for part updates and panel crop/mask edits; several command helpers still centralize mutation without command records.
- `state.project` is synchronized at save/load and command boundaries, but render/edit code still depends on legacy editor state fields.

## Important Files

- `index.html`: static app shell and existing controls.
- `scripts/project-model.js`: central project model normalization and project/editor part conversion.
- `scripts/project-serialization.js`: editor state to `AnimotionProject` save payload.
- `scripts/project-model.d.ts`: TypeScript declarations for the project format.
- `scripts/command-history.js`: undo/redo stack and command replay helper.
- `scripts/session-commands.js`: project/session reset and restore commands.
- `scripts/part-commands.js`: part creation/update/delete commands.
- `scripts/motion-commands.js`: keyframe, bridge, motion plan, and generated-track commands.
- `scripts/timeline.js`: pure keyframe sorting, insertion-result, deletion-result, and frame evaluation helpers.
- `scripts/correspondence-model.js`: correspondence, normalized B impact, and occlusion metadata normalization.
- `scripts/correspondence-commands.js`: correspondence mutation and history records.
- `scripts/correspondence-editor.js`: correspondence UI and B cut impact anchor picking.
- `scripts/motion-panel-mapper.js`: B impact coordinate to A/source planner target conversion.
- `scripts/motion-hints.js`: motion hint normalization and status text for correspondence-derived occlusion/depth/hidden-completion.
- `scripts/motion-drafts.js`: non-destructive 2.5D motion draft compilation and hidden-completion lifecycle helpers.
- `scripts/motion-draft-editor.js`: motion draft inspector/timeline controls.
- `scripts/hidden-completion-assets.js`: hidden-completion patch asset normalization, guide mesh model, and runtime guide mesh restoration.
- `scripts/hidden-completion-guide-editor.js`: guide-only patch creation, preview overlay, and guide vertex dragging.
- `scripts/motion-target-policy.js`: correspondence target overwrite policy.
- `scripts/panel-commands.js`: panel target/crop/mask commands.
- `scripts/panel-editor.js`: A/B crop and character mask UI/render helpers.
- `scripts/motion-anchors.js`: action-anchor generation and normalization.
- `scripts/motion-planner.js`: target-driven beat and trajectory draft generation.
- `scripts/motion-anchor-picker.js`: choose and directly place generated action anchors.
- `scripts/motion-trajectory-editor.js`: editable beat handles and trajectory overlay.
- `scripts/cutscene-options.js`: A cut source-motion and body-assist option controls.
- `scripts/preview-transform.js`: coordinate conversion for A cut panel scale/position.
- `scripts/preview.js`: Canvas preview rendering and trajectory overlays.
- `scripts/cutscene-model.js`: cutscene bridge timing and panel transition values.
- `scripts/joint-coordinates.js`: joint pose inference from current parts.
- `scripts/pose-assist.js`: older keyframe anticipation helper.
- `scripts/io.js`: JSON save/load for `AnimotionProject`, legacy rig JSON, and AI rig payloads.
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
node tests\part-commands.test.js
node tests\motion-commands.test.js
node tests\session-commands.test.js
node tests\panel-commands.test.js
node tests\correspondence-commands.test.js
node tests\motion-draft-editor.test.js
node --test lookism\test\cutscene-values.test.mjs
cd ai-rig-server
$env:PYTHONPATH='src'; python -m unittest discover -s tests
```

## Suggested Next Work Unit

Continue the hidden-completion guide workflow before adding AI generation.

Smallest next scope:

```text
Persist and reload guide patch editing through a realistic JSON round-trip
-> create guide patch from selected part
-> drag one or more mesh vertices
-> save JSON
-> reload JSON against the current source image
-> verify the linked patch asset and normalized guide vertices survive
-> verify preview overlay restores against the current part rect
```

Why this is next:

- The guide editor now creates and edits mesh data, but the next risk is end-to-end persistence after real save/load.
- AI inpainting should consume guide-only geometry as mask/silhouette/direction hints, not as a final stretched texture.
- Renderer and AI work should wait until the guide patch asset path is proven stable through project serialization.

Do not jump straight to AI matching, renderer z-swap, generated patch compositing, or 3D proxy work. First make guide patch authoring and JSON persistence boring and reliable.

## GitHub State

Remote:

```text
origin https://github.com/2019147590/animotion.git
```

Branch:

```text
master
```

Latest known committed baseline at handoff time:

```text
126ed55 Create hidden completion guide editor
```

## Current Working Tree Notes

As of this handoff update, the correspondence, motionDraft, normalized coordinate, hidden-completion patch asset, mesh guide model, and guide editor UI work is committed on `master` and pushed to `origin/master`.

Recently completed in the working tree:

- Central `AnimotionProject` save/load model and `.d.ts` type declarations.
- Save/load refactor to project JSON while preserving legacy rig and AI rig imports.
- Part, motion, session, and panel command layers.
- Command history scaffold with Undo/Redo for part update commands.
- Panel crop and character-mask Undo/Redo.
- Manual 2.5D-ready A/B correspondence metadata.
- B-lite correspondence relation schema with backward-compatible migration.
- B cut impact anchor picker for the selected A part.
- Explicit correspondence target application into `motionPlan.target`.
- Correspondence target overwrite policy that protects manual targets.
- Correspondence-derived motion hints on `motionPlan`, generated primary anchors, and `cutsceneBridge.jointAction`.
- Occlusion/depth/hidden-completion metadata controls and hint status text.
- Non-destructive motion draft compilation from correspondence motion hints.
- Motion draft inspector/timeline display and minimal editing controls.
- Hidden completion asset lifecycle metadata: `missing`, `requested`, `ready`, and remove back to `missing`.
- Hidden completion patch asset model with legacy `inpaintedPatch` normalization.
- Hidden completion mesh guide model with part-local normalized mesh/silhouette vertices.
- Guide-only hidden completion patch creation from the selected part.
- Preview overlay for guide mesh and silhouette.
- Preview vertex dragging for guide mesh vertices, saved back as part-local normalized coordinates.
- B impact anchors saved as normalized image coordinates and restored against the current image size.
- Keyboard history shortcuts: `Ctrl+Z`, `Ctrl+Y`, and `Ctrl+Shift+Z`.
- Timeline keyframe mutation removed from `scripts/timeline.js`; keyframe writes now stay in `scripts/motion-commands.js`.
- Planner, anchor picker, trajectory editor, timeline controls, preview rig edits, cutscene controls/options, IO restore, and Lookism preset application moved toward command helpers.
- Regression tests:
  - `tests/ai-rig-import.test.js`
  - `tests/part-commands.test.js`
  - `tests/motion-commands.test.js`
  - `tests/session-commands.test.js`
  - `tests/panel-commands.test.js`
  - `tests/correspondence-commands.test.js`
  - `tests/motion-draft-editor.test.js`
  - `tests/cutscene-options.test.js`
