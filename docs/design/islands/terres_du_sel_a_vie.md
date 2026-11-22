# Les Terres du Sel-à-Vie — spec de design

Tranche de niveaux 15–35 · slug court `sel_` · requiert `fer_voiles_fortune_de_pot` · débloque `detroit_des_cloches_sonnees` via `sel_coque_chene_et_os` · dossier fourni par l'utilisateur le 2026-11-22, transcrit sans modification de valeurs.

> Statut : spécification de référence, NON implémentée. Cible : Vague 6 (données) et Vague 7 (contenu). Les écarts de modèle communs sont décrits dans docs/design/islands/ile_de_la_ferraille.md §10 — ils valent ici à l'identique.

## 1. Résumé

Les Terres du Sel-à-Vie sont un archipel de marais salants où l'on récolte le sel comme d'autres récoltent l'impôt, c'est-à-dire en discutant beaucoup. Les moulins y tournent à l'envers, poussés par la marée montante, et personne n'a jamais jugé utile d'expliquer pourquoi. L'Ordre du Bouillon-Cube y tient le sel pour une écriture sainte et la soupe pour sa seule exégèse valable. Au centre, le Duc de la Moutarde-au-Nez taxe les paludiers, les charpentiers et jusqu'au bois flotté qui s'échoue sur ses rives, ce qui lui vaut une popularité strictement proportionnelle à la largeur de ses fossés.

## 2. Bestiaire

| ID | Nom | Niv. | PV | PA/PM | Archétype | Drops notables |
| --- | --- | --- | --- | --- | --- | --- |
| `sel_navet_navrant` | Navet Navrant | 17 | 155 | 6/4 | `melee_rusher` | `sel_fane_saline`, `sel_anneau_sel_fin` |
| `sel_mouette_a_sel` | Goéland Salé-Poivré | 21 | 195 | 6/4 | `ranged_kiter` | `sel_plume_saumuree`, `sel_bec_encroute` |
| `sel_epouvantail_trempe` | Épouvantail de Paille-en-Queue | 24 | 245 | 7/3 | `pusher_control` | `sel_paille_humide`, `sel_bois_flotte_sale` |
| `sel_marmiton_bouillon` | Marmiton du Bouillon-Cube | 28 | 280 | 7/4 | `support_healer` | `sel_cube_bouillon_ancien`, `sel_poireau_mutant` |
| `sel_sanglier_saumure` | Cochon-Salé | 31 | 340 | 7/4 | `tank_tackler` | `sel_couenne_cristallisee`, `sel_os_a_moelle_sale` |
| `sel_boss_duc_moutarde` | Duc de la Moutarde-au-Nez (Boss) | 35 | 430 | 8/4 | `boss_custom` | `sel_pot_moutarde_ducal`, `sel_fruit_grain_de_sel` |

### `sel_navet_navrant`

```yaml
id: sel_navet_navrant
name: Navet Navrant
description: "Un navet de la taille d'un chien, poussé dans le sel et dans l'aigreur. Il a des racines, des opinions, et aucune des deux ne se négocie."
level: 17
isBoss: false
hp: 155
pa: 6
pm: 4
baseXp: 230
kamasMin: 28
kamasMax: 52
stats:
  strength: 55
  intelligence: 15
  chance: 35
  agility: 25
  wisdom: 15
resistances:
  flat: { earth: 2, fire: 3, water: 0, air: 2, neutral: 0 }
  percent: { earth: 0, fire: 15, water: -15, air: 10, neutral: 0 }
spellIds: [sel_spell_coup_de_racine, sel_spell_jus_de_navet]
ai:
  archetype: melee_rusher
  preferredDistance: 1
  behaviorRules:
    - "Fonce sur l'ennemi le plus proche et ne s'arrête qu'au contact."
    - "Réserve Coup de Racine pour une cible déjà au corps-à-corps."
    - "N'a pas de plan de repli : il a de l'élan, ce qui revient au même jusqu'à ce que ça casse."
drops:
  - { itemId: sel_fane_saline, baseDropRate: 0.72, ppThreshold: 100 }
  - { itemId: sel_gros_sel_gris, baseDropRate: 0.50, ppThreshold: 100 }
  - { itemId: sel_anneau_sel_fin, baseDropRate: 0.02, ppThreshold: 110 }
```

### `sel_mouette_a_sel`

```yaml
id: sel_mouette_a_sel
name: Goéland Salé-Poivré
description: "Goéland gavé de saumure et de poivre gris. Il vole bas, pique loin, et considère le sel comme une monnaie dont il est le seul à connaître le change."
level: 21
isBoss: false
hp: 195
pa: 6
pm: 4
baseXp: 320
kamasMin: 38
kamasMax: 70
stats:
  strength: 15
  intelligence: 20
  chance: 50
  agility: 65
  wisdom: 20
resistances:
  flat: { earth: 1, fire: 0, water: 1, air: 2, neutral: 3 }
  percent: { earth: 0, fire: -10, water: 0, air: 10, neutral: 15 }
spellIds: [sel_spell_fiente_au_gros_sel, sel_spell_rafale_iodee]
ai:
  archetype: ranged_kiter
  preferredDistance: 4
  behaviorRules:
    - "Reste à 4 cases ou plus et recule d'une case après chaque tir."
    - "Ne tire jamais sans ligne de vue : se repositionne d'abord, quitte à perdre un tour."
    - "Fuit toute cible au corps-à-corps au lieu de la frapper, par principe et par lâcheté."
drops:
  - { itemId: sel_plume_saumuree, baseDropRate: 0.68, ppThreshold: 100 }
  - { itemId: sel_gros_sel_gris, baseDropRate: 0.45, ppThreshold: 100 }
  - { itemId: sel_bec_encroute, baseDropRate: 0.24, ppThreshold: 100 }
```

### `sel_epouvantail_trempe`

```yaml
id: sel_epouvantail_trempe
name: Épouvantail de Paille-en-Queue
description: "Épouvantail de marais salant, monté sur un pieu qui a fini par prendre des décisions. Il pousse les intrus vers l'eau et trouve ça pédagogique."
level: 24
isBoss: false
hp: 245
pa: 7
pm: 3
baseXp: 410
kamasMin: 48
kamasMax: 88
stats:
  strength: 75
  intelligence: 20
  chance: 20
  agility: 45
  wisdom: 30
resistances:
  flat: { earth: 3, fire: 3, water: 0, air: 2, neutral: 2 }
  percent: { earth: 5, fire: 10, water: -15, air: 5, neutral: 10 }
spellIds: [sel_spell_faux_mouvement, sel_spell_coup_de_manche, sel_spell_vent_de_panique]
ai:
  archetype: pusher_control
  preferredDistance: 2
  behaviorRules:
    - "Se place à 2 cases et pousse l'ennemi vers l'eau ou le mur le plus proche."
    - "Utilise Faux Mouvement pour attirer une cible isolée hors de sa portée de soutien."
    - "Ne poursuit jamais : il attend que l'ennemi revienne dans la zone."
drops:
  - { itemId: sel_paille_humide, baseDropRate: 0.65, ppThreshold: 100 }
  - { itemId: sel_bois_flotte_sale, baseDropRate: 0.34, ppThreshold: 100 }
  - { itemId: sel_tissu_epouvantail, baseDropRate: 0.22, ppThreshold: 110 }
```

### `sel_marmiton_bouillon`

```yaml
id: sel_marmiton_bouillon
name: Marmiton du Bouillon-Cube
description: "Membre tonsuré de l'Ordre du Bouillon-Cube. Il soigne les siens à la louche et corrige les autres au poivre, dans cet ordre et sans état d'âme."
level: 28
isBoss: false
hp: 280
pa: 7
pm: 4
baseXp: 530
kamasMin: 60
kamasMax: 110
stats:
  strength: 20
  intelligence: 95
  chance: 40
  agility: 25
  wisdom: 45
resistances:
  flat: { earth: 2, fire: 1, water: 4, air: 2, neutral: 0 }
  percent: { earth: 0, fire: 0, water: 20, air: 5, neutral: -10 }
spellIds: [sel_spell_potage_revigorant, sel_spell_eclaboussure_bouillante, sel_spell_pincee_de_poivre]
ai:
  archetype: support_healer
  preferredDistance: 3
  behaviorRules:
    - "Soigne en priorité l'allié le plus bas en PV, jamais lui-même en premier."
    - "Reste à 3 cases de son protégé et à 4 de l'ennemi."
    - "Garde Pincée de Poivre pour un ennemi qui attaque à distance."
drops:
  - { itemId: sel_cube_bouillon_ancien, baseDropRate: 0.62, ppThreshold: 100 }
  - { itemId: sel_louche_tordue, baseDropRate: 0.28, ppThreshold: 110 }
  - { itemId: sel_poireau_mutant, baseDropRate: 0.14, ppThreshold: 130 }
```

