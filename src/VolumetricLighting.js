import * as THREE from "three/webgpu";
import {
  vec3,
  Fn,
  time,
  texture3D,
  screenUV,
  uniform,
  screenCoordinate,
  pass,
} from "three/tsl";
import { ImprovedNoise } from "three/addons/math/ImprovedNoise.js";
import { bayer16 } from "three/addons/tsl/math/Bayer.js";
import { gaussianBlur } from "three/addons/tsl/display/GaussianBlurNode.js";
import { fxaa } from "three/addons/tsl/display/FXAANode.js";

export default class VolumetricLighting {
  constructor(renderer, scene, camera, options = {}) {
    this.renderer = renderer;
    this.scene = scene;
    this.camera = camera;

    // Configuration
    this.LAYER_VOLUMETRIC = 10;
    this.config = {
      volumeSize: options.volumeSize || { x: 20, y: 10, z: 20 },
      volumePosition: options.volumePosition || { x: 0, y: 2, z: 0 },
      steps: options.steps || 12,
      smokeAmount: options.smokeAmount || 2,
      intensity: options.intensity || 1,
      denoiseStrength: options.denoiseStrength || 0.6,
      resolution: options.resolution || 0.25,
      ...options,
    };

    // Uniforms
    this.smokeAmount = uniform(this.config.smokeAmount);
    this.volumetricLightingIntensity = uniform(this.config.intensity);
    this.denoiseStrength = uniform(this.config.denoiseStrength);

    this.postProcessing = null;
    this.volumetricMesh = null;
    this.volumetricLayer = null;

    this.#init();
  }

  #init() {
    this.#setupLayers();
    this.#createVolumetricMesh();
    this.#setupPostProcessing();
  }

  #setupLayers() {
    this.volumetricLayer = new THREE.Layers();
    this.volumetricLayer.disableAll();
    this.volumetricLayer.enable(this.LAYER_VOLUMETRIC);
  }

  #createTexture3D() {
    let i = 0;

    const size = 128;
    const data = new Uint8Array(size * size * size);

    const scale = 10;
    const perlin = new ImprovedNoise();

    const repeatFactor = 5.0;

    for (let z = 0; z < size; z++) {
      for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
          const nx = (x / size) * repeatFactor;
          const ny = (y / size) * repeatFactor;
          const nz = (z / size) * repeatFactor;

          const noiseValue = perlin.noise(nx * scale, ny * scale, nz * scale);

          data[i] = 128 + 128 * noiseValue;

          i++;
        }
      }
    }

    const texture = new THREE.Data3DTexture(data, size, size, size);
    texture.format = THREE.RedFormat;
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.unpackAlignment = 1;
    texture.needsUpdate = true;

    return texture;
  }

  #createVolumetricMesh() {
    const noiseTexture3D = this.#createTexture3D();

    const volumetricMaterial = new THREE.VolumeNodeMaterial();
    volumetricMaterial.steps = this.config.steps;
    volumetricMaterial.offsetNode = bayer16(screenCoordinate);

    volumetricMaterial.scatteringNode = Fn(({ positionRay }) => {
      const timeScaled = vec3(time, 0, time.mul(0.3));

      const sampleGrain = (scale, timeScale = 0.02) =>
        texture3D(
          noiseTexture3D,
          positionRay.add(timeScaled.mul(timeScale)).mul(scale).mod(1),
          0
        ).r.add(0.5);

      let density = sampleGrain(0.1);
      density = density.mul(sampleGrain(0.05, 1));
      density = density.mul(sampleGrain(0.02, 2));

      return this.smokeAmount.mix(1, density);
    });

    const geometry = new THREE.BoxGeometry(
      this.config.volumeSize.x,
      this.config.volumeSize.y,
      this.config.volumeSize.z
    );

    this.volumetricMesh = new THREE.Mesh(geometry, volumetricMaterial);
    this.volumetricMesh.receiveShadow = true;
    this.volumetricMesh.position.set(
      this.config.volumePosition.x,
      this.config.volumePosition.y,
      this.config.volumePosition.z
    );
    this.volumetricMesh.layers.disableAll();
    this.volumetricMesh.layers.enable(this.LAYER_VOLUMETRIC);

    this.scene.add(this.volumetricMesh);
    this.volumetricMaterial = volumetricMaterial;
  }

  #setupPostProcessing() {
    this.postProcessing = new THREE.PostProcessing(this.renderer);

    // Scene Pass
    const scenePass = pass(this.scene, this.camera);
    const sceneDepth = scenePass.getTextureNode("depth");

    // Apply occlusion depth to volumetric material
    this.volumetricMaterial.depthNode = sceneDepth.sample(screenUV);

    // Volumetric Lighting Pass
    const volumetricPass = pass(this.scene, this.camera, {
      depthBuffer: false,
    });
    volumetricPass.name = "Volumetric Lighting";
    volumetricPass.setLayers(this.volumetricLayer);
    volumetricPass.setResolutionScale(this.config.resolution);

    // Compose and Denoise
    const blurredVolumetricPass = gaussianBlur(
      volumetricPass,
      this.denoiseStrength
    );

    const scenePassColor = scenePass.add(
      blurredVolumetricPass.mul(this.volumetricLightingIntensity)
    );

    // Apply FXAA anti-aliasing
    this.postProcessing.outputNode = fxaa(scenePassColor);

    // Store passes for external access
    this.scenePass = scenePass;
    this.volumetricPass = volumetricPass;
    this.blurredVolumetricPass = blurredVolumetricPass;
  }

  enableLightForVolumetric(light) {
    light.layers.enable(this.LAYER_VOLUMETRIC);
  }

  setSteps(steps) {
    this.volumetricMaterial.steps = steps;
  }

  setSmokeAmount(amount) {
    this.smokeAmount.value = amount;
  }

  setIntensity(intensity) {
    this.volumetricLightingIntensity.value = intensity;
  }

  setDenoiseStrength(strength) {
    this.denoiseStrength.value = strength;
  }

  setResolution(resolution) {
    this.volumetricPass.setResolutionScale(resolution);
  }

  render() {
    this.postProcessing.render();
  }

  dispose() {
    if (this.volumetricMesh) {
      this.scene.remove(this.volumetricMesh);
      this.volumetricMesh.geometry.dispose();
      this.volumetricMesh.material.dispose();
    }
  }
}
