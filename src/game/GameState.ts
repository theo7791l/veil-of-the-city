export type GameScreen = 'title' | 'playing' | 'paused' | 'end';

export interface GameStateData {
  screen: GameScreen;
  missionStep: number;
  alertLevel: number;       // 0-3: calm, suspicious, alerted, alarm
  guardsNeutralized: number;
  maxAlertReached: number;
  missionStartTime: number;
  echoEnergy: number;       // 0-1
  playerHealth: number;     // 0-1
  isEchoActive: boolean;
  debugMode: boolean;
  qualityLevel: number;     // 0=low 1=medium 2=high
}

export class GameState {
  data: GameStateData = {
    screen: 'title',
    missionStep: 0,
    alertLevel: 0,
    guardsNeutralized: 0,
    maxAlertReached: 0,
    missionStartTime: 0,
    echoEnergy: 1,
    playerHealth: 1,
    isEchoActive: false,
    debugMode: false,
    qualityLevel: 2,
  };

  startMission(): void {
    this.data.missionStep = 1;
    this.data.alertLevel = 0;
    this.data.guardsNeutralized = 0;
    this.data.maxAlertReached = 0;
    this.data.missionStartTime = performance.now();
    this.data.echoEnergy = 1;
    this.data.playerHealth = 1;
    this.data.isEchoActive = false;
  }

  setAlertLevel(level: number): void {
    this.data.alertLevel = Math.max(0, Math.min(3, level));
    if (this.data.alertLevel > this.data.maxAlertReached) {
      this.data.maxAlertReached = this.data.alertLevel;
    }
  }

  getMissionElapsed(): number {
    return (performance.now() - this.data.missionStartTime) / 1000;
  }
}
