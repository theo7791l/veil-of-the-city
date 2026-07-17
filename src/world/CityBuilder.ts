import * as THREE from 'three';
import { CollisionWorld } from './CollisionWorld';
import { Materials } from '../assets/ProceduralMaterials';

export interface SpawnPoint {
  position: THREE.Vector3;
  rotation: number;
  type?: string;
}

export interface MissionMarker {
  id: string;
  position: THREE.Vector3;
  mesh: THREE.Object3D;
}

export class CityBuilder {
  private guardSpawns: SpawnPoint[] = [];
  private civilianSpawns: SpawnPoint[] = [];
  public missionMarkers: MissionMarker[] = [];
  public interactables: { id: string; mesh: THREE.Object3D; position: THREE.Vector3 }[] = [];

  constructor(private scene: THREE.Scene, private col: CollisionWorld) {}

  build(): void {
    this.buildGround();
    this.buildDistrict();
    this.buildQuay();
    this.buildTower();
    this.buildMissionPoints();
    this.buildAtmosphere();
  }

  setLOD(q: number): void {
    // Could toggle detail meshes; for now a no-op stub
    void q;
  }

  getGuardSpawns(): SpawnPoint[] { return this.guardSpawns; }
  getCivilianSpawns(): SpawnPoint[] { return this.civilianSpawns; }

  // ─── Ground ────────────────────────────────────────────────────────────────────────────────
  private buildGround(): void {
    const g = new THREE.PlaneGeometry(300, 300);
    const m = new THREE.Mesh(g, Materials.sand());
    m.rotation.x = -Math.PI / 2;
    m.receiveShadow = true;
    this.scene.add(m);
    this.col.addBox(new THREE.Vector3(-150, -1, -150), new THREE.Vector3(150, 0, 150), { ledge: true });
  }

  // ─── Main district buildings ─────────────────────────────────────────────────────────────────
  private buildDistrict(): void {
    // Row 1 — north market block
    this.addBuilding(-20, 0, -30, 12, 8, 10, 'stone');
    this.addBuilding(-6, 0, -30, 8, 6, 10, 'stone');
    this.addBuilding(4, 0, -28, 10, 10, 12, 'stone');
    this.addBuilding(16, 0, -30, 8, 7, 10, 'stone');
    // Row 2 — residential
    this.addBuilding(-22, 0, -14, 10, 9, 8, 'stone');
    this.addBuilding(-10, 0, -14, 8, 5, 8, 'stone');
    this.addBuilding(0, 0, -10, 14, 12, 10, 'stone'); // tall building
    this.addBuilding(16, 0, -14, 8, 6, 8, 'stone');
    this.addBuilding(26, 0, -16, 10, 8, 10, 'stone');
    // Row 3 — near quay
    this.addBuilding(-18, 0, 4, 10, 7, 8, 'stone');
    this.addBuilding(-6, 0, 6, 8, 5, 8, 'stone');
    this.addBuilding(6, 0, 8, 10, 6, 8, 'stone');
    this.addBuilding(18, 0, 4, 8, 7, 8, 'stone');
    // Fortified residence
    this.addBuilding(-5, 0, -50, 18, 14, 16, 'stoneDark'); // mission target
    this.addWall(-14, 0, -50, 2, 5, 16, 'stoneDark');
    this.addWall(13, 0, -50, 2, 5, 16, 'stoneDark');
    this.addWall(-14, 0, -42, 28, 5, 2, 'stoneDark');
    // Arches
    this.addArch(-2, 0, -42, 4, 5);
    // Scaffolding
    this.addScaffolding(10, 0, -20);
    this.addScaffolding(-15, 0, -5);
    // Boxes / crates
    this.addCrates(5, 0, -5);
    this.addCrates(-8, 0, 2);
    // Awnings / ledge steps
    this.addLedgeStep(-20, 5, -14, 10, 0.5, 8);
    this.addLedgeStep(0, 8, -10, 14, 0.5, 10);
    this.addLedgeStep(-5, 10, -50, 18, 0.5, 16);
    // Guard spawns
    this.guardSpawns.push(
      { position: new THREE.Vector3(0, 0, -15), rotation: 0, type: 'patrol' },
      { position: new THREE.Vector3(-20, 0, -20), rotation: Math.PI, type: 'patrol' },
      { position: new THREE.Vector3(15, 0, -25), rotation: -Math.PI / 2, type: 'patrol' },
      { position: new THREE.Vector3(-5, 14, -50), rotation: Math.PI, type: 'sentinel' }, // roof
      { position: new THREE.Vector3(5, 14, -50), rotation: 0, type: 'sentinel' },
      { position: new THREE.Vector3(0, 0, -44), rotation: Math.PI, type: 'heavy' },
      { position: new THREE.Vector3(10, 0, -55), rotation: 0, type: 'patrol' },
      { position: new THREE.Vector3(-10, 0, -55), rotation: Math.PI / 2, type: 'patrol' },
    );
    // Civilian spawns
    this.civilianSpawns.push(
      { position: new THREE.Vector3(0, 0, 5), rotation: 0 },
      { position: new THREE.Vector3(10, 0, 0), rotation: 1 },
      { position: new THREE.Vector3(-12, 0, 0), rotation: -1 },
      { position: new THREE.Vector3(5, 0, 10), rotation: 2 },
    );
  }

