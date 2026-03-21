// ── Map Systems: NPCs, Collectibles, Photo Spots, Score ────────────
// Extracted from map.html for maintainability.
// Usage: <script src="map-systems.js"></script> before the main module script.
// All systems are exposed via window.MapSystems.

(function () {
  'use strict';

  // ── Score & Achievements ─────────────────────────────────────────
  let score = 0;
  const milestones = [
    { pts: 50, name: 'Explorer!' },
    { pts: 100, name: 'Adventurer!' },
    { pts: 200, name: 'Ho Chi Minh City Expert!' },
  ];
  const milestonesHit = new Set();
  const npcsScored = new Set();
  let lm81Scored = false;

  function addScore(pts) {
    score += pts;
    document.getElementById('hud-score').textContent = `SCORE: ${score}`;
    const popup = document.getElementById('achieve-popup');
    for (const m of milestones) {
      if (score >= m.pts && !milestonesHit.has(m.pts)) {
        milestonesHit.add(m.pts);
        popup.textContent = m.name;
        popup.style.display = 'block'; popup.style.opacity = '1';
        setTimeout(() => { popup.style.opacity = '0'; }, 2500);
        setTimeout(() => { popup.style.display = 'none'; }, 3000);
      }
    }
  }

  function checkLandmark81(camPos) {
    if (!lm81Scored && Math.sqrt(camPos.x ** 2 + camPos.z ** 2) < 20) {
      lm81Scored = true; addScore(50);
    }
  }

  // ── NPC Tour Guides ──────────────────────────────────────────────
  const npcDefs = [
    { name: 'Linh', color: 0xe84393, lat: 10.7950, lon: 106.7219,
      msg: 'Welcome! Landmark 81 is Vietnam\'s tallest building at 461m. Built in 2018!' },
    { name: 'Minh', color: 0x0984e3, lat: 10.7940, lon: 106.7200,
      msg: 'This is Vinhomes Central Park, a premium residential complex with beautiful gardens.' },
    { name: 'Thu', color: 0x00b894, lat: 10.7960, lon: 106.7230,
      msg: 'The Saigon River runs along here. It connects Ho Chi Minh City to the sea!' },
  ];

  let dialogOpen = false, activeNPC = null;

  function createNPCs(THREE, scene, latLonToXZ) {
    const npcs = [];
    const container = document.getElementById('npc-labels');
    npcDefs.forEach(def => {
      const pos = latLonToXZ(def.lat, def.lon);
      if (Math.abs(pos.x) < 30 && Math.abs(pos.z) < 30) { pos.x = 30; pos.z = 5; }
      const group = new THREE.Group();
      group.position.set(pos.x, 0, pos.z);
      const bMat = new THREE.MeshLambertMaterial({ color: def.color });
      const lMat = new THREE.MeshLambertMaterial({ color: 0x444444 });
      const body = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.7, 0.3), bMat); body.position.y = 0.75; group.add(body);
      const head = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.35, 0.35), bMat); head.position.y = 1.3; group.add(head);
      const legL = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.5, 0.2), lMat); legL.position.set(-0.12, 0.25, 0); group.add(legL);
      const legR = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.5, 0.2), lMat); legR.position.set(0.12, 0.25, 0); group.add(legR);
      group.castShadow = true; scene.add(group);
      const label = document.createElement('div'); label.className = 'npc-label';
      label.textContent = def.name; label.style.color = '#' + def.color.toString(16).padStart(6, '0');
      container.appendChild(label);
      npcs.push({ group, def, pos, label });
    });
    return npcs;
  }

  function showNPCDialog(npc) {
    document.getElementById('npc-name').textContent = npc.def.name;
    document.getElementById('npc-msg').textContent = npc.def.msg;
    document.getElementById('npc-dialog').style.display = 'block';
    dialogOpen = true; activeNPC = npc;
    if (!npcsScored.has(npc.def.name)) { npcsScored.add(npc.def.name); addScore(15); }
    document.exitPointerLock();
  }

  function dismissDialog(renderer) {
    if (!dialogOpen) return;
    document.getElementById('npc-dialog').style.display = 'none';
    dialogOpen = false; activeNPC = null;
    renderer.domElement.requestPointerLock();
  }

  function updateNPCLabels(npcs, camera) {
    const w2 = window.innerWidth / 2, h2 = window.innerHeight / 2;
    const THREE = window._THREE;
    npcs.forEach(npc => {
      const headPos = new THREE.Vector3(npc.pos.x, 1.7, npc.pos.z);
      headPos.project(camera);
      if (headPos.z > 1 || headPos.z < -1) { npc.label.style.display = 'none'; return; }
      npc.label.style.display = 'block';
      npc.label.style.left = (headPos.x * w2 + w2) + 'px';
      npc.label.style.top = (-headPos.y * h2 + h2) + 'px';
    });
  }

  function updateNPCs(npcs, dt, elapsed, camera, renderer) {
    let nearest = null, nearDist = Infinity;
    npcs.forEach(npc => {
      npc.group.rotation.y += 0.5 * dt;
      npc.group.children.forEach(c => { c.position.y += Math.sin(elapsed * 2) * 0.001; });
      const dx = camera.position.x - npc.pos.x, dz = camera.position.z - npc.pos.z;
      const dist = Math.sqrt(dx * dx + dz * dz);
      if (dist < 8 && dist < nearDist) { nearest = npc; nearDist = dist; }
    });
    if (nearest && !dialogOpen) showNPCDialog(nearest);
    updateNPCLabels(npcs, camera);
  }

  // ── Collectible Cultural Items ───────────────────────────────────
  const collectibleDefs = [
    { name: 'Lotus Flower', color: 0xff69b4, lat: 10.7938, lon: 106.7198 },
    { name: 'Lotus Flower', color: 0xff69b4, lat: 10.7955, lon: 106.7228 },
    { name: 'Banh Mi', color: 0x8b5a2b, lat: 10.7945, lon: 106.7210 },
    { name: 'Banh Mi', color: 0x8b5a2b, lat: 10.7952, lon: 106.7215 },
    { name: 'Non La Hat', color: 0xe8d44d, lat: 10.7942, lon: 106.7222 },
    { name: 'Non La Hat', color: 0xe8d44d, lat: 10.7948, lon: 106.7205 },
    { name: 'Coffee Cup', color: 0x3e2723, lat: 10.7958, lon: 106.7212 },
    { name: 'Coffee Cup', color: 0x3e2723, lat: 10.7935, lon: 106.7225 },
  ];
  let itemsCollected = 0;

  function createCollectibles(THREE, scene, latLonToXZ) {
    const collectibles = [];
    collectibleDefs.forEach(def => {
      const p = latLonToXZ(def.lat, def.lon);
      const mesh = new THREE.Mesh(new THREE.SphereGeometry(0.4, 12, 8),
        new THREE.MeshStandardMaterial({ color: def.color, emissive: def.color, emissiveIntensity: 0.4 }));
      mesh.position.set(p.x, 0.5, p.z);
      scene.add(mesh);
      collectibles.push({ def, pos: p, mesh, collected: false, fadeTimer: -1 });
    });
    return collectibles;
  }

  function updateCollectibles(collectibles, dt, elapsed, camera, scene) {
    collectibles.forEach(c => {
      if (c.collected) {
        if (c.fadeTimer >= 0) {
          c.fadeTimer += dt;
          const t = c.fadeTimer / 0.3;
          const s = 1 + t * 0.5;
          c.mesh.scale.set(s, s, s);
          c.mesh.material.opacity = 1 - t;
          if (t >= 1) { scene.remove(c.mesh); c.fadeTimer = -1; }
        }
        return;
      }
      c.mesh.position.y = 0.5 + Math.sin(elapsed * Math.PI * 2) * 0.5;
      c.mesh.rotation.y += 1.5 * dt;
      const dx = camera.position.x - c.pos.x, dz = camera.position.z - c.pos.z;
      if (Math.sqrt(dx * dx + dz * dz) < 2) {
        c.collected = true; c.fadeTimer = 0;
        c.mesh.material.transparent = true;
        itemsCollected++;
        document.getElementById('hud-items').textContent = `🌿 Items: ${itemsCollected}/8`;
        addScore(10);
      }
    });
  }

  // ── Photo Spots ──────────────────────────────────────────────────
  const photoSpotDefs = [
    { name: 'Landmark 81 View', lat: 10.7935, lon: 106.7215 },
    { name: 'Saigon River Sunset', lat: 10.7958, lon: 106.7235 },
    { name: 'Vinhomes Garden', lat: 10.7942, lon: 106.7198 },
  ];
  const photosTaken = new Set();
  let nearPhotoSpot = null;

  function createPhotoSpots(THREE, scene, latLonToXZ) {
    const photoSpots = [];
    photoSpotDefs.forEach(def => {
      const p = latLonToXZ(def.lat, def.lon);
      const sphere = new THREE.Mesh(new THREE.SphereGeometry(0.3, 12, 8),
        new THREE.MeshStandardMaterial({ color: 0xffd700, emissive: 0xffa000, emissiveIntensity: 0.6 }));
      sphere.position.set(p.x, 0.5, p.z);
      scene.add(sphere);
      photoSpots.push({ def, pos: p, mesh: sphere });
    });
    return photoSpots;
  }

  function takePhoto(spot) {
    if (photosTaken.has(spot.def.name)) return;
    photosTaken.add(spot.def.name);
    document.getElementById('hud-photos').textContent = `📸 Photos: ${photosTaken.size}/3`;
    addScore(25);
    const flash = document.getElementById('photo-flash');
    flash.style.opacity = '1';
    setTimeout(() => { flash.style.opacity = '0'; }, 150);
    const toast = document.getElementById('photo-toast');
    toast.textContent = `Photo saved! ${spot.def.name}`;
    toast.style.display = 'block';
    setTimeout(() => { toast.style.display = 'none'; }, 3000);
  }

  function updatePhotoSpots(photoSpots, elapsed, camera) {
    nearPhotoSpot = null;
    photoSpots.forEach(s => {
      s.mesh.position.y = 0.5 + Math.sin(elapsed * 3) * 0.15;
      const dx = camera.position.x - s.pos.x, dz = camera.position.z - s.pos.z;
      if (Math.sqrt(dx * dx + dz * dz) < 6 && !photosTaken.has(s.def.name)) nearPhotoSpot = s;
    });
    document.getElementById('photo-prompt').style.display = nearPhotoSpot ? 'block' : 'none';
  }

  // ── Event listeners ──────────────────────────────────────────────
  function initEvents(renderer) {
    document.addEventListener('click', () => { if (dialogOpen) dismissDialog(renderer); });
    document.addEventListener('keydown', e => {
      if (e.code === 'KeyE' && dialogOpen) dismissDialog(renderer);
      if (e.code === 'KeyF' && nearPhotoSpot && !photosTaken.has(nearPhotoSpot.def.name)) takePhoto(nearPhotoSpot);
    });
  }

  // ── Public API ───────────────────────────────────────────────────
  window.MapSystems = {
    createNPCs,
    updateNPCs,
    createCollectibles,
    updateCollectibles,
    createPhotoSpots,
    updatePhotoSpots,
    addScore,
    checkLandmark81,
    initEvents,
    get dialogOpen() { return dialogOpen; },
    get npcsScored() { return npcsScored; },
    get photosTaken() { return photosTaken; },
    get collectibles() { return collectibleDefs; },
  };
})();
