# L'Île de la Ferraille — spec de design

Tranche de niveaux 1–20 · slug court `fer_` · Navire-Base non requis (zone de départ) · amélioration débloquée `fer_voiles_fortune_de_pot` · dossier fourni par l'utilisateur le 2026-11-22, transcrit sans modification de valeurs.

> Statut : spécification de référence, NON implémentée. Cible : Vague 6 (données) et Vague 7 (contenu complet). Voir la section « Écarts avec le modèle de données actuel » avant toute implémentation.

## 1. Résumé

L'Île de la Ferraille est un lagon de mazout où les épaves de la Coupure se sont empilées jusqu'à former un sol praticable. La Confrérie des Vis-Sans-Fin y règne sur un marché de boulons, de tôles et de dettes, avec la conviction tranquille que tout se répare. Yvon Rouiller, son chef de chantier autoproclamé, est persuadé qu'un boulon géant retient l'océan et refuse catégoriquement qu'on y touche. Autour de lui, crabes à clef à molette, marmites fuyardes et rats nourris au mazout défendent l'idée qu'un boulon bien serré vaut mieux qu'une explication.

## 2. Bestiaire

| ID | Nom | Niv. | PV | PA/PM | Archétype IA | Drops notables |
| --- | --- | --- | --- | --- | --- | --- |
| `piou_mazoute` | Piou Mazouté | 3 | 35 | 5/4 | `ranged_kiter` | `plume_mazoutee`, `fer_anneau_mazoute` |
| `fer_rat_de_cale` | Rat d'Égoût-dron | 6 | 52 | 5/3 | `melee_rusher` | `fer_dent_rouillee`, `fer_queue_caoutchouc` |
| `fer_crabe_cle_molette` | Crabe à Clé-à-Molette | 9 | 75 | 5/3 | `tank_tackler` | `fer_pince_de_douze`, `fer_carapace_tole` |
| `fer_marmite_fuyarde` | Marmite qui Fuit | 12 | 85 | 6/3 | `support_healer` | `fer_couvercle_cabosse`, `fer_huile_de_coude` |
| `fer_boulon_pousseur` | Écrou-Baton | 15 | 105 | 6/3 | `pusher_control` | `fer_boulon_sans_fin`, `fer_ressort_tendu` |
| `fer_boss_yvon_rouiller` | Yvon Rouiller (Boss) | 20 | 140 | 6/4 | `boss_custom` | `fer_ecrou_sacre_yvon`, `fer_fruit_coup_de_boulon` |

### `piou_mazoute`

```yaml
id: piou_mazoute
name: Piou Mazouté
description: "Un oiseau de mer à moitié carbonisé qui réclame des dommages et intérêts à chaque vague, et à la mer en général."
level: 3
isBoss: false
hp: 35
pa: 5
pm: 4
baseXp: 28
kamasMin: 4
kamasMax: 10
stats:
  strength: 5
  intelligence: 5
  chance: 15
  agility: 20
  wisdom: 5
resistances:
  flat: { neutral: 0, earth: 0, fire: 0, water: 1, air: 1 }
  percent: { neutral: 0, earth: 0, fire: -10, water: 10, air: 5 }
spellIds: [fer_spell_crachat_mazout, fer_spell_coup_daile_gras]
ai:
  archetype: ranged_kiter
  preferredDistance: 4
  behaviorRules:
    - "Reste à 4 cases ou plus et recule d'une case après chaque tir."
    - "Ne tire jamais sans ligne de vue : se repositionne d'abord, quitte à perdre un tour."
    - "Ignore les cibles à plus de 4 cases et se rapproche jusqu'à portée."
drops:
  - { itemId: plume_mazoutee, baseDropRate: 0.70, ppThreshold: 100 }
  - { itemId: fer_goutte_mazout, baseDropRate: 0.45, ppThreshold: 100 }
  - { itemId: fer_toile_sac_poisseuse, baseDropRate: 0.18, ppThreshold: 100 }
  - { itemId: fer_anneau_mazoute, baseDropRate: 0.02, ppThreshold: 100 }
```

### `fer_rat_de_cale`

```yaml
id: fer_rat_de_cale
name: Rat d'Égoût-dron
description: "Rat de cale nourri au mazout et à la rancune. Il a déjà rongé trois câbles, un contrat de fret et un traité de paix."
level: 6
isBoss: false
hp: 52
pa: 5
pm: 3
baseXp: 55
kamasMin: 8
kamasMax: 18
stats:
  strength: 22
  intelligence: 5
  chance: 10
  agility: 15
  wisdom: 10
resistances:
  flat: { neutral: 1, earth: 1, fire: 0, water: 0, air: 0 }
  percent: { neutral: 5, earth: 5, fire: -5, water: 0, air: -5 }
spellIds: [fer_spell_morsure_tetanos, fer_spell_grignotage_cable]
ai:
  archetype: melee_rusher
  preferredDistance: 1
  behaviorRules:
    - "Fonce sur la cible la plus faible en PV qu'il peut atteindre ce tour."
    - "Réserve Grignotage de Câble pour un ennemi qui n'a plus que 2 PA."
    - "Ne recule jamais, même à 1 PV."
drops:
  - { itemId: fer_dent_rouillee, baseDropRate: 0.65, ppThreshold: 100 }
  - { itemId: fer_goutte_mazout, baseDropRate: 0.40, ppThreshold: 100 }
  - { itemId: fer_queue_caoutchouc, baseDropRate: 0.22, ppThreshold: 100 }
```

### `fer_crabe_cle_molette`

```yaml
id: fer_crabe_cle_molette
name: Crabe à Clé-à-Molette
description: "Crabe dont une pince a été remplacée par une clef à molette. Personne ne sait par qui, et personne ne tient à demander."
level: 9
isBoss: false
hp: 75
pa: 5
pm: 3
baseXp: 90
kamasMin: 12
kamasMax: 26
stats:
  strength: 32
  intelligence: 5
  chance: 15
  agility: 22
  wisdom: 10
resistances:
  flat: { neutral: 2, earth: 2, fire: 0, water: 1, air: 0 }
  percent: { neutral: 10, earth: 10, fire: -10, water: 5, air: 0 }
spellIds: [fer_spell_pince_de_douze, fer_spell_serrage_de_boulon]
ai:
  archetype: tank_tackler
  preferredDistance: 1
  behaviorRules:
    - "Avance vers la cible la plus proche et se colle à elle pour la tacler."
    - "Garde Serrage de Boulon pour lui-même sous 50 % de PV."
    - "Préfère bloquer un couloir plutôt que frapper fort."
drops:
  - { itemId: fer_pince_de_douze, baseDropRate: 0.60, ppThreshold: 100 }
  - { itemId: fer_carapace_tole, baseDropRate: 0.28, ppThreshold: 100 }
```

### `fer_marmite_fuyarde`

