import type { BattleCombatantView } from "../../../renderer/battleViewModel";
import type { CastBlock } from "../../../engine/multiCombat";
import type { AttackButtonState } from "../../battle/attackButtonState";
import {
  ACTION_BUTTON,
  ACTIVE_CARD,
  BLOCKED_HINT,
  CARD_HEAD,
  COLOR_DOT,
  COMBATANT_CARD,
  HP_FILL,
  HP_TRACK,
  STATS_LINE,
  TARGETABLE_CARD,
} from "./battleTheme";

export interface CombatantCardProps {
  view: BattleCombatantView;
  /** Le camp du héros joue : les cibles valides peuvent être attaquées. */
  canAttack: boolean;
  /** État du bouton (coût, PA, recharge), calculé une fois pour tout le panneau. */
  attack: AttackButtonState;
  onAttack: (targetId: string) => void;
}

/** Libellés des refus géométriques : le joueur voit la même raison que le journal. */
const BLOCK_LABEL: Record<CastBlock, string> = {
  "too-close": "Trop proche",
  "out-of-range": "Hors portée",
  "no-los": "Ligne de vue bloquée",
};

/** Actif (contour doré) et ciblable (anneau rouge) se cumulent sans se masquer. */
function cardClass(view: BattleCombatantView): string {
  const base = view.isTargetable ? `${COMBATANT_CARD} ${TARGETABLE_CARD}` : COMBATANT_CARD;
  return view.isActive ? `${base} ${ACTIVE_CARD}` : base;
}

function activeFlag(view: BattleCombatantView): "true" | undefined {
  return view.isActive ? "true" : undefined;
}

/** Barre de PV procédurale : largeur et teinte dérivées de la vue. */
function HpBar({ ratio, color }: { ratio: number; color: string }) {
  const width = `${Math.round(ratio * 100)}%`;
  return (
    <div className={HP_TRACK}>
      <div className={HP_FILL} style={{ width, backgroundColor: color }} />
    </div>
  );
}

function CardHead({ view }: { view: BattleCombatantView }) {
  return (
    <header className={CARD_HEAD}>
      <span className={COLOR_DOT} style={{ backgroundColor: view.color }} aria-hidden="true" />
      <span>{view.name}</span>
    </header>
  );
}

function StatsLine({ view }: { view: BattleCombatantView }) {
  return <p className={STATS_LINE}>❤ {view.hp} / {view.maxHp} · ★ {view.ap} PA · 👢 {view.mp} PM</p>;
}

interface AttackActionProps {
  view: BattleCombatantView;
  attack: AttackButtonState;
  onAttack: (targetId: string) => void;
}

/**
 * Le moteur refuserait le clic (PA manquants, recharge) : le bouton le dit
 * **avant** le clic, en attribut `disabled` et en `aria-disabled`, jamais
 * seulement par la couleur.
 */
function AttackButton({ view, attack, onAttack }: AttackActionProps) {
  if (!view.isTargetable) return null;
  return (
    <button type="button" className={ACTION_BUTTON} onClick={() => onAttack(view.id)} disabled={attack.disabled} aria-disabled={attack.disabled}>
      {attack.label}
    </button>
  );
}

/** Cible présente mais trop proche, hors portée ou sans LoS : la raison remplace le bouton. */
function BlockedHint({ view }: { view: BattleCombatantView }) {
  if (view.blockedReason === null) return null;
  return <p className={BLOCKED_HINT}>{BLOCK_LABEL[view.blockedReason]}</p>;
}

function Actions({ view, attack, onAttack }: AttackActionProps) {
  return (
    <>
      <BlockedHint view={view} />
      <AttackButton view={view} attack={attack} onAttack={onAttack} />
    </>
  );
}

function CardBody({ view, canAttack, attack, onAttack }: CombatantCardProps) {
  return (
    <>
      <CardHead view={view} />
      <StatsLine view={view} />
      <HpBar ratio={view.hpRatio} color={view.color} />
      {canAttack ? <Actions view={view} attack={attack} onAttack={onAttack} /> : null}
    </>
  );
}

export function CombatantCard({ view, canAttack, attack, onAttack }: CombatantCardProps) {
  return (
    <li className={cardClass(view)} aria-label={`Combattant ${view.name}`} aria-current={activeFlag(view)}>
      <CardBody view={view} canAttack={canAttack} attack={attack} onAttack={onAttack} />
    </li>
  );
}
