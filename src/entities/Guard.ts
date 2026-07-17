import * as THREE from 'three';
import { NavigationGraph } from '../world/NavigationGraph';
import { CollisionWorld } from '../world/CollisionWorld';
import { ProceduralAudio } from '../assets/ProceduralAudio';

export type GuardType = 'patrol' | 'sentinel' | 'heavy';

export enum GuardAIState {
  Patrol = 'patrol',
  Suspicious = 'suspicious',
  Investigate = 'investigate',
  Alerted = 'alerted',
  ReturnPatrol = 'returnPatrol',
  Dead = 'dead',
}

// Guard constants
export const GUARD_CONSTANTS = {
  visionRange: { patrol: 18, sentinel: 22, heavy: 12 },
  visionAngle: { patrol: 80, sentinel: 90, heavy: 60 }, // half-angle degrees
  hearRange: 10,
  suspicionRate: 1.2,
  suspicionDecay: 0.4,
  alertThreshold: 2.0,
  speed: { patrol: 3.5, sentinel: 0, heavy: 2.2 },
  health: { patrol: 40, sentinel: 50, heavy: 100 },
  attackDamage: { patrol: 12, sentinel: 10, heavy: 22 },
  attackRange: 1.8,
  attackCooldown: 1.2,
};

const GC = GUARD_CONSTANTS;

export class Guard {
  mesh: THREE.Group;
  private body: THREE.Mesh;
  private visorMesh: THREE.Mesh;
  aiState: GuardAIState = GuardAIState.Patrol;
  suspicion = 0;
  private health: number;
  type: GuardType;

  private patrolWaypoints: THREE.Vector3[] = [];
  private waypointIdx = 0;
  private waitTimer = 0;
  private stateTimer = 0;
  private lastKnownPlayerPos = new THREE.Vector3();
  private attackCooldown = 0;
  public neutralized = false;
  private velocity = new THREE.Vector3();
  private onGround = true;

  private _tmpDir = new THREE.Vector3();

  constructor(
    private scene: THREE.Scene,
    private col: CollisionWorld,
    type: GuardType,
    position: THREE.Vector3,
    rotation: number,
    private audio: ProceduralAudio,
  ) {
    this.type = type;
    this.health = GC.health[type];

    this.mesh = new THREE.Group();
    this.body = this.buildBody(type);
    this.visorMesh = this.buildVisor();
    this.mesh.add(this.body, this.visorMesh);
    this.mesh.position.copy(position);
    this.mesh.rotation.y = rotation;
    scene.add(this.mesh);
  }

