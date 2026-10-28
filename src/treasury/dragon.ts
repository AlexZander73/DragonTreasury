import * as THREE from 'three';

const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
const skin = new THREE.MeshStandardMaterial({ color: '#36564b', roughness: .58, metalness: .3, flatShading: true });
const dark = new THREE.MeshStandardMaterial({ color: '#1c3832', roughness: .68, metalness: .2, flatShading: true });
const belly = new THREE.MeshStandardMaterial({ color: '#b49a63', roughness: .57, metalness: .35, flatShading: true });
const horn = new THREE.MeshStandardMaterial({ color: '#e1c394', roughness: .3, metalness: .5, flatShading: true });
const obsidian = new THREE.MeshStandardMaterial({ color: '#10231f', roughness: .32, metalness: .35 });
const eye = new THREE.MeshBasicMaterial({ color: '#ffd87f', toneMapped: false });

export function mesh(geometry: THREE.BufferGeometry, material: THREE.Material, parent: THREE.Object3D, position = V(0, 0, 0), scale = V(1, 1, 1)) {
  const object = new THREE.Mesh(geometry, material);
  object.position.copy(position); object.scale.copy(scale);
  object.castShadow = true; object.receiveShadow = true;
  parent.add(object); return object;
}

export function bone(a: THREE.Vector3, b: THREE.Vector3, start: number, end: number, material: THREE.Material, parent: THREE.Object3D, sides = 8) {
  const object = mesh(new THREE.CylinderGeometry(end, start, a.distanceTo(b), sides), material, parent, a.clone().add(b).multiplyScalar(.5));
  object.quaternion.setFromUnitVectors(V(0, 1, 0), b.clone().sub(a).normalize());
  return object;
}

function ellipsoid(parent: THREE.Object3D, position: THREE.Vector3, scale: THREE.Vector3, material: THREE.Material = skin, detail = 1) {
  return mesh(new THREE.IcosahedronGeometry(1, detail), material, parent, position, scale);
}

function taperedCurve(parent: THREE.Object3D, points: THREE.Vector3[], radius: number, material: THREE.Material) {
  const curve = new THREE.CatmullRomCurve3(points);
  const geometry = new THREE.TubeGeometry(curve, 35, radius, 7, false);
  const positions = geometry.attributes.position;
  for (let i = 0; i < positions.count; i++) {
    const t = Math.floor(i / 8) / 35;
    const center = curve.getPointAt(t);
    const point = V(positions.getX(i), positions.getY(i), positions.getZ(i));
    point.sub(center).multiplyScalar(Math.max(.025, 1 - t * .98)).add(center);
    positions.setXYZ(i, point.x, point.y, point.z);
  }
  geometry.computeVertexNormals();
  return mesh(geometry, material, parent);
}

function makeWing(side: number, parent: THREE.Object3D) {
  const wing = new THREE.Group(); parent.add(wing);
  wing.position.set(side * .65, 2.75, -.4); wing.scale.x = side;
  const elbow = V(1.15, 1.7, -.65);
  const edge = [V(0, 0, .45), V(.5, .8, -.2), elbow, V(2.7, 3.1, -1.15), V(4.9, 2.5, -.8), V(3.6, 1.55, -.1), V(3.8, -.15, 1.1), V(2.6, .35, 1.1), V(2.2, -1.2, 1.9), V(1.35, -.65, 1.2), V(.8, -1.4, 1.3), V(0, -.55, .7)];
  const vertices: number[] = [];
  for (let i = 0; i < edge.length; i++) vertices.push(...elbow.toArray(), ...edge[i].toArray(), ...edge[(i + 1) % edge.length].toArray());
  const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3)); geometry.computeVertexNormals();
  mesh(geometry, new THREE.MeshStandardMaterial({ color: '#587566', roughness: .75, metalness: .15, side: THREE.DoubleSide, flatShading: true }), wing);
  bone(V(0, 0, 0), elbow, .23, .14, skin, wing);
  bone(elbow, edge[3], .14, .07, skin, wing);
  bone(edge[3], edge[4], .07, .015, horn, wing);
  for (const index of [6, 8, 10]) bone(elbow, edge[index], .085, .018, skin, wing);
  for (let i = 3; i < edge.length - 1; i++) bone(edge[i], edge[i + 1], .024, .014, dark, wing, 5);
  bone(elbow, elbow.clone().add(V(-.15, .6, 0)), .14, .005, horn, wing);
  return wing;
}