```yaml
id: fer_marmite_fuyarde
name: Marmite qui Fuit
description: "Marmite de cantine ayant pris la fuite après un procès en empoisonnement. Elle fuit toujours, et elle cuisine toujours."
level: 12
isBoss: false
hp: 85
pa: 6
pm: 3
baseXp: 130
kamasMin: 18
kamasMax: 35
stats:
  strength: 10
  intelligence: 40
  chance: 15
  agility: 10
  wisdom: 15
resistances:
  flat: { neutral: 1, earth: 0, fire: 2, water: 0, air: 0 }
  percent: { neutral: 0, earth: 0, fire: 15, water: -10, air: 0 }
spellIds: [fer_spell_soupe_a_lhuile, fer_spell_jet_de_vapeur, fer_spell_coup_de_couvercle]
ai:
  archetype: support_healer
  preferredDistance: 4
  behaviorRules:
    - "Reste à 3–4 cases derrière la première ligne alliée."
    - "Soigne l'allié le plus blessé en priorité, sans exigence de ligne de vue."
    - "Lance Jet de Vapeur dès que deux ennemis sont adjacents."
drops:
  - { itemId: fer_couvercle_cabosse, baseDropRate: 0.58, ppThreshold: 100 }
  - { itemId: fer_toile_sac_poisseuse, baseDropRate: 0.30, ppThreshold: 100 }
  - { itemId: fer_huile_de_coude, baseDropRate: 0.14, ppThreshold: 110 }
```

### `fer_boulon_pousseur`

```yaml
id: fer_boulon_pousseur
name: Écrou-Baton
description: "Un écrou de la taille d'un homme, doué de parole syndicale et d'un sens très développé de l'injustice salariale."
level: 15
isBoss: false
hp: 105
pa: 6
pm: 3
baseXp: 185
kamasMin: 24
kamasMax: 45
stats:
  strength: 45
  intelligence: 10
  chance: 10
  agility: 18
  wisdom: 15
resistances:
  flat: { neutral: 2, earth: 2, fire: 0, water: 0, air: 1 }
  percent: { neutral: 5, earth: 10, fire: 0, water: -5, air: 5 }
spellIds: [fer_spell_coup_de_tete_filete, fer_spell_lancer_decrou, fer_spell_graissage]
ai:
  archetype: pusher_control
  preferredDistance: 1
  behaviorRules:
    - "Cherche une cible dos à un mur `#` avant de pousser."
    - "Graisse un allié de première ligne avant de frapper."
    - "Priorise les cibles déjà collées à un obstacle."
drops:
  - { itemId: fer_boulon_sans_fin, baseDropRate: 0.65, ppThreshold: 100 }
  - { itemId: fer_ressort_tendu, baseDropRate: 0.30, ppThreshold: 100 }
  - { itemId: fer_carapace_tole, baseDropRate: 0.25, ppThreshold: 100 }
```

### `fer_boss_yvon_rouiller`

```yaml
id: fer_boss_yvon_rouiller
name: Yvon Rouiller
description: "Chef de chantier autoproclamé de La Ferraille. Persuadé qu'un boulon géant retient l'océan, il refuse de le desserrer, même pour dormir."
level: 20
isBoss: true
hp: 140
pa: 6
pm: 4
baseXp: 480
kamasMin: 85
kamasMax: 140
stats:
  strength: 60
  intelligence: 35
  chance: 20
  agility: 25
  wisdom: 25
resistances:
  flat: { neutral: 3, earth: 3, fire: 2, water: 0, air: 1 }
  percent: { neutral: 10, earth: 15, fire: 10, water: -10, air: 5 }
spellIds:
  - fer_spell_clef_a_choc
  - fer_spell_pluie_de_rivets
  - fer_spell_tole_blindee
  - fer_spell_appel_a_la_casse
ai:
  archetype: boss_custom
  preferredDistance: 2
  behaviorRules:
    - "Ouvre par Tôle Blindée au tour 1, puis avance vers la cible la plus proche."
    - "Clef à Choc sert à projeter une cible contre un mur `#` tant que le bouclier est actif : bouclier dissipé et −2 PA au prochain tour."
    - "Appel à la Casse dès qu'il tombe sous 50 % de PV ou qu'il reste au plus deux assaillants."
    - "Ne s'éloigne jamais de plus de 2 cases de l'enclume ; sans poussée, son point faible est l'Eau (−10 % de résistance)."
drops:
  - { itemId: fer_ecrou_sacre_yvon, baseDropRate: 0.80, ppThreshold: 100 }
  - { itemId: fer_huile_de_coude, baseDropRate: 0.45, ppThreshold: 100 }
  - { itemId: fer_casque_chantier_cabosse, baseDropRate: 0.05, ppThreshold: 120 }
  - { itemId: fer_fruit_coup_de_boulon, baseDropRate: 0.04, ppThreshold: 150 }
```

**`bossMechanic`** — Carapace Oxydée : Tôle Blindée (+20 bouclier, 2 tours). Dégâts de poussée contre un mur `#` pendant que le bouclier est actif ⇒ bouclier dissipé + perte de 2 PA au prochain tour. Sans poussée, −10 % résistance Eau = point faible.

Règles de comportement résumées :

1. Tour 1 : Tôle Blindée, puis avancée contrôlée vers la cible la plus proche.
2. Bouclier actif : cherche systématiquement la poussée contre un mur.
3. Sous 50 % de PV ou ≤ 2 assaillants : Appel à la Casse.
4. Ne s'éloigne jamais de plus de 2 cases de l'enclume ; l'Eau reste son point faible.

## 3. Sorts des monstres

| ID | Nom | PA | Portée | Zone | Effet |
| --- | --- | --- | --- | --- | --- |
| `fer_spell_crachat_mazout` | Crachat Mazouté | 3 | 1–4 | Cible | 5–8 Eau + −1 PM |
| `fer_spell_coup_daile_gras` | Coup d'Aile Gras | 3 | 1–1 | Cible | 4–6 Air + poussée 1 |
| `fer_spell_morsure_tetanos` | Morsure Tétanos | 3 | 1–1 | Cible | 7–10 Neutre |
| `fer_spell_grignotage_cable` | Grignotage de Câble | 2 | 1–1 | Cible | 3–5 Terre + −1 PA |
| `fer_spell_pince_de_douze` | Pince de Douze | 3 | 1–1 | Cible | 9–13 Terre |
| `fer_spell_serrage_de_boulon` | Serrage de Boulon | 2 | 0–0 | Cible | +12 bouclier 2 tours |
| `fer_spell_soupe_a_lhuile` | Soupe à l'Huile | 3 | 1–4 sans LoS | Cible | soin 12–18 |
| `fer_spell_jet_de_vapeur` | Jet de Vapeur | 3 | 1–3 | Croix 1 | 8–12 Feu |
| `fer_spell_coup_de_couvercle` | Coup de Couvercle | 3 | 1–1 | Cible | 6–9 Neutre + poussée 2 |
| `fer_spell_coup_de_tete_filete` | Coup de Tête Fileté | 3 | 1–1 | Cible | 10–14 Terre + poussée 2 |
| `fer_spell_lancer_decrou` | Lancer d'Écrou | 3 | 2–4 | Cible | 9–12 Neutre |
| `fer_spell_graissage` | Graissage | 2 | 0–3 | Cible | +1 PM 2 tours |
| `fer_spell_clef_a_choc` | Clef à Choc | 3 | 1–1 | Cible | 14–19 Terre + poussée 3 |
| `fer_spell_pluie_de_rivets` | Pluie de Rivets | 4 | 2–5 sans LoS | Cercle 1 | 11–16 Feu |
| `fer_spell_tole_blindee` | Tôle Blindée | 2 | 0–0 | Cible | +20 bouclier 2 tours, cassable sur `#` (−2 PA) |
| `fer_spell_appel_a_la_casse` | Appel à la Casse | 4 | 1–3 | Cible | invoque `fer_rat_de_cale` |