  private buildQuay(): void {
    // Quay platform
    const qw = 60, qd = 20;
    const g = new THREE.BoxGeometry(qw, 1.5, qd);
    const m = new THREE.Mesh(g, Materials.wood());
    m.position.set(0, -0.75, 30);
    m.receiveShadow = true;
    m.castShadow = false;
    this.scene.add(m);
    this.col.addBox(new THREE.Vector3(-qw/2, -1.5, 20), new THREE.Vector3(qw/2, 0, 40), { ledge: true });
    // Bollards
    for (let x = -25; x <= 25; x += 10) {
      this.addCylinder(x, 0, 38, 0.3, 1.2);
    }
    // Extraction marker
    const exGeo = new THREE.CylinderGeometry(1.5, 1.5, 0.1, 16);
    const exMat = new THREE.MeshStandardMaterial({ color: 0x00ff88, emissive: new THREE.Color(0x00ff88), emissiveIntensity: 0.6, transparent: true, opacity: 0.7 });
    const exMesh = new THREE.Mesh(exGeo, exMat);
    exMesh.position.set(0, 0.1, 32);
    exMesh.name = 'extraction_zone';
    this.scene.add(exMesh);
    this.missionMarkers.push({ id: 'extraction', position: new THREE.Vector3(0, 0, 32), mesh: exMesh });
  }

  private buildTower(): void {
    // Tall watch tower (mission observation point)
    const tx = -2, tz = -65;
    this.addBuilding(tx, 0, tz, 8, 24, 8, 'stoneDark');
    // Top platform
    const tpGeo = new THREE.BoxGeometry(10, 0.5, 10);
    const tpMesh = new THREE.Mesh(tpGeo, Materials.stoneDark());
    tpMesh.position.set(tx, 24.25, tz);
    tpMesh.castShadow = true;
    tpMesh.receiveShadow = true;
    this.scene.add(tpMesh);
    this.col.addBox(
      new THREE.Vector3(tx - 5, 23.9, tz - 5),
      new THREE.Vector3(tx + 5, 24.5, tz + 5),
      { ledge: true },
    );
    // Staircase steps up
    for (let i = 0; i < 12; i++) {
      const sw = 2.5, sd = 1.2;
      const sx = tx + 4;
      const sy = i * 2;
      const sz = tz + 4 - i * 1.5;
      const sGeo = new THREE.BoxGeometry(sw, 0.4, sd);
      const sMesh = new THREE.Mesh(sGeo, Materials.stone());
      sMesh.position.set(sx, sy + 0.2, sz);
      sMesh.castShadow = true;
      sMesh.receiveShadow = true;
      this.scene.add(sMesh);
      this.col.addBox(
        new THREE.Vector3(sx - sw/2, sy, sz - sd/2),
        new THREE.Vector3(sx + sw/2, sy + 0.4, sz + sd/2),
        { ledge: true },
      );
    }
    // Observation point marker
    const obsGeo = new THREE.SphereGeometry(0.5, 8, 8);
    const obsMat = new THREE.MeshStandardMaterial({ color: 0xffd700, emissive: new THREE.Color(0xffd700), emissiveIntensity: 0.8 });
    const obsMesh = new THREE.Mesh(obsGeo, obsMat);
    obsMesh.position.set(tx, 25.5, tz);
    obsMesh.name = 'observation_point';
    this.scene.add(obsMesh);
    this.missionMarkers.push({ id: 'observation', position: new THREE.Vector3(tx, 25, tz), mesh: obsMesh });
  }

