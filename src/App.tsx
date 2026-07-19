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
import HumidifierControl from './components/HumidifierControl';
import VoiceAssistant from './components/VoiceAssistant';
import AutomationSection from './components/AutomationSection';
import AnalyticsSection from './components/AnalyticsSection';
import ActivityFeed from './components/ActivityFeed';
import SystemHealth from './components/SystemHealth';
import SettingsPanel from './components/SettingsPanel';
import WeatherModal from './components/WeatherModal';
import KittenSwearModal from './components/KittenSwearModal';
import CreativeModesOverlay from './components/CreativeModesOverlay';
import HiddenTaskTracker from './components/HiddenTaskTracker';

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
  const [espData, setEspData] = useState<ESP32Data>(() => {
    const saved = localStorage.getItem('kitten_settings');
    let isSimMode = true;
    if (saved) {
      try {
        isSimMode = JSON.parse(saved).simulationMode !== false;
      } catch (e) {}
    }
    return isSimMode ? initialESPState : { ...initialESPState, temperature: null };
  });
  const [systemHealth, setSystemHealth] = useState<SystemHealthMetrics>(initialSystemHealth);
  const [logs, setLogs] = useState<ActivityLog[]>(initialLogs);
  const [historyData, setHistoryData] = useState<HistoryDataPoint[]>(() => {
    const saved = localStorage.getItem('kitten_settings');
    let isSimMode = true;
    if (saved) {
      try {
        isSimMode = JSON.parse(saved).simulationMode !== false;
      } catch (e) {}
    }
    return generateInitialHistory(isSimMode ? initialESPState : { ...initialESPState, temperature: null });
  });

  // Usual Arrival Time Scheduler State
  const [arrivalSchedule, setArrivalSchedule] = useState(() => {
    const saved = localStorage.getItem('kitten_arrival_schedule');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {}
    }
    return {
      enabled: false,
      type: 'school' as 'school' | 'office' | 'custom',
      time: '15:30', // Default (3:30 PM)
    };
  });

  // Save arrival schedule on change
  useEffect(() => {
    localStorage.setItem('kitten_arrival_schedule', JSON.stringify(arrivalSchedule));
  }, [arrivalSchedule]);

  // Ultrasonic Humidifier Water Level state (0-100)
  const [waterLevel, setWaterLevel] = useState<number>(() => {
    const saved = localStorage.getItem('humidifier_water_level');
    return saved !== null ? parseInt(saved, 10) : 85;
  });

  const handleRefillWater = () => {
    setWaterLevel(100);
    localStorage.setItem('humidifier_water_level', '100');
    addLog('Humidifier water reservoir successfully replenished with purified water.', 'success');
  };

  // AI Trend Analyzer States
  const [trendConsecutiveDays, setTrendConsecutiveDays] = useState<number>(() => {
    return Number(localStorage.getItem('kitten_trend_days') || '0');
  });
  const [trendMissedDays, setTrendMissedDays] = useState<number>(() => {
    return Number(localStorage.getItem('kitten_trend_missed') || '0');
  });
  const [learnedTime, setLearnedTime] = useState<string | null>(() => {
    return localStorage.getItem('kitten_learned_time') || null;
  });

  const isTrendRuleActive = trendConsecutiveDays >= 3;

  useEffect(() => {
    localStorage.setItem('kitten_trend_days', String(trendConsecutiveDays));
  }, [trendConsecutiveDays]);

  useEffect(() => {
    localStorage.setItem('kitten_trend_missed', String(trendMissedDays));
  }, [trendMissedDays]);

  useEffect(() => {
    if (learnedTime) {
      localStorage.setItem('kitten_learned_time', learnedTime);
    } else {
      localStorage.removeItem('kitten_learned_time');
    }
  }, [learnedTime]);

  const formatTime12h = (timeStr: string | null): string => {
    if (!timeStr) return '';
    const [hStr, mStr] = timeStr.split(':');
    const h = parseInt(hStr, 10);
    const m = parseInt(mStr, 10);
    if (isNaN(h) || isNaN(m)) return timeStr;
    const ampm = h >= 12 ? 'PM' : 'AM';
    const displayH = h % 12 === 0 ? 12 : h % 12;
    const displayM = m < 10 ? `0${m}` : m;
    return `${displayH}:${displayM} ${ampm}`;
  };

  const handleSimulateTrendEntry = (timeStr: string) => {
    setTrendMissedDays(0);
    const displayTime = formatTime12h(timeStr);

    if (trendConsecutiveDays === 0 || !learnedTime) {
      setLearnedTime(timeStr);
      setTrendConsecutiveDays(1);
      addLog(`[AI Trend] Day 1: New entry routine candidate registered at ${displayTime}. Need to enter around this time for 2 more days to form a rule.`, 'info');
    } else {
      // Parse times to find shortest distance in minutes
      const [h1, m1] = timeStr.split(':').map(Number);
      const [h2, m2] = learnedTime.split(':').map(Number);
      const t1 = h1 * 60 + m1;
      const t2 = h2 * 60 + m2;
      const rawDiff = Math.abs(t1 - t2);
      const diff = Math.min(rawDiff, 1440 - rawDiff);

      if (diff <= 60) {
        // Entries within 1 hour matching range
        setTrendConsecutiveDays((prev) => {
          const next = Math.min(4, prev + 1);
          if (next === 3) {
            addLog(`[AI Trend] Day 3: Entry detected at ${displayTime}, matching learned routine (${formatTime12h(learnedTime)}). ACTIVE PREDICTIVE PRE-COOLING RULE ENABLED!`, 'success');
          } else if (next === 4) {
            addLog(`[AI Trend] Day 4: Entry detected at ${displayTime}, reinforcing routine (${formatTime12h(learnedTime)}). Pre-cooling schedule is highly optimized.`, 'success');
          } else {
            addLog(`[AI Trend] Day ${next}: Entry detected at ${displayTime}, matching candidate routine (${formatTime12h(learnedTime)}). ${3 - next} more day(s) required to activate pre-cooling.`, 'info');
          }
          return next;
        });
      } else {
        addLog(`[AI Trend] Room entry detected at ${displayTime}, but it does not match learned routine (${formatTime12h(learnedTime)}). No consecutive trend incremented.`, 'warning');
      }
    }
  };

  const handleSimulateTrendMiss = () => {
    if (!learnedTime) {
      addLog(`[AI Trend] Miss ignored: No active arrival routine candidate has been registered yet.`, 'info');
      return;
    }

    setTrendMissedDays((prev) => {
      const next = prev + 1;
      if (next >= 2) {
        addLog(`[AI Trend] Missed room entrance near learned routine (${formatTime12h(learnedTime)}) for 2 days straight. Trend database purged and reset!`, 'alert');
        setTrendConsecutiveDays(0);
        setLearnedTime(null);
        return 0;
      } else {
        addLog(`[AI Trend] No room activity detected near routine (${formatTime12h(learnedTime)}). Missed Day ${next}/2 logged. Rule will be forgotten if missed tomorrow.`, 'warning');
        return next;
      }
    });
  };

  const handleResetTrend = () => {
    setTrendConsecutiveDays(0);
    setTrendMissedDays(0);
    setLearnedTime(null);
    addLog(`[AI Trend] Trend pattern databases purged and reset to defaults.`, 'info');
  };

  // UI state controllers
  const [isConnected, setIsConnected] = useState<boolean>(true);
  const [latency, setLatency] = useState<number | null>(null);
  const [isFetching, setIsFetching] = useState<boolean>(false);
  const [showSettingsModal, setShowSettingsModal] = useState<boolean>(false);
  const [showDocsModal, setShowDocsModal] = useState<boolean>(false);
  const [showWeeklyReportModal, setShowWeeklyReportModal] = useState<boolean>(false);
  const [showWeatherModal, setShowWeatherModal] = useState<boolean>(false);
  const [showSwearModal, setShowSwearModal] = useState<boolean>(false);
  const [showSecretTracker, setShowSecretTracker] = useState<boolean>(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        (e.ctrlKey && e.shiftKey && (e.key === 'T' || e.key === 't')) ||
        (e.ctrlKey && e.shiftKey && (e.key === 'H' || e.key === 'h'))
      ) {
        e.preventDefault();
        setShowSecretTracker((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Creative Modes State Variables
  const [isExploding, setIsExploding] = useState<boolean>(false);
  const [isDestroyed, setIsDestroyed] = useState<boolean>(false);
  const [isDisco, setIsDisco] = useState<boolean>(false);
  const [isHaunted, setIsHaunted] = useState<boolean>(false);
  const [isHyper, setIsHyper] = useState<boolean>(false);
  const [isPurring, setIsPurring] = useState<boolean>(false);

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

  const handleCreativeModeTrigger = (mode: 'explode' | 'disco' | 'ghost' | 'hyper' | 'purr' | 'normal') => {
    setIsExploding(false);
    setIsDisco(false);
    setIsHaunted(false);
    setIsHyper(false);
    setIsPurring(false);

    if (mode === 'explode') {
      setIsExploding(true);
    } else if (mode === 'disco') {
      setIsDisco(true);
    } else if (mode === 'ghost') {
      setIsHaunted(true);
    } else if (mode === 'hyper') {
      setIsHyper(true);
    } else if (mode === 'purr') {
      setIsPurring(true);
    }
  };

  const handleRebuildCore = () => {
    setIsDestroyed(false);
    setIsExploding(false);
    setIsDisco(false);
    setIsHaunted(false);
    setIsHyper(false);
    setIsPurring(false);
    addLog("🔧 Core rebuilt successfully. Rebooting KITTEN stack... Status online.", "success");
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
            humidity: latestPoint.humidity,
            motion: latestPoint.motion === 1,
            led: latestPoint.led,
            fan: latestPoint.fan,
            humidifier: latestPoint.humidifier ?? 0,
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
          humidifier: ctrlState.humidifier !== undefined ? ctrlState.humidifier : prev.humidifier,
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

      // Telemetry strictly updates sensor readings (temperature, humidity & motion) to prevent feedback loops with control targets
      setEspData((prev) => ({
        ...prev,
        temperature: latestData.temperature,
        humidity: latestData.humidity,
        motion: latestData.motion,
      }));

      addLog(`[Cloud] Live Feed Sync: Received database telemetry (Temp: ${latestData.temperature}°C, Humidity: ${latestData.humidity}%, Motion: ${latestData.motion ? 'Active' : 'Clear'})`, 'info');
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

      // Synchronize to the local Express backend control endpoint as well
      fetch('/api/control', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(stateUpdate)
      }).catch(err => console.warn("[API Control] sendCommand failed to sync state:", err));

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

          // Humidity simulator
          let humidityTarget = prev.humidity !== null ? prev.humidity : 45;
          if (prev.humidifier > 0) {
            humidityTarget += (prev.humidifier / 255) * 0.4; // Humidifier adds moisture
          }
          // Fan dissipates humidity slightly faster towards baseline
          const dissipationSpeed = prev.fan > 0 ? 0.08 : 0.03;
          const humidityBaseline = 45;
          if (humidityTarget < humidityBaseline) humidityTarget += 0.01;
          if (humidityTarget > humidityBaseline) humidityTarget -= dissipationSpeed;

          const humidityNoise = (Math.random() - 0.5) * 0.12;
          const nextHumidity = Math.max(15, Math.min(95, Math.round((humidityTarget + humidityNoise) * 10) / 10));

          // AUTO AUTOMATION CONTROLS (If Auto mode is active, the simulator adjusts devices!)
          let nextLed = prev.led;
          let nextFan = prev.fan;
          let nextHumidifier = prev.humidifier;

          if (prev.auto) {
            // Fan control rules: only turn on if motion is detected AND temperature is NOT below 24°C
            if (prev.motion) {
              if (nextTemp < 24) {
                if (prev.fan > 0) {
                  nextFan = 0;
                  addLog('Auto AI: Occupancy registered but temperature is cool (<24°C). Keeping fan off.', 'info');
                }
              } else {
                // Temp is >= 24°C, turn on the fan (speed depending on temp)
                if (nextTemp >= 30) {
                  if (prev.fan !== 180) {
                    nextFan = 180;
                    addLog('Auto AI: Occupancy registered and room is hot (>=30°C). Overclocking climate ventilation to 70%.', 'info');
                  }
                } else {
                  if (prev.fan !== 60) {
                    nextFan = 60;
                    addLog('Auto AI: Occupancy registered and temperature is warm (>=24°C). Engaging moderate ventilation.', 'info');
                  }
                }
              }
            } else {
              // No motion detected, fan must be OFF
              if (prev.fan > 0) {
                nextFan = 0;
                addLog('Auto AI: No motion detected. Shutting down fan to conserve energy.', 'info');
              }
            }

            // Humidifier control rules: turn on if occupancy is detected and humidity is dry (< 40%)
            if (prev.motion) {
              if (nextHumidity < 40) {
                if (prev.humidifier !== 140) {
                  nextHumidifier = 140;
                  addLog('Auto AI: Relative humidity is dry (<40%). Engaging humidifier transducer.', 'success');
                }
              } else if (nextHumidity >= 55) {
                if (prev.humidifier !== 0) {
                  nextHumidifier = 0;
                  addLog('Auto AI: Relative humidity is optimal. Deactivating humidifier.', 'info');
                }
              }
            } else {
              if (prev.humidifier > 0) {
                nextHumidifier = 0;
                addLog('Auto AI: No motion detected. Pausing humidifier.', 'info');
              }
            }

            // Save energy if room is occupied but comfortable
            if (prev.motion && prev.led < 100) {
              nextLed = 120;
              addLog('Auto AI: Occupancy registered in dark room. Engaging 45% LED brightness.', 'info');
            } else if (!prev.motion && prev.led > 0) {
              nextLed = 0;
              addLog('Auto AI: Room is empty. Turning off LEDs to conserve power.', 'info');
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
            humidity: nextHumidity,
            motion: nextMotion,
            led: nextLed,
            fan: nextFan,
            humidifier: nextHumidifier,
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

        // Deplete simulated humidifier water reservoir if active
        if (currentEspData.humidifier > 0) {
          setWaterLevel((prev) => {
            const consumption = (currentEspData.humidifier / 255) * 0.4;
            const nextVal = Math.max(0, parseFloat((prev - consumption).toFixed(2)));
            localStorage.setItem('humidifier_water_level', Math.round(nextVal).toString());

            if (nextVal <= 0 && currentEspData.humidifier > 0) {
              // Auto shut-off humidifier
              setTimeout(() => {
                handleHumidifierChange(0);
                addLog('Ultrasonic Humidifier auto-stopped: Water reservoir is empty. Refill required.', 'warning');
              }, 0);
            }
            return nextVal;
          });
        }

        // Insert new history data point for the graphs
        setHistoryData((prev) => {
          const now = new Date();
          const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
          const newPoint: HistoryDataPoint = {
            time: timeStr,
            temperature: espDataRef.current.temperature,
            humidity: espDataRef.current.humidity,
            motion: espDataRef.current.motion ? 1 : 0,
            led: espDataRef.current.led,
            fan: espDataRef.current.fan,
            humidifier: espDataRef.current.humidifier,
          };
          
          const lastPoint = prev[prev.length - 1];
          if (lastPoint && lastPoint.time === timeStr) {
            const updatedHistory = [...prev];
            updatedHistory[updatedHistory.length - 1] = newPoint;
            return updatedHistory;
          } else {
            const nextHistory = [...prev, newPoint];
            if (nextHistory.length > 1000) {
              return nextHistory.slice(nextHistory.length - 1000);
            }
            return nextHistory;
          }
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
            const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            const data = espDataRef.current;
            const newPoint: HistoryDataPoint = {
              time: timeStr,
              temperature: data.temperature,
              humidity: data.humidity,
              motion: data.motion ? 1 : 0,
              led: data.led,
              fan: data.fan,
              humidifier: data.humidifier,
            };
            
            const lastPoint = prev[prev.length - 1];
            if (lastPoint && lastPoint.time === timeStr) {
              const updatedHistory = [...prev];
              updatedHistory[updatedHistory.length - 1] = newPoint;
              return updatedHistory;
            } else {
              const nextHistory = [...prev, newPoint];
              if (nextHistory.length > 1000) {
                return nextHistory.slice(nextHistory.length - 1000);
              }
              return nextHistory;
            }
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
                const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                const newPoint: HistoryDataPoint = {
                  time: timeStr,
                  temperature: data.temperature,
                  humidity: data.humidity,
                  motion: data.motion ? 1 : 0,
                  led: data.led,
                  fan: data.fan,
                  humidifier: data.humidifier,
                };
                
                const lastPoint = prev[prev.length - 1];
                if (lastPoint && lastPoint.time === timeStr) {
                  const updatedHistory = [...prev];
                  updatedHistory[updatedHistory.length - 1] = newPoint;
                  return updatedHistory;
                } else {
                  const nextHistory = [...prev, newPoint];
                  if (nextHistory.length > 1000) {
                    return nextHistory.slice(nextHistory.length - 1000);
                  }
                  return nextHistory;
                }
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

  const handleHumidifierChange = (val: number) => {
    sendCommand(`/humidifier?value=${val}`, { humidifier: val, auto: false }, `Ultrasonic Humidifier set to ${val} (${Math.round((val/255)*100)}%) [Manual Mode].`);
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

  const handleVoiceCommandAction = async (updates: Partial<ESP32Data>, logMsg: string) => {
    setIsFetching(true);
    
    // Immediately apply to UI for instantaneous response feel
    setEspData((prev) => ({ ...prev, ...updates }));

    // Sync to Firestore if enabled
    if (settings.firestoreSyncEnabled) {
      const mergedState = { ...espDataRef.current, ...updates };
      try {
        await saveControlState(mergedState);
        console.log('[Firestore] Control state synced successfully to control/esp32');
      } catch (err) {
        console.error('[Firestore] Failed to sync control state to Firestore:', err instanceof Error ? err.message : String(err));
      }
      addLog(logMsg, 'success');
      setIsFetching(false);
      return;
    }

    if (settings.simulationMode) {
      addLog(logMsg, 'success');
      setIsFetching(false);
      return;
    }

    // Physical ESP32 connection execution (non-Firestore mode)
    if (!settings.espIpAddress) {
      addLog('Command applied locally. (No physical ESP32 IP address configured for direct API).', 'warning');
      setIsFetching(false);
      return;
    }

    const cleanIp = settings.espIpAddress.replace(/^https?:\/\//i, '').trim();
    
    try {
      const startTime = performance.now();
      
      // Send separate API requests for each changed control to ESP32 with 200ms safety delay
      if (updates.auto !== undefined) {
        const url = `http://${cleanIp}/auto?enabled=${updates.auto}`;
        await fetch(url, { mode: 'no-cors' });
        await new Promise(resolve => setTimeout(resolve, 200));
      }
      if (updates.led !== undefined) {
        const url = `http://${cleanIp}/led?value=${updates.led}`;
        await fetch(url, { mode: 'no-cors' });
        await new Promise(resolve => setTimeout(resolve, 200));
      }
      if (updates.fan !== undefined) {
        const url = `http://${cleanIp}/fan?value=${updates.fan}`;
        await fetch(url, { mode: 'no-cors' });
        await new Promise(resolve => setTimeout(resolve, 200));
      }

      const endTime = performance.now();
      setLatency(Math.round(endTime - startTime));
      addLog(logMsg, 'success');
    } catch (err) {
      console.error('Physical send error:', err instanceof Error ? err.message : String(err));
      addLog(`Failed to communicate with ESP32 at: ${cleanIp}. (Check network / CORS policy).`, 'alert');
      setIsConnected(false);
    } finally {
      setIsFetching(false);
    }
  };

  // Check arrival pre-cooling schedule exactly 5 minutes before the arrival target
  useEffect(() => {
    if (!arrivalSchedule.enabled) return;

    let lastTriggeredMinute = '';

    const checkPreCooling = () => {
      const now = new Date();
      const currentHours = now.getHours();
      const currentMinutes = now.getMinutes();
      const currentMinuteStr = `${currentHours}:${currentMinutes}`;

      if (currentMinuteStr === lastTriggeredMinute) return;

      const [schedHours, schedMinutes] = arrivalSchedule.time.split(':').map(Number);
      const targetMin = schedHours * 60 + schedMinutes;
      const currentMin = currentHours * 60 + currentMinutes;

      // 5 minutes prior to arrival
      if (currentMin === targetMin - 5) {
        lastTriggeredMinute = currentMinuteStr;
        
        // Turn on fan to high speed (180 out of 255)
        sendCommand('/fan?value=180', { fan: 180, auto: false }, `[Schedule] Arrival Pre-Cooling triggered! Fan automatically activated 5 minutes prior to scheduled arrival (${arrivalSchedule.time}).`);
      }
    };

    checkPreCooling();
    const interval = setInterval(checkPreCooling, 10000);
    return () => clearInterval(interval);
  }, [arrivalSchedule]);

  // Check learned arrival pre-cooling schedule exactly 5 minutes before the dynamically learned time
  useEffect(() => {
    if (!isTrendRuleActive || !learnedTime) return;

    let lastTriggeredMinute = '';

    const checkTrendCooling = () => {
      const now = new Date();
      const currentHours = now.getHours();
      const currentMinutes = now.getMinutes();
      const currentMinuteStr = `${currentHours}:${currentMinutes}`;

      if (currentMinuteStr === lastTriggeredMinute) return;

      const [learnedH, learnedM] = learnedTime.split(':').map(Number);
      const learnedMinutesTotal = learnedH * 60 + learnedM;
      const triggerMinutes = (learnedMinutesTotal - 5 + 1440) % 1440;
      const currentMinutesTotal = currentHours * 60 + currentMinutes;

      if (currentMinutesTotal === triggerMinutes) {
        lastTriggeredMinute = currentMinuteStr;
        
        // Turn on fan to high speed (180 out of 255)
        sendCommand(
          '/fan?value=180',
          { fan: 180, auto: false },
          `[AI Predict] Learned ${formatTime12h(learnedTime)} entry pattern active! Fan automatically activated 5 minutes prior at ${formatTime12h(currentMinuteStr)} for microclimate optimization.`
        );
      }
    };

    checkTrendCooling();
    const interval = setInterval(checkTrendCooling, 10000);
    return () => clearInterval(interval);
  }, [isTrendRuleActive, learnedTime]);

  if (showSecretTracker) {
    return (
      <HiddenTaskTracker
        isOpen={true}
        onClose={() => setShowSecretTracker(false)}
        firestoreSyncEnabled={settings.firestoreSyncEnabled}
        addLog={addLog}
      />
    );
  }

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
        onOpenSecretTracker={() => setShowSecretTracker(true)}
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
              arrivalSchedule={arrivalSchedule}
              onChangeArrivalSchedule={setArrivalSchedule}
            />

            {/* Ultrasonic Humidifier Control */}
            <HumidifierControl
              data={espData}
              onHumidifierChange={handleHumidifierChange}
              isLoading={isFetching}
              waterLevel={Math.round(waterLevel)}
              onRefillWater={handleRefillWater}
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
              onOpenWeeklyReport={() => setShowWeeklyReportModal(true)}
              onOpenWeather={() => setShowWeatherModal(true)}
              onOpenKittenSwear={() => setShowSwearModal(true)}
              onCreativeMode={handleCreativeModeTrigger}
            />

            {/* Hardware statistics monitor */}
            <SystemHealth metrics={systemHealth} />
          </div>

          {/* COLUMN 3 (Full Span Row): Time-Series Analytics Charts & Logging Terminal */}
          <div className="md:col-span-3 grid grid-cols-1 md:grid-cols-5 gap-6">
            {/* Recharts Analytics graphs */}
            <AnalyticsSection
              historyData={historyData}
              showWeeklyModal={showWeeklyReportModal}
              onOpenWeeklyModal={() => setShowWeeklyReportModal(true)}
              onCloseWeeklyModal={() => setShowWeeklyReportModal(false)}
              onOpenWeather={() => setShowWeatherModal(true)}
            />

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

      {/* 3. METEOROLOGICAL WEATHER STATION MODAL */}
      <WeatherModal
        isOpen={showWeatherModal}
        onClose={() => setShowWeatherModal(false)}
        indoorData={espData}
        addLog={addLog}
      />

      {/* 4. KITTEN SWEAR VERBAL CONTRA-MEASURES MODAL */}
      <KittenSwearModal
        isOpen={showSwearModal}
        onClose={() => setShowSwearModal(false)}
        addLog={addLog}
      />

      {/* 5. CREATIVE FUN VOICE MODES OVERLAYS */}
      <CreativeModesOverlay
        isExploding={isExploding}
        isDestroyed={isDestroyed}
        isDisco={isDisco}
        isHaunted={isHaunted}
        isHyper={isHyper}
        isPurring={isPurring}
        onRebuildCore={handleRebuildCore}
        onExplodeComplete={() => {
          setIsExploding(false);
          setIsDestroyed(true);
        }}
        addLog={addLog}
        setEspData={setEspData}
      />
    </div>
  );
}