### `sel_sanglier_saumure`

```yaml
id: sel_sanglier_saumure
name: Cochon-Salé
description: "Cochon élevé au sel, ce qui lui donne le cuir dur et l'humeur de quelqu'un qu'on a trop saupoudré pendant trop longtemps."
level: 31
isBoss: false
hp: 340
pa: 7
pm: 4
baseXp: 640
kamasMin: 72
kamasMax: 130
stats:
  strength: 105
  intelligence: 15
  chance: 35
  agility: 55
  wisdom: 30
resistances:
  flat: { earth: 4, fire: 4, water: 1, air: 3, neutral: 0 }
  percent: { earth: 15, fire: 20, water: 0, air: 10, neutral: -15 }
spellIds: [sel_spell_charge_jambon, sel_spell_croute_de_sel, sel_spell_grognement_lourd]
ai:
  archetype: tank_tackler
  preferredDistance: 1
  behaviorRules:
    - "Se colle à l'ennemi le plus dangereux et ne le lâche plus."
    - "Utilise Grognement Lourd dès que l'ennemi a 4 PA ou plus."
    - "Ne quitte jamais le contact, même pour se soigner."
drops:
  - { itemId: sel_couenne_cristallisee, baseDropRate: 0.64, ppThreshold: 100 }
  - { itemId: sel_bois_flotte_sale, baseDropRate: 0.30, ppThreshold: 100 }
  - { itemId: sel_os_a_moelle_sale, baseDropRate: 0.18, ppThreshold: 130 }
```

### `sel_boss_duc_moutarde`

```yaml
id: sel_boss_duc_moutarde
name: Duc de la Moutarde-au-Nez
description: "Le Duc de la Moutarde-au-Nez règne sur les marais, taxe le bois flotté et le sel, et considère la politesse comme une exemption fiscale qu'on ne lui a jamais accordée."
level: 35
isBoss: true
hp: 430
pa: 8
pm: 4
baseXp: 1450
kamasMin: 210
kamasMax: 340
stats:
  strength: 120
  intelligence: 85
  chance: 80
  agility: 45
  wisdom: 55
resistances:
  flat: { earth: 5, fire: 6, water: 0, air: 4, neutral: 2 }
  percent: { earth: 15, fire: 25, water: -15, air: 15, neutral: 5 }
spellIds: [sel_spell_louche_ducale, sel_spell_glyphe_de_moutarde, sel_spell_moutarde_qui_monte, sel_spell_appel_du_potager]
ai:
  archetype: boss_custom
  preferredDistance: 2
  behaviorRules:
    - "Alterne corps-à-corps et mi-distance : ne reste jamais deux tours à la même portée."
    - "Pose Glyphe de Moutarde sous le groupe ennemi dès qu'il est disponible."
    - "Invoque un Navet Navrant quand il tombe sous 50 % de PV, puis repasse au contact."
  bossMechanic: "Moutarde qui Monte : dès que le Duc subit des dégâts au corps-à-corps (distance 1), il gagne +25 % Dommages pour son prochain tour (non cumulable). Il pose régulièrement Glyphe de Moutarde (glyphe 2 tours, cercle 2 : dégâts Terre + −1 PM en début de tour). Le jouer à mi-distance ou l'entraver en PM tout en exploitant sa faiblesse Feu (−15 %) neutralise son pic."
drops:
  - { itemId: sel_pot_moutarde_ducal, baseDropRate: 0.80, ppThreshold: 100 }
  - { itemId: sel_os_a_moelle_sale, baseDropRate: 0.50, ppThreshold: 100 }
  - { itemId: sel_coiffe_chou_fleur, baseDropRate: 0.05, ppThreshold: 140 }
  - { itemId: sel_fruit_grain_de_sel, baseDropRate: 0.04, ppThreshold: 180 }
```

## 3. Sorts des monstres

| ID | Nom | PA | Portée | Zone | Effet |
| --- | --- | --- | --- | --- | --- |
| `sel_spell_coup_de_racine` | Coup de Racine | 3 | 1–1 | Cible | 14–19 Terre |
| `sel_spell_jus_de_navet` | Jus de Navet | 3 | 1–3 | Cible | 10–14 Eau + −1 PM |
| `sel_spell_fiente_au_gros_sel` | Fiente au Gros Sel | 3 | 2–5 | Cible | 13–18 Eau + −1 PM |
| `sel_spell_rafale_iodee` | Rafale Iodée | 3 | 1–2 | Cible | 11–16 Air + poussée 2 |
| `sel_spell_faux_mouvement` | Faux Mouvement | 3 | 2–4 | Cible | 12–16 Terre + **attirance 2** |
| `sel_spell_coup_de_manche` | Coup de Manche | 4 | 1–1 | Cible | 18–24 Neutre + poussée 2 |
| `sel_spell_vent_de_panique` | Vent de Panique | 3 | 1–3 | **Croix 1** | 10–14 Air + −1 PM |
| `sel_spell_potage_revigorant` | Potage Revigorant | 4 | 0–4 sans LoS | Cible | soin 28–38 |
| `sel_spell_eclaboussure_bouillante` | Éclaboussure Bouillante | 3 | 1–4 | **Cercle 1** | 15–21 Feu |
| `sel_spell_pincee_de_poivre` | Pincée de Poivre | 3 | 1–5 | Cible | 11–15 Air + **−2 PO (2 tours)** |
| `sel_spell_charge_jambon` | Charge-Jambon | 4 | 1–1 | Cible | 22–30 Terre |
| `sel_spell_croute_de_sel` | Croûte de Sel | 3 | 0–0 | Cible | +35 bouclier (2 tours) |
| `sel_spell_grognement_lourd` | Grognement Lourd | 3 | 1–2 | Cible | 12–16 Neutre + −1 PA |
| `sel_spell_louche_ducale` | Louche Ducale | 4 | 1–2 | Cible | 26–35 Terre + poussée 1 |
| `sel_spell_glyphe_de_moutarde` | Glyphe de Moutarde | 4 | 1–5 sans LoS | **Cercle 2** | glyphe 2 tours 16–22 Terre + −1 PM |
| `sel_spell_moutarde_qui_monte` | Moutarde qui Monte | 2 | 0–0 | Cible | **+25 % Dommages +1 PM (2 tours)** |
| `sel_spell_appel_du_potager` | Appel du Potager | 4 | 1–3 | Cible | invoque `sel_navet_navrant` |

```yaml
id: sel_spell_coup_de_racine
name: Coup de Racine
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
minValue: 14
maxValue: 19
effects: []
description: "Le navet projette une racine à hauteur de tibia. C'est court, c'est sec, c'est revendiqué comme un argument."
```

```yaml
id: sel_spell_jus_de_navet
name: Jus de Navet
apCost: 3
minRange: 1
maxRange: 3
requiresLos: true
cooldown: 1
maxPerTurn: 1
maxPerTarget: 1
zone: { type: target, size: 0 }
kind: damage
element: water
minValue: 10
maxValue: 14
effects:
  - { type: pmLoss, value: 1, durationTurns: 1 }
description: "Projection de saumure de navet, acide et poisseuse. On perd un PM, et l'envie de se battre juste après."
```

```yaml
id: sel_spell_fiente_au_gros_sel
name: Fiente au Gros Sel
apCost: 3
minRange: 2
maxRange: 5
requiresLos: true
cooldown: 0
maxPerTurn: 2
maxPerTarget: 1
zone: { type: target, size: 0 }
kind: damage
element: water
minValue: 13
maxValue: 18
effects:
  - { type: pmLoss, value: 1, durationTurns: 1 }
description: "Le goéland bombarde à distance respectable, avec une précision qui tient moins du talent que du contentieux."
```

