# Plan week-end — Sister Cities

Ordre de travail pour livrer la v1. **Une phase à la fois** — ne pas commencer la suivante tant que la phase courante n’est pas cochée.

Référence vision : [OBJECTIF.md](OBJECTIF.md)

---

## Phase 0 — Aligner `main` avec le code (30 min)

**Situation :** le pipeline et le site existent sur `feat/data-pipeline` ; `main` est encore minimal.

- [ ] Merger `feat/data-pipeline` → `main` (ou PR puis merge)
- [ ] Vérifier que `scripts/`, `docs/`, `data/` sont présents sur `main`
- [ ] Pousser `main` sur `origin` (résoudre SSL git si besoin)

**Critère done :** `main` contient tout le projet ; une seule branche de référence pour la suite.

---

## Phase 1 — Données qui marchent en local (2–3 h)

- [ ] `pip install -r requirements.txt`
- [ ] `python scripts/sync_sample.py` (~100 jumelages, évite le rate-limit Wikidata)
- [ ] `python scripts/build_stats.py`
- [ ] `python scripts/copy_docs_data.py`
- [ ] Prévisualiser : `cd docs && python -m http.server 8000`

**Critère done :** le site local affiche de vraies données (pas seulement Paris/Lyon test manuel).

---

## Phase 2 — Mise en ligne (1 h)

- [ ] Activer GitHub Pages : branche `main`, dossier `/docs`
- [ ] Vérifier le workflow `.github/workflows/sync-data.yml` sur `main`
- [ ] Lancer un run manuel Actions (*Sync Wikidata twin cities*) si besoin
- [ ] Mettre l’URL live dans `README.md`

**Critère done :** URL publique accessible ; CI configurée sur `main`.

---

## Phase 3 — UX minimum v1 (2 h)

Cocher les critères de [OBJECTIF.md](OBJECTIF.md) :

- [ ] Clic ville → panneau jumelées
- [ ] Recherche par nom
- [ ] Filtres pays / continent
- [ ] Arcs optionnels (checkbox)
- [ ] Deep link `?city=Q…`

**Critère done :** checklist v1 dans `OBJECTIF.md` cochée (sauf sync full si Wikidata 429 en local — la CI peut le faire).

---

## Phase 4 — Sync complète & consolidation (optionnel)

- [ ] Sync `--full` via CI ou local quand Wikidata répond
- [ ] Remplacer l’échantillon par les données complètes dans `docs/data/`
- [ ] Test mobile basique
- [ ] Journaliser dans [HISTORIQUE_ET_TODO.md](HISTORIQUE_ET_TODO.md)

---

## Règles pour l’IA (Cursor)

- Travailler sur la **phase indiquée dans [SESSION.md](SESSION.md)** uniquement
- Pas de refonte globale sans demande explicite
- Code Python simple ; site statique dans `docs/`
- Ne pas commit sauf demande explicite
- En fin de tâche : proposer quoi cocher dans ce fichier et quoi mettre dans `SESSION.md` pour la prochaine fois

---

## Phase courante

→ **Phase 0** (voir [SESSION.md](SESSION.md))
