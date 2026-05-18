# Preview Pointer Target Arbitration

Preview `pointerdown` must be resolved by one arbiter before any editor starts a drag.
Editors should expose side-effect-free hit tests and a separate drag starter. They should not compete with
capture-phase `stopImmediatePropagation()` for normal preview editing.

## Pointerdown Flow

1. `previewPointerArbitration.collectTargets(event)` asks registered preview editors for possible hit targets.
2. `previewPointerArbitration.decideTarget(targets)` chooses exactly one target using the priority table.
3. `previewPointerArbitration.beginPointerDown(event)` starts a drag only for the selected target.
4. Move/up events remain owned by the editor that created the drag session.

## Priority Table

1. `active-drag-session`
2. `selected-part-rigging-point`
3. `active-mode-guide-point`
4. `selected-part-transform-handle`
5. `motion-trajectory-point`
6. `part-body`
7. `empty-preview-background`

## Editor Contract

Each preview editor that wants pointerdown ownership should provide:

- `hitTarget(event)`: returns a target descriptor without mutating state.
- `beginDragFromTarget(event, target)`: starts the drag session for a target selected by the arbiter.

Current active click modes such as B-cut reference picking, motion anchor picking, and motion target picking use
the same contract. Future editors such as part transform handles or camera handles should register through this
contract instead of adding independent capture-phase pointerdown handlers.

## Debugging

The arbiter writes the latest decision to `Animotion.state.previewPointerArbitrationDebug`.
Set `Animotion.state.debugPreviewPointerArbitration = true` or `localStorage.debugPreviewPointerArbitration = "1"`
to log the selected target and candidates to the console.