export class Dragon {
  root = new THREE.Group();
  torso = new THREE.Group();
  head = new THREE.Group();
  jaw = new THREE.Group();
  tail = new THREE.Group();
  wings: THREE.Group[];
  eyes: THREE.Mesh[] = [];
  fire: THREE.Points;
  private firePositions = new Float32Array(160 * 3);
  private fireSeeds = Array.from({ length: 160 }, (_, i) => (i * .61803398875) % 1);
  private wakeStarted = -100;

  constructor() {
    this.root.add(this.torso);
    ellipsoid(this.torso, V(0, 1.75, -.25), V(1.15, 1.35, 1.8), skin, 2);
    ellipsoid(this.torso, V(0, 1.9, .7), V(.8, 1.1, 1.1), belly, 1);
    // Rising, articulated neck and overlapping throat plates.
    ellipsoid(this.torso, V(0, 2.75, 1.05), V(.63, 1.1, .75), skin, 2);
    ellipsoid(this.torso, V(0, 3.5, 1.5), V(.52, .9, .6), skin, 1);
    for (let i = 0; i < 7; i++) {
      const plate = ellipsoid(this.torso, V(0, 2.1 + i * .245, 1.55 + i * .055), V(.53 - i * .022, .17, .15), belly);
      plate.rotation.x = -.22;
    }
    this.head.position.set(0, 4, 1.85); this.torso.add(this.head);
    ellipsoid(this.head, V(0, 0, 0), V(.67, .55, .78), skin, 1);
    ellipsoid(this.head, V(0, -.18, .65), V(.49, .32, .8), skin, 1);
    ellipsoid(this.head, V(0, -.12, 1.12), V(.5, .28, .3), dark, 1);
    this.jaw.position.set(0, -.39, .1); this.head.add(this.jaw);
    ellipsoid(this.jaw, V(0, 0, .62), V(.45, .16, .75), belly, 1);
    for (const side of [-1, 1]) {
      const eyeSocket = ellipsoid(this.head, V(side * .54, .1, .36), V(.15, .21, .31), obsidian);
      eyeSocket.rotation.z = side * -.2;
      this.eyes.push(ellipsoid(this.head, V(side * .65, .1, .44), V(.065, .1, .18), eye));
      ellipsoid(this.head, V(side * .71, .1, .45), V(.015, .075, .022), obsidian);
      const brow = ellipsoid(this.head, V(side * .52, .3, .38), V(.19, .13, .43), skin);
      brow.rotation.z = side * -.32;
      ellipsoid(this.head, V(side * .3, .01, 1.3), V(.1, .07, .05), obsidian);
      taperedCurve(this.head, [V(side * .43, .35, -.3), V(side * .7, .95, -.55), V(side * .82, 1.4, -1.1), V(side * .65, 1.55, -1.4)], .23, horn);
      bone(V(side * .48, -.1, -.3), V(side * 1, .1, -.85), .22, .01, horn, this.head);
      for (let i = 0; i < 4; i++) bone(V(side * .39, -.3, .4 + i * .23), V(side * .35, -.52, .4 + i * .23), .055, .005, horn, this.head, 5);
      // Four muscular legs, broad feet and three ivory claws per foot.
      for (const back of [false, true]) {
        const z = back ? -1.3 : .95;
        ellipsoid(this.torso, V(side * .9, back ? 1.1 : 1.35, z), V(back ? .75 : .48, .78, .65), skin);
        bone(V(side * 1.05, 1.2, z), V(side * 1.4, .45, z + .5), .32, .24, skin, this.torso);
        ellipsoid(this.torso, V(side * 1.42, .35, z + .7), V(.46, .26, .65), dark);
        for (let i = 0; i < 3; i++) bone(V(side * 1.42 + (i - 1) * .25, .28, z + 1), V(side * 1.42 + (i - 1) * .28, .16, z + 1.5), .11, .009, horn, this.torso);
      }
    }
    // Dorsal armor follows the entire spine.
    for (let i = 0; i < 10; i++) {
      const z = -1.8 + i * .36;
      const y = i < 6 ? 2.75 + Math.sin(i / 6 * Math.PI) * .3 : 3.1 + (i - 6) * .28;
      const spike = mesh(new THREE.ConeGeometry(.22, .7, 4), horn, this.torso, V(0, y, z)); spike.rotation.x = -.4;
    }
    this.tail.position.set(0, 1.2, -1.4); this.torso.add(this.tail);
    taperedCurve(this.tail, [V(0, 0, 0), V(.2, -.4, -1.6), V(1.8, -.7, -3), V(3.6, -.8, -2.7), V(4.2, -.5, -1.4), V(3.8, -.1, -.6)], .65, skin);
    for (let i = 0; i < 7; i++) {
      const angle = i * .28;
      const spike = mesh(new THREE.ConeGeometry(.17 - i * .015, .5 - i * .035, 4), horn, this.tail, V(.25 + i * .5, .15 - i * .1, -1 - Math.sin(angle) * 2)); spike.rotation.x = -.3;
    }
    this.wings = [makeWing(-1, this.torso), makeWing(1, this.torso)];
    // Small armor plates break up the faceted body silhouette.
    for (let side = -1; side <= 1; side += 2) for (let i = 0; i < 6; i++) {
      const plate = ellipsoid(this.torso, V(side * .99, 2.15, -.9 + i * .35), V(.19, .26, .25), dark);
      plate.rotation.z = side * .5;
    }
    const fireGeometry = new THREE.BufferGeometry(); fireGeometry.setAttribute('position', new THREE.BufferAttribute(this.firePositions, 3));
    this.fire = new THREE.Points(fireGeometry, new THREE.PointsMaterial({ color: '#ffb34d', size: .13, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
    this.fire.frustumCulled = false; this.head.add(this.fire);
  }

  wake(time: number) { this.wakeStarted = time; }

  update(time: number, reduced: boolean, looking: number) {
    const t = reduced ? 0 : time;
    const elapsed = time - this.wakeStarted;
    const wake = !reduced && elapsed < 4 ? Math.sin(Math.min(elapsed / 4, 1) * Math.PI) : 0;
    this.torso.scale.y = 1 + Math.sin(t * 1.1) * .018;
    this.head.rotation.y = Math.sin(t * .28) * .09 + looking * .12;
    this.head.rotation.x = Math.sin(t * .6) * .025 - wake * .15;
    this.jaw.rotation.x = wake * .33;
    this.tail.rotation.y = Math.sin(t * .6) * .09;
    this.wings.forEach((wing, index) => { wing.rotation.z = (index === 0 ? 1 : -1) * (.18 + Math.sin(t * .7) * .04 - wake * .33); wing.rotation.y = (index === 0 ? -1 : 1) * (.14 + Math.sin(t * .5) * .04); });
    const blink = !reduced && t % 7.3 > 7.12 ? .15 : 1;
    this.eyes.forEach(object => { object.scale.y = .1 * blink; });
    const material = this.fire.material as THREE.PointsMaterial;
    material.opacity = elapsed > .6 && elapsed < 3.3 ? wake * .85 : 0;
    for (let i = 0; i < 160; i++) {
      const p = (t * 1.2 + this.fireSeeds[i]) % 1;
      this.firePositions[i * 3] = Math.sin(i * 13.7 + t * 3) * p * .6;
      this.firePositions[i * 3 + 1] = -.3 + p * .5 + Math.cos(i * 7.1) * p * .3;
      this.firePositions[i * 3 + 2] = 1.3 + p * 4.5;
    }
    this.fire.geometry.attributes.position.needsUpdate = true;
  }
}
