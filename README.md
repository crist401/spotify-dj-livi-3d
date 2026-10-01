# 🎵 Spotify DJ Livi - ESP32 Smart Device 3D Simulator (Three.js & Blender)

Simulador 3D interactivo en tiempo real construido con **Three.js** para un dispositivo físico con microcontrolador **ESP32** y la IA **DJ Livi de Spotify**.

---

## 🚀 Nuevas Funcionalidades Implementadas

### 📺 1. Pantalla OLED de Alta Resolución (DJ Livi + Música)
La pantalla OLED virtual proyectada en el modelo 3D muestra de forma simultánea:
- **Información de DJ Livi**:
  - Avatar animado con halo pulsante en tiempo real y badge de DJ Livi.
  - Subtítulos dinámicos de voz y comentarios sobre la sesión activa.
  - Estado de conexión Spotify Connect y frecuencia del ESP32.
- **Información de la Música Reproducida**:
  - Título de la pista y artista actual.
  - Estado de reproducción (`▶ REPRODUCIENDO` / `⏸ PAUSADO`).
  - Barra de progreso interactiva con tiempo transcurrido (`01:28 / 03:15`).
  - **Ecualizador de espectro FFT** reactivo al audio con gradiente Spotify Green & Neon Cyan.
  - HUD emergente de volumen al girar la perilla (`VOL: XX%`).

### 🎛️ 2. Botón 2: Perilla Giratoria de Volumen (Rotary Knob)
El control de volumen es una **perilla física rotatoria**:
- **Giro a la Derecha (Sentido Horario)**: **Sube el volumen** (+5% por paso).
- **Giro a la Izquierda (Sentido Antihorario)**: **Baja el volumen** (-5% por paso).
- **Interacción en Three.js**:
  - **Arrastrar con el ratón**: Haz clic sobre la perilla y arrastra hacia la derecha/arriba para subir o izquierda/abajo para bajar.
  - **Rueda del ratón**: Coloca el cursor sobre la perilla y gira la rueda.
  - **Rotación 3D realista**: La malla de la perilla en 3D rota físicamente en su eje Y entre $-135^\circ$ (0%) y $+135^\circ$ (100%) con sonido de click háptico.

---

## 🧊 Nombres de Mallas para Blender

Nombra tus objetos en Blender así para que Three.js los enlace automáticamente:

| Función | Nombre en Blender | Interacción |
| :--- | :--- | :--- |
| **Botón 1 (Encendido/Apagado)** | `Btn_Power` | Clic para encender / apagar |
| **Botón 2 (Perilla de Volumen)** | `Btn_Volume` o `Knob_Volume` | Girar derecha (Vol+) / Girar izquierda (Vol-) |
| **Botón 3 (Play/Pausa Música)** | `Btn_PlayPause` | Clic para reproducir / pausar |
| **Pantalla OLED** | `Screen` o `Display` | Proyección dinámica de DJ Livi + Música |
| **Anillo LED** | `LED_Ring` | Halo de luz reactivo al ritmo |

---

## ⚡ Conexión del ESP32 Físico (`esp32_firmware.ino`)

El firmware [`esp32_firmware.ino`](file:///C:/Users/crist/.gemini/antigravity-ide/scratch/spotify-dj-livi-3d/esp32_firmware.ino) incluye soporte para **Encoder Rotatorio KY-040**:

```
+--------------------------------------------------------------+
| ESP32 GPIO | COMPONENTE FÍSICO                               |
+------------+-------------------------------------------------+
| GPIO 18    | Botón 1 (Power ON/OFF) -> Pulsador a GND        |
| GPIO 19    | Perilla Volumen -> Pin CLK del Encoder KY-040   |
| GPIO 5     | Perilla Volumen -> Pin DT del Encoder KY-040    |
| GPIO 4     | Perilla Volumen -> Pin SW (Click perilla)       |
| GPIO 23    | Botón 3 (Play/Pausa) -> Pulsador a GND          |
| GPIO 2     | LED de Estado -> Resistencia 220Ω a GND         |
+--------------------------------------------------------------+
```

---

## ▶️ Ejecución Local

Abre en tu navegador:
👉 **[http://localhost:8080/](http://localhost:8080/)**
