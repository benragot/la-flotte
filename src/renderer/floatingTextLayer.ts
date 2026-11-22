import { Container, Text } from "pixi.js";
import type { FloatingEvent, FloatKind } from "../engine/combat";
import { unseenFloats } from "../engine/combat";
import type { PixelPoint } from "./gridProjection";
import {
  FLOAT_FONT_SIZE,
  FLOAT_MS,
  FLOAT_STROKE,
  FLOAT_STROKE_WIDTH,
  floatAlpha,
  floatFill,
  floatLabel,
  floatOrigin,
  floatY,
  stackOffset,
} from "./floatingText";
import type { TokenView } from "./tokens";

interface FloatEntry {
  targetId: string;
  text: Text;
  /** Point de naissance figé : le nombre reste où le coup a été porté. */
  origin: PixelPoint;
  /** `null` tant qu'aucune image ne l'a daté : l'horloge vient du ticker, jamais d'ici. */
  startMs: number | null;
}

export interface FloatSyncInput {
  events: readonly FloatingEvent[];
  tokens: readonly TokenView[];
  /** Identité de la carte dessinée : un changement annule tout nombre en vol. */
  scene?: object | null;
}

function floatText(kind: FloatKind, amount: number, scale: number): Text {
  const fontSize = Math.round(FLOAT_FONT_SIZE * scale);
  const style = { fontSize, fontWeight: "bold" as const, fill: floatFill(kind) };
  const text = new Text({ text: floatLabel(kind, amount), style: { ...style, stroke: { color: FLOAT_STROKE, width: FLOAT_STROKE_WIDTH } } });
  text.anchor.set(0.5);
  return text;
}

function shiftOrigin(origin: PixelPoint, index: number): PixelPoint {
  const offset = stackOffset(index);
  return { x: origin.x + offset.x, y: origin.y + offset.y };
}

function applyFrame(entry: FloatEntry, elapsedMs: number): void {
  entry.text.position.set(entry.origin.x, floatY(entry.origin.y, elapsedMs));
  entry.text.alpha = floatAlpha(elapsedMs);
}

/**
 * Le nombre naît **déjà posé** : sans cette frame 0, le premier `app.render`
 * affichait le texte au coin haut-gauche pendant une image — un clignotement
 * visible par le joueur, invisible en capture.
 */
function spawnEntry(event: FloatingEvent, token: TokenView, index: number): FloatEntry {
  const origin = shiftOrigin(floatOrigin(token), index);
  const text = floatText(event.kind, event.amount, token.scale);
  const entry: FloatEntry = { targetId: event.targetId, text, origin, startMs: null };
  applyFrame(entry, 0);
  return entry;
}

/**
 * Nombres de dégâts et de soins flottants, au-dessus des jetons **ciblés**.
 *
 * La couche ne calcule rien : le montant vient du moteur (`state.floats`), la
 * trajectoire de `floatingText`. Elle ne détient qu'une chose : ce qui est en
 * vol. Un nombre est **détruit** à `FLOAT_MS`, un changement de carte emporte
 * tout, et la couche ne capte jamais le pointeur.
 */
export class FloatingTextLayer {
  readonly container = new Container();
  private entries: FloatEntry[] = [];
  /** Dernier identifiant consommé : un rendu ne rejoue jamais un nombre déjà vu. */
  private seenId = 0;
  private scene: object | null | undefined;

  /**
   * Ajoute les événements inédits, puis retient le plus grand identifiant lu.
   * Sur une **carte neuve**, le tampon reçu est ignoré (`fresh` vide) : rien ne
   * rejoue. Le curseur ne retient que ce tampon-là, si bien qu'un combat neuf —
   * dont les identifiants repartent à 1 — s'affiche normalement.
   */
  sync(input: FloatSyncInput): void {
    const newScene = this.switchScene(input.scene);
    const fresh = newScene ? [] : unseenFloats(input.events, this.seenId);
    this.seenId = Math.max(this.seenId, ...input.events.map((event) => event.id));
    fresh.forEach((event) => this.spawn(event, input.tokens));
  }

  /** Une image : âge chaque nombre, détruit les expirés, `true` s'il en reste. */
  advance(nowMs: number): boolean {
    const alive = this.entries.filter((entry) => this.step(entry, nowMs));
    this.entries = alive;
    this.reparent();
    return alive.length > 0;
  }

  busy(): boolean {
    return this.entries.length > 0;
  }

  clear(): void {
    this.entries.forEach((entry) => entry.text.destroy());
    this.container.removeChildren();
    this.entries = [];
  }

  private step(entry: FloatEntry, nowMs: number): boolean {
    entry.startMs ??= nowMs;
    const elapsed = nowMs - entry.startMs;
    applyFrame(entry, elapsed);
    if (elapsed < FLOAT_MS) return true;
    entry.text.destroy();
    return false;
  }

  private spawn(event: FloatingEvent, tokens: readonly TokenView[]): void {
    const token = tokens.find((entry) => entry.id === event.targetId);
    if (token === undefined) return;
    const entry = spawnEntry(event, token, this.stackIndex(event.targetId));
    this.entries.push(entry);
    this.container.addChild(entry.text);
  }

  private stackIndex(targetId: string): number {
    return this.entries.filter((entry) => entry.targetId === targetId).length;
  }

  /** Seuls les textes vivants restent dans le conteneur : aucun nœud fantôme. */
  private reparent(): void {
    this.container.removeChildren();
    this.entries.forEach((entry) => this.container.addChild(entry.text));
  }

  /**
   * Nouvelle carte : les nombres en vol appartiennent à l'ancienne. Ils sont
   * détruits et le curseur repart de zéro, `sync` sachant qu'il ne doit **rien**
   * rejouer du tampon reçu dans la même passe. Le **premier** rendu n'est pas un
   * changement de carte : un tampon déjà rempli s'affiche normalement.
   */
  private switchScene(scene: object | null | undefined): boolean {
    if (scene === undefined || scene === this.scene) return false;
    const known = this.scene !== undefined;
    this.scene = scene;
    this.seenId = 0;
    this.clear();
    return known;
  }
}
