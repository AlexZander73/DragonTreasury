import { Application, BlurFilter, Container, FederatedPointerEvent, Graphics, Sprite } from 'pixi.js';
import gsap from 'gsap';
import type { Body } from 'matter-js';
import type { HoardItem } from '../types/content';
import type { BgmTrack, SceneTheme } from '../types/environment';
import type { ArrangeMode } from '../types/filters';
import type { HoardSceneOptions } from '../types/scene';
import { AudioManager } from '../audio/AudioManager';
import { PHYSICS_LIMITS } from '../physics/physicsConfig';
import { HoardPhysics } from '../physics/HoardPhysics';
import type { DragonColorTheme } from '../types/dragon';
import { withBase } from '../utils/basePath';
import { clamp, lerp } from '../utils/math';
import { rarityWeight } from '../utils/rarityStyles';
import { DragonActor } from './DragonActor';
import { getTreasureAtlasTexture } from './atlasTextures';
import { ParticleSystem } from './ParticleSystem';
import { createTreasureVisual, setTreasureVisualState, type TreasureVisual } from './TreasureVisuals';

interface TreasureEntity {
  item: HoardItem;
  body: Body;
  visual: TreasureVisual;
  visible: boolean;
}

interface DragState {
  id: string;
  startedAt: number;
  startX: number;
  startY: number;
  lastX: number;
  lastY: number;
  lastTime: number;
  moved: boolean;
}

interface SceneVisualStyle {
  hazeColor: number;
  hazeAlpha: number;
  edgeShadeColor: number;
  edgeShadeAlpha: number;
  wallGlowMain: number;
  wallGlowSecondary: number;
  warmthColor: number;
  warmthAlpha: number;
  torchAlpha: number;
  fogAlpha: number;
  vignetteAlpha: number;
  groundFogColor: number;
}

interface SceneVisualAssets {
  backdrop: string;
  midground: string;
  fog: string;
  colorGrade?: string;
}

const SCENE_VISUAL_STYLES: Record<SceneTheme, SceneVisualStyle> = {
  cave: {
    hazeColor: 0x070507,
    hazeAlpha: 0.8,
    edgeShadeColor: 0x040304,
    edgeShadeAlpha: 0.52,
    wallGlowMain: 0x5f3f24,
    wallGlowSecondary: 0x302119,
    warmthColor: 0xd58e4e,
    warmthAlpha: 0.38,
    torchAlpha: 0.54,
    fogAlpha: 0.6,
    vignetteAlpha: 0.56,
    groundFogColor: 0x8f6748,
  },
  castle: {
    hazeColor: 0x07080b,
    hazeAlpha: 0.5,
    edgeShadeColor: 0x030408,
    edgeShadeAlpha: 0.34,
    wallGlowMain: 0x6d5a45,
    wallGlowSecondary: 0x303746,
    warmthColor: 0xbda07b,
    warmthAlpha: 0.31,
    torchAlpha: 0.42,
    fogAlpha: 0.46,
    vignetteAlpha: 0.62,
    groundFogColor: 0xa58a64,
  },
  mountain: {
    hazeColor: 0x07090f,
    hazeAlpha: 0.42,
    edgeShadeColor: 0x020407,
    edgeShadeAlpha: 0.3,
    wallGlowMain: 0x4e6170,
    wallGlowSecondary: 0x243a48,
    warmthColor: 0x8ca8c4,
    warmthAlpha: 0.2,
    torchAlpha: 0.34,
    fogAlpha: 0.52,
    vignetteAlpha: 0.64,
    groundFogColor: 0x6d90af,
  },
  forest: {
    hazeColor: 0x060806,
    hazeAlpha: 0.48,
    edgeShadeColor: 0x030503,
    edgeShadeAlpha: 0.3,
    wallGlowMain: 0x496043,
    wallGlowSecondary: 0x294130,
    warmthColor: 0x83ae6c,
    warmthAlpha: 0.27,
    torchAlpha: 0.37,
    fogAlpha: 0.58,
    vignetteAlpha: 0.54,
    groundFogColor: 0x73905c,
  },
  ocean: {
    hazeColor: 0x04080b,
    hazeAlpha: 0.54,
    edgeShadeColor: 0x010407,
    edgeShadeAlpha: 0.34,
    wallGlowMain: 0x2b6b75,
    wallGlowSecondary: 0x1d3c4e,
    warmthColor: 0x3f9fba,
    warmthAlpha: 0.24,
    torchAlpha: 0.3,
    fogAlpha: 0.66,
    vignetteAlpha: 0.68,
    groundFogColor: 0x4f9ac4,
  },
};

const SCENE_VISUAL_ASSETS: Record<SceneTheme, SceneVisualAssets> = {
  cave: {
    backdrop: '/assets/backgrounds/cave-backdrop.svg',
    midground: '/assets/backgrounds/cave-midground.svg',
    fog: '/assets/backgrounds/cave-fog.svg',
    colorGrade: '/assets/backgrounds/cave-color-grade.svg',
  },
  castle: {
    backdrop: '/assets/backgrounds/castle-backdrop.svg',
    midground: '/assets/backgrounds/castle-midground.svg',
    fog: '/assets/backgrounds/castle-fog.svg',
  },
  mountain: {
    backdrop: '/assets/backgrounds/mountain-backdrop.svg',
    midground: '/assets/backgrounds/mountain-midground.svg',
    fog: '/assets/backgrounds/mountain-fog.svg',
  },
  forest: {
    backdrop: '/assets/backgrounds/forest-backdrop.svg',
    midground: '/assets/backgrounds/forest-midground.svg',
    fog: '/assets/backgrounds/forest-fog.svg',
  },
  ocean: {
    backdrop: '/assets/backgrounds/ocean-backdrop.svg',
    midground: '/assets/backgrounds/ocean-midground.svg',
    fog: '/assets/backgrounds/ocean-fog.svg',
  },
};

