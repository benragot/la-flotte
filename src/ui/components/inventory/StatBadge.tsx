import {
  STAT_PENDING_HINT,
  STAT_PENDING_LABEL,
  formatStatValue,
} from "../../inventoryHudHelpers";
import { CHIP, TEXT_GOLD, TEXT_MUTED, TEXT_PENDING } from "./inventoryTheme";

interface StatBadgeProps {
  label: string;
  value: number;
  pending?: boolean | undefined;
}

function toneOf(value: number, pending: boolean): string {
  if (pending) return TEXT_PENDING;
  return value > 0 ? TEXT_GOLD : TEXT_MUTED;
}

function titleOf(label: string, pending: boolean): string {
  return pending ? `${label} — ${STAT_PENDING_HINT}` : label;
}

/** Badge `label +value` ; grisé et annoté si le moteur n'applique pas la stat. */
export default function StatBadge({ label, value, pending = false }: StatBadgeProps) {
  return (
    <span className={`${CHIP} ${toneOf(value, pending)}`} title={titleOf(label, pending)}>
      {label} <strong>{formatStatValue(value)}</strong>
      {pending ? <em className="ml-1 not-italic opacity-70">{STAT_PENDING_LABEL}</em> : null}
    </span>
  );
}
