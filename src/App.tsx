/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useRef } from 'react';
import {
  ESP32Data,
  SystemHealthMetrics,
  ActivityLog,
  HistoryDataPoint,
  DashboardSettings,
} from './types';
import {
  initialESPState,
  initialSystemHealth,
  initialLogs,
  generateInitialHistory,
  createLog,
  calculateComfortScore,
} from './mockData';
import { saveTelemetry, getRecentTelemetry, subscribeToLatestTelemetry, setFirestoreDatabaseTarget, pruneOldTelemetry, saveControlState, getControlState } from './lib/firebase';

// Component imports
import Header from './components/Header';
import EnvironmentSection from './components/EnvironmentSection';
import LightingControl from './components/LightingControl';
import FanControl from './components/FanControl';
import VoiceAssistant from './components/VoiceAssistant';
import AutomationSection from './components/AutomationSection';
import AnalyticsSection from './components/AnalyticsSection';
import ActivityFeed from './components/ActivityFeed';
import SystemHealth from './components/SystemHealth';
import SettingsPanel from './components/SettingsPanel';
import MediaControlSection from './components/MediaControlSection';

// Icons
import { Settings, BookOpen, Sparkles, RefreshCw, X } from 'lucide-react';
import firebaseConfig from '../firebase-applet-config.json';

