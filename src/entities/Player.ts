import * as THREE from 'three';
import { CollisionWorld } from '../world/CollisionWorld';
import { ProceduralAudio } from '../assets/ProceduralAudio';
import { GameState } from '../game/GameState';
import { SaveSystem } from '../systems/SaveSystem';
import { eventBus } from '../game/EventBus';

// ─── Gameplay constants — tweak here ───────────────────────────────────────
export const PLAYER_CONSTANTS = {
  walkSpeed: 5,
  runSpeed: 9,
  sprintSpeed: 14,
  crouchSpeed: 2.5,
  jumpForce: 7.5,
  gravity: -22,
  airControl: 0.35,
  maxHealth: 100,
  echoMaxEnergy: 1,
  echoDrainRate: 0.35,
  echoRechargeRate: 0.15,
  cameraDist: 4.5,
  cameraHeight: 1.8,
  fovNormal: 70,
  fovSprint: 80,
  ledgeReach: 2.2,
  capsuleRadius: 0.35,
  capsuleHalfH: 0.9,
  fallDamageThreshold: 6,
  fallDamageFatal: 16,
  stealthKillRange: 1.8,
};

const C = PLAYER_CONSTANTS;

enum ParkourState {
  Grounded      = 'grounded',
  Airborne      = 'airborne',
  HangingLedge  = 'hangingLedge',
  ClimbingUp    = 'climbingUp',
  Rolling       = 'rolling',
}

export class Player {
  mesh: THREE.Group;
  private body: THREE.Mesh;
  private head: THREE.Mesh;
  private cloak: THREE.Mesh;

  private velocity      = new THREE.Vector3();
  private onGround      = false;
  private parkourState  = ParkourState.Grounded;
  private ledgePoint    = new THREE.Vector3();
  private ledgeNormal   = new THREE.Vector3();
  private climbTimer    = 0;
  private rollTimer     = 0;
  private fallHeight    = 0;
  private airTime       = 0;

  private health  = C.maxHealth;
  private enabled = false;

  // Camera
  private camYaw         = 0;
  private camPitch       = 0.2;
  private camCurrentDist = C.cameraDist;
  private camTarget      = new THREE.Vector3();
  private camActual      = new THREE.Vector3();

  // Input
  private keys        = new Set<string>();
  private mouseX      = 0;
  private mouseY      = 0;
  private mouseLocked = false;
  private stepTimer   = 0;

  // Combat
  private attackCooldown = 0;
  private hitFlash       = 0;
  private isBlocking     = false;

  // Context
  private nearInteractable: { id: string; position: THREE.Vector3 } | null = null;
  public  lastKnownPos = new THREE.Vector3();

  constructor(
    private scene: THREE.Scene,
    private camera: THREE.PerspectiveCamera,
    private col: CollisionWorld,
    private audio: ProceduralAudio,
    private state: GameState,
    private save: SaveSystem,
  ) {
    this.mesh = new THREE.Group();
    this.body  = this.buildBody();
    this.head  = this.buildHead();
    this.cloak = this.buildCloak();
    this.mesh.add(this.body, this.head, this.cloak);
    this.mesh.position.set(0, 1, 0);
    scene.add(this.mesh);

    this.bindInput();
  }

  // ─── Character mesh ──────────────────────────────────────────────────────
  private buildBody(): THREE.Mesh {
    const geo = new THREE.CapsuleGeometry(C.capsuleRadius, C.capsuleHalfH * 1.5, 4, 8);
    const mat = new THREE.MeshStandardMaterial({ color: 0x1a1a2e, roughness: 0.7 });
    const m   = new THREE.Mesh(geo, mat);
    m.position.y  = C.capsuleHalfH;
    m.castShadow  = true;
    return m;
  }

  private buildHead(): THREE.Mesh {
    const geo = new THREE.SphereGeometry(0.22, 8, 8);
    const mat = new THREE.MeshStandardMaterial({ color: 0xc8a07a, roughness: 0.8 });
    const m   = new THREE.Mesh(geo, mat);
    m.position.y  = C.capsuleHalfH * 2 + 0.3;
    m.castShadow  = true;
    return m;
  }

