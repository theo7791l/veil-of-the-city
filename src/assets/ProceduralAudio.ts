import type { SaveData } from '../systems/SaveSystem';

export class ProceduralAudio {
  private ctx: AudioContext | null = null;
  private masterGain!: GainNode;
  private musicGain!: GainNode;
  private sfxGain!: GainNode;
  private ambienceNodes: AudioNode[] = [];

  constructor(private settings: SaveData['settings']) {}

  private ensureCtx(): AudioContext {
    if (!this.ctx) {
      this.ctx = new AudioContext();
      this.masterGain = this.ctx.createGain();
      this.musicGain = this.ctx.createGain();
      this.sfxGain = this.ctx.createGain();
      this.musicGain.connect(this.masterGain);
      this.sfxGain.connect(this.masterGain);
      this.masterGain.connect(this.ctx.destination);
      this.masterGain.gain.value = this.settings.volumeMaster;
      this.musicGain.gain.value = this.settings.volumeMusic;
      this.sfxGain.gain.value = this.settings.volumeSFX;
    }
    return this.ctx;
  }

  applySettings(s: SaveData['settings']): void {
    this.settings = s;
    if (this.ctx) {
      this.masterGain.gain.value = s.volumeMaster;
      this.musicGain.gain.value = s.volumeMusic;
      this.sfxGain.gain.value = s.volumeSFX;
    }
  }

  playAmbience(): void {
    const ctx = this.ensureCtx();
    this.stopAmbience();
    // Wind low rumble
    const buf = ctx.createBuffer(1, ctx.sampleRate * 3, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * 0.03;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 180;
    src.connect(lp);
    lp.connect(this.musicGain);
    src.start();
    this.ambienceNodes = [src];
  }

  playGameAmbience(): void {
    const ctx = this.ensureCtx();
    this.stopAmbience();
    // Distant market murmur
    const rate = ctx.sampleRate;
    const buf = ctx.createBuffer(1, rate * 4, rate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * 0.025;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 600;
    bp.Q.value = 0.3;
    const g = ctx.createGain();
    g.gain.value = 0.4;
    src.connect(bp);
    bp.connect(g);
    g.connect(this.musicGain);
    src.start();
    this.ambienceNodes = [src];
  }

  stopAmbience(): void {
    this.ambienceNodes.forEach(n => { try { (n as AudioBufferSourceNode).stop(); } catch (_) {} });
    this.ambienceNodes = [];
  }

  playSFX(type: 'footstep' | 'jump' | 'land' | 'grab' | 'hit' | 'stealth_kill' | 'detect' | 'blade', vol = 1): void {
    const ctx = this.ensureCtx();
    const g = ctx.createGain();
    g.gain.value = vol;
    g.connect(this.sfxGain);

    const osc = ctx.createOscillator();
    const env = ctx.createGain();
    osc.connect(env);
    env.connect(g);
    const now = ctx.currentTime;

    switch (type) {
      case 'footstep': {
        const buf = ctx.createBuffer(1, ctx.sampleRate * 0.05, ctx.sampleRate);
        const d = buf.getChannelData(0);
        for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.exp(-i / (d.length * 0.3));
        const s = ctx.createBufferSource();
        s.buffer = buf;
        s.connect(g);
        s.start();
        return;
      }
      case 'jump':
        osc.type = 'sine';
        osc.frequency.setValueAtTime(220, now);
        osc.frequency.exponentialRampToValueAtTime(110, now + 0.15);
        env.gain.setValueAtTime(0.4, now);
        env.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
        osc.start(now);
        osc.stop(now + 0.2);
        break;
      case 'land':
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(80, now);
        osc.frequency.exponentialRampToValueAtTime(40, now + 0.1);
        env.gain.setValueAtTime(0.5, now);
        env.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
        osc.start(now);
        osc.stop(now + 0.15);
        break;
      case 'grab':
        osc.type = 'sine';
        osc.frequency.setValueAtTime(300, now);
        osc.frequency.exponentialRampToValueAtTime(180, now + 0.1);
        env.gain.setValueAtTime(0.3, now);
        env.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
        osc.start(now);
        osc.stop(now + 0.12);
        break;
      case 'hit':
        osc.type = 'square';
        osc.frequency.setValueAtTime(150, now);
        osc.frequency.exponentialRampToValueAtTime(60, now + 0.08);
        env.gain.setValueAtTime(0.6, now);
        env.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
        osc.start(now);
        osc.stop(now + 0.1);
        break;
      case 'stealth_kill':
        osc.type = 'sine';
        osc.frequency.setValueAtTime(120, now);
        osc.frequency.exponentialRampToValueAtTime(40, now + 0.3);
        env.gain.setValueAtTime(0.25, now);
        env.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
        osc.start(now);
        osc.stop(now + 0.35);
        break;
      case 'detect':
        osc.type = 'sine';
        osc.frequency.setValueAtTime(880, now);
        osc.frequency.exponentialRampToValueAtTime(440, now + 0.3);
        env.gain.setValueAtTime(0.5, now);
        env.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
        osc.start(now);
        osc.stop(now + 0.4);
        break;
      case 'blade':
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(600, now);
        osc.frequency.exponentialRampToValueAtTime(200, now + 0.05);
        env.gain.setValueAtTime(0.35, now);
        env.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
        osc.start(now);
        osc.stop(now + 0.08);
        break;
    }
  }
}
