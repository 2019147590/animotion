# Animotion 2.5D Motion Comic Editor 기획안

## 0. 문서 목적

이 문서는 Codex가 현재 개발 중인 Animotion MVP를 이해하고, 앞으로 어떤 방향으로 기능을 구현해야 하는지 판단할 수 있도록 작성한 제품/기술 기획안이다.

Animotion은 단순한 이미지 편집기나 드로잉 툴이 아니라, **웹툰/일러스트 컷을 2D 애니메이션처럼 움직이게 만드는 2.5D 모션 코믹 제작툴**을 목표로 한다.

핵심 과제는 다음과 같다.

1. 정적인 2D 이미지에서 캐릭터 파츠를 분리한다.
2. 원본 컷에 가려져 있던 신체 부위와 배경을 보완한다.
3. 파츠를 단순 회전시키는 꼭두각시 인형극 느낌을 줄인다.
4. 필요한 경우 2.5D 볼륨 프록시 또는 3D 파츠 구조를 사용한다.
5. 격렬한 액션에서 발생하는 한계를 연출, 잔상, 이펙트, 카메라워크로 보완한다.
6. 사용자가 AI 결과물을 편집 가능한 레이어/파츠로 제어할 수 있게 한다.

---

## 1. 제품 정의

### 1.1 제품명

Animotion

### 1.2 한 줄 정의

**웹툰/일러스트 이미지를 파츠 분리, 숨은 부위 보완, 리깅, 2.5D 모션, 연출 효과를 통해 짧은 모션 코믹/애니메이션 컷으로 변환하는 제작툴.**

### 1.3 이 제품이 아닌 것

Animotion은 다음을 목표로 하지 않는다.

- Clip Studio Paint 같은 범용 드로잉 툴
- Blender 같은 풀 3D DCC 툴
- After Effects 같은 범용 영상 합성툴
- 단순 AI 영상 생성기
- 모든 프레임을 AI가 새로 생성하는 자동 영상 생성 서비스

### 1.4 이 제품이 목표로 하는 것

Animotion은 다음을 목표로 한다.

- 그림을 직접 잘 그리지 못하는 사용자도 이미지를 움직일 수 있게 한다.
- 웹툰 컷, 캐릭터 일러스트, 콘티 이미지를 짧은 애니메이션 컷으로 만든다.
- AI가 결과물을 대신 완성하는 것이 아니라, 사용자가 제어 가능한 제작툴을 제공한다.
- 2D 파츠 리깅, 2.5D 볼륨 프록시, 인페인팅, 연출 효과를 조합한다.
- 처음에는 저강도/중강도 모션을 안정적으로 구현하고, 고강도 액션은 실험적으로 접근한다.

---

## 2. 핵심 문제 정의

현재 단순한 2D 파츠 리깅 방식에는 한계가 있다.

이미지를 머리, 몸통, 팔, 다리 등으로 잘라서 피벗 기준으로 회전시키면 다음 문제가 발생한다.

- 캐릭터가 꼭두각시 인형극처럼 보인다.
- 관절 연결부가 어색하다.
- 팔이나 몸이 회전할 때 안 보이던 부분이 드러나면 빈 공간이 생긴다.
- 정면 이미지 하나만으로 옆면, 뒷면, 안쪽 면을 표현하기 어렵다.
- 격렬한 액션에서 입체감과 궤적이 부족하다.
- 프레임마다 AI가 새로 그리면 그림체와 형태가 흔들릴 수 있다.

따라서 Animotion은 단순 컷아웃 리깅을 넘어서 다음을 고려해야 한다.

1. 숨은 부위를 미리 보완한 완성 파츠 생성
2. 2D 메쉬 변형
3. 2.5D 볼륨 프록시
4. 관절부 보정
5. 카메라워크와 이펙트를 이용한 연출적 타협
6. 시간적 일관성을 유지하는 비파괴 편집 구조

---

## 3. 핵심 철학

### 3.1 AI는 매 프레임을 새로 그리는 도구가 아니다

초기 Animotion에서 AI는 모든 프레임을 새로 생성하는 역할을 맡지 않는다.

나쁜 접근:

```text
프레임 1 생성
프레임 2 생성
프레임 3 생성
...
```

