export class ThoughtBubble {
  private el: HTMLDivElement;
  private textEl: HTMLSpanElement;
  private fullText = '';
  private charIndex = 0;
  private typing = false;
  private typeTimer: number | null = null;
  private onDone: (() => void) | null = null;
  private charsPerSec = 40;

  constructor(container: HTMLElement) {
    this.el = document.createElement('div');
    this.el.className = 'thought-bubble';
    this.el.innerHTML = `
      <div class="thought-bubble-inner">
        <span class="thought-bubble-text"></span>
        <span class="thought-bubble-cursor">|</span>
        <span class="thought-bubble-hint">Space / Enter to continue</span>
      </div>
    `;
    this.textEl = this.el.querySelector('.thought-bubble-text')!;
    container.appendChild(this.el);
    this.injectStyles();
    this.hide();
  }

  private injectStyles(): void {
    if (document.getElementById('thought-bubble-styles')) return;
    const style = document.createElement('style');
    style.id = 'thought-bubble-styles';
    style.textContent = `
      .thought-bubble {
        position: absolute;
        left: 50%;
        bottom: 22%;
        transform: translateX(-50%);
        max-width: min(480px, 85vw);
        z-index: 100;
        pointer-events: auto;
        animation: bubble-in 0.3s ease-out;
      }
      @keyframes bubble-in {
        from { opacity: 0; transform: translateX(-50%) translateY(10px); }
        to { opacity: 1; transform: translateX(-50%) translateY(0); }
      }
      .thought-bubble-inner {
        background: rgba(255, 255, 255, 0.95);
        border: 3px solid #1a1a2e;
        border-radius: 20px;
        padding: 16px 20px;
        font-size: 1.05rem;
        line-height: 1.5;
        color: #1a1a2e;
        box-shadow: 0 8px 24px rgba(0,0,0,0.2);
        font-style: italic;
      }
      .thought-bubble-cursor {
        animation: blink 0.8s step-end infinite;
        font-style: normal;
        font-weight: 700;
      }
      @keyframes blink { 50% { opacity: 0; } }
      .thought-bubble-hint {
        display: block;
        margin-top: 10px;
        font-size: 0.75rem;
        font-style: normal;
        color: #64748b;
        text-align: right;
      }
    `;
    document.head.appendChild(style);
  }

  show(text: string, onDone: () => void): void {
    this.fullText = text;
    this.charIndex = 0;
    this.onDone = onDone;
    this.textEl.textContent = '';
    this.el.style.display = 'block';
    this.typing = true;
    this.tick();
  }

  private tick = (): void => {
    if (!this.typing) return;
    const step = Math.max(1, Math.floor(this.charsPerSec / 60));
    this.charIndex = Math.min(this.fullText.length, this.charIndex + step);
    this.textEl.textContent = this.fullText.slice(0, this.charIndex);
    if (this.charIndex >= this.fullText.length) {
      this.typing = false;
      return;
    }
    this.typeTimer = window.setTimeout(this.tick, 1000 / 60);
  };

  skip(): void {
    if (!this.el.style.display || this.el.style.display === 'none') return;
    if (this.typeTimer) clearTimeout(this.typeTimer);
    this.typing = false;
    this.textEl.textContent = this.fullText;
  }

  dismiss(): void {
    if (this.el.style.display === 'none') return;
    this.skip();
    this.hide();
    this.onDone?.();
    this.onDone = null;
  }

  hide(): void {
    if (this.typeTimer) clearTimeout(this.typeTimer);
    this.el.style.display = 'none';
    this.typing = false;
  }

  isVisible(): boolean {
    return this.el.style.display !== 'none';
  }

  isTyping(): boolean {
    return this.typing;
  }
}
