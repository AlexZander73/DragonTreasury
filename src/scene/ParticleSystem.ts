import { Container, Sprite, Texture } from 'pixi.js';
import type { SceneTheme } from '../types/environment';
import { clamp } from '../utils/math';

type ParticleKind = 'dust' | 'spark' | 'ember' | 'smoke';

interface Particle {
  sprite: Sprite;
  kind: ParticleKind;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  ttl: number;
  spin: number;
  baseAlpha: number;
  baseScale: number;
  fadeIn: number;
}

interface ParticleSystemOptions {
  maxParticles: number;
  reducedMotion: boolean;
}

interface SpawnConfig {
  kind: ParticleKind;
  x: number;
  y: number;
  vx: number;
  vy: number;
  ttl: number;
  tint: number;
  alpha: number;
  scale: number;
  fadeIn?: number;
}

interface ParticlePalette {
  sparkleTint: number;
  smokeTint: number;
  emberWarm: number;
  emberHot: number;
  dustTint: number;
  topDustTint: number;
}

const PARTICLE_PALETTES: Record<SceneTheme, ParticlePalette> = {
  cave: {
    sparkleTint: 0xffefb2,
    smokeTint: 0xc2b7ac,
    emberWarm: 0xffb05c,
    emberHot: 0xff5b30,
    dustTint: 0xffebca,
    topDustTint: 0xd8c5a3,
  },
  castle: {
    sparkleTint: 0xffe7c4,
    smokeTint: 0xc7c0b8,
    emberWarm: 0xf8c48b,
    emberHot: 0xe8834f,
    dustTint: 0xf3e4cf,
    topDustTint: 0xcfc1ae,
  },
  mountain: {
    sparkleTint: 0xb8e7ff,
    smokeTint: 0xaab5c1,
    emberWarm: 0x9dcfff,
    emberHot: 0x4d95d3,
    dustTint: 0xd6e6f0,
    topDustTint: 0xb8cad9,
  },
  forest: {
    sparkleTint: 0xd8f6ba,
    smokeTint: 0xafbba9,
    emberWarm: 0xbbdb8f,
    emberHot: 0x73b467,
    dustTint: 0xdce7c8,
    topDustTint: 0xb9c9a8,
  },
  ocean: {
    sparkleTint: 0x8de9ff,
    smokeTint: 0x8da4b4,
    emberWarm: 0x6fd7ff,
    emberHot: 0x2f98d6,
    dustTint: 0xafd5e8,
    topDustTint: 0x8cbfd8,
  },
  treasury: {
    sparkleTint: 0xffebb3,
    smokeTint: 0xbfa893,
    emberWarm: 0xffbf67,
    emberHot: 0xf57734,
    dustTint: 0xf0dcc0,
    topDustTint: 0xd6b997,
  },
};

const makeRadialTexture = (size: number, inner: string, outer: string): Texture => {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    return Texture.WHITE;
  }

  const radius = size * 0.5;
  const gradient = ctx.createRadialGradient(radius, radius, 0, radius, radius, radius);
  gradient.addColorStop(0, inner);
  gradient.addColorStop(1, outer);
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(radius, radius, radius, 0, Math.PI * 2);
  ctx.fill();

  return Texture.from(canvas);
};

export class ParticleSystem {
  readonly container = new Container();
  private particles: Particle[] = [];
  private pool: Sprite[] = [];
  private maxParticles: number;
  private reducedMotion: boolean;
  private sceneTheme: SceneTheme = 'cave';
  private spawnAccumulator = 0;
  private topDustAccumulator = 0;

  private readonly textures = {
    dust: makeRadialTexture(48, 'rgba(255, 237, 210, 0.9)', 'rgba(255, 237, 210, 0)'),
    spark: makeRadialTexture(48, 'rgba(255, 249, 220, 1)', 'rgba(255, 249, 220, 0)'),
    ember: makeRadialTexture(52, 'rgba(255, 171, 84, 0.96)', 'rgba(255, 81, 34, 0)'),
    smoke: makeRadialTexture(64, 'rgba(190, 178, 166, 0.85)', 'rgba(120, 118, 125, 0)'),
  };