  private buildCloak(): THREE.Mesh {
    const geo = new THREE.ConeGeometry(0.45, 1.2, 6);
    const mat = new THREE.MeshStandardMaterial({ color: 0x0d0d1a, roughness: 0.95 });
    const m   = new THREE.Mesh(geo, mat);
    m.position.y  = C.capsuleHalfH * 2 + 0.3;
    m.rotation.x  = Math.PI;
    return m;
  }

  // ─── Lifecycle ───────────────────────────────────────────────────────────
  reset(): void {
    this.mesh.position.set(0, 1, 0);
    this.velocity.set(0, 0, 0);
    this.health = C.maxHealth;
    this.state.data.playerHealth = 1;
    this.state.data.echoEnergy   = 1;
    this.parkourState = ParkourState.Grounded;
    this.camYaw   = 0;
    this.camPitch = 0.2;
  }

  enable(): void {
    this.enabled = true;
    // BUG FIX : on demande le pointer lock via un clic sur le canvas directement,
    // pas sur document (évite un clic parasite sur le bouton du menu)
    document.getElementById('game-canvas')?.addEventListener('click', this.requestPointerLock);
  }

  disable(): void {
    this.enabled = false;
    document.getElementById('game-canvas')?.removeEventListener('click', this.requestPointerLock);
    if (document.pointerLockElement) document.exitPointerLock();
    this.mouseLocked = false;
  }

  private requestPointerLock = (): void => {
    const canvas = document.getElementById('game-canvas');
    if (canvas && this.enabled) canvas.requestPointerLock();
  };

  // ─── Input binding ───────────────────────────────────────────────────────
  private bindInput(): void {
    window.addEventListener('keydown', e => {
      this.keys.add(e.code);
      if (e.code === 'Escape' && this.enabled) {
        eventBus.emit('pauseGame');
      }
      if (e.code === 'F3') {
        this.state.data.debugMode = !this.state.data.debugMode;
      }
      if (e.code === 'KeyE') this.tryInteract();
      if (e.code === 'KeyF') this.tryStealthKill();
    });
    window.addEventListener('keyup', e => this.keys.delete(e.code));

    window.addEventListener('mousemove', e => {
      if (!this.mouseLocked) return;
      const sens = this.save.getSettings().mouseSensitivity;
      this.mouseX += e.movementX * sens;
      this.mouseY += e.movementY * sens;
    });

    window.addEventListener('mousedown', e => {
      if (e.button === 0) { this.tryAttack(); }
      if (e.button === 2) { this.isBlocking = true; }
    });
    window.addEventListener('mouseup', e => {
      if (e.button === 2) this.isBlocking = false;
    });
    window.addEventListener('contextmenu', e => e.preventDefault());

    document.addEventListener('pointerlockchange', () => {
      this.mouseLocked = document.pointerLockElement === document.getElementById('game-canvas');
    });
  }

  // ─── Main update ─────────────────────────────────────────────────────────
  update(dt: number): void {
    if (!this.enabled) return;

    this.updateCamera();
    this.updateMovement(dt);
    this.updateEcho(dt);
    this.updateCombatCooldowns(dt);
    this.updateProceduralAnim(dt);
    this.syncState();

    this.lastKnownPos.copy(this.mesh.position);
    this.mouseX = 0;
    this.mouseY = 0;
  }

