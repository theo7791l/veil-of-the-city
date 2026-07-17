import { eventBus } from '../game/EventBus';
import type { GameState } from '../game/GameState';
import type { SaveSystem } from '../systems/SaveSystem';

export class MissionUI {
  private root: HTMLElement;

  constructor(private container: HTMLElement, private state: GameState, private save: SaveSystem) {
    this.root = document.createElement('div');
    this.root.className = 'screen menu-bg pointer-events hidden';
    this.root.id = 'end-screen';
    this.container.appendChild(this.root);
  }

  showEnd(
    time: number,
    maxAlert: number,
    guards: number,
    stealth: boolean
  ): void {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60).toString().padStart(2, '0');
    const alertLabels = ['Fantôme', 'Discret', 'Repéré', 'Alarme'];
    const alertLabel = alertLabels[maxAlert] || 'Inconnu';
    const grade = this._calcGrade(time, maxAlert, guards, stealth);

    this.save.recordRun(time, grade);

    const best = this.save.getBestTime();
    const bestStr = best
      ? `${Math.floor(best / 60)}:${Math.floor(best % 60).toString().padStart(2, '0')}`
      : '--:--';

    this.root.innerHTML = `
      <div style="text-align:center;">
        <div style="font-size:11px;letter-spacing:4px;color:#7a6a4a;text-transform:uppercase;margin-bottom:12px;">Mission accomplie</div>
        <div class="title-logo" style="font-size:36px;">REGISTRE VOLÉ</div>
        <div class="menu-divider"></div>
        <div class="grade-display">${grade}</div>
        <div class="end-screen-stats">
          <span class="stat-label">Temps</span><span class="stat-value">${minutes}:${seconds}</span>
          <span class="stat-label">Meilleur temps</span><span class="stat-value">${bestStr}</span>
          <span class="stat-label">Niveau d'alerte max</span><span class="stat-value">${alertLabel}</span>
          <span class="stat-label">Gardes neutralisés</span><span class="stat-value">${guards}</span>
          <span class="stat-label">Bonus discrétion</span><span class="stat-value">${stealth ? 'OUI ⭐' : 'NON'}</span>
        </div>
        <button class="menu-btn primary" id="btn-end-replay">REJOUER</button>
        <button class="menu-btn" id="btn-end-menu">↩ MENU PRINCIPAL</button>
      </div>
    `;
    this.root.classList.remove('hidden');

    this.root.querySelector('#btn-end-replay')!.addEventListener('click', () => {
      this.root.classList.add('hidden');
      eventBus.emit('end:replay');
    });
    this.root.querySelector('#btn-end-menu')!.addEventListener('click', () => {
      this.root.classList.add('hidden');
      eventBus.emit('end:main_menu');
    });
  }

  private _calcGrade(time: number, maxAlert: number, guards: number, stealth: boolean): string {
    let score = 100;
    score -= maxAlert * 18;
    score -= guards * 5;
    if (!stealth) score -= 10;
    if (time < 180) score += 15;
    else if (time < 300) score += 5;
    if (score >= 90) return 'S';
    if (score >= 75) return 'A';
    if (score >= 55) return 'B';
    if (score >= 35) return 'C';
    return 'D';
  }

  hide(): void { this.root.classList.add('hidden'); }
  destroy(): void { this.root.remove(); }
}
