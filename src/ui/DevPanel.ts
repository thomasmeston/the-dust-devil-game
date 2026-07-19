import type { AudioManager } from '../game/AudioManager';
import type { ObjectDef } from '../types/game';
import { STAGE_ORDER, STAGE_TITLES, type StageId } from '../utils/constants';

export interface DevPlayerBindings {
  getMass: () => number;
  getSpeedMultiplier: () => number;
  setMass: (mass: number) => void;
  setSpeedMultiplier: (multiplier: number) => void;
}

export interface DevObjectEditorBindings {
  getObjectTypes: () => string[];
  getObjectDef: (type: string) => ObjectDef | undefined;
  getOriginalObjectDef?: (type: string) => ObjectDef | undefined;
  onObjectDefChange: (
    type: string,
    patch: { color?: string; scale?: [number, number, number] }
  ) => void;
  onRevertToOriginal?: (type: string) => void;
  onSpawnRandom: (type: string) => void;
  onSaveToSource?: () => Promise<{ ok: boolean; message: string }>;
}

export interface DevPanelOptions {
  onJumpStage?: (stageId: StageId) => void;
  player?: DevPlayerBindings;
  objectEditor?: DevObjectEditorBindings;
  onObjectEditorActiveChange?: (active: boolean) => void;
}

const DEV_MASS_MAX = 150;
const DEV_SPEED_MIN = 0.5;
const DEV_SPEED_MAX = 2.5;
const DEV_SCALE_MIN = 0.05;
const DEV_SCALE_MAX = 25;
const DEV_SCALE_STEP = 0.05;

type DevTab = 'controls' | 'objects';

export class DevPanel {
  private el: HTMLDivElement;
  private spawnBtn: HTMLButtonElement;
  private card: HTMLDivElement;
  private tabControlsBtn: HTMLButtonElement;
  private tabObjectsBtn: HTMLButtonElement;
  private controlsPane: HTMLDivElement;
  private objectsPane: HTMLDivElement;
  private levelSelect: HTMLSelectElement;
  private massSlider: HTMLInputElement;
  private massValue: HTMLSpanElement;
  private speedSlider: HTMLInputElement;
  private speedValue: HTMLSpanElement;
  private musicSlider: HTMLInputElement;
  private musicValue: HTMLSpanElement;
  private sfxSlider: HTMLInputElement;
  private sfxValue: HTMLSpanElement;
  private objectSelect: HTMLSelectElement;
  private colorInput: HTMLInputElement;
  private scaleXSlider: HTMLInputElement;
  private scaleYSlider: HTMLInputElement;
  private scaleZSlider: HTMLInputElement;
  private scaleXValue: HTMLSpanElement;
  private scaleYValue: HTMLSpanElement;
  private scaleZValue: HTMLSpanElement;
  private keepRatioCheckbox: HTMLInputElement;
  private revertBtn: HTMLButtonElement;
  private saveBtn: HTMLButtonElement;
  private saveStatus: HTMLParagraphElement;
  private objectEmptyHint: HTMLParagraphElement;
  private lastScale: [number, number, number] = [1, 1, 1];
  private open = false;
  private activeTab: DevTab = 'controls';
  private syncingObjectEditor = false;
  private onJumpStage?: (stageId: StageId) => void;
  private onObjectEditorActiveChange?: (active: boolean) => void;
  private player?: DevPlayerBindings;
  private objectEditor?: DevObjectEditorBindings;

