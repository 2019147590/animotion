const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

const tests = [];

function test(name, fn) {
  tests.push({ name, fn });
}

function loadAnimotion() {
  const context = {
    window: { Animotion: {}, MediaRecorder: FakeMediaRecorder },
    performance: { now: () => 1000 },
    setTimeout: (fn) => { fn(); return 1; },
    Blob: FakeBlob,
    URL: { createObjectURL: () => "blob:cutscene" },
  };
  vm.createContext(context);
  for (const path of [
    "scripts/config.js",
    "scripts/geometry.js",
    "scripts/coordinate-spaces.js",
    "scripts/project-model.js",
    "scripts/motion-model.js",
    "scripts/motion-hints.js",
    "scripts/motion-drafts.js",
    "scripts/motion-target-state.js",
    "scripts/motion-target-debug.js",
    "scripts/character-root-motion.js",
    "scripts/action-specs.js",
    "scripts/action-timeline-model.js",
    "scripts/cutscene-action-selectors.js",
    "scripts/impact-exaggeration-layer.js",
    "scripts/rig-connection.js",
    "scripts/arm-chain-resolver.js",
    "scripts/pose-assist.js",
    "scripts/joint-coordinates.js",
    "scripts/cutscene-model.js",
    "scripts/motion-anchors.js",
    "scripts/timeline.js",
    "scripts/motion-track-builder.js",
    "scripts/boxing-step-locomotion.js",
    "scripts/motion-planner.js",
    "scripts/motion-primary-selection.js",
    "scripts/action-sequence.js",
  ]) runScript(context, path);
  const Animotion = context.window.Animotion;
  Animotion.dom = {
    previewCanvas: { captureStream: () => ({}) },
    els: { motionTemplate: { value: "cutscene" }, motionStrength: { value: "1" } },
  };
  Animotion.state = { running: false, currentFrame: 1, parts: [], selectedPartId: null };
  runScript(context, "scripts/motion.js");
  runScript(context, "scripts/cutscene-clip-store.js");
  Animotion.commandHistory = { cleared: false, clear() { this.cleared = true; } };
  return Animotion;
}

function runScript(context, path) {
  vm.runInContext(fs.readFileSync(path, "utf8"), context, { filename: path });
}

function loadProjectState(Animotion, path) {
  const payload = JSON.parse(fs.readFileSync(path, "utf8"));
  const project = Animotion.projectModel.normalizeProject(payload, { imageBounds: canvasBounds(payload) });
  const parts = Animotion.projectModel.editorPartsFromProject(project);
  return {
    project: Animotion.projectModel.attachEditorParts(project, parts),
    image: { naturalWidth: payload.canvas.width, naturalHeight: payload.canvas.height },
    imageName: path,
    parts,
    selectedPartId: project.editor?.selectedPartId || parts[0]?.id || null,
    currentFrame: project.timeline?.currentFrame || 1,
    cutsceneBridge: project.editor?.cutsceneBridge || null,
    motionPlan: project.editor?.motionPlan || { template: "kick", target: null, targetMode: false },
    actionSequence: { steps: [] },
    actionSequenceClips: [],
    editTarget: { kind: "part", partId: null, maskId: null },
  };
}

test("current loaded json motion can be saved as video cutscene clips and replayed in order", async () => {
  const Animotion = loadAnimotion();
  Object.assign(Animotion.state, loadProjectState(Animotion, "animotion-project (8).json"));
  const jab = await Animotion.cutsceneClipStore.clipFromCurrentState(Animotion.state, { id: "cutscene1", name: "cutscene1" });
  Object.assign(Animotion.state, loadProjectState(Animotion, "animotion-project (17).json"));
  const rear = await Animotion.cutsceneClipStore.clipFromCurrentState(Animotion.state, { id: "cutscene2", name: "cutscene2" });
  const player = fakeVideo();
  const played = await Animotion.cutsceneClipStore.playSequence({
    steps: [{ clipId: "cutscene1" }, { clipId: "cutscene1" }, { clipId: "cutscene2" }],
  }, [jab, rear], { video: player });

  assert.equal(jab.name, "cutscene1");
  assert.equal(rear.name, "cutscene2");
  assert.equal(jab.capturedVideo, true);
  assert.equal(jab.videoUrl, "blob:cutscene");
  assert.equal(played.ok, true);
  assert.deepEqual(player.playedSources, ["blob:cutscene", "blob:cutscene", "blob:cutscene"]);
});

