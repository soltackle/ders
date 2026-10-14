#!/usr/bin/env python3
"""Build a small public course index from the repository's source DOCX files."""
from __future__ import annotations

import hashlib
import json
import re
import zipfile
from pathlib import Path
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]
COURSES = ROOT / "maliye"
OUTPUT = ROOT / "site" / "data" / "courses.json"
MAP_DEFINITIONS = json.loads((ROOT / "scripts" / "concept_maps.json").read_text(encoding="utf-8"))
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


def read_docx_tables(path: Path) -> list[list[str]]:
    """Read table rows without flattening their cells into neighboring prompts."""
    with zipfile.ZipFile(path) as doc:
        xml = ET.fromstring(doc.read("word/document.xml"))
    tables: list[list[str]] = []
    for table in xml.findall(".//w:tbl", NS):
        for row in table.findall("./w:tr", NS):
            cells = []
            for cell in row.findall("./w:tc", NS):
                paragraphs = [
                    "".join((run.text or "") for run in paragraph.findall(".//w:t", NS)).strip()
                    for paragraph in cell.findall("./w:p", NS)
                ]
                cells.append(re.sub(r"\s+", " ", " ".join(p for p in paragraphs if p)).strip())
            if any(cells):
                tables.append(cells)
    return tables


def tidy_key(text: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", text.casefold()).strip("-")


def build_answer_maps(path: Path, tasks: list[dict]) -> list[dict]:
    """Attach concept links reviewed against each document's Y answer keys."""
    number = re.match(r"\d+", path.name).group()
    definitions = MAP_DEFINITIONS.get(number, {})
    hashes = definitions.get("_source", {})
    maps = []
    for task in tasks:
        if not task["answer"]:
            continue
        links = definitions.get(task["id"])
        checksum = hashlib.sha256(task["answer"].encode("utf-8")).hexdigest()
        if not links or hashes.get(task["id"]) != checksum:
            raise ValueError(f"Review concept map {path.name} {task['id']}: answer key is new or changed.")
        if any(not isinstance(link, list) or len(link) != 3 or any(not isinstance(text, str) or not text.strip() for text in link) or link[0] == link[2] for link in links):
            raise ValueError(f"Invalid concept links: {path.name} {task['id']}")
        names = list(dict.fromkeys(name for start, _, end in links for name in (start, end)))
        incoming = {name: sum(end == name for _, _, end in links) for name in names}
        queue = [name for name in names if not incoming[name]]
        for start in queue:
            for source, _, end in links:
                if source == start:
                    incoming[end] -= 1
                    if incoming[end] == 0:
                        queue.append(end)
        if len(queue) != len(names):
            raise ValueError(f"Cyclic concept links: {path.name} {task['id']}")
        connected = {names[0]}
        pending = [names[0]]
        for name in pending:
            for start, _, end in links:
                neighbor = end if start == name else start if end == name else None
                if neighbor is not None and neighbor not in connected:
                    connected.add(neighbor)
                    pending.append(neighbor)
        if len(connected) != len(names):
            raise ValueError(f"Disconnected concept links: {path.name} {task['id']}")
        maps.append({"id": task["id"], "links": links})
    return maps


def extract_course(path: Path) -> dict:
    paras = read_docx(path)
    table_rows = read_docx_tables(path)
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

    detail_by_reference = {}
    detail_by_id = {}
    evidence_bank = []
    seen_evidence = set()
    reference_cards = []
    seen_cards = set()
    evidence_table_texts = set()
    knowledge_profile = []
    for row in table_rows:
        first = row[0].strip() if row else ""
        cells = [cell.strip() for cell in row]
        profile_match = re.match(r"^([PCAER])\s*[·.]\s*(.+)$", first)
        if profile_match and len(cells) >= 3 and cells[1] and cells[2]:
            knowledge_profile.append(
                {
                    "type": profile_match.group(1),
                    "label": profile_match.group(2),
                    "weight": cells[1],
                    "description": cells[2],
                }
            )
        detail = next((cell for cell in cells[1:] if cell), "")
        detail_match = re.match(r"^(D\d+)(?:\s*(¶\s*\d+))?$", first)
        if detail_match and detail:
            evidence_table_texts.add(detail)
            task_id, reference = detail_match.groups()
            if reference:
                detail_by_reference[(task_id, re.sub(r"\s+", "", reference))] = detail
            detail_by_id.setdefault(task_id, detail)
            kind_answer = answers.get(task_id, "")
            kind_match = re.search(r"→\s*([ER])\b", kind_answer, re.IGNORECASE)
            evidence_key = (task_id, detail)
            if evidence_key not in seen_evidence:
                evidence_bank.append(
                    {
                        "id": task_id,
                        "text": detail,
                        "sourceRefs": re.findall(r"¶\s*\d+", first),
                        "expectedKind": kind_match.group(1).upper() if kind_match else "",
                    }
                )
                seen_evidence.add(evidence_key)
            continue
        card_match = re.match(r"^(K\d+)$", first)
        if card_match and len(cells) >= 3 and cells[1] and cells[2]:
            key = (card_match.group(1), cells[1], cells[2])
            if key not in seen_cards:
                reference_cards.append(
                    {"id": key[0], "front": key[1], "back": key[2]}
                )
                seen_cards.add(key)

    analogy_answers = {}
    analogy_by_topic = {}
    answer_block = None
    capturing_analogy = False
    for p in paras[answer_i + 1 :]:
        block_heading = re.match(r"^Blok\s+(\d+)\s*[—–-]", p, re.IGNORECASE)
        if block_heading:
            answer_block = int(block_heading.group(1))
            capturing_analogy = False
            continue
        if p.startswith(("Analoji eleştirisi", "PACER'in analojisi ve eleştirisi")):
            capturing_analogy = True
            analogy_answers[answer_block] = [p]
            topic = re.split(r"\s*[—–]\s*", p, maxsplit=1)[-1].casefold()
            analogy_by_topic[topic] = analogy_answers[answer_block]
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
        if n == len(block_starts) - 1:
            proof_heading = next(
                (i for i, p in enumerate(content) if p.upper().startswith("GÜN SONU / HAFTA SONU")),
                None,
            )
            if proof_heading is not None:
                content = content[:proof_heading]
        heading = content[0]
        match = BLOCK.match(heading)
        block_number = int(match.group(1)) if match else n + 1
        time_match = re.search(r"~\s*(\d+)\s*dk\s*oku\s*·\s*~\s*(\d+)\s*dk\s*sindir", heading, re.IGNORECASE)

        sections = []
        current = None
        for p in content[1:]:
            if not p:
                continue
            if p in evidence_table_texts:
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
                source_refs = re.findall(r"¶\s*\d+", prompt)
                if task_id.startswith("D") and re.fullmatch(r"¶\s*\d+", prompt):
                    prompt = detail_by_reference.get(
                        (task_id, re.sub(r"\s+", "", prompt)), prompt
                    )
                elif task_id.startswith("D") and not prompt:
                    prompt = detail_by_id.get(task_id, prompt)
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
                task_data = {"id": task_id, "prompt": prompt, "answer": answers.get(task_id, "")}
                if kind == "ER":
                    task_data["sourceRefs"] = source_refs
                    classification = re.search(r"→\s*([ER])\b", task_data["answer"], re.IGNORECASE)
                    task_data["expectedKind"] = classification.group(1).upper() if classification else ""
                current["tasks"].append(task_data)
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
                elif p.startswith(("Futbol benzetmen:", "Kendi benzetmeni kur:", "Kendi analojin:")):
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

        # Some worksheets place an analogy in a different block than its answer key.
        # Match the original topic before falling back to the block number.
        for section in sections:
            if section["type"] != "A":
                continue
            guidance = " ".join(section["guidance"]).casefold()
            matches = [answer for topic, answer in analogy_by_topic.items() if topic in guidance]
            if len(matches) == 1:
                for task in section["tasks"]:
                    task["answer"] = "\n".join(matches[0])

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
    reflection_questions = []
    proof_tasks = []
    for p in paras[block_starts[-1] : source_i]:
        task = TASK_ID.match(p)
        if task and task.group(1)[0] == "Y":
            wrap_up.append(
                {
                    "id": task.group(1),
                    "type": "map" if task.group(1).startswith("Y") else "proof",
                    "prompt": task.group(2).strip(),
                    "answer": answers.get(task.group(1), ""),
                }
            )
        elif task and task.group(1)[0] == "G":
            proof_tasks.append(
                {
                    "id": task.group(1),
                    "prompt": task.group(2).strip(),
                    "answer": answers.get(task.group(1), ""),
                }
            )

    reflection_heading = next(
        (i for i, p in enumerate(paras[:source_i]) if p.upper().startswith("OTURUM SONU") and "DEĞERLENDİRME" in p.upper()),
        None,
    )
    if reflection_heading is not None:
        for p in paras[reflection_heading + 1 : source_i]:
            if p.upper().startswith("KAVRAM HARİTASI"):
                break
            question = re.match(r"^\d+[.)]\s*(.+)$", p)
            if question:
                reflection_questions.append(question.group(1).strip())

    map_heading = next(
        (i for i, p in enumerate(paras[:source_i]) if p.upper().startswith("KAVRAM HARİTASI")),
        None,
    )
    map_setup = {}
    if map_heading is not None:
        map_setup = {
            "title": paras[map_heading],
            "instruction": paras[map_heading + 1] if map_heading + 1 < source_i else "",
            "starter": next(
                (p.partition(":")[2].strip() for p in paras[map_heading + 2 : source_i] if p.lower().startswith("başlangıç önerisi:")),
                "",
            ),
        }
    proof_heading_text = next(
        (p for p in paras[:source_i] if p.upper().startswith("GÜN SONU / HAFTA SONU")),
        "",
    )
    proof_instructions = []
    if proof_heading_text:
        proof_index = paras.index(proof_heading_text)
        proof_instructions = [
            p for p in paras[proof_index + 1 : source_i]
            if p and not TASK_ID.match(p) and not p.startswith(("#", "☐"))
        ][:2]
    study_guide_start = next(
        (i for i, p in enumerate(paras[:source_i]) if p.lower() == "bu kağıt nasıl çalışır"),
        None,
    )
    study_guide = []
    if study_guide_start is not None:
        guide_end = next(
            (i for i in range(study_guide_start + 1, source_i) if paras[i].lower().startswith("bu konunun bilgi dokusu")),
            source_i,
        )
        study_guide = [p for p in paras[study_guide_start + 1 : guide_end] if p]

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
        "mapWalks": wrap_up,
        "answerMaps": build_answer_maps(path, wrap_up),
        "reflectionQuestions": reflection_questions,
        "studyGuide": study_guide,
        "knowledgeProfile": knowledge_profile,
        "mapSetup": map_setup,
        "referenceCards": reference_cards,
        "evidenceBank": evidence_bank,
        "proofPractice": {
            "title": proof_heading_text,
            "instructions": proof_instructions,
            "tasks": proof_tasks,
            "evidenceIds": list(dict.fromkeys(item["id"] for item in evidence_bank)),
        },
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
