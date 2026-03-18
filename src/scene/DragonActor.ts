import { Container, Graphics, Sprite } from 'pixi.js';
import gsap from 'gsap';
import { withBase } from '../utils/basePath';
import { clamp, lerp } from '../utils/math';

interface DragonCallbacks {
  onSmoke: (x: number, y: number) => void;
  onNudgeNearby: (x: number, y: number) => void;
  onBreath: () => void;
  onIdle: () => void;
  onHuff: () => void;
  onRareEvent: () => void;
  onSecretUnlock: () => void;
  onClickCount?: (count: number) => void;
}

export class DragonActor {
  readonly container = new Container();
  private readonly body = new Graphics();
  private readonly chestGlow = new Graphics();
  private readonly head = new Graphics();
  private readonly eyeLeft = new Graphics();
  private readonly eyeRight = new Graphics();
  private readonly tail = new Graphics();
  private readonly wing = new Graphics();
  private spriteLayersMounted = false;

  private callbacks: DragonCallbacks;
  private reducedMotion: boolean;
  private breathTween: gsap.core.Tween | null = null;
  private blinkTimer = 0;
  private smokeTimer = 0;
  private postureTimer = 0;
  private nudgeTimer = 0;
  private rareTimer = 0;
  private huffCooldown = 0;
  private clickCount = 0;

  private baseX = 0;
  private baseY = 0;

  constructor(callbacks: DragonCallbacks, reducedMotion: boolean) {
    this.callbacks = callbacks;
    this.reducedMotion = reducedMotion;

    this.container.sortableChildren = true;
    this.container.eventMode = 'static';
    this.container.cursor = 'pointer';
    this.container.on('pointerdown', () => {
      this.clickCount += 1;
      this.callbacks.onClickCount?.(this.clickCount);
      gsap.fromTo(this.head.scale, { x: 1.05, y: 1.05 }, { x: 1, y: 1, duration: 0.35, ease: 'back.out(2)' });

      if (this.clickCount >= 6) {
        this.clickCount = 0;
        this.callbacks.onSecretUnlock();
      }
    });

    this.draw();
    this.startIdleAnimations();
  }

  setReducedMotion(value: boolean): void {
    this.reducedMotion = value;
    if (value) {
      this.breathTween?.pause();
    } else {
      this.breathTween?.resume();
    }
  }

  setPosition(x: number, y: number): void {
    this.baseX = x;
    this.baseY = y;
    this.container.position.set(x, y);
  }

  reactToDisturbance(strength: number): void {
    if (strength < 0.6 || this.huffCooldown > 0) {
      return;
    }

    this.huffCooldown = 2.8;
    this.callbacks.onHuff();

    gsap.fromTo(
      this.head,
      { rotation: -0.06, y: this.head.y },
      {
        rotation: 0.14,
        y: this.head.y - 8,
        duration: 0.2,
        yoyo: true,
        repeat: 1,
        ease: 'power1.inOut',
      },
    );
  }

  reactToLegendarySelection(): void {
    gsap.to(this.container, {
      y: this.baseY - 12,
      duration: 0.45,
      yoyo: true,
      repeat: 1,
      ease: 'sine.inOut',
    });

    gsap.to(this.chestGlow, {
      alpha: 0.55,
      duration: 0.22,
      yoyo: true,
      repeat: 1,
      ease: 'power1.inOut',
    });
  }

  reactToStrongToss(x: number, y: number): void {
    const targetRotation = clamp((x - this.baseX) / 280, -0.25, 0.25);
    gsap.to(this.head, {
      rotation: targetRotation,
      duration: 0.22,
      ease: 'power2.out',
      onComplete: () => {
        gsap.to(this.head, { rotation: 0, duration: 0.42, ease: 'sine.out' });
      },
    });

    if (Math.random() < 0.5) {
      this.callbacks.onSmoke(this.baseX + 60, this.baseY - 88);
      this.callbacks.onSmoke(this.baseX + 88, this.baseY - 90);
    }

    if (Math.random() < 0.28) {
      this.callbacks.onNudgeNearby(x, y + 55);
    }
  }

  update(dt: number, pointerNormX: number, pointerNormY: number): void {
    this.blinkTimer += dt;
    this.smokeTimer += dt;
    this.postureTimer += dt;
    this.nudgeTimer += dt;
    this.rareTimer += dt;
    this.huffCooldown = Math.max(0, this.huffCooldown - dt);

    if (!this.reducedMotion) {
      const headTargetX = lerp(-0.1, 0.1, pointerNormX);
      const headTargetY = lerp(-0.06, 0.06, pointerNormY);
      this.head.rotation = this.head.rotation * 0.9 + headTargetX * 0.1;
      this.head.y = this.head.y * 0.93 + (-72 + headTargetY * 18) * 0.07;

      this.tail.rotation = Math.sin(performance.now() * 0.0012) * 0.14;
      this.wing.rotation = Math.sin(performance.now() * 0.0009) * 0.08;
    }

    if (this.blinkTimer > 2 + Math.random() * 3.2) {
      this.blinkTimer = 0;
      this.blink();
    }

    if (this.smokeTimer > 3.4 + Math.random() * 4.8) {
      this.smokeTimer = 0;
      this.callbacks.onSmoke(this.baseX + 86, this.baseY - 92);
      if (Math.random() < 0.5) {
        this.callbacks.onSmoke(this.baseX + 58, this.baseY - 90);
      }
    }

    if (!this.reducedMotion && this.postureTimer > 8.5 + Math.random() * 8) {
      this.postureTimer = 0;
      this.callbacks.onIdle();
      gsap.to(this.container, {
        x: this.baseX + (Math.random() - 0.5) * 14,
        y: this.baseY + (Math.random() - 0.5) * 9,
        duration: 1.2,
        yoyo: true,
        repeat: 1,
        ease: 'sine.inOut',
      });
    }

    if (this.nudgeTimer > 10 + Math.random() * 10) {
      this.nudgeTimer = 0;
      this.callbacks.onNudgeNearby(this.baseX - 120, this.baseY + 70);
    }

    if (!this.reducedMotion && this.rareTimer > 18 + Math.random() * 18) {
      this.rareTimer = 0;
      this.playRareAmbient();
      this.callbacks.onRareEvent();
    }
  }