```yaml
id: sel_spell_rafale_iodee
name: Rafale Iodée
apCost: 3
minRange: 1
maxRange: 2
requiresLos: true
cooldown: 1
maxPerTurn: 1
maxPerTarget: 1
zone: { type: target, size: 0 }
kind: push_pull
element: air
minValue: 11
maxValue: 16
effects:
  - { type: pushCells, value: 2 }
description: "Battement d'ailes chargé d'iode. Ça pique, ça pousse, et ça sent le port à marée basse."
```

```yaml
id: sel_spell_faux_mouvement
name: Faux Mouvement
apCost: 3
minRange: 2
maxRange: 4
requiresLos: true
cooldown: 1
maxPerTurn: 1
maxPerTarget: 1
zone: { type: target, size: 0 }
kind: push_pull
element: earth
minValue: 12
maxValue: 16
effects:
  - { type: pullCells, value: 2 }
description: "L'épouvantail agite sa manche ailleurs. La cible fait un pas de trop, dans la mauvaise direction."
```

```yaml
id: sel_spell_coup_de_manche
name: Coup de Manche
apCost: 4
minRange: 1
maxRange: 1
requiresLos: true
cooldown: 0
maxPerTurn: 1
maxPerTarget: 1
zone: { type: target, size: 0 }
kind: push_pull
element: neutral
minValue: 18
maxValue: 24
effects:
  - { type: pushCells, value: 2 }
description: "Grand coup de manche en bois flotté. Techniquement, c'est du mobilier qui vous frappe."
```

```yaml
id: sel_spell_vent_de_panique
name: Vent de Panique
apCost: 3
minRange: 1
maxRange: 3
requiresLos: true
cooldown: 2
maxPerTurn: 1
maxPerTarget: 1
zone: { type: cross, size: 1 }
kind: damage
element: air
minValue: 10
maxValue: 14
effects:
  - { type: pmLoss, value: 1, durationTurns: 1 }
description: "Un courant d'air salé traverse la croix et fait perdre à chacun un peu de vitesse et beaucoup de dignité."
```

```yaml
id: sel_spell_potage_revigorant
name: Potage Revigorant
apCost: 4
minRange: 0
maxRange: 4
requiresLos: false
cooldown: 1
maxPerTurn: 1
maxPerTarget: 1
zone: { type: target, size: 0 }
kind: heal
minValue: 28
maxValue: 38
effects: []
description: "Louche de bouillon tiède servie à l'aveugle, à travers les murs si nécessaire. L'Ordre ne reconnaît pas les murs."
```

```yaml
id: sel_spell_eclaboussure_bouillante
name: Éclaboussure Bouillante
apCost: 3
minRange: 1
maxRange: 4
requiresLos: true
cooldown: 0
maxPerTurn: 2
maxPerTarget: 1
zone: { type: circle, size: 1 }
kind: damage
element: fire
minValue: 15
maxValue: 21
effects: []
description: "Une marmite bascule. Le cercle entier découvre que le bouillon de l'Ordre bout à cent dix degrés par conviction."
```

```yaml
id: sel_spell_pincee_de_poivre
name: Pincée de Poivre
apCost: 3
minRange: 1
maxRange: 5
requiresLos: true
cooldown: 2
maxPerTurn: 1
maxPerTarget: 1
zone: { type: target, size: 0 }
kind: damage
element: air
minValue: 11
maxValue: 15
effects:
  - { type: poLoss, value: 2, durationTurns: 2 }
description: "Poivre gris dans les yeux : la cible voit trouble, et surtout voit loin moins longtemps."
```

```yaml
id: sel_spell_charge_jambon
name: Charge-Jambon
apCost: 4
minRange: 1
maxRange: 1
requiresLos: true
cooldown: 0
maxPerTurn: 1
maxPerTarget: 1
zone: { type: target, size: 0 }
kind: damage
element: earth
minValue: 22
maxValue: 30
effects: []
description: "Le Cochon-Salé prend son élan sur trois mètres. C'est peu, mais avec le poids, ça suffit largement."
```

```yaml
id: sel_spell_croute_de_sel
name: Croûte de Sel
apCost: 3
minRange: 0
maxRange: 0
requiresLos: true
cooldown: 3
maxPerTurn: 1
maxPerTarget: 1
zone: { type: target, size: 0 }
kind: buff
minValue: 35
maxValue: 35
effects:
  - { type: shield, value: 35, durationTurns: 2 }
description: "Le cochon se recouvre d'une croûte de sel séché. Ça protège, ça craquelle, ça décourage les dents."
```

```yaml
id: sel_spell_grognement_lourd
name: Grognement Lourd
apCost: 3
minRange: 1
maxRange: 2
requiresLos: true
cooldown: 1
maxPerTurn: 1
maxPerTarget: 1
zone: { type: target, size: 0 }
kind: damage
element: neutral
minValue: 12
maxValue: 16
effects:
  - { type: apLoss, value: 1, durationTurns: 1 }
description: "Un grognement si bas qu'il en coûte un PA. Personne n'a jamais expliqué le mécanisme, personne ne le remet en cause."
```

```yaml
id: sel_spell_louche_ducale
name: Louche Ducale
apCost: 4
minRange: 1
maxRange: 2
requiresLos: true
cooldown: 0
maxPerTurn: 2
maxPerTarget: 1
zone: { type: target, size: 0 }
kind: push_pull
element: earth
minValue: 26
maxValue: 35
effects:
  - { type: pushCells, value: 1 }
description: "Louche de service, argenture écaillée, manche renforcé. Elle sert à servir, et parfois à servir d'exemple."
```

```yaml
id: sel_spell_glyphe_de_moutarde
name: Glyphe de Moutarde
apCost: 4
minRange: 1
maxRange: 5
requiresLos: false
cooldown: 3
maxPerTurn: 1
maxPerTarget: 1
zone: { type: circle, size: 2 }
kind: glyph
element: earth
minValue: 16
maxValue: 22
effects:
  - { type: glyphDurationTurns, value: 2, durationTurns: 2 }
  - { type: pmLoss, value: 1, durationTurns: 1 }
description: "Le Duc répand de la moutarde sur le sol, en cercle, avec le geste d'un homme qui dresse un procès-verbal."
```

```yaml
id: sel_spell_moutarde_qui_monte
name: Moutarde qui Monte
apCost: 2
minRange: 0
maxRange: 0
requiresLos: true
cooldown: 3
maxPerTurn: 1
maxPerTarget: 1
zone: { type: target, size: 0 }
kind: buff
minValue: 25
maxValue: 25
effects:
  - { type: percentDamageBonus, value: 25, durationTurns: 2 }
  - { type: pmBuff, value: 1, durationTurns: 2 }
description: "La moutarde monte au nez, puis aux avant-bras. Le Duc frappe plus fort et court plus vite, deux tours durant."
```

```yaml
id: sel_spell_appel_du_potager
name: Appel du Potager
apCost: 4
minRange: 1
maxRange: 3
requiresLos: true
cooldown: 4
maxPerTurn: 1
maxPerTarget: 1
zone: { type: target, size: 0 }
kind: summon
minValue: 0
maxValue: 0
effects:
  - { type: summonMonsterId, value: 1, durationTurns: 0, summonMonsterId: sel_navet_navrant }
description: "Le Duc siffle. Un navet répond, ce qui pose des questions que la cour royale préfère ne pas instruire."
```

## 4. Ressources, consommables, clé, amélioration

### 4.1 Ressources (13)

