# Animotion Handoff

This document preserves the current product direction and implementation status so the project can be resumed after an editor/session restart.

## Product Direction

Animotion is moving toward a creator-controlled 2D/2.5D character rigging animation tool for original, licensed, or commercially usable character assets.

The intended MVP flow is:

```text
original/licensed character image or part assets
-> manual part selection / import
-> pivot, joint, parent-child rig setup
-> keypose, trajectory, and motion-draft editing
-> hidden-completion guide/patch authoring when motion exposes missing areas
-> preview playback
-> export or save project JSON
```

A/B cut correspondence, B-cut impact references, and the Lookism-style preset remain implemented prototype/reference workflows. They are no longer the primary product direction. Treat them as optional pose/reference assistance and motion-readability testbeds, not as an unauthorized webtoon panel conversion workflow.

The AI/GPU plan remains an assistant layer, not the core renderer. Later AI should propose character masks, parts, joints, hidden-completion patches, side textures, and correction candidates. The app must still work when the user provides those values manually.

Scripted genga cut generation is now a rights-safe fixture path for development and demos, and it is being moved toward a Blender-like user-authored scripting workflow. It is not a professional drawing app. The current implementation uses a restricted declarative JSON/object DSL instead of arbitrary `eval`: a cut definition can describe canvas settings, SVG elements, logical parts, rects, pivot/joint candidates, parent-child links, z-order, and hidden-completion guide metadata. The output can enter the existing rig/project pipeline.

The hardcoded demo genga cut remains available, but it should be treated as the first sample definition/internal reference implementation, not as the final shape of the generator.

## Key Principles

- Treat the planning spec as a living document. Keep the core direction stable, but update feature scope, terminology, data shape, and priorities when implementation, testing, user feedback, or IP/legal constraints reveal better choices.
- Implement the feature before discussing the next step.
- Separate implemented behavior from future work in every report.
- Keep work units small and push each completed unit to GitHub.
- Treat AI-generated or automatic results as editable drafts.
- Avoid hardcoded per-image motion data in app code; save generated motion as project data.
- Assume production inputs are user-authored, licensed, or commercially usable assets.
- Do not design the product around copying original webtoon panels, poses, silhouettes, layouts, or IP-specific style.
- If an automation path reduces quality or user control, move it back to a manual-first or editable-draft workflow.
- Keep scripted fixtures deterministic and structure-first; visual quality can improve later only if it does not turn the app into a general drawing tool.

## Current Implemented State

### Latest 2026-06-18 Saved Cutscene Sequence Handoff

This handoff captures the changed sequence approach: instead of uploading multiple JSON files directly into the sequence UI, the user loads one project JSON through the normal app flow, saves that loaded motion as `cutscene1`, `cutscene2`, and so on, clears only the loaded JSON project data, then loads the next JSON and builds a sequence from the saved cutscene clips.

Clarification update:

- The saved cutscene path now stores the loaded motion as a browser-recorded WebM video clip, not as JSON-derived motion data or sampled pose tracks.
- `clipFromCurrentState()` records the current preview canvas through `canvas.captureStream()` and `MediaRecorder`, then stores the resulting `video/webm` Blob URL as `cutscene1`, `cutscene2`, etc.
- When every sequence step is a saved video cutscene, `연속동작 생성` plays the saved WebM clips in array order through the preview canvas instead of compiling motion data or using an in-panel video player.

Problem 1-pager:

- Context: project JSON load already restores the intended motion for playback, but direct JSON-clip upload made it hard to use the same UI flow as normal project loading and did not give the user a clear "clear this loaded JSON, keep my saved clips" action.
- Problem: after loading one motion JSON, the app needed a way to preserve that motion as a reusable clip while removing the current loaded project data so another JSON can be loaded cleanly.
- Goal: add UI support for saving the current loaded cutscene as `cutsceneN`, preserving those clips across JSON reset, and generating a continuous sequence from the saved clip order.
- Non-goals: no server-side encoding, no MP4 conversion, no broad project schema change, no unrelated rig retargeting solver, and no removal of the existing template sequence path.
- Constraints: keep saved clip data exact for same-rig project JSON, keep generated sequence compatible with the existing cutscene/keyframe renderer, and keep new files under AGENTS.md limits.

Options considered:

- Continue direct multi-JSON upload into the sequence panel. Pro: fast to add several files at once. Con/risk: bypasses the normal project load/playback flow the user wants to use and leaves unclear reset semantics.
- Save the currently loaded JSON playback as an in-memory WebM cutscene clip, then clear only current project motion data before loading the next JSON. Pro: matches the user's requested video-file model and preserves the exact preview result. Con/risk: depends on browser `MediaRecorder`/WebM support and clips are runtime helpers. Chosen.

Implemented behavior:

- Added `scripts/cutscene-clip-store.js`.
  - `clipFromCurrentState()` records the preview canvas into a reusable `saved-video-cutscene` clip with `videoBlob`, `videoUrl`, `mimeType`, and duration metadata.
  - `clearLoadedJsonState()` clears current loaded project parts, selected part, bridge, frame/debug/editor motion state, and command history while preserving `actionSequenceClips` and the current sequence array.
  - `nextClipName()` names saved clips as `cutscene1`, `cutscene2`, etc.
  - `playSequence()` plays saved video clips in sequence order using a hidden video element as the frame source.
  - `drawPreviewPlayback()` draws the active video frame into the preview canvas while a saved-video sequence is playing.
- Updated `scripts/action-sequence-controls.js`.
  - Replaced the direct JSON file input with `현재 컷신 저장`, `JSON 초기화`, and saved-cutscene selection controls.
  - `현재 컷신 저장` records a WebM clip asynchronously and reports unsupported browser/empty recording failures.
  - Sequence generation remains enabled when all sequence steps are saved video cutscenes, even after JSON initialization clears current parts.
  - Video-only sequences are replayed in the preview canvas; older template/JSON-motion sequence compilation still remains as a fallback path.
- Updated `scripts/preview.js`.
  - The preview render loop now lets `cutsceneClipStore.drawPreviewPlayback()` take over the canvas while video sequence playback is active.
- Follow-up fix:
  - The preview canvas no longer switches to video playback mode until the hidden video source has a drawable frame.
  - Video recording waits one render frame after switching the app into cutscene playback state before starting `MediaRecorder`, reducing black/empty captured clips.
  - Previously recorded black Blob clips must be saved again because in-memory Blob data cannot be repaired after capture.
- Updated bootstrap order so the clip store loads between `action-sequence` and `action-sequence-controls`.

Impact note:

- `JSON 초기화` is intentionally narrower than new-image reset: it keeps the boxer image and saved `cutsceneN` clips so another project JSON can be loaded next.
- Saved clips are in-memory Blob URL helpers. They are not automatically persisted into project JSON.
- Exact visual transfer depends on what the preview canvas records, not on matching part IDs, when using the saved-video path.
- Browsers without `canvas.captureStream()` or `MediaRecorder` cannot save video clips and receive a UI failure message.

Regression tests added:

- Added `tests/cutscene-clip-store.test.js`.
  - Saves real `animotion-project (8).json` and `animotion-project (17).json` as WebM-backed `cutscene1`/`cutscene2` using a fake `MediaRecorder`.
  - Replays `cutscene1 -> cutscene1 -> cutscene2` through a fake video player in order.
  - Verifies the active video sequence is rendered through the preview canvas draw path.
  - Verifies the preview canvas is not claimed before a saved video frame is drawable.
  - Verifies `JSON 초기화` clears current project motion while preserving saved clips and sequence steps.

Verification for this work:

- `node --check scripts\cutscene-clip-store.js`
- `node --check scripts\action-sequence-controls.js`
- `node --check scripts\preview.js`
- `node tests\cutscene-clip-store.test.js`
- `node tests\action-sequence.test.js`
- `node tests\cutscene-options.test.js`
- `node tests\session-commands.test.js`
- `node tests\cutscene-action-selectors.test.js`

### Latest 2026-06-18 JSON Clip Action Sequence Handoff

This handoff captures the additional action-sequence path where uploaded project JSON files can be used as reusable motion clips, including repeated use such as `(8) -> (8) -> (17)`.

Button activation follow-up:

- Fixed the sequence generate button staying disabled after JSON clip upload.
- Previous condition required `state.image` and current `state.parts`, which was too strict for the JSON-clip path.
- JSON clips now store the normalized source project parts as clip metadata.
- `compileSequence()` can use the first referenced JSON clip's parts when current app parts are empty.
- `actionSequenceControls` enables generation when the sequence has steps and either current parts or referenced JSON clip parts exist.
- If generation starts with no current parts but a JSON clip has parts, the controls hydrate `state.parts` from that clip before applying generated tracks.
- Added regression coverage for compiling a JSON clip sequence without preloaded app parts.

Problem 1-pager:

- Context: template-generated action sequences now work, but the desired boxer combo can also be represented by existing saved project JSON files: `animotion-project (8).json` for jab-like motion and `animotion-project (17).json` for the desired rear-hand punch.
- Problem: loading each JSON as a whole project would replace the current rig/editor state, while the user needs the JSON files to act as ordered reusable motion sources inside the sequence UI.
- Goal: let the sequence UI upload multiple JSON files, add any uploaded JSON motion clip to the sequence more than once, and compile the resulting order into one playable cutscene.
- Non-goals: no project switching during sequence editing, no cross-rig retargeting solver, no new external file persistence schema, and no automatic semantic naming beyond the file/clip label.
- Constraints: keep the current template sequence path working, preserve saved JSON keyframes/bridge data exactly for same-rig boxer files, and keep new code under AGENTS.md line limits.

Options considered:

- Restore each uploaded JSON into the app before generating the next sequence step. Pro: uses the existing project load path. Con/risk: destructive to the current editor state and awkward for repeated `(8)` use.
- Extract only `cutsceneBridge` plus part keyframes from each project JSON as a reusable motion clip. Pro: non-destructive, repeatable, and preserves the saved motion authored in each JSON. Con/risk: assumes matching part IDs for exact motion transfer. Chosen.

Implemented behavior:

- Extended `scripts/action-sequence.js`.
  - Added `clipFromProjectPayload(payload, options)` to normalize an Animotion project JSON and extract a reusable clip: bridge, joint action, duration/impact frames, primary part id, and per-part keyframe tracks.
  - `normalizeSequence()` now preserves `{ clipId }` steps in addition to template steps.
  - `compileSequence()` can now mix template-generated steps and uploaded JSON clip steps in the same ordered sequence.
  - JSON clip steps are shifted and merged with the same beat/keyframe prefixing as template steps.
- Extended `scripts/action-sequence-controls.js`.
  - Added a multi-file JSON input inside the sequence panel.
  - Uploaded JSON files appear in a clip selector.
  - `JSON 추가` appends the selected uploaded clip to the sequence, and the same clip can be added repeatedly for `(8)-(8)-(17)`.
- Added `state.actionSequenceClips` and clears it on new image/session reset.

Impact note:

- JSON clip motion is exact for same-rig/same-part-id project files. It is not a general retargeting system for unrelated rigs.
- Existing template sequence generation remains available in the same UI.
- `(8)-(8)-(17)` can be built by uploading `animotion-project (8).json` and `animotion-project (17).json`, adding the `(8)` clip twice, then adding the `(17)` clip once, then clicking sequence generation.
- Existing unrelated dirty files and scratch artifacts remain excluded from this unit.

Regression tests added or updated:

- Updated `tests/action-sequence.test.js`.
  - Loads the real `animotion-project (8).json` and `animotion-project (17).json`.
  - Extracts both as JSON clips.
  - Compiles `{ clipId: "jab8" }, { clipId: "jab8" }, { clipId: "rear17" }`.
  - Verifies impact frames `15, 33, 51`, total duration `54`, and the final impact pose matches the loaded 17 rear-hand punch.

Verification for this work:

- `node --check scripts\action-sequence.js`
- `node --check scripts\action-sequence-controls.js`
- `node --check tests\action-sequence.test.js`
- `node --check scripts\action-sequence-controls.js`
- `node tests\action-sequence.test.js`
- `node tests\rear-hand-punch-template.test.js`
- `node tests\cutscene-action-selectors.test.js`
- `node tests\action-frame-editor.test.js`
- `node tests\motion-planner-commands.test.js`
- `node tests\cutscene-options.test.js`

### Latest 2026-06-18 Rear-Hand Punch 01 Reference Fix Handoff

This handoff captures the fix for `rearHandPunch01` generating a motion that did not match the rear-cross punch stored in `animotion-project (17).json`.

Problem 1-pager:

- Context: `animotion-project (17).json` stores the desired rear-hand punch as a generic `punch` action, but its runtime data is clearly rear-cross: `targetDebug.punchStyle: "rear-cross"`, selected rear hand endpoint, saved target, anchors, and trajectory.
- Problem: switching that loaded action to `rearHandPunch01` treated the template id change as a stale action context. The command path cleared the saved target/anchors and re-inferred bridge direction, so the punch could flip or target the wrong side.
- Goal: make `rearHandPunch01` reproduce the loaded 17 rear-cross punch behavior by preserving the compatible rear-cross target, anchors, and direction.
- Non-goals: no hardcoded 17-only coordinates in app code, no new motion solver, and no JSON fixture rewrite.
- Constraints: keep stale target invalidation for genuinely different actions/parts, including kick/punch switches and front-jab to rear-cross changes.

Options considered:

- Hardcode the 17 target/anchor shape into the `rearHandPunch01` template. Pro: exact for one fixture. Con/risk: not reusable and breaks on other rigs/images.
- Treat a loaded generic `punch` with `targetDebug.punchStyle: "rear-cross"` as compatible with `rearHandPunch01`. Pro: preserves user-authored/generated rear-cross data while keeping stale invalidation for unrelated contexts. Chosen.

Implemented behavior:

- Updated `scripts/motion-planner-commands.js`.
  - `sameActionContext()` now recognizes punch-like template compatibility by rear-cross style.
  - `shouldPreserveFacingDirection()` now preserves bridge direction when switching a compatible loaded rear-cross punch to `rearHandPunch01`.
- Added a regression in `tests/rear-hand-punch-template.test.js` that loads `animotion-project (17).json`, switches the plan to `rearHandPunch01`, regenerates, and verifies the saved target, impact endpoint, primary anchor, direction sign, primary part, and distinct template id are preserved.
- Cleaned `scripts/action-sequence.js` to read action timelines through `cutsceneActionSelectors.rawActionTimeline()` so selector-boundary tests remain valid.

Verification for this fix:

- `node --check scripts\motion-planner-commands.js`
- `node --check tests\rear-hand-punch-template.test.js`
- `node --check scripts\action-sequence.js`
- `node tests\rear-hand-punch-template.test.js`
- `node tests\motion-planner-commands.test.js`
- `node tests\action-sequence.test.js`
- `node tests\action-frame-editor.test.js`
- `node tests\action-specs.test.js`
- `node tests\cutscene-action-selectors.test.js`
- `node tests\cutscene-motion-status.test.js`
- `node tests\rear-cross-lead-hand-retract.test.js`

Impact note:

- This fix does not make every generic punch preserve into `rearHandPunch01`; it preserves only when the loaded action is already rear-cross.
- The intended 17 behavior is now covered by a direct fixture regression.
- Existing unrelated dirty files and scratch artifacts are still excluded from this unit.

### Latest 2026-06-18 Action Sequence Combo Handoff

This handoff captures the new UI/runtime path for generating ordered action sequences such as jab -> jab -> rear-hand punch 01 as one playable cutscene motion.

Problem 1-pager:

- Context: the app already generated one action template at a time through `motionPlanner.createPlan()` and stored the result as a cutscene bridge plus generated part keyframes.
- Problem: a boxer workflow needs quick chained actions, but adding a separate playback engine would touch save/load, preview, action-frame editing, and status paths at once.
- Goal: let the UI hold an ordered action array and compile that array into one normal generated cutscene/keyframe result.
- Non-goals: no per-step manual target editor, no blending/IK solver, no broad save schema rewrite, and no retiming of existing saved projects.
- Constraints: preserve existing single-action generation, keep new files under 300 LOC, reuse current preview/keyframe/cutscene playback, and keep unrelated local artifacts out of the change.

Options considered:

- Add a persistent sequence-player schema that switches actions during playback. Pro: semantically explicit sequence data. Con/risk: broad playback/save/load/editor changes and higher regression risk.
- Compile selected templates into one shifted `jointAction` plus merged part keyframes. Pro: reuses existing renderer, playback speed, action-frame buttons, and project save behavior. Con/risk: sequence edits are generated drafts and per-step targets are not separately editable yet. Chosen.

Implemented behavior:

- Added `scripts/action-sequence.js`.
  - Normalizes ordered steps and caps sequences at 6 steps / 120 frames.
  - Treats `punch` in a sequence as jab-oriented by selecting the front/jab arm when available.
  - Selects the rear hand for `rearHandPunch01` by classifying available arm chains with the existing punch logic.
  - Compiles every step through the existing motion planner, then shifts beat/keyframe frames into one cutscene.
  - Stores generated sequence evidence in `jointAction.targetDebug.actionSequence`.
- Added `scripts/action-sequence-controls.js`.
  - Adds a sequence panel under the Action generator UI.
  - Supports adding attack templates, moving steps up/down, removing steps, clearing the list, generating the sequence, and applying a `jab-jab-rearHandPunch01` preset.
- Added `state.actionSequence` and resets it on new image/session reset.
- Updated action-frame/status handling so prefixed sequence beats such as `s1:impact` and `s2:impact` still show as selectable punch action frames.
- Updated bootstrap order and UI refresh wiring for the new controls.

Impact note:

- Generated combo playback is saved as ordinary cutscene bridge/keyframes; the sequence editor list itself is a runtime draft helper.
- The first implementation intentionally uses automatic per-step targets. Users can still edit generated action frames after generation.
- Existing single-action `Punch`, `rearHandPunch01`, `Kick`, playback-speed, and cutscene status behavior should remain unchanged.
- The pre-existing local modification to `scripts/motion-draft-editor.js` remains unrelated and should not be mixed into this feature unless separately reviewed.

Regression tests added or updated:

- Added `tests/action-sequence.test.js` for sequence normalization, jab-jab-rear generation, front/rear hand assignment, shifted frames, merged tracks, and empty-sequence failure.
- Updated `tests/action-frame-editor.test.js` for sequence-prefixed beat frame labels.
- Updated `tests/cutscene-options.test.js` for bootstrap order.

Verification for this work:

- `node --check scripts\action-sequence.js`
- `node --check scripts\action-sequence-controls.js`
- `node --check tests\action-sequence.test.js`
- `node --check scripts\action-frame-editor.js`
- `node --check scripts\cutscene-motion-status.js`
- `node tests\action-sequence.test.js`
- `node tests\action-frame-editor.test.js`
- `node tests\cutscene-motion-status.test.js`
- `node tests\cutscene-options.test.js`
- `node tests\motion-planner-commands.test.js`
- `node tests\rear-hand-punch-template.test.js`
- `node tests\action-specs.test.js`

