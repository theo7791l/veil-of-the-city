import * as THREE from 'three';
import { Player } from '../entities/Player';
import { AISystem } from './AISystem';
import { Guard } from '../entities/Guard';
import { eventBus } from '../game/EventBus';
import { ProceduralAudio } from '../assets/ProceduralAudio';

export class CombatSystem {
  constructor(
    private player: Player,
    private aiSystem: AISystem,
    private audio: ProceduralAudio,
  ) {
    eventBus.on('playerAttack', ({ position, range }: { position: THREE.Vector3; range: number }) => {
      this.processPlayerAttack(position, range);
    });
    eventBus.on('guardAttack', ({ guard, damage }: { guard: Guard; damage: number }) => {
      if (!this.player.isBlocking2()) {
        this.player.takeDamage(damage);
      } else {
        this.audio.playSFX('hit', 0.3);
      }
    });
  }

  private processPlayerAttack(pos: THREE.Vector3, range: number): void {
    const nearby = this.aiSystem.getGuardsInRange(pos, range);
    nearby.forEach(g => {
      g.takeDamage(25);
    });
  }
}
