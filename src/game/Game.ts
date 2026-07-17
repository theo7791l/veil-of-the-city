import * as THREE from 'three';
import { GameState, GameScreen } from './GameState';
import { eventBus } from './EventBus';
import { SaveSystem } from '../systems/SaveSystem';
import { ProceduralAudio } from '../assets/ProceduralAudio';
import { CityBuilder } from '../world/CityBuilder';
import { CollisionWorld } from '../world/CollisionWorld';
import { Lighting } from '../world/Lighting';
import { Player } from '../entities/Player';
import { AISystem } from '../systems/AISystem';
import { MissionSystem } from '../systems/MissionSystem';
import { HUD } from '../ui/HUD';
import { Menu } from '../ui/Menu';
import { PauseMenu } from '../ui/PauseMenu';
import { MissionUI } from '../ui/MissionUI';

// ─── Performance adaptive thresholds ────────────────────────────────────────
const PERF_SAMPLE_FRAMES = 60;
const PERF_LOW_FPS = 35;

export class Game {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  state: GameState;
  saveSystem: SaveSystem;
  audio: ProceduralAudio;

  cityBuilder!: CityBuilder;
  collisionWorld!: CollisionWorld;
  lighting!: Lighting;
  player!: Player;
  aiSystem!: AISystem;
  missionSystem!: MissionSystem;

  hud!: HUD;
  menu!: Menu;
  pauseMenu!: PauseMenu;
  missionUI!: MissionUI;

  private lastTime = 0;
  private running = false;
  private frameCount = 0;
  private fpsAccum = 0;
  private rafId = 0;

  constructor(private canvas: HTMLCanvasElement, private uiOverlay: HTMLDivElement) {
    this.state = new GameState();
    this.saveSystem = new SaveSystem();
    this.audio = new ProceduralAudio(this.saveSystem.getSettings());

    // Renderer
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      powerPreference: 'high-performance',
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.1;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    // Scene
    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.FogExp2(0xc8a97a, 0.012);
    this.scene.background = new THREE.Color(0xd4956a);

    // Camera
    this.camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 300);
    this.camera.position.set(0, 10, 0);

    window.addEventListener('resize', this.onResize);
    eventBus.on('startGame', () => this.startGame());
    eventBus.on('restartGame', () => this.restartGame());
    eventBus.on('resumeGame', () => this.resumeGame());
    eventBus.on('pauseGame', () => this.pauseGame());
    eventBus.on('showTitle', () => this.showTitle());
    eventBus.on('settingsChanged', (s) => {
      this.saveSystem.updateSettings(s);
      this.audio.applySettings(this.saveSystem.getSettings());
    });
  }

  async start(): Promise<void> {
    this.buildWorld();
    this.buildUI();
    this.showTitle();
    this.running = true;
    this.lastTime = performance.now();
    this.loop(this.lastTime);
  }

  private buildWorld(): void {
    this.collisionWorld = new CollisionWorld();
    this.lighting = new Lighting(this.scene);
    this.cityBuilder = new CityBuilder(this.scene, this.collisionWorld);
    this.cityBuilder.build();
    this.lighting.build();

    this.player = new Player(this.scene, this.camera, this.collisionWorld, this.audio, this.state, this.saveSystem);
    this.aiSystem = new AISystem(this.scene, this.collisionWorld, this.state, this.audio);
    this.aiSystem.spawnGuards(this.cityBuilder.getGuardSpawns());
    this.aiSystem.spawnCivilians(this.cityBuilder.getCivilianSpawns());
    this.missionSystem = new MissionSystem(this.state, this.aiSystem, this.player, this.cityBuilder);
  }

  private buildUI(): void {
    this.hud = new HUD(this.uiOverlay, this.state);
    this.menu = new Menu(this.uiOverlay, this.saveSystem);
    this.pauseMenu = new PauseMenu(this.uiOverlay, this.saveSystem);
    this.missionUI = new MissionUI(this.uiOverlay);
  }

  private showTitle(): void {
    this.state.data.screen = 'title';
    this.menu.show();
    this.hud.hide();
    this.pauseMenu.hide();
    this.audio.playAmbience();
    this.player.disable();
  }

  private startGame(): void {
    this.state.data.screen = 'playing';
    this.state.startMission();
    this.menu.hide();
    this.hud.show();
    this.pauseMenu.hide();
    this.player.reset();
    this.aiSystem.reset();
    this.missionSystem.reset();
    this.player.enable();
    this.audio.playGameAmbience();
    this.missionUI.showObjective('Rejoindre le point d’observation sur les toits');
  }

  private restartGame(): void {
    this.startGame();
  }

  private pauseGame(): void {
    if (this.state.data.screen !== 'playing') return;
    this.state.data.screen = 'paused';
    this.pauseMenu.show();
    this.player.disable();
  }

  private resumeGame(): void {
    if (this.state.data.screen !== 'paused') return;
    this.state.data.screen = 'playing';
    this.pauseMenu.hide();
    this.player.enable();
  }

  private loop = (time: number): void => {
    this.rafId = requestAnimationFrame(this.loop);
    const raw = (time - this.lastTime) / 1000;
    this.lastTime = time;
    const dt = Math.min(raw, 0.05); // clamp to 50ms

    // FPS tracking
    this.fpsAccum += 1 / dt;
    this.frameCount++;
    if (this.frameCount >= PERF_SAMPLE_FRAMES) {
      const avgFps = this.fpsAccum / this.frameCount;
      this.fpsAccum = 0;
      this.frameCount = 0;
      if (avgFps < PERF_LOW_FPS && this.state.data.qualityLevel > 0) {
        this.state.data.qualityLevel--;
        this.applyQuality();
      }
    }

    if (this.state.data.screen === 'playing') {
      this.player.update(dt);
      this.aiSystem.update(dt, this.player);
      this.missionSystem.update(dt);
      this.hud.update(dt);
    }

    this.renderer.render(this.scene, this.camera);

    if (this.state.data.debugMode) {
      this.hud.updateDebug({
        fps: Math.round(1 / dt),
        pos: this.player.mesh.position,
        screen: this.state.data.screen,
        alert: this.state.data.alertLevel,
        step: this.state.data.missionStep,
      });
    }
  };

  private applyQuality(): void {
    const q = this.state.data.qualityLevel;
    this.renderer.setPixelRatio(q === 0 ? 1 : Math.min(window.devicePixelRatio, q === 1 ? 1.5 : 2));
    this.scene.fog = new THREE.FogExp2(0xc8a97a, q === 0 ? 0.025 : q === 1 ? 0.018 : 0.012);
    this.cityBuilder.setLOD(q);
  }

  private onResize = (): void => {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  };
}
