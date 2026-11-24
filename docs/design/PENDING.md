# En attente — nuit du 23-24/11

Liste de reprise, dans l'ordre donné. Pas de case à cocher : c'est un état des
lieux, pas un tableau de bord.

## Bugs constatés en jeu

1. **Bug 7** — sur `quai_02`/`cale_03`, cliquer un monstre ne déclenche **aucun**
   combat (ça marche sur la plage). *Worktree `.wt/quai`, WIP committé,
   diagnostic à reprendre.* Test de reproduction obligatoire.
2. **Bug 5** — points de caractéristiques perdus : **corrigé** (PR #130,
   `allocateAndSave`), **reste le test composé** : niveau 3 → investir 10 en Force
   → **niveau 4** → **rechargement** ⇒ Force 10 **et** `capitalPoints` 5.
3. **Soleil de sortie** — cliquer une sortie **téléporte** : le héros doit
   **marcher jusqu'au carré** puis la carte change au **clic suivant**.
4. **Survol** — surbrillance de la **case seule** ; doit couvrir **l'entité**
   (sprite + cases) et non la seule case.
5. **Barre d'XP absente** — vouloir un **%** de progression + **infobulle**
   `3432/10000` au survol.

## Décisions du propriétaire à appliquer

6. **Barre de vie** : si elle **sort du cadre**, la **descendre sous le nom** (la
   spec dit `-2.6`, c'est faux).
7. **Clic hors budget de PM** : **refus sec**, aucun déplacement (revenir sur la
   « marche partielle », réécrire `ui-dofus-retro.md` §7).
8. **`dev=true` par défaut** : XP et Prospection **×10**.

## Refontes d'interface (specs fournies)

9. **Inventaire Dofus 1.29** — spec **complète** (palette, grille 4×11, pods,
   kamas, Dofus, aperçu perso, onglets Effets/Conditions/Carac.). Découper :
   **inventaire** puis **fiche objet**.
10. **Interface des sorts** — spec **complète** (panneau fiche + panneau liste,
    niveaux 1-6, effets/critiques, autres caractéristiques).
11. **Fin de combat** — spec **INCOMPLÈTE** (le JSON s'arrête à « Moitié
    inférieure ») : **redemander la suite**. ⚠️ Note : le design suppose une
    **équipe de joueurs**, or le moteur est **1 héros vs N monstres** ⇒ écart de
    modèle à trancher.

## Règles et dettes

12. Écrire dans `AGENTS.md` une **règle 11** : tout bug constaté en jeu est
    **reproduit par un test qui rejoue les étapes du joueur**, avant tout
    correctif.
13. **Emoji** restants (`HeroVitalsLine`, `CombatantCard`) — interdit **I11** ;
    exige d'écrire dans `tests/unit`.
14. Exception **`#b83b3b`** gelée (exigée par `tests/unit/dungeonEntry.spec.ts:400`).
15. **`allocateStat`** écrit `localStorage` **à chaque point** : un bouton
    **+5/+10** serait plus juste (coût synchrone par clic).
16. **Flake** `dockTheme` observé **une fois** (navigation) — à surveiller.
17. **D103** pression 2,376 ; **D98** et **D104** soldées.
18. **`5C-hero-move`** livré (moteur + clic + tacle `D70`). Restent :
    `5C-turn-rail`, `5C-info-panel`, `5C-group-stars`, `5C-log-channel`,
    `5C-cast-preview`, `5C-hover-hp` ✅, `5C-pm-zone` ✅.
19. Dettes ouvertes : `D82` (arme sans dégâts), `D78` (pods), `D79` (récolte),
    `D80` (médaillon/chrono), `D102` (règle PM non documentée), `D105` (survol
    absent en salle de donjon).

## Suites techniques (aucun bug actif)

20. **Test composé manquant**, suite du #130 : `allocateAndSave`
    (`src/store/useGameStore.ts`) est sur `main`, mais **aucun test ne rejoue
    le scénario du joueur** — investir des points → **niveau 4** → **recharger**
    ⇒ Force **10** **et** `capitalPoints` **5** ensemble. Les tests couvrent
    chaque moitié séparément.
21. **Échec d'engagement muet** : `clickCell` → `combatUpdate` → `initCombat`
    n'a **aucun `try/catch`, aucune ligne de journal, aucun `console.error`**.
    C'est ce qui a rendu le bug du quai/cale **invisible trois heures** :
    l'exception annulait le `set`, donc aucun combat **et** aucune erreur. Le
    #132 a tué **la cause** (cartes `ferraille_quai_02`/`ferraille_cale_03` sans
    case `M` ⇒ repli sur la case praticable la plus lointaine), **pas
    l'invisibilité** : une autre erreur d'initialisation redonnerait un bouton
    mort silencieux. Une trace à l'échec = quelques lignes.
22. **Départage du repli non figé** : `farthestCell`
    (`src/engine/combatLoop/init.ts`) garde le **premier** maximum d'un parcours
    **ordonné** (y puis x), sans RNG ni tri — déterministe, mais **aucun test ne
    met deux cases à égalité**. Un refactor de l'ordre de parcours changerait la
    case de l'ennemi **sans qu'un test rougisse**, et rendrait le walkthrough
    **flaky**.
23. **`compaction.keep.tokens` à 15 000** : `opencode.jsonc` pose
    `buffer: 748576` ⇒ compaction à **300 000** tokens (fenêtre 1 048 576), mais
    on ne garde que **15 000** tokens en clair, soit **5 %** du seuil. L'audit
    suggérait **30 000** (10 %). **Non bloquant, à trancher.**