const BACKDROP_PILE_COUNT = 8;
const BACKDROP_HOARD_BLUR = new BlurFilter({ strength: 1.05, quality: 1 });

export class HoardScene {
  private readonly host: HTMLDivElement;
  private readonly callbacks: HoardSceneOptions['callbacks'];
  private reducedMotion: boolean;
  private muted: boolean;
  private dragonColorTheme: DragonColorTheme;
  private sceneTheme: SceneTheme;
  private bgmTrack: BgmTrack;

  private app: Application | null = null;
  private physics: HoardPhysics | null = null;
  private audio: AudioManager;
  private particles: ParticleSystem;
  private dragon: DragonActor | null = null;

  private world = new Container();
  private bgLayer = new Container();
  private midLayer = new Container();
  private treasureLayer = new Container();
  private dragonLayer = new Container();
  private fxLayer = new Container();
  private overlayLayer = new Container();
  private torchLight: Sprite | null = null;
  private foregroundMist: Sprite | null = null;
  private hoardWarmth: Graphics | null = null;
  private edgeVeil: Graphics | null = null;

  private entities = new Map<string, TreasureEntity>();
  private itemsById = new Map<string, HoardItem>();
  private clickHistory = new Map<string, number>();
  private visibleItemIds = new Set<string>();
  private visibilitySynced = false;

  private selectedItemId: string | null = null;
  private hoverItemId: string | null = null;
  private featuredMode = false;
  private arrangeMode: ArrangeMode = 'pile';

  private pointerX = 0;
  private pointerY = 0;
  private pointerNormX = 0.5;
  private pointerNormY = 0.5;
  private dragState: DragState | null = null;
  private drift = 0;
  private hidden = false;

  constructor(options: HoardSceneOptions) {
    this.host = options.host;
    this.callbacks = options.callbacks;
    this.reducedMotion = options.reducedMotion;
    this.muted = options.muted;
    this.dragonColorTheme = options.dragonColorTheme;
    this.sceneTheme = options.sceneTheme;
    this.bgmTrack = options.bgmTrack;

    this.audio = new AudioManager(options.muted);
    this.particles = new ParticleSystem({
      maxParticles: options.quality.maxParticles,
      reducedMotion: options.reducedMotion,
    });

    options.items.forEach((item) => {
      this.itemsById.set(item.id, item);
      this.visibleItemIds.add(item.id);
    });
  }

  async init(initialItems: HoardItem[]): Promise<void> {
    this.app = new Application();
    await this.app.init({
      resizeTo: this.host,
      backgroundAlpha: 0,
      antialias: true,
      powerPreference: 'high-performance',
      preference: 'webgl',
    });

    this.host.appendChild(this.app.canvas);
    this.app.stage.eventMode = 'static';
    this.app.stage.hitArea = this.app.screen;

    this.world.sortableChildren = true;
    this.bgLayer.zIndex = 0;
    this.midLayer.zIndex = 1;
    this.treasureLayer.zIndex = 2;
    this.dragonLayer.zIndex = 3;
    this.fxLayer.zIndex = 4;
    this.overlayLayer.zIndex = 5;

    this.world.addChild(this.bgLayer, this.midLayer, this.treasureLayer, this.dragonLayer, this.fxLayer, this.overlayLayer);
    this.app.stage.addChild(this.world);
    this.treasureLayer.sortableChildren = true;

    this.drawBackground();
    this.particles.setSceneTheme(this.sceneTheme);
    this.fxLayer.addChild(this.particles.container);
    this.audio.setSceneTheme(this.sceneTheme);
    this.audio.setMusicTrack(this.bgmTrack);

    this.physics = new HoardPhysics(this.host.clientWidth, this.host.clientHeight);
    this.physics.setCollisionListener(({ relativeVelocity }) => {
      const normalized = clamp(relativeVelocity / 8, 0, 1.25);
      this.audio.playCollision(normalized);

      if (relativeVelocity > 7.4 && this.dragon) {
        this.dragon.reactToDisturbance(clamp(relativeVelocity / 10, 0, 1));
      }
    });

    this.dragon = new DragonActor(
      {
        onSmoke: (x, y) => this.particles.emitSmoke(x, y),
        onNudgeNearby: (x, y) => this.physics?.nudgeRandomNear(x, y),
        onBreath: () => this.audio.playDragon('breath'),
        onIdle: () => this.audio.playDragon('idle'),
        onHuff: () => this.audio.playDragon('huff'),
        onRareEvent: () => {
          this.audio.playDragon('rumble');
          this.particles.emitSparkle(this.host.clientWidth * 0.52, this.host.clientHeight * 0.5, 1.2);
        },
        onSecretUnlock: () => this.callbacks.onDragonSecretUnlock(),
        onClickCount: (count) => this.callbacks.onDragonClick?.(count),
      },
      this.reducedMotion,
      this.dragonColorTheme,
    );
    this.dragonLayer.addChild(this.dragon.container);

    this.bindPointerHandlers();
    this.setItems(initialItems);

    this.app.ticker.add((ticker) => {
      if (this.hidden) {
        return;
      }
      this.update(ticker.deltaMS / 1000);
    });

    this.positionDragon();

    const visibilityHandler = (): void => {
      this.hidden = document.hidden;
    };
    visibilityHandler();
    document.addEventListener('visibilitychange', visibilityHandler);

    (this.app.canvas as HTMLCanvasElement).dataset.visibilityBound = '1';
    this.app.canvas.addEventListener('contextmenu', (event) => event.preventDefault());

    window.addEventListener('resize', this.handleResize);

    gsap.fromTo(
      this.world,
      { alpha: 0 },
      {
        alpha: 1,
        duration: this.reducedMotion ? 0.45 : 1.4,
        ease: 'power2.out',
      },
    );
  }

