import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

class ModelLoader {
  private cache = new Map<string, THREE.Group>();
  private loader = new GLTFLoader();
  private loading = new Map<string, Promise<THREE.Group>>();

  async load(modelId: string): Promise<THREE.Group> {
    const cached = this.cache.get(modelId);
    if (cached) return cached.clone(true);

    const pending = this.loading.get(modelId);
    if (pending) {
      const template = await pending;
      return template.clone(true);
    }

    const promise = this.loader
      .loadAsync(`/models/${modelId}.glb`)
      .then((gltf) => {
        const group = gltf.scene;
        group.traverse((child) => {
          if (child instanceof THREE.Mesh) {
            child.castShadow = true;
            child.receiveShadow = true;
          }
        });
        this.cache.set(modelId, group);
        this.loading.delete(modelId);
        return group;
      })
      .catch((err) => {
        this.loading.delete(modelId);
        throw err;
      });

    this.loading.set(modelId, promise);
    const template = await promise;
    return template.clone(true);
  }

  async preloadAll(modelIds: string[]): Promise<void> {
    await Promise.all(modelIds.map((id) => this.load(id)));
  }

  has(modelId: string): boolean {
    return this.cache.has(modelId);
  }
}

export const modelLoader = new ModelLoader();

export function fitModelToTarget(
  root: THREE.Object3D,
  targetScale: [number, number, number],
  color: string
): void {
  const box = new THREE.Box3().setFromObject(root);
  const size = box.getSize(new THREE.Vector3());
  const safe = new THREE.Vector3(
    size.x || 1,
    size.y || 1,
    size.z || 1
  );

  root.scale.set(
    targetScale[0] / safe.x,
    targetScale[1] / safe.y,
    targetScale[2] / safe.z
  );

  root.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      child.material = new THREE.MeshToonMaterial({
        color: new THREE.Color(color),
      });
    }
  });

  const fitted = new THREE.Box3().setFromObject(root);
  root.position.y = -fitted.min.y;
}

export function meshRadius(root: THREE.Object3D): number {
  const box = new THREE.Box3().setFromObject(root);
  const size = box.getSize(new THREE.Vector3());
  return Math.max(size.x, size.z) * 0.5;
}