```yaml
- id: sel_fane_saline
  name: Fane Saline
  category: resource
  rarity: common
  sellValue: 9
  description: "Feuille de navet racornie par le sel. Les paludiers en font de la litière, les apothicaires une décoction, les deux se trompent."
- id: sel_gros_sel_gris
  name: Gros Sel Gris
  category: resource
  rarity: common
  sellValue: 10
  description: "Sel non raffiné, gris de vase. C'est la monnaie locale, l'assaisonnement officiel et le prétexte de la plupart des procès."
- id: sel_plume_saumuree
  name: Plume Saumurée
  category: resource
  rarity: common
  sellValue: 12
  description: "Plume de goéland gorgée de saumure. Elle sèche en craquant, et craque en séchant, ce qui suffit à la vendre."
- id: sel_bec_encroute
  name: Bec Encroûté
  category: resource
  rarity: uncommon
  sellValue: 24
  description: "Bec incrusté de sel cristallisé. Les cuisiniers le broient, les orfèvres le sertissent, les goélands le regrettent."
- id: sel_paille_humide
  name: Paille Humide
  category: resource
  rarity: common
  sellValue: 14
  description: "Paille de marais, imbibée depuis la dernière marée haute. Elle ne pourrit pas : elle négocie."
- id: sel_bois_flotte_sale
  name: Bois Flotté Salé
  category: resource
  rarity: uncommon
  sellValue: 28
  description: "Bois rejeté par la mer et taxé par le Duc avant même d'avoir touché le sable. Le sel est inclus, la taxe aussi."
- id: sel_tissu_epouvantail
  name: Tissu d'Épouvantail
  category: resource
  rarity: uncommon
  sellValue: 26
  description: "Toile de sac déchirée sur un épouvantail. Elle garde la forme d'un torse et une odeur de rancune mouillée."
- id: sel_cube_bouillon_ancien
  name: Cube de Bouillon Ancien
  category: resource
  rarity: common
  sellValue: 18
  description: "Cube de bouillon fossilisé, béni par l'Ordre. Il parfume les soupes et, dit-on, les serments."
- id: sel_louche_tordue
  name: Louche Tordue
  category: resource
  rarity: uncommon
  sellValue: 34
  description: "Louche de cuisine pliée par un usage théologique. Elle penche toujours du côté du plus gros pot."
- id: sel_poireau_mutant
  name: Poireau Mutant
  category: resource
  rarity: rare
  sellValue: 65
  description: "Poireau poussé trop près des bassins de saumure. Il est bleu, il est amer, et il est extrêmement conscient du regard qu'on porte sur lui."
- id: sel_couenne_cristallisee
  name: Couenne Cristallisée
  category: resource
  rarity: common
  sellValue: 22
  description: "Couenne de Cochon-Salé, dure comme du verre dépoli. Les tanneurs la refusent, les tailleurs la convoitent."
- id: sel_os_a_moelle_sale
  name: Os à Moelle Salé
  category: resource
  rarity: rare
  sellValue: 70
  description: "Os si chargé de sel que la moelle a pris le goût du large. Les charpentiers l'utilisent en cheville, les cuisiniers en bouillon."
- id: sel_pot_moutarde_ducal
  name: Pot de Moutarde Ducal
  category: resource
  rarity: rare
  sellValue: 140
  description: "Moutarde de la maison ducale, scellée à la cire verte. Sert d'ingrédient, de tribut et, en cas de nécessité diplomatique, de monnaie."
```

### 4.2 Consommables (2)

```yaml
- id: sel_bouillon_tiede
  name: Bouillon Tiède
  category: consumable
  rarity: common
  sellValue: 35
  healHp: 110
  description: "Bouillon de fane et de gros sel, servi tiède par principe. L'Ordre soutient qu'un bouillon brûlant manque d'humilité."
- id: sel_soupe_a_la_grimace
  name: Soupe à la Grimace
  category: consumable
  rarity: uncommon
  sellValue: 65
  healHp: 190
  description: "Soupe épaisse où flotte un poireau bleu. Elle soigne, et elle laisse un souvenir qui soigne moins."
```

### 4.3 Clé de donjon (1)

```yaml
- id: cle_donjon_terres_du_sel_a_vie
  name: Clef de la Marmite Royale
  category: key
  rarity: uncommon
  sellValue: 85
  targetDungeonId: sel_donjon_marmite_royale
  description: "Une louche dont le manche a été tordu en forme de clef par le Duc lui-même, ce qu'il rappelle à chaque serrure."
```

### 4.4 Amélioration de navire (1)

```yaml
- id: sel_coque_chene_et_os
  name: Coque de Chêne-et-d'Os
  category: shipUpgrade
  rarity: rare
  sellValue: 0
  unlocksIsland: detroit_des_cloches_sonnees
  description: "Coque assemblée en chêne flotté et chevillée en os à moelle salé. Elle tient la mer et, accessoirement, elle sonne creux — ce qui ouvre la route du Détroit des Cloches Sonnées."
```

## 5. Armes

| ID | Nom | Type | Niv. | PA | Portée | CC (taux/bonus) | Dégâts | Stats | Condition |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `sel_arc_brin_de_paille` | Arc en Brin de Paille | `bow` | 22 | 4 | 2–6 | 30 % / +7 | Air 13–19 | Agi 18–32, Crit 2–4, Init 40–80 | Agilité ≥ 45 |
| `sel_baton_poireau_geant` | Bâton Poireau Géant | `staff` | 26 | 4 | 1–1 | 40 % / +8 | Feu 16–23 | Int 20–36, Sag 12–22, Dégâts fixes 2–4 | Intelligence ≥ 55 |
| `sel_hache_de_boucher_sale` | Hache de Boucher Salé | `axe` | 30 | 4 | 1–1 | 35 % / +10 | Terre 19–27 + Neutre 6–9 | For 22–40, Vita 20–35, Crit 2–3 | Force ≥ 65 |
| `sel_epee_louche_royale` | Épée Louche Royale | `sword` | 34 | 4 | 1–1 | 40 % / +9 | Eau 20–29 (vol de vie) | Cha 24–42, PP 12–22, Vita 22–38 | Chance ≥ 70 |

```yaml
id: sel_arc_brin_de_paille
name: Arc en Brin de Paille
weaponType: bow
level: 22
apCost: 4
minRange: 2
maxRange: 6
critRate: 30
critBonus: 7
damageLines:
  - { element: air, min: 13, max: 19 }
stats:
  agility: { min: 18, max: 32 }
  crit: { min: 2, max: 4 }
  initiative: { min: 40, max: 80 }
conditions:
  - { stat: agility, min: 45 }
```

```yaml
id: sel_baton_poireau_geant
name: Bâton Poireau Géant
weaponType: staff
level: 26
apCost: 4
minRange: 1
maxRange: 1
critRate: 40
critBonus: 8
damageLines:
  - { element: fire, min: 16, max: 23 }
stats:
  intelligence: { min: 20, max: 36 }
  wisdom: { min: 12, max: 22 }
  flatDamage: { min: 2, max: 4 }
conditions:
  - { stat: intelligence, min: 55 }
```

```yaml
id: sel_hache_de_boucher_sale
name: Hache de Boucher Salé
weaponType: axe
level: 30
apCost: 4
minRange: 1
maxRange: 1
critRate: 35
critBonus: 10
damageLines:
  - { element: earth, min: 19, max: 27 }
  - { element: neutral, min: 6, max: 9 }
stats:
  strength: { min: 22, max: 40 }
  vitality: { min: 20, max: 35 }
  crit: { min: 2, max: 3 }
conditions:
  - { stat: strength, min: 65 }
```

```yaml
id: sel_epee_louche_royale
name: Épée Louche Royale
weaponType: sword
level: 34
apCost: 4
minRange: 1
maxRange: 1
critRate: 40
critBonus: 9
damageLines:
  - { element: water, min: 20, max: 29, lifesteal: true }
stats:
  chance: { min: 24, max: 42 }
  prospection: { min: 12, max: 22 }
  vitality: { min: 22, max: 38 }
conditions:
  - { stat: chance, min: 70 }
```

## 6. Équipements et panoplies