  constructor(
    container: HTMLElement,
    private audio: AudioManager,
    options: DevPanelOptions = {}
  ) {
    this.onJumpStage = options.onJumpStage;
    this.onObjectEditorActiveChange = options.onObjectEditorActiveChange;
    this.player = options.player;
    this.objectEditor = options.objectEditor;
    this.el = document.createElement('div');
    this.el.className = 'dev-panel dev-panel--hidden';
    this.el.innerHTML = `
      <div class="dev-panel__card">
        <div class="dev-panel__header">
          <span class="dev-panel__title">Dev mode</span>
          <kbd class="dev-panel__key">\`</kbd>
        </div>
        <div class="dev-panel__tabs">
          <button type="button" class="dev-panel__tab dev-panel__tab--active" data-tab="controls">Controls</button>
          <button type="button" class="dev-panel__tab" data-tab="objects">Object editor</button>
        </div>
        <div class="dev-panel__pane dev-panel__pane--controls">
          <div class="dev-panel__section">
            <label class="dev-panel__label" for="dev-level-select">Level</label>
            <select id="dev-level-select" class="dev-panel__select"></select>
            <button type="button" class="dev-panel__jump">Load level</button>
          </div>
          <div class="dev-panel__section">
            <label class="dev-panel__label" for="dev-mass">Dust devil size (mass)</label>
            <div class="dev-panel__volume-row">
              <input type="range" id="dev-mass" class="dev-panel__slider"
                min="0" max="${DEV_MASS_MAX}" step="0.5" />
              <span class="dev-panel__volume-value dev-panel__mass-value">0.0</span>
            </div>
          </div>
          <div class="dev-panel__section">
            <label class="dev-panel__label" for="dev-speed">Move speed</label>
            <div class="dev-panel__volume-row">
              <input type="range" id="dev-speed" class="dev-panel__slider"
                min="${DEV_SPEED_MIN * 100}" max="${DEV_SPEED_MAX * 100}" step="5" />
              <span class="dev-panel__volume-value dev-panel__speed-value">100%</span>
            </div>
          </div>
          <div class="dev-panel__section">
            <label class="dev-panel__label" for="dev-music-volume">Music</label>
            <div class="dev-panel__volume-row">
              <input type="range" id="dev-music-volume" class="dev-panel__slider"
                min="0" max="100" step="1" />
              <span class="dev-panel__volume-value dev-panel__music-value">35%</span>
            </div>
          </div>
          <div class="dev-panel__section">
            <label class="dev-panel__label" for="dev-sfx-volume">SFX</label>
            <div class="dev-panel__volume-row">
              <input type="range" id="dev-sfx-volume" class="dev-panel__slider"
                min="0" max="100" step="1" />
              <span class="dev-panel__volume-value dev-panel__sfx-value">100%</span>
            </div>
          </div>
        </div>
        <div class="dev-panel__pane dev-panel__pane--objects dev-panel__pane--hidden">
          <div class="dev-panel__section">
            <label class="dev-panel__label" for="dev-object-select">Level object</label>
            <select id="dev-object-select" class="dev-panel__select"></select>
            <p class="dev-panel__hint dev-panel__hint--pick">Click an object in the level to select it.</p>
            <p class="dev-panel__hint dev-panel__hint--empty dev-panel__hint--hidden">No objects on this level yet.</p>
          </div>
          <div class="dev-panel__section">
            <label class="dev-panel__label" for="dev-object-color">Color</label>
            <input type="color" id="dev-object-color" class="dev-panel__color" value="#ffffff" />
          </div>
          <div class="dev-panel__section dev-panel__section--row">
            <label class="dev-panel__check">
              <input type="checkbox" id="dev-keep-ratio" class="dev-panel__checkbox" />
              Keep ratio
            </label>
          </div>
          <div class="dev-panel__section">
            <label class="dev-panel__label" for="dev-scale-x">Width (X)</label>
            <div class="dev-panel__volume-row">
              <input type="range" id="dev-scale-x" class="dev-panel__slider"
                min="${DEV_SCALE_MIN}" max="${DEV_SCALE_MAX}" step="${DEV_SCALE_STEP}" />
              <span class="dev-panel__volume-value dev-panel__scale-x-value">1.00</span>
            </div>
          </div>
          <div class="dev-panel__section">
            <label class="dev-panel__label" for="dev-scale-y">Height (Y)</label>
            <div class="dev-panel__volume-row">
              <input type="range" id="dev-scale-y" class="dev-panel__slider"
                min="${DEV_SCALE_MIN}" max="${DEV_SCALE_MAX}" step="${DEV_SCALE_STEP}" />
              <span class="dev-panel__volume-value dev-panel__scale-y-value">1.00</span>
            </div>
          </div>
          <div class="dev-panel__section">
            <label class="dev-panel__label" for="dev-scale-z">Depth (Z)</label>
            <div class="dev-panel__volume-row">
              <input type="range" id="dev-scale-z" class="dev-panel__slider"
                min="${DEV_SCALE_MIN}" max="${DEV_SCALE_MAX}" step="${DEV_SCALE_STEP}" />
              <span class="dev-panel__volume-value dev-panel__scale-z-value">1.00</span>
            </div>
          </div>
          <p class="dev-panel__hint">Changes apply to all props of this type on the level.</p>
          <button type="button" class="dev-panel__revert">Revert to original</button>
          <button type="button" class="dev-panel__save">Save to objects.json</button>
          <p class="dev-panel__status dev-panel__status--idle"></p>
        </div>
      </div>
    `;
    container.appendChild(this.el);

    this.spawnBtn = document.createElement('button');
    this.spawnBtn.type = 'button';
    this.spawnBtn.className = 'dev-spawn-btn dev-spawn-btn--hidden';
    this.spawnBtn.textContent = '+ Spawn random object';
    container.appendChild(this.spawnBtn);

    this.card = this.el.querySelector('.dev-panel__card')!;
    this.tabControlsBtn = this.el.querySelector('[data-tab="controls"]')!;
    this.tabObjectsBtn = this.el.querySelector('[data-tab="objects"]')!;
    this.controlsPane = this.el.querySelector('.dev-panel__pane--controls')!;
    this.objectsPane = this.el.querySelector('.dev-panel__pane--objects')!;
    this.levelSelect = this.el.querySelector('#dev-level-select')!;
    this.massSlider = this.el.querySelector('#dev-mass')!;
    this.massValue = this.el.querySelector('.dev-panel__mass-value')!;
    this.speedSlider = this.el.querySelector('#dev-speed')!;
    this.speedValue = this.el.querySelector('.dev-panel__speed-value')!;
    this.musicSlider = this.el.querySelector('#dev-music-volume')!;
    this.musicValue = this.el.querySelector('.dev-panel__music-value')!;
    this.sfxSlider = this.el.querySelector('#dev-sfx-volume')!;
    this.sfxValue = this.el.querySelector('.dev-panel__sfx-value')!;
    this.objectSelect = this.el.querySelector('#dev-object-select')!;
    this.colorInput = this.el.querySelector('#dev-object-color')!;
    this.scaleXSlider = this.el.querySelector('#dev-scale-x')!;
    this.scaleYSlider = this.el.querySelector('#dev-scale-y')!;
    this.scaleZSlider = this.el.querySelector('#dev-scale-z')!;
    this.scaleXValue = this.el.querySelector('.dev-panel__scale-x-value')!;
    this.scaleYValue = this.el.querySelector('.dev-panel__scale-y-value')!;
    this.scaleZValue = this.el.querySelector('.dev-panel__scale-z-value')!;
    this.keepRatioCheckbox = this.el.querySelector('#dev-keep-ratio')!;
    this.revertBtn = this.el.querySelector('.dev-panel__revert')!;
    this.saveBtn = this.el.querySelector('.dev-panel__save')!;
    this.saveStatus = this.el.querySelector('.dev-panel__status')!;
    this.objectEmptyHint = this.el.querySelector('.dev-panel__hint--empty')!;

    for (let i = 0; i < STAGE_ORDER.length; i++) {
      const id = STAGE_ORDER[i];
      const opt = document.createElement('option');
      opt.value = id;
      opt.textContent = `${i + 1}. ${STAGE_TITLES[id]}`;
      this.levelSelect.appendChild(opt);
    }

    this.populateObjectSelect();

    this.el.querySelector('.dev-panel__jump')!.addEventListener('click', () => {
      this.onJumpStage?.(this.levelSelect.value as StageId);
    });
    this.tabControlsBtn.addEventListener('click', () => this.setTab('controls'));
    this.tabObjectsBtn.addEventListener('click', () => this.setTab('objects'));
    this.massSlider.addEventListener('input', () => this.onMassInput());
    this.speedSlider.addEventListener('input', () => this.onSpeedInput());
    this.musicSlider.addEventListener('input', () => this.onMusicInput());
    this.sfxSlider.addEventListener('input', () => this.onSfxInput());
    this.objectSelect.addEventListener('change', () => this.syncObjectEditorFromSelection());
    this.colorInput.addEventListener('input', () => this.onObjectEditorInput());
    this.scaleXSlider.addEventListener('input', () => this.onScaleInput(0));
    this.scaleYSlider.addEventListener('input', () => this.onScaleInput(1));
    this.scaleZSlider.addEventListener('input', () => this.onScaleInput(2));
    this.spawnBtn.addEventListener('click', () => this.onSpawnClick());
    this.revertBtn.addEventListener('click', () => this.onRevertClick());
    this.saveBtn.addEventListener('click', () => void this.onSaveClick());

    if (!import.meta.env.DEV || !this.objectEditor?.onSaveToSource) {
      this.saveBtn.hidden = true;
    }

    this.injectStyles();
    this.syncControls();
  }