  async unlockAudio(): Promise<void> {
    await this.audio.unlock();
    this.audio.setMuted(this.muted);
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    this.audio.setMuted(muted);
  }

  setDragonColorTheme(theme: DragonColorTheme): void {
    this.dragonColorTheme = theme;
    this.dragon?.setColorTheme(theme);
  }

  setSceneTheme(theme: SceneTheme): void {
    if (this.sceneTheme === theme) {
      return;
    }
    this.sceneTheme = theme;
    this.audio.setSceneTheme(theme);
    this.particles.setSceneTheme(theme);
    this.drawBackground();
  }

  setBgmTrack(track: BgmTrack): void {
    this.bgmTrack = track;
    this.audio.setMusicTrack(track);
  }

  setReducedMotion(value: boolean): void {
    this.reducedMotion = value;
    this.particles.setReducedMotion(value);
    this.dragon?.setReducedMotion(value);
  }

  setVisibleItems(ids: Set<string>): void {
    this.visibleItemIds = new Set(ids);
    this.visibilitySynced = true;
  }

  setSelectedItem(id: string | null): void {
    this.selectedItemId = id;
    if (id) {
      const item = this.itemsById.get(id);
      if (item?.rarity === 'legendary') {
        this.dragon?.reactToLegendarySelection();
      }
    }
  }

  setFeaturedMode(enabled: boolean): void {
    this.featuredMode = enabled;
  }

  setArrangeMode(mode: ArrangeMode): void {
    this.arrangeMode = mode;
    this.physics?.setArrangeMode(
      mode,
      Array.from(this.entities.values())
        .map((entity) => entity.item)
        .filter((item) => this.visibleItemIds.has(item.id)),
    );
  }

  setItems(items: HoardItem[]): void {
    this.itemsById = new Map(items.map((item) => [item.id, item]));
    if (!this.visibilitySynced && this.visibleItemIds.size === 0 && items.length > 0) {
      this.visibleItemIds = new Set(items.map((item) => item.id));
    }

    if (!this.physics) {
      return;
    }

    for (const id of this.entities.keys()) {
      this.physics.removeItem(id);
      const entity = this.entities.get(id)!;
      entity.visual.container.removeFromParent();
      entity.visual.container.destroy({ children: true });
    }
    this.entities.clear();
    this.physics.restartIntroDrop();

    items.forEach((item, index) => {
      const body = this.physics!.addItem(item, index, items.length);
      const visual = createTreasureVisual(item);
      visual.container.position.set(body.position.x, body.position.y);
      visual.container.rotation = body.angle;
      visual.container.eventMode = 'static';
      visual.container.cursor = 'grab';

      visual.container.on('pointerover', () => {
        this.hoverItemId = item.id;
        this.audio.playHover();
        this.particles.emitSparkle(body.position.x, body.position.y - 18, 0.6);
      });
      visual.container.on('pointerout', () => {
        if (this.hoverItemId === item.id) {
          this.hoverItemId = null;
        }
      });
      visual.container.on('pointerdown', (event: FederatedPointerEvent) => this.handleItemPointerDown(event, item.id));

      this.treasureLayer.addChild(visual.container);

      this.entities.set(item.id, {
        item,
        body,
        visual,
        visible: true,
      });
    });

    this.setArrangeMode(this.arrangeMode);
  }

  focusItem(id: string): void {
    const entity = this.entities.get(id);
    if (!entity || !this.app) {
      return;
    }

    this.selectedItemId = id;

    gsap.fromTo(
      entity.visual.container.scale,
      { x: 1.35, y: 1.35 },
      {
        x: 1,
        y: 1,
        duration: 0.6,
        ease: 'elastic.out(1.1, 0.4)',
      },
    );

    const tx = this.host.clientWidth * 0.5 - entity.body.position.x;
    const ty = this.host.clientHeight * 0.54 - entity.body.position.y;

    gsap.fromTo(
      this.world,
      { x: 0, y: 0 },
      {
        x: tx * 0.18,
        y: ty * 0.1,
        duration: this.reducedMotion ? 0.2 : 0.62,
        yoyo: true,
        repeat: 1,
        ease: 'sine.inOut',
      },
    );
  }

  resetPile(): void {
    if (!this.physics) {
      return;
    }

    const items = Array.from(this.entities.values()).map((entry) => entry.item);
    this.physics.resetPile(items);
    this.setArrangeMode('pile');
  }

  updateQuality(maxParticles: number): void {
    this.particles.setMaxParticles(maxParticles);
  }

