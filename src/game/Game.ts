import * as THREE from 'three';
import { LEVELS, OBJECTS, STORY } from '../data/loader';
import {
  STAGE_ORDER,
  type GameState,
  type StageId,
} from '../utils/constants';
import { AbsorptionSystem } from './AbsorptionSystem';
import { AudioManager } from './AudioManager';
import { CameraController } from './CameraController';
import { DustDevil } from './DustDevil';
import { InputManager } from './InputManager';
import { ParticleSwirl } from './ParticleSwirl';
import { SceneManager } from './SceneManager';
import { SpatialGrid } from './SpatialGrid';
import { StageManager } from './StageManager';
import { StoryManager } from './StoryManager';
import { HUD } from '../ui/HUD';
import { ThoughtBubble } from '../ui/ThoughtBubble';
import { UIManager } from '../ui/UIManager';
import { modelLoader } from './ModelLoader';
import { collectModelIds } from './PropFactory';
import { groundTextureLoader } from './GroundTextureLoader';

export class Game {
  private sceneManager: SceneManager;
  private cameraController: CameraController;
  private input: InputManager;
  private player: DustDevil;
  private grid: SpatialGrid;
  private absorption: AbsorptionSystem;
  private stageManager: StageManager;
  private particles: ParticleSwirl;
  private audio: AudioManager;
  private story: StoryManager;
  private ui: UIManager;
  private hud: HUD;
  private bubble: ThoughtBubble;

  private state: GameState = 'title';
  private stageIndex = 0;
  private elapsedSec = 0;
  private firstPickup = false;
  private exitOpened = false;
  private boostAnnounced = false;
  private shakeIntensity = 0;
  private clock = new THREE.Clock();
  private rafId = 0;
  private pauseInputForStory = false;

  constructor(container: HTMLElement) {
    this.sceneManager = new SceneManager(container);
    this.cameraController = new CameraController(
      container.clientWidth / container.clientHeight
    );
    this.input = new InputManager();
    this.player = new DustDevil();
    this.grid = new SpatialGrid();
    this.absorption = new AbsorptionSystem(this.grid, this.sceneManager.scene);
    this.stageManager = new StageManager(this.sceneManager.scene, this.grid);
    this.particles = new ParticleSwirl(this.sceneManager.scene);
    this.audio = new AudioManager();
    this.ui = new UIManager(container);
    this.hud = new HUD(container);
    this.bubble = new ThoughtBubble(container);

    this.story = new StoryManager(
      STORY,
      (text, pauseInput) => {
        this.pauseInputForStory = pauseInput;
        this.input.enabled = !pauseInput;
        this.audio.playUiPop();
        this.bubble.show(text, () => {
          this.story.onBubbleDismissed();
          if (!this.story.isShowing()) {
            this.pauseInputForStory = false;
            this.input.enabled = true;
          }
        });
      },
      () => {
        /* story beat queue advanced */
      }
    );

    this.sceneManager.scene.add(this.player.group);
    this.audio.init();

    window.addEventListener('click', () => {
      this.audio.resume();
      if (this.bubble.isVisible()) {
        if (this.bubble.isTyping()) this.bubble.skip();
        else this.bubble.dismiss();
      }
    });

    this.ui.showTitle(
      () => void this.beginGame(),
      () => this.audio.toggleMute()
    );

    this.loop();
  }

  private async beginGame(): Promise<void> {
    await Promise.all([
      modelLoader.preloadAll(collectModelIds(OBJECTS)),
      groundTextureLoader.preloadAll(),
    ]);
    this.startGame();
  }

  private startGame(): void {
    this.stageIndex = 0;
    void this.startStage(STAGE_ORDER[0]);
  }

  private async startStage(stageId: StageId): Promise<void> {
    const level = LEVELS[stageId];
    this.state = 'stage_intro';
    this.elapsedSec = 0;
    this.firstPickup = false;
    this.exitOpened = false;
    this.boostAnnounced = false;
    this.absorption.clear();
    this.stageManager.clear();

    await this.stageManager.loadAsync(level, OBJECTS, stageId);
    this.player.reset(
      level.playerStart.x,
      level.playerStart.z,
      level.minSizeClass,
      level.growthFactor
    );
    this.player.setBounds(level.width / 2 - 2, level.depth / 2 - 2);
    this.cameraController.repositionImmediate(this.player.position);
    this.cameraController.setPlayerRadius(this.player.radius);

    this.input.boostEnabled = level.enableBoost ?? false;
    this.story.setStage(stageId);
    this.story.resetStage();

    this.ui.showStageIntro(stageId, () => {
      this.state = 'playing';
      this.hud.show();
      this.hud.setHint('WASD to swirl · Absorb things smaller than you');
      this.audio.startMusic(stageId, this.stageIndex);
      this.story.fire({ type: 'stage_start' });

      if (level.enableBoost && !this.boostAnnounced) {
        setTimeout(() => {
          this.boostAnnounced = true;
          this.story.fire({ type: 'boost_unlock' });
        }, 8000);
      }
    });
  }