  private buildBody(type: GuardType): THREE.Mesh {
    const h = type === 'heavy' ? 1.5 : 1.1;
    const r = type === 'heavy' ? 0.45 : 0.32;
    const geo = new THREE.CapsuleGeometry(r, h, 4, 8);
    const color = type === 'heavy' ? 0x6a1010 : type === 'sentinel' ? 0x8c2020 : 0x7a1a1a;
    const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.8 });
    const m = new THREE.Mesh(geo, mat);
    m.position.y = h / 2 + r;
    m.castShadow = true;
    return m;
  }

  private buildVisor(): THREE.Mesh {
    const geo = new THREE.BoxGeometry(0.3, 0.06, 0.1);
    const mat = new THREE.MeshStandardMaterial({ color: 0xffaa00, emissive: new THREE.Color(0xffaa00), emissiveIntensity: 0.5 });
    const m = new THREE.Mesh(geo, mat);
    m.position.set(0, this.type === 'heavy' ? 2.1 : 1.6, 0.3);
    return m;
  }

  setPatrolWaypoints(pts: THREE.Vector3[]): void {
    this.patrolWaypoints = pts;
  }

  update(dt: number, playerPos: THREE.Vector3, playerVisible: boolean, playerSuspicion: number): void {
    if (this.neutralized) return;
    this.attackCooldown -= dt;
    this.stateTimer += dt;

    switch (this.aiState) {
      case GuardAIState.Patrol: this.doPatrol(dt); break;
      case GuardAIState.Suspicious: this.doSuspicious(dt, playerPos, playerSuspicion); break;
      case GuardAIState.Investigate: this.doInvestigate(dt, playerPos); break;
      case GuardAIState.Alerted: this.doAlerted(dt, playerPos, playerVisible); break;
      case GuardAIState.ReturnPatrol: this.doReturn(dt); break;
    }

    // Gravity
    const gY = this.col.groundAt(this.mesh.position.x, this.mesh.position.z, this.mesh.position.y + 0.5);
    if (gY !== null) {
      this.mesh.position.y = gY;
    }
  }

  private doPatrol(dt: number): void {
    if (this.type === 'sentinel') return;
    if (this.patrolWaypoints.length === 0) return;

    const target = this.patrolWaypoints[this.waypointIdx];
    if (!target) return;

    const dist = this.moveTo(target, GC.speed[this.type] * dt);
    if (dist < 0.8) {
      this.waitTimer += dt;
      if (this.waitTimer > 2) {
        this.waitTimer = 0;
        this.waypointIdx = (this.waypointIdx + 1) % this.patrolWaypoints.length;
      }
    }
  }

  private doSuspicious(dt: number, playerPos: THREE.Vector3, suspicion: number): void {
    // Look toward noise/last position
    this.stateTimer += dt;
    if (suspicion <= 0 && this.stateTimer > 4) {
      this.aiState = GuardAIState.ReturnPatrol;
      this.stateTimer = 0;
    }
  }

  private doInvestigate(dt: number, playerPos: THREE.Vector3): void {
    this.moveTo(this.lastKnownPlayerPos, GC.speed[this.type] * dt);
    const dist = this.mesh.position.distanceTo(this.lastKnownPlayerPos);
    if (dist < 1.5) {
      this.stateTimer = 0;
      this.aiState = GuardAIState.ReturnPatrol;
    }
    if (this.stateTimer > 10) {
      this.aiState = GuardAIState.ReturnPatrol;
      this.stateTimer = 0;
    }
  }

  private doAlerted(dt: number, playerPos: THREE.Vector3, visible: boolean): void {
    if (visible) {
      this.lastKnownPlayerPos.copy(playerPos);
      const dist = this.moveTo(playerPos, GC.speed[this.type] * 1.5 * dt);
      // Attack
      if (dist < GC.attackRange && this.attackCooldown <= 0) {
        this.attackCooldown = GC.attackCooldown[this.type];
        // Emit attack event handled by combat system
        (this as any)._pendingAttack = true;
      }
    } else {
      this.moveTo(this.lastKnownPlayerPos, GC.speed[this.type] * dt);
      const dist = this.mesh.position.distanceTo(this.lastKnownPlayerPos);
      if (dist < 1.5) {
        this.aiState = GuardAIState.Investigate;
        this.stateTimer = 0;
      }
    }
  }

  private doReturn(dt: number): void {
    if (this.patrolWaypoints.length === 0) return;
    const target = this.patrolWaypoints[this.waypointIdx];
    const dist = this.moveTo(target, GC.speed[this.type] * 0.8 * dt);
    if (dist < 1 || this.stateTimer > 8) {
      this.aiState = GuardAIState.Patrol;
      this.stateTimer = 0;
    }
  }

  private moveTo(target: THREE.Vector3, step: number): number {
    this._tmpDir.subVectors(target, this.mesh.position);
    this._tmpDir.y = 0;
    const dist = this._tmpDir.length();
    if (dist < 0.01) return 0;
    this._tmpDir.normalize();
    this.mesh.position.addScaledVector(this._tmpDir, Math.min(step, dist));
    this.mesh.rotation.y = Math.atan2(this._tmpDir.x, this._tmpDir.z);
    return dist;
  }

  canSeePoint(point: THREE.Vector3): boolean {
    const toPlayer = this._tmpDir.subVectors(point, this.mesh.position);
    toPlayer.y = 0;
    const dist = toPlayer.length();
    const range = GC.visionRange[this.type];
    if (dist > range) return false;

    const halfAngle = (GC.visionAngle[this.type] * Math.PI) / 180;
    const guardFwd = new THREE.Vector3(Math.sin(this.mesh.rotation.y), 0, Math.cos(this.mesh.rotation.y));
    const angle = guardFwd.angleTo(toPlayer.normalize());
    if (angle > halfAngle) return false;

    // Simple raycast
    const rayDir = toPlayer.normalize();
    const hitDist = this.col.raycast(this.mesh.position, rayDir, dist);
    return hitDist >= dist - 0.5;
  }

  canHearPoint(point: THREE.Vector3, noiseLevel: number): boolean {
    const dist = this.mesh.position.distanceTo(point);
    return dist < GC.hearRange * noiseLevel;
  }

  setSuspicion(s: number): void { this.suspicion = s; }

  alertTo(playerPos: THREE.Vector3): void {
    this.lastKnownPlayerPos.copy(playerPos);
    this.aiState = GuardAIState.Alerted;
    this.stateTimer = 0;
    this.audio.playSFX('detect');
  }

  takeDamage(amount: number): void {
    this.health -= amount;
    this.audio.playSFX('hit', 0.7);
    if (this.health <= 0) this.neutralize();
  }

  neutralize(): void {
    this.neutralized = true;
    this.aiState = GuardAIState.Dead;
    this.mesh.rotation.z = Math.PI / 2;
    this.mesh.position.y = 0.3;
    this.audio.playSFX('stealth_kill', 0.6);
  }

  getType(): GuardType { return this.type; }
  getState(): GuardAIState { return this.aiState; }
  isNeutralized(): boolean { return this.neutralized; }
  hasPendingAttack(): boolean {
    const p = (this as any)._pendingAttack ?? false;
    (this as any)._pendingAttack = false;
    return p;
  }
}
