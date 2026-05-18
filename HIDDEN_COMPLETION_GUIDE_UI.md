# Hidden Completion Guide UI

## Problem 1-Pager

### Context

`hiddenCompletionPatch` assets can now store a guide mesh separately from any later AI-generated patch result. The app still needs a user-facing way to create that guide from a selected part and inspect it on the current preview.

### Problem

Guide mesh data exists in JSON, but users cannot create or adjust it from the editor. Without a visible preview, the guide risks becoming a hidden data field rather than a practical authoring step.

### Goal

Add a small UI path that creates a guide-only patch for the active 2.5D draft, links it to `motionDraft.hiddenCompletion.assetId`, draws the guide on the preview, and lets users drag mesh vertices while storing part-local normalized coordinates.

### Non-Goals

- No AI inpainting request.
- No generated patch image rendering.
- No mixed guide/generated render mode.
- No source texture deformation.

### Constraints

- Existing pivot and joint dragging must keep working.
- Legacy `hiddenCompletionPatch` assets without `guide` must still load.
- Runtime preview pixels must be restored from saved part-local normalized guide vertices.

## Options Compared

1. Add guide controls directly inside `motion-draft-editor.js`.
   - Pros: fewer files.
   - Cons: grows an already large inspector file and mixes lifecycle controls with mesh editing.
   - Risk: harder to keep the next mesh UI changes scoped.

2. Add a small `hidden-completion-guide-editor.js` module.
   - Pros: keeps guide creation, preview overlay, and vertex editing isolated.
   - Cons: adds one bootstrap entry.
   - Risk: preview event priority must be explicit.

Decision: choose option 2. Guide vertex hits are checked before pivot/joint drag so mesh editing is direct, while normal rig handles still work when no guide vertex is hit.
