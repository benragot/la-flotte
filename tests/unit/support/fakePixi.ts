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

export class FakeGraphics extends FakeNode {
  circle(): this {
    return this;
  }

  fill(): this {
    return this;
  }

  stroke(): this {
    return this;
  }
}

export class FakeAnimatedSprite extends FakeNode {
  textures: readonly unknown[] = [];
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