  private buildMissionPoints(): void {
    // Register (interactable inside fortified residence)
    const rGeo = new THREE.BoxGeometry(0.4, 0.3, 0.6);
    const rMat = new THREE.MeshStandardMaterial({ color: 0xc8a430, emissive: new THREE.Color(0xc8a430), emissiveIntensity: 0.5 });
    const rMesh = new THREE.Mesh(rGeo, rMat);
    rMesh.position.set(-5, 15, -52);
    rMesh.name = 'register';
    this.scene.add(rMesh);
    this.interactables.push({ id: 'register', mesh: rMesh, position: new THREE.Vector3(-5, 15, -52) });
    this.missionMarkers.push({ id: 'register', position: new THREE.Vector3(-5, 15, -52), mesh: rMesh });

    // Meeting scene (two NPCs outside)
    this.addMeetingNPCs();
  }

  private addMeetingNPCs(): void {
    const positions = [
      new THREE.Vector3(-3, 14, -48),
      new THREE.Vector3(2, 14, -48),
    ];
    positions.forEach((pos, i) => {
      const geo = new THREE.CapsuleGeometry(0.3, 1.1, 4, 8);
      const mat = new THREE.MeshStandardMaterial({ color: i === 0 ? 0x2a3a5a : 0x3a2a1a });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.copy(pos);
      mesh.name = `npc_meeting_${i}`;
      this.scene.add(mesh);
    });
  }

  // ─── Helpers ────────────────────────────────────────────────────────────────────────────
  addBuilding(cx: number, y: number, cz: number, w: number, h: number, d: number, mat: 'stone' | 'stoneDark'): void {
    const geo = new THREE.BoxGeometry(w, h, d);
    const mesh = new THREE.Mesh(geo, mat === 'stone' ? Materials.stone() : Materials.stoneDark());
    mesh.position.set(cx, y + h / 2, cz);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    this.scene.add(mesh);
    this.col.addBox(
      new THREE.Vector3(cx - w/2, y, cz - d/2),
      new THREE.Vector3(cx + w/2, y + h, cz + d/2),
      { ledge: true, climbable: true },
    );
    // Roof tile
    const rGeo = new THREE.BoxGeometry(w + 0.4, 0.5, d + 0.4);
    const rMesh = new THREE.Mesh(rGeo, Materials.roof());
    rMesh.position.set(cx, y + h + 0.25, cz);
    rMesh.castShadow = true;
    this.scene.add(rMesh);
  }

  addWall(cx: number, y: number, cz: number, w: number, h: number, d: number, mat: 'stone' | 'stoneDark'): void {
    const geo = new THREE.BoxGeometry(w, h, d);
    const mesh = new THREE.Mesh(geo, mat === 'stone' ? Materials.stone() : Materials.stoneDark());
    mesh.position.set(cx, y + h / 2, cz);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    this.scene.add(mesh);
    this.col.addBox(
      new THREE.Vector3(cx - w/2, y, cz - d/2),
      new THREE.Vector3(cx + w/2, y + h, cz + d/2),
    );
  }

  private addLedgeStep(cx: number, y: number, cz: number, w: number, h: number, d: number): void {
    const geo = new THREE.BoxGeometry(w, h, d);
    const mesh = new THREE.Mesh(geo, Materials.stoneDark());
    mesh.position.set(cx, y, cz);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    this.scene.add(mesh);
    this.col.addBox(
      new THREE.Vector3(cx - w/2, y - h/2, cz - d/2),
      new THREE.Vector3(cx + w/2, y + h/2, cz + d/2),
      { ledge: true, climbable: true },
    );
  }

  private addArch(cx: number, y: number, cz: number, w: number, h: number): void {
    // Left pillar
    const pg = new THREE.BoxGeometry(0.8, h, 0.8);
    const lp = new THREE.Mesh(pg, Materials.stoneDark());
    lp.position.set(cx - w/2, y + h/2, cz);
    this.scene.add(lp);
    this.col.addBox(
      new THREE.Vector3(cx - w/2 - 0.4, y, cz - 0.4),
      new THREE.Vector3(cx - w/2 + 0.4, y + h, cz + 0.4),
    );
    // Right pillar
    const rp = new THREE.Mesh(pg.clone(), Materials.stoneDark());
    rp.position.set(cx + w/2, y + h/2, cz);
    this.scene.add(rp);
    this.col.addBox(
      new THREE.Vector3(cx + w/2 - 0.4, y, cz - 0.4),
      new THREE.Vector3(cx + w/2 + 0.4, y + h, cz + 0.4),
    );
    // Arch lintel
    const lg = new THREE.BoxGeometry(w + 0.8, 0.8, 0.8);
    const lm = new THREE.Mesh(lg, Materials.stoneDark());
    lm.position.set(cx, y + h - 0.4, cz);
    this.scene.add(lm);
  }

