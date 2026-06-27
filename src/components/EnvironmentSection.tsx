/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Thermometer, Eye, Activity, Heart, ShieldAlert } from 'lucide-react';
import { ESP32Data } from '../types';
import GlowCard from './GlowCard';
import { calculateComfortScore } from '../mockData';

interface EnvironmentSectionProps {
  data: ESP32Data;
}

export default function EnvironmentSection({ data }: EnvironmentSectionProps) {
  const comfortScore = calculateComfortScore(data.temperature, data.fan, data.led);

  // Determine ambient room state status string
  const getRoomStatusAndColor = () => {
    if (data.temperature >= 30) {
      return { text: 'ROOM IS HOT', color: 'text-amber-400 bg-amber-500/10 border-amber-500/20' };
    }
    if (data.temperature <= 18) {
      return { text: 'ROOM IS COLD', color: 'text-blue-400 bg-blue-500/10 border-blue-500/20' };
    }
    return { text: 'AMBIENT OPTIMAL', color: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/20' };
  };

  const statusInfo = getRoomStatusAndColor();

  return (
    <GlowCard
      id="card-environment-control"
      title="Environment Status"
      subtitle="LIVE AMBIENT CLIMATE TELEMETRY"
      glowColor={data.temperature >= 30 ? 'amber' : 'cyan'}
      className="md:col-span-2 overflow-hidden"
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 items-center">
        {/* Large Temp Display */}
        <div className="flex flex-col items-center sm:items-start text-center sm:text-left">
          <div className="flex items-center justify-center gap-1.5 font-mono text-slate-500 text-xs tracking-wider uppercase mb-2">
            <Thermometer className="w-4 h-4 text-cyan-400" />
            <span>Ambient Air Temperature</span>
          </div>

          <div className="relative inline-flex items-baseline justify-center sm:justify-start">
            <span className="text-7xl font-extrabold tracking-tighter text-white font-sans select-none drop-shadow-[0_0_15px_rgba(255,255,255,0.1)]">
              {data.temperature}
            </span>
            <span className="text-4xl font-semibold text-cyan-400 ml-1 select-none font-sans">
              °C
            </span>
            
            {/* Visual heating/cooling indicators */}
            {data.temperature >= 30 && (
              <span className="absolute -top-1 -right-7 flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-amber-500"></span>
              </span>
            )}
          </div>

          <div className="mt-4 w-full">
            <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border font-mono text-xs font-semibold uppercase tracking-wider ${statusInfo.color}`}>
              <div className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
              <span>{statusInfo.text}</span>
            </div>
          </div>
        </div>

        {/* Climate Metrics Details */}
        <div className="grid grid-cols-2 gap-4">
          {/* Motion Status */}
          <div className="flex flex-col p-4.5 rounded-xl border border-slate-900 bg-slate-950/50">
            <div className="flex items-center gap-2 mb-2">
              <div className={`p-1.5 rounded-lg ${data.motion ? 'bg-cyan-500/10 text-cyan-400' : 'bg-slate-900 text-slate-500'}`}>
                {data.motion ? <Activity className="w-4 h-4 animate-bounce" /> : <Eye className="w-4 h-4" />}
              </div>
              <span className="text-xs text-slate-400 font-mono">Motion</span>
            </div>

            <div className="mt-1 flex items-baseline gap-1.5">
              <span className={`text-lg font-bold font-sans tracking-tight leading-none ${data.motion ? 'text-cyan-400' : 'text-slate-500'}`}>
                {data.motion ? 'Detected' : 'Inactive'}
              </span>
            </div>

            <p className="text-[10px] text-slate-500 font-mono mt-1.5">
              {data.motion ? 'Radar active (Room Occupied)' : 'No physical presence'}
            </p>
          </div>

          {/* Comfort Score */}
          <div className="flex flex-col p-4.5 rounded-xl border border-slate-900 bg-slate-950/50">
            <div className="flex items-center gap-2 mb-2">
              <div className={`p-1.5 rounded-lg ${comfortScore >= 80 ? 'bg-emerald-500/10 text-emerald-400' : comfortScore >= 50 ? 'bg-amber-500/10 text-amber-400' : 'bg-red-500/10 text-red-400'}`}>
                <Heart className="w-4 h-4" />
              </div>
              <span className="text-xs text-slate-400 font-mono">Comfort</span>
            </div>

            <div className="mt-1 flex items-baseline gap-0.5">
              <span className="text-2xl font-black font-sans tracking-tight text-white leading-none">
                {comfortScore}
              </span>
              <span className="text-xs text-slate-400 font-mono">%</span>
            </div>

            {/* Micro comfort slider indicator */}
            <div className="w-full bg-slate-900 rounded-full h-1 mt-2 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  comfortScore >= 80 ? 'bg-emerald-500' : comfortScore >= 50 ? 'bg-amber-500' : 'bg-red-500'
                }`}
                style={{ width: `${comfortScore}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Cyber ambient footer decoration */}
      <div className="mt-5 border-t border-slate-900/40 pt-4 flex items-center justify-between font-mono text-[10px] text-slate-500">
        <div className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
          <span>SENSORS ONLINE & BROADCASTING</span>
        </div>
        <div className="flex items-center gap-1">
          <span>COMFORT INDEX:</span>
          <span className={comfortScore >= 80 ? 'text-emerald-400' : comfortScore >= 50 ? 'text-amber-400' : 'text-red-400'}>
            {comfortScore >= 80 ? 'EXCELLENT' : comfortScore >= 50 ? 'MODERATE' : 'CRITICAL'}
          </span>
        </div>
      </div>
    </GlowCard>
  );
}
