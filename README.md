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

# Small manual trial (~100 twin links, 1 SPARQL request)
python scripts/sync_sample.py
python scripts/sync_sample.py --limit 50

# Build site aggregates
python scripts/build_stats.py
```

### Delta sync

The script reads `metadata.json` → `last_run` and filters Wikidata with `schema:dateModified` to fetch only recent changes. Use `--full` to ignore `last_run`.

Recommended rhythm:

| Frequency | Command | Purpose |
|-----------|---------|---------|
| Weekly (CI) | `python scripts/sync_wikidata.py` | Delta — recent changes only |
| Monthly (CI) | `python scripts/sync_wikidata.py --full` | Full — catch anything missed by delta |
| Manual | `--full` or delta | On demand |

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

| Trigger | Mode | Schedule |
|---------|------|----------|
| Cron | **delta** | Every Sunday 03:00 UTC |
| Cron | **full** | 1st of each month 04:00 UTC |
| Manual | delta or full | Actions → *Sync Wikidata twin cities* → optional checkbox *Force full sync* |

Commits/pushes **only if** `data/processed/` or `docs/data/` changed.

## Interactive site (GitHub Pages)

Static site in [`docs/`](docs/) — Deck.gl arc map + D3 charts, English UI.

| Feature | Detail |
|---------|--------|
| Map | Click city → twin arcs + side panel with distances |
| Search | Autocomplete on city names |
| Filters | Country + continent dropdowns |
| Charts | Top cities bar + country chord diagram |
| Deep link | `?city=Q90` |

### Local preview

```bash
python scripts/build_stats.py
python scripts/copy_docs_data.py
cd docs
python -m http.server 8000
# → http://localhost:8000
```

### Deploy on GitHub Pages

1. Merge to `main`
2. **Settings → Pages → Build from branch `main`, folder `/docs`**
3. Site URL: `https://<user>.github.io/little-project-sister-cities-scrapping-and-mapping/`

After each data sync, run `python scripts/copy_docs_data.py` (done automatically in CI).

## Branches

- `feat/data-pipeline` — Wikidata sync + stats + site in `/docs`
- `main` — deploy branch for GitHub Pages

## Notebooks pédagogiques

Dossier [`notebooks/`](notebooks/) — pour étudiant·e non spécialiste :

| Notebook | Contenu |
|----------|---------|
| [01_vue_ensemble.ipynb](notebooks/01_vue_ensemble.ipynb) | Objectif de la branche, fichiers produits, grands choix |
| [02_technologies_et_pipeline.ipynb](notebooks/02_technologies_et_pipeline.ipynb) | Wikidata, SPARQL, delta/full, parcimonie, stockage |
| [03_explorer_les_donnees.ipynb](notebooks/03_explorer_les_donnees.ipynb) | Pandas, filtres, graphiques, idées d'exploration |
| [04_essai_scrapping_100.ipynb](notebooks/04_essai_scrapping_100.ipynb) | Petit essai Wikidata (~100 jumelages) avec `sync_sample.py` |

```bash
pip install -r requirements.txt -r requirements-notebooks.txt
jupyter notebook notebooks/
```

Lancer Jupyter **depuis la racine du projet** (les chemins `../data/` sont relatifs au dossier `notebooks/`).
