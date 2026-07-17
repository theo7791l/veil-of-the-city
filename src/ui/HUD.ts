import { eventBus } from '../game/EventBus';
import type { GameState } from '../game/GameState';
import type { MissionSystem } from '../systems/MissionSystem';

export class HUD {
  private root: HTMLElement;
  private healthBar: HTMLElement;
  private energyBar: HTMLElement;
  private detectionDot: HTMLElement;
  private detectionLabel: HTMLElement;
  private objectiveText: HTMLElement;
  private contextPrompt: HTMLElement;
  private echoOverlay: HTMLElement;
  private debugPanel: HTMLElement;
  private helpPanel: HTMLElement;
  private notifContainer: HTMLElement;
  private observeBar: HTMLElement;
  private observeWrapper: HTMLElement;

  private helpVisible = true;
  private helpTimeout: ReturnType<typeof setTimeout> | null = null;

  constructor(private container: HTMLElement, private state: GameState, private mission: MissionSystem) {
    this.root = document.createElement('div');
    this.root.className = 'hud-container';
    this.container.appendChild(this.root);
    this._build();
    this._setupEvents();
    if (this.helpTimeout) clearTimeout(this.helpTimeout);
    this.helpTimeout = setTimeout(() => {
      this.helpPanel.style.opacity = '0';
      setTimeout(() => { this.helpPanel.style.display = 'none'; }, 600);
      this.helpVisible = false;
    }, 12000);
  }

  private _build(): void {
    this.root.innerHTML = `
      <div class="crosshair"></div>

      <div class="hud-bottom-left">
        <div class="bar-wrapper">
          <span class="bar-label">VIE</span>
          <div class="bar-bg"><div class="bar-fill health" id="hud-health" style="width:100%"></div></div>
        </div>
        <div class="bar-wrapper">
          <span class="bar-label">ECH</span>
          <div class="bar-bg"><div class="bar-fill energy" id="hud-energy" style="width:100%"></div></div>
        </div>
      </div>

      <div class="hud-top-center">
        <div class="objective-label">Objectif</div>
        <div class="objective-text" id="hud-objective">Rejoindre le point d'observation</div>
        <div id="observe-wrapper" style="display:none;margin-top:6px;">
          <div style="font-size:10px;letter-spacing:2px;color:#9a8b6a;margin-bottom:3px;">OBSERVATION EN COURS...</div>
          <div style="width:180px;height:4px;background:rgba(255,255,255,0.1);border-radius:2px;overflow:hidden;">
            <div id="observe-bar" style="height:100%;width:0%;background:#3498db;border-radius:2px;transition:width 0.1s;"></div>
          </div>
        </div>
      </div>

      <div class="hud-top-right">
        <div class="detection-indicator">
          <div class="detection-dot" id="hud-detect-dot"></div>
          <span id="hud-detect-label" style="font-size:10px;letter-spacing:2px;color:#9a8b6a;">CALME</span>
        </div>
      </div>

      <div class="context-prompt" id="hud-context" style="opacity:0;"></div>

      <div class="echo-overlay" id="echo-overlay"></div>

      <div class="debug-panel" id="debug-panel" style="display:none;"></div>

      <div id="notif-container" style="position:absolute;top:70px;left:50%;transform:translateX(-50%);width:340px;pointer-events:none;"></div>

      <div class="help-panel" id="help-panel">
        <div style="font-size:10px;letter-spacing:3px;color:#7a6a4a;margin-bottom:8px;">CONTRÔLES</div>
        <div class="help-row"><span class="help-key">ZQSD/WASD</span><span>Déplacer</span></div>
        <div class="help-row"><span class="help-key">Espace</span><span>Sauter / Grimper</span></div>
        <div class="help-row"><span class="help-key">Shift</span><span>Sprint</span></div>
        <div class="help-row"><span class="help-key">Ctrl</span><span>Accroupir</span></div>
        <div class="help-row"><span class="help-key">E</span><span>Interagir</span></div>
        <div class="help-row"><span class="help-key">F</span><span>Élim. silencieuse</span></div>
        <div class="help-row"><span class="help-key">R (maintenir)</span><span>Lecture des Échos</span></div>
        <div class="help-row"><span class="help-key">F3</span><span>Mode debug</span></div>
        <div class="help-row"><span class="help-key">Échap</span><span>Pause</span></div>
      </div>
    `;

    this.healthBar = this.root.querySelector('#hud-health')!;
    this.energyBar = this.root.querySelector('#hud-energy')!;
    this.detectionDot = this.root.querySelector('#hud-detect-dot')!;
    this.detectionLabel = this.root.querySelector('#hud-detect-label')!;
    this.objectiveText = this.root.querySelector('#hud-objective')!;
    this.contextPrompt = this.root.querySelector('#hud-context')!;
    this.echoOverlay = this.root.querySelector('#echo-overlay')!;
    this.debugPanel = this.root.querySelector('#debug-panel')!;
    this.helpPanel = this.root.querySelector('#help-panel')!;
    this.notifContainer = this.root.querySelector('#notif-container')!;
    this.observeBar = this.root.querySelector('#observe-bar')!;
    this.observeWrapper = this.root.querySelector('#observe-wrapper')!;
  }

