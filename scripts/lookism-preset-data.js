{
  const global = window;
  const Animotion = global.Animotion;

  const DURATION = 0.5;
  const EXPORT_MOTION_MS = 1050;
  const VIRTUAL_STAGE = { width: 1280, height: 720 };
  const READY_IMAGE = "lookism/standing.png";
  const IMPACT_IMAGE = "lookism/제목 없음.png";

  const ASSETS = {
    ready: { src: READY_IMAGE, crop: { x: 0, y: 0, w: 245, h: 260 } },
    impact: { src: IMPACT_IMAGE, crop: { x: 0, y: 0, w: 245, h: 735 } },
  };

  const ACTION = {
    beats: [
      {
        id: "stance",
        label: "STANCE",
        at: 0,
        pose: {
          hip: [305, 448], chest: [302, 350], head: [292, 264],
          lShoulder: [260, 332], lElbow: [218, 302], lHand: [190, 282],
          rShoulder: [345, 350], rElbow: [380, 420], rHand: [350, 470],
          lKnee: [260, 560], lFoot: [170, 628], rKnee: [365, 552], rFoot: [442, 635],
        },
      },
      {
        id: "compress",
        label: "COMPRESS",
        at: 0.1,
        pose: {
          hip: [322, 480], chest: [314, 370], head: [300, 286],
          lShoulder: [268, 354], lElbow: [226, 330], lHand: [200, 304],
          rShoulder: [362, 370], rElbow: [398, 438], rHand: [360, 488],
          lKnee: [275, 590], lFoot: [176, 652], rKnee: [386, 575], rFoot: [460, 650],
        },
      },
      {
        id: "takeoff",
        label: "TAKEOFF",
        at: 0.22,
        pose: {
          hip: [458, 386], chest: [438, 294], head: [418, 222],
          lShoulder: [392, 282], lElbow: [336, 256], lHand: [312, 220],
          rShoulder: [486, 306], rElbow: [548, 342], rHand: [590, 390],
          lKnee: [438, 492], lFoot: [338, 558], rKnee: [548, 452], rFoot: [636, 458],
        },
      },
      {
        id: "chamber",
        label: "CHAMBER",
        at: 0.34,
        pose: {
          hip: [600, 322], chest: [560, 246], head: [522, 190],
          lShoulder: [512, 248], lElbow: [454, 236], lHand: [416, 200],
          rShoulder: [606, 254], rElbow: [672, 286], rHand: [720, 332],
          lKnee: [576, 430], lFoot: [462, 482], rKnee: [694, 350], rFoot: [792, 312],
        },
      },
      {
        id: "extend",
        label: "EXTEND",
        at: 0.43,
        pose: {
          hip: [692, 300], chest: [640, 238], head: [590, 186],
          lShoulder: [592, 246], lElbow: [536, 262], lHand: [502, 232],
          rShoulder: [684, 230], rElbow: [746, 248], rHand: [798, 292],
          lKnee: [662, 410], lFoot: [540, 464], rKnee: [806, 270], rFoot: [970, 196],
        },
      },
      {
        id: "impact",
        label: "IMPACT",
        at: 0.5,
        pose: {
          hip: [706, 302], chest: [652, 232], head: [598, 182],
          lShoulder: [600, 242], lElbow: [532, 260], lHand: [492, 230],
          rShoulder: [692, 224], rElbow: [760, 232], rHand: [808, 278],
          lKnee: [664, 408], lFoot: [536, 462], rKnee: [812, 260], rFoot: [1008, 174],
        },
      },
    ],
  };

  const RIG_LINKS = {
    back_upper_arm: ["lShoulder", "lElbow", [66, 62], [36, 55]],
    back_forearm: ["lElbow", "lHand", [56, 54], [30, 66]],
    left_thigh: ["hip", "lKnee", [76, 148], [58, 198]],
    left_shin: ["lKnee", "lFoot", [58, 198], [30, 246]],
    right_thigh: ["hip", "rKnee", [138, 151], [132, 197]],
    right_shin: ["rKnee", "rFoot", [132, 197], [190, 246]],
    pelvis: ["hip", "rKnee", [112, 154], [150, 154]],
    torso: ["chest", "hip", [112, 88], [112, 154]],
    front_upper_arm: ["rShoulder", "rElbow", [145, 82], [177, 142]],
    front_forearm: ["rElbow", "rHand", [177, 142], [190, 188]],
    head: ["head", "chest", [95, 62], [95, 18], "chest", "head"],
  };

  const DRAW_ORDER = [
    "back_upper_arm",
    "back_forearm",
    "left_thigh",
    "left_shin",
    "right_thigh",
    "right_shin",
    "pelvis",
    "torso",
    "front_upper_arm",
    "front_forearm",
    "head",
  ];

  const MANIFEST = {
    parts: [
      { name: "head", file: "lookism/parts/head.png", bounds: { x: 50, y: 0, width: 96, height: 81 }, pivot: { x: 95, y: 62 }, polygon: [54, 0, 132, 3, 145, 38, 127, 70, 82, 80, 50, 52] },
      { name: "torso", file: "lookism/parts/torso.png", bounds: { x: 35, y: 50, width: 140, height: 139 }, pivot: { x: 112, y: 88 }, polygon: [63, 58, 140, 50, 174, 91, 164, 153, 139, 188, 77, 174, 35, 111] },
      { name: "pelvis", file: "lookism/parts/pelvis.png", bounds: { x: 51, y: 129, width: 119, height: 62 }, pivot: { x: 112, y: 154 }, polygon: [70, 130, 154, 129, 169, 162, 132, 190, 71, 174, 51, 148] },
      { name: "back_upper_arm", file: "lookism/parts/back_upper_arm.png", bounds: { x: 0, y: 1, width: 79, height: 61 }, pivot: { x: 66, y: 62 }, polygon: [0, 1, 62, 17, 78, 43, 58, 61, 18, 53, 0, 38] },
      { name: "back_forearm", file: "lookism/parts/back_forearm.png", bounds: { x: 19, y: 42, width: 74, height: 37 }, pivot: { x: 56, y: 54 }, polygon: [48, 42, 83, 45, 92, 60, 76, 78, 35, 72, 19, 57] },
      { name: "front_upper_arm", file: "lookism/parts/front_upper_arm.png", bounds: { x: 132, y: 66, width: 61, height: 85 }, pivot: { x: 145, y: 82 }, polygon: [132, 66, 170, 79, 192, 128, 174, 150, 150, 116, 136, 96] },
      { name: "front_forearm", file: "lookism/parts/front_forearm.png", bounds: { x: 157, y: 126, width: 60, height: 74 }, pivot: { x: 177, y: 142 }, polygon: [174, 126, 204, 150, 216, 166, 189, 199, 157, 150] },
      { name: "left_thigh", file: "lookism/parts/left_thigh.png", bounds: { x: 0, y: 130, width: 108, height: 73 }, pivot: { x: 76, y: 148 }, polygon: [44, 142, 102, 130, 107, 186, 58, 202, 20, 194, 0, 175] },
      { name: "left_shin", file: "lookism/parts/left_shin.png", bounds: { x: 0, y: 188, width: 78, height: 66 }, pivot: { x: 58, y: 198 }, polygon: [22, 188, 77, 190, 69, 241, 0, 253, 0, 220] },
      { name: "right_thigh", file: "lookism/parts/right_thigh.png", bounds: { x: 92, y: 136, width: 86, height: 67 }, pivot: { x: 138, y: 151 }, polygon: [109, 136, 158, 143, 177, 187, 128, 202, 92, 178, 100, 150] },
      { name: "right_shin", file: "lookism/parts/right_shin.png", bounds: { x: 92, y: 181, width: 126, height: 73 }, pivot: { x: 132, y: 197 }, polygon: [126, 187, 176, 181, 217, 253, 104, 253, 92, 218] },
    ],
  };

  Animotion.lookismPresetData = {
    DURATION,
    EXPORT_MOTION_MS,
    VIRTUAL_STAGE,
    READY_IMAGE,
    ASSETS,
    ACTION,
    RIG_LINKS,
    DRAW_ORDER,
    MANIFEST,
  };
}
