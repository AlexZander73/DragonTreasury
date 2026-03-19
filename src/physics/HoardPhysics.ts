import Matter, {
  Body,
  Bodies,
  Composite,
  Engine,
  Events,
  Runner,
  Sleeping,
  Vector,
  type IEventCollision,
} from 'matter-js';
import type { Category, HoardItem } from '../types/content';
import type { ArrangeMode } from '../types/filters';
import { createSeededRng } from '../utils/seededRandom';
import { clamp } from '../utils/math';
import { PHYSICS_LIMITS, sizeClassToPixels } from './physicsConfig';

export interface CollisionPayload {
  a: string;
  b: string;
  relativeVelocity: number;
}

interface BoundsBodies {
  floor: Body;
  leftWall: Body;
  rightWall: Body;
  ceiling: Body;
}

export class HoardPhysics {
  readonly engine: Engine;
  readonly runner: Runner;
  private width: number;
  private height: number;
  private boundaries!: BoundsBodies;
  private bodies = new Map<string, Body>();
  private arrangedTargets = new Map<string, Vector>();
  private arrangeMode: ArrangeMode = 'pile';
  private onCollision: ((payload: CollisionPayload) => void) | null = null;
  private introElapsedMs = 0;
  private readonly introDropMs = 1800;

  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
    this.engine = Engine.create({
      gravity: { x: 0, y: 1 },
      enableSleeping: true,
    });
    this.runner = Runner.create();
    this.createOrResetBounds();