  get isOpen(): boolean {
    return this.open;
  }

  get isObjectEditorActive(): boolean {
    return this.open && this.activeTab === 'objects';
  }

  refreshObjectList(): void {
    this.populateObjectSelect();
  }

  selectObjectType(type: string): void {
    const hasOption = [...this.objectSelect.options].some((opt) => opt.value === type);
    if (!hasOption) {
      this.refreshObjectList();
    }
    if (![...this.objectSelect.options].some((opt) => opt.value === type)) return;
    this.objectSelect.value = type;
    this.syncObjectEditorFromSelection();
  }

  show(): void {
    this.syncControls();
    this.open = true;
    this.el.classList.remove('dev-panel--hidden');
    this.spawnBtn.classList.remove('dev-spawn-btn--hidden');
    this.notifyObjectEditorActive();
  }

  hide(): void {
    this.open = false;
    this.el.classList.add('dev-panel--hidden');
    this.spawnBtn.classList.add('dev-spawn-btn--hidden');
    this.notifyObjectEditorActive();
  }

  toggle(): boolean {
    if (this.open) this.hide();
    else this.show();
    return this.open;
  }

  setCurrentStage(stageId: StageId): void {
    this.levelSelect.value = stageId;
  }

  /** Refresh player sliders after mass changes from normal gameplay. */
  syncPlayerControls(): void {
    if (!this.player) return;
    const mass = this.player.getMass();
    this.massSlider.value = String(Math.min(DEV_MASS_MAX, mass));
    this.massValue.textContent = mass.toFixed(1);

    const speedPct = Math.round(this.player.getSpeedMultiplier() * 100);
    this.speedSlider.value = String(speedPct);
    this.speedValue.textContent = `${speedPct}%`;
  }

