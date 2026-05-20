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

Implemented in `scripts/motion-planner.js`, `scripts/action-timeline-model.js`, `scripts/motion-anchors.js`, `scripts/motion-anchor-picker.js`, and `scripts/motion-trajectory-editor.js`.

- Motion templates: kick, punch, dash.
- Punch and kick now read their beat timing from `scripts/action-timeline-model.js` while preserving the existing `motionPlanner -> cutsceneBridge -> part.keyframes` flow.
- Punch timeline: `guard -> windup -> drive -> extension -> impact -> recover`.
- Kick timeline: `ready -> compress -> chamber -> extend -> impact -> recover`.
- Action timeline normalization preserves `durationFrames`, `impactFrame`, `beats`, `primaryPartRole`, and `rootMotionHint`.
- Legacy `motionPlan.template: "punch"` and `"kick"` continue to normalize and generate cutscene bridge actions.
- Punch/kick plans now create `cutsceneBridge.jointAction.impactExaggeration` from the action timeline impact beat.
- Impact exaggeration metadata is stored on `cutsceneBridge.jointAction` only. Do not introduce a duplicate `project.effects` editor state for this.
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

### Impact Exaggeration Layer

Implemented in the current working tree in `scripts/impact-exaggeration-layer.js`, `scripts/motion-planner.js`, `scripts/cutscene-model.js`, `scripts/preview.js`, `scripts/ui.js`, and `scripts/events.js`.

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

Recent commit:

```text
5064c57 Add direct motion anchor picking
```

### Scripted Genga Cut Generator

Implemented in the current working tree.

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
- Guide mesh preview is currently an editor overlay. It is not a final image patch and should be treated as AI/input guidance only. Users can now create a guide patch or a 2D mesh guide preset from the selected part inspector, then adjust guide vertices in the preview.
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
- `scripts/hidden-completion-part-panel.js`: selected-part hidden-completion UI for guide creation, 2D mesh guide presets, patch selection, link/unlink, and cutscene-draft fallback creation.
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
node tests\impact-exaggeration-layer.test.js
node tests\scripted-genga-generator.test.js
node tests\panel-commands.test.js
node tests\correspondence-commands.test.js
node tests\motion-draft-editor.test.js
node tests\motion-target-propagation.test.js
node tests\motion-target-state.test.js
node tests\rig-connection.test.js
node tests\edit-target-inspector.test.js
node tests\preview-coordinate.test.js
node tests\preview-pose-drag.test.js
node tests\preview-hit-test.test.js
node tests\preview-pointer-arbitration.test.js
node tests\events-history-shortcuts.test.js
node tests\hidden-completion-part-panel.test.js
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

## Suggested Next Work Unit

Stabilize creator-controlled rigging and motion authoring before adding more automatic generation.

Smallest next scope:

```text
part selection and inspector consistency
-> pivot/joint editing with out-of-rect coordinates preserved
-> parent-child transform evaluation and debug output
-> trajectory control point editing without preview target conflicts
-> save/load/save round-trip coverage for motionDraft and hiddenCompletionPatch guide data
-> undo/redo records for the remaining command helpers
```

Why this is next:

- The new product center is direct character rigging and motion editing, so the edit loop must be dependable before AI or A/B reference features expand.
- Correspondence, manual target, active target, root anchor, and trajectory sample concepts are separated in state, but creator-facing UI still needs stronger visual distinction.
- Hidden-completion guide assets now exist; their coordinates and asset references must round-trip reliably before generated patches become a production feature.

Do not change `HiddenCompletionRequestPayload`, hidden-completion provider contracts, Stability/Local SD provider logic, or B impact snap timing while doing this rigging/motion stability pass.

## GitHub State

Remote:

```text
origin https://github.com/2019147590/animotion.git
```

Branch:

```text
master
```

Latest known committed baseline:

```text
abb9f2b Add human rig schema and action timelines
```

Current upload status:

```text
impact exaggeration work is still uncommitted/unpushed in the working tree
```

## Current Working Tree Notes

As of this handoff update on 2026-05-20, the scripted genga generator, demo motion preset, planning-doc updates, UI demo entrypoints, basic human rig schema, and action timeline model have been committed and pushed to `master`. The impact exaggeration layer and enabled-toggle UI are implemented locally but not committed or pushed.

Recently completed in the working tree:

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
  - `tests/edit-target-inspector.test.js`
  - `tests/events-history-shortcuts.test.js`
  - `tests/hidden-completion-part-panel.test.js`
  - `tests/geometry.test.js`
  - `tests/preview-coordinate.test.js`
  - `tests/preview-pose-drag.test.js`
  - `tests/preview-pointer-arbitration.test.js`

Latest completed in this working tree before upload:

- Unified runtime/preview parent checks around `rigConnection.parentIdFor(part)` for parentId/parentPartId compatibility, with parentId priority regression coverage.
- Fixed parented-head and root-follow cutscene regressions so parented heads inherit through parent transforms instead of receiving duplicate root follow.
- Added multiple trajectory tracks for generated cutscene actions so body/root and primary limb paths can be displayed/edited without breaking existing motion command paths.
- Expanded A/B cut image scale controls to a wider range while preserving save/load compatibility.
- Added Lookism-style ghost rendering controls and shared ghost timing constants between generic cutscene preview and Lookism preset rendering.
- Added selected-part hidden-completion UI for guide creation, 2D mesh guide presets, existing patch selection, patch link/unlink, and automatic hidden-completion draft creation when a cutscene action exists without a motion draft.