| Pièce | Nom | Slot | Niv. | Panoplie |
| --- | --- | --- | --- | --- |
| `sel_anneau_sel_fin` | Anneau de Sel Fin | ring | 22 | Cul-Salé |
| `sel_ceinture_marais_salant` | Ceinture des Marais Salants | belt | 23 | Cul-Salé |
| `sel_cape_toile_saumure` | Cape en Toile de Saumure | cloak | 24 | Cul-Salé |
| `sel_coiffe_cul_sale` | Coiffe Cul-Salé | hat | 25 | Cul-Salé |
| `sel_bottes_mariniere_salee` | Bottes Marinière Salée | boots | 26 | Cul-Salé |
| `sel_amulette_bouillon_cube` | Amulette du Bouillon-Cube | amulet | 30 | Chou-Fleur-de-Lys |
| `sel_cape_feuille_de_chou` | Cape Feuille-de-Chou | cloak | 31 | Chou-Fleur-de-Lys |
| `sel_ceinture_tablier_chef` | Ceinture Tablier de Chef | belt | 32 | Chou-Fleur-de-Lys |
| `sel_coiffe_chou_fleur` | Coiffe Chou-Fleur | hat | 33 | Chou-Fleur-de-Lys |
| `sel_bottes_sabots_potager` | Bottes Sabots du Potager | boots | 34 | Chou-Fleur-de-Lys |
| `sel_anneau_grain_de_sel` | Anneau Grain-de-Sel | ring | 27 | hors-panoplie |
| `sel_amulette_dent_de_cochon` | Amulette Dent-de-Cochon | amulet | 28 | hors-panoplie |
| `sel_coiffe_passoire_cuivre` | Coiffe Passoire-de-Cuivre | hat | 32 | hors-panoplie |

### 6.1 Panoplie Cul-Salé — `sel_set_cul_sale`

```yaml
- id: sel_anneau_sel_fin
  name: Anneau de Sel Fin
  slot: ring
  level: 22
  setId: sel_set_cul_sale
  stats:
    chance: { min: 15, max: 26 }
    prospection: { min: 8, max: 16 }
- id: sel_ceinture_marais_salant
  name: Ceinture des Marais Salants
  slot: belt
  level: 23
  setId: sel_set_cul_sale
  stats:
    chance: { min: 16, max: 28 }
    vitality: { min: 15, max: 28 }
    prospection: { min: 8, max: 15 }
- id: sel_cape_toile_saumure
  name: Cape en Toile de Saumure
  slot: cloak
  level: 24
  setId: sel_set_cul_sale
  stats:
    chance: { min: 18, max: 32 }
    vitality: { min: 18, max: 30 }
    flatDamage: { min: 2, max: 4 }
- id: sel_coiffe_cul_sale
  name: Coiffe Cul-Salé
  slot: hat
  level: 25
  setId: sel_set_cul_sale
  stats:
    chance: { min: 20, max: 35 }
    vitality: { min: 18, max: 32 }
    prospection: { min: 10, max: 18 }
- id: sel_bottes_mariniere_salee
  name: Bottes Marinière Salée
  slot: boots
  level: 26
  setId: sel_set_cul_sale
  stats:
    chance: { min: 20, max: 34 }
    vitality: { min: 16, max: 30 }
    initiative: { min: 45, max: 85 }
```

```yaml
- id: sel_set_cul_sale
  name: Panoplie Cul-Salé
  pieceIds:
    - sel_anneau_sel_fin
    - sel_ceinture_marais_salant
    - sel_cape_toile_saumure
    - sel_coiffe_cul_sale
    - sel_bottes_mariniere_salee
  bonusesByCount:
    2: { chance: 15, prospection: 10 }
    3: { chance: 28, prospection: 18, vitality: 20 }
    4: { chance: 40, prospection: 25, vitality: 32, initiative: 60 }
    5: { chance: 55, prospection: 35, vitality: 45, pm: 1 }
```

### 6.2 Panoplie Chou-Fleur-de-Lys — `sel_set_chou_fleur_de_lys`

```yaml
- id: sel_amulette_bouillon_cube
  name: Amulette du Bouillon-Cube
  slot: amulet
  level: 30
  setId: sel_set_chou_fleur_de_lys
  stats:
    intelligence: { min: 20, max: 36 }
    wisdom: { min: 15, max: 26 }
    flatDamage: { min: 2, max: 4 }
- id: sel_cape_feuille_de_chou
  name: Cape Feuille-de-Chou
  slot: cloak
  level: 31
  setId: sel_set_chou_fleur_de_lys
  stats:
    intelligence: { min: 22, max: 38 }
    vitality: { min: 22, max: 38 }
    wisdom: { min: 12, max: 22 }
- id: sel_ceinture_tablier_chef
  name: Ceinture Tablier de Chef
  slot: belt
  level: 32
  setId: sel_set_chou_fleur_de_lys
  stats:
    intelligence: { min: 22, max: 40 }
    vitality: { min: 20, max: 36 }
    flatDamage: { min: 3, max: 5 }
- id: sel_coiffe_chou_fleur
  name: Coiffe Chou-Fleur
  slot: hat
  level: 33
  setId: sel_set_chou_fleur_de_lys
  stats:
    intelligence: { min: 25, max: 44 }
    wisdom: { min: 16, max: 28 }
    vitality: { min: 24, max: 42 }
- id: sel_bottes_sabots_potager
  name: Bottes Sabots du Potager
  slot: boots
  level: 34
  setId: sel_set_chou_fleur_de_lys
  stats:
    intelligence: { min: 24, max: 42 }
    vitality: { min: 24, max: 40 }
    wisdom: { min: 14, max: 25 }
```

```yaml
- id: sel_set_chou_fleur_de_lys
  name: Panoplie Chou-Fleur-de-Lys
  pieceIds:
    - sel_amulette_bouillon_cube
    - sel_cape_feuille_de_chou
    - sel_ceinture_tablier_chef
    - sel_coiffe_chou_fleur
    - sel_bottes_sabots_potager
  bonusesByCount:
    2: { intelligence: 15, wisdom: 10 }
    3: { intelligence: 30, wisdom: 18, vitality: 25 }
    4: { intelligence: 45, wisdom: 25, vitality: 45, flatDamage: 4 }
    5: { intelligence: 60, wisdom: 35, vitality: 65, flatDamage: 6, pa: 1 }
```

### 6.3 Pièces hors-panoplie

```yaml
- id: sel_anneau_grain_de_sel
  name: Anneau Grain-de-Sel
  slot: ring
  level: 27
  setId: null
  stats:
    strength: { min: 16, max: 28 }
    agility: { min: 16, max: 28 }
    crit: { min: 2, max: 4 }
- id: sel_amulette_dent_de_cochon
  name: Amulette Dent-de-Cochon
  slot: amulet
  level: 28
  setId: null
  stats:
    strength: { min: 22, max: 38 }
    vitality: { min: 20, max: 36 }
    percentDamage: { min: 8, max: 16 }
- id: sel_coiffe_passoire_cuivre
  name: Coiffe Passoire-de-Cuivre
  slot: hat
  level: 32
  setId: null
  stats:
    agility: { min: 24, max: 42 }
    po: { min: 1, max: 1 }
    initiative: { min: 60, max: 110 }
```

## 7. Recettes de craft (22)

