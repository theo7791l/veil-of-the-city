import * as THREE from 'three';

export class Lighting {
  private sun!: THREE.DirectionalLight;

  constructor(private scene: THREE.Scene) {}

  build(): void {
    // Ambient warm fill
    const ambient = new THREE.AmbientLight(0xffcc88, 0.45);
    this.scene.add(ambient);

    // Sun — golden late afternoon
    this.sun = new THREE.DirectionalLight(0xffb060, 1.8);
    this.sun.position.set(60, 80, 40);
    this.sun.castShadow = true;
    this.sun.shadow.camera.near = 1;
    this.sun.shadow.camera.far = 300;
    this.sun.shadow.camera.left = -80;
    this.sun.shadow.camera.right = 80;
    this.sun.shadow.camera.top = 80;
    this.sun.shadow.camera.bottom = -80;
    this.sun.shadow.mapSize.set(2048, 2048);
    this.sun.shadow.bias = -0.0003;
    this.scene.add(this.sun);

    // Sky fill (top)
    const sky = new THREE.DirectionalLight(0x88aacc, 0.3);
    sky.position.set(-30, 50, -60);
    this.scene.add(sky);

    // Warm bounce from ground
    const bounce = new THREE.HemisphereLight(0xd4956a, 0x6a4a2a, 0.4);
    this.scene.add(bounce);
  }

  update(_dt: number): void {
    // Subtle sun sway could go here
  }
}
