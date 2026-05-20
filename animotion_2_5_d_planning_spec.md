# Animotion 2D/2.5D Character Rigging Animation Tool 기획안

## 0. 문서 목적

이 문서는 Codex가 Animotion을 구현할 때 기준으로 삼을 제품/개발 지시문이다. 앞으로 문제 정의가 더 구체화되면 이 문서는 유연하게 수정한다.

## 0.1 Planning Document Policy

이 기획안은 최종 확정 문서가 아니라 기능 개발 과정에서 계속 갱신되는 living document다.

핵심 방향은 유지한다.

- 오리지널 IP 중심
- 창작자 제어 우선
- 리깅 기반 2D/2.5D 애니메이션 제작
- AI는 대체가 아니라 보조
- 상업적으로 안전한 워크플로우

하지만 세부 기능과 구현 방식은 고정하지 않는다.

- A/B컷 대응은 필요하면 축소하거나 레퍼런스/포즈 보조 기능으로 재해석한다.
- hidden completion 방식은 mesh, guide, inpainting, manual patch 등으로 바뀔 수 있다.
- `motionDraft` 구조는 실제 구현 안정성에 따라 수정될 수 있다.
- UI 용어는 사용자가 더 잘 이해하는 방향으로 바꿀 수 있다.
- MVP 범위는 개발 과정에서 더 작게 잘라낼 수 있다.

기획안은 다음 사실이 더 명확해질 때 갱신한다: 실제 사용자가 막히는 지점, MVP 필수 기능과 후순위 기능, 리깅/모션/2.5D/AI 보완 사이의 기술적 타협점, 구현 난이도 대비 제품 가치, 법적/IP 리스크, 기존 코드 구조와의 충돌, UI 용어와 사용자 이해도, 테스트 과정에서 드러난 병목.

구현 중 발견된 반복 버그는 설계 문제일 수 있고, 사용자가 헷갈리는 지점은 UI/용어 문제일 수 있다. 테스트가 어렵다면 데이터 구조나 command 구조가 불명확한 것일 수 있다. 특정 자동화가 품질을 떨어뜨리면 수동 제어 중심으로 되돌린다.

기능 추가 전에는 항상 다음을 묻는다.

1. 이 기능은 현재 문제정의와 맞는가?
2. MVP에 꼭 필요한가?
3. 사용자가 직접 수정할 수 있는가?
4. 법적/IP 리스크를 키우지 않는가?
5. 구현 복잡도 대비 가치가 충분한가?
6. 나중에 바뀌어도 데이터가 깨지지 않는가?

결론적으로 이 문서는 제품 방향을 잡기 위한 기준점이지, 세부 구현을 강제로 고정하는 문서가 아니다. 새로운 구현 결과, 테스트 결과, 사용자 경험, 법적 판단, 기술적 한계가 드러나면 문서를 업데이트하고 그에 맞춰 개발 방향을 조정한다.

## 1. 핵심 문제정의

기존 2D 리깅툴은 반복 모션, 게임 캐릭터, 정면/측면 중심 움직임, UI/버튜버/모바일 컷신에는 강하다. 하지만 일본식/웹툰식 2D 애니메이션은 단순 관절 보간보다 컷마다 새롭게 설계되는 표현적 그림이 중요하다.

중요 요소는 컷마다 달라지는 실루엣, 과장된 원근, 스미어/잔상/충격 프레임, 손/머리카락/옷주름의 프레임별 변화, 포즈에 따라 새로 그린 듯한 얼굴/몸 변형, 단순 관절 보간이 아닌 작화적 재해석이다.

핵심 문제:

> 기존 2D 리깅툴은 반복 모션에는 강하지만, 일본식/웹툰식 2D 애니메이션에서 필요한 컷별 변형, 숨은 부위 보완, 실루엣 수정, 손그림 같은 작화 자유도를 충분히 지원하지 못한다.

## 2. 새 제품 방향

Animotion은 더 이상 기존 웹툰 컷 A/B를 그대로 맞춰 애니메이션화하는 도구를 메인 목표로 삼지 않는다. 그 방향은 저작권/IP 리스크가 크고 상업적으로 사용하기 어렵다.

새 방향:

