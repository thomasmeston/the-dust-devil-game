import desertLevel from '../../data/levels/desert.json';
import mountainLevel from '../../data/levels/mountain.json';
import forestLevel from '../../data/levels/forest.json';
import suburbsLevel from '../../data/levels/suburbs.json';
import downtownLevel from '../../data/levels/downtown.json';
import objectDefs from '../../data/objects.json';
import storyScript from '../../data/story/script.json';
import type { LevelDef, ObjectDef, StoryScript } from '../types/game';

export const LEVELS: Record<string, LevelDef> = {
  desert: desertLevel as LevelDef,
  mountain: mountainLevel as LevelDef,
  forest: forestLevel as LevelDef,
  suburbs: suburbsLevel as LevelDef,
  downtown: downtownLevel as LevelDef,
};

export const OBJECTS = objectDefs as unknown as Record<string, ObjectDef>;
export const STORY = storyScript as StoryScript;

export function cloneObjectDefs(
  source: Record<string, ObjectDef>
): Record<string, ObjectDef> {
  const out: Record<string, ObjectDef> = {};
  for (const [key, def] of Object.entries(source)) {
    out[key] = { ...def, scale: [...def.scale] as [number, number, number] };
  }
  return out;
}
