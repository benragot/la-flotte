import { computeProspection } from "../engine/economy";
import { equippedItems, STAT_FIELDS, isDefined } from "../engine/inventory";
import type {
  EquipmentSlot,
  InventoryState,
  ItemCategory,
  ItemLike,
  ItemStack,
  SetBonusTier,
  SetLike,
  StatBlock,
  StatField,
} from "../engine/inventory";
import { EQUIPMENT_SLOTS } from "../schemas/itemSchema";

/** Vue d'un emplacement d'équipement : huit entrées, une par slot canonique. */
export interface SlotView {
  slot: EquipmentSlot;
  label: string;
  itemName: string | null;
  setId: string | null;
}

/** Vue d'une panoplie possédée : pièces équipées, paliers atteints, suivant. */
export interface SetView {
  setId: string;
  setName: string;
  pieces: number;
  totalPieces: number;
  activePieces: number[];
  nextTier: number | null;
}

/** Ligne de statistique prête à afficher (`+12`, `-5`, `0`). */
export interface StatLine {
  key: StatField;
  label: string;
  value: number;
}

/** Entrée du sac : item connu, quantité strictement positive. */
export interface BackpackEntry {
  itemId: string;
  name: string;
  quantity: number;
  category: ItemCategory;
}

/** Une statistique est « appliquée » en combat ou encore « en attente » (D45). */
export type StatApplication = "applied" | "pending";

/** Ligne de statistique annotée du statut d'application. */
export interface PanelStatLine extends StatLine {
  application: StatApplication;
}

export interface InventoryItemsInput {
  inventory: InventoryState;
  items: readonly ItemLike[];
}

/** Une panoplie du catalogue porte son `name` ; `SetLike` reste le minimum. */
export interface SetViewSet extends SetLike {
  name?: string;
}

export interface SetViewsInput extends InventoryItemsInput {
  sets: readonly SetViewSet[];
}

/** Contrat minimal d'un héros soignable : le HUD n'a besoin que des PV. */
export interface HpHolder {
  hp: number;
  maxHp: number;
}

/** Libellés FR des huit emplacements (copie d'interface, pas une donnée métier). */
export const SLOT_LABELS: Record<EquipmentSlot, string> = {
  hat: "Chapeau",
  cloak: "Cape",
  weapon: "Arme",
  amulet: "Amulette",
  ring1: "Anneau 1",
  ring2: "Anneau 2",
  belt: "Ceinture",
  boots: "Bottes",
};

/** Libellés FR des treize clés de `StatBlock`. */
export const STAT_LABELS: Record<StatField, string> = {
  vitality: "Vitalité",
  wisdom: "Sagesse",
  strength: "Force",
  intelligence: "Intelligence",
  chance: "Chance",
  agility: "Agilité",
  hp: "Points de vie",
  ap: "PA",
  mp: "PM",
  percentDmg: "% Dégâts",
  flatRes: "Résistance",
  percentRes: "% Résistance",
  prospection: "Prospection",
};

function itemOf(items: readonly ItemLike[], itemId: string | undefined): ItemLike | undefined {
  return items.find((item) => item.id === itemId);
}

function itemInSlot(input: InventoryItemsInput, slot: EquipmentSlot): ItemLike | undefined {
  return itemOf(input.items, input.inventory.equipment[slot]);
}

function nameOf(item: ItemLike | undefined): string | null {
  return item === undefined ? null : item.name;
}

function setIdOf(item: ItemLike | undefined): string | null {
  return item === undefined ? null : (item.setId ?? null);
}

function slotView(input: InventoryItemsInput, slot: EquipmentSlot): SlotView {
  const item = itemInSlot(input, slot);
  return { slot, label: SLOT_LABELS[slot], itemName: nameOf(item), setId: setIdOf(item) };
}

/** Les huit slots dans l'ordre de `EQUIPMENT_SLOTS`, vides compris. */
export function buildSlotViews(input: InventoryItemsInput): SlotView[] {
  return EQUIPMENT_SLOTS.map((slot) => slotView(input, slot));
}

function positiveStacks(stacks: readonly ItemStack[]): string[] {
  return stacks.filter((stack) => stack.quantity > 0).map((stack) => stack.itemId);
}

function equippedIds(inventory: InventoryState): string[] {
  return Object.values(inventory.equipment).filter(isDefined);
}

/** Ids possédés : piles non vides et équipement porté. */
function ownedIds(inventory: InventoryState): Set<string> {
  return new Set([...positiveStacks(inventory.stacks), ...equippedIds(inventory)]);
}

function hasPiece(set: SetViewSet, owned: ReadonlySet<string>): boolean {
  return set.pieceIds.some((pieceId) => owned.has(pieceId));
}

function equippedPieceCount(set: SetViewSet, worn: readonly ItemLike[]): number {
  return worn.filter((item) => set.pieceIds.includes(item.id)).length;
}

