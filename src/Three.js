import * as THREE from "three/webgpu";
import WebGLContext from "./WebGLContext";
import Scene from "./Scene";

class Three {
  constructor(container) {
    this.container = container;
    this.context = null;
    this.clock = new THREE.Clock();
  }

  async run() {
    this.context = new WebGLContext(this.container);
    await this.context.init();
    this.scene = new Scene();
    this.#animate();
    this.#addResizeListener();
  }

  #animate() {
    const delta = this.clock.getDelta();
    const elapsed = this.clock.elapsedTime;

    this.scene.animate(delta, elapsed);
    this.#render();
    requestAnimationFrame(() => this.#animate());
  }

  #render() {
    if (this.scene.postProcessing) {
      this.scene.postProcessing.render();
    } else if (this.scene.volumetricLighting) {
      this.scene.volumetricLighting.render();
    } else {
      this.context.renderer.render(this.scene.scene, this.scene.camera);
    }
  }

  #addResizeListener() {
    window.addEventListener("resize", () => this.#onResize());
  }

  #onResize() {
    const { width, height } = this.context.getFullScreenDimensions();
    this.context.onResize(width, height);
    this.scene.onResize(width, height);
  }
}

export default Three;
