import {removeOpponentPackage} from './opponent.ts';
import { ravensProfile } from "./ravens-catalog.ts";
import { planRavens } from "./ravens.ts";
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
  s.ravens
    ? s.ravens.enabled !== false
    : !!(s.zone?.enabled || s.protection?.enabled);
export function planTraining(s: ScenarioType) {
  return s.ravens ? planRavens(s) : s.zone ? planZone(s) : planProtection(s);
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
  next.playbook = "Takım field zone · covered / uncovered";
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
  if(s.opponent)s=removeOpponentPackage(s);
  return preserveRavens(s, preserveZone(s, protectionFront(s, n)));
}
export function trainingDefense(
  s: ScenarioType,
  side: DefenseSide,
  intent: "blitz" | "show",
) {
  if(s.opponent)s=removeOpponentPackage(s);
  return preserveRavens(s, preserveZone(s, setDefenseOption(s, side, intent)));
}

function preserveRavens(previous: ScenarioType, next: ScenarioType) {
  if (!previous.ravens) return next;
  if (
    previous.ravens.blocking === "team" &&
    !["pass", "pass-wrap", "rollout"].includes(
      ravensProfile(previous.ravens.id).kind,
    )
  )
    for (const p of next.players.filter(
      (p) => p.side === "DEF" && p.pos === "LB" && p.intent === "hold",
    )) {
      const old = previous.players.find((q) => q.id === p.id);
      p.intent = old?.intent === "hold" ? "hold" : "auto";
      if (p.intent === "auto" && p.at[1] <= 1.8) p.at[1] = 3.3;
    }
  next.ravens = structuredClone(previous.ravens);
  next.name = previous.name;
  next.scheme = "Ravens · MOST";
  next.protection = {
    enabled: previous.protection?.enabled ?? false,
    showDepth: previous.protection?.showDepth ?? 1.8,
  };
  return next;
}