  destroy(): void {
    window.removeEventListener('resize', this.handleResize);

    this.app?.ticker.stop();
    this.physics?.destroy();
    this.particles.destroy();
    this.dragon?.destroy();
    this.audio.destroy();

    if (this.app) {
      this.app.destroy(true, {
        children: true,
        texture: false,
      });
      this.app = null;
    }
  }

  private bindPointerHandlers(): void {
    if (!this.app) {
      return;
    }

    this.app.stage.on('globalpointermove', this.handleGlobalPointerMove);
    this.app.stage.on('pointerup', this.handlePointerUp);
    this.app.stage.on('pointerupoutside', this.handlePointerUp);
    this.app.stage.on('pointerleave', this.handlePointerUp);
  }

  private readonly handleGlobalPointerMove = (event: FederatedPointerEvent): void => {
    this.pointerX = event.global.x;
    this.pointerY = event.global.y;

    const width = Math.max(1, this.host.clientWidth);
    const height = Math.max(1, this.host.clientHeight);
    this.pointerNormX = clamp(this.pointerX / width, 0, 1);
    this.pointerNormY = clamp(this.pointerY / height, 0, 1);

    if (!this.dragState || !this.physics) {
      return;
    }

    const dx = event.global.x - this.dragState.startX;
    const dy = event.global.y - this.dragState.startY;
    if (!this.dragState.moved && dx * dx + dy * dy > 25) {
      this.dragState.moved = true;
    }

    this.physics.dragBody(this.dragState.id, event.global.x, event.global.y);
    if (this.dragState.moved && Math.random() < 0.12) {
      this.physics.nudgeRandomNear(event.global.x, event.global.y);
    }

    this.dragState.lastX = event.global.x;
    this.dragState.lastY = event.global.y;
    this.dragState.lastTime = performance.now();
  };

  private readonly handleItemPointerDown = (event: FederatedPointerEvent, id: string): void => {
    event.stopPropagation();

    this.dragState = {
      id,
      startedAt: performance.now(),
      startX: event.global.x,
      startY: event.global.y,
      lastX: event.global.x,
      lastY: event.global.y,
      lastTime: performance.now(),
      moved: false,
    };
  };

  private readonly handlePointerUp = (event: FederatedPointerEvent): void => {
    if (!this.dragState || !this.physics) {
      return;
    }

    const drag = this.dragState;
    this.dragState = null;

    const now = performance.now();
    const elapsed = Math.max(16, now - drag.lastTime);

    const vx = ((event.global.x - drag.lastX) / elapsed) * (1000 / 60) * PHYSICS_LIMITS.dragTossMultiplier;
    const vy = ((event.global.y - drag.lastY) / elapsed) * (1000 / 60) * PHYSICS_LIMITS.dragTossMultiplier;

    if (drag.moved) {
      this.physics.tossBody(drag.id, vx, vy);
      const speed = Math.hypot(vx, vy);
      if (speed > 2.2) {
        this.dragon?.reactToStrongToss(event.global.x, event.global.y);
      }
      return;
    }

    const lastClick = this.clickHistory.get(drag.id) ?? 0;
    const isDouble = now - lastClick < 320;
    this.clickHistory.set(drag.id, now);

    const item = this.itemsById.get(drag.id);
    if (item) {
      this.audio.playSelect(item.rarity);
    }

    this.callbacks.onSelect({ itemId: drag.id, inspect: isDouble });
  };

  private readonly handleResize = (): void => {
    if (!this.app || !this.physics) {
      return;
    }

    this.physics.resize(this.host.clientWidth, this.host.clientHeight);
    this.positionDragon();
    this.drawBackground();
  };