  private _setupEvents(): void {
    eventBus.on('mission:new_objective', (label: string) => {
      this.objectiveText.textContent = label;
      this.notify(`✔ Objectif mis à jour : ${label}`);
    });
    eventBus.on('mission:step_complete', () => {
      this.notify('✔ Objectif accompli !');
    });
    eventBus.on('interaction:nearest_changed', (item: any) => {
      if (item) {
        this.contextPrompt.innerHTML = `<span class="context-key">E</span> : ${item.label}`;
        this.contextPrompt.style.opacity = '1';
      } else {
        this.contextPrompt.style.opacity = '0';
      }
    });
    eventBus.on('player:stealth_action_available', (label: string) => {
      this.contextPrompt.innerHTML = `<span class="context-key">F</span> : ${label}`;
      this.contextPrompt.style.opacity = '1';
    });
    eventBus.on('player:stealth_action_unavailable', () => {
      if (!this.state.data.isEchoActive) this.contextPrompt.style.opacity = '0';
    });
  }

  update(): void {
    const d = this.state.data;
    this.healthBar.style.width = `${d.playerHealth * 100}%`;
    this.energyBar.style.width = `${d.echoEnergy * 100}%`;

    // Detection
    const al = d.alertLevel;
    const labels = ['CALME', 'SUSPICION', 'ALERTÉ', 'ALARME'];
    const classes = ['', 'suspicious', 'detected', 'detected'];
    this.detectionDot.className = 'detection-dot ' + (classes[al] || '');
    this.detectionLabel.textContent = labels[al] || 'CALME';

    // Echo
    if (d.isEchoActive) this.echoOverlay.classList.add('active');
    else this.echoOverlay.classList.remove('active');

    // Observe progress
    const prog = this.mission.getObserveProgress();
    if (prog > 0) {
      this.observeWrapper.style.display = 'block';
      this.observeBar.style.width = `${prog * 100}%`;
    } else {
      this.observeWrapper.style.display = 'none';
    }
  }

  updateDebug(lines: string[]): void {
    if (!this.state.data.debugMode) {
      this.debugPanel.style.display = 'none';
      return;
    }
    this.debugPanel.style.display = 'block';
    this.debugPanel.innerHTML = lines.join('<br>');
  }

  notify(msg: string): void {
    const el = document.createElement('div');
    el.className = 'notification';
    el.textContent = msg;
    this.notifContainer.appendChild(el);
    setTimeout(() => el.remove(), 3200);
  }

  setObjective(text: string): void {
    this.objectiveText.textContent = text;
  }

  show(): void { this.root.style.display = 'block'; }
  hide(): void { this.root.style.display = 'none'; }

  destroy(): void {
    this.root.remove();
  }
}
