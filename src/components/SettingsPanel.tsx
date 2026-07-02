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
  Kitten Smart Home - ESP32 Firestore Integration Sketch (DHT11 Version)
  Requires the following libraries in Arduino IDE:
  1. "ArduinoJson" by Benoit Blanchon (via Library Manager)
  2. "DHT sensor library" by Adafruit (via Library Manager)
  3. "Adafruit Unified Sensor" by Adafruit (via Library Manager, required by DHT library)
*/

#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include <DHT.h>
#include <time.h>

// WiFi Credentials
const char* ssid = "ASUS_X00RD";
const char* password = "6172839405";

// Firebase Configurations
const char* projectId = "${firebaseConfig.projectId || 'kitten-smarthome'}";
const char* databaseId = "${settings.firestoreDatabaseTarget === 'custom' ? (firebaseConfig.firestoreDatabaseId || '(default)') : '(default)'}";

// Hardware Pins (Adjust to your actual wiring)
const int RED_PIN = 12;      // GPIO pin for Red channel
const int GREEN_PIN = 14;    // GPIO pin for Green channel
const int BLUE_PIN = 26;     // GPIO pin for Blue channel
const int FAN_PIN = 13;      // Digital Pin for Fan ON/OFF Control (Connected to L298N IN1)
const int DHT_PIN = 32;      // Digital pin connected to DHT11 (GPIO 32)
const int MOTION_PIN = 27;   // PIR Motion sensor pin

/* 
  RGB LED WIRING DIAGRAM:
  An RGB LED has 4 pins. Pin 1 is Red, Pin 2 is Common (longest leg), Pin 3 is Green, Pin 4 is Blue.
  
  Option 1: Common Cathode RGB LED (Common Ground) - DEFAULT IN THIS CODE
  1. RED pin (Pin 1)   -> 220 Ohm Resistor -> Connect to ESP32 Pin 12 (RED_PIN)
  2. COMMON pin (Pin 2) -> Connect directly to ESP32 GND
  3. GREEN pin (Pin 3) -> 220 Ohm Resistor -> Connect to ESP32 Pin 14 (GREEN_PIN)
  4. BLUE pin (Pin 4)  -> 220 Ohm Resistor -> Connect to ESP32 Pin 26 (BLUE_PIN)
  
  Option 2: Common Anode RGB LED (Common VCC)
  1. RED pin (Pin 1)   -> 220 Ohm Resistor -> Connect to ESP32 Pin 12 (RED_PIN)
  2. COMMON pin (Pin 2) -> Connect directly to ESP32 3.3V (or 5V)
  3. GREEN pin (Pin 3) -> 220 Ohm Resistor -> Connect to ESP32 Pin 14 (GREEN_PIN)
  4. BLUE pin (Pin 4)  -> 220 Ohm Resistor -> Connect to ESP32 Pin 26 (BLUE_PIN)
  *Note: For Common Anode, the signals must be inverted! (Uncomment the inversion line in setRGBColor() below).
*/

#define DHTTYPE DHT11
DHT dht(DHT_PIN, DHTTYPE);

// Choose your RGB LED type:
// Set to true if you have a Common Anode RGB LED (longest leg connected to VCC / 3.3V or 5V)
// Set to false if you have a Common Cathode RGB LED (longest leg connected to GND)
const bool IS_COMMON_ANODE = false;

// Global State Variables (Synchronized with Firestore)
int ledVal = 128;            // Current LED brightness level (0-255)
int fanVal = 0;              // Current Fan state (0 = OFF, 255 = ON)
bool autoMode = true;        // Automation override flag

// Helper function to write color values to RGB channels
void setRGBColor(int r, int g, int b) {
  // Constrain inputs to standard PWM range
  r = constrain(r, 0, 255);
  g = constrain(g, 0, 255);
  b = constrain(b, 0, 255);

  // Invert signals if using Common Anode LED
  int outR = IS_COMMON_ANODE ? (255 - r) : r;
  int outG = IS_COMMON_ANODE ? (255 - g) : g;
  int outB = IS_COMMON_ANODE ? (255 - b) : b;

  // Use direct digital writes for boundaries (0 and 255) to guarantee absolute ON/OFF states and bypass ESP32 PWM driver glitches
  if (outR <= 0) {
    digitalWrite(RED_PIN, LOW);
  } else if (outR >= 255) {
    digitalWrite(RED_PIN, HIGH);
  } else {
    analogWrite(RED_PIN, outR);
  }

  if (outG <= 0) {
    digitalWrite(GREEN_PIN, LOW);
  } else if (outG >= 255) {
    digitalWrite(GREEN_PIN, HIGH);
  } else {
    analogWrite(GREEN_PIN, outG);
  }

  if (outB <= 0) {
    digitalWrite(BLUE_PIN, LOW);
  } else if (outB >= 255) {
    digitalWrite(BLUE_PIN, HIGH);
  } else {
    analogWrite(BLUE_PIN, outB);
  }
}

