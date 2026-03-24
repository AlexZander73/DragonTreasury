import { Container, Sprite, Texture } from 'pixi.js';
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
  shadow: number;
  belly: number;
}

const DRAGON_COLOR_STYLES: Record<DragonColorTheme, DragonColorStyle> = {
  ember: {
    body: 0xffffff,
    head: 0xffffff,
    wing: 0xffffff,
    tail: 0xffffff,
    scales: 0xf4d6b2,
    spines: 0xf0cfad,
    horns: 0xf8deb9,
    jaw: 0xf3d4b2,
    glow: 0xffac55,
    eyes: 0xffd37b,
    aura: 0xffb56b,
    rim: 0xffdda7,
    shadow: 0x1a0f12,
    belly: 0xe0b88d,
  },
  verdant: {
    body: 0xc8d8bd,
    head: 0xd2e2c7,
    wing: 0xa8bf9e,
    tail: 0xb2c6a8,
    scales: 0xe7f2d6,
    spines: 0xdceacc,
    horns: 0xe7dfc9,
    jaw: 0xd7e2cd,
    glow: 0x8ed07b,
    eyes: 0xdbff9f,
    aura: 0x98eba0,
    rim: 0xcce8b9,
    shadow: 0x121712,
    belly: 0xc7cfa6,
  },
  sapphire: {
    body: 0xc2cff0,
    head: 0xd2ddf5,
    wing: 0x9ab2db,
    tail: 0xa6bde3,
    scales: 0xe0eaff,
    spines: 0xd3def6,
    horns: 0xeee7d8,
    jaw: 0xd5dfef,
    glow: 0x88bdf2,
    eyes: 0xd4ecff,
    aura: 0x94d0fb,
    rim: 0xc0ddff,
    shadow: 0x101624,
    belly: 0xb6c4da,
  },
  amethyst: {
    body: 0xd2bfe6,
    head: 0xe0d0f0,
    wing: 0xb89ace,
    tail: 0xbea4d3,
    scales: 0xeadcf9,
    spines: 0xe2d2f3,
    horns: 0xede3dc,
    jaw: 0xdbcbe8,
    glow: 0xc78ced,
    eyes: 0xf2dcff,
    aura: 0xd9acef,
    rim: 0xe6c3ff,
    shadow: 0x191126,
    belly: 0xcdafd8,
  },
  obsidian: {
    body: 0xbdb7c1,
    head: 0xc9c3cd,
    wing: 0x9a949e,
    tail: 0x9f9aa5,
    scales: 0xd5cfda,
    spines: 0xc9c3cd,
    horns: 0xd8cfc0,
    jaw: 0xbeb8c2,
    glow: 0xd2a87c,
    eyes: 0xffcb8e,
    aura: 0xe0b888,
    rim: 0xded4c8,
    shadow: 0x141315,
    belly: 0xb8aa96,
  },
};

interface LayerSpriteSet {
  base: Sprite;
  shadow: Sprite;
  rim: Sprite;
}

let eyeAuraTexture: Texture | null = null;
let emberCoreTexture: Texture | null = null;
let smokeTexture: Texture | null = null;
let throatShadowTexture: Texture | null = null;

const createRadialTexture = (size: number, stops: Array<{ offset: number; color: string }>): Texture => {
  if (typeof document === 'undefined') {
    return Texture.WHITE;
  }

  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    return Texture.WHITE;
  }

  const grad = ctx.createRadialGradient(size * 0.5, size * 0.5, 0, size * 0.5, size * 0.5, size * 0.5);
  for (const stop of stops) {
    grad.addColorStop(stop.offset, stop.color);
  }

  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);

  return Texture.from(canvas);
};

const getEyeAuraTexture = (): Texture => {
  if (!eyeAuraTexture) {
    eyeAuraTexture = createRadialTexture(96, [
      { offset: 0, color: 'rgba(255, 208, 136, 0.95)' },
      { offset: 0.38, color: 'rgba(255, 170, 90, 0.45)' },
      { offset: 1, color: 'rgba(255, 150, 72, 0)' },
    ]);
  }
  return eyeAuraTexture;
};

