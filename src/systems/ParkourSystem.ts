import * as THREE from 'three';
import type { Player } from '../entities/Player';
import type { CollisionWorld } from '../world/CollisionWorld';

export const PARKOUR_CONSTANTS = {
  WALK_SPEED: 4.5,
  RUN_SPEED: 8.5,
  SPRINT_SPEED: 13.0,
  CROUCH_SPEED: 2.5,
  JUMP_FORCE: 8.5,
  GRAVITY: -22,
  LEDGE_GRAB_DIST: 1.1,
  LEDGE_GRAB_HEIGHT: 0.6,
  VAULT_DIST: 1.4,
  VAULT_HEIGHT_MAX: 1.5,
  CLIMB_SPEED: 3.0,
  ROLL_DURATION: 0.4,
  LAND_STAGGER_THRESHOLD: 8,
  FALL_DEATH_THRESHOLD: 18,
  AIR_CONTROL: 0.4,
  COYOTE_TIME: 0.12,
  JUMP_BUFFER_TIME: 0.12,
};

export type ParkourState =
  | 'ground'
  | 'air'
  | 'ledge'
  | 'climbing'
  | 'vaulting'
  | 'rolling'
  | 'hanging';

export class ParkourSystem {
  state: ParkourState = 'ground';
  velocity = new THREE.Vector3();
  isGrounded = false;
  isCrouching = false;
  isSprinting = false;
  isRunning = false;

  // Timers
  coyoteTimer = 0;
  jumpBufferTimer = 0;
  rollTimer = 0;
  staggerTimer = 0;
  vaultTimer = 0;
  vaultProgress = 0;

  // Ledge data
  ledgePoint = new THREE.Vector3();
  ledgeNormal = new THREE.Vector3();
  hangTimer = 0;

  // Fall tracking
  private fallStartY = 0;
  private wasFalling = false;

  private _moveDir = new THREE.Vector3();
  private _raycaster = new THREE.Raycaster();
  private _down = new THREE.Vector3(0, -1, 0);
  private _fwd = new THREE.Vector3();
  private _right = new THREE.Vector3();

  constructor(private collision: CollisionWorld) {}

