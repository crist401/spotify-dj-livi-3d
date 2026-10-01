/**
 * ESP32 Bridge & Web Serial API Module
 * Manages simulation of the ESP32 micro-controller and real physical connection
 * via USB Serial to exchange commands and button triggers.
 */

class ESP32Bridge {
  constructor() {
    this.isConnected = false;
    this.port = null;
    this.reader = null;
    this.writer = null;
    this.readableStreamClosed = null;
    this.writableStreamClosed = null;

    // Pin states
    this.pins = {
      power: false,
      volume: false,
      play: false,
      oled: false,
      led: false,
      wifi: false
    };

    // Listeners for UI / 3D sync
    this.listeners = {
      onButtonPower: [],
      onButtonVolume: [],
      onButtonPlay: [],
      onLog: [],
      onStatusChange: []
    };
  }

  on(event, cb) {
    if (this.listeners[event]) {
      this.listeners[event].push(cb);
    }
  }

  emit(event, data) {
    if (this.listeners[event]) {
      this.listeners[event].forEach(cb => cb(data));
    }
  }

  log(msg, type = 'normal') {
    this.emit('onLog', { msg, type, timestamp: new Date().toLocaleTimeString() });
  }

  // Update pin visual representation
  setPin(pinName, state) {
    this.pins[pinName] = state;
    this.emit('onStatusChange', { pins: this.pins });
  }

  // Flash a pin (e.g. when button is pressed)
  pulsePin(pinName) {
    this.setPin(pinName, true);
    setTimeout(() => {
      this.setPin(pinName, false);
    }, 250);
  }

  // Check if Web Serial is supported
  isSerialSupported() {
    return 'serial' in navigator;
  }

  // Connect to physical ESP32
  async connectPhysicalESP32() {
    if (!this.isSerialSupported()) {
      alert("Tu navegador no soporta Web Serial API. Usa Google Chrome o Microsoft Edge.");
      return false;
    }

    try {
      this.log("[SERIAL] Solicitando puerto COM...", "system");
      this.port = await navigator.serial.requestPort();
      await this.port.open({ baudRate: 115200 });

      this.isConnected = true;
      this.log("[SERIAL] ¡ESP32 conectado a 115200 baudios!", "system");
      this.setPin('wifi', true);

      // Start read loop
      this.readSerialLoop();
      return true;
    } catch (err) {
      this.log(`[SERIAL ERROR] ${err.message}`, "error");
      return false;
    }
  }

  async readSerialLoop() {
    const textDecoder = new TextDecoderStream();
    this.readableStreamClosed = this.port.readable.pipeTo(textDecoder.writable);
    this.reader = textDecoder.readable.getReader();

    let buffer = "";

    try {
      while (true) {
        const { value, done } = await this.reader.read();
        if (done) break;
        if (value) {
          buffer += value;
          const lines = buffer.split("\n");
          buffer = lines.pop(); // keep remainder

          for (const line of lines) {
            const cleanLine = line.trim();
            if (cleanLine.length > 0) {
              this.processIncomingESP32Message(cleanLine);
            }
          }
        }
      }
    } catch (error) {
      this.log(`[SERIAL] Error de lectura: ${error.message}`, "error");
    } finally {
      this.reader.releaseLock();
    }
  }

  processIncomingESP32Message(msg) {
    this.log(`[ESP32 -> WEB] ${msg}`, "esp-in");

    // Command Parser
    if (msg.includes("BTN_POWER") || msg.includes("BTN:1")) {
      this.pulsePin('power');
      this.emit('onButtonPower');
    } else if (msg.includes("BTN_VOL_UP") || msg.includes("BTN:2:UP")) {
      this.pulsePin('volume');
      this.emit('onButtonVolume', 'up');
    } else if (msg.includes("BTN_VOL_DOWN") || msg.includes("BTN:2:DOWN")) {
      this.pulsePin('volume');
      this.emit('onButtonVolume', 'down');
    } else if (msg.includes("BTN_VOL") || msg.includes("BTN:2")) {
      this.pulsePin('volume');
      this.emit('onButtonVolume', 'cycle');
    } else if (msg.includes("BTN_PLAY") || msg.includes("BTN:3")) {
      this.pulsePin('play');
      this.emit('onButtonPlay');
    }
  }

  // Send message to physical ESP32
  async sendToESP32(text) {
    if (!this.isConnected || !this.port) return;
    try {
      const encoder = new TextEncoder();
      const writer = this.port.writable.getWriter();
      await writer.write(encoder.encode(text + "\n"));
      writer.releaseLock();
      this.log(`[WEB -> ESP32] ${text}`, "system");
    } catch (e) {
      this.log(`[SERIAL TX ERROR] ${e.message}`, "error");
    }
  }
}

export const esp32Bridge = new ESP32Bridge();
