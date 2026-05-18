const assert = require("node:assert/strict");

globalThis.Animotion = {};
const previewCoordinate = require("../scripts/preview-coordinate.js");

function test(name, fn) {
  try {
    fn();
    console.log(`PASS ${name}`);
  } catch (error) {
    console.error(`FAIL ${name}`);
    throw error;
  }
}

function contextForZoom(zoom, partMatrix = identity()) {
  const part = { id: "head", rect: { x: 10, y: 8, w: 40, h: 30 } };
  return {
    part,
    partMatrix,
    view: { x: 0, y: 0, w: 100 * zoom, h: 80 * zoom },
    sourceFrame: { x: 0, y: 0, w: 100, h: 80, sourceWidth: 100, sourceHeight: 80 },
    sourceTransform: { x: 0, y: 0, scale: 1 },
  };
}

function dragSession(context, startLocal) {
  const startPointer = previewCoordinate.partLocalToPreviewPoint(startLocal, context);
  return {
    ...context,
    coordinateSpace: "part-local",
    startPointLocalPosition: startLocal,
    startPointNormalizedPosition: previewCoordinate.partLocalToNormalizedPoint(startLocal, context.part),
    startPointerPreviewPosition: startPointer,
    startPointerLocalPosition: previewCoordinate.previewToPartLocalPoint(startPointer, context),
    grabOffset: { x: 0, y: 0 },
  };
}

function renderedDeltaAfterPointerMove(zoom, screenDelta, matrix = identity()) {
  const context = contextForZoom(zoom, matrix);
  const startLocal = { x: 12, y: 9 };
  const session = dragSession(context, startLocal);
  const movedPointer = {
    x: session.startPointerPreviewPosition.x + screenDelta.x,
    y: session.startPointerPreviewPosition.y + screenDelta.y,
  };
  const movedLocal = previewCoordinate.dragLocalPoint(session, movedPointer);
  const movedRendered = previewCoordinate.partLocalToPreviewPoint(movedLocal, context);
  return {
    x: movedRendered.x - session.startPointerPreviewPosition.x,
    y: movedRendered.y - session.startPointerPreviewPosition.y,
    local: movedLocal,
    rendered: movedRendered,
    context,
  };
}

function identity() {
  return { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 };
}

function translate(x, y) {
  return { a: 1, b: 0, c: 0, d: 1, e: x, f: y };
}

function approxPoint(actual, expected) {
  assert.equal(Number(actual.x.toFixed(6)), expected.x);
  assert.equal(Number(actual.y.toFixed(6)), expected.y);
}

test("dragging a point 10px right renders it 10px right", () => {
  approxPoint(renderedDeltaAfterPointerMove(1, { x: 10, y: 0 }), { x: 10, y: 0 });
});

test("dragging keeps the same screen feel at 50, 100, and 200 percent zoom", () => {
  for (const zoom of [0.5, 1, 2]) {
    approxPoint(renderedDeltaAfterPointerMove(zoom, { x: 10, y: 6 }), { x: 10, y: 6 });
  }
});

test("dragging preserves the pointer grab offset without retargeting the point", () => {
  const context = contextForZoom(1);
  const startLocal = { x: 12, y: 9 };
  const startRendered = previewCoordinate.partLocalToPreviewPoint(startLocal, context);
  const startPointer = { x: startRendered.x + 4, y: startRendered.y - 3 };
  const session = {
    ...dragSession(context, startLocal),
    startPointerPreviewPosition: startPointer,
    startPointerLocalPosition: previewCoordinate.previewToPartLocalPoint(startPointer, context),
  };
  const movedLocal = previewCoordinate.dragLocalPoint(session, { x: startPointer.x + 10, y: startPointer.y });
  const movedRendered = previewCoordinate.partLocalToPreviewPoint(movedLocal, context);
  approxPoint({ x: movedRendered.x - startRendered.x, y: movedRendered.y - startRendered.y }, { x: 10, y: 0 });
});

test("pose drag image delta is not clamped to source image bounds", () => {
  const context = contextForZoom(1);
  const session = {
    ...context,
    startPointerImagePosition: { x: 12, y: 9 },
  };
  const movedPointer = previewCoordinate.imageToPreviewPoint({ x: 160, y: -20 }, context);
  approxPoint(previewCoordinate.dragImageDelta(session, movedPointer), { x: 148, y: -29 });
});

test("dragging outside all part rect edges preserves outside local coordinates", () => {
  const context = contextForZoom(1);
  const session = dragSession(context, { x: 12, y: 9 });
  for (const local of [{ x: -5, y: 9 }, { x: 12, y: -4 }, { x: 47, y: 9 }, { x: 12, y: 36 }]) {
    const pointer = previewCoordinate.partLocalToPreviewPoint(local, context);
    approxPoint(previewCoordinate.dragLocalPoint(session, pointer), local);
  }
});

test("saving normalized point data and loading it renders at the same position", () => {
  const result = renderedDeltaAfterPointerMove(1, { x: 10, y: 0 });
  const normalized = previewCoordinate.partLocalToNormalizedPoint(result.local, result.context.part);
  const loaded = previewCoordinate.normalizedToPartLocalPoint(normalized, result.context.part);
  const loadedRendered = previewCoordinate.partLocalToPreviewPoint(loaded, result.context);
  approxPoint({
    x: loadedRendered.x - result.rendered.x,
    y: loadedRendered.y - result.rendered.y,
  }, { x: 0, y: 0 });
});

test("head point drag uses the frozen parent/root transform once", () => {
  const result = renderedDeltaAfterPointerMove(1, { x: 10, y: 0 }, translate(32, -14));
  approxPoint(result, { x: 10, y: 0 });
});
