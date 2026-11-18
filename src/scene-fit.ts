import type { ScenarioType } from "./model.ts";
const cache = new WeakMap<
  ScenarioType,
  { x: number; z: number; width: number; height: number }
>();
export function sceneFit(s: ScenarioType | undefined, aspect: number) {
  if (!s?.ravens) return { x: 0, z: 0, span: 6.2 };
  let b = cache.get(s);
  if (!b) {
    const points = s.players
      .map((p) => p.at)
      .concat(s.actions.flatMap((a) => [...(a.path ?? []), a.to]));
    const x = points.map((p) => p[0]),
      z = points.map((p) => p[1]),
      left = Math.min(...x) - 1.5,
      right = Math.max(...x) + 1.5,
      low = Math.min(...z) - 2,
      high = Math.max(...z) + 2;
    b = {
      x: (left + right) / 2,
      z: (low + high) / 2,
      width: right - left,
      height: high - low,
    };
    cache.set(s, b);
  }
  return {
    x: b.x,
    z: b.z,
    span: Math.max(6.2, b.height / 2, b.width / 2 / Math.max(0.2, aspect)),
  };
}