Upload scope for the next GitHub push:

- Include:
  - `scripts/action-sequence.js`
  - `scripts/action-sequence-controls.js`
  - `scripts/bootstrap.js`
  - `scripts/dom-state.js`
  - `scripts/cutscene-action-selectors.js`
  - `scripts/ui.js`
  - `scripts/action-frame-editor.js`
  - `scripts/cutscene-motion-status.js`
  - `tests/action-sequence.test.js`
  - `tests/action-frame-editor.test.js`
  - `tests/cutscene-options.test.js`
  - `HANDOFF.md`
- Exclude unrelated local artifacts and pre-existing dirty changes unless explicitly requested:
  - `scripts/motion-draft-editor.js`
  - `_analysis_frames/`
  - `recording/`
  - screenshots
  - `animotion-project (10).json`
  - `animotion-project (11).json`
  - `tests/motion-draft-billing-controls.test.js`
  - planning scratch files

### Latest 2026-06-18 Runtime Playback Speed Control Handoff

This handoff captures the non-destructive playback speed control added to increase the perceived speed of animations without retiming saved keyframes or project JSON.

Problem 1-pager:

- Context: preview playback was driven by `state.startTime`, `state.pausedTime`, `state.currentFrame`, `timeline.frameFromTime()`, and `cutsceneModel.bridgeFrameFromTime()`. The boxer punch workflow needs a quick way to make action playback feel faster while preserving editable beat/keyframe data.
- Problem: directly compressing keyframe frames or changing cutscene duration would alter saved motion data, impact timing, hidden-completion timing, and undo/edit expectations. A speed control must affect preview playback without damaging authored timing.
- Goal: add a UI control for runtime playback speed and route preview/cutscene/keyframe time evaluation through one normalized speed helper.
- Non-goals: no persisted JSON schema change, no keyframe retiming command, no WebM duration policy change, no motion quality retuning, and no broad playback/render rewrite.
- Constraints: keep the change small, preserve manual frame scrubbing, preserve pause/resume frame continuity, and keep pre-existing unrelated local changes out of this feature.

Options considered:

- Runtime playback speed multiplier. Pro: non-destructive, immediate, works for keyframe and cutscene preview. Con/risk: all pause/resume and preview hit-test time paths must use the same scaled time helper. Chosen.
- Saved keyframe/frame compression. Pro: exported project itself would be faster. Con/risk: mutates user-authored timing and broadens the change into schema/history/cutscene retiming.

Implemented behavior:

- Added `scripts/playback-speed.js`.
  - Normalizes speed to `0.25x` through `3x`.
  - Computes scaled playback seconds from `startTime`, `pausedTime`, and `playbackSpeed`.
  - Preserves current playback position when speed changes while running.
  - Stores paused time as scaled playback seconds.
- Added `scripts/playback-speed-controls.js`.
  - Inserts a `재생 배속` range control into the motion panel above the playback buttons.
  - Supports `0.25x`, `0.5x`, `0.75x`, `1x`, `1.25x`, `1.5x`, `1.75x`, `2x`, `2.25x`, `2.5x`, `2.75x`, and `3x`.
- Added `state.playbackSpeed = 1`.
- Updated preview/cutscene/lookism/runtime draw paths to evaluate motion using scaled playback seconds.
- Updated playback pause/resume and preview picker/drag freeze paths so stopping playback at higher speeds preserves the currently evaluated frame.
- Kept saved project keyframes, cutscene duration, impact frame, and project serialization unchanged.

Impact note:

- This is a runtime preview feature. Saved JSON still records original keyframes and current frame only.
- Manual frame scrubbing still pauses playback and selects exact authored frames.
- WebM export records the current runtime playback behavior, but this upload does not change the export duration policy.
- The pre-existing local modification to `scripts/motion-draft-editor.js` remains unrelated and should not be mixed into this feature unless separately reviewed.

Regression tests added or updated:

- Added `tests/playback-speed.test.js` for speed normalization, scaled elapsed seconds, speed-change continuity, pause behavior, one-based frame seconds, bootstrap order, and control range.
- Updated preview/drag test loaders so they include `scripts/playback-speed.js` when exercising runtime preview scripts directly.

Verification for this upload:

- `node --check scripts\playback-speed.js`
- `node --check scripts\playback-speed-controls.js`
- `node --check scripts\events.js`
- `node --check scripts\preview-part-renderer.js`
- `node --check tests\playback-speed.test.js`
- `node tests\playback-speed.test.js`
- `node tests\preview-render-order.test.js`
- `node tests\preview-hit-test.test.js`
- `node tests\preview-part-drag.test.js`
- `node tests\action-frame-pose-drag.test.js`
- `node tests\preview-pose-drag.test.js`
- `node tests\events-history-shortcuts.test.js`
- `node tests\cutscene-options.test.js`
- `node tests\geometry.test.js`
- `node tests\motion-target-state.test.js`

Upload scope:

- Include runtime playback speed implementation and tests:
  - `scripts/playback-speed.js`
  - `scripts/playback-speed-controls.js`
  - `scripts/bootstrap.js`
  - `scripts/dom-state.js`
  - `scripts/events.js`
  - `scripts/preview-part-renderer.js`
  - `scripts/preview-scene.js`
  - `scripts/preview-rig-overlay.js`
  - `scripts/preview-events.js`
  - `scripts/preview-hit-test.js`
  - `scripts/preview-part-drag.js`
  - `scripts/lookism-preset-renderer.js`
  - `scripts/correspondence-editor.js`
  - `scripts/motion-anchor-picker.js`
  - `scripts/motion-planner-controls.js`
  - `scripts/motion-trajectory-editor.js`
  - `scripts/hidden-completion-guide-editor.js`
  - `scripts/hidden-completion-supplemental-warp-editor.js`
  - `tests/playback-speed.test.js`
  - `tests/action-frame-pose-drag.test.js`
  - `tests/events-history-shortcuts.test.js`
  - `tests/preview-hit-test.test.js`
  - `tests/preview-part-drag.test.js`
  - `tests/preview-pose-drag.test.js`
  - `tests/preview-render-order-fixture.js`
  - `HANDOFF.md`
- Exclude unrelated local artifacts and pre-existing local changes unless explicitly requested:
  - `scripts/motion-draft-editor.js`
  - `_analysis_frames/`
  - `recording/`
  - screenshots
  - `animotion-project (10).json`
  - `animotion-project (11).json`
  - `tests/motion-draft-billing-controls.test.js`
  - planning scratch files

### Latest 2026-06-18 README Boxer Fixture Usage Handoff

This handoff captures the README update that explains how a person can use the included boxer image and saved project JSON fixtures to experience the rear-hand punch motion workflow.

Problem 1-pager:

- Context: the repository now includes `lookism/boxer.png` and the sample project fixtures `animotion-project (8).json`, `animotion-project (17).json`, and `animotion-project (17-1).json`. The `rearHandPunch01` action template is available in the UI as a separate rear-hand punch motion template.
- Problem: the previous README did not give a clear human-readable path for loading the boxer image first, restoring the JSON projects, playing/scrubbing the motion, or generating the new rear-hand punch template directly from the UI.
- Goal: rewrite the README into a practical usage guide for trying the saved boxer motion fixtures and creating the `rearHandPunch01` motion from the existing UI.
- Non-goals: no app code change, no fixture data rewrite, no UI redesign, no new generated asset, and no migration of unrelated local scratch files.
- Constraints: keep this as a docs-only update, preserve the current fixture filenames exactly, and make the guide understandable to someone operating the app manually.

Options considered:

- Append a short note to the existing README. Pro: minimal diff. Con/risk: still leaves the main usage path scattered and unclear for first-time manual testing.
- Rewrite the README as a focused quick-start and usage guide. Pro: gives the user an ordered workflow from image upload to JSON load, playback, frame scrub, and direct template generation. Con/risk: larger documentation diff. Chosen.

Implemented documentation:

- Rewrote `README.md` with a quick-start section for the boxer motion fixtures.
- Documented the required files:
  - `lookism/boxer.png`
  - `animotion-project (8).json`
  - `animotion-project (17).json`
  - `animotion-project (17-1).json`
- Documented the required order: open `index.html`, upload the boxer image, then load one of the sample JSON files.
- Explained how to play the motion, scrub frames, and inspect selected body parts in the preview.
- Added sample-selection notes for the three JSON fixtures.
- Added a direct `rearHandPunch01` generation workflow: select a rear arm chain part, choose the rear-hand punch template in the `Action` dropdown, and run `Generate beats/path`.
- Kept development references to `HANDOFF.md`, `animotion_2_5_d_planning_spec.md`, and `AI_VISION_WORKFLOW_STRATEGY.md`.
- Restated the rights-safe input principle: use original, licensed, or otherwise usable images/assets.

Impact note:

- This is documentation-only; runtime behavior and project JSON data are unchanged.
- The README explicitly warns that project JSON loading expects the source image to be uploaded first.
- The user-visible rear-hand punch label may depend on browser font/encoding display, but the internal saved template id remains `rearHandPunch01`.
- The pre-existing local modification to `scripts/motion-draft-editor.js` and local scratch files are intentionally excluded from this upload.

Verification for this upload:

- `git diff --check -- README.md` passed with only LF-to-CRLF conversion warnings.
- A final staged diff check should include only `README.md` and this `HANDOFF.md` update.

Upload scope:

- Include:
  - `README.md`
  - `HANDOFF.md`
- Exclude unrelated local artifacts and scratch files unless explicitly requested:
  - `scripts/motion-draft-editor.js`
  - `_analysis_frames/`
  - `recording/`
  - screenshots
  - `animotion-project (10).json`
  - `animotion-project (11).json`
  - `tests/motion-draft-billing-controls.test.js`
  - planning scratch files

### Latest 2026-06-18 Rear-Hand Punch Template and Project Fixtures Handoff

This handoff captures the added `rearHandPunch01` action template, exposed in the UI as `뒷손펀치_01`, plus the requested project/image fixture upload scope.

Problem 1-pager:

- Context: `animotion-project (17).json` contains a saved rear-cross/rear-hand punch action with 18 frames, impact frame 15, `punchStyle: "rear-cross"`, a terminal hand endpoint, and manual target/anchor data. The existing UI already had the generic `Punch` template, but did not expose this saved rear-hand punch as a separate selectable motion template.
- Problem: adding a separate template only to the UI would make it selectable, but would risk bypassing existing punch-specific rear-cross behavior such as terminal hand resolution, rear-cross auto target adjustment, lead-hand retreat, body/root follow, status/debug reporting, and loaded punch track upgrade compatibility.
- Goal: add a distinct selectable template named `뒷손펀치_01` while keeping the generated action stored with its own template id and reusing the proven punch/rear-cross code path internally.
- Non-goals: no broad motion planner rewrite, no new project schema, no JSON repair pass for malformed historical fixture text, no change to the existing generic `Punch` behavior, and no import of unrelated local scratch assets.
- Constraints: keep files small, avoid editing already-overgrown files where possible, preserve existing rear-cross/jab/kick regressions, and keep the user-requested image/project files explicit in the upload.

Options considered:

- Add `뒷손펀치_01` as a hidden parameter of the existing `punch` template. Pro: minimal implementation. Con/risk: the UI still would not show a distinct motion template, and saved actions would not be easy to distinguish from ordinary punch generation.
- Add a distinct action spec with `baseTemplate: "punch"` and `punchStyle: "rear-cross"`. Pro: the UI gets a separate option, saved actions keep a separate template id, and existing rear-cross punch behavior remains shared. Con/risk: all punch-specific selectors need a punch-like check instead of direct `template === "punch"` checks. Chosen.

Implemented behavior:

- Added `rearHandPunch01` to `scripts/action-specs.js`.
  - UI label is `뒷손펀치_01`.
  - Internal saved template id is ASCII: `rearHandPunch01`.
  - The template uses the saved project timing: 18 duration frames and impact frame 15.
  - Beat phases match the saved rear-cross punch shape: `guard -> windup -> drive -> extension -> impact -> recover`.
  - `baseTemplate: "punch"` and `punchStyle: "rear-cross"` mark it as a punch-compatible rear-hand template.
- Added action-spec helpers for punch-like templates:
  - `baseTemplateFor(id)`
  - `punchStyleFor(id)`
  - `isPunchLike(id)`
- Updated `scripts/motion-planner.js` so punch-like templates keep their own template id in `actionTimeline`, but use punch-compatible classification and anchor generation internally.
- Updated command, selector, track, status, path explanation, and primary-selection paths to use punch-like checks where a rear-hand punch should behave like a punch:
  - `scripts/motion-planner-commands.js`
  - `scripts/cutscene-action-selectors.js`
  - `scripts/motion-track-builder.js`
  - `scripts/motion-primary-selection.js`
  - `scripts/cutscene-motion-status.js`
  - `scripts/motion-path-explainer.js`
- Selecting an upper arm, forearm, or hand in a valid arm chain can still resolve to the terminal punching hand for `rearHandPunch01`.
- The generated action remains `rearHandPunch01`, while `targetDebug.punchStyle` is forced to `rear-cross`.
- Existing generic `punch`, jab, rear-cross, kick, and boxing step behavior remains covered by focused regression tests.

Impact note:

- The user-visible template name is `뒷손펀치_01`; the project JSON stores `actionTimeline.template: "rearHandPunch01"`.
- `rearHandPunch01` intentionally reuses rear-cross punch support rather than duplicating planner math.
- `animotion-project (17).json` was used as the behavior reference, but historical JSON parsing defects in that file were not repaired in this implementation unit.
- The pre-existing local modification to `scripts/motion-draft-editor.js` was not part of this template change and should not be mixed into the upload unless it is separately reviewed.

Regression tests added or updated:

- Updated `tests/action-specs.test.js` for the new template metadata, label, timing, punch-like mapping, and editable beat ids.
- Updated `tests/rear-cross-lead-hand-retract.test.js` to verify `rearHandPunch01` keeps its distinct template id while preserving rear-cross support and lead-hand retreat.
- Added `tests/rear-hand-punch-template.test.js` to exercise the UI command path through `motionPlannerCommands.generateFromSelection()`.

Verification for this upload:

- `node --check scripts\action-specs.js`
- `node --check scripts\motion-planner.js`
- `node --check scripts\motion-planner-commands.js`
- `node --check scripts\cutscene-action-selectors.js`
- `node --check tests\rear-hand-punch-template.test.js`
- `node tests\action-specs.test.js`
- `node tests\rear-cross-lead-hand-retract.test.js`
- `node tests\rear-hand-punch-template.test.js`
- `node tests\cutscene-action-selectors.test.js`
- `node tests\cutscene-motion-status.test.js`
- `node tests\motion-planner-commands.test.js`
- `node tests\action-timeline-model.test.js`
- `node tests\motion-path-explainer.test.js`
- `node tests\loaded-punch-track-upgrade.test.js`
- `node tests\preview-point-info.test.js`
- `node tests\action-frame-editor.test.js`
- `git diff --check`

Result: all focused tests listed above passed locally. `git diff --check` reported only LF-to-CRLF conversion warnings.

Upload scope:

- Include the rear-hand punch template implementation and tests:
  - `scripts/action-specs.js`
  - `scripts/motion-planner.js`
  - `scripts/motion-planner-commands.js`
  - `scripts/cutscene-action-selectors.js`
  - `scripts/motion-track-builder.js`
  - `scripts/motion-primary-selection.js`
  - `scripts/cutscene-motion-status.js`
  - `scripts/motion-path-explainer.js`
  - `tests/action-specs.test.js`
  - `tests/rear-cross-lead-hand-retract.test.js`
  - `tests/rear-hand-punch-template.test.js`
  - `HANDOFF.md`
- Include the user-requested fixtures/assets:
  - `lookism/boxer.png`
  - `animotion-project (8).json`
  - `animotion-project (17).json`
  - `animotion-project (17-1).json`
- Exclude unrelated local artifacts and scratch files unless explicitly requested:
  - `_analysis_frames/`
  - `recording/`
  - screenshots
  - `animotion-project (10).json`
  - `animotion-project (11).json`
  - unrelated Lookism screenshots
  - pre-existing `scripts/motion-draft-editor.js` changes

### Latest 2026-06-07 Supplemental Follow Parts and Rear-Cross Arm Gap Handoff

This handoff captures the completed non-destructive supplemental follow system for rear-cross/rear-hand punch shoulder and elbow gaps, plus the UI path for copied regular parts.

Problem 1-pager:

- Context: rear-hand punch preview can expose empty shoulder and elbow regions when the upper arm and forearm separate. Existing hidden-completion supplemental parts render non-destructively, but they previously followed only the source part group and had no runtime follow metadata for copied fill pieces.
- Problem: static shoulder fills should stay attached to torso/body/shoulder space, while elbow fills should track the evaluated upperArm.joint and forearm.pivot. Copied regular parts also needed a visible UI path to become supplemental fill parts after loading existing JSON.
- Goal: add optional `part.supplementalFollow` metadata, compute follow transforms only at preview/playback runtime, preserve legacy JSON, and expose minimal inspector controls for copied fill parts.
- Non-goals: no mesh/4-point warp, no foot/leg follow implementation, no saved punch regeneration or migration, no destructive part merge/bake, and no broad motion planner rewrite.
- Constraints: do not mutate `state.parts` order or saved JSON during preview, keep hidden-completion, visibilityMask, cutsceneDepth, handTip, and rear-cross punch behavior intact, and keep new helper files under 300 LOC.

Options considered:

- Put follow logic directly into `preview-supplemental-renderer.js`. Pro: fewer files. Con/risk: mixes draw ordering with coordinate math and makes later 4-point warp harder.
- Add a focused supplemental-follow helper and keep renderers as consumers. Pro: isolates coordinate-space math, makes unit testing easier, and preserves hidden-completion renderer structure. Con/risk: requires script load-order and project-normalization wrappers. Chosen.
- Make every copied part automatically supplemental. Pro: one-click copy becomes immediately usable as a fill. Con/risk: breaks normal duplicate-part workflow. Chosen alternative: copied parts receive `supplementalCandidateSourcePartId`, show the supplemental UI, and become real supplemental parts only when the user clicks `Use as supplemental`, `Shoulder fill`, or `Elbow joint fill`.

Implemented behavior:

- Added `scripts/supplemental-follow.js`.
  - `shoulderFill` uses `mode: "staticAttach"` and follows a torso/body/shoulder driver matrix through a stored bind matrix.
  - `elbowJointFill` uses `mode: "jointBridge"` and tracks the midpoint between evaluated `upperArm.joint` and `forearm.pivot`.
  - Elbow fill rotation is based on the anchor direction in v1, and scale/stretch increases as the anchor distance grows.
  - Runtime math is position/rotation/scale only; no mesh warp was added.