```yaml
id: fer_spell_crachat_mazout
name: Crachat Mazouté
apCost: 3
minRange: 1
maxRange: 4
requiresLos: true
cooldown: 0
maxPerTurn: 1
maxPerTarget: 1
zone: { type: target, size: 0 }
kind: damage
element: water
minValue: 5
maxValue: 8
effects:
  - { type: pmLoss, value: 1, durationTurns: 1 }
```

```yaml
id: fer_spell_coup_daile_gras
name: Coup d'Aile Gras
apCost: 3
minRange: 1
maxRange: 1
requiresLos: true
cooldown: 1
maxPerTurn: 1
maxPerTarget: 1
zone: { type: target, size: 0 }
kind: push_pull
element: air
minValue: 4
maxValue: 6
effects:
  - { type: pushCells, value: 1 }
```

```yaml
id: fer_spell_morsure_tetanos
name: Morsure Tétanos
apCost: 3
minRange: 1
maxRange: 1
requiresLos: true
cooldown: 0
maxPerTurn: 2
maxPerTarget: 2
zone: { type: target, size: 0 }
kind: damage
element: neutral
minValue: 7
maxValue: 10
effects: []
```

```yaml
id: fer_spell_grignotage_cable
name: Grignotage de Câble
apCost: 2
minRange: 1
maxRange: 1
requiresLos: true
cooldown: 1
maxPerTurn: 1
maxPerTarget: 1
zone: { type: target, size: 0 }
kind: debuff
element: earth
minValue: 3
maxValue: 5
effects:
  - { type: apLoss, value: 1, durationTurns: 1 }
```

```yaml
id: fer_spell_pince_de_douze
name: Pince de Douze
apCost: 3
minRange: 1
maxRange: 1
requiresLos: true
cooldown: 0
maxPerTurn: 2
maxPerTarget: 2
zone: { type: target, size: 0 }
kind: damage
element: earth
minValue: 9
maxValue: 13
effects: []
```

```yaml
id: fer_spell_serrage_de_boulon
name: Serrage de Boulon
apCost: 2
minRange: 0
maxRange: 0
requiresLos: false
cooldown: 3
maxPerTurn: 1
maxPerTarget: 1
zone: { type: target, size: 0 }
kind: buff
element: null
minValue: 12
maxValue: 12
effects:
  - { type: shield, value: 12, durationTurns: 2 }
```

```yaml
id: fer_spell_soupe_a_lhuile
name: Soupe à l'Huile
apCost: 3
minRange: 1
maxRange: 4
requiresLos: false
cooldown: 1
maxPerTurn: 1
maxPerTarget: 1
zone: { type: target, size: 0 }
kind: heal
element: null
minValue: 12
maxValue: 18
effects:
  - { type: heal, value: 12 }
```

```yaml
id: fer_spell_jet_de_vapeur
name: Jet de Vapeur
apCost: 3
minRange: 1
maxRange: 3
requiresLos: true
cooldown: 0
maxPerTurn: 2
maxPerTarget: 1
zone: { type: cross, size: 1 }
kind: damage
element: fire
minValue: 8
maxValue: 12
effects: []
```

```yaml
id: fer_spell_coup_de_couvercle
name: Coup de Couvercle
apCost: 3
minRange: 1
maxRange: 1
requiresLos: true
cooldown: 2
maxPerTurn: 1
maxPerTarget: 1
zone: { type: target, size: 0 }
kind: push_pull
element: neutral
minValue: 6
maxValue: 9
effects:
  - { type: pushCells, value: 2 }
```

```yaml
id: fer_spell_coup_de_tete_filete
name: Coup de Tête Fileté
apCost: 3
minRange: 1
maxRange: 1
requiresLos: true
cooldown: 0
maxPerTurn: 1
maxPerTarget: 1
zone: { type: target, size: 0 }
kind: push_pull
element: earth
minValue: 10
maxValue: 14
effects:
  - { type: pushCells, value: 2 }
```

```yaml
id: fer_spell_lancer_decrou
name: Lancer d'Écrou
apCost: 3
minRange: 2
maxRange: 4
requiresLos: true
cooldown: 0
maxPerTurn: 2
maxPerTarget: 2
zone: { type: target, size: 0 }
kind: damage
element: neutral
minValue: 9
maxValue: 12
effects: []
```

```yaml
id: fer_spell_graissage
name: Graissage
apCost: 2
minRange: 0
maxRange: 3
requiresLos: true
cooldown: 2
maxPerTurn: 1
maxPerTarget: 1
zone: { type: target, size: 0 }
kind: buff
element: null
minValue: 1
maxValue: 1
effects:
  - { type: mpGain, value: 1, durationTurns: 2 }
```

```yaml
id: fer_spell_clef_a_choc
name: Clef à Choc
apCost: 3
minRange: 1
maxRange: 1
requiresLos: true
cooldown: 1
maxPerTurn: 1
maxPerTarget: 1
zone: { type: target, size: 0 }
kind: push_pull
element: earth
minValue: 14
maxValue: 19
effects:
  - { type: pushCells, value: 3 }
```

```yaml
id: fer_spell_pluie_de_rivets
name: Pluie de Rivets
apCost: 4
minRange: 2
maxRange: 5
requiresLos: false
cooldown: 1
maxPerTurn: 1
maxPerTarget: 1
zone: { type: circle, size: 1 }
kind: damage
element: fire
minValue: 11
maxValue: 16
effects: []
```

```yaml
id: fer_spell_tole_blindee
name: Tôle Blindée
apCost: 2
minRange: 0
maxRange: 0
requiresLos: false
cooldown: 3
maxPerTurn: 1
maxPerTarget: 1
zone: { type: target, size: 0 }
kind: buff
element: null
minValue: 20
maxValue: 20
effects:
  - { type: shield, value: 20, durationTurns: 2, breakOnWallPush: true, wallBreakApLoss: 2 }
```

```yaml
id: fer_spell_appel_a_la_casse
name: Appel à la Casse
apCost: 4
minRange: 1
maxRange: 3
requiresLos: true
cooldown: 4
maxPerTurn: 1
maxPerTarget: 1
zone: { type: target, size: 0 }
kind: summon
element: null
minValue: 0
maxValue: 0
effects:
  - { type: summon, summonMonsterId: fer_rat_de_cale, maxSummons: 2 }
```

## 4. Ressources, consommables, clé, amélioration

### 4.1 Ressources (12)

