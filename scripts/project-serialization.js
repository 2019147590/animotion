{
  const global = typeof window !== "undefined" ? window : globalThis;
  const Animotion = global.Animotion || (global.Animotion = {});
  const model = Animotion.projectModel;

  function projectFromEditorState(state, options = {}) {
    const previous = state.project || {};
    const canvas = canvasFromState(state, options);
    const parts = (state.parts || []).map((part, index) => model.normalizeProjectPart(part, index));
    const motions = motionClipsFromParts(parts, canvas.durationFrames);
    return {
      ...model.createEmptyProject({
        name: projectName(state, previous),
        createdAt: previous.metadata?.createdAt,
        canvas,
      }),
      metadata: metadataFromState(state, previous),
      assets: assetsFromState(state, parts),
      parts,
      rigs: [rigFromParts(parts)],
      motions,
      effects: effectsFromState(state),
      timeline: timelineFromState(state, motions, canvas.durationFrames),
      editor: editorDataFromState(state),
    };
  }

  function canvasFromState(state, options) {
    const image = state.image;
    return {
      width: Math.round(Number(options.width || image?.naturalWidth) || 1),
      height: Math.round(Number(options.height || image?.naturalHeight) || 1),
      fps: Math.round(Number(Animotion.config?.timelineFps) || 24),
      durationFrames: Math.round(Number(state.cutsceneBridge?.durationFrames || Animotion.config?.timelineFrames) || 120),
      backgroundColor: "#f7f0df",
    };
  }

  function metadataFromState(state, previous) {
    const now = new Date().toISOString();
    return {
      name: projectName(state, previous),
      createdAt: previous.metadata?.createdAt || now,
      updatedAt: now,
      ...(previous.metadata?.author ? { author: previous.metadata.author } : {}),
    };
  }

  function projectName(state, previous) {
    return String(previous.metadata?.name || state.imageName || "Untitled Animotion Project");
  }

  function assetsFromState(state, parts) {
    const assets = [];
    if (state.imageName) assets.push(imageAsset("source-image", "sourceImage", state.imageName, state.image));
    if (state.nextImageName) assets.push(imageAsset("impact-image", "sourceImage", state.nextImageName, state.nextImage));
    for (const part of parts) assets.push(partAsset(part));
    return assets.filter(Boolean);
  }

  function imageAsset(id, type, name, image) {
    return {
      id,
      type,
      name,
      uri: name,
      ...(image?.naturalWidth ? { width: image.naturalWidth } : {}),
      ...(image?.naturalHeight ? { height: image.naturalHeight } : {}),
    };
  }

  function partAsset(part) {
    const rect = model.normalizeRect(part.sourceRect || part.rect);
    return { id: part.assetId, type: "partImage", name: part.name, uri: `part://${part.id}`, width: rect.w, height: rect.h };
  }

  function motionClipsFromParts(parts, durationFrames) {
    return parts.map((part) => ({
      id: `motion-${part.id}`,
      name: `${part.name} motion`,
      durationFrames,
      keyframes: model.normalizeLegacyKeyframes(part.keyframes).map((keyframe) => motionKeyframe(part.id, keyframe)),
    }));
  }

  function motionKeyframe(partId, keyframe) {
    return {
      frame: keyframe.frame,
      targetId: partId,
      targetType: "part",
      property: "customMotion",
      value: keyframe.pose,
      easing: "linear",
    };
  }

  function rigFromParts(parts) {
    return {
      id: "main-rig",
      name: "Main Rig",
      rootPartId: parts.find((part) => !part.parentId)?.id || parts[0]?.id || null,
      bones: parts.map((part) => boneFromPart(part)),
    };
  }

  function boneFromPart(part) {
    const rect = model.normalizeRect(part.sourceRect || part.rect);
    return {
      id: `bone-${part.id}`,
      name: `${part.name} bone`,
      parentBoneId: part.parentId ? `bone-${part.parentId}` : undefined,
      partId: part.id,
      start: { x: rect.x + part.pivot.x, y: rect.y + part.pivot.y },
      end: { x: rect.x + part.joint.x, y: rect.y + part.joint.y },
    };
  }

  function effectsFromState(state) {
    if (!state.cutsceneBridge) return [];
    return [{
      id: "cutscene-bridge",
      type: "impact",
      name: "Cutscene Bridge",
      visible: true,
      params: { ...state.cutsceneBridge },
    }];
  }

  function timelineFromState(state, motions, durationFrames) {
    return {
      currentFrame: Math.round(Number(state.currentFrame) || 1),
      durationFrames,
      tracks: motions.map((motion) => ({
        id: `track-${motion.id}`,
        targetId: motion.keyframes[0]?.targetId || motion.id.replace(/^motion-/, ""),
        targetType: "part",
        keyframeIds: motion.keyframes.map((_, index) => `${motion.id}:${index}`),
      })),
    };
  }

  function editorDataFromState(state) {
    return {
      imageName: state.imageName || "",
      nextImageName: state.nextImageName || "",
      separateCharacter: Boolean(state.separateCharacter),
      cutsceneBridge: state.cutsceneBridge || null,
      panelSetup: state.panelSetup || null,
      correspondences: Animotion.correspondenceModel?.normalizeList?.(state.correspondences, state.parts) || [],
      motionPlan: state.motionPlan || null,
      selectedPartId: state.selectedPartId || null,
    };
  }

  model.projectFromEditorState = projectFromEditorState;

  if (typeof module !== "undefined") module.exports = model;
}
