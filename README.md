# Sister Cities — scraping & mapping

Weekend project: visualize city twinning (jumelage) from Wikidata.

## Architecture data

| File | Role |
|------|------|
| `data/processed/jumelages.csv` | **Source of truth** — upsert on `(ville_A_id, ville_B_id)` |
| `data/processed/graphe_jumelages.json` | Graph export `{"nodes": [...], "links": [...]}` — regenerated when CSV changes |
| `data/processed/metadata.json` | `last_run` for delta sync + validation stats |
| `data/processed/stats.json` | KPIs, chord matrix, top cities (for the site) |

## Pipeline

```bash
pip install -r requirements.txt

# First run (full sync)
python scripts/sync_wikidata.py --full

# Subsequent runs (delta via schema:dateModified + last_run)
python scripts/sync_wikidata.py

# Build site aggregates
python scripts/build_stats.py
```

### Delta sync

The script reads `metadata.json` → `last_run` and filters Wikidata with `schema:dateModified` to fetch only recent changes. Use `--full` to ignore `last_run`.

### User-Agent

Wikidata requires identification in the HTTP User-Agent header:

```
little-project-sister-cities-scrapping-and-mapping/0.2 (...; mailto:your@email.com)
```

Override email locally:

```bash
set WIKIDATA_CONTACT_EMAIL=you@example.com
python scripts/sync_wikidata.py
```

## GitHub Actions

Workflow `.github/workflows/sync-data.yml`:

- Cron: every Sunday 03:00 UTC
- Manual: **Actions → Sync Wikidata twin cities → Run workflow**
- Commits/pushes **only if** `data/processed/` changed

## Branches

- `feat/data-pipeline` — Wikidata sync + stats
- `feat/site` — interactive GitHub Pages site (next)
