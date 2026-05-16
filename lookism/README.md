# Lookism Cutscene Prototype

이 폴더는 1.0초짜리 발차기 컷신을 HTML Canvas로 합성하는 정적 웹 프로토타입이다.
영상 파일을 재생하는 구조가 아니라, 원본 이미지 컷아웃과 신체 파츠 리그를 매 프레임 다시 그려서 컷신처럼 보이게 만든다.

## 실행 방법

상위 폴더에서 실행할 때는 이 폴더로 들어와 정적 서버를 띄운다.

```powershell
cd lookism
python -m http.server 8000
```

브라우저에서 `http://localhost:8000/index.html`을 연다.

`index.html`을 파일로 직접 열면 ES module과 `fetch("parts/manifest.json")` 로딩이 브라우저 보안 정책에 막힐 수 있으므로, 정적 서버 실행을 기준으로 본다.

## 핵심 원리

전체 흐름은 `index.html -> app.mjs -> src/* -> parts/*` 순서로 이어진다.

1. `index.html`은 Canvas 무대와 Play/Reset UI만 만든다.
2. `app.mjs`가 이미지를 로딩하고, 시간값을 계산하고, 매 프레임 Canvas를 다시 그린다.
3. `src/action-data.mjs`에는 0.5초 액션의 키 포즈가 들어 있다.
4. `src/action.mjs`는 현재 시간에 맞춰 앞뒤 키 포즈를 보간한다.
5. `src/rig-renderer.mjs`는 `parts` 폴더의 신체 파츠 이미지를 관절 좌표에 맞춰 회전/배치한다.
6. `src/canvas.mjs`는 배경, 속도선, 궤적, 패널 테두리 같은 연출 레이어를 그린다.

즉, 컷신은 다음 레이어를 시간에 따라 합성해서 만들어진다.

```text
종이 배경
-> 속도선 / 잉크 입자 / 이동 궤적
-> standing.png에서 잘라낸 준비 자세
-> parts/*.png 파츠 리그로 만든 중간 발차기 동작
-> 제목 없음.png에서 잘라낸 임팩트 자세
-> 순간 암전 / 손날베기 / 화면 절단 reveal
-> post_parts/*.png 파츠 리그로 만든 고개숙임 회피 동작
-> endmotion.png에서 잘라낸 후속 컷 자세
-> 화면 흔들림 / 플래시 / 패널 테두리
```

## 시간 구조

`src/action-data.mjs`의 `STRIKE_DURATION`은 `0.5`초이고, `FOLLOW_THROUGH_DURATION`도 `0.5`초다.
`ACTION.beats`에는 첫 0.5초 발차기 비트가 들어 있다.
`POST_ACTION.beats`에는 0.5초 이후의 옆 회피에서 뒤젖힘 회피까지의 비트가 들어 있다.

```text
0.00 stance
0.10 compress
0.22 takeoff
0.34 chamber
0.43 extend
0.50 impact
0.54 blackout
0.68 blade enter
0.78 screen cut
0.88 duck under
1.00 end motion
```

각 비트는 `hip`, `chest`, `head`, `shoulder`, `elbow`, `hand`, `knee`, `foot` 같은 관절 좌표를 가진다.
`sampleAction()`은 현재 시간이 어느 두 비트 사이에 있는지 찾고, `smoothstep`으로 좌표를 부드럽게 보간한다.

## 리그 구조

`parts/manifest.json`은 파츠 이미지의 정보다.
각 파츠는 다음 정보를 가진다.

- `name`: 파츠 이름
- `file`: 실제 PNG 파일 경로
- `bounds`: 원본 이미지에서 잘라낸 영역
- `pivot`: 회전과 배치 기준점

`src/action-data.mjs`의 `RIG_LINKS`는 파츠와 관절을 연결한다.
예를 들어 정강이 파츠는 무릎에서 발 방향을 보고 회전하고, 팔 파츠는 어깨에서 팔꿈치 방향을 보고 회전한다.

`drawRigLayer()`는 각 파츠에 대해 다음 순서로 그린다.

```text
관절 위치로 이동
-> 현재 포즈의 관절 방향만큼 회전
-> 파츠의 pivot이 관절 위치에 오도록 이미지 그리기
```

그래서 원본 이미지를 통째로 왜곡하지 않고, 잘라낸 신체 부위를 관절 애니메이션처럼 재배치한다.

## 주요 파일

- `index.html`: Canvas와 컨트롤 UI
- `styles.css`: 화면 레이아웃과 패널 스타일
- `app.mjs`: 앱 부팅, 재생 루프, 전체 렌더 순서
- `src/action-data.mjs`: 컷신 길이, 키 포즈, 파츠 연결 정보
- `src/post-action-data.mjs`: 0.5초 이후 공격자/회피자 후속 리그 키 포즈
- `src/action.mjs`: 시간 기반 포즈 보간
- `src/assets.mjs`: 이미지/JSON 로딩, 흰 배경 투명화 컷아웃
- `src/canvas.mjs`: 배경과 효과 레이어 드로잉
- `src/cutscene-values.mjs`: 컷신 시간값, 페이드, 플래시, 라벨 계산
- `src/slash-renderer.mjs`: 암전, 손날베기, slash reveal 렌더링
- `src/rig-renderer.mjs`: 파츠 리그 렌더링
- `test/cutscene-values.test.mjs`: 컷신 타이밍과 효과음 잉크 제거 판정 테스트
- `parts/manifest.json`: 파츠 메타데이터
- `parts/*.png`: 몸통, 머리, 팔, 다리 파츠 이미지
- `post_parts/*.png`: 0.5초 이후 공격자/회피자 파츠 이미지
- `scripts/generate-post-parts.ps1`: `endmotion.png`에서 후속 리그 파츠를 다시 생성하는 스크립트
- `standing.png`: 시작 자세 소스 이미지
- `제목 없음.png`: 임팩트 자세 소스 이미지
- `endmotion.png`: 후속 컷 소스 이미지

## 수정 포인트

- 동작 타이밍 변경: `src/action-data.mjs`의 `ACTION.beats[].at`
- 자세 변경: `ACTION.beats[].pose`의 관절 좌표
- 파츠 연결 변경: `RIG_LINKS`
- 0.5초 이후 파츠 연결 변경: `src/post-action-data.mjs`의 `POST_RIG_LINKS`
- 파츠 그리는 앞뒤 순서 변경: `CUTSCENE_RIG_DRAW_ORDER`
- 화면 효과 변경: `src/cutscene-values.mjs`와 `src/canvas.mjs`
- 시작/임팩트 이미지 크롭 변경: `CUTSCENE_ASSETS`

## 구현 가정

- `제목 없음.png`와 `endmotion.png`의 효과음 글자는 컷아웃 내부의 매우 어두운 잉크 픽셀로 취급한다.
- 원본 PNG는 수정하지 않고, 런타임 컷아웃 생성 단계에서만 글자 영역을 투명화한다.
- 후속 컷은 `post_parts`의 별도 신체 파츠 리그를 거쳐 `endmotion.png` 컷아웃으로 정착한다.
- 0.5초 이후 회피자는 피격된 것이 아니라 옆 회피 이후 손날 공격을 고개를 숙여 피한다.
- 공격자의 손날베기는 단순 전환 효과가 아니라 다음 컷을 찢어내는 공격 동작으로 리깅한다.
- 0.1초 안팎의 암전은 전환을 숨기는 장치가 아니라 손날베기가 들어오기 전의 호흡 정지로 사용한다.
