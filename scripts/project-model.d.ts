export type AnimotionProject = {
  version: string;
  format: "animotion-project";
  metadata: ProjectMetadata;
  canvas: CanvasSettings;
  assets: Asset[];
  parts: Part[];
  proxies: VolumeProxy[];
  rigs: Rig[];
  motions: MotionClip[];
  effects: EffectLayer[];
  timeline: Timeline;
  editor?: EditorProjectData;
};

export type ProjectMetadata = {
  name: string;
  createdAt: string;
  updatedAt: string;
  author?: string;
};

export type CanvasSettings = {
  width: number;
  height: number;
  fps: number;
  durationFrames: number;
  backgroundColor?: string;
};

export type Asset = {
  id: string;
  type: "sourceImage" | "partImage" | "inpaintedPatch" | "texture" | "effect";
  name: string;
  uri: string;
  width?: number;
  height?: number;
};

export type Part = {
  id: string;
  name: string;
  type: "head" | "body" | "spine" | "arm" | "leg" | "hand" | "hair" | "eye" | "mouth" | "clothes" | "prop" | "background";
  assetId: string;
  sourceAssetId?: string;
  parentId?: string | null;
  layerIndex: number;
  visible: boolean;
  opacity: number;
  pivot: Vec2;
  joint?: Vec2;
  mask?: PolygonMask | null;
  transform: Transform2D;
  mesh?: Mesh2D;
  proxyId?: string;
  sourceRect?: Rect;
  motionSettings?: CustomMotion;
};

export type VolumeProxy = {
  id: string;
  partId: string;
  proxyType: "plane" | "curvedPlane" | "capsule" | "box" | "ellipsoid" | "customMesh";
  depth: number;
  rotationLimit: RotationLimit3D;
  textureAssetIds: string[];
  correctionPatchIds?: string[];
};

export type Rig = {
  id: string;
  name: string;
  rootPartId: string | null;
  bones: Bone[];
};

export type Bone = {
  id: string;
  name: string;
  parentBoneId?: string;
  partId: string;
  start: Vec2;
  end: Vec2;
  rotationLimit?: { min: number; max: number };
};

export type MotionClip = {
  id: string;
  name: string;
  durationFrames: number;
  keyframes: Keyframe[];
};

export type Keyframe = {
  frame: number;
  targetId: string;
  targetType: "part" | "bone" | "camera" | "effect";
  property: string;
  value: number | string | Vec2 | Transform2D | CustomMotion;
  easing?: "linear" | "easeIn" | "easeOut" | "easeInOut";
};

export type EffectLayer = {
  id: string;
  type: "speedLine" | "afterImage" | "motionBlur" | "impact" | "flash" | "cameraShake";
  name: string;
  visible: boolean;
  params: Record<string, unknown>;
};

export type Timeline = {
  currentFrame: number;
  durationFrames: number;
  tracks: TimelineTrack[];
};

export type TimelineTrack = {
  id: string;
  targetId: string;
  targetType: "part" | "bone" | "camera" | "effect";
  keyframeIds: string[];
};

export type EditorProjectData = {
  imageName: string;
  nextImageName: string;
  separateCharacter: boolean;
  cutsceneBridge: unknown;
  panelSetup: unknown;
  correspondences: Correspondence[];
  motionPlan: unknown;
  selectedPartId: string | null;
};

export type Correspondence = {
  id: string;
  schemaVersion: "editor-correspondence-v1" | string;
  kind: "manual" | "ai-draft" | "imported";
  sourcePartId: string;
  sourcePartType: string;
  targetPartType: "head" | "chest" | "hip" | "arm" | "hand" | "leg" | "foot" | "hair" | "prop";
  impactAnchor: Vec2 | null;
  bImpact: NormalizedImagePoint | null;
  occlusion: OcclusionMetadata;
  source: CorrespondenceSource;
  target: CorrespondenceTarget;
};

export type CorrespondenceSource = {
  partId: string;
  partType: string;
};

export type CorrespondenceTarget = {
  partType: "head" | "chest" | "hip" | "arm" | "hand" | "leg" | "foot" | "hair" | "prop";
  anchor: Vec2 | null;
  coordinateSpace: "impactImage" | "sourceImage" | "normalized-image";
  bImpact: NormalizedImagePoint | null;
};

export type PlannerCorrespondenceDraft = {
  source: "correspondence-compile-v1";
  correspondenceId: string;
  sourcePartId: string;
  sourcePartType: string;
  targetPartType: CorrespondenceTarget["partType"];
  target: Vec2;
  targetCoordinateSpace: CorrespondenceTarget["coordinateSpace"];
  anchors: [];
  motionHints: MotionHints;
  motionDraft: MotionDraft | null;
  relation: {
    source: CorrespondenceSource;
    target: CorrespondenceTarget;
    occlusion: OcclusionMetadata;
  };
};

export type MotionHints = {
  source: string;
  occlusion: OcclusionMetadata["status"];
  depthOrder: OcclusionMetadata["depthOrder"];
  hiddenCompletion: OcclusionMetadata["hiddenCompletion"];
  warnings: string[];
};

export type MotionDraft = {
  source: string;
  partId: string | null;
  draftKind: "non-destructive-2.5d";
  draftScope: "plan" | "action-snapshot";
  compiledFromHintsVersion: number;
  sourceCorrespondenceId: string | null;
  sourceTargetId: string | null;
  generatedFrom: string;
  visibility: MotionDraftVisibility | null;
  zOrder: MotionDraftZOrder | null;
  hiddenCompletion: MotionDraftHiddenCompletion;
  warnings: string[];
};

export type MotionDraftVisibility = {
  property: "opacity";
  reason: string;
  keyframes: { frame: number; value: number }[];
};

export type MotionDraftZOrder = {
  property: "layerIndex";
  reason: string;
  keyframes: { frame: number; value: string }[];
};

export type MotionDraftHiddenCompletion = {
  needed: boolean;
  status: OcclusionMetadata["hiddenCompletion"];
  assetKind: "inpaintedPatch" | string;
  assetStatus: "none" | "missing" | "requested" | "ready";
  assetId: string | null;
  requestId: string | null;
  requestedAt: string | null;
  completedAt: string | null;
};

export type OcclusionMetadata = {
  status: "visible" | "partial" | "hidden" | "unknown";
  depthOrder: "front" | "behind" | "intersect" | "unknown";
  hiddenCompletion: "none" | "candidate" | "required";
};

export type Vec2 = { x: number; y: number };
export type NormalizedImagePoint = { xNorm: number; yNorm: number; coordinateSpace: "normalized-image" };
export type Rect = { x: number; y: number; w: number; h: number };
export type PolygonMask = { points: Vec2[] };
export type Mesh2D = { vertices: Vec2[]; triangles: [number, number, number][]; uvs?: Vec2[] };
export type Transform2D = { x: number; y: number; rotation: number; scaleX: number; scaleY: number };
export type CustomMotion = { x: number; y: number; rotate: number; scaleY: number; jointX: number; jointY: number; phase: number };
export type RotationLimit3D = { xMin: number; xMax: number; yMin: number; yMax: number; zMin: number; zMax: number };
