import type { CombatState } from "../../engine/combatLoop/types";
import VitalMeter from "./VitalMeter";
import { DOCK_PANEL } from "./hudTheme";

/**
 * Les trois ressources du héros, une par ligne : libellé Dofus, chiffres
 * tabulaires, barre sous le texte. Aucune icône emoji — `❤`, `★` et `👢`
 * n'existent pas dans Dofus 1.29 et faisaient prototype.
 *
 * Une ligne par ressource plutôt qu'une seule ligne pointée : la colonne
 * `vitals` ne fait que ~150 px à 1024×768, une rangée unique y passerait à la
 * ligne de toute façon, et la barre resterait orpheline de son chiffre.
 */
function VitalRow({ combat }: { combat: CombatState }) {
  const { player } = combat;
  return (
    <div className="flex w-full min-w-0 flex-col justify-center gap-1">
      <VitalMeter label="PV" tone="hp" current={player.hp} max={player.maxHp} />
      <VitalMeter label="PA" tone="ap" current={player.ap} max={player.maxAp} />
      <VitalMeter label="PM" tone="mp" current={player.mp} max={player.maxMp} />
    </div>
  );
}

/**
 * Zone `vitals` : **uniquement** les compteurs PV/PA/PM. L'action de tour a sa
 * propre colonne (`turn`), sinon le bouton recouvre les chiffres.
 */
export default function Vitals({ combat }: { combat: CombatState }) {
  return (
    <section aria-label="Ressources du héros" className={`${DOCK_PANEL} justify-center`}>
      <VitalRow combat={combat} />
    </section>
  );
}
