---
name: dofus-129-combat
description: "Référentiel complet du combat Dofus 1.29 : dégâts, CC, retrait PA-PM, poussée, tacle, initiative et LoS."
---

# Combat Dofus 1.29

## Boucle de tour

1. Début de tour : PA/PM restaurés, effets temporaires décrémentés.
2. Actions : sorts, déplacement, corps à corps.
3. Fin de tour : poison, régénération, états.

## Règles transverses

- **Arrondi** : `Math.floor` sur le résultat final, jamais d'arrondi
  intermédiaire implicite ; les étapes nommées ci-dessous sont explicites.
- **Ordre des résistances** : résistances fixes (`flatRes` + `armor`) d'abord,
  pourcentage (`pctRes`) ensuite, plancher à 0 à chaque étape.
- **Pureté** : aucune formule ne lit `Math.random()`, `Date.now()` ou `window`.
  Le hasard (`roll`) et les stats sont injectés.
- **ESLint `max-params: 3`** : toute fonction à plus de 3 paramètres prend un
  **objet d'options** typé (`DamageInput`, `PushInput`, `RetraitInput`…).

## 1. Dégâts

```ts
raw = floor(base * (100 + max(0, stat) + percentDmg) / 100) + flatDmg;
afterFlat = max(0, raw - flatRes - armor);
pctRes = isPlayer ? min(pctRes, 50) : pctRes;
degats = max(0, floor(afterFlat * (100 - pctRes) / 100));
```

- `stat` négative est ramenée à 0 (`max(0, stat)`), elle ne soigne jamais.
- Le cap `pctRes = 50` ne s'applique **qu'aux joueurs** ; un monstre peut
  dépasser 50 %.
- `flatRes` et `armor` sont deux sources distinctes de résistance fixe.

### Cas chiffrés

| Cas | base | stat | %dmg | flat | flatRes | armor | pctRes | Calcul | Résultat |
| --- | ---- | ---- | ---- | ---- | ------- | ----- | ------ | ------ | -------- |
| Stat positive | 20 | 200 | 0 | 0 | 0 | 0 | 0 | `floor(20*300/100)=60` | **60** |
| Résistances fixes puis % | 15 | 100 | 10 | 5 | 6 | 4 | 20 | `floor(15*210/100)=31`, `+5=36`, `36-10=26`, `floor(26*80/100)=20` | **20** |
| Cap joueur / monstre | 30 | -20 | 0 | 0 | 0 | 0 | 80 | `max(0,-20)=0` ⇒ raw 30 ; joueur : `floor(30*50/100)` ; monstre : `floor(30*20/100)` | **15** / **6** |

## 2. Taux de coups critiques (CC)

```ts
baseDiff = baseCrit - bonusCrit;
if (baseDiff <= 2) return 2;
if (agility >= 8) {
  return max(2, floor(baseDiff * (Math.E * 1.1 / Math.log(agility + 12))));
}
return baseDiff;
```

- `Math.log` est le logarithme **naturel** ; `Math.E * 1.1 ≈ 2.9901`.
- Seuil : en dessous de 8 d'Agilité, aucun bonus d'Agilité n'est appliqué.
- Plancher absolu : 2 %.

### Cas chiffrés

| Cas | baseCrit | bonusCrit | Agilité | Calcul | Résultat |
| --- | -------- | --------- | ------- | ------ | -------- |
| Écart déjà minimal | 10 | 9 | 0 | `baseDiff = 1 <= 2` | **2** |
| Agilité forte | 20 | 0 | 100 | `ln(112)=4.7185`, `2.9901/4.7185=0.6337`, `20*0.6337=12.67` | **12** |
| Agilité sous le seuil | 20 | 0 | 0 | `baseDiff = 20`, `agility < 8` | **20** |
| Agilité juste au seuil | 12 | 0 | 8 | `ln(20)=2.9957`, `12*0.99825=11.98` | **11** |

## 3. Perte / retrait de PA-PM

```ts
dodge = max(1, floor(targetWisdom / 4)) + bonusDodge;
retrait = max(1, floor(casterWisdom / 4)) + bonusRetrait;
probability = clamp(0.5 * (retrait / dodge) * (remaining / max), 0.10, 0.90);
```

- `remaining / max` : PA (ou PM) restants sur le maximum de la cible.
- `clamp` borne la probabilité dans `[0.10, 0.90]` : jamais 0 %, jamais 100 %.
- `dodge` et `retrait` ne descendent jamais sous 1.

