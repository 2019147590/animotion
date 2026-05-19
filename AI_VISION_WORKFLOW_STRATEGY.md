# AI Vision 창작자 보조 파츠/리깅 전략

## Problem 1-Pager

### Context

Animotion의 현재 최상위 앱은 사용자가 오리지널 또는 정식 권리를 확보한 캐릭터 이미지를 올리고, 직접 마스크를 그려 파츠를 만든 뒤, 피벗/관절/부모관계를 지정해 Canvas에서 리깅 미리보기를 만든다. `lookism` 프로토타입은 미리 준비한 파츠 PNG와 manifest, 관절 좌표 테이블을 사용하면 영상 파일 없이도 컷신을 매 프레임 합성할 수 있음을 보여주는 검증용 예시다.

다음 목표는 창작자가 직접 제어할 수 있는 수동 파츠 제작 시간을 줄이는 것이다. 사용자가 직접 그렸거나 권리를 가진 캐릭터 이미지를 업로드하면 앱이 캐릭터/파츠 후보를 찾고, 파츠 레이어, 관절 좌표, 피벗/부모관계 초안을 제안해서 Canvas rig data 초안을 생성해야 한다.

이 문서는 AI 보조 기능의 현재 가설이다. 실제 모델 출력, 사용자 보정 비용, 법적/IP 판단, 구현 난이도, 데이터 round-trip 안정성에 따라 단계와 모델 조합은 바뀔 수 있다.

### Goal

1차 목표는 완전 자동 완성기가 아니라, 사용자가 바로 수정 가능한 리깅 초안을 만드는 창작자 보조 파이프라인이다.

```text
오리지널/허가 캐릭터 이미지 업로드
-> 캐릭터 instance 추출
-> 캐릭터별 crop
-> DWPose 관절 추정
-> See-through 레이어 분해
-> 관절/레이어 reconcile
-> SAM 계열 경계 보정
-> VLM 검수
-> Canvas rig JSON + PNG/mask 생성
-> 사용자가 correction UI에서 수정
```

품질 목표는 "80% 자동 생성 + 20% 빠른 보정"이다. AI 결과를 확정값으로 숨기지 않고, 항상 사용자가 확인하고 고칠 수 있는 제안으로 취급한다.

### Non-Goals

- 1차 목표에서 브라우저 내부 WebGPU만으로 모든 AI 모델을 실행하지 않는다.
- See-through 결과만으로 완전한 Live2D rig를 만든다고 가정하지 않는다.
- VLM을 픽셀 마스크의 source of truth로 쓰지 않는다.
- 첫 구현에서 A/B 두 컷의 파츠 대응과 생성형 인비트윈까지 해결하지 않는다.
- 사용자 보정 UI를 제거하고 원클릭 자동화만 추구하지 않는다.
- 무단 웹툰 컷, 유명 IP, 원작 그림체 복제 워크플로우를 제품 목표로 두지 않는다.

### Constraints

- AI 모델 실행은 Vessl의 RTX 3090 GPU 환경에서 별도 Python 백엔드 또는 작업 서버로 처리한다.
- Canvas 앱은 AI 결과물인 PNG/mask/JSON을 로드해 편집하고 렌더링한다.
- 기존 수동 파츠 제작 워크플로우와 리그 JSON 호환성을 유지한다.
- 모델 출력이 틀릴 수 있으므로 각 단계는 confidence, diagnostics, correction target을 남긴다.
- MVP는 사용자가 업로드한 단일 오리지널/허가 이미지에서 자동으로 주 대상 캐릭터를 골라 rig 초안을 만드는 흐름을 먼저 검증한다. 여러 캐릭터 후보 선택 UI와 두 컷 대응은 후속 단계의 레퍼런스/포즈 보조 기능으로 둔다.

### IP Safety

안전한 입력은 사용자가 직접 그린 캐릭터, 사용자가 권리를 보유한 오리지널 IP, 정식 라이선스 캐릭터, 상업 사용 가능한 에셋, 테스트용 더미/샘플 에셋이다.

