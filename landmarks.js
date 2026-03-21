// ── Landmarks: Landmark 81 Area POIs & Vietnamese Cultural Elements ──
// Usage: <script src="landmarks.js"></script> before the main module script.
// Exposed via window.Landmarks.

(function () {
  'use strict';

  // ── POI Definitions ───────────────────────────────────────────────
  const pois = [
    {
      id: 'landmark81', name: 'Landmark 81',
      nameVi: 'Tòa nhà Landmark 81',
      lat: 10.7950, lon: 106.7219,
      desc: 'Vietnam\'s tallest skyscraper at 461.3m with 81 floors. Completed in 2018, it dominates the HCMC skyline.',
      descVi: 'Tòa nhà cao nhất Việt Nam với 461,3m và 81 tầng. Hoàn thành năm 2018.',
      icon: '🏙️', color: 0xFFD700, radius: 30, category: 'landmark',
    },
    {
      id: 'vinhomes', name: 'Vinhomes Central Park',
      nameVi: 'Vinhomes Central Park',
      lat: 10.7940, lon: 106.7200,
      desc: 'A premium 43.1-hectare riverside urban complex with parks, pools, and modern apartments. Opened 2016.',
      descVi: 'Khu đô thị cao cấp rộng 43,1 ha bên sông với công viên, hồ bơi và căn hộ hiện đại.',
      icon: '🌳', color: 0x4CAF50, radius: 25, category: 'landmark',
    },
    {
      id: 'saigonRiver', name: 'Saigon River Waterfront',
      nameVi: 'Bờ sông Sài Gòn',
      lat: 10.7955, lon: 106.7250,
      desc: 'The 256km Saigon River connects HCMC to the East Sea. The waterfront promenade offers stunning city views.',
      descVi: 'Sông Sài Gòn dài 256km nối TP.HCM với biển Đông. Đường đi bộ ven sông có tầm nhìn tuyệt đẹp.',
      icon: '🌊', color: 0x2196F3, radius: 20, category: 'landmark',
    },
    {
      id: 'benThanhMarket', name: 'Traditional Market',
      nameVi: 'Chợ truyền thống',
      lat: 10.7935, lon: 106.7208,
      desc: 'A bustling Vietnamese market with handicrafts, textiles, spices, and local specialties.',
      descVi: 'Chợ Việt Nam nhộn nhịp với hàng thủ công, vải, gia vị và đặc sản địa phương.',
      icon: '🏪', color: 0xFF5722, radius: 15, category: 'culture',
    },
    {
      id: 'streetFood', name: 'Street Food Vendors',
      nameVi: 'Quán ăn đường phố',
      lat: 10.7947, lon: 106.7212,
      desc: 'Try phở, bánh mì, bún chả, and gỏi cuốn — iconic Vietnamese street food loved worldwide.',
      descVi: 'Thử phở, bánh mì, bún chả và gỏi cuốn — món ăn đường phố Việt Nam nổi tiếng thế giới.',
      icon: '🍜', color: 0xFF9800, radius: 12, category: 'culture',
    },
    {
      id: 'cafeShop', name: 'Cà Phê Sữa Đá',
      nameVi: 'Quán Cà Phê',
      lat: 10.7958, lon: 106.7215,
      desc: 'Vietnamese coffee culture — strong drip coffee with condensed milk over ice. A daily ritual since French colonial era.',
      descVi: 'Văn hóa cà phê Việt Nam — cà phê phin đậm với sữa đặc và đá. Nghi thức hàng ngày từ thời Pháp thuộc.',
      icon: '☕', color: 0x795548, radius: 10, category: 'culture',
    },
  ];

  // ── State ─────────────────────────────────────────────────────────
  const discovered = new Set();
  let activePOI = null;
  let panelVisible = false;
  let proximityLabel = null;
  let proximityTimer = 0;

  // ── Cultural ambience tracks (Web Audio synthesis) ─────────────────
  let ambienceCtx = null, ambienceGain = null;
  let marketOsc = null, cafeOsc = null;

  function initAmbience() {
    if (ambienceCtx) return;
    try {
      ambienceCtx = new (window.AudioContext || window.webkitAudioContext)();
      ambienceGain = ambienceCtx.createGain();
      ambienceGain.gain.value = 0;
      ambienceGain.connect(ambienceCtx.destination);

      // Market ambience: layered oscillators for chatter/bustle
      marketOsc = ambienceCtx.createOscillator();
      marketOsc.type = 'sawtooth';
      marketOsc.frequency.value = 120;
      const marketFilter = ambienceCtx.createBiquadFilter();
      marketFilter.type = 'bandpass';
      marketFilter.frequency.value = 400;
      marketFilter.Q.value = 2;
      const marketGain = ambienceCtx.createGain();
      marketGain.gain.value = 0.015;
      marketOsc.connect(marketFilter);
      marketFilter.connect(marketGain);
      marketGain.connect(ambienceGain);
      marketOsc.start();

      // Cafe ambience: soft tonal hum
      cafeOsc = ambienceCtx.createOscillator();
      cafeOsc.type = 'sine';
      cafeOsc.frequency.value = 220;
      const cafeFilter = ambienceCtx.createBiquadFilter();
      cafeFilter.type = 'lowpass';
      cafeFilter.frequency.value = 300;
      const cafeGainNode = ambienceCtx.createGain();
      cafeGainNode.gain.value = 0.008;
      cafeOsc.connect(cafeFilter);
      cafeFilter.connect(cafeGainNode);
      cafeGainNode.connect(ambienceGain);
      cafeOsc.start();
    } catch (e) { /* Audio not available */ }
  }

  function updateAmbience(camX, camZ, poiPositions) {
    if (!ambienceCtx || !ambienceGain) return;
    // Fade ambience based on proximity to cultural POIs
    let nearCulture = false;
    for (const p of poiPositions) {
      if (p.category !== 'culture') continue;
      const dx = camX - p.x, dz = camZ - p.z;
      if (Math.sqrt(dx * dx + dz * dz) < p.radius * 1.5) {
        nearCulture = true;
        break;
      }
    }
    const target = nearCulture ? 0.6 : 0;
    ambienceGain.gain.value += (target - ambienceGain.gain.value) * 0.05;
  }

  // ── 3D Marker Creation ────────────────────────────────────────────
  function createPOIMarkers(THREE, scene, latLonToXZ) {
    const markers = [];
    pois.forEach(poi => {
      const pos = latLonToXZ(poi.lat, poi.lon);
      const group = new THREE.Group();
      group.position.set(pos.x, 0, pos.z);

      // Floating icon sprite
      const canvas = document.createElement('canvas');
      canvas.width = 128; canvas.height = 128;
      const ctx = canvas.getContext('2d');
      // Background circle
      ctx.beginPath();
      ctx.arc(64, 64, 56, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fill();
      ctx.strokeStyle = '#' + poi.color.toString(16).padStart(6, '0');
      ctx.lineWidth = 4;
      ctx.stroke();
      // Icon emoji
      ctx.font = '48px serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#fff';
      ctx.fillText(poi.icon, 64, 64);

      const tex = new THREE.CanvasTexture(canvas);
      const spriteMat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false });
      const sprite = new THREE.Sprite(spriteMat);
      sprite.scale.set(4, 4, 1);
      sprite.position.y = poi.category === 'landmark' ? 12 : 6;
      group.add(sprite);

      // Glow ring on ground
      const ringGeo = new THREE.RingGeometry(1.5, 2, 24);
      ringGeo.rotateX(-Math.PI / 2);
      const ringMat = new THREE.MeshBasicMaterial({
        color: poi.color, transparent: true, opacity: 0.4, side: 2
      });
      const ring = new THREE.Mesh(ringGeo, ringMat);
      ring.position.y = 0.05;
      group.add(ring);

      scene.add(group);
      markers.push({
        poi, group, sprite, ring,
        x: pos.x, z: pos.z,
        category: poi.category,
        radius: poi.radius,
      });
    });
    return markers;
  }

  // ── Update Markers (bob + pulse) ──────────────────────────────────
  function updateMarkers(markers, dt, elapsed, camera) {
    let nearest = null, nearDist = Infinity;
    markers.forEach(m => {
      // Bobbing sprite
      const baseY = m.poi.category === 'landmark' ? 12 : 6;
      m.sprite.position.y = baseY + Math.sin(elapsed * 1.5 + m.x) * 0.4;
      // Pulsing ring
      const pulse = 0.3 + Math.sin(elapsed * 2) * 0.15;
      m.ring.material.opacity = pulse;
      m.ring.rotation.z = elapsed * 0.3;

      // Billboard sprite faces camera
      const dx = camera.position.x - m.x, dz = camera.position.z - m.z;
      const dist = Math.sqrt(dx * dx + dz * dz);

      // Distance-based visibility
      m.sprite.material.opacity = dist < 300 ? 1 : Math.max(0, 1 - (dist - 300) / 100);

      // Check proximity
      if (dist < m.radius && dist < nearDist) {
        nearest = m;
        nearDist = dist;
      }
    });
    return nearest;
  }

  // ── Proximity & Discovery ─────────────────────────────────────────
  function handleProximity(nearest, dt) {
    const label = document.getElementById('poi-proximity');
    const counter = document.getElementById('poi-counter');

    if (nearest && !panelVisible) {
      if (!discovered.has(nearest.poi.id)) {
        discovered.add(nearest.poi.id);
        if (window.MapSystems) window.MapSystems.addScore(20);
        // Flash discovery
        const banner = document.getElementById('poi-discovery');
        banner.innerHTML = `<span>${nearest.poi.icon}</span> Discovered: ${nearest.poi.name}<br><small>${nearest.poi.nameVi}</small>`;
        banner.style.display = 'block';
        banner.style.opacity = '1';
        setTimeout(() => { banner.style.opacity = '0'; }, 2500);
        setTimeout(() => { banner.style.display = 'none'; }, 3000);
      }
      // Show proximity label
      label.innerHTML = `${nearest.poi.icon} ${nearest.poi.name} <small style="opacity:0.6">(${nearest.poi.nameVi})</small><br><small style="color:#FFD700">Click to learn more</small>`;
      label.style.display = 'block';
      proximityLabel = nearest;
      proximityTimer = 0;
    } else if (!nearest) {
      proximityTimer += dt;
      if (proximityTimer > 0.5) {
        label.style.display = 'none';
        proximityLabel = null;
      }
    }
    counter.textContent = `🏛️ Discovered: ${discovered.size}/${pois.length}`;
  }

  // ── Info Panel ────────────────────────────────────────────────────
  function showInfoPanel(marker) {
    const panel = document.getElementById('poi-info');
    const p = marker.poi;
    panel.querySelector('.poi-title').textContent = `${p.icon} ${p.name}`;
    panel.querySelector('.poi-title-vi').textContent = p.nameVi;
    panel.querySelector('.poi-desc').textContent = p.desc;
    panel.querySelector('.poi-desc-vi').textContent = p.descVi;
    panel.querySelector('.poi-cat').textContent = p.category === 'landmark' ? '🏛️ Landmark' : '🎭 Culture';
    // Distance
    const dist = panel.dataset.dist || '';
    panel.querySelector('.poi-dist').textContent = dist ? `📍 ${dist}m away` : '';
    panel.style.display = 'block';
    panelVisible = true;
    activePOI = marker;
    document.exitPointerLock();
  }

  function hideInfoPanel(renderer) {
    document.getElementById('poi-info').style.display = 'none';
    panelVisible = false;
    activePOI = null;
    if (renderer) renderer.domElement.requestPointerLock();
  }

  // ── Raycasting for Click Interaction ──────────────────────────────
  function setupInteraction(THREE, camera, markers, renderer) {
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    document.addEventListener('click', (e) => {
      if (panelVisible) { hideInfoPanel(renderer); return; }
      // If proximity label is showing, open its panel
      if (proximityLabel) {
        const dx = camera.position.x - proximityLabel.x;
        const dz = camera.position.z - proximityLabel.z;
        const dist = Math.round(Math.sqrt(dx * dx + dz * dz));
        document.getElementById('poi-info').dataset.dist = dist;
        showInfoPanel(proximityLabel);
        return;
      }
      // Raycast to POI sprites
      mouse.set(0, 0); // center of screen (crosshair)
      raycaster.setFromCamera(mouse, camera);
      const sprites = markers.map(m => m.sprite);
      const hits = raycaster.intersectObjects(sprites);
      if (hits.length > 0) {
        const hit = markers.find(m => m.sprite === hits[0].object);
        if (hit) {
          const dx = camera.position.x - hit.x, dz = camera.position.z - hit.z;
          document.getElementById('poi-info').dataset.dist = Math.round(Math.sqrt(dx * dx + dz * dz));
          showInfoPanel(hit);
        }
      }
    });

    document.addEventListener('keydown', (e) => {
      if (e.code === 'KeyE' && panelVisible) hideInfoPanel(renderer);
    });
  }

  // ── Minimap POI Markers ───────────────────────────────────────────
  function drawPOIsOnMinimap(mm, markers, worldToMM) {
    markers.forEach(m => {
      const p = worldToMM(m.x, m.z);
      const col = '#' + m.poi.color.toString(16).padStart(6, '0');
      // Diamond shape for POIs
      mm.save();
      mm.translate(p.mx, p.my);
      mm.rotate(Math.PI / 4);
      mm.fillStyle = discovered.has(m.poi.id) ? col : 'rgba(255,255,255,0.3)';
      mm.fillRect(-2.5, -2.5, 5, 5);
      mm.restore();
    });
  }

  // ── Distance Indicators ───────────────────────────────────────────
  function updateDistanceIndicators(markers, camera) {
    const container = document.getElementById('poi-distances');
    if (!container) return;
    let html = '';
    markers.forEach(m => {
      const dx = camera.position.x - m.x, dz = camera.position.z - m.z;
      const dist = Math.sqrt(dx * dx + dz * dz);
      if (dist < 200 && dist > m.radius) {
        const col = '#' + m.poi.color.toString(16).padStart(6, '0');
        html += `<div style="color:${col}">${m.poi.icon} ${Math.round(dist)}m</div>`;
      }
    });
    container.innerHTML = html;
  }

  // ── Public API ────────────────────────────────────────────────────
  window.Landmarks = {
    pois,
    createPOIMarkers,
    updateMarkers,
    handleProximity,
    setupInteraction,
    drawPOIsOnMinimap,
    updateDistanceIndicators,
    initAmbience,
    updateAmbience,
    hideInfoPanel,
    get discovered() { return discovered; },
    get panelVisible() { return panelVisible; },
    get activePOI() { return activePOI; },
  };
})();
