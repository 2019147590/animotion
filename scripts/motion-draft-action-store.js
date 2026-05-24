{
  const global = typeof window !== "undefined" ? window : globalThis;
  const Animotion = global.Animotion || (global.Animotion = {});

  function activeDraftContext(state = Animotion.state, options = {}) {
    const action = Animotion.cutsceneActionSelectors?.getActiveJointAction?.(state)?.action;
    const partId = selectedPartId(state);
    const linked = draftForPart(action, partId, options);
    if (linked) return { scope: "action-hidden-completion", draft: linked };
    if (action?.motionDraft) return { scope: "action-snapshot", draft: normalizeDraft(action.motionDraft, options) };
    const plan = Animotion.motionCommands?.currentMotionPlan?.() || Animotion.motionPlanner?.normalizePlan?.(state?.motionPlan);
    if (plan?.motionDraft) return { scope: "plan", draft: normalizeDraft(plan.motionDraft, options) };
    return null;
  }

  function withActionDraft(action, draft, options = {}) {
    const snapshot = actionSnapshot(draft, options);
    const next = { ...action, hiddenCompletionDrafts: upsertDraft(action?.hiddenCompletionDrafts, snapshot, options) };
    if (options.setPrimary !== false) next.motionDraft = snapshot;
    return next;
  }

  function preservePreviousDraft(previousAction, nextAction, options = {}) {
    if (!previousAction?.motionDraft?.hiddenCompletion?.assetId) return nextAction;
    return {
      ...nextAction,
      hiddenCompletionDrafts: upsertDraft(nextAction?.hiddenCompletionDrafts, previousAction.motionDraft, options),
    };
  }

  function draftForPart(action, partId, options = {}) {
    if (!partId) return null;
    return normalizeList(action?.hiddenCompletionDrafts, options).find((draft) => draft.partId === partId) || null;
  }

  function upsertDraft(drafts = [], draft, options = {}) {
    const next = actionSnapshot(draft, options);
    const key = draftKey(next);
    return [...normalizeList(drafts, options).filter((item) => draftKey(item) !== key), next];
  }

  function normalizeList(drafts = [], options = {}) {
    const unique = new Map();
    for (const draft of Array.isArray(drafts) ? drafts : []) {
      const normalized = normalizeDraft(draft, options);
      if (!normalized) continue;
      const key = draftKey(normalized);
      if (unique.has(key)) unique.delete(key);
      unique.set(key, normalized);
    }
    return [...unique.values()];
  }

  function actionSnapshot(draft, options = {}) {
    return { ...normalizeDraft(draft, options), draftScope: "action-snapshot" };
  }

  function normalizeDraft(draft, options = {}) {
    return draft ? Animotion.motionDrafts?.normalize?.(draft, options) || draft : null;
  }

  function draftKey(draft) {
    return draft?.partId || "__global__";
  }

  function selectedPartId(state = Animotion.state) {
    return Animotion.parts?.selectedPart?.()?.id || state?.selectedPartId || null;
  }

  Animotion.motionDraftActionStore = {
    activeDraftContext,
    withActionDraft,
    preservePreviousDraft,
    draftForPart,
    upsertDraft,
    normalizeList,
  };
  if (typeof module !== "undefined") module.exports = Animotion.motionDraftActionStore;
}