  private update(dt: number): void {
    if (!this.app || !this.physics) {
      return;
    }
    if (this.hidden && document.hidden) {
      return;
    }

    this.drift += dt;
    this.physics.update(dt * 1000);

    const sceneW = this.host.clientWidth;
    const sceneH = this.host.clientHeight;

    for (const [id, entity] of this.entities.entries()) {
      const body = entity.body;
      entity.visual.container.position.set(body.position.x, body.position.y);
      entity.visual.container.rotation = body.angle;
      entity.visual.container.zIndex = body.position.y;

      const isVisible = this.visibleItemIds.has(id);
      const depthScale = clamp(0.82 + (body.position.y / Math.max(1, sceneH)) * 0.34, 0.82, 1.17);
      setTreasureVisualState(entity.visual, {
        selected: id === this.selectedItemId,
        hovered: id === this.hoverItemId,
        visible: isVisible,
        featuredMode: this.featuredMode,
        featured: Boolean(entity.item.featured || entity.item.rarity === 'legendary'),
        reducedMotion: this.reducedMotion,
        time: this.drift,
        depthScale,
      });

      if (!this.reducedMotion && Math.random() < rarityWeight[entity.item.rarity] * 0.0018) {
        this.particles.emitSparkle(body.position.x, body.position.y - entity.visual.radius * 0.85, 0.5);
      }
    }

    this.dragon?.update(dt, this.pointerNormX, this.pointerNormY);

    this.particles.update(dt, sceneW, sceneH);

    const parallaxX = (this.pointerNormX - 0.5) * 2;
    const parallaxY = (this.pointerNormY - 0.5) * 2;
    const driftX = Math.sin(this.drift * 0.2) * (this.reducedMotion ? 1.2 : 4.2);
    const driftY = Math.cos(this.drift * 0.23) * (this.reducedMotion ? 0.8 : 2.8);

    this.bgLayer.x = parallaxX * -10 + driftX * 0.35;
    this.bgLayer.y = parallaxY * -7 + driftY * 0.2;
    this.midLayer.x = parallaxX * -16 + driftX * 0.45;
    this.midLayer.y = parallaxY * -10 + driftY * 0.25;
    this.treasureLayer.x = parallaxX * -6;
    this.treasureLayer.y = parallaxY * -4;
    this.dragonLayer.x = parallaxX * -12 + driftX * 0.2;
    this.dragonLayer.y = parallaxY * -8 + driftY * 0.25;

    if (this.torchLight) {
      const style = SCENE_VISUAL_STYLES[this.sceneTheme];
      const targetX = this.host.clientWidth * (0.36 + this.pointerNormX * 0.34);
      const targetY = this.host.clientHeight * (0.32 + this.pointerNormY * 0.22);
      this.torchLight.x = lerp(this.torchLight.x, targetX, 0.06);
      this.torchLight.y = lerp(this.torchLight.y, targetY, 0.06);
      const pulse = this.reducedMotion ? 0.9 : 0.85 + Math.sin(this.drift * 2.6) * 0.08;
      this.torchLight.alpha = style.torchAlpha * pulse;
    }

    if (this.foregroundMist) {
      const mistPulse = this.reducedMotion ? 0.9 : 0.82 + Math.sin(this.drift * 0.7) * 0.08;
      this.foregroundMist.alpha = 0.28 * mistPulse;
      this.foregroundMist.x = parallaxX * -8;
      this.foregroundMist.y = parallaxY * -5;
    }

    if (this.hoardWarmth) {
      const style = SCENE_VISUAL_STYLES[this.sceneTheme];
      const warmthPulse = this.reducedMotion ? 0.9 : 0.84 + Math.sin(this.drift * 1.15) * 0.11;
      this.hoardWarmth.alpha = style.warmthAlpha * warmthPulse;
    }

    if (this.edgeVeil) {
      const veilWave = this.reducedMotion ? 1 : 0.94 + Math.sin(this.drift * 0.32) * 0.04;
      this.edgeVeil.alpha = 0.34 * veilWave;
      this.edgeVeil.x = parallaxX * 2;
      this.edgeVeil.y = parallaxY * 1.5;
    }
  }

  private drawBackground(): void {
    this.bgLayer.removeChildren();
    this.midLayer.removeChildren();
    this.overlayLayer.removeChildren();

    const w = this.host.clientWidth;
    const h = this.host.clientHeight;
    const style = SCENE_VISUAL_STYLES[this.sceneTheme];
    const assets = SCENE_VISUAL_ASSETS[this.sceneTheme];

    const haze = new Graphics();
    haze.rect(0, 0, w, h).fill({ color: style.hazeColor, alpha: style.hazeAlpha });

    const backdrop = Sprite.from(withBase(assets.backdrop));
    backdrop.width = w;
    backdrop.height = h;
    backdrop.alpha = 0.96;

    const colorGrade = assets.colorGrade ? Sprite.from(withBase(assets.colorGrade)) : null;
    if (colorGrade) {
      colorGrade.width = w;
      colorGrade.height = h;
      colorGrade.alpha = this.sceneTheme === 'cave' ? 0.78 : 0.34;
    }

    const edgeShadow = new Graphics();
    edgeShadow.rect(0, 0, w, h).fill({ color: style.edgeShadeColor, alpha: style.edgeShadeAlpha });
    edgeShadow.ellipse(w * 0.5, h * 0.55, w * 0.46, h * 0.34).fill({ color: 0x000000, alpha: 0.14 });

    const wallGlow = new Graphics();
    wallGlow.ellipse(w * 0.5, h * 0.33, w * 0.42, h * 0.28).fill({ color: style.wallGlowMain, alpha: 0.36 });
    wallGlow.ellipse(w * 0.25, h * 0.48, w * 0.23, h * 0.2).fill({ color: style.wallGlowSecondary, alpha: 0.44 });
    wallGlow.ellipse(w * 0.76, h * 0.44, w * 0.2, h * 0.17).fill({ color: 0x3a2a22, alpha: 0.36 });
    wallGlow.ellipse(w * 0.56, h * 0.62, w * 0.26, h * 0.1).fill({ color: 0x3f2a1b, alpha: 0.22 });

    const thematicOcclusion = this.createThemeOcclusion(this.sceneTheme, w, h);
    const thematicBackdrop = this.createThemeBackdropPaint(this.sceneTheme, w, h);

    const fog = new Graphics();
    fog.ellipse(w * 0.5, h * 0.74, w * 0.64, h * 0.2).fill({ color: style.groundFogColor, alpha: 0.15 });

    const midground = Sprite.from(withBase(assets.midground));
    midground.width = w;
    midground.height = h;
    midground.alpha = 0.94;
    const thematicBand = this.createThemeFeatureBand(this.sceneTheme, w, h);

    const backdropHoard = this.createBackdropHoardDecor(w, h);

    const fogOverlay = Sprite.from(withBase(assets.fog));
    fogOverlay.width = w;
    fogOverlay.height = h;
    fogOverlay.alpha = style.fogAlpha;

    const vignetteOverlay = Sprite.from(withBase('/assets/backgrounds/cave-vignette.svg'));
    vignetteOverlay.width = w;
    vignetteOverlay.height = h;
    vignetteOverlay.alpha = style.vignetteAlpha;

    const mound = new Graphics();
    mound.ellipse(w * 0.5, h * 0.88, w * 0.46, h * 0.18).fill({ color: 0x1f1714, alpha: 0.9 });
    mound.ellipse(w * 0.5, h * 0.9, w * 0.37, h * 0.12).fill({ color: 0x3a291c, alpha: 0.4 });

    this.hoardWarmth = new Graphics();
    this.hoardWarmth.ellipse(w * 0.5, h * 0.74, w * 0.28, h * 0.14).fill({ color: style.warmthColor, alpha: style.warmthAlpha });
    this.hoardWarmth.ellipse(w * 0.52, h * 0.8, w * 0.22, h * 0.09).fill({ color: style.warmthColor, alpha: style.warmthAlpha * 0.72 });
    this.hoardWarmth.blendMode = 'add';

    this.bgLayer.addChild(haze, thematicBackdrop, backdrop);
    if (colorGrade) {
      this.bgLayer.addChild(colorGrade);
    }
    this.bgLayer.addChild(edgeShadow, wallGlow, thematicOcclusion);
    this.midLayer.addChild(midground, thematicBand, backdropHoard, fog, fogOverlay, this.hoardWarmth, mound, vignetteOverlay);

    this.torchLight = Sprite.from(withBase('/assets/backgrounds/torch-light.svg'));
    this.torchLight.anchor.set(0.5);
    this.torchLight.width = w * 0.74;
    this.torchLight.height = h * 0.62;
    this.torchLight.position.set(w * 0.5, h * 0.36);
    this.torchLight.alpha = style.torchAlpha;
    this.torchLight.blendMode = 'add';

    this.foregroundMist = Sprite.from(withBase('/assets/backgrounds/foreground-mist.svg'));
    this.foregroundMist.width = w;
    this.foregroundMist.height = h;
    this.foregroundMist.alpha = 0.29;

    this.edgeVeil = new Graphics();
    this.edgeVeil.rect(0, 0, w, h).fill({ color: 0x050406, alpha: 0.32 });
    this.edgeVeil.ellipse(w * 0.52, h * 0.56, w * 0.44, h * 0.33).fill({ color: 0x000000, alpha: 0.1 });
    this.edgeVeil.blendMode = 'multiply';

    this.overlayLayer.addChild(this.torchLight, this.foregroundMist, this.edgeVeil);
  }