AI pipeline은 원본 컷 복제, 원본 포즈 트레이싱, 원본 실루엣 재현, 원본 구도/연출/컷 순서 복원을 목표로 하지 않는다. 레퍼런스가 있더라도 동작 원리와 감정 흐름을 사용자 오리지널 캐릭터로 재해석하는 보조 정보로만 다룬다.

## 결정된 선택

### Pose Estimator

DWPose를 1차 pose estimator로 사용한다.

선택 이유:

- body, face, hand를 포함한 whole-body keypoint 계열이라 2D 캐릭터 리깅에 필요한 관절 후보를 많이 제공한다.
- ControlNet/일러스트 워크플로우에서 이미 널리 쓰여 애니/만화 이미지에 대한 실전 사례가 많다.
- RTMPose보다 무겁지만 MVP 서버 파이프라인에서는 실시간 프레임 처리가 아니라 업로드 후 분석이므로 정확도와 keypoint richness가 더 중요하다.

주의:

- DWPose도 만화/일러스트 도메인에서는 실패할 수 있다.
- 과장된 포즈, 가려진 팔다리, 반신 이미지, 효과선이 많은 입력은 별도 실패 처리가 필요하다.
- 관절 좌표는 rig 생성의 강한 힌트이지, 무조건 정답은 아니다.

### Layer Decomposition

See-through를 1차 layer decomposition 모델로 사용한다.

역할:

- 캐릭터 이미지를 semantic layer로 분해한다.
- hair, face, eyes, mouth, neck, clothing, accessories 등 투명 레이어를 만든다.
- occluded region inpainting과 depth/layer order 정보를 활용한다.

주의:

- See-through는 자동 리깅 모델이 아니라 레이어 분해 모델이다.
- upper arm, forearm, thigh, shin처럼 리깅에 필요한 limb 단위가 항상 바로 나오지는 않는다.
- 따라서 DWPose 관절 좌표를 기준으로 split/merge하는 후처리가 필요하다.

### Character Instance Segmentation

캐릭터 검출/분리는 SAM3 primary, Grounding DINO + SAM fallback 구조로 둔다.

역할:

- 입력 이미지 전체에서 리깅 대상 캐릭터 instance를 분리한다.
- 여러 캐릭터가 있는 경우 가장 큰/중앙/고신뢰 instance를 자동 선택한다.
- See-through와 DWPose에 배경/말풍선/다른 캐릭터가 섞여 들어가는 것을 줄인다.

MVP에서는 SAM3가 준비되지 않았거나 운영 비용이 높으면 Grounding DINO + SAM 계열로 먼저 시작할 수 있다.

### VLM Verification

OpenAI, Claude, Gemini 같은 VLM은 검수와 설명에 사용한다.

좋은 사용:

- 파츠 라벨이 맞는지 확인한다.
- 좌우 팔/다리가 뒤집혔는지 확인한다.
- 얼굴/머리/팔/다리 누락 여부를 판단한다.
- confidence가 낮은 결과를 correction UI에서 강조한다.

나쁜 사용:

- 정확한 픽셀 마스크를 VLM 출력만으로 생성한다.
- VLM의 자연어 판단을 geometry보다 우선한다.
- VLM 검수 없이 자동으로 모든 파츠를 확정한다.

## 최종 파이프라인

```text
[Input original/licensed character image]
        |
        v
[Character instance segmentation]
SAM3 primary
Grounding DINO + SAM fallback
        |
        v
[Character crop per instance]
normalize size
remove image margin
preserve mapping to original image coordinates
        |
        +--> [Pose estimator]
        |    DWPose
        |    output: whole-body keypoints + confidence
        |
        +--> [Layer decomposition]
             See-through primary
             optional anime foreground mask
             output: transparent layers + masks + depth/order
        |
        v
[Pose + layer reconciliation]
split/merge layers with keypoint guidance
label rig parts
resolve left/right
        |
        v
[SAM mask refinement]
refine only weak or ambiguous masks
        |
        v
[VLM semantic audit]
label/missing/duplicate/left-right checks
        |
        v
[Geometry postprocess]
polygon, bbox, pivot, joint, hierarchy, z-index
        |
        v
[Canvas rig data]
PNG layers + mask polygons + JSON manifest
        |
        v
[Human correction UI]
        |
        v
[Feedback dataset]
corrections saved for evaluation and future fine-tuning
```

