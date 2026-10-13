#!/usr/bin/env python3
"""Build a small public course index from the repository's source DOCX files."""
from __future__ import annotations

import json
import re
import zipfile
from pathlib import Path
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]
COURSES = ROOT / "maliye"
OUTPUT = ROOT / "site" / "data" / "courses.json"
NS = {"w": "http://schemas.openxmlformats.org/wordprocessingml/2006/main"}
TASK_ID = re.compile(r"^([PCAERDGY]\d+)\s*(.*)$")
BLOCK = re.compile(r"^BLOK\s+(\d+)\b", re.IGNORECASE)
TASK_SECTIONS = {
    "C": "Kavramları haritala",
    "P": "Uygula",
    "A": "Analoji kur ve eleştir",
        "E": "Kanıtları sakla",
        "D": "Kanıt ve referans ayrımı",
    "ER": "Kanıt mı, referans mı?",
    "R": "Referans kartı",
}


def read_docx(path: Path) -> list[str]:
    with zipfile.ZipFile(path) as doc:
        xml = ET.fromstring(doc.read("word/document.xml"))
    paragraphs = []
    for paragraph in xml.findall(".//w:p", NS):
        text = "".join((run.text or "") for run in paragraph.findall(".//w:t", NS))
        paragraphs.append(re.sub(r"\s+", " ", text).strip())
    return paragraphs


