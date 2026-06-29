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
  // Translate speed 0-255 to dynamic RPM (0 to ~4500 RPM)
  const rpm = data.fan === 0 ? 0 : Math.round((data.fan / 255) * 4500);
  const percentage = Math.round((data.fan / 255) * 100);

  // Compute CSS rotation animation duration based on speed
  // 0 speed = paused. Maximum speed = fast 0.2s duration.
  const getSpinStyle = () => {
    if (data.fan === 0) {
      return { animationPlayState: 'paused' };
    }
    // Interpolate: 255 -> 0.25s, 1 -> 3.0s
    const duration = 3.0 - (data.fan / 255) * 2.75;
    return {
      animationName: 'spin',
      animationDuration: `${duration}s`,
      animationIterationCount: 'infinite',
      animationTimingFunction: 'linear',
    };
  };

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onFanChange(parseInt(e.target.value, 10));
  };

  const handleToggle = () => {
    if (data.fan > 0) {
      onFanChange(0);
    } else {
      onFanChange(150); // standard starting speed
    }
  };

  return (
    <GlowCard
      id="card-fan-control"
      title="Climate Control"
      subtitle="VENTILATION & FAN SPEED"
      glowColor="blue"
      className="overflow-hidden"
      headerAction={
        <button
          id="btn-toggle-fan"
          onClick={handleToggle}
          disabled={isLoading}
          className={`p-2 rounded-xl border transition-all duration-300 ${
            data.fan > 0
              ? 'border-blue-500/40 bg-blue-950/20 text-blue-400 shadow-[0_0_10px_rgba(0,119,255,0.2)]'
              : 'border-slate-800 bg-slate-950/40 text-slate-500'
          }`}
        >
          <Power className="w-4 h-4" />
        </button>
      }
    >
      <div className="flex flex-col gap-6">
        {/* Animated Fan Blade SVG */}
        <div className="flex flex-col justify-center items-center py-4 relative">
          <div className="relative w-24 h-24 flex items-center justify-center">
            {/* Outer Fan Shroud / Ring */}
            <div className="absolute inset-0 rounded-full border border-dashed border-blue-500/30 animate-[spin_20s_linear_infinite]" />
            <div className="absolute inset-1 rounded-full border border-slate-900 bg-slate-950/40" />
            
            {/* SVG Blades */}
            <svg
              id="svg-fan-blades"
              className="w-16 h-16 text-blue-400 z-10 transition-transform duration-300"
              style={getSpinStyle()}
              viewBox="0 0 100 100"
            >
              {/* Central Cap */}
              <circle cx="50" cy="50" r="12" className="fill-blue-500 stroke-blue-300 stroke-[2px]" />
              
              {/* Blade 1 */}
              <path
                d="M50 38 C40 38 35 20 50 10 C65 20 60 38 50 38 Z"
                className="fill-blue-400/85 stroke-blue-300 stroke-[1px]"
              />
              {/* Blade 2 */}
              <path
                d="M62 50 C62 40 80 35 90 50 C80 65 62 60 62 50 Z"
                className="fill-blue-400/85 stroke-blue-300 stroke-[1px]"
              />
              {/* Blade 3 */}
              <path
                d="M50 62 C60 62 65 80 50 90 C35 80 40 62 50 62 Z"
                className="fill-blue-400/85 stroke-blue-300 stroke-[1px]"
              />
              {/* Blade 4 */}
              <path
                d="M38 50 C38 60 20 65 10 50 C20 35 38 40 38 50 Z"
                className="fill-blue-400/85 stroke-blue-300 stroke-[1px]"
              />
            </svg>
          </div>

          {/* Real-time Airflow Gust graphics removed per request */}
        </div>

        {/* Sliders and Info Panel */}
        <div>
          <div className="flex justify-between items-baseline mb-2">
            <span className="text-xs text-slate-400 font-mono flex items-center gap-1.5">
              <Wind className="w-3.5 h-3.5 text-blue-400" /> Fan Speed & Flow
            </span>
            <div className="flex items-baseline gap-1 font-mono">
              <span className="text-sm font-bold text-slate-100">{percentage}</span>
              <span className="text-[10px] text-slate-500">%</span>
              <span className="text-xs text-blue-400 font-semibold ml-2">{rpm} RPM</span>
            </div>
          </div>

          <div className="relative group flex items-center">
            <input
              id="slider-fan-speed"
              type="range"
              min="0"
              max="255"
              value={data.fan}
              onChange={handleSliderChange}
              disabled={isLoading}
              className="w-full h-2 rounded-lg bg-slate-900 border border-slate-800/80 appearance-none cursor-pointer focus:outline-none accent-blue-500 group-hover:border-slate-700 transition-colors duration-200"
            />
          </div>

          <div className="flex justify-between text-[10px] text-slate-500 font-mono mt-2">
            <span>STILL (0)</span>
            <span>HYPER-BLAST VENTILATION (255)</span>
          </div>
        </div>
      </div>
    </GlowCard>
  );
}
