import * as THREE from "three/webgpu";

export default class DustParticles {
  constructor(scene, options = {}) {
    this.scene = scene;

    // Configuration
    this.count = options.count ?? 200;
    this.spread = options.spread ?? { x: 15, y: 10, z: 15 };
    this.basePosition = options.basePosition ?? { x: 0, y: 0, z: 0 };
    this.particleSize = options.particleSize ?? 0.03;
    this.speed = options.speed ?? 0.1;
    this.opacity = options.opacity ?? 0.4;
    this.color = options.color ?? 0xffffff;

    this.particles = [];
    this.group = new THREE.Group();
    this.scene.add(this.group);

    this.#createParticles();
  }

  #createParticles() {
    // Create sprite texture
    const canvas = document.createElement("canvas");
    canvas.width = 32;
    canvas.height = 32;
    const ctx = canvas.getContext("2d");

    const gradient = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
    gradient.addColorStop(0, "rgba(255, 255, 255, 1)");
    gradient.addColorStop(0.6, "rgba(255, 255, 255, 1)");
    gradient.addColorStop(1, "rgba(255, 255, 255, 0)");

    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 32, 32);

    const texture = new THREE.CanvasTexture(canvas);

    const material = new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
      opacity: this.opacity,
      color: this.color,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    for (let i = 0; i < this.count; i++) {
      const sprite = new THREE.Sprite(material.clone());

      // Random position
      sprite.position.set(
        this.basePosition.x + (Math.random() - 0.5) * this.spread.x,
        this.basePosition.y + (Math.random() - 0.5) * this.spread.y,
        this.basePosition.z + (Math.random() - 0.5) * this.spread.z
      );

      // Random size
      const size = this.particleSize * (0.5 + Math.random() * 1.0);
      sprite.scale.set(size, size, size);

      // Store animation data
      sprite.userData = {
        velocity: {
          x: (Math.random() - 0.5) * 0.02,
          y: (Math.random() - 0.5) * 0.01 + 0.005,
          z: (Math.random() - 0.5) * 0.02,
        },
        phase: {
          x: Math.random() * Math.PI * 2,
          y: Math.random() * Math.PI * 2,
          z: Math.random() * Math.PI * 2,
        },
        amplitude: {
          x: 0.01 + Math.random() * 0.02,
          y: 0.005 + Math.random() * 0.01,
          z: 0.01 + Math.random() * 0.02,
        },
        initialPos: sprite.position.clone(),
      };

      this.particles.push(sprite);
      this.group.add(sprite);
    }
  }

  animate(elapsed) {
    if (!this.particles.length) return;

    for (const sprite of this.particles) {
      const { velocity, phase, amplitude, initialPos } = sprite.userData;

      // Oscillating movement
      const oscX = Math.sin(elapsed * this.speed + phase.x) * amplitude.x;
      const oscY = Math.sin(elapsed * this.speed * 0.7 + phase.y) * amplitude.y;
      const oscZ = Math.sin(elapsed * this.speed * 0.8 + phase.z) * amplitude.z;

      sprite.position.x += velocity.x * this.speed + oscX * 0.1;
      sprite.position.y += velocity.y * this.speed + oscY * 0.1;
      sprite.position.z += velocity.z * this.speed + oscZ * 0.1;

      // Wrap around when out of bounds
      const halfX = this.spread.x / 2;
      const halfY = this.spread.y / 2;
      const halfZ = this.spread.z / 2;

      if (sprite.position.x > this.basePosition.x + halfX) {
        sprite.position.x = this.basePosition.x - halfX;
      } else if (sprite.position.x < this.basePosition.x - halfX) {
        sprite.position.x = this.basePosition.x + halfX;
      }

      if (sprite.position.y > this.basePosition.y + halfY) {
        sprite.position.y = this.basePosition.y - halfY;
      } else if (sprite.position.y < this.basePosition.y - halfY) {
        sprite.position.y = this.basePosition.y + halfY;
      }

      if (sprite.position.z > this.basePosition.z + halfZ) {
        sprite.position.z = this.basePosition.z - halfZ;
      } else if (sprite.position.z < this.basePosition.z - halfZ) {
        sprite.position.z = this.basePosition.z + halfZ;
      }
    }
  }

  dispose() {
    for (const sprite of this.particles) {
      sprite.material.dispose();
      this.group.remove(sprite);
    }
    this.scene.remove(this.group);
    this.particles = [];
  }
}
