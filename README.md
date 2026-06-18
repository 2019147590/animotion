# Animotion MVP

## JSON 모션 재생 안내

이미지를 먼저 업로드한 뒤 `.json` 프로젝트 파일을 불러오면, 그 JSON에 저장된 리깅/컷신/키프레임 정보가 현재 이미지 위에 복원됩니다. 이후 미리보기 영역에서 재생 버튼을 누르면 불러온 `.json`에 해당하는 모션이 그대로 재생됩니다.

Animotion은 원본 또는 사용 권한이 있는 2D 캐릭터 이미지를 파츠로 나누고, pivot/joint/parent 관계를 잡은 뒤 키포즈와 액션 모션을 편집하는 2D/2.5D 리깅 애니메이션 실험 도구입니다.

현재 저장소에는 복서 샘플 이미지와 미리 저장된 프로젝트 JSON이 포함되어 있어, 별도 제작 과정 없이 바로 후방 펀치 모션을 재생하고 편집해 볼 수 있습니다.

## 빠른 체험: 복서 모션 재생

준비 파일:

- `lookism/boxer.png`
- `animotion-project (8).json`
- `animotion-project (17).json`
- `animotion-project (17-1).json`

권장 순서:

1. 브라우저에서 `index.html`을 엽니다.
2. 왼쪽 패널의 `원화/캐릭터 컷 업로드`에서 `lookism/boxer.png`를 선택합니다.
3. 오른쪽 아래 프로젝트 영역의 `JSON 불러오기`에서 샘플 JSON 중 하나를 선택합니다.
4. 모션 패널의 템플릿이 자동으로 `액션 컷신` 상태가 되면, `재생` 버튼을 눌러 모션을 확인합니다.
5. `프레임` 슬라이더를 움직이면 각 키포즈를 정지 상태로 볼 수 있습니다.
6. 미리보기 캔버스에서 손, 팔, 몸통 파츠를 선택하면 현재 파츠의 pivot/joint/handTip과 키프레임 반응을 확인할 수 있습니다.

샘플 JSON 선택 기준:

- `animotion-project (8).json`: 초기 후방 펀치 리깅/모션 확인용입니다.
- `animotion-project (17).json`: 후방 손 펀치가 `rear-cross`로 분류된 18프레임 모션입니다.
- `animotion-project (17-1).json`: `17` 기반에 발/추가 파츠가 포함된 확장 샘플입니다.

참고: JSON 불러오기는 이미지가 먼저 업로드되어 있어야 동작합니다. 먼저 JSON을 선택해도 아무 변화가 없으면 `lookism/boxer.png`를 먼저 업로드한 뒤 다시 JSON을 불러오세요.

## 뒷손펀치_01 직접 생성

`뒷손펀치_01`은 `animotion-project (17).json`에 들어 있던 후방 손 펀치 성격을 별도 액션 템플릿으로 노출한 것입니다. UI에는 `뒷손펀치_01`로 보이고, 저장되는 내부 템플릿 ID는 `rearHandPunch01`입니다.

직접 생성 절차:

1. `lookism/boxer.png`를 업로드하고 샘플 JSON을 불러옵니다.
2. 파츠 목록 또는 미리보기에서 후방 팔 체인의 파츠를 선택합니다. 상완, 전완, 손 중 하나를 선택해도 됩니다.
3. 모션 패널의 `Action` 드롭다운에서 `뒷손펀치_01`을 선택합니다.
4. `Generate beats/path`를 누릅니다.
5. 앱이 선택한 팔 체인의 terminal hand를 타격 끝점으로 잡고, 18프레임 후방 손 펀치 모션을 다시 생성합니다.
6. `재생` 또는 프레임 슬라이더로 결과를 확인합니다.

기대 동작:

- `impact`는 15프레임 기준으로 잡힙니다.
- 후방 손은 전방 목표로 뻗고, 앞손 체인은 가드 쪽으로 접힙니다.
- 생성된 액션은 기존 `Punch`와 구분되는 `rearHandPunch01` 템플릿으로 저장됩니다.

## 주요 UI 흐름

- `원화/캐릭터 컷 업로드`: 작업할 기준 이미지를 올립니다.
- `JSON 불러오기`: 저장된 파츠, 리깅, 모션, 컷신 상태를 복원합니다.
- `JSON 저장`: 현재 상태를 Animotion 프로젝트 JSON으로 저장합니다.
- `Action`: `Punch`, `Kick`, `Boxing step`, `뒷손펀치_01` 같은 액션 초안을 선택합니다.
- `Generate beats/path`: 선택한 파츠와 액션 템플릿을 기준으로 키포즈와 경로를 생성합니다.
- `프레임`: 현재 프레임을 수동으로 확인합니다.
- `재생`: 현재 컷신 또는 키프레임 모션을 반복 재생합니다.
- `불러온 펀치 트랙 보정 적용`: 오래된 펀치 JSON을 현재 펀치 트랙 생성 로직으로 다시 맞춥니다.

## 직접 파츠를 만들 때

1. `원화/캐릭터 컷 업로드`로 이미지를 올립니다.
2. 선택 도구에서 사각형, 타원, 자유 올가미, 폴리곤 중 하나를 선택합니다.
3. 원본 캔버스에서 파츠 영역을 지정합니다.
4. 파츠 타입과 이름을 정하고 `선택 영역을 파츠로 추가`를 누릅니다.
5. 미리보기에서 pivot, joint, handTip을 조정합니다.
6. 필요한 경우 parent 관계와 humanRole을 지정합니다.
7. 액션 템플릿을 선택하고 `Generate beats/path`로 모션을 생성합니다.

## 검증

주요 회귀 테스트:

```powershell
node tests\action-specs.test.js
node tests\rear-cross-lead-hand-retract.test.js
node tests\rear-hand-punch-template.test.js
node tests\motion-planner-commands.test.js
```

전체 테스트를 돌릴 때:

```powershell
Get-ChildItem tests -Filter *.test.js | Sort-Object Name | ForEach-Object { node $_.FullName; if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE } }
```

## 개발 메모

- 최신 구현 상태와 다음 작업 맥락은 [HANDOFF.md](HANDOFF.md)에 정리합니다.
- 제품 방향과 기획 판단은 [animotion_2_5_d_planning_spec.md](animotion_2_5_d_planning_spec.md)에 정리합니다.
- AI 기반 파츠/리깅 보조 전략은 [AI_VISION_WORKFLOW_STRATEGY.md](AI_VISION_WORKFLOW_STRATEGY.md)에 정리합니다.

## 원칙

- 입력 이미지는 직접 제작했거나 사용 권한이 있는 원본/라이선스 이미지여야 합니다.
- A/B 컷 참조와 Lookism 스타일 프리셋은 메인 제품 방향이 아니라 리깅/모션/렌더링 검증용 프로토타입입니다.
- AI 결과물은 최종 산출물이 아니라 사용자가 편집할 수 있는 draft, guide, patch, texture로 취급합니다.
- pivot, joint, guide vertex 같은 좌표는 파츠 rect 밖 좌표와 normalized 값을 보존해야 합니다.
- scripted cut generator는 전문 드로잉 앱이 아니라 리깅/모션/hidden completion 테스트에 바로 쓰는 rights-safe fixture 생성기입니다.