  private createThemeOcclusion(theme: SceneTheme, width: number, height: number): Container {
    const layer = new Container();
    const g = new Graphics();

    if (theme === 'castle') {
      g.rect(0, height * 0.18, width * 0.09, height).fill({ color: 0x06080b, alpha: 0.58 });
      g.rect(width * 0.91, height * 0.16, width * 0.09, height).fill({ color: 0x06070b, alpha: 0.56 });
      g.poly([width * 0.22, height * 0.72, width * 0.5, height * 0.38, width * 0.78, height * 0.72]).fill({
        color: 0x0c1118,
        alpha: 0.5,
      });
      g.ellipse(width * 0.5, height * 0.42, width * 0.22, height * 0.15).fill({ color: 0x121a24, alpha: 0.34 });
    } else if (theme === 'mountain') {
      g.poly([0, height * 0.88, width * 0.2, height * 0.52, width * 0.34, height * 0.88]).fill({
        color: 0x08131c,
        alpha: 0.56,
      });
      g.poly([width * 0.22, height * 0.9, width * 0.5, height * 0.46, width * 0.76, height * 0.9]).fill({
        color: 0x0a1823,
        alpha: 0.5,
      });
      g.poly([width * 0.62, height * 0.9, width * 0.82, height * 0.56, width, height * 0.9]).fill({
        color: 0x091722,
        alpha: 0.54,
      });
    } else if (theme === 'forest') {
      g.poly([0, height, 0, height * 0.38, width * 0.09, height * 0.26, width * 0.15, height]).fill({
        color: 0x050b06,
        alpha: 0.58,
      });
      g.poly([width, height, width, height * 0.34, width * 0.91, height * 0.22, width * 0.85, height]).fill({
        color: 0x050a06,
        alpha: 0.56,
      });
      g.ellipse(width * 0.34, height * 0.52, width * 0.18, height * 0.14).fill({ color: 0x112119, alpha: 0.36 });
      g.ellipse(width * 0.72, height * 0.5, width * 0.2, height * 0.16).fill({ color: 0x102118, alpha: 0.34 });
    } else if (theme === 'ocean') {
      g.poly([0, height, 0, height * 0.42, width * 0.12, height * 0.34, width * 0.18, height]).fill({
        color: 0x030a12,
        alpha: 0.6,
      });
      g.poly([width, height, width, height * 0.4, width * 0.9, height * 0.34, width * 0.84, height]).fill({
        color: 0x020a12,
        alpha: 0.58,
      });
      g.ellipse(width * 0.5, height * 0.46, width * 0.22, height * 0.16).fill({ color: 0x113143, alpha: 0.26 });
    } else {
      g.poly([0, height * 0.56, width * 0.16, height * 0.45, width * 0.3, height * 0.6, 0, height * 0.72]).fill({
        color: 0x161316,
        alpha: 0.78,
      });
      g.poly([width * 0.67, height * 0.52, width, height * 0.46, width, height * 0.78, width * 0.58, height * 0.76]).fill({
        color: 0x18141a,
        alpha: 0.82,
      });
      g.poly([0, height, 0, height * 0.34, width * 0.09, height * 0.24, width * 0.13, height]).fill({
        color: 0x050407,
        alpha: 0.66,
      });
      g.poly([width, height, width, height * 0.28, width * 0.9, height * 0.22, width * 0.86, height]).fill({
        color: 0x060408,
        alpha: 0.62,
      });
    }

    layer.addChild(g);
    return layer;
  }