  private addScaffolding(cx: number, y: number, cz: number): void {
    // Vertical posts
    const posts = [[-1, -1], [-1, 1], [1, -1], [1, 1]];
    posts.forEach(([ox, oz]) => {
      const pg = new THREE.BoxGeometry(0.15, 8, 0.15);
      const pm = new THREE.Mesh(pg, Materials.wood());
      pm.position.set(cx + ox, y + 4, cz + oz);
      this.scene.add(pm);
    });
    // Platforms at 3, 6
    [3, 6].forEach(h => {
      const plg = new THREE.BoxGeometry(2.5, 0.2, 2.5);
      const plm = new THREE.Mesh(plg, Materials.wood());
      plm.position.set(cx, y + h, cz);
      plm.castShadow = true;
      this.scene.add(plm);
      this.col.addBox(
        new THREE.Vector3(cx - 1.25, y + h - 0.1, cz - 1.25),
        new THREE.Vector3(cx + 1.25, y + h + 0.1, cz + 1.25),
        { ledge: true, climbable: true },
      );
    });
  }

  private addCrates(cx: number, y: number, cz: number): void {
    const sizes = [[1.2, 1, 1.2], [0.8, 0.8, 0.8]];
    sizes.forEach(([w, h, d], i) => {
      const geo = new THREE.BoxGeometry(w, h, d);
      const mesh = new THREE.Mesh(geo, Materials.wood());
      mesh.position.set(cx + i * 1.5, y + h / 2, cz);
      mesh.castShadow = true;
      this.scene.add(mesh);
      this.col.addBox(
        new THREE.Vector3(cx + i*1.5 - w/2, y, cz - d/2),
        new THREE.Vector3(cx + i*1.5 + w/2, y + h, cz + d/2),
        { ledge: true },
      );
    });
  }

  private addCylinder(x: number, y: number, z: number, r: number, h: number): void {
    const geo = new THREE.CylinderGeometry(r, r, h, 8);
    const mesh = new THREE.Mesh(geo, Materials.wood());
    mesh.position.set(x, y + h/2, z);
    mesh.castShadow = true;
    this.scene.add(mesh);
  }

  private buildAtmosphere(): void {
    // Hanging banners (flat quads)
    const bPositions = [
      [-5, 10, -30], [8, 8, -20], [-15, 9, -10],
      [5, 6, -5], [20, 7, -25],
    ];
    bPositions.forEach(([x, y, z]) => {
      const geo = new THREE.PlaneGeometry(0.6, 2);
      const hue = Math.random() > 0.5 ? 0xaa2222 : 0x2244aa;
      const mat = new THREE.MeshStandardMaterial({ color: hue, side: THREE.DoubleSide });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(x, y, z);
      this.scene.add(mesh);
    });

    // Particle dust (static instanced small spheres)
    const dustGeo = new THREE.SphereGeometry(0.04, 4, 4);
    const dustMat = new THREE.MeshBasicMaterial({ color: 0xe8d5a3, transparent: true, opacity: 0.35 });
    const count = 200;
    const iMesh = new THREE.InstancedMesh(dustGeo, dustMat, count);
    const m4 = new THREE.Matrix4();
    for (let i = 0; i < count; i++) {
      m4.setPosition(
        (Math.random() - 0.5) * 60,
        Math.random() * 20,
        (Math.random() - 0.5) * 80,
      );
      iMesh.setMatrixAt(i, m4);
    }
    iMesh.instanceMatrix.needsUpdate = true;
    this.scene.add(iMesh);

    // Distant birds (simple moving dots handled in update — static here)
    for (let i = 0; i < 6; i++) {
      const bGeo = new THREE.SphereGeometry(0.1, 4, 4);
      const bMat = new THREE.MeshBasicMaterial({ color: 0x222222 });
      const bMesh = new THREE.Mesh(bGeo, bMat);
      bMesh.position.set(
        (Math.random() - 0.5) * 120,
        25 + Math.random() * 20,
        (Math.random() - 0.5) * 100,
      );
      bMesh.name = 'bird';
      this.scene.add(bMesh);
    }
  }
}
