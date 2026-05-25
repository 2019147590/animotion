import type {
  HiddenCompletionMeshGuide,
  HiddenCompletionPatchTransform,
  NormalizedImageRect,
  NormalizedLocalPoint,
} from "./project-model";

/**
 * Provider-neutral adapter input for hidden-area completion.
 *
 * This is not an OpenAI, Replicate, ComfyUI, Stable Diffusion, or local runner
 * request. Provider adapters translate this semantic payload at their boundary.
 *
 * Coordinate contract:
 * - sourceRectNormalized is normalized against the full source image.
 * - sourcePartRectNormalized is the original source part rect, used to map
 *   source-part-local coordinates into an expanded sourceRectNormalized crop.
 * - maskVerticesNormalized, guide.meshVerticesNormalized,
 *   guide.silhouetteVerticesNormalized, and patchTransform.translationNormalized
 *   are source-part-local normalized coordinates.
 * - guide vertices may be outside 0..1 and must not be clamped before adapter
 *   conversion.
 */
export type HiddenCompletionRequestPayload = {
  task: "hidden_completion";
  requestId: string | null;
  promptVersion: string | null;
  patchAssetId: string;
  sourcePartId: string;
  sourceRectNormalized: NormalizedImageRect | null;
  sourcePartRectNormalized: NormalizedImageRect | null;
  maskVerticesNormalized: NormalizedLocalPoint[];
  guide: Pick<HiddenCompletionMeshGuide, "meshVerticesNormalized" | "meshFaces" | "silhouetteVerticesNormalized">;
  patchTransform: HiddenCompletionPatchTransform;
  intent: {
    mode: "extend_same_part";
    preserveStyle: boolean;
    preserveLineArt: boolean;
    avoidNewDesign: boolean;
  };
  provenance: { provider: null; modelId: null; modelLicense: null };
  warnings: string[];
};

export type HiddenCompletionRequestOptions = {
  promptVersion?: string;
  includeWarnings?: boolean;
  strictMode?: boolean;
  requestId?: string;
};
