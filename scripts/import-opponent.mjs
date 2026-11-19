import fs from "node:fs";
import { JSDOM } from "jsdom";
import { sampleDrawing } from "../src/ravens.ts";
const input = process.argv[2];
if (!input)
  throw Error(
    "node --experimental-strip-types scripts/import-opponent.mjs snapshot.html",
  );
const document = new JSDOM(fs.readFileSync(input, "utf8")).window.document,
  scale = 1.2 / (1024 * 0.04),
  packages = [];
for (const tile of document.querySelectorAll(".tile.play.phaseDefense")) {
  const ball = tile.querySelector("svg.ball");
  if (!ball) throw Error("Kaynak top/merkez işareti yok");
  const anchor = {
    x: (parseFloat(ball.getAttribute("x")) / 100) * 1024,
    y: (parseFloat(ball.getAttribute("y")) / 100) * 2304,
  };
  const label = tile.querySelector(".label").cloneNode(true);
  label.querySelector("strong")?.remove();
  const players = [...tile.querySelectorAll("g.myTeam svg.player")].map(
    (p, index) => {
      const text = p.querySelector("text").textContent.trim(),
        x = (parseFloat(p.getAttribute("x")) / 100) * 1024,
        y = (parseFloat(p.getAttribute("y")) / 100) * 2304,
        pos = ["E", "T", "N"].includes(text)
          ? "DL"
          : ["S", "M", "W"].includes(text)
            ? "LB"
            : text === "C"
              ? "CB"
              : text;
      return {
        id: `OP_${text}_${index + 1}`,
        label: text,
        pos,
        at: [(x - anchor.x) * scale, (y - anchor.y) * scale],
        paths: [...p.querySelectorAll("g.lines > path")].map((a) => ({
          d: a.getAttribute("d"),
          points: sampleDrawing(a.getAttribute("d")).map(([x, z]) => [
            x * scale,
            z * scale,
          ]),
        })),
      };
    },
  );
  if (players.length !== 11) throw Error("11 savunmacı bekleniyor");
  packages.push({
    id: tile.querySelector("input[type=checkbox]").value,
    name: label.textContent.trim(),
    formation: "4-3",
    anchor,
    scale,
    players,
  });
}
if (packages.length !== 5) throw Error("5 rakip çağrı bekleniyor");
fs.writeFileSync(
  "src/data/opponent-kocaeli.json",
  JSON.stringify(packages, null, 2) + "\n",
);
console.log(
  `Imported ${packages.length} opponent calls / ${packages.reduce((n, p) => n + p.players.length, 0)} defenders`,
);
