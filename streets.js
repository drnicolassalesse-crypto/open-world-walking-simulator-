// ── OSM-based Streets, Sidewalks, Shops & Street Furniture ──────────
// Fetches real road/amenity data from Overpass API and renders 3D geometry.
// Usage: <script src="streets.js"></script>, then call StreetBuilder.build(...)
(function () {
  'use strict';

  // ── Road width lookup by OSM highway tag ──────────────────────────
  const ROAD_WIDTHS = {
    motorway: 12, trunk: 10, primary: 9, secondary: 8, tertiary: 7,
    residential: 6, unclassified: 5, service: 4, living_street: 5,
    pedestrian: 4, footway: 2.5, cycleway: 2, path: 1.8, steps: 1.5,
    motorway_link: 6, trunk_link: 6, primary_link: 6,
    secondary_link: 5, tertiary_link: 5,
  };
  const SIDEWALK_W = 2.5;
  const CURB_H = 0.15;
  const ROAD_Y = 0.02;       // slight raise above ground to avoid z-fight
  const SIDEWALK_Y = ROAD_Y + CURB_H;

  // ── Procedural canvas textures ────────────────────────────────────

  function makeAsphaltTexture(w) {
    const c = document.createElement('canvas'); c.width = 256; c.height = 256;
    const ctx = c.getContext('2d');
    // Dark asphalt base
    ctx.fillStyle = '#383838';
    ctx.fillRect(0, 0, 256, 256);
    // Grain noise
    for (let i = 0; i < 6000; i++) {
      const v = 35 + Math.random() * 40;
      ctx.fillStyle = `rgba(${v},${v},${v},0.25)`;
      ctx.fillRect(Math.random() * 256, Math.random() * 256, 1 + Math.random() * 2, 1);
    }
    // Center dashed line for wider roads
    if (w >= 6) {
      ctx.strokeStyle = '#e8e8e8';
      ctx.lineWidth = 2;
      ctx.setLineDash([18, 14]);
      ctx.beginPath(); ctx.moveTo(128, 0); ctx.lineTo(128, 256); ctx.stroke();
      ctx.setLineDash([]);
    }
    // Edge lines for primary+ roads
    if (w >= 8) {
      ctx.strokeStyle = 'rgba(255,255,255,0.5)';
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(8, 0); ctx.lineTo(8, 256); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(248, 0); ctx.lineTo(248, 256); ctx.stroke();
    }
    return c;
  }

  function makeSidewalkTexture() {
    const c = document.createElement('canvas'); c.width = 256; c.height = 256;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#b5ab9e';
    ctx.fillRect(0, 0, 256, 256);
    // Tile grid
    ctx.strokeStyle = 'rgba(80,70,60,0.35)';
    ctx.lineWidth = 1;
    const ts = 32;
    for (let x = 0; x <= 256; x += ts) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, 256); ctx.stroke();
    }
    for (let y = 0; y <= 256; y += ts) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(256, y); ctx.stroke();
    }
    // Per-tile color variation
    for (let tx = 0; tx < 8; tx++) {
      for (let ty = 0; ty < 8; ty++) {
        const v = 155 + Math.random() * 35;
        ctx.fillStyle = `rgba(${v},${v - 8},${v - 18},0.12)`;
        ctx.fillRect(tx * ts + 1, ty * ts + 1, ts - 2, ts - 2);
      }
    }
    // Expansion joints (cross pattern)
    ctx.strokeStyle = 'rgba(60,50,40,0.2)';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(128, 0); ctx.lineTo(128, 256); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, 128); ctx.lineTo(256, 128); ctx.stroke();
    return c;
  }

  function makeCrosswalkTexture() {
    const c = document.createElement('canvas'); c.width = 256; c.height = 256;
    const ctx = c.getContext('2d');
    // Asphalt base
    ctx.fillStyle = '#383838';
    ctx.fillRect(0, 0, 256, 256);
    // Zebra stripes
    ctx.fillStyle = '#e8e8e8';
    for (let i = 0; i < 8; i++) {
      if (i % 2 === 0) ctx.fillRect(0, i * 32, 256, 24);
    }
    return c;
  }

  // ── Vietnamese shop sign texture ──────────────────────────────────
  const SHOP_NAMES = [
    'PHỞ BÒ', 'CÀ PHÊ SỮA ĐÁ', 'BÚN CHẢ', 'BÁN MÌ', 'TRÁI CÂY',
    'TIỆM VÀNG', 'NHÀ THUỐC', 'QUÁN ĂN', 'SIÊU THỊ MINI', 'SỮA CHUA',
    'TRÀ ĐÁ', 'CƠM TẤM', 'HỦ TIẾU', 'GỎI CUỐN', 'NEM NƯỚNG',
    'QUÁN NƯỚC', 'KEM', 'BIA HƠI', 'ĐỒ ĐIỆN TỬ', 'THỜI TRANG',
  ];
  const SIGN_COLORS = [
    '#da251d', '#ff6600', '#0066cc', '#228b22', '#8b008b',
    '#cc0066', '#006666', '#994400', '#333399', '#009933',
  ];

  function makeShopSignCanvas(name, bgColor) {
    const c = document.createElement('canvas'); c.width = 256; c.height = 64;
    const ctx = c.getContext('2d');
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, 256, 64);
    // Border
    ctx.strokeStyle = 'rgba(255,255,255,0.6)';
    ctx.lineWidth = 2;
    ctx.strokeRect(2, 2, 252, 60);
    // Text
    ctx.font = 'bold 22px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#fff';
    ctx.shadowColor = 'rgba(0,0,0,0.5)';
    ctx.shadowBlur = 4;
    ctx.fillText(name, 128, 32);
    return c;
  }

  // ── Overpass query for roads & amenities ───────────────────────────
  const BBOX = '10.7895,106.7165,10.8005,106.7273'; // same as buildings

  function buildQuery() {
    return `[out:json][timeout:25];(
      way["highway"](${BBOX});
      node["shop"](${BBOX});
      node["amenity"~"restaurant|cafe|bar|pharmacy|bank|atm"](${BBOX});
    );out body;>;out skel qt;`;
  }

  async function fetchOSMRoads() {
    const url = 'https://overpass-api.de/api/interpreter';
    // Retry with backoff — Overpass API rate-limits concurrent requests
    for (let attempt = 0; attempt < 3; attempt++) {
      if (attempt > 0) await new Promise(r => setTimeout(r, 2000 * attempt));
      try {
        const resp = await fetch(url, {
          method: 'POST',
          body: `data=${encodeURIComponent(buildQuery())}`,
        });
        if (resp.status === 429) {
          console.warn(`[Streets] Overpass rate-limited (attempt ${attempt + 1}/3), retrying...`);
          continue;
        }
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        return resp.json();
      } catch (err) {
        if (attempt === 2) throw err;
        console.warn(`[Streets] Fetch attempt ${attempt + 1} failed:`, err.message);
      }
    }
  }

  // ── Geometry builders ─────────────────────────────────────────────

  // Build a flat ribbon mesh along a polyline (for roads & sidewalks).
  // pts: [{x,z},...], halfWidth: half-width, y: height
  function buildRibbon(THREE, pts, halfWidth, y, mat) {
    if (pts.length < 2) return null;
    const positions = [], uvs = [], indices = [];
    let dist = 0;

    for (let i = 0; i < pts.length; i++) {
      // Direction vector at this point
      let dx = 0, dz = 0;
      if (i < pts.length - 1) {
        dx += pts[i + 1].x - pts[i].x;
        dz += pts[i + 1].z - pts[i].z;
      }
      if (i > 0) {
        dx += pts[i].x - pts[i - 1].x;
        dz += pts[i].z - pts[i - 1].z;
      }
      const len = Math.sqrt(dx * dx + dz * dz) || 1;
      // Normal (perpendicular) — rotate 90 degrees
      const nx = -dz / len, nz = dx / len;

      // Left and right vertices
      positions.push(
        pts[i].x + nx * halfWidth, y, pts[i].z + nz * halfWidth,
        pts[i].x - nx * halfWidth, y, pts[i].z - nz * halfWidth,
      );

      if (i > 0) dist += Math.sqrt(
        (pts[i].x - pts[i - 1].x) ** 2 + (pts[i].z - pts[i - 1].z) ** 2,
      );
      const v = dist / (halfWidth * 4); // UV repeat along road
      uvs.push(0, v, 1, v);

      if (i < pts.length - 1) {
        const base = i * 2;
        indices.push(base, base + 1, base + 2, base + 1, base + 3, base + 2);
      }
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geo.setIndex(indices);
    geo.computeVertexNormals();
    const mesh = new THREE.Mesh(geo, mat);
    mesh.receiveShadow = true;
    return mesh;
  }

  // Build curb geometry (narrow raised strip along road edge)
  function buildCurb(THREE, pts, halfWidth, side, mat) {
    if (pts.length < 2) return null;
    const positions = [], indices = [];
    const curbW = 0.12;

    for (let i = 0; i < pts.length; i++) {
      let dx = 0, dz = 0;
      if (i < pts.length - 1) { dx += pts[i + 1].x - pts[i].x; dz += pts[i + 1].z - pts[i].z; }
      if (i > 0) { dx += pts[i].x - pts[i - 1].x; dz += pts[i].z - pts[i - 1].z; }
      const len = Math.sqrt(dx * dx + dz * dz) || 1;
      const nx = -dz / len * side, nz = dx / len * side;

      const ex = pts[i].x + nx * halfWidth;
      const ez = pts[i].z + nz * halfWidth;

      // 4 verts per point: outer-bottom, outer-top, inner-top, inner-bottom
      positions.push(
        ex + nx * curbW, ROAD_Y, ez + nz * curbW,       // outer bottom
        ex + nx * curbW, SIDEWALK_Y, ez + nz * curbW,    // outer top
        ex, SIDEWALK_Y, ez,                                // inner top
        ex, ROAD_Y, ez,                                    // inner bottom
      );
      if (i < pts.length - 1) {
        const b = i * 4;
        // Front face
        indices.push(b, b + 1, b + 5, b, b + 5, b + 4);
        // Top face
        indices.push(b + 1, b + 2, b + 6, b + 1, b + 6, b + 5);
        // Back face
        indices.push(b + 2, b + 3, b + 7, b + 2, b + 7, b + 6);
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setIndex(indices);
    geo.computeVertexNormals();
    const mesh = new THREE.Mesh(geo, mat);
    mesh.receiveShadow = true;
    return mesh;
  }

  // ── Street lamp builder ───────────────────────────────────────────
  function createLamp(THREE, x, z) {
    const group = new THREE.Group();
    // Pole
    const pole = new THREE.Mesh(
      new THREE.CylinderGeometry(0.08, 0.1, 5, 6),
      new THREE.MeshStandardMaterial({ color: 0x444444, roughness: 0.6, metalness: 0.5 }),
    );
    pole.position.set(0, 2.5, 0);
    pole.castShadow = true;
    group.add(pole);
    // Arm
    const arm = new THREE.Mesh(
      new THREE.CylinderGeometry(0.04, 0.04, 1.5, 4),
      new THREE.MeshStandardMaterial({ color: 0x444444, metalness: 0.5 }),
    );
    arm.rotation.z = Math.PI / 2;
    arm.position.set(0.7, 4.8, 0);
    group.add(arm);
    // Lamp head
    const head = new THREE.Mesh(
      new THREE.ConeGeometry(0.35, 0.3, 8),
      new THREE.MeshStandardMaterial({ color: 0x666666, metalness: 0.4 }),
    );
    head.position.set(1.4, 4.7, 0);
    head.rotation.z = Math.PI;
    group.add(head);
    // Glow sphere
    const glow = new THREE.Mesh(
      new THREE.SphereGeometry(0.15, 6, 4),
      new THREE.MeshBasicMaterial({ color: 0xffeedd }),
    );
    glow.position.set(1.4, 4.55, 0);
    group.add(glow);
    // Point light (low range for perf)
    const light = new THREE.PointLight(0xffe8cc, 0.8, 18);
    light.position.set(1.4, 4.5, 0);
    group.add(light);
    group.position.set(x, 0, z);
    group.userData = { light, glow };
    return group;
  }

  // ── Bench builder ─────────────────────────────────────────────────
  function createBench(THREE, x, z, angle) {
    const group = new THREE.Group();
    const wood = new THREE.MeshStandardMaterial({ color: 0x6B3E26, roughness: 0.9 });
    const metal = new THREE.MeshStandardMaterial({ color: 0x555555, roughness: 0.4, metalness: 0.6 });
    // Seat planks
    for (let i = -1; i <= 1; i++) {
      const plank = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.06, 0.14), wood);
      plank.position.set(0, 0.45, i * 0.16);
      plank.castShadow = true;
      group.add(plank);
    }
    // Legs
    for (const sx of [-0.55, 0.55]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.45, 0.5), metal);
      leg.position.set(sx, 0.225, 0);
      group.add(leg);
    }
    // Backrest
    const back = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.06, 0.4), wood);
    back.position.set(0, 0.72, -0.2);
    back.rotation.x = -0.15;
    back.castShadow = true;
    group.add(back);
    group.position.set(x, 0, z);
    group.rotation.y = angle;
    return group;
  }

  // ── Shop sign (3D sprite on building face) ────────────────────────
  function createShopSign(THREE, x, z, name) {
    const bgColor = SIGN_COLORS[Math.floor(Math.random() * SIGN_COLORS.length)];
    const canvas = makeShopSignCanvas(name || SHOP_NAMES[Math.floor(Math.random() * SHOP_NAMES.length)], bgColor);
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(3.5, 0.9), mat);
    mesh.position.set(x, 4.5, z);
    // Face outward from building (random cardinal)
    mesh.rotation.y = [0, Math.PI / 2, Math.PI, -Math.PI / 2][Math.floor(Math.random() * 4)];
    // Neon glow backing
    const glowMat = new THREE.MeshBasicMaterial({
      color: new THREE.Color(bgColor), transparent: true, opacity: 0.25,
    });
    const glowMesh = new THREE.Mesh(new THREE.PlaneGeometry(3.8, 1.1), glowMat);
    glowMesh.position.z = -0.05;
    mesh.add(glowMesh);
    mesh.userData.isSign = true;
    return mesh;
  }

  // ── Crosswalk placement helper ────────────────────────────────────
  function addCrosswalks(THREE, scene, intersections, mat) {
    let count = 0;
    for (const pt of intersections) {
      if (count >= 30) break; // perf cap
      const cw = new THREE.Mesh(new THREE.PlaneGeometry(6, 3), mat);
      cw.rotation.x = -Math.PI / 2;
      cw.position.set(pt.x, ROAD_Y + 0.005, pt.z);
      cw.rotation.z = pt.angle || 0;
      cw.receiveShadow = true;
      scene.add(cw);
      count++;
    }
  }

  // ── Fallback hardcoded streets (when API fails) ────────────────────
  function buildFallbackStreets(THREE, scene, latLonToXZ, roadMat, narrowMat, sidewalkMat, curbMat, footpathMat) {
    console.log('[Streets] Building fallback street grid');
    // Major roads in the Landmark 81 area (approximate real layout)
    const roads = [
      // Nguyen Huu Canh (main north-south) — primary, wide
      { pts: [[-200, -500], [-200, -200], [-190, 0], [-180, 200], [-170, 500]], w: 9 },
      // Xa Lo Ha Noi (highway to the north) — trunk
      { pts: [[-400, -350], [-200, -300], [0, -280], [200, -260], [500, -250]], w: 11 },
      // Nguyen Luong Bang / D1 (east-west near LM81)
      { pts: [[-400, -50], [-200, -40], [0, -30], [200, -20], [400, -10]], w: 8 },
      // Vo Nguyen Giap / D2 (east-west south of LM81)
      { pts: [[-300, 150], [-100, 140], [0, 130], [150, 120], [350, 110]], w: 7 },
      // Local road north of LM81
      { pts: [[-100, -200], [0, -180], [100, -170], [200, -160]], w: 6 },
      // Local road east side
      { pts: [[100, -300], [110, -100], [120, 50], [130, 200]], w: 5 },
      // Pedestrian path near river
      { pts: [[250, -400], [260, -200], [270, 0], [280, 200], [290, 400]], w: 2.5 },
      // Small street west
      { pts: [[-350, -200], [-340, 0], [-330, 200]], w: 5 },
    ];

    for (const road of roads) {
      const pts = road.pts.map(([x, z]) => ({ x, z }));
      const halfW = road.w / 2;
      const isNarrow = road.w < 4;
      const mat = isNarrow ? footpathMat : (road.w >= 6 ? roadMat : narrowMat);

      const mesh = buildRibbon(THREE, pts, halfW, ROAD_Y, mat);
      if (mesh) scene.add(mesh);

      // Add sidewalks for wider roads
      if (road.w >= 5) {
        for (const side of [1, -1]) {
          const swPts = pts.map((p, i) => {
            let dx = 0, dz = 0;
            if (i < pts.length - 1) { dx += pts[i + 1].x - p.x; dz += pts[i + 1].z - p.z; }
            if (i > 0) { dx += p.x - pts[i - 1].x; dz += p.z - pts[i - 1].z; }
            const len = Math.sqrt(dx * dx + dz * dz) || 1;
            const nx = -dz / len * side, nz = dx / len * side;
            return { x: p.x + nx * (halfW + SIDEWALK_W / 2 + 0.15), z: p.z + nz * (halfW + SIDEWALK_W / 2 + 0.15) };
          });
          const sw = buildRibbon(THREE, swPts, SIDEWALK_W / 2, SIDEWALK_Y, sidewalkMat);
          if (sw) scene.add(sw);
        }
        // Curbs
        const lc = buildCurb(THREE, pts, halfW, 1, curbMat);
        if (lc) scene.add(lc);
        const rc = buildCurb(THREE, pts, halfW, -1, curbMat);
        if (rc) scene.add(rc);
      }
    }
  }

  // ── Main build function ───────────────────────────────────────────
  async function build(THREE, scene, latLonToXZ, onProgress) {
    // Create reusable materials
    const asphaltCanvas = makeAsphaltTexture(8);
    const asphaltTex = new THREE.CanvasTexture(asphaltCanvas);
    asphaltTex.wrapS = asphaltTex.wrapT = THREE.RepeatWrapping;
    asphaltTex.colorSpace = THREE.SRGBColorSpace;
    const roadMat = new THREE.MeshStandardMaterial({ map: asphaltTex, roughness: 0.92 });

    const narrowAsphalt = makeAsphaltTexture(4);
    const narrowTex = new THREE.CanvasTexture(narrowAsphalt);
    narrowTex.wrapS = narrowTex.wrapT = THREE.RepeatWrapping;
    narrowTex.colorSpace = THREE.SRGBColorSpace;
    const narrowMat = new THREE.MeshStandardMaterial({ map: narrowTex, roughness: 0.9 });

    const swCanvas = makeSidewalkTexture();
    const swTex = new THREE.CanvasTexture(swCanvas);
    swTex.wrapS = swTex.wrapT = THREE.RepeatWrapping;
    swTex.colorSpace = THREE.SRGBColorSpace;
    const sidewalkMat = new THREE.MeshStandardMaterial({ map: swTex, roughness: 0.85 });

    const curbMat = new THREE.MeshStandardMaterial({ color: 0x999990, roughness: 0.8 });

    const cwCanvas = makeCrosswalkTexture();
    const cwTex = new THREE.CanvasTexture(cwCanvas);
    cwTex.colorSpace = THREE.SRGBColorSpace;
    const crosswalkMat = new THREE.MeshStandardMaterial({ map: cwTex, roughness: 0.9 });

    const footpathMat = new THREE.MeshStandardMaterial({ color: 0xa09888, roughness: 0.85 });

    console.log('[Streets] Fetching OSM road data...');
    let data;
    try {
      data = await fetchOSMRoads();
      console.log('[Streets] OSM data received:', data.elements.length, 'elements');
    } catch (err) {
      console.warn('[Streets] OSM fetch failed, using fallback streets:', err);
      if (onProgress) onProgress('streets-error');
      // Build fallback streets so there's always something visible
      buildFallbackStreets(THREE, scene, latLonToXZ, roadMat, narrowMat, sidewalkMat, curbMat, footpathMat);
      return { lamps: [], roadCount: 0, shopCount: 0 };
    }

    // Index nodes
    const nodes = {};
    data.elements.filter(e => e.type === 'node').forEach(n => { nodes[n.id] = n; });

    // Process roads (ways with highway tag)
    const roads = data.elements.filter(e => e.type === 'way' && e.tags && e.tags.highway);
    const intersections = [];
    const lampPositions = [];
    const lamps = [];
    let roadCount = 0;

    for (const way of roads) {
      const coords = (way.nodes || []).map(nid => nodes[nid]).filter(Boolean);
      if (coords.length < 2) continue;

      const hwType = way.tags.highway;
      const width = ROAD_WIDTHS[hwType] || 5;
      const halfW = width / 2;
      const pts = coords.map(n => latLonToXZ(n.lat, n.lon));

      // Skip very short segments
      let totalLen = 0;
      for (let i = 1; i < pts.length; i++) {
        totalLen += Math.sqrt((pts[i].x - pts[i - 1].x) ** 2 + (pts[i].z - pts[i - 1].z) ** 2);
      }
      if (totalLen < 3) continue;

      // Choose material based on road width
      const isFootpath = hwType === 'footway' || hwType === 'path' || hwType === 'cycleway' || hwType === 'steps';
      const mat = isFootpath ? footpathMat : (width >= 6 ? roadMat : narrowMat);

      // Road surface
      const roadMesh = buildRibbon(THREE, pts, halfW, ROAD_Y, mat);
      if (roadMesh) { scene.add(roadMesh); roadCount++; }

      // Sidewalks & curbs for non-footpaths with width >= 5
      if (!isFootpath && width >= 5) {
        // Left sidewalk
        const leftPts = pts.map((p, i) => {
          let dx = 0, dz = 0;
          if (i < pts.length - 1) { dx += pts[i + 1].x - p.x; dz += pts[i + 1].z - p.z; }
          if (i > 0) { dx += p.x - pts[i - 1].x; dz += p.z - pts[i - 1].z; }
          const len = Math.sqrt(dx * dx + dz * dz) || 1;
          const nx = -dz / len, nz = dx / len;
          return { x: p.x + nx * (halfW + SIDEWALK_W / 2 + 0.15), z: p.z + nz * (halfW + SIDEWALK_W / 2 + 0.15) };
        });
        const leftSW = buildRibbon(THREE, leftPts, SIDEWALK_W / 2, SIDEWALK_Y, sidewalkMat);
        if (leftSW) scene.add(leftSW);

        // Right sidewalk
        const rightPts = pts.map((p, i) => {
          let dx = 0, dz = 0;
          if (i < pts.length - 1) { dx += pts[i + 1].x - p.x; dz += pts[i + 1].z - p.z; }
          if (i > 0) { dx += p.x - pts[i - 1].x; dz += p.z - pts[i - 1].z; }
          const len = Math.sqrt(dx * dx + dz * dz) || 1;
          const nx = dz / len, nz = -dx / len;
          return { x: p.x + nx * (halfW + SIDEWALK_W / 2 + 0.15), z: p.z + nz * (halfW + SIDEWALK_W / 2 + 0.15) };
        });
        const rightSW = buildRibbon(THREE, rightPts, SIDEWALK_W / 2, SIDEWALK_Y, sidewalkMat);
        if (rightSW) scene.add(rightSW);

        // Curbs
        const leftCurb = buildCurb(THREE, pts, halfW, 1, curbMat);
        if (leftCurb) scene.add(leftCurb);
        const rightCurb = buildCurb(THREE, pts, halfW, -1, curbMat);
        if (rightCurb) scene.add(rightCurb);

        // Street lamps every ~40m along wider roads
        if (width >= 7) {
          let accum = 0;
          for (let i = 1; i < pts.length; i++) {
            const segLen = Math.sqrt((pts[i].x - pts[i - 1].x) ** 2 + (pts[i].z - pts[i - 1].z) ** 2);
            accum += segLen;
            if (accum >= 40) {
              accum = 0;
              // Check not too close to existing lamp
              const lx = leftPts[i].x, lz = leftPts[i].z;
              const tooClose = lampPositions.some(lp =>
                (lp.x - lx) ** 2 + (lp.z - lz) ** 2 < 400
              );
              if (!tooClose && lamps.length < 80) {
                const lamp = createLamp(THREE, lx, lz);
                scene.add(lamp);
                lamps.push(lamp);
                lampPositions.push({ x: lx, z: lz });
              }
            }
          }
        }
      }

      // Collect intersection points (first and last node of each road)
      if (!isFootpath && width >= 5) {
        const first = pts[0], last = pts[pts.length - 1];
        const angle = Math.atan2(pts[1].x - first.x, pts[1].z - first.z);
        intersections.push({ x: first.x, z: first.z, angle });
        const angle2 = Math.atan2(last.x - pts[pts.length - 2].x, last.z - pts[pts.length - 2].z);
        intersections.push({ x: last.x, z: last.z, angle: angle2 });
      }
    }

    // Deduplicate intersection points (merge within 8m radius)
    const mergedIntersections = [];
    for (const pt of intersections) {
      const existing = mergedIntersections.find(m =>
        (m.x - pt.x) ** 2 + (m.z - pt.z) ** 2 < 64
      );
      if (!existing) mergedIntersections.push(pt);
    }

    // Add crosswalks at intersections
    addCrosswalks(THREE, scene, mergedIntersections, crosswalkMat);

    // Add benches along sidewalks (sparse)
    let benchCount = 0;
    for (let i = 0; i < mergedIntersections.length && benchCount < 20; i += 3) {
      const p = mergedIntersections[i];
      const bench = createBench(THREE, p.x + 4, p.z + 3, p.angle || 0);
      scene.add(bench);
      benchCount++;
    }

    // ── Process shop/amenity nodes ────────────────────────────────────
    const shopNodes = data.elements.filter(e =>
      e.type === 'node' && e.tags && (e.tags.shop || e.tags.amenity)
    );
    let shopCount = 0;
    for (const node of shopNodes) {
      if (shopCount >= 50) break; // perf cap
      const p = latLonToXZ(node.lat, node.lon);
      const name = node.tags.name || node.tags['name:vi'] || null;
      const sign = createShopSign(THREE, p.x, p.z, name);
      scene.add(sign);
      shopCount++;
    }

    console.log(`[Streets] Built: ${roadCount} roads, ${lamps.length} lamps, ${benchCount} benches, ${shopCount} shops, ${mergedIntersections.length} crosswalks`);
    if (roadCount === 0) {
      console.warn('[Streets] No roads from OSM data, adding fallback streets');
      buildFallbackStreets(THREE, scene, latLonToXZ, roadMat, narrowMat, sidewalkMat, curbMat, footpathMat);
    }
    if (onProgress) onProgress('streets-done');
    return { lamps, roadCount, shopCount };
  }

  // ── Update lamp lights (for day/night cycle) ──────────────────────
  function updateLamps(lamps, timeOfDay) {
    if (!lamps || !lamps.length) return;
    // Lamps on when dark (timeOfDay ~0.75-1.0 and 0.0-0.25 are night in map.html)
    // map.html dayNight: sun angle = (t - 0.25) * 2PI, sunUp = sin(sunAngle)
    const sunAngle = (timeOfDay - 0.25) * Math.PI * 2;
    const sunUp = Math.sin(sunAngle);
    const nightFactor = Math.max(0, -sunUp); // 0 in day, 1 at midnight
    const on = nightFactor > 0.05;
    for (const lamp of lamps) {
      const { light, glow } = lamp.userData;
      if (light) {
        light.intensity = on ? 0.8 + nightFactor * 0.4 : 0;
      }
      if (glow) {
        glow.material.color.setHex(on ? 0xffeedd : 0x888888);
        glow.material.opacity = on ? 0.6 + nightFactor * 0.4 : 0.2;
        glow.material.transparent = true;
      }
    }
  }

  // ── Public API ────────────────────────────────────────────────────
  window.StreetBuilder = { build, updateLamps };
})();
