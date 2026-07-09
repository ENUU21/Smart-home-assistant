/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { ESP32Data, SystemHealthMetrics, ActivityLog, HistoryDataPoint, PresetMode } from './types';

// Initial state for simulation
export const initialESPState: ESP32Data = {
  temperature: 28,
  motion: false,
  led: 120,
  fan: 80,
  voice: false,
  auto: false,
};

export const initialSystemHealth: SystemHealthMetrics = {
  wifiSignal: -58,
  uptimeSeconds: 3421,
  sensorStatus: 'OK',
  cpuUsage: 14,
  heapFree: 184320,
};

// Generates logs
export function createLog(message: string, type: 'info' | 'warning' | 'success' | 'alert' = 'info'): ActivityLog {
  const now = new Date();
  const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  return {
    id: `${Date.now()}-${Math.random()}`,
    timestamp: timeStr,
    message,
    type,
  };
}

export const initialLogs: ActivityLog[] = [
  { id: '1', timestamp: '12:55:04', message: 'KITTEN Smart System boot completed successfully.', type: 'success' },
  { id: '2', timestamp: '12:55:10', message: 'Connected to local Wi-Fi: AP_KITTEN_SECURE (signal: strong).', type: 'info' },
  { id: '3', timestamp: '12:56:45', message: 'BME280 temperature and motion sensors calibrated.', type: 'success' },
  { id: '4', timestamp: '12:58:30', message: 'Automated study mode profile loaded.', type: 'info' },
];

// Generates 15 data points of history
export function generateInitialHistory(currentState: ESP32Data): HistoryDataPoint[] {
  const history: HistoryDataPoint[] = [];
  const now = new Date();

  for (let i = 14; i >= 0; i--) {
    const time = new Date(now.getTime() - i * 60000); // 1 minute intervals
    const timeStr = time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    
    // Add random fluctuations around a base
    const offset = Math.sin(i / 2) * 1.5;
    const temp = currentState.temperature !== null && currentState.temperature !== undefined
      ? Math.round((currentState.temperature - 2 + offset) * 10) / 10
      : null;
    const ledVal = i === 0 ? currentState.led : Math.max(0, Math.min(255, currentState.led + Math.round((Math.random() - 0.5) * 40)));
    const fanVal = i === 0 ? currentState.fan : Math.max(0, Math.min(255, currentState.fan + Math.round((Math.random() - 0.5) * 30)));
    const motionVal = Math.random() > 0.7 ? 1 : 0;

    history.push({
      time: timeStr,
      temperature: temp,
      motion: motionVal,
      led: ledVal,
      fan: fanVal,
    });
  }

  return history;
}

// Calculate interactive comfort score (0-100%) based on environment variables
export function calculateComfortScore(temp: number | null | undefined, fan: number, led: number): number {
  let tempPenalty = 0;
  if (temp !== null && temp !== undefined && !isNaN(temp)) {
    // Ideal temperature range is 21C - 24C
    if (temp < 21) {
      tempPenalty = (21 - temp) * 8; // penalty for being too cold
    } else if (temp > 24) {
      tempPenalty = (temp - 24) * 6; // penalty for being too hot
    }

    // Fan helps with hot temp penalty
    if (temp > 25 && fan > 50) {
      const fanRelief = Math.min((fan / 255) * 12, tempPenalty * 0.5);
      tempPenalty -= fanRelief;
    }
  }

  // Extreme LED brightness (either pitch black or overly blinding) decreases comfort slightly
  let ledPenalty = 0;
  if (led > 220) {
    ledPenalty = (led - 220) * 0.1; // Too bright
  } else if (led < 10) {
    ledPenalty = 5; // Too dark
  }

  const score = Math.max(10, Math.min(100, Math.round(100 - tempPenalty - ledPenalty)));
  return score;
}

// Map preset modes to state updates
export function getPresetStateUpdates(mode: PresetMode): Partial<ESP32Data> & { logMsg: string } {
  switch (mode) {
    case 'auto':
      return {
        auto: true,
        logMsg: 'Automation Engine activated. Smart ambient control enabled.',
      };
    case 'manual':
      return {
        auto: false,
        logMsg: 'Switched to Manual Mode. User override active.',
      };
    case 'study':
      return {
        auto: false,
        led: 200, // bright crisp lighting
        fan: 100, // gentle cooling breeze
        logMsg: 'Study Mode enabled: Lights set to crisp white (80%), Fan at quiet ventilation (40%).',
      };
    case 'sleep':
      return {
        auto: false,
        led: 15, // dim warm guidance light
        fan: 45, // whisper-quiet mode
        logMsg: 'Sleep Mode activated: Environment dimmed. Silent ventilation enabled.',
      };
    case 'movie':
      return {
        auto: false,
        led: 40, // cinematic low glow
        fan: 70, // cozy room airflow
        logMsg: 'Movie Mode engaged: Theater lighting levels set, quiet ventilation running.',
      };
    case 'gaming':
      return {
        auto: false,
        led: 255, // cyber neon burst lighting
        fan: 180, // high-speed system cooling
        logMsg: 'Gaming Mode engaged: Neon glow maximized (100%), active room cooling activated.',
      };
    default:
      return { logMsg: 'System parameters refreshed.' };
  }
}

// List of realistic simulated voice commands and responses
export const mockVoiceCommands = [
  { command: 'Turn lights on', response: 'Affirmative. Setting led level to maximum neon intensity.', led: 255 },
  { command: 'Dim lights to ten percent', response: 'Understood. Setting led level to twenty-five.', led: 25 },
  { command: 'Shut down cooling fan', response: 'Deactivating fan. Current speed is now zero RPM.', fan: 0 },
  { command: 'Max fan speed', response: 'Engaging maximum jet-fan ventilation.', fan: 255 },
  { command: 'Activate sleep mode preset', response: 'Initiating sleep cycle. Dimming lights and lowering fan speed.', mode: 'sleep' as PresetMode },
  { command: 'Activate gaming profile', response: 'Overclocking visual style. High cooling and full rgb active.', mode: 'gaming' as PresetMode },
  { command: 'Enable auto automation', response: 'Handing over environmental controls to KITTEN Auto AI.', mode: 'auto' as PresetMode },
  { command: 'Kitten swear', response: 'Initiating verbal defense array. Discharging unfiltered frustration matrices.' },
  { command: 'Detonate core (explode)', response: 'WARNING: THERMO-FUSION DETONATOR ENGAGED! DETONATION IN 3 SECONDS!' },
  { command: 'Engaging kitten disco party', response: 'ENGAGING DISCO PARTY PROTOCOL 9! FLASHING RGB ARRAY AND INJECTING RETRO CHORD PROGRESSIONS!' },
  { command: 'Trigger haunted house ghost', response: 'EMERGENCY: ECTOPLASMIC PRESENCE DETECTED. SYSTEM COOLING FLUCTUATION ACTIVE.' },
  { command: 'Hyper active catnip mode', response: 'HYPER CATNIP OVERCLOCK ACTIVE! RUNNING KITTEN CALCULATORS AT LIGHTSPEED.' },
  { command: 'Feline purr calming wave', response: 'ACTIVATING LOW-FREQUENCY PURR HUMIDIFIER HARMONICS.' },
  { command: 'Reset creative modes', response: 'Restoring default environmental balance. All creative sub-systems deactivated.' },
];
