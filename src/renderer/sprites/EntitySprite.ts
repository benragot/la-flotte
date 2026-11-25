import { AnimatedSprite, Container } from "pixi.js";
import type { PixelPoint } from "../gridProjection";
import { SPRITE_ANCHOR } from "./anchor";
import { ACTION_EFFECT_MS, NEUTRAL_TINT, actionTint } from "./actionEffect";
import { displayScaleFor } from "./frameMath";
import type { Facing, SpriteAnimationName, SpriteSheetFrames, SpriteSheetSpec } from "./types";
import type { WalkPlan, WalkState } from "./walkMotion";
import { resumeWalk, sampleWalk, startWalk } from "./walkMotion";

/** Pieds de la cellule : l'ancre tombe sur le centre du losange (`./anchor`). */
export { SPRITE_ANCHOR };
/** Cadence de référence d'`animationSpeed` chez PixiJS (une frame par tick à 1). */
const REFERENCE_FPS = 60;

export interface EntitySpriteInput {
  spec: SpriteSheetSpec;
  frames: SpriteSheetFrames | null;
}

export interface ActorPlacement {
  point: PixelPoint;
  facing: Facing;
  animation: SpriteAnimationName;
  signature: string;
  /** Échelle du décor : l'acteur suit le zoom de la carte. */
  scale?: number;
}

/**
 * Acteur animé d'une entité : encapsule un `AnimatedSprite` PixiJS v8, ancré aux
 * pieds et retourné selon `facing`.
 *
 * **Aucun disque plein** n'est posé sous le sprite (`ui-dofus-retro.md` §8.6) :
 * tant que la feuille n'est pas prête, le nœud est vide, et c'est l'**anneau
 * d'équipe** de la couche `teamRings` qui marque la case et le camp. Un acteur
 * n'est donc jamais anonyme, et jamais peint en pion bleu ou rouge.
 */
export class EntitySprite {
  readonly node = new Container();
  private readonly spec: SpriteSheetSpec;
  private frames: SpriteSheetFrames | null = null;
  private animated: AnimatedSprite | null = null;
  /** Signature de la dernière demande du jeu : elle seule décide d'un rejeu. */
  private requested = "";
  /** Demande courante, mémorisée même pendant un glissement. */
  private pending = "";
  /** Glissement en cours : `null` = l'acteur est posé sur sa case logique. */
  private walk: WalkState | null = null;
  /** Flash d'action en cours : sa date de départ vient du ticker, jamais d'ici. */
  private effect: { startMs: number | null } | null = null;

  constructor(input: EntitySpriteInput) {
    this.spec = input.spec;
    if (input.frames !== null) this.setFrames(input.frames);
  }

  /** Remplace le nœud vide par la feuille animée, une seule fois. */
  setFrames(frames: SpriteSheetFrames): void {
    if (this.animated !== null) return;
    this.frames = frames;
    this.animated = new AnimatedSprite({ textures: frames.idle, anchor: SPRITE_ANCHOR, autoPlay: true });
    this.node.removeChildren().forEach((child) => child.destroy());
    this.node.addChild(this.animated);
    this.requested = "";
    if (this.walk !== null) this.start("walk");
  }

  /**
   * Démarre visuellement une animation sans toucher à la demande courante :
   * `attack`/`hit` ne bouclent pas et retombent sur `idle` en fin de course.
   */
  private start(animation: SpriteAnimationName): void {
    const { animated, frames } = this;
    if (animated === null || frames === null) return;
    this.clearEffect();
    this.playFrames(animated, frames, animation);
  }

  private playFrames(animated: AnimatedSprite, frames: SpriteSheetFrames, animation: SpriteAnimationName): void {
    const spec = this.spec.animations[animation];
    animated.textures = frames[animation];
    animated.animationSpeed = spec.fps / REFERENCE_FPS;
    animated.loop = spec.loop;
    animated.onComplete = spec.loop ? undefined : () => this.start("idle");
    animated.gotoAndPlay(0);
  }

  /**
   * Joue la demande du jeu : seule une **nouvelle** signature rejoue, ce qui
   * garde les one-shots stables à travers les re-rendus (survol, resize…).
   */
  play(animation: SpriteAnimationName, signature: string): void {
    if (this.requested === signature) return;
    this.requested = signature;
    this.start(animation);
    this.applyEffect(animation);
  }

