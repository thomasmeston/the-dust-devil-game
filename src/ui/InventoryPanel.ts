import type { PickupInventory } from '../game/PickupInventory';

export class InventoryPanel {
  private el: HTMLDivElement;
  private listEl: HTMLUListElement;
  private summaryEl: HTMLParagraphElement;
  private emptyEl: HTMLParagraphElement;
  private hintEl: HTMLParagraphElement;
  private open = false;

  private onOpenChange?: (open: boolean) => void;

  constructor(container: HTMLElement, onOpenChange?: (open: boolean) => void) {
    this.onOpenChange = onOpenChange;
    this.el = document.createElement('div');
    this.el.className = 'inventory-panel';
    this.el.hidden = true;
    this.el.innerHTML = `
      <div class="inventory-panel__card">
        <div class="inventory-panel__header">
          <h3 class="inventory-panel__title">Collected</h3>
          <button type="button" class="inventory-panel__close" aria-label="Close inventory">×</button>
        </div>
        <p class="inventory-panel__summary"></p>
        <p class="inventory-panel__empty">Nothing picked up yet.</p>
        <ul class="inventory-panel__list"></ul>
        <p class="inventory-panel__hint">Tab to close</p>
      </div>
    `;
    container.appendChild(this.el);
    this.summaryEl = this.el.querySelector('.inventory-panel__summary')!;
    this.emptyEl = this.el.querySelector('.inventory-panel__empty')!;
    this.listEl = this.el.querySelector('.inventory-panel__list')!;
    this.hintEl = this.el.querySelector('.inventory-panel__hint')!;
    this.el.querySelector('.inventory-panel__close')!.addEventListener('click', () => {
      this.setOpen(false);
    });
    this.injectStyles();
  }

  get isOpen(): boolean {
    return this.open;
  }

  toggle(): boolean {
    this.setOpen(!this.open);
    return this.open;
  }

  setOpen(open: boolean): void {
    this.open = open;
    this.el.hidden = !open;
    this.el.classList.toggle('inventory-panel--open', open);
    this.onOpenChange?.(open);
  }

  hide(): void {
    this.setOpen(false);
  }

  setCloseHint(text: string): void {
    this.hintEl.textContent = text;
  }

  render(inventory: PickupInventory): void {
    const entries = inventory.getEntries();
    const total = inventory.totalPickedUp;
    const unique = inventory.uniqueTypes;

    if (total === 0) {
      this.summaryEl.textContent = '';
      this.summaryEl.hidden = true;
      this.emptyEl.hidden = false;
      this.listEl.innerHTML = '';
      return;
    }

    this.emptyEl.hidden = true;
    this.summaryEl.hidden = false;
    this.summaryEl.textContent =
      unique === 1
        ? `${total} item · 1 type`
        : `${total} items · ${unique} types`;

    this.listEl.innerHTML = entries
      .map(
        (e) =>
          `<li><span class="inventory-panel__name">${escapeHtml(e.label)}</span><span class="inventory-panel__count">×${e.count}</span></li>`
      )
      .join('');
  }

  private injectStyles(): void {
    if (document.getElementById('inventory-panel-styles')) return;
    const style = document.createElement('style');
    style.id = 'inventory-panel-styles';
    style.textContent = `
      .inventory-panel {
        position: absolute; inset: 0; z-index: 120;
        display: flex; align-items: flex-start; justify-content: flex-end;
        padding: 72px 20px 20px;
        pointer-events: none;
        background: rgba(15, 15, 28, 0.35);
        opacity: 0;
        transition: opacity 0.2s ease;
      }
      .inventory-panel--open { opacity: 1; pointer-events: auto; }
      .inventory-panel__card {
        width: min(280px, 88vw);
        max-height: min(420px, 70vh);
        display: flex; flex-direction: column;
        background: rgba(26, 26, 46, 0.96);
        border: 2px solid rgba(251, 191, 36, 0.45);
        border-radius: 14px;
        padding: 14px 16px;
        box-shadow: 0 12px 32px rgba(0,0,0,0.45);
        transform: translateX(12px);
        transition: transform 0.2s ease;
      }
      .inventory-panel--open .inventory-panel__card { transform: translateX(0); }
      .inventory-panel__header {
        display: flex; justify-content: space-between; align-items: center;
        margin-bottom: 8px;
      }
      .inventory-panel__title {
        margin: 0; font-size: 1.15rem; font-weight: 800; color: #fbbf24;
      }
      .inventory-panel__close {
        background: transparent; border: none; color: #94a3b8;
        font-size: 1.5rem; line-height: 1; cursor: pointer; padding: 0 4px;
        font-family: inherit;
      }
      .inventory-panel__close:hover { color: #fff; }
      .inventory-panel__summary {
        margin: 0 0 10px; font-size: 0.85rem; color: #94a3b8; font-weight: 600;
      }
      .inventory-panel__empty {
        margin: 0; color: #64748b; font-size: 0.95rem; font-style: italic;
      }
      .inventory-panel__list {
        list-style: none; margin: 0; padding: 0;
        overflow-y: auto; flex: 1; min-height: 0;
      }
      .inventory-panel__list li {
        display: flex; justify-content: space-between; align-items: center;
        gap: 12px; padding: 7px 0;
        border-bottom: 1px solid rgba(255,255,255,0.08);
        font-size: 0.95rem; color: #e2e8f0;
      }
      .inventory-panel__list li:last-child { border-bottom: none; }
      .inventory-panel__name { font-weight: 700; }
      .inventory-panel__count {
        color: #fbbf24; font-weight: 800; font-variant-numeric: tabular-nums;
      }
      .inventory-panel__hint {
        margin: 10px 0 0; font-size: 0.75rem; color: #64748b; text-align: center;
      }
    `;
    document.head.appendChild(style);
  }
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
