/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface ESP32Data {
  temperature: number;
  motion: boolean;
  led: number; // 0-255
  fan: number; // 0-255
  voice: boolean; // Voice wake status or activated
  auto: boolean; // Auto mode vs manual
}

export interface SystemHealthMetrics {
  wifiSignal: number; // dBm, e.g. -65
  uptimeSeconds: number;
  sensorStatus: 'OK' | 'WARNING' | 'ERROR';
  cpuUsage: number; // percentage
  heapFree: number; // in bytes
}

export interface ActivityLog {
  id: string;
  timestamp: string;
  message: string;
  type: 'info' | 'warning' | 'success' | 'alert';
}

export interface HistoryDataPoint {
  time: string;
  temperature: number;
  motion: number; // 0 or 1 for chart
  led: number;
  fan: number;
}

export type PresetMode = 'manual' | 'auto' | 'study' | 'sleep' | 'movie' | 'gaming';

export interface DashboardSettings {
  espIpAddress: string;
  refreshRateMs: number;
  simulationMode: boolean;
  voiceSensitivity: number; // 1-10
  notificationsEnabled: boolean;
  lowLightMode: boolean;
  themeColor: 'cyan' | 'blue' | 'amber' | 'emerald';
  firestoreSyncEnabled: boolean;
  firestoreAutoSaveTicks: boolean;
  firestoreDatabaseTarget?: 'default' | 'custom';
}
