{
  const scripts = [
    "config",
    "geometry",
    "dom-state",
    "view",
    "path",
    "panel-editor",
    "rigging",
    "motion-model",
    "joint-coordinates",
    "cutscene-model",
    "motion-planner",
    "pose-assist",
    "timeline",
    "parts",
    "motion",
    "cutscene-effects",
    "cutscene-controls",
    "lookism-preset-data",
    "lookism-preset-action",
    "lookism-preset-assets",
    "lookism-preset-parts",
    "lookism-preset-renderer",
    "lookism-preset",
    "preview",
    "render",
    "ui",
    "editor",
    "io",
    "export",
    "events",
    "preview-events",
    "timeline-controls",
    "main",
  ];

  loadScripts(scripts).catch((error) => {
    console.error(error);
    document.body.dataset.bootstrapError = error.message;
  });

  async function loadScripts(names) {
    for (const name of names) await loadScript(`scripts/${name}.js`);
  }

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = src;
      script.onload = resolve;
      script.onerror = () => reject(new Error(`Script load failed: ${src}`));
      document.body.append(script);
    });
  }
}
