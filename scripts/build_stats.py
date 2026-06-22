"""Construit les agregats JSON pour le site a partir de jumelages.csv."""

from __future__ import annotations

import json
import math
from collections import Counter
from pathlib import Path
from typing import Dict, List, Tuple

import pandas as pd

from country_utils import country_to_continent, iso_to_flag

ROOT_DIR = Path(__file__).resolve().parents[1]
DATA_DIR = ROOT_DIR / "data" / "processed"
CSV_PATH = DATA_DIR / "jumelages.csv"
STATS_PATH = DATA_DIR / "stats.json"
COUNTRIES_PATH = DATA_DIR / "countries.json"
CITY_INDEX_PATH = DATA_DIR / "city_index.json"
TOP_CITIES_LIMIT = 15
CHORD_COUNTRY_LIMIT = 20


def haversine_km(lon_a: float, lat_a: float, lon_b: float, lat_b: float) -> float:
    radius_km = 6371.0
    phi1, phi2 = math.radians(lat_a), math.radians(lat_b)
    d_phi = math.radians(lat_b - lat_a)
    d_lambda = math.radians(lon_b - lon_a)
    a = math.sin(d_phi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(d_lambda / 2) ** 2
    return 2 * radius_km * math.asin(math.sqrt(a))


def load_csv() -> pd.DataFrame:
    if not CSV_PATH.exists():
        raise FileNotFoundError(f"Fichier introuvable: {CSV_PATH}. Lance sync_wikidata.py d'abord.")
    return pd.read_csv(CSV_PATH, dtype={"ville_A_id": str, "ville_B_id": str})


def build_cities_from_csv(df: pd.DataFrame) -> Dict[str, dict]:
    """Reconstruit un dict ville -> attributs depuis le CSV."""
    cities: Dict[str, dict] = {}

    def upsert_city(city_id: str, name: str, lon, lat, country) -> None:
        entry = cities.setdefault(city_id, {"n": name, "t": []})
        if pd.notna(lon) and pd.notna(lat) and "c" not in entry:
            entry["c"] = [float(lon), float(lat)]
        if pd.notna(country) and "cc" not in entry:
            cc = str(country).upper()
            entry["cc"] = cc
            flag = iso_to_flag(cc)
            if flag:
                entry["d"] = flag

    for row in df.itertuples(index=False):
        upsert_city(row.ville_A_id, row.ville_A_nom, row.ville_A_lon, row.ville_A_lat, row.ville_A_pays)
        upsert_city(row.ville_B_id, row.ville_B_nom, row.ville_B_lon, row.ville_B_lat, row.ville_B_pays)

        cities[row.ville_A_id]["t"].append(
            {
                "id": row.ville_B_id,
                "n": row.ville_B_nom,
                **(
                    {"c": [float(row.ville_B_lon), float(row.ville_B_lat)]}
                    if pd.notna(row.ville_B_lon) and pd.notna(row.ville_B_lat)
                    else {}
                ),
                **({"cc": str(row.ville_B_pays).upper()} if pd.notna(row.ville_B_pays) else {}),
            }
        )
        cities[row.ville_B_id]["t"].append(
            {
                "id": row.ville_A_id,
                "n": row.ville_A_nom,
                **(
                    {"c": [float(row.ville_A_lon), float(row.ville_A_lat)]}
                    if pd.notna(row.ville_A_lon) and pd.notna(row.ville_A_lat)
                    else {}
                ),
                **({"cc": str(row.ville_A_pays).upper()} if pd.notna(row.ville_A_pays) else {}),
            }
        )

    return cities


def unique_undirected_links(df: pd.DataFrame, cities: Dict[str, dict]) -> List[Tuple[str, str, dict, dict]]:
    links: List[Tuple[str, str, dict, dict]] = []
    for row in df.itertuples(index=False):
        city_a = cities[row.ville_A_id]
        city_b = cities[row.ville_B_id]
        links.append((row.ville_A_id, row.ville_B_id, city_a, city_b))
    return links


def build_city_index(cities: Dict[str, dict]) -> List[dict]:
    index = []
    for city_id, city in cities.items():
        entry = {"id": city_id, "n": city["n"]}
        if city.get("c"):
            entry["c"] = city["c"]
        if city.get("cc"):
            entry["cc"] = city["cc"]
        index.append(entry)
    return sorted(index, key=lambda item: item["n"].lower())


def build_countries(cities: Dict[str, dict]) -> Dict[str, dict]:
    countries: Dict[str, dict] = {}
    for city in cities.values():
        cc = city.get("cc")
        if not cc or cc in countries:
            continue
        countries[cc] = {
            "name": cc,
            "continent": country_to_continent(cc),
            "flag": iso_to_flag(cc) or "",
        }
    return dict(sorted(countries.items()))


def build_country_chord(links: List[Tuple[str, str, dict, dict]]) -> dict:
    pair_counts: Counter = Counter()

    for _, _, city_a, city_b in links:
        cc_a = city_a.get("cc")
        cc_b = city_b.get("cc")
        if not cc_a or not cc_b or cc_a == cc_b:
            continue
        pair_counts[tuple(sorted((cc_a, cc_b)))] += 1

    country_totals: Counter = Counter()
    for (cc_a, cc_b), count in pair_counts.items():
        country_totals[cc_a] += count
        country_totals[cc_b] += count

    top_countries = [cc for cc, _ in country_totals.most_common(CHORD_COUNTRY_LIMIT)]
    index = {cc: idx for idx, cc in enumerate(top_countries)}
    size = len(top_countries)
    matrix = [[0 for _ in range(size)] for _ in range(size)]

    for (cc_a, cc_b), count in pair_counts.items():
        if cc_a not in index or cc_b not in index:
            continue
        i, j = index[cc_a], index[cc_b]
        matrix[i][j] += count
        matrix[j][i] += count

    return {"labels": top_countries, "matrix": matrix}


def build_stats(cities: Dict[str, dict], links: List[Tuple[str, str, dict, dict]]) -> dict:
    degrees = {city_id: len(city.get("t", [])) for city_id, city in cities.items()}
    top_cities = sorted(degrees.items(), key=lambda item: item[1], reverse=True)[:TOP_CITIES_LIMIT]
    top_cities_payload = [
        {"id": city_id, "n": cities[city_id]["n"], "degree": degree}
        for city_id, degree in top_cities
        if degree > 0
    ]

    continent_counter: Counter = Counter()
    arc_distances: List[float] = []
    country_codes = set()

    for city in cities.values():
        if city.get("cc"):
            country_codes.add(city["cc"])
            continent_counter[country_to_continent(city["cc"])] += 1

    for _, _, city_a, city_b in links:
        coords_a = city_a.get("c")
        coords_b = city_b.get("c")
        if coords_a and coords_b:
            arc_distances.append(haversine_km(coords_a[0], coords_a[1], coords_b[0], coords_b[1]))

    avg_arc_km = round(sum(arc_distances) / len(arc_distances), 1) if arc_distances else 0.0

    return {
        "kpis": {
            "city_count": len(cities),
            "link_count": len(links),
            "country_count": len(country_codes),
            "directed_link_count": sum(degrees.values()),
        },
        "top_cities": top_cities_payload,
        "country_chord": build_country_chord(links),
        "continent_distribution": dict(sorted(continent_counter.items(), key=lambda x: x[1], reverse=True)),
        "avg_arc_km": avg_arc_km,
        "arcs_with_distance": len(arc_distances),
    }


def write_json(path: Path, payload: object) -> None:
    with path.open("w", encoding="utf-8") as json_file:
        json.dump(payload, json_file, ensure_ascii=False, indent=2)


def main() -> None:
    df = load_csv()
    cities = build_cities_from_csv(df)
    links = unique_undirected_links(df, cities)
    DATA_DIR.mkdir(parents=True, exist_ok=True)

    write_json(STATS_PATH, build_stats(cities, links))
    write_json(COUNTRIES_PATH, build_countries(cities))
    write_json(CITY_INDEX_PATH, build_city_index(cities))

    print(f"Stats: {STATS_PATH}")
    print(f"Countries: {COUNTRIES_PATH}")
    print(f"City index: {CITY_INDEX_PATH}")


if __name__ == "__main__":
    main()
