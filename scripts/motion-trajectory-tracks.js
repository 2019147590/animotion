{
  const global = typeof window !== "undefined" ? window : globalThis;
  const Animotion = global.Animotion || (global.Animotion = {});

  function trajectoryTracks(action) {
    return trajectoryKeys(action).map((key) => ({
      key,
      samples: trajectorySamples(action, key),
    }));
  }

  function trajectoryKeys(action) {
    const focusKey = action?.focusKey || "hip";
    const keys = [focusKey];
    if (focusKey !== "hip" && hasPoseKey(action, "hip")) keys.push("hip");
    return keys.filter((key, index) => key && keys.indexOf(key) === index && hasPoseKey(action, key));
  }

  function trajectorySamples(action, key) {
    return Animotion.motionTargetState?.trajectorySamples?.(action?.beats || [], key)
      || (action?.beats || []).map((beat) => beat.pose?.[key]).filter(Boolean)
        .map((point, index) => ({ id: `sample-${index}`, kind: "sample", editable: false, point: pointFrom(point) }));
  }

  function hasPoseKey(action, key) {
    return Boolean(key && action?.beats?.some((beat) => beat.pose?.[key]));
  }

  function pointFrom(point) {
    if (!point) return null;
    return { x: Number(point.x ?? point[0]) || 0, y: Number(point.y ?? point[1]) || 0 };
  }

  Animotion.motionTrajectoryTracks = { trajectoryTracks, trajectoryKeys, trajectorySamples };
  if (typeof module !== "undefined") module.exports = Animotion.motionTrajectoryTracks;
}
