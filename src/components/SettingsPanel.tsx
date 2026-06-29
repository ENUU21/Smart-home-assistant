/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState } from 'react';
import { Sliders, Cpu, Save, RefreshCw, Volume2, ShieldAlert, BookOpen, AlertTriangle, Trash2, Database, Copy, Check } from 'lucide-react';
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
  const [activeTab, setActiveTab] = useState<'cloud' | 'local'>('cloud');
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
      console.error(err);
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

            {/* Firestore Periodic Autosave Toggle */}
            <label className="flex items-center gap-3 cursor-pointer group">
              <input
                id="checkbox-firestore-autosave"
                type="checkbox"
                checked={settings.firestoreAutoSaveTicks}
                onChange={(e) => handleInputChange('firestoreAutoSaveTicks', e.target.checked)}
                className="sr-only peer"
                disabled={!settings.firestoreSyncEnabled}
              />
              <div className="relative w-10 h-5.5 bg-slate-900 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-slate-400 after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-600 peer-checked:after:bg-emerald-300 peer-disabled:opacity-40" />
              <div className={!settings.firestoreSyncEnabled ? 'opacity-40' : ''}>
                <span className="text-xs font-bold text-slate-300 font-sans group-hover:text-slate-100 transition-colors">
                  Periodic Save (10s)
                </span>
                <span className="text-[8px] text-slate-500 font-mono block leading-none mt-0.5">
                  Autosave device logs
                </span>
              </div>
            </label>
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
          
          {/* Tabs header */}
          <div className="flex border border-slate-900 bg-slate-950/40 p-1 rounded-xl">
            <button
              id="tab-conn-cloud"
              type="button"
              onClick={() => setActiveTab('cloud')}
              className={`flex-1 py-1.5 text-center rounded-lg text-[10px] uppercase tracking-wider font-bold transition-all duration-150 cursor-pointer ${
                activeTab === 'cloud'
                  ? 'bg-slate-900 text-cyan-400 border border-cyan-500/10 shadow-[0_0_10px_rgba(0,255,208,0.1)]'
                  : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              Cloud Sync (Firestore DB)
            </button>
            <button
              id="tab-conn-local"
              type="button"
              onClick={() => setActiveTab('local')}
              className={`flex-1 py-1.5 text-center rounded-lg text-[10px] uppercase tracking-wider font-bold transition-all duration-150 cursor-pointer ${
                activeTab === 'local'
                  ? 'bg-slate-900 text-cyan-400 border border-cyan-500/10 shadow-[0_0_10px_rgba(0,255,208,0.1)]'
                  : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              Local LAN (Direct HTTP)
            </button>
          </div>

          {activeTab === 'cloud' ? (
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
                    <span className="text-emerald-400 font-bold">POST</span> <span className="text-slate-300">https://firestore.googleapis.com/v1/projects/{firebaseConfig.projectId || 'kitten-smarthome'}/databases/{settings.firestoreDatabaseTarget === 'custom' ? (firebaseConfig.firestoreDatabaseId || '(default)') : '(default)'}/documents/telemetry</span>
                    <span className="text-slate-500 block text-[9px] mt-0.5">Push real-time sensor parameters (temp, motion)</span>
                  </div>
                  <div>
                    <span className="text-cyan-400 font-bold">GET</span> <span className="text-slate-300">https://firestore.googleapis.com/v1/projects/{firebaseConfig.projectId || 'kitten-smarthome'}/databases/{settings.firestoreDatabaseTarget === 'custom' ? (firebaseConfig.firestoreDatabaseId || '(default)') : '(default)'}/documents/control/esp32</span>
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
                    onClick={() => handleCopyCode(`/*
  Kitten Smart Home - ESP32 Firestore Integration Sketch
  Requires the "ArduinoJson" library by Benoit Blanchon.
  Install it via the Arduino Library Manager in Arduino IDE.
*/

#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>

// WiFi Credentials
const char* ssid = "YOUR_WIFI_SSID";
const char* password = "YOUR_WIFI_PASSWORD";

// Firebase Configurations (Dynamically Configured from Active Database Target)
const char* projectId = "${firebaseConfig.projectId || 'kitten-smarthome'}";
const char* databaseId = "${settings.firestoreDatabaseTarget === 'custom' ? (firebaseConfig.firestoreDatabaseId || '(default)') : '(default)'}";

// Hardware Pins (Adjust to your actual wiring)
const int LED_PIN = 12;      // PWM Pin for LED Brightness
const int FAN_PIN = 13;      // PWM Pin for Fan Speed Control
const int TEMP_PIN = 34;     // Analog sensor pin (e.g., LM35 or thermistor)
const int MOTION_PIN = 27;   // PIR Motion sensor pin

// Timing Trackers
unsigned long lastTelemetryTime = 0;
const unsigned long telemetryInterval = 5000; // Publish telemetry every 5 seconds
unsigned long lastControlCheckTime = 0;
const unsigned long controlInterval = 2000;  // Fetch controls every 2 seconds

void setup() {
  Serial.begin(115200);
  
  pinMode(LED_PIN, OUTPUT);
  pinMode(FAN_PIN, OUTPUT);
  pinMode(MOTION_PIN, INPUT);

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
  HTTPClient http;
  
  // Construct Firestore REST Document Endpoint
  String url = "https://firestore.googleapis.com/v1/projects/";
  url += projectId;
  url += "/databases/";
  url += databaseId;
  url += "/documents/control/esp32";

  http.begin(url);
  int httpResponseCode = http.GET();

  if (httpResponseCode == 200) {
    String payload = http.getString();
    
    // Parse JSON
    DynamicJsonDocument doc(1024);
    DeserializationError error = deserializeJson(doc, payload);

    if (!error) {
      // Decode Firestore-specific typed fields
      int ledVal = doc["fields"]["led"]["integerValue"].as<int>();
      int fanVal = doc["fields"]["fan"]["integerValue"].as<int>();
      bool autoMode = doc["fields"]["auto"]["booleanValue"].as<bool>();

      Serial.printf("Decoded - LED Brightness: %d%%, Fan Speed: %d, Auto: %s\\n", 
                    ledVal, fanVal, autoMode ? "ON" : "OFF");

      // Set hardware outputs
      // Translate led 0-100% to ESP32 PWM 0-255
      analogWrite(LED_PIN, map(ledVal, 0, 100, 0, 255));
      
      // Translate fan level (0-3) to ESP32 PWM
      int fanPWM = 0;
      if (fanVal == 1) fanPWM = 85;
      else if (fanVal == 2) fanPWM = 170;
      else if (fanVal == 3) fanPWM = 255;
      analogWrite(FAN_PIN, fanPWM);
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
  HTTPClient http;
  
  // Construct Firestore REST Post Endpoint
  String url = "https://firestore.googleapis.com/v1/projects/";
  url += projectId;
  url += "/databases/";
  url += databaseId;
  url += "/documents/telemetry";

  http.begin(url);
  http.addHeader("Content-Type", "application/json");

  // Read actual sensors
  float tempVal = (analogRead(TEMP_PIN) * 3.3 / 4095.0) * 100.0; // Scaled temperature
  bool motionVal = digitalRead(MOTION_PIN) == HIGH;

  // Build Firestore typed fields structure
  DynamicJsonDocument doc(1024);
  JsonObject fields = doc.createNestedObject("fields");

  JsonObject tempObj = fields.createNestedObject("temperature");
  tempObj["doubleValue"] = tempVal;

  JsonObject motionObj = fields.createNestedObject("motion");
  motionObj["booleanValue"] = motionVal;

  JsonObject ledObj = fields.createNestedObject("led");
  ledObj["integerValue"] = 50; // Replace with actual current states if needed

  JsonObject fanObj = fields.createNestedObject("fan");
  fanObj["integerValue"] = 1;

  JsonObject autoObj = fields.createNestedObject("auto");
  autoObj["booleanValue"] = true;

  String jsonString;
  serializeJson(doc, jsonString);

  int httpResponseCode = http.POST(jsonString);

  if (httpResponseCode == 200 || httpResponseCode == 201) {
    Serial.println("[Firestore] Telemetry updated successfully!");
  } else {
    Serial.printf("POST telemetry failed, HTTP: %d\\n", httpResponseCode);
  }
  http.end();
}`)}
                    className="px-2 py-1 bg-slate-900 hover:bg-slate-800 text-cyan-400 border border-slate-800 rounded-lg text-[9px] flex items-center gap-1 cursor-pointer transition-all active:scale-95"
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
                    {`/*
  Kitten Smart Home - ESP32 Firestore Integration Sketch
  Requires the "ArduinoJson" library by Benoit Blanchon.
  Install it via the Arduino Library Manager in Arduino IDE.
*/

#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>

// WiFi Credentials
const char* ssid = "YOUR_WIFI_SSID";
const char* password = "YOUR_WIFI_PASSWORD";

// Firebase Configurations
const char* projectId = "${firebaseConfig.projectId || 'kitten-smarthome'}";
const char* databaseId = "${settings.firestoreDatabaseTarget === 'custom' ? (firebaseConfig.firestoreDatabaseId || '(default)') : '(default)'}";

// Hardware Pins (Adjust to your actual wiring)
const int LED_PIN = 12;      // PWM Pin for LED Brightness
const int FAN_PIN = 13;      // PWM Pin for Fan Speed Control
const int TEMP_PIN = 34;     // Analog sensor pin (e.g., LM35 or thermistor)
const int MOTION_PIN = 27;   // PIR Motion sensor pin

// Timing Trackers
unsigned long lastTelemetryTime = 0;
const unsigned long telemetryInterval = 5000; // Publish telemetry every 5 seconds
unsigned long lastControlCheckTime = 0;
const unsigned long controlInterval = 2000;  // Fetch controls every 2 seconds

void setup() {
  Serial.begin(115200);
  
  pinMode(LED_PIN, OUTPUT);
  pinMode(FAN_PIN, OUTPUT);
  pinMode(MOTION_PIN, INPUT);

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
  HTTPClient http;
  
  // Construct Firestore REST Document Endpoint
  String url = "https://firestore.googleapis.com/v1/projects/";
  url += projectId;
  url += "/databases/";
  url += databaseId;
  url += "/documents/control/esp32";

  http.begin(url);
  int httpResponseCode = http.GET();

  if (httpResponseCode == 200) {
    String payload = http.getString();
    
    // Parse JSON
    DynamicJsonDocument doc(1024);
    DeserializationError error = deserializeJson(doc, payload);

    if (!error) {
      // Decode Firestore-specific typed fields
      int ledVal = doc["fields"]["led"]["integerValue"].as<int>();
      int fanVal = doc["fields"]["fan"]["integerValue"].as<int>();
      bool autoMode = doc["fields"]["auto"]["booleanValue"].as<bool>();

      Serial.printf("Decoded - LED Brightness: %d%%, Fan Speed: %d, Auto: %s\\n", 
                    ledVal, fanVal, autoMode ? "ON" : "OFF");

      // Set hardware outputs
      // Translate led 0-100% to ESP32 PWM 0-255
      analogWrite(LED_PIN, map(ledVal, 0, 100, 0, 255));
      
      // Translate fan level (0-3) to ESP32 PWM
      int fanPWM = 0;
      if (fanVal == 1) fanPWM = 85;
      else if (fanVal == 2) fanPWM = 170;
      else if (fanVal == 3) fanPWM = 255;
      analogWrite(FAN_PIN, fanPWM);
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
  HTTPClient http;
  
  // Construct Firestore REST Post Endpoint
  String url = "https://firestore.googleapis.com/v1/projects/";
  url += projectId;
  url += "/databases/";
  url += databaseId;
  url += "/documents/telemetry";

  http.begin(url);
  http.addHeader("Content-Type", "application/json");

  // Read actual sensors
  float tempVal = (analogRead(TEMP_PIN) * 3.3 / 4095.0) * 100.0; // Scaled temperature
  bool motionVal = digitalRead(MOTION_PIN) == HIGH;

  // Build Firestore typed fields structure
  DynamicJsonDocument doc(1024);
  JsonObject fields = doc.createNestedObject("fields");

  JsonObject tempObj = fields.createNestedObject("temperature");
  tempObj["doubleValue"] = tempVal;

  JsonObject motionObj = fields.createNestedObject("motion");
  motionObj["booleanValue"] = motionVal;

  JsonObject ledObj = fields.createNestedObject("led");
  ledObj["integerValue"] = 50; // Replace with actual current states if needed

  JsonObject fanObj = fields.createNestedObject("fan");
  fanObj["integerValue"] = 1;

  JsonObject autoObj = fields.createNestedObject("auto");
  autoObj["booleanValue"] = true;

  String jsonString;
  serializeJson(doc, jsonString);

  int httpResponseCode = http.POST(jsonString);

  if (httpResponseCode == 200 || httpResponseCode == 201) {
    Serial.println("[Firestore] Telemetry updated successfully!");
  } else {
    Serial.printf("POST telemetry failed, HTTP: %d\\n", httpResponseCode);
  }
  http.end();
}`}
                  </pre>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              <div className="flex items-start gap-2.5 p-3 rounded-xl border border-cyan-500/10 bg-cyan-950/5">
                <BookOpen className="w-5 h-5 text-cyan-400 shrink-0 mt-0.5" />
                <div>
                  <span className="text-xs font-bold text-slate-200 block mb-1">
                    ESP32 HTTP Routing Protocols
                  </span>
                  <span>
                    To connect your real hardware board directly, configure your ESP32 Arduino sketches
                    or MicroPython code to host a web server on port <strong className="text-cyan-400">80</strong>, implementing these exact endpoints:
                  </span>
                </div>
              </div>

              <div className="bg-slate-950/80 p-3 rounded-xl border border-slate-900 flex flex-col gap-1.5 select-all font-mono text-[10px]">
                <div>
                  <span className="text-cyan-400 font-bold">GET /data</span>
                  <span className="text-slate-500"> - Returns live sensor JSON structure</span>
                </div>
                <div>
                  <span className="text-cyan-400 font-bold">GET /led?value=X</span>
                  <span className="text-slate-500"> - Configures LED level (0-255)</span>
                </div>
                <div>
                  <span className="text-cyan-400 font-bold">GET /fan?value=Y</span>
                  <span className="text-slate-500"> - Sets ventilation speed (0-255)</span>
                </div>
                <div>
                  <span className="text-cyan-400 font-bold">GET /auto</span>
                  <span className="text-slate-500"> - Toggles smart auto profile engine</span>
                </div>
                <div>
                  <span className="text-cyan-400 font-bold">GET /voice</span>
                  <span className="text-slate-500"> - Triggers the ESP32 vocal mic record</span>
                </div>
              </div>

              <div className="flex items-start gap-2.5 p-3 rounded-xl border border-amber-500/10 bg-amber-950/5">
                <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                <div>
                  <span className="text-xs font-bold text-slate-200 block mb-1">
                    Bypassing Browser Insecure Content (CORS / Mixed Content)
                  </span>
                  <span className="block mb-2 text-[10.5px]">
                    Because this website loads over <strong className="text-slate-200">HTTPS (Secure)</strong>, browsers will automatically block XMLHttpRequests to <strong className="text-slate-200">HTTP (Insecure)</strong> local IP addresses like <code className="text-amber-400 font-mono bg-amber-950/30 px-1 py-0.5 rounded">http://192.168.x.x</code> due to <strong>Mixed Content Security Policies</strong>.
                  </span>
                  
                  <span className="font-bold text-slate-300 block mb-1">Workarounds to connect real hardware:</span>
                  <ul className="list-decimal pl-4 flex flex-col gap-1 text-[10px]">
                    <li>
                      <strong>Open in New Tab & Run Insecure</strong>: Click the 'Open in new tab' button in AI Studio, click the browser lock icon next to the address bar, choose <strong>Site Settings</strong>, and set <strong>Insecure Content</strong> to <strong>Allow</strong>.
                    </li>
                    <li>
                      <strong>Use CORS Extension</strong>: Install a browser extension like <em>"Allow CORS"</em> or <em>"CORS Unblock"</em> to allow local network requests.
                    </li>
                    <li>
                      <strong>CORS headers in ESP32</strong>: Ensure your ESP32 server appends this CORS header to every HTTP response: 
                      <code className="block bg-slate-950 px-2 py-1 rounded text-[9px] text-cyan-300 border border-slate-900 mt-1 select-all">
                        server.sendHeader("Access-Control-Allow-Origin", "*");
                      </code>
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          )}
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