  private populateObjectSelect(): void {
    this.objectSelect.innerHTML = '';
    const types = this.objectEditor?.getObjectTypes() ?? [];
    const hasTypes = types.length > 0;

    for (const type of types) {
      const opt = document.createElement('option');
      opt.value = type;
      opt.textContent = type.replace(/_/g, ' ');
      this.objectSelect.appendChild(opt);
    }

    this.objectSelect.disabled = !hasTypes;
    this.colorInput.disabled = !hasTypes;
    this.keepRatioCheckbox.disabled = !hasTypes;
    this.scaleXSlider.disabled = !hasTypes;
    this.scaleYSlider.disabled = !hasTypes;
    this.scaleZSlider.disabled = !hasTypes;
    this.revertBtn.disabled = !hasTypes;
    this.spawnBtn.disabled = !hasTypes;
    this.objectEmptyHint.classList.toggle('dev-panel__hint--hidden', hasTypes);

    if (hasTypes) {
      this.syncObjectEditorFromSelection();
    }
  }

  private setTab(tab: DevTab): void {
    this.activeTab = tab;
    this.tabControlsBtn.classList.toggle('dev-panel__tab--active', tab === 'controls');
    this.tabObjectsBtn.classList.toggle('dev-panel__tab--active', tab === 'objects');
    this.controlsPane.classList.toggle('dev-panel__pane--hidden', tab !== 'controls');
    this.objectsPane.classList.toggle('dev-panel__pane--hidden', tab !== 'objects');
    this.card.classList.toggle('dev-panel__card--wide', tab === 'objects');
    if (tab === 'objects') {
      this.refreshObjectList();
    }
    this.notifyObjectEditorActive();
  }

  private notifyObjectEditorActive(): void {
    this.onObjectEditorActiveChange?.(this.isObjectEditorActive);
  }

