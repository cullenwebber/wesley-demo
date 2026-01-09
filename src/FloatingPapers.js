import * as THREE from "three/webgpu";
import PBRTextureLoader from "./PBRTextureLoader";

export default class FloatingPapers {
  constructor(scene, options = {}) {
    this.scene = scene;
    this.papers = [];
    this.paperTexture = null;
    this.pbrTextures = null;

    // Configuration
    this.count = options.count ?? 15;
    this.basePosition = options.basePosition ?? { x: 0, y: 0, z: -2 };
    this.paperSize = options.paperSize ?? { width: 0.4, height: 0.55 };
    this.floatSpeed = options.floatSpeed ?? 0.3;
    this.rotationSpeed = options.rotationSpeed ?? 0.15;
    this.flutterSpeed = options.flutterSpeed ?? 2.0;
    this.flutterAmount = options.flutterAmount ?? 0.01;

    // Spiral configuration
    this.spiralRadius = options.spiralRadius ?? 4;
    this.spiralHeight = options.spiralHeight ?? 6;
    this.spiralTurns = options.spiralTurns ?? 1.5;
    this.spiralRotationSpeed = options.spiralRotationSpeed ?? 0.1;

    this.#init();
  }

  async #init() {
    await this.#loadTexture();
    this.#createPapers();
  }

  async #loadTexture() {
    // Load color map
    const textureLoader = new THREE.TextureLoader();
    this.paperTexture = await textureLoader.loadAsync("/paper-texture.jpg");
    this.paperTexture2 = await textureLoader.loadAsync("/back-paper.jpg");
    this.paperTexture.colorSpace = THREE.SRGBColorSpace;
    this.paperTexture2.colorSpace = THREE.SRGBColorSpace;

    this.paperMap = [this.paperTexture, this.paperTexture2];

    // Load PBR textures from Paper003
    const pbrLoader = new PBRTextureLoader("/Paper003_1K-JPG", {
      repeat: { x: 1, y: 1 },
    });

    await pbrLoader.loadTextures({
      normal: "Paper003_1K-JPG_NormalGL.jpg",
      roughness: "Paper003_1K-JPG_Roughness.jpg",
    });

    this.pbrTextures = pbrLoader.textures;
  }

  #createCurvedPaperGeometry(width, height, curveAmount, segments = 8) {
    // Create a plane with enough segments to curve
    const geometry = new THREE.PlaneGeometry(width, height, segments, segments);
    const positionAttr = geometry.attributes.position;

    // Store original positions for animation
    const originalPositions = new Float32Array(positionAttr.array.length);
    originalPositions.set(positionAttr.array);
    geometry.userData.originalPositions = originalPositions;

    // Apply initial curve
    this.#applyCurve(geometry, curveAmount, 0);

    return geometry;
  }

  #applyCurve(geometry, curveAmount, waveOffset) {
    const positionAttr = geometry.attributes.position;
    const original = geometry.userData.originalPositions;

    for (let i = 0; i < positionAttr.count; i++) {
      const x = original[i * 3];
      const y = original[i * 3 + 1];

      // Normalize x position (-0.5 to 0.5 range based on width)
      const normalizedX = x / (this.paperSize.width * 0.5);
      const normalizedY = y / (this.paperSize.height * 0.5);

      // Create a curved surface - gentle bend along X axis with wave variation along Y
      const curve = curveAmount * (normalizedX * normalizedX) * 0.2;
      const wave =
        Math.sin(normalizedY * Math.PI + waveOffset) * curveAmount * 0.5;

      positionAttr.array[i * 3 + 2] = curve + wave;
    }

    positionAttr.needsUpdate = true;
    geometry.computeVertexNormals();
  }

  #createPapers() {
    // Create slightly different paper materials for variety
    const paperColors = [0xffffff, 0xfff8f0, 0xf5f5f5, 0xfffef8, 0xf8f8ff];

    for (let i = 0; i < this.count; i++) {
      // Each paper gets its own geometry so we can animate them independently
      const baseCurve = 0.08 + Math.random() * 0.04;
      const geometry = this.#createCurvedPaperGeometry(
        this.paperSize.width,
        this.paperSize.height,
        baseCurve
      );

      const material = new THREE.MeshStandardMaterial({
        map: this.paperMap[i % this.paperMap.length],
        normalMap: this.pbrTextures.normalMap,
        roughnessMap: this.pbrTextures.roughnessMap,
        color: paperColors[i % paperColors.length],
        side: THREE.DoubleSide,
        roughness: 1.0,
        metalness: 0.0,
      });

      const paper = new THREE.Mesh(geometry, material);

      // Spiral position calculation
      const t = i / this.count;
      const angle = t * Math.PI * 2 * this.spiralTurns;
      const radius = this.spiralRadius * (0.65 + t * 0.35); // Radius grows as we go up

      paper.position.x = this.basePosition.x + Math.cos(angle) * radius;
      paper.position.y =
        this.basePosition.y +
        (t - 0.5) * this.spiralHeight +
        (Math.random() - 0.5) * 2.5;
      paper.position.z =
        this.basePosition.z +
        Math.sin(angle) * radius +
        (Math.random() - 0.5) * 1.5;

      // Face outward from spiral center with some tilt
      paper.rotation.x = (Math.random() - 0.5) * Math.PI;
      paper.rotation.y =
        -angle + Math.PI / 2 + ((Math.random() - 0.5) * Math.PI) / 4;
      paper.rotation.z = ((Math.random() - 0.5) * Math.PI) / 2;

      // Slight scale variation
      const scale = 0.8 + Math.random() * 0.4;
      paper.scale.set(scale, scale, scale);

      // Enable shadows
      paper.castShadow = true;
      paper.receiveShadow = true;

      // Store animation parameters on the mesh
      paper.userData = {
        // Spiral animation
        spiralIndex: i,
        spiralT: t,
        baseAngle: angle,
        baseRadius: radius,
        // Float animation
        floatOffset: i * 0.4,
        floatAmplitude: 0.15 + Math.random() * 0.1,
        floatSpeed: 0.2,
        // Rotation oscillation
        rotationOffsetX: i * 0.3,
        rotationOffsetY: i * 0.5,
        rotationOffsetZ: i * 0.2,
        rotationAmplitudeX: 0.2 + Math.random() * 0.3,
        rotationAmplitudeY: 0.3 + Math.random() * 0.4,
        rotationAmplitudeZ: 0.2 + Math.random() * 0.3,
        initialRotation: {
          x: paper.rotation.x,
          y: paper.rotation.y,
          z: paper.rotation.z,
        },
        initialY: paper.position.y,
        initialX: paper.position.x,
        initialZ: paper.position.z,
        // Flutter parameters
        baseCurve: baseCurve,
        flutterOffset: i * 0.5,
        flutterSpeed: 0.8 + Math.random() * 0.2,
      };

      this.papers.push(paper);
      this.scene.add(paper);
    }
  }

  animate(elapsed) {
    for (const paper of this.papers) {
      const {
        floatOffset,
        floatAmplitude,
        floatSpeed,
        rotationOffsetX,
        rotationOffsetY,
        rotationOffsetZ,
        rotationAmplitudeX,
        rotationAmplitudeY,
        rotationAmplitudeZ,
        initialRotation,
        initialY,
        initialX,
        initialZ,
        baseCurve,
        flutterOffset,
        flutterSpeed: paperFlutterSpeed,
      } = paper.userData;

      // Gentle vertical float
      const floatY =
        Math.sin(elapsed * floatSpeed + floatOffset) * floatAmplitude;
      paper.position.y = initialY + floatY;

      // Rotate the entire spiral around Y axis
      const spiralAngle = elapsed * this.spiralRotationSpeed;
      const relX = initialX - this.basePosition.x;
      const relZ = initialZ - this.basePosition.z;
      const rotatedX =
        relX * Math.cos(spiralAngle) - relZ * Math.sin(spiralAngle);
      const rotatedZ =
        relX * Math.sin(spiralAngle) + relZ * Math.cos(spiralAngle);

      // Apply rotated position with subtle sway
      paper.position.x =
        this.basePosition.x +
        rotatedX +
        Math.sin(elapsed * 0.15 + floatOffset) * 0.1;
      paper.position.z =
        this.basePosition.z +
        rotatedZ +
        Math.cos(elapsed * 0.15 + floatOffset) * 0.1;

      // Gentle rotation oscillation + follow spiral rotation
      paper.rotation.x =
        initialRotation.x +
        Math.sin(elapsed * this.rotationSpeed + rotationOffsetX) *
          rotationAmplitudeX;
      paper.rotation.y =
        initialRotation.y +
        spiralAngle +
        Math.sin(elapsed * this.rotationSpeed * 0.7 + rotationOffsetY) *
          rotationAmplitudeY;
      paper.rotation.z =
        initialRotation.z +
        Math.sin(elapsed * this.rotationSpeed * 0.5 + rotationOffsetZ) *
          rotationAmplitudeZ;

      // Animate the paper curve (flutter effect)
      const waveOffset =
        elapsed * this.flutterSpeed * paperFlutterSpeed + flutterOffset;
      const dynamicCurve =
        baseCurve + Math.sin(waveOffset) * this.flutterAmount;
      this.#applyCurve(paper.geometry, dynamicCurve, waveOffset * 0.5);
    }
  }

  dispose() {
    for (const paper of this.papers) {
      paper.geometry.dispose();
      paper.material.dispose();
      this.scene.remove(paper);
    }
    this.papers = [];
  }
}