  private onAbsorb(prop: { type: string; mass: number; setPiece: boolean }): void {
    this.audio.playAbsorb(prop.mass);
    this.particles.spawnPuff(this.sceneManager.scene, this.player.position.clone());
    this.hud.flashAbsorb(prop.mass);
    this.shakeIntensity = 0.15;

    if (!this.firstPickup) {
      this.firstPickup = true;
      this.story.fire({ type: 'first_pickup' });
    }
    this.story.fire({ type: 'mass', value: this.player.mass });
    this.story.fire({ type: 'object_type', value: prop.type });

    const level = this.stageManager.level!;
    if (!this.exitOpened && this.player.mass >= level.targetMass) {
      if (level.winProp) {
        this.exitOpened = true;
        this.story.fire({ type: 'exit_opens' });
      } else {
        this.exitOpened = true;
        this.stageManager.openExit();
        this.audio.playExitOpen();
        this.story.fire({ type: 'exit_opens' });
      }
    }

    if (this.stageManager.checkWinProp(prop.type)) {
      this.story.fire({ type: 'win' });
      this.cameraController.pullBack(25);
      setTimeout(() => this.finishGame(), 3500);
    }
  }

  private finishGame(): void {
    this.state = 'credits';
    this.hud.hide();
    this.audio.stopMusic();
    this.ui.showCredits(STORY.ending, () => {
      this.stageManager.clear();
      this.ui.showTitle(
        () => void this.beginGame(),
        () => this.audio.toggleMute()
      );
      this.state = 'title';
    });
  }

  private completeStage(): void {
    this.state = 'stage_complete';
    this.hud.hide();
    this.audio.stopMusic();
    const level = this.stageManager.level!;
    this.ui.showStageComplete(level, this.player.mass, this.elapsedSec, () => {
      this.stageIndex++;
      if (this.stageIndex >= STAGE_ORDER.length) {
        this.finishGame();
        return;
      }
      void this.startStage(STAGE_ORDER[this.stageIndex]);
    });
  }

  private handleBubbleDismiss(): void {
    if (!this.bubble.isVisible()) return;
    if (this.input.consumeDismiss()) {
      if (this.bubble.isTyping()) this.bubble.skip();
      else this.bubble.dismiss();
    }
  }

  private updatePlaying(dt: number): void {
    this.handleBubbleDismiss();

    if (!this.pauseInputForStory && !this.bubble.isVisible()) {
      this.player.update(this.input, dt);
    }

    if (this.player.moveSpeed > 3) {
      const move = this.input.getMovementVector();
      this.particles.spawnTrail(this.player.position, move.x, move.z);
    }

    this.absorption.update(this.player, this.stageManager.props, dt, {
      onAbsorb: (prop) => this.onAbsorb(prop),
      onBounce: () => {},
    });

    this.particles.syncOrbiters(
      [...this.absorption.orbitingProps],
      this.player.position,
      this.player.radius
    );

    this.cameraController.setPlayerRadius(this.player.radius);
    this.cameraController.follow(
      this.player.position,
      dt,
      this.sceneManager.width / this.sceneManager.height
    );

    if (this.shakeIntensity > 0) {
      this.cameraController.camera.position.x += (Math.random() - 0.5) * this.shakeIntensity;
      this.cameraController.camera.position.z += (Math.random() - 0.5) * this.shakeIntensity;
      this.shakeIntensity *= 0.85;
    }

    this.elapsedSec += dt;
    const level = this.stageManager.level;
    if (level) {
      this.hud.update(this.player.mass, level, this.elapsedSec, this.stageManager.exitOpen);
    }

    if (this.stageManager.checkExitCollision(this.player.position, this.player.radius)) {
      this.completeStage();
    }
  }

  private loop = (): void => {
    this.rafId = requestAnimationFrame(this.loop);
    const dt = Math.min(this.clock.getDelta(), 0.05);

    if (this.state === 'playing') {
      this.updatePlaying(dt);
    }

    this.sceneManager.render(this.cameraController.camera);
  };

  dispose(): void {
    cancelAnimationFrame(this.rafId);
    this.player.vortex.dispose();
    this.particles.dispose();
    this.sceneManager.dispose();
  }
}