  constructor(options: ParticleSystemOptions) {
    this.maxParticles = options.maxParticles;
    this.reducedMotion = options.reducedMotion;
    this.container.sortableChildren = true;
  }

  setReducedMotion(value: boolean): void {
    this.reducedMotion = value;
  }

  setMaxParticles(maxParticles: number): void {
    this.maxParticles = maxParticles;
  }

  setSceneTheme(theme: SceneTheme): void {
    this.sceneTheme = theme;
  }

  emitSparkle(x: number, y: number, intensity = 1): void {
    const palette = PARTICLE_PALETTES[this.sceneTheme];
    const count = Math.max(1, Math.min(7, Math.round(intensity * 4.5)));
    for (let i = 0; i < count; i += 1) {
      this.spawn({
        kind: 'spark',
        x: x + (Math.random() - 0.5) * 14,
        y: y + (Math.random() - 0.5) * 8,
        vx: (Math.random() - 0.5) * 1.9,
        vy: -Math.random() * 2.4,
        ttl: 0.42 + Math.random() * 0.55,
        tint: palette.sparkleTint,
        alpha: 0.95,
        scale: 1.2 + Math.random() * 2.2,
        fadeIn: 0.08,
      });
    }
  }

  emitSmoke(x: number, y: number): void {
    const palette = PARTICLE_PALETTES[this.sceneTheme];
    const count = this.reducedMotion ? 1 : 3;
    for (let i = 0; i < count; i += 1) {
      this.spawn({
        kind: 'smoke',
        x: x + (Math.random() - 0.5) * 8,
        y: y + (Math.random() - 0.5) * 5,
        vx: (Math.random() - 0.5) * 0.23,
        vy: -0.22 - Math.random() * 0.52,
        ttl: 1.25 + Math.random() * 1.1,
        tint: palette.smokeTint,
        alpha: 0.22,
        scale: 7.4 + Math.random() * 8.2,
        fadeIn: 0.18,
      });
    }
  }

  emitEmber(x: number, y: number): void {
    const palette = PARTICLE_PALETTES[this.sceneTheme];
    this.spawn({
      kind: 'ember',
      x,
      y,
      vx: (Math.random() - 0.5) * 1.1,
      vy: -0.55 - Math.random() * 1.45,
      ttl: 0.66 + Math.random() * 0.7,
      tint: Math.random() > 0.35 ? palette.emberWarm : palette.emberHot,
      alpha: 0.82,
      scale: 1.5 + Math.random() * 1.6,
      fadeIn: 0.06,
    });
  }

