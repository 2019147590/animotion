# Coordinate Space Audit

## Problem 1-Pager

### Context

Animotion stores editable rig JSON while rendering and editing against the current canvas/image transforms. B impact anchors already keep stable `normalized-image` storage in `bImpact` and restore pixels at display/compile boundaries.

### Problem

Other point-like data still mixes stable project data with runtime pixels. Converting every point to `normalized-image` would be wrong because pivots and joints are local to a part, while action anchors and trajectory beats are source-image planning data.

### Goal

Identify each coordinate space before changing behavior, then add stable storage fields while preserving runtime pixel fields for renderers and old projects.

### Non-Goals

- Do not replace all pixel fields in one pass.
- Do not change panel/camera display transforms.
- Do not remove legacy JSON compatibility.
- Do not add AI matching, mesh deformation, or renderer z-swap behavior.

### Constraints

- Current preview/render code expects pixel `part.rect`, `part.pivot`, `part.joint`, motion anchors, and beat poses.
- Saved JSON must survive reload when the current source or impact image dimensions differ.
- Existing project and legacy rig payloads must still import.
- The app remains static and dependency-free.

## Options Compared

1. Convert all point fields to `normalized-image`.
   - Pros: one obvious format for storage.
   - Cons: wrong for part-local pivots/joints and hides semantic differences.
   - Risk: future code cannot tell whether a point was local, source-image, or impact-image data.

2. Store stable fields per semantic space and keep runtime pixel fields.
   - Pros: preserves existing renderers while making saved data resize-safe.
   - Cons: more fields during migration.
   - Risk: fields can diverge unless save/load normalization is centralized.

Decision: choose option 2. The project model remains the storage boundary; editor state keeps runtime pixel values.

## Current Coordinate Inventory

| Data | Current Runtime | Stable Storage Recommendation | Runtime Boundary |
| --- | --- | --- | --- |
| B impact | `impactAnchor` pixel plus `bImpact` normalized | `normalized-image` on B image | display/compile restores B image pixels |
| Part rect | source-image pixel | source-image normalized rect | project load restores current source pixels |
| Pivot | part-local pixel | part-local normalized | project load restores local pixels from current rect |
| Joint | part-local pixel | part-local normalized | project load restores local pixels from current rect |
| Mask vertices | part-local pixel | part-local normalized vertices | project load restores local pixels from current rect |
| Motion target | source-image pixel plus `targetNormalized` | source-image normalized draft field | planner compile restores source pixels |
| Action anchor | source-image pixel plus `pointNormalized` | source-image normalized draft field | planner/anchor edit restores source pixels |
| Trajectory beat | source-image pixel arrays plus `poseNormalized` | source-image normalized draft field | trajectory display/track compile restores source pixels |

## Impact Note

`sourceRect`, `pivot`, `joint`, `mask.points`, `motionPlan.target`, and action-anchor `point` remain runtime pixel fields because preview, render, planner, and existing tests read them directly. New normalized fields are additive and are used at save/load or planner normalization boundaries.

## Hidden Completion Patch Asset

`hiddenCompletion.assetKind` normalizes legacy `inpaintedPatch` to `hiddenCompletionPatch`.

Patch asset coordinate spaces:

- `sourceRectNormalized`: A/source image normalized rect.
- `maskVerticesNormalized`: selected part-local normalized vertices.
- `patchTransform.translationNormalized`: part-local normalized translation.
- `patchTransform.scaleX`, `patchTransform.scaleY`, and `patchTransform.rotation`: patch-local transform values.

When project assets are available, a draft can stay `assetStatus: "ready"` only if `hiddenCompletion.assetId` points to a project asset with `type: "hiddenCompletionPatch"`.