```yaml
- id: plume_mazoutee
  name: Plume Mazoutée
  category: resource
  rarity: common
  sellValue: 3
  description: "Plume lourde et noire, qui tache les doigts et les réputations."
- id: fer_goutte_mazout
  name: Goutte de Mazout Durcie
  category: resource
  rarity: common
  sellValue: 4
  description: "Une larme de mazout assez vieille pour être devenue solide. On la brûle, on la boit, on la marchande : jamais dans cet ordre."
- id: fer_dent_rouillee
  name: Dent Rouillée
  category: resource
  rarity: common
  sellValue: 5
  description: "Dent de rat de cale. Rouillée, ce qui, dans ce commerce, vaut certificat d'authenticité."
- id: fer_queue_caoutchouc
  name: Queue en Caoutchouc
  category: resource
  rarity: uncommon
  sellValue: 12
  description: "Élastique, increvable, légèrement vindicative. Les gamins de La Ferraille s'en servent de fronde et les charpentiers de joint."
- id: fer_pince_de_douze
  name: Pince de Douze
  category: resource
  rarity: common
  sellValue: 8
  description: "Pince sectionnée sur un crabe. Elle serre encore toute seule quand on la pose sur l'établi."
- id: fer_carapace_tole
  name: Carapace de Tôle
  category: resource
  rarity: uncommon
  sellValue: 16
  description: "Morceau de tôle bombée, rayé de coups de clef, qui a manifestement servi de logement à quelque chose d'irritable."
- id: fer_couvercle_cabosse
  name: Couvercle Cabossé
  category: resource
  rarity: common
  sellValue: 10
  description: "Couvercle de marmite fuyarde, cabossé de l'intérieur. La Confrérie refuse d'expliquer pourquoi."
- id: fer_huile_de_coude
  name: Huile de Coude
  category: resource
  rarity: rare
  sellValue: 35
  description: "Flacon trouble, vendu sous étiquette médicale. À La Ferraille, on graisse les mécanismes et on graisse les gens."
- id: fer_boulon_sans_fin
  name: Boulon Sans Fin
  category: resource
  rarity: common
  sellValue: 12
  description: "Boulon fileté sans tête ni écrou. La Confrérie en a fait son emblème, puis son dieu, puis son tarif."
- id: fer_ressort_tendu
  name: Ressort Tendu
  category: resource
  rarity: uncommon
  sellValue: 20
  description: "Ressort qui a gardé toute son énergie. Il attend son heure, probablement dans une poche."
- id: fer_toile_sac_poisseuse
  name: Toile de Sac Poisseuse
  category: resource
  rarity: uncommon
  sellValue: 14
  description: "Toile de sac à mazout, rigide de crasse. Imputrescible, infroissable, insupportable."
- id: fer_ecrou_sacre_yvon
  name: Écrou Sacré d'Yvon
  category: resource
  rarity: rare
  sellValue: 80
  description: "Écrou d'octogone, béni par Yvon dans un rituel que nul témoin n'a jugé bon de contredire. Sert de monnaie dans tout l'atelier."
```

### 4.2 Consommables (2)

```yaml
- id: fer_sandwich_sardine_rouillee
  name: Sandwich à la Sardine Rouillée
  category: consumable
  rarity: common
  sellValue: 15
  healHp: 45
  description: "Pain, sardine, un soupçon de rouille. Le goût métallique est présenté comme un apport en fer."
- id: fer_grog_au_degrippant
  name: Grog au Dégrippant
  category: consumable
  rarity: uncommon
  sellValue: 32
  healHp: 90
  description: "Boisson chaude, dégrippante, servie avec une paille. Déconseillée aux mécanismes sensibles et aux matelots qui tiennent debout."
```

### 4.3 Clé de donjon (1)

```yaml
- id: cle_donjon_ile_de_la_ferraille
  name: Clef de la Casse aux Vis-Sans-Fin
  category: key
  rarity: uncommon
  sellValue: 40
  targetDungeonId: fer_donjon_casse_vis_sans_fin
  description: "Une clef à molette géante, tordue à la main. Elle n'ouvre aucune porte de la Casse, mais tout le monde la présente à l'entrée par respect pour la coutume."
```

### 4.4 Amélioration de navire (1)

```yaml
- id: fer_voiles_fortune_de_pot
  name: Voiles de Fortune-de-Pot
  category: shipUpgrade
  rarity: rare
  sellValue: 0
  unlocksIsland: terres_du_sel_a_vie
  description: "Voiles cousues dans des sacs de mazout, tendues sur des espars récupérés. Elles avancent par superstition plus que par vent, et débloquent la route des Terres du Sel-à-Vie."
```

## 5. Armes

| ID | Nom | Type | Niv. | PA | Portée | CC (taux/bonus) | Dégâts | Stats | Condition |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `fer_dague_ouvre_boite` | Dague Ouvre-Boîte | `dagger` | 9 | 3 | 1–1 | 30 % / +5 | Air 7–11 | Agi 8–16, Crit 1–2, Init 20–50 | Agilité ≥ 20 |
| `fer_baguette_soudeur` | Baguette du Soudeur | `wand` | 12 | 4 | 2–4 | 40 % / +6 | Feu 9–14 | Int 10–18, Sag 5–10, Dégâts fixes 1–2 | Intelligence ≥ 25 |
| `fer_marteau_cle_de_douze` | Marteau Clef-de-Douze | `hammer` | 15 | 4 | 1–1 | 45 % / +7 | Terre 11–16 + Neutre 4–6 | Force 12–22, Vita 10–20 | Force ≥ 30 |
| `fer_pelle_a_gravats` | Pelle à Gravats | `shovel` | 17 | 4 | 1–1 | 40 % / +6 | Eau 12–18 (vol de vie) | Chance 12–22, PP 6–12, Vita 8–15 | Chance ≥ 30 |

```yaml
id: fer_dague_ouvre_boite
name: Dague Ouvre-Boîte
weaponType: dagger
level: 9
apCost: 3
minRange: 1
maxRange: 1
critRate: 30
critBonus: 5
damageLines:
  - { element: air, min: 7, max: 11 }
stats:
  agility: { min: 8, max: 16 }
  crit: { min: 1, max: 2 }
  initiative: { min: 20, max: 50 }
conditions:
  - { stat: agility, min: 20 }
```

```yaml
id: fer_baguette_soudeur
name: Baguette du Soudeur
weaponType: wand
level: 12
apCost: 4
minRange: 2
maxRange: 4
critRate: 40
critBonus: 6
damageLines:
  - { element: fire, min: 9, max: 14 }
stats:
  intelligence: { min: 10, max: 18 }
  wisdom: { min: 5, max: 10 }
  flatDamage: { min: 1, max: 2 }
conditions:
  - { stat: intelligence, min: 25 }
```

```yaml
id: fer_marteau_cle_de_douze
name: Marteau Clef-de-Douze
weaponType: hammer
level: 15
apCost: 4
minRange: 1
maxRange: 1
critRate: 45
critBonus: 7
damageLines:
  - { element: earth, min: 11, max: 16 }
  - { element: neutral, min: 4, max: 6 }
stats:
  strength: { min: 12, max: 22 }
  vitality: { min: 10, max: 20 }
conditions:
  - { stat: strength, min: 30 }
```

```yaml
id: fer_pelle_a_gravats
name: Pelle à Gravats
weaponType: shovel
level: 17
apCost: 4
minRange: 1
maxRange: 1
critRate: 40
critBonus: 6
damageLines:
  - { element: water, min: 12, max: 18, lifesteal: true }
stats:
  chance: { min: 12, max: 22 }
  prospection: { min: 6, max: 12 }
  vitality: { min: 8, max: 15 }
conditions:
  - { stat: chance, min: 30 }
```