  private createThemeFeatureBand(theme: SceneTheme, width: number, height: number): Container {
    const layer = new Container();
    const g = new Graphics();

    if (theme === 'castle') {
      g.rect(width * 0.28, height * 0.56, width * 0.44, height * 0.06).fill({ color: 0x4d4c4b, alpha: 0.5 });
      g.rect(width * 0.3, height * 0.49, width * 0.1, height * 0.07).fill({ color: 0x74695a, alpha: 0.4 });
      g.rect(width * 0.6, height * 0.49, width * 0.1, height * 0.07).fill({ color: 0x6f6458, alpha: 0.4 });
    } else if (theme === 'mountain') {
      g.poly([width * 0.2, height * 0.7, width * 0.35, height * 0.5, width * 0.5, height * 0.7]).fill({
        color: 0x476884,
        alpha: 0.34,
      });
      g.poly([width * 0.48, height * 0.72, width * 0.64, height * 0.48, width * 0.78, height * 0.72]).fill({
        color: 0x3d5f7a,
        alpha: 0.32,
      });
    } else if (theme === 'forest') {
      g.ellipse(width * 0.34, height * 0.64, width * 0.16, height * 0.14).fill({ color: 0x416442, alpha: 0.33 });
      g.ellipse(width * 0.62, height * 0.62, width * 0.18, height * 0.16).fill({ color: 0x3f6642, alpha: 0.34 });
      g.rect(width * 0.3, height * 0.62, width * 0.02, height * 0.1).fill({ color: 0x274229, alpha: 0.44 });
      g.rect(width * 0.58, height * 0.6, width * 0.024, height * 0.12).fill({ color: 0x274229, alpha: 0.42 });
    } else if (theme === 'ocean') {
      g.ellipse(width * 0.45, height * 0.7, width * 0.2, height * 0.1).fill({ color: 0x3a7d94, alpha: 0.32 });
      g.ellipse(width * 0.66, height * 0.66, width * 0.14, height * 0.09).fill({ color: 0x2f6d84, alpha: 0.34 });
      g.rect(width * 0.27, height * 0.58, width * 0.04, height * 0.13).fill({ color: 0x29566d, alpha: 0.44 });
      g.rect(width * 0.72, height * 0.56, width * 0.036, height * 0.14).fill({ color: 0x2b5f76, alpha: 0.42 });
    } else {
      g.ellipse(width * 0.46, height * 0.64, width * 0.22, height * 0.14).fill({ color: 0x6a4a31, alpha: 0.28 });
      g.ellipse(width * 0.62, height * 0.66, width * 0.18, height * 0.12).fill({ color: 0x5d3d29, alpha: 0.26 });
    }

    layer.addChild(g);
    return layer;
  }

  private createThemeBackdropPaint(theme: SceneTheme, width: number, height: number): Container {
    const layer = new Container();
    const g = new Graphics();

    if (theme === 'castle') {
      g.rect(0, 0, width, height).fill({ color: 0x1a2431, alpha: 0.48 });
      g.ellipse(width * 0.52, height * 0.28, width * 0.3, height * 0.16).fill({ color: 0xceb18b, alpha: 0.16 });
      g.rect(width * 0.1, height * 0.12, width * 0.14, height * 0.58).fill({ color: 0x293241, alpha: 0.32 });
      g.rect(width * 0.76, height * 0.12, width * 0.14, height * 0.58).fill({ color: 0x293241, alpha: 0.32 });
    } else if (theme === 'mountain') {
      g.rect(0, 0, width, height).fill({ color: 0x162a3c, alpha: 0.46 });
      g.poly([0, height * 0.72, width * 0.24, height * 0.42, width * 0.42, height * 0.72]).fill({ color: 0x2b4d68, alpha: 0.4 });
      g.poly([width * 0.28, height * 0.74, width * 0.54, height * 0.36, width * 0.78, height * 0.74]).fill({
        color: 0x27455f,
        alpha: 0.38,
      });
      g.ellipse(width * 0.68, height * 0.2, width * 0.12, height * 0.08).fill({ color: 0xd6ebff, alpha: 0.18 });
    } else if (theme === 'forest') {
      g.rect(0, 0, width, height).fill({ color: 0x173020, alpha: 0.5 });
      g.ellipse(width * 0.4, height * 0.2, width * 0.18, height * 0.12).fill({ color: 0xc7e6a9, alpha: 0.16 });
      g.poly([0, height * 0.78, width * 0.12, height * 0.34, width * 0.2, height * 0.78]).fill({ color: 0x1a3a24, alpha: 0.42 });
      g.poly([width * 0.82, height * 0.8, width * 0.9, height * 0.3, width, height * 0.8]).fill({ color: 0x1a3a24, alpha: 0.42 });
    } else if (theme === 'ocean') {
      g.rect(0, 0, width, height).fill({ color: 0x0f2f44, alpha: 0.54 });
      g.ellipse(width * 0.5, height * 0.22, width * 0.28, height * 0.14).fill({ color: 0x7ee4ff, alpha: 0.14 });
      g.poly([0, height * 0.74, width * 0.16, height * 0.42, width * 0.28, height * 0.74]).fill({ color: 0x1f4e66, alpha: 0.38 });
      g.poly([width * 0.68, height * 0.72, width * 0.82, height * 0.4, width, height * 0.72]).fill({ color: 0x1a4a63, alpha: 0.38 });
    } else {
      g.rect(0, 0, width, height).fill({ color: 0x2a1b16, alpha: 0.42 });
      g.ellipse(width * 0.5, height * 0.32, width * 0.28, height * 0.18).fill({ color: 0x8b603d, alpha: 0.18 });
      g.poly([0, height * 0.74, width * 0.2, height * 0.48, width * 0.34, height * 0.74]).fill({ color: 0x261915, alpha: 0.42 });
      g.poly([width * 0.64, height * 0.72, width * 0.82, height * 0.46, width, height * 0.74]).fill({
        color: 0x251814,
        alpha: 0.42,
      });
    }

    layer.addChild(g);
    return layer;
  }