## Stage Details

### 1. Character Instance Segmentation

Input:

- 원본 오리지널/허가 캐릭터 이미지

Output:

- `characterInstances[]`
- 각 instance의 bbox, mask, confidence
- 원본 이미지 좌표계와 crop 좌표계 간 변환 정보

Why:

- See-through와 DWPose가 이미지 전체의 배경, 말풍선, 효과음, 다른 캐릭터를 섞어서 보지 않게 한다.
- 여러 캐릭터가 있는 이미지에서도 대상 캐릭터를 자동 선택할 수 있게 한다.

Failure handling:

- instance가 여러 개면 ranking rule로 자동 선택한다.
- instance가 하나도 없으면 사용자가 bbox를 직접 그려 fallback crop을 만든다.
- 자동 선택 결과가 명백히 틀리면 correction UI에서 crop/bbox를 고칠 수 있게 한다.
- bbox가 너무 작거나 잘린 캐릭터면 "partial body" 플래그를 붙인다.

Selection ranking:

```text
score =
  confidence * 0.45
  + normalized_area * 0.30
  + center_bias * 0.15
  + full_body_likelihood * 0.10
```

MVP에서는 후보 선택 화면을 별도로 만들지 않는다. 자동 선택된 character crop을 바로 다음 단계로 넘기고, 실패했을 때만 보정 UI에서 crop을 수정한다.

### 2. Character Crop Per Instance

Input:

- character bbox/mask
- 원본 이미지

Process:

- bbox 주변에 안전 margin을 추가한다.
- 긴 변 기준 1024 또는 1280 해상도로 normalize한다.
- crop 좌표계를 원본 이미지 좌표계로 되돌릴 affine transform을 저장한다.

Output:

```json
{
  "cropId": "char_01",
  "sourceRect": { "x": 120, "y": 40, "w": 680, "h": 980 },
  "scale": 0.78,
  "offset": { "x": 120, "y": 40 },
  "imagePath": "workspace/jobs/job_001/crops/char_01.png"
}
```

### 3. DWPose Estimation

Input:

- character crop image

Output:

- body keypoints
- face/hand keypoints when available
- per-keypoint confidence
- skeleton-level quality score

Required keypoints for rigging:

```text
head / face center
neck
left_shoulder / right_shoulder
left_elbow / right_elbow
left_wrist / right_wrist
left_hip / right_hip
left_knee / right_knee
left_ankle / right_ankle
```

Derived keypoints:

```text
chest = midpoint(shoulders, neck-adjusted)
pelvis = midpoint(hips)
torso_axis = neck -> pelvis
left_upper_arm_axis = left_shoulder -> left_elbow
left_forearm_axis = left_elbow -> left_wrist
left_thigh_axis = left_hip -> left_knee
left_shin_axis = left_knee -> left_ankle
```

Quality flags:

- missing arm
- missing leg
- low-confidence head
- crossed limbs
- partial body crop
- multi-person contamination

### 4. See-through Layer Decomposition

Input:

- character crop image

Output:

- transparent layer PNGs or PSD layers
- semantic tags
- depth/layer order
- intermediate masks

Expected semantic groups:

```text
hair: front hair, back hair
head: face, eyes, eyebrows, irides, mouth, neck
torso: topwear, neck, accessories
lower body: bottomwear, legwear, footwear
arms/hands: handwear or related clothing/accessory layers
props/accessories: optional
```

Important integration choice:

- Prefer PNG + JSON output for the app pipeline.
- PSD can remain an interchange/export artifact, but the Canvas app should not depend on client-side PSD parsing for MVP.

### 5. Pose + Layer Reconciliation

This stage is mostly rule-based, but it is not image-specific hardcoding. It applies generic algorithms to model outputs.

Input:

- DWPose keypoints
- See-through layer masks/tags/order
- character foreground mask

Output:

- canonical rig part candidates

Canonical target parts:

```text
head
hair_front
hair_back
face
eye_left
eye_right
mouth
torso
pelvis
upper_arm_left
forearm_left
hand_left
upper_arm_right
forearm_right
hand_right
thigh_left
shin_left
foot_left
thigh_right
shin_right
foot_right
prop_*
```