test("saved video sequence renders through the preview canvas path", () => {
  const Animotion = loadAnimotion();
  const ctx = fakeContext();
  const video = { readyState: 2, videoWidth: 160, videoHeight: 90 };
  Animotion.state.actionSequenceVideoPlayback = { active: true, video, clip: { name: "cutscene1" } };

  const handled = Animotion.cutsceneClipStore.drawPreviewPlayback(ctx, { w: 320, h: 180 });

  assert.equal(handled, true);
  assert.equal(ctx.drawImageCalls.length, 1);
  assert.deepEqual(ctx.drawImageCalls[0].slice(1), [0, 0, 320, 180]);
});

test("preview canvas is not claimed before a saved video frame is drawable", () => {
  const Animotion = loadAnimotion();
  const ctx = fakeContext();
  Animotion.state.actionSequenceVideoPlayback = { active: true, video: { readyState: 0 }, clip: { name: "cutscene1" } };

  const handled = Animotion.cutsceneClipStore.drawPreviewPlayback(ctx, { w: 320, h: 180 });

  assert.equal(handled, false);
  assert.equal(ctx.fillRectCalls.length, 0);
  assert.equal(ctx.drawImageCalls.length, 0);
});

test("json reset clears current project motion while preserving saved video cutscene clips", async () => {
  const Animotion = loadAnimotion();
  Object.assign(Animotion.state, loadProjectState(Animotion, "animotion-project (17).json"));
  const saved = await Animotion.cutsceneClipStore.clipFromCurrentState(Animotion.state, { id: "cutscene1" });
  Animotion.state.actionSequenceClips = [saved];
  Animotion.state.actionSequence = { steps: [{ clipId: "cutscene1" }] };

  const result = Animotion.cutsceneClipStore.clearLoadedJsonState(Animotion.state);

  assert.equal(result.ok, true);
  assert.equal(Animotion.state.parts.length, 0);
  assert.equal(Animotion.state.cutsceneBridge, null);
  assert.deepEqual(Animotion.state.actionSequenceClips.map((clip) => clip.id), ["cutscene1"]);
  assert.deepEqual(Animotion.state.actionSequence.steps, [{ clipId: "cutscene1" }]);
  assert.equal(Animotion.dom.els.motionTemplate.value, "keyframes");
  assert.equal(Animotion.commandHistory.cleared, true);
});

function canvasBounds(payload) {
  return { width: payload.canvas.width, height: payload.canvas.height };
}

function fakeVideo() {
  return {
    playedSources: [],
    classList: { remove() {} },
    set src(value) { this.currentSrc = value; },
    get src() { return this.currentSrc; },
    play() {
      this.playedSources.push(this.currentSrc);
      Promise.resolve().then(() => this.onended?.());
      return Promise.resolve();
    },
    pause() {},
  };
}

function fakeContext() {
  return {
    drawImageCalls: [],
    fillRectCalls: [],
    fillTextCalls: [],
    set fillStyle(value) { this.lastFillStyle = value; },
    set textAlign(value) { this.lastTextAlign = value; },
    set font(value) { this.lastFont = value; },
    fillRect(...args) { this.fillRectCalls.push(args); },
    drawImage(...args) { this.drawImageCalls.push(args); },
    fillText(...args) { this.fillTextCalls.push(args); },
  };
}

function FakeBlob(chunks, options) {
  this.chunks = chunks;
  this.type = options?.type || "";
  this.size = chunks.length;
}

function FakeMediaRecorder(stream, options) {
  this.stream = stream;
  this.mimeType = options?.mimeType || "video/webm";
  this.state = "inactive";
}

FakeMediaRecorder.isTypeSupported = () => true;
FakeMediaRecorder.prototype.start = function start() { this.state = "recording"; };
FakeMediaRecorder.prototype.requestData = function requestData() {
  this.ondataavailable?.({ data: { size: 1, bytes: [1] } });
};
FakeMediaRecorder.prototype.stop = function stop() {
  this.state = "inactive";
  this.onstop?.();
};

async function run() {
  for (const entry of tests) {
    try {
      await entry.fn();
      console.log(`PASS ${entry.name}`);
    } catch (error) {
      console.error(`FAIL ${entry.name}`);
      throw error;
    }
  }
}

run();
