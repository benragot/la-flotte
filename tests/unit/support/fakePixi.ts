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

export class FakeNode {
  children: FakeNode[] = [];
  position = { set: (): void => undefined };
  scale = { x: 1 };

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

/** Toutes les `Graphics` créées, dans l'ordre : la couche des jetons est la 4ᵉ. */
export const graphicsOf: FakeGraphics[] = [];

export class FakeGraphics extends FakeNode {
  circleCalls = 0;

  constructor() {
    super();
    graphicsOf.push(this);
  }

  circle(): this {
    this.circleCalls += 1;
    return this;
  }

  poly(): this {
    return this;
  }

  rect(): this {
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

  constructor(options: { text: string }) {
    super();
    this.text = options.text;
  }
}
