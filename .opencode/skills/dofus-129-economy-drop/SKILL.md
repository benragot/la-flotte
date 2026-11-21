---
name: dofus-129-economy-drop
description: Référentiel économie Dofus 1.29 (XP, Sagesse, PP, drop) prêt à recevoir les courbes détaillées.
---

# Économie & Drop Dofus 1.29

## Sections à compléter

### Courbe d'XP

- XP requise par niveau (1 → 200).
- XP accordée par monstre selon niveau et écart de niveau.
- Pénalités de groupe et de haut niveau.

### Sagesse

- Gain de Sagesse par point investi et par équipement.
- Impact sur l'XP, le drop et l'esquive.

### Prospection (PP)

- Formule du taux de drop : base × (PP / 100).
- Rendements décroissants et cap.
- Répartition du butin en groupe.

### Drop

- Taux de base par ressource, condition de drop (étoiles).
- Influence de la Sagesse et de la PP.
- Butin garanti vs butin optionnel.

### Marché

- Monnaie : kamas.
- Taxes d'hôtel de vente, prix plancher.
- Sources et puits économiques de La Flotte.

## Méthode

- Toute courbe est stockée en YAML (`data/`) et validée par Zod.
- Chaque palier ajouté est couvert par un test chiffré.
- Aucune constante métier en dur dans `src/`.
