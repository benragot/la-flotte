---
name: dofus-129-classes
description: Référentiel des 12 classes Dofus 1.29 et de leurs paliers de sorts (structure prête à recevoir les formules).
---

# Classes Dofus 1.29

## Les 12 classes

| ID          | Classe   | Stat principale |
| ----------- | -------- | --------------- |
| `feca`      | Féca     | Intelligence    |
| `osamodas`  | Osamodas | Force/Sagesse   |
| `enutrof`   | Enutrof  | Chance          |
| `sram`      | Sram     | Agilité         |
| `xelor`     | Xélor    | Intelligence    |
| `ecaflip`   | Ecaflip  | Chance/Agilité  |
| `eniripsa`  | Eniripsa | Intelligence    |
| `iop`       | Iop      | Force           |
| `cra`       | Crâ      | Agilité         |
| `sadida`    | Sadida   | Intelligence    |
| `sacrieur`  | Sacrieur | Force/Vitalité  |
| `pandawa`   | Pandawa  | Force/Chance    |

## Stats de base au niveau 1

| Champ    | Valeur par défaut | Exception        |
| -------- | ----------------- | ---------------- |
| `basePa` | 6                 | —                |
| `basePm` | 3                 | —                |
| `baseHp` | 50                | —                |
| `basePp` | 100               | `enutrof` : 120  |

```yaml
classes:
  - id: iop
    name: Iop
    basePa: 6
    basePm: 3
    baseHp: 50
    basePp: 100
  - id: enutrof
    name: Enutrof
    basePa: 6
    basePm: 3
    baseHp: 50
    basePp: 120
```

## Soft caps : format canonique

Un soft cap est une **liste ordonnée croissante** de paires `[seuil, coût]`.
Un seuil `null` vaut infini et ferme toujours la liste. Les valeurs sont
exprimées en **points de capital**.

```yaml
softCaps:
  strength:
    - [100, 1]
    - [200, 2]
    - [300, 3]
    - [400, 4]
    - [null, 5]
```

### Règle d'allocation

Le coût pour atteindre la valeur `v` d'une caractéristique est le coût du
**premier palier dont le seuil est ≥ `v`** (le palier `null` valant infini).
On paie donc chaque point au tarif de sa valeur d'arrivée, et on s'arrête dès
que le capital restant ne suffit plus.

### Vitalité et Sagesse (identiques pour toutes les classes)

| Caractéristique | Paliers    | Effet par point de capital        |
| --------------- | ---------- | --------------------------------- |
| `vitality`      | `[[1, 1]]` | +1 Vitalité (`sacrieur` : +2)     |
| `wisdom`        | `[[3, 1]]` | 3 points de capital = +1 Sagesse  |

Champ associé : `vitalityGainPerPoint` vaut `1` par défaut et `2` pour
`sacrieur`.

```yaml
# sacrieur
vitalityGainPerPoint: 2
softCaps:
  vitality: [[1, 1]]
  wisdom: [[3, 1]]
```

### Force / Intelligence / Chance / Agilité

