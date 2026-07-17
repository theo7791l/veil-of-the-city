import * as THREE from 'three';
import { GameState } from '../game/GameState';
import { Player } from '../entities/Player';
import { AISystem } from './AISystem';
import { Guard, GuardAIState } from '../entities/Guard';
import { eventBus } from '../game/EventBus';

export class StealthSystem {
  private visibilityLevel = 0; // 0-1

  constructor(
    private state: GameState,
    private aiSystem: AISystem,
  ) {
    eventBus.on('stealthKillAttempt', ({ position }: { position: THREE.Vector3 }) => {
      this.tryStealthKill(position);
    });
  }

  update(dt: number, player: Player): void {
    // Compute player visibility
    const isCrouch = player.isInCrouch();
    const isSprinting = player.isSprinting();
    const isMoving = player.isMoving();

    let vis = 0.1; // base
    if (isSprinting) vis = 1.0;
    else if (isMoving) vis = isCrouch ? 0.3 : 0.6;
    else if (isCrouch) vis = 0.15;

    this.visibilityLevel = vis;
  }

  private tryStealthKill(playerPos: THREE.Vector3): void {
    const range = 1.8;
    for (const guard of this.aiSystem.guards) {
      if (guard.neutralized) continue;
      const dist = guard.mesh.position.distanceTo(playerPos);
      if (dist > range) continue;
      // Must be behind (not looking at player)
      const visible = guard.canSeePoint(playerPos);
      if (!visible) {
        guard.neutralize();
        this.state.data.guardsNeutralized++;
        eventBus.emit('stealthKillSuccess');
        return;
      }
    }
    eventBus.emit('stealthKillFailed');
  }

  getVisibilityLevel(): number { return this.visibilityLevel; }
}
