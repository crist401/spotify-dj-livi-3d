import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { audioEngine } from './audioEngine.js';
import { esp32Bridge } from './esp32Bridge.js';
import { createProceduralDevice } from './proceduralDevice.js';

/**
 * Main Three.js Application for Spotify DJ Livi ESP32 Device
 * Featuring Interactive Rotary Volume Knob (Girar Derecha = Vol+, Girar Izquierda = Vol-)
 * and Dynamic OLED Screen with DJ Livi Info & Music Playback Info.
 */
class SpotifyDeviceApp {
  constructor() {
    this.container = document.getElementById('canvas-container');
    this.canvas = document.getElementById('webgl-canvas');
    
    // Device State
    this.isPoweredOn = false;
    this.isPlaying = false;
    this.volume = 0.7; // 0.0 to 1.0 (70%)
    this.bootProgress = 0;
    this.isBooting = false;
    this.bootTimer = null;
    this.trackProgress = 0.35; // simulated track position
    this.trackDurationSec = 195; // 3:15
    this.currentTrackTitle = "Livi's Chill Beats (ESP32 Mix)";
    this.currentArtist = "Spotify AI DJ • Electronic Waves";
    this.currentDJStatus = "Seleccionando tus favoritos para hoy...";
    this.volHudTimer = 0; // Show volume popup on screen
    
    // Three.js Core
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.controls = null;
    this.currentModelGroup = null;
    
    // Raycasting & Interaction
    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();
    this.interactiveObjects = [];
    this.hoveredObject = null;
    this.isDraggingKnob = false;
    this.dragStartX = 0;
    this.dragStartVolume = 0.7;

    // Mesh Mapping Configuration
    this.meshMapping = {
      power: 'Btn_Power',
      volume: 'Btn_Volume',
      play: 'Btn_PlayPause',
      screen: 'Screen',
      leds: 'LED_Ring'
    };
    
    // Mapped Mesh References
    this.meshes = {
      power: null,
      volume: null,
      play: null,
      screen: null,
      leds: null,
      esp32StatusLed: null
    };

    // Screen 2D Dynamic Canvas (High Resolution 512x256)
    this.screenCanvas = document.getElementById('device-screen-canvas');
    this.screenCanvas.width = 512;
    this.screenCanvas.height = 256;
    this.screenCtx = this.screenCanvas.getContext('2d');
    this.screenTexture = new THREE.CanvasTexture(this.screenCanvas);
    this.screenTexture.minFilter = THREE.LinearFilter;
    this.screenTexture.magFilter = THREE.LinearFilter;

    // HUD Visualizer
    this.hudVisCanvas = document.getElementById('hud-visualizer-canvas');
    this.hudVisCtx = this.hudVisCanvas.getContext('2d');

    // UI Elements
    this.dom = {
      loadingOverlay: document.getElementById('loading-overlay'),
      loadingStatus: document.getElementById('loading-status'),
      loadingProgress: document.getElementById('loading-progress'),
      badgePower: document.getElementById('badge-power'),
      badgeEsp32: document.getElementById('badge-esp32'),
      btnWebSerial: document.getElementById('btn-webserial'),
      djBubble: document.getElementById('dj-bubble'),
      djSpeechText: document.getElementById('dj-speech-text'),
      uiBtnPlay: document.getElementById('ui-btn-play'),
      uiBtnPrev: document.getElementById('ui-btn-prev'),
      uiBtnNext: document.getElementById('ui-btn-next'),
      uiBtnTalk: document.getElementById('ui-btn-talk'),
      hudVolSlider: document.getElementById('hud-volume-slider'),
      hudVolText: document.getElementById('hud-volume-text'),
      hudSongTitle: document.getElementById('hud-song-title'),
      hudArtist: document.getElementById('hud-artist'),
      serialLog: document.getElementById('serial-log'),
      btnClearTerm: document.getElementById('btn-clear-term'),
      btnBrowseGlb: document.getElementById('btn-browse-glb'),
      glbFileInput: document.getElementById('glb-file-input'),
      dropZone: document.getElementById('drop-zone'),
      btnProcedural: document.getElementById('btn-use-procedural'),
      btnOpenMapper: document.getElementById('btn-open-mapper'),
      modalMapper: document.getElementById('modal-mesh-mapper'),
      btnCloseMapper: document.getElementById('btn-close-mapper'),
      btnSaveMapping: document.getElementById('btn-save-mapping'),
      detectedMeshList: document.getElementById('detected-mesh-list'),
      mapNamePower: document.getElementById('map-name-power'),
      mapNameVol: document.getElementById('map-name-vol'),
      mapNamePlay: document.getElementById('map-name-play'),
      mapNameScreen: document.getElementById('map-name-screen'),
      mapNameLeds: document.getElementById('map-name-leds'),
      btnToggleLights: document.getElementById('btn-toggle-lights'),
      btnToggleWireframe: document.getElementById('btn-toggle-wireframe'),
      btnResetCam: document.getElementById('btn-reset-cam')
    };

    // Lights
    this.studioLights = [];
    this.wireframeActive = false;

    // Animation Clock
    this.clock = new THREE.Clock();

    this.init();
  }

  async init() {
    this.updateLoading(20, "Inicializando motor Three.js...");
    this.setupThreeScene();
    
    this.updateLoading(50, "Configurando luces de estudio y materiales...");
    this.setupLighting();
    this.setupEnvironment();

    this.updateLoading(70, "Generando dispositivo Spotify DJ Livi con ESP32...");
    this.loadProceduralDevice();

    this.updateLoading(90, "Conectando eventos de perilla de volumen y audio...");
    this.setupEventListeners();
    this.setupEsp32Bridge();

    // Resize handlers
    this.onWindowResize();
    window.addEventListener('resize', () => this.onWindowResize());

    // Update initial knob rotation
    this.updateKnobRotation();

    // Start loop
    this.updateLoading(100, "¡Listo!");
    setTimeout(() => {
      this.dom.loadingOverlay.classList.add('hidden');
    }, 400);

    this.animate();
  }

