"""Synchronise les jumelages Wikidata (P190) vers CSV + graphe JSON."""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import List, Optional

import pandas as pd
from SPARQLWrapper import JSON, SPARQLWrapper

ROOT_DIR = Path(__file__).resolve().parents[1]
DATA_DIR = ROOT_DIR / "data" / "processed"
CSV_PATH = DATA_DIR / "jumelages.csv"
GRAPH_PATH = DATA_DIR / "graphe_jumelages.json"
METADATA_PATH = DATA_DIR / "metadata.json"

ENDPOINT_URL = "https://query.wikidata.org/sparql"
PROJECT_NAME = "little-project-sister-cities-scrapping-and-mapping"
CONTACT_EMAIL = os.getenv("WIKIDATA_CONTACT_EMAIL", "dimiphoton@users.noreply.github.com")
USER_AGENT = f"{PROJECT_NAME}/0.2 (https://github.com/dimiphoton/{PROJECT_NAME}; mailto:{CONTACT_EMAIL})"

PAGE_SIZE = 5_000
MAX_RETRIES = 5
RETRY_DELAY_SECONDS = 65
BATCH_SLEEP_SECONDS = 65
POINT_RE = re.compile(r"Point\(([-\d.]+) ([-\d.]+)\)")

CSV_COLUMNS = [
    "ville_A_id",
    "ville_B_id",
    "ville_A_nom",
    "ville_B_nom",
    "ville_A_lon",
    "ville_A_lat",
    "ville_B_lon",
    "ville_B_lat",
    "ville_A_pays",
    "ville_B_pays",
    "wikidata_modified",
]


def parse_point(value: str) -> tuple[Optional[float], Optional[float]]:
    match = POINT_RE.match(value)
    if not match:
        return None, None
    lon, lat = match.groups()
    return float(lon), float(lat)


def extract_qid(uri: str) -> str:
    return uri.rsplit("/", 1)[-1]


def load_metadata() -> dict:
    if not METADATA_PATH.exists():
        return {}
    with METADATA_PATH.open(encoding="utf-8") as json_file:
        return json.load(json_file)


def get_last_run(metadata: dict) -> Optional[str]:
    """Retourne last_run (ISO) pour le filtre delta."""
    return metadata.get("last_run") or metadata.get("generated_at")


def build_query(limit: int, offset: int, last_run: Optional[str]) -> str:
    """Construit la requete SPARQL (full ou delta via schema:dateModified)."""
    common_select = """
    SELECT ?city ?cityLabel ?coords ?cityCountryCode ?cityModified
           ?twin ?twinLabel ?twinCoords ?twinCountryCode ?twinModified
    """

    common_optional = """
      OPTIONAL { ?city wdt:P625 ?coords . }
      OPTIONAL {
        ?city wdt:P17 ?cityCountry .
        ?cityCountry wdt:P297 ?cityCountryCode .
      }
      OPTIONAL { ?city schema:dateModified ?cityModified . }
      OPTIONAL { ?twin wdt:P625 ?twinCoords . }
      OPTIONAL {
        ?twin wdt:P17 ?twinCountry .
        ?twinCountry wdt:P297 ?twinCountryCode .
      }
      OPTIONAL { ?twin schema:dateModified ?twinModified . }
      SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
    """

    prefixes = """
    PREFIX schema: <http://schema.org/>
    """

    if not last_run:
        return f"""
        {prefixes}
        {common_select}
        WHERE {{
          ?city wdt:P190 ?twin .
          {common_optional}
        }}
        LIMIT {limit}
        OFFSET {offset}
        """

    # Delta : entites ville ou jumelle modifiees depuis last_run.
    return f"""
    {prefixes}
    {common_select}
    WHERE {{
      {{
        ?city wdt:P190 ?twin .
        {common_optional}
        ?city schema:dateModified ?cityModified .
        FILTER(?cityModified > "{last_run}"^^xsd:dateTime)
      }}
      UNION
      {{
        ?city wdt:P190 ?twin .
        {common_optional}
        ?twin schema:dateModified ?twinModified .
        FILTER(?twinModified > "{last_run}"^^xsd:dateTime)
      }}
    }}
    LIMIT {limit}
    OFFSET {offset}
    """


