import { useState } from "react";
import { GAME_CATALOG, useGameStore } from "../../../store/useGameStore";
import type { BackpackEntry } from "../../inventoryHudHelpers";
import { backpackItems, bagEquipHints } from "../../inventoryHudHelpers";
import type { ItemSelectionProps } from "./itemSelection";
import type { SaleLock, SalePrice } from "./saleView";
import { priceLabel, saleLock, saleLockLabel, saleNotice } from "./saleView";
import { useLiveCombat, useSell } from "./useSell";
import type { SellHandler } from "./useSell";
import {
  BAG_ROW,
  BAG_ROW_SELECTED,
  EMPTY_HINT,
  HEADING,
  HEAD_ROW,
  ITEM_BUTTON,
  LIST,
  PURSE,
  ROW,
  SALE_NOTICE,
  SELL_PRICE,
  SELL_PRICE_OFF,
  SMALL_BUTTON,
  TEXT_KO,
} from "./inventoryTheme";

/**
 * Prix de vente par objet, lu **une fois** dans le catalogue du store : c'est
 * la même donnée que celle consommée par l'action `sellItem`, jamais un calcul
 * local (§11 « afficher, pas calculer », `ui-visual-direction-11-sell.md`).
 */
const SALE_PRICES: ReadonlyMap<string, SalePrice> = new Map(
  GAME_CATALOG.items.map((item) => [item.id, item.sellPrice ?? null]),
);

function salePriceOf(itemId: string): SalePrice {
  return SALE_PRICES.get(itemId) ?? null;
}

const NOOP_SOLD = (): void => undefined;

/** Raison lisible du refus, affichée à côté du bouton (badge rouge). */
function EquipHint({ id, hint }: { id: string; hint: string | null }) {
  if (hint === null) return null;
  return <span id={id} className={TEXT_KO}>{hint}</span>;
}

interface EquipTriggerProps {
  hint: string | null;
  hintId: string;
  onClick: () => void;
}

/** `title` n'est pas fiable sur un bouton `disabled` : le badge est lié par `aria-describedby`. */
function EquipTrigger({ hint, hintId, onClick }: EquipTriggerProps) {
  const describedBy = hint === null ? undefined : hintId;
  return (
    <button type="button" className={SMALL_BUTTON} disabled={hint !== null} title={hint ?? undefined} aria-describedby={describedBy} onClick={onClick}>Équiper</button>
  );
}

function EquipButton({ itemId, hint }: { itemId: string; hint: string | null }) {
  const equip = useGameStore((state) => state.equip);
  const hintId = `equip-hint-${itemId}`;
  return (
    <span className={ROW}>
      <EquipHint id={hintId} hint={hint} />
      <EquipTrigger hint={hint} hintId={hintId} onClick={() => equip({ itemId })} />
    </span>
  );
}

/** Seuls les équipements portent une action ; le reste du sac est informatif. */
function BagAction({ entry, hint }: { entry: BackpackEntry; hint: string | null }) {
  if (entry.category !== "equipment") return null;
  return <EquipButton itemId={entry.itemId} hint={hint} />;
}

/** Prix unitaire : chiffre lisible, ou « Invendable » barré — jamais un vide. */
function PriceTag({ price }: { price: SalePrice }) {
  const className = price === null ? SELL_PRICE_OFF : SELL_PRICE;
  return <span className={className}>{priceLabel(price)}</span>;
}

interface SellTriggerProps {
  label: string;
  hint: string | null;
  onClick: () => void;
}

/** Bouton de vente : désactivé **franc** (jeton compact), la raison est en `title`. */
function SellTrigger({ label, hint, onClick }: SellTriggerProps) {
  return (
    <button type="button" className={SMALL_BUTTON} disabled={hint !== null} title={hint ?? undefined} onClick={onClick}>
      {label}
    </button>
  );
}

interface SaleTriggersProps {
  entry: BackpackEntry;
  hint: string | null;
  sell: (quantity: number) => void;
}

/** Un geste unitaire, un geste de pile : le second n'apparaît qu'au-delà d'une unité. */
function SaleTriggers({ entry, hint, sell }: SaleTriggersProps) {
  return (
    <>
      <SellTrigger label="Vendre 1" hint={hint} onClick={() => sell(1)} />
      {entry.quantity > 1 ? <SellTrigger label="Tout vendre" hint={hint} onClick={() => sell(entry.quantity)} /> : null}
    </>
  );
}

