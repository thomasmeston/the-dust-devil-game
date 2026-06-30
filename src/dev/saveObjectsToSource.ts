import type { ObjectDef } from '../types/game';

export interface SaveObjectsResult {
  ok: boolean;
  message: string;
}

/** Persist object definitions to data/objects.json (dev server only). */
export async function saveObjectsToSource(
  objects: Record<string, ObjectDef>
): Promise<SaveObjectsResult> {
  if (!import.meta.env.DEV) {
    return { ok: false, message: 'Save is only available in the dev server.' };
  }

  try {
    const res = await fetch('/__dev/save-objects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(objects),
    });

    const data = (await res.json()) as { ok?: boolean; error?: string };
    if (!res.ok || !data.ok) {
      return { ok: false, message: data.error ?? 'Save failed.' };
    }

    return { ok: true, message: 'Saved to data/objects.json' };
  } catch {
    return { ok: false, message: 'Could not reach the dev save endpoint.' };
  }
}
