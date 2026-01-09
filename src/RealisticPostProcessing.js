import * as THREE from "three/webgpu";
import {
  pass,
  mrt,
  normalView,
  velocity,
  directionToColor,
  colorToDirection,
  sample,
  screenUV,
  builtinAOContext,
} from "three/tsl";
import { ao } from "three/addons/tsl/display/GTAONode.js";
import { traa } from "three/addons/tsl/display/TRAANode.js";

export default class RealisticPostProcessing {
  constructor(renderer, scene, camera, options = {}) {
    this.renderer = renderer;
    this.scene = scene;
    this.camera = camera;

    this.config = {
      aoSamples: options.aoSamples || 16,
      aoRadius: options.aoRadius || 0.25,
      aoScale: options.aoScale || 1,
      aoThickness: options.aoThickness || 1,
      aoDistanceExponent: options.aoDistanceExponent || 1,
      aoDistanceFallOff: options.aoDistanceFallOff || 1,
      aoResolutionScale: options.aoResolutionScale || 0.5,
      useTRAA: options.useTRAA !== false,
      useTemporalFiltering: options.useTemporalFiltering !== false,
      ...options,
    };

    this.postProcessing = null;
    this.aoPass = null;
    this.#init();
  }

  #init() {
    this.postProcessing = new THREE.PostProcessing(this.renderer);

    // Pre-pass for normals and velocity
    const prePass = pass(this.scene, this.camera);
    prePass.name = "Pre-Pass";
    prePass.transparent = false;

    prePass.setMRT(
      mrt({
        output: directionToColor(normalView),
        velocity: velocity,
      })
    );

    const prePassNormal = sample((uv) => {
      return colorToDirection(prePass.getTextureNode().sample(uv));
    });

    const prePassDepth = prePass.getTextureNode("depth");
    const prePassVelocity = prePass.getTextureNode("velocity");

    // Bandwidth optimization
    const normalTexture = prePass.getTexture("output");
    normalTexture.type = THREE.UnsignedByteType;

    // Scene pass
    const scenePass = pass(this.scene, this.camera);

    // GTAO - Ground Truth Ambient Occlusion
    this.aoPass = ao(prePassDepth, prePassNormal, this.camera);
    this.aoPass.resolutionScale = this.config.aoResolutionScale;
    this.aoPass.useTemporalFiltering = this.config.useTemporalFiltering;
    this.aoPass.samples.value = this.config.aoSamples;
    this.aoPass.distanceExponent.value = this.config.aoDistanceExponent;
    this.aoPass.distanceFallOff.value = this.config.aoDistanceFallOff;
    this.aoPass.radius.value = this.config.aoRadius;
    this.aoPass.scale.value = this.config.aoScale;
    this.aoPass.thickness.value = this.config.aoThickness;

    const aoPassOutput = this.aoPass.getTextureNode();

    // Apply AO to scene using builtin context
    scenePass.contextNode = builtinAOContext(aoPassOutput.sample(screenUV).r);

    // TRAA - Temporal Reprojection Anti-Aliasing
    let finalOutput = scenePass;
    if (this.config.useTRAA) {
      const traaPass = traa(scenePass, prePassDepth, prePassVelocity, this.camera);
      traaPass.useSubpixelCorrection = false;
      finalOutput = traaPass;
      this.traaPass = traaPass;
    }

    this.postProcessing.outputNode = finalOutput;

    // Store references
    this.prePass = prePass;
    this.scenePass = scenePass;
  }

  setAOSamples(samples) {
    if (this.aoPass) {
      this.aoPass.samples.value = samples;
    }
  }

  setAORadius(radius) {
    if (this.aoPass) {
      this.aoPass.radius.value = radius;
    }
  }

  setAOScale(scale) {
    if (this.aoPass) {
      this.aoPass.scale.value = scale;
    }
  }

  setAOThickness(thickness) {
    if (this.aoPass) {
      this.aoPass.thickness.value = thickness;
    }
  }

  render() {
    this.postProcessing.render();
  }

  dispose() {
    if (this.postProcessing) {
      this.postProcessing.dispose();
    }
  }
}