이 방식은 프레임마다 선화, 색감, 얼굴, 의상 디테일이 흔들릴 가능성이 높다.

좋은 접근:

```text
원본 이미지
→ 파츠 분리
→ 숨은 부위 보완
→ 완성된 파츠 레이어 저장
→ 리깅/변형/2.5D 모션
→ 필요한 부분만 국소적 AI 보정
```

즉, AI는 **편집 가능한 파츠 자산을 보완하는 도구**로 사용한다.

### 3.2 제작툴은 사용자 제어 가능성이 핵심이다

사용자는 다음을 직접 제어할 수 있어야 한다.

- 파츠 영역
- 파츠 순서
- 피벗
- 관절
- 부모-자식 관계
- 숨은 부위 보완 결과
- 모션 강도
- 카메라워크
- 이펙트
- 내보내기 범위

AI가 자동으로 만든 결과도 사용자가 다시 수정할 수 있어야 한다.

### 3.3 완벽한 2D 애니메이션 자동화가 아니라, 제작 시간을 줄이는 것이 목표다

초기 목표는 다음이 아니다.

> 전문 애니메이터 수준의 완성 작화를 자동 생성한다.

초기 목표는 다음이다.

> 사용자가 수작업으로 오래 걸릴 파츠 보완, 단순 모션, 컷신 연출을 빠르게 만들 수 있게 한다.

---

## 4. 비타협 구현점

다음 항목들은 제품의 핵심 가치와 직결되므로 쉽게 포기해서는 안 된다.

### 4.1 캐릭터 정체성 유지

움직임 중에도 원본 캐릭터의 정체성이 유지되어야 한다.

필수 조건:

- 얼굴이 다른 사람처럼 변하면 안 된다.
- 선화 스타일이 크게 달라지면 안 된다.
- 색감이 흔들리면 안 된다.
- 옷 디자인과 주요 디테일이 유지되어야 한다.
- 파츠가 움직여도 원본 그림체의 인상이 남아야 한다.

### 4.2 시간적 일관성

프레임 간 결과물이 흔들리면 안 된다.

특히 AI 결과물을 프레임마다 생성하지 않도록 한다.

우선 방식:

- 정적인 보완 파츠를 먼저 생성한다.
- 생성된 파츠를 저장한다.
- 저장된 파츠를 deterministic하게 변형/렌더링한다.
- 국소 보정이 필요한 경우에도 동일한 파츠 기반에서 처리한다.

### 4.3 파츠 편집 가능성

모든 핵심 결과물은 편집 가능해야 한다.

필수 기능:

- 파츠 선택
- 파츠 이름 변경
- 파츠 삭제
- 파츠 순서 변경
- 파츠 숨김/표시
- 피벗 수정
- 관절점 수정
- 부모 파츠 설정
- 투명도 조절
- 보완된 숨은 부위 수정 또는 재생성

### 4.4 관절과 겹침의 기본 설득력

팔, 목, 허리, 무릎, 손목 같은 관절부는 최소한의 설득력이 있어야 한다.

필수 고려사항:

- 관절 주변 빈 공간이 생기지 않게 한다.
- 앞뒤 관계가 명확해야 한다.
- 회전 시 파츠가 분리되어 보이면 안 된다.
- 관절 주변에는 보정 패치 또는 인페인팅이 필요할 수 있다.

### 4.5 프로젝트 저장/불러오기 안정성

제작툴에서 프로젝트 파일은 매우 중요하다.

필수 조건:

- 모든 파츠 정보 저장
- 피벗/관절 정보 저장
- 모션 정보 저장
- 캔버스 정보 저장
- 버전 정보 저장
- 나중에 포맷이 바뀌어도 마이그레이션 가능해야 함

---

## 5. 타협 가능한 영역

다음 항목들은 초기 단계에서 완벽하게 구현하지 않아도 된다. 대신 연출과 UX로 보완한다.

### 5.1 극단적인 각도 변화

정면 이미지 한 장에서 180도 회전이나 완전한 뒷모습을 지원하려고 하면 난이도가 급격히 상승한다.

초기 타협:

