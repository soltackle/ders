import { motion, position, samplePath, type ScenarioType } from "./model.ts";
import { fieldSide } from "./model.ts";
export function zoneBlockPose(s: ScenarioType, id: string, t: number) {
  if (!s.zone?.enabled) return null;
  const p = s.players.find((p) => p.id === id);
  if (!p || p.side !== "OFF" || !["LT", "LG", "C", "RG", "RT"].includes(p.pos))
    return null;
  const m = motion(s, id, t),
    a = m.action;
  if (!a) return null;
  const target = a.target ? position(s, a.target, t) : [m.at[0], m.at[1] + 1];
  const heading =
    a.label === "climb"
      ? m.heading
      : Math.max(
          -1.15,
          Math.min(
            1.15,
            Math.atan2(target[0] - m.at[0], Math.max(0.2, target[1] - m.at[1])),
          ),
        );
  const before = position(s, id, a.start);
  const moving = Math.hypot(a.to[0] - before[0], a.to[1] - before[1]) > 0.02;
  const previous = s.actions
    .filter(
      (x) => x.player === id && x.end <= a.start && x.label !== "zone-seal",
    )
    .sort((a, b) => b.end - a.end)[0];
  const track = moving ? a : previous,
    sign = fieldSide(s) === "right" ? 1 : -1;
  const feet = ([-1, 1] as const).map((side, i) => {
    let at = m.at,
      lift = 0;
    if (track) {
      const start = position(s, id, track.start),
        distance = Math.hypot(track.to[0] - start[0], track.to[1] - start[1]),
        steps = Math.max(2, Math.ceil(distance / 0.24)),
        u = Math.max(
          0,
          Math.min(1, (t - track.start) / (track.end - track.start)),
        ),
        k = Math.min(steps - 1, Math.floor(u * steps)),
        f = u === 1 ? 1 : u * steps - k,
        lead = sign > 0 ? 1 : 0;
      if ((k + lead) % 2 === i) {
        const from = samplePath(start, track, Math.max(0, (k - 1) / steps)),
          to = samplePath(start, track, (k + 1) / steps),
          blend = f * f * (3 - 2 * f);
        at = [
          from[0] + (to[0] - from[0]) * blend,
          from[1] + (to[1] - from[1]) * blend,
        ];
        lift = Math.sin(Math.PI * f) * 0.07;
      } else {
        let last = k - 1;
        if ((last + lead) % 2 !== i) last--;
        at = samplePath(start, track, Math.max(0, (last + 1) / steps));
      }
    }
    const dx = at[0] + side * 0.28 - m.at[0],
      dz = at[1] + 0.03 - m.at[1];
    return {
      x: dx * Math.cos(heading) - dz * Math.sin(heading),
      z: dx * Math.sin(heading) + dz * Math.cos(heading),
      y: 0.065 + lift,
    };
  });
  return {
    heading,
    feet,
    contact:
      a.label !== "zone-step" &&
      a.label !== "climb" &&
      Math.hypot(target[0] - m.at[0], target[1] - m.at[1]) < 1.4,
    phase: a.label,
    hip: 0.59,
    chest: 0.88,
    head: 1.2,
    lean: a.label === "climb" ? 0.22 : 0.32,
  };
}
