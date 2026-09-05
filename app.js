/**
 * Knight's Tour 3D &middot; Grandmaster Algorithmic Lab
 * High-fidelity 3D WebGL Engine, Procedural PBR Shaders, Web Audio Synthesizer,
 * Warnsdorff's Heuristic vs Depth-First Backtracking Dual Arena.
 */

// Helper utility
const $ = (id) => document.getElementById(id);

// Knight moves vector
const moves = [
  [2, 1],
  [1, 2],
  [-1, 2],
  [-2, 1],
  [-2, -1],
  [-1, -2],
  [1, -2],
  [2, -1],
];

// Global simulation state
let running = false;
let paused = false;
let runId = 0;
let soundEnabled = true;
let currentStepIndex = 0;
let maxCompletedSteps = 0;
let activeJobs = [];

// ==========================================
// 1. SOUND SYNTHESIZER (Web Audio API)
// ==========================================
class SoundEngine {
  constructor() {
    this.ctx = null;
    this.initialized = false;
  }

  init() {
    if (this.initialized) return;
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
        this.initialized = true;
      }
    } catch (e) {
      console.warn('Web Audio API not supported', e);
    }
  }

  playTap(frequency = 320, volume = 0.15) {
    if (!soundEnabled) return;
    this.init();
    if (!this.ctx) return;
    if (this.ctx.state === 'suspended') this.ctx.resume();

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const filter = this.ctx.createBiquadFilter();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(frequency, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(80, this.ctx.currentTime + 0.06);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(1400, this.ctx.currentTime);

    gain.gain.setValueAtTime(volume, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.07);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start();
    osc.stop(this.ctx.currentTime + 0.08);
  }

  playWhoosh() {
    if (!soundEnabled) return;
    this.init();
    if (!this.ctx) return;
    if (this.ctx.state === 'suspended') this.ctx.resume();

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(180, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(320, this.ctx.currentTime + 0.05);
    osc.frequency.exponentialRampToValueAtTime(160, this.ctx.currentTime + 0.1);

    gain.gain.setValueAtTime(0.04, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.1);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start();
    osc.stop(this.ctx.currentTime + 0.11);
  }

  playVictory() {
    if (!soundEnabled) return;
    this.init();
    if (!this.ctx) return;
    if (this.ctx.state === 'suspended') this.ctx.resume();

    const notes = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6
    notes.forEach((freq, idx) => {
      setTimeout(() => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, this.ctx.currentTime);

        gain.gain.setValueAtTime(0.12, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.45);

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start();
        osc.stop(this.ctx.currentTime + 0.5);
      }, idx * 90);
    });
  }
}

const audio = new SoundEngine();

// ==========================================
// 2. ALGORITHMIC GRAPH ENGINE
// ==========================================
function legal(position, size) {
  const row = Math.floor(position / size);
  const column = position % size;

  return moves
    .map(([rowOffset, columnOffset]) => ({
      row: row + rowOffset,
      column: column + columnOffset,
    }))
    .filter(
      ({ row: nextRow, column: nextColumn }) => nextRow >= 0 && nextColumn >= 0 && nextRow < size && nextColumn < size,
    )
    .map(({ row: nextRow, column: nextColumn }) => nextRow * size + nextColumn);
}

function isKnightMove(from, to, size) {
  const rowDistance = Math.abs(Math.floor(from / size) - Math.floor(to / size));
  const columnDistance = Math.abs((from % size) - (to % size));
  return (rowDistance === 2 && columnDistance === 1) || (rowDistance === 1 && columnDistance === 2);
}

function isValidTour(path, size, closed) {
  if (path.length !== size * size || new Set(path).size !== path.length) return false;
  if (!path.every((square) => Number.isInteger(square) && square >= 0 && square < size * size)) return false;
  if (!path.slice(1).every((square, index) => isKnightMove(path[index], square, size))) return false;
  return !closed || isKnightMove(path[path.length - 1], path[0], size);
}

function solve(size, start, heuristic, closed, budget) {
  const visited = new Set([start]);
  const path = [start];
  const cap = heuristic ? Math.max(budget, 120000) : budget;
  const startedAt = performance.now();
  let nodes = 0;

  function dfs(position) {
    nodes += 1;
    if (nodes > cap) return false;
    if (path.length === size * size) {
      return !closed || legal(position, size).includes(start);
    }

    const next = legal(position, size).filter((square) => !visited.has(square));
    if (heuristic) {
      // Warnsdorff's Rule: lowest onward degree first
      next.sort((a, b) => {
        const degA = legal(a, size).filter((sq) => !visited.has(sq)).length;
        const degB = legal(b, size).filter((sq) => !visited.has(sq)).length;
        if (degA !== degB) return degA - degB;
        // Secondary tie-breaker: prioritize edge distance or start proximity
        return 0;
      });
    }

    for (const square of next) {
      visited.add(square);
      path.push(square);
      if (dfs(square)) return true;
      path.pop();
      visited.delete(square);
    }
    return false;
  }

  const found = dfs(start);
  const success = found && isValidTour(path, size, closed);
  return {
    path: success ? path : [...path],
    nodes,
    success,
    time: performance.now() - startedAt,
    capped: nodes > cap,
  };
}

