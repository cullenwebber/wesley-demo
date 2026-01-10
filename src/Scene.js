import * as THREE from "three/webgpu";
import WebGLContext from "./WebGLContext";
import ImportGltf from "./ImportGltf";
import VolumetricLighting from "./VolumetricLighting";
import PBRTextureLoader from "./PBRTextureLoader";
import GradientBackground from "./GradientBackground";
import { CameraRig } from "./CameraRig";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { TTFLoader } from "three/addons/loaders/TTFLoader.js";
import { TextGeometry } from "three/addons/geometries/TextGeometry.js";
import { Font } from "three/addons/loaders/FontLoader.js";
import FloatingPapers from "./FloatingPapers";
import DustParticles from "./DustParticles";

export default class Scene {
  constructor() {
    this.context;
    this.camera = null;
    this.cameraRig = null;
    this.width = 0;
    this.height = 0;
    this.aspectRatio = 0;
    this.scene = null;
    this.volumetricLighting = null;
    this.postProcessing = null;
    this.targetLightPos = new THREE.Vector3(0, 0, 1);
    this.floatingPapers = null;
    this.titleText = null;
    this.dustParticles = null;

    this.#init();
  }

  async #init() {
    this.#setContext();
    this.#setupScene();
    this.#setupCamera();
    this.#setupCameraRig();
    this.#addGradientBackground();
    this.#addLights();
    this.#setupPostProcessing();
    this.#setupVolumetricLighting();
    await this.#addObjects();
    this.#addFloatingPapers();
    this.#addDustParticles();
    await this.#addTitleText();
    this.#bindMouseMovement();
  }

  #setContext() {
    this.context = new WebGLContext();
  }

  #setupScene() {
    this.scene = new THREE.Scene();
    const environment = new RoomEnvironment();
    const pmremGenerator = new THREE.PMREMGenerator(this.context.renderer);
    this.envMap = pmremGenerator.fromScene(environment).texture;
    this.scene.environment = this.envMap;
    this.scene.environmentIntensity = 0.05;
    // this.scene.background = new THREE.Color(0x000000);
  }

  #setupCamera() {
    this.#calculateAspectRatio();
    this.camera = new THREE.PerspectiveCamera(45, this.aspectRatio, 0.001, 100);
    this.camera.position.z = 8;
    this.camera.position.y = -0.5;
  }

  #setupCameraRig() {
    this.cameraRig = new CameraRig(this.camera, {
      target: new THREE.Vector3(0, 0, 0),
      xLimit: [-0.25, 0.25],
      yLimit: [-0.75, -0.25],
      damping: 1.65,
    });
  }

  #addGradientBackground() {
    const gradientBg = new GradientBackground(this.camera, {
      topColor: 0x08291d,
      bottomColor: 0x047b4e,
      distance: -15,
    });

    this.scene.add(gradientBg.getMesh());
    this.gradientBackground = gradientBg;
  }

  #addLights() {
    this.pointLight2 = new THREE.PointLight(0xffffff, 3, 400, 0);
    this.pointLight2.position.x = -4;
    this.pointLight2.position.y = 4;
    this.pointLight2.position.z = 1;
    this.pointLight2.castShadow = true;
    this.pointLight2.shadow.mapSize.width = 2048;
    this.pointLight2.shadow.mapSize.height = 2048;
    this.pointLight2.shadow.radius = 10;
    this.pointLight2.shadow.intensity = 0.8;
    this.pointLight2.shadow.bias = -0.0001;
    this.scene.add(this.pointLight2);

    this.pointLight3 = new THREE.PointLight(0x92c17b, 3, 400, 0);
    this.pointLight3.position.x = 8;
    this.pointLight3.position.y = 4;
    this.pointLight3.position.z = 2;
    this.pointLight3.castShadow = true;
    this.pointLight3.shadow.mapSize.width = 2048;
    this.pointLight3.shadow.mapSize.height = 2048;
    this.pointLight3.shadow.radius = 10;
    this.pointLight3.shadow.intensity = 0.8;
    this.pointLight3.shadow.bias = -0.0001;
    this.scene.add(this.pointLight3);

    this.spotLight = new THREE.SpotLight(0x45ffb8, 10);
    this.spotLight.position.set(-1.5, 0.5, -8);
    this.spotLight.angle = -Math.PI / 16;
    this.spotLight.penumbra = 1;
    this.spotLight.decay = 1.5;
    this.spotLight.distance = 0;
    this.spotLight.castShadow = true;
    this.spotLight.shadow.intensity = 0.98;
    this.spotLight.shadow.mapSize.width = 2048;
    this.spotLight.shadow.mapSize.height = 2048;
    this.spotLight.shadow.radius = 30;
    this.spotLight.shadow.camera.near = 1;
    this.spotLight.shadow.camera.far = 15;
    this.spotLight.shadow.focus = 1;
    this.spotLight.shadow.bias = -0.0001;
    this.spotLight.target.position.set(0, 0, 0);
    this.scene.add(this.spotLight);
    this.scene.add(this.spotLight.target);

    // Mouse-following light
    this.mouseLight = new THREE.PointLight(0x0dec400, 2, 20, 2);
    this.mouseLight.position.set(0, 0, 3);
    this.mouseLight.castShadow = true;
    this.mouseLight.shadow.mapSize.width = 1024;
    this.mouseLight.shadow.mapSize.height = 1024;
    this.mouseLight.shadow.radius = 15;
    this.mouseLight.shadow.bias = -0.0001;
    this.scene.add(this.mouseLight);
  }

  #setupPostProcessing() {}

  #setupVolumetricLighting() {
    this.volumetricLighting = new VolumetricLighting(
      this.context.renderer,
      this.scene,
      this.camera,
      {
        volumeSize: { x: 15, y: 15, z: 15 },
        volumePosition: { x: 0, y: 0, z: 0 },
        steps: 16,
        smokeAmount: 0.25,
        intensity: 10,
        denoiseStrength: 0.6,
        resolution: 0.2,
      }
    );
    // Only enable the spotlight for volumetric rendering
    this.volumetricLighting.enableLightForVolumetric(this.spotLight);
  }

  async #addObjects() {
    // Load Metal007 PBR textures with scaling
    const textureLoader = new PBRTextureLoader(
      `${import.meta.env.BASE_URL}Marble019_1K-JPG`,
      {
        repeat: { x: 12, y: 12 },
      }
    );

    try {
      await textureLoader.loadTextures({
        color: "Marble019_1K-JPG_Color.jpg",
        normal: "Marble019_1K-JPG_NormalGL.jpg",
        roughness: "Marble019_1K-JPG_Roughness.jpg",
        displacement: "Marble019_1K-JPG_Displacement.jpg",
      });

      const material = new THREE.MeshStandardMaterial({
        side: THREE.DoubleSide,
        color: 0xffffff,
        roughness: 1.0,
        map: textureLoader.textures.map,
        normalMap: textureLoader.textures.normalMap,
        // roughnessMap: textureLoader.textures.roughnessMap,
      });

      new ImportGltf(`${import.meta.env.BASE_URL}wyvern-smooth_v2.glb`, {
        onLoad: (model) => {
          this.mesh = model;

          this.mesh.traverse((children) => {
            if (!children.isMesh) return;
            children.material = material;
            children.castShadow = true;
            children.receiveShadow = true;
          });
          this.mesh.rotation.y = Math.PI / 3.5;
          // this.mesh.rotation.x = -Math.PI / 12;
          this.mesh.position.y = -0.5;
          this.scene.add(model);
        },
      });
    } catch (error) {
      console.error("Failed to load textures:", error);
    }
  }

  #addFloatingPapers() {
    this.floatingPapers = new FloatingPapers(this.scene, {
      count: 20,
      basePosition: { x: 0, y: -1, z: 0 },
      paperSize: { width: 0.5, height: 0.65 },
      floatSpeed: 0.4,
      rotationSpeed: 0.2,
      spiralRadius: 4.5,
      spiralHeight: 3,
      spiralTurns: 1.5,
      spiralRotationSpeed: 0.1,
    });
  }

  #addDustParticles() {
    this.dustParticles = new DustParticles(this.scene, {
      count: 50,
      spread: { x: 20, y: 12, z: 15 },
      basePosition: { x: 0, y: 0, z: 0 },
      particleSize: 0.1,
      speed: 0.15,
      opacity: 0.01,
      color: 0x45ffb8,
    });
  }

  async #addTitleText() {
    const loader = new TTFLoader();

    return new Promise((resolve) => {
      loader.load(
        `${import.meta.env.BASE_URL}leitura.ttf`,
        async (fontData) => {
          const font = new Font(fontData);

          let geometry = new TextGeometry("WESLEY COLLEGE WESLEY COLLEGE", {
            font: font,
            size: 0.75,
            depth: 0.001,
            curveSegments: 32,
            bevelEnabled: true,
            bevelThickness: 0.05,
            bevelSize: 0.03,
            bevelSegments: 1,
          });

          // Center the geometry first
          geometry.computeBoundingBox();
          geometry.translate(
            -0.5 * (geometry.boundingBox.max.x - geometry.boundingBox.min.x),
            0,
            0
          );

          // Curve the text around Y axis
          const radius = 3; // Adjust for tighter/looser curve
          const positionAttr = geometry.attributes.position;

          for (let i = 0; i < positionAttr.count; i++) {
            const x = positionAttr.getX(i);
            const y = positionAttr.getY(i);
            const z = positionAttr.getZ(i);

            // Convert X position to angle
            const angle = x / radius;

            // Calculate new position on curve
            const newX = Math.sin(angle) * (radius + z);
            const newZ = Math.cos(angle) * (radius + z) - radius;

            positionAttr.setXYZ(i, newX, y, newZ);
          }

          positionAttr.needsUpdate = true;
          geometry.computeVertexNormals();

          // Re-center geometry after curving so rotation is around center
          geometry.computeBoundingBox();
          geometry.center();

          let textureLoader = new PBRTextureLoader(
            `${import.meta.env.BASE_URL}Metal007_1K-JPG`,
            {
              repeat: { x: 1, y: 1 },
            }
          );

          await textureLoader.loadTextures({
            color: "Metal007_1K-JPG_Color.jpg",
            normal: "Metal007_1K-JPG_NormalGL.jpg",
            roughness: "Metal007_1K-JPG_Roughness.jpg",
            displacement: "Metal007_1K-JPG_Displacement.jpg",
            metalness: "Metal007_1K-JPG_Metalness.jpg",
          });

          let material = new THREE.MeshStandardMaterial({
            side: THREE.DoubleSide,
            color: 0xe4cc35,
            metalness: 0.9,
            roughness: 1.0,
            map: textureLoader.textures.map,
            normalMap: textureLoader.textures.normalMap,
            roughnessMap: textureLoader.textures.roughnessMap,
            metalnessMap: textureLoader.textures.metalnessMap,
            flatshading: false,
            envMap: this.envMap,
          });

          // const material = new THREE.MeshStandardMaterial({
          //   color: "#E4CC35",
          //   roughness: 0.4,
          //   metalness: 1.0,
          //   envMap: this.envMap,
          // });

          this.titleText = new THREE.Mesh(geometry, material);
          this.titleText.position.set(0, -0.65, 0);
          this.titleText.rotation.x = Math.PI / 16;
          this.titleText.rotation.z = -Math.PI / 16;
          this.titleText.scale.set(0.7, 0.7, 0.7);
          // this.scene.add(this.titleText);

          geometry = new TextGeometry("Welcome to", {
            font: font,
            size: 0.25,
            depth: 0.001,
            curveSegments: 32,
          });

          let geometry2 = new TextGeometry("Wesley College", {
            font: font,
            size: 0.5,
            depth: 0.001,
            curveSegments: 32,
          });
          material = new THREE.MeshBasicMaterial({ color: 0xe4cc35 });
          let material2 = new THREE.MeshBasicMaterial({ color: 0xffffff });
          this.middleText = new THREE.Mesh(geometry, material);
          this.middleText2 = new THREE.Mesh(geometry2, material2);
          geometry.computeVertexNormals();
          geometry2.computeVertexNormals();
          geometry.computeBoundingBox();
          geometry2.computeBoundingBox();
          geometry.center();
          geometry2.center();

          this.middleText.position.set(0, -0.25, 1.5);
          this.middleText.castShadow = true;
          this.middleText2.position.set(0, -0.9, 1.5);
          this.middleText2.castShadow = true;
          this.scene.add(this.middleText);
          this.scene.add(this.middleText2);
          resolve();
        }
      );
    });
  }

  #calculateAspectRatio() {
    const { width, height } = this.context.getFullScreenDimensions();
    this.width = width;
    this.height = height;
    this.aspectRatio = this.width / this.height;
  }

  #bindMouseMovement() {
    const rangeX = 4;
    const rangeY = 2;

    if (this.mouseLight) {
      this.targetLightPos.z = this.mouseLight.position.z;
    }

    window.addEventListener("mousemove", (e) => {
      const x = (e.clientX / this.width) * 2 - 1;
      const y = -(e.clientY / this.height) * 2 + 1;

      this.targetLightPos.x = x * rangeX;
      this.targetLightPos.y = y * rangeY;
    });
  }

  animate(delta, elapsed) {
    if (this.cameraRig) {
      this.cameraRig.update(delta);
    }

    // Smoothly move mouse light to target position
    if (this.mouseLight) {
      this.mouseLight.position.lerp(this.targetLightPos, 0.08);
    }

    if (this.titleText) this.titleText.rotation.y -= delta * 0.1;

    // Animate floating papers
    if (this.floatingPapers) {
      this.floatingPapers.animate(elapsed);
    }

    // Animate dust particles
    if (this.dustParticles) {
      this.dustParticles.animate(elapsed);
    }
  }

  onResize(width, height) {
    this.width = width;
    this.height = height;
    this.aspectRatio = width / height;

    this.camera.aspect = this.aspectRatio;
    this.camera.updateProjectionMatrix();
  }
}