Rules:

- Face/eyes/mouth/hair layers near head keypoints become head hierarchy children.
- Neck/topwear layers overlapping neck/shoulder/hip region become torso.
- Bottomwear around hip region becomes pelvis or lower torso.
- Limb-like masks are split by nearest skeleton segment.
- If one arm layer covers shoulder-to-wrist, split into upper arm and forearm using the elbow.
- If one leg layer covers hip-to-ankle, split into thigh and shin using the knee.
- Footwear near ankle/foot keypoints becomes foot.

Arm split method:

```text
For each alpha pixel in candidate limb mask:
  distance_to_upper = distance(pixel, segment(shoulder, elbow))
  distance_to_lower = distance(pixel, segment(elbow, wrist))
  assign to upper_arm if distance_to_upper < distance_to_lower
  assign to forearm otherwise
Then smooth boundary and remove small islands.
```

Leg split method:

```text
For each alpha pixel in candidate leg mask:
  distance_to_thigh = distance(pixel, segment(hip, knee))
  distance_to_shin = distance(pixel, segment(knee, ankle))
  assign by nearest segment.
```

Left/right resolution:

- Prefer DWPose left/right labels.
- If drawing is mirrored or crossed, compare limb segment position relative to torso axis.
- If confidence is low, mark for VLM audit and UI correction.

### 6. SAM Mask Refinement

Input:

- weak part candidate masks
- DWPose keypoints
- layer masks

When to run:

- mask boundary is too coarse
- mask has large holes
- limb split produced disconnected islands
- candidate overlaps too much with torso/head
- VLM or rule audit flags likely mislabeling

Prompt generation:

```text
positive points: skeleton segment interior points
negative points: nearby torso/background/other limb points
bbox: candidate mask bbox expanded by margin
prior mask: current candidate mask when supported
```

Output:

- refined mask
- refinement confidence
- before/after diagnostics

Adoption rule:

- Accept refined mask only if it improves area sanity, overlap sanity, and skeleton coverage.
- Otherwise keep original mask and mark for correction.

### 7. VLM Semantic Audit

Input:

- crop image
- overlaid candidate masks
- part labels
- DWPose skeleton visualization

Output:

- audit warnings
- label suggestions
- missing part suggestions
- left/right or duplicate warnings

Example checks:

```text
Is this mask likely the left forearm?
Are both legs present?
Is the mouth layer actually a mouth or a shadow?
Is this hair mask including background?
Are left/right arms swapped?
```

Policy:

- VLM output can trigger retries or UI warnings.
- VLM output should not directly overwrite geometry without deterministic validation.

### 8. Geometry Postprocess

Input:

- final part masks
- DWPose keypoints
- See-through depth/order
- source/crop coordinate transform

Output:

- Canvas rig data

Processing:

- alpha mask to bbox
- alpha mask to contour polygon
- polygon simplification
- small island removal
- hole filling where needed
- transparent PNG crop generation
- pivot/joint calculation
- parent hierarchy calculation
- z-index calculation
- confidence/diagnostic metadata

Pivot/joint rules:

```text
torso:
  pivot = pelvis or torso bbox lower center
  joint = neck/chest
  parent = null

head:
  pivot = neck
  joint = head center
  parent = torso

upper_arm_left:
  pivot = left_shoulder
  joint = left_elbow
  parent = torso

forearm_left:
  pivot = left_elbow
  joint = left_wrist
  parent = upper_arm_left

thigh_left:
  pivot = left_hip
  joint = left_knee
  parent = pelvis or torso

shin_left:
  pivot = left_knee
  joint = left_ankle
  parent = thigh_left

eyes/mouth:
  pivot = local center or face anchor
  parent = head
```

Z-index rules:

- Start with See-through layer order/depth.
- Keep face details above face/head.
- Keep front hair above face and back hair behind head.
- Use depth/order for crossing arms and legs.
- If uncertain, expose z-index correction in UI.

### 9. Canvas Rig Data

Output should be close to the current `state.parts` model so the existing renderer can ingest it.

Proposed JSON:

