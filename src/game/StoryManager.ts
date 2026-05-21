import type { StoryBeat, StoryScript } from '../types/game';
import type { StageId } from '../utils/constants';

export type StoryEvent =
  | { type: 'stage_start' }
  | { type: 'first_pickup' }
  | { type: 'mass'; value: number }
  | { type: 'exit_opens' }
  | { type: 'object_type'; value: string }
  | { type: 'boost_unlock' }
  | { type: 'win' };

export class StoryManager {
  private beats: StoryBeat[] = [];
  private fired = new Set<string>();
  private queue: StoryBeat[] = [];
  private current: StoryBeat | null = null;
  private onShow: (text: string, pauseInput: boolean) => void;
  private onComplete: () => void;
  private currentStage: StageId = 'desert';
  opening = '';
  ending = '';

  constructor(
    script: StoryScript,
    onShow: (text: string, pauseInput: boolean) => void,
    onComplete: () => void
  ) {
    this.beats = script.beats;
    this.opening = script.opening;
    this.ending = script.ending;
    this.onShow = onShow;
    this.onComplete = onComplete;
  }

  setStage(stage: StageId): void {
    this.currentStage = stage;
  }

  resetStage(): void {
    this.fired.clear();
    this.queue = [];
    this.current = null;
  }

  fire(event: StoryEvent): void {
    for (const beat of this.beats) {
      if (beat.stage !== this.currentStage) continue;
      if (this.fired.has(beat.id)) continue;
      if (!this.matches(beat, event)) continue;
      this.fired.add(beat.id);
      this.queue.push(beat);
    }
    this.tryShowNext();
  }

  private matches(beat: StoryBeat, event: StoryEvent): boolean {
    if (beat.trigger !== event.type) return false;
    if (beat.trigger === 'mass' && event.type === 'mass') {
      return (beat.value as number) <= event.value;
    }
    if (beat.trigger === 'object_type' && event.type === 'object_type') {
      return beat.value === event.value;
    }
    return true;
  }

  private tryShowNext(): void {
    if (this.current || this.queue.length === 0) return;
    this.current = this.queue.shift()!;
    this.onShow(this.current.text, this.current.pauseInput ?? false);
  }

  onBubbleDismissed(): void {
    this.current = null;
    this.onComplete();
    this.tryShowNext();
  }

  isShowing(): boolean {
    return this.current !== null;
  }

  shouldPauseInput(): boolean {
    return this.current?.pauseInput ?? false;
  }
}