// ==========================================
// 3. 3D WEBGL ENGINE & SCENE GENERATION
// ==========================================
class Board3DView {
  constructor(containerId, isCoralTheme = false) {
    this.container = $(containerId);
    this.isCoralTheme = isCoralTheme;
    this.size = 8;
    this.tileSize = 1.0;
    this.tileGap = 0.015;
    this.tileHeight = 0.22;

    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.controls = null;
    this.boardGroup = null;
    this.tiles = [];
    this.knight = null;
    this.trailLine = null;
    this.stepSprites = [];
    this.hoverMesh = null;
    this.activeTween = null;

    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2(-999, -999);
    this.hoveredTile = null;

    this.initScene();
  }

  initScene() {
    this.container.replaceChildren();

    // Scene
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0a0c10);

    // Camera
    const width = this.container.clientWidth || 500;
    const height = this.container.clientHeight || 500;
    this.camera = new THREE.PerspectiveCamera(38, width / height, 0.1, 100);

    // Renderer
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    if (THREE.ACESFilmicToneMapping) {
      this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
      this.renderer.toneMappingExposure = 1.25;
    }
    this.container.appendChild(this.renderer.domElement);

    // Controls
    if (typeof THREE.OrbitControls !== 'undefined') {
      this.controls = new THREE.OrbitControls(this.camera, this.renderer.domElement);
      this.controls.enableDamping = true;
      this.controls.dampingFactor = 0.06;
      this.controls.maxPolarAngle = Math.PI / 2 - 0.05; // Don't flip under board
      this.controls.minDistance = 3;
      this.controls.maxDistance = 25;
    }

    // Lighting setup (Warm Amber/Studio reflection matching reference image)
    const ambientLight = new THREE.AmbientLight(0xfff6ea, 0.72);
    this.scene.add(ambientLight);

    // Directional Key Light
    this.dirLight = new THREE.DirectionalLight(0xffedd0, 1.35);
    this.dirLight.position.set(7, 14, 8);
    this.dirLight.castShadow = true;
    this.dirLight.shadow.mapSize.width = 1024;
    this.dirLight.shadow.mapSize.height = 1024;
    this.dirLight.shadow.camera.near = 0.5;
    this.dirLight.shadow.camera.far = 35;
    const d = 8;
    this.dirLight.shadow.camera.left = -d;
    this.dirLight.shadow.camera.right = d;
    this.dirLight.shadow.camera.top = d;
    this.dirLight.shadow.camera.bottom = -d;
    this.dirLight.shadow.bias = -0.0006;
    this.scene.add(this.dirLight);

    // Warm Golden Rim Light
    const rimLight = new THREE.PointLight(this.isCoralTheme ? 0xff8d76 : 0xecb653, 1.3, 30);
    rimLight.position.set(-8, 6, -8);
    this.scene.add(rimLight);

    // Cool Fill Light for specular contrast
    const fillLight = new THREE.DirectionalLight(0x63d2ff, 0.45);
    fillLight.position.set(-6, 8, 7);
    this.scene.add(fillLight);

    // Dark Glossy Surrounding Floor (like reference picture)
    const floorGeo = new THREE.PlaneGeometry(50, 50);
    const floorMat = new THREE.MeshStandardMaterial({
      color: 0x07080a,
      roughness: 0.35,
      metalness: 0.5,
    });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -0.15;
    floor.receiveShadow = true;
    this.scene.add(floor);

    // Event listeners for raycasting
    this.renderer.domElement.addEventListener('mousemove', (e) => this.onMouseMove(e));
    this.renderer.domElement.addEventListener('click', (e) => this.onClick(e));
    window.addEventListener('resize', () => this.onWindowResize());

