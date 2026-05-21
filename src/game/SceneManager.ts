import * as THREE from 'three';

export class SceneManager {
  readonly scene: THREE.Scene;
  readonly renderer: THREE.WebGLRenderer;
  readonly container: HTMLElement;
  private ground: THREE.Mesh | null = null;
  private skyColor = 0x87ceeb;

  constructor(container: HTMLElement) {
    this.container = container;
    this.scene = new THREE.Scene();
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(this.renderer.domElement);

    const ambient = new THREE.AmbientLight(0xffffff, 0.55);
    this.scene.add(ambient);

    const sun = new THREE.DirectionalLight(0xfff5e6, 0.85);
    sun.position.set(20, 40, 15);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    sun.shadow.camera.near = 1;
    sun.shadow.camera.far = 120;
    sun.shadow.camera.left = -50;
    sun.shadow.camera.right = 50;
    sun.shadow.camera.top = 50;
    sun.shadow.camera.bottom = -50;
    this.scene.add(sun);

    window.addEventListener('resize', () => this.onResize());
  }

  setBiomeColors(groundColor: number, skyColor: number, fogColor?: number): void {
    this.skyColor = skyColor;
    this.scene.background = new THREE.Color(skyColor);
    if (fogColor !== undefined) {
      this.scene.fog = new THREE.Fog(fogColor, 40, 100);
    } else {
      this.scene.fog = null;
    }
    if (this.ground) {
      (this.ground.material as THREE.MeshToonMaterial).color.setHex(groundColor);
    }
  }

  createGround(width: number, depth: number, color: number): void {
    if (this.ground) {
      this.scene.remove(this.ground);
      this.ground.geometry.dispose();
      (this.ground.material as THREE.Material).dispose();
    }
    const geo = new THREE.PlaneGeometry(width, depth);
    const mat = new THREE.MeshToonMaterial({ color });
    this.ground = new THREE.Mesh(geo, mat);
    this.ground.rotation.x = -Math.PI / 2;
    this.ground.receiveShadow = true;
    this.scene.add(this.ground);
    this.setBiomeColors(color, this.skyColor);
  }

  render(camera: THREE.Camera): void {
    this.renderer.render(this.scene, camera);
  }

  onResize(): void {
    const w = this.container.clientWidth;
    const h = this.container.clientHeight;
    this.renderer.setSize(w, h);
  }

  get width(): number {
    return this.container.clientWidth;
  }

  get height(): number {
    return this.container.clientHeight;
  }

  dispose(): void {
    this.renderer.dispose();
  }
}