def fetch_batch(limit: int, offset: int, last_run: Optional[str]) -> List[dict]:
    last_error: Optional[Exception] = None

    for attempt in range(MAX_RETRIES):
        try:
            sparql = SPARQLWrapper(ENDPOINT_URL, agent=USER_AGENT)
            sparql.setQuery(build_query(limit, offset, last_run))
            sparql.setReturnFormat(JSON)
            results = sparql.query().convert()
            return results["results"]["bindings"]
        except Exception as exc:  # noqa: BLE001 — retry reseau SPARQL
            last_error = exc
            wait_seconds = RETRY_DELAY_SECONDS if "429" in str(exc) else min(RETRY_DELAY_SECONDS, 5 * (attempt + 1))
            print(f"Erreur SPARQL (offset={offset}, essai {attempt + 1}/{MAX_RETRIES}): {exc}")
            print(f"  Nouvelle tentative dans {wait_seconds}s...")
            time.sleep(wait_seconds)

    raise RuntimeError(f"Echec SPARQL apres {MAX_RETRIES} essais (offset={offset})") from last_error


def fetch_all_rows(last_run: Optional[str]) -> List[dict]:
    offset = 0
    collected: List[dict] = []
    mode = "delta" if last_run else "full"
    print(f"Recuperation Wikidata ({mode})...")

    while True:
        batch = fetch_batch(PAGE_SIZE, offset, last_run)
        if not batch:
            break

        print(f"  Lot offset={offset}: {len(batch)} lignes")
        for item in batch:
            city_id = extract_qid(item["city"]["value"])
            twin_id = extract_qid(item["twin"]["value"])
            city_lon, city_lat = (
                parse_point(item["coords"]["value"]) if "coords" in item else (None, None)
            )
            twin_lon, twin_lat = (
                parse_point(item["twinCoords"]["value"]) if "twinCoords" in item else (None, None)
            )
            city_modified = item.get("cityModified", {}).get("value")
            twin_modified = item.get("twinModified", {}).get("value")
            wikidata_modified = max(filter(None, [city_modified, twin_modified]), default=None)

            collected.append(
                {
                    "ville_A_id": city_id,
                    "ville_B_id": twin_id,
                    "ville_A_nom": item["cityLabel"]["value"],
                    "ville_B_nom": item["twinLabel"]["value"],
                    "ville_A_lon": city_lon,
                    "ville_A_lat": city_lat,
                    "ville_B_lon": twin_lon,
                    "ville_B_lat": twin_lat,
                    "ville_A_pays": item.get("cityCountryCode", {}).get("value"),
                    "ville_B_pays": item.get("twinCountryCode", {}).get("value"),
                    "wikidata_modified": wikidata_modified,
                }
            )

        offset += PAGE_SIZE
        if len(batch) < PAGE_SIZE:
            break
        time.sleep(BATCH_SLEEP_SECONDS)

    return collected


def normalize_pair(row: dict) -> dict:
    """Tri lexicographique des IDs pour cle unique stable (A,B)."""
    id_a, id_b = row["ville_A_id"], row["ville_B_id"]
    if id_a <= id_b:
        return row

    swapped = {
        "ville_A_id": id_b,
        "ville_B_id": id_a,
        "ville_A_nom": row["ville_B_nom"],
        "ville_B_nom": row["ville_A_nom"],
        "ville_A_lon": row["ville_B_lon"],
        "ville_A_lat": row["ville_B_lat"],
        "ville_B_lon": row["ville_A_lon"],
        "ville_B_lat": row["ville_A_lat"],
        "ville_A_pays": row["ville_B_pays"],
        "ville_B_pays": row["ville_A_pays"],
        "wikidata_modified": row.get("wikidata_modified"),
    }
    return swapped


def rows_to_dataframe(rows: List[dict]) -> pd.DataFrame:
    if not rows:
        return pd.DataFrame(columns=CSV_COLUMNS)

    normalized = [normalize_pair(row) for row in rows]
    df = pd.DataFrame(normalized)
    return df[CSV_COLUMNS]


def load_existing_csv() -> pd.DataFrame:
    if not CSV_PATH.exists():
        return pd.DataFrame(columns=CSV_COLUMNS)
    return pd.read_csv(CSV_PATH, dtype={"ville_A_id": str, "ville_B_id": str})


def upsert_csv(existing: pd.DataFrame, incoming: pd.DataFrame) -> pd.DataFrame:
    """Upsert Pandas : cle unique (ville_A_id, ville_B_id), keep='last'."""
    if existing.empty:
        merged = incoming.copy()
    elif incoming.empty:
        merged = existing.copy()
    else:
        merged = pd.concat([existing, incoming], ignore_index=True)
        merged = merged.drop_duplicates(subset=["ville_A_id", "ville_B_id"], keep="last")

    return merged.sort_values(["ville_A_id", "ville_B_id"]).reset_index(drop=True)


