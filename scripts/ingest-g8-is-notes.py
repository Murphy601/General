#!/usr/bin/env python3
"""Ingest Grade 8 Integrated Science notes docx text into structured JSON."""
from __future__ import annotations

import json
import re
import zipfile
from pathlib import Path
from xml.etree import ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]
DOCX = ROOT / "knowledge-base" / "textbooks" / "GRADE_8_INTEGRATED_SCIENCE_NOTES.docx"
OUT = ROOT / "knowledge-base" / "textbooks" / "grade-8-integrated-science-notes.json"
RAW = ROOT / "knowledge-base" / "textbooks" / "grade-8-is-notes-raw.txt"

NS = {"w": "http://schemas.openxmlformats.org/wordprocessingml/2006/main"}


def extract_docx(path: Path) -> list[str]:
    with zipfile.ZipFile(path) as z:
        xml = z.read("word/document.xml")
    root = ET.fromstring(xml)
    paras = []
    for p in root.findall(".//w:p", NS):
        texts = [t.text or "" for t in p.findall(".//w:t", NS)]
        line = "".join(texts).strip()
        if line:
            paras.append(line)
    return paras


def clean(s: str) -> str:
    for ch in "\u00a0":
        s = s.replace(ch, " ")
    s = re.sub(r"\s+", " ", s).strip()
    reps = [
        ("compunds", "compounds"),
        ("flouride", "fluoride"),
        ("sort -hand", "shorthand"),
        ("ration", "ratio"),
        ("googles", "goggles"),
        ("macroscope", "microscope"),
        ("Concentratio.", "Concentration."),
        ("alight", "a light"),
        (" od ", " of "),
        ("len.", "lens."),
    ]
    for a, b in reps:
        s = s.replace(a, b)
    return s


def find(paras: list[str], pat: str) -> int:
    rx = re.compile(pat, re.I)
    for i, p in enumerate(paras):
        if rx.search(p):
            return i
    raise ValueError(f"Not found: {pat}")


def main() -> None:
    raw = extract_docx(DOCX)
    RAW.write_text("\n".join(raw), encoding="utf-8")

    paras: list[str] = []
    for p in raw:
        c = clean(p)
        if not c:
            continue
        if re.match(r"^GRADE\s*8|^LESSON NOTES COMPLETE|^RATIONALIZED", c, re.I):
            continue
        paras.append(c)

    bounds = [
        (find(paras, r"^ELEMENTS AND"), "1.1", "Elements and Compounds", "Strand 1: Mixtures, Elements and Compounds"),
        (find(paras, r"^1\.2\s*-?\s*Physical"), "1.2", "Physical and chemical changes", "Strand 1: Mixtures, Elements and Compounds"),
        (find(paras, r"Classes of Fire"), "1.3", "Classes of fire", "Strand 1: Mixtures, Elements and Compounds"),
        (find(paras, r"^2\.1\s*The Cell"), "2.1", "The Cell", "Strand 2: Living Things and Their Environment"),
        (find(paras, r"^2\.2\s*Movement"), "2.2", "Movement of Materials in and out of the cell", "Strand 2: Living Things and Their Environment"),
        (find(paras, r"^2\.3\s*Reproduction"), "2.3", "Reproduction in human beings", "Strand 2: Living Things and Their Environment"),
        (find(paras, r"^3\.1\s*Transformation"), "3.1", "Transformation of Energy", "Strand 3: Force and Energy"),
        (find(paras, r"^3\.2\s*Pressure"), "3.2", "Pressure", "Strand 3: Force and Energy"),
    ]

    topics = []
    for i, b in enumerate(bounds):
        start = b[0]
        end = bounds[i + 1][0] if i + 1 < len(bounds) else len(paras)
        body = [p for p in paras[start:end] if not re.match(r"^STRAND\s*\d", p, re.I)]
        topics.append(
            {
                "topicNumber": b[1],
                "topicName": b[2],
                "strandName": b[3],
                "paragraphs": body,
                "chars": sum(len(x) for x in body),
            }
        )
        print(f"{b[1]} paras={len(body)} chars={topics[-1]['chars']} start={body[0][:70]!r}")

    catalog = {
        "grade": "grade-8",
        "gradeLabel": "Grade 8",
        "subject": "INTEGRATED SCIENCE",
        "sourceFile": "GRADE_8_INTEGRATED_SCIENCE_NOTES.docx",
        "sourceNote": "Student classroom study pages from Grade 8 Rationalized Integrated Science notes.",
        "topics": topics,
    }
    OUT.write_text(json.dumps(catalog, ensure_ascii=False, indent=2), encoding="utf-8")
    print("Wrote", OUT)


if __name__ == "__main__":
    main()