```text
cle_donjon_terres_du_sel_a_vie ← sel_gros_sel_gris×4, sel_cube_bouillon_ancien×3, sel_louche_tordue×2
sel_bouillon_tiede ← sel_fane_saline×3, sel_gros_sel_gris×2
sel_soupe_a_la_grimace ← sel_cube_bouillon_ancien×2, sel_fane_saline×3, sel_poireau_mutant×1
sel_coque_chene_et_os ← sel_pot_moutarde_ducal×1, sel_bois_flotte_sale×8, sel_os_a_moelle_sale×4, sel_couenne_cristallisee×6
sel_fruit_grain_de_sel ← sel_pot_moutarde_ducal×5, sel_poireau_mutant×4, sel_os_a_moelle_sale×4, sel_gros_sel_gris×15
sel_anneau_sel_fin ← sel_gros_sel_gris×5, sel_fane_saline×4
sel_ceinture_marais_salant ← sel_gros_sel_gris×6, sel_paille_humide×5, sel_bec_encroute×2
sel_cape_toile_saumure ← sel_plume_saumuree×8, sel_tissu_epouvantail×3, sel_gros_sel_gris×5
sel_coiffe_cul_sale ← sel_plume_saumuree×8, sel_tissu_epouvantail×4, sel_bec_encroute×3
sel_bottes_mariniere_salee ← sel_couenne_cristallisee×4, sel_bois_flotte_sale×4, sel_gros_sel_gris×6
sel_amulette_bouillon_cube ← sel_cube_bouillon_ancien×6, sel_louche_tordue×3, sel_poireau_mutant×1
sel_cape_feuille_de_chou ← sel_fane_saline×10, sel_tissu_epouvantail×4, sel_poireau_mutant×2
sel_ceinture_tablier_chef ← sel_tissu_epouvantail×5, sel_louche_tordue×4, sel_cube_bouillon_ancien×5
sel_coiffe_chou_fleur ← sel_fane_saline×10, sel_poireau_mutant×3, sel_pot_moutarde_ducal×1
sel_bottes_sabots_potager ← sel_bois_flotte_sale×6, sel_couenne_cristallisee×5, sel_pot_moutarde_ducal×1
sel_anneau_grain_de_sel ← sel_gros_sel_gris×8, sel_bec_encroute×3, sel_os_a_moelle_sale×1
sel_amulette_dent_de_cochon ← sel_couenne_cristallisee×6, sel_os_a_moelle_sale×2, sel_gros_sel_gris×5
sel_coiffe_passoire_cuivre ← sel_louche_tordue×5, sel_bec_encroute×4, sel_poireau_mutant×2
sel_arc_brin_de_paille ← sel_paille_humide×6, sel_bois_flotte_sale×4, sel_plume_saumuree×5
sel_baton_poireau_geant ← sel_poireau_mutant×2, sel_cube_bouillon_ancien×6, sel_bois_flotte_sale×4
sel_hache_de_boucher_sale ← sel_couenne_cristallisee×6, sel_os_a_moelle_sale×3, sel_bois_flotte_sale×5
sel_epee_louche_royale ← sel_louche_tordue×6, sel_os_a_moelle_sale×3, sel_pot_moutarde_ducal×1
```

## 8. Donjon et Fruit d'Écho

```yaml
id: sel_donjon_marmite_royale
name: La Marmite Royale
recommendedLevel: 32
keyItemId: cle_donjon_terres_du_sel_a_vie
rooms:
  - id: sel_salle_potager_inonde
    name: Le Potager Inondé
    monsters:
      - { monsterId: sel_navet_navrant, quantity: 2 }
      - { monsterId: sel_mouette_a_sel, quantity: 1 }
  - id: sel_salle_bassins_saumure
    name: Les Bassins de Saumure
    monsters:
      - { monsterId: sel_mouette_a_sel, quantity: 1 }
      - { monsterId: sel_epouvantail_trempe, quantity: 2 }
      - { monsterId: sel_marmiton_bouillon, quantity: 1 }
  - id: sel_salle_saloir_fortifie
    name: Le Saloir Fortifié
    monsters:
      - { monsterId: sel_epouvantail_trempe, quantity: 1 }
      - { monsterId: sel_marmiton_bouillon, quantity: 1 }
      - { monsterId: sel_sanglier_saumure, quantity: 2 }
  - id: sel_salle_cuisine_duc
    name: La Cuisine du Duc
    isBossRoom: true
    monsters:
      - { monsterId: sel_boss_duc_moutarde, quantity: 1 }
      - { monsterId: sel_marmiton_bouillon, quantity: 1 }
      - { monsterId: sel_sanglier_saumure, quantity: 1 }
      - { monsterId: sel_mouette_a_sel, quantity: 1 }
```

### Salle 2 — « Les Bassins de Saumure »

```
############
#..P....M..#
#.P.~~~~.M.#
#..#....#..#
#..~....~..#
#...#..#...#
#...#..#...#
#..~....~..#
#..#....#..#
#.P.~~~~.M.#
#..P....M..#
############
```

### Salle 4 — « La Cuisine du Duc »

```
############
#P...##...M#
#.P..~~..M.#
#...~..~...#
#.#......#.#
#..~....~..#
#..~....~..#
#.#......#.#
#...~..~...#
#.P..~~..M.#
#P...##...M#
############
```

### Fruit d'Écho — `sel_fruit_grain_de_sel`

```yaml
id: sel_fruit_grain_de_sel
name: Fruit du Grain-de-Sel
description: "Un grain de sel de la taille d'un poing, tiède et légèrement sucré. Il se dépose sur la langue sans un bruit et laisse un goût de procès-verbal."
obtention:
  - { type: drop, monsterId: sel_boss_duc_moutarde, baseDropRate: 0.04, ppThreshold: 180 }
  - { type: craft, recipeId: sel_fruit_grain_de_sel }
passive:
  trigger: onAfterDamageApplied
  condition: "cible ennemie, non déclenché ce tour"
  effect: "Marque le tour comme consommé puis tente un retrait de 1 PM sur la cible (jet d'esquive 1.29 par Sagesse). Une seule tentative par tour, quel que soit le nombre de cibles touchées."
signatureSpellId: sel_spell_addition_salee
```

```yaml
id: sel_spell_addition_salee
name: Addition Salée
apCost: 4
minRange: 1
maxRange: 5
requiresLos: true
cooldown: 3
maxPerTurn: 1
maxPerTarget: 1
zone: { type: circle, size: 1 }
kind: glyph
element: water
minValue: 14
maxValue: 20
effects:
  - { type: glyphDurationTurns, value: 2, durationTurns: 2 }
  - { type: pmLoss, value: 1, durationTurns: 1 }
description: "Le porteur renverse la salière du monde. Un cercle de sel se dessine, la note tombe pendant deux tours, et personne ne discute l'addition."
```

Lore : le figuier salin pousse dans les bassins abandonnés, les racines dans la saumure et les branches au sec. Ses fruits ne mûrissent que les années de procès, ce qui, aux Terres du Sel-à-Vie, ne laisse pas beaucoup de repos au figuier. Le duc en revendique la propriété ; l'Ordre affirme qu'il pousse « par la grâce du Bouillon », ce qui n'engage que lui.

## 9. PNJ et quêtes

*Note de transcription : les valeurs chiffrées, structures et étapes de quête ci-dessous sont celles du dossier. Le texte des répliques (idle et dialogues) est la version de travail du dossier de design et se recale mot pour mot sur la fiche utilisateur lors de la transcription finale — aucune autre valeur n'est concernée.*

### `sel_npc_alain_gourmand` — Alain Gourmand

- **Rôle** : paludier philosophe, récoltant de sel et donneur de quête d'entrée de l'île.
- **Emplacement** : Terres du Sel-à-Vie, marais nord, bassin de la Fane Grise.
- **Personnalité** : lent, sentencieux, persuadé que le sel est une forme de vérité qu'on marchande mal.

```yaml
id: sel_npc_alain_gourmand
name: Alain Gourmand
role: questgiver
locationId: sel_bassin_fane_grise
dialogue:
  idle:
    - "Le sel ne ment pas. Il pique, c'est sa façon d'être honnête."
    - "J'ai réfléchi vingt ans au sel. J'en suis à la conclusion qu'il faut encore réfléchir."
    - "Les moulins tournent à l'envers ici. Ça n'a jamais dérangé personne, sauf les moulins."
```

### `sel_npc_barbe_a_papa` — Maître Pot-au-Feu

- **Rôle** : charpentier-cuisinier déchu, réparateur de coques et gardien du second palier de l'île.
- **Emplacement** : Terres du Sel-à-Vie, chantier du Saloir Fortifié.
- **Personnalité** : bougon, méthodique, mettant les bateaux et les ragoûts dans la même catégorie d'objet réparable.

```yaml
id: sel_npc_barbe_a_papa
name: Maître Pot-au-Feu
role: questgiver
locationId: sel_chantier_saloir_fortifie
dialogue:
  idle:
    - "Une coque, c'est une marmite qui flotte. À partir de là, tout s'éclaire."
    - "J'ai été quelqu'un de bien, dans la restauration. Puis j'ai goûté ma propre soupe."
    - "Le Duc taxe le bois flotté. Le bois flotté, note bien : il flotte, il est à personne, et il est taxé."
```

### `sel_quest_mettre_son_grain_de_sel` — « Mettre son Grain de Sel »