const getEmberCoreTexture = (): Texture => {
  if (!emberCoreTexture) {
    emberCoreTexture = createRadialTexture(256, [
      { offset: 0, color: 'rgba(255, 250, 206, 1)' },
      { offset: 0.24, color: 'rgba(255, 192, 104, 0.98)' },
      { offset: 0.58, color: 'rgba(255, 106, 42, 0.75)' },
      { offset: 1, color: 'rgba(130, 18, 14, 0)' },
    ]);
  }
  return emberCoreTexture;
};

const getSmokeTexture = (): Texture => {
  if (!smokeTexture) {
    smokeTexture = createRadialTexture(160, [
      { offset: 0, color: 'rgba(185, 170, 156, 0.46)' },
      { offset: 0.5, color: 'rgba(112, 104, 101, 0.24)' },
      { offset: 1, color: 'rgba(84, 80, 84, 0)' },
    ]);
  }
  return smokeTexture;
};

const getThroatShadowTexture = (): Texture => {
  if (!throatShadowTexture) {
    throatShadowTexture = createRadialTexture(220, [
      { offset: 0, color: 'rgba(18, 10, 12, 0.75)' },
      { offset: 1, color: 'rgba(0, 0, 0, 0)' },
    ]);
  }
  return throatShadowTexture;
};

export class DragonActor {
  readonly container = new Container();
  private readonly body = new Container();
  private readonly bodyScales = new Container();
  private readonly neckSpines = new Container();
  private readonly rimLight = new Container();
  private readonly chestGlow = new Container();
  private readonly throatShadow = new Container();
  private readonly bellyPlates = new Container();
  private readonly head = new Container();
  private readonly eyeLeft = new Container();
  private readonly eyeRight = new Container();
  private readonly tail = new Container();
  private readonly wing = new Container();
  private readonly clawLeft = new Container();
  private readonly clawRight = new Container();
  private readonly smokeOverlay = new Container();

  private jawSprite: Sprite | null = null;
  private hornLeftSprite: Sprite | null = null;
  private hornRightSprite: Sprite | null = null;
  private glowSprite: Sprite | null = null;
  private emberCoreSprite: Sprite | null = null;
  private innerCoilSprite: Sprite | null = null;
  private bellySprite: Sprite | null = null;
  private bodyLayers: LayerSpriteSet | null = null;
  private headLayers: LayerSpriteSet | null = null;
  private tailLayers: LayerSpriteSet | null = null;
  private wingLayers: LayerSpriteSet | null = null;
  private scalesSprite: Sprite | null = null;
  private spinesSprite: Sprite | null = null;
  private eyeLeftCore: Sprite | null = null;
  private eyeRightCore: Sprite | null = null;
  private eyeAuraLeft: Sprite | null = null;
  private eyeAuraRight: Sprite | null = null;
  private clawLeftSprite: Sprite | null = null;
  private clawRightSprite: Sprite | null = null;
  private throatShadowSprite: Sprite | null = null;
  private smokeLeftSprite: Sprite | null = null;
  private smokeRightSprite: Sprite | null = null;

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
  private readonly facing = -1;
  private headBaseY = -72;
  private jawBaseRotation = 0.05;
  private eyeLeftBase = { x: -6, y: -10 };
  private eyeRightBase = { x: 14, y: -8 };

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

      gsap.fromTo(this.head.scale, { x: 1.035, y: 1.035 }, { x: 1, y: 1, duration: 0.35, ease: 'back.out(2)' });

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

    this.bodyLayers?.base && (this.bodyLayers.base.tint = style.body);
    this.headLayers?.base && (this.headLayers.base.tint = style.head);
    this.wingLayers?.base && (this.wingLayers.base.tint = style.wing);
    this.tailLayers?.base && (this.tailLayers.base.tint = style.tail);
    this.scalesSprite && (this.scalesSprite.tint = style.scales);
    this.spinesSprite && (this.spinesSprite.tint = style.spines);
    this.hornLeftSprite && (this.hornLeftSprite.tint = style.horns);
    this.hornRightSprite && (this.hornRightSprite.tint = style.horns);
    this.jawSprite && (this.jawSprite.tint = style.jaw);
    this.innerCoilSprite && (this.innerCoilSprite.tint = style.body);
    this.bellySprite && (this.bellySprite.tint = style.belly);
    this.clawLeftSprite && (this.clawLeftSprite.tint = style.horns);
    this.clawRightSprite && (this.clawRightSprite.tint = style.horns);