## 6. Équipements et panoplies

| Pièce | Nom | Slot | Niv. | Panoplie |
| --- | --- | --- | --- | --- |
| `fer_anneau_mazoute` | Anneau Mazouté | ring | 7 | Goudron-et-Plumes |
| `fer_ceinture_goudron` | Ceinture de Goudron | belt | 8 | Goudron-et-Plumes |
| `fer_cape_plumes_mazoutees` | Cape de Plumes Mazoutées | cloak | 9 | Goudron-et-Plumes |
| `fer_coiffe_goudron` | Coiffe de Goudron | hat | 10 | Goudron-et-Plumes |
| `fer_bottes_goudron` | Bottes de Goudron | boots | 10 | Goudron-et-Plumes |
| `fer_amulette_ecrou_geante` | Amulette à l'Écrou Géant | amulet | 16 | Brico-Lourd |
| `fer_cape_bache_trouee` | Cape Bâche Trouée | cloak | 17 | Brico-Lourd |
| `fer_ceinture_outils_rouilles` | Ceinture à Outils Rouillés | belt | 17 | Brico-Lourd |
| `fer_casque_chantier_cabosse` | Casque de Chantier Cabossé | hat | 18 | Brico-Lourd |
| `fer_bottes_securite_fer` | Bottes de Sécurité en Fer | boots | 18 | Brico-Lourd |
| `fer_amulette_bouillon_fer` | Amulette du Bouillon de Fer | amulet | 11 | hors-panoplie |
| `fer_anneau_rondelle_chance` | Anneau Rondelle-de-Chance | ring | 13 | hors-panoplie |
| `fer_coiffe_passoire_sage` | Coiffe Passoire-de-Sagesse | hat | 15 | hors-panoplie |

```yaml
- id: fer_anneau_mazoute
  name: Anneau Mazouté
  slot: ring
  level: 7
  setId: fer_set_goudron_plumes
  stats:
    agility: { min: 6, max: 12 }
    initiative: { min: 15, max: 35 }
- id: fer_ceinture_goudron
  name: Ceinture de Goudron
  slot: belt
  level: 8
  setId: fer_set_goudron_plumes
  stats:
    agility: { min: 8, max: 15 }
    vitality: { min: 6, max: 12 }
    crit: { min: 1, max: 2 }
- id: fer_cape_plumes_mazoutees
  name: Cape de Plumes Mazoutées
  slot: cloak
  level: 9
  setId: fer_set_goudron_plumes
  stats:
    agility: { min: 10, max: 18 }
    vitality: { min: 8, max: 15 }
    flatDamage: { min: 1, max: 2 }
- id: fer_coiffe_goudron
  name: Coiffe de Goudron
  slot: hat
  level: 10
  setId: fer_set_goudron_plumes
  stats:
    agility: { min: 12, max: 20 }
    vitality: { min: 10, max: 18 }
    crit: { min: 1, max: 2 }
- id: fer_bottes_goudron
  name: Bottes de Goudron
  slot: boots
  level: 10
  setId: fer_set_goudron_plumes
  stats:
    agility: { min: 10, max: 18 }
    vitality: { min: 8, max: 16 }
    initiative: { min: 25, max: 50 }
- id: fer_amulette_ecrou_geante
  name: Amulette à l'Écrou Géant
  slot: amulet
  level: 16
  setId: fer_set_brico_lourd
  stats:
    strength: { min: 10, max: 18 }
    vitality: { min: 12, max: 22 }
    flatDamage: { min: 1, max: 2 }
- id: fer_cape_bache_trouee
  name: Cape Bâche Trouée
  slot: cloak
  level: 17
  setId: fer_set_brico_lourd
  stats:
    strength: { min: 12, max: 20 }
    vitality: { min: 12, max: 22 }
    percentDamage: { min: 5, max: 10 }
- id: fer_ceinture_outils_rouilles
  name: Ceinture à Outils Rouillés
  slot: belt
  level: 17
  setId: fer_set_brico_lourd
  stats:
    strength: { min: 12, max: 22 }
    vitality: { min: 10, max: 20 }
    flatDamage: { min: 1, max: 3 }
- id: fer_casque_chantier_cabosse
  name: Casque de Chantier Cabossé
  slot: hat
  level: 18
  setId: fer_set_brico_lourd
  stats:
    strength: { min: 15, max: 24 }
    vitality: { min: 15, max: 25 }
- id: fer_bottes_securite_fer
  name: Bottes de Sécurité en Fer
  slot: boots
  level: 18
  setId: fer_set_brico_lourd
  stats:
    strength: { min: 14, max: 22 }
    vitality: { min: 14, max: 24 }
    flatDamage: { min: 1, max: 2 }
- id: fer_amulette_bouillon_fer
  name: Amulette du Bouillon de Fer
  slot: amulet
  level: 11
  setId: null
  stats:
    intelligence: { min: 12, max: 22 }
    vitality: { min: 8, max: 16 }
    flatDamage: { min: 1, max: 2 }
- id: fer_anneau_rondelle_chance
  name: Anneau Rondelle-de-Chance
  slot: ring
  level: 13
  setId: null
  stats:
    chance: { min: 10, max: 20 }
    prospection: { min: 8, max: 15 }
- id: fer_coiffe_passoire_sage
  name: Coiffe Passoire-de-Sagesse
  slot: hat
  level: 15
  setId: null
  stats:
    wisdom: { min: 12, max: 22 }
    vitality: { min: 10, max: 18 }
```

```yaml
- id: fer_set_goudron_plumes
  name: Panoplie Goudron-et-Plumes
  pieceIds:
    - fer_anneau_mazoute
    - fer_ceinture_goudron
    - fer_cape_plumes_mazoutees
    - fer_coiffe_goudron
    - fer_bottes_goudron
  bonusesByCount:
    2: { agility: 10, vitality: 10 }
    3: { agility: 20, vitality: 15, crit: 2 }
    4: { agility: 30, vitality: 25, crit: 3, initiative: 50 }
    5: { agility: 40, vitality: 35, crit: 4, pm: 1 }
- id: fer_set_brico_lourd
  name: Panoplie Brico-Lourd
  pieceIds:
    - fer_amulette_ecrou_geante
    - fer_cape_bache_trouee
    - fer_ceinture_outils_rouilles
    - fer_casque_chantier_cabosse
    - fer_bottes_securite_fer
  bonusesByCount:
    2: { strength: 10, vitality: 15 }
    3: { strength: 20, vitality: 25, flatDamage: 2 }
    4: { strength: 30, vitality: 40, flatDamage: 4 }
    5: { strength: 45, vitality: 55, flatDamage: 5, pa: 1 }
```

## 7. Recettes de craft (22)