// Timing Trackers
unsigned long lastTelemetryTime = 0;
const unsigned long telemetryInterval = 5000; // Publish telemetry every 5 seconds
unsigned long lastControlCheckTime = 0;
const unsigned long controlInterval = 2000;  // Fetch controls every 2 seconds

void setup() {
  Serial.begin(115200);
  
  pinMode(RED_PIN, OUTPUT);
  pinMode(GREEN_PIN, OUTPUT);
  pinMode(BLUE_PIN, OUTPUT);
  pinMode(FAN_PIN, OUTPUT);
  pinMode(MOTION_PIN, INPUT);

  // Initialize DHT sensor
  dht.begin();

  // Connect to WiFi network
  WiFi.begin(ssid, password);
  Serial.print("Connecting to WiFi");
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("\\nWiFi Connected!");
  Serial.print("IP Address: ");
  Serial.println(WiFi.localIP());

  // Initialize NTP time with 0 offset (UTC)
  configTime(0, 0, "pool.ntp.org", "time.nist.gov");
  Serial.print("Synchronizing time with NTP");
  struct tm timeinfo;
  int retry = 0;
  while (!getLocalTime(&timeinfo) && retry < 15) {
    delay(500);
    Serial.print(".");
    retry++;
  }
  Serial.println("");
  if (getLocalTime(&timeinfo)) {
    Serial.println("Time synchronized successfully!");
  } else {
    Serial.println("Time synchronization failed, using fallback.");
  }
}

void loop() {
  if (WiFi.status() == WL_CONNECTED) {
    unsigned long currentMillis = millis();

    // 1. Fetch Control State from Firestore (GET)
    if (currentMillis - lastControlCheckTime >= controlInterval) {
      lastControlCheckTime = currentMillis;
      fetchControlState();
    }

    // 2. Publish Telemetry to Firestore (POST)
    if (currentMillis - lastTelemetryTime >= telemetryInterval) {
      lastTelemetryTime = currentMillis;
      publishTelemetry();
    }
  }
}