| classe    | strength                           | intelligence                        | chance                              | agility                             |
| --------- | ---------------------------------- | ----------------------------------- | ----------------------------------- | ----------------------------------- |
| feca      | [[50,2],[150,3],[250,4],[null,5]]  | [[100,1],[200,2],[300,3],[400,4],[null,5]] | [[20,1],[40,2],[60,3],[80,4],[null,5]] | [[20,1],[40,2],[60,3],[80,4],[null,5]] |
| osamodas  | [[50,2],[150,3],[250,4],[null,5]]  | [[100,1],[200,2],[300,3],[400,4],[null,5]] | [[100,1],[200,2],[300,3],[400,4],[null,5]] | [[20,1],[40,2],[60,3],[80,4],[null,5]] |
| enutrof   | [[50,1],[150,2],[250,3],[350,4],[null,5]] | [[20,1],[60,2],[100,3],[140,4],[null,5]] | [[100,1],[150,2],[230,3],[330,4],[null,5]] | [[20,1],[40,2],[60,3],[80,4],[null,5]] |
| sram      | [[100,1],[200,2],[300,3],[400,4],[null,5]] | [[50,2],[150,3],[250,4],[null,5]] | [[20,1],[40,2],[60,3],[80,4],[null,5]] | [[100,1],[200,2],[300,3],[400,4],[null,5]] |
| xelor     | [[50,2],[150,3],[250,4],[null,5]]  | [[100,1],[200,2],[300,3],[400,4],[null,5]] | [[20,1],[40,2],[60,3],[80,4],[null,5]] | [[20,1],[40,2],[60,3],[80,4],[null,5]] |
| ecaflip   | [[100,1],[200,2],[300,3],[400,4],[null,5]] | [[20,1],[40,2],[60,3],[80,4],[null,5]] | [[20,1],[40,2],[60,3],[80,4],[null,5]] | [[50,1],[100,2],[150,3],[200,4],[null,5]] |
| eniripsa  | [[50,2],[150,3],[250,4],[null,5]]  | [[100,1],[200,2],[300,3],[400,4],[null,5]] | [[20,1],[40,2],[60,3],[80,4],[null,5]] | [[20,1],[40,2],[60,3],[80,4],[null,5]] |
| iop       | [[100,1],[200,2],[300,3],[400,4],[null,5]] | [[20,1],[40,2],[60,3],[80,4],[null,5]] | [[20,1],[40,2],[60,3],[80,4],[null,5]] | [[20,1],[40,2],[60,3],[80,4],[null,5]] |
| cra       | [[50,1],[150,2],[250,3],[350,4],[null,5]] | [[50,1],[150,2],[250,3],[350,4],[null,5]] | [[20,1],[40,2],[60,3],[80,4],[null,5]] | [[50,1],[100,2],[150,3],[200,4],[null,5]] |
| sadida    | [[50,1],[250,2],[300,3],[400,4],[null,5]] | [[100,1],[200,2],[300,3],[400,4],[null,5]] | [[100,1],[200,2],[300,3],[400,4],[null,5]] | [[20,1],[40,2],[60,3],[80,4],[null,5]] |
| sacrieur  | [[100,3],[150,4],[null,5]]         | [[100,3],[150,4],[null,5]]          | [[100,3],[150,4],[null,5]]          | [[100,3],[150,4],[null,5]]          |
| pandawa   | [[50,1],[200,2],[null,3]]          | [[50,1],[200,2],[null,3]]           | [[50,1],[200,2],[null,3]]           | [[50,1],[200,2],[null,3]]           |

## Cas de tests chiffrés

### Iop, 3 points de capital en Force (Force = 99)

`iop.strength = [[100,1],[200,2],[300,3],[400,4],[null,5]]`

| Achat | Valeur visée | Premier seuil ≥ visée | Coût | Capital restant |
| ----- | ------------ | --------------------- | ---- | --------------- |
| 1     | 100          | 100                   | 1    | 2               |
| 2     | 101          | 200                   | 2    | 0               |

⇒ Force = **101**, 0 point restant. Le test vérifie `strength === 101` et
`points === 0` : le point suivant coûterait 2, impossible à financer.

### Sacrieur, 1 point de capital en Vitalité

`vitalityGainPerPoint: 2`, `vitality = [[1,1]]` ⇒ Vitalité = **+2**,
capital restant = 0.

### Sagesse 3:1

`wisdom = [[3,1]]`, 3 points de capital ⇒ Sagesse = **+1**, capital restant = 0.
Avec seulement 2 points, aucun point de Sagesse n'est acheté (coût 3).

### Enutrof, Force = 50, 2 points de capital

`enutrof.strength = [[50,1],[150,2],[250,3],[350,4],[null,5]]`

Valeur visée 51 ⇒ premier seuil ≥ 51 = 150 ⇒ coût **2**.
Force = **51**, capital restant = 0.

## Structure d'une fiche de classe

- Stats de base niveau 1 : PA, PM, PV, PP (`data/classes.yaml`).
- Soft caps par caractéristique (format ci-dessus, validé par Zod).
- Paliers de sorts : niveau débloqué, coût PA, portée, dégâts, effets.

## Méthode

- Toute valeur ajoutée ici doit être reprise dans un schéma Zod **et** dans un
  test chiffré : une ligne de ce document sans test est une dette.
- Les soft caps sont des données : ils vivent dans `data/*.yaml`, jamais en dur
  dans `src/`.
- Les fonctions de calcul (`getStatCost`, `applyCapitalPoints`) restent pures,
  à 10 lignes maximum, et reçoivent leurs paliers en paramètre.
