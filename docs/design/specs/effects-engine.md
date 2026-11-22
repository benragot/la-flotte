---
title: Moteur d'effets de sorts (Dofus 1.29)
status: spec
source: dofus-129-expert
related_island: docs/design/islands/ile_de_la_ferraille.md
unlocks: 9 sorts de monstres refusés (§3)
---

# Fiche Spec TDD — Moteur d'effets de sorts (Dofus 1.29)

**Périmètre** : rendre implémentables les **9 sorts refusés** de `docs/design/islands/ile_de_la_ferraille.md` §3 sans perdre d'effet.

## 0. Sources et conventions

### 0.1 Abréviations

| Réf | Fichier / source |
|---|---|
| `L###` | `docs/design/islands/ile_de_la_ferraille.md`, ligne |
| `SCH###` | `src/schemas/spellSchema.ts`, ligne |
| `CAST###` | `src/engine/combatLoop/cast.ts`, ligne |
| `CASTABLE###` | `src/engine/combatLoop/castable.ts`, ligne |
| `PUSH###` | `src/engine/combatLoop/push.ts`, ligne |
| `DMG###` | `src/engine/combat/damage.ts`, ligne |
| `APMP###` | `src/engine/combat/apMpLoss.ts`, ligne |
| `PB###` | `src/engine/combat/pushback.ts`, ligne |
| `TURN###` | `src/engine/combatLoop/turn.ts`, ligne |
| `MULTI###` | `src/engine/multiCombat/types.ts`, ligne |
| `GRID###` | `src/engine/grid/asciiMap.ts` et `lineOfSight.ts` |
| `YAML###` | `data/spells.yaml`, ligne |
| `SKILL-COMBAT` | skill `dofus-129-combat` |
| `DPLN` | dofuspourlesnoobs.com, « Retrait et Esquive » |
| `JOL-RETRAIT` | forum JOL/Dofus, formule retrait 2018–2022 |
| `DOFUSINFOS-FECA` | dofus-infos.webnode.page, Féca 1.29 |
| `JOL-PUSH` | forum JOL, « Les formules de calcul dans Dofus » (1.27+) |
| `JOL-RETRO-FALL` | forum JOL Retro 2020, dégâts de zone |
| `JOL-SOIN` | forum JOL 2007, formule des soins |
| `RETRO-CM` | Ankama CM Dofus Retro, 07/05/2026 (pas de stat retrait équipement) |
| `FASHIONISTA` | dofusfashionista.gg, Retro : pas de plafond 12 PA / 6 PM |
| `JOL-SUMMON` | dofusretro.jeuxonline.info, guide Osamodas 1.29 |
| `RETRO-FORUM` | dofus-retro.com, 2024 : invocations non contrôlables |
| `PATCH-1.29` | dofus.jeuxonline.info, notes 1.29 |

### 0.2 Conventions non négociables

| Règle | Application |
|---|---|
| Arrondi | `Math.floor` **uniquement** aux étapes nommées ; aucun arrondi intermédiaire implicite |
| Aléa | `rng` injecté `[0,1[` ; interdiction de `Math.random`, `Date.now`, `window` |
| Fonctions | ≤ 10 lignes ; > 3 paramètres ⇒ objet d'options typé (`SKILL-COMBAT`) |
| Moteur | `src/engine/` sans React / PixiJS / `window` |
| Source de vérité | La fiche d'île **prime** sur toute règle générale 1.29 (valeurs, portées, durées) |
| Refus | Un effet non représentable reste **refusé**, jamais silencieusement perdu (`YAML:53-61`, `L1198-1204`) |

### 0.3 Les 9 sorts refusés et la PR qui les rend possibles

| Sort | Effet requis | Réf fiche | PR |
|---|---|---|---|
| `crachat_mazout` | dégâts + −1 PM | `L263`, `L281-297` | PR6 |
| `grignotage_cable` | dégâts + −1 PA | `L266`, `L337-353` | PR6 |
| `serrage_de_boulon` | bouclier 12, 2 tours | `L268`, `L374-390` | PR6 |
| `tole_blindee` | bouclier 20, 2 tours, cassable sur `#` (−2 PA) | `L277`, `L542-558`, `L250` | PR6 + PR9 |
| `soupe_a_lhuile` | soin 12–18 | `L269`, `L393-409` | PR8b |
| `jet_de_vapeur` | dégâts croix 1 | `L270`, `L412-427` | PR6 |
| `pluie_de_rivets` | dégâts cercle 1 | `L276`, `L524-539` | PR6 |
| `graissage` | +1 PM, 2 tours | `L274`, `L486-502`, `L199` | PR6 |
| `appel_a_la_casse` | invoque `fer_rat_de_cale`, max 2 | `L278`, `L561-577` | PR8b |

### 0.4 Valeurs manquantes / décisions à trancher (aucune n'est inventée)

