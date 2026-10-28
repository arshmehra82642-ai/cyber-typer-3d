/**
 * CyberTyper 3D - Three.js Graphic & Animation Engine
 * Handles Hyperspace warp, Cyber grid, 3D Player Cannon Turret,
 * Enemy Drone meshes, 3D Laser beams, Particle Explosions & Camera Shake.
 */

class GameScene3D {
  constructor(container) {
    this.container = container;
    this.scene = null;
    this.camera = null;
    this.renderer = null;

    // 3D Objects
    this.stars = null;
    this.starCount = 1200;
    this.cyberGrid = null;
    this.playerShip = null;
    this.leftCannon = null;
    this.rightCannon = null;
    this.thrusterParticles = null;

    // Active 3D lasers & explosions
    this.lasers = [];
    this.explosions = [];

    // Camera shake
    this.shakeIntensity = 0;
    this.baseCameraPos = new THREE.Vector3(0, 2.5, 8.5);

    // Target tracking for turret
    this.currentTargetPos = null;

    this.clock = new THREE.Clock();
    this.init();
  }

  init() {
    const width = this.container.clientWidth || window.innerWidth;
    const height = this.container.clientHeight || window.innerHeight;

    // Scene & Fog
    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.FogExp2(0x020718, 0.018);

    // Camera
    this.camera = new THREE.PerspectiveCamera(60, width / height, 0.1, 1000);
    this.camera.position.copy(this.baseCameraPos);
    this.camera.lookAt(0, 1.2, -30);

    // Renderer
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.3;
    this.container.appendChild(this.renderer.domElement);

    // Lights
    const ambientLight = new THREE.AmbientLight(0x091d3e, 2.0);
    this.scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0x00f0ff, 2.5);
    dirLight.position.set(5, 15, 10);
    this.scene.add(dirLight);

    const bottomGlow = new THREE.PointLight(0xff0055, 2.0, 30);
    bottomGlow.position.set(0, -2, 4);
    this.scene.add(bottomGlow);

    // Build World Elements
    this.buildStarfield();
    this.buildCyberGrid();
    this.buildPlayerTurret();

    // Resize event
    window.addEventListener('resize', this.onResize.bind(this));

