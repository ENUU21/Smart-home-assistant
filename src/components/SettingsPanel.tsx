/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState } from 'react';
import { Sliders, Cpu, Save, RefreshCw, Volume2, ShieldAlert, Trash2, Database, Copy, Check } from 'lucide-react';
import { DashboardSettings } from '../types';
import GlowCard from './GlowCard';
import { pruneOldTelemetry } from '../lib/firebase';
import firebaseConfig from '../../firebase-applet-config.json';

interface SettingsPanelProps {
  settings: DashboardSettings;
  onSaveSettings: (newSettings: DashboardSettings) => void;
  onClose: () => void;
}

export default function SettingsPanel({ settings, onSaveSettings, onClose }: SettingsPanelProps) {
  const [pruning, setPruning] = useState(false);
  const [pruneStatus, setPruneStatus] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handlePrune = async () => {
    setPruning(true);
    setPruneStatus('Optimizing Database...');
    try {
      const removedCount = await pruneOldTelemetry(100);
      if (removedCount > 0) {
        setPruneStatus(`Done! Cleared ${removedCount} logs`);
      } else {
        setPruneStatus('Database is already clean');
      }
      setTimeout(() => {
        setPruneStatus(null);
        setPruning(false);
      }, 3000);
    } catch (err) {
      setPruneStatus('Maintenance Failed');
      console.error('Maintenance error:', err instanceof Error ? err.message : String(err));
      setTimeout(() => {
        setPruneStatus(null);
        setPruning(false);
      }, 3500);
    }
  };

  const handleInputChange = (key: keyof DashboardSettings, value: any) => {
    onSaveSettings({
      ...settings,
      [key]: value,
    });
  };

  const esp32Code = `/*
  ========================================================================================
  KITTEN SMART HOME - ESP32 COMPACT SKETCH (Voice & Sensor Edition)
  
  ⚠️ IMPORTANT - CHOOSE LARGE PARTITION TABLE TO PREVENT 'SKETCH TOO BIG' ERROR:
  Because compiling both WiFi, HTTP Secure client, and Bluetooth A2DP audio requires 
  large libraries, please make the following selection in your Arduino IDE:
  👉 Tools > Partition Scheme > Select "Huge APP (3MB No OTA)" or "Minimal SPIFFS"
  ========================================================================================
  Libraries required:
  1. "ArduinoJson" (Benoit Blanchon)
  2. "DHT sensor library" (Adafruit)
  3. "Adafruit Unified Sensor" (Adafruit)
  4. "ESP32-A2DP" (Phil Schatzmann) - No extra AudioTools needed!
*/

#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include <DHT.h>
#include <time.h>
#include <driver/i2s.h>

// FEATURE FLAGS (Turn ON/OFF features easily for modular testing!)
#define ENABLE_SPEAKER false     // Set to true once you connect the MAX98357A speaker! Set to false for mic-only testing.
#define CONTINUOUS_LISTENING true
#define USE_SOUND_THRESHOLD true
const int SOUND_PEAK_THRESHOLD = 4500; // Peak volume threshold to start recording

#if ENABLE_SPEAKER
#define A2DP_LEGACY_I2S_SUPPORT 1
#define A2DP_I2S_AUDIOTOOLS 0
#include "BluetoothA2DPSink.h"
#endif

// Hardware Pin Configuration
const char* ssid = "ASUS_X00RD";
const char* password = "6172839405";
const char* projectId = "${firebaseConfig.projectId || 'kitten-smarthome'}";
const char* databaseId = "${settings.firestoreDatabaseTarget === 'custom' ? (firebaseConfig.firestoreDatabaseId || '(default)') : '(default)'}";

const int LED_PIN = 12;
const int FAN_PIN = 13;
const int DHT_PIN = 32;
const int MOTION_PIN = 27;

const int I2S_SCK = 26;          // SCK/BCLK pin (Shared if using both mic & speaker)
const int I2S_WS = 25;           // WS/LRC pin (Shared if using both mic & speaker)
const int I2S_SD = 33;           // Mic Data Out (DOUT)
const int I2S_SPEAKER_DATA = 22; // Speaker Data In (DIN)

#define DHTTYPE DHT11
DHT dht(DHT_PIN, DHTTYPE);

const int SAMPLE_RATE = 16000;
const int RECORD_TIME_SECS = 2;
const int BUFFER_SIZE = SAMPLE_RATE * RECORD_TIME_SECS;
int16_t* audioBuffer = NULL;

int ledVal = 128;
int fanVal = 0;
bool autoMode = true;

#if ENABLE_SPEAKER
BluetoothA2DPSink a2dp_sink;
#endif

unsigned long lastTelemetryTime = 0;
const unsigned long telemetryInterval = 5000;
unsigned long lastControlCheckTime = 0;
const unsigned long controlInterval = 2000;

void initMicrophone() {
  Serial.println("[I2S Mic] Configuring I2S...");
  Serial.flush();
  i2s_config_t i2s_config = {
    .mode = (i2s_mode_t)(I2S_MODE_MASTER | I2S_MODE_RX),
    .sample_rate = SAMPLE_RATE,
    .bits_per_sample = I2S_BITS_PER_SAMPLE_16BIT,
    .channel_format = I2S_CHANNEL_FMT_ONLY_LEFT,
    .communication_format = (i2s_comm_format_t)(I2S_COMM_FORMAT_I2S | I2S_COMM_FORMAT_I2S_MSB),
    .intr_alloc_flags = ESP_INTR_FLAG_LEVEL1,
    .dma_buf_count = 8,
    .dma_buf_len = 64,
    .use_apll = false
  };
  i2s_pin_config_t pin_config = {
    .bck_io_num = I2S_SCK,
    .ws_io_num = I2S_WS,
    .data_out_num = I2S_PIN_NO_CHANGE,
    .data_in_num = I2S_SD
  };
  Serial.println("[I2S Mic] Installing driver for I2S_NUM_1...");
  Serial.flush();
  esp_err_t err1 = i2s_driver_install(I2S_NUM_1, &i2s_config, 0, NULL);
  if (err1 != ESP_OK) {
    Serial.printf("[ERROR] i2s_driver_install failed: 0x%x\\n", err1);
    Serial.flush();
  }
  
  Serial.println("[I2S Mic] Setting pins...");
  Serial.flush();
  esp_err_t err2 = i2s_set_pin(I2S_NUM_1, &pin_config);
  if (err2 != ESP_OK) {
    Serial.printf("[ERROR] i2s_set_pin failed: 0x%x\\n", err2);
    Serial.flush();
  }
}

void setLEDIntensity(int val) {
  val = constrain(val, 0, 255);
  analogWrite(LED_PIN, val);
}

void setup() {
  Serial.begin(115200);
  delay(1000); // Give serial monitor time to connect
  Serial.println("\\n[SYSTEM] ESP32 Booting Up...");
  Serial.flush();

  Serial.println("[SYSTEM] Initializing Pin Modes...");
  pinMode(LED_PIN, OUTPUT);
  pinMode(FAN_PIN, OUTPUT);
  pinMode(MOTION_PIN, INPUT);
  Serial.flush();

  Serial.println("[SYSTEM] Allocating Audio Buffer...");
  Serial.flush();
  audioBuffer = (int16_t*) malloc(BUFFER_SIZE * sizeof(int16_t));
  if (audioBuffer == NULL) {
    Serial.println("[WARNING] Failed to allocate audio buffer (Out of Memory)!");
  } else {
    Serial.println("[SYSTEM] Audio buffer allocated successfully.");
  }
  Serial.flush();

  Serial.println("[SYSTEM] Initializing DHT Sensor...");
  Serial.flush();
  dht.begin();

  Serial.println("[SYSTEM] Initializing I2S Microphone...");
  Serial.flush();
  initMicrophone();
  Serial.println("[SYSTEM] Microphone initialized successfully.");
  Serial.flush();

#if ENABLE_SPEAKER
  Serial.println("[SYSTEM] Initializing Bluetooth Speaker...");
  Serial.flush();
  // Set Bluetooth speaker pin config directly (Standard ESP32 I2S output - I2S_NUM_0)
  i2s_pin_config_t my_pin_config = {
    .bck_io_num = I2S_SCK,
    .ws_io_num = I2S_WS,
    .data_out_num = I2S_SPEAKER_DATA,
    .data_in_num = I2S_PIN_NO_CHANGE
  };
  a2dp_sink.set_pin_config(my_pin_config);
  a2dp_sink.start("ESP32 Bluetooth Speaker");
  Serial.println("[SYSTEM] Bluetooth Speaker initialized.");
  Serial.flush();
#endif

  Serial.print("[SYSTEM] Connecting to WiFi SSID: ");
  Serial.println(ssid);
  Serial.flush();
  WiFi.begin(ssid, password);
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
    Serial.flush();
  }
  Serial.println("\\n[SYSTEM] WiFi Connected!");
  Serial.print("[SYSTEM] IP Address: ");
  Serial.println(WiFi.localIP());
  Serial.flush();

  Serial.println("[SYSTEM] Synchronizing Time...");
  Serial.flush();
  configTime(0, 0, "pool.ntp.org", "time.nist.gov");
  Serial.println("[SYSTEM] Setup complete!");
  Serial.flush();
}

bool checkVoiceTrigger() {
  if (audioBuffer == NULL) return false;
  int16_t sampleWindow[128];
  size_t bytesRead = 0;
  i2s_read(I2S_NUM_1, (void*)sampleWindow, sizeof(sampleWindow), &bytesRead, 10);
  int numSamples = bytesRead / sizeof(int16_t);
  for (int i = 0; i < numSamples; i++) {
    if (abs(sampleWindow[i]) > SOUND_PEAK_THRESHOLD) return true;
  }
  return false;
}

void recordAudio() {
  setLEDIntensity(255);
  delay(150);
  setLEDIntensity(0);
  delay(150);
  setLEDIntensity(255);
  memset(audioBuffer, 0, BUFFER_SIZE * sizeof(int16_t));
  size_t bytesRead = 0;
  i2s_read(I2S_NUM_1, (void*)audioBuffer, BUFFER_SIZE * sizeof(int16_t), &bytesRead, portMAX_DELAY);
  setLEDIntensity(ledVal);
}

void recordAndProcessVoice(); // Forward declaration

void loop() {
  if (WiFi.status() == WL_CONNECTED) {
    unsigned long currentMillis = millis();
    if (CONTINUOUS_LISTENING && audioBuffer != NULL) {
      if (!USE_SOUND_THRESHOLD || checkVoiceTrigger()) {
        recordAndProcessVoice();
        delay(300);
      }
    }
    if (currentMillis - lastControlCheckTime >= controlInterval) {
      lastControlCheckTime = currentMillis;
      fetchControlState();
    }
    if (currentMillis - lastTelemetryTime >= telemetryInterval) {
      lastTelemetryTime = currentMillis;
      publishTelemetry();
    }
  } else {
    // If WiFi is disconnected, try to reconnect gracefully and print status
    static unsigned long lastReconnectAttempt = 0;
    unsigned long currentMillis = millis();
    if (currentMillis - lastReconnectAttempt > 10000) {
      Serial.println("[WIFI] Connection lost! Reconnecting...");
      Serial.flush();
      WiFi.disconnect();
      WiFi.begin(ssid, password);
      lastReconnectAttempt = currentMillis;
    }
    delay(500); // Wait 500ms before checking again
  }
  delay(10); // ALWAYS add a small delay to prevent Task Watchdog resets!
}

void recordAndProcessVoice() {
  recordAudio();
  WiFiClientSecure client;
  client.setInsecure();
  HTTPClient http;
  String serverUrl = "https://${typeof window !== 'undefined' ? window.location.host : 'localhost:3000'}/api/voice-command-raw";
  http.begin(client, serverUrl);
  http.addHeader("Content-Type", "application/octet-stream");
  int httpResponseCode = http.POST((uint8_t*)audioBuffer, BUFFER_SIZE * sizeof(int16_t));
  if (httpResponseCode == 200) {
    String payload = http.getString();
    DynamicJsonDocument doc(1024);
    if (!deserializeJson(doc, payload)) {
      if (doc.containsKey("led")) {
        ledVal = doc["led"].as<int>();
        setLEDIntensity(ledVal);
      }
      if (doc.containsKey("fan")) {
        fanVal = doc["fan"].as<int>();
        digitalWrite(FAN_PIN, (fanVal > 0) ? HIGH : LOW);
      }
      if (doc.containsKey("auto")) {
        autoMode = doc["auto"].as<bool>();
      }
    }
  }
  http.end();
}

void fetchControlState() {
  WiFiClientSecure client;
  client.setInsecure();
  HTTPClient http;
  String url = "https://firestore.googleapis.com/v1/projects/";
  url += projectId;
  url += "/databases/";
  url += databaseId;
  url += "/documents/control/esp32";
  http.begin(client, url);
  if (http.GET() == 200) {
    DynamicJsonDocument doc(1024);
    if (!deserializeJson(doc, http.getString())) {
      if (doc["fields"]["led"].containsKey("integerValue")) {
        ledVal = doc["fields"]["led"]["integerValue"].as<int>();
      }
      if (doc["fields"]["fan"].containsKey("integerValue")) {
        fanVal = doc["fields"]["fan"]["integerValue"].as<int>();
      }
      if (doc["fields"]["auto"].containsKey("booleanValue")) {
        autoMode = doc["fields"]["auto"]["booleanValue"].as<bool>();
      }
      if (autoMode) {
        float t = dht.readTemperature();
        if (!isnan(t)) {
          t -= 2.0;
          if (t >= 28.0) fanVal = 255;
          else if (t < 25.0) fanVal = 0;
        }
        ledVal = (digitalRead(MOTION_PIN) == HIGH) ? 120 : 0;
      }
      setLEDIntensity(ledVal);
      digitalWrite(FAN_PIN, (fanVal > 0) ? HIGH : LOW);
    }
  }
  http.end();
}

void publishTelemetry() {
  WiFiClientSecure client;
  client.setInsecure();
  HTTPClient http;
  String url = "https://firestore.googleapis.com/v1/projects/";
  url += projectId;
  url += "/databases/";
  url += databaseId;
  url += "/documents/telemetry";
  http.begin(client, url);
  http.addHeader("Content-Type", "application/json");
  float t = dht.readTemperature();
  t = isnan(t) ? 24.5 : (t - 2.0);
  bool m = digitalRead(MOTION_PIN) == HIGH;
  struct tm timeinfo;
  String isoTime = "";
  if (getLocalTime(&timeinfo)) {
    char timeString[30];
    strftime(timeString, sizeof(timeString), "%Y-%m-%dT%H:%M:%SZ", &timeinfo);
    isoTime = String(timeString);
  }
  DynamicJsonDocument doc(1024);
  JsonObject fields = doc.createNestedObject("fields");
  fields.createNestedObject("temperature")["doubleValue"] = t;
  fields.createNestedObject("motion")["booleanValue"] = m;
  if (isoTime.length() > 0) {
    fields.createNestedObject("timestamp")["timestampValue"] = isoTime;
  }
  String json;
  serializeJson(doc, json);
  http.POST(json);
  http.end();
}`;

  return (
    <div className="flex flex-col gap-6">
      {/* Configuration Sliders Card */}
      <GlowCard
        id="card-settings-parameters"
        title="Software Configurations"
        subtitle="DASHBOARD & REFRESH CALIBRATIONS"
        glowColor="blue"
      >
        <div className="flex flex-col gap-5">
          {/* IP Address Field */}
          <div>
            <label className="text-[10px] text-slate-500 font-mono block mb-1.5 uppercase tracking-wider flex items-center gap-1.5">
              <Cpu className="w-3.5 h-3.5 text-blue-400" /> Physical ESP32 IPv4 Network Target
            </label>
            <input
              id="input-esp-ip-address"
              type="text"
              value={settings.espIpAddress}
              onChange={(e) => handleInputChange('espIpAddress', e.target.value)}
              placeholder="e.g. 192.168.1.50"
              disabled={settings.simulationMode}
              className="w-full bg-slate-950 text-slate-100 border border-slate-900 rounded-xl px-4 py-2.5 font-mono text-sm focus:outline-none focus:border-blue-500 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            />
            {settings.simulationMode ? (
              <p className="text-[9px] text-amber-500 font-mono mt-1.5 leading-snug">
                * Simulated Mode is active. Turn off simulator in header to bind physical IP.
              </p>
            ) : (
              <p className="text-[9px] text-slate-500 font-mono mt-1.5 leading-snug">
                Enter your local ESP32 IP address on your private home Wi-Fi.
              </p>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Poll rate */}
            <div>
              <div className="flex justify-between items-baseline mb-1.5">
                <label className="text-[10px] text-slate-500 font-mono block uppercase tracking-wider flex items-center gap-1.5">
                  <RefreshCw className="w-3.5 h-3.5 text-cyan-400" /> Refresh Rate (ms)
                </label>
                <span className="text-xs text-cyan-400 font-bold font-mono">
                  {settings.refreshRateMs} ms
                </span>
              </div>
              <input
                id="range-refresh-rate"
                type="range"
                min="500"
                max="5000"
                step="250"
                value={settings.refreshRateMs}
                onChange={(e) => handleInputChange('refreshRateMs', parseInt(e.target.value, 10))}
                className="w-full h-1.5 rounded bg-slate-900 appearance-none cursor-pointer focus:outline-none accent-cyan-400"
              />
              <div className="flex justify-between text-[8px] text-slate-500 font-mono mt-1">
                <span>0.5s (POLL FAST)</span>
                <span>5.0s (POLL SLOW)</span>
              </div>
            </div>

            {/* Voice Sensitivity */}
            <div>
              <div className="flex justify-between items-baseline mb-1.5">
                <label className="text-[10px] text-slate-500 font-mono block uppercase tracking-wider flex items-center gap-1.5">
                  <Volume2 className="w-3.5 h-3.5 text-purple-400" /> Voice Sensitivity
                </label>
                <span className="text-xs text-purple-400 font-bold font-mono">
                  Lvl {settings.voiceSensitivity}
                </span>
              </div>
              <input
                id="range-voice-sensitivity"
                type="range"
                min="1"
                max="10"
                value={settings.voiceSensitivity}
                onChange={(e) => handleInputChange('voiceSensitivity', parseInt(e.target.value, 10))}
                className="w-full h-1.5 rounded bg-slate-900 appearance-none cursor-pointer focus:outline-none accent-purple-500"
              />
              <div className="flex justify-between text-[8px] text-slate-500 font-mono mt-1">
                <span>QUIET (1)</span>
                <span>HYPER-SENSITIVE (10)</span>
              </div>
            </div>
          </div>

          <div className="border-t border-slate-900/40 pt-4 grid grid-cols-2 gap-4">
            {/* Notifications Toggle */}
            <label className="flex items-center gap-3 cursor-pointer group">
              <input
                id="checkbox-notifications"
                type="checkbox"
                checked={settings.notificationsEnabled}
                onChange={(e) => handleInputChange('notificationsEnabled', e.target.checked)}
                className="sr-only peer"
              />
              <div className="relative w-10 h-5.5 bg-slate-900 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-slate-400 after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600 peer-checked:after:bg-cyan-300" />
              <div>
                <span className="text-xs font-bold text-slate-300 font-sans group-hover:text-slate-100 transition-colors">
                  Desktop Alerts
                </span>
                <span className="text-[8px] text-slate-500 font-mono block leading-none mt-0.5">
                  Toggle browser popups
                </span>
              </div>
            </label>

            {/* Power Saving Theme Mode Toggle */}
            <label className="flex items-center gap-3 cursor-pointer group">
              <input
                id="checkbox-power-saving"
                type="checkbox"
                checked={settings.lowLightMode}
                onChange={(e) => handleInputChange('lowLightMode', e.target.checked)}
                className="sr-only peer"
              />
              <div className="relative w-10 h-5.5 bg-slate-900 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-slate-400 after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600 peer-checked:after:bg-cyan-300" />
              <div>
                <span className="text-xs font-bold text-slate-300 font-sans group-hover:text-slate-100 transition-colors">
                  Cyber Dimmer
                </span>
                <span className="text-[8px] text-slate-500 font-mono block leading-none mt-0.5">
                  Ultra low glow style
                </span>
              </div>
            </label>

            {/* Firestore Cloud Sync Toggle */}
            <label className="flex items-center gap-3 cursor-pointer group">
              <input
                id="checkbox-firestore-sync"
                type="checkbox"
                checked={settings.firestoreSyncEnabled}
                onChange={(e) => handleInputChange('firestoreSyncEnabled', e.target.checked)}
                className="sr-only peer"
              />
              <div className="relative w-10 h-5.5 bg-slate-900 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-slate-400 after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-600 peer-checked:after:bg-emerald-300" />
              <div>
                <span className="text-xs font-bold text-slate-300 font-sans group-hover:text-slate-100 transition-colors">
                  Firestore Cloud Sync
                </span>
                <span className="text-[8px] text-slate-500 font-mono block leading-none mt-0.5">
                  Bidirectional data linkage
                </span>
              </div>
            </label>

            {/* Telemetry Upload Mode Indicator */}
            <div className="flex items-start gap-3 bg-slate-950/40 p-2.5 rounded-lg border border-slate-900/30">
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse mt-1.5" />
              <div>
                <span className="text-xs font-bold text-slate-300 font-sans block leading-none">
                  Telemetry: ESP32-Only
                </span>
                <span className="text-[9px] text-slate-500 font-sans block mt-1 leading-normal">
                  Browser-simulated telemetry is disabled. Any data appearing on the dashboard is strictly transmitted by your physical sensor.
                </span>
              </div>
            </div>
          </div>

          {/* Firestore Database Target Selector */}
          <div className="border-t border-slate-900/40 pt-4 flex flex-col gap-2">
            <div className="flex justify-between items-baseline">
              <label className="text-[10px] text-slate-500 font-mono block uppercase tracking-wider">
                Target Firestore Database Selection
              </label>
              <span className="text-[10px] text-emerald-400 font-bold font-mono">
                {settings.firestoreDatabaseTarget === 'custom' ? 'Custom DB' : '(default) DB'}
              </span>
            </div>
            <select
              id="select-firestore-db-target"
              value={settings.firestoreDatabaseTarget || 'default'}
              onChange={(e) => handleInputChange('firestoreDatabaseTarget', e.target.value)}
              disabled={!settings.firestoreSyncEnabled}
              className="w-full bg-slate-950 text-slate-100 border border-slate-900 rounded-xl px-3 py-2 font-mono text-xs focus:outline-none focus:border-emerald-500 transition-colors disabled:opacity-40 cursor-pointer"
            >
              <option value="default">(default) - Standard Spark Free Plan (Recommended)</option>
              <option value="custom">Custom Named DB - Blaze Paid Plan</option>
            </select>
            <p className="text-[9px] text-slate-500 font-mono leading-relaxed mt-1">
              <strong>SPARK PLAN LIMITATION:</strong> Firebase free accounts only support the <code>(default)</code> database. Custom named databases require a Blaze plan upgrade. If you see only the "(default)" database in your Firebase console, choose "(default)" to sync telemetry data.
            </p>
          </div>

          {/* Firestore Database Maintenance */}
          <div className="border-t border-slate-900/40 pt-4 flex flex-col gap-2">
            <label className="text-[10px] text-slate-500 font-mono block uppercase tracking-wider">
              Database Maintenance
            </label>
            <button
              id="btn-prune-telemetry"
              type="button"
              disabled={pruning || !settings.firestoreSyncEnabled}
              onClick={handlePrune}
              className="w-full bg-slate-950/80 hover:bg-slate-900 hover:text-emerald-400 text-slate-300 border border-slate-900 rounded-xl px-3 py-2.5 font-mono text-xs focus:outline-none focus:border-emerald-500 transition-all disabled:opacity-40 flex items-center justify-center gap-2 cursor-pointer select-none active:scale-[0.98]"
            >
              <Trash2 className={`w-4 h-4 ${pruning ? 'animate-spin text-emerald-400' : ''}`} />
              {pruneStatus || 'Prune Old Logs (Keep Latest 100)'}
            </button>
            <p className="text-[9px] text-slate-500 font-mono leading-relaxed mt-1">
              <strong>OPTIMIZATION SERVICE:</strong> Keeps your database compact and prevents storage limits by removing all telemetry documents except the 100 most recent records.
            </p>
          </div>
        </div>
      </GlowCard>

      {/* Connection Docs and CORS Workaround Guidelines */}
      <GlowCard
        id="card-settings-troubleshooting-docs"
        title="Developer Connection Portal"
        subtitle="HOW TO ESTABLISH PHYSICAL ENDPOINTS"
        glowColor="cyan"
      >
        <div className="flex flex-col gap-4 font-mono text-[11px] leading-relaxed text-slate-400">
          <div className="flex flex-col gap-4">
            <div className="flex items-start gap-2.5 p-3 rounded-xl border border-cyan-500/10 bg-cyan-950/5">
              <Database className="w-5 h-5 text-cyan-400 shrink-0 mt-0.5" />
              <div>
                <span className="text-xs font-bold text-slate-200 block mb-1">
                  Bidirectional Firestore Cloud Sync
                </span>
                <span>
                  Bypasses browser CORS restrictions completely by establishing direct internet communication between the ESP32 and Firestore. The ESP32 pushes sensor readings and retrieves controls globally without needing an open port on your local network.
                </span>
              </div>
            </div>

            <div className="bg-slate-950/80 p-3 rounded-xl border border-slate-900 flex flex-col gap-2">
              <span className="text-[10px] font-bold text-slate-300 uppercase tracking-wider block">
                Active REST Endpoints (for custom firmware)
              </span>
              <div className="flex flex-col gap-1.5 text-[9.5px]">
                <div>
                  <span className="text-emerald-400 font-bold">POST</span> <span className="text-slate-300">https://firestore.googleapis.com/v1/projects/${firebaseConfig.projectId || 'kitten-smarthome'}/databases/${settings.firestoreDatabaseTarget === 'custom' ? (firebaseConfig.firestoreDatabaseId || '(default)') : '(default)'}/documents/telemetry</span>
                  <span className="text-slate-500 block text-[9px] mt-0.5">Push real-time sensor parameters (temp, motion)</span>
                </div>
                <div>
                  <span className="text-cyan-400 font-bold">GET</span> <span className="text-slate-300">https://firestore.googleapis.com/v1/projects/${firebaseConfig.projectId || 'kitten-smarthome'}/databases/${settings.firestoreDatabaseTarget === 'custom' ? (firebaseConfig.firestoreDatabaseId || '(default)') : '(default)'}/documents/control/esp32</span>
                  <span className="text-slate-500 block text-[9px] mt-0.5">Read fan levels, LED, and automatic engine states</span>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <div className="flex justify-between items-center">
                <span className="text-[10px] font-bold text-slate-300 uppercase tracking-wider">
                  ESP32 Firmware Code (Arduino C++)
                </span>
                <button
                  id="btn-copy-arduino-code"
                  type="button"
                  onClick={() => handleCopyCode(esp32Code)}
                  className="px-2 py-1 bg-slate-900 hover:bg-slate-800 text-cyan-400 border border-slate-800 rounded-lg text-[9px] flex items-center gap-1 cursor-pointer transition-all active:scale-[0.95]"
                >
                  {copied ? (
                    <>
                      <Check className="w-3 h-3 text-emerald-400" />
                      <span>Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3 h-3" />
                      <span>Copy Code</span>
                    </>
                  )}
                </button>
              </div>
              <div className="bg-slate-950 p-3 rounded-xl border border-slate-900 max-h-72 overflow-y-auto font-mono text-[9.5px] leading-relaxed text-slate-300 select-all scrollbar-thin scrollbar-thumb-slate-800 scrollbar-track-transparent">
                <pre className="whitespace-pre-wrap">
                  {esp32Code}
                </pre>
              </div>
            </div>
          </div>
        </div>
      </GlowCard>

      <button
        id="btn-close-settings-modal"
        onClick={onClose}
        className="w-full bg-gradient-to-r from-blue-600 to-cyan-500 text-slate-950 font-bold text-xs uppercase tracking-wider py-3 rounded-xl font-mono hover:shadow-[0_0_15px_rgba(0,255,208,0.35)] hover:from-blue-500 hover:to-cyan-400 transition-all duration-200 cursor-pointer"
      >
        DISMISS & RUN SYSTEM
      </button>
    </div>
  );
}