> 오리지널 캐릭터 또는 정식 권리를 확보한 캐릭터를 파츠 단위로 리깅하고, 창작자가 Blender/Spine처럼 직접 모션을 조정할 수 있으며, 필요할 때 AI가 숨은 부위 보완과 작화 보조를 해주는 2D/2.5D 애니메이션 제작 툴.

핵심은 자동화가 아니라 창작자 제어 가능성이다. AI는 메인 엔진이 아니라 보조 기능이다.

## 3. 제품 정체성

한 문장 정의:

> 오리지널 2D 캐릭터를 파츠 기반으로 리깅하고, 창작자가 직접 키포즈와 이동 경로를 조정하며, AI가 숨은 부위와 작화 보정을 보조하는 2D/2.5D 애니메이션 제작 툴.

장기 목표:

> 오리지널 IP 제작자가 빠르게 애니메이션을 만들 수 있게 하고, 이후 정식 라이선스를 확보한 유명 웹툰/IP를 애니메이션화할 수 있는 제작 파이프라인으로 확장한다.

중요 원칙: 남의 웹툰 컷을 무단으로 애니메이션화하는 툴이 아니며, 오리지널 IP 또는 허가받은 IP를 위한 제작 도구다. 웹툰 컷 A/B 대응 기능은 메인이 아니라 선택적 레퍼런스/포즈 보조 기능이다.

## 4. 기존 기능의 새 의미

| 기존 기능 | 새 기획에서의 의미 |
| --- | --- |
| `part` / image part | 오리지널 캐릭터의 레이어/파츠 |
| `rect` | 파츠의 기본 이미지 영역 |
| `pivot` | 파츠 회전 중심 |
| `joint` | 다른 파츠와 연결되는 관절점 |
| `parentId` / `parentPartId` | 몸통-머리-팔-다리 계층 구조 |
| rig connection | 캐릭터 스켈레톤 구조 |
| `motionDraft` | 모션/포즈 편집 초안 |
| trajectory | 캐릭터 또는 파츠의 이동 경로 |
| keyframe | 사용자가 직접 조정한 시간별 상태 |
| `hiddenCompletionPatch` | 회전/변형 시 드러나는 숨은 부위 보완 에셋 |
| 2.5D draft | 2D 파츠에 깊이감/회전감을 주기 위한 편집 상태 |
| A/B cut matching | 메인 기능이 아닌 선택적 레퍼런스/포즈 보조 기능 |
| scripted cut generator | 권리 안전한 원화 컷 fixture와 motion-ready metadata를 만드는 dev/demo 보조 기능 |

## 4.1 Scripted Genga Cut Generator

Animotion은 단순 자동 리깅 툴도 아니고 순수 AI 애니메이션 생성기도 아니다. 입력 이미지를 움직일 수 있는 `motion-ready structure`로 바꾸고, 리깅 기반 모션과 애니메이터식 자유 표현이 함께 존재하는 제작 경험을 제공해야 한다.

이를 검증하려면 권리 문제가 없는 오리지널 2D 애니메이션 원화 컷 fixture가 필요하다. `scripted cut generator`는 이를 위한 최소 기반이다.

원칙:

- professional drawing app 또는 범용 그림툴이 아니다.
- 브러시 엔진, Clip Studio/Photoshop 대체 기능, AI 이미지 생성 기능을 만들지 않는다.
- 목적은 rights-safe original 2D anime/genga-style source cuts를 생성하는 것이다.
- 생성 결과는 단순 이미지가 아니라 리깅/모션/hidden completion 테스트에 바로 투입 가능한 구조여야 한다.
- 출력은 `original cut preview`, logical parts/layers, part rects, pivot/joint candidates, parent-child links, z-order, optional hidden completion guide candidate를 포함한다.
- 고퀄 일러스트보다 deterministic fixture와 구조화된 metadata를 우선한다.

이 기능은 제품의 메인 제작 UX가 아니라 개발/데모/테스트용 entrypoint다. 다만 사용자가 원화 컷을 넣었을 때 기대해야 할 motion-ready 구조를 명확히 보여주는 기준 fixture 역할을 한다.

## 5. 비목표

하지 말아야 할 것: 무단 웹툰 컷을 입력받아 그대로 애니메이션화, 원본 컷의 구도/포즈/실루엣 복원, 유명 IP 무단 데모, 원작 그림체/캐릭터 무단 재현, "자동으로 일본 애니를 완성한다"는 식의 과장된 자동화.