export default function App() {
  // 1. Initial configuration load from localStorage (or defaults)
  const [settings, setSettings] = useState<DashboardSettings>(() => {
    const saved = localStorage.getItem('kitten_settings');
    const defaultDbTarget = 'custom';
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return {
          firestoreSyncEnabled: true,
          firestoreAutoSaveTicks: true,
          ...parsed,
          firestoreDatabaseTarget: 'custom',
        };
      } catch (e) {
        // use default
      }
    }
    return {
      espIpAddress: '',
      refreshRateMs: 1000,
      simulationMode: true,
      voiceSensitivity: 5,
      notificationsEnabled: true,
      lowLightMode: false,
      themeColor: 'cyan',
      firestoreSyncEnabled: true,
      firestoreAutoSaveTicks: true,
      firestoreDatabaseTarget: defaultDbTarget,
    };
  });

  // Sync the selected Firestore database target to the Firebase driver
  useEffect(() => {
    setFirestoreDatabaseTarget(settings.firestoreDatabaseTarget || 'default');
  }, [settings.firestoreDatabaseTarget]);

  // Automatically prune old database entries on startup to stay within free tier limits
  useEffect(() => {
    if (settings.firestoreSyncEnabled) {
      pruneOldTelemetry(100)
        .then((prunedCount) => {
          if (prunedCount > 0) {
            console.log(`[Firebase] Auto-pruned ${prunedCount} old telemetry entries on startup.`);
            addLog(`Database optimized: cleared ${prunedCount} older telemetry entries`, 'info');
          }
        })
        .catch((err) => {
          console.warn('[Firebase] Startup database pruning omitted:', err instanceof Error ? err.message : String(err));
        });
    }
  }, [settings.firestoreSyncEnabled]);

  // Save settings on change
  useEffect(() => {
    localStorage.setItem('kitten_settings', JSON.stringify(settings));
  }, [settings]);

  // 2. Main Live State buffers
  const [espData, setEspData] = useState<ESP32Data>(initialESPState);
  const [systemHealth, setSystemHealth] = useState<SystemHealthMetrics>(initialSystemHealth);
  const [logs, setLogs] = useState<ActivityLog[]>(initialLogs);
  const [historyData, setHistoryData] = useState<HistoryDataPoint[]>(() =>
    generateInitialHistory(initialESPState)
  );

  // UI state controllers
  const [isConnected, setIsConnected] = useState<boolean>(true);
  const [latency, setLatency] = useState<number | null>(null);
  const [isFetching, setIsFetching] = useState<boolean>(false);
  const [showSettingsModal, setShowSettingsModal] = useState<boolean>(false);
  const [showDocsModal, setShowDocsModal] = useState<boolean>(false);

  // References to keep state available inside polling callbacks
  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  const espDataRef = useRef(espData);
  espDataRef.current = espData;

  // Add Log Helper
  const addLog = (message: string, type: ActivityLog['type'] = 'info') => {
    const newLog = createLog(message, type);
    setLogs((prev) => {
      // Keep only last 500 logs to prevent overflow
      const combined = [...prev, newLog];
      if (combined.length > 500) {
        return combined.slice(combined.length - 500);
      }
      return combined;
    });

    // Handle standard browser alert triggers if active
    if (settings.notificationsEnabled && type === 'alert') {
      // Uses simple fallback badge alert
      console.log(`[KITTEN ALERT] ${message}`);
    }
  };

  // 2b. Firestore Live Sync & Initialization
  useEffect(() => {
    if (!settings.firestoreSyncEnabled) return;

    let isCancelled = false;
    let lastSeenId = '';

    // Load initial recent telemetry points from Firestore
    const initFirestoreData = async () => {
      try {
        addLog('[Cloud] Syncing historical logs & latest device registry...', 'info');
        const recentPoints = await getRecentTelemetry(15);
        if (isCancelled) return;

        if (recentPoints.length > 0) {
          setHistoryData(recentPoints);
          
          // Get the very latest point from our history (which was returned in chronological order)
          const latestPoint = recentPoints[recentPoints.length - 1];
          setEspData((prev) => ({
            ...prev,
            temperature: latestPoint.temperature,
            motion: latestPoint.motion === 1,
            led: latestPoint.led,
            fan: latestPoint.fan,
          }));
          addLog(`[Cloud] Successfully loaded ${recentPoints.length} state log data points into chart.`, 'success');
        } else {
          addLog('[Cloud] Telemetry collection is empty. Ready for new snapshots.', 'info');
        }

        // Fetch or initialize control state to prevent ESP32 404s
        const ctrlState = await getControlState();
        if (isCancelled) return;
        setEspData((prev) => ({
          ...prev,
          led: ctrlState.led !== undefined ? ctrlState.led : prev.led,
          fan: ctrlState.fan !== undefined ? ctrlState.fan : prev.fan,
          auto: ctrlState.auto !== undefined ? ctrlState.auto : prev.auto,
          voice: ctrlState.voice !== undefined ? ctrlState.voice : prev.voice,
        }));
        addLog('[Cloud] Control settings synced with database.', 'success');
      } catch (err) {
        addLog(`[Cloud] Failed to fetch initial data: ${(err as Error).message}`, 'warning');
      }
    };

    initFirestoreData();

    // Subscribe to real-time telemetry changes in Firestore
    const unsubscribe = subscribeToLatestTelemetry((latestData) => {
      if (isCancelled) return;

      // Skip if this is the exact same document ID we just saw or wrote
      if (latestData.id === lastSeenId) return;
      lastSeenId = latestData.id;

      // Telemetry strictly updates sensor readings (temperature & motion) to prevent feedback loops with control targets
      setEspData((prev) => ({
        ...prev,
        temperature: latestData.temperature,
        motion: latestData.motion,
      }));

      addLog(`[Cloud] Live Feed Sync: Received database telemetry (Temp: ${latestData.temperature}°C, Motion: ${latestData.motion ? 'Active' : 'Clear'})`, 'info');
    });

    return () => {
      isCancelled = true;
      unsubscribe();
    };
  }, [settings.firestoreSyncEnabled, settings.firestoreDatabaseTarget]);

  // 3. Command API dispatcher (GET endpoints to physical ESP32 or simulation state updates)
  const sendCommand = async (endpoint: string, stateUpdate: Partial<ESP32Data>, logMessage: string) => {
    setIsFetching(true);
    
    // Immediately apply to UI for instantaneous response feel
    setEspData((prev) => ({ ...prev, ...stateUpdate }));

    // Sync to Firestore if enabled
    if (settings.firestoreSyncEnabled) {
      const mergedState = { ...espDataRef.current, ...stateUpdate };

      saveControlState(mergedState)
        .then(() => {
          console.log('[Firestore] Control state synced successfully to control/esp32');
        })
        .catch((err) => {
          console.error('[Firestore] Failed to sync control state to Firestore:', err instanceof Error ? err.message : String(err));
        });

      // If Firestore Cloud Sync is active, the ESP32 pulls these settings, so do not perform direct local IP HTTP fetches.
      addLog(logMessage, 'success');
      setIsFetching(false);
      return;
    }

    if (settings.simulationMode) {
      // Local simulation execution
      addLog(logMessage, 'success');
      setIsFetching(false);
      return;
    }

    // Physical ESP32 connection execution
    if (!settings.espIpAddress) {
      addLog('Command aborted: No physical ESP32 IP address configured.', 'warning');
      setIsFetching(false);
      return;
    }

    const cleanIp = settings.espIpAddress.replace(/^https?:\/\//i, '').trim();
    const url = `http://${cleanIp}${endpoint}`;

    try {
      const startTime = performance.now();
      const response = await fetch(url, { mode: 'no-cors' }); // no-cors bypasses standard CORS block
      const endTime = performance.now();
      setLatency(Math.round(endTime - startTime));
      
      addLog(logMessage, 'success');
    } catch (err) {
      console.error('Physical send error:', err instanceof Error ? err.message : String(err));
      addLog(`Failed to communicate with ESP32 at: ${url}. (Check network / CORS policy).`, 'alert');
      setIsConnected(false);
    } finally {
      setIsFetching(false);
    }
  };

  // 4. Polling & Simulation Logic loop
  useEffect(() => {
    let intervalId: any = null;
    let localSecondsCount = 0;

    const runDataLoop = async () => {
      const currentSettings = settingsRef.current;
      const currentEspData = espDataRef.current;

      // --- SIMULATED MODE ENGINE ---
      if (currentSettings.simulationMode) {
        setIsConnected(true);
        localSecondsCount += currentSettings.refreshRateMs / 1000;

        // Fluctuating temperature based on current preset modes
        setEspData((prev) => {
          let tempTarget = prev.temperature;
          
          // Presets affect temperature target over time
          if (prev.fan > 150) {
            tempTarget -= 0.1; // fans cool down the room
          } else if (prev.led > 200) {
            tempTarget += 0.05; // bright LEDs heat up the room slightly
          }

          // Ambient baseline attraction
          const ambientBaseline = 24.5;
          if (tempTarget < ambientBaseline) tempTarget += 0.02;
          if (tempTarget > ambientBaseline) tempTarget -= 0.02;

          // Tiny random noise fluctuation
          const noise = (Math.random() - 0.5) * 0.15;
          const nextTemp = Math.max(16, Math.min(42, Math.round((tempTarget + noise) * 10) / 10));

          // AUTO AUTOMATION CONTROLS (If Auto mode is active, the simulator adjusts devices!)
          let nextLed = prev.led;
          let nextFan = prev.fan;

          if (prev.auto) {
            // Cool down if hot
            if (nextTemp >= 30 && prev.fan < 180) {
              nextFan = 180;
              addLog('Auto AI: Room is hot (>=30°C). Overclocking climate ventilation to 70%.', 'info');
            } else if (nextTemp < 24 && prev.fan > 60) {
              nextFan = 60;
              addLog('Auto AI: Thermal comfortable levels restored. Lowering ventilation.', 'info');
            }

            // Save energy if room is occupied but comfortable
            if (prev.motion && prev.led < 100) {
              nextLed = 120;
              addLog('Auto AI: Occupancy registered in dark room. Engaging 45% LED brightness.', 'info');
            }
          }

          // Motion occurrence simulator (random PIR motion triggers every 25s)
          let nextMotion = prev.motion;
          if (Math.random() > 0.96) {
            nextMotion = !prev.motion;
            addLog(nextMotion ? 'Room sensor registered physical movement.' : 'No room motion detected for 120s.', nextMotion ? 'warning' : 'info');
          }

          return {
            ...prev,
            temperature: nextTemp,
            motion: nextMotion,
            led: nextLed,
            fan: nextFan,
          };
        });

        // Update system hardware statistics
        setSystemHealth((prev) => ({
          ...prev,
          uptimeSeconds: prev.uptimeSeconds + Math.round(currentSettings.refreshRateMs / 1000),
          cpuUsage: Math.max(8, Math.min(95, Math.round(15 + Math.sin(localSecondsCount / 10) * 12 + (currentEspData.auto ? 25 : 0)))),
          wifiSignal: Math.max(-85, Math.min(-35, Math.round(-55 + Math.sin(localSecondsCount / 100) * 8))),
          sensorStatus: 'OK',
        }));

        // Insert new history data point for the graphs
        setHistoryData((prev) => {
          const now = new Date();
          const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
          const newPoint: HistoryDataPoint = {
            time: timeStr,
            temperature: espDataRef.current.temperature,
            motion: espDataRef.current.motion ? 1 : 0,
            led: espDataRef.current.led,
            fan: espDataRef.current.fan,
          };
          
          // Limit to last 15 ticks
          const nextHistory = [...prev, newPoint];
          if (nextHistory.length > 15) {
            return nextHistory.slice(nextHistory.length - 15);
          }
          return nextHistory;
        });

        setLatency(1); // minimal simulation latency
      }
      
      // --- PHYSICAL ESP32 REAL NETWORK POLLING ---
      else {
        if (currentSettings.firestoreSyncEnabled) {
          // Bypasses browser-to-local HTTP direct requests to prevent CORS / Mixed Content block.
          // Real-time telemetry is synced via the Firestore snapshot subscription instead.
          setIsConnected(true);
          setLatency(220); // Average Firestore sync latency

          // Populate system health incrementally
          setSystemHealth((prev) => ({
            ...prev,
            uptimeSeconds: prev.uptimeSeconds + Math.round(currentSettings.refreshRateMs / 1000),
            sensorStatus: 'OK',
          }));

          // Save history trace using current state synced from Firestore
          setHistoryData((prev) => {
            const now = new Date();
            const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
            const data = espDataRef.current;
            const newPoint: HistoryDataPoint = {
              time: timeStr,
              temperature: data.temperature,
              motion: data.motion ? 1 : 0,
              led: data.led,
              fan: data.fan,
            };
            const nextHistory = [...prev, newPoint];
            if (nextHistory.length > 15) {
              return nextHistory.slice(nextHistory.length - 15);
            }
            return nextHistory;
          });
        } else {
          // Fallback direct HTTP polling (only used if Cloud Sync is toggled off)
          if (!currentSettings.espIpAddress) {
            setIsConnected(false);
            return;
          }

          const cleanIp = currentSettings.espIpAddress.replace(/^https?:\/\//i, '').trim();
          const url = `http://${cleanIp}/data`;

          try {
            const startTime = performance.now();
            const res = await fetch(url);
            const endTime = performance.now();
            
            if (res.ok) {
              const data: ESP32Data = await res.json();
              setEspData(data);
              setIsConnected(true);
              setLatency(Math.round(endTime - startTime));

              // Populate system health incrementally
              setSystemHealth((prev) => ({
                ...prev,
                uptimeSeconds: prev.uptimeSeconds + Math.round(currentSettings.refreshRateMs / 1000),
                sensorStatus: 'OK',
              }));

              // Save history trace
              setHistoryData((prev) => {
                const now = new Date();
                const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
                const newPoint: HistoryDataPoint = {
                  time: timeStr,
                  temperature: data.temperature,
                  motion: data.motion ? 1 : 0,
                  led: data.led,
                  fan: data.fan,
                };
                const nextHistory = [...prev, newPoint];
                if (nextHistory.length > 15) {
                  return nextHistory.slice(nextHistory.length - 15);
                }
                return nextHistory;
              });
            }
          } catch (err) {
            if (isConnected) {
              addLog(`Lost connection to ESP32 board at: ${url}. Checking status...`, 'alert');
              setIsConnected(false);
              setLatency(null);
            }
          }
        }
      }

      // Removed browser-triggered periodic telemetry snapshot upload.
      // Telemetry must originate strictly from the physical ESP32 to prevent simulated data pollution.
    };

    // Run first immediately, then set interval
    runDataLoop();
    intervalId = setInterval(runDataLoop, settings.refreshRateMs);

    return () => {
      clearInterval(intervalId);
    };
  }, [settings.refreshRateMs, settings.simulationMode, isConnected]);

  // Controls Adjustments dispatch wrappers
  const handleLedChange = (val: number) => {
    sendCommand(`/led?value=${val}`, { led: val, auto: false }, `LED brightness set to ${val} (${Math.round((val/255)*100)}%) [Manual Mode].`);
  };

  const handleFanChange = (val: number) => {
    sendCommand(`/fan?value=${val}`, { fan: val, auto: false }, `Climate fan set to ${val > 0 ? 'ON' : 'OFF'} [Manual Mode].`);
  };

  const handleVoiceButtonTrigger = () => {
    sendCommand('/voice', { voice: true }, 'Activated vocal microphone listen cycle.');
  };

  const handlePresetSelect = (updates: Partial<ESP32Data>, logMsg: string) => {
    // Send corresponding commands
    let endpoint = '/auto';
    if (updates.auto === false) {
      endpoint = `/led?value=${updates.led ?? 120}`;
    }
    sendCommand(endpoint, updates, logMsg);
  };

  const handleVoiceCommandAction = (updates: Partial<ESP32Data>, logMsg: string) => {
    setEspData((prev) => ({ ...prev, ...updates }));
    addLog(logMsg, 'success');
  };

  return (
    <div className={`min-h-screen pb-16 flex flex-col ${settings.lowLightMode ? 'brightness-90 saturate-75' : ''}`}>
      {/* 1. Header component */}
      <Header
        isConnected={isConnected}
        settings={settings}
        setSettings={setSettings}
        latency={latency}
        onOpenSettings={() => setShowSettingsModal(true)}
        onOpenDocs={() => setShowDocsModal(true)}
      />

      {/* Main Grid Content Area */}
      <main className="max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 mt-6 flex-grow flex flex-col gap-6">
        {/* Dynamic Warning for Config offline alerts */}
        {!isConnected && !settings.simulationMode && (
          <div className="flex items-center justify-between p-4 rounded-xl border border-rose-500/20 bg-rose-950/15 text-rose-400 font-mono text-xs animate-pulse shadow-[0_0_15px_rgba(239,68,68,0.1)]">
            <div className="flex items-center gap-2.5">
              <span className="w-2 h-2 rounded-full bg-rose-500" />
              <span>
                <strong>CRITICAL:</strong> Physical ESP32 target is offline. Currently attempting connection at{' '}
                <code className="bg-slate-950 px-1.5 py-0.5 rounded text-white">{settings.espIpAddress || 'None'}</code>.
              </span>
            </div>
            <button
              id="btn-offline-toggle-simulation"
              onClick={() => setSettings((prev) => ({ ...prev, simulationMode: true }))}
              className="px-3 py-1.5 rounded-lg bg-rose-500/20 text-white font-bold uppercase tracking-wider hover:bg-rose-500/40 transition-colors cursor-pointer"
            >
              Run Simulator
            </button>
          </div>
        )}

        {/* Cyber Bento Layout */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* COLUMN 1: Environment & Climate Hardware Controls */}
          <div className="md:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-6">
            {/* Environment Climate Telemetry */}
            <EnvironmentSection data={espData} />

            {/* Lighting Slider Control */}
            <LightingControl
              data={espData}
              onLedChange={handleLedChange}
              isLoading={isFetching}
            />

            {/* Fan Slider Control */}
            <FanControl
              data={espData}
              onFanChange={handleFanChange}
              isLoading={isFetching}
            />

            {/* Preloaded Automation Presets */}
            <AutomationSection
              data={espData}
              onPresetSelect={handlePresetSelect}
              isLoading={isFetching}
            />
          </div>

          {/* COLUMN 2: Intelligent Assistant / Subsystem diagnostics */}
          <div className="flex flex-col gap-6">
            {/* KITTEN Verbal Command Controller */}
            <VoiceAssistant
              data={espData}
              onVoiceTrigger={handleVoiceButtonTrigger}
              onCommandTriggered={handleVoiceCommandAction}
              addLog={(newLog) => setLogs((prev) => [...prev, newLog])}
              isLoading={isFetching}
            />

            {/* Hardware statistics monitor */}
            <SystemHealth metrics={systemHealth} />
          </div>

          {/* Media Player Streaming Hub */}
          <MediaControlSection
            currentData={espData}
            addLog={addLog}
          />

          {/* COLUMN 3 (Full Span Row): Time-Series Analytics Charts & Logging Terminal */}
          <div className="md:col-span-3 grid grid-cols-1 md:grid-cols-5 gap-6">
            {/* Recharts Analytics graphs */}
            <AnalyticsSection historyData={historyData} />

            {/* Audit log terminal list */}
            <ActivityFeed logs={logs} onClearLogs={() => setLogs([])} />
          </div>
        </div>
      </main>

      {/* FOOTER credit and stats */}
      <footer className="max-w-7xl w-full mx-auto px-4 text-center mt-12 text-[10px] font-mono text-slate-600 flex items-center justify-between border-t border-slate-900/40 pt-4">
        <div>
          <span>KITTEN ROOM MONITOR SYSTEM // PROJECT SECURE DEPLOYMENT</span>
        </div>
        <div>
          <span>DEV_URL_NODE: AIS-3000-SECURE</span>
        </div>
      </footer>

      {/* --- MODAL DIALOGS --- */}

      {/* 1. CONFIGURATION SETTINGS PANEL MODAL */}
      {showSettingsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm transition-all duration-300">
          <div className="relative max-w-xl w-full max-h-[90vh] overflow-y-auto rounded-2xl p-1 bg-gradient-to-br from-blue-600 to-cyan-400 shadow-[0_0_40px_rgba(0,119,255,0.3)]">
            <div className="bg-slate-950 rounded-2xl p-6 flex flex-col gap-5">
              <div className="flex items-center justify-between border-b border-slate-900 pb-3">
                <div className="flex items-center gap-2">
                  <Settings className="w-5 h-5 text-cyan-400" />
                  <h2 className="text-sm font-bold tracking-widest font-sans uppercase text-slate-100">
                    Dashboard Settings
                  </h2>
                </div>
                <button
                  id="btn-close-settings-modal-top"
                  onClick={() => setShowSettingsModal(false)}
                  className="p-1 rounded-lg border border-slate-900 bg-slate-950 hover:bg-slate-900 text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Mounted Panel */}
              <SettingsPanel
                settings={settings}
                onSaveSettings={setSettings}
                onClose={() => setShowSettingsModal(false)}
              />
            </div>
          </div>
        </div>
      )}

      {/* 2. DEVELOPER DOCUMENTATION MODAL */}
      {showDocsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm transition-all duration-300">
          <div className="relative max-w-2xl w-full max-h-[85vh] overflow-y-auto rounded-2xl p-[1px] bg-gradient-to-br from-cyan-400 to-purple-600 shadow-[0_0_40px_rgba(0,255,208,0.25)]">
            <div className="bg-slate-950 rounded-2xl p-6 flex flex-col gap-5">
              <div className="flex items-center justify-between border-b border-slate-900 pb-3">
                <div className="flex items-center gap-2">
                  <BookOpen className="w-5 h-5 text-cyan-400" />
                  <h2 className="text-sm font-bold tracking-widest font-sans uppercase text-slate-100">
                    ESP32 Integration Playbook
                  </h2>
                </div>
                <button
                  id="btn-close-docs-modal-top"
                  onClick={() => setShowDocsModal(false)}
                  className="p-1 rounded-lg border border-slate-900 bg-slate-950 hover:bg-slate-900 text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="font-mono text-xs text-slate-400 leading-relaxed flex flex-col gap-4">
                <p>
                  This responsive control board communicates with any networked ESP32 / ESP8266 node using standard HTTP JSON APIs.
                </p>

                <div className="border-l-2 border-cyan-400 pl-3">
                  <h4 className="font-bold text-slate-200 mb-1">Arduino Server Implementation Example:</h4>
                  <pre className="bg-slate-950 border border-slate-900 rounded-lg p-3 max-h-60 overflow-y-auto font-mono text-[9px] text-cyan-300 select-all scrollbar-thin">
{`#include <WiFi.h>
#include <WebServer.h>
#include <ArduinoJson.h>

WebServer server(80);

// Default Sensor registers
int tempVal = 28;
bool motionFlag = false;
int ledLevel = 120;
int fanSpeed = 80;
bool voiceRequest = false;
bool autoStatus = false;

void handleData() {
  // Return JSON telemetry
  JsonDocument doc;
  doc["temperature"] = tempVal;
  doc["motion"] = motionFlag;
  doc["led"] = ledLevel;
  doc["fan"] = fanSpeed;
  doc["voice"] = voiceRequest;
  doc["auto"] = autoStatus;

  String output;
  serializeJson(doc, output);
  
  server.sendHeader("Access-Control-Allow-Origin", "*");
  server.send(200, "application/json", output);
}

void handleLed() {
  if (server.hasArg("value")) {
    ledLevel = server.arg("value").toInt();
    analogWrite(4, ledLevel); // control transistor/RGB pin
  }
  server.sendHeader("Access-Control-Allow-Origin", "*");
  server.send(200, "text/plain", "OK");
}

void handleFan() {
  if (server.hasArg("value")) {
    fanSpeed = server.arg("value").toInt();
    analogWrite(5, fanSpeed); // cooling fan motor driver
  }
  server.sendHeader("Access-Control-Allow-Origin", "*");
  server.send(200, "text/plain", "OK");
}

void handleAuto() {
  autoStatus = !autoStatus;
  server.sendHeader("Access-Control-Allow-Origin", "*");
  server.send(200, "text/plain", "OK");
}

void handleVoice() {
  voiceRequest = true;
  server.sendHeader("Access-Control-Allow-Origin", "*");
  server.send(200, "text/plain", "OK");
}

void setup() {
  WiFi.begin("SSID", "PASSWORD");
  // ... connection loop ...
  
  server.on("/data", handleData);
  server.on("/led", handleLed);
  server.on("/fan", handleFan);
  server.on("/auto", handleAuto);
  server.on("/voice", handleVoice);
  server.begin();
}`}
                  </pre>
                </div>

                <div className="flex items-center gap-1 text-[10px] text-amber-400 bg-amber-950/10 border border-amber-500/10 rounded-lg p-2.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-ping" />
                  <span>NOTE: Ensure your home computer or mobile device running this dashboard is connected to the exact same Wi-Fi SSID router as your ESP32 controller!</span>
                </div>
              </div>

              <button
                id="btn-close-docs-modal"
                onClick={() => setShowDocsModal(false)}
                className="w-full bg-slate-900 border border-slate-800 text-slate-300 font-bold text-xs uppercase tracking-wider py-3 rounded-xl font-mono hover:bg-slate-850 hover:text-white transition-all cursor-pointer"
              >
                GOT IT
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
