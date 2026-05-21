{
  const scripts = [
    "config",
    "geometry",
    "coordinate-spaces",
    "hidden-completion-assets",
    "hidden-completion-request",
    "hidden-completion-prep",
    "hidden-completion-result",
    "hidden-completion-provider",
    "hidden-completion-client",
    "human-rig-schema",
    "rig-connection",
    "project-model",
    "project-serialization",
    "scripted-genga-runner",
    "scripted-genga-sample-definition",
    "scripted-genga-generator",
    "scripted-genga-motion-preset",
    "correspondence-model",
    "dom-state",
    "edit-target-inspector",
    "command-history",
    "history-shortcuts",
    "pose-drag-history",
    "view",
    "path",
    "panel-editor",
    "panel-commands",
    "rigging",
    "motion-model",
    "motion-hints",
    "motion-drafts",
    "motion-target-policy",
    "motion-target-state",
    "motion-target-debug",
    "character-root-motion",
    "action-timeline-model",
    "impact-exaggeration-layer",
    "cutscene-motion-status",
    "joint-coordinates",
    "cutscene-model",
    "motion-anchors",
    "motion-panel-mapper",
    "motion-planner",
    "motion-planner-commands",
    "motion-anchor-picker",
    "motion-trajectory-tracks",
    "preview-hit-test",
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
    "preview-coordinate",
    "preview-rig-points",
    "cutscene-depth",
    "preview",
    "render",
    "ui",
    "motion-draft-editor",
    "hidden-completion-guide-editor",
    "hidden-completion-part-panel",
    "preview-pointer-arbitration",
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