| # | Question | Source du doute | Défaut proposé | Impact |
|---|---|---|---|---|
| Q1 | Dégâts de zone : centre à **100 %** ou **110 %**, puis −10 %/case ? | `JOL-RETRO-FALL` dit 110 % ; DPLN dit 100 % | **100 %** au centre, −10 %/case, constante `ZONE_CENTER_PERCENT` | Les bras de `jet_de_vapeur`/`pluie_de_rivets` perdent 10 % |
| Q2 | `cercle 1` = **5** cases (losange) ou **9** cases (3×3) ? | Convention de « taille » | **5** (losange Manhattan, 1.29 : diagonales sûres) | `croix 1` et `cercle 1` sont identiques à taille 1 |
| Q3 | Les dégâts de zone touchent-ils les alliés ? | `L276` ne le dit pas | `target: undefined` = tous ; les 9 mettent `enemy` | Pas de friendly fire dans les 9 |
| Q4 | Soin critique ? | 1.29 le permet, `L269` ne donne aucun CC | **Pas de critique** (aucun champ `critHeal`) | Soin déterministe |
| Q5 | PV d'invocation : `PdV × (1 + niveau invocateur/100)` ? | `JOL-SUMMON`, `L68` donne 52 PV | **Oui** : 62 PV pour Yvon niv. 20 | +10 PV sur le rat invoqué |
| Q6 | L'invocation meurt-elle avec son invocateur ? | Aucune source primaire | **Non** : persiste jusqu'à 0 PV / fin | La victoire exige de tuer l'invocation |
| Q7 | « Bouclier » = **pool de points** ou **armure plate** ? | 1.29 n'a pas de pool ; `L268`/`L277` disent « bouclier » | **Armure plate** par coup (mécanique 1.29 la plus proche) | 12 absorbe 12 **par coup**, pas 12 au total |
| Q8 | `−1 PM`/`−1 PA` : retrait **définitif** (1.29) ou **1 tour** (`L296`, `L352`) ? | Fiche explicite `durationTurns: 1` | **1 tour** (la fiche prime) | Le retrait est une réduction temporaire |

## 1. Règles 1.29 exactes

### 1.1 Retrait de PA / PM

```ts
retrait = max(1, Math.floor(sagesseLanceur / 4)) + bonusRetrait; // bonus défaut 0
esquive = max(1, Math.floor(sagesseCible / 4)) + bonusEsquive;   // bonus défaut 0
p = clamp(0.5 * (retrait / esquive) * (restants / max), 0.10, 0.90);
```

