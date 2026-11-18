import { position, type ScenarioType } from "./model.ts";
/** Explicit training branch; never guesses a pitch from a defender's movement. */
export function ravensBall(s: ScenarioType, t: number) {
  if (
    s.zone?.enabled ||
    !s.ravens ||
    s.ravens.blocking !== "team" ||
    !s.ravens.carrier
  )
    return null;
  const snap = s.steps[0].end,
    qb = s.players.find((p) => p.side === "OFF" && p.pos === "QB"),
    carrier = s.players.find(
      (p) => p.side === "OFF" && p.id === s.ravens!.carrier,
    );
  if (!qb || !carrier || t < snap) return null;
  const at = s.ravens.transferAt ?? snap,
    blend =
      carrier.id === qb.id
        ? 1
        : Math.max(0, Math.min(1, (t - (at - 0.35)) / 0.35));
  const from = position(s, qb.id, t),
    to = position(s, carrier.id, t);
  return {
    carrier: blend === 1 ? carrier.id : qb.id,
    blend,
    at: [
      from[0] + (to[0] - from[0]) * blend,
      0.83 + Math.sin(blend * Math.PI) * 0.3,
      from[1] + (to[1] - from[1]) * blend + 0.25,
    ] as [number, number, number],
  };
}