- Added `scripts/supplemental-follow-project.js` to preserve optional `supplementalFollow` metadata through project normalize/save without migrating legacy parts.
- Added `scripts/supplemental-follow-commands.js` for manual supplemental conversion and follow assignment commands.
- Added `scripts/supplemental-follow-controls.js` for minimal inspector controls:
  - `Use as supplemental`
  - `Shoulder fill`
  - `Elbow joint fill`
  - `Clear follow`
- Copied parts now receive `supplementalCandidateSourcePartId`; this makes the supplemental inspector section visible for the copy without silently converting it to a persisted supplemental part.
- Clicking a follow button on a copied candidate converts it into a non-destructive supplemental part with `isSupplementalPart: true`, `sourcePartId`, `supplementalKind: "manualCopy"`, and follow metadata.
- `preview.worldMatrix()` now returns the runtime supplemental follow matrix only for parts with `supplementalFollow`.
- Supplemental draw paths now use the follow matrix for follow parts while preserving source-group draw ordering for existing hidden-completion supplemental parts.
- Preview draw no longer writes `supplementalCoverage` onto follow parts; runtime follow computation does not mutate saved part data.
- `ui.refreshUi()` refreshes supplemental follow controls after inspector visibility is rendered, so the UI reappears after selecting a normal part and returning to a supplemental/candidate part.
- Rear-cross punch lead-hand elbow locking remains scoped to the lead/front retreat chain and no longer affects the rear punching chain.

Impact note:

- Follow rendering depends on `scripts/supplemental-follow.js` loading before preview/runtime draw modules.
- Follow command/UI depends on `scripts/supplemental-follow-commands.js` loading after `part-commands` and `part-transform-commands`.
- Existing supplemental hidden-completion parts without `supplementalFollow` keep the previous source-group behavior.
- Legacy JSON without `supplementalFollow` is ignored safely and is not auto-migrated.
- Normal copy remains non-destructive and reversible; only explicit user action turns a copy into a supplemental part.

Regression tests added or updated:

- Added `tests/supplemental-follow.test.js` for shoulder fill driver following, elbow midpoint following, stretch growth, preview no-mutation, project metadata preservation, and command assignment.
- Added `tests/supplemental-follow-controls.test.js` for inspector control installation and command dispatch.
- Updated `tests/ui-inspector.test.js` for supplemental UI visibility returning after normal-part selection and for copied regular part candidates showing the follow controls before conversion.
- Updated `tests/part-transform-commands.test.js` to verify copied parts receive `supplementalCandidateSourcePartId`.
- Updated preview/render fixtures and focused hidden-completion/render-order tests to load the new follow helper.
- Rear-cross/punch regressions cover lead-hand retreat scoping and rear punching chain freedom.

Verification for this upload:

- `node tests\supplemental-follow.test.js`
- `node tests\supplemental-follow-controls.test.js`
- `node tests\ui-inspector.test.js`
- `node tests\part-transform-commands.test.js`
- `node tests\preview-render-order-supplemental-fill.test.js`
- `node tests\hidden-completion-supplemental-load.test.js`
- `node tests\part-visibility-masks.test.js`
- `node tests\preview-render-order-runtime.test.js`
- `node tests\rear-cross-lead-hand-retract.test.js`
- `node tests\motion-planner-commands.test.js`
- `node tests\punch-hand-tip-regression.test.js`
- `node tests\cutscene-depth.test.js`
- `Get-ChildItem tests -Filter *.test.js | Sort-Object Name | ForEach-Object { node $_.FullName; if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE } }`
- `git diff --check`

Result: all focused tests and the full JavaScript test suite passed locally. `git diff --check` reported only LF-to-CRLF conversion warnings.

Upload scope:

- Include supplemental follow runtime/project/command/UI files, preview draw/runtime wiring, copied-part candidate metadata, UI refresh ordering, rear-cross lead-hand retreat scoping, related tests, and this `HANDOFF.md` update.
- Include source/test files currently required by the passing local suite for this branch.
- Exclude local QA/user artifacts and scratch files: `_analysis_frames/`, `animotion-project (*.json)`, `lookism/*.png`, `recording/`, screenshots, and planning scratch files unless explicitly requested.

### Latest 2026-06-06 Source Polygon Point Editing Handoff

This handoff captures the completed source-canvas polygon point editing pass for manual part creation and existing part outlines.

Problem 1-pager:

- Context: source-canvas editing shows polygon handles for selected parts, and the polygon creation tool lets users place points before capturing a new part.
- Problem: users needed direct cleanup for mistaken polygon points: delete unwanted selected-part outline vertices and move already placed points while drawing a new polygon.
- Goal: support double-click deletion of selected part polygon vertices and click-drag movement of existing points in an open polygon selection used for new part creation.
- Non-goals: no persisted schema change, no visibility-mask vertex deletion shortcut, no new UI button, no browser framework/dependency change, and no unrelated motion/action behavior change.
- Constraints: preserve the first-point click-to-close polygon workflow, keep visibility-mask edit targets isolated from part editing, preserve undo/redo for existing part outline edits, and keep touched implementation/test files under 300 LOC.

Options considered:

- Handle all source-canvas polygon editing directly inside `events.js`. Pro: fewer files. Con/risk: `events.js` was already over the 300 LOC target and mixes drawing, selection, inspector, and window events.
- Split source-canvas input into a focused module and keep geometric mutations in `editor.js`. Pro: keeps source input handling isolated, preserves existing editor hit-test/coordinate conversion behavior, and brings touched files under 300 LOC. Con/risk: requires bootstrap load-order update. Chosen.

Implemented behavior:

- Added `scripts/source-canvas-events.js` for source-canvas pointer/wheel/double-click input.
- `scripts/events.js` now delegates source-canvas binding and selection closing to `Animotion.sourceCanvasEvents`, reducing it to 240 LOC.
- Selected part polygon/lasso outline vertices can be double-clicked in edit mode to delete a point, while keeping at least three vertices.
- Existing selected-part outline vertex dragging still works through the source-canvas pointer path and uses existing `applyShapeToPart()` history/canvas update behavior.
- While using the polygon tool for a new part, clicking and dragging an existing open polygon point moves that point instead of adding a duplicate point.
- Clicking away from existing open polygon points still appends a new point.
- Clicking back on the first point still closes the polygon and switches to edit mode.
- Active visibility-mask edit targets remain isolated; part-outline deletion and part-target drags do not mutate visibility-mask geometry by mistake.
- All touched implementation and test files are below 300 LOC: `scripts/source-canvas-events.js` 172, `scripts/events.js` 240, `scripts/editor.js` 253, `tests/events-history-shortcuts.test.js` 238, `tests/source-editor-transform.test.js` 292, and `tests/source-polygon-selection-drag.test.js` 122.

Impact note:

- Source canvas input now depends on `scripts/source-canvas-events.js` loading before `scripts/events.js`; `scripts/bootstrap.js` was updated accordingly.
- Existing external `Animotion.events.bindEvents()` and `Animotion.events.onSourcePointerDown` entrypoints remain available.
- Existing part outline edits still go through `Animotion.editor.applyDragEdit()` and `Animotion.parts.applyShapeToPart()`, so project sync, part canvas updates, and command-history snapshots are preserved.
- New open-polygon point movement mutates only `state.selection.points`; it does not create a command-history entry because the part does not exist yet.

Regression tests added or updated:

- Added `tests/source-polygon-selection-drag.test.js` for open polygon point drag, point append, and first-point close behavior.
- Updated `tests/source-editor-transform.test.js` for source-canvas pointer-route part vertex dragging and visibility-mask isolation.
- Updated `tests/events-history-shortcuts.test.js` to load `source-canvas-events.js` and verify source double-click delegation.

Verification for this upload:

- `node --check scripts\source-canvas-events.js`
- `node --check scripts\editor.js`
- `node --check tests\source-polygon-selection-drag.test.js`
- `node tests\source-polygon-selection-drag.test.js`
- `node tests\source-editor-transform.test.js`
- `node tests\events-history-shortcuts.test.js`
- `node tests\part-commands.test.js`
- `node tests\part-visibility-masks.test.js`
- `node tests\source-visibility-mask-render.test.js`
- `git diff --check`

Result: all listed focused tests passed locally. `git diff --check` reported only CRLF conversion warnings.

Upload scope:

- Include `scripts/source-canvas-events.js`, `scripts/events.js`, `scripts/editor.js`, `scripts/bootstrap.js`, `tests/source-polygon-selection-drag.test.js`, `tests/source-editor-transform.test.js`, `tests/events-history-shortcuts.test.js`, and this `HANDOFF.md` update.
- Exclude pre-existing unrelated local changes and QA/user artifacts: `scripts/boxing-step-locomotion.js`, `tests/boxing-step-locomotion.test.js`, `_analysis_frames/`, `animotion-project (10).json`, `animotion-project (11).json`, `lookism/*.png`, `recording/`, screenshots, and untracked planning scratch files unless explicitly requested.

### Latest 2026-06-01 BoxingStep Locomotion and Extensible ActionSpec Handoff

This handoff captures the completed `boxingStep` locomotion action and the runtime `ActionSpec` split.

Problem 1-pager:

- Context: punch motion quality is now acceptable, and the next expansion is a concise boxing step locomotion action rather than another attack/hook action.
- Problem: punch/kick/dash behavior and saved JSON need to remain stable while adding a new action family and avoiding more action-specific hardcoding.
- Goal: add `boxingStep` as a short forward locomotion action driven by direction/distance, with generic action-frame buttons from the action timeline/spec.
- Non-goals: no weapon action implementation, no hidden-completion provider changes, no AI/Stability/Local SD changes, no B correspondence changes, and no old JSON migration.
- Constraints: keep body-part-only actions working, preserve saved `cutsceneBridge`/`part.keyframes`, keep new modules small, and keep future prop/weapon concepts extensible.

Options considered:

- Add `boxingStep` directly inside `motion-planner.js`. Pro: fewer files. Con/risk: grows action-specific branching and makes future action families harder to isolate.
- Add small runtime action/track/locomotion modules. Pro: keeps the planner core small and makes action metadata shared by planner/editor/tests. Con/risk: requires careful script/test load ordering. Chosen.

Implemented behavior:

- Added `scripts/action-specs.js` for `punch`, `kick`, `dash`, and `boxingStep`.
- `ActionSpec.primaryFocus` is now extensible: `{ owner: "bodyPart" | "prop", role, point }`.
- Current specs use only `owner: "bodyPart"` at runtime, and include empty `requiredProps` and `attachments` plus a `focusTarget` object for future prop/weapon actions.
- Punch/kick beat lists are preserved through specs. Dash remains available to the planner but does not gain an action timeline, preserving legacy saved behavior.
- Added `scripts/boxing-step-locomotion.js`; generated `jointAction.actionTimeline.template` is `"boxingStep"`.
- Default boxing step beats are `guard -> weightShift -> leadFootStep -> rearFootFollow -> settle` with 16 default frames.
- Boxing step is a locomotion action: no target point, no attack trajectory, and no `impactExaggeration`.
- Forward direction is implemented; internal direction/distance fields are structured for backward/left/right expansion later.
- Root/body/head/arms move together over a short distance. Foot/leg chains step lead foot first and rear foot follows; no-leg rigs fall back to body-only motion.
- Added `scripts/motion-track-builder.js` to keep existing punch/kick/dash part-track generation outside the planner.
- Added `scripts/motion-planner-controls.js` so UI controls stay separate from planner generation logic.
- Action-frame editor now reads editable frames from `actionSpecs`/`actionTimeline`, so boxing step buttons are generated from spec data and pose drags still write to `part.keyframes`.
- Trajectory remains read-only diagnostic data during action-frame editing.
- Legacy punch/kick selector fallback was preserved for older saved actions that have `actionTimeline.template` but no loaded `actionSpecs`.

Regression tests added or updated:

- `tests/action-specs.test.js`
- `tests/boxing-step-locomotion.test.js`
- `tests/action-frame-editor.test.js`
- `tests/action-frame-pose-drag.test.js`
- Existing motion planner/action timeline tests were updated to load the new helper modules.

Verification for this upload:

- `node --check scripts\action-specs.js`
- `node --check scripts\boxing-step-locomotion.js`
- `node --check scripts\motion-planner.js`
- `node --check scripts\motion-track-builder.js`
- `node --check scripts\motion-planner-controls.js`
- `node tests\action-specs.test.js`
- `node tests\boxing-step-locomotion.test.js`
- `node tests\action-frame-editor.test.js`
- `node tests\action-frame-pose-drag.test.js`
- `node tests\action-timeline-model.test.js`
- `node tests\motion-planner-commands.test.js`
- `node tests\cutscene-options.test.js`
- `Get-ChildItem tests -Filter *.test.js | Sort-Object Name | ForEach-Object { node $_.FullName }`
- `git diff --check`

Result: all focused tests and the full JavaScript test suite passed locally. `git diff --check` reported only CRLF conversion warnings.

Upload scope:

- Include the new action spec, boxing step locomotion, planner helper modules, bootstrap/load-order changes, action-frame generalization, and tests.
- Include this `HANDOFF.md` update.
- Exclude local QA/user artifacts: `_analysis_frames/`, `animotion-project (10).json`, `animotion-project (11).json`, `lookism/*.png`, `recording/`, and screenshot/video artifacts.

### Latest 2026-06-01 Visibility Mask Outline-Rebase Handoff

This handoff captures the current local tracked change that preserves visibility-mask placement when a part outline is edited.

Problem 1-pager:

- Context: the 2026-05-26 edit-target model made visibility masks editable as child targets of a parent part, but part-outline edits still needed a stable rule for existing mask geometry.
- Problem: when a parent part outline changes, mask points are stored in part-local coordinates, so leaving them untouched can shift the mask's image-space placement.
- Goal: preserve each existing visibility mask's image-space polygon while rebasing its local points into the new part rect.
- Non-goals: no schema change, no visibility-mask transform animation change, no hidden-completion provider change, and no QA artifact upload.
- Constraints: keep the runtime command path small, preserve undo/redo snapshot behavior, and keep static flip/rotation transforms from rewriting mask geometry.

Options considered:

- Leave mask local points unchanged. Pro: smallest code change. Con/risk: part outline edits can visually move existing masks to the wrong image region.
- Rebase mask local points through image-space coordinates during `applyShapeToPart()`. Pro: keeps user-authored mask placement stable through outline edits. Con/risk: depends on the existing part rect and should not run for static transform-only commands. Chosen as the simpler user-facing behavior.

Implemented behavior:

- `scripts/part-commands.js` now rebases `part.visibilityMasks[].mask.points` when `applyShapeToPart()` changes a part rect.
- Pivot, joint, and handTip still preserve their image-space positions through the same outline-edit path.
- Visibility-mask keyframes, ids, enabled state, and strength values are preserved.
- Static selected-part transform commands, including horizontal flip and rotation, do not rewrite existing visibility-mask geometry.

Impact note:

- `applyShapeToPart()` is reached from source edit dragging, the Apply Outline button, `Animotion.parts.applyShapeToPart()`, and the command-history wrapper.
- The change affects only outline/shape application for parts with existing visibility masks; normal part creation, copy, flip, rotate, mask-target editing, and project schema are not intentionally changed.

Regression tests added or updated:

- `tests/source-editor-transform.test.js` now verifies that part-outline edits preserve visibility-mask image-space placement and keyframes while rebasing local mask points.
- `tests/part-transform-commands.test.js` now verifies that flip/rotation keep existing visibility-mask geometry unchanged.

Verification for this upload:

- `node tests\source-editor-transform.test.js`
- `node tests\part-transform-commands.test.js`
- `node tests\part-visibility-masks.test.js`
- `node tests\part-commands.test.js`
- `node tests\preview-render-order.test.js`
- `git diff --check`

Result: all listed focused tests passed locally. `git diff --check` reported only CRLF conversion warnings.

Upload scope:

- Include `scripts/part-commands.js`, `tests/source-editor-transform.test.js`, `tests/part-transform-commands.test.js`, and this `handoff.md` update.
- Exclude local QA/user artifacts: `_analysis_frames/`, `animotion-project (10).json`, `animotion-project (11).json`, `lookism/*.png`, screenshot/video artifacts.
- Leave untracked planning scratch files out of this upload unless explicitly requested.

### Latest 2026-05-26 Visibility Mask Edit Target and Transformed Source Editing Handoff

This handoff captures the completed visibility-mask edit-target model, transformed source/original-cut editing fixes, and regression coverage.

Edit target model:

- Added `scripts/edit-target.js` as a runtime-only edit-target helper.
- `state.editTarget` now defaults to `{ kind: "part", partId: null, maskId: null }`.
- Visibility masks remain persisted only under `part.visibilityMasks[]`; they are not real entries in `state.parts`.
- Selecting a parent part sets the edit target to `kind: "part"` and clears stale visibility-mask selection.
- Selecting a visibility-mask child sets the edit target to `kind: "visibilityMask"` for the owning part and mask id.
- Legacy loose fields `selectedPartId`, `selectedVisibilityMaskId`, and `selectedVisibilityMaskPartId` are kept synchronized for compatibility.
- Existing projects without `editTarget` still load and behave as part-editing sessions.

Source/original-cut editor behavior:

- Source editor hit-testing now follows the same transformed geometry used for rendering copied, moved, flipped, and rotated parts.
- When `editTarget.kind === "part"`, only the selected part outline handles are draggable; visibility-mask polygon handles are not editable.
- When `editTarget.kind === "visibilityMask"`, only the active mask polygon handles are draggable; the parent part outline is not edited.
- Edited visibility-mask points are saved back in the parent part's local coordinate space.
- Polygon selection used for creating a new visibility mask is cleared after creation so it does not accidentally remain as a later part-edit input.

Inspector and controls:

- The visibility-mask controls now show mask entries as child edit targets under the selected parent part.
- The `Edit part` child control switches back to parent part-outline editing.
- Strength, keyframe, and remove controls are enabled only when a visibility-mask edit target is active.
- Source overlays draw the selected part outline and visibility-mask polygons with different styles; only the active edit target shows draggable handles.

Clone/copy and render behavior:

- Copying/duplicating a part regenerates every cloned `visibilityMasks[].id`.
- Copying a part selects the new copy as a part edit target, preventing accidental selection of a mask id shared with the original.
- Visibility-mask rendering remains isolated to the owning part: masks are applied with `destination-out` inside an offscreen/local part layer, then composited back to the main canvas.
- A mask on one part no longer erases previously drawn overlapping parts or the original source image background.

Relevant files:

- `scripts/edit-target.js`
- `scripts/dom-state.js`
- `scripts/bootstrap.js`
- `scripts/editor.js`
- `scripts/render.js`
- `scripts/ui.js`
- `scripts/session-commands.js`
- `scripts/part-commands.js`
- `scripts/part-command-history.js`
- `scripts/part-transform-commands.js`
- `scripts/part-transform-geometry.js`
- `scripts/part-visibility-mask-commands.js`
- `scripts/part-visibility-mask-controls.js`
- `scripts/part-visibility-mask-render.js`
- `scripts/part-visibility-masks.js`
- `scripts/preview-part-renderer.js`