interface NoticeInput {
  sell: SellHandler;
  entry: BackpackEntry;
  quantity: number;
  lock: SaleLock;
  onSold: (entry: BackpackEntry, quantity: number) => void;
}

/** Vente + confirmation : un verrou ne produit ni crédit ni message de succès. */
function sellWithNotice(input: NoticeInput): void {
  if (input.lock !== null) return;
  input.sell(input.quantity);
  input.onSold(input.entry, input.quantity);
}

interface SaleControlsProps {
  entry: BackpackEntry;
  price: SalePrice;
  inCombat: boolean;
  onSold: (entry: BackpackEntry, quantity: number) => void;
}

/** Deux gestes de vente, ancrés à la ligne de l'objet. */
function SaleControls({ entry, price, inCombat, onSold }: SaleControlsProps) {
  const lock = saleLock(price, inCombat);
  const sell = useSell(entry.itemId, lock);
  const onQuantity = (quantity: number) => sellWithNotice({ sell, entry, quantity, lock, onSold });
  return (
    <span className={ROW}>
      <SaleTriggers entry={entry} hint={saleLockLabel(lock)} sell={onQuantity} />
    </span>
  );
}

export interface BagRowProps {
  entry: BackpackEntry;
  selected: boolean;
  onSelect: (itemId: string) => void;
  /** Refus explicité par le moteur ; `null`/absent quand l'objet est équipable. */
  hint?: string | null;
  /** Combat en cours : la vente est verrouillée, la consultation non. */
  inCombat?: boolean;
  /** Confirmation de vente ; sans lui, la ligne reste rendable en isolation (SSR). */
  onSold?: (entry: BackpackEntry, quantity: number) => void;
}

interface BagNameProps {
  entry: BackpackEntry;
  price: SalePrice;
  selected: boolean;
  onSelect: (itemId: string) => void;
}

/** Étage haut : le nom reste le bouton du détail, le prix le suit à droite. */
function BagName({ entry, price, selected, onSelect }: BagNameProps) {
  return (
    <div className={ROW}>
      <button type="button" aria-pressed={selected} className={ITEM_BUTTON} onClick={() => onSelect(entry.itemId)}>{entry.name} ×{entry.quantity}</button>
      <PriceTag price={price} />
    </div>
  );
}

interface BagActionsProps {
  entry: BackpackEntry;
  price: SalePrice;
  hint: string | null;
  inCombat: boolean;
  onSold: (entry: BackpackEntry, quantity: number) => void;
}

/** Étage bas : vente à gauche, équipement à droite. */
function BagActions({ entry, price, hint, inCombat, onSold }: BagActionsProps) {
  return (
    <div className={ROW}>
      <SaleControls entry={entry} price={price} inCombat={inCombat} onSold={onSold} />
      <BagAction entry={entry} hint={hint} />
    </div>
  );
}

interface BagActionPropsInput extends Pick<BagRowProps, "entry" | "hint" | "inCombat" | "onSold"> {
  price: SalePrice;
}

/** Props d'actions normalisées : verrou et confirmation absents sont des cas légitimes. */
function bagActionsProps(props: BagActionPropsInput): BagActionsProps {
  const { entry, price } = props;
  const base = { entry, price, hint: props.hint ?? null };
  return { ...base, inCombat: props.inCombat ?? false, onSold: props.onSold ?? NOOP_SOLD };
}

/** Ligne d'objet : deux étages pour que quatre contrôles restent cliquables à 1024 px. */
export function BagRow({ entry, selected, onSelect, hint, inCombat, onSold }: BagRowProps) {
  const price = salePriceOf(entry.itemId);
  return (
    <li className={selected ? BAG_ROW_SELECTED : BAG_ROW}>
      <BagName entry={entry} price={price} selected={selected} onSelect={onSelect} />
      <BagActions {...bagActionsProps({ entry, price, hint, inCombat, onSold })} />
    </li>
  );
}

export interface BagRowsProps extends ItemSelectionProps {
  entries: readonly BackpackEntry[];
  hints: Record<string, string>;
  inCombat: boolean;
  onSold: (entry: BackpackEntry, quantity: number) => void;
}