### Cas chiffrés

| Cas | casterWis | targetWis | remaining/max | Calcul | Résultat |
| --- | --------- | --------- | ------------- | ------ | -------- |
| Égalité | 100 | 100 | 1/1 | `25/25=1`, `0.5*1*1` | **0.50** |
| Cible très résistante | 20 | 200 | 6/6 | `5/50=0.1`, `0.5*0.1=0.05` ⇒ plancher | **0.10** |
| Lanceur très fort | 400 | 0 | 2/2 | `dodge=1`, `retrait=100`, `0.5*100=50` ⇒ plafond | **0.90** |
| Cible entamée | 400 | 0 | 1/4 | `retrait=100`, `dodge=1`, `0.5*100*0.25=12.5` | **0.90** |

## 4. Dégâts de poussée

```ts
push = floor((8 + roll * casterLevel / 50) * remainingCells);
degats = isSecondaryTarget ? floor(push / 2) : push;
```

- `roll` est **injecté** dans `[1..8]` (dé) pour garder le moteur déterministe.
- `remainingCells` : nombre de cases réellement parcourues (0 si bloqué).
- Une cible secondaire ne subit que la moitié, arrondie par `floor`.

### Cas chiffrés

| Cas | Niveau | roll | Cases | Secondaire | Calcul | Résultat |
| --- | ------ | ---- | ----- | ---------- | ------ | -------- |
| Nominal | 50 | 4 | 3 | non | `8+4=12`, `12*3` | **36** |
| Nominal secondaire | 50 | 4 | 3 | oui | `floor(36/2)` | **18** |
| Une seule case | 100 | 8 | 1 | non | `8+16=24`, `24*1` | **24** |
| Bas niveau | 10 | 1 | 5 | non | `8+0.2=8.2`, `8.2*5=41` | **41** |

## 5. Tacle / esquive

```ts
escape = clamp(((fleeAgi + 25) / (fleeAgi + tackleAgi + 50)) * 300 - 100, 0, 100);
```

- Résultat en pourcentage de **réussite de la fuite** (esquive du tacle).
- Pas de tacleur (`tackleAgi = 0`) n'est pas synonyme de fuite garantie : le
  calcul plafonne à 100 %.
- Le tacle des PA/PM est traité par la formule 3, pas par celle-ci.

### Cas chiffrés

| Cas | fleeAgi | tackleAgi | Calcul | Résultat |
| --- | ------- | --------- | ------ | -------- |
| Fuite large | 25 | 0 | `(50/75)*300-100 = 200-100` | **100** |
| Égalité | 100 | 100 | `(125/250)*300-100 = 150-100` | **50** |
| Tacle écrasant | 0 | 75 | `(25/125)*300-100 = 60-100 = -40` | **0** |
| Fuite modérée | 80 | 20 | `(105/150)*300-100 = 210-100` | **100** |

## 6. Initiative

```ts
initiative = floor((str + int + cha + agi + bonusInit) * (currentHp / maxHp));
```

- Somme des 4 caractéristiques principales, plus les bonus d'initiative.
- L'initiative **suit les PV courants** : blessé, on joue plus tard.
- `maxHp` ne peut pas être 0 (garanti par le schéma de monstre/joueur).

### Cas chiffrés

| Cas | str+int+cha+agi | bonusInit | PV | Calcul | Résultat |
| --- | --------------- | --------- | -- | ------ | -------- |
| PV plein | 400 | 100 | 50/50 | `500*1` | **500** |
| PV à moitié | 400 | 0 | 25/50 | `400*0.5` | **200** |
| Presque mort | 101 | 0 | 3/7 | `101*0.4286 = 43.28` | **43** |

## Ligne de vue (LoS)

- Règle des diagonales et des coins : un coin plein bloque le rayon.
- Portée minimale/maximale par sort ; certains sorts ignorent la LoS.
- La carte de collision et la LoS sont des données (`data/*.yaml`, schéma Zod),
  testées par des grilles ASCII dans `tests/`.

## Méthode

- Toute modification de formule exige une fiche Spec TDD et au moins 3 cas
  chiffrés recalculés à la main.
- Le moteur reste headless : aucun import UI dans `src/engine/`.
- Chaque formule est isolée dans une fonction pure de 10 lignes maximum ; les
  paramètres au-delà de 3 passent par un objet d'options typé.
