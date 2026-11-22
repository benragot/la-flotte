/**
 * Barrel **local** de l'inventaire (règle anti-conflit de la vague 4C) :
 * `src/ui/components/index.ts` n'est pas touché ici, son montage est prévu
 * en phase 4D avec le HUD de héros.
 */
export { default as InventoryPanel } from "./InventoryPanel";
export type { InventoryPanelProps } from "./InventoryPanel";
export { default as EquipmentSlots } from "./EquipmentSlots";
export { default as BackpackList } from "./BackpackList";
export { default as ConsumableBar } from "./ConsumableBar";
export { default as SetBonusPanel } from "./SetBonusPanel";
export { default as StatSummary } from "./StatSummary";
export { default as StatBadge } from "./StatBadge";
export { default as SaveControls } from "./SaveControls";