    // Animation render loop
    this.animate = this.animate.bind(this);
    requestAnimationFrame(this.animate);
  }

  animate() {
    requestAnimationFrame(this.animate);
    if (this.controls) this.controls.update();

    // Raycast hover check
    this.checkHover();

    this.renderer.render(this.scene, this.camera);
  }

  onWindowResize() {
    if (!this.container || !this.renderer || !this.camera) return;
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;
    if (width === 0 || height === 0) return;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }

  // ==========================================
  // 3D BOARD GENERATION
  // ==========================================
  buildBoard(size) {
    this.size = size;

    if (this.boardGroup) {
      this.scene.remove(this.boardGroup);
    }
    this.boardGroup = new THREE.Group();
    this.tiles = [];
    this.stepSprites = [];

    const boardSpan = size * (this.tileSize + this.tileGap);
    const halfSpan = boardSpan / 2;
    const frameThickness = 0.85;
    const frameHeight = 0.2;
    const tileThickness = 0.04;
    const frameWidth = boardSpan + frameThickness * 2;

    // 1. Base Wooden Frame (Warm Walnut Wood matching reference photo)
    const frameGeo = new THREE.BoxGeometry(frameWidth, frameHeight, frameWidth);
    const frameMat = new THREE.MeshStandardMaterial({
      color: this.isCoralTheme ? 0x281215 : 0x76381b,
      roughness: 0.32,
      metalness: 0.15,
    });
    const frameMesh = new THREE.Mesh(frameGeo, frameMat);
    frameMesh.position.y = frameHeight / 2;
    frameMesh.receiveShadow = true;
    this.boardGroup.add(frameMesh);

    // 2. Inner Cream Pinstripe Frame (4 perimeter strips framing the squares)
    const stripWidth = 0.04;
    const pinstripeMat = new THREE.MeshStandardMaterial({
      color: this.isCoralTheme ? 0xf9e7e1 : 0xf5e4bd,
      roughness: 0.3,
      metalness: 0.05,
    });
    const pY = frameHeight + tileThickness / 2;

    const northStrip = new THREE.Mesh(
      new THREE.BoxGeometry(boardSpan + stripWidth * 2, tileThickness, stripWidth),
      pinstripeMat,
    );
    northStrip.position.set(0, pY, -halfSpan - stripWidth / 2);
    this.boardGroup.add(northStrip);

    const southStrip = new THREE.Mesh(
      new THREE.BoxGeometry(boardSpan + stripWidth * 2, tileThickness, stripWidth),
      pinstripeMat,
    );
    southStrip.position.set(0, pY, halfSpan + stripWidth / 2);
    this.boardGroup.add(southStrip);

    const westStrip = new THREE.Mesh(new THREE.BoxGeometry(stripWidth, tileThickness, boardSpan), pinstripeMat);
    westStrip.position.set(-halfSpan - stripWidth / 2, pY, 0);
    this.boardGroup.add(westStrip);

    const eastStrip = new THREE.Mesh(new THREE.BoxGeometry(stripWidth, tileThickness, boardSpan), pinstripeMat);
    eastStrip.position.set(halfSpan + stripWidth / 2, pY, 0);
    this.boardGroup.add(eastStrip);

    // 3. High-Contrast Tournament Chessboard Tiles (Light Maple Cream vs Warm Walnut Caramel)
    const amberTileMat = new THREE.MeshPhysicalMaterial({
      color: this.isCoralTheme ? 0xf9e7e1 : 0xf5e4bd, // Light Maple Cream Ivory
      roughness: 0.22,
      metalness: 0.02,
      clearcoat: 0.85,
      clearcoatRoughness: 0.1,
      reflectivity: 0.8,
    });

    const mahoganyTileMat = new THREE.MeshPhysicalMaterial({
      color: this.isCoralTheme ? 0xac3d35 : 0xb85b24, // Warm Caramel Walnut Wood
      roughness: 0.24,
      metalness: 0.02,
      clearcoat: 0.85,
      clearcoatRoughness: 0.1,
      reflectivity: 0.8,
    });

    const tileGeo = new THREE.BoxGeometry(this.tileSize, tileThickness, this.tileSize);

    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        const index = r * size + c;
        const isLight = (r + c) % 2 === 0;
        const mat = isLight ? amberTileMat.clone() : mahoganyTileMat.clone();

        const tileMesh = new THREE.Mesh(tileGeo, mat);
        const x = c * (this.tileSize + this.tileGap) - halfSpan + this.tileSize / 2;
        const z = r * (this.tileSize + this.tileGap) - halfSpan + this.tileSize / 2;
        tileMesh.position.set(x, frameHeight + tileThickness / 2, z);
        tileMesh.castShadow = true;
        tileMesh.receiveShadow = true;

        tileMesh.userData = {
          row: r,
          column: c,
          index: index,
          name: `${String.fromCharCode(65 + c)}${r + 1}`,
          baseColor: isLight ? (this.isCoralTheme ? 0xf9e7e1 : 0xf5e4bd) : this.isCoralTheme ? 0xac3d35 : 0xb85b24,
        };

        this.boardGroup.add(tileMesh);
        this.tiles.push(tileMesh);
      }
    }

    // 4. Border Coordinate Labels (Files A-H & Ranks 1-8) along outer wood frame
    this.addBorderCoordinates(size, halfSpan, frameHeight);

    // 5. Hover Highlight Inlay
    const hoverGeo = new THREE.PlaneGeometry(this.tileSize * 0.96, this.tileSize * 0.96);
    const hoverMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.35,
      side: THREE.DoubleSide,
    });
    this.hoverMesh = new THREE.Mesh(hoverGeo, hoverMat);
    this.hoverMesh.rotation.x = -Math.PI / 2;
    this.hoverMesh.position.y = frameHeight + tileThickness + 0.003;
    this.hoverMesh.visible = false;
    this.boardGroup.add(this.hoverMesh);

    // 6. 3D Path Trail Line
    const trailGeo = new THREE.BufferGeometry();
    const trailMat = new THREE.LineBasicMaterial({
      color: this.isCoralTheme ? 0xffb5a6 : 0x221100,
      linewidth: 3,
      transparent: true,
      opacity: 0.85,
    });
    this.trailLine = new THREE.Line(trailGeo, trailMat);
    this.boardGroup.add(this.trailLine);

    this.scene.add(this.boardGroup);

    // Build 3D Golden Knight Piece
    this.buildKnight();

    // Default Camera Framing
    this.setCameraPreset('cinematic');
  }

  addBorderCoordinates(size, halfSpan, frameHeight) {
    const offset = halfSpan + 0.44;
    const labelY = frameHeight + 0.025;

    // Files (Columns A, B, C... along top and bottom)
    for (let c = 0; c < size; c++) {
      const char = String.fromCharCode(65 + c);
      const x = c * (this.tileSize + this.tileGap) - halfSpan + this.tileSize / 2;
      this.createBorderTextSprite(char, x, labelY, -offset);
      this.createBorderTextSprite(char, x, labelY, offset);
    }

    // Ranks (Rows 1, 2, 3... along left and right)
    for (let r = 0; r < size; r++) {
      const num = String(r + 1);
      const z = r * (this.tileSize + this.tileGap) - halfSpan + this.tileSize / 2;
      this.createBorderTextSprite(num, -offset, labelY, z);
      this.createBorderTextSprite(num, offset, labelY, z);
    }
  }

  createBorderTextSprite(text, x, y, z) {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 74px "DM Mono", -apple-system, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = 'rgba(0, 0, 0, 0.75)';
    ctx.shadowBlur = 8;
    ctx.fillText(text, 64, 64);

    const texture = new THREE.CanvasTexture(canvas);
    const spriteMat = new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
      depthTest: true,
    });
    const sprite = new THREE.Sprite(spriteMat);
    sprite.scale.set(0.4, 0.4, 1);
    sprite.position.set(x, y, z);
    this.boardGroup.add(sprite);
  }

  // ==========================================
  // 3D PROCEDURAL CHESS KNIGHT MODEL
  // ==========================================
  buildKnight() {
    if (this.knight) {
      this.scene.remove(this.knight);
    }

    this.knight = new THREE.Group();

    // Polished Brass/Gold Material (reference photo)
    const goldMat = new THREE.MeshStandardMaterial({
      color: this.isCoralTheme ? 0xffc4b8 : 0xecb653,
      roughness: 0.22,
      metalness: 0.88,
      envMapIntensity: 1.5,
    });

    // Tiered Base Pedestal
    const baseGeo1 = new THREE.CylinderGeometry(0.38, 0.44, 0.1, 28);
    const base1 = new THREE.Mesh(baseGeo1, goldMat);
    base1.position.y = 0.05;
    base1.castShadow = true;
    base1.receiveShadow = true;
    this.knight.add(base1);

    const baseGeo2 = new THREE.CylinderGeometry(0.3, 0.36, 0.08, 28);
    const base2 = new THREE.Mesh(baseGeo2, goldMat);
    base2.position.y = 0.14;
    base2.castShadow = true;
    this.knight.add(base2);

    // Collar Torus
    const torusGeo = new THREE.TorusGeometry(0.26, 0.05, 16, 32);
    const torus = new THREE.Mesh(torusGeo, goldMat);
    torus.rotation.x = Math.PI / 2;
    torus.position.y = 0.2;
    torus.castShadow = true;
    this.knight.add(torus);

    // Sculpted Horse Head Shape (Extruded silhouette)
    const shape = new THREE.Shape();
    shape.moveTo(-0.25, 0);
    shape.lineTo(0.25, 0);
    shape.quadraticCurveTo(0.32, 0.35, 0.18, 0.68); // arched neck
    shape.lineTo(0.22, 0.88); // top of mane
    shape.lineTo(0.12, 1.05); // ear tip
    shape.lineTo(0.04, 0.88); // between ears
    shape.lineTo(-0.02, 0.98); // second ear tip
    shape.lineTo(-0.06, 0.8); // forehead
    shape.quadraticCurveTo(-0.35, 0.65, -0.32, 0.45); // snout
    shape.lineTo(-0.2, 0.42); // mouth line
    shape.quadraticCurveTo(-0.16, 0.22, -0.25, 0); // chest curve

    const extrudeSettings = {
      depth: 0.26,
      bevelEnabled: true,
      bevelSegments: 4,
      steps: 1,
      bevelSize: 0.035,
      bevelThickness: 0.035,
    };

    const headGeo = new THREE.ExtrudeGeometry(shape, extrudeSettings);
    headGeo.center();
    const headMesh = new THREE.Mesh(headGeo, goldMat);
    headMesh.position.y = 0.72;
    headMesh.castShadow = true;
    this.knight.add(headMesh);

    // Eyes
    const eyeGeo = new THREE.SphereGeometry(0.035, 12, 12);
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0x221308 });
    const eyeR = new THREE.Mesh(eyeGeo, eyeMat);
    eyeR.position.set(-0.14, 0.84, 0.15);
    const eyeL = new THREE.Mesh(eyeGeo, eyeMat);
    eyeL.position.set(-0.14, 0.84, -0.15);
    this.knight.add(eyeR);
    this.knight.add(eyeL);

    this.knight.scale.set(0.78, 0.78, 0.78);
    this.scene.add(this.knight);
  }

  // ==========================================
  // CAMERA PRESETS
  // ==========================================
  setCameraPreset(mode) {
    if (!this.camera || !this.controls) return;
    const boardSpan = this.size * (this.tileSize + this.tileGap);
    const dist = boardSpan * 1.35;

    this.controls.target.set(0, this.tileHeight / 2, 0);

    if (mode === 'cinematic') {
      // 3/4 Dramatic Perspective matching user's photo
      this.camera.position.set(dist * 0.85, dist * 0.95, dist * 1.15);
    } else if (mode === 'iso') {
      // Classic Isometric 45-degree angle
      this.camera.position.set(dist * 1.1, dist * 1.1, dist * 1.1);
    } else if (mode === 'top') {
      // Top-Down Tactical View
      this.camera.position.set(0, dist * 1.8, 0.01);
    } else if (mode === 'reset') {
      this.camera.position.set(dist * 0.85, dist * 0.95, dist * 1.15);
    }

    this.camera.lookAt(0, this.tileHeight / 2, 0);
    this.controls.update();
  }

  // ==========================================
  // TILE INTERACTION & RAYCASTING
  // ==========================================
  onMouseMove(e) {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
  }

  checkHover() {
    if (!this.boardGroup || !this.tiles.length) return;
    this.raycaster.setFromCamera(this.mouse, this.camera);
    const intersects = this.raycaster.intersectObjects(this.tiles);

    const tooltipId = this.isCoralTheme ? 'backTileHover' : 'warnTileHover';
    const tooltip = $(tooltipId);

    if (intersects.length > 0) {
      const hit = intersects[0].object;
      this.hoveredTile = hit;
      if (this.hoverMesh) {
        this.hoverMesh.position.x = hit.position.x;
        this.hoverMesh.position.z = hit.position.z;
        this.hoverMesh.visible = true;
      }
      if (tooltip) {
        tooltip.textContent = `Square: ${hit.userData.name} (#${hit.userData.index + 1})`;
        tooltip.classList.add('visible');
      }
    } else {
      this.hoveredTile = null;
      if (this.hoverMesh) this.hoverMesh.visible = false;
      if (tooltip) tooltip.classList.remove('visible');
    }
  }

  onClick() {
    if (this.hoveredTile && !running) {
      const pos = this.hoveredTile.userData.index;
      $('start').value = String(pos);
      audio.playTap(440, 0.2);
      reset();
    }
  }

  getSquareCoords(position) {
    const tile = this.tiles[position];
    if (!tile) return { x: 0, y: 0.22, z: 0 };
    return {
      x: tile.position.x,
      y: 0.24,
      z: tile.position.z,
    };
  }

  placeKnight(position) {
    const coords = this.getSquareCoords(position);
    this.knight.position.set(coords.x, coords.y, coords.z);
  }

  // ==========================================
  // TRAIL & STEP NUMBER RENDERING
  // ==========================================
  clearTrail() {
    // Reset tile colors
    this.tiles.forEach((tile) => {
      tile.material.color.setHex(tile.userData.baseColor);
      tile.material.emissive.setHex(0x000000);
      tile.position.y = 0.22;
    });

    // Clear step sprites
    this.stepSprites.forEach((sprite) => this.boardGroup.remove(sprite));
    this.stepSprites = [];

    // Clear line
    this.trailLine.geometry.dispose();
    this.trailLine.geometry = new THREE.BufferGeometry();
  }

  createStepBadge(number, coords) {
    if (!$('showLabels').checked) return;

    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = this.isCoralTheme ? 'rgba(255, 125, 102, 0.9)' : 'rgba(230, 176, 76, 0.9)';
    ctx.beginPath();
    ctx.arc(32, 32, 28, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#140c04';
    ctx.font = 'bold 30px "DM Mono", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(number), 32, 33);

    const texture = new THREE.CanvasTexture(canvas);
    const spriteMat = new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
      depthTest: false,
    });
    const sprite = new THREE.Sprite(spriteMat);
    sprite.scale.set(0.38, 0.38, 1);
    sprite.position.set(coords.x, coords.y + 0.15, coords.z);

    this.boardGroup.add(sprite);
    this.stepSprites.push(sprite);
  }

  renderPath(path, visibleMoves) {
    const showTrail = $('showTrail').checked;
    const trailPoints = [];

    path.slice(0, visibleMoves).forEach((pos, idx) => {
      const tile = this.tiles[pos];
      if (tile) {
        // Highlight visited tile with gentle emissive glow
        tile.material.emissive.setHex(this.isCoralTheme ? 0x4a181b : 0x4a3410);
        const coords = this.getSquareCoords(pos);
        trailPoints.push(new THREE.Vector3(coords.x, coords.y + 0.08, coords.z));

        // Add badge if first time rendering this step
        if (this.stepSprites.length < idx + 1) {
          this.createStepBadge(idx + 1, coords);
        }
      }
    });

    if (showTrail && trailPoints.length > 1) {
      this.trailLine.geometry.dispose();
      this.trailLine.geometry = new THREE.BufferGeometry().setFromPoints(trailPoints);
      this.trailLine.visible = true;
    } else {
      this.trailLine.visible = false;
    }

    if (visibleMoves > 0) {
      this.placeKnight(path[visibleMoves - 1]);
    }
  }

  // ==========================================
  // PARABOLIC 3D JUMP ANIMATION
  // ==========================================
  async animateJump(fromPos, toPos, duration) {
    const fromCoords = this.getSquareCoords(fromPos);
    const toCoords = this.getSquareCoords(toPos);

    // Calculate facing angle in Y
    const dx = toCoords.x - fromCoords.x;
    const dz = toCoords.z - fromCoords.z;
    const targetAngle = Math.atan2(dx, dz) - Math.PI / 2;
    this.knight.rotation.y = targetAngle;

    const jumpHeight = 0.9;
    const startTime = performance.now();

    audio.playWhoosh();

    return new Promise((resolve) => {
      const step = (now) => {
        const elapsed = now - startTime;
        const progress = Math.min(1, elapsed / duration);

        // Parabolic height curve
        const curX = fromCoords.x + dx * progress;
        const curZ = fromCoords.z + dz * progress;
        const curY = fromCoords.y + jumpHeight * 4 * progress * (1 - progress);

        this.knight.position.set(curX, curY, curZ);

        // Pitch rotation during hop
        this.knight.rotation.z = Math.sin(progress * Math.PI) * 0.18;

        if (progress < 1) {
          requestAnimationFrame(step);
        } else {
          // Landing squash & sound
          this.knight.position.set(toCoords.x, toCoords.y, toCoords.z);
          this.knight.rotation.z = 0;
          audio.playTap(330, 0.18);
          resolve();
        }
      };
      requestAnimationFrame(step);
    });
  }
}