```json
{
  "version": 3,
  "sourceImage": "character.png",
  "ai": {
    "pipelineVersion": "ai-rig-v1",
    "models": {
      "characterSegmentation": "sam3-or-grounded-sam",
      "pose": "dwpose",
      "layerDecomposition": "see-through"
    }
  },
  "characters": [
    {
      "id": "char_01",
      "sourceRect": { "x": 120, "y": 40, "w": 680, "h": 980 },
      "parts": [
        {
          "id": "part_upper_arm_left",
          "name": "upper_arm_left",
          "type": "arm",
          "subtype": "upper_arm",
          "side": "left",
          "image": "parts/upper_arm_left.png",
          "mask": "masks/upper_arm_left.json",
          "rect": { "x": 240, "y": 300, "w": 90, "h": 180 },
          "pivot": { "x": 18, "y": 20 },
          "joint": { "x": 62, "y": 152 },
          "parentId": "part_torso",
          "order": 12,
          "alpha": 1,
          "confidence": 0.76,
          "diagnostics": ["elbow_low_confidence"]
        }
      ]
    }
  ]
}
```

Compatibility:

- Existing app can map this into `state.parts`.
- `subtype`, `side`, `confidence`, `diagnostics`, and `ai` metadata are optional extension fields.
- Existing manual rig JSON should still load.

## Backend Architecture

### Services

```text
animotion-web
  static Canvas editor
  uploads image
  polls job status
  imports generated rig

ai-rig-server
  FastAPI or similar
  stores job workspace
  orchestrates model calls
  emits PNG/mask/JSON artifacts

gpu-worker
  executes SAM/DWPose/See-through jobs
  one job at a time for MVP
  unloads models when needed
```

### Job API

```text
POST /api/rig-jobs
  multipart image
  options: characterMode, maxResolution, targetCharacter
  returns: jobId

GET /api/rig-jobs/:jobId
  returns: status, progress, warnings

GET /api/rig-jobs/:jobId/result
  returns: manifest JSON + artifact URLs

POST /api/rig-jobs/:jobId/feedback
  stores user corrections for dataset/evaluation
```

### Job Workspace

```text
workspace/jobs/job_001/
  input/character.png
  characters/char_01/crop.png
  characters/char_01/pose.json
  characters/char_01/see_through/
  characters/char_01/parts/*.png
  characters/char_01/masks/*.json
  result/rig.json
  result/preview.png
  diagnostics/*.png
```

## GPU Strategy

The GPU bottleneck is See-through.

Confirmed development target:

```text
Vessl RTX 3090
24GB VRAM
64GB system RAM
NVMe-backed workspace preferred
CUDA-compatible Linux environment
```

Minimum experimental target:

```text
12GB VRAM with See-through group_offload
or 8GB VRAM with See-through NF4/blockswap mode
```

Operational policy:

- Normalize images to 1024 or 1280 for MVP.
- Run SAM/DWPose/See-through sequentially, not concurrently.
- Do not keep every model resident in VRAM at first unless measurement proves RTX 3090 headroom is enough.
- Cache model weights on disk.
- Store final artifacts as PNG/JSON so the web app remains lightweight.
- Prefer See-through full/bf16 path first on RTX 3090. Keep NF4/group_offload as fallback if large images or combined model residency causes OOM.

## MVP Phases

### Phase 0: Offline Spike

Goal:

- Prove that DWPose + See-through outputs can become current `state.parts` data.

Tasks:

- Run See-through on 10-20 representative original/licensed character images or cleared dummy samples.
- Run DWPose on the same character crops.
- Write a local converter script from generated layers + pose JSON to Animotion rig JSON.
- Manually inspect generated PNGs, pivots, hierarchy, z-index.

Exit criteria:

- At least 5 samples produce editable Canvas parts without manual cropping.
- Head/torso/basic limbs load into current renderer.
- Failure cases are documented.

### Phase 1: Backend Job Prototype

Goal:

- One uploaded image returns a generated rig manifest.

Tasks:

- Create `ai-rig-server`.
- Add job workspace layout.
- Add DWPose runner.
- Add See-through runner.
- Add deterministic geometry postprocess.
- Return `rig.json` + PNG artifacts.

Exit criteria:

- A single character crop can produce rig data through API.
- Canvas app can import the result.
- Server records diagnostics and warnings.