def tidy_key(text: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", text.casefold()).strip("-")


def extract_course(path: Path) -> dict:
    paras = read_docx(path)
    title = next((p for p in paras if p), path.stem)
    slug = path.stem.split("-", 1)[0] + "-" + tidy_key(title)
    meta = " ".join(paras[:8])
    duration = re.search(r"Bugünkü oturum:\s*~?([\d,.]+)\s*dk", meta, re.IGNORECASE)
    thesis = next((p.partition(":")[2].strip() for p in paras if p.startswith("Konunun çekirdeği:")), "")
    outcomes = next((p.partition(":")[2].strip() for p in paras if p.startswith("Oturumun sonunda yapabilmen gereken:")), "")

    source_i = next((i for i, p in enumerate(paras) if p.upper().startswith("KAYNAK METİN")), len(paras))
    answer_i = next(
        (i for i, p in enumerate(paras) if i > source_i and p.upper().startswith("CEVAP ANAHTARI")),
        len(paras),
    )

    source = []
    for p in paras[source_i + 1 : answer_i]:
        if not p or re.fullmatch(r"\d+", p):
            continue
        source.append(p)

    source_intro = []
    source_blocks: dict[int, dict[int, str]] = {}
    source_block_number = 1
    source_paragraph_number = None
    for p in source:
        block_match = BLOCK.match(p)
        if block_match:
            source_block_number = int(block_match.group(1))
            source_paragraph_number = None
            continue
        marker = re.match(r"^¶\s*(\d+)\s*(.*)$", p)
        if marker:
            source_paragraph_number = int(marker.group(1))
            # Source markers can also carry compact marginal references (¶4C2).
            suffix = marker.group(2).strip()
            if re.fullmatch(r"(?:[DCPAE RGY]\d+\s*)+", suffix):
                suffix = ""
            if source_paragraph_number not in source_blocks.setdefault(source_block_number, {}):
                source_blocks[source_block_number][source_paragraph_number] = suffix
            elif suffix:
                source_blocks[source_block_number][source_paragraph_number] += " " + suffix
            continue
        if source_paragraph_number is None:
            source_intro.append(p)
        else:
            old = source_blocks.setdefault(source_block_number, {}).get(source_paragraph_number, "")
            source_blocks[source_block_number][source_paragraph_number] = (old + " " + p).strip()

    answers = {}
    for p in paras[answer_i + 1 :]:
        match = TASK_ID.match(p)
        if match and match.group(1) not in answers:
            answers[match.group(1)] = match.group(2).strip()

    analogy_answers = {}
    answer_block = None
    capturing_analogy = False
    for p in paras[answer_i + 1 :]:
        block_heading = re.match(r"^Blok\s+(\d+)\s*[—–-]", p, re.IGNORECASE)
        if block_heading:
            answer_block = int(block_heading.group(1))
            capturing_analogy = False
            continue
        if p.startswith("Analoji eleştirisi"):
            capturing_analogy = True
            analogy_answers[answer_block] = [p]
            continue
        if capturing_analogy:
            if TASK_ID.match(p) or p.startswith(("Uzman gibi gez", "Kanıt provası", "Uzmanın ağı")):
                capturing_analogy = False
            elif p.startswith(("▹", "Eleştir:", "Futbol benzetmen:")):
                analogy_answers[answer_block].append(p)

    block_starts = [
        i for i, p in enumerate(paras[:source_i])
        if p.startswith("BLOK ") and re.search(r"~\s*\d+\s*dk\s*oku", p, re.IGNORECASE)
    ]
    blocks = []
    for n, start in enumerate(block_starts):
        stop = block_starts[n + 1] if n + 1 < len(block_starts) else source_i
        content = paras[start:stop]
        heading = content[0]
        match = BLOCK.match(heading)
        block_number = int(match.group(1)) if match else n + 1
        time_match = re.search(r"~\s*(\d+)\s*dk\s*oku\s*·\s*~\s*(\d+)\s*dk\s*sindir", heading, re.IGNORECASE)

        sections = []
        current = None
        for p in content[1:]:
            if not p:
                continue
            section = re.match(r"^([PCAER])\s+(.{2,72})$", p)
            combined = re.match(r"^E\s+R\s+(Ayır ve sakla)$", p)
            if combined:
                section = ("E", combined.group(1))
            section_title = combined.group(1) if combined else section.group(2) if section else ""
            if section and section_title.strip() in {
                "Haritana ekle", "Şimdi uygula", "Analojiyi eleştir", "Ayır ve sakla"
            }:
                kind = "ER" if combined else section.group(1)
                current = {
                    "type": kind,
                    "label": TASK_SECTIONS.get(kind, kind),
                    "instruction": p,
                    "guidance": [],
                    "tasks": [],
                }
                sections.append(current)
                continue
            task = TASK_ID.match(p)
            if task:
                task_id, prompt = task.group(1), task.group(2).strip()
                kind = "ER" if task_id.startswith("D") else task_id[0]
                if task_id.startswith(("Y", "G")):
                    continue
                if current is None or current["type"] != kind:
                    current = {
                        "type": kind,
                        "label": TASK_SECTIONS.get(kind, "Görev"),
                        "instruction": "",
                        "guidance": [],
                        "tasks": [],
                    }
                    sections.append(current)
                current["tasks"].append({"id": task_id, "prompt": prompt, "answer": answers.get(task_id, "")})
                continue
            if current and p.startswith("③"):
                current = None
                continue
            if current and current["type"] == "A":
                analogy_prompt = re.match(r"^(\d+)[.)]\s+(.+)$", p)
                if analogy_prompt:
                    number, prompt = analogy_prompt.groups()
                    current["tasks"].append(
                        {
                            "id": f"A{block_number}q{number}",
                            "prompt": prompt,
                            "answer": "\n".join(analogy_answers.get(block_number, [])),
                        }
                    )
                elif p.startswith("Futbol benzetmen:") or p.startswith("Kendi benzetmeni kur:"):
                    current["tasks"].append(
                        {
                            "id": f"A{block_number}own",
                            "prompt": p,
                            "answer": "\n".join(analogy_answers.get(block_number, [])),
                        }
                    )
                elif p.startswith("Konu içinden:"):
                    current["guidance"].append(p)
                else:
                    current["guidance"].append(p)
                continue
            if current and p.startswith(("→", "Örnek cevap", "Çözümlü örnek:")):
                current["instruction"] += "\n" + p
            elif current and p not in {"✓", "☐", "—"}:
                current["guidance"].append(p)

        # Add the original read direction even when a worksheet uses a label variation.
        read_instruction = next(
            (p for p in content if "① TÜKET" in p or p.startswith("Oku:") or "Kaynak metinde" in p),
            "",
        )
        block_title = re.sub(r"^BLOK\s+\d+\s*", "", heading, flags=re.IGNORECASE)
        block_title = re.sub(r"\s*~\s*\d+\s*dk\s*oku.*$", "", block_title, flags=re.IGNORECASE).strip(" ·—-")
        read_range = re.search(r"¶\s*(\d+)\s*[-–—]\s*(\d+)", read_instruction)
        source_map = source_blocks.get(block_number, {})
        if read_range:
            lo, hi = sorted((int(read_range.group(1)), int(read_range.group(2))))
            reading = [
                {"number": number, "text": text}
                for number, text in sorted(source_map.items())
                if lo <= number <= hi and text
            ]
        else:
            reading = [{"number": number, "text": text} for number, text in sorted(source_map.items()) if text]
        blocks.append(
            {
                "number": block_number,
                "title": block_title or f"Blok {block_number}",
                "readMinutes": int(time_match.group(1)) if time_match else None,
                "digestMinutes": int(time_match.group(2)) if time_match else None,
                "readInstruction": read_instruction,
                "reading": reading,
                "sections": sections,
            }
        )

    wrap_up = []
    for p in paras[block_starts[-1] : source_i]:
        task = TASK_ID.match(p)
        if task and task.group(1)[0] in "YG":
            wrap_up.append(
                {
                    "id": task.group(1),
                    "type": "map" if task.group(1).startswith("Y") else "proof",
                    "prompt": task.group(2).strip(),
                    "answer": answers.get(task.group(1), ""),
                }
            )

    category = title.split(" — ", 1)[0].split(" 1/", 1)[0].split(" 2/", 1)[0]
    category = re.sub(r"\s+[1-5]/[1-5]$", "", category)
    return {
        "id": slug,
        "filename": path.name,
        "title": title,
        "category": category,
        "durationMinutes": float(duration.group(1).replace(",", ".")) if duration else None,
        "thesis": thesis,
        "outcomes": outcomes,
        "blocks": blocks,
        "wrapUp": wrap_up,
        "sourceIntro": source_intro,
        "answers": answers,
    }


def main() -> None:
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    files = sorted(COURSES.glob("*.docx"), key=lambda p: (int(re.match(r"\d+", p.name).group()), p.name))
    courses = [extract_course(path) for path in files]
    OUTPUT.write_text(json.dumps(courses, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(f"Built {len(courses)} lessons ({sum(len(c['blocks']) for c in courses)} blocks) → {OUTPUT}")


if __name__ == "__main__":
    main()
