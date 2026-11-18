import {
  fieldSide,
  position,
  pathLength,
  Scenario,
  type ScenarioType,
  type ActionType,
} from "./model.ts";
import { travelDuration } from "./timing.ts";
import { matchDefenders } from "./front-matching.ts";
import type { ProtectionResult } from "./protection.ts";
import type { ZoneResult } from "./zone.ts";
type Plan = ProtectionResult | ZoneResult;
const isOL = (pos: string) => ["LT", "LG", "C", "RG", "RT"].includes(pos);
function finish(plan: Plan) {
  return Math.max(...plan.scenario.steps.map((s) => s.end));
}
function update(plan: Plan, description: string) {
  const s = plan.scenario,
    pass = !s.zone;
  const active = new Set(
    plan.coverage
      .filter((c) => ["blocked", "hot", "free"].includes(c.status))
      .map((c) => c.defender),
  );
  plan.coverage = plan.coverage.map((c) => {
    const blockers = plan.assignments
      .filter(
        (a) =>
          a.type !== "watch" &&
          (a.target === c.defender || a.release === c.defender),
      )
      .map((a) => a.player);
    return {
      ...c,
      blockers,
      detail: blockers.join(", "),
      status:
        c.status === "show"
          ? "show"
          : blockers.length
            ? "blocked"
            : active.has(c.defender)
              ? pass
                ? "hot"
                : "free"
              : "idle",
    };
  });
  plan.unblocked = plan.coverage
    .filter((c) => c.status === "hot" || c.status === "free")
    .map((c) => c.defender);
  plan.warnings = plan.warnings.filter(
    (x) => !/bloklanmıyor|HOT:|Blok dışı|combo için/.test(x),
  );
  if (plan.unblocked.length)
    plan.warnings.push(
      `Blok dışı: ${plan.unblocked.join(", ")}. ${pass ? "QB hot gözetimi; blok değildir." : "Koşu takipçisi; ek takım ataması yok."}`,
    );
  if (pass && plan.unblocked.length) {
    const qb = s.players.find((p) => p.side === "OFF" && p.pos === "QB");
    if (qb) {
      let watch = plan.assignments.find(
        (a) => a.player === qb.id && a.type === "watch",
      );
      if (!watch) {
        const added = { player: qb.id, type: "watch" as const, note: "" };
        plan.assignments.push(added);
        watch = added;
      }
      watch.target = plan.unblocked[0];
      watch.watchTargets = [...plan.unblocked];
      watch.gaze = plan.unblocked[0];
      watch.note = `HOT: ${plan.unblocked.join(", ")} blok dışı; gözetim blok sayılmaz.`;
      for (const a of s.actions.filter((a) => a.player === qb.id))
        a.gaze = watch.gaze;
      for (const c of plan.coverage)
        c.watchers = plan.unblocked.includes(c.defender) ? [qb.id] : [];
    }
  }
  const notes = Object.fromEntries(
    plan.assignments.map((a) => [a.player, a.note]),
  );
  for (const step of s.steps) {
    step.notes = { ...step.notes, ...notes };
    step.description = description + " " + step.description;
  }
  s.playbook = description;
  s.rules = [
    {
      id: "ravens-team-variant",
      blitz: s.blitz,
      title: description,
      note: description,
      assign: Object.fromEntries(
        plan.assignments.map((a) => [
          a.player,
          {
            type:
              a.type === "watch"
                ? "watch"
                : a.type === "slide"
                  ? "slide"
                  : "man",
            target: a.target,
            note: a.note,
          },
        ]),
      ),
    },
  ];
  return { ...plan, scenario: Scenario.parse(s) };
}
function appendHold(
  s: ScenarioType,
  player: string,
  track: ActionType,
  end: number,
  target?: string,
) {
  s.actions.push(track, {
    source: "ravens",
    player,
    label: s.zone ? "zone-seal" : "punch",
    assignment: s.zone ? "zone" : "man",
    start: track.end,
    end: Math.max(end, track.end + 0.8),
    to: track.to,
    target,
  });
}
function extend(s: ScenarioType, end: number) {
  const old = Math.max(...s.steps.map((st) => st.end));
  for (const a of s.actions)
    if (a.end === old && a.label !== "motion") a.end = end;
  s.steps.at(-1)!.end = end;
}
export function rolloutProtection(plan: ProtectionResult) {
  const s = plan.scenario,
    sign = fieldSide(s) === "right" ? 1 : -1,
    fg = sign > 0 ? "RG" : "LG",
    ft = sign > 0 ? "RT" : "LT",
    bg = sign > 0 ? "LG" : "RG",
    bt = sign > 0 ? "LT" : "RT",
    ids = [fg, ft, "C"]
      .map(
        (pos) => s.players.find((p) => p.side === "OFF" && p.pos === pos)?.id,
      )
      .filter((id): id is string => !!id),
    boundary = plan.assignments.filter((a) =>
      s.players.some((p) => p.id === a.player && [bg, bt].includes(p.pos)),
    ),
    reserved = new Set(boundary.map((a) => a.target));
  const rb = s.players.find((p) => p.pos === "RB"),
    rbTarget = plan.assignments.find((a) => a.player === rb?.id)?.target;
  const threats = s.players.filter(
      (p) =>
        p.side === "DEF" &&
        p.intent !== "hold" &&
        (p.pos === "DL" || p.intent === "blitz" || p.intent === "show") &&
        !reserved.has(p.id) &&
        p.id !== rbTarget,
    ),
    matches = matchDefenders(
      s.players.filter((p) => ids.includes(p.id)),
      threats,
    );
  for (const a of boundary) {
    a.type = "man";
    a.partner = undefined;
    a.release = undefined;
    a.note = `Boundary adam adam: ${a.target ?? "kendi iç bölgen"} sende; field rollout için adamını bırakma.`;
  }
  const snap = s.steps[0].end;
  let end = finish(plan);
  s.actions = s.actions.filter((a) => !ids.includes(a.player));
  for (const id of ids) {
    const p = s.players.find((p) => p.id === id)!,
      a = plan.assignments.find((a) => a.player === id)!;
    a.target = matches.get(id);
    a.type = "slide";
    a.partner = undefined;
    a.release = undefined;
    a.note = `Field rollout: ${a.target ?? "field A-gap"} sorumluluğunu field yönüne slide ile tut; boundary adam adam kalır.`;
    const d = a.target ? s.players.find((p) => p.id === a.target) : undefined,
      to: [number, number] = [
        d ? d.at[0] + sign * 0.25 : p.at[0] + sign * 0.4,
        -0.65,
      ],
      set: ActionType = {
        source: "ravens",
        player: id,
        label: "slide",
        assignment: "slide",
        start: snap,
        end:
          snap +
          Math.max(
            1.6,
            travelDuration(Math.hypot(to[0] - p.at[0], to[1] - p.at[1]), 1.7),
          ),
        to,
        target: a.target,
      };
    s.actions.push(set);
    const moving: ActionType = {
      source: "ravens",
      player: id,
      label: "slide",
      assignment: "slide",
      start: set.end,
      end: set.end + 1.5,
      to: [to[0] + sign * 1.0, -0.65],
      target: a.target,
    };
    end = Math.max(end, moving.end + 1.4);
    appendHold(s, id, moving, end, a.target);
    if (
      d &&
      !s.actions.some(
        (x) => x.player === d.id && (!x.source || x.source === "manual"),
      )
    ) {
      s.actions = s.actions.filter((x) => x.player !== d.id);
      s.actions.push(
        {
          source: "ravens",
          player: d.id,
          label: "rush",
          start: snap,
          end: set.end,
          to: [set.to[0], -0.1],
        },
        {
          source: "ravens",
          player: d.id,
          label: "block-resist",
          start: set.end,
          end: moving.end,
          to: [moving.to[0], -0.1],
        },
        {
          source: "ravens",
          player: d.id,
          label: "block-resist",
          start: moving.end,
          end,
          to: [moving.to[0], -0.1],
        },
      );
    }
  }
  extend(s, end);
  return update(
    plan,
    "Field rollout: FT–FG–C slide, boundary G/T adam adam; QB field’a açılır.",
  );
}
export function boundaryWrap(plan: ProtectionResult, source: ScenarioType) {
  const s = plan.scenario,
    sign = fieldSide(s) === "right" ? 1 : -1,
    bg = s.players.find(
      (p) => p.side === "OFF" && p.pos === (sign > 0 ? "LG" : "RG"),
    )!,
    bt = s.players.find(
      (p) => p.side === "OFF" && p.pos === (sign > 0 ? "LT" : "RT"),
    )!,
    g = plan.assignments.find((a) => a.player === bg.id)!,
    t = plan.assignments.find((a) => a.player === bt.id)!,
    oldG = g.target,
    oldT = t.target,
    snap = s.steps[0].end;
  g.target = oldT;
  t.target = oldG;
  g.type = "pickup";
  g.partner = undefined;
  g.release = undefined;
  t.type = "man";
  t.partner = undefined;
  t.release = undefined;
  g.note = `Boundary wrap: ${bt.id} arkasından dolaş ve tackle’ın adamı ${oldT ?? "dış bölge"} sende.`;
  t.note = `${bg.id} wrap yaparken onun iç adamı ${oldG ?? "iç bölge"} sende; iç DL boş bırakılmaz.`;
  for (const a of plan.assignments)
    if (
      a.player !== g.player &&
      a.player !== t.player &&
      a.partner === g.player
    ) {
      a.partner = t.player;
      a.note = `İç DL ${a.target ?? "bölge"} için ${bt.id} ile iletişim; ${bg.id} dış adama wrap yaptı.`;
    }
  s.actions = s.actions.filter((a) => a.player !== bg.id && a.player !== bt.id);
  const pieces = source.actions.filter(
      (a) => a.player === bg.id && a.label !== "motion",
    ),
    path = pieces
      .flatMap((a) => [...(a.path ?? []), a.to])
      .filter((p) => p[1] < -0.2);
  const endPoint: [number, number] = [
    oldT ? s.players.find((p) => p.id === oldT)!.at[0] : bt.at[0],
    -0.65,
  ];
  const track: ActionType = {
    source: "ravens",
    player: bg.id,
    label: "pull",
    interpolation: "polyline",
    assignment: "pickup",
    kind: "pass-wrap",
    start: snap,
    end: snap + 1,
    to: endPoint,
    path: path.length
      ? [
          [bg.at[0], -0.7],
          ...path.map((p) => [p[0], Math.min(-1.25, p[1])] as [number, number]),
        ]
      : [
          [bg.at[0] - sign * 0.3, -1.1],
          [bt.at[0], -1.1],
        ],
    target: oldT,
    gaze: oldT,
  };
  track.end = snap + Math.max(2, travelDuration(pathLength(bg.at, track), 1.7));
  track.phases = [
    { name: "open", start: snap, end: snap + 0.3 },
    { name: "run", start: snap + 0.3, end: track.end - 0.5 },
    { name: "gather", start: track.end - 0.5, end: track.end - 0.2 },
    { name: "strike", start: track.end - 0.2, end: track.end },
  ];
  const end = Math.max(finish(plan), track.end + 1.8);
  appendHold(s, bg.id, track, end, oldT);
  const inner: [number, number] = [
      oldG
        ? s.players.find((p) => p.id === oldG)!.at[0] - sign * 0.35
        : bt.at[0] + sign * 0.5,
      -0.65,
    ],
    inside: ActionType = {
      source: "ravens",
      player: bt.id,
      label: "pass-set",
      assignment: "man",
      start: snap,
      end:
        snap +
        Math.max(
          1.6,
          travelDuration(
            Math.hypot(inner[0] - bt.at[0], inner[1] - bt.at[1]),
            1.7,
          ),
        ),
      to: inner,
      target: oldG,
    };
  appendHold(s, bt.id, inside, end, oldG);
  plan.boundaryLocks = [
    { player: bg.id, target: oldT },
    { player: bt.id, target: oldG },
  ].filter((x): x is { player: string; target: string } => !!x.target);
  extend(s, end);
  return update(
    plan,
    "Boundary guard tackle arkasından wrap ile dış adamı alır; tackle iç adamı devralır.",
  );
}
export function fieldGuardLead(plan: ZoneResult, source: ScenarioType) {
  const s = plan.scenario,
    sign = fieldSide(s) === "right" ? 1 : -1,
    g = s.players.find(
      (p) => p.side === "OFF" && p.pos === (sign > 0 ? "RG" : "LG"),
    )!,
    t = s.players.find(
      (p) => p.side === "OFF" && p.pos === (sign > 0 ? "RT" : "LT"),
    )!,
    a = plan.assignments.find((a) => a.player === g.id)!,
    ta = plan.assignments.find((a) => a.player === t.id)!,
    snap = s.steps[0].end,
    old = a.target;
  const targetIsDL = s.players.some((p) => p.id === old && p.pos === "DL");
  if (targetIsDL && old !== ta.target) {
    a.target = ta.target;
    ta.target = old;
    ta.note = `Field guard lead çıkarken ${g.id}’ın iç DL’si ${old} için down/pin; dış adama guard lead yapar.`;
  } else {
    const used = new Set(
      plan.assignments
        .filter((x) => x.player !== a.player)
        .flatMap((x) => [x.target, x.release]),
    );
    a.target = s.players
      .filter(
        (p) =>
          p.side === "DEF" &&
          p.pos === "LB" &&
          p.intent !== "hold" &&
          p.intent !== "show" &&
          !used.has(p.id),
      )
      .sort(
        (x, y) => Math.abs(x.at[0] - t.at[0]) - Math.abs(y.at[0] - t.at[0]),
      )[0]?.id;
  }
  a.type = "reach";
  a.partner = undefined;
  a.release = undefined;
  a.secondLevel = false;
  a.note = `Field zone lead: ${t.id} arkasından pull yap, ${a.target ?? "field koşu koridorunda"} lead blok kur. Diğer OL covered/uncovered kuralında.`;
  for (const helper of plan.assignments.filter((x) => x.partner === g.id)) {
    helper.partner = undefined;
    helper.target = helper.release;
    helper.release = undefined;
    helper.type = "climb";
    helper.secondLevel = true;
    helper.note =
      "Lead çıkan guard’a sabit combo yok; kendi ikinci seviye bölgeni al.";
    s.actions = s.actions.filter((x) => x.player !== helper.player);
    const p = s.players.find((p) => p.id === helper.player)!,
      d = s.players.find((p) => p.id === helper.target),
      to: [number, number] = d ? [d.at[0], 2.15] : [p.at[0] + sign * 0.4, 2.15];
    s.actions.push({
      source: "zone",
      player: p.id,
      label: "climb",
      assignment: "zone",
      start: snap,
      end: snap + 2.5,
      to,
      target: helper.target,
    });
  }
  const pieces = source.actions.filter(
    (x) => x.player === g.id && x.label !== "motion",
  );
  let path = pieces
      .flatMap((x) => [...(x.path ?? []), x.to])
      .filter((p) => p[1] < 0.9),
    to: [number, number] = pieces.at(-1)?.to ?? [t.at[0] + sign * 1.5, 1.15];
  if (!path.some((p) => p[1] < -0.5))
    path = [
      [g.at[0] + sign * 0.3, -1],
      [t.at[0] + sign * 0.4, -1],
    ];
  const track: ActionType = {
    source: "ravens",
    player: g.id,
    label: "pull",
    assignment: "pull",
    kind: "zone-lead",
    start: snap,
    end: snap + 1,
    path,
    to,
    target: a.target,
  };
  track.end =
    snap + Math.max(2.6, travelDuration(pathLength(g.at, track), 2.1));
  track.phases = [
    { name: "open", start: snap, end: snap + 0.3 },
    { name: "run", start: snap + 0.3, end: track.end - 0.5 },
    { name: "gather", start: track.end - 0.5, end: track.end - 0.2 },
    { name: "strike", start: track.end - 0.2, end: track.end },
  ];
  s.actions = s.actions.filter((x) => x.player !== g.id && x.player !== t.id);
  const end = Math.max(finish(plan), track.end + 1.5);
  appendHold(s, g.id, track, end, a.target);
  const d = s.players.find((p) => p.id === ta.target),
    pin: [number, number] = [d?.at[0] ?? t.at[0] - sign * 0.6, 1.1];
  appendHold(
    s,
    t.id,
    {
      source: "zone",
      player: t.id,
      label: "reach",
      assignment: "zone",
      start: snap,
      end:
        snap +
        Math.max(
          1.7,
          travelDuration(Math.hypot(pin[0] - t.at[0], pin[1] - t.at[1]), 1.7),
        ),
      to: pin,
      target: ta.target,
    },
    end,
    ta.target,
  );
  // Rebind resistance to the actual owner after the pin/lead exchange.
  for (const [owner, target] of [
    [g.id, a.target],
    [t.id, ta.target],
  ] as const) {
    if (
      !target ||
      s.actions.some(
        (x) => x.player === target && (!x.source || x.source === "manual"),
      )
    )
      continue;
    s.actions = s.actions.filter((x) => x.player !== target);
    const p = s.players.find((p) => p.id === target)!,
      at = position(s, owner, end);
    s.actions.push(
      {
        source: "zone",
        player: target,
        label: "run-read",
        start: snap,
        end: Math.min(snap + 1.5, end - 0.2),
        to: [p.at[0], p.pos === "DL" ? 0.7 : 2.7],
      },
      {
        source: "zone",
        player: target,
        label: "block-resist",
        start: Math.min(snap + 1.5, end - 0.2),
        end,
        to: [at[0], at[1] + 0.55],
      },
    );
  }
  extend(s, end);
  return update(
    plan,
    "Field zone: field guard tackle arkasından lead çıkar; tackle down/pin, diğer OL covered/uncovered.",
  );
}