- 회전 범위를 제한한다.
- 과도한 회전은 경고한다.
- 극단 포즈는 컷 전환, 이펙트, 스매어로 처리한다.

### 5.2 고강도 액션

격투, 점프, 회전, 돌진 같은 고강도 액션은 초기 MVP에서 완벽하게 처리하지 않는다.

초기 타협:

- 속도선
- 잔상
- 모션 블러
- 카메라 흔들림
- 줌인/줌아웃
- 플래시
- 컷 전환
- 프레임 홀드

이런 연출 효과로 부족한 작화량을 보완한다.

### 5.3 모든 숨은 부위의 완전 자동 추론

AI가 처음부터 모든 가려진 부위를 완벽히 복원할 필요는 없다.

초기 타협:

- 사용자가 마스크를 지정한다.
- AI가 보완 후보를 만든다.
- 사용자가 재생성하거나 수동 수정한다.
- 결과를 새 레이어로 저장한다.

### 5.4 풀 3D 캐릭터 생성

초기에는 완전한 3D 캐릭터 모델을 생성하지 않는다.

대신 다음을 목표로 한다.

- 2D 파츠
- 2D 메쉬 변형
- 단순 2.5D 볼륨 프록시
- 일부 파츠에 대한 3D-like 회전 보조

---

## 6. 기술 방향: 2.5D 볼륨 프록시

### 6.1 개념

2.5D 볼륨 프록시는 완전한 3D 모델이 아니라, 2D 캐릭터 파츠가 입체적으로 움직이는 것처럼 보이게 하기 위한 간단한 구조다.

목표:

- 파츠가 단순 평면처럼 보이는 문제를 줄인다.
- 회전 시 약간의 두께와 측면감을 제공한다.
- 안 보이던 면이 드러날 때 최소한의 구조적 설득력을 만든다.
- 2D 스타일을 유지하면서 움직임의 입체감을 보완한다.

### 6.2 파츠별 프록시 예시

#### 머리

- 타원체 또는 저해상도 메쉬 기반 프록시
- 정면 텍스처 투영
- 약간의 좌우 회전 지원
- 눈/입은 별도 레이어 또는 데칼로 유지
- 큰 회전은 제한

#### 몸통

- 얇은 박스 또는 곡면 메쉬
- 앞면 텍스처 + 측면 보완 텍스처
- 상체 기울기, 약한 비틀림 지원

#### 팔/다리

- 캡슐 또는 원통형 프록시
- 정면/측면 일부 텍스처
- 어깨, 팔꿈치, 손목에 보정 패치 필요
- 과도한 회전 시 모션 블러나 잔상으로 보완

#### 머리카락/옷자락

- 강체보다 2D 메쉬 변형 우선
- 흔들림, 지연, 보조 움직임 적용
- 필요시 스프링 계열 세컨더리 모션 적용

### 6.3 주의점

3D 파츠에 2D 텍스처를 입히는 것만으로는 충분하지 않다.

반드시 다음이 필요하다.

- 2D 라인 유지
- 셀채색 스타일 유지
- 관절부 보정
- 파츠별 회전 제한
- AI/수동 보정 레이어
- 연출 효과

---

## 7. 기능 단계 정의

### Level 1: 컷아웃 리깅

목표:

- 가장 기본적인 파츠 기반 모션 구현

기능:

- 이미지 업로드
- 파츠 선택
- 파츠 생성
- 피벗 설정
- 파츠 회전/이동/스케일
- 간단한 키프레임
- 호흡, 고개 끄덕임, 말하기 같은 저강도 모션

적합한 컷:

- 대화 장면
- 정적인 인물 컷
- 약한 표정/호흡 연기

### Level 2: 메쉬 기반 2D 변형

목표:

- 단순 회전보다 자연스러운 2D 변형 제공

기능:

- 파츠별 메쉬 생성
- 메쉬 포인트 이동
- 굽힘 변형
- 머리카락/옷자락 흔들림
- 관절 주변 간단 보정

적합한 컷:

- 팔 들기
- 몸 기울이기
- 머리 회전 약간
- 머리카락 흔들림

### Level 3: 2.5D 볼륨 프록시

목표:

- 중강도 액션에서 꼭두각시 느낌 감소