지금 하지 않아도 되는 것: 완전 자동 리깅/동화 생성, 극장판급 액션 작화 자동 생성, 복잡한 3D 캐릭터 시스템, Blender/Spine 전체 기능 재구현.

## 6. MVP 목표

1차 구현목표:

> 2D 기본 인체 캐릭터를 입력받아 전신 펀치/킥 액션을 리깅 기반으로 만들고, 타격 순간에는 스미어·메쉬변형·드로우오버 같은 만화적 표현을 추가할 수 있게 한다. 또한 클로즈업 펀치 컷에서는 얼굴·상체·주먹을 디테일하게 제어해, 가까이 보여도 일본 2D 애니식 액션 표현이 가능하도록 한다. 그리고 리깅 모션과 만화적 표현을 자유자재로 구사할 수 있어야 한다.

1차 전제: 입력 캐릭터는 오리지널, 정식 라이선스, 또는 상업적으로 사용 가능한 기본 인체형 2D 캐릭터로 제한한다. 자동 완성보다 창작자가 직접 수정할 수 있는 리깅, 키포즈, 작화 보조 레이어를 우선한다.

MVP 핵심 기능: 파츠 선택, 이동/회전/스케일, pivot/joint 편집, parent-child 연결, 전신 펀치/킥용 키포즈와 이동 경로 편집, 타격 프레임용 스미어/메쉬 변형/드로우오버 레이어, 클로즈업 펀치 컷용 얼굴/상체/주먹 세부 제어, preview 재생, 숨은 부위 보완용 guide/patch asset 편집, 저장/불러오기 round-trip 안정성, undo/redo 가능한 command 구조.

AI 기능은 MVP의 필수 핵심이 아니라 후속 보조 기능이다.

## 7. AI 기능의 위치

AI는 창작자를 대체하지 않는다. AI는 창작자가 직접 제어하는 리깅/모션 시스템 위에서 보조 역할을 한다.

AI가 맡을 수 있는 역할: hidden completion patch 생성, 보이지 않는 옆면/뒷면 텍스처 보완, 중간 포즈 후보 제안, 리깅 포인트 자동 추천, 간단한 모션 프리셋 추천, 깨진 실루엣 보정안 제안.

항상 지켜야 할 원칙:

> AI-generated result는 항상 editable asset이어야 한다.

AI가 만든 patch, mesh, guide, texture는 사용자가 수정할 수 있어야 한다.

## 8. 개발 원칙

### 8.1 창작자 제어 우선

나쁜 방향:

```text
AI가 자동 생성하고 사용자는 결과만 받는다.
```

좋은 방향:

```text
AI가 초안을 만들고, 사용자가 mesh/guide/keyframe으로 수정한다.
```

### 8.2 리깅은 편집 보조 구조

2D 작화에서는 관절점이 파츠 `rect` 밖으로 나갈 수 있다.

중요 원칙:

```text
part-local coordinate는 rect 밖 좌표를 허용해야 한다.
normalized coordinate도 0..1 밖 값을 보존해야 한다.
```

이유: 어깨 관절과 회전 중심이 이미지 밖에 있을 수 있고, 숨은 부위 보완 guide와 작화적 변형은 원래 이미지 경계를 넘어갈 수 있다.

### 8.3 저장 포맷 안정성

save -> load -> save round-trip에서 `part rect`, `pivot`, `joint`, `parent relation`, `trajectory points`, `motionDraft`, `hiddenCompletion assetId`, `hiddenCompletionPatch guide vertices`, `0..1` 밖 normalized coordinates, user-authored mesh/silhouette data는 손실되면 안 된다.

### 8.4 UI 용어와 코드 용어 정렬

| UI 용어 | 코드 후보 |
| --- | --- |
| 파츠 | `part` |
| 회전 중심 | `pivot` |
| 관절점 | `joint` |
| 부모 파츠 | `parentPart` |
| 이동 경로 | `trajectory` |
| 모션 초안 | `motionDraft` |
| 숨은 부위 보완 | `hiddenCompletion` |
| 보완 가이드 | `hiddenCompletionGuide` |
| 보완 패치 | `hiddenCompletionPatch` |
| 키포즈 | `keyPose` / `keyframe` |
| 컷신 미리보기 | `cutscenePreview` |

