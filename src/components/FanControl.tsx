/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Wind, Power } from 'lucide-react';
import { ESP32Data } from '../types';
import GlowCard from './GlowCard';

interface FanControlProps {
  data: ESP32Data;
  onFanChange: (value: number) => void;
  isLoading: boolean;
}

export default function FanControl({ data, onFanChange, isLoading }: FanControlProps) {
  const isFanOn = data.fan > 0;

  // Compute CSS rotation animation duration based on state
  const getSpinStyle = () => {
    if (!isFanOn) {
      return { animationPlayState: 'paused' };
    }
    return {
      animationName: 'spin',
      animationDuration: '0.6s',
      animationIterationCount: 'infinite',
      animationTimingFunction: 'linear',
    };
  };

  const handleToggle = () => {
    if (isFanOn) {
      onFanChange(0);
    } else {
      onFanChange(255); // Full power digital switch
    }
  };

  return (
    <GlowCard
      id="card-fan-control"
      title="Climate Control"
      subtitle="VENTILATION POWER STATE"
      glowColor="blue"
      className="overflow-hidden"
    >
      <div className="flex flex-col gap-6 items-center">
        {/* Animated Fan Blade SVG */}
        <div className="flex flex-col justify-center items-center py-4 relative">
          <div className="relative w-28 h-28 flex items-center justify-center">
            {/* Outer Fan Shroud / Ring */}
            <div className={`absolute inset-0 rounded-full border border-dashed transition-all duration-500 ${
              isFanOn ? 'border-blue-500/50 animate-[spin_10s_linear_infinite]' : 'border-slate-800'
            }`} />
            <div className="absolute inset-1.5 rounded-full border border-slate-900 bg-slate-950/40" />
            
            {/* SVG Blades */}
            <svg
              id="svg-fan-blades"
              className={`w-20 h-20 text-blue-400 z-10 transition-all duration-500 ${
                isFanOn ? 'drop-shadow-[0_0_12px_rgba(59,130,246,0.6)]' : 'text-slate-600'
              }`}
              style={getSpinStyle()}
              viewBox="0 0 100 100"
            >
              {/* Central Cap */}
              <circle cx="50" cy="50" r="12" className={`${isFanOn ? 'fill-blue-500 stroke-blue-300' : 'fill-slate-700 stroke-slate-600'} stroke-[2px]`} />
              
              {/* Blade 1 */}
              <path
                d="M50 38 C40 38 35 20 50 10 C65 20 60 38 50 38 Z"
                className={`${isFanOn ? 'fill-blue-400/85 stroke-blue-300' : 'fill-slate-700/60 stroke-slate-600'} stroke-[1px]`}
              />
              {/* Blade 2 */}
              <path
                d="M62 50 C62 40 80 35 90 50 C80 65 62 60 62 50 Z"
                className={`${isFanOn ? 'fill-blue-400/85 stroke-blue-300' : 'fill-slate-700/60 stroke-slate-600'} stroke-[1px]`}
              />
              {/* Blade 3 */}
              <path
                d="M50 62 C60 62 65 80 50 90 C35 80 40 62 50 62 Z"
                className={`${isFanOn ? 'fill-blue-400/85 stroke-blue-300' : 'fill-slate-700/60 stroke-slate-600'} stroke-[1px]`}
              />
              {/* Blade 4 */}
              <path
                d="M38 50 C38 60 20 65 10 50 C20 35 38 40 38 50 Z"
                className={`${isFanOn ? 'fill-blue-400/85 stroke-blue-300' : 'fill-slate-700/60 stroke-slate-600'} stroke-[1px]`}
              />
            </svg>
          </div>
        </div>

        {/* Master Power Control Button */}
        <div className="w-full flex flex-col gap-3">
          <button
            id="btn-toggle-fan-power"
            onClick={handleToggle}
            disabled={isLoading}
            className={`w-full flex items-center justify-center gap-3 py-3 px-5 rounded-2xl border font-mono text-xs tracking-wider transition-all duration-300 active:scale-[0.98] ${
              isFanOn
                ? 'border-blue-500/50 bg-blue-950/20 text-blue-400 shadow-[0_0_15px_rgba(59,130,246,0.15)] hover:bg-blue-950/35'
                : 'border-slate-800 bg-slate-950/60 text-slate-400 hover:bg-slate-900/50'
            }`}
          >
            <Power className={`w-4 h-4 transition-all duration-300 ${isFanOn ? 'animate-pulse' : ''}`} />
            <span>{isFanOn ? 'SYSTEM ACTIVE' : 'SYSTEM STANDBY'}</span>
          </button>

          {/* Status Label */}
          <div className="flex justify-between items-center text-[10px] text-slate-500 font-mono px-1">
            <span className="flex items-center gap-1">
              <Wind className="w-3 h-3 text-blue-500" /> FAN PORT: GPIO 13
            </span>
            <span className={isFanOn ? 'text-blue-400 animate-pulse' : 'text-slate-600'}>
              {isFanOn ? 'ON (100% DUTY)' : 'OFF (0% DUTY)'}
            </span>
          </div>
        </div>
      </div>
    </GlowCard>
  );
}
