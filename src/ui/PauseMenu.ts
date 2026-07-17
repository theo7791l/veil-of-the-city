import { eventBus } from '../game/EventBus';
import type { SaveSystem } from '../systems/SaveSystem';

export class PauseMenu {
  private root: HTMLElement;

  constructor(private container: HTMLElement, private save: SaveSystem) {
    this.root = document.createElement('div');
    this.root.className = 'screen pause-overlay pointer-events hidden';
    this.root.id = 'pause-menu';
    this.container.appendChild(this.root);
    this._build();
  }

  private _build(): void {
    const s = this.save.getSettings();
    this.root.innerHTML = `
      <div class="menu-title" style="margin-bottom:30px;">PAUSE</div>
      <button class="menu-btn primary" id="btn-resume">REPRENDRE</button>
      <button class="menu-btn" id="btn-restart">RECOMMENCER LA MISSION</button>
      <div class="menu-divider"></div>
      <div class="settings-grid" style="margin-bottom:20px;">
        <span class="settings-label">Volume général</span>
        <input type="range" id="p-vol-master" min="0" max="1" step="0.05" value="${s.volumeMaster}">
        <span class="settings-label">Musique</span>
        <input type="range" id="p-vol-music" min="0" max="1" step="0.05" value="${s.volumeMusic}">
        <span class="settings-label">Effets</span>
        <input type="range" id="p-vol-sfx" min="0" max="1" step="0.05" value="${s.volumeSFX}">
      </div>
      <div style="font-size:11px;letter-spacing:2px;color:#7a6a4a;text-transform:uppercase;margin-bottom:12px;">Contrôles</div>
      <div style="font-size:11px;color:#9a8b6a;line-height:2;letter-spacing:1px;text-align:left;">
        ZQSD / WASD &mdash; Déplacer &nbsp;&bull;&nbsp; Souris &mdash; Caméra<br>
        Espace &mdash; Saut/Grimper &nbsp;&bull;&nbsp; Shift &mdash; Sprint<br>
        Ctrl &mdash; Accroupir &nbsp;&bull;&nbsp; E &mdash; Interagir<br>
        F &mdash; Élim. silencieuse &nbsp;&bull;&nbsp; R &mdash; Lecture des Échos<br>
        Clic G &mdash; Attaquer &nbsp;&bull;&nbsp; Clic D &mdash; Bloquer<br>
        F3 &mdash; Debug &nbsp;&bull;&nbsp; Échap &mdash; Pause
      </div>
      <div class="menu-divider"></div>
      <button class="menu-btn" id="btn-main-menu">↩ MENU PRINCIPAL</button>
    `;

    this.root.querySelector('#btn-resume')!.addEventListener('click', () => eventBus.emit('pause:resume'));
    this.root.querySelector('#btn-restart')!.addEventListener('click', () => eventBus.emit('pause:restart'));
    this.root.querySelector('#btn-main-menu')!.addEventListener('click', () => eventBus.emit('pause:main_menu'));

    const onChange = () => {
      const vm = parseFloat((this.root.querySelector('#p-vol-master') as HTMLInputElement).value);
      const vmu = parseFloat((this.root.querySelector('#p-vol-music') as HTMLInputElement).value);
      const vsfx = parseFloat((this.root.querySelector('#p-vol-sfx') as HTMLInputElement).value);
      this.save.updateSettings({ volumeMaster: vm, volumeMusic: vmu, volumeSFX: vsfx });
      eventBus.emit('settings:changed', this.save.getSettings());
    };
    ['#p-vol-master','#p-vol-music','#p-vol-sfx'].forEach(id => {
      (this.root.querySelector(id) as HTMLInputElement).addEventListener('input', onChange);
    });
  }

  show(): void { this.root.classList.remove('hidden'); }
  hide(): void { this.root.classList.add('hidden'); }
  destroy(): void { this.root.remove(); }
}
