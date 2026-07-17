import { eventBus } from '../game/EventBus';
import type { SaveSystem } from '../systems/SaveSystem';

export class PauseMenu {
  private root: HTMLElement;

  constructor(private container: HTMLElement, private save: SaveSystem) {
    this.root = document.createElement('div');
    this.root.className = 'screen pause-overlay pointer-events';
    this.root.id = 'pause-menu';
    // Cach\u00e9 par d\u00e9faut via style (pas via classe CSS .hidden qui n'\u00e9tait pas d\u00e9finie)
    this.root.style.display = 'none';
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
        <span class="settings-label">Volume g\u00e9n\u00e9ral</span>
        <input type="range" id="p-vol-master" min="0" max="1" step="0.05" value="${s.volumeMaster}">
        <span class="settings-label">Musique</span>
        <input type="range" id="p-vol-music" min="0" max="1" step="0.05" value="${s.volumeMusic}">
        <span class="settings-label">Effets</span>
        <input type="range" id="p-vol-sfx" min="0" max="1" step="0.05" value="${s.volumeSFX}">
      </div>
      <div style="font-size:11px;letter-spacing:2px;color:#7a6a4a;text-transform:uppercase;margin-bottom:12px;">Contr\u00f4les</div>
      <div style="font-size:11px;color:#9a8b6a;line-height:2;letter-spacing:1px;text-align:left;">
        ZQSD / WASD \u2014 D\u00e9placer &nbsp;&bull;&nbsp; Souris \u2014 Cam\u00e9ra<br>
        Espace \u2014 Saut/Grimper &nbsp;&bull;&nbsp; Shift \u2014 Sprint<br>
        Ctrl \u2014 Accroupir &nbsp;&bull;&nbsp; E \u2014 Interagir<br>
        F \u2014 \u00c9lim. silencieuse &nbsp;&bull;&nbsp; R \u2014 Lecture des \u00c9chos<br>
        Clic G \u2014 Attaquer &nbsp;&bull;&nbsp; Clic D \u2014 Bloquer<br>
        F3 \u2014 Debug &nbsp;&bull;&nbsp; \u00c9chap \u2014 Pause
      </div>
      <div class="menu-divider"></div>
      <button class="menu-btn" id="btn-main-menu">\u21a9 MENU PRINCIPAL</button>
    `;

    // BUG FIX : \u00e9v\u00e9nements align\u00e9s avec ceux \u00e9cout\u00e9s dans Game.ts
    this.root.querySelector('#btn-resume')!.addEventListener('click',    () => eventBus.emit('resumeGame'));
    this.root.querySelector('#btn-restart')!.addEventListener('click',   () => eventBus.emit('restartGame'));
    this.root.querySelector('#btn-main-menu')!.addEventListener('click', () => eventBus.emit('showTitle'));

    const onChange = () => {
      const vm   = parseFloat((this.root.querySelector('#p-vol-master') as HTMLInputElement).value);
      const vmu  = parseFloat((this.root.querySelector('#p-vol-music')  as HTMLInputElement).value);
      const vsfx = parseFloat((this.root.querySelector('#p-vol-sfx')    as HTMLInputElement).value);
      this.save.updateSettings({ volumeMaster: vm, volumeMusic: vmu, volumeSFX: vsfx });
      eventBus.emit('settingsChanged', this.save.getSettings());
    };
    ['#p-vol-master','#p-vol-music','#p-vol-sfx'].forEach(id => {
      (this.root.querySelector(id) as HTMLInputElement).addEventListener('input', onChange);
    });
  }

  show(): void {
    this.root.style.display = 'flex';
    this.root.style.flexDirection = 'column';
    this.root.style.alignItems = 'center';
    this.root.style.justifyContent = 'center';
  }
  hide(): void { this.root.style.display = 'none'; }
  destroy(): void { this.root.remove(); }
}