  updateLoading(pct, text) {
    if (this.dom.loadingProgress) this.dom.loadingProgress.style.width = `${pct}%`;
    if (this.dom.loadingStatus) this.dom.loadingStatus.innerText = text;
  }

  setupThreeScene() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0a0c10);
    this.scene.fog = new THREE.FogExp2(0x0a0c10, 0.04);

    const aspect = window.innerWidth / window.innerHeight;
    this.camera = new THREE.PerspectiveCamera(45, aspect, 0.1, 100);
    this.camera.position.set(0, 4.2, 6.2);

    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      powerPreference: "high-performance",
      alpha: true
    });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.05;
    this.controls.maxPolarAngle = Math.PI / 2 - 0.02;
    this.controls.minDistance = 3;
    this.controls.maxDistance = 15;
    this.controls.target.set(0, 0.8, 0);
  }

  setupLighting() {
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
    this.scene.add(ambientLight);
    this.studioLights.push(ambientLight);

    const keyLight = new THREE.DirectionalLight(0xfff5e6, 2.2);
    keyLight.position.set(5, 8, 5);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.width = 2048;
    keyLight.shadow.mapSize.height = 2048;
    keyLight.shadow.bias = -0.0005;
    this.scene.add(keyLight);
    this.studioLights.push(keyLight);

    const fillLight = new THREE.DirectionalLight(0x88bbff, 1.2);
    fillLight.position.set(-6, 4, 3);
    this.scene.add(fillLight);
    this.studioLights.push(fillLight);

    const rimLightGreen = new THREE.PointLight(0x1db954, 2.8, 10);
    rimLightGreen.position.set(0, 3, -4);
    this.scene.add(rimLightGreen);
    this.studioLights.push(rimLightGreen);

    const cyanLight = new THREE.PointLight(0x00d2ff, 1.6, 8);
    cyanLight.position.set(3, 1, 2);
    this.scene.add(cyanLight);
    this.studioLights.push(cyanLight);
  }

  setupEnvironment() {
    const tableGeo = new THREE.CylinderGeometry(5.5, 6.0, 0.4, 64);
    const tableMat = new THREE.MeshStandardMaterial({
      color: 0x12151c,
      roughness: 0.3,
      metalness: 0.5
    });
    const table = new THREE.Mesh(tableGeo, tableMat);
    table.position.y = -0.2;
    table.receiveShadow = true;
    this.scene.add(table);

    const tableRingGeo = new THREE.TorusGeometry(5.5, 0.04, 16, 64);
    const tableRingMat = new THREE.MeshStandardMaterial({
      color: 0x00d2ff,
      emissive: 0x00d2ff,
      emissiveIntensity: 0.6
    });
    const tableRing = new THREE.Mesh(tableRingGeo, tableRingMat);
    tableRing.rotation.x = Math.PI / 2;
    tableRing.position.y = 0;
    this.scene.add(tableRing);

    const groundGeo = new THREE.PlaneGeometry(30, 30);
    const groundMat = new THREE.ShadowMaterial({ opacity: 0.4 });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.21;
    ground.receiveShadow = true;
    this.scene.add(ground);

    const grid = new THREE.GridHelper(24, 24, 0x1db954, 0x1f2633);
    grid.position.y = -0.22;
    this.scene.add(grid);
  }

  loadProceduralDevice() {
    if (this.currentModelGroup) {
      this.scene.remove(this.currentModelGroup);
    }

    this.currentModelGroup = createProceduralDevice(this.screenTexture);
    this.scene.add(this.currentModelGroup);

    this.mapSceneMeshes();
    this.updateKnobRotation();
    this.logSerial("[3D] Modelo de dispositivo ESP32 cargado correctamente.", "system");
  }

  mapSceneMeshes() {
    this.interactiveObjects = [];
    this.meshes.power = null;
    this.meshes.volume = null;
    this.meshes.play = null;
    this.meshes.screen = null;
    this.meshes.leds = null;
    this.meshes.esp32StatusLed = null;

    const detectedNames = [];

    this.currentModelGroup.traverse((child) => {
      if (child.isMesh) {
        detectedNames.push(child.name || 'SinNombre');
        child.castShadow = true;
        child.receiveShadow = true;

        const name = child.name;

        // Button 1: Power
        if (this.matchName(name, this.meshMapping.power, ['power', 'encendido', 'btn1'])) {
          this.meshes.power = child;
          this.interactiveObjects.push(child);
          child.userData.role = 'power';
          child.userData.label = 'Botón 1: Encendido / Apagado';
          if (!child.userData.originalY) child.userData.originalY = child.position.y;
        }
        // Button 2: Volume Rotary Knob
        else if (this.matchName(name, this.meshMapping.volume, ['vol', 'volumen', 'btn2', 'knob', 'perilla'])) {
          this.meshes.volume = child;
          this.interactiveObjects.push(child);
          child.userData.role = 'volume';
          child.userData.isKnob = true;
          child.userData.label = 'Perilla de Volumen (Girar Derecha = Vol+, Izquierda = Vol-)';
          if (!child.userData.originalY) child.userData.originalY = child.position.y;
        }
        // Button 3: Play/Pause
        else if (this.matchName(name, this.meshMapping.play, ['play', 'pause', 'musica', 'btn3'])) {
          this.meshes.play = child;
          this.interactiveObjects.push(child);
          child.userData.role = 'play';
          child.userData.label = 'Botón 3: Play / Pausa Música';
          if (!child.userData.originalY) child.userData.originalY = child.position.y;
        }
        // Screen Display
        else if (this.matchName(name, this.meshMapping.screen, ['screen', 'pantalla', 'oled', 'display'])) {
          this.meshes.screen = child;
          child.material = new THREE.MeshBasicMaterial({
            map: this.screenTexture,
            toneMapped: false
          });
        }
        // LED Ring / Ambient
        else if (this.matchName(name, this.meshMapping.leds, ['led', 'ring', 'halo', 'light'])) {
          this.meshes.leds = child;
        }
        // ESP32 Status LED
        else if (name.includes('ESP32_LED_Status')) {
          this.meshes.esp32StatusLed = child;
        }
      }
    });

    if (this.dom.detectedMeshList) {
      this.dom.detectedMeshList.innerHTML = detectedNames.map(n => 
        `<span class="mesh-tag" onclick="navigator.clipboard.writeText('${n}')">${n}</span>`
      ).join('');
    }

    this.logSerial(`[3D] Mallas interactivas: Botones y Perilla de Volumen mapeados.`);
  }

  matchName(meshName, targetName, fallbackKeywords) {
    if (!meshName) return false;
    const lower = meshName.toLowerCase();
    if (targetName && lower === targetName.toLowerCase()) return true;
    return fallbackKeywords.some(kw => lower.includes(kw));
  }

  loadGlbFile(file) {
    const reader = new FileReader();
    this.dom.loadingOverlay.classList.remove('hidden');
    this.updateLoading(30, `Leyendo archivo ${file.name}...`);

    reader.onload = (e) => {
      const contents = e.target.result;
      const loader = new GLTFLoader();

      this.updateLoading(60, "Decodificando modelo 3D de Blender...");

      loader.parse(contents, '', (gltf) => {
        if (this.currentModelGroup) {
          this.scene.remove(this.currentModelGroup);
        }

        const model = gltf.scene;
        model.name = "Blender_User_Model";

        const box = new THREE.Box3().setFromObject(model);
        const center = box.getCenter(new THREE.Vector3());
        const size = box.getSize(new THREE.Vector3());

        const maxDim = Math.max(size.x, size.y, size.z);
        const targetSize = 5.0;
        const scale = maxDim > 0 ? (targetSize / maxDim) : 1;

        model.scale.set(scale, scale, scale);
        model.position.x = -center.x * scale;
        model.position.y = -box.min.y * scale;
        model.position.z = -center.z * scale;

        this.currentModelGroup = model;
        this.scene.add(this.currentModelGroup);

        this.mapSceneMeshes();
        this.updateKnobRotation();

        this.dom.btnProcedural.classList.remove('active');
        this.dom.loadingOverlay.classList.add('hidden');
        this.logSerial(`[BLENDER] ¡Modelo "${file.name}" cargado! Perilla y pantalla enlazadas.`, "system");
        this.showDJMessage(`¡Cargaste tu modelo de Blender! La perilla de volumen y la pantalla OLED están listas.`);
      }, (err) => {
        this.dom.loadingOverlay.classList.add('hidden');
        alert("Error cargando el archivo GLB/GLTF de Blender: " + err.message);
      });
    };

    reader.readAsArrayBuffer(file);
  }

  // --- Interaction & Rotary Knob Logic ---

  setupEventListeners() {
    window.addEventListener('mousemove', (e) => this.onMouseMove(e));
    window.addEventListener('pointerdown', (e) => this.onPointerDown(e));
    window.addEventListener('pointermove', (e) => this.onPointerMove(e));
    window.addEventListener('pointerup', () => this.onPointerUp());
    window.addEventListener('wheel', (e) => this.onMouseWheel(e), { passive: false });

    // UI Buttons
    this.dom.uiBtnPlay.addEventListener('click', () => this.triggerButtonPlay());
    this.dom.uiBtnPrev.addEventListener('click', () => this.previousTrack());
    this.dom.uiBtnNext.addEventListener('click', () => this.nextTrack());
    this.dom.uiBtnTalk.addEventListener('click', () => this.triggerDJTalk());

    // Volume Slider on HUD
    this.dom.hudVolSlider.addEventListener('input', (e) => {
      this.setDeviceVolume(parseFloat(e.target.value) / 100);
    });

    // File Drag and Drop for Blender Models
    this.dom.btnBrowseGlb.addEventListener('click', () => this.dom.glbFileInput.click());
    this.dom.glbFileInput.addEventListener('change', (e) => {
      if (e.target.files.length > 0) this.loadGlbFile(e.target.files[0]);
    });

    const dropZone = this.dom.dropZone;
    dropZone.addEventListener('dragover', (e) => {
      e.preventDefault();
      dropZone.classList.add('dragover');
    });
    dropZone.addEventListener('dragleave', () => dropZone.classList.remove('dragover'));
    dropZone.addEventListener('drop', (e) => {
      e.preventDefault();
      dropZone.classList.remove('dragover');
      if (e.dataTransfer.files.length > 0) {
        this.loadGlbFile(e.dataTransfer.files[0]);
      }
    });

    this.dom.btnProcedural.addEventListener('click', () => {
      this.loadProceduralDevice();
      this.dom.btnProcedural.classList.add('active');
    });

    // Mesh Mapper Modal
    this.dom.btnOpenMapper.addEventListener('click', () => {
      this.dom.modalMapper.classList.add('open');
    });
    this.dom.btnCloseMapper.addEventListener('click', () => {
      this.dom.modalMapper.classList.remove('open');
    });
    this.dom.btnSaveMapping.addEventListener('click', () => {
      this.meshMapping.power = this.dom.mapNamePower.value.trim();
      this.meshMapping.volume = this.dom.mapNameVol.value.trim();
      this.meshMapping.play = this.dom.mapNamePlay.value.trim();
      this.meshMapping.screen = this.dom.mapNameScreen.value.trim();
      this.meshMapping.leds = this.dom.mapNameLeds.value.trim();
      this.mapSceneMeshes();
      this.updateKnobRotation();
      this.dom.modalMapper.classList.remove('open');
      this.logSerial("[MAPPER] Mapeo guardado con éxito.", "system");
    });

    // Camera Presets
    document.querySelectorAll('.cam-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        document.querySelectorAll('.cam-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.setCameraPreset(btn.dataset.cam);
      });
    });

    // Viewport Quick Toggles
    this.dom.btnToggleLights.addEventListener('click', () => {
      const active = this.dom.btnToggleLights.classList.toggle('active');
      this.studioLights.forEach(l => l.intensity *= (active ? 0.3 : 3.33));
    });

    this.dom.btnToggleWireframe.addEventListener('click', () => {
      this.wireframeActive = !this.wireframeActive;
      this.dom.btnToggleWireframe.classList.toggle('active', this.wireframeActive);
      this.currentModelGroup.traverse(child => {
        if (child.isMesh && child.material) {
          child.material.wireframe = this.wireframeActive;
        }
      });
    });

    this.dom.btnResetCam.addEventListener('click', () => {
      this.setCameraPreset('front');
    });

    this.dom.btnClearTerm.addEventListener('click', () => {
      this.dom.serialLog.innerHTML = '<div class="log-line system">[TERMINAL] Limpio.</div>';
    });

    // Web Serial Connect
    this.dom.btnWebSerial.addEventListener('click', async () => {
      const ok = await esp32Bridge.connectPhysicalESP32();
      if (ok) {
        this.dom.badgeEsp32.classList.remove('esp-disconnected');
        this.dom.badgeEsp32.classList.add('esp-connected');
        this.dom.badgeEsp32.innerHTML = '<i class="fa-solid fa-microchip"></i> <span class="label">ESP32 Físico Online</span>';
        this.showDJMessage("¡Dispositivo ESP32 físico conectado por Serial USB!");
      }
    });
  }

  setupEsp32Bridge() {
    esp32Bridge.on('onLog', (entry) => {
      this.logSerial(entry.msg, entry.type);
    });

    esp32Bridge.on('onButtonPower', () => {
      this.triggerButtonPower();
    });

    esp32Bridge.on('onButtonVolume', (dir) => {
      if (dir === 'up') this.rotateKnobStep(1);
      else if (dir === 'down') this.rotateKnobStep(-1);
      else this.rotateKnobStep(1);
    });

    esp32Bridge.on('onButtonPlay', () => {
      this.triggerButtonPlay();
    });

    esp32Bridge.on('onStatusChange', (data) => {
      this.updateHardwareMonitor(data.pins);
    });
  }

  onMouseMove(e) {
    if (this.isDraggingKnob) return;

    this.mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
    this.mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;

    this.raycaster.setFromCamera(this.mouse, this.camera);
    const intersects = this.raycaster.intersectObjects(this.interactiveObjects, true);

    if (intersects.length > 0) {
      let obj = intersects[0].object;
      while (obj && !this.interactiveObjects.includes(obj) && obj.parent) {
        obj = obj.parent;
      }

      if (obj && this.interactiveObjects.includes(obj)) {
        if (this.hoveredObject !== obj) {
          this.hoveredObject = obj;
          document.body.style.cursor = obj.userData.isKnob ? 'ew-resize' : 'pointer';
        }
        return;
      }
    }

    if (this.hoveredObject) {
      this.hoveredObject = null;
      document.body.style.cursor = 'default';
    }
  }

  onPointerDown(e) {
    if (e.target.closest('.ui-overlay') || e.target.closest('.modal-backdrop')) {
      return;
    }

    this.mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
    this.mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
    this.raycaster.setFromCamera(this.mouse, this.camera);

    const intersects = this.raycaster.intersectObjects(this.interactiveObjects, true);
    if (intersects.length > 0) {
      let obj = intersects[0].object;
      while (obj && !this.interactiveObjects.includes(obj) && obj.parent) {
        obj = obj.parent;
      }

      if (obj && this.interactiveObjects.includes(obj)) {
        if (obj.userData.role === 'power') {
          this.animateButtonPress(obj);
          this.triggerButtonPower();
        } else if (obj.userData.role === 'volume' || obj.userData.isKnob) {
          // Start dragging the volume rotary knob
          this.isDraggingKnob = true;
          this.dragStartX = e.clientX;
          this.dragStartVolume = this.volume;
          this.controls.enabled = false; // Disable OrbitControls while adjusting knob

          // If clicked without dragging: click on right side = Vol+, left side = Vol-
          const rect = this.canvas.getBoundingClientRect();
          const clickXNorm = (e.clientX - rect.left) / rect.width;
          if (e.button === 2) {
            this.rotateKnobStep(-1);
          }
        } else if (obj.userData.role === 'play') {
          this.animateButtonPress(obj);
          this.triggerButtonPlay();
        }
      }
    }
  }

  onPointerMove(e) {
    if (!this.isDraggingKnob) return;

    const deltaX = e.clientX - this.dragStartX;
    // Dragging right -> increase volume (clockwise)
    // Dragging left -> decrease volume (counter-clockwise)
    const sensitivity = 0.005; // 200px drag = 100% volume
    const newVol = THREE.MathUtils.clamp(this.dragStartVolume + deltaX * sensitivity, 0.0, 1.0);

    if (Math.abs(newVol - this.volume) > 0.01) {
      this.setDeviceVolume(newVol, false);
    }
  }

  onPointerUp() {
    if (this.isDraggingKnob) {
      this.isDraggingKnob = false;
      this.controls.enabled = true;
      audioEngine.playClickSound('volume');
    }
  }

  onMouseWheel(e) {
    // If hovering over the volume knob, scroll wheel to turn it
    if (this.hoveredObject && (this.hoveredObject.userData.role === 'volume' || this.hoveredObject.userData.isKnob)) {
      e.preventDefault();
      const dir = e.deltaY < 0 ? 1 : -1; // Wheel up = right/clockwise (Vol+), Wheel down = left/counter-clockwise (Vol-)
      this.rotateKnobStep(dir);
    }
  }

  // Turn volume knob by step (+1 for right/clockwise, -1 for left/counter-clockwise)
  rotateKnobStep(direction = 1) {
    if (!this.isPoweredOn) {
      this.showDJMessage("Enciende el dispositivo primero con el Botón 1.");
      audioEngine.playClickSound('normal');
      return;
    }

    const step = 0.05; // 5% per tick
    const newVol = THREE.MathUtils.clamp(this.volume + direction * step, 0.0, 1.0);
    this.setDeviceVolume(newVol, true);

    // Subtle physical knob rotation feedback
    this.volHudTimer = 3.0; // Show volume HUD on OLED for 3 seconds
  }

  setDeviceVolume(val, playFeedback = true) {
    this.volume = THREE.MathUtils.clamp(val, 0.0, 1.0);
    audioEngine.setVolume(this.volume);
    
    if (playFeedback) {
      audioEngine.playClickSound('volume');
    }
    esp32Bridge.pulsePin('volume');

    const pct = Math.round(this.volume * 100);
    this.dom.hudVolSlider.value = pct;
    this.dom.hudVolText.innerText = `${pct}%`;

    // Rotate the 3D volume knob mesh
    this.updateKnobRotation();

    this.volHudTimer = 3.0;
    this.logSerial(`[ESP32] Perilla de volumen girada a: ${pct}% (GPIO 19)`);
    esp32Bridge.sendToESP32(`CMD:VOL:${pct}`);
  }

  updateKnobRotation() {
    if (!this.meshes.volume) return;
    // Map volume 0.0..1.0 to rotation angle: -135deg to +135deg (-2.356 rad to +2.356 rad)
    const minAngle = -2.356;
    const maxAngle = 2.356;
    const targetAngle = minAngle + this.volume * (maxAngle - minAngle);

    // Smoothly set rotation on Y axis
    this.meshes.volume.rotation.y = targetAngle;
  }

  animateButtonPress(mesh) {
    if (!mesh) return;
    const origY = mesh.userData.originalY || mesh.position.y;
    mesh.position.y = origY - 0.08;

    setTimeout(() => {
      mesh.position.y = origY;
    }, 150);
  }

  // --- Button Actions & Device Logic ---

  // Button 1: Power ON/OFF
  triggerButtonPower() {
    this.isPoweredOn = !this.isPoweredOn;
    esp32Bridge.pulsePin('power');

    if (this.isPoweredOn) {
      audioEngine.playClickSound('power-on');
      this.logSerial("[ESP32] Dispositivo ENCENDIDO (GPIO 18 HIGH). Iniciando pantalla...", "system");
      
      this.dom.badgePower.classList.remove('off');
      this.dom.badgePower.classList.add('on');
      this.dom.badgePower.innerHTML = '<span class="dot"></span> <span class="label">ENCENDIDO</span>';

      this.isBooting = true;
      this.bootProgress = 0;
      if (this.bootTimer) clearInterval(this.bootTimer);
      
      this.bootTimer = setInterval(() => {
        this.bootProgress += 0.05;
        if (this.bootProgress >= 1.0) {
          clearInterval(this.bootTimer);
          this.isBooting = false;
          this.currentDJStatus = "¡Hola! Soy DJ Livi. Presiona Play (Botón 3) para escuchar tu música.";
          this.showDJMessage(this.currentDJStatus);
          audioEngine.speakLivi("¡Hola! Soy DJ Livi de Spotify. Dispositivo ESP32 listo.");
        }
      }, 50);

      if (this.meshes.esp32StatusLed) {
        this.meshes.esp32StatusLed.material.emissiveIntensity = 1.0;
      }
      esp32Bridge.setPin('oled', true);
      esp32Bridge.setPin('led', true);
      esp32Bridge.sendToESP32("CMD:POWER:ON");
    } else {
      audioEngine.playClickSound('power-off');
      this.logSerial("[ESP32] Dispositivo APAGADO (GPIO 18 LOW).", "system");

      this.dom.badgePower.classList.remove('on');
      this.dom.badgePower.classList.add('off');
      this.dom.badgePower.innerHTML = '<span class="dot"></span> <span class="label">APAGADO</span>';

      if (this.isPlaying) {
        this.triggerButtonPlay(false);
      }

      this.isBooting = false;
      this.showDJMessage("Dispositivo apagado. Presiona el Botón 1 para encender.");
      
      if (this.meshes.esp32StatusLed) {
        this.meshes.esp32StatusLed.material.emissiveIntensity = 0.0;
      }
      esp32Bridge.setPin('oled', false);
      esp32Bridge.setPin('led', false);
      esp32Bridge.sendToESP32("CMD:POWER:OFF");
    }

    if (this.meshes.power) {
      this.animateButtonPress(this.meshes.power);
    }
  }

  // Button 3: Play / Pause
  triggerButtonPlay(forceState = null) {
    if (!this.isPoweredOn) {
      this.showDJMessage("Enciende el dispositivo primero con el Botón 1.");
      audioEngine.playClickSound('normal');
      return;
    }

    const nextState = (forceState !== null) ? forceState : !this.isPlaying;
    this.isPlaying = nextState;
    esp32Bridge.pulsePin('play');

    if (this.isPlaying) {
      audioEngine.playClickSound('normal');
      audioEngine.startMusic();
      this.dom.uiBtnPlay.innerHTML = '<i class="fa-solid fa-pause"></i>';
      this.currentDJStatus = "Reproduciendo selección de DJ Livi...";
      this.logSerial("[ESP32] Reproduciendo Spotify DJ Livi (GPIO 21 HIGH)", "system");
      this.showDJMessage(this.currentDJStatus);
      esp32Bridge.sendToESP32("CMD:MUSIC:PLAY");
    } else {
      audioEngine.playClickSound('normal');
      audioEngine.stopMusic();
      this.dom.uiBtnPlay.innerHTML = '<i class="fa-solid fa-play"></i>';
      this.currentDJStatus = "Música pausada. Presiona Play para continuar.";
      this.logSerial("[ESP32] Música en pausa (GPIO 21 LOW)");
      this.showDJMessage(this.currentDJStatus);
      esp32Bridge.sendToESP32("CMD:MUSIC:PAUSE");
    }

    if (this.meshes.play) {
      this.animateButtonPress(this.meshes.play);
    }
  }

  previousTrack() {
    if (!this.isPoweredOn) return;
    this.logSerial("[SPOTIFY] Pista anterior solicitada.");
    audioEngine.playClickSound('normal');
    this.currentTrackTitle = "Midnight Synthwave Chill";
    this.currentArtist = "DJ Livi • Retro Future";
    this.dom.hudSongTitle.innerText = this.currentTrackTitle;
    this.dom.hudArtist.innerText = this.currentArtist;
    this.currentDJStatus = "Regresando a la pista anterior...";
    this.showDJMessage(this.currentDJStatus);
  }

  nextTrack() {
    if (!this.isPoweredOn) return;
    this.logSerial("[SPOTIFY] Siguiente pista solicitada.");
    audioEngine.playClickSound('normal');
    this.currentTrackTitle = "Electronic Horizons (Live)";
    this.currentArtist = "DJ Livi • Cyber Pulse";
    this.dom.hudSongTitle.innerText = this.currentTrackTitle;
    this.dom.hudArtist.innerText = this.currentArtist;
    const comment = audioEngine.getRandomDJComment();
    this.currentDJStatus = comment;
    this.showDJMessage(comment);
    audioEngine.speakLivi(comment);
  }

  triggerDJTalk() {
    if (!this.isPoweredOn) {
      this.showDJMessage("Enciende el dispositivo para hablar con DJ Livi.");
      return;
    }
    const comment = audioEngine.getRandomDJComment();
    this.currentDJStatus = comment;
    this.showDJMessage(comment);
    audioEngine.speakLivi(comment);
  }

  showDJMessage(text) {
    this.dom.djSpeechText.innerText = `"${text}"`;
    this.dom.djBubble.classList.remove('hidden');
    
    if (this.djBubbleTimer) clearTimeout(this.djBubbleTimer);
    this.djBubbleTimer = setTimeout(() => {
      this.dom.djBubble.classList.add('hidden');
    }, 7000);
  }

  logSerial(msg, type = 'normal') {
    const line = document.createElement('div');
    line.className = `log-line ${type}`;
    line.innerText = `[${new Date().toLocaleTimeString()}] ${msg}`;
    this.dom.serialLog.appendChild(line);
    this.dom.serialLog.scrollTop = this.dom.serialLog.scrollHeight;
  }

  updateHardwareMonitor(pins) {
    const setStatus = (id, active) => {
      const el = document.getElementById(id);
      if (el) {
        el.className = `pin-status ${active ? 'on' : 'off'}`;
        el.innerText = active ? 'HIGH / ON' : 'LOW / OFF';
      }
    };
    setStatus('pin-state-power', pins.power);
    setStatus('pin-state-vol', pins.volume);
    setStatus('pin-state-play', pins.play);
    setStatus('pin-state-oled', pins.oled);
    setStatus('pin-state-led', pins.led);
    setStatus('pin-state-wifi', pins.wifi);
  }

  setCameraPreset(type) {
    if (!this.camera || !this.controls) return;
    
    const targets = {
      front: { pos: [0, 3.2, 5.0], target: [0, 0.8, 0] },
      top: { pos: [0, 5.5, 1.2], target: [0, 0.8, 0.5] },
      esp32: { pos: [2.5, 3.0, 1.5], target: [1.6, 1.2, -0.3] },
      iso: { pos: [4.0, 4.5, 4.5], target: [0, 0.8, 0] }
    };

    const cfg = targets[type] || targets.front;
    this.camera.position.set(...cfg.pos);
    this.controls.target.set(...cfg.target);
    this.controls.update();
  }

  // --- Dynamic OLED Screen Rendering (DJ Livi & Music Player Info) ---

  renderScreenTexture(time, delta, freqData) {
    const ctx = this.screenCtx;
    const w = this.screenCanvas.width;
    const h = this.screenCanvas.height;

    // Background: High Contrast OLED Black with subtle border glow
    ctx.fillStyle = '#06080c';
    ctx.fillRect(0, 0, w, h);

    if (!this.isPoweredOn) {
      // Power off CRT line or black screen
      ctx.fillStyle = '#11151a';
      ctx.fillRect(0, h / 2 - 1, w, 2);
      this.screenTexture.needsUpdate = true;
      return;
    }

    if (this.isBooting) {
      // Boot Screen Animation
      ctx.fillStyle = '#1db954';
      ctx.font = 'bold 26px "Plus Jakarta Sans", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('SPOTIFY DJ LIVI', w / 2, h / 2 - 24);

      // DJ Livi Tag
      ctx.fillStyle = '#00d2ff';
      ctx.font = '13px "JetBrains Mono", monospace';
      ctx.fillText('ESP32-WROOM-32 INITIALIZING...', w / 2, h / 2 + 10);

      // Loading Bar
      ctx.strokeStyle = '#222933';
      ctx.lineWidth = 2;
      ctx.strokeRect(w / 2 - 110, h / 2 + 30, 220, 12);
      ctx.fillStyle = '#1db954';
      ctx.fillRect(w / 2 - 108, h / 2 + 32, 216 * this.bootProgress, 8);

      this.screenTexture.needsUpdate = true;
      return;
    }

    // --- Active State Display ---

    // 1. Top Header Bar
    ctx.fillStyle = '#0e121a';
    ctx.fillRect(0, 0, w, 34);

    // Spotify Logo Dot & Connect Status
    ctx.fillStyle = '#1db954';
    ctx.beginPath();
    ctx.arc(20, 17, 6, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 12px "JetBrains Mono", monospace';
    ctx.textAlign = 'left';
    ctx.fillText('SPOTIFY CONNECT', 34, 21);

    // DJ Livi AI Badge on top bar
    ctx.fillStyle = '#9d4edd';
    ctx.font = 'bold 11px "Plus Jakarta Sans", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('✦ DJ LIVI AI', w / 2, 21);

    // Volume Status on Top Right
    const volPct = Math.round(this.volume * 100);
    ctx.fillStyle = '#00d2ff';
    ctx.textAlign = 'right';
    ctx.font = 'bold 12px "JetBrains Mono", monospace';
    ctx.fillText(`VOL: ${volPct}%`, w - 16, 21);

    // 2. Left Section: DJ Livi Avatar & AI Information Box
    const leftW = 160;
    ctx.fillStyle = '#090d14';
    ctx.fillRect(10, 42, leftW, h - 52);
    ctx.strokeStyle = 'rgba(0, 210, 255, 0.2)';
    ctx.lineWidth = 1;
    ctx.strokeRect(10, 42, leftW, h - 52);

    // DJ Livi Animated Circle Avatar
    const avatarX = 42;
    const avatarY = 76;
    const pulse = Math.sin(time * 4) * 3;

    // Glowing Outer Halo
    const haloGrad = ctx.createRadialGradient(avatarX, avatarY, 10, avatarX, avatarY, 26 + pulse);
    haloGrad.addColorStop(0, 'rgba(0, 210, 255, 0.4)');
    haloGrad.addColorStop(1, 'rgba(157, 78, 221, 0)');
    ctx.fillStyle = haloGrad;
    ctx.beginPath();
    ctx.arc(avatarX, avatarY, 26 + pulse, 0, Math.PI * 2);
    ctx.fill();

    // Avatar Core Circle
    const coreGrad = ctx.createLinearGradient(avatarX - 18, avatarY - 18, avatarX + 18, avatarY + 18);
    coreGrad.addColorStop(0, '#00d2ff');
    coreGrad.addColorStop(1, '#9d4edd');
    ctx.fillStyle = coreGrad;
    ctx.beginPath();
    ctx.arc(avatarX, avatarY, 18, 0, Math.PI * 2);
    ctx.fill();

    // DJ Waveform Icon inside Avatar
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(avatarX - 9, avatarY);
    ctx.lineTo(avatarX - 5, avatarY - 8);
    ctx.lineTo(avatarX, avatarY + 8);
    ctx.lineTo(avatarX + 5, avatarY - 8);
    ctx.lineTo(avatarX + 9, avatarY);
    ctx.stroke();

    // DJ Livi Name & Mode Text
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 13px "Plus Jakarta Sans", sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('DJ Livi', 70, 72);

    ctx.fillStyle = '#1db954';
    ctx.font = '10px "JetBrains Mono", monospace';
    ctx.fillText('EN VIVO', 70, 86);

    // DJ Status / Speech Subtitles
    ctx.fillStyle = '#8e9bb0';
    ctx.font = 'italic 10px "Plus Jakarta Sans", sans-serif';
    this.wrapText(ctx, `"${this.currentDJStatus}"`, 16, 116, leftW - 12, 14);

    // 3. Right Section: Music Playing Information (Song Title, Artist, Visualizer)
    const rightX = 180;
    const rightW = w - rightX - 12;

    // Track Title
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 17px "Plus Jakarta Sans", sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(this.currentTrackTitle, rightX, 62);

    // Artist
    ctx.fillStyle = '#1db954';
    ctx.font = '12px "Plus Jakarta Sans", sans-serif';
    ctx.fillText(this.currentArtist, rightX, 80);

    // Playback State Badge
    ctx.fillStyle = this.isPlaying ? '#00ff66' : '#ffaa00';
    ctx.font = 'bold 10px "JetBrains Mono", monospace';
    ctx.fillText(this.isPlaying ? '▶ REPRODUCIENDO' : '⏸ PAUSADO', rightX, 100);

    // Progress Bar & Elapsed Time
    if (this.isPlaying) {
      this.trackProgress = (this.trackProgress + (delta * 0.02)) % 1.0;
    }
    const currentSec = Math.floor(this.trackProgress * this.trackDurationSec);
    const min = Math.floor(currentSec / 60);
    const sec = currentSec % 60;
    const durMin = Math.floor(this.trackDurationSec / 60);
    const durSec = this.trackDurationSec % 60;
    const timeStr = `${min}:${sec < 10 ? '0' : ''}${sec} / ${durMin}:${durSec < 10 ? '0' : ''}${durSec}`;

    ctx.fillStyle = '#6b7a90';
    ctx.font = '10px "JetBrains Mono", monospace';
    ctx.textAlign = 'right';
    ctx.fillText(timeStr, w - 16, 100);

    // Progress Bar Line
    const barW = rightW;
    ctx.fillStyle = '#1b222d';
    ctx.fillRect(rightX, 106, barW, 4);

    ctx.fillStyle = '#1db954';
    ctx.fillRect(rightX, 106, barW * this.trackProgress, 4);

    // 4. Audio FFT Spectrum Equalizer on OLED (Bottom Area)
    const specY = h - 20;
    const numBars = 22;
    const barWidth = Math.floor(rightW / numBars) - 3;

    for (let i = 0; i < numBars; i++) {
      let val = 0.08;
      if (this.isPlaying && freqData) {
        const raw = freqData[i % freqData.length] || 0;
        val = Math.max(0.08, raw / 255);
      } else if (this.isPlaying) {
        val = 0.2 + Math.sin(time * 6 + i * 0.5) * 0.2;
      }

      const barH = val * 80;
      const bx = rightX + i * (barWidth + 3);
      const by = specY - barH;

      const grad = ctx.createLinearGradient(0, by, 0, specY);
      grad.addColorStop(0, '#00d2ff');
      grad.addColorStop(0.5, '#1db954');
      grad.addColorStop(1, '#0c4420');

      ctx.fillStyle = grad;
      ctx.fillRect(bx, by, barWidth, barH);
    }

    // 5. Volume HUD Overlay (Triggered when turning the Rotary Knob)
    if (this.volHudTimer > 0) {
      this.volHudTimer -= delta;
      ctx.fillStyle = 'rgba(6, 10, 16, 0.92)';
      ctx.fillRect(w / 2 - 110, h / 2 - 35, 220, 70);
      ctx.strokeStyle = '#00d2ff';
      ctx.lineWidth = 2;
      ctx.strokeRect(w / 2 - 110, h / 2 - 35, 220, 70);

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 14px "Plus Jakarta Sans", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`VOLUMEN: ${volPct}%`, w / 2, h / 2 - 12);

      // Volume bar
      ctx.fillStyle = '#1a222e';
      ctx.fillRect(w / 2 - 80, h / 2 + 5, 160, 10);
      ctx.fillStyle = '#00d2ff';
      ctx.fillRect(w / 2 - 80, h / 2 + 5, 160 * this.volume, 10);
    }

    this.screenTexture.needsUpdate = true;
  }

  // Text Wrapping helper for OLED Display
  wrapText(ctx, text, x, y, maxWidth, lineHeight) {
    const words = text.split(' ');
    let line = '';
    let curY = y;
    let lineCount = 0;

    for (let n = 0; n < words.length; n++) {
      const testLine = line + words[n] + ' ';
      const metrics = ctx.measureText(testLine);
      const testWidth = metrics.width;
      if (testWidth > maxWidth && n > 0) {
        ctx.fillText(line, x, curY);
        line = words[n] + ' ';
        curY += lineHeight;
        lineCount++;
        if (lineCount >= 4) { // Max 4 lines on OLED
          ctx.fillText(line + '...', x, curY);
          return;
        }
      } else {
        line = testLine;
      }
    }
    ctx.fillText(line, x, curY);
  }

  renderHUDVisualizer(time, freqData) {
    const ctx = this.hudVisCtx;
    const w = this.hudVisCanvas.width = this.hudVisCanvas.clientWidth * 2;
    const h = this.hudVisCanvas.height = this.hudVisCanvas.clientHeight * 2;

    ctx.clearRect(0, 0, w, h);

    const bars = 32;
    const barWidth = w / bars - 2;

    for (let i = 0; i < bars; i++) {
      let val = 0.05;
      if (this.isPlaying && freqData) {
        val = Math.max(0.05, (freqData[i % freqData.length] / 255));
      }

      const barHeight = val * h * 0.9;
      const x = i * (barWidth + 2);
      const y = h - barHeight;

      const grad = ctx.createLinearGradient(0, y, 0, h);
      grad.addColorStop(0, '#1db954');
      grad.addColorStop(1, '#00d2ff');

      ctx.fillStyle = grad;
      ctx.fillRect(x, y, barWidth, barHeight);
    }
  }

  // --- Animation Loop ---
  animate() {
    requestAnimationFrame(() => this.animate());

    const delta = this.clock.getDelta();
    const time = this.clock.getElapsedTime();
    const freqData = audioEngine.getFrequencyData();

    // Pulse LED Ring when music is playing
    if (this.meshes.leds && this.meshes.leds.material) {
      if (this.isPoweredOn && this.isPlaying) {
        const energy = freqData ? (freqData[2] / 255) : 0.5;
        this.meshes.leds.material.emissiveIntensity = 0.8 + energy * 1.5;
      } else if (this.isPoweredOn) {
        this.meshes.leds.material.emissiveIntensity = 0.4;
      } else {
        this.meshes.leds.material.emissiveIntensity = 0.0;
      }
    }

    // Render Canvas Screen Texture & HUD Visualizer
    this.renderScreenTexture(time, delta, freqData);
    this.renderHUDVisualizer(time, freqData);

    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  }

  onWindowResize() {
    if (!this.camera || !this.renderer) return;
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }
}

// Instantiate on load
window.addEventListener('DOMContentLoaded', () => {
  window.appInstance = new SpotifyDeviceApp();
});
