import { formatObjectLabel } from '../utils/objectLabel';

export interface InventoryEntry {
  type: string;
  label: string;
  count: number;
}

/** Counts absorbed objects for the current playthrough (persists across stages). */
export class PickupInventory {
  private counts = new Map<string, number>();

  add(type: string): void {
    this.counts.set(type, (this.counts.get(type) ?? 0) + 1);
  }

  reset(): void {
    this.counts.clear();
  }

  get totalPickedUp(): number {
    let n = 0;
    for (const c of this.counts.values()) n += c;
    return n;
  }

  get uniqueTypes(): number {
    return this.counts.size;
  }

  getEntries(): InventoryEntry[] {
    return [...this.counts.entries()]
      .map(([type, count]) => ({
        type,
        label: formatObjectLabel(type),
        count,
      }))
      .sort(
        (a, b) => b.count - a.count || a.label.localeCompare(b.label)
      );
  }
}
