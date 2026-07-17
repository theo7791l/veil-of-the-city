import * as THREE from 'three';
import { eventBus } from '../game/EventBus';

export interface Interactable {
  id: string;
  mesh: THREE.Object3D;
  radius: number;
  label: string;
  onInteract: () => void;
  oneShot?: boolean;
  used?: boolean;
}

export class InteractionSystem {
  private items: Interactable[] = [];
  nearestItem: Interactable | null = null;

  register(item: Interactable): void {
    this.items.push(item);
  }

  unregister(id: string): void {
    this.items = this.items.filter(i => i.id !== id);
  }

  update(playerPos: THREE.Vector3): void {
    let best: Interactable | null = null;
    let bestDist = Infinity;
    for (const item of this.items) {
      if (item.used) continue;
      const d = item.mesh.position.distanceTo(playerPos);
      if (d < item.radius && d < bestDist) {
        bestDist = d;
        best = item;
      }
    }
    if (best !== this.nearestItem) {
      this.nearestItem = best;
      eventBus.emit('interaction:nearest_changed', best);
    }
  }

  triggerInteract(): void {
    if (this.nearestItem && !this.nearestItem.used) {
      this.nearestItem.onInteract();
      if (this.nearestItem.oneShot) {
        this.nearestItem.used = true;
        this.nearestItem = null;
        eventBus.emit('interaction:nearest_changed', null);
      }
    }
  }

  clear(): void {
    this.items = [];
    this.nearestItem = null;
  }
}