```text
cle_donjon_ile_de_la_ferraille ← fer_pince_de_douze×3, fer_boulon_sans_fin×3, fer_goutte_mazout×2
fer_sandwich_sardine_rouillee ← fer_dent_rouillee×2, fer_goutte_mazout×1
fer_grog_au_degrippant ← fer_goutte_mazout×2, fer_couvercle_cabosse×1, fer_huile_de_coude×1
fer_voiles_fortune_de_pot ← fer_ecrou_sacre_yvon×1, fer_toile_sac_poisseuse×6, fer_ressort_tendu×4, fer_huile_de_coude×2
fer_fruit_coup_de_boulon ← fer_ecrou_sacre_yvon×5, fer_huile_de_coude×4, fer_ressort_tendu×6, fer_boulon_sans_fin×10
fer_anneau_mazoute ← plume_mazoutee×4, fer_goutte_mazout×3
fer_ceinture_goudron ← plume_mazoutee×5, fer_queue_caoutchouc×2, fer_goutte_mazout×4
fer_cape_plumes_mazoutees ← plume_mazoutee×8, fer_toile_sac_poisseuse×3, fer_goutte_mazout×4
fer_coiffe_goudron ← plume_mazoutee×8, fer_couvercle_cabosse×2, fer_queue_caoutchouc×2
fer_bottes_goudron ← plume_mazoutee×6, fer_dent_rouillee×4, fer_queue_caoutchouc×2
fer_amulette_ecrou_geante ← fer_boulon_sans_fin×6, fer_pince_de_douze×4, fer_ressort_tendu×2
fer_cape_bache_trouee ← fer_toile_sac_poisseuse×5, fer_carapace_tole×3, fer_ressort_tendu×3
fer_ceinture_outils_rouilles ← fer_pince_de_douze×5, fer_boulon_sans_fin×5, fer_huile_de_coude×1
fer_casque_chantier_cabosse ← fer_carapace_tole×4, fer_couvercle_cabosse×4, fer_ecrou_sacre_yvon×1
fer_bottes_securite_fer ← fer_carapace_tole×4, fer_boulon_sans_fin×6, fer_ecrou_sacre_yvon×1
fer_amulette_bouillon_fer ← fer_couvercle_cabosse×4, fer_huile_de_coude×1, fer_goutte_mazout×3
fer_anneau_rondelle_chance ← fer_pince_de_douze×3, fer_boulon_sans_fin×3, fer_dent_rouillee×4
fer_coiffe_passoire_sage ← fer_couvercle_cabosse×5, fer_ressort_tendu×2, fer_toile_sac_poisseuse×2
fer_dague_ouvre_boite ← fer_dent_rouillee×5, fer_pince_de_douze×3, fer_goutte_mazout×3
fer_baguette_soudeur ← fer_couvercle_cabosse×4, fer_ressort_tendu×3, fer_huile_de_coude×1
fer_marteau_cle_de_douze ← fer_pince_de_douze×6, fer_boulon_sans_fin×5, fer_carapace_tole×2
fer_pelle_a_gravats ← fer_carapace_tole×4, fer_boulon_sans_fin×4, fer_huile_de_coude×2
```

## 8. Donjon et Fruit d'Écho

```yaml
id: fer_donjon_casse_vis_sans_fin
name: La Casse aux Vis-Sans-Fin
recommendedLevel: 16
keyItemId: cle_donjon_ile_de_la_ferraille
rooms:
  - id: fer_salle_cour_volatiles
    name: La Cour aux Volatiles Gras
    monsters:
      - { monsterId: piou_mazoute, quantity: 2 }
      - { monsterId: fer_rat_de_cale, quantity: 1 }
  - id: fer_salle_hangar_mazout
    name: Le Hangar à Mazout
    monsters:
      - { monsterId: fer_rat_de_cale, quantity: 1 }
      - { monsterId: fer_crabe_cle_molette, quantity: 2 }
      - { monsterId: fer_marmite_fuyarde, quantity: 1 }
  - id: fer_salle_allee_boulons
    name: L'Allée des Boulons Perdus
    monsters:
      - { monsterId: fer_crabe_cle_molette, quantity: 1 }
      - { monsterId: fer_marmite_fuyarde, quantity: 1 }
      - { monsterId: fer_boulon_pousseur, quantity: 2 }
  - id: fer_salle_atelier_yvon
    name: L'Atelier d'Yvon Rouiller
    isBossRoom: true
    monsters:
      - { monsterId: fer_boss_yvon_rouiller, quantity: 1 }
      - { monsterId: fer_crabe_cle_molette, quantity: 1 }
      - { monsterId: fer_marmite_fuyarde, quantity: 1 }
      - { monsterId: fer_boulon_pousseur, quantity: 1 }
```

### Salle 2 — « Le Hangar à Mazout »

```
############
#..P....M..#
#.P..##..M.#
#...~##~...#
#..~~..~~..#
#...#..#...#
#...#..#...#
#..~~..~~..#
#...~##~...#
#.P..##..M.#
#..P....M..#
############
```

### Salle 4 — « L'Atelier d'Yvon Rouiller »

```
############
#..#....#..#
#P...~~...M#
#.P..~~..M.#
#..#....#..#
#....##....#
#....##....#
#..#....#..#
#.P..~~..M.#
#P...~~...M#
#..#....#..#
############
```

### Fruit d'Écho — `fer_fruit_coup_de_boulon`

```yaml
id: fer_fruit_coup_de_boulon
name: Fruit du Coup-de-Boulon
description: "Une poire de métal bleui, lourde comme une enclume de poche. Elle pue le mazout et la soudure, et roule vers les gens avec une intention manifeste."
obtention:
  - { type: drop, monsterId: fer_boss_yvon_rouiller, baseDropRate: 0.04, ppThreshold: 150 }
  - { type: craft, recipeId: fer_fruit_coup_de_boulon }
passive:
  trigger: onBeforeApplyPush
  effect: pushCells + 1
  condition: pushCells >= 1
signatureSpellId: fer_spell_petage_de_plomb
```

```yaml
id: fer_spell_petage_de_plomb
name: Pétage de Plomb
apCost: 3
minRange: 1
maxRange: 1
requiresLos: true
cooldown: 2
maxPerTurn: 1
maxPerTarget: 1
zone: { type: target, size: 0 }
kind: push_pull
element: earth
minValue: 12
maxValue: 16
effects:
  - { type: pushCells, value: 2 }
```

Lore : la poire métallique ne se mange pas — elle se porte, et elle pèse sur les décisions. Le porteur comprend très vite pourquoi les murs de La Ferraille sont tous aussi épais.

## 9. PNJ et quêtes

### `fer_npc_gertrude_degrippant` — Gertrude du Dégrippant

- **Rôle** : tenancière de la Cantine du Dégrippant, ravitailleuse et mémoire vivante des dettes de la Confrérie.
- **Emplacement** : La Ferraille, quai sud, Cantine du Dégrippant (entrée du Hangar à Mazout).
- **Personnalité** : autoritaire, pratique, d'une mauvaise foi chirurgicale dès qu'on parle de nourriture.

```yaml
id: fer_npc_gertrude_degrippant
name: Gertrude du Dégrippant
role: merchant
locationId: fer_cantine_degrippant
dialogue:
  idle:
    - "Mange. On discutera de ta mort après."
    - "Le mazout, c'est comme la famille : ça passe partout et ça laisse des traces."
    - "J'ai servi trois rois ici. Deux sont repartis, le troisième est dans la soupe."
```

### `fer_npc_jean_marteau_bricole` — Jean-Marteau de la Bricole

