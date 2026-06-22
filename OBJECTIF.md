# Objectif du projet — Sister Cities

Projet week-end : **collecter, maintenir et visualiser les jumelages de villes** (sister cities / twin towns) à partir de Wikidata.

---

## But final

Proposer un **site public interactif** (GitHub Pages) où l’on peut :

1. **Explorer** les jumelages mondiaux sur une carte
2. **Sélectionner une ville** (carte ou panneau latéral) et voir ses villes jumelées
3. **Filtrer** par pays ou continent
4. **Rechercher** une ville par nom
5. **Consulter** des infographies (top villes, diagramme cordes pays → pays)
6. **Partager** un lien direct vers une ville (`?city=Q90`)

Les **données se rafraîchissent automatiquement** depuis Wikidata (sync hebdomadaire en delta, full mensuel), sans intervention manuelle après mise en production.

---

## Problème résolu

Les jumelages sont dispersés (sites municipaux, Wikipédia, bases hétérogènes). Wikidata centralise une partie de ces liens via la propriété **P190** (*twinned administrative body*).

Ce projet :

- **Extrait** ces relations via SPARQL
- **Normalise** les paires (symétrie, pas de doublons A↔B / B↔A)
- **Stocke** une source de vérité auditable (`jumelages.csv`)
- **Publie** des agrégats pour le site web (`stats.json`, graphe JSON)

---

## Architecture cible

```
Wikidata (P190)
      │
      ▼
scripts/sync_wikidata.py     ← delta (last_run) ou --full
      │
      ├── data/processed/jumelages.csv          ← source de vérité
      ├── data/processed/graphe_jumelages.json  ← nodes + links
      └── data/processed/metadata.json          ← last_run, stats sync
      │
      ▼
scripts/build_stats.py
      │
      ├── data/processed/stats.json             ← KPIs, chord, top villes
      ├── data/processed/city_index.json        ← recherche / autocomplete
      └── data/processed/countries.json         ← filtres pays / continent
      │
      ▼
scripts/copy_docs_data.py
      │
      └── docs/data/                            ← copie pour GitHub Pages
      │
      ▼
docs/ (site statique)
      ├── Deck.gl  → carte, points, arcs optionnels
      ├── D3       → bar chart + chord diagram
      └── modules ES → app.js, data-loader.js, geo.js, charts.js
```

**CI** (`.github/workflows/sync-data.yml`) : exécute sync + build + copy, commit si les fichiers data changent.

---

## Livrables finaux

| Livrable | Emplacement | Rôle |
|----------|-------------|------|
| Pipeline Wikidata | `scripts/sync_wikidata.py` | Sync delta / full, upsert CSV |
| Essai limité | `scripts/sync_sample.py` | ~100 jumelages pour tests locaux |
| Agrégats site | `scripts/build_stats.py` | Stats et index pour l’UI |
| Site interactif | `docs/` | Carte + graphiques, UI en anglais |
| Notebooks pédagogiques | `notebooks/` | Comprendre le pipeline sans être dev |
| Documentation technique | `README.md`, ce fichier | Setup et architecture |
| Déploiement | branche `main` + GitHub Pages `/docs` | URL publique |

---

## Stack technique

| Couche | Technologie | Pourquoi |
|--------|-------------|----------|
| Données | Wikidata + SPARQL | Source ouverte, structurée, API officielle |
| Scripts | Python 3.11, pandas, requests | Familier pour profil data / scripting |
| Stockage | CSV + JSON | Lisible, diff Git-friendly |
| CI | GitHub Actions | Refresh automatique + commit data |
| Carte | Deck.gl + MapLibre | Arcs géodésiques, performance |
| Graphiques | D3.js | Chord + bar chart |
| Hébergement | GitHub Pages (statique) | Gratuit, sans backend |

---

## Critères de « projet terminé » (v1)

- [ ] Sync complète Wikidata exécutée au moins une fois (pas seulement l’échantillon test)
- [ ] Workflow CI actif sur `main` (cron delta + full mensuel)
- [ ] GitHub Pages publié depuis `/docs`
- [ ] Site utilisable : clic ville, panneau jumelées, arcs optionnels, recherche, filtres
- [ ] README à jour avec URL du site live

---

## Hors scope v1 (idées futures)

- Comparer deux zones dessinées sur la carte (cross-zone)
- Enrichissement langues / labels multilingues
- Export CSV / API REST
- Tests automatisés (`pytest`)

Voir `HISTORIQUE_ET_TODO.md` pour l’avancement détaillé et la liste des actions restantes.