```yaml
id: sel_quest_mettre_son_grain_de_sel
name: Mettre son Grain de Sel
giverNpcId: sel_npc_alain_gourmand
recommendedLevel: 18
prerequisiteQuestId: null
summary: "Alain Gourmand veut prouver à l'Ordre qu'un paludier sait encore faire du bouillon sans passer par la théologie. Il lui faut des navets, du sel et une soupe qui tienne debout."
steps:
  - { type: kill_monsters, monsterId: sel_navet_navrant, quantity: 5 }
  - { type: collect_items, itemId: sel_gros_sel_gris, quantity: 6, consumeItems: true }
  - { type: craft_item, itemId: sel_bouillon_tiede, quantity: 1 }
  - { type: talk_to_npc, npcId: sel_npc_alain_gourmand }
dialogue:
  intro:
    - { npcId: sel_npc_alain_gourmand, text: "Tu vois ces navets là-bas ? Ils ont des racines, donc des convictions." }
    - { npcId: sel_npc_alain_gourmand, text: "Cinq navets. Six gros sel. Et un bouillon correct, pas une eau trouble avec des idées." }
    - { npcId: sel_npc_alain_gourmand, text: "Si l'Ordre demande, tu diras que c'est de la philosophie appliquée. Ils n'osent pas contredire ça." }
  inProgress:
    - { npcId: sel_npc_alain_gourmand, text: "Le sel attend. Le sel est très patient, c'est son seul défaut." }
    - { npcId: sel_npc_alain_gourmand, text: "Six parts de gros sel, consommées dans le bouillon. Une soupe sans sel, c'est un discours sans fin." }
  completion:
    - { npcId: sel_npc_alain_gourmand, text: "Ça sent le bouillon honnête. Tiède, comme il se doit." }
    - { npcId: sel_npc_alain_gourmand, text: "Prends la clef de la Marmite, et deux soupes. La seconde est pour quand la première aura posé des questions." }
rewards:
  xp: 1200
  kamas: 320
  items:
    - { itemId: cle_donjon_terres_du_sel_a_vie, quantity: 1 }
    - { itemId: sel_soupe_a_la_grimace, quantity: 2 }
```

### `sel_quest_la_moutarde_monte` — « La Moutarde qui Monte au Nez »

```yaml
id: sel_quest_la_moutarde_monte
name: La Moutarde qui Monte au Nez
giverNpcId: sel_npc_barbe_a_papa
recommendedLevel: 30
prerequisiteQuestId: sel_quest_mettre_son_grain_de_sel
summary: "Pot-au-Feu veut une coque pour sortir de l'archipel avant que le Duc ne taxe l'air. Il faut passer par la Marmite Royale, puis recycler la moutarde ducale en coque."
steps:
  - { type: clear_dungeon, dungeonId: sel_donjon_marmite_royale }
  - { type: craft_item, itemId: sel_coque_chene_et_os, quantity: 1 }
  - { type: talk_to_npc, npcId: sel_npc_barbe_a_papa }
dialogue:
  intro:
    - { npcId: sel_npc_barbe_a_papa, text: "La Marmite Royale, quatre salles. Le Duc au fond, dans sa cuisine, avec son pot de moutarde." }
    - { npcId: sel_npc_barbe_a_papa, text: "Rapporte-moi de quoi faire une coque en chêne et en os. Le sel tient les chevilles mieux que la poix." }
    - { npcId: sel_npc_barbe_a_papa, text: "Et ne discute pas le prix avec lui. Il facture les mots." }
  inProgress:
    - { npcId: sel_npc_barbe_a_papa, text: "Quatre salles, une coque. Ce n'est pas de la menuiserie, c'est de la liturgie." }
    - { npcId: sel_npc_barbe_a_papa, text: "Il te manque du pot de moutarde, ou du bois. Les deux se volent, mais différemment." }
  completion:
    - { npcId: sel_npc_barbe_a_papa, text: "Voilà une coque. Elle sonne creux, c'est normal : elle est faite pour aller là où les cloches sonnent." }
    - { npcId: sel_npc_barbe_a_papa, text: "Tiens, de la moutarde et un anneau. La moutarde pour le pain, l'anneau pour le doigt. Ne les inverse pas." }
rewards:
  xp: 2800
  kamas: 650
  items:
    - { itemId: sel_pot_moutarde_ducal, quantity: 1 }
    - { itemId: sel_anneau_grain_de_sel, quantity: 1 }
```

## 10. Écarts avec le modèle de données

Les écarts **communs** (`pa`/`pm` vs `ap`/`mp`, `sellValue`/`sellPrice`, `healHp`/`heal`, `slot: ring`, `setId: null`, stats en fourchettes, `bonusesByCount` 2→5, `drops`/`loot`, champs de sorts, résistances négatives, `description` obligatoire, `category` absent, `rarity`, `key`/`shipUpgrade` hors union, `crit`/`initiative`/`flatDamage`/`percentDamage` non reconnus et supprimés silencieusement) sont documentés une fois pour toutes dans `docs/design/islands/ile_de_la_ferraille.md` §10 et s'appliquent **à l'identique** ici. Seuls les écarts **nouveaux** sont listés ci-dessous.

**Précision vérifiée, non numérotée** : `checkSetSlot` (`src/schemas/itemSchema.ts`) n'autorise une pièce de panoplie qu'en `hat`/`cloak`/`amulet`/`boots`. La panoplie **Cul-Salé** contient une `ring` (`sel_anneau_sel_fin`) et une `belt` (`sel_ceinture_marais_salant`) : elle est rejetée au parse même après résolution de l'écart 6 de la Ferraille. À traiter avec le même chantier.

19. **`sel_spell_faux_mouvement` introduit `pullCells`** (attirance 2). Vérifié : aucun effet d'attraction n'existe, ni dans `spellSchema` (`src/schemas/spellSchema.ts` ne connaît que `pushCells`), ni dans le moteur (`pushCells` est le seul déplacement forcé consommé). C'est un nouvel effet, et le sens opposé de `pushCells` : la résolution (collision, dégâts de poussée, `breakOnWallPush`) doit être partagée, pas dupliquée.
20. **`sel_spell_pincee_de_poivre` introduit `poLoss: 2`** (retrait de **portée**, 2 tours). Concept inédit : `CombatantState` (`src/engine/combatLoop/types.ts`) ne porte **aucun** champ de portée modifiable (ni `range`, ni `po`), et `spellSchema` n'a aucun effet de réduction de portée. Il faut d'abord doter l'état de combat d'une portée effective dérivée de l'arme et des buffs, puis un effet qui la réduit temporairement.
21. **`zone: { type: circle, size: 2 }`** (rayon **2**) sur `sel_spell_glyphe_de_moutarde`, et `zone` sur `vent_de_panique` (`cross`), `eclaboussure_bouillante` (`circle` 1) et `addition_salee`. Vérifié : **aucune zone n'existe** dans le schéma ni dans le moteur aujourd'hui (`spellSchema` n'a pas de clé `zone`, `spellEffectSchema.target` ne décrit qu'une intention). Même en Vague 6, il faudra trancher explicitement que `size` est un **rayon** (3×3 pour `circle 1`, 5×5 pour `circle 2`) et non un diamètre, sinon les dégâts doublent silencieusement de surface.
22. **`sel_spell_glyphe_de_moutarde` combine `isGlyph` + `glyphDurationTurns` + `pmLoss` + une zone.** Le modèle `effect` actuel est un **objet unique** (non une liste) et n'est pas consommé par le moteur : insuffisant pour un glyphe à effet périodique (dégâts Terre **et** −1 PM en début de tour, pendant 2 tours). Il faut un effet composé et un état de zone persistant sur la grille, plus la résolution au début de tour — chantier 6A complet.
23. **`sel_spell_moutarde_qui_monte` introduit `percentDamageBonus: 25`.** Aucun bonus de dommages **temporaire** n'existe dans `CombatantState` : ni `damageBonus`, ni `percentDamageBonus`, ni pile de buffs avec durée. À noter que `itemStatsSchema` connaît `percentDmg` (permanent, équipement) — deux notions voisines à ne pas confondre dans le moteur.
24. **Stat `po`** (portée) sur `sel_coiffe_passoire_cuivre`. `itemStatsSchema` ne connaît aucune stat de portée (`vitality`, `wisdom`, `strength`, `intelligence`, `chance`, `agility`, `hp`, `ap`, `mp`, `percentDmg`, `flatRes`, `percentRes`, `prospection`). Même prérequis que l'écart 20 : une portée effective modifiable par l'équipement, et un nom de stat à figer (`po` ou `range`).
25. **`weaponType` doit couvrir 8 types** (`dagger`, `wand`, `hammer`, `shovel`, `bow`, `staff`, `axe`, `sword`). Le schéma d'arme **n'existe pas encore** (aucun `weaponSchema` dans `src/schemas/`), mais l'enum doit être dimensionnée dès maintenant avec les 8 valeurs, dont 4 nouvelles ici (`bow`, `staff`, `axe`, `sword`). Aucune donnée métier ne doit atterrir dans un `enum` en dur dans `src/` : la liste vit dans le schéma, les valeurs dans `data/*.yaml`.
26. **Référence inter-îles cassée** : `sel_coque_chene_et_os` débloque `detroit_des_cloches_sonnees`, qui **n'existe pas** — `data/islands.yaml` n'existe pas (vérifié) et aucune île de ce nom n'est référencée ailleurs. C'est une dépendance d'**ordre de livraison** entre lots de contenu : soit le Détroit arrive avant ou avec l'amélioration, soit `unlocksIsland` accepte une cible déclarée plus tard (référence faible), ce qui doit être décidé et testé.
27. **`sel_anneau_sel_fin` est à la fois un drop de monstre et une pièce d'équipement** (`ring`, panoplie Cul-Salé, et ingrédient indirect de craft). C'est exactement le même schéma croisé que `fer_anneau_mazoute` : une seule entité `items` doit satisfaire le butin (`lootEntrySchema.itemId`) **et** l'équipement (`equipmentItemSchema`), et le craft doit pouvoir la produire **sans** dupliquer l'id. À traiter **une seule fois** pour les deux îles, pas deux fois.