    if (this.glowSprite) {
      this.glowSprite.tint = style.glow;
    }
    if (this.emberCoreSprite) {
      this.emberCoreSprite.tint = style.glow;
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

    if (this.bodyLayers?.shadow) {
      this.bodyLayers.shadow.tint = style.shadow;
    }
    if (this.headLayers?.shadow) {
      this.headLayers.shadow.tint = style.shadow;
    }
    if (this.wingLayers?.shadow) {
      this.wingLayers.shadow.tint = style.shadow;
    }
    if (this.tailLayers?.shadow) {
      this.tailLayers.shadow.tint = style.shadow;
    }
    if (this.throatShadowSprite) {
      this.throatShadowSprite.tint = style.shadow;
    }

    if (this.bodyLayers?.rim) {
      this.bodyLayers.rim.tint = style.rim;
    }
    if (this.headLayers?.rim) {
      this.headLayers.rim.tint = style.rim;
    }
    if (this.wingLayers?.rim) {
      this.wingLayers.rim.tint = style.rim;
    }
    if (this.tailLayers?.rim) {
      this.tailLayers.rim.tint = style.rim;
    }
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
      alpha: 0.56,
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
      alpha: 0.76,
      duration: 0.24,
      yoyo: true,
      repeat: 1,
      ease: 'power1.inOut',
    });

    gsap.to(this.rimLight, {
      alpha: 0.58,
      duration: 0.22,
      yoyo: true,
      repeat: 1,
      ease: 'power1.inOut',
    });
  }

  reactToStrongToss(x: number, y: number): void {
    const targetRotation = clamp(((x - this.baseX) / 260) * this.facing, -0.28, 0.28);
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
      this.callbacks.onSmoke(this.worldX(60), this.baseY - 88);
      this.callbacks.onSmoke(this.worldX(88), this.baseY - 90);
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
      this.head.y = this.head.y * 0.93 + (this.headBaseY + headTargetY * 18) * 0.07;

      this.tail.rotation = Math.sin(now * 1.25) * 0.15;
      this.wing.rotation = Math.sin(now * 0.95) * 0.085;
      this.neckSpines.rotation = Math.sin(now * 0.7) * 0.04;
      this.bodyScales.y = Math.sin(now * 1.1) * 1.6;
    }

    this.body.y = breathe * 1.5 + hover * 0.7;
    this.body.scale.y = 1 + breathe * 0.012;

    if (this.scalesSprite) {
      this.scalesSprite.y = 0.8 + breathe * 1.1;
      this.scalesSprite.alpha = 0.72 + (this.reducedMotion ? 0 : Math.sin(now * 1.65) * 0.06);
    }

    if (this.bellySprite) {
      this.bellySprite.alpha = 0.62 + (this.reducedMotion ? 0 : Math.sin(now * 0.9) * 0.05);
    }

    if (this.tailLayers?.base) {
      this.tailLayers.base.rotation = (this.reducedMotion ? 0 : Math.sin(now * 1.06) * 0.12) + Math.sin(now * 2.6) * 0.02;
      this.tailLayers.base.y = hover * 1.9;
    }

    if (this.wingLayers?.base) {
      this.wingLayers.base.rotation = this.reducedMotion ? -0.03 : Math.sin(now * 0.74) * 0.08 - 0.04;
      this.wingLayers.base.scale.y = 1 + (this.reducedMotion ? 0 : Math.sin(now * 0.84) * 0.02);
    }

    if (this.spinesSprite) {
      this.spinesSprite.rotation = this.reducedMotion ? 0 : Math.sin(now * 0.92) * 0.05;
    }

    if (this.headLayers?.base) {
      this.headLayers.base.y = this.reducedMotion ? 0 : Math.sin(now * 1.08) * 1.3;
    }

    if (this.hornLeftSprite && this.hornRightSprite && !this.reducedMotion) {
      const hornWave = Math.sin(now * 0.9) * 0.04;
      this.hornLeftSprite.rotation = hornWave;
      this.hornRightSprite.rotation = -0.08 - hornWave * 0.7;
    }

    if (this.glowSprite) {
      const glowPulse = this.reducedMotion ? 0.95 : 0.86 + Math.sin(now * 2.35) * 0.1;
      this.glowSprite.alpha = 0.38 * glowPulse;
      this.glowSprite.scale.set(1 + (glowPulse - 0.9) * 0.16, 1 + (glowPulse - 0.9) * 0.12);
    }

    if (this.emberCoreSprite) {
      const pulse = this.reducedMotion ? 0.94 : 0.86 + Math.sin(now * 2.9) * 0.12;
      this.emberCoreSprite.alpha = 0.62 * pulse;
      this.emberCoreSprite.scale.set(0.98 + pulse * 0.08, 0.96 + pulse * 0.07);
    }

    if (this.jawSprite) {
      const jawPulse = this.reducedMotion ? 0 : Math.sin(now * 1.4) * 0.018;
      this.jawSprite.rotation = this.jawBaseRotation + jawPulse;
    }

    if (this.smokeLeftSprite && this.smokeRightSprite) {
      const smokePulse = this.reducedMotion ? 0.22 : 0.18 + Math.sin(now * 0.8) * 0.06;
      this.smokeLeftSprite.alpha = smokePulse;
      this.smokeRightSprite.alpha = smokePulse * 0.9;
      const drift = this.reducedMotion ? 0 : Math.sin(now * 0.65) * 2;
      this.smokeLeftSprite.y = -14 + drift;
      this.smokeRightSprite.y = -16 + drift * 0.8;
      const swell = this.reducedMotion ? 1.02 : 1 + Math.sin(now * 0.58) * 0.04;
      this.smokeLeftSprite.scale.set(swell, swell * 0.95);
      this.smokeRightSprite.scale.set(swell * 0.95, swell * 0.9);
    }

    const eyeOffsetX = this.reducedMotion ? 0 : lerp(-1.2, 1.2, pointerNormX);
    const eyeOffsetY = this.reducedMotion ? 0 : lerp(-0.8, 0.9, pointerNormY);
    this.eyeLeft.position.set(this.eyeLeftBase.x + eyeOffsetX, this.eyeLeftBase.y + eyeOffsetY);
    this.eyeRight.position.set(this.eyeRightBase.x + eyeOffsetX * 0.85, this.eyeRightBase.y + eyeOffsetY * 0.85);

    const eyeFlicker = 0.46 + Math.sin(now * 5.2) * 0.09;
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
      this.callbacks.onSmoke(this.worldX(86), this.baseY - 92);
      if (Math.random() < 0.5) {
        this.callbacks.onSmoke(this.worldX(58), this.baseY - 90);
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
      this.callbacks.onNudgeNearby(this.worldX(120), this.baseY + 70);
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
    this.mountSpriteLayers();
    this.container.scale.set(this.facing, 1);

    this.container.removeChildren();
    this.container.addChild(
      this.tail,
      this.wing,
      this.body,
      this.bodyScales,
      this.bellyPlates,
      this.neckSpines,
      this.chestGlow,
      this.throatShadow,
      this.clawLeft,
      this.clawRight,
      this.head,
      this.rimLight,
      this.smokeOverlay,
    );

    this.body.alpha = 0.99;
    this.bodyScales.alpha = 0.56;
    this.neckSpines.alpha = 0.52;
    this.head.alpha = 0.98;
    this.tail.alpha = 0.9;
    this.wing.alpha = 0.9;
    this.bellyPlates.alpha = 0.52;
    this.rimLight.alpha = 0.16;
    this.smokeOverlay.alpha = 0.6;
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
      alpha: 0.58,
      duration: 2.4,
      repeat: -1,
      yoyo: true,
      ease: 'sine.inOut',
    });

    this.rimTween = gsap.to(this.rimLight, {
      alpha: 0.43,
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
        this.rimLight.alpha = 0.6;
        this.callbacks.onSmoke(this.worldX(92), this.baseY - 90);
        this.callbacks.onSmoke(this.worldX(58), this.baseY - 94);
      },
      onComplete: () => {
        this.rimLight.alpha = 0.36;
      },
    });

    if (this.wingLayers?.base) {
      gsap.to(this.wingLayers.base, {
        rotation: -0.22,
        duration: 0.3,
        yoyo: true,
        repeat: 1,
        ease: 'sine.inOut',
      });
    }
    if (this.tailLayers?.base) {
      gsap.to(this.tailLayers.base, {
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

    this.tail.position.set(-134, 102);
    this.tail.scale.x = 1;
    this.wing.position.set(4, -100);
    this.body.position.set(-8, 24);
    this.bodyScales.position.set(8, -4);
    this.bellyPlates.position.set(98, 46);
    this.neckSpines.position.set(66, -44);
    this.headBaseY = -92;
    this.head.position.set(118, this.headBaseY);
    this.head.scale.x = 1;
    this.chestGlow.position.set(96, -18);
    this.throatShadow.position.set(108, -24);
    this.clawLeft.position.set(94, 112);
    this.clawRight.position.set(152, 114);
    this.smokeOverlay.position.set(126, -96);

    this.tailLayers = this.buildLayeredPart('dragon-tail', 296, 170, 0, 0, {
      shadowOffset: { x: -8, y: 10 },
      rimOffset: { x: -3, y: -2 },
    });

    this.wingLayers = this.buildLayeredPart('dragon-wing', 336, 246, 0, 0, {
      shadowOffset: { x: -4, y: 8 },
      rimOffset: { x: -2, y: -5 },
    });

    this.bodyLayers = this.buildLayeredPart('dragon-body', 432, 312, 0, 0, {
      shadowOffset: { x: -3, y: 12 },
      rimOffset: { x: -1, y: -4 },
    });

    this.headLayers = this.buildLayeredPart('dragon-head', 226, 168, 0, 0, {
      shadowOffset: { x: -4, y: 8 },
      rimOffset: { x: -2, y: -2 },
    });

    this.scalesSprite = this.createSprite('dragon-scales', 196, 236, 0, 0, 0.42);
    this.scalesSprite.blendMode = 'screen';

    this.innerCoilSprite = this.createSprite('dragon-body', 152, 112, -22, -8, 0);
    this.innerCoilSprite.blendMode = 'normal';

    this.bellySprite = this.createSprite('dragon-scales', 138, 188, -10, -2, 0.24);
    this.bellySprite.blendMode = 'screen';

    this.spinesSprite = this.createSprite('dragon-spines', 264, 104, 0, 0, 0.52);

    this.jawSprite = null;
    this.hornLeftSprite = null;
    this.hornRightSprite = null;
    this.jawBaseRotation = 0.05;

    this.glowSprite = new Sprite(getEmberCoreTexture());
    this.glowSprite.anchor.set(0.5);
    this.glowSprite.width = 176;
    this.glowSprite.height = 124;
    this.glowSprite.alpha = 0.32;
    this.glowSprite.blendMode = 'add';

    this.emberCoreSprite = new Sprite(getEmberCoreTexture());
    this.emberCoreSprite.anchor.set(0.5);
    this.emberCoreSprite.width = 112;
    this.emberCoreSprite.height = 80;
    this.emberCoreSprite.alpha = 0.44;
    this.emberCoreSprite.blendMode = 'add';

    this.throatShadowSprite = new Sprite(getThroatShadowTexture());
    this.throatShadowSprite.anchor.set(0.5);
    this.throatShadowSprite.width = 132;
    this.throatShadowSprite.height = 92;
    this.throatShadowSprite.alpha = 0.28;
    this.throatShadowSprite.blendMode = 'multiply';

    this.eyeLeftCore = this.createSprite('dragon-eye', 22, 13, 0, 0, 0.92);
    this.eyeRightCore = this.createSprite('dragon-eye', 16, 10, 0, 0, 0.0);
    this.eyeRightCore.scale.x = 0.9;

    this.eyeAuraLeft = new Sprite(getEyeAuraTexture());
    this.eyeAuraLeft.anchor.set(0.5);
    this.eyeAuraLeft.width = 28;
    this.eyeAuraLeft.height = 24;
    this.eyeAuraLeft.alpha = 0.5;
    this.eyeAuraLeft.blendMode = 'add';

    this.eyeAuraRight = new Sprite(getEyeAuraTexture());
    this.eyeAuraRight.anchor.set(0.5);
    this.eyeAuraRight.width = 24;
    this.eyeAuraRight.height = 21;
    this.eyeAuraRight.alpha = 0;
    this.eyeAuraRight.blendMode = 'add';

    this.clawLeftSprite = this.createSprite('dragon-horn', 24, 28, 0, 0, 0);
    this.clawLeftSprite.rotation = 2.1;
    this.clawRightSprite = this.createSprite('dragon-horn', 22, 26, 0, 0, 0);
    this.clawRightSprite.rotation = 2.0;

    const clawLeftTip = this.createSprite('dragon-horn', 18, 22, 10, 6, 0.88);
    clawLeftTip.rotation = 2.2;
    const clawRightTip = this.createSprite('dragon-horn', 18, 21, 10, 6, 0.88);
    clawRightTip.rotation = 2.15;

    this.smokeLeftSprite = new Sprite(getSmokeTexture());
    this.smokeLeftSprite.anchor.set(0.5);
    this.smokeLeftSprite.width = 42;
    this.smokeLeftSprite.height = 30;
    this.smokeLeftSprite.position.set(60, -18);
    this.smokeLeftSprite.alpha = 0.2;
    this.smokeLeftSprite.blendMode = 'screen';

    this.smokeRightSprite = new Sprite(getSmokeTexture());
    this.smokeRightSprite.anchor.set(0.5);
    this.smokeRightSprite.width = 36;
    this.smokeRightSprite.height = 26;
    this.smokeRightSprite.position.set(84, -20);
    this.smokeRightSprite.alpha = 0.18;
    this.smokeRightSprite.blendMode = 'screen';

    this.eyeLeftBase = { x: 20, y: -8 };
    this.eyeRightBase = { x: 34, y: -5 };
    this.eyeLeft.position.set(this.eyeLeftBase.x, this.eyeLeftBase.y);
    this.eyeRight.position.set(this.eyeRightBase.x, this.eyeRightBase.y);

    this.tail.addChild(this.tailLayers.shadow, this.tailLayers.base);
    this.wing.addChild(this.wingLayers.shadow, this.wingLayers.base);
    this.body.addChild(this.bodyLayers.shadow, this.bodyLayers.base);
    this.bodyScales.addChild(this.scalesSprite);
    this.bellyPlates.addChild(this.innerCoilSprite, this.bellySprite);
    this.neckSpines.addChild(this.spinesSprite);

    this.eyeLeft.addChild(this.eyeAuraLeft, this.eyeLeftCore);
    this.eyeRight.addChild(this.eyeAuraRight, this.eyeRightCore);

    this.head.addChild(
      this.headLayers.shadow,
      this.headLayers.base,
      this.eyeLeft,
      this.eyeRight,
    );

    this.clawLeft.addChild(this.clawLeftSprite, clawLeftTip);
    this.clawRight.addChild(this.clawRightSprite, clawRightTip);

    this.chestGlow.addChild(this.glowSprite, this.emberCoreSprite);
    this.throatShadow.addChild(this.throatShadowSprite);

    this.rimLight.addChild(this.wingLayers.rim, this.bodyLayers.rim, this.headLayers.rim);
    this.rimLight.blendMode = 'add';

    this.smokeOverlay.addChild(this.smokeLeftSprite, this.smokeRightSprite);

    this.spriteLayersMounted = true;
  }

  private worldX(localOffsetX: number): number {
    return this.baseX + localOffsetX * this.facing;
  }

  private buildLayeredPart(
    atlasKey: DragonAtlasFrameKey,
    width: number,
    height: number,
    x: number,
    y: number,
    options: {
      shadowOffset: { x: number; y: number };
      rimOffset: { x: number; y: number };
    },
  ): LayerSpriteSet {
    const base = this.createSprite(atlasKey, width, height, x, y, 1);
    const shadow = this.createSprite(atlasKey, width * 1.01, height * 1.01, x + options.shadowOffset.x, y + options.shadowOffset.y, 0.42);
    shadow.blendMode = 'multiply';

    shadow.alpha = 0.24;

    const rim = this.createSprite(atlasKey, width * 1.01, height * 1.01, x + options.rimOffset.x, y + options.rimOffset.y, 0.34);
    rim.blendMode = 'add';
    rim.alpha = 0.18;

    return { base, shadow, rim };
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
