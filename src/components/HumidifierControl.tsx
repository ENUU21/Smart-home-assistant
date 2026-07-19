/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Droplet, Power, ShieldAlert, Waves, RefreshCw } from 'lucide-react';
import { ESP32Data } from '../types';
import GlowCard from './GlowCard';

interface HumidifierControlProps {
  data: ESP32Data;
  onHumidifierChange: (value: number) => void;
  isLoading: boolean;
  waterLevel?: number; // Simulated water level (0-100%)
  onRefillWater?: () => void;
}

export default function HumidifierControl({
  data,
  onHumidifierChange,
  isLoading,
  waterLevel = 100,
  onRefillWater,
}: HumidifierControlProps) {
  const isHumidifierOn = data.humidifier > 0;
  const isWaterLow = waterLevel <= 15;

  const handleToggle = () => {
    if (isHumidifierOn) {
      onHumidifierChange(0);
    } else {
      onHumidifierChange(255); // Full power digital switch
    }
  };

  return (
    <GlowCard
      id="card-humidifier-control"
      title="Humidifier Control"
      subtitle="HUMIDITY INJECTION STATE"
      glowColor="purple"
      className="overflow-hidden"
      headerAction={
        <div className="flex items-center gap-2">
          {isWaterLow && (
            <span className="text-[9px] font-mono text-rose-400 bg-rose-500/10 px-2 py-1 rounded border border-rose-500/20 animate-pulse flex items-center gap-1">
              <ShieldAlert className="w-2.5 h-2.5" /> DRY TANK
            </span>
          )}
          <button
            id="btn-toggle-humidifier"
            onClick={handleToggle}
            disabled={isLoading}
            className={`p-2 rounded-xl border transition-all duration-300 ${
              isHumidifierOn
                ? 'border-purple-500/40 bg-purple-950/20 text-purple-400 shadow-[0_0_10px_rgba(168,85,247,0.2)]'
                : 'border-slate-800 bg-slate-950/40 text-slate-500'
            }`}
          >
            <Power className="w-4 h-4" />
          </button>
        </div>
      }
    >
      <div className="flex flex-col gap-6">
        {/* Animated Mist / Vapor SVG Indicator */}
        <div className="flex justify-center items-center py-5 relative">
          <div className="relative w-24 h-24 flex items-center justify-center">
            {/* Outer Ring */}
            <div className={`absolute inset-0 rounded-full border border-dashed transition-all duration-500 ${
              isHumidifierOn ? 'border-purple-500/40 animate-[spin_12s_linear_infinite]' : 'border-slate-800'
            }`} />
            <div className="absolute inset-1.5 rounded-full border border-slate-900 bg-slate-950/40" />
            
            {/* Ultrasonic vapor animation */}
            <div className="absolute inset-0 flex items-center justify-center">
              {isHumidifierOn ? (
                <div className="flex flex-col items-center gap-1.5 z-10 animate-pulse">
                  <div className="flex gap-1.5 justify-center mb-1">
                    {/* Floating Vapor Particle 1 */}
                    <span 
                      className="w-1.5 h-3 bg-purple-400/80 rounded-full animate-[bounce_1.2s_infinite_alternate]" 
                      style={{ animationDelay: '0ms' }}
                    />
                    {/* Floating Vapor Particle 2 */}
                    <span 
                      className="w-1.5 h-5 bg-purple-300/80 rounded-full animate-[bounce_1.2s_infinite_alternate]" 
                      style={{ animationDelay: '200ms' }}
                    />
                    {/* Floating Vapor Particle 3 */}
                    <span 
                      className="w-1.5 h-3 bg-purple-400/80 rounded-full animate-[bounce_1.2s_infinite_alternate]" 
                      style={{ animationDelay: '400ms' }}
                    />
                  </div>
                  <Waves className="w-7 h-7 text-purple-400 animate-[pulse_1s_infinite_alternate] drop-shadow-[0_0_8px_rgba(168,85,247,0.5)]" />
                </div>
              ) : (
                <Droplet className="w-8 h-8 text-slate-700 z-10" />
              )}
            </div>
          </div>
        </div>

        {/* Sliders and Info Panel */}
        <div>
          <div className="flex justify-between items-baseline mb-2">
            <span className="text-xs text-slate-400 font-mono flex items-center gap-1.5">
              <Waves className="w-3.5 h-3.5 text-purple-400" /> Mist Intensity
            </span>
            <div className="flex items-baseline gap-1 font-mono">
              <span className="text-sm font-bold text-slate-100">{Math.round((data.humidifier / 255) * 100)}</span>
              <span className="text-[10px] text-slate-500">%</span>
              <span className="text-xs text-slate-500 ml-1.5">({data.humidifier})</span>
            </div>
          </div>

          <div className="relative group flex items-center">
            <input
              id="slider-humidifier-speed"
              type="range"
              min="0"
              max="255"
              value={data.humidifier}
              onChange={(e) => onHumidifierChange(parseInt(e.target.value, 10))}
              disabled={isLoading}
              className="w-full h-2 rounded-lg bg-slate-900 border border-slate-800/80 appearance-none cursor-pointer focus:outline-none accent-purple-400 group-hover:border-slate-700 transition-colors duration-200"
            />
          </div>

          <div className="flex justify-between text-[10px] text-slate-500 font-mono mt-2">
            <span>OFF</span>
            <span className="text-[10px] text-slate-600 font-mono">
              PORT: GPIO 14 (PWM)
            </span>
            <span>MAX MIST</span>
          </div>
        </div>

        {/* Water Level Tank Meter */}
        <div className="pt-4 border-t border-slate-900/60 mt-1">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-slate-400 font-mono flex items-center gap-1.5">
              <Droplet className={`w-3.5 h-3.5 ${isWaterLow ? 'text-rose-400' : 'text-purple-400'}`} /> Tank Water Level
            </span>
            <span className={`text-xs font-mono font-bold ${isWaterLow ? 'text-rose-400' : 'text-purple-400'}`}>
              {waterLevel}%
            </span>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex-1 h-3 rounded-full bg-slate-950 border border-slate-900 overflow-hidden relative">
              <div 
                className={`h-full rounded-full transition-all duration-500 ${
                  isWaterLow 
                    ? 'bg-gradient-to-r from-rose-500 to-rose-400' 
                    : 'bg-gradient-to-r from-purple-600 to-purple-400'
                }`}
                style={{ width: `${waterLevel}%` }}
              />
              {isHumidifierOn && (
                <div className="absolute inset-0 bg-[linear-gradient(45deg,rgba(255,255,255,0.15)_25%,transparent_25%,transparent_50%,rgba(255,255,255,0.15)_50%,rgba(255,255,255,0.15)_75%,transparent_75%,transparent)] bg-[length:15px_15px] animate-[pulse_1s_infinite_linear]" />
              )}
            </div>

            {onRefillWater && (
              <button
                id="btn-refill-water"
                onClick={onRefillWater}
                className="p-1.5 rounded-lg border border-purple-500/30 bg-purple-950/10 hover:bg-purple-950/30 text-purple-400 cursor-pointer transition-all flex items-center justify-center"
                title="Refill Water Tank"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="text-[9px] text-slate-500 font-mono mt-1.5 leading-relaxed">
            {isHumidifierOn 
              ? `💦 Evaporating water... Mist rate is approximately ${Math.round((data.humidifier / 255) * 4)}% per minute.`
              : '💤 Humidifier on standby. Water tank is secure.'}
          </div>
        </div>
      </div>
    </GlowCard>
  );
}