  // ─── Camera ──────────────────────────────────────────────────────────────
  private updateCamera(): void {
    this.camYaw   -= this.mouseX;
    this.camPitch  = Math.max(-0.5, Math.min(0.8, this.camPitch - this.mouseY));

    const isSprinting = this.keys.has('ShiftLeft') || this.keys.has('ShiftRight');
    const targetFov = isSprinting ? C.fovSprint : C.fovNormal;
    this.camera.fov += (targetFov - this.camera.fov) * 0.08;
    this.camera.updateProjectionMatrix();

    const yawQ     = new THREE.Quaternion().setFromAxisAngle(THREE.Object3D.DEFAULT_UP, this.camYaw);
    const pitchAxis = new THREE.Vector3(1, 0, 0).applyQuaternion(yawQ);
    const pitchQ   = new THREE.Quaternion().setFromAxisAngle(pitchAxis, -this.camPitch);
    const camDir   = new THREE.Vector3(0, 0, 1).applyQuaternion(yawQ).applyQuaternion(pitchQ);

    const eyePos       = this.mesh.position.clone().add(new THREE.Vector3(0, C.cameraHeight, 0));
    const hitDist      = this.col.raycast(eyePos, camDir, C.cameraDist);
    const safeDist     = Math.min(hitDist - 0.2, C.cameraDist);
    this.camCurrentDist += (Math.max(0.8, safeDist) - this.camCurrentDist) * 0.15;

    const safeCamPos = eyePos.clone().addScaledVector(camDir, this.camCurrentDist);
    this.camActual.lerp(safeCamPos, 0.15);
    this.camera.position.copy(this.camActual);

    const fwd    = new THREE.Vector3(-Math.sin(this.camYaw), 0, -Math.cos(this.camYaw));
    const lookAt = eyePos.clone().addScaledVector(fwd, 1.5);
    this.camTarget.lerp(lookAt, 0.12);
    this.camera.lookAt(this.camTarget);
  }

