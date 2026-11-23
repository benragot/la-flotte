import type { CombatantState } from "../../engine/combatLoop/types";
import { formatHpBar } from "../hudHelpers";
import {
  MINI_HP_FILL,
  MINI_HP_TRACK,
  TIMELINE_CARD,
  TIMELINE_CARD_ACTIVE,
} from "../uiTokens";

interface TimelineCardProps {
  combatant: CombatantState;
  isActive: boolean;
}

/** Nom : 11 / 16, capitales — une seule ligne, tronquée (§3). */
const NAME = "truncate text-[11px] font-bold uppercase leading-4 tracking-[0.08em]";

/**
 * PV : 10 / 12 monospace à chiffres tabulaires : le compteur ne saute pas d'un
 * pixel quand il passe de `9` à `10`. L'encre reste `wood-ink` — `ink-danger`
 * `#D68F87` sur le bois `#4A3728` ne donne que 4,36:1, sous le seuil du texte
 * courant. Le rouge reste porté par la mini-barre, qui est un composant.
 */
const VITALS = "font-mono text-[10px] leading-3 tabular-nums";

function cardClass(isActive: boolean): string {
  return isActive ? TIMELINE_CARD_ACTIVE : TIMELINE_CARD;
}

function cardLabel(combatant: CombatantState): string {
  return `${combatant.name}, niveau ${combatant.level}`;
}

/** Mini-barre de PV : 4 px, la largeur en `style` est la seule valeur dynamique. */
function MiniHpBar({ percent }: { percent: number }) {
  return (
    <div className={MINI_HP_TRACK}>
      <div className={MINI_HP_FILL} style={{ width: `${percent}%` }} />
    </div>
  );
}

export default function TimelineCard({ combatant, isActive }: TimelineCardProps) {
  const hp = formatHpBar(combatant.hp, combatant.maxHp);
  return (
    <article aria-label={cardLabel(combatant)} data-combatant={combatant.id} className={cardClass(isActive)}>
      <p className={NAME}>{combatant.name}</p>
      <p className={VITALS}>Niv. {combatant.level} · {hp.text} PV</p>
      <MiniHpBar percent={hp.percent} />
    </article>
  );
}