def file_hash(path: Path) -> Optional[str]:
    if not path.exists():
        return None
    return hashlib.sha256(path.read_bytes()).hexdigest()


def csv_to_graph(df: pd.DataFrame) -> dict:
    """Export graphe : nodes + links depuis le CSV source de verite."""
    nodes: dict[str, dict] = {}

    def add_node(city_id: str, name: str, lon, lat, country) -> None:
        if city_id in nodes:
            node = nodes[city_id]
            if pd.isna(node.get("lon")) and pd.notna(lon):
                node["lon"] = float(lon)
                node["lat"] = float(lat)
            if not node.get("country") and pd.notna(country):
                node["country"] = str(country).upper()
            return

        nodes[city_id] = {
            "id": city_id,
            "name": name,
            "lon": float(lon) if pd.notna(lon) else None,
            "lat": float(lat) if pd.notna(lat) else None,
            "country": str(country).upper() if pd.notna(country) else None,
        }

    links = []
    for row in df.itertuples(index=False):
        add_node(row.ville_A_id, row.ville_A_nom, row.ville_A_lon, row.ville_A_lat, row.ville_A_pays)
        add_node(row.ville_B_id, row.ville_B_nom, row.ville_B_lon, row.ville_B_lat, row.ville_B_pays)
        links.append({"source": row.ville_A_id, "target": row.ville_B_id})

    return {
        "nodes": sorted(nodes.values(), key=lambda node: node["name"].lower()),
        "links": links,
    }


def write_metadata(
    *,
    last_run: str,
    sync_mode: str,
    rows_fetched: int,
    rows_total: int,
    csv_changed: bool,
    graph_changed: bool,
) -> None:
    metadata = {
        "last_run": last_run,
        "generated_at": last_run,
        "source": "Wikidata P190",
        "endpoint": ENDPOINT_URL,
        "sync_mode": sync_mode,
        "rows_fetched": rows_fetched,
        "rows_total": rows_total,
        "csv_changed": csv_changed,
        "graph_changed": graph_changed,
        "user_agent": USER_AGENT,
    }
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    with METADATA_PATH.open("w", encoding="utf-8") as json_file:
        json.dump(metadata, json_file, ensure_ascii=False, indent=2)


def main() -> int:
    parser = argparse.ArgumentParser(description="Sync Wikidata P190 -> CSV + graphe JSON")
    parser.add_argument(
        "--full",
        action="store_true",
        help="Ignore last_run et force une synchronisation complete",
    )
    args = parser.parse_args()

    metadata = load_metadata()
    last_run = None if args.full else get_last_run(metadata)
    sync_mode = "full" if last_run is None else "delta"

    rows = fetch_all_rows(last_run)
    incoming_df = rows_to_dataframe(rows)
    existing_df = load_existing_csv()

    csv_hash_before = file_hash(CSV_PATH)
    merged_df = upsert_csv(existing_df, incoming_df)

    DATA_DIR.mkdir(parents=True, exist_ok=True)
    merged_df.to_csv(CSV_PATH, index=False)
    csv_hash_after = file_hash(CSV_PATH)
    csv_changed = csv_hash_before != csv_hash_after

    graph_changed = False
    if csv_changed:
        graph = csv_to_graph(merged_df)
        graph_hash_before = file_hash(GRAPH_PATH)
        with GRAPH_PATH.open("w", encoding="utf-8") as json_file:
            json.dump(graph, json_file, ensure_ascii=False, indent=2)
        graph_changed = file_hash(GRAPH_PATH) != graph_hash_before
        print(f"Graphe regenere: {GRAPH_PATH} ({len(graph['nodes'])} nodes, {len(graph['links'])} links)")
    else:
        print("CSV inchange — graphe non regenere.")

    now = datetime.now(timezone.utc).replace(microsecond=0).isoformat()
    write_metadata(
        last_run=now,
        sync_mode=sync_mode,
        rows_fetched=len(incoming_df),
        rows_total=len(merged_df),
        csv_changed=csv_changed,
        graph_changed=graph_changed,
    )

    print(f"Mode: {sync_mode} | Lignes recues: {len(incoming_df)} | Total CSV: {len(merged_df)}")
    print(f"CSV: {CSV_PATH} (changed={csv_changed})")
    print(f"Metadata: {METADATA_PATH}")

    return 1 if csv_changed or graph_changed else 0


if __name__ == "__main__":
    raise SystemExit(main())