## 9. 아키텍처 방향

Source of truth:

```text
project.parts
project.assets
project.motionPlans
project.motionDrafts
```

UI preview는 canonical data를 임시로 보여주는 layer다.

주요 mutation은 command 계층을 통해 처리한다.

```text
movePart
rotatePart
setPivot
setJoint
setParentPart
addKeyframe
updateKeyframe
moveTrajectoryPoint
createHiddenCompletionPatch
updateHiddenCompletionGuideVertex
```

Preview 구조:

```text
project data
  -> evaluator
  -> preview transform
  -> render
```

Motion evaluation은 `local transform`, `parent transform`, `character root motion`, `trajectory motion`, `evaluated world transform`을 분리한다.

## 10. 기술적 차별점

Animotion은 단순 Spine clone이 아니다.

> 리깅의 효율성과 손그림 작화의 유연성을 동시에 지원하는 2D/2.5D 애니메이션 툴.

특히 중요한 기능:

1. 파츠 rect 밖 pivot/joint 허용
2. 숨은 부위 보완 patch asset
3. 작화적 실루엣 수정용 guide mesh
4. 키포즈 기반 수동 수정
5. 자동 보간 후 수동 override
6. parent-child 계층 구조
7. trajectory 기반 캐릭터 이동
8. AI-generated patch를 editable asset으로 저장
9. 오리지널/허가된 IP 중심 워크플로우

## 11. 법적/기획적 안전장치

안전한 입력: 사용자가 직접 그린 캐릭터, 사용자가 권리를 보유한 오리지널 IP, 정식 라이선스를 받은 캐릭터, 상업 사용 가능한 에셋, 테스트용 더미/샘플 에셋.

웹툰/애니 레퍼런스는 가능하더라도 다음을 금지한다.

```text
원본 컷 복제 X
원본 포즈 트레이싱 X
원본 실루엣 재현 X
원본 구도/연출/컷 순서 복원 X
```

허용 방향:

```text
동작 원리 참고
감정 흐름 참고
액션 문장화
사용자 오리지널 캐릭터로 재해석
```

## 12. 현재 개발 우선순위

1순위: 리깅/모션 편집 안정화. part 선택, pivot/joint 편집, parent-child transform, trajectory 편집 충돌, preview 재생 결과 일관성을 먼저 잡는다.

2순위: 데이터 구조 안정화. save/load round-trip, hiddenCompletionPatch asset 저장, motionDraft 저장 구조, command 기반 mutation, undo/redo 기반을 정리한다.

3순위: 창작자 UI 정리. UI 용어, 선택 파츠 inspector, 리깅 편집 패널, trajectory 편집 모드, hidden completion 진입점을 명확히 한다.

4순위: AI 보조 기능. hidden completion patch, side texture 후보, guide mesh 기반 inpainting, 생성 결과 editable asset화를 붙인다.

## 13. 개발 판단 기준

기능을 추가하거나 수정할 때는 다음 질문을 기준으로 판단한다.

1. 이 기능은 오리지널 캐릭터 제작에 도움이 되는가?
2. 사용자가 최종 결과를 직접 수정할 수 있는가?
3. 자동화가 창작자의 통제를 빼앗지 않는가?
4. save/load 후 데이터가 보존되는가?
5. preview와 canonical data가 분리되어 있는가?
6. 일본식 2D 작화의 유연성을 해치지 않는가?
7. 단순 Spine clone이 아니라 2D/2.5D 작화 보조 툴로서 차별점이 있는가?
8. 저작권/IP 리스크를 키우지 않는가?

## 14. 현재 개발 방향 결론

기존 웹툰 A/B컷 대응 기능은 완전히 버리지 않는다. 다만 메인 기획에서 내리고, 선택적 레퍼런스/포즈 보조 기능으로 둔다.

중심 방향:

```text
웹툰 컷 자동 변환 툴
↓
오리지널 IP용 2D/2.5D 캐릭터 애니메이션 제작 툴
↓
정식 라이선스 IP 애니메이션 제작 파이프라인
```

이 방향이 법적으로 더 안전하고, 제품 정체성이 명확하며, 장기적으로 유명 웹툰/IP 애니메이션화 목표에도 더 신빙성을 준다.