기능:

- 파츠별 프록시 타입 지정
- head/body/arm/leg proxy
- 약한 3D-like 회전
- 카메라 패닝/줌
- 측면 보완 텍스처
- 회전 범위 제한

적합한 컷:

- 상체 회전
- 팔 휘두르기
- 손 뻗기
- 돌진 느낌 연출

### Level 4: AI 보정 시스템

목표:

- 숨은 부위와 관절부를 보완

기능:

- 마스크 기반 인페인팅
- 파츠 완성
- 배경 클린 플레이트 생성
- 관절부 보정 패치 생성
- 보완 결과를 레이어로 저장
- 재생성/수동 수정 가능

### Level 5: 연출 시스템

목표:

- 한계가 드러나는 액션을 연출로 보완

기능:

- 속도선
- 잔상
- 모션 블러
- 충격파
- 플래시
- 카메라 흔들림
- 줌인/줌아웃
- 프레임 홀드
- 스매어 프레임 후보 생성

---

## 8. 1차 프로토타입 목표

### 8.1 1차 목표 정의

1차 목표는 완성된 제품을 만드는 것이 아니라, 다음을 검증하는 것이다.

> 2D 컷아웃 리깅, 메쉬 변형, 2.5D 볼륨 프록시, AI 보완, 연출 효과를 조합했을 때 어느 수준까지 퀄리티를 유지할 수 있는가?

또한 다음을 알아내야 한다.

- 어디까지가 비타협 구현점인가?
- 어디서부터 연출적 타협이 필요한가?
- 2.5D 프록시가 꼭두각시 느낌을 얼마나 줄이는가?
- AI 보완은 어느 부분에 가장 효과적인가?
- 어떤 동작부터 품질이 무너지는가?

### 8.2 1차 실험 세트

#### 실험 A: 저강도 연기 컷

동작:

- 호흡
- 고개 끄덕임
- 눈 깜빡임
- 말하기
- 시선 이동

평가:

- 원본 캐릭터 느낌이 유지되는가?
- 파츠 분리감이 보이는가?
- 사용자 입장에서 쉽게 만들 수 있는가?

#### 실험 B: 중강도 동작 컷

동작:

- 팔 들기
- 손 흔들기
- 상체 기울이기
- 상체 약간 회전
- 머리 약간 회전

평가:

- 관절부가 자연스러운가?
- 숨은 부위 보완이 필요한가?
- 2.5D 프록시가 도움이 되는가?
- 꼭두각시 느낌이 줄어드는가?

#### 실험 C: 고강도 액션 컷

동작:

- 주먹 휘두르기
- 돌진
- 점프
- 카메라 줌인
- 빠른 회전 느낌

평가:

- 실제 구현으로 버틸 수 있는 구간은 어디까지인가?
- 어느 순간부터 이펙트와 컷 전환이 필요한가?
- 잔상/속도선/모션 블러가 위화감을 얼마나 가리는가?

---

## 9. 핵심 데이터 모델 초안

Codex는 모든 기능을 구현할 때 프로젝트 데이터 모델을 중심으로 작업해야 한다.

