import {
  Scenario,
  fieldSide,
  position,
  pathLength,
  config,
  type ScenarioType,
  type PlayerType,
  type ActionType,
} from "./model.ts";
import {
  frontLabel,
  type ProtectionAssignment,
  type ProtectionResult,
  type DefenseCoverage,
} from "./protection.ts";
import { matchDefenders } from "./front-matching.ts";
import { alignment } from "./tactics.ts";
import { travelDuration } from "./timing.ts";
export type SpecialProfile = {
  number: number;
  kind: string;
  direction?: string;
};
const linePositions = ["LT", "LG", "C", "RG", "RT"];
const titles: Record<string, string> = {
  "gt-counter": "GT counter",
  dart: "Dart · tackle pull",
  trap3: "3-tech trap",
  screen: "Field screen",
  "ct-counter": "Boundary CT counter",
  "source-special": "Çizime özel oyun",
  trap5: "Field 5-tech trap",
  tushpush: "Tush push",
  "speed-option": "Field speed option",
};
const pulls: Record<number, string[]> = {
  12: ["RG", "RT"],
  13: ["LG", "LT"],
  14: ["LT"],
  19: ["LG"],
  21: ["RG", "RT"],
  26: ["LG"],
  28: ["C", "RT"],
  29: ["LG", "RG"],
  30: ["RG", "RT"],
  34: ["LG"],
};
function ends(s: ScenarioType, id: string) {
  return s.actions
    .filter((a) => a.player === id && a.label !== "motion")
    .sort((a, b) => a.end - b.end)
    .at(-1);
}
function pointDistance(a: [number, number], b: [number, number]) {
  return Math.hypot(a[0] - b[0], a[1] - b[1]);
}
// Maximize valid local blocks first; a distant forced pair must never consume a
// nearby defender and then be discarded after the matching has finished.
function localMatches(
  blockers: PlayerType[],
  defenders: PlayerType[],
  reach: number,
) {
  let best = new Map<string, string>(),
    cost = Infinity;
  function visit(
    i: number,
    used: Set<string>,
    chosen: Map<string, string>,
    sum: number,
  ) {
    if (i === blockers.length) {
      if (
        chosen.size > best.size ||
        (chosen.size === best.size && sum < cost)
      ) {
        best = new Map(chosen);
        cost = sum;
      }
      return;
    }
    const p = blockers[i];
    for (const d of defenders) {
      const dx = Math.abs(p.at[0] - d.at[0]);
      if (used.has(d.id) || dx > reach) continue;
      used.add(d.id);
      chosen.set(p.id, d.id);
      visit(i + 1, used, chosen, sum + dx * dx);
      used.delete(d.id);
      chosen.delete(p.id);
    }
    visit(i + 1, used, chosen, sum);
  }
  visit(0, new Set(), new Map(), 0);
  return best;
}
/** Early run exchange uses an actual backfield meeting, never the late finishing carry. */
export function prepareRunHandoff(
  s: ScenarioType,
  carrierId: string,
  legacyDefault: number,
  warnings: string[],
) {
  const meta = s.ravens as
    | (NonNullable<ScenarioType["ravens"]> & { transferManual?: boolean })
    | undefined;
  const qb = s.players.find((p) => p.side === "OFF" && p.pos === "QB"),
    carrier = s.players.find((p) => p.side === "OFF" && p.id === carrierId),
    snap = s.steps[0]?.end ?? 1.1;
  if (!meta || !qb || !carrier) return undefined;
  // Preserve explicit edits, including legacy custom times which differ from the old auto default.
  const manual =
    meta.transferManual === true ||
    (meta.transferManual === undefined &&
      meta.transferAt !== undefined &&
      Math.abs(meta.transferAt - legacyDefault) > 1e-4);
  if (manual) {
    meta.transferManual = true;
    return meta.transferAt;
  }
  meta.transferManual = false;
  if (carrier.id === qb.id) return snap;
  // Choose the closest early backfield meeting, not the first long arm's-reach pass.
  // The contact layer retains body separation if the drawn center paths cross.
  let closest: { time: number; distance: number } | undefined;
  for (let t = snap + 0.45; t <= snap + 2.0001; t += 0.025) {
    const q = position(s, qb.id, t),
      r = position(s, carrier.id, t),
      distance = pointDistance(q, r);
    if (
      q[1] <= 0.15 &&
      r[1] <= 0.15 &&
      (!closest || distance < closest.distance)
    )
      closest = { time: t, distance };
  }
  if (closest && closest.distance <= 1) return closest.time;
  // Some source diagrams only contain fakes. Add a bounded approach before them,
  // retaining every existing route waypoint/end point and delaying only this carrier.
  const start = snap + 0.05,
    from = position(s, carrier.id, snap);
  for (let t = snap + 0.65; t <= snap + 2.0001; t += 0.05) {
    const q = position(s, qb.id, t),
      dx = from[0] - q[0],
      dz = from[1] - q[1],
      d = Math.hypot(dx, dz) || 1;
    const to: [number, number] = [
      q[0] + (dx / d) * 0.72,
      q[1] + (dz / d) * 0.72,
    ];
    if (
      q[1] > 0.15 ||
      to[1] > 0.15 ||
      travelDuration(pointDistance(from, to), 3) > t - start
    )
      continue;
    const shift = t - snap;
    for (const a of s.actions.filter(
      (a) =>
        a.player === carrier.id &&
        a.label !== "motion" &&
        a.start >= snap - 1e-6,
    )) {
      a.start += shift;
      a.end += shift;
      for (const phase of a.phases ?? []) {
        phase.start += shift;
        phase.end += shift;
      }
    }
    s.actions.push({
      source: "ravens",
      player: carrier.id,
      label: "special-mesh-approach",
      start,
      end: t,
      to,
    });
    warnings.push(
      `${carrier.id}: kaynak fake öncesine hız sınırlı kısa QB mesh yaklaşması eklendi; sonraki çizim noktaları korunur.`,
    );
    return t;
  }
  // Do not animate a handoff across the field if the chosen player cannot reach QB.
  meta.carrier = qb.id;
  warnings.push(
    `${carrier.id}: ilk iki saniyede ulaşılabilir QB mesh yok; uzaktan top aktarımı yapılmadı, top QB’de kaldı. Taşıyıcı ve açık devir zamanı düzenlenebilir.`,
  );
  return snap;
}
/** Special runs use the imported OL tracks, then finish against the selected live defense. */
export function applyRavensSpecial(
  input: ScenarioType,
  profile: SpecialProfile,
): ProtectionResult {
  const s = structuredClone(input),
    field = fieldSide(s) === "right" ? 1 : -1,
    center =
      s.players.find((p) => p.side === "OFF" && p.pos === "C")?.at[0] ?? 0;
  const ol = s.players.filter(
      (p) => p.side === "OFF" && linePositions.includes(p.pos),
    ),
    dl = s.players.filter(
      (p) => p.side === "DEF" && p.pos === "DL" && p.intent !== "hold",
    ),
    lbs = s.players.filter(
      (p) =>
        p.side === "DEF" &&
        (p.pos === "LB" || p.intent === "blitz") &&
        p.intent !== "hold" &&
        p.intent !== "show",
    );
  const snap = s.steps[0]?.end ?? 1.1,
    title = titles[profile.kind] ?? "Ravens özel oyun",
    warnings: string[] = [],
    assignments: ProtectionAssignment[] = [],
    notes: Record<string, string> = {};
  s.protection = { enabled: false, showDepth: s.protection?.showDepth ?? 1.8 };
  s.zone = undefined;
  // Source tracks are authoritative; remove only our previous finishing tracks on a direct re-plan.
  s.actions = s.actions.filter(
    (a) =>
      !a.label.startsWith("special-") &&
      a.kind !== "special-screen" &&
      (s.players.find((p) => p.id === a.player)?.side === "OFF" ||
        !a.source ||
        a.source === "manual"),
  );
  const authoredDEF = new Set(
    s.actions
      .filter((a) => s.players.find((p) => p.id === a.player)?.side === "DEF")
      .map((a) => a.player),
  );
  const reflectRoles =
    field < 0 && [14, 21, 28, 30, 34].includes(profile.number);
  const pullRoles = (pulls[profile.number] ?? []).map((pos) =>
    reflectRoles
      ? (({ LG: "RG", RG: "LG", LT: "RT", RT: "LT" } as Record<string, string>)[
          pos
        ] ?? pos)
      : pos,
  );
  const pullers = pullRoles
    .map((pos) => ol.find((p) => p.pos === pos))
    .filter((p): p is PlayerType => !!p);
  const endDx = pullers
    .map((p) => (ends(s, p.id)?.to[0] ?? p.at[0]) - p.at[0])
    .reduce((n, v) => n + v, 0);
  const direction =
    profile.kind === "dart"
      ? Math.sign(endDx) || field
      : profile.direction === "field"
        ? field
        : profile.direction === "boundary"
          ? -field
          : profile.direction === "right"
            ? 1
            : profile.direction === "left"
              ? -1
              : Math.sign(endDx) || field;
  let finish = Math.max(snap + 6, ...s.actions.map((a) => a.end)),
    contact = snap + 1.4;
  if (profile.kind === "screen")
    for (const p of pullers) {
      for (const a of s.actions.filter(
        (a) => a.player === p.id && a.label !== "motion",
      )) {
        a.start += 0.65;
        a.end += 0.65;
        for (const phase of a.phases ?? []) {
          phase.start += 0.65;
          phase.end += 0.65;
        }
      }
      s.actions.push({
        source: "ravens",
        player: p.id,
        label: "special-screen-set",
        kind: "special-screen",
        assignment: "gap",
        start: snap,
        end: snap + 0.65,
        to: [...p.at],
      });
    }
  const targetByBlocker = new Map<string, string>(),
    reserved = new Set<string>(),
    secondLevel = new Set<string>();
  const releaseIds =
    profile.kind === "trap3"
      ? ["RG"]
      : profile.kind === "trap5"
        ? [field > 0 ? "RT" : "LT"]
        : [];
  const releasers = ol.filter((p) => releaseIds.includes(p.pos));
  releasers.forEach((p) => secondLevel.add(p.id));
  function assign(
    p: PlayerType,
    target: PlayerType | undefined,
    note: string,
    type: ProtectionAssignment["type"] = "man",
  ) {
    if (target) {
      targetByBlocker.set(p.id, target.id);
      reserved.add(target.id);
    }
    assignments.push({ player: p.id, target: target?.id, type, note });
    notes[p.id] = note;
  }
  function nearest(candidates: PlayerType[], x: number) {
    return [...candidates].sort(
      (a, b) =>
        Math.abs(a.at[0] - x) - Math.abs(b.at[0] - x) ||
        a.id.localeCompare(b.id),
    )[0];
  }
  const trap = profile.kind === "trap3" || profile.kind === "trap5";
  let trapTarget: PlayerType | undefined;
  if (trap) {
    const code = profile.kind === "trap3" ? "3" : "5",
      label = config(s).techniqueLabels[code] ?? code;
    const candidates = dl.filter(
      (p) =>
        alignment(s, p.at[0]).technique === label &&
        (profile.kind === "trap5"
          ? (p.at[0] - center) * field > 0
          : (p.at[0] - center) * direction > 0),
    );
    trapTarget = nearest(
      candidates,
      center + direction * (profile.kind === "trap3" ? 1.6 : 2.8),
    );
    if (!trapTarget)
      warnings.push(
        `${code}-tech trap hedefi bu dizilişte yok. Pull yolu ve bölge görevi gösterilir; başka teknik ${code}-tech olarak etiketlenmez.`,
      );
    else reserved.add(trapTarget.id);
  }
  // Source-specific pullers: a GT pair is guard kick + tackle wrap; CT is center kick + tackle wrap.
  for (const [index, p] of pullers.entries()) {
    const source = ends(s, p.id),
      x = source?.to[0] ?? p.at[0],
      ownDirection =
        profile.number === 29 ? Math.sign(x - p.at[0]) || direction : direction;
    let target: PlayerType | undefined;
    if (profile.kind === "screen")
      target = nearest(
        lbs.filter(
          (p) =>
            !reserved.has(p.id) &&
            (p.at[0] - center) * field > 0 &&
            Math.abs(p.at[0] - x) <= 2.2,
        ),
        x + ownDirection * 0.5,
      );
    else if (trap) target = trapTarget;
    else if (profile.kind === "dart") {
      secondLevel.add(p.id);
      target = nearest(
        lbs.filter(
          (lb) => !reserved.has(lb.id) && (lb.at[0] - center) * direction >= 0,
        ),
        x,
      );
    } else if (index === 0 || profile.number === 29)
      target = nearest(
        dl.filter(
          (p) => !reserved.has(p.id) && (p.at[0] - center) * ownDirection >= 0,
        ),
        center + ownDirection * 2.8,
      );
    else {
      secondLevel.add(p.id);
      target = nearest(
        lbs.filter((p) => !reserved.has(p.id)),
        center + ownDirection * 2,
      );
    }
    assign(
      p,
      target,
      profile.kind === "screen"
        ? `Pas görünüşünü kısa süre koru; kaynak çizgideki gecikmeli ${ownDirection > 0 ? "sağ" : "sol"} screen çıkışını yap, ${target?.id ?? "field bölgesindeki ilk takipçiyi"} karşıla.`
        : trap
          ? `${profile.kind === "trap3" ? "3" : "Field 5"}-tech trap: kaynak çizgide hattın arkasından pull; ${target?.id ?? "hedef teknik bulunana kadar trap bölgesi"}.`
          : `${title}: ${p.pos} kaynak çizgide hattın arkasından ${ownDirection > 0 ? "sağa" : "sola"} pull. ${index === 0 || profile.number === 29 ? "Kick / kenar kontrolü" : "İlk pullerin arkasından wrap / ikinci seviye"}: ${target?.id ?? "bölgeyi oku"}.`,
      "pickup",
    );
  }
  const remaining = ol.filter(
    (p) => !pullers.some((q) => q.id === p.id) && !secondLevel.has(p.id),
  );
  // Preserve covered ownership before matching any uncovered down blocks.
  const available = dl.filter((p) => !reserved.has(p.id));
  for (const p of remaining) {
    const own = nearest(
      available.filter(
        (d) =>
          alignment(s, d.at[0]).nearest === p.id &&
          !reserved.has(d.id) &&
          Math.abs(d.at[0] - (ends(s, p.id)?.to[0] ?? p.at[0])) <= 1.3,
      ),
      p.at[0],
    );
    if (own)
      assign(
        p,
        own,
        `${title}: ${own.id} kendi bölgenizde. Pull yapan arkadaş için adamını bırakma; kaynak down/drive yolunu koru.`,
      );
  }
  const matched = localMatches(
    remaining
      .filter((p) => !targetByBlocker.has(p.id))
      .map((p) => ({
        ...p,
        at: [ends(s, p.id)?.to[0] ?? p.at[0], p.at[1]] as [number, number],
      })),
    available.filter((d) => !reserved.has(d.id)),
    1.8,
  );
  for (const p of remaining.filter((p) => !targetByBlocker.has(p.id))) {
    const found = dl.find((d) => d.id === matched.get(p.id));
    const target =
      found && Math.abs(found.at[0] - (ends(s, p.id)?.to[0] ?? p.at[0])) <= 1.8
        ? found
        : undefined;
    assign(
      p,
      target,
      target
        ? `${title}: pull ile açılan iç bölgeyi ${target.id} down bloğuyla kapat; çizilmiş OL yolu korunur.`
        : `${title}: açık iç bölgeyi koru; kaynak adımını ve LB akışını oku.`,
    );
  }
  for (const p of releasers) {
    const end = ends(s, p.id)?.to ?? p.at,
      target = nearest(
        lbs.filter((d) => !reserved.has(d.id)),
        end[0],
      );
    assign(
      p,
      target,
      `${title}: trap yapılacak DL’yi alma; kaynak çizgide bypass ederek ${target?.id ?? "ikinci seviye bölgesine"} çık.`,
      "pickup",
    );
  }
  // Label the imported path rather than replacing its pull geometry with pass protection.
  for (const p of ol) {
    const tracks = s.actions.filter(
      (a) =>
        a.player === p.id &&
        a.label !== "motion" &&
        !a.label.startsWith("special-"),
    );
    for (const [i, a] of tracks.entries()) {
      const pull = pullers.some((q) => q.id === p.id);
      a.target = targetByBlocker.get(p.id);
      a.gaze = a.target;
      a.assignment = pull ? "pull" : secondLevel.has(p.id) ? "zone" : "gap";
      a.kind = pull
        ? trap
          ? "trap"
          : profile.kind === "screen"
            ? "screen"
            : "pull"
        : "down";
      a.label = pull
        ? "source-pull"
        : secondLevel.has(p.id)
          ? "source-climb"
          : "source-down";
      const phase = pull
        ? i === 0
          ? "open"
          : i === tracks.length - 1
            ? "gather"
            : "run"
        : "drive";
      a.phases = [{ name: phase, start: a.start, end: a.end }];
    }
  }
  // Pullers finish their drawn rear-of-line track before gathering to the actual target.
  for (const p of pullers) {
    const target = s.players.find((d) => d.id === targetByBlocker.get(p.id)),
      last = ends(s, p.id),
      from = last?.to ?? p.at;
    if (!target) continue;
    const destination: [number, number] = [
      target.at[0] + (p.at[0] < target.at[0] ? -0.12 : 0.12),
      Math.max(0.3, target.at[1] - 0.55),
    ];
    // Trap drawings contain a release arrow beyond contact: retain the rear-line waypoints, stop at the trap target.
    if (trap && last && from[1] > 0.4) {
      last.path = (last.path ?? []).filter((q) => q[1] < 0.35);
      last.to = destination;
      const previous = position(s, p.id, last.start);
      last.end = Math.max(
        last.end,
        last.start + travelDuration(pathLength(previous, last), 1.8),
      );
      contact = Math.max(contact, last.end);
    } else {
      const start = last?.end ?? snap,
        end = start + travelDuration(pointDistance(from, destination), 1.8);
      s.actions.push({
        source: "ravens",
        player: p.id,
        label: "special-gather",
        kind: trap ? "trap" : "pull",
        assignment: "pull",
        start,
        end,
        to: destination,
        target: target.id,
        gaze: target.id,
        phases: [
          { name: "gather", start, end: end - 0.2 },
          { name: "strike", start: end - 0.2, end },
        ],
      });
      contact = Math.max(contact, end);
    }
  }
  finish = Math.max(finish, contact + 2.2);
  // Continue steady contact through the educational finish. Source paths for nonpullers stay intact.
  for (const p of ol) {
    const last = ends(s, p.id),
      from = last?.to ?? p.at,
      target = targetByBlocker.get(p.id);
    s.actions.push({
      source: "ravens",
      player: p.id,
      label: "special-hold",
      kind: pullers.some((q) => q.id === p.id) ? "pull" : "down",
      assignment: pullers.some((q) => q.id === p.id) ? "pull" : "gap",
      start: last?.end ?? snap,
      end: finish,
      to: [...from],
      target,
      gaze: target,
    });
  }
  if (profile.kind === "tushpush") {
    s.actions = s.actions.filter(
      (a) =>
        !s.players.some(
          (p) =>
            p.id === a.player &&
            p.side === "OFF" &&
            (linePositions.includes(p.pos) ||
              ["QB", "RB", "FB"].includes(p.pos) ||
              ["H", "U", "Y"].includes(p.id)),
        ),
    );
    assignments.length = 0;
    targetByBlocker.clear();
    reserved.clear();
    finish = snap + 6;
    contact = snap + 2.3;
    const match = matchDefenders(ol, dl);
    for (const p of ol) {
      const target = dl.find((d) => d.id === match.get(p.id)),
        to: [number, number] = [p.at[0], 1.6];
      assign(
        p,
        target,
        `Tush push: alçak pad seviyesi, kısa ileri adım ve sürekli drive; QB koridorunu aç.`,
      );
      s.actions.push(
        {
          source: "ravens",
          player: p.id,
          label: "special-tush-drive",
          assignment: "gap",
          start: snap,
          end: contact,
          to,
          target: target?.id,
          phases: [{ name: "low-drive", start: snap, end: contact }],
        },
        {
          source: "ravens",
          player: p.id,
          label: "special-tush-hold",
          assignment: "gap",
          start: contact,
          end: finish,
          to,
          target: target?.id,
        },
      );
    }
    const qb = s.players.find((p) => p.side === "OFF" && p.pos === "QB");
    if (qb) {
      s.actions.push(
        {
          source: "ravens",
          player: qb.id,
          label: "special-qb-surge",
          start: snap,
          end: contact + 0.4,
          to: [center, 1.05],
        },
        {
          source: "ravens",
          player: qb.id,
          label: "special-qb-finish",
          start: contact + 0.4,
          end: finish,
          to: [center, 1.05],
        },
      );
      notes[qb.id] =
        "Tush push: snap sonrası center arkasından kısa ve alçak ileri surge. Top QB’de kalır.";
      if (s.ravens)
        Object.assign(s.ravens, { carrier: qb.id, transferAt: snap });
    }
    const helpers = s.players.filter(
      (p) =>
        p.side === "OFF" &&
        p.id !== qb?.id &&
        !linePositions.includes(p.pos) &&
        (["RB", "FB"].includes(p.pos) || ["H", "U", "Y"].includes(p.id)),
    );
    for (const [i, p] of helpers.entries()) {
      const x =
        p.id === "H" || p.pos === "RB"
          ? center
          : center + Math.sign(p.at[0] - center || i - 1) * 0.65;
      s.actions.push(
        {
          source: "ravens",
          player: p.id,
          label: "special-follow-push",
          start: snap + 0.3,
          end: contact + 0.7,
          to: [x, 0.35],
        },
        {
          source: "ravens",
          player: p.id,
          label: "special-follow-hold",
          start: contact + 0.7,
          end: finish,
          to: [x, 0.35],
        },
      );
      notes[p.id] =
        "QB’nin arkasında kontrollü takip ve destek; QB’nin önüne geçme.";
    }
  } else if (profile.kind === "speed-option") {
    const qb = s.players.find((p) => p.side === "OFF" && p.pos === "QB"),
      rb = s.players.find((p) => p.side === "OFF" && p.pos === "RB"),
      choice = s.ravens?.optionRead ?? "keep";
    const explicit = s.players.find(
        (p) => p.side === "OFF" && p.id === s.ravens?.carrier,
      ),
      carrier = explicit ?? (choice === "pitch" ? rb : qb);
    if (qb)
      notes[qb.id] =
        `Field speed option: kaynak field yolunda force oyuncusunu oku. Seçilen gösterim ${choice === "pitch" ? "pitch; belirtilen anda topu dış raydaki taşıyıcıya aktar" : "QB keep; top QB’de kalır"}.`;
    if (rb)
      notes[rb.id] =
        choice === "pitch"
          ? "Pitch rayında QB’nin dışında ve kontrollü mesafede kal; seçilen top aktarımından sonra taşıyıcı yolunu sürdür."
          : "QB’nin dışındaki pitch rayını ve mesafeyi koru; keep seçildiği için topu almış gibi gösterilmez.";
    const defaultTransfer =
      choice === "pitch"
        ? Math.max(
            snap + 0.8,
            Math.min(
              ends(s, qb?.id ?? "")?.end ?? finish,
              ends(s, rb?.id ?? "")?.end ?? finish,
            ) - 0.3,
          )
        : snap;
    const transfer = Math.max(
      snap,
      Math.min(finish - 0.1, s.ravens?.transferAt ?? defaultTransfer),
    );
    if (s.ravens && carrier)
      Object.assign(s.ravens, {
        optionRead: choice,
        carrier: carrier.id,
        transferAt: transfer,
      });
    if (choice === "pitch" && !carrier)
      warnings.push("Pitch seçildi ancak sahada uygun taşıyıcı yok.");
    warnings.push(
      choice === "pitch"
        ? "Speed option pitch dalı seçilmiştir; top aktarım zamanı eğitim için ayarlanabilir."
        : "Speed option gösterimi QB keep dalındadır; pitch kararı kullanıcı tarafından seçilebilir.",
    );
  } else if (
    ["gt-counter", "ct-counter", "dart", "trap3", "trap5"].includes(
      profile.kind,
    )
  ) {
    const carrier =
      s.players.find((p) => p.side === "OFF" && p.id === s.ravens?.carrier) ??
      (profile.number === 28
        ? (s.players.find((p) => p.side === "OFF" && p.pos === "FB") ??
          s.players.find((p) => p.side === "OFF" && p.pos === "RB"))
        : s.players.find((p) => p.side === "OFF" && p.pos === "RB"));
    if (carrier) {
      const last = ends(s, carrier.id),
        from = last?.to ?? carrier.at,
        start = Math.max(last?.end ?? snap, contact + 0.15),
        to: [number, number] = [center + direction * (trap ? 2.1 : 3.8), 3.2],
        track: ActionType = {
          source: "ravens",
          player: carrier.id,
          label: "special-carry",
          start,
          end: start + 1,
          to,
          path: [
            [from[0], Math.min(-1, from[1])],
            [center + direction * (trap ? 1.4 : 3), -0.8],
          ],
        };
      track.end = start + travelDuration(pathLength(from, track), 3);
      s.actions.push(track);
      finish = Math.max(finish, track.end + 0.6);
      notes[carrier.id] =
        `${title}: kaynak ilk fake/mesh adımlarından sonra çağrılan ${direction > 0 ? "sağ" : "sol"} koridoru, pull yapan blokçuların arkasından takip et.`;
      if (s.ravens) {
        s.ravens.carrier = carrier.id;
        s.ravens.transferAt = prepareRunHandoff(s, carrier.id, start, warnings);
        finish = Math.max(finish, ...s.actions.map((a) => a.end + 0.1));
      }
      if (profile.number === 28)
        warnings.push(
          "CT counter’da kaynak H yolu ters yöne gidiyor; sol akıştaki F taşıyıcı olarak gösterildi, H fake yolu korunuyor.",
        );
      else if (Math.sign(from[0] - center) !== direction)
        warnings.push(
          `${carrier.id} kaynak fake sonrası ${title} yönüne kontrollü devam eder; kesin mesh/top verişi takım tarafından ayrıca tarif edilebilir.`,
        );
    }
  } else if (profile.kind === "screen" || profile.number === 29) {
    const qb = s.players.find((p) => p.side === "OFF" && p.pos === "QB"),
      requested = s.players.find(
        (p) =>
          p.side === "OFF" &&
          !linePositions.includes(p.pos) &&
          p.id === s.ravens?.carrier,
      ),
      carrier =
        requested ?? s.players.find((p) => p.side === "OFF" && p.pos === "RB");
    if (carrier) {
      const last = ends(s, carrier.id),
        start = Math.max(snap + 0.8, last?.end ?? snap + 0.8);
      if (profile.kind === "screen") {
        const from = last?.to ?? carrier.at,
          to: [number, number] = [center + field * 4.4, 3.2],
          run: ActionType = {
            source: "ravens",
            player: carrier.id,
            label: "special-screen-carry",
            start,
            end: start + 1,
            to,
            path: [
              [from[0], Math.min(-1, from[1])],
              [center + field * 4.4, -0.5],
            ],
          };
        run.end = start + travelDuration(pathLength(from, run), 3);
        s.actions.push(run);
        finish = Math.max(finish, run.end + 0.6);
      }
      const transferAt = Math.max(
        snap,
        Math.min(
          s.ravens?.transferAt ??
            (profile.kind === "screen" ? start - 0.15 : snap + 1.0),
          finish - 0.1,
        ),
      );
      if (s.ravens) {
        s.ravens.carrier = carrier.id;
        s.ravens.transferAt =
          profile.number === 29
            ? prepareRunHandoff(s, carrier.id, snap + 1, warnings)
            : transferAt;
        finish = Math.max(finish, ...s.actions.map((a) => a.end + 0.1));
      }
      notes[carrier.id] =
        profile.kind === "screen"
          ? `Field screen alıcısı ${carrier.id}: gecikmeli çıkan RG/RT eskortunun arkasındaki field koridoruna devam et.`
          : `İki guard karşıt dış pull yaparken ${carrier.id} kaynak H/F sol akışını takip eder; Z arka alan fake/motion yolu korunur.`;
      warnings.push(
        `${profile.kind === "screen" ? "Screen" : "29 özel oyun"} taşıyıcısı ${carrier.id}, top aktarımı ${(s.ravens?.transferAt ?? transferAt).toFixed(1)} sn olarak eğitim gösteriminde seçildi; taşıyıcı/devir alanından değiştirilebilir.`,
      );
    }
    if (qb)
      notes[qb.id] =
        profile.kind === "screen"
          ? "Field screen: pas görünüşünü koru; seçili alıcıya field screen aktarımını yap."
          : "Kaynak iki guard dış pull ve H/F sol akışına göre seçilen taşıyıcıyla fake/mesh; diğer alıcı çizgileri korunur.";
    if (profile.number === 29)
      warnings.push(
        "29: iki guard dışa farklı yönlere pull yapıyor; H/F sol akış ve Z motion çizimi korunur.",
      );
  }
  // Extend our contact holds to the final runner segment without accelerating the blockers.
  for (const a of s.actions.filter(
    (a) =>
      a.label === "special-hold" ||
      a.label === "special-tush-hold" ||
      a.label === "special-qb-finish" ||
      a.label === "special-follow-hold",
  ))
    a.end = finish;
  const reactionEnd = Math.max(snap + 1.3, Math.min(contact, snap + 2));
  const defenders = s.players.filter((p) => p.side === "DEF");
  for (const p of defenders) {
    if (!["DL", "LB"].includes(p.pos) && p.intent !== "blitz") continue;
    if (
      authoredDEF.has(p.id) ||
      p.intent === "hold" ||
      p.intent === "show" ||
      p.reaction === "hold"
    )
      continue;
    const owner = assignments.find((a) => a.target === p.id),
      blocker = owner
        ? s.players.find((q) => q.id === owner.player)
        : undefined;
    const r = p.reaction ?? "base",
      lateral =
        r === "slant-field"
          ? field * 0.6
          : r === "slant-boundary"
            ? -field * 0.6
            : r === "pinch"
              ? -Math.sign(p.at[0] - center) * 0.5
              : r === "widen"
                ? Math.sign(p.at[0] - center) * 0.5
                : 0;
    const fit: [number, number] = blocker
      ? [
          position(s, blocker.id, reactionEnd)[0],
          position(s, blocker.id, reactionEnd)[1] + 0.55,
        ]
      : [
          p.at[0] + lateral,
          p.pos === "DL" ? 0.65 : p.intent === "blitz" ? 0.5 : 2.3,
        ];
    s.actions.push({
      source: "ravens",
      player: p.id,
      label: "special-run-fit",
      start: snap,
      end: reactionEnd,
      to: fit,
    });
    if (blocker) {
      const to = position(s, blocker.id, Math.min(finish, contact));
      s.actions.push(
        {
          source: "ravens",
          player: p.id,
          label: "special-block-resist",
          start: reactionEnd,
          end: Math.max(reactionEnd + 0.2, contact),
          to: [to[0], to[1] + 0.55],
        },
        {
          source: "ravens",
          player: p.id,
          label: "special-block-hold",
          start: Math.max(reactionEnd + 0.2, contact),
          end: finish,
          to: [to[0], to[1] + 0.55],
        },
      );
    }
  }
  const active = defenders.filter(
      (p) =>
        p.intent !== "hold" &&
        p.intent !== "show" &&
        p.reaction !== "hold" &&
        (p.pos === "DL" ||
          s.actions.some(
            (a) => a.player === p.id && a.label === "special-run-fit",
          ) ||
          p.intent === "blitz" ||
          (p.at[1] >= 0 && p.at[1] <= 1.8)),
    ),
    unblocked = active
      .filter((p) => !assignments.some((a) => a.target === p.id))
      .map((p) => p.id);
  if (unblocked.length)
    warnings.push(
      `Blok dışı koşu takipçileri: ${unblocked.join(", ")}. Çizilmiş pull görevleri nedeniyle bu tehditler sahipsiz; eşleşmiş gibi sayılmaz.`,
    );
  const coverage: DefenseCoverage[] = defenders.map((p) => {
    const a = assignments.filter((a) => a.target === p.id);
    return {
      defender: p.id,
      position: p.pos,
      technique: p.pos === "DL" ? alignment(s, p.at[0]).technique : null,
      blockers: a.map((a) => a.player),
      watchers: [],
      detail: a
        .map(
          (a) =>
            `${a.player} · ${pullers.some((q) => q.id === a.player) ? (trap ? "trap" : "pull") : "down / drive"}`,
        )
        .join(", "),
      status:
        p.intent === "show"
          ? "show"
          : a.length
            ? "blocked"
            : unblocked.includes(p.id)
              ? "free"
              : "idle",
    };
  });
  s.playbook = `Ravens ${profile.number} · ${title}`;
  s.blitz = "none";
  s.rules = [
    {
      id: "ravens-special",
      blitz: "none",
      title,
      note: `${title}. Kaynak OL yolları ve belirtilen pull/trap görevleri uygulanır. ${warnings.join(" ")}`,
      assign: Object.fromEntries(
        assignments.map((a) => [
          a.player,
          { type: a.type, target: a.target, note: a.note },
        ]),
      ),
    },
  ];
  s.steps = [
    {
      title: `${profile.number} · ${title} / motion`,
      start: 0,
      end: snap,
      description: `Kaynak dizilişi ve snap öncesi motion. ${profile.direction === "boundary" ? "Boundary" : profile.direction === "field" ? "Field" : "Çizimdeki"} yönü ve puller görevlerini oku.`,
      notes,
      focus: pullers.map((p) => p.id),
    },
    {
      title:
        profile.kind === "tushpush"
          ? "Alçak ileri surge"
          : "İlk adım / pull açılışı",
      start: snap,
      end: Math.min(contact, snap + 1.2),
      description:
        profile.kind === "tushpush"
          ? "OL kısa, alçak ileri adımla QB koridorunu açar."
          : "Pull yapan oyuncular çizimdeki arka hat yoluna açılır; kalan OL down/drive ve iç bölge kontrolünü sürdürür.",
      notes,
      focus: ol.map((p) => p.id),
    },
    {
      title: "Gather / temas / ikinci seviye",
      start: Math.min(contact, snap + 1.2),
      end: Math.max(contact + 0.2, snap + 1.4),
      description: `${title}: belirtilen hedefte temas kur. Hedef teknik yoksa uyarıyı kontrol et; başka teknik aynı hedef sayılmaz.`,
      notes,
      focus: assignments.map((a) => a.target).filter((x): x is string => !!x),
    },
    {
      title: "Koridor / son kontrol",
      start: Math.max(contact + 0.2, snap + 1.4),
      end: finish,
      description: `${warnings.join(" ") || "Blok paylaşımı ve taşıyıcı koridorunu incele."}`,
      notes,
      focus: [],
    },
  ];
  return {
    scenario: Scenario.parse(s),
    mode: "base",
    frontLabel: frontLabel(s),
    front: dl.length,
    pressureCount: active.length,
    assignments,
    warnings,
    coverage,
    unblocked,
    boundaryLocks: [],
    alert: false,
    fieldThreats: lbs
      .filter((p) => p.intent === "blitz" && (p.at[0] - center) * field > 2.4)
      .map((p) => p.id),
    boundaryThreats: lbs
      .filter((p) => p.intent === "blitz" && (p.at[0] - center) * field < -2.4)
      .map((p) => p.id),
    interiorThreats: lbs
      .filter((p) => p.intent === "blitz" && Math.abs(p.at[0] - center) <= 2.4)
      .map((p) => p.id),
  };
}
