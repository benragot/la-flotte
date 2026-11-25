# Direction visuelle — §11

> Le §10 de `ui-visual-direction.md` appartient à UI-05 (`#181` / `#185`).
> Ce fichier porte le §11 pour ne pas ajouter au même point de fin de fichier :
> deux ajouts distincts au même EOF rendent la PR non mergeable, et GitHub ne
> dispatche alors aucun workflow. Aucune ligne du §10 n'est touchée.

## 11. Le sac devient la bourse — écran de vente (DATA-02)

**État des lieux avant cette PR** (`play-report-avant/06-inventaire.png`).

- Le sac existe déjà : `BackpackList.tsx:63-72` liste `nom ×quantité`, et
  `BagAction` (`:49-52`) n'offre que « Équiper » aux équipements.
- Le **prix de vente** n'apparaît que dans le détail d'un objet sélectionné
  (`ItemDetailPanel.tsx:60-67`), pas dans la liste.
- **Les kamas du héros ne sont affichés nulle part** en exploration ni en
  inventaire : seules les récompenses de fin de combat les montrent
  (`RewardsSummary.tsx:36-37`). Le moteur sait vendre (`src/engine/economy/sell.ts`),
  l'action `sellItem` est dans le store, le sac n'a aucun bouton.
- Aucune touche n'ouvre le sac : seule la barre d'accès (`OverlayPanels.tsx:60`)
  le fait à la souris.

**Décision de surface.** On **étend le sac existant**, on n'ajoute ni deuxième
panneau ni deuxième palette. Une ligne du sac devient un **relevé de bord** à
deux étages :

```
┌ Sac ─────────────────────────── Bourse : 12 kamas ┐
│ Chapeau du Piou Mazouté ×3          12 kamas      │  ← nom (bouton) + prix
│ [Vendre 1] [Tout vendre]            [Équiper]     │  ← actions
│ Gourdin du matelot ×1                8 kamas      │
│ [Vendre 1]                          [Équiper]     │
│ …                                                 │
└───────────────────────────────────────────────────┘
```

- **Étage 1** : le nom reste le **bouton focusable** qui ouvre le détail
  (`aria-pressed`) ; la quantité reste collée au nom (`×3`) comme avant. Le prix
  unitaire est une **plaque mono tabulaire** à droite, `Invendable` barré quand
  `sellPrice` manque.
- **Étage 2** : « Vendre 1 » toujours présent ; « Tout vendre » **uniquement si
  la pile compte plus d'une unité** (sinon il ferait exactement la même chose :
  un bouton doublon est un clic mort). « Équiper » reste à sa place, à droite.
- La **bourse** est en tête de section, alignée à droite du titre « Sac » :
  `Bourse : 12 kamas`, `aria-live="polite"`. C'est le seul chiffre qui bouge
  après une vente, il est donc annoncé et lisible à 1024 px.
- Un bandeau d'état (`role="status"`) confirme la dernière vente :
  `Vendu : Chapeau du Piou Mazouté ×1` — **aucun montant recalculé dans
  `src/ui/`**, le crédit se lit dans la bourse (règle « afficher, pas calculer »).

Le **prix** affiché est lu dans `GAME_CATALOG.items` — la même donnée que celle
consommée par l'action `sellItem` du store ; l'interface ne recalcule ni prix ni
total, et un objet sans `sellPrice` reste affiché `Invendable`.

**Jetons réemployés** (`inventoryTheme.ts` / `uiTokens.ts`) : `BUTTON_COMPACT`
pour les trois boutons (quatre états francs, focus 2 px), `HEADING` pour les
libellés de section, `DETAIL_META` pour le bandeau d'état, `TEXT_KO` pour le
verrou de combat, `FIELD_MATERIAL` **non** employé (aucun nouveau creux).
**Jetons ajoutés, aucune couleur nouvelle** :

| Jeton | Rôle | Contraste mesuré |
|---|---|---|
| `PURSE` | `Bourse : N kamas`, 11 px mono tabulaire, `ink-1` | 9,00:1 sur `surface-2` |
| `SELL_PRICE` | prix unitaire, 10 px mono gras, `ink-2` | 7,01:1 sur `surface-2`, 5,84:1 sur la ligne sélectionnée `surface-3` |
| `SELL_PRICE_OFF` | `Invendable`, même encre + `line-through dotted` | 5,84:1 au pire |
| `BAG_ROW` / `BAG_ROW_SELECTED` | ligne à deux étages, filet or quand ouverte | — |

Les **états** sont ceux du §2.2 et d'`inventoryTheme` : repos (plaque
`surface-1`), survol (filet et encre or, `-translate-y-px`), actif
(`translate-y-px`, `surface-2`), désactivé (filet `line-field`, fond
`surface-2`, encre `btn-disabled-ink`) — **jamais une opacité** (I10). Le prix
n'est jamais un état par la couleur seule : `Invendable` porte aussi un texte et
un barré, la vente impossible en combat porte aussi une phrase.

**Arbitrage combat.** Le sac reste une **fenêtre modale** (`LAYER_SCRIM`,
`fixed`, `z-40`) : c'est la matière unique du §9, et `tests/ui/escape.spec.ts:71-75`
exige qu'il s'ouvre **pendant** un combat. Il ne peut donc pas « ne pas
recouvrir » la grille. La règle appliquée est la seconde branche de la consigne :
**vendre en pleine bataille est désactivé**. En combat (`combat` 1v1 ou `battle`
de salle), les boutons de vente sont `disabled`, un bandeau
`Vente impossible en combat` l'explique, et un clic forcé ne crédite rien
(l'action store rend l'état intact). On peut **consulter** son sac et son or en
combat — utile pour décider — mais pas transformer un objet en kamas au milieu
d'un tour.

**Clavier.** `I` ouvre le sac, `I` ou `Échap` le referme (`aria-keyshortcuts="I"`,
`title="Inventaire (I)"` sur le bouton d'accès : son **nom accessible reste
« Inventaire »**, les sélecteurs existants ne bougent pas). La touche est ignorée
dans un champ de saisie et avec un modificateur (`⌘I`, `Ctrl+I`).

**Cas couverts** (vérifiés par `tests/ui/sellPanel.spec.ts`, 3 viewports) :

| Cas | Attendu |
|---|---|
| vendre 1 sur une pile de 3 | bourse 0 → 12, ligne `×3` → `×2` |
| tout vendre | ligne disparue, bourse 12 → 36 |
| rechargement | bourse et quantité relues depuis la sauvegarde |
| combat, **sac ouvert** | boutons de vente `disabled`, bandeau de verrou, clic forcé sans crédit, boîte du canvas **identique à sac fermé** |
| objet sans `sellPrice` | prix `Invendable` barré + boutons `disabled` — **aucun objet de `data/items.yaml` n'est dans ce cas (34/34)**, la branche est en place et signalée, pas inventée |

**Captures.** `play-report-avant/06-inventaire.png` (avant) et, après, les trois
viewports visés : `play-report/06-inventaire.png` (1280×720),
`play-report-1024/06-inventaire.png` (1024×768) et
`play-report-1920/06-inventaire.png` (1920×1080), toutes produites par
`npm run play -- --viewport …`. Les chemins absolus figurent dans la PR.
Aucune image n'est versionnée, aucune capture n'est un asset du jeu.
