---
name: tdd-micro-functions
description: Règles de découpage en fonctions pures de 10 lignes maximum et protocole Red/Green/Refactor.
---

# TDD & micro-fonctions

## Contrainte mécanique

- Toute fonction de `src/` fait **10 lignes maximum** (hors lignes vides et
  commentaires), signature et accolades incluses par ESLint.
- Complexité cyclomatique ≤ 4, profondeur ≤ 2, paramètres ≤ 3.
- `eslint-disable` est interdit : si la règle casse, on découpe.

## Techniques de découpage

1. **Early return** : sortir les cas d'erreur avant le cas nominal.
2. **Composition** : une fonction = une responsabilité ; extraire les calculs
   intermédiaires dans des helpers purs nommés.
3. **Types dédiés** : remplacer les paramètres booléens/optionnels qui
   s'accumulent par un objet typé (`Options`, `Stats`, `Context`).
4. **Table de correspondance** : remplacer les `switch` par un `Record` typé.
5. **Fonction pure** : aucune mutation d'argument, aucun accès à `window`,
   `Date.now()` ou au hasard non injecté.

## Protocole Red / Green / Refactor

1. **RED** — écrire le test, lancer la suite, constater l'échec pour la bonne
   raison (message d'erreur attendu).
2. **GREEN** — écrire la plus petite implémentation qui passe, sans
   anticipation.
3. **REFACTOR** — nettoyer sans changer le comportement, `npm run check` vert.
4. Mettre à jour `tests/walkthrough/` si le comportement de jeu évolue.

## Nommage

- `createX`, `computeX`, `applyX`, `isX`, `getX` : verbe explicite.
- Un fichier = une fonction publique principale + helpers privés.
