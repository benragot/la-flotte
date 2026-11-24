---
name: dofus-129-classes
description: "Référentiel complet des 12 classes Dofus 1.29 : stats de base, soft caps et allocation des points de capital."
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
| `baseHp` | 55                | —                |
| `basePp` | 100               | `enutrof` : 120  |

En 1.29, un personnage démarre à **55 PV** au niveau 1, puis gagne
**+5 PV par niveau** (source : règle 1.29 « starts with 55 HP and gets 5 extra
HP per level »).

```yaml
classes:
  - id: iop
    name: Iop
    basePa: 6
    basePm: 3
    baseHp: 55
    basePp: 100
  - id: enutrof
    name: Enutrof
    basePa: 6
    basePm: 3
    baseHp: 55
    basePp: 120
```

## Soft caps : format canonique

Un soft cap est une **liste ordonnée croissante** de paires `[a, b]`. Deux
formes coexistent et ne se lisent **pas** de la même façon :

| Forme          | Lecture                                         | Exemple                                                              |
| -------------- | ----------------------------------------------- | -------------------------------------------------------------------- |
| Un seul palier | Taux d'échange fixe `[capitalPourUnGain, gain]` | `vitality: [[1, 1]]` ⇒ 1 point de capital = +1 Vitalité              |
| Multi-paliers  | `[valeurMaxDuPalier, coûtParPoint]`             | `[[100, 1], [200, 2]]` ⇒ 1 de Force jusqu'à 100, puis 2 de 101 à 200 |

- Un palier `null` en `valeurMaxDuPalier` vaut infini et ferme toujours la
  liste.
- Les paliers d'une table multi-paliers sont **contigus** : un palier couvre les
  valeurs allant de `palierPrécédent + 1` à `valeurMaxDuPalier`, borne haute
  incluse.

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

- Table à **un seul palier** : c'est un **taux d'échange fixe**
  `[capitalPourUnGain, gain]`. Il n'y a pas de palier : `vitality: [[1, 1]]`
  donne toujours 1 point de capital = +1 Vitalité, et `wisdom: [[3, 1]]` donne
  toujours 3 points de capital = +1 Sagesse, quel que soit le niveau atteint.
- Table **multi-paliers** : `[valeurMaxDuPalier, coûtParPoint]`. Le coût pour
  atteindre la valeur `v` est le coût du palier **contenant** `v` (borne haute
  incluse, `null` = infini). On paie chaque point au tarif de sa valeur
  d'arrivée et on s'arrête dès que le capital restant ne suffit plus.
- `vitalityGainPerPoint` multiplie le gain de Vitalité : à `2` (`sacrieur`),
  1 point de capital = **+2** Vitalité.

### Vitalité et Sagesse (identiques pour toutes les classes)

| Caractéristique | Table      | Taux d'échange                                              |
| --------------- | ---------- | ----------------------------------------------------------- |
| `vitality`      | `[[1, 1]]` | 1 point de capital = +1 Vitalité (× `vitalityGainPerPoint`) |
| `wisdom`        | `[[3, 1]]` | 3 points de capital = +1 Sagesse                            |

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

Les 99 points de Force sont **déjà investis** avant la dépense : on ne paie ici
que les 3 points de capital.

| Achat | Valeur visée | Palier contenant la valeur | Coût | Capital restant |
| ----- | ------------ | -------------------------- | ---- | --------------- |
| 1     | 100          | 1–100                      | 1    | 2               |
| 2     | 101          | 101–200                    | 2    | 0               |

⇒ Force = **101**, 0 point restant. Le test vérifie `strength === 101` et
`points === 0` : le point suivant coûterait 2, impossible à financer.

### Sacrieur, 1 point de capital en Vitalité

`vitality: [[1, 1]]` (taux fixe 1 pour 1) et `vitalityGainPerPoint: 2` :
1 point de capital ⇒ Vitalité = **+2**, capital restant = 0.

### Sagesse 3:1

`wisdom: [[3, 1]]` est un **taux d'échange fixe**, pas un palier :
3 points de capital ⇒ Sagesse = **+1**, capital restant = 0.
Avec seulement 2 points, aucun point de Sagesse n'est acheté (il en faut 3).

### Enutrof, Force = 50, 2 points de capital

`enutrof.strength = [[50,1],[150,2],[250,3],[350,4],[null,5]]`

Valeur visée 51 ⇒ palier 51–150 ⇒ coût **2**.
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
  à 10 lignes maximum, et reçoivent leur table de soft cap en paramètre :
  taux d'échange (`[[capitalPourUnGain, gain]]`) ou multi-paliers
  (`[[valeurMaxDuPalier, coûtParPoint]]`).