  update(
    dt: number,
    player: Player,
    input: {
      moveX: number; moveZ: number;
      jump: boolean; jumpPressed: boolean;
      sprint: boolean; crouch: boolean;
    },
    camYaw: number
  ): void {
    const C = PARKOUR_CONSTANTS;
    const pos = player.mesh.position;

    // Build movement direction from camera yaw
    const yaw = camYaw;
    this._fwd.set(Math.sin(yaw), 0, Math.cos(yaw));
    this._right.set(Math.cos(yaw), 0, -Math.sin(yaw));
    this._moveDir.set(0, 0, 0)
      .addScaledVector(this._fwd, -input.moveZ)
      .addScaledVector(this._right, input.moveX);
    const hasMove = this._moveDir.lengthSq() > 0.01;
    if (hasMove) this._moveDir.normalize();

    // Update jump buffer
    if (input.jumpPressed) this.jumpBufferTimer = C.JUMP_BUFFER_TIME;
    else this.jumpBufferTimer = Math.max(0, this.jumpBufferTimer - dt);

    // State machine
    switch (this.state) {
      case 'rolling': this._updateRoll(dt, player); break;
      case 'vaulting': this._updateVault(dt, player); break;
      case 'ledge': this._updateLedge(dt, player, input); break;
      case 'climbing': this._updateClimb(dt, player, input); break;
      case 'ground':
      case 'air':
        this._updateLocomotion(dt, player, input, hasMove, yaw, C);
        break;
    }

    // Facing direction
    if (hasMove && this.state !== 'ledge' && this.state !== 'climbing') {
      const targetAngle = Math.atan2(this._moveDir.x, this._moveDir.z);
      const current = player.mesh.rotation.y;
      const diff = ((targetAngle - current + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
      player.mesh.rotation.y += diff * Math.min(1, dt * 14);
    }
  }

  private _updateLocomotion(
    dt: number, player: Player,
    input: any, hasMove: boolean,
    _yaw: number, C: typeof PARKOUR_CONSTANTS
  ): void {
    const pos = player.mesh.position;

    // Coyote time
    if (this.isGrounded) this.coyoteTimer = C.COYOTE_TIME;
    else this.coyoteTimer = Math.max(0, this.coyoteTimer - dt);

    // Ground check
    const groundHit = this.collision.raycast(
      pos.clone().add(new THREE.Vector3(0, 0.1, 0)),
      this._down, 0.35
    );
    this.isGrounded = !!groundHit;
    if (this.isGrounded && this.velocity.y < 0) {
      // Landing
      const fallSpeed = Math.abs(this.velocity.y);
      if (this.wasFalling && fallSpeed > C.LAND_STAGGER_THRESHOLD) {
        if (fallSpeed > C.FALL_DEATH_THRESHOLD) {
          player.takeDamage(1.0);
        } else {
          this._startRoll(player);
          return;
        }
      }
      this.velocity.y = 0;
      pos.y = groundHit!.point.y + 0.01;
      this.wasFalling = false;
      this.state = 'ground';
    } else if (!this.isGrounded) {
      if (!this.wasFalling && this.velocity.y < -1) {
        this.fallStartY = pos.y;
        this.wasFalling = true;
      }
    }

    // Jump
    const canJump = this.coyoteTimer > 0;
    if (this.jumpBufferTimer > 0 && canJump) {
      this.velocity.y = C.JUMP_FORCE;
      this.jumpBufferTimer = 0;
      this.coyoteTimer = 0;
      this.state = 'air';
      this.wasFalling = false;
      // Try vault/ledge
      this._tryVaultOrLedge(player);
    }

    // Speed
    this.isSprinting = input.sprint && hasMove && this.isGrounded;
    this.isRunning = hasMove && !this.isSprinting;
    this.isCrouching = input.crouch && this.isGrounded;
    let targetSpeed = C.WALK_SPEED;
    if (this.isSprinting) targetSpeed = C.SPRINT_SPEED;
    else if (this.isRunning) targetSpeed = C.RUN_SPEED;
    else if (this.isCrouching) targetSpeed = C.CROUCH_SPEED;

    // Horizontal movement
    const accel = this.isGrounded ? 18 : 8;
    const control = this.isGrounded ? 1 : C.AIR_CONTROL;
    if (hasMove) {
      this.velocity.x = THREE.MathUtils.lerp(this.velocity.x, this._moveDir.x * targetSpeed * control, dt * accel);
      this.velocity.z = THREE.MathUtils.lerp(this.velocity.z, this._moveDir.z * targetSpeed * control, dt * accel);
    } else {
      const drag = this.isGrounded ? 12 : 3;
      this.velocity.x = THREE.MathUtils.lerp(this.velocity.x, 0, dt * drag);
      this.velocity.z = THREE.MathUtils.lerp(this.velocity.z, 0, dt * drag);
    }

    // Gravity
    if (!this.isGrounded) {
      this.velocity.y += C.GRAVITY * dt;
      this.state = 'air';
    } else {
      this.state = 'ground';
    }

    // Apply movement with collision
    const delta = this.velocity.clone().multiplyScalar(dt);
    this._applyMovement(pos, delta);

    // Ledge grab while falling
    if (!this.isGrounded && this.velocity.y < 0) {
      this._tryGrabLedge(player);
    }
  }

  private _applyMovement(pos: THREE.Vector3, delta: THREE.Vector3): void {
    // X axis
    const nx = pos.clone().add(new THREE.Vector3(delta.x, 0, 0));
    if (!this.collision.overlapSphere(nx, 0.28)) pos.x = nx.x;
    // Z axis
    const nz = pos.clone().add(new THREE.Vector3(0, 0, delta.z));
    if (!this.collision.overlapSphere(nz, 0.28)) pos.z = nz.z;
    // Y axis
    pos.y += delta.y;
    // Floor clamp
    if (pos.y < 0.15) { pos.y = 0.15; this.velocity.y = 0; this.isGrounded = true; this.state = 'ground'; }
  }

  private _tryVaultOrLedge(player: Player): void {
    const C = PARKOUR_CONSTANTS;
    const pos = player.mesh.position;
    const fwd = new THREE.Vector3(Math.sin(player.mesh.rotation.y), 0, Math.cos(player.mesh.rotation.y));
    // Check for low obstacle ahead
    const checkPos = pos.clone().add(fwd.clone().multiplyScalar(0.6));
    const hitLow = this.collision.raycast(checkPos.clone().add(new THREE.Vector3(0, C.VAULT_HEIGHT_MAX + 0.5, 0)), new THREE.Vector3(0, -1, 0), C.VAULT_HEIGHT_MAX + 0.8);
    if (hitLow && hitLow.point.y - pos.y > 0.3 && hitLow.point.y - pos.y < C.VAULT_HEIGHT_MAX) {
      this._startVault(player, hitLow.point);
    }
  }

  private _startVault(player: Player, targetPoint: THREE.Vector3): void {
    this.state = 'vaulting';
    this.vaultTimer = 0;
    this.vaultProgress = 0;
    this.ledgePoint.copy(targetPoint).add(new THREE.Vector3(0, 0.3, 0));
    const fwd = new THREE.Vector3(Math.sin(player.mesh.rotation.y), 0, Math.cos(player.mesh.rotation.y));
    this.ledgeNormal.copy(fwd);
  }

  private _updateVault(dt: number, player: Player): void {
    this.vaultTimer += dt;
    const t = Math.min(this.vaultTimer / 0.35, 1);
    const startPos = player.mesh.position.clone();
    const over = this.ledgePoint.clone().add(this.ledgeNormal.clone().multiplyScalar(0.7));
    player.mesh.position.lerpVectors(startPos, over, dt * 8);
    if (t >= 1 || this.vaultTimer > 0.4) {
      this.state = 'air';
      this.velocity.set(this.ledgeNormal.x * 3, 2, this.ledgeNormal.z * 3);
    }
  }

  private _tryGrabLedge(player: Player): void {
    const C = PARKOUR_CONSTANTS;
    const pos = player.mesh.position;
    const fwd = new THREE.Vector3(Math.sin(player.mesh.rotation.y), 0, Math.cos(player.mesh.rotation.y));
    const checkOrigin = pos.clone().add(new THREE.Vector3(0, C.LEDGE_GRAB_HEIGHT, 0)).add(fwd.clone().multiplyScalar(0.4));
    const hit = this.collision.raycast(checkOrigin, new THREE.Vector3(0, -1, 0), C.LEDGE_GRAB_HEIGHT + 0.4);
    if (hit && Math.abs(hit.point.y - (pos.y + 1.6)) < 0.5) {
      this.state = 'ledge';
      this.ledgePoint.copy(hit.point);
      this.ledgeNormal.copy(fwd);
      this.velocity.set(0, 0, 0);
      player.mesh.position.set(pos.x, hit.point.y - 1.5, pos.z);
      this.hangTimer = 0;
    }
  }

  private _updateLedge(dt: number, player: Player, input: any): void {
    this.hangTimer += dt;
    // Drop
    if (input.crouch) {
      this.state = 'air';
      this.velocity.set(0, 0, 0);
      return;
    }
    // Climb up
    if (input.jumpPressed || input.jump) {
      this._climbUp(player);
      return;
    }
    // Max hang
    if (this.hangTimer > 4) {
      this.state = 'air';
      this.velocity.y = -1;
    }
  }

  private _climbUp(player: Player): void {
    this.state = 'climbing';
    this.vaultTimer = 0;
  }

  private _updateClimb(dt: number, player: Player, _input: any): void {
    this.vaultTimer += dt;
    player.mesh.position.y += PARKOUR_CONSTANTS.CLIMB_SPEED * dt;
    player.mesh.position.x += this.ledgeNormal.x * 1.5 * dt;
    player.mesh.position.z += this.ledgeNormal.z * 1.5 * dt;
    if (this.vaultTimer > 0.45) {
      this.state = 'ground';
      this.isGrounded = true;
      this.velocity.set(0, 0, 0);
    }
  }

  private _startRoll(player: Player): void {
    this.state = 'rolling';
    this.rollTimer = 0;
    const fwd = new THREE.Vector3(Math.sin(player.mesh.rotation.y), 0, Math.cos(player.mesh.rotation.y));
    this.velocity.set(fwd.x * 5, 0, fwd.z * 5);
  }

  private _updateRoll(dt: number, player: Player): void {
    this.rollTimer += dt;
    const t = this.rollTimer / PARKOUR_CONSTANTS.ROLL_DURATION;
    const speed = THREE.MathUtils.lerp(5, 0, t);
    const fwd = new THREE.Vector3(Math.sin(player.mesh.rotation.y), 0, Math.cos(player.mesh.rotation.y));
    player.mesh.position.addScaledVector(fwd, speed * dt);
    player.mesh.rotation.x = Math.sin(t * Math.PI) * 0.6;
    if (this.rollTimer >= PARKOUR_CONSTANTS.ROLL_DURATION) {
      this.state = 'ground';
      player.mesh.rotation.x = 0;
      this.velocity.set(0, 0, 0);
    }
  }
}
