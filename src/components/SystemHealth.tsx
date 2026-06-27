/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Wifi, Cpu, Clock, Layers, ShieldCheck, ShieldAlert } from 'lucide-react';
import { SystemHealthMetrics } from '../types';
import GlowCard from './GlowCard';

interface SystemHealthProps {
  metrics: SystemHealthMetrics;
}

export default function SystemHealth({ metrics }: SystemHealthProps) {
  // Translate wifi signal to percent / verbal quality
  const getWifiQuality = (dbm: number) => {
    if (dbm >= -50) return { label: 'Excellent', percent: 100, color: 'text-emerald-400' };
    if (dbm >= -60) return { label: 'Good', percent: 80, color: 'text-cyan-400' };
    if (dbm >= -70) return { label: 'Moderate', percent: 60, color: 'text-blue-400' };
    if (dbm >= -80) return { label: 'Weak', percent: 30, color: 'text-amber-400' };
    return { label: 'Critical', percent: 10, color: 'text-red-400' };
  };

  const wifiInfo = getWifiQuality(metrics.wifiSignal);

  // Format uptime
  const formatUptime = (seconds: number) => {
    const d = Math.floor(seconds / (3600 * 24));
    const h = Math.floor((seconds % (3600 * 24)) / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);

    const parts = [];
    if (d > 0) parts.push(`${d}d`);
    if (h > 0) parts.push(`${h}h`);
    if (m > 0) parts.push(`${m}m`);
    parts.push(`${s}s`);

    return parts.join(' ');
  };

  return (
    <GlowCard
      id="card-system-health-status"
      title="Hardware Health Console"
      subtitle="ESP32 SYSTEM & COMPILER TELEMETRY"
      glowColor={metrics.sensorStatus === 'OK' ? 'none' : 'amber'}
    >
      <div className="grid grid-cols-2 gap-4">
        {/* Wi-Fi Health */}
        <div className="flex flex-col p-3 rounded-xl border border-slate-900 bg-slate-950/40">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] text-slate-500 font-mono flex items-center gap-1.5 uppercase">
              <Wifi className="w-3.5 h-3.5 text-cyan-400" /> Wi-Fi RSSI
            </span>
            <span className={`text-[9px] font-mono font-bold uppercase ${wifiInfo.color}`}>
              {wifiInfo.label}
            </span>
          </div>
          <div className="flex items-baseline gap-1 mt-1">
            <span className="text-xl font-bold font-sans text-slate-100">{metrics.wifiSignal}</span>
            <span className="text-[9px] text-slate-500 font-mono">dBm</span>
          </div>
          {/* Signal Level Bar */}
          <div className="w-full bg-slate-900 h-1 rounded-full mt-2 overflow-hidden">
            <div
              className="h-full rounded-full bg-cyan-400 transition-all duration-500"
              style={{ width: `${wifiInfo.percent}%` }}
            />
          </div>
        </div>

        {/* CPU Util */}
        <div className="flex flex-col p-3 rounded-xl border border-slate-900 bg-slate-950/40">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] text-slate-500 font-mono flex items-center gap-1.5 uppercase">
              <Cpu className="w-3.5 h-3.5 text-blue-400" /> CPU Core
            </span>
            <span className="text-[9px] text-slate-500 font-mono font-bold">XTENSA LX7</span>
          </div>
          <div className="flex items-baseline gap-1 mt-1">
            <span className="text-xl font-bold font-sans text-slate-100">{metrics.cpuUsage}</span>
            <span className="text-[9px] text-slate-500 font-mono">%</span>
          </div>
          {/* CPU Bar */}
          <div className="w-full bg-slate-900 h-1 rounded-full mt-2 overflow-hidden">
            <div
              className="h-full rounded-full bg-blue-500 transition-all duration-500"
              style={{ width: `${metrics.cpuUsage}%` }}
            />
          </div>
        </div>

        {/* Uptime */}
        <div className="flex flex-col p-3 rounded-xl border border-slate-900 bg-slate-950/40">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] text-slate-500 font-mono flex items-center gap-1.5 uppercase">
              <Clock className="w-3.5 h-3.5 text-amber-500" /> ESP Uptime
            </span>
          </div>
          <div className="text-sm font-bold font-mono text-slate-200 mt-1.5 select-all leading-none py-0.5">
            {formatUptime(metrics.uptimeSeconds)}
          </div>
          <p className="text-[8px] text-slate-500 font-mono mt-2">Continuous RTOS execution</p>
        </div>

        {/* Sensor Grid Status */}
        <div className="flex flex-col p-3 rounded-xl border border-slate-900 bg-slate-950/40">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] text-slate-500 font-mono flex items-center gap-1.5 uppercase">
              <Layers className="w-3.5 h-3.5 text-purple-500" /> Sensor Grid
            </span>
          </div>
          <div className="flex items-center gap-1.5 mt-1.5">
            {metrics.sensorStatus === 'OK' ? (
              <>
                <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                <span className="text-xs font-bold font-mono text-emerald-400">OPERATIONAL</span>
              </>
            ) : (
              <>
                <ShieldAlert className="w-4 h-4 text-amber-500 shrink-0" />
                <span className="text-xs font-bold font-mono text-amber-500">WARNING</span>
              </>
            )}
          </div>
          <p className="text-[8px] text-slate-500 font-mono mt-2">BME280 + PIR Calibration</p>
        </div>
      </div>

      {/* RAM metrics bar */}
      <div className="mt-4 pt-3 border-t border-slate-900/60 flex flex-col gap-1.5 font-mono text-[9px] text-slate-400">
        <div className="flex justify-between">
          <span>FREE DRAM HEAP MEMORY</span>
          <span className="text-cyan-400 font-bold">{Math.round(metrics.heapFree / 1024)} KB</span>
        </div>
        <div className="w-full bg-slate-900 h-1 rounded-full overflow-hidden">
          {/* heap is 184KB of total 320KB DRAM */}
          <div
            className="h-full rounded-full bg-emerald-400"
            style={{ width: `${(metrics.heapFree / 320000) * 100}%` }}
          />
        </div>
      </div>
    </GlowCard>
  );
}
