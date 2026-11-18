// Read a user-supplied Playmaker HTML snapshot; emit only validated drawing data.
import fs from "node:fs";
import { JSDOM } from "jsdom";
const input = process.argv[2];
if (!input) throw Error("Usage: node scripts/import-ravens.mjs snapshot.html");
const document = new JSDOM(fs.readFileSync(input, "utf8")).window.document;
const plays = [];
for (const tile of document.querySelectorAll(".tile.play")) {
  if (tile.querySelector(".label strong")?.textContent !== "MOST") continue;
  const label = tile.querySelector(".label").cloneNode(true);
  label.querySelector("strong").remove();
  const players = [...tile.querySelectorAll("g.myTeam svg.player")].map(
    (p) => ({
      id: p.querySelector("text").textContent,
      x: (parseFloat(p.getAttribute("x")) / 100) * 1024,
      y: (parseFloat(p.getAttribute("y")) / 100) * 2304,
      paths: [...p.querySelectorAll("g.lines > path")].map((path) => ({
        d: path.getAttribute("d"),
        motion: /dotted|dashed/.test(path.getAttribute("class") ?? ""),
      })),
    }),
  );
  const svg = tile.querySelector(".routes > svg");
  if (svg.getAttribute("viewBox") !== "0 0 1024 2304")
    throw Error("Unknown drawing scale");
  if (
    players.length !== 11 ||
    new Set(players.map((p) => p.id)).size !== 11 ||
    !players.every((p) => [p.x, p.y].every(Number.isFinite))
  )
    throw Error("Invalid roster");
  const commands = new Set(
    players.flatMap((p) =>
      p.paths.flatMap((a) => a.d.match(/[a-df-z]/gi) ?? []),
    ),
  );
  for (const cmd of commands)
    if (!["M", "L", "Q", "C", "Z", "H", "V"].includes(cmd))
      throw Error("Unsupported SVG command " + cmd);
  plays.push({
    id: tile.querySelector("input[type=checkbox]").value,
    name: label.textContent.trim(),
    players,
  });
}
if (plays.length !== 35) throw Error("Expected 35 MOST plays");
fs.writeFileSync(
  "src/data/ravens-most.json",
  JSON.stringify(plays, null, 2) + "\n",
);
console.log(
  `Imported ${plays.length} MOST plays / ${plays.reduce((n, p) => n + p.players.length, 0)} players`,
);
