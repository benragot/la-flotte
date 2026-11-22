import { formatStatValue } from "../../inventoryHudHelpers";
import { CHIP, TEXT_GOLD, TEXT_MUTED } from "./inventoryTheme";

interface StatBadgeProps {
  label: string;
  value: number;
}

function toneOf(value: number): string {
  return value > 0 ? TEXT_GOLD : TEXT_MUTED;
}

/** Badge compact `label +value` ; doré dès que la statistique est positive. */
export default function StatBadge({ label, value }: StatBadgeProps) {
  return (
    <span className={`${CHIP} ${toneOf(value)}`}>
      {label} <strong>{formatStatValue(value)}</strong>
    </span>
  );
}
