import * as THREE from 'three';
import { LEVELS, OBJECTS, STORY } from '../data/loader';
import {
  STAGE_ORDER,
  STAGE_TITLES,
  type GameState,
  type StageId,
} from '../utils/constants';
import { hintsForDevice } from '../utils/device';
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
import { PickupInventory } from './PickupInventory';
import { HUD } from '../ui/HUD';
import { InventoryPanel } from '../ui/InventoryPanel';
import { ThoughtBubble } from '../ui/ThoughtBubble';
import { TouchControls } from '../ui/TouchControls';
import { UIManager } from '../ui/UIManager';
import { modelLoader } from './ModelLoader';
import { collectModelIds } from './PropFactory';
import { groundTextureLoader } from './GroundTextureLoader';
import { DowntownTraffic } from './DowntownTraffic';
import { DesertUfo } from './DesertUfo';
import { publicUrl } from '../utils/publicUrl';

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
  private inventory: PickupInventory;
  private inventoryPanel: InventoryPanel;
  private bubble: ThoughtBubble;
  private touchControls: TouchControls;
  private downtownTraffic: DowntownTraffic;
  private desertUfo: DesertUfo;

  private state: GameState = 'title';
  private stageIndex = 0;
  private elapsedSec = 0;
  private firstPickup = false;
  private exitOpened = false;
  private boostAnnounced = false;
  private shakeIntensity = 0;
  private lastAnimalWindSoundTime = 0;
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
    this.inventory = new PickupInventory();
    this.inventoryPanel = new InventoryPanel(container, (open) => {
      this.syncInputEnabled(!open);
      this.hud.setInventorySignVisible(!open);
      this.touchControls.setEnabled(!open);
    });
    this.bubble = new ThoughtBubble(container);
    this.touchControls = new TouchControls(container, this.input);
    this.downtownTraffic = new DowntownTraffic(this.sceneManager.scene);
    this.desertUfo = new DesertUfo(this.sceneManager.scene);

    this.inventoryPanel.setCloseHint(hintsForDevice().inventoryClose);
    this.bubble.updateHint();

    this.hud.onInventoryTap(() => {
      this.input.requestInventoryToggle();
    });

    this.bubble.onTap(() => {
      this.input.requestDismiss();
      this.handleBubbleDismissFromTap();
    });

    this.story = new StoryManager(
      STORY,
      (text, pauseInput) => {
        this.pauseInputForStory = pauseInput;
        this.input.enabled = !pauseInput;
        this.touchControls.setEnabled(!pauseInput);
        this.audio.playUiPop();
        this.bubble.show(text, () => {
          this.story.onBubbleDismissed();
          if (!this.story.isShowing()) {
            this.pauseInputForStory = false;
            this.input.enabled = true;
            this.syncTouchControlsEnabled();
          }
        });
      },
      () => {
        /* story beat queue advanced */
      }
    );

    this.sceneManager.scene.add(this.player.group);
    this.audio.init();

    container.addEventListener('pointerup', (e) => this.onContainerPointerUp(e));

    this.ui.showTitle(
      () => void this.beginGame(),
      () => this.audio.toggleMute()
    );

    this.loop();
  }

  private onContainerPointerUp(e: PointerEvent): void {
    const target = e.target as HTMLElement;
    if (target.closest('.touch-controls')) return;
    if (target.closest('.hud-inventory-sign--mobile')) return;
    if (target.closest('.thought-bubble-inner')) return;
    if (target.closest('.ui-overlay .screen')) return;
    if (target.closest('.inventory-panel')) return;

    this.audio.resume();
    if (this.bubble.isVisible()) {
      this.input.requestDismiss();
      this.handleBubbleDismissFromTap();
    }
  }

  private handleBubbleDismissFromTap(): void {
    if (!this.bubble.isVisible()) return;
    if (this.bubble.isTyping()) this.bubble.skip();
    else this.bubble.dismiss();
  }

  private syncTouchControlsEnabled(): void {
    const allow =
      this.state === 'playing' &&
      !this.inventoryPanel.isOpen &&
      !this.pauseInputForStory;
    this.touchControls.setEnabled(allow);
  }

  private playingHint(boost: boolean): string {
    const hints = hintsForDevice();
    return boost ? hints.playingBoost : hints.playing;
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
    this.inventory.reset();
    this.inventoryPanel.hide();
    this.touchControls.hide();
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
    this.downtownTraffic.dispose();
    this.desertUfo.dispose();
    this.stageManager.clear();
    this.particles.resetFleeTrails();
    this.inventoryPanel.hide();
    this.touchControls.hide();

    await this.stageManager.loadAsync(level, OBJECTS, stageId);
    if (stageId === 'downtown') {
      this.downtownTraffic.build(level.width, level.depth);
    }
    if (stageId === 'desert') {
      this.desertUfo.build(
        this.stageManager.playableHalfX,
        this.stageManager.playableHalfZ
      );
    }
    this.player.reset(
      level.playerStart.x,
      level.playerStart.z,
      level.minSizeClass,
      level.growthFactor
    );
    this.player.setBounds(
      this.stageManager.playableHalfX,
      this.stageManager.playableHalfZ
    );
    this.cameraController.resetStageZoom();
    this.cameraController.setPlayerRadius(this.player.radius);
    this.cameraController.repositionImmediate(this.player.position);
    this.cameraController.updateFrustum(
      this.sceneManager.width / this.sceneManager.height
    );

    this.input.boostEnabled = level.enableBoost ?? false;
    this.touchControls.setBoostVisible(!!level.enableBoost);
    this.story.setStage(stageId);
    this.story.resetStage();

    this.ui.showStageIntro(stageId, () => {
      this.state = 'playing';
      this.hud.show();
      this.hud.setLevel(
        this.stageIndex + 1,
        STAGE_TITLES[stageId],
        STAGE_ORDER.length
      );
      this.hud.setInventorySignVisible(true);
      this.hud.setHint(this.playingHint(!!level.enableBoost));
      this.touchControls.setPlayingVisible(true);
      this.syncTouchControlsEnabled();
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
    if (prop.type === 'ufo') {
      this.audio.playUfoAbsorb();
    } else {
      this.audio.playAbsorb(prop.mass);
    }
    this.particles.spawnPuff(this.sceneManager.scene, this.player.position.clone());
    this.hud.flashAbsorb(prop.mass);
    this.hud.showPickupLabel(prop.type);
    this.inventory.add(prop.type);
    if (this.inventoryPanel.isOpen) {
      this.inventoryPanel.render(this.inventory);
    }
    this.shakeIntensity = 0.15;

    if (prop.type === 'tortoise') {
      this.pauseInputForStory = true;
      this.input.enabled = false;
      this.touchControls.setEnabled(false);
      this.audio.playUiPop();
      this.bubble.show("May I shell pick you up?", () => {
        this.pauseInputForStory = false;
        this.input.enabled = true;
        this.syncTouchControlsEnabled();
      });
    }

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
    this.inventoryPanel.hide();
    this.touchControls.hide();
    this.input.enabled = true;
    this.hud.hide();
    this.audio.stopMusic();
    this.ui.showCredits(STORY.ending, STORY.credits ?? [], STORY.musicBy, () => {
      this.stageManager.clear();
      this.ui.showTitle(
        () => void this.beginGame(),
        () => this.audio.toggleMute()
      );
      this.state = 'title';
    });
  }

  private completeStage(): void {
    if (this.stageIndex === 0) {
      this.state = 'stage_complete';
      this.inventoryPanel.hide();
      this.touchControls.hide();
      this.input.enabled = true;
      this.hud.hide();
      this.hud.setInventorySignVisible(false);
      this.audio.stopMusic();
      const videoSrc = publicUrl('a_dust_devil_picking_items_up.mp4');
      this.ui.showVideoCutscene(videoSrc, () => {
        this.finishCompleteStage();
      });
    } else {
      this.finishCompleteStage();
    }
  }

  private finishCompleteStage(): void {
    this.state = 'stage_complete';
    this.inventoryPanel.hide();
    this.touchControls.hide();
    this.input.enabled = true;
    this.hud.hide();
    this.hud.setInventorySignVisible(false);
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

  private syncInputEnabled(allowMovement: boolean): void {
    this.input.enabled =
      allowMovement && !this.inventoryPanel.isOpen && !this.pauseInputForStory;
    this.syncTouchControlsEnabled();
  }

  private handleInventoryToggle(): void {
    if (!this.input.consumeInventoryToggle()) return;
    if (this.bubble.isVisible()) return;

    const opening = !this.inventoryPanel.isOpen;
    this.inventoryPanel.toggle();
    if (opening) this.inventoryPanel.render(this.inventory);
    this.syncInputEnabled(!this.inventoryPanel.isOpen);
  }

  private updatePlaying(dt: number): void {
    this.handleBubbleDismiss();
    this.handleInventoryToggle();

    if (this.inventoryPanel.isOpen) {
      const level = this.stageManager.level;
      if (level) {
        this.hud.update(this.player.mass, level, this.elapsedSec, this.stageManager.exitOpen);
      }
      return;
    }

    if (!this.pauseInputForStory && !this.bubble.isVisible()) {
      this.player.update(this.input, dt);
      if (this.player.justTriggeredPushback) {
        this.audio.playWindGust();
        this.particles.spawnWindGust(
          this.sceneManager.scene,
          this.player.position,
          this.player.pushbackDir.x,
          this.player.pushbackDir.z
        );
        this.shakeIntensity = 0.08;
      }
    }

    if (this.player.moveSpeed > 1) {
      this.particles.spawnTrail(
        this.player.position,
        this.player.velocity.x,
        this.player.velocity.z,
        this.player.radius
      );
    }

    this.absorption.update(
      this.player,
      this.stageManager.props,
      dt,
      {
        onAbsorb: (prop) => this.onAbsorb(prop),
        onBounce: () => {},
        onFleeTrail: (prop, velX, velZ, variant) => {
          this.particles.spawnFleeTrail(prop.id, prop.position, velX, velZ, dt, variant);
        },
        onWindPushback: (prop, dirX, dirZ) => {
          const distToPlayer = prop.position.distanceTo(this.player.position);
          const now = Date.now();
          if (distToPlayer < 22 && now - this.lastAnimalWindSoundTime > 350) {
            this.audio.playWindGust();
            this.lastAnimalWindSoundTime = now;
          }
          this.particles.spawnWindGust(
            this.sceneManager.scene,
            prop.position,
            dirX,
            dirZ
          );
        },
        onPop: () => {
          this.audio.playTortoiseRetract();
        },
        onSweat: (prop) => {
          this.particles.spawnSweat(this.sceneManager.scene, prop.position);
        },
      },
      this.stageManager.playableHalfX,
      this.stageManager.playableHalfZ
    );

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

    this.downtownTraffic.update(dt);
    this.desertUfo.update(dt, this.player, (mass) => {
      this.player.addMass(mass);
      this.onAbsorb({ type: 'ufo', mass, setPiece: false });
    });

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
    this.downtownTraffic.dispose();
    this.desertUfo.dispose();
    this.sceneManager.dispose();
  }
}