function BagRows({ entries, selected, onSelect, hints, inCombat, onSold }: BagRowsProps) {
  const propsOf = (entry: BackpackEntry) => ({
    entry, selected: entry.itemId === selected, onSelect, onSold, inCombat,
    hint: hints[entry.itemId] ?? null,
  });
  return entries.map((entry) => <BagRow key={entry.itemId} {...propsOf(entry)} />);
}

function BagList({ entries, selected, onSelect, hints, inCombat, onSold }: BagRowsProps) {
  if (entries.length === 0) return <p className={EMPTY_HINT}>Sac vide.</p>;
  return (
    <ul aria-label="Objets du sac" className={LIST}>
      <BagRows entries={entries} selected={selected} onSelect={onSelect} hints={hints} inCombat={inCombat} onSold={onSold} />
    </ul>
  );
}

/** Bourse du héros : le seul chiffre qui bouge à la vente, annoncé aux lecteurs d'écran. */
function Purse({ kamas }: { kamas: number }) {
  return (
    <p aria-label="Bourse" aria-live="polite" className={PURSE}>Bourse : {kamas} kamas</p>
  );
}

function SacHeader({ kamas }: { kamas: number }) {
  return (
    <header className={HEAD_ROW}>
      <h3 className={HEADING}>Sac</h3>
      <Purse kamas={kamas} />
    </header>
  );
}

/** Verrou de combat : une phrase, pas une couleur seule. */
function LockNotice({ inCombat }: { inCombat: boolean }) {
  if (!inCombat) return null;
  return <p className={TEXT_KO}>Vente impossible en combat</p>;
}

function SaleNotice({ notice }: { notice: string | null }) {
  if (notice === null) return null;
  return <p role="status" className={SALE_NOTICE}>{notice}</p>;
}

function SaleStatus({ inCombat, notice }: { inCombat: boolean; notice: string | null }) {
  return (
    <>
      <LockNotice inCombat={inCombat} />
      <SaleNotice notice={notice} />
    </>
  );
}

/** Tout ce qui surplombe la liste : titre, bourse, verrou et dernière vente. */
function SacTop({ kamas, inCombat, notice }: { kamas: number; inCombat: boolean; notice: string | null }) {
  return (
    <>
      <SacHeader kamas={kamas} />
      <SaleStatus inCombat={inCombat} notice={notice} />
    </>
  );
}

/** Dernière vente confirmée : état d'interface local, aucun calcul de prix. */
function useSaleNotice(): { notice: string | null; onSold: (entry: BackpackEntry, quantity: number) => void } {
  const [notice, setNotice] = useState<string | null>(null);
  const onSold = (entry: BackpackEntry, quantity: number) => setNotice(saleNotice(entry.name, quantity));
  return { notice, onSold };
}

interface BagContent {
  entries: readonly BackpackEntry[];
  hints: Record<string, string>;
  kamas: number;
  inCombat: boolean;
}

/** Sac + raisons de refus + bourse, lus une fois pour toutes les lignes. */
function useBagContent(): BagContent {
  const inventory = useGameStore((state) => state.inventory);
  const heroLevel = useGameStore((state) => state.hero?.level ?? 1);
  const kamas = useGameStore((state) => state.hero?.kamas ?? 0);
  const inCombat = useLiveCombat();
  const entries = backpackItems({ inventory, items: GAME_CATALOG.items });
  const hints = bagEquipHints({ inventory, items: GAME_CATALOG.items, heroLevel });
  return { entries, hints, kamas, inCombat };
}

/** Sac du héros : bourse, piles, prix de vente, et les deux gestes de vente. */
export default function BackpackList({ selected, onSelect }: ItemSelectionProps) {
  const { entries, hints, kamas, inCombat } = useBagContent();
  const { notice, onSold } = useSaleNotice();
  return (
    <section aria-label="Sac" className="flex min-h-0 flex-col gap-1">
      <SacTop kamas={kamas} inCombat={inCombat} notice={notice} />
      <BagList entries={entries} selected={selected} onSelect={onSelect} hints={hints} inCombat={inCombat} onSold={onSold} />
    </section>
  );
}