  /** Allume brièvement le sprite : or pour une frappe, rouge pour une touche. */
  private applyEffect(animation: SpriteAnimationName): void {
    const tint = actionTint(animation);
    if (tint === null || this.animated === null) return;
    this.effect = { startMs: null };
    this.animated.tint = tint;
  }

  /** Retire le flash et rend la teinte neutre : aucun état ne survit à l'action. */
  private clearEffect(): void {
    if (this.animated !== null) this.animated.tint = NEUTRAL_TINT;
    this.effect = null;
  }

  /** Une image d'effet : `true` tant que la teinte tient (il faut repeindre). */
  private advanceEffect(nowMs: number): boolean {
    if (this.effect === null) return false;
    this.effect.startMs ??= nowMs;
    if (nowMs - this.effect.startMs < ACTION_EFFECT_MS) return true;
    this.clearEffect();
    return false;
  }

  /**
   * Positionne l'acteur sur le centre du losange, à l'échelle du décor, et applique le retournement.
   *
   * ⚠️ Pendant un glissement, la demande est **mémorisée** mais pas jouée :
   * `finishWalk` la consomme pour ne pas rejouer le `walk` déjà vu. Un coup porté
   * pendant un glissement n'est donc **pas animé** (limitation connue, suivie
   * hors de cette PR) — la donnée du héros, elle, n'attend jamais le visuel.
   */
  update(placement: ActorPlacement): void {
    this.applyTransform(placement);
    this.pending = `${placement.signature}:${placement.animation}`;
    if (this.walk !== null) return;
    this.placePoint(placement.point);
    this.play(placement.animation, this.pending);
  }

  /**
   * Glisse l'acteur le long d'un chemin de centres de cases. Un trajet qui
   * arrive **pendant** un glissement repart du **pixel peint**, pas de la case
   * logique : le sprite ne saute plus en avant quand le joueur l'interrompt, et
   * le trajet précédent est remplacé, jamais complété (aucune pile de tweens).
   */
  walkAlong(plan: WalkPlan, nowMs: number): void {
    this.walk = startWalk(this.resumedPlan(plan, nowMs), nowMs);
    this.start("walk");
  }

  /** Plan effectif : la reprise part de la position peinte quand un trajet est en cours. */
  private resumedPlan(plan: WalkPlan, nowMs: number): WalkPlan {
    if (this.walk === null) return plan;
    return resumeWalk(this.walk.plan, nowMs - this.walk.startedAt, plan) ?? plan;
  }

  /**
   * Avance le glissement et le flash à `nowMs`. `true` tant qu'une chose bouge
   * ou s'allume : la boucle de rendu sait alors qu'il faut repeindre. À
   * l'arrivée, retour à `idle` ; à l'expiration, teinte neutre.
   */
  advance(nowMs: number): boolean {
    const effect = this.advanceEffect(nowMs);
    return this.advanceWalk(nowMs) || effect;
  }

  private advanceWalk(nowMs: number): boolean {
    if (this.walk === null) return false;
    const sample = sampleWalk(this.walk, nowMs);
    this.placePoint(sample.point);
    if (sample.done) this.finishWalk();
    return true;
  }

  /**
   * Interrompt un glissement : le prochain `update` repose l'acteur sur sa case
   * logique. Utilisé quand la carte change au milieu du trajet.
   */
  cancelWalk(): void {
    this.walk = null;
  }

  /** Un changement de scène emporte aussi le flash : rien ne survit à l'ancienne carte. */
  cancelAction(): void {
    this.clearEffect();
  }

  /** Fin de trajet : l'acteur est posé et respire, sans rejouer le walk déjà consommé. */
  private finishWalk(): void {
    this.walk = null;
    this.requested = this.pending;
    this.start("idle");
  }

  private placePoint(point: PixelPoint): void {
    this.node.position.set(point.x, point.y);
  }

  private applyTransform(placement: ActorPlacement): void {
    const scale = displayScaleFor(this.spec.frameWidth, placement.scale ?? 1);
    this.node.scale.x = placement.facing === "left" ? -scale : scale;
    this.node.scale.y = scale;
  }
}
