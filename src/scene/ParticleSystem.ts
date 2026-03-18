import { Container, Sprite, Texture } from 'pixi.js';
import { clamp } from '../utils/math';

interface Particle {
  sprite: Sprite;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  ttl: number;
  spin: number;
}

interface ParticleSystemOptions {
  maxParticles: number;
  reducedMotion: boolean;
}

export class ParticleSystem {
  readonly container = new Container();
  private particles: Particle[] = [];
  private pool: Sprite[] = [];
  private maxParticles: number;
  private reducedMotion: boolean;
  private spawnAccumulator = 0;

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

  emitSparkle(x: number, y: number, intensity = 1): void {
    const count = Math.max(1, Math.min(6, Math.round(intensity * 4)));
    for (let i = 0; i < count; i += 1) {
      this.spawn({
        x,
        y,
        vx: (Math.random() - 0.5) * 1.7,
        vy: -Math.random() * 2.2,
        ttl: 0.45 + Math.random() * 0.5,
        tint: 0xffe8a3,
        alpha: 0.85,
        scale: 1 + Math.random() * 2,
      });
    }
  }

  emitSmoke(x: number, y: number): void {
    const count = this.reducedMotion ? 1 : 3;
    for (let i = 0; i < count; i += 1) {
      this.spawn({
        x: x + (Math.random() - 0.5) * 6,
        y: y + (Math.random() - 0.5) * 4,
        vx: (Math.random() - 0.5) * 0.25,
        vy: -0.25 - Math.random() * 0.5,
        ttl: 1.4 + Math.random() * 1,
        tint: 0xaaaaaa,
        alpha: 0.18,
        scale: 8 + Math.random() * 10,
      });
    }
  }

  emitEmber(x: number, y: number): void {
    this.spawn({
      x,
      y,
      vx: (Math.random() - 0.5) * 0.8,
      vy: -0.6 - Math.random() * 1.2,
      ttl: 0.7 + Math.random() * 0.6,
      tint: Math.random() > 0.35 ? 0xffaa44 : 0xff4d2f,
      alpha: 0.75,
      scale: 1.4 + Math.random() * 1.3,
    });
  }

  update(dt: number, width: number, height: number): void {
    if (!this.reducedMotion) {
      this.spawnAccumulator += dt;
      if (this.spawnAccumulator > 0.035) {
        this.spawnAccumulator = 0;
        const x = Math.random() * width;
        const y = height * 0.3 + Math.random() * (height * 0.6);
        this.spawn({
          x,
          y,
          vx: (Math.random() - 0.5) * 0.1,
          vy: -0.06 - Math.random() * 0.14,
          ttl: 4.5 + Math.random() * 4,
          tint: 0xffe8cc,
          alpha: 0.09,
          scale: 1.5 + Math.random() * 2,
        });

        if (Math.random() < 0.25) {
          this.emitEmber(width * (0.2 + Math.random() * 0.6), height * (0.55 + Math.random() * 0.35));
        }
      }
    }

    for (let index = this.particles.length - 1; index >= 0; index -= 1) {
      const particle = this.particles[index];
      particle.life += dt;
      const progress = particle.life / particle.ttl;

      particle.x += particle.vx;
      particle.y += particle.vy;
      particle.vx *= 0.995;
      particle.vy *= 0.99;

      particle.sprite.x = particle.x;
      particle.sprite.y = particle.y;
      particle.sprite.rotation += particle.spin;
      particle.sprite.alpha = clamp((1 - progress) * particle.sprite.alpha, 0, 1);

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
  }

  private spawn(config: {
    x: number;
    y: number;
    vx: number;
    vy: number;
    ttl: number;
    tint: number;
    alpha: number;
    scale: number;
  }): void {
    if (this.particles.length >= this.maxParticles) {
      return;
    }

    const sprite = this.pool.pop() ?? Sprite.from(Texture.WHITE);
    sprite.anchor.set(0.5);
    sprite.width = config.scale;
    sprite.height = config.scale;
    sprite.tint = config.tint;
    sprite.alpha = config.alpha;
    sprite.blendMode = 'add';
    sprite.x = config.x;
    sprite.y = config.y;

    this.container.addChild(sprite);

    this.particles.push({
      sprite,
      x: config.x,
      y: config.y,
      vx: config.vx,
      vy: config.vy,
      life: 0,
      ttl: config.ttl,
      spin: (Math.random() - 0.5) * 0.04,
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