```ts
type AnimotionProject = {
  version: string;
  metadata: ProjectMetadata;
  canvas: CanvasSettings;
  assets: Asset[];
  parts: Part[];
  proxies: VolumeProxy[];
  rigs: Rig[];
  motions: MotionClip[];
  effects: EffectLayer[];
  timeline: Timeline;
};

type ProjectMetadata = {
  name: string;
  createdAt: string;
  updatedAt: string;
  author?: string;
};

type CanvasSettings = {
  width: number;
  height: number;
  fps: number;
  durationFrames: number;
  backgroundColor?: string;
};

type Asset = {
  id: string;
  type: "sourceImage" | "partImage" | "inpaintedPatch" | "texture" | "effect";
  name: string;
  uri: string;
  width?: number;
  height?: number;
};

type Part = {
  id: string;
  name: string;
  type: "head" | "body" | "arm" | "leg" | "hand" | "hair" | "eye" | "mouth" | "clothes" | "prop" | "background";
  assetId: string;
  sourceAssetId?: string;
  parentId?: string;
  layerIndex: number;
  visible: boolean;
  opacity: number;
  pivot: Vec2;
  joint?: Vec2;
  mask?: PolygonMask;
  transform: Transform2D;
  mesh?: Mesh2D;
  proxyId?: string;
};

type VolumeProxy = {
  id: string;
  partId: string;
  proxyType: "plane" | "curvedPlane" | "capsule" | "box" | "ellipsoid" | "customMesh";
  depth: number;
  rotationLimit: {
    xMin: number;
    xMax: number;
    yMin: number;
    yMax: number;
    zMin: number;
    zMax: number;
  };
  textureAssetIds: string[];
  correctionPatchIds?: string[];
};

type Rig = {
  id: string;
  name: string;
  rootPartId: string;
  bones: Bone[];
};

type Bone = {
  id: string;
  name: string;
  parentBoneId?: string;
  partId: string;
  start: Vec2;
  end: Vec2;
  rotationLimit?: {
    min: number;
    max: number;
  };
};

type MotionClip = {
  id: string;
  name: string;
  durationFrames: number;
  keyframes: Keyframe[];
};

type Keyframe = {
  frame: number;
  targetId: string;
  targetType: "part" | "bone" | "camera" | "effect";
  property: string;
  value: number | string | Vec2 | Transform2D;
  easing?: "linear" | "easeIn" | "easeOut" | "easeInOut";
};

type EffectLayer = {
  id: string;
  type: "speedLine" | "afterImage" | "motionBlur" | "impact" | "flash" | "cameraShake";
  name: string;
  visible: boolean;
  params: Record<string, unknown>;
};

type Timeline = {
  currentFrame: number;
  durationFrames: number;
  tracks: TimelineTrack[];
};

type TimelineTrack = {
  id: string;
  targetId: string;
  targetType: "part" | "bone" | "camera" | "effect";
  keyframeIds: string[];
};

type Vec2 = {
  x: number;
  y: number;
};

type Transform2D = {
  x: number;
  y: number;
  rotation: number;
  scaleX: number;
  scaleY: number;
};

type PolygonMask = {
  points: Vec2[];
};

type Mesh2D = {
  vertices: Vec2[];
  triangles: [number, number, number][];
  uvs?: Vec2[];
};
```

---

## 10. 추천 코드 구조

```text
src/
  core/
    projectModel.ts
    assetModel.ts
    partModel.ts
    rigModel.ts
    motionModel.ts
    effectModel.ts
    serialization.ts
    migration.ts

  editor/
    editorState.ts
    selection.ts
    commandHistory.ts
    commands/
      createPartCommand.ts
      deletePartCommand.ts
      updatePartCommand.ts
      updatePivotCommand.ts
      createKeyframeCommand.ts
      updateProxyCommand.ts
    tools/
      rectangleSelectTool.ts
      lassoSelectTool.ts
      polygonSelectTool.ts
      pivotEditTool.ts
      meshEditTool.ts
      proxyEditTool.ts

  renderer/
    canvasRenderer.ts
    partRenderer.ts
    meshRenderer.ts
    proxyRenderer.ts
    rigOverlayRenderer.ts
    effectRenderer.ts
    timelinePreviewRenderer.ts

  ai/
    inpaintClient.ts
    maskUtils.ts
    hiddenPartCompletion.ts
    backgroundFill.ts
    correctionPatch.ts

  ui/
    App.tsx
    panels/
      CutInputPanel.tsx
      PartPanel.tsx
      RigPanel.tsx
      ProxyPanel.tsx
      MotionPanel.tsx
      EffectPanel.tsx
      PropertyPanel.tsx
      ExportPanel.tsx
    canvas/
      EditorCanvas.tsx
      CanvasToolbar.tsx
    timeline/
      Timeline.tsx
      Track.tsx
      Keyframe.tsx

  export/
    webmExporter.ts
    pngSequenceExporter.ts
    gifExporter.ts

  presets/
    motionTemplates.ts
    effectPresets.ts
    proxyPresets.ts
```

---

## 11. Codex 작업 원칙

Codex는 다음 원칙을 따라 구현해야 한다.

### 11.1 UI와 코어 로직 분리