// Instantiate the dual 3D boards
let warnBoard3D = null;
let backBoard3D = null;

function init3D() {
  warnBoard3D = new Board3DView('warn3dContainer', false);
  backBoard3D = new Board3DView('back3dContainer', true);
}

// ==========================================
// 4. METRICS, SETTINGS & CONTROLS
// ==========================================
function setMetrics(prefix, result, visibleMoves) {
  const explored = Math.min(
    result.nodes,
    Math.max(visibleMoves, Math.floor((result.nodes * visibleMoves) / result.path.length)),
  );
  const total = $('size').value ** 2;
  $(`${prefix}Moves`).textContent = `${visibleMoves} / ${total}`;
  $(`${prefix}Nodes`).textContent = explored.toLocaleString();
  $(`${prefix}Time`).textContent = result.time < 1 ? '<1 ms' : `${result.time.toFixed(1)} ms`;
  $(`${prefix}Progress`).style.width = `${(visibleMoves / total) * 100}%`;
}

function updateStartOptions(size) {
  const start = $('start');
  const choices = [
    0,
    size - 1,
    Math.floor(size / 2) * size + Math.floor(size / 2),
    Math.floor((size - 1) / 2) * size + Math.floor((size - 1) / 2),
  ];
  const uniqueChoices = [...new Set(choices)];
  start.replaceChildren(
    ...uniqueChoices.map((position) => {
      const option = document.createElement('option');
      option.value = position;
      const c = position % size;
      const r = Math.floor(position / size);
      option.textContent = `${String.fromCharCode(65 + c)}${r + 1} (#${position + 1})`;
      return option;
    }),
  );
  start.value = String(uniqueChoices[Math.min(2, uniqueChoices.length - 1)]);
}

