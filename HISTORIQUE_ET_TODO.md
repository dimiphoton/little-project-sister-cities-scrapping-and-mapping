# Historique des actions & todo

Journal du projet **Sister Cities** — ce qui a été fait, les blocages rencontrés, et ce qu’il reste à faire.

> Branche de travail actuelle : `feat/data-pipeline`  
> Branche de déploiement prévue : `main` (GitHub Pages)

---

## Chronologie

### 2025 — Initialisation

| Action | Détail |
|--------|--------|
| Repo créé | `Initial commit` sur `main` |
| Branche feature | `feat/data-pipeline` pour le pipeline data + site |

### Phase 1 — Pipeline data

| Action | Fichiers / impact |
|--------|-------------------|
| Sync Wikidata P190 | `scripts/sync_wikidata.py` — requête SPARQL, export CSV |
| Source de vérité CSV | `data/processed/jumelages.csv` — upsert sur `(ville_A_id, ville_B_id)` |
| Graphe JSON | `graphe_jumelages.json` — `{nodes, links}` pour la carte |
| Symétrie des paires | Normalisation A↔B via `normalize_pair` (pas de doublons inversés) |
| Métadonnées sync | `metadata.json` — `last_run`, stats de validation |
| Sync delta | Filtre `schema:dateModified` + `last_run` ; `--full` pour tout recharger |
| User-Agent Wikidata | Identification avec email (`WIKIDATA_CONTACT_EMAIL`) |
| Retry 429 | Gestion rate-limit SPARQL |
| Utilitaires pays | `scripts/country_utils.py` |
| Commit | `73f237b` — *data pipeline* |

### Phase 2 — Stats, CI, site, pédagogie

| Action | Fichiers / impact |
|--------|-------------------|
| Agrégats pour le site | `scripts/build_stats.py` → `stats.json`, `city_index.json`, `countries.json` |
| Copie vers Pages | `scripts/copy_docs_data.py` → `docs/data/` |
| Essai limité | `scripts/sync_sample.py` (~100 jumelages, 1 requête SPARQL) |
| GitHub Actions | `.github/workflows/sync-data.yml` — cron dimanche (delta) + 1er du mois (full) + `workflow_dispatch` |
| Site statique | `docs/index.html`, `css/style.css`, `js/*.js` |
| Carte Deck.gl | Points villes, arcs au focus, filtres pays/continent |
| Infographies D3 | Top villes (bar) + cordes pays→pays |
| Deep link | URL `?city=Q…` |
| Données test locales | `docs/data/` — Paris, Lyon, London (2 jumelages) — générées manuellement |
| Notebooks FR | `notebooks/01` à `04` — vue d’ensemble, pipeline, exploration, essai scraping |
| README | Architecture, commandes, déploiement Pages |
| Commit | `b36f964` — *Add GitHub Pages site, sample sync, notebooks, and monthly full CI refresh* |

### Phase 3 — Corrections UX (post-review)

| Problème | Correction |
|----------|------------|
| Impossible de cliquer sur une ville | Tuiles carte `pickable: false` ; clic via `deck.onClick` ; points plus grands |
| Liste alternative | Boutons villes cliquables dans le panneau latéral (`#city-pick-list`) |
| Arcs toujours visibles / carte chargée | Checkbox **Show twin arcs** (décochée par défaut) ; arcs seulement si `showArcs && ville sélectionnée` |
| Jumelées cliquables | Clic sur une jumelle dans le panneau → change la sélection |

---

## Blocages rencontrés

| Blocage | Statut | Contournement / suite |
|---------|--------|------------------------|
| Wikidata **429** (rate limit) en sync locale complète | Non résolu localement | Utiliser `sync_sample.py` ; laisser la CI GitHub syncer ; réessayer avec délai |
| **Push Git** échoué (SSL certificate) | Non résolu | Push manuel ou corriger certificats Git ; merge via PR depuis une autre machine |
| Workflow CI sur `feat/data-pipeline` uniquement | Attendu | Les crons ne tournent qu’après **merge sur `main`** |
| Port localhost | Résolu | Serveur sur `8765` ou `8000` : `cd docs && python -m http.server 8000` |
| Données réelles absentes en local | Contourné | Échantillon test dans `docs/data/` en attendant sync complète |

---

## Actions à faire

### Priorité haute (mise en production)

- [ ] **Pousser** la branche `feat/data-pipeline` sur `origin` (résoudre SSL si besoin)
- [ ] **Ouvrir une PR** `feat/data-pipeline` → `main`
- [ ] **Merger** sur `main`
- [ ] **Activer GitHub Pages** : Settings → Pages → branche `main`, dossier `/docs`
- [ ] **Vérifier le workflow** Actions après merge (premier run manuel ou attendre le cron)
- [ ] **Lancer une sync complète** une fois (`workflow_dispatch` + *Force full sync*, ou local `--full` si Wikidata répond)
- [ ] **Mettre à jour le README** avec l’URL GitHub Pages live

### Priorité moyenne (qualité data & UX)

- [ ] Remplacer les **données test** (`docs/data/`) par une vraie sync (`sync_sample.py` minimum, `--full` idéal)
- [ ] Configurer `WIKIDATA_CONTACT_EMAIL` avec une **vraie adresse** (local + doc)
- [ ] Tester le site sur **mobile** (responsive basique)
- [ ] Vérifier les villes **sans coordonnées** (exclues de la carte — documenter ou géocoder)

### Priorité basse / v2

- [ ] Mode **compare deux zones** sur la carte
- [ ] Labels / UI multilingue (FR)
- [ ] Tests automatisés (`pytest` sur `normalize_pair`, build_stats)
- [ ] Badge CI / statut sync dans le README

---

## Commandes utiles (rappel)

```bash
# Sync
python scripts/sync_wikidata.py --full          # première fois
python scripts/sync_wikidata.py                 # delta
python scripts/sync_sample.py                   # ~100 jumelages (test)

# Site
python scripts/build_stats.py
python scripts/copy_docs_data.py
cd docs && python -m http.server 8000

# Notebooks
pip install -r requirements.txt -r requirements-notebooks.txt
jupyter notebook notebooks/
```

---

## Mise à jour de ce fichier

À chaque étape significative (merge, déploiement, sync complète, correction UX) :

1. Ajouter une ligne dans **Chronologie**
2. Cocher les items dans **Actions à faire**
3. Noter les nouveaux blocages le cas échéant