  private createBackdropHoardDecor(width: number, height: number): Container {
    const layer = new Container();
    layer.sortableChildren = true;
    layer.filters = [BACKDROP_HOARD_BLUR];
    layer.alpha = 0.76;

    for (let index = 0; index < BACKDROP_PILE_COUNT; index += 1) {
      const pile = this.createBackdropPile(index, BACKDROP_PILE_COUNT, width, height);
      layer.addChild(pile);
    }

    return layer;
  }

  private createBackdropPile(index: number, total: number, width: number, height: number): Container {
    const pile = new Container();
    pile.sortableChildren = true;

    const spacing = (width * 0.86) / Math.max(1, total - 1);
    const baseX = width * 0.07 + spacing * index + (Math.random() - 0.5) * width * 0.035;
    const baseY = height * (0.26 + Math.random() * 0.2);
    pile.position.set(baseX, baseY);

    const scale = 0.74 + Math.random() * 0.24;
    pile.scale.set(scale);

    const coinTexture = getTreasureAtlasTexture('coin');
    const gemTexture = getTreasureAtlasTexture('gem');
    const relicTexture = getTreasureAtlasTexture('artifact');
    const idolTexture = getTreasureAtlasTexture('metal-idol');
    const legendaryTexture = getTreasureAtlasTexture('legendary-relic');

    const coinCount = 24 + Math.floor(Math.random() * 28);
    for (let i = 0; i < coinCount; i += 1) {
      const coin = new Sprite(coinTexture);
      coin.anchor.set(0.5);
      const size = 14 + Math.random() * 26;
      coin.width = size;
      coin.height = size;
      coin.position.set((Math.random() - 0.5) * 170, 18 + Math.random() * 84);
      coin.rotation = (Math.random() - 0.5) * 0.55;
      coin.tint = Math.random() > 0.5 ? 0xf4ce7d : 0xdca64d;
      coin.alpha = 0.42 + Math.random() * 0.34;
      coin.zIndex = coin.position.y;
      pile.addChild(coin);
    }

    const sparkleCount = 2 + Math.floor(Math.random() * 3);
    for (let i = 0; i < sparkleCount; i += 1) {
      const gem = new Sprite(gemTexture);
      gem.anchor.set(0.5);
      const size = 22 + Math.random() * 22;
      gem.width = size;
      gem.height = size;
      gem.position.set((Math.random() - 0.5) * 120, 6 + Math.random() * 62);
      gem.rotation = (Math.random() - 0.5) * 0.36;
      gem.tint = [0x79b9ff, 0xda5a58, 0x6ecf88, 0xab7be2][Math.floor(Math.random() * 4)];
      gem.alpha = 0.48 + Math.random() * 0.28;
      gem.zIndex = gem.position.y + 2;
      pile.addChild(gem);
    }

    if (Math.random() > 0.38) {
      const relic = new Sprite(Math.random() > 0.4 ? relicTexture : idolTexture);
      relic.anchor.set(0.5);
      const widthPx = 66 + Math.random() * 58;
      const heightPx = 58 + Math.random() * 42;
      relic.width = widthPx;
      relic.height = heightPx;
      relic.position.set((Math.random() - 0.5) * 78, 10 + Math.random() * 30);
      relic.rotation = (Math.random() - 0.5) * 0.22;
      relic.tint = 0xe9c078;
      relic.alpha = 0.5 + Math.random() * 0.22;
      relic.zIndex = relic.position.y + 3;
      pile.addChild(relic);
    }

    if (Math.random() > 0.88) {
      const relic = new Sprite(legendaryTexture);
      relic.anchor.set(0.5);
      relic.width = 56;
      relic.height = 56;
      relic.position.set((Math.random() - 0.5) * 70, 2 + Math.random() * 22);
      relic.rotation = (Math.random() - 0.5) * 0.28;
      relic.tint = 0xfbe2a5;
      relic.alpha = 0.62;
      relic.zIndex = relic.position.y + 6;
      pile.addChild(relic);
    }

    return pile;
  }

  private positionDragon(): void {
    if (!this.dragon) {
      return;
    }

    const x = this.host.clientWidth * 0.74;
    const y = this.host.clientHeight * 0.63;
    this.dragon.setPosition(x, y);
  }
}