function settings() {
  return {
    size: Number($('size').value),
    start: Number($('start').value),
    closed: $('closed').checked,
    loop: $('closed').checked && $('loop').checked,
    budget: Number($('budget').value),
  };
}

// ==========================================
// 5. ANIMATION EXECUTION & PLAYBACK
// ==========================================
async function run(one) {
  if (running && !paused) return;
  running = true;
  paused = false;
  $('pauseBtn').disabled = false;
  $('stepBackBtn').disabled = true;
  $('stepForwardBtn').disabled = true;

  const token = ++runId;
  const currentSettings = settings();

  $('run').textContent = 'CALCULATING\u2026';
  $('topStatus').textContent = 'RUNNING';
  const kinds = one ? [one] : ['warn', 'back'];
  kinds.forEach((prefix) => {
    const statusEl = $(`${prefix}Status`);
    statusEl.textContent = 'SEARCHING';
    statusEl.className = 'metric-value status-running';
  });

  await new Promise((resolve) => setTimeout(resolve, 60));

  const jobs = kinds.map((prefix) => ({
    prefix,
    view: prefix === 'warn' ? warnBoard3D : backBoard3D,
    result: solve(
      currentSettings.size,
      currentSettings.start,
      prefix === 'warn',
      currentSettings.closed,
      currentSettings.budget,
    ),
  }));

  activeJobs = jobs;

  // Update Telemetry & Insights
  const warnJob = jobs.find((j) => j.prefix === 'warn');
  const backJob = jobs.find((j) => j.prefix === 'back');

  if (warnJob) {
    const eff = warnJob.result.success
      ? '100% (Direct Walk)'
      : `${Math.round((warnJob.result.path.length / currentSettings.size ** 2) * 100)}%`;
    $('warnEfficiency').textContent = eff;
  }
  if (backJob) {
    const ratio = backJob.result.capped
      ? `Explored ${backJob.result.nodes.toLocaleString()} (Limit reached)`
      : `${backJob.result.nodes.toLocaleString()} nodes`;
    $('backPruningRatio').textContent = ratio;
  }

  $('graphType').textContent = currentSettings.closed ? 'Hamiltonian Cycle' : 'Hamiltonian Path';

  $('insightTitle').textContent = jobs.some(({ result }) => result.success)
    ? 'Valid Knight Tour discovered. Visualizing 3D Hamiltonian trajectory.'
    : 'No complete tour within current search budget.';

  const isLooping = currentSettings.loop && jobs.some(({ result }) => result.success);
  $('run').innerHTML = isLooping ? '<span>&#8634;</span> LOOPING...' : '<span>&#9654;</span> ANIMATING...';
  if (isLooping) $('topStatus').textContent = 'LOOPING';

  // Animate solvers
  await Promise.all(
    jobs.map(({ prefix, view, result }) =>
      animateSolver(prefix, view, result, currentSettings.size, token, currentSettings.loop),
    ),
  );

  if (token === runId) {
    $('topStatus').textContent = 'COMPLETE';
    $('run').innerHTML = '<span>&#9654;</span> RACE BOTH SOLVERS';
    $('pauseBtn').disabled = true;
    $('stepBackBtn').disabled = false;
    $('stepForwardBtn').disabled = false;
    running = false;

    if (jobs.some((j) => j.result.success)) {
      audio.playVictory();
    }
  }
}

