/**
 * Doublures minimales de PixiJS pour tester la machine à états d'`EntitySprite`
 * en Node, sans WebGL : aucune texture réelle, aucun renderer.
 */

/** Doublure minimale d'`AnimatedSprite` : on ne teste que la machine à états. */
export interface AnimatedLike {
  textures: readonly unknown[];
  animationSpeed: number;
  loop: boolean;
  onComplete?: () => void;
  currentFrame: number;
  gotoAndPlay: (frame?: number) => void;
}

/** Position mémorisée : `set(x, y)`, comme le `Container.position` de PixiJS. */
export class FakePoint {
  x = 0;
  y = 0;

  set(x = 0, y = 0): void {
    this.x = x;
    this.y = y;
  }
}

export class FakeNode {
  children: FakeNode[] = [];
  position = new FakePoint();
  scale = { x: 1, y: 1 };
  alpha = 1;
  eventMode: string | undefined;

  addChild(child: FakeNode): FakeNode {
    this.children.push(child);
    return child;
  }

  removeChildren(): FakeNode[] {
    const removed = this.children;
    this.children = [];
    return removed;
  }

  destroy(): void {
    this.children = [];
  }
}

/** Toutes les `Graphics` créées, dans l'ordre : la couche des jetons est la 6ᵉ. */
export const graphicsOf: FakeGraphics[] = [];

export class FakeGraphics extends FakeNode {
  circleCalls = 0;
  polyCalls = 0;

  constructor() {
    super();
    graphicsOf.push(this);
  }

  circle(): this {
    this.circleCalls += 1;
    return this;
  }

  poly(): this {
    this.polyCalls += 1;
    return this;
  }

  rect(): this {
    return this;
  }

  ellipse(): this {
    return this;
  }

  moveTo(): this {
    return this;
  }

  lineTo(): this {
    return this;
  }

  fill(): this {
    return this;
  }

  stroke(): this {
    return this;
  }

  clear(): this {
    this.circleCalls = 0;
    this.polyCalls = 0;
    return this;
  }
}

export class FakeAnimatedSprite extends FakeNode {  textures: readonly unknown[] = [];
  animationSpeed = 1;
  loop = true;
  onComplete?: () => void;
  currentFrame = 0;
  anchor: unknown;

  constructor(options: { textures: readonly unknown[]; anchor?: unknown }) {
    super();
    this.textures = options.textures;
    this.anchor = options.anchor;
  }

  gotoAndPlay(frame = 0): void {
    this.currentFrame = frame;
  }

  play(): void {
    return undefined;
  }

  stop(): void {
    return undefined;
  }
}

/** Doublure de `Text` : seuls l'ancre et la position sont posées par la couche. */
export class FakeText extends FakeNode {
  text: string;
  anchor = { set: (): void => undefined };

  /** Pixi mesure le texte réel ; la doublure approxime pour les tests de bornes. */
  get width(): number {
    return this.text.length * 6;
  }

  constructor(options: { text: string }) {
    super();
    this.text = options.text;
  }
}
