import * as THREE from 'three';

const COLORS = [0xc8a07a, 0xa07850, 0xd4b896, 0x8a6040];

export class Civilian {
  mesh: THREE.Group;
  private body: THREE.Mesh;
  private moveTarget = new THREE.Vector3();
  private waitTimer = 0;
  private moveTimer = 0;
  private speed = 1.2 + Math.random() * 0.8;
  private home: THREE.Vector3;
  private panicking = false;
  private _tmpDir = new THREE.Vector3();

  constructor(private scene: THREE.Scene, position: THREE.Vector3) {
    this.mesh = new THREE.Group();
    const color = COLORS[Math.floor(Math.random() * COLORS.length)];
    const geo = new THREE.CapsuleGeometry(0.28, 0.9, 4, 8);
    const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.9 });
    this.body = new THREE.Mesh(geo, mat);
    this.body.position.y = 0.8;
    this.body.castShadow = true;
    this.mesh.add(this.body);
    this.mesh.position.copy(position);
    this.home = position.clone();
    this.pickNewTarget();
    scene.add(this.mesh);
  }

  update(dt: number, alertLevel: number): void {
    if (alertLevel >= 2 && !this.panicking) {
      this.panicking = true;
      this.speed = 4;
      // Run away from center
      this.moveTarget.set(this.home.x + (Math.random() - 0.5) * 30, 0, this.home.z + 30);
    }

    if (this.waitTimer > 0) {
      this.waitTimer -= dt;
      return;
    }

    this._tmpDir.subVectors(this.moveTarget, this.mesh.position);
    this._tmpDir.y = 0;
    const dist = this._tmpDir.length();

    if (dist < 0.5) {
      if (!this.panicking) {
        this.waitTimer = 1 + Math.random() * 2;
        this.pickNewTarget();
      }
    } else {
      this._tmpDir.normalize();
      this.mesh.position.addScaledVector(this._tmpDir, this.speed * dt);
      this.mesh.rotation.y = Math.atan2(this._tmpDir.x, this._tmpDir.z);
    }

    this.moveTimer += dt;
    // Idle head bob
    if (dist > 0.5) {
      this.body.position.y = 0.8 + Math.sin(this.moveTimer * 6) * 0.025;
    }
  }

  private pickNewTarget(): void {
    this.moveTarget.set(
      this.home.x + (Math.random() - 0.5) * 16,
      0,
      this.home.z + (Math.random() - 0.5) * 16,
    );
  }
}
