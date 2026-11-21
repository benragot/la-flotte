---
name: yaml-data-design
description: Conventions des fichiers YAML de La Flotte (IDs snake_case, grilles ASCII, validation Zod obligatoire).
---

# Conception des données YAML

## Emplacement

- Toutes les données métier : `data/*.yaml`.
- Aucune donnée métier en dur dans `src/`.
- Chaque fichier possède un schéma Zod dans `src/schemas/` et est validé par
  `tests/data/validate-yaml.spec.ts`.

## Conventions d'IDs

- `snake_case` strict : `chateau_de_la_coupure`, `crabe_des_abysses`.
- Pas d'accents, pas d'espaces, pas de majuscules.
- Un ID est stable : on ne le renomme jamais, on le déprécie.

## Grilles de maps (ASCII)

Une map est une liste de lignes de largeur identique :

| Symbole | Sens            |
| ------- | --------------- |
| `.`     | sol praticable  |
| `#`     | mur / obstacle  |
| `~`     | eau / mer       |
| `P`     | point de départ |
| `M`     | monstre         |

```yaml
id: ile_du_premier_vent
width: 5
height: 3
grid:
  - "P..M."
  - "..#.."
  - "~~~.."
```

## Validation

- Toute nouvelle clé est ajoutée au schéma Zod **avant** le fichier YAML.
- Les tests `npm run test:data` doivent rester verts.
- Les nombres de jeu sont explicites et commentés quand ils viennent d'une
  formule 1.29.
