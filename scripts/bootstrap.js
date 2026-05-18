{
  const scripts = [
    "config",
    "geometry",
    "coordinate-spaces",
    "project-model",
    "project-serialization",
    "correspondence-model",
    "dom-state",
    "command-history",
    "view",
    "path",
    "panel-editor",
    "panel-commands",
    "rigging",
    "motion-model",
    "motion-hints",
    "motion-drafts",
    "motion-target-policy",
    "joint-coordinates",
    "cutscene-model",
    "motion-anchors",
    "motion-panel-mapper",
    "motion-planner",
    "motion-anchor-picker",
    "correspondence-commands",
    "correspondence-editor",
    "motion-trajectory-editor",
    "pose-assist",
    "timeline",
    "parts",
    "part-commands",
    "motion-commands",
    "session-commands",
    "motion",
    "cutscene-effects",
    "cutscene-controls",
    "cutscene-options",
    "lookism-preset-data",
    "lookism-preset-action",
    "lookism-preset-assets",
    "lookism-preset-parts",
    "lookism-preset-renderer",
    "lookism-preset",
    "preview-transform",
    "preview",
    "render",
    "ui",
    "motion-draft-editor",
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
