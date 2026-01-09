import * as THREE from "three/webgpu";
import { color, uv, mix, fract, sin, dot, vec2 } from "three/tsl";

export default class GradientBackground {
  constructor(camera, options = {}) {
    this.camera = camera;

    this.config = {
      topColor: options.topColor || 0x1a1a2e,
      bottomColor: options.bottomColor || 0x0f3460,
      distance: options.distance || -10,
      ...options,
    };

    this.mesh = null;
    this.#init();
  }

  #init() {
    // Create a large plane that covers the view
    const geometry = new THREE.PlaneGeometry(70, 50);

    // Create gradient shader using TSL (Three.js Shading Language)
    const topColor = color(this.config.topColor);
    const bottomColor = color(this.config.bottomColor);

    // Create gradient based on UV coordinates (0-1 from bottom to top)
    // Using UV.y for smooth vertical gradient
    const uvCoordinates = uv();

    // Hash noise
    const noise = fract(
      sin(dot(uvCoordinates.mul(1000.0), vec2(12.9898, 78.233))).mul(43758.5453)
    );

    // Very small amplitude
    const dither = noise.mul(0.01);
    const gradientFactor = uvCoordinates.x
      .mul(0.2)
      .add(uvCoordinates.y)
      .mul(0.8)
      .add(dither)
      .smoothstep(0.0, 0.6);

    const gradientNode = mix(bottomColor, topColor, gradientFactor);

    const material = new THREE.MeshBasicNodeMaterial({
      colorNode: gradientNode,
      side: THREE.FrontSide,
      depthWrite: false,
    });

    this.mesh = new THREE.Mesh(geometry, material);
    this.mesh.position.z = this.config.distance;
    this.mesh.renderOrder = -1; // Render first (behind everything)

    this.material = material;
  }

  getMesh() {
    return this.mesh;
  }

  setTopColor(color) {
    this.config.topColor = color;
    this.#updateGradient();
  }

  setBottomColor(color) {
    this.config.bottomColor = color;
    this.#updateGradient();
  }

  #updateGradient() {
    const topColor = color(this.config.topColor);
    const bottomColor = color(this.config.bottomColor);

    const uvCoordinates = uv();
    const gradientNode = mix(bottomColor, topColor, uvCoordinates.y);

    this.material.colorNode = gradientNode;
    this.material.needsUpdate = true;
  }

  dispose() {
    if (this.mesh) {
      this.mesh.geometry.dispose();
      this.mesh.material.dispose();
    }
  }
}