UI 컴포넌트 안에 직접 프로젝트 데이터를 복잡하게 수정하는 코드를 넣지 않는다.

나쁜 예:

```ts
function Button() {
  // 여기서 직접 part 배열 수정, canvas redraw, json 저장까지 모두 처리
}
```

좋은 예:

```ts
runCommand(createPartCommand(params));
```

### 11.2 모든 편집 행동은 Command를 통해 처리

Undo/Redo를 위해 모든 편집 작업은 command로 처리한다.

예:

- createPartCommand
- deletePartCommand
- updatePartTransformCommand
- updatePivotCommand
- createKeyframeCommand
- updateProxyCommand

### 11.3 렌더러는 상태를 변경하지 않는다

renderer는 project state를 읽어서 화면에 그리기만 해야 한다.

### 11.4 저장 파일에는 version을 반드시 포함

모든 프로젝트 JSON은 version을 포함해야 한다.

향후 데이터 구조 변경 시 migration을 구현한다.

### 11.5 AI 결과물은 원본을 덮어쓰지 않는다

AI 인페인팅/보정 결과는 항상 새 asset 또는 새 layer로 저장한다.

원본 이미지는 보존한다.

---

## 12. 1차 구현 우선순위

### Priority 1: 프로젝트 모델 정리

- AnimotionProject 타입 정의
- Part, Asset, MotionClip, Timeline 구조 정리
- 저장/불러오기 안정화
- version 필드 추가

### Priority 2: 파츠 생성 안정화

- 사각형 선택
- 폴리곤 선택
- 선택 영역 시각화
- 파츠 생성
- 파츠 목록 반영
- 삭제/수정
- 선택 파츠 하이라이트

### Priority 3: 피벗/관절 편집

- 피벗 핸들 표시
- 피벗 드래그 수정
- 관절점 표시
- 부모-자식 연결 표시
- 회전 미리보기

### Priority 4: 기본 모션 템플릿

- 호흡
- 고개 끄덕임
- 손 흔들기
- 카메라 드리프트
- 말하기용 입 움직임 placeholder

### Priority 5: 2D 메쉬 변형 실험

- 파츠에 간단한 mesh 생성
- mesh vertex 표시
- 굽힘 변형
- 머리카락/옷자락 흔들림 테스트

### Priority 6: 2.5D 프록시 실험

- Part에 proxyType 추가
- plane, curvedPlane, capsule placeholder 구현
- proxy 회전 테스트
- 회전 범위 제한
- 2D 텍스처 매핑 실험

### Priority 7: 연출 효과

- 속도선
- 잔상
- 카메라 흔들림
- 플래시
- 모션 블러 placeholder

### Priority 8: AI 보정 연결 준비

초기에는 실제 AI 서버가 없어도 된다.

먼저 인터페이스만 만든다.

```ts
type InpaintRequest = {
  sourceAssetId: string;
  maskAssetId: string;
  prompt?: string;
  targetPartId?: string;
};

type InpaintResult = {
  assetId: string;
  previewUri: string;
};
```

이후 실제 인페인팅 서버나 API를 연결한다.

---

## 13. MVP 성공 기준

1차 MVP는 다음이 가능해야 성공으로 본다.

### 필수 성공 기준

- 사용자가 이미지를 업로드할 수 있다.
- 사용자가 파츠를 만들 수 있다.
- 파츠에 피벗을 지정할 수 있다.
- 파츠를 움직이고 미리볼 수 있다.
- 간단한 모션 템플릿을 적용할 수 있다.
- 프로젝트를 JSON으로 저장/불러오기 할 수 있다.
- WebM 또는 PNG sequence로 결과를 출력할 수 있다.

### 2.5D 실험 성공 기준

- 단순 2D 회전보다 덜 꼭두각시처럼 보이는 예시를 하나 이상 만든다.
- 팔 들기 또는 상체 회전에서 2.5D 프록시의 효과를 확인한다.
- 한계가 드러나는 지점을 문서화한다.

### 연출 타협 성공 기준

- 고강도 액션에서 부족한 움직임을 잔상/속도선/카메라워크로 어느 정도 보완하는 예시를 만든다.
- 실제 구현으로 해결해야 할 부분과 연출로 넘길 수 있는 부분을 구분한다.