Regression tests added or updated:

- `tests/source-editor-transform.test.js`
- `tests/part-visibility-mask-controls.test.js`
- `tests/part-visibility-masks.test.js`
- `tests/part-transform-commands.test.js`
- `tests/source-visibility-mask-render.test.js`
- `tests/preview-render-order.test.js`

Verification already run before this handoff update:

- `node tests\source-editor-transform.test.js`
- `node tests\part-visibility-masks.test.js`
- `node tests\part-visibility-mask-controls.test.js`
- `node tests\part-transform-commands.test.js`
- `node tests\source-visibility-mask-render.test.js`
- `node tests\preview-render-order.test.js`
- `node tests\ui-inspector.test.js`
- `node tests\session-commands.test.js`
- `Get-ChildItem tests -Filter *.test.js | ForEach-Object { node $_.FullName }`
- `git diff --check`

Result: all focused tests and the full JavaScript test suite passed locally. `git diff --check` reported only CRLF conversion warnings.

Important untracked local files:

- `_analysis_frames/`, `animotion-project (10).json`, `animotion-project (11).json`, `lookism/*.png`, and screenshot/video artifacts are local QA/user artifacts and should not be committed unless explicitly requested.

### Latest 2026-05-26 Polygon Structure, Visibility Masks, and Render Hook Fix Handoff

This handoff captures the latest part-structure UI, animated visibility-mask feature, `index.html` size refactor, and the follow-up crash fix from real QA video review.

Part structure editing:

- Added polygon-based part structure commands in `scripts/part-structure-commands.js`.
- Users can extract a drawn polygon region into a new manual split part.
- Users can merge selected/source parts into one polygon part.
- Added `scripts/part-structure-controls.js` to expose the structure tools in the inspector without placing them in the destructive/danger section.
- Structure edits use the existing part command/history path and do not change the persisted base part schema beyond normal part fields.

Animated visibility masks:

- Added `scripts/part-visibility-masks.js` for normalizing polygon masks, frame keyframes, and evaluated mask strength.
- Added `scripts/part-visibility-mask-commands.js` for creating a mask from the current selection and setting per-frame strength.
- Added `scripts/part-visibility-mask-controls.js` for the UI.
- Added `scripts/part-visibility-mask-render.js` and wired it into `scripts/preview-part-renderer.js`.
- The visibility mask hook intentionally runs immediately after the normal part `drawImage()` call, using `destination-out` to hide the active mask region at the evaluated frame strength.
- Normal parts with no visibility masks still render normally; `activeMasks()` returns an empty list and the render hook is a no-op.
- Visibility masks persist on `part.visibilityMasks` through project save/load normalization.

Visibility mask crash fix:

- A QA recording showed the preview could break after the visibility-mask update.
- Root cause: `scripts/preview-part-renderer.js` called `Animotion.partVisibilityMaskRender.apply(..., frame, ...)` inside `drawNormalPart()`, but `frame` was scoped only inside `drawPart()`.
- Fix: `drawPart()` now passes the evaluated current frame explicitly into `drawNormalPart(part, replacement, segmented, frame, context)`.
- The hook remains after part drawing and still receives the actual current frame.
- Persisted schema, hidden-completion rendering, supplemental part behavior, punch/kick planner behavior, and render-order policy were not intentionally changed.
- Added a regression in `tests/preview-render-order.test.js` that stubs the visibility-mask hook and verifies normal preview rendering passes `state.currentFrame` into it. This would fail on the prior `ReferenceError: frame is not defined`.
- Updated `tests/preview-render-order-fixture.js` to load the visibility mask modules so preview tests exercise the real hook.

`index.html` and file-size status:

- `index.html` was refactored from 366 lines to 151 lines while preserving the existing DOM ids used by the scripts/tests.
- Current checked changed/added implementation files remain under the 300-line target:
  - `index.html`: 151 lines.
  - `scripts/bootstrap.js`: 154 lines.
  - `scripts/part-commands.js`: 249 lines.
  - `scripts/project-model.js`: 275 lines.
  - `scripts/preview-part-renderer.js`: 158 lines.
  - New structure/visibility modules and their tests are all under 300 lines.

Real QA/video findings:

- Uploaded recording `화면 녹화 중 2026-05-26 004301.mp4` was inspected by extracting representative frames.
- The JSON was not empty: `animotion-project (10).json` restored 11 parts and the original source image at `1023 x 1537`.
- The diagonal lines visible in the lower preview were cutscene speed-line effects, not part polygon outlines.
- Existing `animotion-project (10).json` and `(11).json` contain supplemental hidden-completion parts without `supplementalCanvasDataUrl`, so old supplemental pixels can still regenerate differently from the original save. This is separate from the visibility-mask crash.
- The immediate post-update preview break was traced to the visibility-mask hook `frame` scope bug and fixed as above.

Verification already run before this handoff update:

- `node tests\part-visibility-masks.test.js`
- `node tests\preview-render-order.test.js`
- `node tests\preview-render-order-supplemental-fill.test.js`
- `node tests\hidden-completion-action-drafts.test.js`
- `node tests\hidden-completion-supplemental-part.test.js`
- `Get-ChildItem tests -Filter *.test.js | ForEach-Object { node $_.FullName }`
- `git diff --check`

Result: all focused tests and the full JS test suite passed locally. `git diff --check` reported only CRLF conversion warnings.

Important untracked local files:

- `_analysis_frames/` was generated locally from the uploaded QA video for diagnosis and should not be committed.
- `animotion-project (10).json`, `animotion-project (11).json`, uploaded/QA `lookism/*.png` files, and screenshot/video artifacts remain local user/QA files and should not be committed unless explicitly requested.

### Latest 2026-05-25 Rig Part Transform Controls and 300-Line Legacy Refactor Handoff

This handoff captures the latest rig-part transform feature work and the first incremental 300-line legacy refactor passes.

Rig part transform controls:

- Added selected rig part copy, horizontal flip, clockwise rotation, and counter-clockwise rotation.
- Added user-controlled rotation angle input. The default is `90` degrees; clockwise/counter-clockwise buttons apply the current input value.
- Transform controls are inserted into a normal `리깅 파츠 변형` inspector section, not the `위험 작업` section.
- `위험 작업` now remains reserved for destructive delete behavior.
- The public command surface is preserved through `Animotion.partCommands`:
  - `copySelectedPart`
  - `flipSelectedPartHorizontal`
  - `rotateSelectedPartClockwise`
  - `rotateSelectedPartCounterClockwise`
  - `rotateSelectedPartBy`
- Copy creates a selected duplicate with a small offset, preserves project sync, and records history.
- Flip and rotation update the selected part's static `transform` through existing part update/history paths.
- Static part transforms are applied by preview matrix evaluation and are covered by parent/world transform regression tests.

Preview/render-order module split:

- `scripts/preview.js` was split into smaller runtime modules while preserving `Animotion.preview.drawPreview`, `worldMatrix`, `localMatrix`, and `currentMotionFrame`.
- New preview helper modules:
  - `scripts/preview-scene.js`
  - `scripts/preview-hidden-fill.js`
  - `scripts/preview-supplemental-renderer.js`
  - `scripts/preview-part-renderer.js`
  - `scripts/preview-rig-overlay.js`
  - `scripts/preview-static-transform.js`
- `tests/preview-render-order.test.js` was split into focused test files plus `tests/preview-render-order-fixture.js`.
- Render behavior was not intentionally changed. The split preserves existing source panel, cutscene effects, ghost part, hidden-completion fill, supplemental, depth top-up, and overlay behavior.

Legacy 300-line refactor status:

- `scripts/preview.js`: reduced to 158 lines through the preview module split.
- `tests/preview-render-order.test.js`: reduced to 115 lines through focused test files and a shared fixture.
- `scripts/part-commands.js`: reduced from 334 to 281 lines by extracting supplemental-part transform patch calculation to `scripts/part-supplemental-transform.js`.
- `scripts/arm-extension.js`: reduced from 301 to 299 lines by extracting segmented render adapter behavior to `scripts/arm-extension-segment.js`.
- All modified/added files from these passes are under 300 lines.
- Persisted schema, planner output, render output, and existing public APIs were intentionally kept unchanged.

Important untracked local files:

- `animotion-project (10).json`, `animotion-project (11).json`, several `lookism/*.png` files, and one screenshot remain untracked local QA/user artifacts.
- They were not staged for the code upload unless explicitly requested later.

Verification already run before this handoff update:

- `node tests\part-transform-commands.test.js`
- `node tests\part-action-controls.test.js`
- `node tests\part-commands.test.js`
- `node tests\arm-extension-controls.test.js`
- `node tests\motion-replacement-layer.test.js`
- `node tests\cutscene-motion-status.test.js`
- `node tests\hand-tip-fallback.test.js`
- `node tests\punch-hand-tip-regression.test.js`
- `Get-ChildItem tests -Filter *.test.js | ForEach-Object { node $_.FullName }`
- `git diff --check`

Result: all tests passed locally. `git diff --check` passed with only CRLF conversion warnings.

### Latest 2026-05-25 Hidden Completion Render Order and Canvas Snapshot Handoff

This section supersedes the earlier assumption that supplemental hidden-completion parts are safely rendered immediately after their source part. The latest real-project QA with `animotion-project (10).json` and `animotion-project (11).json` proved two separate failure layers and fixes:

1. Rear upperArm hidden-completion was visually covering foreground forearm/hand because both direct ready patches and generated supplemental parts were drawn too late.
2. Body supplemental warp edits were preserved, but old projects could look different after reload because supplemental canvas pixels were not persisted and were regenerated from current logic.

Render-policy fix:

- Added `scripts/hidden-completion-fill-scheduler.js`.
- Direct ready patch and generated supplemental part paths are now normalized into hidden-completion fill requests.
- Preview collects hidden-completion fill requests before normal part drawing and schedules them before detected foreground occluders.
- The scheduler uses role/name/type/overlap and same-limb-chain heuristics, not body-specific or rearUpperArm-specific IDs.
- For limb chains, upperArm fill draws before same-chain forearm/hand when those parts would otherwise occlude the fill.
- For body/torso fills, overlapping arm/hand/face/hair/clothing-style foreground parts are detected as occluders.
- The fill still follows the source part transform/pose.
- Hidden-completion fill is not redrawn during depth-top-up or late overlay passes.
- `state.parts` order and saved JSON order are unchanged.

Render diagnostics now include:

- `visiblePath`: `direct-ready-patch` or `supplemental-part`.
- `scheduledBeforePartIds`.
- `foregroundOccluderIds`.
- `actualDrawIndex`.
- `foregroundDrawnBeforeFill`.
- `unexpectedForegroundBeforeFill`.
- `wasDepthTopUpSkipped`.

Real failing project evidence after the render-policy fix:

- In `animotion-project (11).json`, the rear upperArm supplemental part `supp-hidden-344d68b5-da9a-4a05-ae0c-aef075518a3d-symmetry` now draws at index `8`.
- The related hand draws at index `10`, forearm at index `11`, and source upperArm at index `12`.
- The supplemental fill reports `visiblePath: "supplemental-part"` and `unexpectedForegroundBeforeFill: false`.
- This confirms the previously repeated symptom was render order / foreground occlusion, not stale supplemental data, counterpart resolution, sampling coverage, or warp placement.

Canvas snapshot persistence fix:

- Added optional supplemental canvas snapshot persistence for generated/user-edited hidden-completion supplemental parts.
- New saved supplemental parts can include:
  - `supplementalCanvasDataUrl`
  - `supplementalCanvasWidth`
  - `supplementalCanvasHeight`
  - `supplementalCanvasVersion`
- `scripts/project-serialization.js` asks `hiddenCompletionSupplementalProject.snapshotFieldsForPart(part)` for those fields during save.
- `scripts/io.js` now restores a saved supplemental canvas snapshot before trying metadata regeneration.
- If a snapshot exists, load uses the saved PNG/dataURL canvas and applies the saved `supplementalWarp` to that restored canvas.
- If no snapshot exists, legacy JSON still falls back to `regenerateCanvasForPart()` exactly as before.

Snapshot diagnostics now include:

- `hasSavedSupplementalCanvas`.
- `restoredCanvasFromSnapshot`.
- `regeneratedCanvasFromMetadata`.
- `supplementalCanvasWidth`.
- `supplementalCanvasHeight`.
- `sourcePatchAssetId`.
- `sourcePartId`.

Important compatibility note:

- Existing files such as `animotion-project (10).json` do not contain canvas snapshots, so their old exact supplemental canvas pixels cannot be reconstructed from the file alone.
- In `(10).json`, the body supplemental `supplementalWarp` was confirmed to be preserved exactly across current load normalization. The visible change came from applying that preserved warp to a regenerated canvas.
- New saves after this change preserve the actual generated supplemental canvas and should be WYSIWYG-stable across save/load.

Files most relevant to the latest state:

- `scripts/hidden-completion-fill-scheduler.js`
- `scripts/preview.js`
- `scripts/render-order-debug.js`
- `scripts/project-serialization.js`
- `scripts/io.js`
- `scripts/hidden-completion-supplemental-project.js`
- `scripts/hidden-completion-supplemental-part.js`
- `scripts/hidden-completion-supplemental-coverage.js`
- `scripts/hidden-completion-supplemental-warp.js`
- `tests/preview-render-order.test.js`
- `tests/hidden-completion-supplemental-load.test.js`
- `tests/hidden-completion-supplemental-part.test.js`
- `tests/hidden-completion-supplemental-sync.test.js`
- `tests/hidden-completion-supplemental-warp.test.js`

Verification already run before this handoff update:

- `node tests\preview-render-order.test.js`
- `node tests\hidden-completion-action-drafts.test.js`
- `node tests\hidden-completion-supplemental-part.test.js`
- `node tests\hidden-completion-supplemental-sync.test.js`
- `node tests\hidden-completion-supplemental-warp.test.js`
- `node tests\hidden-completion-supplemental-load.test.js`
- `Get-ChildItem tests -Filter *.test.js | ForEach-Object { node $_.FullName }`

Result: all listed tests passed locally.

### Latest 2026-05-24 Supplemental Part Render/Coverage Stabilization Handoff

This section supersedes the earlier note that supplemental completion parts render as ordinary ordered parts. The current model is:

- `hiddenCompletionPatch` is the internal/source patch asset. It stores the editable completion guide, silhouette, and mask data.
- A supplemental completion part is the user-facing editable inserted part. It keeps generated canvas/texture data plus metadata: `isSupplementalPart: true`, `supplementalKind: "hiddenCompletionSymmetry"`, `completionMethod: "symmetry"`, `sourcePatchAssetId`, `sourcePartId`, `createdForActionId` or `createdFromJointActionId`, and local `mask`.

Implemented behavior:

- Existing JSON compatibility was fixed so guide/silhouette/mask edits commit back into `project.assets` for the linked `hiddenCompletionPatch`.
- Patch asset updates call the supplemental sync path by `sourcePatchAssetId`, preserving the generated canvas/texture while updating display/edit metadata such as rect/sourceRect/mask.
- Per-part hidden completion drafts now take priority over legacy single `motionDraft`, so selecting `body` returns the body patch and selecting `upperArm` returns the upperArm patch when both exist.
- Multiple supplemental parts can coexist in one action, e.g. body and upperArm supplemental parts. Different `sourcePatchAssetId` values do not hit duplicate prevention.
- Direct patch preview is hidden when a visible supplemental part for that patch/action exists, preventing patch + supplemental double rendering.
- Supplemental parts render inside their `sourcePartId` group, immediately after the source part. Their own high `order` no longer lets them escape the source group.
- Preview clipping uses the supplemental part's local mask. The mask is offset by the part rect before draw, so the visible region is limited to the patch-derived area.

Coverage fix/status:

- Added `scripts/hidden-completion-supplemental-coverage.js`.
- New supplemental generation no longer pre-clips the generated canvas to the mask. It draws the mirrored/counterpart texture into the supplemental rect, then preview clipping applies the mask at render time.
- If a patch mask extends beyond the source rect, supplemental `rect`/`sourceRect` expand to include the patch mask bounds, and mask points are converted to supplemental-local coordinates.
- Sync still does not regenerate canvas/texture. If an existing saved supplemental canvas is already too small or pre-clipped, it stays intact and reports a coverage warning instead of silently passing.
- Coverage debug reports mask bounds, rect bounds, sourceRect bounds, canvas/source bounds, canvas opaque bounds, rendered clipped bounds, approximate coverage ratio, and warnings: `mask-outside-supplemental-rect`, `source-rect-too-small`, `canvas-opaque-bounds-too-small`, `mask-coordinate-mismatch`.
- Inspector/status now exposes supplemental coverage percentage and warning reasons for the selected supplemental part.

Important caveat discussed:

- If two supplemental parts overlap, overlap alone does not create a gap. Each supplemental part is still clipped by its own patch mask and rendered in its own source part group.
- Gaps visible in one still frame usually indicate coverage/mask/canvas/sourceRect mismatch.
- Gaps that appear only during playback are more likely frame-by-frame relative motion between source groups, e.g. body and upperArm moving apart or occluding differently.
- The current work did not add visible frame range logic, bake/merge supplemental parts into originals, or rewrite the whole preview render order.

Files most relevant to this state:

- `scripts/hidden-completion-guide-editor.js`
- `scripts/hidden-completion-supplemental-part.js`
- `scripts/hidden-completion-supplemental-coverage.js`
- `scripts/hidden-completion-supplemental-project.js`
- `scripts/hidden-completion-supplemental-part-ui.js`
- `scripts/hidden-completion-render.js`
- `scripts/preview.js`
- `scripts/part-commands.js`
- `tests/hidden-completion-supplemental-part.test.js`
- `tests/hidden-completion-supplemental-part-ui.test.js`
- `tests/preview-render-order.test.js`
- `tests/part-commands.test.js`
- `tests/ui-inspector.test.js`

Verification already run before this handoff update:

- `node tests\hidden-completion-supplemental-part.test.js`
- `node tests\hidden-completion-supplemental-part-ui.test.js`
- `node tests\motion-draft-editor.test.js`
- `node tests\preview-render-order.test.js`
- `node tests\ui-inspector.test.js`
- `node tests\part-commands.test.js`
- `Get-ChildItem tests -Filter *.test.js | ForEach-Object { node $_.FullName }`
- `git diff --check`

Result: tests passed. `git diff --check` reported only CRLF whitespace warnings. No commit has been made.

### Latest 2026-05-24 Supplemental Hidden Completion Part Upload

This upload makes ready symmetry hidden-completion patches usable as editable rig parts without removing or replacing the existing patch-asset workflow.

Supplemental part conversion:

- Added `scripts/hidden-completion-supplemental-part.js` as the conversion and insertion module for ready `hiddenCompletionPatch` assets with `completionMethod: "symmetry"`.
- The converter creates a normal editor part payload from the patch source data, guide/silhouette metadata, source/counterpart geometry, and available canvas/texture references.
- Generated parts carry persistent metadata: `isSupplementalPart: true`, `supplementalKind: "hiddenCompletionSymmetry"`, `completionMethod: "symmetry"`, `sourcePatchAssetId`, `sourcePartId`, `counterpartPartId`, `targetRegion`, `sourceRegion`, `createdForActionId`, `createdFromJointActionId`, and `originalPatchAssetType: "hiddenCompletionPatch"`.
- The original `project.assets` patch asset remains intact. The generated supplemental part is a separate editable part.
- Duplicate insertion is guarded by `sourcePatchAssetId`; if a supplemental part already exists for the same patch, the existing part is selected instead of creating another one.
- Initial parent/layer/pivot/joint values are derived from the source/target part when available. Missing defaults return warnings/status instead of failing silently.

UI and editing behavior:

- Added `scripts/hidden-completion-supplemental-part-ui.js` and loaded it through `scripts/bootstrap.js`.
- The selected-part hidden-completion panel now shows `보완 파츠로 삽입` when the selected part has a linked ready symmetry patch.
- Pressing the button inserts the supplemental part, selects it immediately, and leaves the existing `선택 패치 연결` behavior unchanged.
- The selected part inspector/status distinguishes supplemental parts with `보완 파츠`, `symmetry에서 생성됨`, source patch id, source part id, and counterpart part id.
- Supplemental parts render as normal parts. No final preview/playback badge or guide overlay was added.

Persistence and command behavior:

- Supplemental part insertion uses the existing part command-history snapshot path so it can be undone/redone as one user action when command history is loaded.
- Project normalization now preserves supplemental metadata through save/load/save round trips.
- Metadata, parent/layer/order, pivot/joint, and mask vertices survive round trip tests.
- Old JSON load does not auto-create or migrate supplemental parts. Users must explicitly press the insert button.
- Existing `motionDraft.hiddenCompletion` and `jointAction.hiddenCompletionDrafts` links are preserved and not repointed to the supplemental part.

Scope intentionally not changed:

- Provider contracts, Stability/Local SD, `HiddenCompletionRequestPayload`, AI server calls, B impact snap timing, punch/kick timing, frame-by-frame z-order editing, visible frame ranges, automatic hole detection, and motion replacement layering were not changed.

Verification for this upload:

- Added `tests/hidden-completion-supplemental-part.test.js`.
- Added `tests/hidden-completion-supplemental-part-ui.test.js`.
- Verified ready symmetry patch payload creation, metadata preservation, button insertion/selection, duplicate prevention, save/load/save round trip, patch asset preservation, motion-draft link preservation, and old JSON non-migration.
- Verified related regressions with `node tests\hidden-completion-symmetry.test.js`, `node tests\hidden-completion-part-panel.test.js`, `node tests\hidden-completion-roundtrip.test.js`, and `node tests\part-commands.test.js`.
- Full JavaScript suite passed locally via `Get-ChildItem tests -Filter *.test.js | ForEach-Object { node $_.FullName }`.
- `git diff --check` passed with only CRLF conversion warnings.
- Commit/push has not been performed.

### Latest 2026-05-24 Hidden Completion Action Summary UI Upload

This upload exposes action-level hidden-completion links in the UI so multiple per-part drafts are visible even when the currently selected part only shows one linked patch.

Action-level visibility:

- Added `scripts/hidden-completion-action-summary.js` and loaded it through `scripts/bootstrap.js`.
- Added `styles/hidden-completion.css` for the compact hidden-completion summary/status styling.
- The panel now lists linked hidden-completion drafts for the active action, including part name/id, patch asset id, and ready/missing status.
- The summary is informational and does not replace the selected-part patch link controls.
- This makes it visible that body and forearm/arm completion patches can coexist on the same action through different per-part drafts.

Verification for this upload:

- Added `tests/hidden-completion-action-summary.test.js`.
- Verified the action summary reports multiple linked hidden-completion drafts at the same time.
- Verified the summary remains separate from final preview/playback overlays.

### Latest 2026-05-24 Per-Part Hidden Completion Draft Upload

This upload fixes the hidden-completion draft ownership gap found during manual QA: creating an upperArm completion patch could make a previously linked body completion patch disappear from the selected-part UI/preview path.

Per-part hidden-completion draft storage:

- Added `scripts/motion-draft-action-store.js` as the small action-level store for hidden-completion motion drafts.
- A cutscene action can now keep multiple linked hidden-completion drafts in `jointAction.hiddenCompletionDrafts`, keyed by `partId`.
- `body`, `upperArm`, and other parts can each keep their own ready linked patch asset without one part replacing another.
- The legacy single `jointAction.motionDraft` remains supported for old JSON and current planner/editor compatibility.
- When an action update replaces a legacy single `motionDraft`, `motionCommands.updateJointAction()` preserves the previous ready hidden-completion draft into `hiddenCompletionDrafts` before normalization.
- The active motion draft editor now resolves the selected part's draft first, then falls back to the legacy action snapshot and plan draft.

Preview and save/load behavior:

- Symmetry hidden-completion preview now asks the per-part action store for the draft linked to the part being drawn.
- `cutsceneModel.normalizeBridge()` preserves normalized `jointAction.hiddenCompletionDrafts` so the links survive save/load/save and existing project restore flows.
- Bootstrap loads the action store before motion planning/editor modules that need it.
- This does not change symmetry patch generation, guide shape defaults, provider contracts, Stability/Local SD logic, or generated image compositing.

Verification for this upload:

- Added `tests/hidden-completion-action-drafts.test.js`.
- Verified the motion draft editor keeps body and upperArm hidden-completion links at the same time.
- Verified a legacy single ready `motionDraft` is preserved when a new part draft replaces the active action snapshot.
- Verified preview lookup resolves the patch linked to each rendered part.
- Verified cutscene bridge normalization preserves `hiddenCompletionDrafts`.
- Full JavaScript suite passed locally via `Get-ChildItem tests -Filter *.test.js | ForEach-Object { node $_.FullName }`.
- `git diff --check` passed with only CRLF conversion warnings.
- Unrelated untracked local artifacts remain unstaged: `.codex_video_frames/`, extra `lookism/*.png`, and the user-provided root screenshot PNG.

### Latest 2026-05-24 Symmetry Hidden Completion UX Upload

This upload focuses on manual, non-AI hidden-completion symmetry drafts for existing/legacy JSON projects. It does not change provider contracts, Stability/Local SD logic, generated image compositing, or punch/kick timing.

Symmetry counterpart matching:

- Existing JSON projects can now participate in symmetry matching after the user edits parts into reasonable roles. For arm/hand parts, `humanRole` still wins first, then legacy type/name/id hints, and now neutral names such as `arm_01`/`arm_02` can fall back to torso/body geometry.
- If a target arm part has no front/rear/left/right name hint, symmetry matching can infer side from the part center relative to a torso/body/spine part. The inferred target side uses the selected part as the area to fill and the opposite side as the symmetry source.
- Candidate counterpart scoring still prefers clean separated arm chains and manual split metadata, then uses simple geometry similarity to choose the closest matching opposite-side part.
- Missing torso/body geometry or missing counterpart candidates still returns a warning instead of fabricating a patch.

Torso side completion UX:

- The hidden-completion selected-part panel now exposes an explicit `몸통 보완 영역` left/right selector when the selected source part is torso/body/spine.
- For torso/body/spine, the selected region is the target area to fill: `왼쪽을 보완` uses the right side of the same torso part as the symmetry source, and `오른쪽을 보완` uses the left side.
- Torso symmetry still creates a normal `hiddenCompletionPatch` asset with `completionMethod: "symmetry"` and `symmetrySource.targetRegion/sourceRegion` metadata. The same torso part id is stored as the counterpart source.
- `scripts/hidden-completion-part-panel-helpers.js` now holds small panel helpers for torso detection, target-region selection, and mesh preset generation so the main panel stays within the file-size limit.
- The hidden-completion panel loads the helper through `scripts/bootstrap.js` before `scripts/hidden-completion-part-panel.js`.

Editing and compositing behavior:

- Symmetry patches remain separate non-destructive patch assets. They do not rewrite, replace, or delete the existing source part canvas/mask/geometry.
- Preview compositing can visually cover existing visible pixels if the patch guide/silhouette is broad. Torso defaults are intentionally broad half-rectangles, and the user can narrow or reshape the guide vertices in the existing guide editor.
- `선택 패치 연결` only links an existing patch asset for the selected source part into the active `motionDraft.hiddenCompletion`; it does not create a new patch and does not delete the asset when unlinked.
- The current implementation does not automatically detect the exact exposed hole. Guide/silhouette editing remains the user-controlled way to refine the visible patch area.

Verification for this upload:

- Added/expanded regressions in `tests/hidden-completion-symmetry.test.js`, `tests/hidden-completion-part-panel.test.js`, `tests/hidden-completion-part-panel-torso.test.js`, and `tests/hidden-completion-roundtrip.test.js`.
- Verified neutral legacy arm names can match by edited roles plus torso geometry.
- Verified torso left/right target region selection is passed from the UI into symmetry draft creation.
- Verified symmetry metadata, including torso same-part left/right `targetRegion/sourceRegion`, survives save/load/save round trips.
- Full JavaScript suite passed locally via `Get-ChildItem tests -Filter *.test.js | ForEach-Object { node $_.FullName }`.
- Unrelated untracked local artifacts remain unstaged: `.codex_video_frames/`, extra `lookism/*.png`, and the user-provided root screenshot PNG.

### Latest 2026-05-24 Core Manual Undo/Redo Upload

This upload focuses on the manual editor undo/redo gap. The AI rig server and hidden-completion provider paths remain deferred and were not changed.

Core undo/redo coverage:

- Added visible Project-panel controls for Undo and Redo, so history is available through UI buttons as well as keyboard shortcuts.
- Added `scripts/history-controls.js` to bind the buttons to `Animotion.commandHistory` and keep their disabled state in sync after record, undo, redo, and clear.
- Added `scripts/part-command-history.js` as a small wrapper layer over the existing part command API. Part creation, part deletion, selected-part deletion, and shape/mask application now record restorable part snapshots as single user commands.
- Kept existing focused part update history intact. Inspector-style part updates still use the existing patch-based `updatePart` command history.
- Grouped automatic guide-part creation into one undoable command instead of recording or restoring each generated guide part separately.
- Added `scripts/motion-command-history.js` to make generated tracks and motion-plan application undoable as one motion command, including `cutsceneBridge`, `motionPlan`, `customMotion`, and keyframe state.

Scope and assumptions:

- This is not a full global state-store rewrite. New mutating features should still route through command APIs or add command-history wrappers if they need undo/redo.
- Ephemeral UI state, provider/server state, and AI runner behavior were not brought into undo/redo scope.
- The current priority remains core manual authoring. `ai-rig-server` contract cleanup is intentionally lower priority because it is not planned for immediate use.

Verification for this upload:

- Added/expanded regressions in `tests/part-commands.test.js`, `tests/motion-commands.test.js`, and `tests/events-history-shortcuts.test.js`.
- Full JavaScript suite passed locally via all `tests/*.test.js`.
- Unrelated untracked local artifacts remain unstaged: `.codex_video_frames/` and the extra `lookism/*.png` files.

### Latest 2026-05-24 Stability And Arm Completion Upload

This upload completed three connected work units around hidden completion, legacy arm-chain rebinding, and upload-time cutscene state safety.

Hidden completion symmetry draft:

- Added a manual, non-AI symmetry path for `hiddenCompletionPatch` draft assets.
- The user can create a draft patch from the opposite/counterpart part for exposed upperArm/forearm/hand/glove gaps and torso left/right guide regions.
- Symmetry patches store `completionMethod: "symmetry"` and stable `symmetrySource` metadata with counterpart/target ids, regions, confidence, and method.
- Patch assets use the existing `project.assets`, `motionDraft.hiddenCompletion`, guide mesh, and patch transform flows, so they remain editable and non-destructive.
- Preview composites ready symmetry patches after source-panel erase and before foreground/occluding part drawing, preventing blank source-erase holes when a ready patch exists.
- Missing counterparts or low-confidence counterpart matches return warnings instead of generating a bad patch.
- No AI generation and no provider/request payload changes were added.

Manual legacy arm-split rebind:

- Added `scripts/arm-chain-rebind.js` for explicit "분리된 팔 체인으로 다시 연결" support after a user manually splits a loaded arm-only part into upperArm/forearm/hand parts.
- The resolver detects replacement chains from `splitFromPartId`, `originalSourcePartId`, `sourceArmOnlyPartId`, `splitMethod: "manual"`, humanRole, parent links, name/id hints, and geometry fallbacks.
- Loaded JSON remains unchanged on load. Rebind only happens when the user explicitly applies it.
- Rebind updates the active punch/cutscene draft to use the new terminal hand/glove, regenerates planner output against the separated chain, and preserves the original arm-only part unless the user later hides/deletes it.
- Counterpart matching after rebind pairs upperArm/forearm/hand roles against the opposite separated chain and avoids preferring the old arm-only source part for symmetry completion.
- Punch planner, arm-chain resolver, and provider contracts were not bypassed or rewritten.

Central cutscene action selector and upload stability:

- Added `scripts/cutscene-action-selectors.js` as the only approved runtime module that reads `.actionTimeline` directly.
- Central selectors expose `getActiveJointAction(state)`, `getActiveActionTimeline(state)`, `getCutsceneActionStatus(state)`, `actionTemplate(action)`, and `timelineBeats(action)`.
- The inactive app state is now explicit. Missing/incomplete state, `cutsceneBridge === null`, `jointAction === null`, missing `actionTimeline`, empty parts, and `selectedPartId === null` return inactive results such as `reason: "no-cutscene-action"` instead of throwing.
- `resetMotionStateForImageUpload(state)` centralizes image-upload/session reset for motion/cutscene state and clears stale selected/action-frame/trajectory/rebind/debug references before UI refresh.
- UI refresh paths, motion status, rebind controls, hidden-completion panels, preview/render order, motion draft/editor helpers, trajectory/anchor editors, and action-frame helpers now route action/timeline reads through the selector layer.
- A regression test scans `scripts/` so raw `.actionTimeline` access outside `cutscene-action-selectors.js` fails.
- Normal image upload with no parts, no selected part, no cutscene bridge, null `jointAction`, or null/missing timeline is a first-class valid state.
- No fake punch timelines, auto-created `cutsceneBridge`, broad try/catch crash hiding, AI/provider changes, or kick behavior changes were added.

Verification for this upload:

- Full JavaScript suite passed locally via all `tests/*.test.js`.
- Explicitly exercised regressions for cutscene motion status, image upload/session reset, arm-chain rebind, hidden-completion symmetry, motion planner commands, punch hand tip, cutscene depth, and preview render order.
- Unrelated untracked local artifacts remain unstaged: `.codex_video_frames/` and the extra `lookism/*.png` files.

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
- `tests/part-commands.test.js`: part creation/project sync, cyclic parent rejection, child parent clearing on delete, `parentId`/`parentPartId` compatibility, and out-of-rect pivot/joint preservation during shape edits.

Recent stability pass:

- `ce43f68 Stabilize rigging and motion authoring state` keeps inspector parent selection aligned with the selected part, including legacy `parentPartId` fallback.
- Shape edits preserve pivot and joint image positions even when the resulting local coordinates sit outside the new part rect.
- Project rig serialization now uses the shared parent compatibility path so `parentPartId` fallback links still produce the expected parent bones.
- Pointer arbitration has regression coverage for overlapping rig handles, trajectory handles, and active motion target hits.
- `motionDraft` plus `hiddenCompletionPatch` guide data now has save/load/save round-trip coverage together.

Current upload adds an image-session stability pass:

- A plain PNG/JPG upload through the normal image upload button is allowed to leave `selectedPartId === null`, `parts.length === 0`, and no active `cutsceneBridge.jointAction`.
- The motion status, inspector empty state, parent select refresh, hidden-completion part panel, and empty project sync/serialization paths guard those null/empty states directly instead of hiding errors with broad try/catch.
- The verified upload crash was `Cannot read properties of null (reading 'actionTimeline')` in `cutscene-motion-status.js`; a missing `jointAction` now renders as inactive status.

Current upload adds an arm-only hand endpoint and cutscene-only punch depth pass:

- Arm-only rigs can now store an explicit `handTip` local endpoint. There may still be no separate hand part.
- The source inspector, rig handles, hit testing, save/load normalization, part shape edits, and source overlay all preserve and expose the `handTip` endpoint without requiring a schema break.
- Punch generation now uses `handTip` as the endpoint for arm-only primary parts while keeping `selectedPartId` and the visual driver on the selected arm part.
- Existing separate hand-part rigs still prefer the terminal hand part for punch generation.
- Loaded legacy JSON is not auto-migrated. Old saved `cutsceneBridge.jointAction` and `part.keyframes` remain as saved until the user explicitly regenerates punch/kick.
- Explicit punch regeneration replaces old generated punch keyframes, keeps `actionTimeline.template === "punch"`, and computes rear/front classification plus impact target from base part geometry rather than stale evaluated keyframes.
- Rear-cross punch generation records `targetDebug.punchStyle` on the generated action. Front jab remains `jab`.
- Cutscene preview/playback now applies a frame-local evaluated render-order bias for rear-cross punch only. The punching arm/hand rises in front of head/face during drive/impact and returns to original order during recover.
- This depth override is not saved into project part order and does not mutate legacy layer order.
- For arm-only rigs the depth bias applies to the punching arm. For separate hand rigs the terminal hand receives the strongest bias and the parent forearm receives a smaller supporting bias.
- New regressions cover loaded legacy elbow-only punch preservation, explicit handTip-based regeneration, rear windup, recover, front jab preservation, and cutscene-only depth ordering.

Latest rear arm-only punch visual QA on 2026-05-22:

- The latest failing video was `화면 녹화 중 2026-05-22 095255.mp4` at about 4.17 seconds, 2560x1594, 30 fps.
- The video confirmed `arm_02 handTip`, explicit rear-cross classification, and a forward target near `1023,270` with delta about `596,-35`. That made target generation and rear/front classification no longer the primary remaining failure.
- The visible failure was runtime rendering/compositing: source-panel erase removed the original rear arm area, segmented arm rendering replaced the normal whole-arm draw, and the segmented output could create detached glove/arm fragments instead of a safe replacement.
- A second runtime issue was stale generic ghost rendering while the preview was paused/editing. Previous-frame arm/glove positions could remain visible and be mistaken for the current impact pose.
- `scripts/arm-extension-render.js` now validates segmented arm output and returns an explicit render result object. Preview skips the normal whole-arm draw only when segmented rendering succeeds.
- Segment validation rejects invalid controls, degenerate or tiny segments, non-finite transforms, oversized bounds, and overly wide source/target fragments with reasons such as `source-segment-too-wide` and `segment-too-wide`.
- If segmented rendering fails, `scripts/preview.js` draws the normal arm fallback so source-panel erase does not leave an empty hole.
- Runtime debug/status now separates target generation, source-panel overlap, actual draw-order failure, segmented render failure, and source erase without replacement.
- These are preview/runtime safeguards only. Existing JSON load still preserves saved `cutsceneBridge.jointAction`, saved `part.keyframes`, saved layer order, and schema.

