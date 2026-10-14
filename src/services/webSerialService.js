// WebSerial API Hardware Interface for WEMOS LOLIN S2 Mini + AS608 Optical Sensor

export class WebSerialService {
  constructor() {
    this.port = null;
    this.reader = null;
    this.readableStreamClosed = null;
    this.isConnected = false;
    this.onDataCallback = null;
    this.onLogCallback = null;
    this.onStatusChangeCallback = null;
    
    // Telemetry stats
    this.bytesReceived = 0;
    this.framesCount = 0;
    this.lastFrameTime = 0;
    this.currentFps = 0;
    this.droppedPackets = 0;

    // Buffer for AS608 stream reconstruction
    this.rxBuffer = [];
    this.expectedWidth = 128;
    this.expectedHeight = 144;
  }

  isSupported() {
    return typeof navigator !== 'undefined' && 'serial' in navigator;
  }

  log(message, type = 'info') {
    if (this.onLogCallback) {
      this.onLogCallback({
        timestamp: new Date().toLocaleTimeString(),
        message,
        type // 'info', 'success', 'warning', 'error', 'data'
      });
    }
  }

  async connect(baudRate = 57600) {
    if (!this.isSupported()) {
      throw new Error('WebSerial API is not supported in this browser. Please use Chrome, Edge, Opera, or Chrome for Android with experimental flags.');
    }

    try {
      this.log(`Requesting Serial Port access at ${baudRate} baud...`, 'info');
      // Prompt user to select port
      this.port = await navigator.serial.requestPort();
      
      await this.port.open({
        baudRate: parseInt(baudRate, 10),
        dataBits: 8,
        stopBits: 1,
        parity: 'none',
        bufferSize: 16384
      });

      this.isConnected = true;
      if (this.onStatusChangeCallback) {
        this.onStatusChangeCallback(true);
      }
      this.log(`Port connected successfully at ${baudRate} baud! Streaming ready.`, 'success');

      // Listen for unexpected disconnect
      this.port.addEventListener('disconnect', () => {
        this.handleDisconnect('Hardware device disconnected from USB port.');
      });

      // Start continuous background read loop
      this.startReading();
      return true;
    } catch (err) {
      this.log(`Connection failed: ${err.message}`, 'error');
      this.isConnected = false;
      if (this.onStatusChangeCallback) {
        this.onStatusChangeCallback(false);
      }
      throw err;
    }
  }

  async startReading() {
    while (this.port && this.port.readable && this.isConnected) {
      try {
        this.reader = this.port.readable.getReader();
        while (true) {
          const { value, done } = await this.reader.read();
          if (done) {
            break;
          }
          if (value) {
            this.handleIncomingChunk(value);
          }
        }
      } catch (error) {
        if (this.isConnected) {
          this.log(`Serial read error: ${error.message}`, 'warning');
        }
      } finally {
        if (this.reader) {
          this.reader.releaseLock();
          this.reader = null;
        }
      }
    }
  }

  handleIncomingChunk(uint8Chunk) {
    this.bytesReceived += uint8Chunk.length;
    
    // Push bytes into buffer
    for (let i = 0; i < uint8Chunk.length; i++) {
      this.rxBuffer.push(uint8Chunk[i]);
    }

    // Limit buffer overflow protection
    if (this.rxBuffer.length > 65536) {
      this.rxBuffer = this.rxBuffer.slice(-18432);
      this.droppedPackets++;
    }

    this.processBuffer();
  }

  processBuffer() {
    const targetSize = this.expectedWidth * this.expectedHeight; // 18,432 bytes for 128x144

    // 1. Look for custom sync header: 0xAA 0x55 (Fast stream from LOLIN S2 Mini)
    for (let i = 0; i < this.rxBuffer.length - 4; i++) {
      if (this.rxBuffer[i] === 0xAA && this.rxBuffer[i + 1] === 0x55) {
        const w = this.rxBuffer[i + 2] || this.expectedWidth;
        const h = this.rxBuffer[i + 3] || this.expectedHeight;
        const frameBytes = w * h;
        const totalPacket = 4 + frameBytes;

        if (this.rxBuffer.length >= i + totalPacket) {
          const pixelSlice = this.rxBuffer.slice(i + 4, i + totalPacket);
          const pixelData = new Uint8Array(pixelSlice);
          
          this.rxBuffer = this.rxBuffer.slice(i + totalPacket);
          this.deliverFrame(pixelData, w, h);
          return;
        }
      }
    }

    // 2. Look for AS608 standard raw packet header: 0xEF 0x01
    for (let i = 0; i < this.rxBuffer.length - 8; i++) {
      if (this.rxBuffer[i] === 0xEF && this.rxBuffer[i + 1] === 0x01) {
        // Direct stream accumulator
        if (this.rxBuffer.length >= targetSize) {
          const pixelData = new Uint8Array(this.rxBuffer.slice(0, targetSize));
          this.rxBuffer = this.rxBuffer.slice(targetSize);
          this.deliverFrame(pixelData, this.expectedWidth, this.expectedHeight);
          return;
        }
      }
    }

    // 3. Fallback: if raw stream of grayscale values fills a full frame buffer
    if (this.rxBuffer.length >= targetSize) {
      const pixelData = new Uint8Array(this.rxBuffer.slice(0, targetSize));
      this.rxBuffer = this.rxBuffer.slice(targetSize);
      this.deliverFrame(pixelData, this.expectedWidth, this.expectedHeight);
    }
  }

