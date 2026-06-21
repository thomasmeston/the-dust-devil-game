import * as THREE from 'three';
import { STAGE_ORDER, type StageId } from '../utils/constants';
import { publicUrl } from '../utils/publicUrl';

/** Poly Haven ground textures per biome (CC0). */
export const BIOME_TEXTURE_SOURCES: Record<
  StageId,
  { diffuse: string; normal: string; credit: string }
> = {
  desert: {
    diffuse: publicUrl('textures/desert_diff.jpg'),
    normal: publicUrl('textures/desert_nor.jpg'),
    credit: 'Poly Haven — aerial_sand',
  },
  mountain: {
    diffuse: publicUrl('textures/mountain_diff.jpg'),
    normal: publicUrl('textures/mountain_nor.jpg'),
    credit: 'Poly Haven — aerial_rocks_02',
  },
  forest: {
    diffuse: publicUrl('textures/forest_diff.jpg'),
    normal: publicUrl('textures/forest_nor.jpg'),
    credit: 'Poly Haven — brown_mud_leaves_01',
  },
  suburbs: {
    diffuse: publicUrl('textures/suburbs_diff.jpg'),
    normal: publicUrl('textures/suburbs_nor.jpg'),
    credit: 'Poly Haven — aerial_grass_rock',
  },
  downtown: {
    diffuse: publicUrl('textures/downtown_diff.jpg'),
    normal: publicUrl('textures/downtown_nor.jpg'),
    credit: 'Poly Haven — asphalt_01',
  },
};

class GroundTextureLoader {
  private loader = new THREE.TextureLoader();
  private diffuseCache = new Map<StageId, THREE.Texture>();
  private normalCache = new Map<StageId, THREE.Texture>();

  async preloadAll(): Promise<void> {
    await Promise.all(STAGE_ORDER.map((id) => this.loadBiome(id)));
  }

  private async loadBiome(stageId: StageId): Promise<void> {
    if (this.diffuseCache.has(stageId)) return;
    const src = BIOME_TEXTURE_SOURCES[stageId];
    const diffuse = await this.loader.loadAsync(src.diffuse);
    diffuse.colorSpace = THREE.SRGBColorSpace;
    diffuse.wrapS = diffuse.wrapT = THREE.RepeatWrapping;
    this.diffuseCache.set(stageId, diffuse);

    try {
      const normal = await this.loader.loadAsync(src.normal);
      normal.wrapS = normal.wrapT = THREE.RepeatWrapping;
      this.normalCache.set(stageId, normal);
    } catch {
      /* normal map optional */
    }
  }

  createGroundMaterial(
    stageId: StageId,
    width: number,
    depth: number,
    tint: number
  ): THREE.MeshToonMaterial {
    const diffuse = this.diffuseCache.get(stageId);
    if (!diffuse) {
      return new THREE.MeshToonMaterial({ color: tint });
    }

    const repeat = Math.max(width, depth) / 14;
    const diffClone = diffuse.clone();
    diffClone.repeat.set(repeat, repeat);
    diffClone.needsUpdate = true;

    const normal = this.normalCache.get(stageId);
    let normalClone: THREE.Texture | undefined;
    if (normal) {
      normalClone = normal.clone();
      normalClone.repeat.set(repeat, repeat);
      normalClone.needsUpdate = true;
    }

    const finalColor = stageId === 'desert' ? new THREE.Color(0xffffff) : new THREE.Color(tint);
    const nScale = stageId === 'desert' ? 0.95 : 0.25;

    return new THREE.MeshToonMaterial({
      map: diffClone,
      normalMap: normalClone,
      normalScale: new THREE.Vector2(nScale, nScale),
      color: finalColor,
    });
  }
}

export const groundTextureLoader = new GroundTextureLoader();