Current upload adds a frame-specific motion replacement layer for arm-only punch frames:

- `scripts/motion-replacement-layer.js` derives a runtime replacement plan for arm-only rear-cross punch extension/impact frames from `cutsceneBridge.jointAction`, evaluated `part.keyframes`, and part geometry.
- `scripts/motion-replacement-render.js` validates and draws a deterministic proxy replacement arm/fist layer. It rejects invalid source rects, non-finite points, degenerate shoulder-to-hand/target vectors, and absurd replacement bounds before any normal arm draw is skipped.
- The replacement plan is frame-local and visual-only. It does not change punch targets, rear/front classification, trajectory generation, depth rules, saved `state.parts` order, or saved project schema.
- Preview checks the replacement plan before drawing the normal selected arm. A successful replacement draws at the same evaluated arm depth position and skips the normal whole-arm sprite for that part/frame, avoiding a duplicate bent arm under or over the replacement.
- If replacement rendering fails, preview records `motion-replacement-failed`, keeps the normal arm fallback, and avoids source-erase blank holes without a replacement.
- `cutscene-motion-status` and render-order debug now expose `replacementActive`, `replacementReason`, `replacementFrame`, `replacementBeat`, `replacementRenderOk`, `replacementRenderFailure`, `skippedNormalArmDraw`, `fallbackToNormalArm`, and source-erase risk data.
- Action-frame pose edits remain the source of final pose truth: dragging the impact handTip/joint updates `part.keyframes`, and replacement geometry is derived from the edited evaluated pose. Windup/recover keyframes are not overwritten by an impact edit.
- Separate hand/forearm rigs are not forced into replacement mode; the normal rig/keyframe path remains primary when a terminal hand part exists.
- No AI generation, inpainting, replacement sprite authoring UI, trajectory-to-motion replanning, kick behavior changes, global depth rewrite, or old JSON migration was added.
- New regression coverage includes `tests/motion-replacement-layer.test.js`, updated preview render-order tests, updated action-frame pose-drag tests, and updated motion-status tests.
- Local verification: all JavaScript tests under `tests/*.test.js` passed. Python `ai-rig-server` tests were not run because the local Python environment does not have `pytest` installed.

Current upload makes separate hand/forearm arm rigs the preferred boxer punch path:

- `part.humanRole` is now editable in the selected part inspector without replacing legacy `part.type`. Old projects without `humanRole` continue through existing name/id and geometry fallbacks.
- The boxer punch resolver prefers explicit `humanRole` over name/id hints and geometry. It resolves selected `upperArm`, `forearm`, or `hand/glove` parts to one arm chain before classifying front jab versus rear-cross.
- A clean separate arm chain is explicitly `torso -> upperArm -> forearm -> hand/glove`. Parent relationships are validated separately from render depth, so a glove can be parented to the forearm while rendering above it to cover the wrist connection.
- Role-specific handle semantics are enforced across inspector labels, handle visibility/editability, rig point display, hit testing, endpoint resolution, and tests:
  - `upperArm`: pivot is shoulder/proximal rotation center; joint is elbow/distal connection; `handTip` is preserved from legacy JSON but hidden/ignored for separate-rig punch endpoint resolution.
  - `forearm`: pivot is elbow/proximal rotation center; joint is wrist/distal connection; `handTip` is preserved from legacy JSON but hidden/ignored when a terminal hand/glove exists.
  - `hand`: pivot is wrist/cuff rotation center; `handTip` is fist/knuckle/contact point; `joint` is optional and is not treated as the punch endpoint.
- Separate-rig punch endpoint resolution always uses the terminal hand/glove `handTip`; if it is missing, the resolver infers a safe contact point from hand/glove geometry. It never uses upperArm/forearm legacy `handTip` when a terminal hand/glove exists.
- Arm-only rigs remain unchanged as the compatibility path: if no terminal hand/glove exists and the selected arm has `handTip`, punch generation uses the existing arm-only handTip endpoint and existing runtime motion-replacement fallback.
- Clean separate arm rigs do not activate `motion-replacement-layer` by default. They use normal rig/keyframe motion distribution where the terminal hand/glove moves most, the forearm follows with supporting motion, and the upperArm follows more subtly.
- Chain validation reports debug/status fields for `resolvedArmChain`, `terminalPunchPartId`, `terminalPunchPointSource`, `punchSide`, `classificationBasis`, `separateRigPath`, `armOnlyFallback`, `chainParentingValid`, `handParentIsForearm`, `forearmParentIsUpperArm`, `elbowConnectionValid`, `wristConnectionValid`, and `chainWarnings`.
- Elbow and wrist connection validation compares world/image-space points, not local coordinates. `upperArm.joint` should align with `forearm.pivot`, and `forearm.joint` should align with `hand/glove.pivot`. Points are allowed inside, on, or outside part rects and are not clamped.
- Hidden-completion integration remains warning/debug only for this path. If motion may expose an area previously covered by the glove/wrist overlap, the system can mark a hidden-completion candidate through existing `hiddenCompletionPatch`/`motionDraft` flows without changing provider payloads or adding inpainting.
- The selected part inspector now exposes an explicit `Auto place arm handles` helper for a selected separate arm chain. It is user-triggered, does not run on load, does not silently repair parentId, and does not migrate old JSON.
- `scripts/arm-handle-autoplace.js` initializes role-specific handles for a clean chain: shoulder/proximal upperArm pivot, shared elbow point for upperArm joint and forearm pivot, shared wrist point for forearm joint and hand/glove pivot, and a knuckle/contact-side handTip. It preserves out-of-rect coordinates and reports elbow/wrist/parenting/separate-rig validity after running.
- New regressions cover resolver role priority and fallback behavior, endpoint resolution, clean and invalid chain validation, world-space elbow/wrist connection warnings, separate-rig replacement opt-out, arm-only handTip compatibility, old JSON load preservation, render/depth behavior, inspector role semantics, and auto-place handle alignment.
- Local verification on this work unit: all JavaScript tests under `tests/*.test.js` passed.

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

Implemented in `scripts/motion-planner.js`, `scripts/action-timeline-model.js`, `scripts/motion-anchors.js`, `scripts/motion-anchor-picker.js`, and `scripts/motion-trajectory-editor.js`.

- Motion templates: kick, punch, dash.
- Punch and kick now read their beat timing from `scripts/action-timeline-model.js` while preserving the existing `motionPlanner -> cutsceneBridge -> part.keyframes` flow.
- Punch timeline: `guard -> windup -> drive -> extension -> impact -> recover`.
- Kick timeline: `ready -> compress -> chamber -> extend -> impact -> recover`.
- Punch/kick timing and root/body follow were refined in `58b1056 Refine punch kick motion timing`.
- Punch impact now includes hand, torso, and hip/root participation through the existing anchor/keyframe flow; kick keeps distinct chamber, extension, impact, and recovery phases.
- `humanRole` metadata is preferred for body/limb/head role detection when available, with legacy `part.type` fallback preserved.
- Action timeline normalization preserves `durationFrames`, `impactFrame`, `beats`, `primaryPartRole`, and `rootMotionHint`.
- Legacy `motionPlan.template: "punch"` and `"kick"` continue to normalize and generate cutscene bridge actions.
- Punch/kick plans now create `cutsceneBridge.jointAction.impactExaggeration` from the action timeline impact beat.
- Impact exaggeration metadata is stored on `cutsceneBridge.jointAction` only. Do not introduce a duplicate `project.effects` editor state for this.
- `PUNCH_KICK_VISUAL_QA.md` documents the current visual QA checklist for punch/kick motion quality.
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
- `scripts/motion-planner-commands.js` centralizes the canonical selected-part punch/kick generation path used by both `비트/이동 궤적 생성` and `선택 파츠 기준 컷신 초안 생성`.
- When the selected cutscene action type is punch or kick, the selected-part cutscene draft button now generates `motion-planner-punch-anchors-v1` or `motion-planner-kick-anchors-v1` with `cutsceneBridge.jointAction.actionTimeline.template` set to `punch` or `kick`.
- Punch generation requires an arm/forearm/hand role or type, and kick generation requires a thigh/shin/foot/leg role or type. Invalid selections show a status message and do not fall back to the legacy `part-pivots-v1` draft.
- Punch/kick regeneration now compares the previous `cutsceneBridge.jointAction` action type and `primaryPartId` against the current template and selected primary part. If either differs, stale `motionPlan.target`, `activeMotionTarget`, `anchors`, trajectory points, hints, and motionDraft input are invalidated before creating the next draft.
- Same action type plus same selected primary part is the only path that preserves a user-adjusted target/primary anchor. This protects manual trajectory edits inside one punch draft while preventing a previous punch target from driving a later kick draft.
- The legacy selected-part `part-pivots-v1` draft path remains only for non-punch/kick action types.
- Timeline keyframe edits, generated track application, cutscene bridge updates, motion plan updates, anchor regeneration, and trajectory regeneration now go through `scripts/motion-commands.js`.
- Boxer punch action demo is the current 1st-priority motion quality target. Kick quality tuning is intentionally deferred.
- Punch generation writes generated transforms to `part.keyframes`; `cutsceneBridge.jointAction` remains the generated action/trajectory draft source, while `part.keyframes` are the preview/playback transform source.
- In cutscene/keyframe mode, pose dragging now syncs every part's `customMotion` from the current frame before the drag starts. Manual hand/arm/body edits are therefore applied on top of the generated punch frame instead of overwriting related body keyframes with stale poses.
- A manual pose drag at windup/recoil/impact commits a keyframe at `state.currentFrame`; that keyframe is used by preview evaluation and remains in the same punch draft until the user explicitly regenerates punch tracks.
- Punch status labels now map the pre-impact `recoil` beat to user-facing `windup` while keeping the internal action timeline key and the post-impact `recover` beat unchanged.
- Front-hand punch keeps the existing jab-style template. Rear/back/trailing hand punch generation uses an internal rear-cross style while preserving `cutsceneBridge.jointAction.actionTimeline.template === "punch"`.
- Rear-hand punch selection first honors `back`, `rear`, `trailing`, `front`, or `lead` name/id hints. If older JSON uses neutral names such as `arm_01`, `arm_02`, `hand_01`, or `hand_02`, regeneration falls back to geometry: torso center, selected hand position, target/effect direction, and opposite hand position.
- Existing saved JSON is not migrated on load. Old generated `cutsceneBridge.jointAction` beats and `part.keyframes` are restored as saved; the new rear-hand planner is applied only when the user explicitly regenerates punch for the selected rear hand.
- B correspondence anchors, manual motion targets, active motion targets, character root anchors, and trajectory points are separated in state/debug.
- `activeMotionTarget.source` records whether motion generation is driven by `manual`, `correspondence`, or `generated` input.
- If a manual target is active, B correspondence is preserved but shown as not driving the current motion. The UI now exposes `Use B correspondence as motion target` and `Clear manual target`.
- Kick/cutscene bridge motion no longer treats chest/hip/head correspondence as the default attack target. Those anchors are reference/alignment data unless the user explicitly applies them as the active motion target.
- Motion target debug data exposes raw B target, converted target, current selected part position, computed distance, chosen `motionScope`, root delta, follow strengths, primary part, body/root part, parts receiving root delta, and final evaluated part transforms.
- `motionScope` supports limb-only, body-follow, and full-character behavior. Full-character mode applies the same character root delta to visible character parts.
- Character root delta is applied during cutscene motion evaluation so parts without reliable parent linkage still travel coherently with the character group.
- Root motion tuning fields exist for `bodyFollowStrength`, `maxRootDeltaRatio`, `primaryLeadStrength`, and `secondaryFollowStrength`.
- Trajectory samples are treated as evaluated path samples by default. Editable anchors/control points are tracked separately from samples.

Important behavior:

- The target point is the end position of the selected part's primary focus joint.
- For a leg this focus joint is the inferred foot point, not the whole leg rectangle.
- For a body/spine primary action, the focus joint is the inferred chest point and the generated primary motion uses translation (`x/y`) rather than `jointX/jointY`; this avoids accidental 180-degree body rotation.
- A leg action generates `foot`, `knee`, `hip`, `chest`, and `head` anchors. A body action generates `chest`, `hip`, and `head` anchors.
- Far leg targets move body anchors more; near leg targets keep body movement small so the leg can move locally.
- Anchor direct-picking is now implemented for generated anchors. A separate full anchor-management UI is still future work.
- Current generation still requires selecting a part and then generating beats; simply placing a target does not create motion until `beat/trajectory generation` is clicked.
- For the current boxer punch demo, verify the workflow as: generate punch trajectory, scrub to windup/impact/recover frames, drag hand/arm/body rig points, confirm saved `part.keyframes`, preview playback, and only then regenerate if the user wants to discard/rebuild the draft.

Current upload shifts punch editing toward an action-frame-first workflow:

- `scripts/action-frame-editor.js` derives selectable punch action frames from `cutsceneBridge.jointAction.actionTimeline.beats` and existing action beats without adding persisted schema.
- The motion panel now shows compact punch beat buttons such as guard, windup, drive, extension, impact, and recover with frame numbers.
- Selecting a beat sets the preview/current frame to that action frame and marks trajectory editing as read-only for pointer arbitration.
- While a punch action frame is selected, handTip/hand and joint/bend rig drags use the existing pose-drag path and commit edits into `part.keyframes` at the selected frame.
- Trajectory remains a visualization/diagnostic surface in this pass. Arbitrary trajectory handle drags are not used to reinterpret punch motion while action-frame editing is active.
- `cutscene-motion-status` reports the selected beat label/frame, that edits write to keyframes, and that trajectory controls are read-only in action-frame mode.
- Old JSON is not migrated. Existing saved `cutsceneBridge.jointAction` and `part.keyframes` load as-is, and action-frame controls degrade to available beat metadata when timeline metadata is missing.

### Punch/Kick Motion Status Visibility

Implemented on `master` in `f2536d3 Add cutscene motion status visibility`.

- `scripts/cutscene-motion-status.js` extracts display-only punch/kick status from `cutsceneBridge.jointAction`.
- The motion panel now shows a lightweight status line for active punch/kick cutscene drafts.
- The status reports action type, current beat, impact frame, primary role/id, body/root assist, hip/root anchor presence, primary impact target, and recoil/recover timing where available.
- This is read-only debug/status visibility. It does not add editing UI, duplicate state, or persisted schema fields.
- `tests/cutscene-motion-status.test.js` covers status extraction and UI shell wiring.

### Impact Exaggeration Layer

Implemented on `master` in `scripts/impact-exaggeration-layer.js`, `scripts/motion-planner.js`, `scripts/cutscene-model.js`, `scripts/preview.js`, `scripts/ui.js`, and `scripts/events.js`.

- `normalizeImpactExaggerationLayer()` normalizes `kind`, `enabled`, `frame`, `holdFrames`, `strength`, `targetPartIds`, `scaleHints`, and `stretchHints`.
- `createDefaultImpactExaggerationForActionTimeline()` reads the punch/kick action timeline impact beat and creates default impact exaggeration metadata.
- Newly generated punch/kick impact exaggeration defaults to `enabled: true`.
- Legacy impact exaggeration data without `enabled` normalizes as enabled.
- The motion panel exposes a focused `타격 과장 적용` checkbox. It only toggles `cutsceneBridge.jointAction.impactExaggeration.enabled` through `motionCommands.updateJointAction()`.
- Preview applies only minimal scale/stretch hints at the impact hold frames, and skips those hints entirely when `enabled === false`.
- Strength/frame editing, smear UI, draw-over UI, and full render effects are still future work.

Recent commits:

