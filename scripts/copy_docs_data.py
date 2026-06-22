"""Copie data/processed/ vers docs/data/ pour GitHub Pages."""

from __future__ import annotations

import shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "data" / "processed"
TARGET = ROOT / "docs" / "data"

FILES = [
    "graphe_jumelages.json",
    "stats.json",
    "city_index.json",
    "countries.json",
    "metadata.json",
]


def main() -> None:
    if not SOURCE.exists():
        raise FileNotFoundError(f"Dossier absent: {SOURCE}. Lance sync_wikidata.py d'abord.")

    TARGET.mkdir(parents=True, exist_ok=True)
    for name in FILES:
        src = SOURCE / name
        if src.exists():
            shutil.copy2(src, TARGET / name)
            print(f"Copie: {name}")

    print(f"Done -> {TARGET}")


if __name__ == "__main__":
    main()
