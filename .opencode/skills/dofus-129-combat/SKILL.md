---
name: dofus-129-combat
description: Référentiel combat Dofus 1.29 (dégâts, CC, esquive, poussée, LoS) prêt à recevoir les formules détaillées.
---

# Combat Dofus 1.29

## Boucle de tour

1. Début de tour : PA/PM restaurés, effets temporaires décrémentés.
2. Actions : sorts, déplacement, corps à corps.
3. Fin de tour : poison, régénération, états.

## Sections à compléter

### Dégâts

- Formule de base par caractéristique et par palier.
- Arrondis : `Math.floor` sur le résultat final.
- Résistances fixes et en pourcentage, ordre d'application.
- Soft caps par stat (paliers 1.29).

### Coups critiques (CC)

- Taux de CC = base + bonus, cap par sort.
- Effet d'un CC réussi / raté.

### Esquive et tacle

- Esquive PA/PM : formule, opposition au tacle, minimum.
- Retrait et vol de PA/PM.

### Poussée et attraction

- Distance maximale, dégâts de collision.
- Blocage par obstacle ou entité.

### Ligne de vue (LoS)

- Règle des diagonales et des coins.
- Portée minimale/maximale, sorts à portée modifiable.

## Méthode

- Chaque formule est validée par une fiche Spec TDD avec 3 à 5 cas chiffrés.
- Le moteur reste headless : aucun import UI dans `src/engine/`.
- Remplacer ce squelette section par section, jamais en une seule PR.
