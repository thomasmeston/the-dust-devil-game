import * as THREE from 'three';

const ROAD_WIDTH = 5.5;
const ROAD_Y = 0.04;
const ROAD_LIMIT = 38;
const ROAD_X = [-30, 0, 30] as const;
const ROAD_Z = [-30, -10, 10, 30] as const;

type TrafficAxis = 'x' | 'z';

interface TrafficVehicle {
  mesh: THREE.Group;
  axis: TrafficAxis;
  fixed: number;
  lane: number;
  coord: number;
  speed: number;
  min: number;
  max: number;
}

/** Downtown roads plus cars/buses that drive along road centerlines. */
export class DowntownTraffic {
  private group = new THREE.Group();
  private vehicles: TrafficVehicle[] = [];

  constructor(private scene: THREE.Scene) {
    this.group.name = 'downtownTraffic';
  }

  build(width: number, height: number): void {
    this.dispose();
    this.scene.add(this.group);

    const asphalt = new THREE.MeshToonMaterial({ color: 0x374151 });
    const lineMat = new THREE.MeshToonMaterial({ color: 0xeab308 });

    for (const x of ROAD_X) {
      const road = new THREE.Mesh(
        new THREE.PlaneGeometry(ROAD_WIDTH, height * 0.92),
        asphalt
      );
      road.rotation.x = -Math.PI / 2;
      road.position.set(x, ROAD_Y, 0);
      road.receiveShadow = true;
      this.group.add(road);

      const stripe = new THREE.Mesh(
        new THREE.PlaneGeometry(0.18, height * 0.92),
        lineMat
      );
      stripe.rotation.x = -Math.PI / 2;
      stripe.position.set(x, ROAD_Y + 0.01, 0);
      this.group.add(stripe);
    }

    for (const z of ROAD_Z) {
      const road = new THREE.Mesh(
        new THREE.PlaneGeometry(width * 0.92, ROAD_WIDTH),
        asphalt
      );
      road.rotation.x = -Math.PI / 2;
      road.position.set(0, ROAD_Y, z);
      road.receiveShadow = true;
      this.group.add(road);

      const stripe = new THREE.Mesh(
        new THREE.PlaneGeometry(width * 0.92, 0.18),
        lineMat
      );
      stripe.rotation.x = -Math.PI / 2;
      stripe.position.set(0, ROAD_Y + 0.01, z);
      this.group.add(stripe);
    }

    const spawns: Omit<TrafficVehicle, 'mesh'>[] = [
      { axis: 'x', fixed: -30, lane: -0.9, coord: -28, speed: 9, min: -ROAD_LIMIT, max: ROAD_LIMIT },
      { axis: 'x', fixed: -30, lane: 0.9, coord: 18, speed: -8, min: -ROAD_LIMIT, max: ROAD_LIMIT },
      { axis: 'x', fixed: 0, lane: -0.9, coord: -10, speed: 10, min: -ROAD_LIMIT, max: ROAD_LIMIT },
      { axis: 'x', fixed: 0, lane: 0.9, coord: 32, speed: -9, min: -ROAD_LIMIT, max: ROAD_LIMIT },
      { axis: 'x', fixed: 30, lane: -0.9, coord: 5, speed: 8.5, min: -ROAD_LIMIT, max: ROAD_LIMIT },
      { axis: 'x', fixed: 30, lane: 0.9, coord: -22, speed: -7.5, min: -ROAD_LIMIT, max: ROAD_LIMIT },
      { axis: 'z', fixed: -30, lane: -0.9, coord: -15, speed: 7, min: -ROAD_LIMIT, max: ROAD_LIMIT },
      { axis: 'z', fixed: -30, lane: 0.9, coord: 25, speed: -8.5, min: -ROAD_LIMIT, max: ROAD_LIMIT },
      { axis: 'z', fixed: -10, lane: -0.9, coord: 10, speed: 9.5, min: -ROAD_LIMIT, max: ROAD_LIMIT },
      { axis: 'z', fixed: 10, lane: 0.9, coord: -30, speed: -7, min: -ROAD_LIMIT, max: ROAD_LIMIT },
      { axis: 'z', fixed: 30, lane: -0.9, coord: 0, speed: 8, min: -ROAD_LIMIT, max: ROAD_LIMIT },
      { axis: 'z', fixed: 30, lane: 0.9, coord: 20, speed: -9, min: -ROAD_LIMIT, max: ROAD_LIMIT },
    ];

    const carColors = [0xef4444, 0x3b82f6, 0x22c55e, 0xf97316, 0xa855f7, 0xe11d48];
    let colorIdx = 0;
    for (const spawn of spawns) {
      const mesh = createTrafficCar(carColors[colorIdx++ % carColors.length]);
      this.vehicles.push({ ...spawn, mesh });
      this.group.add(mesh);
      this.syncVehicleMesh(this.vehicles[this.vehicles.length - 1]);
    }

    const busSpawns: Omit<TrafficVehicle, 'mesh'>[] = [
      { axis: 'x', fixed: -10, lane: 0, coord: -32, speed: 5.5, min: -ROAD_LIMIT, max: ROAD_LIMIT },
      { axis: 'x', fixed: 10, lane: 0, coord: 30, speed: -5, min: -ROAD_LIMIT, max: ROAD_LIMIT },
      { axis: 'z', fixed: 0, lane: 0, coord: -35, speed: 6, min: -ROAD_LIMIT, max: ROAD_LIMIT },
    ];

    for (const spawn of busSpawns) {
      const mesh = createTrafficBus(0xfacc15);
      this.vehicles.push({ ...spawn, mesh });
      this.group.add(mesh);
      this.syncVehicleMesh(this.vehicles[this.vehicles.length - 1]);
    }
  }