- **Rôle** : grand maître de la Confrérie des Vis-Sans-Fin, gardien autoproclamé du Boulon.
- **Emplacement** : La Ferraille, place centrale, Atelier de la Bricole.
- **Personnalité** : solennel, procédurier, incapable de prononcer une phrase sans convoquer un comité.

```yaml
id: fer_npc_jean_marteau_bricole
name: Jean-Marteau de la Bricole
role: questgiver
locationId: fer_atelier_bricole
dialogue:
  idle:
    - "Le Boulon tient. C'est tout ce qu'il y a à savoir, et c'est déjà énorme."
    - "On ne desserre pas un dogme avec une clef de douze."
    - "J'ai convoqué un comité sur la question du Boulon. Il siège depuis onze ans. Il tient bon aussi."
```

### `fer_quest_plumes_au_beurre_noir` — « Des Plumes dans l'Engrenage »

```yaml
id: fer_quest_plumes_au_beurre_noir
name: Des Plumes dans l'Engrenage
giverNpcId: fer_npc_gertrude_degrippant
recommendedLevel: 4
prerequisiteQuestId: null
summary: "Gertrude a besoin de plumes de Piou Mazouté pour sa soupe du soir. Elle paie en dettes et en clef de donjon, ce qui revient souvent au même."
steps:
  - { type: kill_monsters, monsterId: piou_mazoute, quantity: 4 }
  - { type: collect_items, itemId: plume_mazoutee, quantity: 5, consumeItems: true }
  - { type: craft_item, itemId: fer_sandwich_sardine_rouillee, quantity: 1 }
  - { type: talk_to_npc, npcId: fer_npc_gertrude_degrippant }
dialogue:
  intro:
    - { npcId: fer_npc_gertrude_degrippant, text: "Tu vois les oiseaux noirs là-bas ? Ils me doivent des plumes." }
    - { npcId: fer_npc_gertrude_degrippant, text: "Quatre oiseaux, cinq plumes. Et rapporte-moi un sandwich correct, pas ta mixture." }
    - { npcId: fer_npc_gertrude_degrippant, text: "Si tu reviens sans les plumes, tu manges ce que tu trouves dans la marmite." }
  inProgress:
    - { npcId: fer_npc_gertrude_degrippant, text: "Encore là ? La soupe ne se fait pas en me regardant." }
    - { npcId: fer_npc_gertrude_degrippant, text: "Cinq plumes. J'ai dit cinq. Le nombre est une opinion qui ne se discute pas chez moi." }
  completion:
    - { npcId: fer_npc_gertrude_degrippant, text: "Bon. Ça ressemble à un sandwich. Ça se défend en tout cas." }
    - { npcId: fer_npc_gertrude_degrippant, text: "Tiens, la clef de la Casse. Et ce grog. Ne le bois pas trop près d'une flamme, ni d'un client." }
rewards:
  xp: 220
  kamas: 90
  items:
    - { itemId: cle_donjon_ile_de_la_ferraille, quantity: 1 }
    - { itemId: fer_grog_au_degrippant, quantity: 2 }
```

### `fer_quest_boulon_du_destin` — « Vis-à-Vis avec Yvon »

```yaml
id: fer_quest_boulon_du_destin
name: Vis-à-Vis avec Yvon
giverNpcId: fer_npc_jean_marteau_bricole
recommendedLevel: 15
prerequisiteQuestId: fer_quest_plumes_au_beurre_noir
summary: "Jean-Marteau veut une audience avec Yvon pour faire constater officiellement que le Boulon tient. Il lui faut donc qu'une escorte, une clef et des voiles — dans cet ordre administratif."
steps:
  - { type: clear_dungeon, dungeonId: fer_donjon_casse_vis_sans_fin }
  - { type: craft_item, itemId: fer_voiles_fortune_de_pot, quantity: 1 }
  - { type: talk_to_npc, npcId: fer_npc_jean_marteau_bricole }
dialogue:
  intro:
    - { npcId: fer_npc_jean_marteau_bricole, text: "Yvon ne discute qu'avec ceux qui ont traversé la Casse. C'est absurde, mais c'est le protocole." }
    - { npcId: fer_npc_jean_marteau_bricole, text: "Traverse quatre salles. Ne meurs pas : je n'ai pas de formulaire pour ça." }
    - { npcId: fer_npc_jean_marteau_bricole, text: "Et couse-moi ces voiles. La Confrérie a besoin d'aller porter le doute ailleurs." }
  inProgress:
    - { npcId: fer_npc_jean_marteau_bricole, text: "Le comité attend. Le comité attend depuis onze ans, mais il attend." }
    - { npcId: fer_npc_jean_marteau_bricole, text: "Les voiles, c'est symbolique. C'est-à-dire : obligatoire." }
  completion:
    - { npcId: fer_npc_jean_marteau_bricole, text: "Quatre salles, un boss, et tu es encore debout. Je vais devoir rédiger un éloge." }
    - { npcId: fer_npc_jean_marteau_bricole, text: "Tiens. Un écrou sacré, et une rondelle qui porte chance. La chance, ici, se porte comme une prothèse." }
rewards:
  xp: 650
  kamas: 250
  items:
    - { itemId: fer_ecrou_sacre_yvon, quantity: 1 }
    - { itemId: fer_anneau_rondelle_chance, quantity: 1 }
```

## 10. Écarts avec le modèle de données actuel

