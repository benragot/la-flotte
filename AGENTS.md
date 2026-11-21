# La Flotte — Constitution du projet

## Cible mécanique

- Dofus 1.29 (Retro) : 12 classes, PA/PM/PO, ligne de vue (LoS), soft caps.
- Progression : Sagesse, PP, Drop, XP selon les courbes 1.29.
- Toute formule métier est documentée dans une fiche Spec TDD avant implémentation.

## Univers

- La Flotte : monde post-apo médiéval maritime après **La Coupure**.
- Archipel, navigation, **Fruits d'Écho**, ton One Piece × Kaamelott.
- Dialogues absurdes, héroïsme bancal, économie de subsistance.

## Données

- 100 % des données métier vivent dans `data/*.yaml`.
- Chaque fichier YAML est validé par un schéma Zod dans `src/schemas/`.
- Zéro donnée métier en dur dans `src/`.

## Règles non négociables

1. `orchestrator` ne modifie jamais de fichier et délègue tout à un subagent.
2. 1 feature = 1 branche (`feat/`, `fix/`, `design/`) = 1 PR GitHub
   (`gh pr create`). Zéro commit sur `main`.
3. TDD strict : écrire le test → vérifier qu'il échoue (RED) → implémenter →
   vérifier qu'il passe (GREEN).
4. Fonctions de 10 lignes maximum. `eslint` est obligatoire et
   `eslint-disable` est interdit.
5. `src/engine/` ne doit jamais importer PixiJS, React ni `window`.

## Qualité

- `npm run check` doit être vert avant tout commit.
- Le walkthrough (`tests/walkthrough/`) reste à jour à chaque feature.
- Le rendu (`src/renderer/`, `src/ui/`) est découplé du moteur headless.
