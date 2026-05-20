# Punch/Kick Visual QA Checklist

Use this checklist after generating a punch or kick cutscene from the existing motion planner. This is a visual review aid only; it does not define new persisted data or product features.

## Setup

- Open the app and load a rig with body/root, head, and at least one arm or leg part.
- Generate a `punch` plan from an arm/forearm/hand part and a `kick` plan from a leg/shin/foot part.
- Review once with normal parts that include `humanRole`, then once with a legacy-style rig where parts rely only on `type`.
- Keep body assist enabled for the main pass; repeat with it disabled only to confirm the toggle still suppresses auxiliary body/head motion.

## Punch

- [ ] Impact reads as hand, torso, and hip/root moving together rather than the hand hitting alone.
- [ ] Windup pulls back before drive and does not look like an early impact.
- [ ] Drive accelerates toward the target before the impact frame.
- [ ] Impact frame still places the primary hand focus point on the intended target.
- [ ] Recover relaxes away from impact without snapping the body/root back too early.
- [ ] Body/root assist is visible but not stronger than the primary hand motion.

## Kick

- [ ] Chamber is visually distinct from ready/compress.
- [ ] Extension clearly moves the foot toward the target before impact.
- [ ] Impact frame still places the primary foot focus point on the intended target.
- [ ] Recovery pulls the leg back without losing body balance.
- [ ] Hip/root and torso participate enough to sell weight transfer.
- [ ] Body/root assist does not drag unrelated unparented parts more than expected.

## Legacy And Regeneration

- [ ] A rig without optional `humanRole` metadata still generates valid punch and kick motion.
- [ ] Regenerated trajectory anchors match the new beat timing: windup/chamber before drive/extend, impact at `impactFrame`, recover at `durationFrames`.
- [ ] Dragging or regenerating anchors keeps the existing `motionPlanner -> cutsceneBridge -> part.keyframes` flow intact.
- [ ] Saved and reloaded projects preserve the generated `cutsceneBridge.jointAction` without introducing duplicate motion state.

## Fail If

- Punch impact has zero visible body/root participation while body assist is enabled.
- Kick chamber, extension, impact, and recovery collapse into visually similar poses.
- The primary hand/foot misses the chosen impact target.
- Legacy rigs crash or generate empty beat/keyframe data.
- Anchor regeneration changes unrelated editor state or creates new schema fields.
