import { eventBus } from '../game/EventBus';
import type { SaveSystem } from '../systems/SaveSystem';

export class Menu {
  private root: HTMLElement;
  private titleScreen!: HTMLElement;
  private settingsScreen!: HTMLElement;
  private creditsScreen!: HTMLElement;

  constructor(private container: HTMLElement, private save: SaveSystem) {
    this.root = document.createElement('div');
    this.root.className = 'screen menu-bg pointer-events';
    this.root.id = 'main-menu';
    this.container.appendChild(this.root);
    this._build();
  }

  private _build(): void {
    const s = this.save.getSettings();
    this.root.innerHTML = `
      <!-- TITLE SCREEN -->
      <div id="screen-title" style="display:flex;flex-direction:column;align-items:center;">
        <div class="title-logo">VEIL</div>
        <div style="font-size:18px;letter-spacing:8px;color:#7a6a4a;text-transform:uppercase;margin-bottom:4px;">OF THE CITY</div>
        <div class="title-subtitle">Qasr Al-Nour &mdash; Veilleurs du Voile</div>
        <div class="menu-divider"></div>
        <button class="menu-btn primary" id="btn-play">▶&nbsp;&nbsp;JOUER</button>
        <button class="menu-btn" id="btn-settings-title">PARAM\u00c8TRES</button>
        <button class="menu-btn" id="btn-credits">CR\u00c9DITS</button>
        <div style="position:absolute;bottom:20px;font-size:10px;letter-spacing:2px;color:#4a3a2a;">WASD / ZQSD &bull; SOURIS &bull; ESPACE &bull; SHIFT</div>
      </div>

      <!-- SETTINGS SCREEN -->
      <div id="screen-settings" style="display:none;flex-direction:column;align-items:center;text-align:center;">
        <div class="menu-title">PARAM\u00c8TRES</div>
        <div class="settings-grid">
          <span class="settings-label">Volume g\u00e9n\u00e9ral</span>
          <input type="range" id="vol-master" min="0" max="1" step="0.05" value="${s.volumeMaster}">
          <span class="settings-label">Musique</span>
          <input type="range" id="vol-music" min="0" max="1" step="0.05" value="${s.volumeMusic}">
          <span class="settings-label">Effets</span>
          <input type="range" id="vol-sfx" min="0" max="1" step="0.05" value="${s.volumeSFX}">
          <span class="settings-label">Sensibilit\u00e9 souris</span>
          <input type="range" id="sensitivity" min="0.0005" max="0.005" step="0.0001" value="${s.mouseSensitivity}">
          <span class="settings-label">Qualit\u00e9 graphique</span>
          <select id="quality-select">
            <option value="0" ${s.quality === 0 ? 'selected' : ''}>Bas</option>
            <option value="1" ${s.quality === 1 ? 'selected' : ''}>Moyen</option>
            <option value="2" ${s.quality === 2 ? 'selected' : ''}>Haut</option>
          </select>
        </div>
        <button class="menu-btn" id="btn-settings-back">RETOUR</button>
      </div>

      <!-- CREDITS SCREEN -->
      <div id="screen-credits" style="display:none;flex-direction:column;align-items:center;text-align:center;">
        <div class="menu-title">CR\u00c9DITS</div>
        <p style="color:#9a8b6a;font-size:13px;line-height:2;letter-spacing:1px;">
          VEIL OF THE CITY<br>
          Un jeu original &mdash; univers fictif<br>
          Moteur\u202f: Three.js &bull; Vite &bull; TypeScript<br>
          Audio\u202f: Web Audio API (proc\u00e9dural)<br>
          Visuels\u202f: mat\u00e9riaux et g\u00e9om\u00e9tries proc\u00e9duraux<br><br>
          <em style="color:#7a6a4a;font-size:11px;">Aucun asset sous copyright &mdash; 100\u00a0% original</em>
        </p>
        <button class="menu-btn" id="btn-credits-back">RETOUR</button>
      </div>
    `;

    this.titleScreen    = this.root.querySelector('#screen-title')!;
    this.settingsScreen = this.root.querySelector('#screen-settings')!;
    this.creditsScreen  = this.root.querySelector('#screen-credits')!;

    // ─── BUG FIX : émettre 'startGame' (écouté par Game.ts) ─────────────────
    this.root.querySelector('#btn-play')!.addEventListener('click', () => {
      eventBus.emit('startGame');
    });

    this.root.querySelector('#btn-settings-title')!.addEventListener('click', () => {
      this.titleScreen.style.display = 'none';
      this.settingsScreen.style.display = 'flex';
    });
    this.root.querySelector('#btn-credits')!.addEventListener('click', () => {
      this.titleScreen.style.display = 'none';
      this.creditsScreen.style.display = 'flex';
    });
    this.root.querySelector('#btn-settings-back')!.addEventListener('click', () => {
      this.settingsScreen.style.display = 'none';
      this.titleScreen.style.display = 'flex';
    });
    this.root.querySelector('#btn-credits-back')!.addEventListener('click', () => {
      this.creditsScreen.style.display = 'none';
      this.titleScreen.style.display = 'flex';
    });

    const onChange = () => {
      const vm   = parseFloat((this.root.querySelector('#vol-master')    as HTMLInputElement).value);
      const vmu  = parseFloat((this.root.querySelector('#vol-music')     as HTMLInputElement).value);
      const vsfx = parseFloat((this.root.querySelector('#vol-sfx')       as HTMLInputElement).value);
      const sens = parseFloat((this.root.querySelector('#sensitivity')   as HTMLInputElement).value);
      const q    = parseInt(  (this.root.querySelector('#quality-select') as HTMLSelectElement).value);
      this.save.updateSettings({ volumeMaster: vm, volumeMusic: vmu, volumeSFX: vsfx, mouseSensitivity: sens, quality: q });
      eventBus.emit('settingsChanged', this.save.getSettings());
    };
    ['#vol-master','#vol-music','#vol-sfx','#sensitivity'].forEach(id => {
      (this.root.querySelector(id) as HTMLInputElement).addEventListener('input', onChange);
    });
    (this.root.querySelector('#quality-select') as HTMLSelectElement).addEventListener('change', onChange);
  }

  show(): void {
    this.root.style.display = 'flex';
    this.root.style.flexDirection = 'column';
    this.root.style.alignItems = 'center';
    this.titleScreen.style.display = 'flex';
    this.settingsScreen.style.display = 'none';
    this.creditsScreen.style.display = 'none';
  }

  hide(): void { this.root.style.display = 'none'; }
  destroy(): void { this.root.remove(); }
}
