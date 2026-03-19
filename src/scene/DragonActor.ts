import { Container, Graphics, Sprite } from 'pixi.js';
import gsap from 'gsap';
import type { DragonColorTheme } from '../types/dragon';
import { clamp, lerp } from '../utils/math';
import type { DragonAtlasFrameKey } from './atlasData';
import { getDragonAtlasTexture } from './atlasTextures';

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

interface DragonColorStyle {
  body: number;
  head: number;
  wing: number;
  tail: number;
  scales: number;
  spines: number;
  horns: number;
  jaw: number;
  glow: number;
  eyes: number;
  aura: number;
  rim: number;
}

const DRAGON_COLOR_STYLES: Record<DragonColorTheme, DragonColorStyle> = {
  ember: {
    body: 0xffffff,
    head: 0xffffff,
    wing: 0xffffff,
    tail: 0xffffff,
    scales: 0xf6e0c0,
    spines: 0xeec9a5,
    horns: 0xffe0b8,
    jaw: 0xf4d9b8,
    glow: 0xf6b26c,
    eyes: 0xffcf73,
    aura: 0xffbf66,
    rim: 0xffdb98,
  },
  verdant: {
    body: 0xbfd8b2,
    head: 0xc7e1b9,
    wing: 0x9eb596,
    tail: 0xa6be9d,
    scales: 0xe0f1c8,
    spines: 0xd4e6bf,
    horns: 0xefe1c6,
    jaw: 0xd6e6c7,
    glow: 0x86cf7b,
    eyes: 0xd4ff8f,
    aura: 0x8de88c,
    rim: 0xc7ebb2,
  },
  sapphire: {
    body: 0xb7c9ea,
    head: 0xc6d6f3,
    wing: 0x8fa8d4,
    tail: 0x9bb3de,
    scales: 0xd9e6ff,
    spines: 0xcfdcf5,
    horns: 0xf0ead9,
    jaw: 0xd1ddf1,
    glow: 0x84b8ef,
    eyes: 0xc8e5ff,
    aura: 0x90cdf8,
    rim: 0xb6d5ff,
  },
  amethyst: {
    body: 0xd2bbe6,
    head: 0xddc8ef,
    wing: 0xb293cd,
    tail: 0xb89ad3,
    scales: 0xecddfa,
    spines: 0xe3d1f4,
    horns: 0xf0e6dd,
    jaw: 0xdccbe9,
    glow: 0xc188ec,
    eyes: 0xf2d9ff,
    aura: 0xd4a5f1,
    rim: 0xe0b9ff,
  },
  obsidian: {
    body: 0xb7b0ba,
    head: 0xc7c0ca,
    wing: 0x8f8894,
    tail: 0x94909b,
    scales: 0xd6d0da,
    spines: 0xc7bfcc,
    horns: 0xd8cfbf,
    jaw: 0xbbb5bf,
    glow: 0xc99f78,
    eyes: 0xffc98a,
    aura: 0xe2b486,
    rim: 0xdbd1c6,
  },
};

export class DragonActor {
  readonly container = new Container();
  private readonly body = new Graphics();
  private readonly bodyScales = new Graphics();
  private readonly neckSpines = new Graphics();
  private readonly rimLight = new Graphics();
  private readonly chestGlow = new Graphics();
  private readonly throatShadow = new Graphics();
  private readonly bellyPlates = new Graphics();
  private readonly head = new Graphics();
  private readonly eyeLeft = new Graphics();
  private readonly eyeRight = new Graphics();
  private readonly tail = new Graphics();
  private readonly wing = new Graphics();
  private readonly clawLeft = new Graphics();
  private readonly clawRight = new Graphics();

  private jawSprite: Sprite | null = null;
  private hornLeftSprite: Sprite | null = null;
  private hornRightSprite: Sprite | null = null;
  private glowSprite: Sprite | null = null;
  private bodySprite: Sprite | null = null;
  private headSprite: Sprite | null = null;
  private tailSprite: Sprite | null = null;
  private wingSprite: Sprite | null = null;
  private scalesSprite: Sprite | null = null;
  private spinesSprite: Sprite | null = null;
  private eyeLeftCore: Sprite | null = null;
  private eyeRightCore: Sprite | null = null;
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
  private colorTheme: DragonColorTheme;

