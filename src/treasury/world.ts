import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { Dragon, bone, mesh } from './dragon';
import { hashId, type Project } from './catalog';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
export type Chamber = 'ember' | 'moon' | 'forest';
export type Arrangement = 'hoard' | 'gallery';
interface Callbacks { select: (id: string) => void; hover: (id: string | null, x: number, y: number) => void; wake: () => void }
const palettes = {
  ember: { background: '#141916', fog: '#141916', key: '#ffe1a0', rim: '#7bc1b2', fire: '#ffad48' },
  moon: { background: '#101826', fog: '#101826', key: '#b0cfff', rim: '#b3a1e9', fire: '#8ecfff' },
  forest: { background: '#101e19', fog: '#101e19', key: '#d8f2ab', rim: '#40baaa', fire: '#b5ed91' },
};
function random(seed: number) { return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const gold = new THREE.MeshStandardMaterial({ color: '#d4a849', metalness: .88, roughness: .29 });
const bronze = new THREE.MeshStandardMaterial({ color: '#9a7137', metalness: .72, roughness: .37 });
const wood = new THREE.MeshStandardMaterial({ color: '#34271c', metalness: .12, roughness: .8 });
const stone = new THREE.MeshStandardMaterial({ color: '#333c37', roughness: .87, metalness: .12, flatShading: true });
const stoneDark = new THREE.MeshStandardMaterial({ color: '#242b27', roughness: .78, metalness: .2, flatShading: true });
const ivory = new THREE.MeshStandardMaterial({ color: '#c6b692', roughness: .7 });

export class TreasuryWorld {
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(40, 1, .1, 100);
  private renderer: THREE.WebGLRenderer;
  private controls: OrbitControls;
  private dragon = new Dragon();
  private treasures = new Map<string, THREE.Group>();
  private basePositions = new Map<string, THREE.Vector3>();
  private targets = new Map<string, THREE.Vector3>();
  private pickables: THREE.Object3D[] = [];
  private selection = new THREE.Group();
  private selected: string | null = null;
  private hovered: string | null = null;
  private particles: THREE.Points;
  private torches: THREE.PointLight[] = [];
  private flames: THREE.Mesh[] = [];
  private key = new THREE.DirectionalLight('#ffe1a0', 4.2);
  private rim = new THREE.DirectionalLight('#7bc1b2', 3);
  private lastFrame = performance.now();
  private time = 0;
  private observer: ResizeObserver;
  private reduced = false;
  private paused = false;
  private visible = true;
  private active = true;
  private disposed = false;
  private arrangement: Arrangement = 'hoard';
  private down = { x: 0, y: 0 };
  private raycaster = new THREE.Raycaster();
  private pointer = new THREE.Vector2();
  private targetCamera: THREE.Vector3 | null = null;
  private targetLook: THREE.Vector3 | null = null;
  private environment: THREE.WebGLRenderTarget;
  private resize = () => {
    const width = this.host.clientWidth, height = this.host.clientHeight;
    if (!width || !height) return;
    this.camera.aspect = width / height; this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height, false);
  };

  constructor(private host: HTMLElement, projects: Project[], private callbacks: Callbacks) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, window.innerWidth < 700 ? 1.35 : 1.7));
    this.renderer.shadowMap.enabled = true; this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping; this.renderer.toneMappingExposure = 1.3;
    this.renderer.domElement.setAttribute('aria-label', 'Interactive 3D treasury. Drag to orbit, scroll to zoom, or select a treasure. All projects are also available in the collection below.');
    this.renderer.domElement.setAttribute('role', 'img');
    this.host.append(this.renderer.domElement);
    const generator = new THREE.PMREMGenerator(this.renderer);
    const room = new RoomEnvironment();
    this.environment = generator.fromScene(room, .04); this.scene.environment = this.environment.texture;
    room.dispose(); generator.dispose();
    this.scene.environmentIntensity = .65;
    this.scene.fog = new THREE.FogExp2('#141916', .027);
    this.camera.position.set(11.5, 8.5, 20);
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.target.set(-1.6, 1.8, 0);
    this.controls.enableDamping = true; this.controls.dampingFactor = .07;
    this.controls.minDistance = 10; this.controls.maxDistance = 34;
    this.controls.minPolarAngle = .35; this.controls.maxPolarAngle = Math.PI / 2.12;
    this.controls.enablePan = false;
    this.controls.addEventListener('start', this.cancelCamera);
    this.controls.update();
    this.scene.add(new THREE.HemisphereLight('#e3ecdd', '#40301f', 1.5));
    this.key.position.set(-3, 13, 8); this.key.castShadow = true;
    this.key.shadow.mapSize.set(2048, 2048); this.key.shadow.camera.left = -13; this.key.shadow.camera.right = 13; this.key.shadow.camera.top = 13; this.key.shadow.camera.bottom = -13;
    this.key.shadow.normalBias = .035; this.key.shadow.bias = -.00015;
    this.rim.position.set(4, 8, -7); this.scene.add(this.key, this.rim);
    this.makeChamber();
    this.makeCoins();
    this.dragon.root.position.set(1.4, .2, -1.6); this.dragon.root.rotation.y = -.15; this.dragon.root.scale.setScalar(1.15);
    this.dragon.root.traverse(object => { object.userData.dragon = true; });
    this.scene.add(this.dragon.root); this.pickables.push(this.dragon.root);
    projects.forEach((project, index) => {
      const object = this.makeRelic(project, index);
      const angle = -.3 + index / Math.max(projects.length - 1, 1) * Math.PI * 1.35;
      const radius = 4.5 + (index % 3) * 1.1;
      const position = V(Math.cos(angle) * radius - .5, .5 + (index % 3) * .08, Math.sin(angle) * radius + .8);
      object.position.copy(position); object.rotation.y = hashId(project.id) % 100 / 20;
      object.traverse(child => { child.userData.projectId = project.id; });
      this.treasures.set(project.id, object); this.basePositions.set(project.id, position); this.targets.set(project.id, position.clone());
      this.pickables.push(object); this.scene.add(object);
    });
    const ringMaterial = new THREE.MeshBasicMaterial({ color: '#f2d18c', transparent: true, opacity: .8, side: THREE.DoubleSide });
    mesh(new THREE.TorusGeometry(.83, .018, 6, 64), ringMaterial, this.selection).rotation.x = -Math.PI / 2;
    const outer = mesh(new THREE.TorusGeometry(.96, .009, 4, 64), ringMaterial, this.selection); outer.rotation.x = -Math.PI / 2;
    for (let i = 0; i < 4; i++) { const tick = mesh(new THREE.OctahedronGeometry(.065), ringMaterial, this.selection, V(Math.cos(i * Math.PI / 2) * .96, .02, Math.sin(i * Math.PI / 2) * .96)); tick.scale.y = .3; }
    this.selection.visible = false; this.scene.add(this.selection);
    const rng = random(7391); const particlePositions = new Float32Array(170 * 3);
    for (let i = 0; i < 170; i++) { particlePositions[i * 3] = (rng() - .5) * 25; particlePositions[i * 3 + 1] = rng() * 12; particlePositions[i * 3 + 2] = (rng() - .5) * 22; }
    const particleGeometry = new THREE.BufferGeometry(); particleGeometry.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3));
    this.particles = new THREE.Points(particleGeometry, new THREE.PointsMaterial({ color: '#d8bf83', size: .035, transparent: true, opacity: .5, blending: THREE.AdditiveBlending, depthWrite: false })); this.scene.add(this.particles);
    this.observer = new ResizeObserver(this.resize); this.observer.observe(host); this.resize();
    this.renderer.domElement.addEventListener('pointerdown', this.onDown);
    this.renderer.domElement.addEventListener('pointermove', this.onMove);
    this.renderer.domElement.addEventListener('pointerup', this.onUp);
    this.renderer.domElement.addEventListener('pointerleave', this.onLeave);
    this.renderer.domElement.addEventListener('webglcontextlost', this.onContextLost);
    document.addEventListener('visibilitychange', this.onVisibility);
    this.setChamber('ember'); this.renderer.setAnimationLoop(this.frame);
  }

  private makeChamber() {
    const floor = mesh(new THREE.CylinderGeometry(10.1, 10.5, .55, 96), stoneDark, this.scene, V(0, -.3, 0)); floor.receiveShadow = true;
    for (const radius of [9.5, 9.65, 6.9]) mesh(new THREE.TorusGeometry(radius, radius === 6.9 ? .018 : .035, 5, 128), bronze, this.scene, V(0, .006, 0)).rotation.x = -Math.PI / 2;
    for (let i = 0; i < 64; i++) {
      const angle = i / 64 * Math.PI * 2;
      const rune = mesh(new THREE.BoxGeometry(.035, .012, .23 + (i % 3) * .05), bronze, this.scene, V(Math.cos(angle) * 9.25, .015, Math.sin(angle) * 9.25)); rune.rotation.y = -angle;
    }
    // Stone joints and radial cuts, visible in the warm grazing light.
    for (let i = 0; i < 16; i++) {
      const angle = i / 16 * Math.PI * 2;
      const joint = mesh(new THREE.BoxGeometry(.018, .008, 9.5), new THREE.MeshBasicMaterial({ color: '#151c18' }), this.scene, V(Math.sin(angle) * 4.75, .008, Math.cos(angle) * 4.75)); joint.rotation.y = angle;
    }
    const rng = random(51);
    for (let i = 0; i < 40; i++) {
      const angle = Math.PI + i / 39 * Math.PI;
      const radius = 12 + rng() * 3;
      const rock = mesh(new THREE.IcosahedronGeometry(1, 0), stoneDark, this.scene, V(Math.cos(angle) * radius, 1 + rng() * 2, Math.sin(angle) * radius - 2), V(1.2 + rng() * 1.5, 2 + rng() * 3, 1.3 + rng() * 2));
      rock.rotation.set(rng(), rng(), rng());
    }
    // Ruined arch framing the dragon; its open center keeps the silhouette legible.
    for (const side of [-1, 1]) {
      for (let i = 0; i < 5; i++) {
        const block = mesh(new THREE.BoxGeometry(1.05, .8, 1.15), stone, this.scene, V(side * 5.4, .4 + i * .82, -8)); block.rotation.y = (i % 2) * .04;
      }
      mesh(new THREE.BoxGeometry(1.4, .3, 1.5), stoneDark, this.scene, V(side * 5.4, 4.2, -8));
    }
    for (let i = 0; i <= 16; i++) {
      const angle = i / 16 * Math.PI;
      const block = mesh(new THREE.BoxGeometry(.95, .62, 1.2), stone, this.scene, V(Math.cos(angle) * 5.4, 4.25 + Math.sin(angle) * 3.9, -8)); block.rotation.z = angle + Math.PI / 2;
    }
    for (const [x, z] of [[-6.8, -3], [6.8, -4], [-7, 5], [7.6, 4]]) {
      mesh(new THREE.CylinderGeometry(.38, .65, .25, 8), stone, this.scene, V(x, .15, z));
      mesh(new THREE.CylinderGeometry(.12, .2, 1.5, 8), bronze, this.scene, V(x, 1, z));
      mesh(new THREE.CylinderGeometry(.48, .2, .4, 8), bronze, this.scene, V(x, 1.85, z));
      const flame = mesh(new THREE.IcosahedronGeometry(1, 1), new THREE.MeshBasicMaterial({ color: '#ffce83', transparent: true, opacity: .9 }), this.scene, V(x, 2.2, z), V(.19, .48, .19)); this.flames.push(flame);
      const light = new THREE.PointLight('#ffad48', 17, 10, 2); light.position.set(x, 2.5, z); this.scene.add(light); this.torches.push(light);
    }
  }

  private makeCoins() {
    const rng = random(771);
    const count = window.innerWidth < 700 ? 1400 : 2500;
    const coins = new THREE.InstancedMesh(new THREE.CylinderGeometry(.115, .115, .035, 10), gold, count);
    coins.castShadow = true; coins.receiveShadow = true;
    const dummy = new THREE.Object3D();
    const piles = [[-2.3, 2.6, 2.4, 1.1], [2.8, 3, 2.3, 1.3], [4.9, -.3, 1.7, .8], [-3.6, -1.5, 1.7, .65], [.3, .5, 2.1, .75]];
    for (let i = 0; i < count; i++) {
      const [cx, cz, radius, height] = piles[i % piles.length];
      const angle = rng() * Math.PI * 2; const r = Math.sqrt(rng()) * radius;
      const y = Math.pow(1 - r / radius, 1.3) * height + rng() * .15;
      dummy.position.set(cx + Math.cos(angle) * r, y + .06, cz + Math.sin(angle) * r);
      dummy.rotation.set((rng() - .5) * .65, rng() * 6.28, (rng() - .5) * .65); dummy.scale.setScalar(.7 + rng() * .7); dummy.updateMatrix();
      coins.setMatrixAt(i, dummy.matrix); coins.setColorAt(i, new THREE.Color().setHSL(.105 + rng() * .035, .45 + rng() * .35, .4 + rng() * .22));
    }
    this.scene.add(coins);
    // Faceted gold mound cores prevent gaps from showing empty space beneath coins.
    for (const [x, z, radius, height] of piles) mesh(new THREE.SphereGeometry(1, 18, 8, 0, Math.PI * 2, 0, Math.PI / 2), bronze, this.scene, V(x, .02, z), V(radius * .77, height * .72, radius * .77));
  }

  private makeRelic(project: Project, index: number) {
    const group = new THREE.Group();
    const accent = /^#[0-9a-f]{6}$/i.test(project.accent) ? project.accent : '#72b6a0';
    const gem = new THREE.MeshStandardMaterial({ color: accent, metalness: .45, roughness: .13, emissive: accent, emissiveIntensity: .18, flatShading: true });
    const kind = project.category === 'infrastructure' ? 2 : project.category === 'experiment' ? 1 : hashId(project.id) % 4;
    mesh(new THREE.CylinderGeometry(.66, .74, .13, 8), stoneDark, group, V(0, .03, 0));
    mesh(new THREE.TorusGeometry(.63, .025, 6, 32), bronze, group, V(0, .1, 0)).rotation.x = Math.PI / 2;
    if (kind === 0) {
      // Banded chest with arched lid and a project-colored lock.
      mesh(new THREE.BoxGeometry(.95, .55, .68), wood, group, V(0, .43, 0));
      const lid = mesh(new THREE.CylinderGeometry(.35, .35, .95, 10, 1, false, 0, Math.PI), wood, group, V(0, .7, 0)); lid.rotation.z = Math.PI / 2; lid.rotation.x = Math.PI / 2;
      for (const x of [-.34, .34]) mesh(new THREE.BoxGeometry(.09, .64, .73), gold, group, V(x, .46, 0));
      mesh(new THREE.BoxGeometry(1, .065, .73), bronze, group, V(0, .19, 0));
      mesh(new THREE.BoxGeometry(.16, .23, .08), gold, group, V(0, .55, .39));
      mesh(new THREE.OctahedronGeometry(.085), gem, group, V(0, .56, .45));
    } else if (kind === 1) {
      // A cluster of cut crystals with physical depth and metallic facets.
      for (let i = 0; i < 3; i++) {
        const crystal = mesh(new THREE.OctahedronGeometry(.4, 0), gem, group, V((i - 1) * .25, .6 + (i === 1 ? .2 : 0), (i % 2) * .1), V(.7, i === 1 ? 1.8 : 1.2, .7)); crystal.rotation.z = (i - 1) * -.25;
      }
      mesh(new THREE.CylinderGeometry(.3, .4, .2, 6), gold, group, V(0, .23, 0));
    } else if (kind === 2) {
      const book = new THREE.Group(); group.add(book); book.position.set(0, .5, 0); book.rotation.set(-.35, .2, -.15);
      mesh(new THREE.BoxGeometry(.7, .82, .23), ivory, book);
      for (const z of [-.14, .14]) mesh(new THREE.BoxGeometry(.78, .92, .055), gem, book, V(0, 0, z));
      mesh(new THREE.BoxGeometry(.12, .92, .36), bronze, book, V(-.36, 0, 0));
      mesh(new THREE.TorusGeometry(.18, .025, 5, 4), gold, book, V(0, 0, .18));
      for (const y of [-.36, .36]) mesh(new THREE.BoxGeometry(.78, .035, .02), gold, book, V(0, y, .18));
    } else {
      mesh(new THREE.CylinderGeometry(.16, .32, .36, 8), gold, group, V(0, .3, 0));
      mesh(new THREE.IcosahedronGeometry(.36, 1), gem, group, V(0, .72, 0));
      const ring = mesh(new THREE.TorusGeometry(.46, .035, 6, 32), gold, group, V(0, .72, 0)); ring.rotation.x = .5; ring.rotation.y = -.5;
      const ring2 = mesh(new THREE.TorusGeometry(.43, .02, 6, 32), gold, group, V(0, .72, 0)); ring2.rotation.y = 1;
    }
    if (project.featured) {
      for (let i = 0; i < 5; i++) mesh(new THREE.OctahedronGeometry(.035), gold, group, V(Math.cos(i * 1.257) * .6, .14, Math.sin(i * 1.257) * .6));
    }
    group.userData.phase = index * .9;
    return group;
  }

  setChamber(chamber: Chamber) {
    const palette = palettes[chamber];
    this.scene.background = new THREE.Color(palette.background);
    (this.scene.fog as THREE.FogExp2).color.set(palette.fog);
    this.key.color.set(palette.key); this.rim.color.set(palette.rim);
    this.torches.forEach(light => light.color.set(palette.fire));
    this.flames.forEach(flame => (flame.material as THREE.MeshBasicMaterial).color.set(palette.fire));
  }
  setMotion(reduced: boolean, paused: boolean) { this.reduced = reduced; this.paused = paused; this.controls.enableDamping = !reduced; }
  setActive(active: boolean) { this.active = active; this.lastFrame = performance.now(); }
  setFilter(ids: string[]) {
    const allowed = new Set(ids);
    this.treasures.forEach((object, id) => { object.visible = allowed.has(id); });
    this.setArrangement(this.arrangement);
    this.selection.visible = this.selected !== null && allowed.has(this.selected);
  }
  setArrangement(arrangement: Arrangement) {
    this.arrangement = arrangement;
    const visible = [...this.treasures].filter(([, object]) => object.visible);
    visible.forEach(([id], index) => {
      if (arrangement === 'hoard') this.targets.set(id, this.basePositions.get(id)!.clone());
      else {
        const columns = Math.min(7, visible.length);
        this.targets.set(id, V((index % columns - (columns - 1) / 2) * 1.8, .25, 2 + Math.floor(index / columns) * 1.8));
      }
    });
  }
  select(id: string | null) {
    this.selected = id;
    this.selection.visible = Boolean(id && this.treasures.get(id)?.visible);
  }
  focus(id: string) {
    const object = this.treasures.get(id); if (!object) return;
    this.targetLook = object.position.clone().add(V(0, .5, 0));
    this.targetCamera = object.position.clone().add(V(7, 7, 12));
  }
  reset() {
    this.targetLook = V(-1.6, 1.8, 0); this.targetCamera = V(11.5, 8.5, 20);
  }
  wake() { this.dragon.wake(this.time); }
  private cancelCamera = () => { this.targetCamera = null; this.targetLook = null; };
  private onVisibility = () => { this.visible = !document.hidden; this.lastFrame = performance.now(); };
  private onContextLost = (event: Event) => { event.preventDefault(); this.host.dispatchEvent(new CustomEvent('treasury-render-error')); };
  private hit(event: PointerEvent) {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.pointer.set((event.clientX - rect.left) / rect.width * 2 - 1, -(event.clientY - rect.top) / rect.height * 2 + 1);
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const roots = this.pickables.filter(object => object.visible);
    return this.raycaster.intersectObjects(roots, true)[0]?.object;
  }
  private onDown = (event: PointerEvent) => { this.down = { x: event.clientX, y: event.clientY }; };
  private onMove = (event: PointerEvent) => {
    if (event.buttons) { this.onLeave(); return; }
    const object = this.hit(event);
    this.hovered = object?.userData.projectId || null;
    this.renderer.domElement.style.cursor = object ? 'pointer' : 'grab';
    this.callbacks.hover(this.hovered || (object?.userData.dragon ? 'dragon' : null), event.clientX, event.clientY);
  };
  private onUp = (event: PointerEvent) => {
    if (Math.hypot(event.clientX - this.down.x, event.clientY - this.down.y) > 7) return;
    const object = this.hit(event);
    if (object?.userData.projectId) this.callbacks.select(object.userData.projectId);
    else if (object?.userData.dragon) this.callbacks.wake();
  };
  private onLeave = () => { this.hovered = null; this.callbacks.hover(null, 0, 0); };
  private frame = () => {
    if (this.disposed) return;
    const now = performance.now();
    const delta = Math.min((now - this.lastFrame) / 1000, .05);
    this.lastFrame = now;
    if (!this.visible || !this.active) return;
    if (!this.paused) this.time += delta;
    this.dragon.update(this.time, this.reduced, this.hovered ? .6 : 0);
    this.treasures.forEach((object, id) => {
      const target = this.targets.get(id)!;
      object.position.lerp(target, this.reduced ? 1 : 1 - Math.exp(-delta * 7));
      const active = id === this.selected || id === this.hovered;
      const scale = active ? 1.15 : 1;
      object.scale.lerp(V(scale, scale, scale), .13);
    });
    if (this.selected && this.treasures.has(this.selected)) {
      const object = this.treasures.get(this.selected)!;
      this.selection.position.copy(object.position).add(V(0, .08, 0));
      this.selection.rotation.y = this.reduced ? 0 : this.time * .15;
    }
    if (!this.reduced) {
      this.particles.rotation.y = this.time * .008;
      this.particles.position.y = Math.sin(this.time * .15) * .4;
      this.flames.forEach((flame, i) => { flame.scale.y = .43 + Math.sin(this.time * 7 + i) * .065; this.torches[i].intensity = 16 + Math.sin(this.time * 6 + i) * 2; });
    }
    if (this.targetCamera && this.targetLook) {
      const speed = this.reduced ? 1 : 1 - Math.exp(-delta * 3.5);
      this.camera.position.lerp(this.targetCamera, speed); this.controls.target.lerp(this.targetLook, speed);
      if (this.camera.position.distanceTo(this.targetCamera) < .02) this.cancelCamera();
    }
    this.controls.update(); this.renderer.render(this.scene, this.camera);
  };
  dispose() {
    this.disposed = true; this.renderer.setAnimationLoop(null); this.observer.disconnect(); this.controls.dispose();
    this.renderer.domElement.removeEventListener('pointerdown', this.onDown); this.renderer.domElement.removeEventListener('pointermove', this.onMove); this.renderer.domElement.removeEventListener('pointerup', this.onUp); this.renderer.domElement.removeEventListener('pointerleave', this.onLeave); this.renderer.domElement.removeEventListener('webglcontextlost', this.onContextLost); document.removeEventListener('visibilitychange', this.onVisibility);
    const geometries = new Set<THREE.BufferGeometry>(); const materials = new Set<THREE.Material>();
    this.scene.traverse(object => { if (object instanceof THREE.Mesh || object instanceof THREE.Points) { geometries.add(object.geometry); (Array.isArray(object.material) ? object.material : [object.material]).forEach(material => materials.add(material)); } });
    geometries.forEach(geometry => geometry.dispose()); materials.forEach(material => material.dispose());
    this.environment.dispose(); this.renderer.dispose(); this.renderer.domElement.remove();
  }
}