  private syncObjectEditorFromSelection(): void {
    if (!this.objectEditor) return;
    const type = this.objectSelect.value;
    const def = this.objectEditor.getObjectDef(type);
    if (!def) return;

    this.syncingObjectEditor = true;
    this.colorInput.value = normalizeHexColor(def.color);
    this.scaleXSlider.value = String(def.scale[0]);
    this.scaleYSlider.value = String(def.scale[1]);
    this.scaleZSlider.value = String(def.scale[2]);
    this.scaleXValue.textContent = def.scale[0].toFixed(2);
    this.scaleYValue.textContent = def.scale[1].toFixed(2);
    this.scaleZValue.textContent = def.scale[2].toFixed(2);
    this.lastScale = [...def.scale];
    this.syncingObjectEditor = false;
  }

  private clampScale(value: number): number {
    return Math.min(DEV_SCALE_MAX, Math.max(DEV_SCALE_MIN, value));
  }

  private setScaleSliders(scale: [number, number, number]): void {
    this.scaleXSlider.value = String(scale[0]);
    this.scaleYSlider.value = String(scale[1]);
    this.scaleZSlider.value = String(scale[2]);
    this.scaleXValue.textContent = scale[0].toFixed(2);
    this.scaleYValue.textContent = scale[1].toFixed(2);
    this.scaleZValue.textContent = scale[2].toFixed(2);
  }

  private onScaleInput(axis: 0 | 1 | 2): void {
    if (this.syncingObjectEditor || !this.objectEditor) return;

    const sliders = [this.scaleXSlider, this.scaleYSlider, this.scaleZSlider];
    const newVal = Number(sliders[axis].value);
    let scale: [number, number, number];

    if (this.keepRatioCheckbox.checked) {
      const prev = this.lastScale[axis];
      const ratio = prev > 0 ? newVal / prev : 1;
      scale = [
        this.clampScale(this.lastScale[0] * ratio),
        this.clampScale(this.lastScale[1] * ratio),
        this.clampScale(this.lastScale[2] * ratio),
      ];
      this.syncingObjectEditor = true;
      this.setScaleSliders(scale);
      this.syncingObjectEditor = false;
    } else {
      scale = [
        Number(this.scaleXSlider.value),
        Number(this.scaleYSlider.value),
        Number(this.scaleZSlider.value),
      ];
      this.setScaleSliders(scale);
    }

    this.lastScale = [...scale];
    this.applyObjectEditorChange(scale);
  }

  private onObjectEditorInput(): void {
    if (this.syncingObjectEditor || !this.objectEditor) return;

    const scale: [number, number, number] = [
      Number(this.scaleXSlider.value),
      Number(this.scaleYSlider.value),
      Number(this.scaleZSlider.value),
    ];
    this.lastScale = [...scale];
    this.applyObjectEditorChange(scale);
  }

  private applyObjectEditorChange(scale: [number, number, number]): void {
    if (!this.objectEditor) return;
    const type = this.objectSelect.value;
    this.objectEditor.onObjectDefChange(type, {
      color: this.colorInput.value,
      scale,
    });
  }

  private onRevertClick(): void {
    if (!this.objectEditor?.onRevertToOriginal) return;
    const type = this.objectSelect.value;
    this.objectEditor.onRevertToOriginal(type);
    this.syncObjectEditorFromSelection();
    this.setSaveStatus('Reverted to original values.', 'ok');
  }

  private onSpawnClick(): void {
    if (!this.objectEditor) return;
    this.objectEditor.onSpawnRandom(this.objectSelect.value);
  }

  private async onSaveClick(): Promise<void> {
    if (!this.objectEditor?.onSaveToSource) return;

    this.saveBtn.disabled = true;
    this.setSaveStatus('Saving…', 'idle');

    const result = await this.objectEditor.onSaveToSource();
    this.saveBtn.disabled = false;
    this.setSaveStatus(result.message, result.ok ? 'ok' : 'err');
  }

  private setSaveStatus(message: string, tone: 'idle' | 'ok' | 'err'): void {
    this.saveStatus.textContent = message;
    this.saveStatus.className = `dev-panel__status dev-panel__status--${tone}`;
  }

