import * as THREE from "three/webgpu";

export default class CurvedFloorWall {
  constructor(options = {}) {
    this.width = options.width || 20;
    this.height = options.height || 10;
    this.floorDepth = options.floorDepth || 20;
    this.curveRadius = options.curveRadius || 2;
    this.segments = options.segments || 32;
    this.material = options.material || new THREE.MeshStandardMaterial();

    this.group = new THREE.Group();
    this.#createGeometry();
  }

  #createGeometry() {
    // Create floor plane - horizontal, extending forward
    const floorGeometry = new THREE.PlaneGeometry(
      this.width,
      this.floorDepth - this.curveRadius,
      this.segments,
      this.segments
    );
    const floor = new THREE.Mesh(floorGeometry, this.material);
    floor.rotation.x = -Math.PI / 2;
    floor.position.z = (this.floorDepth - this.curveRadius) / 2;
    floor.receiveShadow = true;
    this.group.add(floor);

    // Create wall plane - vertical, at the back
    const wallGeometry = new THREE.PlaneGeometry(
      this.width,
      this.height - this.curveRadius,
      this.segments,
      this.segments
    );
    const wall = new THREE.Mesh(wallGeometry, this.material);
    wall.position.y = (this.height - this.curveRadius) / 2 + this.curveRadius;
    wall.position.z = -this.curveRadius;
    wall.receiveShadow = true;
    this.group.add(wall);

    // Create curved transition (quarter cylinder)
    const curveGeometry = this.#createCurvedCorner();
    const curve = new THREE.Mesh(curveGeometry, this.material);
    curve.position.z = 0;
    curve.receiveShadow = true;
    this.group.add(curve);
  }

  #createCurvedCorner() {
    const geometry = new THREE.BufferGeometry();
    const vertices = [];
    const normals = [];
    const uvs = [];
    const indices = [];

    const widthSegments = this.segments;
    const curveSegments = Math.floor(this.segments / 4);

    // Generate vertices for the curved section - quarter cylinder from floor to wall
    for (let i = 0; i <= curveSegments; i++) {
      const angle = (Math.PI / 2) * (i / curveSegments);

      for (let j = 0; j <= widthSegments; j++) {
        const x = (j / widthSegments) * this.width - this.width / 2;
        // Curve goes from floor (y=0, z=0) to wall (y=radius, z=-radius)
        const y = this.curveRadius * (1 - Math.cos(angle));
        const z = -this.curveRadius * Math.sin(angle);

        vertices.push(x, y, z);

        // Calculate normals - perpendicular to surface
        const nx = 0;
        const ny = Math.cos(angle);
        const nz = Math.sin(angle);
        normals.push(nx, ny, nz);

        // UVs
        uvs.push(j / widthSegments, i / curveSegments);
      }
    }

    // Generate indices (flipped winding order for correct normals)
    for (let i = 0; i < curveSegments; i++) {
      for (let j = 0; j < widthSegments; j++) {
        const a = i * (widthSegments + 1) + j;
        const b = a + widthSegments + 1;
        const c = a + 1;
        const d = b + 1;

        indices.push(a, c, b);
        indices.push(b, c, d);
      }
    }

    geometry.setIndex(indices);
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
    geometry.setAttribute("normal", new THREE.Float32BufferAttribute(normals, 3));
    geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));

    return geometry;
  }

  getGroup() {
    return this.group;
  }

  setMaterial(material) {
    this.material = material;
    this.group.traverse((child) => {
      if (child.isMesh) {
        child.material = material;
      }
    });
  }

  dispose() {
    this.group.traverse((child) => {
      if (child.isMesh) {
        child.geometry.dispose();
        if (child.material.dispose) {
          child.material.dispose();
        }
      }
    });
  }
}