function activeTiers(bonuses: readonly SetBonusTier[], pieces: number): number[] {
  return bonuses.filter((bonus) => bonus.pieces <= pieces).map((bonus) => bonus.pieces);
}

function nextTierOf(bonuses: readonly SetBonusTier[], pieces: number): number | null {
  const pending = bonuses.map((bonus) => bonus.pieces).filter((required) => required > pieces);
  return pending.length === 0 ? null : Math.min(...pending);
}

function setView(set: SetViewSet, input: SetViewsInput): SetView {
  const pieces = equippedPieceCount(set, equippedItems(input));
  const activePieces = activeTiers(set.bonuses, pieces);
  const nextTier = nextTierOf(set.bonuses, pieces);
  const meta = { setId: set.id, setName: set.name ?? set.id, totalPieces: set.pieceIds.length };
  return { ...meta, pieces, activePieces, nextTier };
}

/** Panoplies dont au moins une pièce est possédée (équipée ou dans le sac). */
export function buildSetViews(input: SetViewsInput): SetView[] {
  const owned = ownedIds(input.inventory);
  return input.sets.filter((set) => hasPiece(set, owned)).map((set) => setView(set, input));
}

function statLine(total: StatBlock, key: StatField): StatLine {
  return { key, label: STAT_LABELS[key], value: total[key] ?? 0 };
}

function isNonZero(line: StatLine): boolean {
  return line.value !== 0;
}

function isZero(line: StatLine): boolean {
  return line.value === 0;
}

/** Treize lignes : valeurs non nulles d'abord, zéros en queue, ordre stable. */
export function buildStatLines(total: StatBlock): StatLine[] {
  const lines = STAT_FIELDS.map((key) => statLine(total, key));
  return [...lines.filter(isNonZero), ...lines.filter(isZero)];
}

/**
 * Stats encore inertes en combat : `combatantFromHero` jette `vitality` et
 * force des résistances nulles (dettes D30 / D45, mapping prévu en 5B).
 */
const PENDING_STATS: readonly StatField[] = ["vitality", "flatRes", "percentRes"];

/** `pending` = affichée mais non appliquée par le moteur de combat. */
export function statApplicationStatus(key: keyof StatBlock): StatApplication {
  return PENDING_STATS.includes(key) ? "pending" : "applied";
}

/** Suffixe affiché à côté d'une statistique inerte en combat. */
export const STAT_PENDING_LABEL = "non appliqué (5B)";

/** Explication du `title` d'une statistique inerte (dette D45). */
export const STAT_PENDING_HINT =
  "Affichée mais non appliquée en combat : mapping vitality → PV et résistances prévu en 5B (dette D45).";

function withApplication(line: StatLine): PanelStatLine {
  return { ...line, application: statApplicationStatus(line.key) };
}

/** Lignes non nulles d'un bloc (total ou palier), annotées appliqué/pending. */
export function buildAppliedStatLines(total: StatBlock): PanelStatLine[] {
  return buildStatLines(total).filter(isNonZero).map(withApplication);
}

export interface ProspectionViewInput {
  basePp: number;
  total: StatBlock;
}

/** PP effective : base + tranches de Chance totale + bonus PP des items. */
export function effectiveProspection(input: ProspectionViewInput): number {
  const chance = input.total.chance ?? 0;
  const bonusPp = input.total.prospection ?? 0;
  return computeProspection({ basePp: input.basePp, chance, bonusPp });
}

/** Consommables réellement présents dans le sac (quantité > 0). */
export function invokableConsumables(input: InventoryItemsInput): ItemLike[] {
  const owned = ownedIds(input.inventory);
  return input.items.filter((item) => item.category === "consumable" && owned.has(item.id));
}

function hasHeal(item: ItemLike): boolean {
  return (item.heal ?? 0) > 0;
}

/** Soin utilisable seulement si l'item soigne et que le héros n'est pas plein. */
export function canUseConsumable(input: { item: ItemLike; hero: HpHolder | null }): boolean {
  if (input.hero === null) return false;
  return hasHeal(input.item) && input.hero.hp < input.hero.maxHp;
}

function bagEntry(stack: ItemStack, items: readonly ItemLike[]): BackpackEntry | null {
  const item = itemOf(items, stack.itemId);
  if (item === undefined || stack.quantity <= 0) return null;
  return { itemId: item.id, name: item.name, quantity: stack.quantity, category: item.category };
}

/** Contenu du sac : piles connues et non vides, dans l'ordre de `stacks`. */
export function backpackItems(input: InventoryItemsInput): BackpackEntry[] {
  const entries = input.inventory.stacks.map((stack) => bagEntry(stack, input.items));
  return entries.filter((entry) => entry !== null);
}

/** `+12` pour un bonus, `-5` pour un malus, `0` sans signe. */
export function formatStatValue(value: number): string {
  if (value === 0) return "0";
  return value > 0 ? `+${value}` : `${value}`;
}
