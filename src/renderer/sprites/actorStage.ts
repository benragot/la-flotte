import { Container } from "pixi.js";
import { depthOrder, type DepthItem } from "../depthOrder";
import type { PixelPoint } from "../gridProjection";
import type { TokenView } from "../tokens";
import { trailPlan } from "../walkTrail";
import { EntitySprite } from "./EntitySprite";
import { ensureSpriteSheet } from "./spriteLoader";
import type { SpriteSheetSpec } from "./types";

/** Nœud de décor déjà peint, fourni par la couche de scène pour le tri commun. */
export interface DepthProp {
  /** Profondeur de grille `x + y` de la case du prop. */
  depth: number;
  /** Rang de pose à profondeur égale : le décor passe avant les acteurs. */
  order: number;
  /** Nœud peint, possédé par l'appelant puis détruit au rendu suivant. */
  node: Container;
}

export interface ActorSyncInput {
  tokens: readonly TokenView[];
  onReady: () => void;
  /** Centres écran des cases de la scène : projection pure, recalculée à chaque image. */
  centers?: ReadonlyMap<string, PixelPoint>;
  /** Identité de la carte affichée : un changement invalide tous les trajets en cours. */
  scene?: object | null;
  /** Décor occlusif intercalé dans la même séquence que les acteurs. */
  props?: readonly DepthProp[];
}

interface DepthPlacement extends DepthItem {
  node: Container;
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
 * Le glissement est **purement visuel** et **entièrement reçu** : le store porte
 * le trajet (`TokenView.trail`), ce plateau ne fait que le projeter puis le
 * jouer. Il ne calcule aucun chemin — la diagonale du moteur reste un pas.
 *
 * ⚠️ Un second trajet qui arrive **pendant** un glissement repart du **pixel
 * peint** et finit le segment en cours avant d'enchaîner : le sprite ne saute
 * plus sur la case logique, et aucune diagonale ne coupe un coin. Aucun tween
 * n'est empilé, et la règle reste maîtresse du placement logique.
 */
export class ActorStage {
  readonly container = new Container();
  /** Feuilles que ce plateau sait rendre : seule autorité pour le repli géométrique. */
  readonly sheetIds: ReadonlySet<string>;
  private readonly specs: ReadonlyMap<string, SpriteSheetSpec>;
  private readonly actors = new Map<string, EntitySprite>();
  /** Dernière signature de trajet **jouée** par acteur : elle seule décide d'un rejeu. */
  private readonly played = new Map<string, string>();
  /** Props du dernier rendu : détruits quand la scène les remplace, jamais laissés fantômes. */
  private props: readonly DepthProp[] = [];
  private centers: ReadonlyMap<string, PixelPoint> = new Map();
  private scene: object | null | undefined;
  private clock = 0;
  private notify: () => void = () => undefined;

  constructor(sheets: readonly SpriteSheetSpec[]) {
    this.specs = new Map(sheets.map((sheet) => [sheet.entityId, sheet]));
    this.sheetIds = new Set(this.specs.keys());
  }

  /** Met à jour chaque acteur puis rétablit l'ordre peintre de la couche. */
  sync(input: ActorSyncInput): void {
    this.notify = input.onReady;
    this.centers = input.centers ?? new Map();
    this.switchScene(input.scene);
    input.tokens.forEach((token) => this.syncToken(token));
    this.orderChildren(input.tokens, input.props ?? []);
    this.replaceProps(input.props ?? []);
    this.forget(actorKeys(input.tokens));
  }

  /** Avance les glissements ; `true` si un acteur bouge encore (il faut repeindre). */
  advance(nowMs: number): boolean {
    this.clock = nowMs;
    const moving = [...this.actors.values()].map((actor) => actor.advance(nowMs));
    return moving.some(Boolean);
  }

  /**
   * Nouvelle carte : les glissements en cours appartiennent à l'ancienne. Ils
   * sont annulés puis reposés sur la case logique au même `sync` — sans cela le
   * héros finissait son trajet au pixel de la carte précédente.
   */
  private switchScene(scene: object | null | undefined): void {
    if (scene === undefined) return;
    if (scene === this.scene) return;
    this.scene = scene;
    this.played.clear();
    this.actors.forEach((actor) => {
      actor.cancelWalk();
      actor.cancelAction();
    });
  }

  private syncToken(token: TokenView): void {
    const actor = this.actorFor(token);
    if (actor === null) return;
    this.walkIfTrail(token, actor);
    const { center, facing, animation, animationKey, scale } = token;
    actor.update({ point: center, facing, animation, signature: animationKey, scale });
  }

  private walkIfTrail(token: TokenView, actor: EntitySprite): void {
    const trail = token.trail;
    if (!trail) return;
    const key = actorKey(token);
    if (this.played.get(key) === trail.signature) return;
    this.played.set(key, trail.signature);
    const plan = trailPlan(trail, this.centers);
    if (plan !== null) actor.walkAlong(plan, this.clock);
  }

  /** Acteurs absents de la scène : détruits, avec leur trajet. Rien ne survit à un changement de carte. */
  private forget(seen: ReadonlySet<string>): void {
    [...this.actors.keys()].filter((key) => !seen.has(key)).forEach((key) => this.dropActor(key));
  }

  private dropActor(key: string): void {
    this.played.delete(key);
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
    const actor = this.actors.get(key) ?? this.createActor(spec, key);
    const frames = ensureSpriteSheet(spec, () => this.notify());
    if (frames !== null) actor.setFrames(frames);
    return actor;
  }

  private createActor(spec: SpriteSheetSpec, key: string): EntitySprite {
    const actor = new EntitySprite({ spec, frames: null });
    this.actors.set(key, actor);
    return actor;
  }

  private orderChildren(tokens: readonly TokenView[], props: readonly DepthProp[]): void {
    this.container.removeChildren();
    const placements = this.placements(tokens, props);
    depthOrder(placements).forEach((placement) => this.container.addChild(placement.node));
  }

  private placements(tokens: readonly TokenView[], props: readonly DepthProp[]): DepthPlacement[] {
    const actors = tokens.flatMap((token, index) => this.actorPlacement(token, props.length + index));
    return [...props, ...actors];
  }

  private actorPlacement(token: TokenView, order: number): DepthPlacement[] {
    const actor = token.spriteId === null ? undefined : this.actors.get(actorKey(token));
    return actor === undefined ? [] : [{ depth: token.depth, order, node: actor.node }];
  }

  private replaceProps(props: readonly DepthProp[]): void {
    this.props.forEach((prop) => prop.node.destroy({ children: true }));
    this.props = props;
  }
}