---

## 14. 금지 또는 보류할 작업

초기에는 다음 작업을 하지 않는다.

- 풀 3D 캐릭터 자동 생성
- 모든 프레임 AI 생성
- 복잡한 물리 시뮬레이션
- 상용 수준 브러시 엔진
- PSD 완전 호환
- 멀티 유저 협업
- 클라우드 렌더링
- 플러그인 마켓
- 대규모 모델 학습

---

## 15. Codex에게 줄 첫 번째 작업 지시 예시

```md
# Task: Refactor Animotion around a central project model

We are building Animotion, a 2.5D motion comic editor.
The app should not be treated as a generic drawing tool. It is a tool for importing a comic/webtoon image, creating character parts, setting pivots/joints, applying motion templates, and eventually using 2.5D proxies and AI inpainting to reduce the puppet-like look.

## Immediate Goal
Refactor the current project so all editor data is stored in a central typed AnimotionProject model.

## Requirements
1. Create TypeScript types for:
   - AnimotionProject
   - ProjectMetadata
   - CanvasSettings
   - Asset
   - Part
   - VolumeProxy
   - Rig
   - Bone
   - MotionClip
   - Keyframe
   - EffectLayer
   - Timeline
2. Add a version field to the project file.
3. Update save/load JSON to use this model.
4. Keep UI components separate from core model logic.
5. Do not add new AI features yet.
6. Do not replace existing UI unless necessary.
7. Preserve current functionality.

## Architecture Rule
UI components should call editor commands or model functions, not directly mutate complex project state.

## Output
- Updated TypeScript model files
- Updated save/load logic
- Minimal integration with current UI
- No visual redesign unless required
```

---

## 16. 향후 기획 판단 기준

새 기능을 추가하기 전에 항상 다음 질문을 한다.

1. 이 기능이 꼭두각시 느낌을 줄이는가?
2. 이 기능이 사용자의 제어 가능성을 높이는가?
3. 이 기능이 캐릭터 정체성과 시간적 일관성을 유지하는가?
4. 이 기능이 MVP 검증에 필요한가?
5. 구현으로 해결해야 하는가, 연출로 타협해도 되는가?
6. 현재 단계에서 너무 큰 범위는 아닌가?

---

## 17. 현재 가장 중요한 방향성

Animotion의 초기 성공은 AI 모델의 완성도보다 다음에 달려 있다.

1. 파츠를 안정적으로 만들 수 있는가?
2. 피벗과 관절을 쉽게 조정할 수 있는가?
3. 단순 리깅보다 덜 어색하게 움직일 수 있는가?
4. 숨은 부위 보완을 편집 가능한 자산으로 저장할 수 있는가?
5. 한계가 드러나는 동작을 연출 효과로 설득력 있게 넘길 수 있는가?

따라서 1차 개발은 기능 확장보다 **핵심 워크플로우의 안정화**에 집중한다.

핵심 워크플로우:

```text
이미지 업로드
→ 파츠 생성
→ 숨은 부위 보완 준비
→ 피벗/관절 설정
→ 2D/2.5D 모션 적용
→ 연출 효과 추가
→ 미리보기
→ 내보내기
→ 프로젝트 저장
```

---

## 18. 최종 요약

Animotion은 클립스튜디오나 블렌더를 대체하는 툴이 아니다.

Animotion은 다음 문제를 해결하는 특화 제작툴이다.

> 정적인 웹툰/일러스트 이미지를, 사용자가 제어 가능한 방식으로, 2D 애니메이션처럼 움직이게 만드는 것.

이를 위해 단순 컷아웃 리깅에서 시작하되, 궁극적으로는 다음을 조합한다.

- 파츠 분리
- 숨은 부위 보완
- 2D 메쉬 변형
- 2.5D 볼륨 프록시
- 관절 보정
- 카메라워크
- 잔상/속도선/이펙트
- AI 인페인팅
- 프로젝트 기반 비파괴 편집

1차 목표는 완벽한 자동 애니메이션 생성이 아니라, **어디까지 구현으로 품질을 유지할 수 있고 어디서부터 연출적 타협이 필요한지 알아내는 것**이다.

