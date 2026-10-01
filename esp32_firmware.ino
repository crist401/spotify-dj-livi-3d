/*
  =============================================================================
  PROYECTO: Dispositivo Físico ESP32 - Spotify DJ Livi
  DESCRIPCIÓN: Firmware Arduino / ESP32 con:
               - Botón 1: Encendido / Apagado (Pulsador)
               - Botón 2: Perilla de Volumen Giratoria (Encoder Rotatorio KY-040)
                          -> Giro Derecha: Sube volumen (BTN_VOL_UP)
                          -> Giro Izquierda: Baja volumen (BTN_VOL_DOWN)
               - Botón 3: Control de Música (Pulsador Play / Pausa)
               - Comunicación Serial USB con Three.js a 115200 baudios.
  =============================================================================
  
  CONEXIÓN DE PINES (PINOUT ESP32):
  -------------------------------------------------------------
  - Botón 1 (Power ON/OFF)         : GPIO 18 -> Pulsador a GND
  - Perilla Volumen (Encoder CLK)  : GPIO 19 -> Pin CLK del Encoder KY-040
  - Perilla Volumen (Encoder DT)   : GPIO 5  -> Pin DT del Encoder KY-040
  - Perilla Volumen (Encoder SW)   : GPIO 4  -> Pin SW (Pulsar perilla) [Opcional]
  - Botón 3 (Play / Pausa Música)  : GPIO 23 -> Pulsador a GND
  - LED Indicador de Estado        : GPIO 2  -> LED a GND con resistencia 220Ω
  -------------------------------------------------------------
*/

#define PIN_BTN_POWER       18
#define PIN_ROTARY_CLK      19
#define PIN_ROTARY_DT       5
#define PIN_ROTARY_SW       4
#define PIN_BTN_PLAY        23
#define PIN_LED_STATUS      2

// Estados del Dispositivo
bool isDeviceOn = false;
bool isPlaying = false;
int currentVolume = 70; // 0% a 100%

// Variables de Encoder Rotatorio (Perilla de Volumen)
int lastClkState;
int currentClkState;
unsigned long lastEncoderTime = 0;

// Variables de Antirrebote (Debounce) para Pulsadores
unsigned long lastDebouncePower = 0;
unsigned long lastDebouncePlay = 0;
const unsigned long debounceDelay = 200; // ms

int lastStatePower = HIGH;
int lastStatePlay  = HIGH;

void setup() {
  Serial.begin(115200);
  delay(500);

  // Configurar pines de entrada con resistencia Pull-Up interna
  pinMode(PIN_BTN_POWER,    INPUT_PULLUP);
  pinMode(PIN_ROTARY_CLK,   INPUT_PULLUP);
  pinMode(PIN_ROTARY_DT,    INPUT_PULLUP);
  pinMode(PIN_ROTARY_SW,    INPUT_PULLUP);
  pinMode(PIN_BTN_PLAY,     INPUT_PULLUP);

  // Configurar LED de estado
  pinMode(PIN_LED_STATUS,   OUTPUT);
  digitalWrite(PIN_LED_STATUS, LOW);

  // Leer estado inicial del pin CLK del encoder
  lastClkState = digitalRead(PIN_ROTARY_CLK);

  Serial.println("[ESP32] Sistema iniciado. Dispositivo DJ Livi listo para Three.js.");
}

void loop() {
  unsigned long currentMillis = millis();

  // -------------------------------------------------------------
  // 1. BOTÓN 1: ENCENDIDO / APAGADO (Pulsador)
  // -------------------------------------------------------------
  int readPower = digitalRead(PIN_BTN_POWER);
  if (readPower == LOW && lastStatePower == HIGH && (currentMillis - lastDebouncePower) > debounceDelay) {
    lastDebouncePower = currentMillis;
    isDeviceOn = !isDeviceOn;
    digitalWrite(PIN_LED_STATUS, isDeviceOn ? HIGH : LOW);

    // Notificar a Three.js
    Serial.println("BTN_POWER");
    Serial.print("[ESP32] Estado Power: ");
    Serial.println(isDeviceOn ? "ON" : "OFF");
  }
  lastStatePower = readPower;

  // -------------------------------------------------------------
  // 2. BOTÓN 2: PERILLA DE VOLUMEN (Encoder Rotatorio)
  //    Giro a la Derecha = Sube volumen (+5%)
  //    Giro a la Izquierda = Baja volumen (-5%)
  // -------------------------------------------------------------
  currentClkState = digitalRead(PIN_ROTARY_CLK);

  // Detectar cambio de flanco en el encoder
  if (currentClkState != lastClkState && currentClkState == LOW) {
    if (currentMillis - lastEncoderTime > 15) { // Filtrado rápido de ruido
      lastEncoderTime = currentMillis;

      if (isDeviceOn) {
        // Si el estado de DT es diferente de CLK -> Giro en sentido horario (DERECHA)
        if (digitalRead(PIN_ROTARY_DT) != currentClkState) {
          currentVolume = min(100, currentVolume + 5);
          Serial.println("BTN_VOL_UP");
          Serial.print("[ESP32] Perilla -> DERECHA | Vol: ");
          Serial.print(currentVolume);
          Serial.println("%");
        } 
        // Si DT es igual a CLK -> Giro en sentido antihorario (IZQUIERDA)
        else {
          currentVolume = max(0, currentVolume - 5);
          Serial.println("BTN_VOL_DOWN");
          Serial.print("[ESP32] Perilla -> IZQUIERDA | Vol: ");
          Serial.print(currentVolume);
          Serial.println("%");
        }
      }
    }
  }
  lastClkState = currentClkState;

  // -------------------------------------------------------------
  // 3. BOTÓN 3: PLAY / PAUSA DE MÚSICA (Pulsador)
  // -------------------------------------------------------------
  int readPlay = digitalRead(PIN_BTN_PLAY);
  if (readPlay == LOW && lastStatePlay == HIGH && (currentMillis - lastDebouncePlay) > debounceDelay) {
    lastDebouncePlay = currentMillis;
    if (isDeviceOn) {
      isPlaying = !isPlaying;

      // Notificar a Three.js
      Serial.println("BTN_PLAY");
      Serial.print("[ESP32] Música: ");
      Serial.println(isPlaying ? "REPRODUCIENDO" : "PAUSA");
    }
  }
  lastStatePlay = readPlay;

  // -------------------------------------------------------------
  // 4. RECEPCIÓN DE COMANDOS DESDE THREE.JS
  // -------------------------------------------------------------
  if (Serial.available() > 0) {
    String command = Serial.readStringUntil('\n');
    command.trim();

    if (command == "CMD:POWER:ON") {
      isDeviceOn = true;
      digitalWrite(PIN_LED_STATUS, HIGH);
    } else if (command == "CMD:POWER:OFF") {
      isDeviceOn = false;
      isPlaying = false;
      digitalWrite(PIN_LED_STATUS, LOW);
    } else if (command.startsWith("CMD:VOL:")) {
      String volStr = command.substring(8);
      currentVolume = volStr.toInt();
    } else if (command == "CMD:MUSIC:PLAY") {
      isPlaying = true;
    } else if (command == "CMD:MUSIC:PAUSE") {
      isPlaying = false;
    }
  }

  delay(2);
}