- `restants` / `max` = PA (ou PM) **courants** / **maximum courant** de la cible (`DPLN`, `JOL-RETRAIT`).
- `p` n'est **pas arrondi** ; la comparaison est `rng() < p`.
- **Point par point** : un sort qui retire N points effectue N tentatives séquentielles ; après chaque succès, `restants` diminue et `p` est recalculé (`DPLN`, `JOL-RETRAIT`).
- Bornes **10 % / 90 %** par tentative, jamais 0 %, jamais 100 % (`DPLN`, `JOL-RETRAIT`).
- Si `restants <= 0` ou `max <= 0` : **aucune tentative** (garde anti-division et anti-négatif).
- **PA et PM n'ont pas de coefficient distinct** dans la formule 1.29. `RETRO-CM` confirme qu'il n'existe pas de stat d'équipement « retrait PA/PM » en 1.29 : tout vient de la Sagesse (`floor(sagesse/4)`). Les différences sont tactiques (PA bloque l'action, PM le déplacement), le pool (6 vs 3) et la forgemagie (hors combat). **La prémisse « PA et PM n'ont pas le même poids » est fausse dans le calcul de combat 1.29.**
- **Plancher** : 0 PA et 0 PM sont atteignables ; jamais négatif.

#### Durée

| Mécanique 1.29 | Durée | Implémentation | Utilisée par les 9 ? |
|---|---|---|---|
| **Retrait** (ex. Flèche Glacée) | définitif pour le combat | **hors périmètre** : non représentable, le schéma exige `durationTurns` | Non |
| **Réduction** | N tours | `durationTurns: N` (requis, §2.4) | Oui : `durationTurns: 1` (`L296`, `L352`) |

> La fiche écrit `durationTurns: 1` : on implémente donc une **réduction temporaire**, pas un retrait définitif. `durationTurns` est **requis** pour `apLoss`/`mpLoss`/`apGain`/`mpGain`/`shield` (§2.4) : aucun des 9 sorts n'étant un retrait définitif, on n'ajoute pas de variante « sans durée » — une règle sans cas d'usage et sans test divergerait.

#### Ordre de résolution

1. Dégâts du sort (puis poussée éventuelle).
2. Si la cible est morte : **aucun** retrait.
3. Tentatives de retrait dans l'ordre du tableau `effects`.
4. Réduction du **max** ; si la cible est l'entité **active**, son `ap`/`mp` courant diminue du même montant (plancher 0) ; sinon la réduction s'applique à son prochain début de tour.
5. Un retrait appliqué **après** un sort déjà lancé ne peut pas l'annuler : les PA ont déjà été dépensés.

#### Cas chiffrés

| Cas | Sagesses | restants/max | Calcul | `p` |
|---|---|---|---|---|
| Piou (`L37-41` wis 5) vs cible wis 0 | 5 / 0 | 3/3 | `retrait=1`, `esquive=1`, `0.5×1×1` | **0.50** |
| Rat (`L79` wis 10) vs cible wis 20 | 10 / 20 | 5/6 | `2/5=0.4`, `0.5×0.4×0.8333` | **0.1667** |
| Rat vs cible à 2 PA (`L89`) | 10 / 20 | 2/6 | `0.5×0.4×0.3333=0.0667` ⇒ plancher | **0.10** |
| Crabe (`L116` wis 10) vs cible wis 0 | 10 / 0 | 5/5 | `2/1=2`, `0.5×2=1` ⇒ plafond | **0.90** |
| Yvon (`L226` wis 25) vs cible wis 20 | 25 / 20 | 6/6 | `6/5=1.2`, `0.5×1.2` | **0.60** |

#### Cas séquentiel déterministe

Entrée : retrait 25, esquive 25, `restants=6`, `max=6`, 2 points, `rng` = `[0.20, 0.60]`.

| Tentative | `p` | Tirage | Résultat | `restants` |
|---|---|---|---|---|
| 1 | 0.50 | 0.20 | succès | 5 |
| 2 | `0.5×5/6=0.4167` | 0.60 | échec | 5 |

⇒ **1 point retiré**.

### 1.2 Bouclier

- Il n'existe **pas de pool de points de bouclier** en 1.29. Les deux mécaniques proches sont :
  1. **Armure** = réduction **fixe par coup**, sur une durée, élément(s) défini(s) (`DOFUSINFOS-FECA`, `JOL-PUSH`) ;
  2. **Bouclier Féca** = résistance **%**, plafonnée à 50 % pour les joueurs (`DOFUSINFOS-FECA`).
- La fiche dit « +12 bouclier » / « +20 bouclier » sans durée de pool. La mécanique 1.29 la plus proche est **l'armure plate**. C'est le choix par défaut (Q7).
- L'armure Féca 1.29 évolue avec le niveau : `floor(base × (100 + niveau×5) / 100)` (`DOFUSINFOS-FECA`). **La fiche prime** : les valeurs 12 et 20 sont **fixes**, sans scaling de niveau.

```ts
aprèsPlat = max(0, dégâtsBruts - résistanceFixe - armure);
dégâtsFinaux = max(0, Math.floor(aprèsPlat * (100 - résistancePct) / 100));
```

| Question | Réponse |
|---|---|
| Valeur | **plate**, pas de % |
| Cumul | **additif** entre sources distinctes ; une même source relancée **rafraîchit** (valeur et durée), ne s'additionne pas à elle-même |
| Expiration | au **début du tour de la source** (`expiresAtRound = round + durationTurns`) |
| Résistances | appliquée **après** `flatRes`, **avant** `%res` (`DMG:24-38`) |
| Poussée | **non réduite** : les dégâts de poussée ont leur propre résistance (`RéPou`) |
| Plancher | 0 ; une armure ne soigne jamais |
| Élément | tous (les 9 ne précisent pas d'élément) |
| `flatRes` | distincte, s'additionne à l'armure |

#### Cas chiffrés

| Cas | brut | flatRes | armure | pctRes | Calcul | Résultat |
|---|---|---|---|---|---|---|
| Bouclier 12 | 30 | 0 | 12 | 0 | `30-12` | **18** |
| Bouclier + résistance fixe | 30 | 5 | 12 | 0 | `30-17` | **13** |
| Bouclier > dégâts | 10 | 0 | 12 | 0 | `max(0,-2)` | **0** |
| Bouclier puis % joueur | 30 | 0 | 12 | 50 | `18`, puis `floor(18×50/100)` | **9** |
| Deux coups | 30, 30 | 0 | 12 | 0 | `18`, `18` | **18 / 18** |
| Deux sources | 30 | 0 | 12+20 | 0 | `30-32` | **0** |
| Poussée | 36 | — | 12 | — | armure ignorée | **36** |

> Le test « deux coups ⇒ 18 / 18 » verrouille le choix **armure par coup**. Un pool donnerait `18` puis `30`.

### 1.3 Soin

```ts
soin = Math.floor(base * (100 + Math.max(0, intelligence)) / 100) + bonusSoins;
pv = Math.min(maxHp, hp + soin);
```

- `base` = jet tiré dans `[min, max]` (ex. `12–18`, `L269`).
- C'est **multiplicatif**, pas `base + intelligence`.
- `bonusSoins` = équipement (0 pour les monstres) ; ajouté **après** l'arrondi (`JOL-SOIN`).
- **Sagesse : aucun effet** sur les soins (`JOL-SOIN`).
- **Critique** : possible en 1.29 (les sorts de soin ont des valeurs CC), mais la fiche ne donne **aucune valeur** ⇒ pas de critique (Q4).
- **Mort** : un soin ne ressuscite jamais ; `hp === 0` ⇒ cible inchangée.
- **Surplus** : perdu (cap `maxHp`).
- Intelligence négative : ramenée à 0, cohérent avec `max(0, stat)` des dégâts.

#### Cas chiffrés

| Cas | base | Int | Cible | Calcul | Résultat |
|---|---|---|---|---|---|
| Marmite (`L149` int 40) | 12 | 40 | 50/85 | `floor(12×140/100)=16` | **66/85** |
| Marmite, jet max | 18 | 40 | 50/85 | `floor(18×140/100)=25` | **75/85** |
| Soin capé | 18 | 40 | 70/85 | `70+25=95` ⇒ cap | **85/85** |
| Sans Intelligence | 12 | 0 | 50/85 | `12` | **62/85** |
| Intelligence négative | 12 | −100 | 50/85 | `max(0,-100)=0` | **62/85** |
| Sagesse | 12 | 0, sag 0 vs 200 | 50/85 | identique | **62/85** |
| Cible morte | 18 | 40 | 0/85 | pas de résurrection | **0/85** |

### 1.4 Zones de sorts

`size` = **rayon** autour de la case ciblée. Preuve interne : la fiche utilise `zone: {type: target, size: 0}` pour « Cible » (une case) sur 14 sorts (`L290, 309, 328, 346, 365, 383, 402, 439, 458, 477, 495, 514, 551, 570`), donc `size` n'est pas un nombre de cases total.

```ts
target(0) = {(0,0)}
cross(n)  = {(0,0)} ∪ {(±i,0),(0,±i) | 1≤i≤n}      // 4n+1 cases
circle(n) = {(dx,dy) | |dx|+|dy| ≤ n}              // 2n²+2n+1 cases
```

| Type | n=1 | n=2 | n=3 |
|---|---|---|---|
| `target` | 1 | — | — |
| `cross` | **5** | **9** | **13** |
| `circle` | **5** | **13** | **25** |

```
croix 1          cercle 1        croix 2          cercle 2
  . X .            . X .           . . X . .        . . X . .
  X O X            X O X           . . X . .        . X X X .
  . X .            . X .           X X O X X        X X O X X
                                   . . X . .        . X X X .
                                   . . X . .        . . X . .
```

> **Piège** : à `size: 1`, `croix` et `cercle` sont **identiques** (5 cases). C'est une conséquence 1.29 (les diagonales sont hors du cercle Manhattan), pas un bug.

| Question | Règle |
|---|---|
| LoS requise ? | **Case ciblée uniquement** ; les cases de la zone ne sont pas testées (`CASTABLE:21-30` : `hasSight` + `isDamageCell` ne regardent que la case ciblée) |
| Mur `#` dans la zone | case géométrique sans combattant ; **ne tronque pas** les autres branches |
| Case hors carte | ignorée, pas d'erreur |
| Centre `#` ou `~` | **invalide** (case non praticable) |
| `requiresLos: false` | aucune LoS, même derrière un mur (`L276`, `L269`) |
| Ordre des cibles | distance croissante depuis le centre, puis `(y,x)` (déterministe) |
| Jet de dégâts | **un seul tirage par cast**, appliqué à toutes les cibles (`DPLN`) |
| Dégâts par éloignement | `floor(dégâts × (ZONE_CENTER_PERCENT − 10×distance) / 100)` (Q1) ; appliqué **après** résistances |

#### Cas chiffrés

| Cas | Entrée | Attendu |
|---|---|---|
| Croix 1 | centre (5,5) | 5 cases : `(5,5),(6,5),(4,5),(5,6),(5,4)` |
| Croix 2 + mur | centre (5,5), `#` en (6,5) | 9 cases, dont `(7,5)` ; le mur ne coupe pas |
| Cercle 2 | centre (2,2) sur 5×5 | 13 cases ; coins `(0,0)`,`(4,4)` exclus |
| Hors carte | centre (0,0), croix 1 | 3 cases : `(0,0),(1,0),(0,1)` |
| Cible derrière un mur | centre visible, cible en (5,4), mur entre caster et (5,4) | **touchée** (pas de LoS par case) |
| Deux cibles, un jet | rng 0.5, dégâts 11–16 | jet = 14 pour les deux |
| Éloignement 1 | dégâts finaux 10 | `floor(10×90/100)=9` |
| Mur au centre | centre `#` | cast **invalide**, PA non dépensés |

### 1.5 Buff de PA / PM

| Question | Réponse |
|---|---|
| Plafond 1.29 | **aucun** ; le 12 PA / 6 PM est une limite 2.x (`FASHIONISTA`) |
| Max effectif | `max(0, maxBase + Σ buffs − Σ debuffs)` |
| Début de tour | `ap = maxApEffectif`, `mp = maxMpEffectif` (`TURN:5-7` à adapter) |
| Durée | source : expire au début du tour du lanceur |
| Cumul | additif entre sources ; même source = refresh |
| Cible | `self` / `ally` ; `Graissage` cible un allié (`L199`) mais la portée 0–3 autorise soi-même |

#### Cas chiffrés

| Cas | Base | Effets | Max effectif |
|---|---|---|---|
| Graissage | 3 PM | +1 | **4** |
| Buff + debuff | 6 PA | +1, −1 | **6** |
| Deux debuffs | 3 PM | −1, −1 | **1** |
| Debuff > base | 1 PA | −2 | **0** |
| Au-delà de 12 | 6 PA | +2 | **8** (pas de cap) |
| Fin de durée | 3 PM | +1, `durationTurns=2`, round 3 | **3** |

### 1.6 Invocation

| Question | Réponse |
|---|---|
| Nombre max | Fiche : `maxSummons: 2` (`L576`). 1.29 : limite globale = places de combat (8 par camp) |
| Contrôle | **non contrôlable** en Retro (`RETRO-FORUM`) ; IA uniquement |
| Ciblable | **oui**, c'est un combattant ; sorts, attaques, zones |
| Durée de vie | jusqu'à 0 PV ou fin de combat ; pas de limite de tours dans la fiche |
| Initiative | `floor((force+intelligence+chance+agilité) × hp/maxHp)` ; à l'apparition PV pleins ⇒ somme des 4 stats |
| PV | `floor(PdV_monstre × (100 + niveau_invocateur) / 100)` (`JOL-SUMMON`, Q5) |
| PA/PM | ceux du monstre (`L69-70` pour le rat : 5/3) |
| Placement | case libre et praticable ; sinon cast refusé, PA non dépensés |
| Mort de l'invocateur | persiste (Q6) ; la victoire exige tous les ennemis morts, invocation incluse |
| Mort de l'invocation | retirée de l'ordre ; sa case libérée |

#### Cas chiffrés

| Cas | Entrée | Attendu |
|---|---|---|
| Rat d'Égoût-dron | `L74-79` : 22/5/10/15 | initiative **52** |
| PV à Yvon niv. 20 | 52 PV, `L20` niv. 20 | `floor(52×1.2)=` **62** |
| Max invocations | `maxSummons: 2` | 3e cast refusé, PA non dépensés |
| Mort de l'invocateur | rat encore vivant | rat **reste** (Q6) |
| Victoire | boss mort, rat vivant | **pas** victoire (`src/engine/multiCombat/outcome.ts:10-12`) |

### 1.7 Push / pull — notre modèle est-il fidèle ?

```ts
distance = cells - travelled;                 // cases NON parcourues
dégâts = Math.floor((8 + roll * niveauLanceur / 50) * distance) + DoPou - RéPou;
secondaire = Math.max(0, Math.floor(dégâts / 2) - RéPouSecondaire);
```

- `roll` attendu ∈ `[1..8]` (`JOL-PUSH`), mais **aucun code ne le tire aujourd'hui** : en 1v1 `cast.ts:108` réutilise le jet de dégâts (`cast.ts:81-86`) ; en 1vN `strike.ts:76` lit `attack.roll ?? 0` alors que `battleSelectors.ts:72-74` (`spellAttackSpec`) ne renseigne jamais `roll` ⇒ **`roll` vaut toujours 0** et les dégâts de poussée se réduisent à `floor(8 × distance)`. **PR7 doit injecter un vrai jet 1..8 dans les deux chemins.**
- `distance` = cases que la cible **aurait dû** parcourir, pas celles réellement parcourues (`JOL-PUSH`, `JOL-RETRAIT` 2021).
- Cible secondaire : moitié **puis** soustraction de `RéPou`, chaîne possible (`JOL-PUSH`).
- Diagonale : la distance n'est **pas** doublée (`JOL-PUSH`).

| Point | Notre code | 1.29 | Verdict |
|---|---|---|---|
| Direction | axe dominant (`PUSH:22-27`) | diagonale si `|dx| = |dy|` | **non fidèle** |
| Distance de collision | `push.travelled` (`CAST:103-111`) | `cells - travelled` | **non fidèle** |
| Mur immédiat | `travelled=0` ⇒ **0 dégât** | distance complète ⇒ dégâts | **non fidèle** |
| Bloqueurs | carte + lanceur (`PUSH:29-32`) | tous les combattants | **non fidèle** |
| Cible secondaire | moitié sans `RéPou` (`PB:17-20`) | moitié − `RéPou`, chaîne | **partiel** |
| Résistance poussée | absente | `RéPou` | **non fidèle** |
| Formule de base | `(8+roll×niv/50)×distance` | identique | **fidèle** |
| Armure | non appliquée | non appliquée | **fidèle** |
| Aléa | jet de dégâts réutilisé (`CAST:108`, 1v1) ou `0` (`strike.ts:76`, 1vN) | 1..8 aléatoire | **non fidèle** |

#### Cas chiffrés — niveau 20, roll 4, poussée 3

| Obstacle | `distance` 1.29 | Dégâts 1.29 | Notre code |
|---|---|---|---|
| Mur immédiat | 3 | `floor(9.6×3)=` **28** | **0** |
| Mur après 1 case | 2 | `floor(9.6×2)=` **19** | **9** |
| Mur après 2 cases | 1 | `floor(9.6×1)=` **9** | **19** |
| Aucun mur | 0 | **0** | **0** |

### 1.8 Durées et ordre de résolution

Règle 1.29 : « les effets de sorts se terminent tous à la fin du tour du personnage qui a lancé le sort » (`PATCH-1.29`).

```ts
expiresAtRound = roundDuCast + durationTurns;
actif = round < expiresAtRound; // au début du tour de la source
```

| Étape | Action |
|---|---|
| 1 | Début du tour de C : retirer les effets dont `sourceId === C.id` et `round >= expiresAtRound` |
| 2 | `ap = maxApEffectif`, `mp = maxMpEffectif` |
| 3 | Cast : phase / PA / cible valides ⇒ dépenser les PA |
| 4 | Zone ⇒ **un seul** jet |
| 5 | Par cible : dégâts (armure, flatRes, %res) ⇒ si morte, stop ⇒ poussée ⇒ riders dans l'ordre |
| 6 | Fin de tour : rien (poisons hors périmètre) |

> Un effet ne peut **jamais** expirer au milieu d'un cast : la zone est résolue atomiquement sur un snapshot. L'expiration n'a lieu qu'au début d'un tour.

## 2. Schéma cible

### 2.1 Types de sorts

```ts
kind: "damage" | "heal" | "buff" | "debuff" | "summon" | "teleport" | "other"
```

| `kind` | Requis | Interdit | Exemple |
|---|---|---|---|
| `damage` | `damage`, `element` | — (les `effects` sont **autorisés**) | Crachat |
| `debuff` | ≥ 1 `apLoss`/`mpLoss` ; `element` si `damage` | `shield`, `apGain`, `mpGain`, `summon` | Grignotage |
| `buff` | ≥ 1 `apGain`/`mpGain`/`shield` | `damage`, `apLoss`, `mpLoss`, `heal`, `summon` | Serrage, Graissage |
| `heal` | `heal` | `damage`, `element`, effets autres que `heal` | Soupe |
| `summon` | exactement 1 effet `summon` | `damage`, `heal`, `element` | Appel |
| `teleport` | — | `damage`, `heal`, `effects` | Bond |
| `other` | ≥ 1 `effect`/`effects` | `damage`, `heal` | Glyphe |

### 2.2 Champs ajoutés

| Champ | Type | Bornes | Défaut | Rôle |
|---|---|---|---|---|
| `heal` | `{min,max}` int ≥ 0 | `min ≤ max` | — | requis si `kind: heal` |
| `zone` | `{type,size}` | `target\|cross\|circle` ; `size ≥ 0` | `{type:"target",size:0}` | forme |
| `effects` | `SpellEffect[]` | — | `[]` | effets **consommés** |
| `effect` | `SpellEffect` | — | — | **legacy**, exclusif avec `effects` |
| `element` | `elementSchema.nullable().optional()` | — | `undefined` | `null` normalisé en `undefined` |

### 2.3 Effets

```ts
type: "heal" | "buff" | "debuff" | "summon" | "trap" | "glyph" | "state" | "push"
    | "steal" | "reflect"
    | "apLoss" | "mpLoss" | "apGain" | "mpGain" | "shield";
```

| Champ | Type | Bornes | Défaut | Types |
|---|---|---|---|---|
| `value` | int | ≥ 1 pour les 5 nouveaux | — | apLoss, mpLoss, apGain, mpGain, shield, push |
| `amount` | `{min,max}` | — | — | heal legacy, glyph, trap |
| `durationTurns` | int | ≥ 1 | **requis** pour les 5 nouveaux | apLoss, mpLoss, apGain, mpGain, shield |
| `target` | `self\|ally\|enemy\|cell\|area` | — | `undefined` = tous | tous |
| `breakOnWallPush` | bool | — | `false` | shield |
| `wallBreakApLoss` | int | ≥ 1 | — | shield + `breakOnWallPush` |
| `summonMonsterId` | string snake_case | — | — | summon |
| `maxSummons` | int | ≥ 1 | `1` | summon |

### 2.4 Refinements `superRefine`

| Règle | Chemin d'issue |
|---|---|
| `effect` et `effects` non vides ⇒ exclusifs | `["effects"]` |
| `kind: damage` sans `damage` ou `element` | `["damage"]`, `["element"]` |
| `damage.min > damage.max` | `["damage","min"]` |
| `kind: heal` sans `heal` | `["heal"]` |
| `kind: heal` avec `damage` | `["damage"]` |
| `kind: summon` sans effet summon / avec 2 | `["effects"]` |
| `kind: buff` sans effet positif | `["effects"]` |
| `kind: debuff` sans effet négatif | `["effects"]` |
| `kind: teleport` avec `damage`/`heal`/`effects` | `["effects"]` |
| `cross`/`circle` avec `size: 0` | `["zone","size"]` |
| `target` avec `size > 0` | `["zone","size"]` |
| `wallBreakApLoss` sans `breakOnWallPush` | `["effects",i,"wallBreakApLoss"]` |
| `durationTurns` absent pour apLoss/mpLoss/apGain/mpGain/shield | `["effects",i,"durationTurns"]` |
| `value` absent/0 pour ces 5 types | `["effects",i,"value"]` |
| `summonMonsterId` absent pour summon | `["effects",i,"summonMonsterId"]` |
| `.strict()` sur `spellSchema` et `spellEffectSchema` | `unrecognized_keys` |

### 2.5 Les 9 sorts en forme schéma

| id | kind | element | damage / heal | zone | effects |
|---|---|---|---|---|---|
| `crachat_mazout` | damage | water | 5–8 | target 0 | `mpLoss 1, 1 tour, enemy` |
| `grignotage_cable` | debuff | earth | 3–5 | target 0 | `apLoss 1, 1 tour, enemy` |
| `serrage_de_boulon` | buff | — | — | target 0 | `shield 12, 2 tours, self` |
| `tole_blindee` | buff | — | — | target 0 | `shield 20, 2 tours, self, breakOnWallPush, wallBreakApLoss 2` |
| `soupe_a_lhuile` | heal | — | heal 12–18 | target 0 | `[]` |
| `jet_de_vapeur` | damage | fire | 8–12 | cross 1 | `[]` |
| `pluie_de_rivets` | damage | fire | 11–16 | circle 1 | `[]` |
| `graissage` | buff | — | — | target 0 | `mpGain 1, 2 tours, ally` |
| `appel_a_la_casse` | summon | — | — | target 0 | `summon, fer_rat_de_cale, maxSummons 2` |

### 2.6 Migration des noms de la fiche

| Fiche | Schéma | Note |
|---|---|---|
| `minValue` / `maxValue` | `damage.min/max` ou `heal.min/max` | `L1198-1204` |
| `maxPerTurn` / `maxPerTarget` | `castsPerTurn` / `castsPerTarget` | déjà dans `SCH:118-119` |
| `effect.duration` | `effect.durationTurns` | **11 occurrences** dans `data/spells.yaml` |
| `element: null` | `null` accepté → `undefined` | 5 sorts (`L1198-1204`) |
| `kind: push_pull` | `kind: damage` + `pushCells` | déjà consommé (`CAST:116`) |
| `zone: {type: cross\|circle, size}` | idem | |

### 2.7 Ce qu'il ne faut **pas** ajouter (YAGNI)

| Champ / variante | Pourquoi non |
|---|---|
| `zone.type: line\|cone\|diagonal\|emptyCenter` | aucun des 9 |
| `effects[].chance` / `dodgeable` | la probabilité est **calculée** (Sagesse) |
| `effects[].stacks` | aucun cumul dans les 9 ; même source = refresh |
| `critHeal` / `critDamage` | aucune valeur dans la fiche (Q4) |
| `shieldPool` | mécanique absente de 1.29 (Q7) |
| `element` sur `shield` | les 9 sont tous-éléments |
| `summon.level/hp/initiative` | dérivés de `monsterSchema` + formules 1.29 |
| `duration` (ancien nom) | un seul nom : `durationTurns` |
| `kind: push_pull` | `damage` + `pushCells` déjà consommé |
| `spell.target` global | le ciblage est par effet et par zone |
| `minValue`/`maxValue`/`maxPerTurn`/`maxPerTarget` | noms de la fiche, pas du moteur |

## 3. Découpage en micro-PR

### PR1 — `feat/spell-effects-schema`
Schéma seul + migration `effect.duration` → `durationTurns` (11 occurrences). Gardes « inertes » : `castSpell` et `getCastableCells` refusent les nouveaux `kind` (identité, PA non dépensés).
**Prouvé** : les 9 fixtures parse ; combinaisons invalides échouent avec le bon chemin ; `data/spells.yaml` (44 sorts) parse toujours ; un `kind: heal` ne peut pas être casté par erreur.
**Encore impossible** : aucun effet consommé ; les 9 sorts absents de `data/spells.yaml`.

### PR2 — `feat/timed-effects`
`TimedEffect`, `expiresAtRound`, `deriveMaxAp`, `deriveMaxMp`, `deriveArmor`, `pruneForSource`.
**Prouvé** : durée par source, plancher 0, cumul/refresh, expiration au début du tour de la source.

### PR3 — `feat/apmp-retrait`
`resolveApMpLoss({ casterWisdom, targetWisdom, remaining, max, points, rng, bonuses })` : tentatives séquentielles, 10–90 %, arrêt à 0, réduction du max et de l'`ap` courant si actif.

### PR4 — `feat/heal-armor`
`computeHeal`, `applyHeal` (cap `maxHp`, pas de résurrection), `deriveArmor`, absorption avant `%res`.

### PR5 — `feat/zone-geometry`
`zoneCells(center, zone, map)`, `affectedTargets`, un seul jet, falloff `ZONE_CENTER_PERCENT = 100`.

### PR6 — `feat/cast-riders`
Intégration dans `cast.ts` : `damage + riders`, `heal` self, `buff` self, `debuff`, `shield`, `zone`. Ajout de **7 sorts** : Crachat, Grignotage, Serrage, Tôle, Graissage, Jet, Pluie.

### PR7 — `feat/push-fidelity`
Diagonale, `cells - travelled`, bloqueurs combattants, `RéPou`, chaîne secondaire, et **jet 1..8 réellement tiré** dans les deux chemins (1v1 et 1vN), au lieu du jet de dégâts réutilisé ou du `0` constant.

### PR8a — `feat/combatants-list`
`CombatState` : `player`/`enemy` → `combatants: CombatantState[]` (adaptateur 1v1 conservé). Aucun changement de comportement ; tous les tests `combatLoop` passent **sans modification d'assertion**.

### PR8b — `feat/summon`
`Soupe` (ciblage allié), `Appel à la Casse`, placement, initiative, PV scalés, IA de l'invocation, ciblage, mort.

### PR9 — `feat/boss-carapace`
Trigger `breakOnWallPush` : si la cible a un shield actif et que la poussée est bloquée par `#`, retirer le shield et appliquer `apLoss 2, durationTurns: 1` **source = pousseur**.

## 4. Cas pièges

| # | Cas | Attendu |
|---|---|---|
| 1 | Zone dont le centre est un mur `#` | cast invalide, PA non dépensés |
| 2 | Mur dans une branche de la croix | branche opposée touchée, pas de troncature |
| 3 | Zone partiellement hors carte | cases hors carte ignorées, pas d'erreur |
| 4 | Cible derrière un mur mais dans la zone | touchée (LoS centre seulement) |
| 5 | `croix 1` vs `cercle 1` | **5 cases chacun** |
| 6 | Deux cibles dans la zone | **même jet** ; dégâts finaux différents par résistances |
| 7 | Cible tuée par les dégâts | **aucun** rider |
| 8 | Rider appliqué après poussée | cible toujours la même entité |
| 9 | Retrait sur cible à 0 PA | aucune tentative, pas de négatif |
| 10 | Retrait qui amène à 0 PA | `max=0`, sorts impossibles, déplacement possible |
| 11 | Retrait pendant le tour de la cible | `ap` courant diminue immédiatement |
| 12 | Retrait après un sort déjà lancé | pas de remboursement |
| 13 | Deux −1 PA successifs | 2e tentative avec `restants` déjà réduit |
| 14 | Retrait appliqué avant le tour du joueur | expire au début du tour du monstre suivant |
| 15 | Bouclier expirant au milieu d'une zone | impossible : expiration au début d'un tour |
| 16 | Bouclier actif, joueur agit avant le boss | bouclier **actif** pendant toute la zone |
| 17 | Bouclier expiré, boss agit avant le joueur | zone **non** absorbée |
| 18 | Bouclier vs poussée | poussée **non** réduite |
| 19 | Bouclier vs dégâts 0 | plancher 0, jamais de soin |
| 20 | Recast du même bouclier | refresh, pas 24 |
| 21 | Cassure du bouclier sur `#` | shield retiré **avant** le −2 PA |
| 22 | Poussée bloquée par un combattant | **pas** de cassure |
| 23 | `−2 PA` sur cible à 1 PA | 0, pas −1 |
| 24 | Soin sur mort | pas de résurrection |
| 25 | Soin au-delà de `maxHp` | cap, surplus perdu |
| 26 | Soin avec Sagesse 0 vs 200 | identique |
| 27 | `Soupe` sur soi | invalide (`minRange: 1`) |
| 28 | Invocation sur case occupée | cast refusé, PA non dépensés |
| 29 | 3e invocation | refus, PA non dépensés |
| 30 | Mort de l'invocateur | invocation persiste ; victoire après sa mort |
| 31 | Mort de l'invocation | retirée de l'ordre, case libérée |
| 32 | Invocation avant son invocateur | elle agit d'abord (initiative) |
| 33 | Invocation contrôlée par le joueur | interdit : IA uniquement |

## 5. Liste ordonnée des PR

1. **PR1** `feat/spell-effects-schema` — schéma + gardes inertes + migration `durationTurns`.
2. **PR2** `feat/timed-effects` — durées, max AP/PM, armure dérivée.
3. **PR3** `feat/apmp-retrait` — retrait séquentiel.
4. **PR4** `feat/heal-armor` — soin + absorption.
5. **PR5** `feat/zone-geometry` — formes, murs, LoS, falloff.
6. **PR6** `feat/cast-riders` — intégration 1v1 + 7 sorts.
7. **PR7** `feat/push-fidelity` — diagonale, distance non parcourue, RéPou, jet 1..8.
8. **PR8a** `feat/combatants-list` — migration N combattants.
9. **PR8b** `feat/summon` — Soupe + Appel.
10. **PR9** `feat/boss-carapace` — cassure du bouclier + −2 PA.

## 6. Tests exacts de la PR1

```ts
const base = {
  id: "test_spell", name: "Test", description: "Test", classId: "monster",
  kind: "damage", apCost: 3, minRange: 1, maxRange: 1, requiresLos: true,
};
const parse = (o: object) => spellSchema.safeParse({ ...base, ...o });
```

| # | Test | Fixture (delta) | Assertion |
|---|---|---|---|
| 1 | `spellSchema — accepte damage + mpLoss` | `element:"water", damage:{min:5,max:8}, effects:[{type:"mpLoss",value:1,durationTurns:1,target:"enemy"}]` | `success === true` ; `data.effects[0]` = `{type:"mpLoss", value:1, durationTurns:1, target:"enemy"}` |
| 2 | `spellSchema — refuse effect et effects simultanés` | `effect:{type:"push",value:1}`, `effects:[{type:"mpLoss",value:1,durationTurns:1}]` | `success === false` ; issue `path:["effects"]` |
| 3 | `spellSchema — refuse mpLoss sans durationTurns` | `effects:[{type:"mpLoss",value:1}]` | `false` ; `path:["effects",0,"durationTurns"]` |
| 4 | `spellSchema — refuse mpLoss avec value 0` | `effects:[{type:"mpLoss",value:0,durationTurns:1}]` | `false` ; `path:["effects",0,"value"]` |
| 5 | `spellSchema — accepte shield self 2 tours` | `kind:"buff", effects:[{type:"shield",value:12,durationTurns:2,target:"self"}]` | `true` ; `data.kind === "buff"`, `data.effects[0].value === 12` |
| 6 | `spellSchema — refuse wallBreakApLoss sans breakOnWallPush` | `kind:"buff", effects:[{type:"shield",value:20,durationTurns:2,target:"self",wallBreakApLoss:2}]` | `false` ; `path:["effects",0,"wallBreakApLoss"]` |
| 7 | `spellSchema — accepte Tôle Blindée complète` | `kind:"buff", effects:[{type:"shield",value:20,durationTurns:2,target:"self",breakOnWallPush:true,wallBreakApLoss:2}]` | `true` ; `breakOnWallPush === true`, `wallBreakApLoss === 2` |
| 8 | `spellSchema — accepte heal 12–18 sans élément` | `kind:"heal", element:null, heal:{min:12,max:18}` | `true` ; `data.element === undefined`, `data.heal.max === 18` |
| 9 | `spellSchema — refuse heal avec damage` | `kind:"heal", heal:{min:12,max:18}, damage:{min:1,max:2}` | `false` ; `path:["damage"]` |
| 10 | `spellSchema — accepte debuff + damage + apLoss` | `kind:"debuff", element:"earth", damage:{min:3,max:5}, effects:[{type:"apLoss",value:1,durationTurns:1,target:"enemy"}]` | `true` |
| 11 | `spellSchema — refuse debuff sans effet négatif` | `kind:"debuff", effects:[{type:"shield",value:5,durationTurns:1,target:"self"}]` | `false` ; `path:["effects"]` |
| 12 | `spellSchema — accepte zone croix 1` | `zone:{type:"cross",size:1}` | `true` ; `data.zone` = `{type:"cross", size:1}` |
| 13 | `spellSchema — applique zone target 0 par défaut` | aucun `zone` | `true` ; `data.zone` = `{type:"target", size:0}` |
| 14 | `spellSchema — refuse cross de taille 0` | `zone:{type:"cross",size:0}` | `false` ; `path:["zone","size"]` |
| 15 | `spellSchema — refuse un champ inconnu minValue` | `minValue:5` | `false` ; issue `code:"unrecognized_keys"`, `keys` contient `"minValue"` |
| 16 | `spellSchema — accepte summon maxSummons 2` | `kind:"summon", effects:[{type:"summon",summonMonsterId:"fer_rat_de_cale",maxSummons:2,target:"cell"}]` | `true` ; `data.effects[0].maxSummons === 2` |
| 17 | `spellSchema — applique maxSummons 1 par défaut` | même sans `maxSummons` | `true` ; `data.effects[0].maxSummons === 1` |
| 18 | `spellSchema — refuse summon sans summonMonsterId` | `effects:[{type:"summon"}]` | `false` ; `path:["effects",0,"summonMonsterId"]` |
| 19 | `spellSchema — refuse deux effets summon` | `effects:[{type:"summon",summonMonsterId:"a"},{type:"summon",summonMonsterId:"b"}]` | `false` ; `path:["effects"]` |
| 20 | `spellSchema — refuse duration (ancien nom)` | `effect:{type:"buff",value:1,duration:2}` | `false` ; `code:"unrecognized_keys"`, `keys` contient `"duration"` |
| 21 | `spellSchema — data/spells.yaml reste valide` | `parseSpellsYaml(readFileSync("data/spells.yaml","utf8"))` | ne lève pas ; 44 sorts ; ids uniques |
| 22 | `castSpell — un kind heal est inerte` | état avec un sort `kind:"heal"` | `castSpell(...) === state` (même référence) ; PA inchangés |
| 23 | `getCastableCells — un kind buff est inerte` | état avec un sort `kind:"buff"` | `[]` |
