---
name: dofus-129-classes
description: Référentiel des 12 classes Dofus 1.29 et de leurs paliers de sorts (structure prête à recevoir les formules).
---

# Classes Dofus 1.29

## Les 12 classes

| ID          | Classe      | Stat principale |
| ----------- | ----------- | --------------- |
| `feca`      | Féca        | Intelligence    |
| `osamodas`  | Osamodas    | Force/Sagesse   |
| `enu`       | Enutrof     | Chance          |
| `sram`      | Sram        | Agilité        |
| `xelor`     | Xélor       | Intelligence    |
| `ecaflip`   | Ecaflip     | Chance/Agilité  |
| `eniripsa`  | Eniripsa    | Intelligence    |
| `iop`       | Iop         | Force           |
| `cra`       | Crâ         | Agilité        |
| `sadida`    | Sadida      | Intelligence    |
| `sacrieur`  | Sacrieur    | Force/Vitalité  |
| `pandawa`   | Pandawa     | Force/Chance    |

## Structure d'une fiche de classe

- Stats de base niveau 1 : PA, PM, PV, PP (dans `data/classes.yaml`).
- Paliers de sorts : niveau débloqué, coût PA, portée, dégâts, effets.
- Soft caps et rendements décroissants par caractéristique.

## À compléter

- [ ] Tableau des sorts par classe (niveau, PA, portée, dégâts).
- [ ] Formules de dégâts par caractéristique.
- [ ] Paliers d'XP et gains de points de caractéristique.
- [ ] Cas de tests chiffrés par classe.

Toute valeur ajoutée ici doit être reprise dans un schéma Zod et un test.
