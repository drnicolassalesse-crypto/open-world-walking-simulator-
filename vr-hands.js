// ── VR Hand Tracking & Gesture Controls for Landmark 81 ─────────────
// WebXR Hand Tracking API with gesture recognition, haptics, and VR UI.
// Usage: <script src="vr-hands.js"></script> before main module script.
// Exposed via window.VRHands.

(function () {
  'use strict';

  // ── Hand Joint Constants (WebXR Hand API) ─────────────────────────
  const WRIST = 0, THUMB_TIP = 4, INDEX_TIP = 9, MIDDLE_TIP = 14, RING_TIP = 19, PINKY_TIP = 24;
  const INDEX_META = 6, MIDDLE_META = 11, THUMB_META = 1;

  // ── State ─────────────────────────────────────────────────────────
  let handTrackingSupported = false;
  let leftHand = null, rightHand = null;
  let leftHandMesh = null, rightHandMesh = null;
  const jointSpheres = { left: [], right: [] };
  let gestureState = {
    pinch: { left: false, right: false },
    point: { left: false, right: false },
    thumbsUp: { left: false, right: false },
    wave: { left: false, right: false },
    grab: { left: false, right: false },
  };
  let prevGesture = { left: 'none', right: 'none' };
  let wavePhase = { left: 0, right: 0 };
  let waveCycles = { left: 0, right: 0 };
  let lastWaveY = { left: 0, right: 0 };

  // Cooldowns to prevent spam
  let teleportCooldown = 0, photoCooldown = 0, npcCooldown = 0, grabCooldown = 0;

  // VR UI elements (3D)
  let wristCompass = null;
  let cursorSphere = null;
  let vrMenuGroup = null;
  let distanceLabels = [];

  // ── Hand Mesh Creation (low-poly for Quest 2/3) ───────────────────
  function createHandVisuals(THREE, scene) {
    const jointGeo = new THREE.SphereGeometry(0.008, 6, 4); // Very low-poly
    const leftMat = new THREE.MeshBasicMaterial({ color: 0x4fc3f7, transparent: true, opacity: 0.7 });
    const rightMat = new THREE.MeshBasicMaterial({ color: 0xef5350, transparent: true, opacity: 0.7 });

    // 25 joints per hand
    for (let i = 0; i < 25; i++) {
      const lSphere = new THREE.Mesh(jointGeo, leftMat.clone());
      lSphere.visible = false;
      scene.add(lSphere);
      jointSpheres.left.push(lSphere);

      const rSphere = new THREE.Mesh(jointGeo, rightMat.clone());
      rSphere.visible = false;
      scene.add(rSphere);
      jointSpheres.right.push(rSphere);
    }

    // Finger connection lines for each hand
    const lineMat = new THREE.LineBasicMaterial({ color: 0x4fc3f7, transparent: true, opacity: 0.4 });
    const lineMatR = new THREE.LineBasicMaterial({ color: 0xef5350, transparent: true, opacity: 0.4 });
    const pts = [new THREE.Vector3(), new THREE.Vector3()];
    const lineGeo = new THREE.BufferGeometry().setFromPoints(pts);

    leftHandMesh = new THREE.Group();
    rightHandMesh = new THREE.Group();
    // Bones: 5 fingers × 4 segments + wrist connections
    const boneCount = 24;
    for (let i = 0; i < boneCount; i++) {
      leftHandMesh.add(new THREE.Line(lineGeo.clone(), lineMat.clone()));
      rightHandMesh.add(new THREE.Line(lineGeo.clone(), lineMatR.clone()));
    }
    leftHandMesh.visible = false;
    rightHandMesh.visible = false;
    scene.add(leftHandMesh);
    scene.add(rightHandMesh);

    // Cursor sphere (for pointing gesture)
    cursorSphere = new THREE.Mesh(
      new THREE.SphereGeometry(0.015, 8, 6),
      new THREE.MeshBasicMaterial({ color: 0xFFD700, transparent: true, opacity: 0.8 })
    );
    cursorSphere.visible = false;
    scene.add(cursorSphere);
  }

  // ── Create 3D Wrist Compass ───────────────────────────────────────
  function createWristCompass(THREE) {
    wristCompass = new THREE.Group();

    // Compass disc
    const discGeo = new THREE.CylinderGeometry(0.025, 0.025, 0.003, 16);
    const discMat = new THREE.MeshBasicMaterial({ color: 0x1a1a2e, transparent: true, opacity: 0.85 });
    const disc = new THREE.Mesh(discGeo, discMat);
    wristCompass.add(disc);

    // Cardinal direction markers using canvas texture
    const canvas = document.createElement('canvas');
    canvas.width = 128; canvas.height = 128;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, 128, 128);
    // Compass circle
    ctx.beginPath(); ctx.arc(64, 64, 58, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(255,255,255,0.3)'; ctx.lineWidth = 2; ctx.stroke();
    // N-S-E-W
    ctx.font = 'bold 24px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = '#f44336'; ctx.fillText('N', 64, 16);
    ctx.fillStyle = '#ffffff'; ctx.fillText('S', 64, 112);
    ctx.fillStyle = '#ffffff'; ctx.fillText('E', 112, 64);
    ctx.fillStyle = '#ffffff'; ctx.fillText('W', 16, 64);
    // Center dot
    ctx.beginPath(); ctx.arc(64, 64, 4, 0, Math.PI * 2);
    ctx.fillStyle = '#FFD700'; ctx.fill();

    const tex = new THREE.CanvasTexture(canvas);
    const faceMat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, side: 2 });
    const faceGeo = new THREE.PlaneGeometry(0.05, 0.05);
    const face = new THREE.Mesh(faceGeo, faceMat);
    face.rotation.x = -Math.PI / 2;
    face.position.y = 0.002;
    wristCompass.add(face);
    wristCompass.userData.face = face;

    wristCompass.visible = false;
    return wristCompass;
  }

  // ── Create VR Floating Menu ───────────────────────────────────────
  function createVRMenu(THREE) {
    vrMenuGroup = new THREE.Group();
    vrMenuGroup.visible = false;

    // Background panel
    const panelGeo = new THREE.PlaneGeometry(0.4, 0.25);
    const panelMat = new THREE.MeshBasicMaterial({
      color: 0x0a0a1e, transparent: true, opacity: 0.85, side: 2
    });
    vrMenuGroup.add(new THREE.Mesh(panelGeo, panelMat));

    // Title + info rendered on canvas texture
    const canvas = document.createElement('canvas');
    canvas.width = 512; canvas.height = 320;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = 'rgba(10,10,30,0.9)';
    ctx.fillRect(0, 0, 512, 320);
    // Border
    ctx.strokeStyle = '#da251d'; ctx.lineWidth = 4;
    ctx.strokeRect(2, 2, 508, 316);
    // Title
    ctx.font = 'bold 28px sans-serif'; ctx.fillStyle = '#FFD700'; ctx.textAlign = 'center';
    ctx.fillText('Landmark 81', 256, 40);
    // Vietnamese subtitle
    ctx.font = '18px sans-serif'; ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.fillText('Tòa nhà Landmark 81', 256, 65);
    // Gesture guide
    ctx.font = '16px sans-serif'; ctx.fillStyle = '#ffffff'; ctx.textAlign = 'left';
    const tips = [
      '🤏 Pinch → Teleport',
      '👆 Point → Select landmark',
      '👍 Thumbs up → Take photo',
      '👋 Wave → Talk to NPCs',
      '✊ Grab → Pick up items',
    ];
    tips.forEach((t, i) => ctx.fillText(t, 30, 105 + i * 32));
    // Vietnamese translation
    ctx.font = '12px sans-serif'; ctx.fillStyle = 'rgba(255,255,255,0.4)';
    const tipsVi = ['Di chuyển', 'Chọn địa điểm', 'Chụp ảnh', 'Nói chuyện', 'Nhặt đồ'];
    tipsVi.forEach((t, i) => ctx.fillText(t, 320, 105 + i * 32));

    const tex = new THREE.CanvasTexture(canvas);
    const textMat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, side: 2 });
    const textMesh = new THREE.Mesh(new THREE.PlaneGeometry(0.38, 0.238), textMat);
    textMesh.position.z = 0.001;
    vrMenuGroup.add(textMesh);

    vrMenuGroup.userData = { canvas, ctx, tex };
    return vrMenuGroup;
  }

  // ── Create Landmark Distance Labels (3D sprites) ──────────────────
  function createDistanceLabels(THREE, poiMarkers) {
    distanceLabels = [];
    poiMarkers.forEach(m => {
      const canvas = document.createElement('canvas');
      canvas.width = 256; canvas.height = 64;
      const tex = new THREE.CanvasTexture(canvas);
      const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false });
      const sprite = new THREE.Sprite(mat);
      sprite.scale.set(2, 0.5, 1);
      sprite.visible = false;
      m.group.add(sprite);
      sprite.position.y = (m.poi.category === 'landmark' ? 14 : 8);
      distanceLabels.push({ sprite, canvas, tex, poi: m.poi, marker: m });
    });
    return distanceLabels;
  }

  // ── Update Joint Positions from XR Hand ───────────────────────────
  function updateHandJoints(hand, frame, refSpace, spheres, handMesh, side, THREE) {
    if (!hand || !frame || !refSpace) { handMesh.visible = false; return null; }

    const joints = [];
    let visible = false;
    for (let i = 0; i < 25; i++) {
      const joint = hand.get(i);
      if (!joint) { spheres[i].visible = false; continue; }
      const pose = frame.getJointPose(joint, refSpace);
      if (!pose) { spheres[i].visible = false; continue; }
      visible = true;
      const p = pose.transform.position;
      spheres[i].position.set(p.x, p.y, p.z);
      spheres[i].visible = true;
      joints.push({ index: i, x: p.x, y: p.y, z: p.z, radius: pose.radius || 0.008 });
    }
    handMesh.visible = visible;

    // Update bone lines
    if (visible) {
      const fingerStarts = [1, 6, 11, 16, 21]; // Start of each finger chain
      let lineIdx = 0;
      for (let f = 0; f < 5; f++) {
        const start = fingerStarts[f];
        for (let j = 0; j < 4 && lineIdx < handMesh.children.length; j++) {
          const a = start + j, b = start + j + 1;
          if (b >= 25 || !spheres[a].visible || !spheres[b].visible) {
            if (lineIdx < handMesh.children.length) handMesh.children[lineIdx].visible = false;
            lineIdx++; continue;
          }
          const line = handMesh.children[lineIdx];
          const positions = line.geometry.attributes.position;
          positions.setXYZ(0, spheres[a].position.x, spheres[a].position.y, spheres[a].position.z);
          positions.setXYZ(1, spheres[b].position.x, spheres[b].position.y, spheres[b].position.z);
          positions.needsUpdate = true;
          line.visible = true;
          lineIdx++;
        }
        // Wrist to finger base connection
        if (lineIdx < handMesh.children.length) {
          const line = handMesh.children[lineIdx];
          if (spheres[WRIST].visible && spheres[fingerStarts[f]].visible) {
            const positions = line.geometry.attributes.position;
            positions.setXYZ(0, spheres[WRIST].position.x, spheres[WRIST].position.y, spheres[WRIST].position.z);
            positions.setXYZ(1, spheres[fingerStarts[f]].position.x, spheres[fingerStarts[f]].position.y, spheres[fingerStarts[f]].position.z);
            positions.needsUpdate = true;
            line.visible = true;
          } else {
            line.visible = false;
          }
          lineIdx++;
        }
      }
    }

    return visible ? joints : null;
  }

  // ── Gesture Recognition ───────────────────────────────────────────
  function dist3D(a, b) {
    return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2 + (a.z - b.z) ** 2);
  }

  function getJoint(joints, idx) {
    return joints.find(j => j.index === idx) || null;
  }

  function recognizeGestures(joints, side) {
    if (!joints || joints.length < 20) return 'none';
    const thumb = getJoint(joints, THUMB_TIP);
    const index = getJoint(joints, INDEX_TIP);
    const middle = getJoint(joints, MIDDLE_TIP);
    const ring = getJoint(joints, RING_TIP);
    const pinky = getJoint(joints, PINKY_TIP);
    const wrist = getJoint(joints, WRIST);
    const indexMeta = getJoint(joints, INDEX_META);
    const middleMeta = getJoint(joints, MIDDLE_META);
    const thumbMeta = getJoint(joints, THUMB_META);
    if (!thumb || !index || !middle || !ring || !pinky || !wrist) return 'none';

    const thumbIndexDist = dist3D(thumb, index);
    const thumbMiddleDist = dist3D(thumb, middle);

    // Index finger extension (distance from index tip to wrist vs metacarpal to wrist)
    const indexExt = indexMeta ? dist3D(index, wrist) / Math.max(dist3D(indexMeta, wrist), 0.01) : 0;
    const middleExt = middleMeta ? dist3D(middle, wrist) / Math.max(dist3D(middleMeta, wrist), 0.01) : 0;
    const ringCurled = dist3D(ring, wrist) < 0.10;
    const pinkyCurled = dist3D(pinky, wrist) < 0.10;

    // PINCH: thumb and index tips close together
    if (thumbIndexDist < 0.025) {
      gestureState.pinch[side] = true;
      return 'pinch';
    }
    gestureState.pinch[side] = false;

    // POINT: index extended, others curled
    if (indexExt > 1.6 && middleExt < 1.3 && ringCurled && pinkyCurled) {
      gestureState.point[side] = true;
      // Update cursor position along pointing direction
      if (cursorSphere && indexMeta) {
        const dir = { x: index.x - indexMeta.x, y: index.y - indexMeta.y, z: index.z - indexMeta.z };
        const len = Math.sqrt(dir.x ** 2 + dir.y ** 2 + dir.z ** 2) || 1;
        cursorSphere.position.set(
          index.x + (dir.x / len) * 2,
          index.y + (dir.y / len) * 2,
          index.z + (dir.z / len) * 2
        );
        cursorSphere.visible = true;
      }
      return 'point';
    }
    gestureState.point[side] = false;
    if (!gestureState.point.left && !gestureState.point.right && cursorSphere) {
      cursorSphere.visible = false;
    }

    // THUMBS UP: thumb extended upward, fingers curled
    if (thumb.y > wrist.y + 0.06 && thumbIndexDist > 0.05 && ringCurled && pinkyCurled && middleExt < 1.3) {
      gestureState.thumbsUp[side] = true;
      return 'thumbsUp';
    }
    gestureState.thumbsUp[side] = false;

    // WAVE: detect repeated lateral wrist motion
    if (wrist) {
      const dy = Math.abs(wrist.x - lastWaveY[side]);
      if (dy > 0.04) {
        waveCycles[side]++;
        lastWaveY[side] = wrist.x;
      }
      if (waveCycles[side] >= 4) {
        gestureState.wave[side] = true;
        waveCycles[side] = 0;
        return 'wave';
      }
    }
    gestureState.wave[side] = false;

    // GRAB: all fingers curled (fist)
    if (thumbIndexDist < 0.04 && thumbMiddleDist < 0.04 && ringCurled && pinkyCurled) {
      gestureState.grab[side] = true;
      return 'grab';
    }
    gestureState.grab[side] = false;

    return 'none';
  }

  // ── Haptic Feedback ───────────────────────────────────────────────
  function triggerHaptic(session, hand, intensity, duration) {
    if (!session) return;
    try {
      for (const source of session.inputSources) {
        if (source.handedness === hand && source.gamepad && source.gamepad.hapticActuators) {
          const actuators = source.gamepad.hapticActuators;
          if (actuators.length > 0) {
            actuators[0].pulse(intensity, duration);
          }
        }
        // Also try vibrationActuator (newer API)
        if (source.handedness === hand && source.gamepad && source.gamepad.vibrationActuator) {
          source.gamepad.vibrationActuator.playEffect('dual-rumble', {
            duration, strongMagnitude: intensity, weakMagnitude: intensity * 0.5
          });
        }
      }
    } catch (e) { /* Haptics not available */ }
  }

  const HAPTIC = {
    discover: { intensity: 0.6, duration: 200, pattern: 'pulse' },
    teleport: { intensity: 0.8, duration: 100, pattern: 'sharp' },
    photo: { intensity: 0.4, duration: 150, pattern: 'soft' },
    npc: { intensity: 0.3, duration: 100, pattern: 'tap' },
    grab: { intensity: 0.5, duration: 80, pattern: 'click' },
    tracking: { intensity: 0.1, duration: 30, pattern: 'subtle' },
  };

  function hapticFeedback(session, hand, type) {
    const h = HAPTIC[type] || HAPTIC.tracking;
    triggerHaptic(session, hand, h.intensity, h.duration);
    // Double-pulse for discover
    if (type === 'discover') {
      setTimeout(() => triggerHaptic(session, hand, h.intensity * 0.5, h.duration), h.duration + 50);
    }
  }

  // ── Gesture Action Handlers ───────────────────────────────────────
  function handleGestureActions(gesture, side, dt, context) {
    const { session, vrCamGroup, camera, poiMarkers, npcs, collectibles, photoSpots,
            scene, THREE, MS, LM, clock } = context;

    // Pinch → Teleport (right hand)
    if (gesture === 'pinch' && side === 'right' && teleportCooldown <= 0) {
      teleportCooldown = 1.0;
      // Teleport 3m forward in look direction
      const camWorld = new THREE.Vector3();
      camera.getWorldPosition(camWorld);
      const dir = new THREE.Vector3(0, 0, -1);
      camera.getWorldDirection(dir);
      dir.y = 0; dir.normalize();
      vrCamGroup.position.x += dir.x * 3;
      vrCamGroup.position.z += dir.z * 3;
      hapticFeedback(session, side, 'teleport');
    }

    // Point → Select/highlight nearest POI (either hand)
    if (gesture === 'point' && cursorSphere && cursorSphere.visible) {
      const cp = cursorSphere.position;
      let nearest = null, nd = Infinity;
      poiMarkers.forEach(m => {
        const dx = cp.x - m.x, dz = cp.z - m.z;
        const d = Math.sqrt(dx * dx + dz * dz);
        if (d < m.radius && d < nd) { nearest = m; nd = d; }
      });
      if (nearest) {
        nearest.ring.material.opacity = 0.9;
        nearest.ring.material.color.setHex(0xFFD700);
        hapticFeedback(session, side, 'tracking');
      }
    }

    // Thumbs Up → Take photo (either hand)
    if (gesture === 'thumbsUp' && photoCooldown <= 0) {
      photoCooldown = 2.0;
      if (MS) MS.updatePhotoSpots(photoSpots, clock.elapsedTime, camera);
      // Try to take photo at nearest spot
      if (MS && MS.photosTaken) {
        const near = photoSpots.find(s => {
          const dx = camera.position.x - s.pos.x, dz = camera.position.z - s.pos.z;
          return Math.sqrt(dx * dx + dz * dz) < 8;
        });
        if (near && !MS.photosTaken.has(near.def.name)) {
          document.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyF' }));
          hapticFeedback(session, side, 'photo');
        }
      }
    }

    // Wave → Interact with NPCs (either hand)
    if (gesture === 'wave' && npcCooldown <= 0) {
      npcCooldown = 3.0;
      const camPos = new THREE.Vector3();
      camera.getWorldPosition(camPos);
      let nearest = null, nd = Infinity;
      npcs.forEach(npc => {
        const dx = camPos.x - npc.pos.x, dz = camPos.z - npc.pos.z;
        const d = Math.sqrt(dx * dx + dz * dz);
        if (d < 10 && d < nd) { nearest = npc; nd = d; }
      });
      if (nearest && !MS.dialogOpen) {
        MS.updateNPCs(npcs, 0, clock.elapsedTime, camera, null);
        hapticFeedback(session, side, 'npc');
      }
    }

    // Grab → Pick up items (either hand)
    if (gesture === 'grab' && grabCooldown <= 0) {
      grabCooldown = 0.5;
      const camPos = new THREE.Vector3();
      camera.getWorldPosition(camPos);
      collectibles.forEach(c => {
        if (c.collected) return;
        const dx = camPos.x - c.pos.x, dz = camPos.z - c.pos.z;
        if (Math.sqrt(dx * dx + dz * dz) < 4) {
          c.collected = true; c.fadeTimer = 0;
          c.mesh.material.transparent = true;
          hapticFeedback(session, side, 'grab');
        }
      });
    }
  }

  // ── Update Wrist Compass ──────────────────────────────────────────
  function updateWristCompass(leftJoints, vrYaw, THREE) {
    if (!wristCompass || !leftJoints) { if (wristCompass) wristCompass.visible = false; return; }
    const wrist = getJoint(leftJoints, WRIST);
    if (!wrist) { wristCompass.visible = false; return; }
    wristCompass.visible = true;
    wristCompass.position.set(wrist.x, wrist.y + 0.03, wrist.z);
    // Rotate compass face to match world north
    if (wristCompass.userData.face) {
      wristCompass.userData.face.rotation.z = vrYaw;
    }
  }

  // ── Update Distance Labels in VR ──────────────────────────────────
  function updateVRDistanceLabels(camera, THREE) {
    const camPos = new THREE.Vector3();
    camera.getWorldPosition(camPos);
    distanceLabels.forEach(dl => {
      const dx = camPos.x - dl.marker.x, dz = camPos.z - dl.marker.z;
      const dist = Math.sqrt(dx * dx + dz * dz);
      if (dist < 150 && dist > 5) {
        dl.sprite.visible = true;
        const ctx = dl.canvas.getContext('2d');
        ctx.clearRect(0, 0, 256, 64);
        ctx.font = 'bold 24px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillStyle = '#FFD700';
        ctx.fillText(`${Math.round(dist)}m`, 128, 28);
        ctx.font = '16px sans-serif';
        ctx.fillStyle = 'rgba(255,255,255,0.7)';
        ctx.fillText(dl.poi.name, 128, 52);
        dl.tex.needsUpdate = true;
        // Face camera
        dl.sprite.lookAt(camPos);
      } else {
        dl.sprite.visible = false;
      }
    });
  }

  // ── Update VR Menu Position ───────────────────────────────────────
  function updateVRMenu(leftJoints, camera, THREE) {
    if (!vrMenuGroup) return;
    // Show menu when left palm faces up (wrist above middle finger base)
    const wrist = leftJoints ? getJoint(leftJoints, WRIST) : null;
    const middleMeta = leftJoints ? getJoint(leftJoints, MIDDLE_META) : null;
    if (wrist && middleMeta && wrist.y > middleMeta.y + 0.03) {
      vrMenuGroup.visible = true;
      vrMenuGroup.position.set(wrist.x, wrist.y + 0.15, wrist.z);
      const camPos = new THREE.Vector3();
      camera.getWorldPosition(camPos);
      vrMenuGroup.lookAt(camPos);
    } else {
      vrMenuGroup.visible = false;
    }
  }

  // ── Main Update Function ──────────────────────────────────────────
  function update(frame, refSpace, dt, context) {
    const { session, THREE, camera, scene } = context;
    if (!session || !frame || !refSpace) return;

    // Decrement cooldowns
    teleportCooldown = Math.max(0, teleportCooldown - dt);
    photoCooldown = Math.max(0, photoCooldown - dt);
    npcCooldown = Math.max(0, npcCooldown - dt);
    grabCooldown = Math.max(0, grabCooldown - dt);

    // Decay wave counters
    wavePhase.left += dt;
    wavePhase.right += dt;
    if (wavePhase.left > 1.5) { waveCycles.left = 0; wavePhase.left = 0; }
    if (wavePhase.right > 1.5) { waveCycles.right = 0; wavePhase.right = 0; }

    // Get hand references from session
    let leftJoints = null, rightJoints = null;
    for (const source of session.inputSources) {
      if (source.hand) {
        if (source.handedness === 'left') {
          leftHand = source.hand;
          leftJoints = updateHandJoints(source.hand, frame, refSpace, jointSpheres.left, leftHandMesh, 'left', THREE);
        }
        if (source.handedness === 'right') {
          rightHand = source.hand;
          rightJoints = updateHandJoints(source.hand, frame, refSpace, jointSpheres.right, rightHandMesh, 'right', THREE);
        }
      }
    }

    // Recognize gestures
    const leftGesture = recognizeGestures(leftJoints, 'left');
    const rightGesture = recognizeGestures(rightJoints, 'right');

    // Fire action on gesture change (rising edge)
    if (leftGesture !== 'none' && leftGesture !== prevGesture.left) {
      handleGestureActions(leftGesture, 'left', dt, context);
      // Subtle haptic for new gesture detection
      if (leftGesture !== 'none') hapticFeedback(session, 'left', 'tracking');
    }
    if (rightGesture !== 'none' && rightGesture !== prevGesture.right) {
      handleGestureActions(rightGesture, 'right', dt, context);
      if (rightGesture !== 'none') hapticFeedback(session, 'right', 'tracking');
    }
    prevGesture.left = leftGesture;
    prevGesture.right = rightGesture;

    // VR UI updates
    updateWristCompass(leftJoints, context.vrYaw || 0, THREE);
    updateVRMenu(leftJoints, camera, THREE);
    updateVRDistanceLabels(camera, THREE);

    // POI discovery haptics
    if (context.LM) {
      const newly = context.LM.discovered;
      if (newly && newly.size > (context._lastDiscovered || 0)) {
        hapticFeedback(session, 'right', 'discover');
        hapticFeedback(session, 'left', 'discover');
        context._lastDiscovered = newly.size;
      }
    }
  }

  // ── Initialize ────────────────────────────────────────────────────
  function init(THREE, scene, camera, poiMarkers) {
    createHandVisuals(THREE, scene);
    const compass = createWristCompass(THREE);
    scene.add(compass);
    const menu = createVRMenu(THREE);
    scene.add(menu);
    if (poiMarkers) createDistanceLabels(THREE, poiMarkers);
    handTrackingSupported = true;
  }

  // ── Cleanup ───────────────────────────────────────────────────────
  function cleanup(scene) {
    jointSpheres.left.forEach(s => scene.remove(s));
    jointSpheres.right.forEach(s => scene.remove(s));
    if (leftHandMesh) scene.remove(leftHandMesh);
    if (rightHandMesh) scene.remove(rightHandMesh);
    if (cursorSphere) scene.remove(cursorSphere);
    if (wristCompass) scene.remove(wristCompass);
    if (vrMenuGroup) scene.remove(vrMenuGroup);
    distanceLabels.forEach(dl => { if (dl.sprite.parent) dl.sprite.parent.remove(dl.sprite); });
  }

  // ── Public API ────────────────────────────────────────────────────
  window.VRHands = {
    init,
    update,
    cleanup,
    get handTrackingSupported() { return handTrackingSupported; },
    get gestureState() { return gestureState; },
    get leftHand() { return leftHand; },
    get rightHand() { return rightHand; },
    hapticFeedback,
  };
})();
