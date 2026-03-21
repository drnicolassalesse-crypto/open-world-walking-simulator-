// ── Procedural Building & Ground Textures for Landmark 81 Map ───────
// Generates canvas-based texture atlases, materials, and UV mappings.
// Usage: <script src="textures.js"></script> before main module script.
// Exposed via window.MapTextures.

(function () {
  'use strict';

  // ── Texture Atlas Dimensions ──────────────────────────────────────
  const ATLAS_SIZE = 512;

  // ── Procedural Building Texture Generator ─────────────────────────
  // Generates a canvas texture atlas with windows, facades, and details.

  function generateGlassTexture() {
    const c = document.createElement('canvas');
    c.width = ATLAS_SIZE; c.height = ATLAS_SIZE;
    const ctx = c.getContext('2d');

    // Dark blue-gray glass base
    ctx.fillStyle = '#3a506b';
    ctx.fillRect(0, 0, ATLAS_SIZE, ATLAS_SIZE);

    // Vertical mullion lines (structural columns)
    ctx.strokeStyle = 'rgba(180,200,220,0.4)';
    ctx.lineWidth = 1;
    const cols = 16;
    for (let i = 0; i <= cols; i++) {
      const x = (i / cols) * ATLAS_SIZE;
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, ATLAS_SIZE); ctx.stroke();
    }

    // Horizontal floor lines
    const rows = 24;
    for (let i = 0; i <= rows; i++) {
      const y = (i / rows) * ATLAS_SIZE;
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(ATLAS_SIZE, y); ctx.stroke();
    }

    // Window panes with reflections
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const x = (col / cols) * ATLAS_SIZE + 2;
        const y = (row / rows) * ATLAS_SIZE + 2;
        const w = ATLAS_SIZE / cols - 4;
        const h = ATLAS_SIZE / rows - 3;

        // Base window tint - slight random variation
        const lit = Math.random() > 0.7;
        if (lit) {
          ctx.fillStyle = `rgba(${200 + Math.random() * 55}, ${180 + Math.random() * 55}, ${120 + Math.random() * 80}, 0.6)`;
        } else {
          const shade = 40 + Math.random() * 30;
          ctx.fillStyle = `rgba(${shade + 20}, ${shade + 40}, ${shade + 60}, 0.8)`;
        }
        ctx.fillRect(x, y, w, h);

        // Reflection highlight (diagonal gradient feel)
        if (!lit && Math.random() > 0.5) {
          const grad = ctx.createLinearGradient(x, y, x + w, y + h);
          grad.addColorStop(0, 'rgba(140,180,220,0.15)');
          grad.addColorStop(0.5, 'rgba(200,220,240,0.08)');
          grad.addColorStop(1, 'rgba(100,130,160,0.05)');
          ctx.fillStyle = grad;
          ctx.fillRect(x, y, w, h);
        }
      }
    }

    return c;
  }

  function generateConcreteTexture() {
    const c = document.createElement('canvas');
    c.width = ATLAS_SIZE; c.height = ATLAS_SIZE;
    const ctx = c.getContext('2d');

    // Warm concrete base
    ctx.fillStyle = '#b8a99a';
    ctx.fillRect(0, 0, ATLAS_SIZE, ATLAS_SIZE);

    // Noise for concrete grain
    for (let i = 0; i < 8000; i++) {
      const x = Math.random() * ATLAS_SIZE;
      const y = Math.random() * ATLAS_SIZE;
      const v = 140 + Math.random() * 60;
      ctx.fillStyle = `rgba(${v}, ${v - 10}, ${v - 20}, 0.15)`;
      ctx.fillRect(x, y, 2 + Math.random() * 3, 1 + Math.random() * 2);
    }

    // Floor lines
    const rows = 8;
    for (let i = 0; i <= rows; i++) {
      const y = (i / rows) * ATLAS_SIZE;
      ctx.strokeStyle = 'rgba(120,100,85,0.5)';
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(ATLAS_SIZE, y); ctx.stroke();
    }

    // Windows with concrete frames
    const cols = 6;
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const x = (col / cols) * ATLAS_SIZE + 12;
        const y = (row / rows) * ATLAS_SIZE + 10;
        const w = ATLAS_SIZE / cols - 24;
        const h = ATLAS_SIZE / rows - 16;

        // Window frame
        ctx.fillStyle = 'rgba(90,80,70,0.6)';
        ctx.fillRect(x - 3, y - 3, w + 6, h + 6);

        // Window glass - dark with occasional light
        const lit = Math.random() > 0.75;
        ctx.fillStyle = lit ?
          `rgba(${220 + Math.random() * 35}, ${190 + Math.random() * 40}, ${100 + Math.random() * 60}, 0.7)` :
          `rgba(50,60,75,0.85)`;
        ctx.fillRect(x, y, w, h);

        // Balcony rail (some floors)
        if (Math.random() > 0.5) {
          ctx.fillStyle = 'rgba(100,90,80,0.7)';
          ctx.fillRect(x - 6, y + h, w + 12, 3);
          // Rail posts
          for (let p = 0; p < 4; p++) {
            ctx.fillRect(x + (p / 3) * w - 1, y + h - 8, 2, 11);
          }
        }
      }
    }

    return c;
  }

  function generateStorefrontTexture() {
    const c = document.createElement('canvas');
    c.width = ATLAS_SIZE; c.height = ATLAS_SIZE;
    const ctx = c.getContext('2d');

    // Upper floors: simple concrete
    ctx.fillStyle = '#c4b5a5';
    ctx.fillRect(0, 0, ATLAS_SIZE, ATLAS_SIZE);

    // Concrete noise
    for (let i = 0; i < 3000; i++) {
      const x = Math.random() * ATLAS_SIZE;
      const y = Math.random() * ATLAS_SIZE;
      ctx.fillStyle = `rgba(${130 + Math.random() * 50}, ${120 + Math.random() * 40}, ${100 + Math.random() * 40}, 0.12)`;
      ctx.fillRect(x, y, 2, 2);
    }

    // Upper windows (smaller, residential)
    const upperRows = 4;
    const upperCols = 5;
    for (let row = 0; row < upperRows; row++) {
      for (let col = 0; col < upperCols; col++) {
        const x = (col / upperCols) * ATLAS_SIZE + 16;
        const y = row * (ATLAS_SIZE * 0.15) + 10;
        const w = ATLAS_SIZE / upperCols - 32;
        const h = ATLAS_SIZE * 0.12;
        ctx.fillStyle = 'rgba(60,70,85,0.8)';
        ctx.fillRect(x, y, w, h);
      }
    }

    // Ground floor: storefront (bottom 35%)
    const sfTop = ATLAS_SIZE * 0.65;
    const sfH = ATLAS_SIZE * 0.35;

    // Storefront wall
    ctx.fillStyle = '#8b7355';
    ctx.fillRect(0, sfTop, ATLAS_SIZE, sfH);

    // Large display windows
    const winCount = 3;
    for (let i = 0; i < winCount; i++) {
      const x = (i / winCount) * ATLAS_SIZE + 10;
      const w = ATLAS_SIZE / winCount - 20;
      // Window
      ctx.fillStyle = 'rgba(180,200,210,0.5)';
      ctx.fillRect(x, sfTop + 8, w, sfH - 30);
      // Window shine
      const grad = ctx.createLinearGradient(x, sfTop + 8, x + w, sfTop + sfH - 22);
      grad.addColorStop(0, 'rgba(255,255,255,0.12)');
      grad.addColorStop(0.5, 'rgba(255,255,255,0.03)');
      grad.addColorStop(1, 'rgba(255,255,255,0.08)');
      ctx.fillStyle = grad;
      ctx.fillRect(x, sfTop + 8, w, sfH - 30);
    }

    // Awning/canopy
    ctx.fillStyle = '#c0392b';
    ctx.fillRect(0, sfTop - 4, ATLAS_SIZE, 8);

    // Signage area
    ctx.fillStyle = 'rgba(40,30,20,0.7)';
    ctx.fillRect(ATLAS_SIZE * 0.15, sfTop + sfH - 24, ATLAS_SIZE * 0.7, 18);
    ctx.font = 'bold 12px sans-serif';
    ctx.fillStyle = '#FFD700';
    ctx.textAlign = 'center';
    ctx.fillText('CỬA HÀNG', ATLAS_SIZE / 2, sfTop + sfH - 10);

    return c;
  }

  // ── Normal Map Generator ──────────────────────────────────────────
  function generateNormalMap(sourceCanvas) {
    const w = sourceCanvas.width, h = sourceCanvas.height;
    const srcCtx = sourceCanvas.getContext('2d');
    const srcData = srcCtx.getImageData(0, 0, w, h).data;

    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(w, h);
    const d = img.data;

    // Sobel-like filter for normal generation
    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        const i = (y * w + x) * 4;
        // Sample grayscale neighbors
        const tl = srcData[((y-1)*w+(x-1))*4] / 255;
        const tc = srcData[((y-1)*w+x)*4] / 255;
        const tr = srcData[((y-1)*w+(x+1))*4] / 255;
        const ml = srcData[(y*w+(x-1))*4] / 255;
        const mr = srcData[(y*w+(x+1))*4] / 255;
        const bl = srcData[((y+1)*w+(x-1))*4] / 255;
        const bc = srcData[((y+1)*w+x)*4] / 255;
        const br = srcData[((y+1)*w+(x+1))*4] / 255;

        const dX = (tr + 2*mr + br) - (tl + 2*ml + bl);
        const dY = (bl + 2*bc + br) - (tl + 2*tc + tr);
        const strength = 2.0;

        const nx = -dX * strength;
        const ny = -dY * strength;
        const nz = 1.0;
        const len = Math.sqrt(nx*nx + ny*ny + nz*nz);

        d[i]   = Math.round(((nx/len) * 0.5 + 0.5) * 255);
        d[i+1] = Math.round(((ny/len) * 0.5 + 0.5) * 255);
        d[i+2] = Math.round(((nz/len) * 0.5 + 0.5) * 255);
        d[i+3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    return c;
  }

  // ── Road Texture ──────────────────────────────────────────────────
  function generateRoadTexture() {
    const c = document.createElement('canvas');
    c.width = 256; c.height = 256;
    const ctx = c.getContext('2d');

    // Asphalt base
    ctx.fillStyle = '#404040';
    ctx.fillRect(0, 0, 256, 256);
    // Asphalt noise
    for (let i = 0; i < 4000; i++) {
      const v = 45 + Math.random() * 35;
      ctx.fillStyle = `rgba(${v},${v},${v},0.3)`;
      ctx.fillRect(Math.random() * 256, Math.random() * 256, 1 + Math.random() * 2, 1);
    }
    // Center lane marking (dashed)
    ctx.strokeStyle = '#e0e0e0';
    ctx.lineWidth = 3;
    ctx.setLineDash([20, 15]);
    ctx.beginPath(); ctx.moveTo(128, 0); ctx.lineTo(128, 256); ctx.stroke();
    ctx.setLineDash([]);
    // Edge lines
    ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(10, 0); ctx.lineTo(10, 256); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(246, 0); ctx.lineTo(246, 256); ctx.stroke();

    return c;
  }

  // ── Sidewalk Texture ──────────────────────────────────────────────
  function generateSidewalkTexture() {
    const c = document.createElement('canvas');
    c.width = 256; c.height = 256;
    const ctx = c.getContext('2d');

    ctx.fillStyle = '#b0a89c';
    ctx.fillRect(0, 0, 256, 256);
    // Grid pattern (pavement tiles)
    ctx.strokeStyle = 'rgba(90,80,70,0.4)';
    ctx.lineWidth = 1;
    for (let x = 0; x <= 256; x += 32) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, 256); ctx.stroke();
    }
    for (let y = 0; y <= 256; y += 32) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(256, y); ctx.stroke();
    }
    // Tile variations
    for (let tx = 0; tx < 8; tx++) {
      for (let ty = 0; ty < 8; ty++) {
        const v = 160 + Math.random() * 30;
        ctx.fillStyle = `rgba(${v},${v-5},${v-15},0.15)`;
        ctx.fillRect(tx * 32 + 1, ty * 32 + 1, 30, 30);
      }
    }
    return c;
  }

  // ── Grass Texture ─────────────────────────────────────────────────
  function generateGrassTexture() {
    const c = document.createElement('canvas');
    c.width = 256; c.height = 256;
    const ctx = c.getContext('2d');

    ctx.fillStyle = '#4a7c3a';
    ctx.fillRect(0, 0, 256, 256);
    // Grass blades
    for (let i = 0; i < 2000; i++) {
      const x = Math.random() * 256;
      const y = Math.random() * 256;
      const g = 60 + Math.random() * 60;
      ctx.fillStyle = `rgba(${30 + Math.random() * 40},${g + 40},${20 + Math.random() * 30},0.3)`;
      ctx.fillRect(x, y, 1, 2 + Math.random() * 4);
    }
    return c;
  }

  // ── Water Shader Material ─────────────────────────────────────────
  function createWaterMaterial(THREE) {
    return new THREE.ShaderMaterial({
      transparent: true,
      side: THREE.DoubleSide,
      uniforms: {
        uTime: { value: 0 },
        uColor: { value: new THREE.Color(0x1a6fa8) },
        uOpacity: { value: 0.75 },
      },
      vertexShader: `
        varying vec2 vUv;
        varying vec3 vWorldPos;
        uniform float uTime;
        void main() {
          vUv = uv;
          vec3 pos = position;
          pos.z += sin(pos.x * 0.05 + uTime) * 0.5 + cos(pos.y * 0.08 + uTime * 0.7) * 0.3;
          vWorldPos = (modelMatrix * vec4(pos, 1.0)).xyz;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 uColor;
        uniform float uOpacity;
        uniform float uTime;
        varying vec2 vUv;
        varying vec3 vWorldPos;
        void main() {
          // Animated ripple pattern
          float ripple = sin(vWorldPos.x * 0.3 + uTime * 2.0) * cos(vWorldPos.z * 0.2 + uTime * 1.5) * 0.5 + 0.5;
          // Fake fresnel reflection
          vec3 col = mix(uColor, vec3(0.6, 0.75, 0.9), ripple * 0.3);
          // Specular highlight
          float spec = pow(ripple, 4.0) * 0.3;
          col += vec3(spec);
          gl_FragColor = vec4(col, uOpacity);
        }
      `,
    });
  }

  // ── AO Shader for building corners ────────────────────────────────
  function generateAOTexture() {
    const c = document.createElement('canvas');
    c.width = 128; c.height = 128;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, 128, 128);
    // Dark edges (ambient occlusion approximation)
    const grad = ctx.createLinearGradient(0, 0, 20, 0);
    grad.addColorStop(0, 'rgba(0,0,0,0.35)');
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 20, 128);
    // Right edge
    const gradR = ctx.createLinearGradient(128, 0, 108, 0);
    gradR.addColorStop(0, 'rgba(0,0,0,0.35)');
    gradR.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = gradR;
    ctx.fillRect(108, 0, 20, 128);
    // Bottom edge (ground contact)
    const gradB = ctx.createLinearGradient(0, 128, 0, 108);
    gradB.addColorStop(0, 'rgba(0,0,0,0.4)');
    gradB.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = gradB;
    ctx.fillRect(0, 108, 128, 20);
    return c;
  }

  // ── Material Cache (texture atlas) ────────────────────────────────
  let glassCanvas = null, concreteCanvas = null, storefrontCanvas = null;
  let glassNormal = null, concreteNormal = null;
  let roadCanvas = null, sidewalkCanvas = null, grassCanvas = null, aoCanvas = null;
  const materialCache = {};

  function initTextures() {
    glassCanvas = generateGlassTexture();
    concreteCanvas = generateConcreteTexture();
    storefrontCanvas = generateStorefrontTexture();
    glassNormal = generateNormalMap(glassCanvas);
    concreteNormal = generateNormalMap(concreteCanvas);
    roadCanvas = generateRoadTexture();
    sidewalkCanvas = generateSidewalkTexture();
    grassCanvas = generateGrassTexture();
    aoCanvas = generateAOTexture();
  }

  // ── Get Material by Building Type ─────────────────────────────────
  function getBuildingMaterial(THREE, height, isLandmark81) {
    let type;
    if (isLandmark81 || height > 100) type = 'glass';
    else if (height > 30) type = 'concrete';
    else type = 'storefront';

    if (materialCache[type]) return materialCache[type];

    const canvas = type === 'glass' ? glassCanvas : type === 'concrete' ? concreteCanvas : storefrontCanvas;
    const normalCanvas = type === 'glass' ? glassNormal : concreteNormal;

    const map = new THREE.CanvasTexture(canvas);
    map.wrapS = map.wrapT = THREE.RepeatWrapping;
    map.colorSpace = THREE.SRGBColorSpace;

    const mat = new THREE.MeshStandardMaterial({
      map: map,
      roughness: type === 'glass' ? 0.15 : type === 'concrete' ? 0.85 : 0.7,
      metalness: type === 'glass' ? 0.3 : 0.05,
      envMapIntensity: type === 'glass' ? 1.2 : 0.4,
    });

    // Normal map for depth
    if (normalCanvas) {
      const nMap = new THREE.CanvasTexture(normalCanvas);
      nMap.wrapS = nMap.wrapT = THREE.RepeatWrapping;
      mat.normalMap = nMap;
      mat.normalScale = new THREE.Vector2(0.8, 0.8);
    }

    materialCache[type] = mat;
    return mat;
  }

  // ── Apply UV mapping to extruded building geometry ────────────────
  function applyBuildingUVs(geometry, height) {
    const uv = geometry.attributes.uv;
    const pos = geometry.attributes.position;
    if (!uv || !pos) return;

    const floorsRepeat = Math.max(1, Math.round(height / 15));

    for (let i = 0; i < uv.count; i++) {
      const y = pos.getY(i);
      // Scale UV.y to repeat per floor
      uv.setY(i, (y / height) * floorsRepeat);
    }
    uv.needsUpdate = true;
  }

  // ── Create Ground Materials ───────────────────────────────────────
  function createGroundMaterials(THREE) {
    const materials = {};

    // Road
    const roadMap = new THREE.CanvasTexture(roadCanvas);
    roadMap.wrapS = roadMap.wrapT = THREE.RepeatWrapping;
    roadMap.repeat.set(1, 20);
    roadMap.colorSpace = THREE.SRGBColorSpace;
    materials.road = new THREE.MeshStandardMaterial({ map: roadMap, roughness: 0.9 });

    // Sidewalk
    const swMap = new THREE.CanvasTexture(sidewalkCanvas);
    swMap.wrapS = swMap.wrapT = THREE.RepeatWrapping;
    swMap.repeat.set(4, 4);
    swMap.colorSpace = THREE.SRGBColorSpace;
    materials.sidewalk = new THREE.MeshStandardMaterial({ map: swMap, roughness: 0.85 });

    // Grass
    const grassMap = new THREE.CanvasTexture(grassCanvas);
    grassMap.wrapS = grassMap.wrapT = THREE.RepeatWrapping;
    grassMap.repeat.set(8, 8);
    grassMap.colorSpace = THREE.SRGBColorSpace;
    materials.grass = new THREE.MeshStandardMaterial({ map: grassMap, roughness: 0.95 });

    return materials;
  }

  // ── Add Roads & Sidewalks to Scene ────────────────────────────────
  function addRoads(THREE, scene, latLonToXZ) {
    const mats = createGroundMaterials(THREE);

    // Main road (north-south through center)
    const road1 = new THREE.Mesh(new THREE.PlaneGeometry(14, 800), mats.road);
    road1.rotation.x = -Math.PI / 2; road1.position.set(-50, 0.05, 0);
    road1.receiveShadow = true; scene.add(road1);

    // East-west road
    const road2Tex = new THREE.CanvasTexture(roadCanvas);
    road2Tex.wrapS = road2Tex.wrapT = THREE.RepeatWrapping;
    road2Tex.repeat.set(20, 1); road2Tex.rotation = Math.PI / 2;
    road2Tex.colorSpace = THREE.SRGBColorSpace;
    const road2Mat = new THREE.MeshStandardMaterial({ map: road2Tex, roughness: 0.9 });
    const road2 = new THREE.Mesh(new THREE.PlaneGeometry(800, 14), road2Mat);
    road2.rotation.x = -Math.PI / 2; road2.position.set(0, 0.05, -80);
    road2.receiveShadow = true; scene.add(road2);

    // Sidewalk strips along main road
    const sw1 = new THREE.Mesh(new THREE.PlaneGeometry(5, 800), mats.sidewalk);
    sw1.rotation.x = -Math.PI / 2; sw1.position.set(-57.5, 0.04, 0);
    sw1.receiveShadow = true; scene.add(sw1);
    const sw2 = new THREE.Mesh(new THREE.PlaneGeometry(5, 800), mats.sidewalk);
    sw2.rotation.x = -Math.PI / 2; sw2.position.set(-42.5, 0.04, 0);
    sw2.receiveShadow = true; scene.add(sw2);

    // Green park area near Landmark 81
    const park = new THREE.Mesh(new THREE.PlaneGeometry(120, 100), mats.grass);
    park.rotation.x = -Math.PI / 2; park.position.set(60, 0.03, 60);
    park.receiveShadow = true; scene.add(park);

    // Small park near river
    const park2 = new THREE.Mesh(new THREE.PlaneGeometry(80, 60), mats.grass);
    park2.rotation.x = -Math.PI / 2; park2.position.set(200, 0.03, -40);
    park2.receiveShadow = true; scene.add(park2);
  }

  // ── Apply AO overlay to building mesh ─────────────────────────────
  function applyAO(THREE, mesh) {
    if (!aoCanvas) return;
    const aoMap = new THREE.CanvasTexture(aoCanvas);
    aoMap.wrapS = aoMap.wrapT = THREE.RepeatWrapping;
    if (mesh.material.aoMap === undefined) {
      mesh.material.aoMap = aoMap;
      mesh.material.aoMapIntensity = 0.6;
    }
  }

  // ── Public API ────────────────────────────────────────────────────
  window.MapTextures = {
    initTextures,
    getBuildingMaterial,
    applyBuildingUVs,
    createWaterMaterial,
    addRoads,
    applyAO,
    generateAOTexture,
    get glassCanvas() { return glassCanvas; },
    get concreteCanvas() { return concreteCanvas; },
    get storefrontCanvas() { return storefrontCanvas; },
  };
})();
