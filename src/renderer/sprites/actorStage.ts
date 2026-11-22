import { Container } from "pixi.js";
import type { TokenView } from "../tokens";
import { EntitySprite } from "./EntitySprite";
import { ensureSpriteSheet } from "./spriteLoader";
import type { SpriteSheetSpec } from "./types";

export interface ActorSyncInput {
  tokens: readonly TokenView[];
  onReady: () => void;
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

/**
 * Couche des acteurs animés : un `EntitySprite` par **jeton**, créé une fois puis
 * réutilisé. Indexer par `spriteId` faisait disparaître le second monstre d'une
 * meute partageant la même feuille. Les jetons sans feuille (groupes
 * d'exploration) restent dessinés en géométrique par la couche `tokens`.
 */
export class ActorStage {
  readonly container = new Container();
  /** Feuilles que ce plateau sait rendre : seule autorité pour le repli géométrique. */
  readonly sheetIds: ReadonlySet<string>;
  private readonly specs: ReadonlyMap<string, SpriteSheetSpec>;
  private readonly actors = new Map<string, EntitySprite>();
  private notify: () => void = () => undefined;

  constructor(sheets: readonly SpriteSheetSpec[]) {
    this.specs = new Map(sheets.map((sheet) => [sheet.entityId, sheet]));
    this.sheetIds = new Set(this.specs.keys());
  }

  /** Met à jour chaque acteur puis rétablit l'ordre peintre de la couche. */
  sync(input: ActorSyncInput): void {
    this.notify = input.onReady;
    input.tokens.forEach((token) => this.syncToken(token));
    this.orderChildren(input.tokens);
  }

  private syncToken(token: TokenView): void {
    const actor = this.actorFor(token);
    if (actor === null) return;
    const { center, facing, animation, animationKey, scale } = token;
    actor.update({ point: center, facing, animation, signature: animationKey, scale });
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
