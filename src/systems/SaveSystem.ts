const SAVE_KEY = 'veil_of_city_save';

export interface SaveData {
  settings: {
    volumeMaster: number;
    volumeMusic: number;
    volumeSFX: number;
    quality: number;
    mouseSensitivity: number;
  };
  bestTime?: number;
  bestGrade?: string;
}

const DEFAULT_SAVE: SaveData = {
  settings: {
    volumeMaster: 0.8,
    volumeMusic: 0.5,
    volumeSFX: 0.8,
    quality: 2,
    mouseSensitivity: 0.002,
  },
};

export class SaveSystem {
  private data: SaveData;

  constructor() {
    this.data = this.load();
  }

  private load(): SaveData {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (raw) return { ...DEFAULT_SAVE, ...JSON.parse(raw) };
    } catch (_) {}
    return { ...DEFAULT_SAVE };
  }

  save(): void {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(this.data));
    } catch (_) {}
  }

  getSettings() { return this.data.settings; }

  updateSettings(partial: Partial<SaveData['settings']>): void {
    Object.assign(this.data.settings, partial);
    this.save();
  }

  recordRun(time: number, grade: string): void {
    if (!this.data.bestTime || time < this.data.bestTime) {
      this.data.bestTime = time;
      this.data.bestGrade = grade;
      this.save();
    }
  }

  getBestTime() { return this.data.bestTime; }
  getBestGrade() { return this.data.bestGrade; }
}
