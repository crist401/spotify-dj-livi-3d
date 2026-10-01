import * as THREE from 'three';

/**
 * Procedural 3D Device Generator for Spotify DJ Livi ESP32 Device
 * Creates a high-fidelity 3D model with PBR materials, interactive buttons,
 * OLED dynamic screen, and visible ESP32 microcontroller.
 */
export function createProceduralDevice(screenTexture) {
  const group = new THREE.Group();
  group.name = "Spotify_DJ_Livi_Device";

  // --- Materials ---
  const bodyMaterial = new THREE.MeshStandardMaterial({
    color: 0x181a1f,
    roughness: 0.35,
    metalness: 0.25,
    envMapIntensity: 1.0
  });

  const bodyAccentMaterial = new THREE.MeshStandardMaterial({
    color: 0x0f1114,
    roughness: 0.6,
    metalness: 0.1
  });

  const buttonPowerMaterial = new THREE.MeshStandardMaterial({
    color: 0x22262c,
    roughness: 0.3,
    metalness: 0.4,
    emissive: 0x112211,
    emissiveIntensity: 0.2
  });

  const buttonVolumeMaterial = new THREE.MeshStandardMaterial({
    color: 0x2a2e36,
    roughness: 0.25,
    metalness: 0.6
  });

  const buttonPlayMaterial = new THREE.MeshStandardMaterial({
    color: 0x1db954,
    roughness: 0.2,
    metalness: 0.3,
    emissive: 0x1db954,
    emissiveIntensity: 0.3
  });

  const metalTrimMaterial = new THREE.MeshStandardMaterial({
    color: 0x88929e,
    roughness: 0.2,
    metalness: 0.85
  });

  const pcbMaterial = new THREE.MeshStandardMaterial({
    color: 0x0a2215, // Dark PCB green
    roughness: 0.4,
    metalness: 0.3
  });

  const chipMaterial = new THREE.MeshStandardMaterial({
    color: 0x1a1a1a,
    roughness: 0.5,
    metalness: 0.1
  });

  const rfShieldMaterial = new THREE.MeshStandardMaterial({
    color: 0xd0d7de,
    roughness: 0.15,
    metalness: 0.95
  });

  const goldPinMaterial = new THREE.MeshStandardMaterial({
    color: 0xd4af37,
    roughness: 0.2,
    metalness: 0.9
  });

  const acrylicMaterial = new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.35,
    roughness: 0.1,
    metalness: 0.1,
    transmission: 0.85,
    ior: 1.5,
    thickness: 0.5
  });

  const screenMaterial = new THREE.MeshBasicMaterial({
    map: screenTexture,
    toneMapped: false
  });

  const ledRingMaterial = new THREE.MeshStandardMaterial({
    color: 0x1db954,
    emissive: 0x1db954,
    emissiveIntensity: 1.2,
    roughness: 0.2,
    metalness: 0.1
  });

  // --- 1. Main Console Body ---
  // Dimensions: Width = 5.2, Height = 1.4, Depth = 3.6
  const baseGeo = new THREE.BoxGeometry(5.2, 1.2, 3.4);
  const baseMesh = new THREE.Mesh(baseGeo, bodyMaterial);
  baseMesh.position.y = 0.6;
  baseMesh.castShadow = true;
  baseMesh.receiveShadow = true;
  group.add(baseMesh);

  // Top Beveled Chamfer Plate
  const topPlateGeo = new THREE.BoxGeometry(5.0, 0.25, 3.2);
  const topPlate = new THREE.Mesh(topPlateGeo, bodyAccentMaterial);
  topPlate.position.y = 1.25;
  topPlate.castShadow = true;
  topPlate.receiveShadow = true;
  group.add(topPlate);

  // Rubber Feet
  const footGeo = new THREE.CylinderGeometry(0.2, 0.2, 0.1, 16);
  const footMat = new THREE.MeshStandardMaterial({ color: 0x050505, roughness: 0.9 });
  const footPositions = [
    [-2.2, 0.05, -1.4],
    [2.2, 0.05, -1.4],
    [-2.2, 0.05, 1.4],
    [2.2, 0.05, 1.4]
  ];
  footPositions.forEach(pos => {
    const foot = new THREE.Mesh(footGeo, footMat);
    foot.position.set(...pos);
    group.add(foot);
  });

  // --- 2. Screen Section (Center-Left) ---
  // Screen Bezel / Frame
  const bezelGeo = new THREE.BoxGeometry(2.6, 0.08, 1.6);
  const bezel = new THREE.Mesh(bezelGeo, metalTrimMaterial);
  bezel.position.set(-0.8, 1.38, -0.4);
  group.add(bezel);

  // Screen Mesh (Mapped with Dynamic Canvas Texture)
  const screenGeo = new THREE.PlaneGeometry(2.4, 1.4);
  const screenMesh = new THREE.Mesh(screenGeo, screenMaterial);
  screenMesh.rotation.x = -Math.PI / 2;
  screenMesh.position.set(-0.8, 1.43, -0.4);
  screenMesh.name = "Screen"; // Important for mapper!
  group.add(screenMesh);

  // --- 3. Interactive Buttons (Bottom Row) ---

  // Button 1: Power ON/OFF (Left)
  const btnPowerBaseGeo = new THREE.CylinderGeometry(0.38, 0.42, 0.12, 32);
  const btnPowerBase = new THREE.Mesh(btnPowerBaseGeo, metalTrimMaterial);
  btnPowerBase.position.set(-1.8, 1.38, 0.85);
  group.add(btnPowerBase);

  const btnPowerGeo = new THREE.CylinderGeometry(0.32, 0.32, 0.25, 32);
  const btnPower = new THREE.Mesh(btnPowerGeo, buttonPowerMaterial);
  btnPower.position.set(-1.8, 1.45, 0.85);
  btnPower.name = "Btn_Power"; // Raycast Target
  btnPower.castShadow = true;
  btnPower.userData = { originalY: 1.45, isPressed: false, label: "Power Button" };
  group.add(btnPower);

  // Button 1 LED Status Dot on top of power button
  const ledPowerDotGeo = new THREE.SphereGeometry(0.06, 16, 16);
  const ledPowerDotMat = new THREE.MeshStandardMaterial({
    color: 0xff3333,
    emissive: 0xff3333,
    emissiveIntensity: 0.8
  });
  const ledPowerDot = new THREE.Mesh(ledPowerDotGeo, ledPowerDotMat);
  ledPowerDot.position.set(0, 0.13, 0);
  ledPowerDot.name = "LED_Power_Dot";
  btnPower.add(ledPowerDot);

  // --- Button 2: Volume Rotary Knob (Center) ---
  const btnVolBaseGeo = new THREE.CylinderGeometry(0.50, 0.54, 0.12, 32);
  const btnVolBase = new THREE.Mesh(btnVolBaseGeo, metalTrimMaterial);
  btnVolBase.position.set(-0.6, 1.38, 0.85);
  group.add(btnVolBase);

  // Dial graduation tick dots around the knob
  for (let a = -135; a <= 135; a += 30) {
    const rad = (a * Math.PI) / 180;
    const tickGeo = new THREE.BoxGeometry(0.04, 0.02, 0.12);
    const tickMat = new THREE.MeshStandardMaterial({
      color: 0x1db954,
      emissive: 0x1db954,
      emissiveIntensity: 0.5
    });
    const tick = new THREE.Mesh(tickGeo, tickMat);
    tick.position.set(-0.6 + Math.sin(rad) * 0.62, 1.39, 0.85 - Math.cos(rad) * 0.62);
    tick.rotation.y = -rad;
    group.add(tick);
  }

  // Rotary Knob Body (High-Grip Potentiometer / Encoder)
  const btnVolGeo = new THREE.CylinderGeometry(0.42, 0.44, 0.38, 32);
  const btnVol = new THREE.Mesh(btnVolGeo, buttonVolumeMaterial);
  btnVol.position.set(-0.6, 1.52, 0.85);
  btnVol.name = "Btn_Volume"; // Raycast Target
  btnVol.castShadow = true;
  btnVol.userData = { 
    originalY: 1.52, 
    isKnob: true,
    minAngle: -2.356, // -135 degrees
    maxAngle: 2.356,  // +135 degrees
    label: "Perilla de Volumen (Girar Izquierda / Derecha)" 
  };
  group.add(btnVol);

  // Metallic pointer indicator groove on top and side of knob
  const volPointerGeo = new THREE.BoxGeometry(0.05, 0.08, 0.38);
  const volPointerMat = new THREE.MeshStandardMaterial({
    color: 0x1db954,
    emissive: 0x1db954,
    emissiveIntensity: 1.0,
    metalness: 0.9,
    roughness: 0.1
  });
  const volPointer = new THREE.Mesh(volPointerGeo, volPointerMat);
  volPointer.position.set(0, 0.17, -0.12);
  btnVol.add(volPointer);

  // Knurling ribs around the perimeter of the knob
  for (let r = 0; r < 24; r++) {
    const angle = (r / 24) * Math.PI * 2;
    const ribGeo = new THREE.BoxGeometry(0.025, 0.32, 0.025);
    const rib = new THREE.Mesh(ribGeo, metalTrimMaterial);
    rib.position.set(Math.sin(angle) * 0.43, 0, Math.cos(angle) * 0.43);
    rib.rotation.y = angle;
    btnVol.add(rib);
  }

  // Button 3: Play / Pause (Right button on row)
  const btnPlayBaseGeo = new THREE.CylinderGeometry(0.48, 0.52, 0.12, 32);
  const btnPlayBase = new THREE.Mesh(btnPlayBaseGeo, metalTrimMaterial);
  btnPlayBase.position.set(0.6, 1.38, 0.85);
  group.add(btnPlayBase);

  const btnPlayGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.28, 32);
  const btnPlay = new THREE.Mesh(btnPlayGeo, buttonPlayMaterial);
  btnPlay.position.set(0.6, 1.47, 0.85);
  btnPlay.name = "Btn_PlayPause"; // Raycast Target
  btnPlay.castShadow = true;
  btnPlay.userData = { originalY: 1.47, isPressed: false, label: "Play / Pause" };
  group.add(btnPlay);

  // Play icon symbol embossing on button 3
  const playIconGeo = new THREE.ConeGeometry(0.12, 0.2, 3);
  playIconGeo.rotateX(Math.PI / 2);
  playIconGeo.rotateZ(-Math.PI / 2);
  const playIcon = new THREE.Mesh(playIconGeo, metalTrimMaterial);
  playIcon.position.set(0, 0.15, 0);
  btnPlay.add(playIcon);

  // --- 4. Ambient LED Ring / Light Strip (Bottom rim) ---
  const ledRingGeo = new THREE.TorusGeometry(2.3, 0.04, 16, 64);
  ledRingGeo.scale(1, 0.7, 1);
  const ledRing = new THREE.Mesh(ledRingGeo, ledRingMaterial);
  ledRing.rotation.x = Math.PI / 2;
  ledRing.position.set(0, 0.12, 0);
  ledRing.name = "LED_Ring";
  group.add(ledRing);

  // --- 5. ESP32 Microcontroller Bay (Right Side Acrylic Window) ---
  // Window frame recess
  const windowFrameGeo = new THREE.BoxGeometry(1.6, 0.1, 2.5);
  const windowFrame = new THREE.Mesh(windowFrameGeo, bodyAccentMaterial);
  windowFrame.position.set(1.6, 1.32, -0.3);
  group.add(windowFrame);

  // Acrylic Glass Cover
  const glassGeo = new THREE.BoxGeometry(1.5, 0.04, 2.4);
  const glassCover = new THREE.Mesh(glassGeo, acrylicMaterial);
  glassCover.position.set(1.6, 1.39, -0.3);
  group.add(glassCover);

  // ESP32 PCB Module Group inside the chamber
  const esp32Group = new THREE.Group();
  esp32Group.name = "ESP32_Board";
  esp32Group.position.set(1.6, 1.25, -0.3);

  // PCB Board (ESP32-WROOM-32 form factor)
  const pcbGeo = new THREE.BoxGeometry(1.1, 0.04, 2.0);
  const pcb = new THREE.Mesh(pcbGeo, pcbMaterial);
  esp32Group.add(pcb);

  // ESP32 RF Shield (Metal can)
  const rfGeo = new THREE.BoxGeometry(0.85, 0.07, 0.9);
  const rfShield = new THREE.Mesh(rfGeo, rfShieldMaterial);
  rfShield.position.set(0, 0.04, -0.2);
  esp32Group.add(rfShield);

  // Antenna trace section (Top of ESP32)
  const antGeo = new THREE.BoxGeometry(0.85, 0.03, 0.35);
  const antMat = new THREE.MeshStandardMaterial({ color: 0x050505, roughness: 0.8 });
  const ant = new THREE.Mesh(antGeo, antMat);
  ant.position.set(0, 0.03, -0.75);
  esp32Group.add(ant);

  // Micro-USB / USB-C Connector (Bottom of ESP32)
  const usbGeo = new THREE.BoxGeometry(0.35, 0.12, 0.25);
  const usb = new THREE.Mesh(usbGeo, metalTrimMaterial);
  usb.position.set(0, 0.06, 0.95);
  esp32Group.add(usb);

  // Dual Header Pins (Gold)
  for (let i = -0.7; i <= 0.7; i += 0.14) {
    const pinGeo = new THREE.BoxGeometry(0.04, 0.12, 0.04);
    const pinL = new THREE.Mesh(pinGeo, goldPinMaterial);
    pinL.position.set(-0.48, 0.06, i);
    esp32Group.add(pinL);

    const pinR = new THREE.Mesh(pinGeo, goldPinMaterial);
    pinR.position.set(0.48, 0.06, i);
    esp32Group.add(pinR);
  }

  // ESP32 Blinking GPIO LEDs (Red Power LED & Blue Status LED)
  const espLedGeo = new THREE.BoxGeometry(0.05, 0.03, 0.05);
  
  const espPowerLedMat = new THREE.MeshStandardMaterial({
    color: 0xff2222,
    emissive: 0xff0000,
    emissiveIntensity: 0.8
  });
  const espPowerLed = new THREE.Mesh(espLedGeo, espPowerLedMat);
  espPowerLed.position.set(-0.25, 0.04, 0.5);
  espPowerLed.name = "ESP32_LED_Power";
  esp32Group.add(espPowerLed);

  const espStatusLedMat = new THREE.MeshStandardMaterial({
    color: 0x00d2ff,
    emissive: 0x00d2ff,
    emissiveIntensity: 0.0 // starts off
  });
  const espStatusLed = new THREE.Mesh(espLedGeo, espStatusLedMat);
  espStatusLed.position.set(0.25, 0.04, 0.5);
  espStatusLed.name = "ESP32_LED_Status";
  esp32Group.add(espStatusLed);

  group.add(esp32Group);

  // Rear I/O Panel (Power Switch, USB Jack, Audio Jack)
  const rearPanelGeo = new THREE.BoxGeometry(4.8, 0.8, 0.1);
  const rearPanel = new THREE.Mesh(rearPanelGeo, bodyAccentMaterial);
  rearPanel.position.set(0, 0.6, -1.71);
  group.add(rearPanel);

  const rearPortGeo = new THREE.BoxGeometry(0.4, 0.18, 0.15);
  const rearPort = new THREE.Mesh(rearPortGeo, metalTrimMaterial);
  rearPort.position.set(0, 0.6, -1.72);
  group.add(rearPort);

  return group;
}
