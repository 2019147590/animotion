{
  const global = window;
  const Animotion = global.Animotion;
  const state = Animotion.state;

  function currentList() {
    state.correspondences = Animotion.correspondenceModel.normalizeList(state.correspondences, state.parts);
    return state.correspondences;
  }

  function selectedCorrespondence() {
    const part = Animotion.parts?.selectedPart?.() || selectedPart();
    if (!part) return null;
    return currentList().find((item) => item.sourcePartId === part.id) || null;
  }

  function upsertForSelectedPart(patch = {}, options = {}) {
    const part = selectedPart();
    if (!part) return null;
    const previous = selectedCorrespondence();
    const next = Animotion.correspondenceModel.createForPart(part, { ...previous, ...patch });
    if (!next) return null;
    const before = cloneValue(currentList());
    state.correspondences = [...before.filter((item) => item.sourcePartId !== part.id), next];
    syncProject();
    recordChange(before, cloneValue(state.correspondences), options);
    return next;
  }

  function setCorrespondences(correspondences = [], options = {}) {
    const before = cloneValue(currentList());
    state.correspondences = Animotion.correspondenceModel.normalizeList(correspondences, state.parts);
    syncProject();
    recordChange(before, cloneValue(state.correspondences), options);
    return state.correspondences;
  }

  function selectedPart() {
    return state.parts.find((part) => part.id === state.selectedPartId) || null;
  }

  function syncProject() {
    if (!state.project) return;
    state.project.editor ||= {};
    state.project.editor.correspondences = cloneValue(state.correspondences);
  }

  function recordChange(before, after, options) {
    if (options.recordHistory === false || sameValue(before, after)) return;
    Animotion.commandHistory?.record?.({
      label: "correspondence-update",
      undo: () => setCorrespondences(before, { recordHistory: false }),
      redo: () => setCorrespondences(after, { recordHistory: false }),
    });
  }

  function sameValue(left, right) {
    return JSON.stringify(left) === JSON.stringify(right);
  }

  function cloneValue(value) {
    if (value === undefined || value === null) return value;
    return JSON.parse(JSON.stringify(value));
  }

  Animotion.correspondenceCommands = { currentList, selectedCorrespondence, upsertForSelectedPart, setCorrespondences };
}
