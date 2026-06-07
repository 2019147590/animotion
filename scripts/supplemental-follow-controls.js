{
  const global = typeof window !== "undefined" ? window : globalThis;
  const Animotion = global.Animotion || (global.Animotion = {});
  const IDS = {
    convert: "markSupplementalFollowPart",
    shoulder: "setSupplementalShoulderFill",
    elbow: "setSupplementalElbowJointFill",
    clear: "clearSupplementalFollow",
    status: "supplementalFollowStatus",
  };

  function installControls() {
    if (typeof document === "undefined") return;
    const panel = document.querySelector("#supplementalPartEditor .inspector-section-body");
    if (!panel || document.querySelector(`#${IDS.shoulder}`)) return;
    const row = document.createElement("div");
    row.className = "button-row";
    row.append(button(IDS.convert, "Use as supplemental"), button(IDS.shoulder, "Shoulder fill"), button(IDS.elbow, "Elbow joint fill"), button(IDS.clear, "Clear follow"));
    panel.append(row, statusNode());
    bind(IDS.convert, () => run("markSelectedAsSupplementalPart"));
    bind(IDS.shoulder, () => run("setSelectedSupplementalShoulderFill"));
    bind(IDS.elbow, () => run("setSelectedSupplementalElbowJointFill"));
    bind(IDS.clear, () => run("clearSelectedSupplementalFollow"));
  }

  function refreshControls() {
    installControls();
    const refs = controls();
    if (!refs.status) return;
    const part = Animotion.parts?.selectedPart?.() || null;
    const canShow = part?.isSupplementalPart === true || Animotion.supplementalFollowCommands?.canShowForPart?.(part);
    const enabled = canShow && Boolean(Animotion.supplementalFollow);
    refs.convert.disabled = !Animotion.supplementalFollowCommands?.canConvertSelectedPart?.();
    refs.shoulder.disabled = !enabled;
    refs.elbow.disabled = !enabled;
    refs.clear.disabled = !canShow || !part?.supplementalFollow;
    refs.status.textContent = statusText(part);
  }

  function run(commandName) {
    const result = Animotion.partCommands?.[commandName]?.();
    if (result) {
      Animotion.ui?.refreshUi?.();
      refreshControls();
    }
  }

  function statusText(part) {
    if (Animotion.supplementalFollowCommands?.canConvertSelectedPart?.()) return "Supplemental follow: copied part can be used as a non-destructive supplemental part.";
    if (!part?.isSupplementalPart) return "Supplemental follow: select a supplemental part.";
    const follow = part.supplementalFollow;
    if (follow?.kind === "shoulderFill") return `Supplemental follow: shoulderFill fixed to ${follow.driverPartId || "-"}.`;
    if (follow?.kind === "elbowJointFill") return `Supplemental follow: elbowJointFill ${follow.driverAId || "-"} -> ${follow.driverBId || "-"}.`;
    return "Supplemental follow: none.";
  }

  function button(id, text) {
    const item = document.createElement("button");
    item.id = id;
    item.type = "button";
    item.textContent = text;
    return item;
  }

  function statusNode() {
    const node = document.createElement("p");
    node.id = IDS.status;
    node.className = "hint";
    node.textContent = "Supplemental follow: none.";
    return node;
  }

  function bind(id, handler) {
    const element = document.querySelector(`#${id}`);
    if (element && !element.dataset.supplementalFollowBound) {
      element.addEventListener("click", handler);
      element.dataset.supplementalFollowBound = "true";
    }
  }

  function controls() {
    return {
      shoulder: document.querySelector(`#${IDS.shoulder}`),
      convert: document.querySelector(`#${IDS.convert}`),
      elbow: document.querySelector(`#${IDS.elbow}`),
      clear: document.querySelector(`#${IDS.clear}`),
      status: document.querySelector(`#${IDS.status}`),
    };
  }

  Animotion.supplementalFollowControls = { installControls, refreshControls, statusText };
  refreshControls();
  if (typeof module !== "undefined") module.exports = Animotion.supplementalFollowControls;
}