  private syncControls(): void {
    this.syncPlayerControls();

    const musicPct = Math.round(this.audio.getMusicVolume() * 100);
    this.musicSlider.value = String(musicPct);
    this.musicValue.textContent = `${musicPct}%`;

    const sfxPct = Math.round(this.audio.getSfxVolume() * 100);
    this.sfxSlider.value = String(sfxPct);
    this.sfxValue.textContent = `${sfxPct}%`;
  }

  private onMassInput(): void {
    if (!this.player) return;
    const mass = Number(this.massSlider.value);
    this.player.setMass(mass);
    this.massValue.textContent = mass.toFixed(1);
  }

  private onSpeedInput(): void {
    if (!this.player) return;
    const pct = Number(this.speedSlider.value);
    this.player.setSpeedMultiplier(pct / 100);
    this.speedValue.textContent = `${pct}%`;
  }

  private onMusicInput(): void {
    const pct = Number(this.musicSlider.value);
    this.audio.setMusicVolume(pct / 100);
    this.musicValue.textContent = `${pct}%`;
    if (pct > 0 && this.audio.isMusicMuted()) {
      this.audio.setMusicMuted(false);
    }
  }

  private onSfxInput(): void {
    const pct = Number(this.sfxSlider.value);
    this.audio.setSfxVolume(pct / 100);
    this.sfxValue.textContent = `${pct}%`;
  }

