---
name: gitmoji-commits
description: Format strict des commits et titres de PR avec gitmoji placé après le type Conventional Commit.
---

# Commits gitmoji

## Format strict

```
type(scope): <gitmoji> description
```

- L'emoji vient **après** les deux-points, jamais avant ni collé au type.
- Le préfixe Conventional Commit reste en tête de ligne (compatibilité
  Release Please).
- Un commit sans emoji est invalide.
- Un commit avec l'emoji avant le type est invalide : `🗺️ feat(data): ...`.
- Le titre de PR suit exactement le même format.

## Table de correspondance

| Commit | Usage |
| --- | --- |
| `test(<scope>): ✅` | tests unitaires / walkthrough TDD |
| `feat(<scope>): ✨` | nouvelle feature code |
| `feat(data): 🗺️` | maps YAML |
| `feat(data): 👾` | monstres, sorts, items, panoplies, donjons YAML |
| `fix(<scope>): 🐛` | correction bug / formule 1.29 |
| `refactor(<scope>): ♻️` | refactorisation 10 lignes max |
| `chore(<scope>): 🔧` | config, harness, CI |
| `docs(<scope>): 📝` | skills, docs |

## Exemples

- Valide : `feat(data): 🗺️ add île de la Coupure`
- Valide : `fix(combat): 🐛 corriger le calcul des CC`
- Invalide : `feat(data): add carte 🗺️` (emoji en fin de ligne)
- Invalide : `🗺️ feat(data): add carte` (emoji avant le type)
