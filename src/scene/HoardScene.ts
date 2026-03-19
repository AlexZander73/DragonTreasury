import { Application, Container, FederatedPointerEvent, Graphics, Sprite } from 'pixi.js';
import gsap from 'gsap';
import type { Body } from 'matter-js';
import type { HoardItem } from '../types/content';
import type { ArrangeMode } from '../types/filters';
import type { HoardSceneOptions } from '../types/scene';
import { AudioManager } from '../audio/AudioManager';
import { PHYSICS_LIMITS } from '../physics/physicsConfig';
import { HoardPhysics } from '../physics/HoardPhysics';
import { withBase } from '../utils/basePath';
import { clamp, lerp } from '../utils/math';
import { rarityWeight } from '../utils/rarityStyles';
import { DragonActor } from './DragonActor';
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

export class HoardScene {
  private readonly host: HTMLDivElement;
  private readonly callbacks: HoardSceneOptions['callbacks'];
  private reducedMotion: boolean;
  private muted: boolean;

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
    this.fxLayer.addChild(this.particles.container);

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

  setReducedMotion(value: boolean): void {
    this.reducedMotion = value;
    this.particles.setReducedMotion(value);
    this.dragon?.setReducedMotion(value);
  }

  setVisibleItems(ids: Set<string>): void {
    this.visibleItemIds = ids;
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
      const targetX = this.host.clientWidth * (0.36 + this.pointerNormX * 0.34);
      const targetY = this.host.clientHeight * (0.32 + this.pointerNormY * 0.22);
      this.torchLight.x = lerp(this.torchLight.x, targetX, 0.06);
      this.torchLight.y = lerp(this.torchLight.y, targetY, 0.06);
      const pulse = this.reducedMotion ? 0.9 : 0.85 + Math.sin(this.drift * 2.6) * 0.08;
      this.torchLight.alpha = 0.52 * pulse;
    }

    if (this.foregroundMist) {
      const mistPulse = this.reducedMotion ? 0.9 : 0.82 + Math.sin(this.drift * 0.7) * 0.08;
      this.foregroundMist.alpha = 0.28 * mistPulse;
      this.foregroundMist.x = parallaxX * -8;
      this.foregroundMist.y = parallaxY * -5;
    }

    if (this.hoardWarmth) {
      const warmthPulse = this.reducedMotion ? 0.9 : 0.84 + Math.sin(this.drift * 1.15) * 0.11;
      this.hoardWarmth.alpha = 0.42 * warmthPulse;
    }