  private baseX = 0;
  private baseY = 0;
  private jawBaseRotation = 0.05;

  constructor(callbacks: DragonCallbacks, reducedMotion: boolean, colorTheme: DragonColorTheme) {
    this.callbacks = callbacks;
    this.reducedMotion = reducedMotion;
    this.colorTheme = colorTheme;

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
    this.setColorTheme(colorTheme);
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

  setColorTheme(theme: DragonColorTheme): void {
    this.colorTheme = theme;
    const style = DRAGON_COLOR_STYLES[theme];

    if (this.bodySprite) {
      this.bodySprite.tint = style.body;
    }
    if (this.headSprite) {
      this.headSprite.tint = style.head;
    }
    if (this.wingSprite) {
      this.wingSprite.tint = style.wing;
    }
    if (this.tailSprite) {
      this.tailSprite.tint = style.tail;
    }
    if (this.scalesSprite) {
      this.scalesSprite.tint = style.scales;
    }
    if (this.spinesSprite) {
      this.spinesSprite.tint = style.spines;
    }
    if (this.hornLeftSprite) {
      this.hornLeftSprite.tint = style.horns;
    }
    if (this.hornRightSprite) {
      this.hornRightSprite.tint = style.horns;
    }
    if (this.jawSprite) {
      this.jawSprite.tint = style.jaw;
    }
    if (this.glowSprite) {
      this.glowSprite.tint = style.glow;
    }
    if (this.eyeLeftCore) {
      this.eyeLeftCore.tint = style.eyes;
    }
    if (this.eyeRightCore) {
      this.eyeRightCore.tint = style.eyes;
    }
    if (this.eyeAuraLeft) {
      this.eyeAuraLeft.tint = style.aura;
    }
    if (this.eyeAuraRight) {
      this.eyeAuraRight.tint = style.aura;
    }
    this.chestGlow.tint = style.glow;
    this.rimLight.tint = style.rim;
    this.clawLeft.tint = style.horns;
    this.clawRight.tint = style.horns;
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
    const breathe = Math.sin(now * 1.18);
    const hover = Math.sin(now * 0.62);

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

    if (this.bodySprite) {
      this.bodySprite.y = breathe * 1.6 + hover * 0.8;
      this.bodySprite.scale.y = 1 + breathe * 0.014;
    }
    if (this.scalesSprite) {
      this.scalesSprite.y = 0.6 + breathe * 1.2;
      this.scalesSprite.alpha = 0.68 + (this.reducedMotion ? 0 : Math.sin(now * 1.7) * 0.06);
    }
    if (this.tailSprite) {
      this.tailSprite.rotation = (this.reducedMotion ? 0.01 : Math.sin(now * 1.06) * 0.14) + Math.sin(now * 2.6) * 0.03;
      this.tailSprite.y = hover * 2.4;
    }
    if (this.wingSprite) {
      this.wingSprite.rotation = this.reducedMotion ? -0.02 : Math.sin(now * 0.74) * 0.09 - 0.03;
      this.wingSprite.scale.y = 1 + (this.reducedMotion ? 0 : Math.sin(now * 0.8) * 0.02);
    }
    if (this.spinesSprite) {
      this.spinesSprite.rotation = this.reducedMotion ? 0 : Math.sin(now * 0.92) * 0.05;
    }
    if (this.headSprite) {
      this.headSprite.y = this.reducedMotion ? 0 : Math.sin(now * 1.12) * 1.4;
    }
    if (this.hornLeftSprite && this.hornRightSprite && !this.reducedMotion) {
      const hornWave = Math.sin(now * 0.9) * 0.04;
      this.hornLeftSprite.rotation = hornWave;
      this.hornRightSprite.rotation = -0.06 - hornWave * 0.7;
    }
    if (this.glowSprite) {
      const glowPulse = this.reducedMotion ? 0.94 : 0.86 + Math.sin(now * 2.35) * 0.1;
      this.glowSprite.alpha = 0.32 * glowPulse;
      this.glowSprite.scale.set(1 + (glowPulse - 0.9) * 0.18, 1 + (glowPulse - 0.9) * 0.14);
    }

    if (this.jawSprite) {
      const jawPulse = this.reducedMotion ? 0 : Math.sin(now * 1.4) * 0.018;
      this.jawSprite.rotation = this.jawBaseRotation + jawPulse;
    }

    const eyeOffsetX = this.reducedMotion ? 0 : lerp(-1.2, 1.2, pointerNormX);
    const eyeOffsetY = this.reducedMotion ? 0 : lerp(-0.8, 0.9, pointerNormY);
    if (this.eyeLeftCore) {
      this.eyeLeftCore.x = 88 + eyeOffsetX;
      this.eyeLeftCore.y = -84 + eyeOffsetY;
    }
    if (this.eyeRightCore) {
      this.eyeRightCore.x = 108 + eyeOffsetX * 0.85;
      this.eyeRightCore.y = -82 + eyeOffsetY * 0.85;
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
    this.body.ellipse(0, 0, 154, 98).fill({ color: 0x150f13, alpha: 0.22 });
    this.body.ellipse(6, 20, 138, 72).fill({ color: 0x24181d, alpha: 0.18 });
    this.body.stroke({ color: 0x87654a, width: 2, alpha: 0.18 });

    this.bodyScales.clear();
    this.bodyScales.ellipse(0, 0, 146, 92).fill({ color: 0xffffff, alpha: 0 });

    this.chestGlow.clear();
    this.chestGlow.circle(10, 20, 56).fill({ color: 0xf3a64e, alpha: 0.32 });
    this.chestGlow.blendMode = 'add';

    this.throatShadow.clear();
    this.throatShadow.ellipse(68, -34, 44, 22).fill({ color: 0x09060b, alpha: 0.22 });
    this.throatShadow.ellipse(44, -8, 62, 32).fill({ color: 0x120b10, alpha: 0.18 });
    this.throatShadow.blendMode = 'multiply';

    this.bellyPlates.clear();
    for (let i = 0; i < 6; i += 1) {
      const t = i / 5;
      this.bellyPlates
        .ellipse(18 + t * 64, 24 + t * 18, 10 - t * 1.5, 6 - t * 0.8)
        .fill({ color: 0xc5a075, alpha: 0.24 - t * 0.04 });
    }
    this.bellyPlates.stroke({ color: 0x5c422e, width: 1, alpha: 0.22 });

    this.rimLight.clear();
    this.rimLight.ellipse(0, -2, 160, 100).stroke({ color: 0xffda94, width: 4, alpha: 0.28 });
    this.rimLight.alpha = 0.28;

    this.tail.clear();
    this.tail.poly([-122, 30, -226, 80, -192, 96, -116, 70]).fill({ color: 0x221c22, alpha: 0.2 });

    this.wing.clear();
    this.wing.poly([-28, -48, -102, -132, 22, -124, 72, -24]).fill({ color: 0x19141f, alpha: 0.18 });

    this.neckSpines.clear();
    this.neckSpines.poly([-40, -54, -2, -92, 20, -56]).fill({ color: 0x2c2329, alpha: 0.24 });

    this.head.clear();
    this.head.ellipse(84, -72, 54, 42).fill({ color: 0x231b22, alpha: 0.22 });
    this.head.poly([108, -88, 146, -112, 128, -74]).fill({ color: 0x2f2530, alpha: 0.2 });
    this.head.poly([104, -54, 142, -32, 120, -50]).fill({ color: 0x2f2530, alpha: 0.2 });

    this.eyeLeft.clear();
    this.eyeLeft.circle(88, -84, 5).fill({ color: 0xffcf65, alpha: 0.84 });

    this.eyeRight.clear();
    this.eyeRight.circle(108, -82, 5).fill({ color: 0xffcf65, alpha: 0.82 });

    this.clawLeft.clear();
    this.clawLeft.poly([66, 82, 74, 98, 84, 84]).fill({ color: 0xcdb08b, alpha: 0.34 });
    this.clawLeft.poly([78, 86, 88, 104, 98, 88]).fill({ color: 0xb69977, alpha: 0.3 });
    this.clawLeft.blendMode = 'screen';

    this.clawRight.clear();
    this.clawRight.poly([98, 80, 106, 96, 116, 82]).fill({ color: 0xc5a884, alpha: 0.3 });
    this.clawRight.poly([110, 84, 120, 102, 130, 86]).fill({ color: 0xb09172, alpha: 0.28 });
    this.clawRight.blendMode = 'screen';

    this.mountSpriteLayers();

    this.container.addChild(
      this.tail,
      this.wing,
      this.body,
      this.bodyScales,
      this.neckSpines,
      this.bellyPlates,
      this.chestGlow,
      this.throatShadow,
      this.rimLight,
      this.head,
      this.eyeLeft,
      this.eyeRight,
      this.clawLeft,
      this.clawRight,
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

    if (this.wingSprite) {
      gsap.to(this.wingSprite, {
        rotation: -0.22,
        duration: 0.3,
        yoyo: true,
        repeat: 1,
        ease: 'sine.inOut',
      });
    }
    if (this.tailSprite) {
      gsap.to(this.tailSprite, {
        rotation: 0.26,
        duration: 0.24,
        yoyo: true,
        repeat: 1,
        ease: 'sine.inOut',
      });
    }

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

    this.tailSprite = this.createSprite('dragon-tail', 244, 138, -170, 84, 0.98);
    this.wingSprite = this.createSprite('dragon-wing', 236, 188, -22, -82, 0.9);
    this.glowSprite = this.createSprite('dragon-glow', 220, 148, 10, 22, 0.34);
    this.bodySprite = this.createSprite('dragon-body', 348, 232, 0, 0, 0.99);
    this.scalesSprite = this.createSprite('dragon-scales', 196, 98, -1, 2, 0.72);
    this.spinesSprite = this.createSprite('dragon-spines', 174, 64, -8, -68, 0.62);

    this.headSprite = this.createSprite('dragon-head', 188, 140, 94, -74, 0.98);

    this.jawSprite = this.createSprite('dragon-jaw', 124, 64, 128, -42, 0.96);
    this.jawSprite.anchor.set(0.18, 0.26);
    this.jawSprite.rotation = this.jawBaseRotation;

    this.hornLeftSprite = this.createSprite('dragon-horn', 48, 64, 156, -132, 0.96);
    this.hornRightSprite = this.createSprite('dragon-horn', 44, 62, 178, -126, 0.92);
    this.hornRightSprite.scale.x = -0.86;
    this.hornRightSprite.rotation = -0.06;

    this.eyeLeftCore = this.createSprite('dragon-eye', 21, 11, 88, -84, 0.98);
    this.eyeRightCore = this.createSprite('dragon-eye', 20, 11, 108, -82, 0.95);
    this.eyeRightCore.scale.x = 0.88;

    this.eyeAuraLeft = new Graphics();
    this.eyeAuraLeft.circle(88, -84, 10).fill({ color: 0xffbf66, alpha: 0.4 });
    this.eyeAuraLeft.blendMode = 'add';

    this.eyeAuraRight = new Graphics();
    this.eyeAuraRight.circle(108, -82, 9).fill({ color: 0xffbf66, alpha: 0.36 });
    this.eyeAuraRight.blendMode = 'add';

    this.tail.addChild(this.tailSprite);
    this.wing.addChild(this.wingSprite);
    this.chestGlow.addChild(this.glowSprite);
    this.body.addChild(this.bodySprite);
    this.bodyScales.addChild(this.scalesSprite);
    this.neckSpines.addChild(this.spinesSprite);
    this.head.addChild(this.headSprite, this.hornLeftSprite, this.hornRightSprite, this.jawSprite);
    this.eyeLeft.addChild(this.eyeAuraLeft, this.eyeLeftCore);
    this.eyeRight.addChild(this.eyeAuraRight, this.eyeRightCore);

    this.body.alpha = 0.98;
    this.bodyScales.alpha = 0.88;
    this.neckSpines.alpha = 0.82;
    this.head.alpha = 0.96;
    this.tail.alpha = 0.93;
    this.wing.alpha = 0.9;
    this.eyeLeft.alpha = 0.86;
    this.eyeRight.alpha = 0.82;

    this.spriteLayersMounted = true;
  }

  private createSprite(
    atlasKey: DragonAtlasFrameKey,
    width: number,
    height: number,
    x: number,
    y: number,
    alpha: number,
  ): Sprite {
    const sprite = new Sprite(getDragonAtlasTexture(atlasKey));
    sprite.anchor.set(0.5);
    sprite.width = width;
    sprite.height = height;
    sprite.position.set(x, y);
    sprite.alpha = alpha;
    return sprite;
  }
}