1. **`piou_mazoute` est redéfini.** Il existe aujourd'hui dans `data/monsters.yaml` avec niveau 1, 35 PV, **6 PA / 3 PM**, `strength: 15`, `baseXp: 120`. Le dossier impose niveau 3, 5 PA / 4 PM, `strength: 5`, `baseXp: 28`. Conséquence : le walkthrough actuel vérifie « 120 XP ⇒ niveau 2 » ; passer `baseXp` à 28 casse ce test. Décision à prendre explicitement en Vague 6 (redéfinir + adapter le walkthrough, ou conserver l'ancien piou comme variante).
2. **Nommage `pa`/`pm` vs `ap`/`mp`.** Le dossier utilise `pa`/`pm` ; le moteur (`CombatantState`) utilise `ap`/`mp` et `maxAp`/`maxMp`. Il faut trancher une convention et ne pas laisser deux noms.
3. **`slot: ring` n'existe pas.** `EquipmentSlot` vaut `hat|cloak|weapon|amulet|ring1|ring2|belt|boots`. Deux pièces du dossier sont des bagues (`fer_anneau_mazoute`, `fer_anneau_rondelle_chance`). Lié à la dette **D06** (interdiction actuelle de porter deux bagues identiques, contraire à 1.29).
4. **`setId: null`** n'est pas accepté par `itemSchema` (chaîne optionnelle). À trancher : clé absente plutôt que `null`.
5. **Stats d'équipement en fourchettes `{min,max}`**, alors que `itemSchema` attend des entiers plats. Le modèle « jet aléatoire 1.29 » n'existe pas encore : c'est un chantier de schéma (et de calcul de stats) avant d'intégrer ce dossier.
6. **Panoplies : `bonusesByCount` 2→5 et `itemIds`**, alors que `setSchema` attend `bonuses: [{pieces, stats}]` avec des paliers **2 à 4 maximum** et `pieceIds`. Les paliers 5 pièces et les bonus `pm: 1` / `pa: 1` n'ont pas de représentation.
7. **Armes : modèle inexistant.** `weaponType`, `damageLines`, `critRate`, `critBonus`, `conditions` (ex. `agility >= 20`) n'ont ni schéma ni moteur. Les dégâts d'arme multi-lignes (terre + neutre) ne sont pas gérés par `computeDamage`.
8. **Sorts de monstre : moteur d'effets absent.** `zone: cross|circle`, `kind: heal|buff|debuff|push_pull|summon`, `effects` (`pmLoss`, `apLoss`, `shield`, `pushCells`, `durationTurns`, `summonMonsterId`, `breakOnWallPush`, `wallBreakApLoss`), `cooldown`, `maxPerTurn`, `maxPerTarget` : rien de tout cela n'est implémenté. `spellSchema` accepte aujourd'hui `kind: damage|teleport|other` avec un `effect` **descriptif non consommé**. C'est le chantier de la Vague 6A (`advanced-spells`). Sans lui, le dossier n'est pas implémentable.
9. **`ai` par monstre inexistant.** Le moteur actuel a une IA unique et codée (`runEnemyTurn` : rapprochement + attaque). Les 6 archétypes (`ranged_kiter`, `melee_rusher`, `tank_tackler`, `support_healer`, `pusher_control`, `boss_custom`) et `behaviorRules` exigent une IA paramétrable — chantier 5A (`multi-combat`) ou 6A.
10. **`isBoss`, `kamasMin`, `kamasMax` absents** de `monsterSchema`. `drops` est compatible avec `loot` actuel (`itemId`/`baseDropRate`/`ppThreshold`), bonne nouvelle.
11. **Donjons, PNJ, quêtes : aucun schéma.** `dungeons.yaml`, `npcs.yaml`, `quests.yaml` sont à créer (`dungeonSchema`, `npcSchema`, `questSchema`) — chantier 5A (`dungeon-data`).
12. **Les 2 grilles ASCII sont directement utilisables** : 12×12, `P` et `M` présents, `#` et `~` conformes à `mapSchema`. Il faudra leur donner des `id` snake_case et des `name`, et vérifier la connexité `P → M` (le test actuel ne l'exige pas mais le walkthrough pourrait).
13. **`fer_ecrou_sacre_yvon` sert de monnaie de craft** (1 à 5 unités par recette) alors que c'est un drop rare à 0.80 : cohérent, mais à surveiller côté équilibrage.
14. **`fer_fruit_coup_de_boulon` est à la fois un drop et un résultat de craft** : il devra exister dans une entité « fruit d'Écho » (Vague 6) **et** être référençable comme butin — deux schémas qui se croisent, à concevoir avant.

## 11. Ordre d'implémentation recommandé

1. **Vague 5A** `dungeon-data` : schémas `dungeon`/`npc`/`quest` + les 2 grilles de ce dossier.
2. **Vague 6A** `advanced-spells` : zones, statuts à durée, boucliers, cooldowns, quotas, `push_pull`, `summon`. **Bloquant** pour 10 des 16 sorts de monstre.
3. **Vague 6A** `echo-fruits` : passif `onBeforeApplyPush`, `fer_fruit_coup_de_boulon`.
4. **Vague 6B** : refonte du modèle d'équipement (fourchettes de stats, `ring`, paliers 5), des armes, et redéfinition de `piou_mazoute`.
5. **Vague 7B** : remplissage complet du bestiaire, des 22 recettes, des 2 quêtes, du donjon 4 salles.

## 12. Tâches à reporter dans `docs/design/backlog.yaml`

Bloc prêt à coller (à répartir dans `waves[].phases[].tasks[]` et `debts[]`). Le fichier appartient à une autre PR : rien n'est appliqué ici.

```yaml
# --- waves[wave-5].phases[5A].tasks ---
- id: 5A-island-ferraille-dungeon-data
  title: Schémas dungeon/npc/quest + 2 grilles du Hangar et de l'Atelier
  status: todo
  owner: tdd-coder
  priority: high
  target: 5A
  severity: high
  depends_on: [4A-harness]
  notes: voir docs/design/islands/ile_de_la_ferraille.md §8

# --- waves[wave-6].phases[6A].tasks ---
- id: 6A-island-ferraille-spells
  title: 16 sorts de monstre — zones cross/circle, statuts à durée, boucliers, cooldowns, quotas, push_pull, summon
  status: todo
  owner: tdd-coder
  priority: high
  target: 6A
  severity: high
  depends_on: [5A-island-ferraille-dungeon-data]
  notes: bloquant pour 10 des 16 sorts (§3, §10.8)
- id: 6A-island-ferraille-fruit
  title: Fruit du Coup-de-Boulon — passif onBeforeApplyPush + Pétage de Plomb
  status: todo
  owner: tdd-coder
  priority: high
  target: 6A
  severity: medium
  depends_on: [6A-island-ferraille-spells]
  notes: double nature drop/craft à trancher (§10.14)

# --- waves[wave-6].phases[6B].tasks ---
- id: 6B-island-ferraille-equipment
  title: Équipement — fourchettes de stats, slot ring, paliers 5 pièces, armes et conditions
  status: todo
  owner: tdd-coder
  priority: high
  target: 6B
  severity: high
  depends_on: [6A-island-ferraille-spells]
  notes: inclut la redéfinition de piou_mazoute (§5, §6, §10.1-7)

# --- waves[wave-7].phases[7B].tasks ---
- id: 7B-island-ferraille-content
  title: Contenu Île de la Ferraille — bestiaire, 22 recettes, 2 quêtes, donjon 4 salles
  status: todo
  owner: tdd-coder
  priority: medium
  target: 7B
  severity: medium
  depends_on: [6B-island-ferraille-equipment, 6A-island-ferraille-fruit]
  notes: données issues de docs/design/islands/ile_de_la_ferraille.md

# --- debts ---
- id: D18
  title: piou_mazoute redéfini (niv. 3, 5/4 PA-PM, baseXp 120→28) casse le walkthrough « 120 XP ⇒ niveau 2 »
  severity: high
  target: 6B
- id: D19
  title: Convention pa/pm (dossier) vs ap/mp (CombatantState) non tranchée
  severity: medium
  target: 6B
- id: D20
  title: slot ring absent d'EquipmentSlot (ring1/ring2 seulement), lié à D06
  severity: medium
  target: 6B
- id: D21
  title: Stats d'équipement en fourchettes {min,max} alors qu'itemSchema attend des entiers plats
  severity: high
  target: 6B
- id: D22
  title: Paliers de panoplie 5 pièces et bonus pa/pm sans représentation dans setSchema
  severity: high
  target: 6B
- id: D23
  title: Armes sans schéma (weaponType, damageLines, critRate, critBonus, conditions)
  severity: high
  target: 6B
- id: D24
  title: IA par archétype absente (6 archétypes + behaviorRules)
  severity: high
  target: 6A
- id: D25
  title: Donjons, PNJ et quêtes sans schéma
  severity: high
  target: 5A
- id: D26
  title: fer_fruit_coup_de_boulon à la fois drop et craft — deux schémas qui se croisent
  severity: medium
  target: 6A
```
