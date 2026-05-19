# Cutscene Motion Terminology

This document keeps cutscene motion terms consistent between code, UI, and debug output.

A/B correspondence is an optional reference/pose-assist workflow. It is not the product center and must not imply copying an unauthorized source panel, pose, silhouette, layout, or IP-specific style.

| Concept | Code term | UI term | Meaning |
| --- | --- | --- | --- |
| Correspondence | `correspondence` | A/B 대응 정보 or B컷 참조 | Optional reference connection between a source part and a second-image reference point. This is reference data and is not automatically the motion target. |
| B reference part | `bReferencePart` or `correspondencePart` | B컷 참조 파츠 | The second-image part used as an optional reference for A/B correspondence. |
| Motion target | `motionTarget` | 움직임 목표 | The actual point used to generate motion. |
| Manual motion target | `manualMotionTarget` | 수동 움직임 목표 | A user-created motion target. |
| Active motion target | `activeMotionTarget` | 현재 움직임 목표 | The target currently driving motion generation. `source` is `manual`, `correspondence`, or `generated`. |
| Character root anchor | `characterRootAnchor` | 캐릭터 기준점 | Reference point for whole-character/root movement. |
| Character root delta | `characterRootDelta` | 캐릭터 이동량 | Computed movement applied to the character/root. |
| Trajectory samples | `trajectorySamples` | 이동 궤적 미리보기 | Evaluated frame-by-frame path samples. These are not anchors unless explicitly made editable. |
| Trajectory control points | `trajectoryControlPoints` | 궤적 조정점 | Editable control/key points when implemented. |

## Notes

- A/B 대응 정보 can be saved without changing the current motion.
- B컷 참조 위치 drives motion only after the user explicitly applies it as the current motion target.
- 수동 움직임 목표 stays active until the user clears it or explicitly applies another target.
- 이동 궤적 미리보기 samples are display/evaluation data. Do not treat them as editable anchors or control points by default.
- Prefer 오리지널/허가 IP wording in product docs; use A/B wording only when describing the implemented optional reference feature.