async function animateSolver(prefix, view, result, size, token, loop) {
  const delay = Math.max(15, Number($('speed').value));
  const jumpDuration = Math.min(Math.round(delay * 0.78), 280);
  const repeat = loop && result.success;

  while (token === runId) {
    view.clearTrail();
    view.renderPath(result.path, 1);
    setMetrics(prefix, result, 1);

    for (let move = 2; move <= result.path.length; move += 1) {
      if (token !== runId) return;

      // Check pause
      while (paused && token === runId) {
        await new Promise((r) => setTimeout(r, 80));
      }

      const fromPos = result.path[move - 2];
      const toPos = result.path[move - 1];

      await view.animateJump(fromPos, toPos, jumpDuration);
      if (token !== runId) return;

      view.renderPath(result.path, move);
      setMetrics(prefix, result, move);
      currentStepIndex = move;

      const sleepTime = Math.max(5, delay - jumpDuration);
      await new Promise((resolve) => setTimeout(resolve, sleepTime));
    }

    if (!repeat) {
      const statusEl = $(`${prefix}Status`);
      if (result.success) {
        statusEl.textContent = $('closed').checked ? 'CLOSED \u2713' : 'OPEN \u2713';
        statusEl.className = 'metric-value status-success';
      } else {
        statusEl.textContent = result.capped ? 'LIMITED' : 'NO TOUR';
        statusEl.className = 'metric-value status-limited';
      }
      return;
    }

    // Closed loop return
    const statusEl = $(`${prefix}Status`);
    statusEl.textContent = 'LOOPING \u21bb';
    statusEl.className = 'metric-value status-success';

    await view.animateJump(result.path[result.path.length - 1], result.path[0], jumpDuration);
    if (token !== runId) return;

    view.renderPath([...result.path, result.path[0]], result.path.length + 1);
    await new Promise((resolve) => setTimeout(resolve, 800));
  }
}