```text
ff72e63 Add multi-anchor motion planner drafts
5044e0e Allow dragging generated motion anchors
5064c57 Add direct motion anchor picking
fc0c961 Fix motion target body follow propagation
62ea451 Apply character root delta during cutscene motion
fcf63a4 Separate motion target semantics
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
- Paused/editing cutscene preview no longer draws stale generic ghost parts from previous frames. Ghost parts remain available during running playback.

Recent commit:

```text
5064c57 Add direct motion anchor picking
```

### Scripted Genga Cut Generator

Implemented on `master`.

- `scripts/scripted-genga-runner.js`: restricted script runner for declarative genga cut definitions.
- `scripts/scripted-genga-sample-definition.js`: first sample/internal reference definition for the demo anime/genga cut.
- `scripts/scripted-genga-generator.js`: compatibility wrapper that now runs the sample definition through the runner.
- `scripts/scripted-genga-motion-preset.js`: applies a small demo motion preset to the generated fixture using existing cutscene/keyframe/motionDraft paths.
- `tests/scripted-genga-generator.test.js`: deterministic generation, DSL compile, project round-trip, hidden-completion guide, and demo motion round-trip coverage.
- `index.html`: dev/demo controls for `Generate Demo Genga Cut` and `Apply Demo Genga Motion`.

Current script API surface:

- `Animotion.scriptedGengaRunner.compileScriptedGengaScript(source)`: accepts a JSON string or object definition and rejects non-JSON source. This intentionally avoids arbitrary code execution.
- `Animotion.scriptedGengaRunner.runScriptedGengaDefinition(definition)`: creates preview SVG data URI, layers, parts, hidden-completion patch assets, and an `AnimotionProject` payload.
- `Animotion.scriptedGengaRunner.loadGeneratedCutIntoApp(result)`: loads the generated result through the existing session/project/part-canvas restore path.
- `Animotion.scriptedGengaSampleDefinition.createDefinition()`: returns the current sample cut definition.
- `Animotion.scriptedGengaGenerator.createFixture()`: compatibility entrypoint used by tests and UI; internally runs the sample definition.

Definition shape currently supported:

```text
canvas
visual.elements
parts
hiddenCompletionGuides
editor.selectedPartId
editor.rootPartId
editor.motionPlan
```

Security and scope notes:

- No `eval` or arbitrary user code execution is used.
- The script/definition API is separated from internal app state. Definitions produce data; app loading is a separate boundary call.
- SVG output is allowlisted to a small set of element names and attributes.
- This is not a brush engine, drawing app, or AI image generator.
- The next natural step is a dev-only JSON textarea/import entrypoint plus validation error display, not a full code editor.

### Project Model And Commands

Implemented on `master`.

- `scripts/project-model.js`: central `AnimotionProject` runtime normalization and project part/editor part conversion.
- `scripts/project-serialization.js`: converts current editor state into `AnimotionProject`.
- `scripts/project-model.d.ts`: TypeScript type declarations for `AnimotionProject`, assets, parts, rigs, motions, effects, timeline, and editor metadata.
- `scripts/human-rig-schema.js`: basic 2D human rig metadata helpers. It keeps existing `part.type` unchanged and normalizes optional `part.humanRole` values for `torso`, `pelvis`, `head`, `upperArm`, `forearm`, `hand`, `thigh`, `shin`, and `foot`.
- Project JSON now saves as `format: "animotion-project"` with string `version`, metadata, canvas, assets, parts, rigs, motions, effects, timeline, and editor compatibility data.
- Project parts now preserve `humanRole` through save/load round trips without changing legacy part type handling.
- Project restore now loads the saved `editor.cutsceneBridge` directly instead of merging it with the current session bridge, so saved panel transforms and action data are not polluted by pre-load UI state.
- Project restore returns the motion template UI to `cutscene` when a saved cutscene bridge has a `jointAction`, or to `keyframes` when restored parts have keyframes.
- Project save recomputes part `sourceRectNormalized`, `pivotNormalized`, `jointNormalized`, and `maskVerticesNormalized` from the current editor `rect/pivot/joint/mask` instead of trusting stale normalized fields left on runtime part objects.
- Existing JSON files that already contain a wrong `sourceRect` such as a 1x1 rect at the image edge cannot be perfectly reconstructed from that JSON alone; the fix prevents newly saved JSON from writing that stale geometry again.
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
- `scripts/motion-target-state.js`: separates correspondence anchors, manual targets, active targets, root anchors, and trajectory sample/control semantics.
- `scripts/motion-target-debug.js`: computes and exposes source-space target delta, distance, scope, root delta, and follow tuning/debug information.
- `scripts/character-root-motion.js`: evaluates explicit character root delta and applies it to visible character parts during cutscene preview.
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
- `scripts/hidden-completion-part-panel.js`: exposes the hidden-completion workflow in the selected part inspector. It can create a guide patch, create a 2D mesh guide preset, select an existing patch for the selected source part, link/unlink it through the existing motion draft helpers, and auto-create the minimal hidden-completion draft when a cutscene `jointAction` exists without `motionDraft`.
- `scripts/hidden-completion-request.js`: converts a saved `hiddenCompletionPatch` asset into provider-neutral `HiddenCompletionRequestPayload` data. Request options are intentionally limited to `promptVersion`, `includeWarnings`, `strictMode`, and `requestId`; provider/model/API settings are rejected here.
- `scripts/hidden-completion-prep.js`: prepares source crop and mask descriptors from the neutral request. Normalized request coordinates are not mutated; clipping happens only at the rasterization/mask boundary.
- `scripts/hidden-completion-provider.js`: provider adapter interface, capability declaration, and normalized provider runner.
- `scripts/hidden-completion-result.js`: normalizes provider output, stores generated patch texture assets, and writes provenance onto the generated result/patch asset.
- `scripts/hidden-completion-prompt.js`: shared hidden-completion prompt builder used by provider adapters.
- `scripts/hidden-completion-stability-provider.js`: server-side Stability image-edit/inpaint adapter. It reads API keys from environment variables only and must not be called from browser code.
- `scripts/hidden-completion-provider-server.js`: local Node provider server exposing `POST /hidden-completion/generate`; reads Stability credentials from env and returns normalized `HiddenCompletionResult`.
- `scripts/hidden-completion-client.js`: browser-side local provider client. It posts neutral request/source/mask payloads to the local server and queues hidden completion when the provider is unavailable.
- `scripts/hidden-completion-local-sd-provider.js`: server-side `local-sd-inpaint` adapter for local/VESSL/RunPod worker validation.
- `scripts/hidden-completion-local-sd-worker-contract.js`: small validation helpers for the Local SD worker wire request/response contract.
- `HIDDEN_COMPLETION_REQUEST.md`: provider-neutral request contract and provider separation rules.
- `LOCAL_SD_WORKER_CONTRACT.md`: provider-specific Local SD worker endpoint request/response contract.
- Correspondence target overwrite policy is explicit: no target, correspondence target, and planner-default target can be overwritten; manual target overwrite is blocked until a confirm UI is added.
- Motion target ownership is explicit: manual targets can override correspondence only when active, and the UI/debug text shows which source is currently driving motion generation.
- B correspondence can be saved as reference data without silently becoming the attack target. Applying it as the active motion target is an explicit user action.
- The current body-follow/full-character bridge uses `characterRootDelta` so the A character visibly travels before the B impact snap instead of only twisting selected limbs.
- Kick/body-follow generation gives the primary part lead motion while torso/root and connected or unparented visible parts receive shared character root movement according to tuning.
- New image reset, project restore, legacy rig restore, and Lookism preset load clear command history.

Current architecture note:

- Renderers still read runtime editor state such as `state.parts`, `state.cutsceneBridge`, `state.motionPlan`, `state.panelSetup`, and `state.correspondences`.
- The central project model is currently the save/load and normalization boundary, not yet the single in-memory source of truth.
- The command layer is an intermediate step toward broad Undo/Redo and eventually making `state.project` the primary editable data store.
- Undo/Redo currently covers part updates, panel crop/mask edits, and committed pose-drag keyframe edits. Part creation/deletion, generated motion plans, and session-level changes are still not undoable.

## Current Limits

- No AI model is connected locally.
- No DWPose, See-through, SAM, or VLM runner is implemented in the browser.
- Manual 2.5D-ready A/B body-part correspondence metadata is implemented and can be explicitly compiled into the motion planner target.
- B cut impact anchors can be stored per selected A part and explicitly converted into a generated primary action target through `motion 목표로 사용`.
- B cut impact anchors are now stored as normalized image coordinates, but other point-like data such as pivots, joints, generated anchors, and trajectory points still need the same coordinate-space treatment.
- Occlusion/depth/hidden-completion metadata is preserved as planner/action hints and compiled into non-destructive `motionDraft` data.
- Motion draft visibility/depth/hidden-completion data is visible and minimally editable in the inspector/timeline, but it does not yet drive renderer opacity, z-order transitions, mesh/proxy deformation, or AI generation.
- Hidden completion patch assets, guide mesh authoring, provider-neutral request building, source/mask preparation descriptors, provider adapter skeleton, Stability API adapter, Local SD worker adapter, local Node provider server, browser local-provider client, and result/provenance writer are implemented.
- Stability and Local SD providers are server-side adapters only. The browser app does not call Stability directly, store API keys, load models, or require GPU for normal editing.
- The motion draft `request/generate` control can call the local provider server. If the local server is unavailable, the hidden completion state moves to `queued`.
- Provider tests use mocked fetch/worker calls only. Manual Stability validation requires starting the local Node provider server with `STABILITY_API_KEY` set.
- Generated patch images can be stored as texture assets and linked from `hiddenCompletionPatch.generatedResult`, but renderer compositing of generated hidden patches is still future work.
- Guide mesh preview is currently an editor overlay. It is not a final image patch and should be treated as AI/input guidance only. Users can now create a guide patch, 2D mesh guide preset, or non-AI symmetry draft from the selected part inspector, then adjust guide vertices in the preview.
- Symmetry hidden-completion drafts are editable, non-destructive patch assets. They may initially cover a broad guide area, especially torso half-rectangles, and rely on user guide-vertex editing rather than automatic exposed-hole detection.
- Time-varying z-order / z-swap editing is not implemented.
- The motion planner is template/rule based, not image-understanding based.
- The generated motion is a draft; anchor editing exists, but detailed anchor/keyframe graph tooling is still limited.
- Target point placement alone does not generate a trajectory; generation is still an explicit user action.
- Natural connection into B cut is improved by explicit correspondence target application, but motion still remains template/rule based.
- The previous issue where A only jittered/twisted toward the target is reduced by character root delta propagation. Remaining attack quality work is motion design/timing/readability, not provider/request work.
- B impact flashing caused by looping the short cutscene preview duration is known and intentionally out of scope for the current motion-target fix.
- Target semantics are now separated, but visual overlays and tuning controls still need refinement so users can clearly distinguish correspondence anchors, active targets, root anchors, editable control points, and evaluated trajectory samples.
- Undo/Redo is implemented for part updates, panel crop/mask edits, and pose-drag commits; several command helpers still centralize mutation without command records.
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
- `scripts/motion-target-state.js`: active/manual/correspondence target state and trajectory sample/control normalization.
- `scripts/motion-target-debug.js`: target conversion, distance/scope, root delta, and evaluated transform debug helpers.
- `scripts/character-root-motion.js`: character root delta evaluation and propagation for cutscene motion.
- `scripts/hidden-completion-assets.js`: hidden-completion patch asset normalization, guide mesh model, and runtime guide mesh restoration.
- `scripts/hidden-completion-guide-editor.js`: guide-only patch creation, preview overlay, and guide vertex dragging.
- `scripts/hidden-completion-symmetry.js`: non-AI symmetry hidden-completion draft creation, counterpart matching, torso same-part side completion, and symmetry metadata writing.
- `scripts/hidden-completion-part-panel-helpers.js`: small selected-part panel helpers for torso detection, explicit left/right target-region selection, and mesh preset guide creation.
- `scripts/hidden-completion-part-panel.js`: selected-part hidden-completion UI for guide creation, 2D mesh guide presets, torso left/right symmetry drafts, patch selection, link/unlink, and cutscene-draft fallback creation.
- `scripts/hidden-completion-render.js`: runtime preview compositing for ready symmetry patches after source-panel erase and before occluding foreground parts.
- `scripts/hidden-completion-request.js`: provider-neutral hidden-completion request builder.
- `scripts/hidden-completion-request.d.ts`: request payload/options TypeScript declarations.
- `scripts/hidden-completion-prep.js`: source crop and mask descriptor preparation.
- `scripts/hidden-completion-provider.js`: provider adapter interface and capability declaration.
- `scripts/hidden-completion-result.js`: normalized provider result and project asset writer.
- `scripts/hidden-completion-prompt.js`: shared prompt builder for adapters.
- `scripts/hidden-completion-stability-provider.js`: server-side Stability API inpaint adapter.
- `scripts/hidden-completion-local-sd-provider.js`: server-side Local Stable Diffusion worker adapter.
- `scripts/hidden-completion-local-sd-worker-contract.js`: Local SD worker request/response validation helpers.
- `HIDDEN_COMPLETION_REQUEST.md`: provider-neutral request, coordinate, and provider separation contract.
- `LOCAL_SD_WORKER_CONTRACT.md`: Local Stable Diffusion worker endpoint contract.
- `scripts/motion-target-policy.js`: correspondence target overwrite policy.
- `scripts/panel-commands.js`: panel target/crop/mask commands.
- `scripts/panel-editor.js`: A/B crop and character mask UI/render helpers.
- `scripts/motion-anchors.js`: action-anchor generation and normalization.
- `scripts/motion-planner.js`: target-driven beat and trajectory draft generation.
- `scripts/motion-anchor-picker.js`: choose and directly place generated action anchors.
- `scripts/motion-trajectory-editor.js`: editable beat handles and trajectory overlay.
- `scripts/cutscene-options.js`: A cut source-motion and body-assist option controls.
- `scripts/human-rig-schema.js`: optional basic human rig role normalization plus missing-role and parent-chain validation.
- `scripts/arm-role-semantics.js`: role-specific pivot/joint/handTip labels, editability, visibility, and endpoint semantics for upperArm, forearm, and hand/glove parts.
- `scripts/arm-chain-resolver.js`: boxer punch arm-chain resolver, side classification, clean separate-chain validation, terminal endpoint resolution, and arm-only fallback metadata.
- `scripts/arm-handle-autoplace.js`: explicit user-triggered helper for initializing separate arm chain shoulder, elbow, wrist, and contact handles without load-time migration.
- `scripts/action-timeline-model.js`: punch/kick action timeline normalization used by motion planner.
- `scripts/impact-exaggeration-layer.js`: punch/kick impact beat exaggeration metadata normalization and preview transform hints.
- `scripts/scripted-genga-runner.js`: restricted declarative genga cut definition compiler/runner and project conversion boundary.
- `scripts/scripted-genga-sample-definition.js`: sample/internal reference genga cut definition used by the demo button.
- `scripts/scripted-genga-generator.js`: compatibility wrapper for `Generate Demo Genga Cut`.
- `scripts/scripted-genga-motion-preset.js`: demo motion preset for the generated genga fixture.
- `scripts/rig-connection.js`: explicit parent/child attach point metadata and rig preview point roles.
- `scripts/edit-target-inspector.js`: selected/hovered edit target inspector for pose, motion path, and hidden guide points.
- `scripts/preview-coordinate.js`: preview/client/image/part-local coordinate conversion helpers for direct manipulation.
- `scripts/preview-hit-test.js`: selected part rig point hit tests shared by preview pointer arbitration.
- `scripts/preview-pointer-arbitration.js`: preview pointerdown target arbitration and debug state.
- `scripts/pose-drag-history.js`: command-history bridge for restoring pose-drag custom motion and committed keyframes.
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

Hidden completion provider server:

```powershell
$env:STABILITY_API_KEY='...'
node scripts\hidden-completion-provider-server.js
```

Default endpoint:

```text
http://127.0.0.1:8787/hidden-completion/generate
```

The browser client posts only the neutral hidden-completion request plus prepared source/mask images and providerConfig metadata. The server reads the Stability API key from the environment.
The provider server allows common local static origins by default: `localhost/127.0.0.1` on ports `8765` and `5500`. Override with `ANIMOTION_PROVIDER_ALLOWED_ORIGINS` as a comma-separated allowlist if needed.

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
node tests\human-rig-schema.test.js
node tests\action-timeline-model.test.js
node tests\cutscene-motion-status.test.js
node tests\impact-exaggeration-layer.test.js
node tests\scripted-genga-generator.test.js
node tests\panel-commands.test.js
node tests\correspondence-commands.test.js
node tests\motion-draft-editor.test.js
node tests\motion-target-propagation.test.js
node tests\motion-target-state.test.js
node tests\arm-chain-resolver.test.js
node tests\arm-handle-autoplace.test.js
node tests\motion-planner-commands.test.js
node tests\rig-connection.test.js
node tests\ui-inspector.test.js
node tests\edit-target-inspector.test.js
node tests\preview-coordinate.test.js
node tests\preview-pose-drag.test.js
node tests\preview-hit-test.test.js
node tests\preview-pointer-arbitration.test.js
node tests\events-history-shortcuts.test.js
node tests\hidden-completion-part-panel.test.js
node tests\hidden-completion-part-panel-torso.test.js
node tests\hidden-completion-symmetry.test.js
node tests\hidden-completion-roundtrip.test.js
node tests\hidden-completion-request.test.js
node tests\hidden-completion-provider.test.js
node tests\hidden-completion-stability-provider.test.js
node tests\hidden-completion-provider-server.test.js
node tests\hidden-completion-client.test.js
node tests\hidden-completion-local-sd-provider.test.js
node --test lookism\test\cutscene-values.test.mjs
cd ai-rig-server
$env:PYTHONPATH='src'; python -m unittest discover -s tests
```

For the browser-only app test suite, this work unit also used:

```powershell
Get-ChildItem tests -Filter *.test.js | ForEach-Object { node $_.FullName }
```

The latest punch/rear-hand work unit verified the same full JS suite after adding regressions for unnamed rear arm geometry fallback, load-time preservation of old generated punch data, pre-impact `windup` status labeling, and front-hand jab preservation.

## Suggested Next Work Unit

Continue stabilizing creator-controlled rigging and motion authoring before adding more automatic generation.

Smallest next scope:

```text
visibility-mask outline browser QA
-> load a project with a parent part and at least one animated visibility mask
-> edit the parent part outline from the source/original-cut editor
-> confirm the mask stays over the same image-space region and keyframed strengths remain unchanged
-> save/load/save and confirm mask-local points, ids, and keyframes remain stable
-> then continue hidden-completion symmetry browser QA

hidden-completion symmetry browser QA
-> load or create an existing-style JSON with torso/body, neutral arm names, and edited humanRole values
-> create arm/forearm/hand symmetry drafts and verify the selected part is the fill target
-> create torso left/right symmetry drafts and verify same-part source/target metadata
-> adjust broad guide vertices in the preview so the visible patch area matches the exposed gap
-> save/load/save and confirm linked patch ids plus symmetrySource metadata remain stable
-> only after this manual completion loop is stable, resume punch/kick quality tuning
```

Why this is next:

- The new product center is direct character rigging and motion editing, so exposed-area completion must remain dependable before AI or A/B reference features expand.
- User QA found no major blocker in the boxer punch browser smoke path, making hidden-completion symmetry authoring the higher-value next manual loop.
- The current completion target is narrower: make selected-part/counterpart semantics, torso left/right semantics, guide adjustment, preview compositing, and save/load stability reliable before spending time on provider generation or kick tuning.
- Remaining work should stay in the current command, inspector/status, `motionPlan`, `cutsceneBridge.jointAction`, `part.keyframes`, `hiddenCompletionPatch`, and `project.assets` flows.

Do not change `HiddenCompletionRequestPayload`, hidden-completion provider contracts, Stability/Local SD provider logic, or B impact snap timing while continuing this rigging/motion stability pass.

## GitHub State

Remote:

```text
origin https://github.com/2019147590/animotion.git
```

Branch:

```text
master
```

Latest known implementation baseline:

```text
current upload builds on the 2026-05-26 visibility-mask edit-target work by stabilizing existing mask geometry during parent part outline edits
```

Current upload status:

```text
this upload includes the visibility-mask outline-rebase implementation, focused regressions, and this handoff update on origin/master.
```

## Current Project Notes

As of this handoff update on 2026-06-01, implementation work includes the previous `ce43f68 Stabilize rigging and motion authoring state` baseline, the image upload/session restore and canonical punch/kick selected-part generation work, punch/kick draft context invalidation, boxer punch manual-edit workflow stabilization, arm-only `handTip` endpoint support, cutscene-only rear-cross depth ordering, separate arm-chain punch resolution, role-specific rig handle semantics, clean separate-chain validation, explicit arm handle auto-placement, core manual Undo/Redo coverage, hidden-completion symmetry draft stabilization for existing JSON workflows, and visibility-mask geometry preservation during parent part outline edits.

Latest completed implementation commits:

