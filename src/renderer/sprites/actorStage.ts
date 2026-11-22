import { Container } from "pixi.js";
import type { Position } from "../../engine/grid";
import { cellKey } from "../scene";
import type { TokenView } from "../tokens";
import { EntitySprite } from "./EntitySprite";
import { ensureSpriteSheet } from "./spriteLoader";
import type { SpriteSheetSpec } from "./types";
import type { WalkField } from "./walkPath";
import { findWalkPath, walkPlanAlong } from "./walkPath";

export interface ActorSyncInput {
  tokens: readonly TokenView[];
  onReady: () => void;
  /** Cases praticables de la scène : sans champ, aucun glissement n'est tenté. */
  field?: WalkField;
}

/** Tri peintre des acteurs : `x + y` croissant, comme les tuiles. */
function depthSorter(a: TokenView, b: TokenView): number {
  return a.depth - b.depth;
}

function hasSprite(token: TokenView): boolean {
  return token.spriteId !== null;
}

/** Clé d'acteur : l'identité du **jeton**, jamais la feuille. Deux Pious = deux acteurs. */
function actorKey(token: TokenView): string {
  return `${token.id}|${token.spriteId ?? ""}`;
}

/** Clés des acteurs réellement présents dans l'image courante. */
function actorKeys(tokens: readonly TokenView[]): ReadonlySet<string> {
  return new Set(tokens.filter(hasSprite).map(actorKey));
}

/**
 * Couche des acteurs animés : un `EntitySprite` par **jeton**, créé une fois puis
 * réutilisé. Indexer par `spriteId` faisait disparaître le second monstre d'une
 * meute partageant la même feuille. Les jetons sans feuille (groupes
 * d'exploration) restent dessinés en géométrique par la couche `tokens`.
 *
 * Le glissement est **purement visuel** : la case logique du jeton arrive d'un
 * coup, ce plateau garde la dernière case vue pour peindre le trajet.
 */
export class ActorStage {
  readonly container = new Container();
  /** Feuilles que ce plateau sait rendre : seule autorité pour le repli géométrique. */
  readonly sheetIds: ReadonlySet<string>;
  private readonly specs: ReadonlyMap<string, SpriteSheetSpec>;
  private readonly actors = new Map<string, EntitySprite>();
  /** Dernière case logique par acteur : `undefined` = jamais vu, donc aucun trajet. */
  private readonly cells = new Map<string, Position>();
  private field: WalkField = new Map();
  private clock = 0;
  private notify: () => void = () => undefined;

  constructor(sheets: readonly SpriteSheetSpec[]) {
    this.specs = new Map(sheets.map((sheet) => [sheet.entityId, sheet]));
    this.sheetIds = new Set(this.specs.keys());
  }

  /** Met à jour chaque acteur puis rétablit l'ordre peintre de la couche. */
  sync(input: ActorSyncInput): void {
    this.notify = input.onReady;
    this.field = input.field ?? new Map();
    input.tokens.forEach((token) => this.syncToken(token));
    this.orderChildren(input.tokens);
    this.forget(actorKeys(input.tokens));
  }

  /** Avance les glissements ; `true` si un acteur bouge encore (il faut repeindre). */
  advance(nowMs: number): boolean {
    this.clock = nowMs;
    const moving = [...this.actors.values()].map((actor) => actor.advance(nowMs));
    return moving.some(Boolean);
  }

  private syncToken(token: TokenView): void {
    const actor = this.actorFor(token);
    if (actor === null) return;
    this.walkIfMoved(token, actor);
    const { center, facing, animation, animationKey, scale } = token;
    actor.update({ point: center, facing, animation, signature: animationKey, scale });
  }

  /** Un saut de case devient un trajet peint ; un spawn (jamais vu) se pose sans glisser. */
  private walkIfMoved(token: TokenView, actor: EntitySprite): void {
    const key = actorKey(token);
    const previous = this.cells.get(key);
    this.cells.set(key, token.cell);
    if (previous === undefined) return;
    if (cellKey(previous) === cellKey(token.cell)) return;
    this.startWalk(actor, previous, token.cell);
  }

  private startWalk(actor: EntitySprite, from: Position, to: Position): void {
    const cells = findWalkPath(this.field, from, to);
    if (cells === null) return;
    const plan = walkPlanAlong(this.field, cells);
    if (plan !== null) actor.walkAlong(plan, this.clock);
  }

  /** Acteurs absents de la scène : détruits, avec leur trajet. Rien ne survit à un changement de carte. */
  private forget(seen: ReadonlySet<string>): void {
    [...this.actors.keys()].filter((key) => !seen.has(key)).forEach((key) => this.dropActor(key));
  }

  private dropActor(key: string): void {
    this.cells.delete(key);
    const actor = this.actors.get(key);
    if (actor === undefined) return;
    this.actors.delete(key);
    actor.node.destroy({ children: true });
  }

  private specFor(spriteId: string | null): SpriteSheetSpec | undefined {
    return spriteId === null ? undefined : this.specs.get(spriteId);
  }

  private actorFor(token: TokenView): EntitySprite | null {
    const spec = this.specFor(token.spriteId);
    if (spec === undefined) return null;
    const key = actorKey(token);
    const actor = this.actors.get(key) ?? this.createActor(spec, token.fill, key);
    const frames = ensureSpriteSheet(spec, () => this.notify());
    if (frames !== null) actor.setFrames(frames);
    return actor;
  }

  private createActor(spec: SpriteSheetSpec, tint: number, key: string): EntitySprite {
    const actor = new EntitySprite({ spec, frames: null, tint });
    this.actors.set(key, actor);
    return actor;
  }

  private orderChildren(tokens: readonly TokenView[]): void {
    this.container.removeChildren();
    tokens.filter(hasSprite).sort(depthSorter).forEach((token) => this.stack(token));
  }

  private stack(token: TokenView): void {
    const actor = token.spriteId === null ? undefined : this.actors.get(actorKey(token));
    if (actor !== undefined) this.container.addChild(actor.node);
  }
}
