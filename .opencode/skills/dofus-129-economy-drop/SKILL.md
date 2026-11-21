---
name: dofus-129-economy-drop
description: "Référentiel complet de l'économie Dofus 1.29 : Prospection, drop, XP, paliers et gains de niveau."
---

# Économie & Drop Dofus 1.29

## 1. Prospection (PP)

```ts
prospection = basePp + floor(chance / 10) + bonusPp;
```

- `basePp` vient de la classe : 100, sauf `enutrof` (120).
- `bonusPp` regroupe équipement, panoplies et buffs (entier, peut être négatif).
- Pas de cap : la Prospection est un **multiplicateur** de drop (voir §2).

| Cas | basePp | chance | bonusPp | Calcul | Résultat |
| --- | ------ | ------ | ------- | ------ | -------- |
| Iop stuffé | 100 | 250 | 0 | `100+25` | **125** |
| Enutrof | 120 | 99 | 10 | `120+9+10` | **139** |
| Chance impaire + bonus | 100 | 137 | 30 | `100+13+30` | **143** |

## 2. Chance de drop

```ts
chance = playerPp < ppThreshold
  ? 0
  : min(1, baseDropRate * (playerPp / 100));
```

- `ppThreshold` est le seuil de Prospection de la ressource : en dessous, la
  ressource ne peut **jamais** tomber (probabilité 0, pas un tirage raté).
- À `playerPp = 100`, la probabilité vaut exactement `baseDropRate`.
- `min(1, …)` : une probabilité ne dépasse jamais 1, la PP au-delà de 100 ne
  compense pas un taux de base trop faible.

| Cas | baseDropRate | ppThreshold | playerPp | Calcul | Résultat |
| --- | ------------ | ----------- | -------- | ------ | -------- |
| PP confortable | 0.10 | 100 | 250 | `0.10*2.5` | **0.25** |
| Sous le seuil | 0.10 | 100 | 99 | condition fausse | **0** |
| Plafond | 0.50 | 100 | 300 | `0.50*3 = 1.5` ⇒ cap | **1** |

## 3. XP de combat

```ts
xp = floor(baseMonsterXp * (1 + wisdom / 100) * levelGapFactor);
```

- `wisdom` peut être négative ; `levelGapFactor` porte les pénalités de haut
  niveau et l'XP de groupe (donnée fournie par l'appelant).
- Un seul `Math.floor`, sur le produit complet.

| Cas | baseMonsterXp | sagesse | levelGapFactor | Calcul | Résultat |
| --- | ------------- | ------- | -------------- | ------ | -------- |
| Sagesse forte | 100 | 200 | 1 | `100*3*1` | **300** |
| Groupe | 100 | 0 | 0.5 | `100*1*0.5` | **50** |
| Sagesse + écart | 125 | 50 | 1.2 | `125*1.5*1.2 = 225` | **225** |
| Arrondi final | 10 | 33 | 1 | `10*1.33 = 13.3` | **13** |

## 4. Paliers de niveau

```ts
// tiers: [{ level, xp }, ...] triés par xp croissante — INJECTÉS en paramètre
computeLevelFromXp(tiers, xp) => plus haut niveau dont l'XP cumulée <= xp
```

- La table de paliers **n'est jamais en dur dans `src/`** : elle est injectée,
  chargée depuis `data/*.yaml` et validée par un schéma Zod.
- Si l'XP est inférieure au premier palier, on renvoie le niveau du premier
  palier (clamp bas).
- Si l'XP dépasse le dernier palier connu, on renvoie le dernier niveau
  (clamp haut).

Fixture de test :

```ts
const tiers = [
  { level: 1, xp: 0 },
  { level: 2, xp: 110 },
  { level: 3, xp: 650 },
  { level: 4, xp: 1500 },
];
```

| Cas | xp | Palier retenu | Résultat |
| --- | -- | ------------- | -------- |
| Départ | 0 | `level 1` | **1** |
| Juste avant | 649 | `level 2` (110) | **2** |
| Pile sur le palier | 650 | `level 3` | **3** |
| Au-delà de la table | 100000 | `level 4` (dernier) | **4** |

## 5. Gains par niveau

À chaque niveau gagné (le niveau 1 est le point de départ, sans gain) :

| Gain              | Valeur par niveau | Total au niveau `n` |
| ----------------- | ----------------- | ------------------- |
| PV                | +5                | `baseHp + 5 * (n - 1)` |
| Points de capital | +5                | `5 * (n - 1)`       |
| Points de sort    | +1                | `n - 1`             |
| PA                | —                 | `n >= 100 ? 7 : 6`  |

- Les PA passent à 7 **au niveau 100 exactement**, et n'augmentent plus
  ensuite.
- `baseHp` est celui de la classe (50 par défaut).

| Cas | Niveau | PV | Capital | Points de sort | PA |
| --- | ------ | -- | ------- | -------------- | -- |
| Départ | 1 | 50 | 0 | 0 | 6 |
| Premier gain | 2 | 55 | 5 | 1 | 6 |
| Seuil PA | 100 | 545 | 495 | 99 | 7 |
| Fin de courbe | 200 | 1045 | 995 | 199 | 7 |

## Marché

- Monnaie : les **kamas**.
- Taxes d'hôtel de vente et prix plancher : données de `data/*.yaml`, jamais de
  taux en dur dans `src/`.
- Sources (butin, quêtes) et puits (taxes, consommables) documentés par fiche
  Spec avant implémentation.

## Méthode

- Toute courbe est stockée en YAML (`data/`) et validée par Zod.
- Chaque palier ajouté est couvert par un test chiffré.
- Aucune constante métier en dur dans `src/` : tables et seuils sont injectés.
