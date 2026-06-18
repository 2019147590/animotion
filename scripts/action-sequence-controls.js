{
  const global = typeof window !== "undefined" ? window : globalThis;
  const Animotion = global.Animotion || (global.Animotion = {});
  let statusMessage = "";

  function installControls() {
    if (typeof document === "undefined") return;
    const anchor = document.querySelector("#motionPlanStatus");
    if (!anchor || document.querySelector("#actionSequenceControls")) return;
    const panel = document.createElement("div");
    panel.id = "actionSequenceControls";
    panel.className = "motion-planner-tools";
    panel.innerHTML = controlsMarkup();
    anchor.after(panel);
    refs().add.addEventListener("click", addSelectedTemplate);
    refs().preset.addEventListener("click", useDefaultSequence);
    refs().clear.addEventListener("click", clearSequence);
    refs().generate.addEventListener("click", generateSequence);
    refs().saveClip.addEventListener("click", saveCurrentClip);
    refs().resetJson.addEventListener("click", resetLoadedJson);
    refs().addClip.addEventListener("click", addSelectedClip);
    refreshControls();
  }

  function refreshControls() {
    const ui = refs();
    if (!ui.panel) return;
    const sequence = currentSequence();
    const clips = currentClips();
    const selectedTemplate = ui.template.value;
    const selectedClip = ui.clip.value;
    ui.template.innerHTML = optionMarkup();
    if ([...ui.template.options].some((option) => option.value === selectedTemplate)) ui.template.value = selectedTemplate;
    ui.clip.innerHTML = clipOptionMarkup(clips);
    if ([...ui.clip.options].some((option) => option.value === selectedClip)) ui.clip.value = selectedClip;
    ui.list.replaceChildren(...sequence.steps.map((step, index) => rowForStep(step, index, sequence.steps.length)));
    ui.empty.classList.toggle("hidden", Boolean(sequence.steps.length));
    ui.add.disabled = !ui.template.value || sequence.steps.length >= (Animotion.actionSequence?.MAX_STEPS || 6);
    ui.saveClip.disabled = !canSaveCurrentClip();
    ui.addClip.disabled = !ui.clip.value || sequence.steps.length >= (Animotion.actionSequence?.MAX_STEPS || 6);
    ui.generate.disabled = !canGenerate(sequence);
    ui.status.textContent = statusMessage || summaryText(sequence);
    ui.clipStatus.textContent = clips.length ? `${clips.length}\uAC1C \uCEF7\uC2E0 \uC800\uC7A5\uB428` : "\uC800\uC7A5\uB41C \uCEF7\uC2E0\uC774 \uC5C6\uC2B5\uB2C8\uB2E4.";
  }

  function addSelectedTemplate() {
    const ui = refs();
    const sequence = currentSequence();
    setSequence([...sequence.steps, { template: ui.template.value }]);
  }

  function addSelectedClip() {
    const ui = refs();
    setSequence([...currentSequence().steps, { clipId: ui.clip.value }]);
  }

  async function saveCurrentClip() {
    const clips = currentClips();
    const name = Animotion.cutsceneClipStore?.nextClipName?.(clips) || `cutscene${clips.length + 1}`;
    statusMessage = `${name} \uC601\uC0C1 \uC800\uC7A5 \uC911...`;
    refreshControls();
    const clip = await Animotion.cutsceneClipStore?.clipFromCurrentState?.(Animotion.state, {
      id: `cutscene-${Date.now()}-${clips.length + 1}`,
      name,
    });
    if (!clip?.videoUrl) {
      statusMessage = clip?.reason === "unsupported-video-recording"
        ? "\uC774 \uBE0C\uB77C\uC6B0\uC800\uB294 \uCEF7\uC2E0 \uC601\uC0C1 \uC800\uC7A5\uC744 \uC9C0\uC6D0\uD558\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4."
        : "\uC800\uC7A5\uD560 \uCEF7\uC2E0 \uC601\uC0C1\uC774 \uC5C6\uC2B5\uB2C8\uB2E4.";
      refreshControls();
      return;
    }
    Animotion.state.actionSequenceClips = [...clips, clip];
    statusMessage = `${name} \uC601\uC0C1 \uC800\uC7A5\uB428`;
    refresh();
  }

  function resetLoadedJson() {
    const result = Animotion.cutsceneClipStore?.clearLoadedJsonState?.(Animotion.state);
    statusMessage = result?.ok
      ? "JSON \uB370\uC774\uD130\uB97C \uCD08\uAE30\uD654\uD588\uC2B5\uB2C8\uB2E4. \uC774\uBBF8 \uC800\uC7A5\uD55C \uCEF7\uC2E0\uC740 \uC720\uC9C0\uB429\uB2C8\uB2E4."
      : "JSON \uCD08\uAE30\uD654\uC5D0 \uC2E4\uD328\uD588\uC2B5\uB2C8\uB2E4.";
    refresh();
  }

  function useDefaultSequence() {
    setSequence(Animotion.actionSequence?.defaultSequence?.().steps || []);
  }

  function clearSequence() {
    setSequence([]);
  }

  function moveStep(index, delta) {
    const steps = [...currentSequence().steps];
    const nextIndex = index + delta;
    if (nextIndex < 0 || nextIndex >= steps.length) return;
    [steps[index], steps[nextIndex]] = [steps[nextIndex], steps[index]];
    setSequence(steps);
  }

  function removeStep(index) {
    setSequence(currentSequence().steps.filter((_, candidateIndex) => candidateIndex !== index));
  }

  function generateSequence() {
    if (canPlayVideoSequence(currentSequence())) return playVideoSequence();
    const parts = partsForGeneration(currentSequence());
    if (!Animotion.state.parts?.length && parts.length) {
      Animotion.state.parts = clonePlain(parts);
      if (Animotion.state.project) Animotion.state.project.parts = Animotion.state.parts;
    }
    const compiled = Animotion.actionSequence?.compileSequence?.(Animotion.state.parts, currentSequence(), {
      plan: Animotion.motionCommands?.currentMotionPlan?.() || Animotion.state.motionPlan,
      bridge: Animotion.state.cutsceneBridge,
      selectedPartId: Animotion.state.selectedPartId,
      clips: currentClips(),
    });
    if (!compiled?.generated) {
      statusMessage = failureText(compiled?.reason);
      refreshControls();
      return;
    }
    statusMessage = successText(compiled.sequence);
    Animotion.motionCommands.applyMotionPlanResult(compiled.bridge, compiled.plan, compiled.result);
    Animotion.state.actionSequence = compiled.sequence;
    if (Animotion.dom?.els?.motionTemplate) Animotion.dom.els.motionTemplate.value = "cutscene";
    if (Animotion.timelineControls?.setCurrentFrame) Animotion.timelineControls.setCurrentFrame(compiled.bridge.impactFrame);
    else refresh();
  }
  async function playVideoSequence() {
    const result = await Animotion.cutsceneClipStore?.playSequence?.(currentSequence(), currentClips());
    statusMessage = result?.ok ? `${summaryText(currentSequence())} \uC601\uC0C1 \uC5F0\uC18D\uC7AC\uC0DD \uC644\uB8CC` : failureText(result?.reason);
    refreshControls();
  }

  function rowForStep(step, index, count) {
    const row = document.createElement("div");
    row.className = "button-row";
    const label = document.createElement("span");
    label.className = "hint";
    label.textContent = `${index + 1}. ${labelForStep(step)}`;
    row.append(label, iconButton("up", "\u2191", index === 0, () => moveStep(index, -1)), iconButton("down", "\u2193", index === count - 1, () => moveStep(index, 1)), iconButton("remove", "\u00d7", false, () => removeStep(index)));
    return row;
  }

  function iconButton(label, text, disabled, handler) {
    const button = document.createElement("button");
    button.type = "button";
    button.title = label;
    button.textContent = text;
    button.disabled = disabled;
    button.addEventListener("click", handler);
    return button;
  }

  function setSequence(steps) {
    statusMessage = "";
    Animotion.state.actionSequence = Animotion.actionSequence?.normalizeSequence?.({ steps }) || { steps: [] };
    refresh();
  }

  function currentSequence() {
    return Animotion.actionSequence?.normalizeSequence?.(Animotion.state?.actionSequence || {}) || { steps: [] };
  }

  function currentClips() {
    return Array.isArray(Animotion.state?.actionSequenceClips) ? Animotion.state.actionSequenceClips : [];
  }

  function canGenerate(sequence) {
    return Boolean(canPlayVideoSequence(sequence) || (sequence.steps.length && (Animotion.state?.parts?.length || partsForGeneration(sequence).length)));
  }

  function controlsMarkup() {
    return `
      <div class="action-frame-title">\uC5F0\uC18D\uB3D9\uC791</div>
      <label>
        \uCD94\uAC00\uD560 \uB3D9\uC791
        <select id="actionSequenceTemplate"></select>
      </label>
      <div class="button-row">
        <button id="addActionSequenceStep" type="button">\uCD94\uAC00</button>
        <button id="useActionSequencePreset" type="button">\uC7BD-\uC7BD-\uB4B7\uC190\uD380\uCE58_01</button>
      </div>
      <label>
        \uC800\uC7A5\uD55C \uCEF7\uC2E0
        <select id="actionSequenceClip"></select>
      </label>
      <div class="button-row">
        <button id="saveCurrentCutsceneClip" type="button">\uD604\uC7AC \uCEF7\uC2E0 \uC800\uC7A5</button>
        <button id="resetLoadedJsonProject" type="button">JSON \uCD08\uAE30\uD654</button>
        <button id="addActionSequenceClip" type="button">\uCEF7\uC2E0 \uCD94\uAC00</button>
      </div>
      <p id="actionSequenceClipStatus" class="hint"></p>
      <div id="actionSequenceList"></div>
      <p id="emptyActionSequence" class="hint">\uB3D9\uC791\uC744 \uCD94\uAC00\uD558\uBA74 \uC704\uC5D0\uC11C \uC21C\uC11C\uB97C \uBC14\uAFC0 \uC218 \uC788\uC2B5\uB2C8\uB2E4.</p>
      <div class="button-row">
        <button id="generateActionSequence" type="button">\uC5F0\uC18D\uB3D9\uC791 \uC0DD\uC131</button>
        <button id="clearActionSequence" type="button">\uBE44\uC6B0\uAE30</button>
      </div>
      <p id="actionSequenceStatus" class="hint"></p>
    `;
  }

  function optionMarkup() {
    return optionSpecs().map((item) => `<option value="${escapeHtml(item.id)}">${escapeHtml(sequenceLabel(item))}</option>`).join("");
  }

  function clipOptionMarkup(clips) {
    return clips.map((clip) => `<option value="${escapeHtml(clip.id)}">${escapeHtml(clip.name)}</option>`).join("");
  }

  function optionSpecs() {
    return (Animotion.actionSpecs?.optionSpecs?.() || []).filter((item) => item.family !== "locomotion");
  }

  function sequenceLabel(item) {
    return item.id === "punch" ? "\uC7BD" : item.label;
  }

  function labelForTemplate(template) {
    if (template === "punch") return "\uC7BD";
    return Animotion.actionSpecs?.specFor?.(template)?.label || template;
  }

  function labelForStep(step) {
    if (step.clipId) return currentClips().find((clip) => clip.id === step.clipId)?.name || step.clipId;
    return labelForTemplate(step.template);
  }

  function summaryText(sequence) {
    if (!sequence.steps.length) return "\uC5F0\uC18D\uB3D9\uC791 \uBC30\uC5F4\uC774 \uBE44\uC5B4 \uC788\uC2B5\uB2C8\uB2E4.";
    return sequence.steps.map(labelForStep).join(" - ");
  }

  function successText(sequence) {
    return `${summaryText(sequence)} \uC0DD\uC131\uC644\uB8CC`;
  }

  function failureText(reason) {
    const messages = {
      "empty-sequence": "\uC5F0\uC18D\uB3D9\uC791\uC5D0 \uC801\uC5B4\uB3C4 \uD558\uB098\uC758 \uB3D9\uC791\uC744 \uB123\uC5B4\uC8FC\uC138\uC694.",
      "missing-parts": "\uD30C\uD2B8\uAC00 \uC788\uB294 \uBCF5\uC11C \uD504\uB85C\uC81D\uD2B8\uB97C \uBA3C\uC800 \uB85C\uB4DC\uD558\uC138\uC694.",
      "missing-primary": "\uC0DD\uC131\uD560 \uD314/\uB2E4\uB9AC/\uBAB8\uD1B5 \uD30C\uD2B8\uB97C \uCC3E\uC9C0 \uBABB\uD588\uC2B5\uB2C8\uB2E4.",
      "sequence-too-long": "\uC5F0\uC18D\uB3D9\uC791\uC774 120\uD504\uB808\uC784\uC744 \uB118\uC5B4 \uC904\uC5EC\uC57C \uD569\uB2C8\uB2E4.",
      "missing-clip": "\uC5F0\uC18D\uB3D9\uC791\uC5D0 \uC788\uB294 JSON \uD074\uB9BD\uC744 \uCC3E\uC9C0 \uBABB\uD588\uC2B5\uB2C8\uB2E4.",
      "missing-video-clip": "\uC5F0\uC18D\uC7AC\uC0DD\uD560 \uC601\uC0C1 \uCEF7\uC2E0\uC744 \uCC3E\uC9C0 \uBABB\uD588\uC2B5\uB2C8\uB2E4.",
    };
    return messages[reason] || "\uC5F0\uC18D\uB3D9\uC791 \uC0DD\uC131\uC5D0 \uC2E4\uD328\uD588\uC2B5\uB2C8\uB2E4.";
  }

  function refs() {
    return {
      panel: document.querySelector("#actionSequenceControls"),
      template: document.querySelector("#actionSequenceTemplate"),
      add: document.querySelector("#addActionSequenceStep"),
      preset: document.querySelector("#useActionSequencePreset"),
      saveClip: document.querySelector("#saveCurrentCutsceneClip"),
      resetJson: document.querySelector("#resetLoadedJsonProject"),
      clip: document.querySelector("#actionSequenceClip"),
      addClip: document.querySelector("#addActionSequenceClip"),
      clipStatus: document.querySelector("#actionSequenceClipStatus"),
      clear: document.querySelector("#clearActionSequence"),
      generate: document.querySelector("#generateActionSequence"),
      list: document.querySelector("#actionSequenceList"),
      empty: document.querySelector("#emptyActionSequence"),
      status: document.querySelector("#actionSequenceStatus"),
    };
  }

  function refresh() {
    Animotion.ui?.refreshUi?.();
  }

  function partsForGeneration(sequence) {
    if (Animotion.state?.parts?.length) return Animotion.state.parts;
    const ids = new Set(sequence.steps.map((step) => step.clipId).filter(Boolean));
    return currentClips().find((clip) => ids.has(clip.id) && clip.parts?.length)?.parts || [];
  }

  function canPlayVideoSequence(sequence) {
    const clips = currentClips();
    return Boolean(sequence.steps.length && sequence.steps.every((step) => clips.find((clip) => clip.id === step.clipId)?.videoUrl));
  }

  function canSaveCurrentClip() {
    return Boolean(Animotion.state?.parts?.length && Animotion.state?.cutsceneBridge?.jointAction);
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[char]);
  }

  Animotion.actionSequenceControls = { installControls, refreshControls };
  installControls();
  if (typeof module !== "undefined") module.exports = Animotion.actionSequenceControls;
}