    Events.on(this.engine, 'collisionStart', (event: IEventCollision<Engine>) => {
      if (!this.onCollision) {
        return;
      }

      for (const pair of event.pairs) {
        const a = pair.bodyA.label;
        const b = pair.bodyB.label;
        if (!this.bodies.has(a) || !this.bodies.has(b)) {
          continue;
        }

        const relativeVelocity = Vector.magnitude({
          x: pair.bodyA.velocity.x - pair.bodyB.velocity.x,
          y: pair.bodyA.velocity.y - pair.bodyB.velocity.y,
        });

        this.onCollision({ a, b, relativeVelocity });
      }
    });
  }

  setCollisionListener(listener: ((payload: CollisionPayload) => void) | null): void {
    this.onCollision = listener;
  }

  private createOrResetBounds(): void {
    if (this.boundaries) {
      Composite.remove(this.engine.world, [
        this.boundaries.floor,
        this.boundaries.leftWall,
        this.boundaries.rightWall,
        this.boundaries.ceiling,
      ]);
    }

    const thickness = 130;
    const floor = Bodies.rectangle(this.width / 2, this.height + thickness * 0.5, this.width + 240, thickness, {
      isStatic: true,
      restitution: 0.24,
      friction: 0.95,
      label: '__floor__',
    });

    const leftWall = Bodies.rectangle(-thickness * 0.5, this.height / 2, thickness, this.height + 220, {
      isStatic: true,
      restitution: 0.3,
      friction: 0.8,
      label: '__left__',
    });

    const rightWall = Bodies.rectangle(this.width + thickness * 0.5, this.height / 2, thickness, this.height + 220, {
      isStatic: true,
      restitution: 0.3,
      friction: 0.8,
      label: '__right__',
    });

    const ceiling = Bodies.rectangle(this.width / 2, -thickness * 0.5, this.width + 220, thickness, {
      isStatic: true,
      restitution: 0.2,
      friction: 0.8,
      label: '__ceiling__',
    });

    this.boundaries = { floor, leftWall, rightWall, ceiling };
    Composite.add(this.engine.world, [floor, leftWall, rightWall, ceiling]);
  }

  resize(width: number, height: number): void {
    this.width = width;
    this.height = height;
    this.createOrResetBounds();
    this.updateArrangementTargets(this.arrangeMode);
  }

  addItem(item: HoardItem, index: number, total: number): Body {
    const radius = sizeClassToPixels[item.physics.sizeClass];
    const spawn = this.computeSpawnPoint(item, index, total, 'drop');
    const body = this.createBodyForType(item, spawn.x, spawn.y, radius);

    Body.setMass(body, item.physics.mass);
    body.restitution = item.physics.restitution;
    body.friction = item.physics.friction;
    body.frictionAir = item.physics.frictionAir ?? 0.03;
    Body.setVelocity(body, { x: (Math.random() - 0.5) * 0.22, y: Math.random() * 0.12 });
    Body.setAngularVelocity(body, (Math.random() - 0.5) * 0.018);
    Sleeping.set(body, false);

    this.bodies.set(item.id, body);
    Composite.add(this.engine.world, body);
    return body;
  }

  removeItem(id: string): void {
    const body = this.bodies.get(id);
    if (!body) {
      return;
    }
    Composite.remove(this.engine.world, body);
    this.bodies.delete(id);
    this.arrangedTargets.delete(id);
  }

  clearItems(): void {
    for (const body of this.bodies.values()) {
      Composite.remove(this.engine.world, body);
    }
    this.bodies.clear();
    this.arrangedTargets.clear();
    this.introElapsedMs = 0;
  }

  getBody(id: string): Body | undefined {
    return this.bodies.get(id);
  }

  getBodies(): Map<string, Body> {
    return this.bodies;
  }

  restartIntroDrop(): void {
    this.introElapsedMs = 0;
  }

  dragBody(id: string, x: number, y: number): void {
    const body = this.bodies.get(id);
    if (!body) {
      return;
    }
    Sleeping.set(body, false);
    Body.setPosition(body, { x, y });
    Body.setVelocity(body, { x: 0, y: 0 });
    Body.setAngularVelocity(body, 0);
  }

  tossBody(id: string, vx: number, vy: number): void {
    const body = this.bodies.get(id);
    if (!body) {
      return;
    }
    const limited = {
      x: clamp(vx, -PHYSICS_LIMITS.maxLinearVelocity, PHYSICS_LIMITS.maxLinearVelocity),
      y: clamp(vy, -PHYSICS_LIMITS.maxLinearVelocity, PHYSICS_LIMITS.maxLinearVelocity),
    };

    Sleeping.set(body, false);
    Body.setVelocity(body, limited);
  }

  nudgeBody(id: string, fx: number, fy: number): void {
    const body = this.bodies.get(id);
    if (!body) {
      return;
    }
    Sleeping.set(body, false);
    Body.applyForce(body, body.position, { x: fx, y: fy });
  }

  nudgeRandomNear(x: number, y: number): void {
    let bestBody: Body | null = null;
    let bestDist = Infinity;

    for (const body of this.bodies.values()) {
      const dx = body.position.x - x;
      const dy = body.position.y - y;
      const d2 = dx * dx + dy * dy;
      if (d2 < bestDist) {
        bestDist = d2;
        bestBody = body;
      }
    }

    if (!bestBody) {
      return;
    }

    Body.applyForce(bestBody, bestBody.position, {
      x: (Math.random() - 0.5) * 0.009,
      y: -0.012,
    });
  }

  setArrangeMode(mode: ArrangeMode, items: HoardItem[]): void {
    this.arrangeMode = mode;
    this.updateArrangementTargets(mode, items);
  }

  private updateArrangementTargets(mode: ArrangeMode, items: HoardItem[] = []): void {
    this.arrangedTargets.clear();
    if (mode === 'pile') {
      return;
    }

    const itemList = items.length > 0 ? items : Array.from(this.bodies.keys()).map((id) => ({ id } as HoardItem));
    const visibleItems = itemList.filter((item) => this.bodies.has(item.id));
    if (visibleItems.length === 0) {
      return;
    }

    if (mode === 'timeline') {
      const sorted = [...visibleItems].sort((a, b) => a.year - b.year || a.title.localeCompare(b.title));
      sorted.forEach((item, index) => {
        const t = sorted.length <= 1 ? 0.5 : index / (sorted.length - 1);
        this.arrangedTargets.set(item.id, {
          x: this.width * 0.16 + t * this.width * 0.68,
          y: this.height * 0.58 + Math.sin(index * 0.75) * 44,
        });
      });
      return;
    }

    if (mode === 'category') {
      const groups = new Map<Category, HoardItem[]>();
      visibleItems.forEach((item) => {
        const itemsInCategory = groups.get(item.category) ?? [];
        itemsInCategory.push(item);
        groups.set(item.category, itemsInCategory);
      });

      const categories = Array.from(groups.keys());
      categories.forEach((category, groupIndex) => {
        const group = groups.get(category)!;
        const x = this.width * 0.12 + (groupIndex / Math.max(1, categories.length - 1)) * this.width * 0.76;

        group.forEach((item, index) => {
          this.arrangedTargets.set(item.id, {
            x: x + ((index % 3) - 1) * 26,
            y: this.height * 0.52 + Math.floor(index / 3) * 34,
          });
        });
      });
      return;
    }

    if (mode === 'era') {
      const eraBuckets = new Map<number, HoardItem[]>();
      visibleItems.forEach((item) => {
        const era = Math.floor(item.year / 5) * 5;
        const bucket = eraBuckets.get(era) ?? [];
        bucket.push(item);
        eraBuckets.set(era, bucket);
      });

      const eras = Array.from(eraBuckets.keys()).sort((a, b) => a - b);
      eras.forEach((era, eraIndex) => {
        const bucket = eraBuckets.get(era)!;
        const x = this.width * 0.14 + (eraIndex / Math.max(1, eras.length - 1)) * this.width * 0.72;
        bucket.forEach((item, index) => {
          this.arrangedTargets.set(item.id, {
            x: x + ((index % 4) - 1.5) * 18,
            y: this.height * 0.56 + Math.floor(index / 4) * 28,
          });
        });
      });
    }
  }

  resetPile(items: HoardItem[]): void {
    const total = items.length;
    this.introElapsedMs = this.introDropMs + 1;
    items.forEach((item, index) => {
      const body = this.bodies.get(item.id);
      if (!body) {
        return;
      }
      const spawn = this.computeSpawnPoint(item, index, total, 'pile');
      Body.setPosition(body, spawn);
      Body.setVelocity(body, { x: 0, y: 0 });
      Body.setAngularVelocity(body, 0);
      Sleeping.set(body, false);
    });
  }

  update(deltaMs: number): void {
    const frameMs = clamp(deltaMs, 1000 / 120, 1000 / 30);
    Engine.update(this.engine, frameMs);
    this.introElapsedMs += frameMs;

    const centerX = this.width * 0.5;
    const centerY = this.height * 0.66;

    for (const [id, body] of this.bodies.entries()) {
      if (this.arrangeMode !== 'pile' && this.introElapsedMs >= this.introDropMs) {
        const target = this.arrangedTargets.get(id);
        if (target) {
          const dx = target.x - body.position.x;
          const dy = target.y - body.position.y;
          Body.applyForce(body, body.position, {
            x: dx * PHYSICS_LIMITS.arrangementPull * 0.00012,
            y: dy * PHYSICS_LIMITS.arrangementPull * 0.00014,
          });
        }
      }

      const dx = centerX - body.position.x;
      const dy = centerY - body.position.y;
      if (Math.abs(dx) > this.width * 0.45 || Math.abs(dy) > this.height * 0.46) {
        Body.applyForce(body, body.position, {
          x: dx * PHYSICS_LIMITS.centerPull * 0.00016,
          y: dy * PHYSICS_LIMITS.centerPull * 0.00022,
        });
      }

      const speed = Vector.magnitude(body.velocity);
      if (speed > PHYSICS_LIMITS.maxLinearVelocity) {
        const factor = PHYSICS_LIMITS.maxLinearVelocity / speed;
        Body.setVelocity(body, {
          x: body.velocity.x * factor,
          y: body.velocity.y * factor,
        });
      }
    }
  }

  private createBodyForType(item: HoardItem, x: number, y: number, radius: number): Body {
    const common: Matter.IChamferableBodyDefinition = {
      label: item.id,
      angle: (Math.random() - 0.5) * 0.3,
      inertia: 2200,
      slop: 0.02,
      render: { visible: false },
    };

    if (item.type === 'coin' || item.type === 'gem' || item.type === 'arcane-crystal') {
      return Bodies.circle(x, y, radius, common);
    }

    if (item.type === 'scroll-capsule') {
      return Bodies.rectangle(x, y, radius * 1.7, radius * 0.95, common);
    }

    if (item.type === 'metal-idol') {
      return Bodies.polygon(x, y, 6, radius * 1.05, common);
    }

    if (item.type === 'legendary-relic') {
      return Bodies.polygon(x, y, 8, radius * 1.2, common);
    }

    return Bodies.rectangle(x, y, radius * 1.45, radius * 1.1, common);
  }

  private computeSpawnPoint(item: HoardItem, index: number, total: number, mode: 'pile' | 'drop'): Vector {
    const rng = createSeededRng(`${item.id}:${index}`);
    const normalizedIndex = total <= 1 ? 0.5 : index / (total - 1);
    const arc = Math.sin(normalizedIndex * Math.PI);
    const clusterIndex = index % 5;
    const clusterOffset = (clusterIndex - 2) * (this.width * 0.065);

    const sizeBiasByClass = {
      tiny: -1.2,
      small: -0.8,
      medium: 0,
      large: 0.85,
      huge: 1.2,
    } as const;
    const sizeBias = sizeBiasByClass[item.physics.sizeClass] ?? 0;

    const moundCenterX = this.width * 0.5 + clusterOffset * (0.5 + rng() * 0.4);
    const spreadX = (rng() - 0.5) * (this.width * 0.2) * (0.6 + arc * 0.55);
    const spreadY = rng() * 82 + Math.abs(clusterIndex - 2) * 8;

    const pileY = this.height * (0.33 + arc * 0.085) + spreadY + sizeBias * 16;
    if (mode === 'pile') {
      return {
        x: clamp(moundCenterX + spreadX, this.width * 0.16, this.width * 0.84),
        y: pileY,
      };
    }

    return {
      x: clamp(moundCenterX + spreadX * 0.86, this.width * 0.16, this.width * 0.84),
      y: -140 - rng() * 220 - index * 3.2 - sizeBias * 18,
    };
  }

  destroy(): void {
    Runner.stop(this.runner);
    Composite.clear(this.engine.world, false);
    Engine.clear(this.engine);
    this.bodies.clear();
    this.arrangedTargets.clear();
  }
}