  private injectStyles(): void {
    if (document.getElementById('dev-panel-styles')) return;
    const style = document.createElement('style');
    style.id = 'dev-panel-styles';
    style.textContent = `
      .dev-panel {
        position: absolute;
        top: 88px;
        right: 24px;
        z-index: 55;
        pointer-events: none;
      }
      .dev-panel--hidden { display: none; }
      .dev-panel__card {
        pointer-events: auto;
        width: min(220px, calc(100vw - 48px));
        max-height: calc(100dvh - 100px);
        overflow-y: auto;
        padding: 12px 14px;
        background: rgba(15, 23, 42, 0.92);
        border: 2px solid rgba(251, 191, 36, 0.45);
        border-radius: 10px;
        box-shadow: 0 8px 24px rgba(0, 0, 0, 0.45);
        font-family: inherit;
      }
      .dev-panel__card--wide {
        width: min(280px, calc(100vw - 48px));
      }
      .dev-panel__header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 10px;
      }
      .dev-panel__title {
        font-size: 0.78rem;
        font-weight: 800;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: #fbbf24;
      }
      .dev-panel__key {
        font-size: 0.72rem;
        padding: 2px 6px;
        background: rgba(255,255,255,0.12);
        border-radius: 4px;
        color: #e2e8f0;
        border: 1px solid rgba(255,255,255,0.2);
      }
      .dev-panel__tabs {
        display: flex;
        gap: 6px;
        margin-bottom: 10px;
      }
      .dev-panel__tab {
        flex: 1;
        padding: 6px 8px;
        font-family: inherit;
        font-size: 0.72rem;
        font-weight: 700;
        color: rgba(255,255,255,0.65);
        background: rgba(0,0,0,0.25);
        border: 1px solid rgba(255,255,255,0.15);
        border-radius: 6px;
        cursor: pointer;
      }
      .dev-panel__tab--active {
        color: #1a1a2e;
        background: #fbbf24;
        border-color: #fbbf24;
      }
      .dev-panel__pane--hidden { display: none; }
      .dev-panel__section { margin-bottom: 12px; }
      .dev-panel__section:last-child { margin-bottom: 0; }
      .dev-panel__section--row { margin-bottom: 8px; }
      .dev-panel__check {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 0.78rem;
        font-weight: 600;
        color: rgba(255,255,255,0.85);
        cursor: pointer;
      }
      .dev-panel__checkbox {
        width: 14px;
        height: 14px;
        accent-color: #fbbf24;
        cursor: pointer;
      }
      .dev-panel__label {
        display: block;
        font-size: 0.72rem;
        font-weight: 700;
        color: rgba(255,255,255,0.75);
        margin-bottom: 6px;
        text-transform: uppercase;
        letter-spacing: 0.05em;
      }
      .dev-panel__select {
        width: 100%;
        margin-bottom: 8px;
        padding: 6px 8px;
        font-family: inherit;
        font-size: 0.82rem;
        font-weight: 600;
        color: #f8fafc;
        background: rgba(0,0,0,0.35);
        border: 1px solid rgba(255,255,255,0.2);
        border-radius: 6px;
      }
      .dev-panel__color {
        width: 100%;
        height: 36px;
        padding: 2px;
        border: 1px solid rgba(255,255,255,0.2);
        border-radius: 6px;
        background: rgba(0,0,0,0.35);
        cursor: pointer;
      }
      .dev-panel__hint {
        margin: 4px 0 0;
        font-size: 0.68rem;
        line-height: 1.35;
        color: rgba(255,255,255,0.45);
      }
      .dev-panel__hint--pick {
        margin-top: 8px;
        color: rgba(251, 191, 36, 0.85);
      }
      .dev-panel__hint--hidden { display: none; }
      .dev-panel__jump {
        width: 100%;
        padding: 7px 10px;
        font-family: inherit;
        font-size: 0.82rem;
        font-weight: 700;
        color: #1a1a2e;
        background: #fbbf24;
        border: none;
        border-radius: 6px;
        cursor: pointer;
      }
      .dev-panel__jump:active { transform: scale(0.98); }
      .dev-panel__revert,
      .dev-panel__save {
        width: 100%;
        margin-top: 8px;
        padding: 7px 10px;
        font-family: inherit;
        font-size: 0.82rem;
        font-weight: 700;
        color: #e2e8f0;
        background: rgba(255,255,255,0.12);
        border: 1px solid rgba(251, 191, 36, 0.45);
        border-radius: 6px;
        cursor: pointer;
      }
      .dev-panel__revert:disabled,
      .dev-panel__save:disabled {
        opacity: 0.55;
        cursor: wait;
      }
      .dev-panel__revert:active:not(:disabled),
      .dev-panel__save:active:not(:disabled) { transform: scale(0.98); }
      .dev-panel__save { margin-top: 6px; }
      .dev-panel__status {
        margin: 8px 0 0;
        min-height: 1rem;
        font-size: 0.68rem;
        line-height: 1.35;
      }
      .dev-panel__status--idle { color: rgba(255,255,255,0.45); }
      .dev-panel__status--ok { color: #86efac; }
      .dev-panel__status--err { color: #fca5a5; }
      .dev-panel__volume-row {
        display: flex;
        align-items: center;
        gap: 8px;
      }
      .dev-panel__slider {
        flex: 1;
        min-width: 0;
        accent-color: #fbbf24;
      }
      .dev-panel__volume-value {
        flex-shrink: 0;
        width: 2.8rem;
        font-size: 0.78rem;
        font-weight: 700;
        color: #e2e8f0;
        text-align: right;
        font-variant-numeric: tabular-nums;
      }
      .dev-spawn-btn {
        position: absolute;
        left: max(24px, env(safe-area-inset-left));
        bottom: max(24px, env(safe-area-inset-bottom));
        z-index: 55;
        padding: 10px 16px;
        font-family: inherit;
        font-size: 0.85rem;
        font-weight: 800;
        color: #1a1a2e;
        background: #fbbf24;
        border: 2px solid rgba(251, 191, 36, 0.55);
        border-radius: 999px;
        box-shadow: 0 6px 18px rgba(0, 0, 0, 0.35);
        cursor: pointer;
        pointer-events: auto;
      }
      .dev-spawn-btn--hidden { display: none; }
      .dev-spawn-btn:active { transform: scale(0.98); }
      @media (max-width: 768px), (pointer: coarse) {
        .dev-panel {
          top: max(72px, env(safe-area-inset-top));
          right: max(12px, env(safe-area-inset-right));
        }
        .dev-spawn-btn {
          left: max(12px, env(safe-area-inset-left));
          bottom: max(88px, calc(env(safe-area-inset-bottom) + 64px));
          font-size: 0.78rem;
          padding: 9px 14px;
        }
      }
    `;
    document.head.appendChild(style);
  }
}

function normalizeHexColor(color: string): string {
  const hex = color.startsWith('#') ? color.slice(1) : color;
  if (hex.length === 3) {
    return `#${hex[0]}${hex[0]}${hex[1]}${hex[1]}${hex[2]}${hex[2]}`;
  }
  if (hex.length >= 6) {
    return `#${hex.slice(0, 6)}`;
  }
  return '#ffffff';
}
