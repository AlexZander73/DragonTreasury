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
  private readonly bodyScales = new Graphics();
  private readonly neckSpines = new Graphics();
  private readonly rimLight = new Graphics();
  private readonly chestGlow = new Graphics();
  private readonly head = new Graphics();
  private readonly eyeLeft = new Graphics();
  private readonly eyeRight = new Graphics();
  private readonly tail = new Graphics();
  private readonly wing = new Graphics();

  private jawSprite: Sprite | null = null;
  private hornLeftSprite: Sprite | null = null;
  private hornRightSprite: Sprite | null = null;
  private glowSprite: Sprite | null = null;
  private hideTextureSprite: Sprite | null = null;
  private eyeAuraLeft: Graphics | null = null;
  private eyeAuraRight: Graphics | null = null;

  private spriteLayersMounted = false;

  private callbacks: DragonCallbacks;
  private reducedMotion: boolean;
  private breathTween: gsap.core.Tween | null = null;
  private chestGlowTween: gsap.core.Tween | null = null;
  private rimTween: gsap.core.Tween | null = null;
  private blinkTimer = 0;
  private smokeTimer = 0;
  private postureTimer = 0;
  private nudgeTimer = 0;
  private rareTimer = 0;
  private huffCooldown = 0;
  private clickCount = 0;

  private baseX = 0;
  private baseY = 0;
  private jawBaseRotation = 0.05;

  constructor(callbacks: DragonCallbacks, reducedMotion: boolean) {
    this.callbacks = callbacks;
    this.reducedMotion = reducedMotion;

    this.container.sortableChildren = true;
    this.container.eventMode = 'static';
    this.container.cursor = 'pointer';
    this.container.on('pointerdown', () => {
      this.clickCount += 1;
      this.callbacks.onClickCount?.(this.clickCount);

      if (this.jawSprite) {
        gsap.fromTo(
          this.jawSprite,
          { rotation: this.jawBaseRotation + 0.22 },
          { rotation: this.jawBaseRotation, duration: 0.3, ease: 'power2.out' },
        );
      }

      gsap.fromTo(this.head.scale, { x: 1.04, y: 1.04 }, { x: 1, y: 1, duration: 0.35, ease: 'back.out(2)' });

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
      this.chestGlowTween?.pause();
      this.rimTween?.pause();
    } else {
      this.breathTween?.resume();
      this.chestGlowTween?.resume();
      this.rimTween?.resume();
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

    if (this.jawSprite) {
      gsap.fromTo(
        this.jawSprite,
        { rotation: this.jawBaseRotation },
        {
          rotation: this.jawBaseRotation + 0.33,
          duration: 0.14,
          yoyo: true,
          repeat: 1,
          ease: 'power2.inOut',
        },
      );
    }

    gsap.fromTo(
      this.head,
      { rotation: -0.06, y: this.head.y },
      {
        rotation: 0.16,
        y: this.head.y - 10,
        duration: 0.24,
        yoyo: true,
        repeat: 1,
        ease: 'power1.inOut',
      },
    );

    gsap.to(this.rimLight, {
      alpha: 0.52,
      duration: 0.18,
      yoyo: true,
      repeat: 1,
      ease: 'power1.inOut',
    });
  }

  reactToLegendarySelection(): void {
    gsap.to(this.container, {
      y: this.baseY - 14,
      duration: 0.45,
      yoyo: true,
      repeat: 1,
      ease: 'sine.inOut',
    });

    gsap.to(this.chestGlow, {
      alpha: 0.7,
      duration: 0.24,
      yoyo: true,
      repeat: 1,
      ease: 'power1.inOut',
    });

    gsap.to(this.rimLight, {
      alpha: 0.56,
      duration: 0.22,
      yoyo: true,
      repeat: 1,
      ease: 'power1.inOut',
    });
  }

  reactToStrongToss(x: number, y: number): void {
    const targetRotation = clamp((x - this.baseX) / 260, -0.28, 0.28);
    gsap.to(this.head, {
      rotation: targetRotation,
      duration: 0.2,
      ease: 'power2.out',
      onComplete: () => {
        gsap.to(this.head, { rotation: 0, duration: 0.42, ease: 'sine.out' });
      },
    });

    if (this.jawSprite) {
      gsap.fromTo(
        this.jawSprite,
        { rotation: this.jawBaseRotation + 0.2 },
        {
          rotation: this.jawBaseRotation,
          duration: 0.24,
          ease: 'power2.out',
        },
      );
    }

    if (Math.random() < 0.6) {
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

    const now = performance.now() * 0.001;

    if (!this.reducedMotion) {
      const headTargetX = lerp(-0.1, 0.1, pointerNormX);
      const headTargetY = lerp(-0.06, 0.06, pointerNormY);
      this.head.rotation = this.head.rotation * 0.9 + headTargetX * 0.1;
      this.head.y = this.head.y * 0.93 + (-72 + headTargetY * 18) * 0.07;

      this.tail.rotation = Math.sin(now * 1.25) * 0.15;
      this.wing.rotation = Math.sin(now * 0.95) * 0.085;
      this.neckSpines.rotation = Math.sin(now * 0.7) * 0.04;
      this.bodyScales.y = Math.sin(now * 1.1) * 1.6;
    }

    if (this.jawSprite) {
      const jawPulse = this.reducedMotion ? 0 : Math.sin(now * 1.4) * 0.018;
      this.jawSprite.rotation = this.jawBaseRotation + jawPulse;
    }

    const eyeFlicker = 0.38 + Math.sin(now * 5.2) * 0.08;
    if (this.eyeAuraLeft) {
      this.eyeAuraLeft.alpha = eyeFlicker;
    }
    if (this.eyeAuraRight) {
      this.eyeAuraRight.alpha = eyeFlicker * 0.92;
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
    this.chestGlowTween?.kill();
    this.rimTween?.kill();
    this.container.removeAllListeners();
    this.container.destroy({ children: true });
  }

  private draw(): void {
    this.body.clear();
    this.body.ellipse(0, 0, 154, 98).fill({ color: 0x2c2428, alpha: 0.02 });
    this.body.ellipse(6, 20, 138, 72).fill({ color: 0x433531, alpha: 0.02 });
    this.body.stroke({ color: 0x7f5f43, width: 2.4, alpha: 0.03 });

    this.bodyScales.clear();
    this.bodyScales.ellipse(0, 0, 146, 92).fill({ color: 0xffffff, alpha: 0 });

    this.chestGlow.clear();
    this.chestGlow.circle(10, 20, 54).fill({ color: 0xf3a64e, alpha: 0.34 });
    this.chestGlow.blendMode = 'add';

    this.rimLight.clear();
    this.rimLight.ellipse(0, -2, 160, 100).stroke({ color: 0xffda94, width: 4, alpha: 0.28 });
    this.rimLight.alpha = 0.28;

    this.tail.clear();
    this.tail.poly([-122, 30, -226, 80, -192, 96, -116, 70]).fill({ color: 0x2f2a2c, alpha: 0.02 });

    this.wing.clear();
    this.wing.poly([-28, -48, -102, -132, 22, -124, 72, -24]).fill({ color: 0x2b2730, alpha: 0.02 });

    this.neckSpines.clear();
    this.neckSpines.poly([-40, -54, -2, -92, 20, -56]).fill({ color: 0x413336, alpha: 0.02 });

    this.head.clear();
    this.head.ellipse(84, -72, 54, 42).fill({ color: 0x352d32, alpha: 0.02 });
    this.head.poly([108, -88, 146, -112, 128, -74]).fill({ color: 0x423438, alpha: 0.02 });
    this.head.poly([104, -54, 142, -32, 120, -50]).fill({ color: 0x423438, alpha: 0.02 });

    this.eyeLeft.clear();
    this.eyeLeft.circle(88, -84, 5).fill({ color: 0xffcf65, alpha: 0.05 });

    this.eyeRight.clear();
    this.eyeRight.circle(108, -82, 5).fill({ color: 0xffcf65, alpha: 0.05 });

    this.mountSpriteLayers();

    this.container.addChild(
      this.tail,
      this.wing,
      this.body,
      this.bodyScales,
      this.neckSpines,
      this.chestGlow,
      this.rimLight,
      this.head,
      this.eyeLeft,
      this.eyeRight,
    );
  }

  private startIdleAnimations(): void {
    this.breathTween = gsap.to(this.body.scale, {
      y: 1.045,
      x: 0.992,
      duration: this.reducedMotion ? 2.4 : 1.85,
      repeat: -1,
      yoyo: true,
      ease: 'sine.inOut',
      onRepeat: () => this.callbacks.onBreath(),
    });

    this.chestGlowTween = gsap.to(this.chestGlow, {
      alpha: 0.48,
      duration: 2.5,
      repeat: -1,
      yoyo: true,
      ease: 'sine.inOut',
    });

    this.rimTween = gsap.to(this.rimLight, {
      alpha: 0.36,
      duration: this.reducedMotion ? 3.8 : 2.7,
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
      x: this.baseX - 12,
      y: this.baseY - 12,
      duration: 0.48,
      yoyo: true,
      repeat: 1,
      ease: 'power1.inOut',
      onStart: () => {
        this.rimLight.alpha = 0.56;
        this.callbacks.onSmoke(this.baseX + 92, this.baseY - 90);
        this.callbacks.onSmoke(this.baseX + 58, this.baseY - 94);
      },
      onComplete: () => {
        this.rimLight.alpha = 0.3;
      },
    });

    if (this.jawSprite) {
      gsap.fromTo(
        this.jawSprite,
        { rotation: this.jawBaseRotation + 0.34 },
        {
          rotation: this.jawBaseRotation,
          duration: 0.4,
          ease: 'power2.out',
        },
      );
    }
  }

  private mountSpriteLayers(): void {
    if (this.spriteLayersMounted) {
      return;
    }

    const tailSprite = this.createSprite('/assets/dragon/dragon-tail.svg', 232, 126, -170, 86, 0.96);
    const wingSprite = this.createSprite('/assets/dragon/dragon-wing.svg', 222, 174, -24, -78, 0.9);
    this.glowSprite = this.createSprite('/assets/dragon/dragon-glow.svg', 214, 138, 8, 20, 0.36);
    const bodySprite = this.createSprite('/assets/dragon/dragon-body.svg', 336, 220, 0, 0, 0.97);
    const scalesSprite = this.createSprite('/assets/dragon/dragon-scales.svg', 188, 92, 0, 0, 0.72);
    this.hideTextureSprite = this.createSprite('/assets/textures/dragon-hide.svg', 196, 98, 0, 2, 0.26);
    this.hideTextureSprite.blendMode = 'multiply';
    const spinesSprite = this.createSprite('/assets/dragon/dragon-spines.svg', 164, 60, -8, -66, 0.64);

    const headSprite = this.createSprite('/assets/dragon/dragon-head.svg', 176, 132, 94, -74, 0.98);

    this.jawSprite = this.createSprite('/assets/dragon/dragon-jaw.svg', 118, 58, 126, -42, 0.96);
    this.jawSprite.anchor.set(0.18, 0.26);
    this.jawSprite.rotation = this.jawBaseRotation;

    this.hornLeftSprite = this.createSprite('/assets/dragon/dragon-horn.svg', 44, 58, 156, -132, 0.95);
    this.hornRightSprite = this.createSprite('/assets/dragon/dragon-horn.svg', 42, 56, 178, -126, 0.9);
    this.hornRightSprite.scale.x = -0.86;

    const leftEyeCore = this.createSprite('/assets/dragon/dragon-eye.svg', 20, 10, 88, -84, 0.98);
    const rightEyeCore = this.createSprite('/assets/dragon/dragon-eye.svg', 19, 10, 108, -82, 0.95);
    rightEyeCore.scale.x = 0.88;

    this.eyeAuraLeft = new Graphics();
    this.eyeAuraLeft.circle(88, -84, 10).fill({ color: 0xffbf66, alpha: 0.4 });
    this.eyeAuraLeft.blendMode = 'add';

    this.eyeAuraRight = new Graphics();
    this.eyeAuraRight.circle(108, -82, 9).fill({ color: 0xffbf66, alpha: 0.36 });
    this.eyeAuraRight.blendMode = 'add';

    this.tail.addChild(tailSprite);
    this.wing.addChild(wingSprite);
    this.chestGlow.addChild(this.glowSprite);
    this.body.addChild(bodySprite);
    this.bodyScales.addChild(scalesSprite);
    this.bodyScales.addChild(this.hideTextureSprite);
    this.neckSpines.addChild(spinesSprite);
    this.head.addChild(headSprite, this.hornLeftSprite, this.hornRightSprite, this.jawSprite);
    this.eyeLeft.addChild(this.eyeAuraLeft, leftEyeCore);
    this.eyeRight.addChild(this.eyeAuraRight, rightEyeCore);

    this.body.alpha = 0.88;
    this.bodyScales.alpha = 0.9;
    this.neckSpines.alpha = 0.9;
    this.head.alpha = 0.94;
    this.tail.alpha = 0.9;
    this.wing.alpha = 0.84;
    this.eyeLeft.alpha = 0.86;
    this.eyeRight.alpha = 0.82;

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
