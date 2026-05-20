{
  const global = typeof window !== "undefined" ? window : globalThis;
  const Animotion = global.Animotion || (global.Animotion = {});
  const WIDTH = 960;
  const HEIGHT = 540;

  function createDefinition() {
    return clone({
      id: "scripted-genga-cut-v1",
      seed: "scripted-genga-cut-v1",
      name: "Scripted Genga Cut Fixture",
      canvas: { width: WIDTH, height: HEIGHT, fps: 24, durationFrames: 120, backgroundColor: "#f7f0df" },
      visual: { elements: visualElements() },
      parts: parts(),
      hiddenCompletionGuides: [rightForearmHiddenGuide()],
      editor: { selectedPartId: "part-right-forearm", rootPartId: "part-torso", motionPlan: { template: "kick", target: null, targetMode: false } },
    });
  }

  function visualElements() {
    return [
      rect(0, 0, WIDTH, HEIGHT, { fill: "#f7f0df" }),
      path("M232 382 C345 180 610 102 790 302", { fill: "none", stroke: "#f1b83b", "stroke-width": 18, "stroke-linecap": "round", opacity: 0.34 }),
      path("M252 407 C390 230 604 155 832 354", { fill: "none", stroke: "#151515", "stroke-width": 5, "stroke-linecap": "round", opacity: 0.42 }),
      path("M410 245 L560 252 L542 410 L438 418 Z", skin()),
      path("M435 263 C475 300 508 326 540 384", { fill: "none", stroke: "#744f40", "stroke-width": 3, opacity: 0.35 }),
      path("M410 414 L488 410 L480 522 L392 512 Z", { fill: "#2f6b84", stroke: "#151515", "stroke-width": 7 }),
      path("M505 392 L615 414 L590 526 L516 492 Z", { fill: "#355f8f", stroke: "#151515", "stroke-width": 7 }),
      path("M402 138 C452 74 558 102 578 178 C592 235 545 278 478 276 C413 274 372 222 402 138 Z", { fill: "#ffd0a8", stroke: "#151515", "stroke-width": 7 }),
      path("M372 126 C430 60 551 72 610 150 C586 126 557 126 530 132 C492 86 430 104 372 126 Z", { fill: "#24212b", stroke: "#151515", "stroke-width": 7 }),
      path("M385 112 C438 78 544 86 598 138 C570 120 520 118 482 142 C444 118 412 126 385 112 Z", { fill: "#302c3a", stroke: "#151515", "stroke-width": 6 }),
      path("M300 282 C348 238 394 240 442 286 L408 368 C360 360 324 336 300 282 Z", skin()),
      path("M548 256 C596 254 632 286 648 342 L610 354 C582 322 560 292 548 256 Z", skin()),
      path("M622 316 C700 318 782 340 824 384 C748 380 680 372 614 354 Z", skin()),
      path("M438 184 C462 174 500 174 528 188", line(7)),
      path("M472 232 C488 244 506 244 518 229", line(5)),
      path("M620 338 C700 318 758 320 828 382", { fill: "none", stroke: "#e1462e", "stroke-width": 4, "stroke-linecap": "round", opacity: 0.72 }),
      path("M648 364 C724 364 778 382 836 430", { fill: "none", stroke: "#e1462e", "stroke-width": 3, "stroke-linecap": "round", opacity: 0.5 }),
    ];
  }

  function parts() {
    return [
      part("part-torso", "torso rough torso", "body", [410, 245, 150, 170], [75, 38], [78, 138], null, 30),
      part("part-neck-head", "head turn key", "head", [390, 120, 190, 160], [91, 132], [98, 76], "part-torso", 70),
      part("part-back-hair", "back hair mass", "hair", [360, 98, 240, 190], [120, 55], [118, 138], "part-neck-head", 55),
      part("part-front-hair", "front hair accents", "hair", [382, 104, 208, 120], [104, 34], [102, 96], "part-neck-head", 90),
      part("part-left-arm", "left arm sweep", "arm", [296, 250, 150, 128], [134, 24], [32, 96], "part-torso", 45),
      part("part-right-upper-arm", "right upper arm", "arm", [540, 242, 116, 116], [18, 22], [92, 98], "part-torso", 46),
      part("part-right-forearm", "right forearm smear", "arm", [615, 308, 210, 88], [-18, 14], [190, 70], "part-right-upper-arm", 80),
      part("part-left-leg", "left planted leg", "leg", [395, 394, 92, 120], [50, 4], [42, 110], "part-torso", 24),
      part("part-right-leg", "right action leg", "leg", [500, 386, 118, 124], [36, 8], [102, 108], "part-torso", 26),
      part("part-eyes", "expression eyes", "eye", [435, 176, 92, 28], [46, 14], [46, 14], "part-neck-head", 100),
      part("part-mouth", "open mouth", "mouth", [470, 224, 44, 30], [22, 15], [22, 15], "part-neck-head", 101),
      part("part-speed-arc", "animator timing arc", "prop", [230, 178, 566, 232], [280, 112], [530, 140], null, 10, 0.58),
    ];
  }

  function rightForearmHiddenGuide() {
    return {
      id: "hidden-right-forearm-extension",
      name: "right forearm hidden extension guide",
      sourcePartId: "part-right-forearm",
      meshVerticesNormalized: [{ xNorm: -0.12, yNorm: 0.04 }, { xNorm: 1.08, yNorm: 0 }, { xNorm: 1.18, yNorm: 1.08 }, { xNorm: -0.05, yNorm: 0.92 }],
      meshFaces: [[0, 1, 2], [0, 2, 3]],
      silhouetteVerticesNormalized: [{ xNorm: -0.08, yNorm: 0.18 }, { xNorm: 1.14, yNorm: 0.05 }, { xNorm: 1.18, yNorm: 0.82 }, { xNorm: 0.04, yNorm: 1.04 }],
      guideStrength: 0.82,
      preview: { label: "forearm side fill", color: "#f1b83b", visible: true },
    };
  }

  function part(id, name, type, rectValues, pivotValues, jointValues, parentId, layerIndex, opacity = 1) {
    return { id, name, type, sourceRect: rectFrom(rectValues), pivot: pointFrom(pivotValues), joint: pointFrom(jointValues), parentId, layerIndex, opacity };
  }
  function path(d, attrs) { return { type: "path", attrs: { d, ...attrs } }; }
  function rect(x, y, width, height, attrs) { return { type: "rect", attrs: { x, y, width, height, ...attrs } }; }
  function line(width) { return { fill: "none", stroke: "#151515", "stroke-width": width, "stroke-linecap": "round" }; }
  function skin() { return { fill: "#f0b38c", stroke: "#151515", "stroke-width": 7 }; }
  function rectFrom(values) { return { x: values[0], y: values[1], w: values[2], h: values[3] }; }
  function pointFrom(values) { return { x: values[0], y: values[1] }; }
  function clone(value) { return JSON.parse(JSON.stringify(value)); }

  Animotion.scriptedGengaSampleDefinition = { createDefinition };
  if (typeof module !== "undefined") module.exports = Animotion.scriptedGengaSampleDefinition;
}
