"""Petit essai Wikidata : telecharge N jumelages (100 par defaut).

Usage (depuis la racine du projet) :
    set WIKIDATA_CONTACT_EMAIL=ton.email@etu.fr
    python scripts/sync_sample.py
    python scripts/sync_sample.py --limit 50
    python scripts/build_stats.py
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

# Permet l'import quand on lance : python scripts/sync_sample.py
sys.path.insert(0, str(Path(__file__).resolve().parent))

from sync_wikidata import run_sync

DEFAULT_LIMIT = 100


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Essai limite : telecharge N jumelages depuis Wikidata (P190)",
    )
    parser.add_argument(
        "--limit",
        type=int,
        default=DEFAULT_LIMIT,
        help=f"Nombre de jumelages a telecharger (defaut: {DEFAULT_LIMIT})",
    )
    parser.add_argument(
        "--merge",
        action="store_true",
        help="Fusionner avec le CSV existant (defaut: remplacer entierement)",
    )
    args = parser.parse_args()

    if args.limit < 1:
        print("Erreur: --limit doit etre >= 1")
        return 1

    print(f"Essai Wikidata : {args.limit} jumelage(s), replace={not args.merge}")
    return run_sync(
        full=True,
        limit=args.limit,
        replace=not args.merge,
        sync_mode="sample",
    )


if __name__ == "__main__":
    raise SystemExit(main())