    if (this.edgeVeil) {
      const veilWave = this.reducedMotion ? 1 : 0.94 + Math.sin(this.drift * 0.32) * 0.04;
      this.edgeVeil.alpha = 0.55 * veilWave;
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

    const haze = new Graphics();
    haze.rect(0, 0, w, h).fill({ color: 0x070507, alpha: 0.8 });

    const backdrop = Sprite.from(withBase('/assets/backgrounds/cave-backdrop.svg'));
    backdrop.width = w;
    backdrop.height = h;
    backdrop.alpha = 0.86;

    const colorGrade = Sprite.from(withBase('/assets/backgrounds/cave-color-grade.svg'));
    colorGrade.width = w;
    colorGrade.height = h;
    colorGrade.alpha = 0.8;

    const edgeShadow = new Graphics();
    edgeShadow.rect(0, 0, w, h).fill({ color: 0x040304, alpha: 0.52 });
    edgeShadow.ellipse(w * 0.5, h * 0.55, w * 0.46, h * 0.34).fill({ color: 0x000000, alpha: 0.14 });

    const wallGlow = new Graphics();
    wallGlow.ellipse(w * 0.5, h * 0.33, w * 0.42, h * 0.28).fill({ color: 0x5f3f24, alpha: 0.36 });
    wallGlow.ellipse(w * 0.25, h * 0.48, w * 0.23, h * 0.2).fill({ color: 0x302119, alpha: 0.44 });
    wallGlow.ellipse(w * 0.76, h * 0.44, w * 0.2, h * 0.17).fill({ color: 0x3a2a22, alpha: 0.36 });
    wallGlow.ellipse(w * 0.56, h * 0.62, w * 0.26, h * 0.1).fill({ color: 0x3f2a1b, alpha: 0.22 });

    const farRocks = new Graphics();
    farRocks.poly([0, h * 0.56, w * 0.16, h * 0.45, w * 0.3, h * 0.6, 0, h * 0.72]).fill({
      color: 0x161316,
      alpha: 0.78,
    });
    farRocks.poly([w * 0.67, h * 0.52, w, h * 0.46, w, h * 0.78, w * 0.58, h * 0.76]).fill({
      color: 0x18141a,
      alpha: 0.82,
    });

    const pillarOcclusion = new Graphics();
    pillarOcclusion.poly([0, h, 0, h * 0.34, w * 0.09, h * 0.24, w * 0.13, h]).fill({ color: 0x050407, alpha: 0.66 });
    pillarOcclusion
      .poly([w, h, w, h * 0.28, w * 0.9, h * 0.22, w * 0.86, h])
      .fill({ color: 0x060408, alpha: 0.62 });

    const fog = new Graphics();
    fog.ellipse(w * 0.5, h * 0.74, w * 0.64, h * 0.2).fill({ color: 0x8f6748, alpha: 0.15 });

    const midground = Sprite.from(withBase('/assets/backgrounds/cave-midground.svg'));
    midground.width = w;
    midground.height = h;
    midground.alpha = 0.78;

    const fogOverlay = Sprite.from(withBase('/assets/backgrounds/cave-fog.svg'));
    fogOverlay.width = w;
    fogOverlay.height = h;
    fogOverlay.alpha = 0.6;

    const vignetteOverlay = Sprite.from(withBase('/assets/backgrounds/cave-vignette.svg'));
    vignetteOverlay.width = w;
    vignetteOverlay.height = h;
    vignetteOverlay.alpha = 0.56;

    const mound = new Graphics();
    mound.ellipse(w * 0.5, h * 0.88, w * 0.46, h * 0.18).fill({ color: 0x1f1714, alpha: 0.9 });
    mound.ellipse(w * 0.5, h * 0.9, w * 0.37, h * 0.12).fill({ color: 0x3a291c, alpha: 0.4 });

    this.hoardWarmth = new Graphics();
    this.hoardWarmth.ellipse(w * 0.5, h * 0.74, w * 0.28, h * 0.14).fill({ color: 0xd58e4e, alpha: 0.38 });
    this.hoardWarmth.ellipse(w * 0.52, h * 0.8, w * 0.22, h * 0.09).fill({ color: 0xa15f2f, alpha: 0.28 });
    this.hoardWarmth.blendMode = 'add';

    this.bgLayer.addChild(haze, backdrop, colorGrade, edgeShadow, wallGlow, farRocks, pillarOcclusion);
    this.midLayer.addChild(midground, fog, fogOverlay, this.hoardWarmth, mound, vignetteOverlay);

    this.torchLight = Sprite.from(withBase('/assets/backgrounds/torch-light.svg'));
    this.torchLight.anchor.set(0.5);
    this.torchLight.width = w * 0.74;
    this.torchLight.height = h * 0.62;
    this.torchLight.position.set(w * 0.5, h * 0.36);
    this.torchLight.alpha = 0.54;
    this.torchLight.blendMode = 'add';

    this.foregroundMist = Sprite.from(withBase('/assets/backgrounds/foreground-mist.svg'));
    this.foregroundMist.width = w;
    this.foregroundMist.height = h;
    this.foregroundMist.alpha = 0.29;

    this.edgeVeil = new Graphics();
    this.edgeVeil.rect(0, 0, w, h).fill({ color: 0x050406, alpha: 0.54 });
    this.edgeVeil.ellipse(w * 0.52, h * 0.56, w * 0.44, h * 0.33).fill({ color: 0x000000, alpha: 0.1 });
    this.edgeVeil.blendMode = 'multiply';

    this.overlayLayer.addChild(this.torchLight, this.foregroundMist, this.edgeVeil);
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