function reset() {
  runId += 1;
  running = false;
  paused = false;
  $('pauseBtn').disabled = true;
  $('stepBackBtn').disabled = true;
  $('stepForwardBtn').disabled = true;

  const size = Number($('size').value);
  const startPos = Number($('start').value);

  if (warnBoard3D) {
    warnBoard3D.buildBoard(size);
    warnBoard3D.clearTrail();
    warnBoard3D.placeKnight(startPos);
  }
  if (backBoard3D) {
    backBoard3D.buildBoard(size);
    backBoard3D.clearTrail();
    backBoard3D.placeKnight(startPos);
  }

  ['warn', 'back'].forEach((prefix) => {
    $(`${prefix}Time`).textContent = '\u2014';
    $(`${prefix}Moves`).textContent = `0 / ${size ** 2}`;
    $(`${prefix}Nodes`).textContent = '0';
    const statusEl = $(`${prefix}Status`);
    statusEl.textContent = 'IDLE';
    statusEl.className = 'metric-value status-idle';
    $(`${prefix}Progress`).style.width = '0%';
  });

  $('run').innerHTML = '<span>&#9654;</span> RACE BOTH SOLVERS';
  $('topStatus').textContent = 'READY';
  $('heroSquares').textContent = String(size ** 2);
}

// ==========================================
// 6. EVENT LISTENERS & INITIALIZATION
// ==========================================
function setupEventListeners() {
  // Board Size
  $('size').addEventListener('input', (e) => {
    const size = Number(e.target.value);
    $('sizeValue').textContent = `${size} \u00d7 ${size} (${size ** 2} squares)`;
    updateStartOptions(size);
    reset();
  });

  // Speed Slider & Presets
  $('speed').addEventListener('input', (e) => {
    const val = e.target.value;
    $('speedValue').textContent = `${val} ms`;
    document.querySelectorAll('.preset-chip').forEach((chip) => {
      chip.classList.toggle('active', chip.dataset.speed === val);
    });
  });

  document.querySelectorAll('.preset-chip').forEach((chip) => {
    chip.addEventListener('click', () => {
      const speed = chip.dataset.speed;
      $('speed').value = speed;
      $('speedValue').textContent = `${speed} ms`;
      document.querySelectorAll('.preset-chip').forEach((c) => c.classList.remove('active'));
      chip.classList.add('active');
    });
  });

  // Search Budget
  $('budget').addEventListener('input', (e) => {
    const num = Number(e.target.value);
    $('budgetValue').textContent = `${num.toLocaleString()} nodes`;
  });

  // Tour Options
  $('closed').addEventListener('change', () => {
    $('loop').disabled = !$('closed').checked;
    $('tourRequirement').textContent = $('closed').checked
      ? 'Closed Tour Required \u00b7 Knight must leap back to start square'
      : 'Open Tour Permitted \u00b7 Knight may conclude on any unvisited square';
    reset();
  });

  $('loop').addEventListener('change', reset);

  $('showTrail').addEventListener('change', () => {
    if (activeJobs.length) {
      activeJobs.forEach(({ view, result }) => {
        view.renderPath(result.path, currentStepIndex);
      });
    }
  });

  $('showLabels').addEventListener('change', () => {
    if (activeJobs.length) {
      activeJobs.forEach(({ view, result }) => {
        view.renderPath(result.path, currentStepIndex);
      });
    }
  });

  // Start Dropdown
  $('start').addEventListener('change', () => {
    const pos = Number($('start').value);
    if (warnBoard3D) warnBoard3D.placeKnight(pos);
    if (backBoard3D) backBoard3D.placeKnight(pos);
    reset();
  });

  // Main Action Buttons
  $('run').addEventListener('click', () => run());
  $('runWarn').addEventListener('click', () => run('warn'));
  $('runBack').addEventListener('click', () => run('back'));
  $('reset').addEventListener('click', reset);

  // Pause Button
  $('pauseBtn').addEventListener('click', () => {
    if (!running) return;
    paused = !paused;
    $('pauseIcon').innerHTML = paused ? '&#9654;' : '&#10074;&#10074;';
    $('topStatus').textContent = paused ? 'PAUSED' : 'RUNNING';
  });

  // Sound Toggle
  $('soundToggle').addEventListener('click', () => {
    soundEnabled = !soundEnabled;
    $('soundIcon').innerHTML = soundEnabled ? '&#128266;' : '&#128263;';
  });

  // Camera Presets Buttons
  document.querySelectorAll('.cam-btn').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      const boardKey = btn.dataset.board;
      const camMode = btn.dataset.cam;
      const view = boardKey === 'warn' ? warnBoard3D : backBoard3D;

      if (view) view.setCameraPreset(camMode);

      // Toggle active styling
      btn.parentElement.querySelectorAll('.cam-btn').forEach((b) => {
        if (b.dataset.cam !== 'reset') b.classList.remove('active');
      });
      if (camMode !== 'reset') btn.classList.add('active');
    });
  });

  $('cameraResetAll').addEventListener('click', () => {
    if (warnBoard3D) warnBoard3D.setCameraPreset('cinematic');
    if (backBoard3D) backBoard3D.setCameraPreset('cinematic');
  });

  // Shortcuts Modal
  $('shortcutsBtn').addEventListener('click', () => {
    $('shortcutsModal').hidden = false;
  });
  $('closeModal').addEventListener('click', () => {
    $('shortcutsModal').hidden = true;
  });
  $('shortcutsModal').addEventListener('click', (e) => {
    if (e.target === $('shortcutsModal')) $('shortcutsModal').hidden = true;
  });

  // Keyboard Navigation
  window.addEventListener('keydown', (e) => {
    if (e.code === 'Space') {
      e.preventDefault();
      if (!running) run();
      else $('pauseBtn').click();
    } else if (e.key === 'r' || e.key === 'R') {
      reset();
    } else if (e.key === 'm' || e.key === 'M') {
      $('soundToggle').click();
    } else if (e.key === '1') {
      warnBoard3D?.setCameraPreset('cinematic');
      backBoard3D?.setCameraPreset('cinematic');
    } else if (e.key === '2') {
      warnBoard3D?.setCameraPreset('iso');
      backBoard3D?.setCameraPreset('iso');
    } else if (e.key === '3') {
      warnBoard3D?.setCameraPreset('top');
      backBoard3D?.setCameraPreset('top');
    }
  });
}

// ==========================================
// 7. BOOTSTRAP
// ==========================================
window.addEventListener('DOMContentLoaded', () => {
  init3D();
  setupEventListeners();
  updateStartOptions(Number($('size').value));
  reset();
});
