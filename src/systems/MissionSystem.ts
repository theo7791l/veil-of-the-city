import { eventBus } from '../game/EventBus';
import type { GameState } from '../game/GameState';

export interface MissionStep {
  id: number;
  label: string;
  description: string;
  completed: boolean;
  triggerRadius?: number;
  triggerPos?: { x: number; y: number; z: number };
}

export class MissionSystem {
  steps: MissionStep[] = [
    {
      id: 1,
      label: 'Atteindre le point d\'observation',
      description: 'Rejoignez le sommet de la Tour des Murmures.',
      completed: false,
      triggerRadius: 4,
      triggerPos: { x: 12, y: 22, z: -18 },
    },
    {
      id: 2,
      label: 'Observer la réunion secrète',
      description: 'Observez la scène depuis le sommet.',
      completed: false,
      triggerRadius: 5,
      triggerPos: { x: 12, y: 22, z: -18 },
    },
    {
      id: 3,
      label: 'Infiltrer la résidence fortifiée',
      description: 'Entrez discrètement dans la résidence de l\'Ordre.',
      completed: false,
      triggerRadius: 5,
      triggerPos: { x: -20, y: 2, z: -35 },
    },
    {
      id: 4,
      label: 'Voler le registre codé',
      description: 'Récupérez le registre dans la salle de réunion.',
      completed: false,
      triggerRadius: 2,
      triggerPos: { x: -22, y: 4, z: -40 },
    },
    {
      id: 5,
      label: 'Rejoindre le point d\'extraction',
      description: 'Fuyez vers les quais sans déclencher l\'alarme.',
      completed: false,
      triggerRadius: 6,
      triggerPos: { x: 30, y: 1, z: 40 },
    },
  ];

  private observeTimer = 0;
  private observing = false;

  constructor(private state: GameState) {}

  get currentStep(): MissionStep | null {
    return this.steps.find(s => !s.completed) || null;
  }

  get currentStepIndex(): number {
    return this.steps.findIndex(s => !s.completed);
  }

  update(dt: number, playerPos: { x: number; y: number; z: number }): void {
    const step = this.currentStep;
    if (!step) return;

    if (step.triggerPos) {
      const dx = playerPos.x - step.triggerPos.x;
      const dy = playerPos.y - step.triggerPos.y;
      const dz = playerPos.z - step.triggerPos.z;
      const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
      const radius = step.triggerRadius ?? 3;

      if (dist < radius) {
        // Step 2 needs observation time
        if (step.id === 2) {
          if (!this.observing) {
            this.observing = true;
            eventBus.emit('mission:observe_start');
          }
          this.observeTimer += dt;
          if (this.observeTimer >= 5) {
            this._completeStep(step);
            this.observing = false;
          }
        } else {
          this._completeStep(step);
        }
      } else {
        this.observing = false;
      }
    }
  }

  triggerInteract(playerPos: { x: number; y: number; z: number }): void {
    const step = this.currentStep;
    if (!step) return;
    if (step.id === 4) {
      if (step.triggerPos) {
        const dx = playerPos.x - step.triggerPos.x;
        const dz = playerPos.z - step.triggerPos.z;
        if (Math.sqrt(dx * dx + dz * dz) < 4) {
          this._completeStep(step);
        }
      }
    }
  }

  private _completeStep(step: MissionStep): void {
    step.completed = true;
    this.state.data.missionStep = step.id + 1;
    eventBus.emit('mission:step_complete', step.id);
    const next = this.currentStep;
    if (!next) {
      eventBus.emit('mission:complete');
    } else {
      eventBus.emit('mission:new_objective', next.label);
    }
  }

  getObserveProgress(): number {
    return this.observing ? Math.min(this.observeTimer / 5, 1) : 0;
  }

  isComplete(): boolean {
    return this.steps.every(s => s.completed);
  }

  reset(): void {
    this.steps.forEach(s => (s.completed = false));
    this.observeTimer = 0;
    this.observing = false;
  }
}