  deliverFrame(pixelData, width, height) {
    this.framesCount++;
    const now = performance.now();
    if (this.lastFrameTime > 0) {
      const delta = (now - this.lastFrameTime) / 1000;
      this.currentFps = Math.round(1 / delta);
    }
    this.lastFrameTime = now;

    if (this.onDataCallback) {
      this.onDataCallback({
        data: pixelData,
        width,
        height,
        fps: this.currentFps,
        bytesTotal: this.bytesReceived,
        framesTotal: this.framesCount,
        timestamp: Date.now()
      });
    }

    if (this.framesCount % 5 === 0) {
      this.log(`Frame #${this.framesCount} received (${width}x${height} @ ${this.currentFps} FPS)`, 'data');
    }
  }

  async sendCommand(commandBytes) {
    if (!this.port || !this.port.writable) {
      throw new Error('Port not writable or not connected.');
    }
    const writer = this.port.writable.getWriter();
    await writer.write(new Uint8Array(commandBytes));
    writer.releaseLock();
    this.log(`Sent command [${Array.from(commandBytes).map(b => '0x' + b.toString(16).padStart(2, '0')).join(' ')}]`, 'info');
  }

  async triggerAS608Scan() {
    // Send AS608 command: GenImg (0x01) - Detect finger & capture image
    // Frame: 0xEF 0x01 (Header), 0xFF 0xFF 0xFF 0xFF (Addr), 0x01 (Cmd), 0x00 0x03 (Len), 0x01 (GenImg), 0x00 0x05 (Checksum)
    const genImgCmd = [0xEF, 0x01, 0xFF, 0xFF, 0xFF, 0xFF, 0x01, 0x00, 0x03, 0x01, 0x00, 0x05];
    await this.sendCommand(genImgCmd);
    this.log('Triggered AS608 GenImg capture command', 'info');
  }

  async disconnect() {
    this.isConnected = false;
    try {
      if (this.reader) {
        await this.reader.cancel();
      }
      if (this.port) {
        await this.port.close();
      }
    } catch (e) {
      console.warn('Error closing port:', e);
    } finally {
      this.port = null;
      this.reader = null;
      this.handleDisconnect('Hardware device disconnected.');
    }
  }

  handleDisconnect(msg) {
    this.isConnected = false;
    this.log(msg, 'warning');
    if (this.onStatusChangeCallback) {
      this.onStatusChangeCallback(false);
    }
  }
}

export const webSerialManager = new WebSerialService();

// Copyable Arduino C++ Firmware Code for WEMOS LOLIN S2 Mini & AS608 Sensor
export const LOLIN_S2_FIRMWARE_CODE = `/*
  ==============================================================
  IsoMatrix - WEMOS LOLIN S2 Mini + AS608 Fingerprint Scanner
  ==============================================================
  Wiring:
    - AS608 VCC  -->  3.3V (or 5V if 5V sensor module)
    - AS608 GND  -->  GND
    - AS608 TX   -->  LOLIN S2 Mini GPIO 16 (Hardware RX1)
    - AS608 RX   -->  LOLIN S2 Mini GPIO 18 (Hardware TX1)
  
  USB: Connect LOLIN S2 Mini native USB to PC / Mobile OTG.
  Streams 128x144 pixel heightfield stream with 0xAA 0x55 sync header.
*/

#include <Arduino.h>
#include <Adafruit_Fingerprint.h>

// Hardware Serial on LOLIN S2 Mini
#define RX_PIN 16
#define TX_PIN 18
HardwareSerial mySerial(1);
Adafruit_Fingerprint finger = Adafruit_Fingerprint(&mySerial);

const uint8_t SYNC_H = 0xAA;
const uint8_t SYNC_L = 0x55;
const uint8_t WIDTH = 128;
const uint8_t HEIGHT = 144;

void setup() {
  Serial.begin(57600);
  while (!Serial && millis() < 3000);

  mySerial.begin(57600, SERIAL_8N1, RX_PIN, TX_PIN);
  finger.begin(57600);

  if (finger.verifyPassword()) {
    Serial.println("FINGERPRINT_SENSOR_READY");
  } else {
    Serial.println("FINGERPRINT_SENSOR_NOT_FOUND");
  }
}

void loop() {
  uint8_t p = finger.getImage();
  if (p == FINGERPRINT_OK) {
    // Stream image data packets to WebSerial
    Serial.write(SYNC_H);
    Serial.write(SYNC_L);
    Serial.write(WIDTH);
    Serial.write(HEIGHT);

    // Request image transfer from sensor buffer
    // finger.readImageRaw(...) or streaming buffer
    for (int y = 0; y < HEIGHT; y++) {
      for (int x = 0; x < WIDTH; x++) {
        // Send pixel byte (0-255)
        uint8_t pixel = random(40, 220); // replace with sensor buffer
        Serial.write(pixel);
      }
    }
    delay(200);
  }
  delay(50);
}
`;
