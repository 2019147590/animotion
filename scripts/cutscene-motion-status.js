{
  const global = typeof window !== "undefined" ? window : globalThis;
  const Animotion = global.Animotion || (global.Animotion = {});

  function statusForBridge(bridge = {}, options = {}) {
    if (!bridge) return { active: false, reason: "no-cutscene-bridge" };
    const safe = Animotion.cutsceneModel?.normalizeBridge?.(bridge) || bridge || {};
    const status = Animotion.cutsceneActionSelectors?.getCutsceneActionStatus?.(safe, options) || {};
    const action = status.action;
    const actionType = status.template;
    if (!action || !["punch", "kick"].includes(actionType)) return { active: false, reason: status.reason || "unsupported-cutscene-action" };
    const beats = Array.isArray(action.beats) ? action.beats : [];
    const impactBeat = beatById(beats, "impact");
    const currentBeat = currentBeatFor(beats, options.currentFrame || 1);
    const timeline = status.timeline || null;
    const timelineBeats = Array.isArray(timeline?.beats) ? timeline.beats : [];
    const runtime = runtimeDebug(safe, action, options);
    return {
      active: true,
      actionType,
      currentBeatId: currentBeat?.id || null,
      currentBeatFrame: currentBeat?.at || null,
      impactFrame: safe.impactFrame || timeline?.impactFrame || impactBeat?.at || null,
      primaryPartRole: timeline?.primaryPartRole || null,
      primaryPartId: safe.primaryPartId || action.targetDebug?.primaryPartId || null,
      bodyRootAssistActive: bodyRootAssistActive(safe, action),
      hipRootAnchorPresent: hipRootAnchorPresent(action.anchors),
      primaryImpactTarget: primaryImpactTarget(action, impactBeat),
      recoilFrame: recoilFrame(timelineBeats),
      driveFrame: frameFor(timelineBeats, "drive"),
      chamberFrame: frameFor(timelineBeats, "chamber"),
      extendFrame: frameFor(timelineBeats, "extend"),
      recoverFrame: frameFor(timelineBeats, "recover") || frameFor(beats, "recover"),
      actionFrame: normalizeActionFrameStatus(options.actionFrame),
      runtime,
    };
  }

  function statusText(status = {}) {
    if (!status.active) return "활성 punch/kick 없음";
    const target = status.primaryImpactTarget ? `${status.primaryImpactTarget.key} ${status.primaryImpactTarget.x},${status.primaryImpactTarget.y}` : "none";
    return compact([
      `motion ${status.actionType}`,
      status.currentBeatId ? `${status.currentBeatId}@${status.currentBeatFrame}` : null,
      actionFrameText(status.actionFrame),
      `impact ${status.impactFrame}`,
      `target ${target}`,
      conciseRuntimeText(status.runtime),
    ]).join(" · ");
  }

  function runtimeDebug(bridge, action, options = {}) {
    const parts = options.parts || [], frame = options.currentFrame || bridge.impactFrame || 1;
    const extension = Animotion.armExtension?.debugForFrame?.({ parts, bridge, frame, selectedPartId: options.selectedPartId }) || {};
    const replacement = Animotion.motionReplacementLayer?.debugForFrame?.({ parts, bridge, frame, selectedPartId: options.selectedPartId }) || {};
    const ordered = Animotion.cutsceneDepth?.orderedParts?.(parts, { parts, bridge, frame, selectedPartId: options.selectedPartId }) || parts;
    const selectedId = options.selectedPartId || bridge.primaryPartId || action.targetDebug?.primaryPartId || null;
    const covering = coveringParts(parts, selectedId);
    const selectedIndex = ordered.findIndex((part) => part.id === selectedId);
    const depthBias = selectedId ? Animotion.cutsceneDepth?.depthBiasForPart?.(parts.find((part) => part.id === selectedId), { parts, bridge, frame, selectedPartId: options.selectedPartId }) || 0 : 0;
    const draw = Animotion.renderOrderDebug?.analyze?.(options.previewDrawSequence, { parts, selectedPartId: selectedId, bridge, frame }) || {};
    const target = targetGenerationDebug(action, parts, selectedId);
    const regeneration = normalizeRegenerationDebug(options.regenerationDebug);
    const hiddenCompletion = Animotion.hiddenCompletionDiagnostics?.analyze?.({ parts, assets: options.assets || [], imageBounds: options.imageBounds || null, previewDrawSequence: options.previewDrawSequence }) || { status: "unknown", evidence: "hidden-completion-diagnostics-unavailable", items: [] };
    const debug = { ...extension, ...replacement, ...draw, regeneration, hiddenCompletion, roleDecision: action.targetDebug?.roleDecision || null, target, targetGenerationFailure: Boolean(target.targetInsideHeadFaceBounds || target.targetNearHeadFaceBounds), sourcePanelOverlapFailure: draw.sourcePanelConflictRisk === true, actualDrawOrderFailure: draw.selectedAfterCoveringParts === false, segmentedRenderFailure: draw.segmentedRenderFailure === true, replacementRenderOk: draw.replacementRenderOk === true, replacementRenderFailure: draw.replacementRenderFailure === true, skippedNormalArmDraw: draw.skippedNormalArmDraw === true, fallbackToNormalArm: draw.fallbackToNormalArm === true, replacementRenderReason: draw.replacementRenderReason || replacement.replacementReason || null, sourceEraseWithoutReplacement: draw.sourceEraseWithoutReplacement === true, punchStyleSource: draw.punchStyleSource || extension.punchStyleSource, legacyDepthCompat: Boolean(draw.legacyDepthCompat || extension.legacyDepthCompat), cutsceneDepthActive: depthBias > 0, evaluatedDepthBias: depthBias, renderOrder: ordered.map((part) => part.id), coveringOrderChecks: covering.map((part) => ({ partId: part.id, selectedAfter: selectedIndex > ordered.findIndex((item) => item.id === part.id) })), selectedAboveCoveringParts: covering.length ? covering.every((part) => selectedIndex > ordered.findIndex((item) => item.id === part.id)) : null, motionMode: options.motionTemplate || "unknown", punchStyle: action.targetDebug?.punchStyle || "none", selectedPartId: action.targetDebug?.selectedPartId || options.selectedPartId || null, resolvedArmChain: action.targetDebug?.resolvedArmChain || null, terminalPunchPartId: action.targetDebug?.terminalPunchPartId || null, terminalPunchPointSource: action.targetDebug?.terminalPunchPointSource || null, punchSide: action.targetDebug?.punchSide || null, classificationBasis: action.targetDebug?.classificationBasis || null, separateRigPath: action.targetDebug?.separateRigPath === true, armOnlyFallback: action.targetDebug?.armOnlyFallback === true, handParentIsForearm: action.targetDebug?.handParentIsForearm === true, forearmParentIsUpperArm: action.targetDebug?.forearmParentIsUpperArm === true, elbowConnectionValid: action.targetDebug?.elbowConnectionValid === true, wristConnectionValid: action.targetDebug?.wristConnectionValid === true, chainParentingValid: action.targetDebug?.chainParentingValid === true, chainParentingWarning: action.targetDebug?.chainParentingWarning || null, chainWarnings: action.targetDebug?.chainWarnings || [], replacementLayerUsed: action.targetDebug?.separateRigPath === true ? false : replacement.replacementActive === true, wristOverlapHandled: action.targetDebug?.wristOverlapHandled === true, hiddenCompletionCandidate: action.targetDebug?.hiddenCompletionCandidate === true, selectedToEndpointText: action.targetDebug?.selectedToEndpointText || null };
    debug.diagnosticLayers = diagnosticLayers({ bridge, action, options, selectedId, debug, draw, target, regeneration });
    return debug;
  }

  function debugText(status = {}) {
    const debug = status.runtime || {};
    if (!debug || !Object.keys(debug).length) return null;
    const order = Array.isArray(debug.renderOrder) ? debug.renderOrder.join(">") : "n/a";
    return `runtime rearCrossArmOnly=${yesNo(debug.rearCrossArmOnlyPunch)} ext=${yesNo(debug.armExtensionActive)} replacement=${yesNo(debug.replacementActive)} replacementOk=${yesNo(debug.replacementRenderOk)} replacementFailure=${yesNo(debug.replacementRenderFailure)} handTip=${debug.handTipSource || "missing"} selectedPart=${debug.selectedPartId || "n/a"} endpoint=${debug.terminalPunchPartId || "n/a"} endpointSource=${debug.terminalPunchPointSource || "n/a"} chain=${chainText(debug.resolvedArmChain)} punchSide=${debug.punchSide || "n/a"} basis=${debug.classificationBasis || "n/a"} separateRig=${yesNo(debug.separateRigPath)} armOnlyFallback=${yesNo(debug.armOnlyFallback)} handParentIsForearm=${yesNo(debug.handParentIsForearm)} forearmParentIsUpperArm=${yesNo(debug.forearmParentIsUpperArm)} elbowConnectionValid=${yesNo(debug.elbowConnectionValid)} wristConnectionValid=${yesNo(debug.wristConnectionValid)} chainParentingValid=${yesNo(debug.chainParentingValid)} chainParentingWarning=${debug.chainParentingWarning || "none"} replacementLayerUsed=${yesNo(debug.replacementLayerUsed)} wristOverlapHandled=${yesNo(debug.wristOverlapHandled)} hiddenCompletionCandidate=${yesNo(debug.hiddenCompletionCandidate)} hiddenCompletion=${debug.hiddenCompletion?.status || "n/a"} hiddenEvidence=${debug.hiddenCompletion?.evidence || "n/a"} targetFailure=${yesNo(debug.targetGenerationFailure)} sourcePanelFailure=${yesNo(debug.sourcePanelOverlapFailure)} drawOrderFailure=${yesNo(debug.actualDrawOrderFailure)} segmentedFailure=${yesNo(debug.segmentedRenderFailure)} sourceEraseWithoutReplacement=${yesNo(debug.sourceEraseWithoutReplacement)} layers=${layersText(debug.diagnosticLayers)} role=${roleDecisionText(debug.roleDecision)} target=${targetText(debug.target)} replaced=${yesNo(debug.oldWholeArmTranslationReplaced)} pose=${debug.impactPoseMode || "n/a"} depth=${yesNo(debug.cutsceneDepthActive)} bias=${debug.evaluatedDepthBias || 0} style=${debug.punchStyle || "none"} styleSource=${debug.punchStyleSource || "missing"} legacyDepthCompat=${yesNo(debug.legacyDepthCompat)} mode=${debug.motionMode || "unknown"} sourcePanel=${debug.sourcePanelMode || "n/a"} order ${order} selectedAboveCover=${nullableYesNo(debug.selectedAboveCoveringParts)} actualAboveCover=${nullableYesNo(debug.selectedAfterCoveringParts)} segmentedReplaces=${yesNo(debug.segmentedReplacesNormal)} skippedNormalArm=${yesNo(debug.skippedNormalArmDraw)} fallbackNormal=${yesNo(debug.fallbackToNormalArm)} drawSeq ${drawSequenceText(debug.finalDrawSequence)}`;
  }

  function diagnosticLayers(data) {
    const { bridge, action, options, selectedId, debug, draw, target, regeneration } = data;
    const part = (options.parts || []).find((item) => item.id === selectedId);
    const impactFrame = bridge.impactFrame || beatById(action.beats, "impact")?.at || null;
    return [
      layer("saved state / loaded JSON", action ? "pass" : "fail", `primary=${bridge.primaryPartId || "n/a"} source=${action?.source || "n/a"} legacy=${Animotion.cutsceneActionSelectors?.rawActionTimeline?.(action) ? "no" : "yes"}`),
      layer("regeneration command", regeneration ? (regeneration.generated ? "pass" : regeneration.attempted ? "fail" : "unknown") : "unknown", regeneration?.reason || "no-regeneration-attempt"),
      layer("planner / role classification", debug.roleDecision || debug.punchStyle !== "none" ? "pass" : "unknown", `style=${debug.punchStyle || "n/a"} basis=${debug.classificationBasis || "n/a"}`),
      layer("keyframe generation", part?.keyframes?.length ? "pass" : "unknown", `part=${part?.id || "n/a"} keyframes=${part?.keyframes?.length || 0} impact=${impactFrame || "n/a"}`),
      layer("preview evaluation", draw.finalDrawSequence?.length || debug.replacementActive || debug.armExtensionActive ? "pass" : "unknown", `replacement=${yesNo(debug.replacementActive)} extension=${yesNo(debug.armExtensionActive)}`),
      layer("render order", draw.selectedAfterCoveringParts === false ? "fail" : draw.selectedAfterCoveringParts === null || draw.selectedAfterCoveringParts === undefined ? "unknown" : "pass", `selectedAfterCover=${nullableYesNo(draw.selectedAfterCoveringParts)}`),
      layer("canvas/source erase/compositing", draw.sourcePanelConflictRisk === true || draw.sourceEraseWithoutReplacement === true ? "fail" : draw.sourcePanelMode ? "pass" : "unknown", `sourcePanel=${draw.sourcePanelMode || "n/a"} eraseWithoutReplacement=${yesNo(draw.sourceEraseWithoutReplacement)}`),
      layer("hiddenCompletion", debug.hiddenCompletion?.status || "unknown", debug.hiddenCompletion?.evidence || "no-hidden-completion-evidence", debug.hiddenCompletion?.items || []),
      layer("UI/debug display", "pass", `status=available debug=available targetInsideHead=${yesNo(target.targetInsideHeadFaceBounds)}`),
    ];
  }

  function layer(name, status, evidence, details) { return details === undefined ? { name, status, evidence } : { name, status, evidence, details }; }
  function normalizeRegenerationDebug(debug) { return debug && typeof debug === "object" ? { ...debug } : null; }
  function layersText(layers = []) { return (Array.isArray(layers) ? layers : []).map((entry) => `${entry.name}:${entry.status}`).join("|") || "n/a"; }

  function conciseRuntimeText(debug = {}) {
    if (!debug || !Object.keys(debug).length) return null;
    return compact([
      debug.rearCrossArmOnlyPunch ? "뒷손 arm-only" : null,
      debug.armExtensionActive ? "손끝 확장" : null,
      debug.replacementRenderOk ? "대체 렌더" : null,
      debug.cutsceneDepthActive ? "깊이 보정" : null,
      debug.selectedToEndpointText,
      debug.separateRigPath ? "separate rig" : null,
      debug.chainParentingWarning ? `chain warning: ${debug.chainParentingWarning}` : null,
      debug.hiddenCompletionCandidate ? "보완 후보" : null,
      debug.hiddenCompletion?.status === "fail" ? "보완 커버리지 실패" : null,
      debug.hiddenCompletion?.status === "warning" ? "보완 커버리지 경고" : null,
      debug.replacementRenderFailure ? "대체 렌더 실패" : null,
      debug.segmentedRenderFailure ? "분절 렌더 실패" : null,
      debug.sourceEraseWithoutReplacement ? "원본 보강 누락" : null,
      debug.selectedAfterCoveringParts === false || debug.selectedAboveCoveringParts === false ? "가림 위험" : null,
    ]).join(" / ") || null;
  }

  function normalizeActionFrameStatus(actionFrame = null) {
    if (!actionFrame) return null;
    return {
      selectedBeatId: actionFrame.selectedBeatId || null,
      selectedFrame: Number.isFinite(Number(actionFrame.selectedFrame)) ? Math.round(Number(actionFrame.selectedFrame)) : null,
      selectedLabel: actionFrame.selectedLabel || actionFrame.selectedBeatId || null,
      writesToKeyframes: actionFrame.writesToKeyframes === true,
      trajectoryReadOnly: actionFrame.trajectoryReadOnly === true,
    };
  }

  function actionFrameText(actionFrame = null) {
    if (!actionFrame?.selectedFrame) return null;
    const write = actionFrame.writesToKeyframes ? "keyframes edit" : "view";
    const trajectory = actionFrame.trajectoryReadOnly ? "trajectory read-only" : null;
    return compact([`frame ${actionFrame.selectedLabel}@${actionFrame.selectedFrame}`, write, trajectory]).join(" / ");
  }

  function yesNo(value) { return value ? "yes" : "no"; }
  function nullableYesNo(value) { return value === null || value === undefined ? "n/a" : yesNo(value); }
  function coveringParts(parts = [], selectedId) { return Animotion.renderLayerUtils?.coveringParts?.(parts, selectedId) || parts.filter((part) => part.id !== selectedId && (Animotion.renderOrderDebug?.isLikelyCoveringPart?.(part) || Animotion.cutsceneDepth?.likelyCoveringPart?.(part))); }
  function targetGenerationDebug(action = {}, parts = [], selectedId = null) {
    const focusKey = action.focusKey;
    const base = Animotion.jointCoordinates?.inferJointPose?.(parts) || {};
    const start = pointObject(action.targetDebug?.selectedPartCurrentPosition) || pointFromArray(base[focusKey]);
    const target = pointObject(action.targetDebug?.convertedTarget) || primaryImpactTarget(action, beatById(action.beats, "impact"));
    const bounds = unionBounds(coveringParts(parts, selectedId).map((part) => part.rect).filter(Boolean));
    return {
      rearHandTipStartPosition: start,
      generatedTarget: target,
      headFaceBounds: bounds,
      targetInsideHeadFaceBounds: Boolean(target && bounds && pointInBounds(target, bounds)),
      targetNearHeadFaceBounds: Boolean(target && bounds && pointInBounds(target, expandBounds(bounds, 24))),
    };
  }
  function targetText(target = {}) {
    const start = target.rearHandTipStartPosition, generated = target.generatedTarget, bounds = target.headFaceBounds;
    return `start=${pointText(start)} generated=${pointText(generated)} headFace=${boundsText(bounds)} inside=${yesNo(target.targetInsideHeadFaceBounds)} near=${yesNo(target.targetNearHeadFaceBounds)}`;
  }
  function roleDecisionText(role = {}) {
    if (!role) return "n/a";
    return `selected=${role.selectedPartId || "n/a"} primary=${role.resolvedPrimaryPartId || "n/a"} endpoint=${role.endpointSource || "n/a"} torso=${pointText(role.torsoCenter)} leftHand=${pointText(role.handTipPositions?.left)} rightHand=${pointText(role.handTipPositions?.right)} facing=${pointText(role.facingDirection)} result=${role.result || "n/a"} explicitOverride=${yesNo(role.explicitActionOverride)}`;
  }
  function chainText(chain = {}) {
    if (!chain) return "n/a";
    return `upper=${chain.upperArmId || "n/a"},forearm=${chain.forearmId || "n/a"},hand=${chain.handOrGloveId || "n/a"}`;
  }
  function pointObject(point) {
    if (!point) return null;
    return { x: Math.round(Number(point.x ?? point[0]) || 0), y: Math.round(Number(point.y ?? point[1]) || 0) };
  }
  function pointFromArray(point) { return point ? { x: Math.round(Number(point[0]) || 0), y: Math.round(Number(point[1]) || 0) } : null; }
  function unionBounds(rects = []) {
    if (!rects.length) return null;
    const normalized = rects.map((rect) => ({ x: Number(rect.x) || 0, y: Number(rect.y) || 0, w: Number(rect.w) || 0, h: Number(rect.h) || 0 }));
    const minX = Math.min(...normalized.map((rect) => rect.x)), minY = Math.min(...normalized.map((rect) => rect.y));
    const maxX = Math.max(...normalized.map((rect) => rect.x + rect.w)), maxY = Math.max(...normalized.map((rect) => rect.y + rect.h));
    return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
  }
  function expandBounds(bounds, amount) {
    return { x: bounds.x - amount, y: bounds.y - amount, w: bounds.w + amount * 2, h: bounds.h + amount * 2 };
  }
  function pointInBounds(point, bounds) {
    return point.x >= bounds.x && point.x <= bounds.x + bounds.w && point.y >= bounds.y && point.y <= bounds.y + bounds.h;
  }
  function pointText(point) { return point ? `${point.x},${point.y}` : "n/a"; }
  function boundsText(bounds) { return bounds ? `${bounds.x},${bounds.y},${bounds.w},${bounds.h}` : "n/a"; }
  function drawSequenceText(sequence = []) {
    if (!Array.isArray(sequence) || !sequence.length) return "n/a";
    return sequence.map((entry) => `${entry.index}:${entry.pass}:${entry.partId || entry.kind}:${entry.drawPath || ""}`).join(">");
  }

  function actionTypeFor(action = {}) {
    return Animotion.cutsceneActionSelectors?.actionTemplate?.(action) || null;
  }

  function currentBeatFor(beats = [], frame) {
    const current = Math.round(Number(frame) || 1);
    return beats.reduce((best, beat) => {
      const at = Math.round(Number(beat.at) || 1);
      if (at > current) return best;
      if (!best || at >= Math.round(Number(best.at) || 1)) return beat;
      return best;
    }, null) || beats[0] || null;
  }

  function bodyRootAssistActive(bridge, action) {
    return bridge.bodyAssistEnabled !== false && action.targetDebug?.chosenMotionScope !== "limb-only" && hipRootAnchorPresent(action.anchors);
  }

  function hipRootAnchorPresent(anchors = []) {
    return (Array.isArray(anchors) ? anchors : []).some((anchor) => anchor.key === "hip" && anchor.role === "root");
  }

  function primaryImpactTarget(action, impactBeat) {
    const key = action.focusKey;
    const point = key ? impactBeat?.pose?.[key] : null;
    if (!point) return null;
    return { key, x: Math.round(Number(point[0]) || 0), y: Math.round(Number(point[1]) || 0) };
  }

  function recoilFrame(beats = []) {
    const beat = beats.find((entry) => Number(entry.recoil) < 0);
    return beat?.at || null;
  }

  function recoilLabel(actionType) {
    return actionType === "punch" ? "windup" : "recoil";
  }

  function frameFor(beats = [], id) {
    return beatById(beats, id)?.at || null;
  }

  function beatById(beats = [], id) {
    return (Array.isArray(beats) ? beats : []).find((beat) => beat.id === id) || null;
  }

  function compact(values) {
    return values.filter((value) => value !== null && value !== undefined && value !== "");
  }

  Animotion.cutsceneMotionStatus = { statusForBridge, statusText, debugText };
  if (typeof module !== "undefined") module.exports = Animotion.cutsceneMotionStatus;
}