  // ─── Movement & parkour ──────────────────────────────────────────────────
  private updateMovement(dt: number): void {
    const isCrouch = this.keys.has('ControlLeft') || this.keys.has('ControlRight');
    const isSprint = (this.keys.has('ShiftLeft') || this.keys.has('ShiftRight')) && !isCrouch;
    const isJump   = this.keys.has('Space');

    let mx = 0, mz = 0;
    if (this.keys.has('KeyW') || this.keys.has('KeyZ')) mz -= 1;
    if (this.keys.has('KeyS')) mz += 1;
    if (this.keys.has('KeyA') || this.keys.has('KeyQ')) mx -= 1;
    if (this.keys.has('KeyD')) mx += 1;

    const hasInput = mx !== 0 || mz !== 0;
    const inputDir = new THREE.Vector3(mx, 0, mz).normalize();
    inputDir.applyAxisAngle(THREE.Object3D.DEFAULT_UP, this.camYaw);

    const speed = isCrouch ? C.crouchSpeed : isSprint ? C.sprintSpeed : C.walkSpeed;

    switch (this.parkourState) {
      case ParkourState.Grounded:
      case ParkourState.Rolling: {
        if (this.parkourState === ParkourState.Rolling) {
          this.rollTimer -= dt;
          if (this.rollTimer <= 0) this.parkourState = ParkourState.Grounded;
        }
        const accel = 18, decel = 14;
        if (hasInput) {
          this.velocity.x += (inputDir.x * speed - this.velocity.x) * Math.min(1, accel * dt);
          this.velocity.z += (inputDir.z * speed - this.velocity.z) * Math.min(1, decel * dt);
        } else {
          this.velocity.x *= Math.max(0, 1 - decel * dt);
          this.velocity.z *= Math.max(0, 1 - decel * dt);
        }
        if (isJump && this.onGround) {
          const ledge = this.col.findLedgeInRange(this.mesh.position, C.ledgeReach);
          if (ledge && ledge.point.y > this.mesh.position.y + 0.5) {
            this.startLedgeGrab(ledge.point, ledge.normal);
          } else {
            this.velocity.y = C.jumpForce;
            this.onGround   = false;
            this.parkourState = ParkourState.Airborne;
            this.audio.playSFX('jump');
            this.airTime    = 0;
            this.fallHeight = this.mesh.position.y;
          }
        }
        if (hasInput && this.onGround) {
          this.stepTimer -= dt;
          if (this.stepTimer <= 0) {
            this.stepTimer = isSprint ? 0.28 : isCrouch ? 0.55 : 0.42;
            this.audio.playSFX('footstep', isCrouch ? 0.3 : isSprint ? 0.8 : 0.55);
          }
        }
        break;
      }

      case ParkourState.Airborne: {
        this.airTime += dt;
        if (hasInput) {
          this.velocity.x += inputDir.x * speed * C.airControl * dt * 10;
          this.velocity.z += inputDir.z * speed * C.airControl * dt * 10;
          const hSpeed = Math.sqrt(this.velocity.x ** 2 + this.velocity.z ** 2);
          if (hSpeed > speed * 1.2) {
            this.velocity.x = (this.velocity.x / hSpeed) * speed * 1.2;
            this.velocity.z = (this.velocity.z / hSpeed) * speed * 1.2;
          }
        }
        if (isJump || this.airTime < 0.3) {
          const ledge = this.col.findLedgeInRange(this.mesh.position, C.ledgeReach);
          if (ledge && ledge.point.y > this.mesh.position.y - 0.2) {
            this.startLedgeGrab(ledge.point, ledge.normal);
          }
        }
        break;
      }

      case ParkourState.HangingLedge: {
        this.velocity.set(0, 0, 0);
        this.mesh.position.set(
          this.ledgePoint.x - this.ledgeNormal.x * 0.4,
          this.ledgePoint.y - C.capsuleHalfH * 2 - 0.2,
          this.ledgePoint.z - this.ledgeNormal.z * 0.4,
        );
        if (isJump) {
          this.parkourState = ParkourState.ClimbingUp;
          this.climbTimer   = 0.35;
        } else if (isCrouch) {
          this.parkourState = ParkourState.Airborne;
          this.velocity.y   = -1;
          this.airTime      = 0;
          this.fallHeight   = this.mesh.position.y;
        }
        return;
      }

      case ParkourState.ClimbingUp: {
        this.climbTimer -= dt;
        this.mesh.position.y += (C.capsuleHalfH * 2 + 0.6) * dt / 0.35;
        this.velocity.set(0, 0, 0);
        if (this.climbTimer <= 0) {
          this.mesh.position.copy(this.ledgePoint);
          this.mesh.position.y = this.ledgePoint.y + 0.05;
          this.parkourState = ParkourState.Grounded;
          this.onGround     = true;
          this.audio.playSFX('land', 0.4);
        }
        return;
      }
    }

    if (!this.onGround) this.velocity.y += C.gravity * dt;

    const newPos = this.mesh.position.clone().addScaledVector(this.velocity, dt);

    const gY = this.col.groundAt(newPos.x, newPos.z, newPos.y + 0.5);
    if (gY !== null && newPos.y <= gY + 0.05 && this.velocity.y <= 0) {
      const wasFalling = !this.onGround;
      const fallDist   = wasFalling ? this.fallHeight - gY : 0;
      newPos.y         = gY;
      this.velocity.y  = 0;
      this.onGround    = true;

      if (wasFalling && this.parkourState === ParkourState.Airborne) {
        if (fallDist > C.fallDamageFatal) {
          this.takeDamage(C.maxHealth);
        } else if (fallDist > C.fallDamageThreshold) {
          this.takeDamage(Math.round((fallDist - C.fallDamageThreshold) * 8));
          this.parkourState = ParkourState.Rolling;
          this.rollTimer    = 0.5;
          this.audio.playSFX('land', 1);
        } else if (fallDist > 2) {
          this.audio.playSFX('land', 0.6);
        }
        if (this.parkourState !== ParkourState.Rolling) this.parkourState = ParkourState.Grounded;
      }
    } else if (this.onGround) {
      if (gY === null || newPos.y > gY + 0.1) {
        this.onGround     = false;
        this.parkourState = ParkourState.Airborne;
        this.airTime      = 0;
        this.fallHeight   = this.mesh.position.y;
      }
    }

    this.mesh.position.copy(newPos);

    if (hasInput && (this.parkourState === ParkourState.Grounded || this.parkourState === ParkourState.Airborne)) {
      const targetAngle  = Math.atan2(inputDir.x, inputDir.z);
      const currentAngle = this.mesh.rotation.y;
      let delta = targetAngle - currentAngle;
      while (delta > Math.PI)  delta -= Math.PI * 2;
      while (delta < -Math.PI) delta += Math.PI * 2;
      this.mesh.rotation.y += delta * 0.15;
    }
  }

