import * as THREE from 'three';
import { Guard, GuardType, GuardAIState, GUARD_CONSTANTS } from '../entities/Guard';
import { Civilian } from '../entities/Civilian';
import { Player } from '../entities/Player';
import { CollisionWorld } from '../world/CollisionWorld';
import { GameState } from '../game/GameState';
import { ProceduralAudio } from '../assets/ProceduralAudio';
import { NavigationGraph } from '../world/NavigationGraph';
import { eventBus } from '../game/EventBus';
import type { SpawnPoint } from '../world/CityBuilder';

export class AISystem {
  guards: Guard[] = [];
  civilians: Civilian[] = [];
  private nav: NavigationGraph;

  constructor(
    private scene: THREE.Scene,
    private col: CollisionWorld,
    private state: GameState,
    private audio: ProceduralAudio,
  ) {
    this.nav = new NavigationGraph();
    this.nav.buildCityGrid();
  }

  spawnGuards(spawns: SpawnPoint[]): void {
    spawns.forEach(sp => {
      const type = (sp.type as GuardType) ?? 'patrol';
      const g = new Guard(this.scene, this.col, type, sp.position, sp.rotation, this.audio);
      // Assign waypoints from nav near spawn
      const waypoints = this.generateWaypoints(sp.position, type);
      g.setPatrolWaypoints(waypoints);
      this.guards.push(g);
    });
  }

  spawnCivilians(spawns: SpawnPoint[]): void {
    spawns.forEach(sp => {
      this.civilians.push(new Civilian(this.scene, sp.position));
    });
  }

  reset(): void {
    // Re-create guards from scratch would require re-spawning;
    // For simplicity, un-neutralize and reset state
    this.guards.forEach(g => {
      g.neutralized = false;
      g.aiState = GuardAIState.Patrol;
      g.suspicion = 0;
      g.mesh.rotation.z = 0;
    });
    this.civilians.forEach(c => {
      (c as any).panicking = false;
      (c as any).speed = 1.2 + Math.random() * 0.8;
    });
  }

  update(dt: number, player: Player): void {
    const playerPos = player.getPosition();
    const isCrouch = player.isInCrouch();
    const isSprinting = player.isSprinting();
    const isMoving = player.isMoving();
    const noiseLevel = isSprinting ? 1.5 : isCrouch ? 0.3 : isMoving ? 0.8 : 0;

    let highestAlert = 0;
    let anyAlerted = false;

    this.guards.forEach(guard => {
      if (guard.neutralized) return;

      const visible = guard.canSeePoint(playerPos);
      const heard = noiseLevel > 0 && guard.canHearPoint(playerPos, noiseLevel);

      // Update suspicion
      if (visible || heard) {
        const rate = visible ? GUARD_CONSTANTS.suspicionRate * (isCrouch ? 0.5 : 1) : 0.5;
        guard.suspicion = Math.min(GUARD_CONSTANTS.alertThreshold, guard.suspicion + rate * dt);
      } else {
        guard.suspicion = Math.max(0, guard.suspicion - GUARD_CONSTANTS.suspicionDecay * dt);
      }

      // State transitions
      if (guard.suspicion >= GUARD_CONSTANTS.alertThreshold) {
        if (guard.aiState !== GuardAIState.Alerted) {
          guard.alertTo(playerPos);
          this.alertNearby(guard, playerPos);
        }
        anyAlerted = true;
        highestAlert = 3;
      } else if (guard.suspicion > 0.8 && guard.aiState === GuardAIState.Patrol) {
        guard.aiState = GuardAIState.Suspicious;
        highestAlert = Math.max(highestAlert, 1);
      } else if (guard.suspicion > 1.2 && guard.aiState === GuardAIState.Suspicious) {
        guard.aiState = GuardAIState.Investigate;
        highestAlert = Math.max(highestAlert, 2);
      }

      guard.update(dt, playerPos, visible, guard.suspicion);

      // Combat
      if (guard.hasPendingAttack()) {
        eventBus.emit('guardAttack', { guard, damage: GUARD_CONSTANTS.attackDamage[guard.type] });
      }
    });

    // Update alert level
    if (anyAlerted) {
      this.state.setAlertLevel(3);
    } else {
      const decayed = Math.max(0, this.state.data.alertLevel - 0.1 * dt);
      this.state.setAlertLevel(Math.max(highestAlert, decayed > 0.5 ? Math.ceil(decayed) - 1 : 0));
    }

    // Update civilians
    this.civilians.forEach(c => c.update(dt, this.state.data.alertLevel));
  }

  private alertNearby(source: Guard, playerPos: THREE.Vector3): void {
    this.guards.forEach(g => {
      if (g === source || g.neutralized) return;
      const dist = g.mesh.position.distanceTo(source.mesh.position);
      if (dist < 20) {
        g.alertTo(playerPos);
      }
    });
  }

  private generateWaypoints(origin: THREE.Vector3, type: GuardType): THREE.Vector3[] {
    if (type === 'sentinel') return [];
    const pts: THREE.Vector3[] = [];
    const count = type === 'heavy' ? 2 : 4;
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2;
      const r = type === 'heavy' ? 6 : 10;
      pts.push(new THREE.Vector3(
        origin.x + Math.cos(angle) * r,
        origin.y,
        origin.z + Math.sin(angle) * r,
      ));
    }
    return pts;
  }

  getGuardsInRange(pos: THREE.Vector3, range: number): Guard[] {
    return this.guards.filter(g => !g.neutralized && g.mesh.position.distanceTo(pos) <= range);
  }
}