  update(dt: number, width: number, height: number): void {
    const palette = PARTICLE_PALETTES[this.sceneTheme];
    if (!this.reducedMotion) {
      this.spawnAccumulator += dt;
      if (this.spawnAccumulator > 0.05) {
        this.spawnAccumulator = 0;
        const x = Math.random() * width;
        const y = height * 0.3 + Math.random() * (height * 0.62);
        this.spawn({
          kind: 'dust',
          x,
          y,
          vx: (Math.random() - 0.5) * 0.14,
          vy: -0.05 - Math.random() * 0.15,
          ttl: 4.2 + Math.random() * 4.6,
          tint: palette.dustTint,
          alpha: 0.12,
          scale: 1.6 + Math.random() * 2.6,
          fadeIn: 0.22,
        });

        if (Math.random() < 0.18) {
          this.emitEmber(width * (0.18 + Math.random() * 0.62), height * (0.55 + Math.random() * 0.32));
        }
      }

      this.topDustAccumulator += dt;
      if (this.topDustAccumulator > 1.2 + Math.random() * 1.4) {
        this.topDustAccumulator = 0;
        this.spawn({
          kind: 'dust',
          x: width * (0.16 + Math.random() * 0.68),
          y: height * 0.2,
          vx: (Math.random() - 0.5) * 0.1,
          vy: 0.1 + Math.random() * 0.18,
          ttl: 2.6 + Math.random() * 1.8,
          tint: palette.topDustTint,
          alpha: 0.08,
          scale: 1.2 + Math.random() * 1.8,
          fadeIn: 0.2,
        });
      }
    }

    for (let index = this.particles.length - 1; index >= 0; index -= 1) {
      const particle = this.particles[index];
      particle.life += dt;
      const progress = particle.life / particle.ttl;

      if (particle.kind === 'smoke') {
        particle.vx *= 0.994;
        particle.vy *= 0.988;
        particle.vy -= 0.0015;
      } else if (particle.kind === 'ember') {
        particle.vx *= 0.992;
        particle.vy *= 0.986;
      } else if (particle.kind === 'spark') {
        particle.vx *= 0.986;
        particle.vy *= 0.982;
      } else {
        particle.vx *= 0.996;
        particle.vy *= 0.994;
      }

      particle.x += particle.vx;
      particle.y += particle.vy;

      particle.sprite.x = particle.x;
      particle.sprite.y = particle.y;
      particle.sprite.rotation += particle.spin;

      const fadeInProgress = clamp(progress / Math.max(0.01, particle.fadeIn), 0, 1);
      const fadeOutProgress = clamp((1 - progress) / 0.45, 0, 1);
      particle.sprite.alpha = particle.baseAlpha * fadeInProgress * fadeOutProgress;

      if (particle.kind === 'smoke') {
        const puff = 1 + progress * 0.56;
        particle.sprite.scale.set(particle.baseScale * puff);
      } else if (particle.kind === 'spark') {
        const flicker = 0.88 + Math.sin(performance.now() * 0.02 + index) * 0.18;
        particle.sprite.scale.set(particle.baseScale * flicker);
      } else {
        particle.sprite.scale.set(particle.baseScale);
      }

      if (particle.life >= particle.ttl) {
        this.recycle(index);
      }
    }
  }

  clear(): void {
    for (let i = this.particles.length - 1; i >= 0; i -= 1) {
      this.recycle(i);
    }
  }

  destroy(): void {
    this.clear();
    this.container.destroy({ children: true });
    this.pool = [];

    this.textures.dust.destroy(true);
    this.textures.spark.destroy(true);
    this.textures.ember.destroy(true);
    this.textures.smoke.destroy(true);
  }

  private spawn(config: SpawnConfig): void {
    if (this.particles.length >= this.maxParticles) {
      return;
    }

    const sprite = this.pool.pop() ?? new Sprite();
    sprite.texture = this.textures[config.kind] ?? Texture.WHITE;
    sprite.anchor.set(0.5);
    sprite.width = config.scale;
    sprite.height = config.scale;
    sprite.tint = config.tint;
    sprite.alpha = config.alpha;
    sprite.blendMode =
      config.kind === 'smoke'
        ? 'normal'
        : config.kind === 'dust'
          ? 'screen'
          : 'add';
    sprite.x = config.x;
    sprite.y = config.y;

    this.container.addChild(sprite);

    this.particles.push({
      sprite,
      kind: config.kind,
      x: config.x,
      y: config.y,
      vx: config.vx,
      vy: config.vy,
      life: 0,
      ttl: config.ttl,
      spin: (Math.random() - 0.5) * 0.06,
      baseAlpha: config.alpha,
      baseScale: config.scale,
      fadeIn: config.fadeIn ?? 0.15,
    });
  }

  private recycle(index: number): void {
    const [particle] = this.particles.splice(index, 1);
    if (!particle) {
      return;
    }

    particle.sprite.removeFromParent();
    this.pool.push(particle.sprite);
  }
}
