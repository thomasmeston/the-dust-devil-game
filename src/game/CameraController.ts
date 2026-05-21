import * as THREE from 'three';
import { ISOMETRIC_PITCH, ISOMETRIC_YAW, lerp } from '../utils/constants';

export class CameraController {
  readonly camera: THREE.OrthographicCamera;
  private target = new THREE.Vector3();
  private currentPos = new THREE.Vector3();
  private baseFrustum = 18;
  private playerRadius = 1;

  constructor(aspect: number) {
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 500);
    this.updateFrustum(aspect);
    this.repositionImmediate(new THREE.Vector3(0, 0, 0));
  }

  updateFrustum(aspect: number): void {
    const size = this.baseFrustum + this.playerRadius * 2.5;
    this.camera.left = (-size * aspect) / 2;
    this.camera.right = (size * aspect) / 2;
    this.camera.top = size / 2;
    this.camera.bottom = -size / 2;
    this.camera.updateProjectionMatrix();
  }

  setPlayerRadius(radius: number): void {
    this.playerRadius = radius;
  }

  repositionImmediate(target: THREE.Vector3): void {
    this.target.copy(target);
    this.currentPos.copy(this.computeCameraPosition(target));
    this.camera.position.copy(this.currentPos);
    this.camera.lookAt(target.x, target.y + 1, target.z);
  }

  private computeCameraPosition(target: THREE.Vector3): THREE.Vector3 {
    const dist = 30 + this.playerRadius * 3;
    const offset = new THREE.Vector3(
      Math.sin(ISOMETRIC_YAW) * Math.cos(ISOMETRIC_PITCH) * dist,
      Math.sin(ISOMETRIC_PITCH) * dist,
      Math.cos(ISOMETRIC_YAW) * Math.cos(ISOMETRIC_PITCH) * dist
    );
    return target.clone().add(offset);
  }

  follow(target: THREE.Vector3, dt: number, aspect: number): void {
    this.target.copy(target);
    const desired = this.computeCameraPosition(target);
    this.currentPos.x = lerp(this.currentPos.x, desired.x, 1 - Math.pow(0.001, dt));
    this.currentPos.y = lerp(this.currentPos.y, desired.y, 1 - Math.pow(0.001, dt));
    this.currentPos.z = lerp(this.currentPos.z, desired.z, 1 - Math.pow(0.001, dt));
    this.camera.position.copy(this.currentPos);
    this.camera.lookAt(target.x, target.y + 0.5, target.z);
    this.updateFrustum(aspect);
  }

  pullBack(extra: number): void {
    this.baseFrustum = 18 + extra;
  }
}