- Current upload: part outline edits now preserve existing visibility-mask image-space placement by rebasing stored mask-local points when `applyShapeToPart()` changes the parent part rect.
- Current upload: selected-part static flip/rotation continues to leave existing visibility-mask geometry unchanged; only outline/shape application performs the rebase.
- Current upload: focused regressions cover source-editor outline edits with mask placement/keyframe preservation and transform commands with unchanged mask geometry.
- `f2536d3 Add cutscene motion status visibility`: read-only punch/kick cutscene status line in the motion panel, backed by `scripts/cutscene-motion-status.js` and `tests/cutscene-motion-status.test.js`.
- `ce43f68 Stabilize rigging and motion authoring state`: inspector parent fallback, `parentId`/`parentPartId` compatibility, out-of-rect pivot/joint preservation, pointer arbitration regressions, and motionDraft plus hiddenCompletionPatch guide round-trip coverage.
- Current upload: symmetry hidden-completion drafts can be created for legacy/neutral arm names after users edit parts into reasonable `humanRole` values. If no side name hint exists, arm counterpart matching can infer front/rear from torso/body geometry.
- Current upload: torso/body/spine selected parts expose explicit `왼쪽을 보완` and `오른쪽을 보완` target-region choices. Torso symmetry uses the same torso part as the counterpart source and stores stable `symmetrySource.targetRegion/sourceRegion` metadata.
- Current upload: symmetry patches remain non-destructive project assets linked through `motionDraft.hiddenCompletion.assetId`. They can visually cover broad guide areas until the user narrows the guide vertices, but they do not overwrite saved source part geometry or masks.
- Current upload: new helper `scripts/hidden-completion-part-panel-helpers.js` keeps torso detection, target-region selection, and mesh preset generation out of the main panel file. `scripts/bootstrap.js` loads it before the selected-part hidden-completion panel.
- Current upload: regressions cover neutral legacy counterpart geometry fallback, torso left/right UI option propagation, symmetry request-contract isolation, and arm/torso symmetry metadata save/load/save stability. The full `tests/*.test.js` suite passed locally.
- Current upload: arm-only rigs now support an explicit `handTip` endpoint in the inspector, rig handles, hit testing, render overlay, project model, serialization, part creation, and shape edit preservation paths.
- Current upload: punch generation uses the selected arm's `handTip` as the actual endpoint when no separate hand part exists, while separate hand-part rigs still resolve to the terminal hand part.
- Current upload: explicit punch regeneration after loading legacy elbow-only keyframes replaces generated punch tracks, keeps `actionTimeline.template === "punch"`, and uses base geometry for rear/front classification, target computation, windup, impact, and recover.
- Current upload: cutscene preview/playback evaluates a temporary rear-cross depth bias from `cutsceneBridge.jointAction` and current frame, so the punching rear hand/arm renders above the head during drive/impact and returns to base order during recover without changing saved part order.
- Current upload: latest rear arm-only punch QA showed target/classification were already correct, so the remaining fix is scoped to render/compositing safety: segmented arm validation, normal arm fallback, source erase safety, and paused-preview ghost suppression.
- Current upload: arm-only rear-cross punch extension/impact frames now have a runtime-only motion replacement layer. The replacement is derived from `jointAction`, evaluated `part.keyframes`, shoulder/elbow/handTip geometry, and target metadata; successful replacement skips the normal bent whole-arm draw only for that frame/part, while failures fall back to normal drawing.
- Current upload: replacement debug/status fields report activation, frame/beat, render success/failure, skipped normal arm drawing, fallback-to-normal-arm behavior, and source-erase-without-replacement risk.
- Current upload: replacement rendering responds to manual action-frame pose edits through existing keyframe evaluation, without changing trajectory handling, punch planning, depth classification, saved schema, or old JSON load behavior.
- Current upload: new regressions include `tests/punch-hand-tip-regression.test.js`, `tests/cutscene-depth.test.js`, `tests/arm-extension-render.test.js`, and `tests/preview-render-order.test.js`; the full `tests/*.test.js` suite passed locally.
- Current upload: `tests/motion-replacement-layer.test.js` covers arm-only rear punch detection, separate-hand rig opt-out, edited impact pose response, safe render skip, safe fallback, and old JSON save preservation.
- Current upload: normal image upload no longer crashes when there are no parts or selected part, project restore no longer merges in stale current bridge data, restored cutscene projects set the motion UI back to cutscene mode, stale normalized runtime geometry is ignored during project save, and punch/kick selected-part draft generation reuses the canonical motion planner path.
- Current upload also prevents punch/kick generation from reusing stale target/anchor/draft data when the action type or selected primary part changes, while preserving manual trajectory edits for the same action plus same part.
- Boxer punch action demo is now the active 1st-priority scope: generated punch `part.keyframes` can be scrubbed, hand/arm/body pose drags commit frame keyframes, preview evaluation uses those manual keyframes, and edits persist until explicit punch regeneration.
- Current upload shifts punch editing from trajectory-first to action-frame-first: generated punch beats are exposed as selectable frame buttons, selecting a beat moves preview to that frame, handTip/joint pose drags write to `part.keyframes`, and trajectory hit targets are read-only while action-frame editing is active.
- Current upload adds `tests/action-frame-editor.test.js`, `tests/action-frame-pose-drag.test.js`, and preview pointer arbitration coverage for trajectory read-only mode.
- Current upload maps pre-impact punch `recoil` status to user-facing `windup`, keeps `recover` as the post-impact beat, and adds rear-hand punch regeneration fallback for legacy neutral part names by using torso/hand geometry when name/id hints are unavailable.
- Current upload makes `part.humanRole` editable in the inspector while preserving legacy `part.type` and old JSON fallback behavior.
- Current upload adds strict role-based arm semantics: upperArm pivot/joint mean shoulder/elbow, forearm pivot/joint mean elbow/wrist, and hand/glove pivot/handTip mean wrist/contact. Legacy upperArm/forearm handTip data is preserved on load but ignored when a terminal hand/glove exists.
- Current upload adds `scripts/arm-chain-resolver.js` so selected upperArm, forearm, or hand/glove resolves to the same chain and terminal hand/glove endpoint. Clean separate chains use normal rig/keyframe punch motion and do not activate the arm-only replacement layer by default.
- Current upload validates separate arm relationship contracts: hand parent is forearm, forearm parent is upperArm when present, upperArm connects toward torso when available, upperArm.joint aligns with forearm.pivot in world/image space, and forearm.joint aligns with hand/glove.pivot in world/image space.
- Current upload adds explicit `Auto place arm handles` UI and `scripts/arm-handle-autoplace.js` for user-triggered shoulder/elbow/wrist/contact handle initialization. It does not auto-migrate old JSON, does not run on project restore, does not silently rewrite parentId, and preserves out-of-rect handle coordinates.
- Current upload adds regressions in `tests/arm-chain-resolver.test.js`, `tests/arm-handle-autoplace.test.js`, and related planner/status/depth/inspector tests. The full `tests/*.test.js` suite passed locally.
- Existing project JSON load remains backward compatible: saved old punch `jointAction` beats and `part.keyframes` are restored unchanged and are only replaced when the user explicitly regenerates the selected punch.
- No persisted schema changes, duplicate editor state, provider contract changes, Stability/Local SD changes, kick quality tuning, or B impact snap timing changes were added in these units.

Previously completed implementation history:

- Planning/product direction update:
  - Updated the planning spec and README direction around creator-controlled 2D/2.5D animation, rights-safe original/licensed IP workflows, scripted genga fixtures, and planning documents as living documents.
  - Reframed generated demo cuts as source material for rigging/motion/hidden-completion testing, not as a general drawing app.
- Scripted genga runner:
  - Added a restricted declarative runner in `scripts/scripted-genga-runner.js`.
  - Added `compileScriptedGengaScript(source)`, `runScriptedGengaDefinition(definition)`, and `loadGeneratedCutIntoApp(result)`.
  - `compileScriptedGengaScript` currently accepts JSON string/object definitions and rejects arbitrary source. There is no `eval`.
  - The runner separates definition normalization, SVG preview generation, part/layer metadata generation, hidden-completion guide asset generation, and `AnimotionProject` conversion.
  - SVG output is generated from allowlisted elements/attributes.
- Sample genga definition:
  - Added `scripts/scripted-genga-sample-definition.js` as the first sample/internal reference implementation.
  - The previous hardcoded demo cut is now expressed as a sample cut definition with canvas, visual SVG elements, parts, parent links, pivots, joints, layer order, and a hidden-completion guide.
  - `Generate Demo Genga Cut` still works through `scripts/scripted-genga-generator.js`, but the wrapper now runs the sample definition through the runner.
- Demo genga motion preset:
  - Added `scripts/scripted-genga-motion-preset.js`.
  - Added `Apply Demo Genga Motion` as a dev/demo UI entrypoint.
  - The preset applies torso/root, head, right upper arm, right forearm, and speed-arc keyframes.
  - It stores trajectory points, root motion, cutscene bridge data, and motionDraft hidden-completion metadata through existing motion/cutscene/project paths.
  - `scripts/motion-planner.js` now preserves demo `trajectoryPoints`, `rootMotion`, and `demoMotionPresetId` during plan normalization.
- Scripted genga tests:
  - Expanded `tests/scripted-genga-generator.test.js` to cover deterministic sample definition execution, JSON compile behavior, motion-ready metadata, project normalize/save/load round-trip, hidden-completion guide preservation, demo motion application, and demo motion round-trip.

- Basic human rig schema:
  - Added `scripts/human-rig-schema.js`.
  - Existing `part.type` values are unchanged.
  - `humanRole` is stored as optional metadata and normalizes to `torso`, `pelvis`, `head`, `upperArm`, `forearm`, `hand`, `thigh`, `shin`, or `foot`.
  - Added pure validation helpers for required-role gaps and parent-chain issues, including missing parents and cycles.
  - `project-model` and `.d.ts` now preserve `humanRole` through save/load round trips.
- Action timeline model:
  - Added `scripts/action-timeline-model.js`.
  - Punch timeline is `guard -> windup -> drive -> extension -> impact -> recover`.
  - Kick timeline is `ready -> compress -> chamber -> extend -> impact -> recover`.
  - The model normalizes `impactFrame`, `durationFrames`, `beats`, `primaryPartRole`, and `rootMotionHint`.
  - `motion-planner.js` now reads punch/kick beats from the new model while preserving legacy `template: "punch"` and `template: "kick"` behavior.
  - `cutscene-model.js` preserves normalized `jointAction.actionTimeline` metadata.
- Human/action tests:
  - Added `tests/human-rig-schema.test.js`.
  - Added `tests/action-timeline-model.test.js`.
  - Verified new tests plus existing punch/kick, project round-trip, motion command, session, target propagation/state, geometry, part command, hidden completion round-trip, AI import, and scripted genga tests.
- Impact exaggeration layer:
  - Added `scripts/impact-exaggeration-layer.js`.
  - `cutsceneBridge.jointAction.impactExaggeration` is the canonical source of truth.
  - `motion-planner.js` creates default punch/kick impact exaggeration from the action timeline impact beat.
  - `cutscene-model.js` preserves normalized impact exaggeration metadata through save/load.
  - `preview.js` applies minimal scale/stretch hints only while the layer is enabled and the current frame is inside the impact hold range.
  - `index.html`, `scripts/config.js`, `scripts/ui.js`, and `scripts/events.js` add the `타격 과장 적용` checkbox in the motion panel.
  - The checkbox updates the existing joint action through `motionCommands.updateJointAction()` and does not create `project.effects` or any separate editor state.
  - Added `enabled: true` by default for new punch/kick layers. Legacy layers without `enabled` normalize as enabled.
  - Smear, draw-over, strength editing, frame editing, and close-up punch rig UI are not implemented in this unit.
- Impact exaggeration tests:
  - Added `tests/impact-exaggeration-layer.test.js`.
  - Covered normalization, strength/hold clamping, punch/kick default layer creation, save/load round-trip, `enabled: false` preview suppression, legacy no-`enabled` compatibility, and UI shell wiring.
  - Expanded `tests/motion-commands.test.js` to verify enabled toggling stays on `cutsceneBridge.jointAction.impactExaggeration` and does not create `project.effects`.
  - Verified all `tests/*.test.js` pass locally.

- Motion/cutscene terminology cleanup:
  - Added `MOTION_TERMINOLOGY.md`.
  - User-facing Korean labels now distinguish A/B correspondence/reference data, B cut reference parts, active/manual/generated motion targets, character root anchors/deltas, trajectory samples, and trajectory control points.
  - `activeMotionTarget` debug data now records source, point, coordinate space, and whether the B reference currently drives motion.
- Edit target inspector:
  - Added a preview inspector/help panel that reports whether the current target is pose, motion path, or hidden completion guide.
  - Hovered/clicked rig/trajectory/guide points populate user-facing labels and role descriptions.
- Rig connection UX:
  - Parts now carry explicit connection metadata: parent part, self attach point, parent attach point, rotation pivot, and follow strength.
  - Rig preview distinguishes connection points, rotation centers, joints, trajectory points, guide points, and body root points with user-facing labels.
  - Parent/child root motion propagation avoids double-applying character root delta to connected children.
- Preview direct manipulation:
  - Rig point dragging now creates a drag session on pointerdown and keeps the selected point fixed until pointerup.
  - Pointer moves use a single coordinate path and frozen start transforms, so rig points follow the pointer 1:1 across zoom levels.
  - Rig points can now move outside the selected part rectangle when authored outside the visual bounds. Joint, connection, and rotation pivot local coordinates are preserved even when outside `0..rect.w/h`.
  - Part-local normalized rig points may be outside `0..1` and round-trip through save/load without silent clamping.
  - Cutscene pose joint dragging now uses unclamped preview-to-image deltas, so dragging past the source/image bounds no longer randomly caps the movement area.
  - Selected joint pose dragging no longer adds extra selected-part translation or rotation on top of the joint delta, reducing jumpy deformation during direct manipulation.
  - Pose-drag commits now record a command-history entry, so a bad joint drag can be restored with Undo after pointerup/keyframe commit.
- Preview pointer arbitration:
  - Added central pointerdown arbitration with the priority order documented in `PREVIEW_POINTER_POLICY.md`.
  - Preview editors now expose `hitTarget(event)` and `beginDragFromTarget(event, target)` instead of competing with capture-phase `stopImmediatePropagation()`.
  - The latest target decision is stored in `Animotion.state.previewPointerArbitrationDebug`; console logging can be enabled with `Animotion.state.debugPreviewPointerArbitration = true` or `localStorage.debugPreviewPointerArbitration = "1"`.
  - Stale preview/trajectory drag state is cleared when the canvas no longer owns pointer capture, preventing old trajectory drags from blocking later rig handle drags.
  - Active drag ownership is centralized so pointermove/pointerup route only to the editor chosen during pointerdown arbitration.
  - Active picker state is exclusive across correspondence picking, motion anchor picking, and motion target picking so two picker modes cannot consume the same preview click.
  - Arbitration now falls through to the next viable hit target when a higher-priority target cannot start a drag, instead of leaving the preview in a blocked state.
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
- JSON round-trip tests for hidden completion guide assets.
- Provider-neutral hidden completion request builder and documentation.
- Request options allowlist to keep provider/model/API settings out of the neutral payload.
- Source/mask preparation descriptor layer.
- Provider adapter interface with capability declarations.
- Normalized hidden completion result writer with generated texture asset storage and patch provenance.
- Server-side Stability image-edit/inpaint adapter with env-only API key handling and mocked tests.
- Server-side Local Stable Diffusion worker adapter with mocked tests.
- Local Stable Diffusion worker endpoint contract documentation and validation helpers.
- Local Node hidden completion provider server and browser local-provider client.
- Motion target debug tracing for converted B target, target delta, distance, scope, root delta, follow strength, and evaluated transforms.
- Body-follow/full-character motion scopes with root/body translation keyframes for long targets.
- Character root delta propagation during cutscene evaluation so visible character parts move coherently even without reliable parent hierarchy.
- Separate target semantics for `correspondenceAnchor`, `manualMotionTarget`, `activeMotionTarget`, `characterRootAnchor`, and `trajectoryPoints`.
- UI controls for `Use B correspondence as motion target` and `Clear manual target`.
- Kick mode avoids using chest/hip/head correspondence as the default attack target unless explicitly applied.
- Root motion tuning fields for body follow, max root delta, primary lead, and secondary follow.
- Trajectory sample semantics separated from editable anchors/control points.
- B impact anchors saved as normalized image coordinates and restored against the current image size.
- Keyboard history shortcuts: `Ctrl+Z`, `Ctrl+Y`, and `Ctrl+Shift+Z`.
- Keyboard history shortcuts do not call app command history from `input`, `textarea`, `select`, or `contenteditable`; browser text undo/redo remains first.
- Timeline keyframe mutation removed from `scripts/timeline.js`; keyframe writes now stay in `scripts/motion-commands.js`.
- Planner, anchor picker, trajectory editor, timeline controls, preview rig edits, cutscene controls/options, IO restore, and Lookism preset application moved toward command helpers.
- Regression tests:
  - `tests/ai-rig-import.test.js`
  - `tests/part-commands.test.js`
  - `tests/motion-commands.test.js`
  - `tests/session-commands.test.js`
  - `tests/human-rig-schema.test.js`
  - `tests/action-timeline-model.test.js`
  - `tests/impact-exaggeration-layer.test.js`
  - `tests/scripted-genga-generator.test.js`
  - `tests/panel-commands.test.js`
  - `tests/correspondence-commands.test.js`
  - `tests/motion-draft-editor.test.js`
  - `tests/hidden-completion-roundtrip.test.js`
  - `tests/hidden-completion-request.test.js`
  - `tests/hidden-completion-provider.test.js`
  - `tests/hidden-completion-stability-provider.test.js`
  - `tests/hidden-completion-provider-server.test.js`
  - `tests/hidden-completion-client.test.js`
  - `tests/hidden-completion-local-sd-provider.test.js`
  - `tests/motion-target-propagation.test.js`
  - `tests/motion-target-state.test.js`
  - `tests/cutscene-options.test.js`
  - `tests/cutscene-depth.test.js`
  - `tests/cutscene-motion-status.test.js`
  - `tests/punch-hand-tip-regression.test.js`
  - `tests/arm-extension-render.test.js`
  - `tests/preview-render-order.test.js`
  - `tests/edit-target-inspector.test.js`
  - `tests/events-history-shortcuts.test.js`
  - `tests/hidden-completion-part-panel.test.js`
  - `tests/geometry.test.js`
  - `tests/preview-coordinate.test.js`
  - `tests/preview-pose-drag.test.js`
  - `tests/preview-pointer-arbitration.test.js`
  - `tests/action-frame-editor.test.js`
  - `tests/action-frame-pose-drag.test.js`

Latest completed before the motion status and stability pass uploads:

- Unified runtime/preview parent checks around `rigConnection.parentIdFor(part)` for parentId/parentPartId compatibility, with parentId priority regression coverage.
- Fixed parented-head and root-follow cutscene regressions so parented heads inherit through parent transforms instead of receiving duplicate root follow.
- Added multiple trajectory tracks for generated cutscene actions so body/root and primary limb paths can be displayed/edited without breaking existing motion command paths.
- Expanded A/B cut image scale controls to a wider range while preserving save/load compatibility.
- Added Lookism-style ghost rendering controls and shared ghost timing constants between generic cutscene preview and Lookism preset rendering.
- Added selected-part hidden-completion UI for guide creation, 2D mesh guide presets, existing patch selection, patch link/unlink, and automatic hidden-completion draft creation when a cutscene action exists without a motion draft.