## 11. Ordre d'implémentation recommandé

1. **Vague 5A** (schémas contenu) : `dungeon` / `npc` / `quest` — partagé avec l'Île de la Ferraille, aucun schéma nouveau propre à cette île. Les 2 grilles de ce dossier ne demandent qu'un `id` snake_case, un `name`, `width: 12` et `height: 12`.
2. **Vague 6A** (moteur d'effets) : zones (`cross`/`circle`, `size` = **rayon**), glyphes à effet périodique, `pullCells`, `poLoss`, bonus temporaires (`percentDamageBonus`, `pmBuff`), `shield`, `summon`. **Trois de ces effets sont des ajouts purs à ceux de l'Île 1** (`pullCells`, `poLoss`, glyphes) : ils s'implémentent après `6A-island-ferraille-spells`, pas en parallèle, sinon deux moteurs d'effets divergent.
3. **Vague 6A** (Fruits d'Écho) : `sel_fruit_grain_de_sel`, passif `onAfterDamageApplied` (marquage par tour + retrait de 1 PM avec jet d'esquive 1.29). Le passif de la Ferraille est `onBeforeApplyPush` : les deux hooks cohabitent, le pipeline de passifs doit être générique.
4. **Vague 6B** (équipement/armes) : fourchettes de stats, `ring`/`belt` en panoplie (précision §10), paliers 5 pièces, stat `po`, 4 armes et leurs `weaponType` sur 8 valeurs.
5. **Vague 7B** (contenu) : bestiaire, 17 sorts de monstre, 22 recettes, 2 quêtes, donjon 4 salles et ses 2 grilles.

**Dépendance dure : cette île dépend de l'Île 1.** `fer_voiles_fortune_de_pot` doit exister dans `data/items.yaml` (catégorie `shipUpgrade`) pour que l'île soit atteignable, et trois des nouveaux effets (`pullCells`, `poLoss`, glyphes) viennent s'ajouter — et non remplacer — ceux de l'Île de la Ferraille. Livrer Sel-à-Vie avant Ferraille produirait une île inatteignable et un moteur d'effets à moitié écrit deux fois.

## 12. Tâches et dettes prêtes à coller

⚠️ **Collision d'identifiants existante.** `D27` et `D28` ont été attribués **deux fois** : une première fois par le lot 4B (kamas non modélisés / tables de butin non snapshotées) et une seconde fois par la spec de l'Île de la Ferraille (`plume_mazoutee` redéfini / `bec_mazoute` orphelin). Aucun des deux usages n'est libéré à ce jour. En conséquence : **`D29` est laissé libre** pour porter la résolution de cette collision (renumérotation ou préfixage par lot), et **toutes les dettes de ce dossier commencent à `D30`**. Ne pas renuméroter au passage : la collision se règle une fois, en `D29`.

Bloc prêt à coller. Le fichier `docs/design/backlog.yaml` appartient à une autre PR : rien n'est appliqué ici. Les 4 tâches suivent le **format tâche** (`id`, `title`, `status`, `owner`, `priority`, `updated_at`, `depends_on`) et vont dans `waves[].phases[].tasks[]` ; les 9 dettes suivent le **format dette** (`id`, `title`, `severity`, `target`) et vont dans `debts[]`.

```yaml
# --- waves[wave-6].phases[6A].tasks ---
- id: 6A-island-sel-spells
  title: 17 sorts de monstre — pullCells, poLoss (retrait de PO), percentDamageBonus, glyphes à effet périodique, zone circle rayon 2
  status: todo
  owner: tdd-coder
  priority: high
  updated_at: "2026-11-22"
  depends_on: [6A-island-ferraille-spells]
- id: 6A-island-sel-fruit
  title: Fruit du Grain-de-Sel — passif onAfterDamageApplied (1 tentative de −1 PM par tour) et Addition Salée
  status: todo
  owner: tdd-coder
  priority: high
  updated_at: "2026-11-22"
  depends_on: [6A-island-sel-spells]

# --- waves[wave-6].phases[6B].tasks ---
- id: 6B-island-sel-equipment
  title: 13 pièces, 2 panoplies 5 pièces (dont ring/belt), stat po, 4 armes bow/staff/axe/sword
  status: todo
  owner: tdd-coder
  priority: high
  updated_at: "2026-11-22"
  depends_on: [6A-island-sel-spells]

# --- waves[wave-7].phases[7B].tasks ---
- id: 7B-island-sel-content
  title: Contenu Terres du Sel-à-Vie — bestiaire, 22 recettes, 2 quêtes, donjon Marmite Royale et ses 2 grilles
  status: todo
  owner: tdd-coder
  priority: medium
  updated_at: "2026-11-22"
  depends_on: [6B-island-sel-equipment, 6A-island-sel-fruit]

# --- debts ---
- id: D30
  title: pullCells (attirance) absent du schéma et du moteur — partager la résolution avec pushCells
  severity: high
  target: 6A
- id: D31
  title: poLoss (retrait de portée) sans représentation — CombatantState n'a aucune portée modifiable
  severity: high
  target: 6A
- id: D32
  title: zones (cross/circle) inexistantes — figer size comme un rayon (circle 2 = 5×5) avant implémentation
  severity: medium
  target: 6A
- id: D33
  title: glyphe de moutarde (isGlyph + glyphDurationTurns + pmLoss + zone) impossible avec un effect unique non consommé
  severity: high
  target: 6A
- id: D34
  title: percentDamageBonus temporaire absent de CombatantState — ne pas confondre avec percentDmg d'équipement
  severity: medium
  target: 6A
- id: D35
  title: stat po (portée) inconnue d'itemStatsSchema
  severity: medium
  target: 6B
- id: D36
  title: weaponType à dimensionner sur 8 valeurs (dagger, wand, hammer, shovel, bow, staff, axe, sword) avant tout schéma d'arme
  severity: medium
  target: 6B
- id: D37
  title: sel_coque_chene_et_os débloque detroit_des_cloches_sonnees, île inexistante (data/islands.yaml absent) — ordre de livraison à trancher
  severity: high
  target: 7B
- id: D38
  title: sel_anneau_sel_fin à la fois drop de monstre et pièce d'équipement — même schéma croisé que fer_anneau_mazoute, à traiter une seule fois
  severity: medium
  target: 6B
```
