# Guide — organiser ton travail avec Cursor

Ce document est ton **mode d’emploi** pour travailler sur ce projet (et réutilisable sur d’autres projets week-end).  
Tu n’as pas besoin de le `@`-mentionner à chaque session : les règles permanentes sont dans `.cursor/rules/projet.mdc`.

---

## Les fichiers et leur rôle

| Fichier | Rôle | Tu le mets à jour… |
|---------|------|---------------------|
| [OBJECTIF.md](OBJECTIF.md) | Vision, architecture, définition « v1 terminée » | Rarement (début ou pivot) |
| [PLAN.md](PLAN.md) | Phases dans l’ordre, critères « done » par phase | Au début ; cocher au fil de l’eau |
| [SESSION.md](SESSION.md) | **Tâche du jour** — prompt principal | **Avant chaque session** |
| [HISTORIQUE_ET_TODO.md](HISTORIQUE_ET_TODO.md) | Journal long terme, blocages, checklist globale | Après une étape significative |
| [README.md](README.md) | Install, commandes, URL du site | Quand setup ou URL change |
| `.cursor/rules/projet.mdc` | Contraintes auto pour l’IA | Quand tes habitudes de code changent |

---

## Workflow en 5 étapes

### 1. Avant d’ouvrir Cursor (2 min)

1. Ouvre [PLAN.md](PLAN.md) → note la **phase courante**.
2. Écrase [SESSION.md](SESSION.md) avec **une seule tâche** concrète.
3. Remplis : date, phase, branche, liberté / hors scope.

**Règle d’or :** une session = une tâche. Si tu as trois idées, choisis la plus bloquante et mets le reste dans `HISTORIQUE_ET_TODO.md`.

### 2. Premier message dans le chat

Copie-colle ou adapte :

```text
@SESSION.md @PLAN.md

Exécute la tâche de SESSION.md. Respecte la phase PLAN.
Ne touche pas au hors scope. Propose quoi cocher à la fin.
```

Tu n’as **pas** besoin de `@OBJECTIF.md` sauf si l’IA hésite sur l’architecture.

### 3. Pendant la session

- Si tu changes de cap : mets à jour **SESSION.md** dans le chat (« nouvelle tâche : … »).
- Si l’IA part trop loin : rappelle la phase PLAN et le hors scope de SESSION.
- Pour une correction ponctuelle : message court sans refaire tout le contexte.

### 4. Fin de session (5 min)

1. Coche ce qui est fait dans **PLAN.md** (et **OBJECTIF.md** si critère v1).
2. Ajoute 2–3 lignes dans **HISTORIQUE_ET_TODO.md** (chronologie + blocages).
3. Prépare **SESSION.md** pour la **prochaine** fois (phase + tâche unique + cases vides).

### 5. Git

- Demande un commit **explicitement** (« commit avec message … »).
- Une phase terminée ≈ un merge ou un commit logique, pas obligatoirement un commit par message Cursor.

---

## Modèle à copier — SESSION.md

```markdown
# Session courante

**Date :** YYYY-MM-DD
**Phase PLAN :** Phase X — …
**Branche :** main

## Contexte (2 phrases max)
…

## Tâche unique pour cette session
…

## Liberté accordée à l’IA
- …

## Hors scope cette session
- …

## Résultat de la session (à remplir en fin de session)
- [ ] Tâche terminée
- **Notes :** …
- **Prochaine session :** …
```

---

## Modèle à copier — message Cursor (session type)

**Implémentation :**

```text
@SESSION.md @PLAN.md
Implémente la tâche SESSION. Tests locaux inclus si pertinent.
```

**Debug :**

```text
@SESSION.md
Bug : [symptôme]. Ne change que ce qui est nécessaire pour corriger.
```

**Revue / état des lieux :**

```text
@PLAN.md @HISTORIQUE_ET_TODO.md
Où en est le projet par rapport au PLAN ? Prochaine tâche recommandée pour SESSION.md ?
```

**Demande large (à éviter) :**

```text
Finis le projet.
```

→ Préfère decouper en une phase PLAN à la fois.

---

## Ce que fait `.cursor/rules/projet.mdc`

Cursor injecte ce fichier **automatiquement** dans chaque conversation sur ce repo.

Tu y mets ce qui ne change pas :

- langue (français)
- style de code (simple, Python data)
- fichiers sacrés (`jumelages.csv`, `docs/`)
- interdictions (commit auto, refonte, scope v2)

Tu **ne** mets **pas** la tâche du jour dedans → ça reste dans **SESSION.md**.

Pour modifier : édite `.cursor/rules/projet.mdc` ou *Cursor Settings → Rules*.

---

## Quand utiliser quel document

| Situation | Fichiers |
|-----------|----------|
| Session de codage normale | `@SESSION.md` + `@PLAN.md` |
| « Où j’en suis ? » | `@PLAN.md` + `@HISTORIQUE_ET_TODO.md` |
| Doute architecture / v1 | `@OBJECTIF.md` |
| Rappel workflow Cursor | ce fichier `GUIDE_CURSOR.md` |
| Nouveau sur le repo | `README.md` puis `OBJECTIF.md` |

---

## Brouillon perso (optionnel)

Si tu veux griffonner sans committer :

```gitignore
# .gitignore
SESSION.brouillon.md
notes-perso/
```

Le **SESSION.md** versionné reste la version « officielle » pour l’IA.

---

## Checklist « projet sous contrôle »

- [ ] Une phase PLAN cochée à la fois
- [ ] SESSION.md ≤ 1 tâche principale
- [ ] HISTORIQUE mis à jour après merge / déploiement / gros bug
- [ ] README avec URL Pages quand le site est live
- [ ] `.cursor/rules/projet.mdc` reflète tes préférences actuelles

---

## Réutiliser sur un autre projet week-end

1. Copier `PLAN.md`, `SESSION.md`, `GUIDE_CURSOR.md`, `.cursor/rules/projet.mdc`.
2. Réécrire `OBJECTIF.md` et les phases de `PLAN.md`.
3. Adapter `projet.mdc` (stack, dossiers, langue).
4. Garder la même discipline : **SESSION = aujourd’hui**, **PLAN = ordre**, **OBJECTIF = pourquoi**.