### Phase 2: Character Instance Front-End

Goal:

- User-uploaded original/licensed character image can be processed without a character candidate selection step.

Tasks:

- Add character instance segmentation.
- Add automatic target character ranking.
- Show the selected crop as part of the generated result/correction view.
- Preserve fallback manual bbox selection.

Exit criteria:

- Multi-character image does not blindly mix characters in common cases.
- User can correct a wrong target crop after generation or through fallback bbox flow.

### Phase 3: Correction UI Integration

Goal:

- AI output is editable, not final.

Tasks:

- Show AI confidence/warnings in parts list.
- Highlight low-confidence joints and masks.
- Allow mask edit, pivot drag, parent edit, z-index edit.
- Save corrections as feedback JSON.

Exit criteria:

- User can fix common AI mistakes without restarting pipeline.
- Corrections can be used as future evaluation data.

### Phase 4: Rig Quality Upgrade

Goal:

- Better limbs and motion readiness.

Tasks:

- Add SAM refinement for weak masks.
- Add VLM semantic audit.
- Improve limb split/merge heuristics.
- Add per-character template memory.
- Add batch evaluation set.

Exit criteria:

- Limb segmentation quality improves over See-through-only baseline.
- Fewer manual edits are needed on representative panels.

## Evaluation Plan

### Metrics

Automatic:

- character detection success rate
- DWPose keypoint coverage
- number of generated canonical parts
- mask area sanity checks
- skeleton coverage per limb
- part overlap rate
- parent hierarchy validity
- z-index conflict count

Human:

- time to usable rig
- number of manual corrections
- subjective mask quality
- subjective motion readiness
- whether user would accept generated rig as starting point

### Test Set

Create a private evaluation folder with only original, licensed, commercially usable, or dummy samples:

- single full-body character
- half-body character
- multiple characters
- heavy speed lines/effects
- speech bubbles
- crossed arms/legs
- occluded limbs
- black-and-white manga-style original/dummy sample
- color webtoon-style original/dummy sample
- chibi/exaggerated proportions

## Open Decisions

The following items record resolved decisions and remaining engineering decisions.

1. Deployment target - resolved

Decision:

- Use Vessl RTX 3090 as the prototype GPU environment.
- Treat the AI pipeline as a backend job service, not browser-side inference.
- Optimize for one job at a time first.

2. Character selection UX - resolved

Decision:

- User uploads the desired image.
- The system automatically chooses the target character instance.
- Do not add a candidate selection screen for MVP.
- Provide fallback/correction only when the automatic crop is wrong.

3. Output schema version - resolved

Decision:

- Introduce `version: 3`.
- Keep `version: 2` importer backward compatible.
- Store AI metadata, character-level crop data, confidence, and diagnostics as optional extension fields.

4. See-through artifact format - resolved

Decision:

- The app consumes PNG + JSON.
- PSD can be stored as a debug/export artifact, but it is not the primary integration format.

5. VLM provider - unresolved

Options:

- OpenAI
- Claude
- Gemini
- no VLM in MVP

Recommendation:

- Keep VLM out of Phase 0/1. Add in Phase 4 after deterministic baseline exists.

6. SAM generation - unresolved

Options:

- SAM3 primary from the start
- Grounding DINO + SAM2 first, SAM3 later
- use See-through/SAM2 only until SAM3 integration is stable

Recommendation:

- If SAM3 setup is stable in our environment, use it. Otherwise start with Grounding DINO + SAM2/SAM3 fallback wrapper.

## Immediate Next Steps

1. Build an offline spike outside the browser.
2. Prepare 10-20 representative test images.
3. Run DWPose and See-through independently.
4. Define the first canonical part schema.
5. Write a converter to current Animotion `state.parts` shape.
6. Import one generated rig into the Canvas app.
7. Measure where the automatic pipeline fails before adding VLM or complex refinement.

## References

- See-through: https://github.com/shitagaki-lab/see-through
- DWPose: https://github.com/IDEA-Research/DWPose
- SAM3: https://github.com/facebookresearch/sam3
- Grounding DINO: https://github.com/IDEA-Research/GroundingDINO
- Sapiens: https://github.com/facebookresearch/sapiens
