export const STRIKE_DURATION = 0.5;
export const FOLLOW_THROUGH_DURATION = 0.5;
export const DURATION = STRIKE_DURATION + FOLLOW_THROUGH_DURATION;

export const CUTSCENE_ASSETS = {
  ready: { src: "standing.png", crop: { x: 0, y: 0, w: 245, h: 260 } },
  impact: {
    src: "제목 없음.png",
    crop: { x: 0, y: 0, w: 245, h: 735 },
    eraseInk: [
      { x: 56, y: 0, w: 38, h: 24 },
      { x: 88, y: 474, w: 142, h: 180 },
    ],
  },
  end: {
    src: "endmotion.png",
    crop: { x: 0, y: 0, w: 245, h: 735 },
    eraseInk: [
      { x: 0, y: 0, w: 128, h: 110 },
      { x: 88, y: 504, w: 142, h: 152 },
    ],
  },
};

export const ACTION = {
  name: "flyingKick",
  duration: STRIKE_DURATION,
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

export const RIG_LINKS = {
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

export const CUTSCENE_RIG_DRAW_ORDER = [
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
