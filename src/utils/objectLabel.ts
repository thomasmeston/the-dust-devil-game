/** Human-readable label from an object type id (e.g. `jackrabbit` → Jackrabbit). */
export function formatObjectLabel(type: string): string {
  return type
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}