void fetchControlState() {
  WiFiClientSecure client;
  client.setInsecure(); // Overpasses SSL validation for direct Google API connection
  HTTPClient http;
  
  // Construct Firestore REST Document Endpoint
  String url = "https://firestore.googleapis.com/v1/projects/";
  url += projectId;
  url += "/databases/";
  url += databaseId;
  url += "/documents/control/esp32";

  http.begin(client, url);
  int httpResponseCode = http.GET();

  if (httpResponseCode == 200) {
    String payload = http.getString();
    
    // Parse JSON
    DynamicJsonDocument doc(1024);
    DeserializationError error = deserializeJson(doc, payload);

    if (!error) {
      // Decode Firestore-specific typed fields safely with fallbacks into global variables
      if (doc["fields"]["led"].containsKey("integerValue")) {
        ledVal = doc["fields"]["led"]["integerValue"].as<int>();
      }
      if (doc["fields"]["fan"].containsKey("integerValue")) {
        fanVal = doc["fields"]["fan"]["integerValue"].as<int>();
      }
      if (doc["fields"]["auto"].containsKey("booleanValue")) {
        autoMode = doc["fields"]["auto"]["booleanValue"].as<bool>();
      }

      Serial.printf("Decoded - LED Duty: %d/255, Fan State: %s, Auto: %s\\n", 
                    ledVal, (fanVal > 0) ? "ON" : "OFF", autoMode ? "ON" : "OFF");

      // Local temperature/occupancy automation if autoMode is active
      if (autoMode) {
        float t = dht.readTemperature();
        bool m = digitalRead(MOTION_PIN) == HIGH;
        if (!isnan(t)) {
          // Dynamic thermostat hysteresis (prevents constant rapid switching)
          if (t >= 28.0) {
            fanVal = 255; // Full power ON if hot
          } else if (t < 25.0) {
            fanVal = 0;   // Shut OFF completely if cool
          }
        }
        if (m) {
          ledVal = 120;   // Brighten LED if motion is active
        } else {
          ledVal = 0;     // Shut off LED if no motion
        }
      }

      // Set hardware outputs
      if (autoMode) {
        // Temperature-based RGB feedback in Auto mode (with motion override)
        float t = dht.readTemperature();
        if (!isnan(t) && ledVal > 0) {
          if (t >= 28.0) {
            // Hot environment -> Glow Red
            setRGBColor(ledVal, 0, 0);
          } else if (t < 25.0) {
            // Cold environment -> Glow Blue
            setRGBColor(0, 0, ledVal);
          } else {
            // Comfortable environment -> Glow warm Green
            setRGBColor(0, ledVal, 0);
          }
        } else {
          setRGBColor(0, 0, 0); // Off if motion inactive or sensor failed
        }
      } else {
        // Manual control: map preset brightness levels to custom color palettes
        if (ledVal == 0) {
          setRGBColor(0, 0, 0); // Off
        } else if (ledVal == 20) {
          // Movie Preset (Deep Indigo Glow)
          setRGBColor(10, 0, 20);
        } else if (ledVal == 255) {
          // Gaming Preset (Neon Magenta)
          setRGBColor(128, 0, 255);
        } else if (ledVal == 150) {
          // Study Preset (Daylight White)
          setRGBColor(150, 150, 150);
        } else {
          // Standard manual adjustment (Scalable warm amber light)
          int r = ledVal;
          int g = (ledVal * 75) / 100;
          int b = (ledVal * 35) / 100;
          setRGBColor(r, g, b);
        }
      }
      // Write to Fan as a simple binary Digital HIGH/LOW to prevent startup stalling and core incompatibilities
      digitalWrite(FAN_PIN, (fanVal > 0) ? HIGH : LOW);
    } else {
      Serial.print("JSON Deserialization failed: ");
      Serial.println(error.c_str());
    }
  } else {
    Serial.printf("GET control state failed, HTTP error: %d\\n", httpResponseCode);
  }
  http.end();
}

void publishTelemetry() {
  WiFiClientSecure client;
  client.setInsecure(); // Overpasses SSL validation for direct Google API connection
  HTTPClient http;
  
  // Construct Firestore REST Post Endpoint
  String url = "https://firestore.googleapis.com/v1/projects/";
  url += projectId;
  url += "/databases/";
  url += databaseId;
  url += "/documents/telemetry";

  http.begin(client, url);
  http.addHeader("Content-Type", "application/json");

  // Read actual DHT11 sensor
  float tempVal = dht.readTemperature();
  bool motionVal = digitalRead(MOTION_PIN) == HIGH;

  // Handle sensor reading failures
  if (isnan(tempVal)) {
    Serial.println("Warning: Failed to read temperature from DHT11 sensor!");
    tempVal = 24.5; // Fail-safe default or skip publishing
  }

  // Display values in the Serial Monitor
  Serial.printf("Sensor Reading - DHT11 Temperature: %.1f C, Motion: %s\\n", 
                tempVal, motionVal ? "DETECTED" : "CLEAR");

  // Get current UTC time for Firestore timestamp
  struct tm timeinfo;
  String isoTime = "";
  if (getLocalTime(&timeinfo)) {
    char timeString[30];
    strftime(timeString, sizeof(timeString), "%Y-%m-%dT%H:%M:%SZ", &timeinfo);
    isoTime = String(timeString);
  }

  // Build Firestore typed fields structure containing ONLY sensor telemetry
  DynamicJsonDocument doc(1024);
  JsonObject fields = doc.createNestedObject("fields");

  JsonObject tempObj = fields.createNestedObject("temperature");
  tempObj["doubleValue"] = tempVal;

  JsonObject motionObj = fields.createNestedObject("motion");
  motionObj["booleanValue"] = motionVal;

  if (isoTime.length() > 0) {
    JsonObject timestampObj = fields.createNestedObject("timestamp");
    timestampObj["timestampValue"] = isoTime;
  }

  String jsonString;
  serializeJson(doc, jsonString);

  int httpResponseCode = http.POST(jsonString);

  if (httpResponseCode == 200 || httpResponseCode == 201) {
    Serial.println("[Firestore] Telemetry updated successfully!");
  } else {
    Serial.printf("POST telemetry failed, HTTP: %d\\n", httpResponseCode);
  }
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