  private startLedgeGrab(point: THREE.Vector3, normal: THREE.Vector3): void {
    this.parkourState = ParkourState.HangingLedge;
    this.ledgePoint.copy(point);
    this.ledgeNormal.copy(normal);
    this.velocity.set(0, 0, 0);
    this.onGround = false;
    this.audio.playSFX('grab');
  }

  // ─── Echo vision ─────────────────────────────────────────────────────────
  private updateEcho(dt: number): void {
    const echoKey = this.keys.has('KeyR');
    if (echoKey && this.state.data.echoEnergy > 0) {
      this.state.data.isEchoActive = true;
      this.state.data.echoEnergy   = Math.max(0, this.state.data.echoEnergy - C.echoDrainRate * dt);
    } else {
      this.state.data.isEchoActive = false;
      this.state.data.echoEnergy   = Math.min(1, this.state.data.echoEnergy + C.echoRechargeRate * dt);
    }
  }

  // ─── Combat ──────────────────────────────────────────────────────────────
  private updateCombatCooldowns(dt: number): void {
    if (this.attackCooldown > 0) this.attackCooldown -= dt;
    if (this.hitFlash > 0)       this.hitFlash       -= dt;
  }

  private tryAttack(): void {
    if (!this.enabled || this.attackCooldown > 0) return;
    this.attackCooldown = 0.6;
    this.audio.playSFX('blade');
    eventBus.emit('playerAttack', { position: this.mesh.position, range: 1.8 });
  }

  tryInteract(): void {
    if (this.nearInteractable) eventBus.emit('interact', this.nearInteractable.id);
  }

  tryStealthKill(): void {
    eventBus.emit('stealthKillAttempt', { position: this.mesh.position });
  }

  setNearInteractable(obj: { id: string; position: THREE.Vector3 } | null): void {
    this.nearInteractable = obj;
  }

  takeDamage(amount: number): void {
    this.health = Math.max(0, this.health - amount);
    this.state.data.playerHealth = this.health / C.maxHealth;
    this.audio.playSFX('hit');
    this.hitFlash = 0.15;
    if (this.health <= 0) eventBus.emit('playerDied');
  }

  heal(amount: number): void {
    this.health = Math.min(C.maxHealth, this.health + amount);
    this.state.data.playerHealth = this.health / C.maxHealth;
  }

  // ─── Procedural animation ────────────────────────────────────────────────
  private updateProceduralAnim(_dt: number): void {
    if (this.onGround && this.isMoving()) {
      const speed = this.isSprinting() ? 14 : 8;
      const amp   = this.isSprinting() ? 0.06 : 0.035;
      this.head.position.y = C.capsuleHalfH * 2 + 0.3 + Math.sin(performance.now() * 0.001 * speed) * amp;
    }
    if (this.hitFlash > 0) {
      (this.body.material as THREE.MeshStandardMaterial).emissive.setHex(0xff0000);
      (this.body.material as THREE.MeshStandardMaterial).emissiveIntensity = this.hitFlash * 4;
    } else {
      (this.body.material as THREE.MeshStandardMaterial).emissiveIntensity = 0;
    }
  }

  private syncState(): void {
    this.state.data.playerHealth = this.health / C.maxHealth;
  }

  // ─── Accessors ───────────────────────────────────────────────────────────
  getPosition(): THREE.Vector3 { return this.mesh.position; }
  getHealth():   number        { return this.health; }
  isBlocking2(): boolean       { return this.isBlocking; }
  isInCrouch():  boolean       { return this.keys.has('ControlLeft') || this.keys.has('ControlRight'); }
  isSprinting(): boolean       { return (this.keys.has('ShiftLeft') || this.keys.has('ShiftRight')) && !this.isInCrouch(); }
  isMoving():    boolean       { return (this.velocity.x ** 2 + this.velocity.z ** 2) > 0.5; }
}