  destroy(): void {
    this.breathTween?.kill();
    this.container.removeAllListeners();
    this.container.destroy({ children: true });
  }

  private draw(): void {
    this.body.clear();
    this.body.ellipse(0, 0, 150, 96).fill({ color: 0x2a2428, alpha: 0.98 });
    this.body.ellipse(0, 18, 132, 66).fill({ color: 0x3c3130, alpha: 0.75 });
    this.body.stroke({ color: 0x6b4f35, width: 2, alpha: 0.6 });

    this.chestGlow.clear();
    this.chestGlow.circle(8, 20, 52).fill({ color: 0xf3a64e, alpha: 0.28 });

    this.tail.clear();
    this.tail.poly([-120, 30, -220, 78, -188, 94, -116, 70]).fill({ color: 0x2f2a2c, alpha: 0.96 });

    this.wing.clear();
    this.wing.poly([-26, -46, -98, -130, 20, -122, 70, -22]).fill({ color: 0x2a272e, alpha: 0.9 });

    this.head.clear();
    this.head.ellipse(82, -72, 52, 40).fill({ color: 0x332b30, alpha: 0.98 });
    this.head.poly([106, -86, 138, -106, 126, -72]).fill({ color: 0x403134, alpha: 0.96 });
    this.head.poly([104, -54, 136, -34, 120, -50]).fill({ color: 0x403134, alpha: 0.96 });

    this.eyeLeft.clear();
    this.eyeLeft.circle(88, -84, 5).fill({ color: 0xffcf65, alpha: 0.96 });

    this.eyeRight.clear();
    this.eyeRight.circle(108, -82, 5).fill({ color: 0xffcf65, alpha: 0.96 });

    this.mountSpriteLayers();

    this.container.addChild(this.tail, this.wing, this.chestGlow, this.body, this.head, this.eyeLeft, this.eyeRight);
  }

  private startIdleAnimations(): void {
    this.breathTween = gsap.to(this.body.scale, {
      y: 1.04,
      x: 0.99,
      duration: this.reducedMotion ? 2.2 : 1.8,
      repeat: -1,
      yoyo: true,
      ease: 'sine.inOut',
      onRepeat: () => this.callbacks.onBreath(),
    });

    gsap.to(this.chestGlow, {
      alpha: 0.38,
      duration: 2.4,
      repeat: -1,
      yoyo: true,
      ease: 'sine.inOut',
    });
  }

  private blink(): void {
    gsap.to([this.eyeLeft.scale, this.eyeRight.scale], {
      y: 0.1,
      duration: 0.08,
      yoyo: true,
      repeat: 1,
      ease: 'power1.inOut',
    });
  }

  private playRareAmbient(): void {
    gsap.to(this.container, {
      x: this.baseX - 10,
      y: this.baseY - 10,
      duration: 0.44,
      yoyo: true,
      repeat: 1,
      ease: 'power1.inOut',
      onStart: () => {
        this.callbacks.onSmoke(this.baseX + 92, this.baseY - 90);
        this.callbacks.onSmoke(this.baseX + 58, this.baseY - 94);
      },
    });
  }

  private mountSpriteLayers(): void {
    if (this.spriteLayersMounted) {
      return;
    }

    const tailSprite = this.createSprite('/assets/dragon/dragon-tail.svg', 214, 114, -170, 86, 0.92);
    const wingSprite = this.createSprite('/assets/dragon/dragon-wing.svg', 206, 160, -24, -76, 0.86);
    const glowSprite = this.createSprite('/assets/dragon/dragon-glow.svg', 196, 124, 8, 20, 0.3);
    const bodySprite = this.createSprite('/assets/dragon/dragon-body.svg', 312, 206, 0, 0, 0.94);
    const headSprite = this.createSprite('/assets/dragon/dragon-head.svg', 154, 122, 90, -72, 0.96);
    const leftEyeSprite = this.createSprite('/assets/dragon/dragon-eye.svg', 18, 10, 88, -84, 0.95);
    const rightEyeSprite = this.createSprite('/assets/dragon/dragon-eye.svg', 18, 10, 108, -82, 0.95);

    leftEyeSprite.scale.x = 0.78;
    rightEyeSprite.scale.x = 0.72;

    this.tail.addChild(tailSprite);
    this.wing.addChild(wingSprite);
    this.chestGlow.addChild(glowSprite);
    this.body.addChild(bodySprite);
    this.head.addChild(headSprite);
    this.eyeLeft.addChild(leftEyeSprite);
    this.eyeRight.addChild(rightEyeSprite);

    this.body.alpha = 0.55;
    this.head.alpha = 0.62;
    this.tail.alpha = 0.62;
    this.wing.alpha = 0.58;
    this.eyeLeft.alpha = 0.42;
    this.eyeRight.alpha = 0.42;

    this.spriteLayersMounted = true;
  }

  private createSprite(path: string, width: number, height: number, x: number, y: number, alpha: number): Sprite {
    const sprite = Sprite.from(withBase(path));
    sprite.anchor.set(0.5);
    sprite.width = width;
    sprite.height = height;
    sprite.position.set(x, y);
    sprite.alpha = alpha;
    return sprite;
  }
}