  update(dt: number): void {
    for (const v of this.vehicles) {
      v.coord += v.speed * dt;
      if (v.coord > v.max) v.coord = v.min;
      if (v.coord < v.min) v.coord = v.max;
      this.syncVehicleMesh(v);
    }
  }

  private syncVehicleMesh(v: TrafficVehicle): void {
    if (v.axis === 'x') {
      v.mesh.position.set(v.coord, 0, v.fixed + v.lane);
      v.mesh.rotation.y = v.speed >= 0 ? -Math.PI / 2 : Math.PI / 2;
    } else {
      v.mesh.position.set(v.fixed + v.lane, 0, v.coord);
      v.mesh.rotation.y = v.speed >= 0 ? 0 : Math.PI;
    }
  }

  dispose(): void {
    this.scene.remove(this.group);
    this.group.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.geometry.dispose();
        if (Array.isArray(child.material)) child.material.forEach((m) => m.dispose());
        else child.material.dispose();
      }
    });
    this.group.clear();
    this.vehicles = [];
  }
}

function createTrafficCar(color: number): THREE.Group {
  const group = new THREE.Group();
  const mat = new THREE.MeshToonMaterial({ color });
  const body = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.55, 2.4), mat);
  body.position.y = 0.38;
  body.castShadow = true;
  group.add(body);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.5, 1.15), mat);
  cabin.position.set(0, 0.6, -0.4);
  cabin.castShadow = true;
  group.add(cabin);
  group.scale.setScalar(0.85);
  return group;
}

function createTrafficBus(color: number): THREE.Group {
  const group = new THREE.Group();
  const bodyMat = new THREE.MeshToonMaterial({ color });
  const windowMat = new THREE.MeshToonMaterial({ color: 0x93c5fd });
  const body = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.95, 4.8), bodyMat);
  body.position.y = 0.58;
  body.castShadow = true;
  group.add(body);
  for (const side of [-0.95, 0.95] as const) {
    const windows = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.45, 3.6), windowMat);
    windows.position.set(side, 0.75, 0.1);
    group.add(windows);
  }
  group.scale.setScalar(0.9);
  return group;
}
