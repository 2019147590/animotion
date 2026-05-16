{
  const global = window;
  const Animotion = global.Animotion;

  function animationLoop(now) {
    Animotion.render.drawSource();
    Animotion.render.drawPreview(now);
    requestAnimationFrame(animationLoop);
  }

  Animotion.events.bindEvents();
  Animotion.timelineControls.bindTimelineControls();
  Animotion.ui.refreshUi();
  requestAnimationFrame(animationLoop);
}
