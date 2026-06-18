{
  const global = window;
  const Animotion = global.Animotion;

  function installControls() {
    if (typeof document === "undefined" || !Animotion.dom?.els?.playPause) return;
    if (document.querySelector("#playbackSpeed")) return;
    const control = createControl();
    Animotion.dom.els.playPause.closest(".button-row")?.before(control);
    refs().input?.addEventListener("input", updateSpeed);
    refreshControls();
  }

  function createControl() {
    const label = document.createElement("label");
    label.className = "playback-speed-control";
    label.innerHTML = `
      <span>\uC7AC\uC0DD \uBC30\uC18D <strong id="playbackSpeedLabel">1x</strong></span>
      <input id="playbackSpeed" type="range" min="0.25" max="3" step="0.25" value="1" />
    `;
    return label;
  }

  function updateSpeed() {
    const speed = Animotion.playbackSpeed.setSpeed(Animotion.state, refs().input.value);
    render(speed);
  }

  function refreshControls() {
    render(Animotion.playbackSpeed.speedFromState(Animotion.state));
  }

  function render(speed) {
    const ui = refs();
    if (!ui.input || !ui.label) return;
    ui.input.value = String(speed);
    ui.label.textContent = Animotion.playbackSpeed.labelForSpeed(speed);
  }

  function refs() {
    return {
      input: document.querySelector("#playbackSpeed"),
      label: document.querySelector("#playbackSpeedLabel"),
    };
  }

  Animotion.playbackSpeedControls = { installControls, refreshControls };
  installControls();
}
