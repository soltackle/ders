import type { ScenarioType } from "./model.ts";
import {
  planProtection,
  protectionFront,
  setDefenseOption,
  frontLabel,
  type FrontCount,
  type DefenseSide,
} from "./protection.ts";
import { planZone } from "./zone.ts";
export const automaticTraining = (s: ScenarioType) =>
  !!(s.zone?.enabled || s.protection?.enabled);
export function planTraining(s: ScenarioType) {
  return s.zone ? planZone(s) : planProtection(s);
}
function preserveZone(previous: ScenarioType, next: ScenarioType) {
  if (!previous.zone) return next;
  for (const lb of next.players.filter(
    (p) => p.side === "DEF" && p.pos === "LB" && p.intent === "hold",
  )) {
    const before = previous.players.find((p) => p.id === lb.id);
    lb.intent = before?.intent === "hold" ? "hold" : "auto";
    if (lb.intent === "auto" && lb.at[1] <= 1.8) lb.at[1] = 3.3;
  }
  next.zone = structuredClone(previous.zone);
  next.protection = {
    enabled: false,
    showDepth: previous.protection?.showDepth ?? 1.8,
  };
  next.name = `Field zone · ${previous.zone.variant ?? "inside"} · ${frontLabel(next)}`;
  next.scheme = "Field zone";
  next.actions = next.actions.filter((a) => !a.source || a.source === "manual");
  next.rules = [];
  next.playbook = "Standart field zone taslağı · koç tarafından düzenlenebilir";
  next.steps = [
    {
      title: "Zone savunma yerleşimi",
      start: 0,
      end: 7.2,
      description:
        "Teknikleri ve savunma tepkilerini seç. Oynat, field zone’u yeniden hesaplar.",
      notes: {},
      focus: [],
    },
  ];
  return next;
}
export function trainingFront(s: ScenarioType, n: FrontCount) {
  return preserveZone(s, protectionFront(s, n));
}
export function trainingDefense(
  s: ScenarioType,
  side: DefenseSide,
  intent: "blitz" | "show",
) {
  return preserveZone(s, setDefenseOption(s, side, intent));
}