    // Animation Loop
    this.isDrivenExternally = false;
    this.animate = this.animate.bind(this);
    requestAnimationFrame(this.animate);
  }

  buildStarfield() {
    const geo = new THREE.BufferGeometry();
    const positions = new Float32Array(this.starCount * 3);
    const colors = new Float32Array(this.starCount * 3);

    for (let i = 0; i < this.starCount; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 80;
      positions[i * 3 + 1] = (Math.random() - 0.5) * 50;
      positions[i * 3 + 2] = -Math.random() * 120;

      // Color variation (cyan, purple, white)
      const r = Math.random();
      if (r < 0.4) {
        colors[i * 3] = 0.0; colors[i * 3 + 1] = 0.94; colors[i * 3 + 2] = 1.0; // Cyan
      } else if (r < 0.7) {
        colors[i * 3] = 0.7; colors[i * 3 + 1] = 0.2; colors[i * 3 + 2] = 1.0; // Violet
      } else {
        colors[i * 3] = 1.0; colors[i * 3 + 1] = 1.0; colors[i * 3 + 2] = 1.0; // White
      }
    }

    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const mat = new THREE.PointsMaterial({
      size: 0.25,
      vertexColors: true,
      transparent: true,
      opacity: 0.9,
      depthWrite: false
    });

    this.stars = new THREE.Points(geo, mat);
    this.scene.add(this.stars);
  }

  buildCyberGrid() {
    // Holographic neon floor grid
    const size = 100;
    const divisions = 50;
    this.cyberGrid = new THREE.GridHelper(size, divisions, 0x00f0ff, 0x051b3d);
    this.cyberGrid.position.y = -3.5;
    this.cyberGrid.material.transparent = true;
    this.cyberGrid.material.opacity = 0.45;
    this.scene.add(this.cyberGrid);

    // Second mirrored ceiling grid for high-speed tunnel aesthetic
    const ceilingGrid = new THREE.GridHelper(size, divisions, 0x7700ff, 0x051b3d);
    ceilingGrid.position.y = 12.0;
    ceilingGrid.material.transparent = true;
    ceilingGrid.material.opacity = 0.25;
    this.scene.add(ceilingGrid);
  }

  buildPlayerTurret() {
    // 3D Starfighter / Plasma Turret Group
    this.playerShip = new THREE.Group();
    this.playerShip.position.set(0, -0.6, 5.2);

    // Main Cockpit Fuselage
    const bodyGeo = new THREE.ConeGeometry(0.85, 3.2, 5);
    const bodyMat = new THREE.MeshStandardMaterial({
      color: 0x0a1628,
      roughness: 0.2,
      metalness: 0.85,
      emissive: 0x002244,
      emissiveIntensity: 0.3
    });
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.rotation.x = Math.PI / 2;
    this.playerShip.add(body);

    // Glowing Cockpit Visor
    const visorGeo = new THREE.BoxGeometry(0.5, 0.25, 0.9);
    const visorMat = new THREE.MeshBasicMaterial({ color: 0x00f0ff });
    const visor = new THREE.Mesh(visorGeo, visorMat);
    visor.position.set(0, 0.45, 0.2);
    this.playerShip.add(visor);

    // Swept Cyber Wings
    const wingGeo = new THREE.BoxGeometry(3.6, 0.08, 1.4);
    const wingMat = new THREE.MeshStandardMaterial({
      color: 0x112340,
      metalness: 0.9,
      roughness: 0.3
    });
    const wings = new THREE.Mesh(wingGeo, wingMat);
    wings.position.set(0, 0.05, 0.6);
    this.playerShip.add(wings);

    // Twin Plasma Cannons (Left & Right)
    const cannonGeo = new THREE.CylinderGeometry(0.08, 0.1, 1.8, 8);
    const cannonMat = new THREE.MeshStandardMaterial({
      color: 0x223344,
      metalness: 0.95
    });

    this.leftCannon = new THREE.Mesh(cannonGeo, cannonMat);
    this.leftCannon.rotation.x = Math.PI / 2;
    this.leftCannon.position.set(-1.4, 0.15, -0.2);
    this.playerShip.add(this.leftCannon);

    this.rightCannon = new THREE.Mesh(cannonGeo, cannonMat);
    this.rightCannon.rotation.x = Math.PI / 2;
    this.rightCannon.position.set(1.4, 0.15, -0.2);
    this.playerShip.add(this.rightCannon);

    // Thruster engine glow
    const engineGlowGeo = new THREE.SphereGeometry(0.35, 16, 16);
    const engineGlowMat = new THREE.MeshBasicMaterial({ color: 0x00f0ff });
    const engineGlow = new THREE.Mesh(engineGlowGeo, engineGlowMat);
    engineGlow.position.set(0, 0, 1.7);
    this.playerShip.add(engineGlow);

    this.scene.add(this.playerShip);
  }

  createDroneMesh() {
    // Creates a robotic enemy drone 3D mesh
    const droneGroup = new THREE.Group();

    // Central core orb
    const coreGeo = new THREE.IcosahedronGeometry(0.7, 1);
    const coreMat = new THREE.MeshStandardMaterial({
      color: 0xff0055,
      emissive: 0xff0044,
      emissiveIntensity: 0.9,
      roughness: 0.3,
      metalness: 0.7
    });
    const core = new THREE.Mesh(coreGeo, coreMat);
    droneGroup.add(core);

    // Outer rotating holographic ring
    const ringGeo = new THREE.TorusGeometry(1.15, 0.04, 8, 32);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0x00f0ff,
      wireframe: true
    });
    const ring1 = new THREE.Mesh(ringGeo, ringMat);
    droneGroup.add(ring1);

    const ring2 = new THREE.Mesh(ringGeo, ringMat);
    ring2.rotation.x = Math.PI / 2;
    droneGroup.add(ring2);

    droneGroup.userData = {
      core,
      ring1,
      ring2,
      baseY: 0
    };

    this.scene.add(droneGroup);
    return droneGroup;
  }

  removeDroneMesh(mesh) {
    if (!mesh) return;
    this.scene.remove(mesh);
    // Cleanup geometries & materials safely
    const disposed = new Set();
    mesh.traverse((child) => {
      if (child.geometry && !disposed.has(child.geometry)) {
        child.geometry.dispose();
        disposed.add(child.geometry);
      }
      if (child.material && !disposed.has(child.material)) {
        if (Array.isArray(child.material)) {
          child.material.forEach(m => {
            if (m && !disposed.has(m)) {
              m.dispose();
              disposed.add(m);
            }
          });
        } else {
          child.material.dispose();
          disposed.add(child.material);
        }
      }
    });
  }

  fireLaser(targetDroneMesh, onHit = null) {
    if (!targetDroneMesh) return;

    // Pick left or right cannon tip
    const useLeft = Math.random() > 0.5;
    const startPos = new THREE.Vector3(
      useLeft ? -1.4 : 1.4,
      -0.45,
      4.2
    );

    const targetPos = targetDroneMesh.position ? targetDroneMesh.position.clone() : targetDroneMesh.clone();

    // Create 3D Laser bolt
    const length = 2.6;
    const geo = new THREE.CylinderGeometry(0.07, 0.07, length, 8);
    const mat = new THREE.MeshBasicMaterial({
      color: 0x00ffff,
      transparent: true,
      opacity: 0.95
    });

    const laserMesh = new THREE.Mesh(geo, mat);
    laserMesh.position.copy(startPos);
    laserMesh.quaternion.setFromUnitVectors(
      new THREE.Vector3(0, 1, 0),
      targetPos.clone().sub(startPos).normalize()
    );

    this.scene.add(laserMesh);

    this.lasers.push({
      mesh: laserMesh,
      start: startPos,
      target: targetPos,
      progress: 0,
      speed: 6.2, // Snappy ~160ms travel time
      onHit: onHit
    });

    // Slight recoil shake
    this.shakeIntensity = Math.max(this.shakeIntensity, 0.1);

    // Aim turret slightly toward target
    this.currentTargetPos = targetPos;
  }

  createExplosion(position) {
    const count = 40;
    const geo = new THREE.BufferGeometry();
    const positions = new Float32Array(count * 3);
    const velocities = [];
    const colors = new Float32Array(count * 3);

    const colPalette = [
      new THREE.Color(0xff0055),
      new THREE.Color(0x00f0ff),
      new THREE.Color(0xffea00)
    ];

    for (let i = 0; i < count; i++) {
      positions[i * 3] = position.x;
      positions[i * 3 + 1] = position.y;
      positions[i * 3 + 2] = position.z;

      // Spherical explosion velocities
      const speed = 3.5 + Math.random() * 8.0;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(Math.random() * 2 - 1);

      velocities.push(new THREE.Vector3(
        speed * Math.sin(phi) * Math.cos(theta),
        speed * Math.sin(phi) * Math.sin(theta),
        speed * Math.cos(phi)
      ));

      const col = colPalette[Math.floor(Math.random() * colPalette.length)];
      colors[i * 3] = col.r;
      colors[i * 3 + 1] = col.g;
      colors[i * 3 + 2] = col.b;
    }

    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const mat = new THREE.PointsMaterial({
      size: 0.35,
      vertexColors: true,
      transparent: true,
      opacity: 1.0,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });

    const pSystem = new THREE.Points(geo, mat);
    this.scene.add(pSystem);

    this.explosions.push({
      points: pSystem,
      velocities,
      age: 0,
      lifetime: 0.65
    });

    // Camera shake on explosion
    this.shakeIntensity = Math.max(this.shakeIntensity, 0.22);
  }

  triggerShieldBreachShake() {
    this.shakeIntensity = 0.55;
  }

  projectToScreen(position) {
    // Converts 3D world coordinates to 2D screen pixels + scaling
    const p = position.clone();
    p.project(this.camera);

    const widthHalf = (this.container.clientWidth || window.innerWidth) / 2;
    const heightHalf = (this.container.clientHeight || window.innerHeight) / 2;

    const screenX = p.x * widthHalf + widthHalf;
    const screenY = -(p.y * heightHalf) + heightHalf;

    // Scale tag based on depth distance
    const dist = this.camera.position.distanceTo(position);
    const scale = Math.max(0.45, Math.min(1.2, 18.0 / dist));
    const isVisible = p.z < 1.0 && p.z > -1.0;

    return { x: screenX, y: screenY, scale, isVisible };
  }

  onResize() {
    if (!this.container || !this.renderer || !this.camera) return;
    const width = this.container.clientWidth || window.innerWidth;
    const height = this.container.clientHeight || window.innerHeight;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }

  animate() {
    if (this.isDrivenExternally) return;
    requestAnimationFrame(this.animate);

    const delta = Math.min(this.clock.getDelta(), 0.1);
    const elapsedTime = this.clock.getElapsedTime();
    this.renderFrame(delta, elapsedTime);
  }

  renderFrame(delta, elapsedTime) {
    // 1. Move Starfield for Hyperspace effect
    if (this.stars) {
      const pos = this.stars.geometry.attributes.position;
      for (let i = 0; i < this.starCount; i++) {
        let z = pos.getZ(i);
        z += 35 * delta;
        if (z > 15) z = -120;
        pos.setZ(i, z);
      }
      pos.needsUpdate = true;
    }

    // 2. Animate Cyber Grid
    if (this.cyberGrid) {
      this.cyberGrid.position.z = (elapsedTime * 6.0) % 2.0 - 1.0;
    }

    // 3. Smooth Camera Shake
    if (this.shakeIntensity > 0) {
      this.camera.position.x = this.baseCameraPos.x + (Math.random() - 0.5) * this.shakeIntensity;
      this.camera.position.y = this.baseCameraPos.y + (Math.random() - 0.5) * this.shakeIntensity;
      this.camera.position.z = this.baseCameraPos.z + (Math.random() - 0.5) * this.shakeIntensity;
      this.shakeIntensity = Math.max(0, this.shakeIntensity - delta * 1.8);
    } else {
      this.camera.position.copy(this.baseCameraPos);
    }

    // 4. Player Ship Floating & Target Tracking
    if (this.playerShip) {
      // Gentle hovering
      this.playerShip.position.y = -0.6 + Math.sin(elapsedTime * 3.0) * 0.08;

      if (this.currentTargetPos) {
        // Aim cannons smoothly toward locked target
        const targetDir = this.currentTargetPos.clone().sub(this.playerShip.position).normalize();
        const targetRotY = Math.atan2(targetDir.x, -targetDir.z) * 0.45;
        const targetRotX = -targetDir.y * 0.35;

        this.playerShip.rotation.y += (targetRotY - this.playerShip.rotation.y) * 0.15;
        this.playerShip.rotation.x += (targetRotX - this.playerShip.rotation.x) * 0.15;
        this.playerShip.rotation.z = -this.playerShip.rotation.y * 0.8; // Banking tilt
      } else {
        this.playerShip.rotation.y *= 0.92;
        this.playerShip.rotation.x *= 0.92;
        this.playerShip.rotation.z *= 0.92;
      }
    }

    // 5. Update 3D Lasers
    for (let i = this.lasers.length - 1; i >= 0; i--) {
      const laser = this.lasers[i];
      laser.progress += laser.speed * delta;
      laser.mesh.position.lerpVectors(laser.start, laser.target, laser.progress);

      if (laser.progress >= 1.0) {
        if (laser.onHit) {
          laser.onHit(laser.target);
        }
        this.scene.remove(laser.mesh);
        laser.mesh.geometry.dispose();
        laser.mesh.material.dispose();
        this.lasers.splice(i, 1);
      }
    }

    // 6. Update Particle Explosions
    for (let i = this.explosions.length - 1; i >= 0; i--) {
      const exp = this.explosions[i];
      exp.age += delta;

      const posAttr = exp.points.geometry.attributes.position;
      const count = exp.velocities.length;

      for (let j = 0; j < count; j++) {
        let x = posAttr.getX(j) + exp.velocities[j].x * delta;
        let y = posAttr.getY(j) + exp.velocities[j].y * delta;
        let z = posAttr.getZ(j) + exp.velocities[j].z * delta;
        posAttr.setXYZ(j, x, y, z);
      }
      posAttr.needsUpdate = true;

      const progress = exp.age / exp.lifetime;
      exp.points.material.opacity = Math.max(0, 1.0 - progress);

      if (exp.age >= exp.lifetime) {
        this.scene.remove(exp.points);
        exp.points.geometry.dispose();
        exp.points.material.dispose();
        this.explosions.splice(i, 1);
      }
    }

    // Render Scene
    this.renderer.render(this.scene, this.camera);
  }
}

window.GameScene3D = GameScene3D;
